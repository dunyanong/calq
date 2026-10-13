// Turns an AI evaluation plan into workings, with every number computed here.
//
// The model (functions/prompts.js STEPS_PROMPT) only says WHICH parts of the
// expression are worked out in each step and adds a short note.
// Each part is evaluated with math.js and replaced by its value. After every
// step the whole expression must still equal the original value, so a wrong
// order of operations or a misquoted part rejects the plan (null), and the
// panel shows "Couldn't explain this one" instead of steps that might be wrong.
//
// A step can instead "rewrite" the expression into an equivalent easier form
// (489×73 -> 489×70+489×3). Rewrites are the only place the model writes
// numbers, so they must match the original value almost exactly; later
// parts are quoted from the latest rewrite.
import { closeParens, evaluate, hasCalculus } from './engine';
import { asOperand } from './format';
import { normalizeExpr } from './normalize';

const MAX_STEPS = 12;

/**
 * True when a calculation is worth workings: more than one operation to explain,
 * or hard arithmetic such as 489×73 or 7488÷24 ("5+3" just shows its result).
 * ∫, d/dx, Σ and Π get none: stepsFromPlan cannot check workings for them.
 */
export const needsSteps = (expr) =>
  !hasCalculus(expr) &&
  ((expr.match(/[+−×÷^!²³⁻√∛(]/g) || []).length >= 2 || /\d{2,}[×÷]\d{2,}/.test(expr));

// Steps built from math.js values carry 10-digit rounding; model-written rewrites must be exact.
const same = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const EXACT = 1e-12;

/**
 * Where `part` occurs in `src`, without partly overlapping a span already
 * worked out (containing one is fine). Repeated text such as the second "2"
 * in "2+2" uses the first free occurrence.
 */
function locate(src, part, spans) {
  for (let at = src.indexOf(part); at >= 0; at = src.indexOf(part, at + 1)) {
    const end = at + part.length;
    const ok = spans.every(
      (s) => s.end <= at || s.start >= end || (s.start >= at && s.end <= end && !(s.start === at && s.end === end)),
    );
    if (ok) return at;
  }
  return -1;
}

/** Original text with each worked-out span replaced by its value. */
function render(src, spans) {
  let out = '';
  let i = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    let v = asOperand(s.value);
    // keep "2(3+4)" as "2(7)", not "27"
    if (!v.startsWith('(') && (/[\d.]$/.test(src.slice(0, s.start)) || /^[\d.]/.test(src.slice(s.end)))) {
      v = '(' + v + ')';
    }
    out += src.slice(i, s.start) + v;
    i = s.end;
  }
  return out + src.slice(i);
}

/**
 * @param {string} expr   expression as entered
 * @param {string} res    formatted result
 * @param {'deg'|'rad'|'grad'} angle
 * @param {{parts?: string[], rewrite?: string, note: string}[]} plan
 * @returns {{label: string, expr: string}[] | null}  null when the plan does not check out
 */
export function stepsFromPlan(expr, res, angle, plan) {
  let src = closeParens(expr);
  const target = evaluate(src, angle);
  if (target === null || !Array.isArray(plan) || plan.length === 0) return null;

  const steps = [{ label: 'Step 1 — expression as entered', expr }];
  const add = (label, e) => steps.push({ label: 'Step ' + (steps.length + 1) + ' — ' + label, expr: e });
  let spans = [];

  for (const step of plan.slice(0, MAX_STEPS)) {
    if (step.rewrite) {
      const rewritten = closeParens(normalizeExpr(step.rewrite));
      const v = evaluate(rewritten, angle);
      if (v === null || !same(v, target, EXACT)) return null;
      if (rewritten === render(src, spans)) continue;
      src = rewritten;
      spans = [];
      add(String(step.note || '').trim() || 'rewritten', rewritten);
      continue;
    }
    let next = spans;
    for (const raw of step.parts || []) {
      let part = String(raw);
      let at = locate(src, part, next);
      if (at < 0) {
        part = normalizeExpr(part); // model wrote "-" or "*"
        at = locate(src, part, next);
      }
      const value = at < 0 ? null : evaluate(part, angle);
      if (value === null) return null;
      const end = at + part.length;
      next = [...next.filter((s) => s.start < at || s.end > end), { start: at, end, value }];
    }
    if (next === spans) continue;

    const note = String(step.note || '').trim() || 'worked out';
    if (next.length === 1 && next[0].start === 0 && next[0].end === src.length) {
      add(note, '= ' + res); // the whole expression: this is the result
      return steps;
    }
    const shown = render(src, next);
    const v = evaluate(shown, angle);
    if (v === null || !same(v, target)) return null;
    spans = next;
    add(note, shown);
  }

  if (steps.length === 1) return null;
  add('result', '= ' + res);
  return steps;
}
