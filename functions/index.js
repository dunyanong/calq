// Calq Cloud Functions: AI features for signed-in users.
//   scanEquation      photo/screenshot -> expression in calculator notation (vision model)
//   explainSteps      expression -> evaluation plan with short notes (text model)
//   integrateFormula  f(x) -> antiderivative F(x) for ∫ without limits (text model);
//                     the app accepts F only if F′ = f numerically (math/symbolic.js)
//   studyNotes        calculations + their checked workings -> explanations for the
//                     AI study-notes export; the app drops any sentence with a number
//                     that is not in the calculation (features/export/studyNotes.js)
// The app checks everything returned here with its own math.js parser and
// computes every number itself, so the models never do arithmetic for the user.
//
// Config (see README "AI features"):
//   secret  LLM_API_KEY                 firebase functions:secrets:set LLM_API_KEY
//   params  LLM_BASE_URL, OCR_MODEL, STEPS_MODEL, SCANS_PER_DAY, STEPS_PER_DAY, INTEGRALS_PER_DAY,
//           NOTES_PER_DAY
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { chatJson } from './llm.js';
import { INTEGRAL_PROMPT, NOTES_OVERVIEW_PROMPT, NOTES_PROMPT, OCR_PROMPT, STEPS_PROMPT } from './prompts.js';

initializeApp();
const db = getFirestore();

const LLM_API_KEY = defineSecret('LLM_API_KEY');
const LLM_BASE_URL = defineString('LLM_BASE_URL', { default: 'https://openrouter.ai/api/v1' });
// Open-weights models (Apache 2.0). Any vision / text model on the provider works.
const OCR_MODEL = defineString('OCR_MODEL', { default: 'qwen/qwen3-vl-235b-a22b-instruct' });
const STEPS_MODEL = defineString('STEPS_MODEL', { default: 'qwen/qwen3-235b-a22b-2507' });
const SCANS_PER_DAY = defineInt('SCANS_PER_DAY', { default: 30 });
// Steps load when the AI button in the hold panel is tapped (cached per session in the app).
const STEPS_PER_DAY = defineInt('STEPS_PER_DAY', { default: 200 });
const INTEGRALS_PER_DAY = defineInt('INTEGRALS_PER_DAY', { default: 50 });
// One per AI study-notes export (each export makes up to 5 model calls).
const NOTES_PER_DAY = defineInt('NOTES_PER_DAY', { default: 20 });

const MAX_IMAGE_B64 = 3_000_000; // ~2.2 MB JPEG; the app sends ~200 KB
const MAX_EXPR = 200; // same limit as history items in firestore.rules
const OPTS = { secrets: [LLM_API_KEY], timeoutSeconds: 60, memory: '256MiB' };

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use this feature');
  return uid;
}

/**
 * Per-user daily quota in usage/{uid} (firestore.rules denies clients, the Admin SDK bypasses rules).
 * @param {'scan'|'steps'|'integral'|'notes'} kind
 */
async function useQuota(uid, kind, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc('usage/' + uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists && snap.get('day') === day ? snap.data() : { day, scan: 0, steps: 0, integral: 0, notes: 0 };
    if ((d[kind] || 0) >= limit) {
      throw new HttpsError('resource-exhausted', 'Daily limit reached, try again tomorrow');
    }
    tx.set(ref, { ...d, [kind]: (d[kind] || 0) + 1 });
  });
}

const llm = (model, messages, maxTokens, temperature = 0, timeoutMs = undefined) =>
  chatJson({ baseUrl: LLM_BASE_URL.value(), apiKey: LLM_API_KEY.value(), model, messages, maxTokens, temperature, timeoutMs });

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Angle units the app knows (src/components/AngleBadge.js); anything else is read as degrees.
const ANGLES = ['deg', 'rad', 'grad'];
const angleOf = (v) => (ANGLES.includes(v) ? v : 'deg');

/** request.data[name] as a non-empty expression of at most MAX_EXPR characters. */
function exprArg(request, name, message) {
  const v = request.data?.[name];
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_EXPR) throw new HttpsError('invalid-argument', message);
  return v;
}

// A retry follows an answer the app rejected: a little randomness gets a different one.
const temperatureOf = (request) => (request.data?.retry === true ? 0.6 : 0);

export const scanEquation = onCall(OPTS, async (request) => {
  const uid = requireUser(request);
  const image = request.data?.image;
  if (typeof image !== 'string' || !image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    throw new HttpsError('invalid-argument', 'Expected a base64 JPEG');
  }
  await useQuota(uid, 'scan', SCANS_PER_DAY.value());

  const reply = await llm(
    OCR_MODEL.value(),
    [
      { role: 'system', content: OCR_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe the calculation in this image.' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image } },
        ],
      },
    ],
    300,
  );
  return { expr: str(reply.expr, MAX_EXPR), note: str(reply.note, 80) };
});

export const explainSteps = onCall(OPTS, async (request) => {
  const uid = requireUser(request);
  const expr = exprArg(request, 'expr', 'Expected an expression');
  const angle = angleOf(request.data?.angle);
  await useQuota(uid, 'steps', STEPS_PER_DAY.value());

  const reply = await llm(
    STEPS_MODEL.value(),
    [
      { role: 'system', content: STEPS_PROMPT },
      { role: 'user', content: `Expression: ${expr}\nAngle: ${angle}` },
    ],
    1200,
    temperatureOf(request),
  );
  const steps = (Array.isArray(reply.steps) ? reply.steps : [])
    .slice(0, 12)
    .map((s) => ({
      parts: (Array.isArray(s?.parts) ? s.parts : []).map((p) => str(p, MAX_EXPR)).filter(Boolean).slice(0, 8),
      rewrite: str(s?.rewrite, MAX_EXPR),
      note: str(s?.note, 60),
    }))
    .filter((s) => s.parts.length > 0 || s.rewrite);
  return { steps };
});

export const integrateFormula = onCall(OPTS, async (request) => {
  const uid = requireUser(request);
  const f = exprArg(request, 'f', 'Expected a function of x');
  const angle = angleOf(request.data?.angle);
  await useQuota(uid, 'integral', INTEGRALS_PER_DAY.value());

  const reply = await llm(
    STEPS_MODEL.value(),
    [
      { role: 'system', content: INTEGRAL_PROMPT },
      { role: 'user', content: `f(x) = ${f}\nAngle: ${angle}` },
    ],
    400,
    temperatureOf(request),
  );
  return { F: str(reply.F, MAX_EXPR) };
});

const MAX_NOTE_ITEMS = 20; // same as MAX_NOTE_ITEMS in src/features/export/studyNotes.js
const MAX_WORKINGS = 13; // stepsFromPlan: "as entered" + at most 12 steps
const NOTES_CHUNK = 5; // calculations per model call; the calls run in parallel

/** request.data.items as [{ expr, result, angle, workings: ['label: expr', …] }], or invalid-argument. */
function noteItems(request) {
  const items = request.data?.items;
  const bad = () => new HttpsError('invalid-argument', 'Expected 1 to ' + MAX_NOTE_ITEMS + ' calculations');
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_NOTE_ITEMS) throw bad();
  return items.map((it) => {
    const expr = it?.expr;
    const result = it?.result;
    if ([expr, result].some((v) => typeof v !== 'string' || !v.trim() || v.length > MAX_EXPR)) throw bad();
    const workings = Array.isArray(it.workings) ? it.workings.slice(0, MAX_WORKINGS) : [];
    return {
      expr,
      result,
      angle: angleOf(it.angle),
      workings: workings.map((w) => str(w?.label, 100) + ': ' + str(w?.expr, MAX_EXPR)),
    };
  });
}

const list = (v, n, max) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => str(x, max)).filter(Boolean);

export const studyNotes = onCall({ ...OPTS, timeoutSeconds: 120 }, async (request) => {
  const uid = requireUser(request);
  const items = noteItems(request);
  await useQuota(uid, 'notes', NOTES_PER_DAY.value());

  const numbered = items.map((it, i) => ({ n: i + 1, ...it }));
  const chunks = [];
  for (let i = 0; i < numbered.length; i += NOTES_CHUNK) chunks.push(numbered.slice(i, i + NOTES_CHUNK));

  const ask = (prompt, data, maxTokens) =>
    llm(
      STEPS_MODEL.value(),
      [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Calculations:\n' + JSON.stringify(data) },
      ],
      maxTokens,
      0.2,
      90_000,
    );
  const [overview, ...parts] = await Promise.allSettled([
    ask(
      NOTES_OVERVIEW_PROMPT,
      numbered.map(({ n, expr, result, angle }) => ({ n, expr, result, angle })),
      600,
    ),
    ...chunks.map((chunk) => ask(NOTES_PROMPT, chunk, 2400)),
  ]);
  // the sections are the notes; without any of them there is nothing to export
  if (!parts.some((p) => p.status === 'fulfilled')) throw parts[0].reason;

  const sections = parts
    .flatMap((p, c) => {
      if (p.status !== 'fulfilled') return [];
      const chunk = chunks[c];
      return (Array.isArray(p.value.sections) ? p.value.sections : []).map((s) => {
        const n = Number(s?.n);
        // the model numbers sections like the calculations it got; only accept those
        if (!chunk.some((it) => it.n === n)) return null;
        return {
          n,
          title: str(s.title, 80),
          explanation: str(s.explanation, 700),
          // one per working, in order: keep empty ones so the rest stay in line
          why: (Array.isArray(s.why) ? s.why : []).slice(0, MAX_WORKINGS).map((x) => str(x, 200)),
          mistake: str(s.mistake, 250),
          tip: str(s.tip, 250),
        };
      });
    })
    .filter(Boolean);
  const o = overview.status === 'fulfilled' ? overview.value : {};
  return {
    title: str(o.title, 80),
    intro: str(o.intro, 400),
    keyIdeas: list(o.keyIdeas, 5, 160),
    summary: str(o.summary, 400),
    sections,
  };
});
