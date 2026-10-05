// "Workings" shown when you hold a calculation. Same idea as the prototype's
// buildSteps(): reduce the expression in a few readable passes.
// Steps are recomputed from expr + angle, so they are never stored.
import { evaluate, closeParens } from './engine';
import { asOperand } from './format';

// Each regex has two groups: [1] text to keep, [2] chunk to evaluate.
const FUNCS = /()((?:sin⁻¹|cos⁻¹|tan⁻¹|sinh|cosh|tanh|sin|cos|tan|log_b|log|ln|ˣ√|√|∛|abs|nPr|nCr|ceil|floor|gcd|lcm)\([^()]*\))/;
// A bracket group that is not a function call.
const GROUPS = /(^|[^a-zA-Z√∛¹_])(\([^()]+\))/;
// a×b or a÷b between plain numbers, not mixed up with ^ or postfix operators.
const PRODUCTS = /(^|[^0-9.)^])(\d+(?:\.\d+)?[×÷]\d+(?:\.\d+)?)(?![0-9.^²³⁻!(])/;

function reduceOnce(src, re, angle) {
  let s = src;
  for (let guard = 0; guard < 8; guard++) {
    const m = re.exec(s);
    if (!m) break;
    const v = evaluate(m[2], angle);
    if (v === null) break;
    const start = m.index + m[1].length;
    s = s.slice(0, start) + asOperand(v) + s.slice(start + m[2].length);
  }
  return s;
}

/**
 * @param {string} expr  expression as entered
 * @param {string} res   formatted result
 * @param {'deg'|'rad'} angle
 * @returns {{label: string, expr: string}[]}
 */
export function buildSteps(expr, res, angle = 'deg') {
  const steps = [{ label: 'Step 1 — expression as entered', expr }];
  const add = (label, e) => steps.push({ label: 'Step ' + (steps.length + 1) + ' — ' + label, expr: e });

  const closed = closeParens(expr);
  const fns = reduceOnce(closed, FUNCS, angle);
  if (fns !== closed) add('functions evaluated', fns);

  const grouped = reduceOnce(fns, GROUPS, angle);
  if (grouped !== fns) add('grouped terms resolved', grouped);

  const md = reduceOnce(grouped, PRODUCTS, angle);
  if (md !== grouped) add('products and quotients', md);

  add('result', '= ' + res);
  return steps;
}
