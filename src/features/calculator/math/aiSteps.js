// Workings for the hold panel and the study notes, with every number computed here.
//
// localSteps() builds them on the device, instantly: it parses the calculation and
// works it out in order of operations (functions and brackets, powers, × ÷, + −).
//
// stepsFromPlan() checks an optional AI plan, which can add tricks for hard
// arithmetic and friendlier notes. The model (functions/prompts.js STEPS_PROMPT) only says WHICH parts of the
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
import { closeParens, evaluate, isHeavy, usesComplex } from './engine';
import { asOperand } from './format';
import { normalizeExpr } from './normalize';

const MAX_STEPS = 12;

/**
 * True when a calculation is worth workings: more than one operation to explain,
 * or hard arithmetic such as 489×73 or 7488÷24 ("5+3" just shows its result).
 * ∫, d/dx, Σ, Π and the other slow keys get none, nor do matrices or complex numbers:
 * stepsFromPlan checks workings with real numbers only.
 */
export const needsSteps = (expr) =>
  !isHeavy(expr) &&
  !/[[\]ᵀ=≤≥∞]/.test(expr) &&
  !usesComplex(expr) &&
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

/**
 * Original text with each worked-out span replaced by its value.
 * @param {boolean} [besideDivide]  also bracket values next to ÷: math.js reads 49÷2(3) as
 *   (49÷2)(3) but (7)²÷2(3) as 49÷(2(3)), so (49)÷2(3) keeps the meaning
 */
function render(src, spans, besideDivide = false) {
  let out = '';
  let i = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    let v = asOperand(s.value);
    // keep "2(3+4)" as "2(7)", not "27"
    const glued = /[\d.]$/.test(src.slice(0, s.start)) || /^[\d.]/.test(src.slice(s.end));
    const divide = besideDivide && (src[s.start - 1] === '÷' || src[s.end] === '÷');
    if (!v.startsWith('(') && (glued || divide)) {
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

// ---- workings without AI -------------------------------------------------------

// Functions written with symbols; any other name followed by "(" is a function too.
const SYMBOL_FNS = ['sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'ˣ√(', '√(', '∛(', 'φ('];
const POSTFIX = ['⁻¹', '²', '³', '!', '%'];
const MINUS = ['−', '-'];

class NoParse extends Error {}

/**
 * The display expression as a tree of { kind, start, end, children, op, name }.
 * Brackets are not nodes of their own: a bracketed node's span includes them.
 * Same precedence as math.js: functions and brackets, postfix, ^ (right to left),
 * unary minus (part of the node it applies to), implicit products (2π, 2(3)), × ÷, then + −.
 * Like math.js, number ÷ number before an implicit product goes first: 6÷2(3) is (6÷2)(3),
 * but π÷2(3) is π÷(2(3)).
 */
function parseDisplay(src) {
  let i = 0;
  const peek = (t) => src.startsWith(t, i);
  const leaf = (start) => ({ kind: 'leaf', start, end: i, children: [] });

  const number = () => {
    const m = /^(\d+\.?\d*|\.\d+)(E[−+-]?\d+)?/.exec(src.slice(i));
    if (!m) return null;
    const start = i;
    i += m[0].length;
    return leaf(start);
  };

  function primary() {
    const start = i;
    const n = number();
    if (n) return n;
    if (peek('π') || peek('e')) {
      i += 1; // e^(…) is e, then ^ in power()
      return leaf(start);
    }
    if (peek('(')) {
      i++;
      const inner = sum();
      if (!peek(')')) throw new NoParse();
      i++;
      return { ...inner, start, end: i, wrapped: true };
    }
    const name = SYMBOL_FNS.find((f) => peek(f)) || /^[A-Za-z][A-Za-z_]*\(/.exec(src.slice(i))?.[0];
    if (!name) throw new NoParse();
    i += name.length;
    const args = [sum()];
    while (peek(',')) {
      i++;
      args.push(sum());
    }
    if (!peek(')')) throw new NoParse();
    i++;
    return { kind: 'call', name: name.slice(0, -1), start, end: i, children: args };
  }

  function postfix() {
    let node = primary();
    for (let op = POSTFIX.find(peek); op; op = POSTFIX.find(peek)) {
      i += op.length;
      // 10% is worked out together with what it is a percentage of (200+10%)
      node = op === '%' ? { kind: 'leaf', start: node.start, end: i, children: [] } : { kind: 'post', op, start: node.start, end: i, children: [node] };
    }
    return node;
  }

  function power() {
    const base = postfix();
    if (!peek('^')) return base;
    i++;
    const exp = unary();
    // x²^y is x^(2^y), like math.js: the ² belongs to the power, not to x
    const children = base.kind === 'post' && (base.op === '²' || base.op === '³') ? [base.children[0], exp] : [base, exp];
    return { kind: 'pow', op: '^', start: base.start, end: exp.end, children };
  }

  function unary() {
    const start = i;
    if (MINUS.some(peek) || peek('+')) {
      i++;
      const inner = unary();
      // −5 is just a number; −2² and −sin(30) are worked out with their minus
      if (inner.kind === 'leaf' && !inner.wrapped) return leaf(start);
      return { ...inner, start };
    }
    return power();
  }

  const startsOperand = () => i < src.length && !['+', '−', '-', '×', '÷', ')', ',', '^'].some(peek) && !POSTFIX.some(peek);
  const mul = (op, left, right) => ({ kind: 'mul', op, start: left.start, end: right.end, children: [left, right] });
  const isNumber = (n) => n.kind === 'leaf' && !n.wrapped && /^[−-]?[\d.]/.test(src.slice(n.start, n.end));

  /** A unary, then 6÷2 when another number and an implicit product follow (math.js "rule 2"). */
  function rule2() {
    let node = unary();
    while (peek('÷') && isNumber(node)) {
      const back = i;
      i++;
      const n = number();
      if (n && startsOperand()) node = mul('÷', node, n);
      else {
        i = back;
        break;
      }
    }
    return node;
  }

  /** 2π, 3sin(30), 2(3+4): tighter than × and ÷. */
  function implicit() {
    let left = rule2();
    while (startsOperand()) left = mul('×', left, rule2());
    return left;
  }

  function product() {
    let left = implicit();
    while (peek('×') || peek('÷')) {
      const op = src[i];
      i++;
      left = mul(op, left, implicit());
    }
    return left;
  }

  function sum() {
    let left = product();
    while (peek('+') || MINUS.some(peek)) {
      const op = peek('+') ? '+' : '−';
      i++;
      const right = product();
      left = { kind: 'add', op, start: left.start, end: right.end, children: [left, right] };
    }
    return left;
  }

  const tree = sum();
  if (i !== src.length) throw new NoParse();
  return tree;
}

// Worked out first when several kinds are ready: brackets and functions, then powers, × ÷, + −.
const PRIORITY = { call: 4, post: 3, pow: 3, mul: 2, add: 1 };
const priority = (n) => (n.wrapped ? 5 : PRIORITY[n.kind]);
const FN_NAMES = {
  sin: 'Sine', cos: 'Cosine', tan: 'Tangent', 'sin⁻¹': 'Inverse sine', 'cos⁻¹': 'Inverse cosine', 'tan⁻¹': 'Inverse tangent',
  sinh: 'Hyperbolic sine', cosh: 'Hyperbolic cosine', tanh: 'Hyperbolic tangent', '√': 'Square root', '∛': 'Cube root',
  'ˣ√': 'Root', log: 'Log', ln: 'Natural log', log_b: 'Log', abs: 'Absolute value', nPr: 'Permutations',
  nCr: 'Combinations', gcd: 'Greatest common divisor', lcm: 'Least common multiple',
};
const DEGREE_SIGN = { deg: '°', grad: ' grad', rad: ' rad' };

/** Short label for the nodes worked out in one step. */
function stepLabel(nodes, src, angle) {
  if (nodes.every((n) => n.wrapped && n.kind !== 'call')) return 'Brackets first';
  const kind = nodes[0].kind;
  if (kind === 'call') {
    if (nodes.length > 1) return 'Functions first';
    const [n] = nodes;
    const name = FN_NAMES[n.name] || n.name[0].toUpperCase() + n.name.slice(1);
    const arg = n.children[0];
    const trig = /^(sin|cos|tan)$/.test(n.name) && n.children.length === 1 && arg.kind === 'leaf';
    return trig ? `${name} of ${src.slice(arg.start, arg.end)}${DEGREE_SIGN[angle] ?? ''}` : name;
  }
  if (kind === 'post' || kind === 'pow') {
    const ops = new Set(nodes.map((n) => n.op));
    if (ops.size === 1 && ops.has('!')) return 'Factorial';
    if (ops.size === 1 && ops.has('⁻¹')) return 'Reciprocal';
    return 'Powers first';
  }
  const ops = new Set(nodes.map((n) => n.op));
  if (kind === 'mul') return ops.size > 1 ? 'Multiply and divide, left to right' : ops.has('÷') ? 'Divide' : 'Multiply';
  return ops.size > 1 ? 'Add and subtract, left to right' : ops.has('+') ? 'Add' : 'Subtract';
}

/**
 * Workings without AI, in order of operations; each step is checked like an AI plan
 * (the shown expression must keep the value of the original).
 * @param {string} expr  expression as entered
 * @param {string} res   formatted result
 * @returns {{label: string, expr: string}[] | null}  null when it cannot be parsed or checked
 */
export function localSteps(expr, res, angle) {
  const src = closeParens(expr);
  const target = evaluate(src, angle);
  if (target === null) return null;
  let tree;
  try {
    tree = parseDisplay(src);
  } catch {
    return null;
  }
  if (tree.kind === 'leaf') return null;

  const nodes = [];
  const parent = new Map();
  const walk = (n) => {
    n.children.forEach((c) => {
      parent.set(c, n);
      walk(c);
    });
    if (n.kind !== 'leaf') nodes.push(n);
  };
  walk(tree);
  // 1+2+3+4 is one step, not three: a node whose parent continues the same chain
  // (no brackets in between) is shown together with it
  const chained = (n) => {
    const p = parent.get(n);
    return !n.wrapped && p && p.kind === n.kind && (n.kind === 'add' || n.kind === 'mul');
  };

  const steps = [{ label: 'Step 1 — expression as entered', expr }];
  const add = (label, e) => steps.push({ label: 'Step ' + (steps.length + 1) + ' — ' + label, expr: e });
  const done = new Set();
  const isDone = (n) => n.kind === 'leaf' || done.has(n);
  let spans = [];
  let carried = []; // chain links worked out but not shown yet
  let carriedShown = '';

  for (;;) {
    const ready = nodes.filter((n) => !done.has(n) && n.children.every(isDone));
    const top = Math.max(...ready.map(priority));
    const chosen = ready.filter((n) => priority(n) === top);
    // the chain so far is a step of its own when something else comes next
    if (carried.length && chosen.some((n) => n.kind !== carried[0].kind || n.wrapped)) {
      if (steps.length < MAX_STEPS) add(stepLabel(carried, src, angle), carriedShown);
      carried = [];
    }
    const label = stepLabel([...carried, ...chosen], src, angle);
    if (chosen.includes(tree)) {
      add(label, '= ' + res);
      return steps;
    }
    let next = spans;
    for (const n of chosen) {
      const value = evaluate(src.slice(n.start, n.end), angle);
      if (value === null) return null;
      next = [...next.filter((s) => s.start < n.start || s.end > n.end), { start: n.start, end: n.end, value }];
      done.add(n);
    }
    const keeps = (text) => {
      const v = evaluate(text, angle);
      return v !== null && same(v, target);
    };
    let shown = render(src, next);
    if (!keeps(shown)) shown = render(src, next, true);
    if (!keeps(shown)) return null;
    spans = next;
    if (chosen.every(chained)) {
      carried = [...carried, ...chosen];
      carriedShown = shown;
      continue;
    }
    carried = [];
    // a very long calculation stops listing steps at MAX_STEPS; the result still follows
    if (steps.length < MAX_STEPS) add(label, shown);
  }
}
