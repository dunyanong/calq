// AI study notes for the export ("Include AI explanation?" → With AI explanation).
//
// Same rule as the rest of the app: the model writes only prose. The workings come
// from stepsFromPlan, which recomputes every value with math.js; results come from
// the saved calculations. Every sentence the model writes is checked, and dropped if
//   - it has a number that is not in its calculation (or a small count / angle fact)
//   - it says what an expression is worth (`A=B`, "`A` gives 2") and the engine disagrees
// so a miscalculated, invented or misattributed value never reaches the notes.
import { needsSteps, stepsFromPlan } from '@/features/calculator/math/aiSteps';
import { evaluate } from '@/features/calculator/math/engine';
import { normalizeExpr } from '@/features/calculator/math/normalize';
import { explainSteps, studyNotes } from '@/services/ai';

/** Formats that become study notes; CSV and Text always export as they are. */
export const AI_FORMATS = ['markdown', 'latex', 'pdf'];
export const MAX_NOTE_ITEMS = 20; // same limit as studyNotes in functions/index.js
const STEP_CALLS = 4; // explainSteps calls at a time

// Numbers the prose may use without them being in the calculation: small counts and
// angle facts (special angles, right angle, half and full turn in degrees and gradians).
const FREE = [...Array(13).keys(), 30, 45, 60, 90, 180, 360, 50, 100, 200, 400];

// "½" states a value just like "0.5" does
const FRACTIONS = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅛': 1 / 8 };

const numbersIn = (s) => [
  ...(String(s).match(/\d+(?:\.\d+)?/g) || []).map(Number),
  ...[...String(s)].filter((c) => c in FRACTIONS).map((c) => FRACTIONS[c]),
];

/** Every number in these texts, plus the free ones. */
const allowedIn = (texts) => new Set([...FREE, ...texts.flatMap(numbersIn)]);

/** A side of a claim as a number: a plain number, or an expression the engine works out; null if it cannot. */
function valueOf(text, angle) {
  const s = text.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return s ? evaluate(normalizeExpr(s), angle) : null;
}

// "`tan(50)` gives `1`", "`nCr(5,2)` is 10", "`3!` equals 6" (a few words may come between)
const CLAIM = /`([^`]+)`[^`.;:]{0,30}?\b(?:gives|is|equals|evaluates to|becomes|comes to)\s+(?:`([^`]+)`|(-?\d+(?:\.\d+)?)\b)/g;

/**
 * True unless the sentence says an expression is worth something the engine disagrees
 * with, in every one of the angle units. Claims about formulas (x², d/dx(x³)) cannot be
 * worked out to a number and are left alone.
 */
function claimsHold(sentence, angles) {
  const pairs = [];
  sentence
    .split('`')
    .filter((_, i) => i % 2)
    .forEach((span) => {
      const sides = span.split('=');
      for (let i = 1; i < sides.length; i++) pairs.push([sides[i - 1], sides[i]]);
    });
  for (const m of sentence.matchAll(CLAIM)) pairs.push([m[1], m[2] ?? m[3]]);
  return pairs.every(([a, b]) => {
    let checked = false;
    for (const angle of angles) {
      const x = valueOf(a, angle);
      const y = valueOf(b, angle);
      if (x === null || y === null) continue;
      checked = true;
      // results are shown to 10 digits: 0.3333333333 is 1/3
      if (Math.abs(x - y) <= 1e-8 * Math.max(1, Math.abs(x), Math.abs(y))) return true;
    }
    return !checked;
  });
}

/** Splits prose into sentences (a decimal point is not followed by a space). */
function sentences(s) {
  const out = [];
  let start = 0;
  for (const m of s.matchAll(/[.!?]+\s+/g)) {
    out.push(s.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  out.push(s.slice(start).trim());
  return out.filter(Boolean);
}

/**
 * The model's text, cleaned up: one line, no markup outside `maths` spans (an
 * unpaired backtick drops them all), each sentence kept only if its numbers are
 * allowed and its claims hold in one of the angle units, cut to max characters at
 * a sentence end.
 * @param {Set<number>} allowed
 * @param {string[]} [angles]  units to check claims in; none: claims are not checked
 */
export function guard(text, allowed, max, angles = []) {
  if (typeof text !== 'string') return '';
  let s = text;
  if ((s.match(/`/g) || []).length % 2) s = s.replace(/`/g, '');
  s = s
    .split('`')
    .map((part, i) => (i % 2 ? part : part.replace(/<[^>]*>/g, '').replace(/[*_#]/g, '')))
    .join('`')
    .replace(/\s+/g, ' ')
    .trim();
  let out = '';
  for (const sentence of sentences(s)) {
    if (!numbersIn(sentence).every((n) => allowed.has(n)) || !claimsHold(sentence, angles)) continue;
    const next = out ? out + ' ' + sentence : sentence;
    if (next.length > max) break;
    out = next;
  }
  return out;
}

/** Runs fn over list with at most limit calls in flight; results keep their order. */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

/**
 * Checked workings for one calculation (the same ones the hold panel shows),
 * without step 1 (the expression itself): [{ label, expr }], or [] when there are
 * none, the plan did not check out, or the steps call failed (quota, network).
 */
async function workingsFor(item) {
  if (!needsSteps(item.expr)) return [];
  try {
    const steps = stepsFromPlan(item.expr, item.result, item.angle, await explainSteps(item.expr, item.angle));
    return steps ? steps.slice(1).map((s) => ({ label: s.label.replace(/^Step \d+ — /, ''), expr: s.expr })) : [];
  } catch {
    return [];
  }
}

/**
 * The model's reply as notes that are safe to print. Sections are matched to the
 * calculations by number; a missing one keeps the calculation and its workings
 * with no prose.
 * @param {object} reply  studyNotes() result
 * @param {object[]} picked  the calculations the notes cover (oldest first)
 * @param {{label: string, expr: string}[][]} workings  checked workings per picked item
 * @param {object[]} all  every exported calculation (listed at the end)
 */
export function checkNotes(reply, picked, workings, all) {
  const r = reply && typeof reply === 'object' ? reply : {};
  const replySections = Array.isArray(r.sections) ? r.sections : [];
  const everyNumber = allowedIn(picked.flatMap((it, i) => [it.expr, it.result, ...(workings[i] || []).map((w) => w.expr)]));
  const everyAngle = [...new Set(picked.map((it) => it.angle))];
  const top = (text, max) => guard(text, everyNumber, max, everyAngle);

  const sections = picked.map((item, i) => {
    const steps = workings[i] || [];
    const allowed = allowedIn([item.expr, item.result, ...steps.map((w) => w.expr)]);
    const check = (text, max) => guard(text, allowed, max, [item.angle]);
    const s = replySections.find((x) => Number(x?.n) === i + 1) || {};
    const why = Array.isArray(s.why) ? s.why : [];
    return {
      item,
      title: check(s.title, 80),
      explanation: check(s.explanation, 700),
      workings: steps.map((w, k) => ({
        expr: w.expr,
        // step notes come from the steps model too: same check
        label: check(w.label, 60) || 'worked out',
        why: check(why[k], 200),
      })),
      mistake: check(s.mistake, 250),
      tip: check(s.tip, 250),
    };
  });

  return {
    title: top(r.title, 80) || 'Calq study notes',
    intro: top(r.intro, 400),
    keyIdeas: (Array.isArray(r.keyIdeas) ? r.keyIdeas : []).map((k) => top(k, 160)).filter(Boolean).slice(0, 5),
    summary: top(r.summary, 400),
    sections,
    all,
  };
}

/**
 * Study notes for the most recent MAX_NOTE_ITEMS of items: checked workings first
 * (cached per session, like the hold panel's), then the explanations.
 * @param {(phase: 'steps'|'notes') => void} [onPhase]  for the progress message
 * @returns {Promise<ReturnType<typeof checkNotes>>}  throws a user-facing Error from services/ai
 */
export async function makeStudyNotes(items, { onPhase = () => {} } = {}) {
  const picked = items.slice(-MAX_NOTE_ITEMS);
  if (picked.some((it) => needsSteps(it.expr))) onPhase('steps');
  const workings = await mapLimit(picked, STEP_CALLS, workingsFor);
  onPhase('notes');
  const reply = await studyNotes(
    picked.map((it, i) => ({ expr: it.expr, result: it.result, angle: it.angle, workings: workings[i] })),
  );
  return checkNotes(reply, picked, workings, items);
}
