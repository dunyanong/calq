// Calq Cloud Functions: AI features for signed-in users.
//   scanEquation  photo/screenshot -> expression in calculator notation (vision model)
//   explainSteps  expression -> evaluation plan with short notes (text model)
// The app checks everything returned here with its own math.js parser and
// computes every number itself, so the models never do arithmetic for the user.
//
// Config (see README "AI features"):
//   secret  LLM_API_KEY                 firebase functions:secrets:set LLM_API_KEY
//   params  LLM_BASE_URL, OCR_MODEL, STEPS_MODEL, SCANS_PER_DAY, STEPS_PER_DAY
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { chatJson } from './llm.js';
import { OCR_PROMPT, STEPS_PROMPT } from './prompts.js';

initializeApp();
const db = getFirestore();

const LLM_API_KEY = defineSecret('LLM_API_KEY');
const LLM_BASE_URL = defineString('LLM_BASE_URL', { default: 'https://openrouter.ai/api/v1' });
// Open-weights models (Apache 2.0). Any vision / text model on the provider works.
const OCR_MODEL = defineString('OCR_MODEL', { default: 'qwen/qwen3-vl-235b-a22b-instruct' });
const STEPS_MODEL = defineString('STEPS_MODEL', { default: 'qwen/qwen3-235b-a22b-2507' });
const SCANS_PER_DAY = defineInt('SCANS_PER_DAY', { default: 30 });
// Steps load on every hold of a complicated calculation (cached per session in the app).
const STEPS_PER_DAY = defineInt('STEPS_PER_DAY', { default: 200 });

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
 * @param {'scan'|'steps'} kind
 */
async function useQuota(uid, kind, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc('usage/' + uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists && snap.get('day') === day ? snap.data() : { day, scan: 0, steps: 0 };
    if ((d[kind] || 0) >= limit) {
      throw new HttpsError('resource-exhausted', 'Daily limit reached, try again tomorrow');
    }
    tx.set(ref, { ...d, [kind]: (d[kind] || 0) + 1 });
  });
}

const llm = (model, messages, maxTokens, temperature = 0) =>
  chatJson({ baseUrl: LLM_BASE_URL.value(), apiKey: LLM_API_KEY.value(), model, messages, maxTokens, temperature });

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
  const expr = request.data?.expr;
  const angle = request.data?.angle === 'rad' ? 'rad' : 'deg';
  if (typeof expr !== 'string' || !expr.trim() || expr.length > MAX_EXPR) {
    throw new HttpsError('invalid-argument', 'Expected an expression');
  }
  await useQuota(uid, 'steps', STEPS_PER_DAY.value());

  const reply = await llm(
    STEPS_MODEL.value(),
    [
      { role: 'system', content: STEPS_PROMPT },
      { role: 'user', content: `Expression: ${expr}\nAngle: ${angle}` },
    ],
    1200,
    request.data?.retry === true ? 0.6 : 0, // a retry follows a plan the app rejected: try another one
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
