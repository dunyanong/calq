// Formulas instead of numbers:
//   d/dx(f) without a point -> f′(x), worked out here with math.js derivative
//   ∫(f) without limits     -> F(x)+C, proposed by the AI (functions/index.js)
//
// Nothing is shown unchecked. A derivative is printed back into calculator
// notation and compared with math.js at sample points; an AI antiderivative
// is accepted only if its numeric derivative equals f at every sample point.
import { closeParens, evaluateNode, fnOfExpr, hasCalculus, math, toMathjs } from './engine';
import { differentiate } from './calculus';
import { callArgs } from './entry';
import { formatNumber } from './format';
import { normalizeExpr } from './normalize';

// Spread out, away from 0, inside (−1, 1) too (√(1−x²)), and large enough to see
// a missing 180÷π in degree mode. Points where f is undefined are skipped.
const SAMPLES = [0.13, 0.37, 0.59, 0.81, -0.29, -0.43, -0.71, 1.29, 1.83, 2.47, 3.61, 5.3, -1.17, -2.71, 7.9, 12.3, -33.3, 47.1];

// math.js simplify, plus 1/2/√x -> 1/(2√x) style clean-ups
const RULES = [...math.simplify.rules, 'n1 / n2 / n3 -> n1 / (n2 * n3)', 'n1 * (n2 / n3) -> (n1 * n2) / n3'];

// Degree mode: the calculator's sin(x) is sin(x·deg_) with deg_ = π/180.
const DEG = 'deg_';
const DEG_SCOPE = { [DEG]: Math.PI / 180 };

const sym = (name) => new math.SymbolNode(name);
const call = (name, args) => new math.FunctionNode(name, args);
const op = (o, fn, args) => new math.OperatorNode(o, fn, args);
const usesX = (node) => node.filter((n) => math.isSymbolNode(n) && n.name === 'x').length > 0;

const TRIG = { tsin: 'sin', tcos: 'cos', ttan: 'tan' };
const ARC = { tasin: 'asin', tacos: 'acos', tatan: 'atan' };
const NUMERIC = new Set(['integ', 'deriv', 'sumx', 'prodx']);

class Unsupported extends Error {}

/**
 * Engine tree (tsin, logb, nroot …) -> standard math.js functions that
 * derivative understands; d/dx(f) without a point becomes its derivative.
 */
function toStandard(node, angle) {
  const deg = angle === 'deg';
  if (math.isFunctionNode(node)) {
    const name = node.fn.name;
    if (name === 'deriv' && node.args.length === 1) {
      return math.derivative(toStandard(node.args[0], angle), 'x', { simplify: false });
    }
    if (NUMERIC.has(name)) {
      // a numeric ∫, d/dx, Σ or Π with fixed limits is just a number here
      if (node.args.slice(1).some(usesX)) throw new Unsupported();
      return new math.ConstantNode(evaluateNode(node, angle));
    }
    const args = node.args.map((a) => toStandard(a, angle));
    if (TRIG[name]) return call(TRIG[name], [deg ? op('*', 'multiply', [args[0], sym(DEG)]) : args[0]]);
    if (ARC[name]) return deg ? op('/', 'divide', [call(ARC[name], args), sym(DEG)]) : call(ARC[name], args);
    if (name === 'logb') return call('log', [args[1], args[0]]); // log_b(b, x) -> log(x, b)
    if (name === 'nroot') return call('nthRoot', [args[1], args[0]]); // ˣ√(n, x) -> nthRoot(x, n)
    return call(name, args);
  }
  return node.map((child) => toStandard(child, angle));
}

// sec, csc, cot (from derivative) are not calculator keys
const RECIPROCAL = { sec: 'cos', csc: 'sin', cot: 'tan', sech: 'cosh', csch: 'sinh', coth: 'tanh' };
const reciprocals = (node) =>
  node.transform((n) =>
    math.isFunctionNode(n) && RECIPROCAL[n.fn.name]
      ? op('/', 'divide', [new math.ConstantNode(1), call(RECIPROCAL[n.fn.name], n.args.map(reciprocals))])
      : n,
  );

// ---- printing back to calculator notation ------------------------------------

const P = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 };
const NAMES = {
  sin: 'sin', cos: 'cos', tan: 'tan', asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', log10: 'log', sqrt: '√', cbrt: '∛', abs: 'abs',
};
const wrap = ([s, p], min) => (p < min ? '(' + s + ')' : s);

/** A positive constant as text: 3, 2÷3, ln(2), 1÷ln(10), π÷2, else 10 digits. */
function constant(v) {
  if (Number.isInteger(v)) return [String(v), P.atom];
  for (let k = 2; k <= 20; k++) {
    if (Math.abs(v - Math.log(k)) < 1e-12) return ['ln(' + k + ')', P.atom];
    if (Math.abs(v - 1 / Math.log(k)) < 1e-12) return ['1÷ln(' + k + ')', P.mul];
  }
  for (let q = 2; q <= 64; q++) {
    const p = Math.round(v * q);
    if (Math.abs(v * q - p) < 1e-9) return [p + '÷' + q, P.mul];
  }
  for (let q = 1; q <= 12; q++) {
    const p = Math.round((v / Math.PI) * q);
    if (p > 0 && Math.abs((v / Math.PI) * q - p) < 1e-9) {
      return [(p === 1 ? '' : p) + 'π' + (q === 1 ? '' : '÷' + q), q === 1 ? P.atom : P.mul];
    }
  }
  const s = formatNumber(v);
  return [s, s.includes('×') ? P.mul : P.atom];
}

/** node / deg_, for a trig argument in degree mode (x·deg_ -> x); null if deg_ is not a factor. */
function withoutDeg(node) {
  if (math.isParenthesisNode(node)) return withoutDeg(node.content);
  if (math.isSymbolNode(node) && node.name === DEG) return new math.ConstantNode(1);
  if (!math.isOperatorNode(node)) return null;
  const [a, b] = node.args;
  if (node.fn === 'multiply') {
    const left = withoutDeg(a);
    if (left) return op('*', 'multiply', [left, b]);
    const right = withoutDeg(b);
    return right ? op('*', 'multiply', [a, right]) : null;
  }
  if (node.fn === 'divide') {
    const top = withoutDeg(a);
    return top ? op('/', 'divide', [top, b]) : null;
  }
  if (node.fn === 'unaryMinus') {
    const inner = withoutDeg(a);
    return inner ? op('-', 'unaryMinus', [inner]) : null;
  }
  if (node.fn === 'add' || node.fn === 'subtract') {
    const l = withoutDeg(a);
    const r = withoutDeg(b);
    return l && r ? op(node.op, node.fn, [l, r]) : null;
  }
  return null;
}

/** [text, precedence] in calculator notation. Throws on anything it cannot write. */
function print(node, deg) {
  if (math.isParenthesisNode(node)) return print(node.content, deg);
  if (math.isConstantNode(node)) {
    const v = Number(node.value);
    if (v < 0) return ['−' + wrap(constant(-v), P.pow), P.neg];
    return constant(v);
  }
  if (math.isSymbolNode(node)) {
    const s = { x: 'x', pi: 'π', e: 'e', [DEG]: '(π÷180)' }[node.name];
    if (!s) throw new Unsupported();
    return [s, P.atom];
  }
  if (math.isFunctionNode(node)) return printCall(node, deg);
  if (!math.isOperatorNode(node)) throw new Unsupported();

  const [a, b] = node.args;
  switch (node.fn) {
    case 'unaryPlus':
      return print(a, deg);
    case 'unaryMinus':
      return ['−' + wrap(print(a, deg), P.mul), P.neg];
    case 'add': {
      const r = print(b, deg)[0];
      return [print(a, deg)[0] + (r.startsWith('−') ? r : '+' + r), P.add];
    }
    case 'subtract':
      return [print(a, deg)[0] + '−' + wrap(print(b, deg), P.mul), P.add];
    case 'multiply': {
      const [p, q] = math.isConstantNode(b) && !math.isConstantNode(a) ? [b, a] : [a, b]; // x·2 -> 2x
      if (math.isConstantNode(p) && Number(p.value) === -1) return ['−' + wrap(print(q, deg), P.mul), P.neg];
      const l = print(p, deg);
      const r = print(q, deg);
      // a factor without x leads: 2x, 3sin(x), 2πx, π(x+1), (π÷180)cos(x); otherwise an explicit ×
      // (a top-level ÷ would swallow what follows: 1÷ln(2)×x must keep its ×)
      const coefficient = !usesX(p) && (l[1] === P.atom || !l[0].includes('÷'));
      if (coefficient && !/^[\d.−]/.test(wrap(r, P.mul))) {
        return [wrap(l, P.mul) + wrap(r, P.pow), l[1] === P.neg ? P.neg : P.mul];
      }
      return [wrap(l, P.mul) + '×' + wrap(r, P.neg), P.mul];
    }
    case 'divide':
      return [wrap(print(a, deg), P.mul) + '÷' + wrap(print(b, deg), P.neg + 1), P.mul];
    case 'pow': {
      const base = wrap(print(a, deg), P.atom);
      if (math.isConstantNode(b) && [2, 3, -1].includes(Number(b.value))) {
        return [base + { 2: '²', 3: '³', '-1': '⁻¹' }[Number(b.value)], P.pow];
      }
      const e = print(b, deg);
      return [base + '^' + (e[1] === P.atom && !e[0].startsWith('−') ? e[0] : '(' + e[0] + ')'), P.pow];
    }
    default:
      throw new Unsupported();
  }
}

function printCall(node, deg) {
  const name = node.fn.name;
  const args = node.args;
  const inner = (n) => print(n, deg)[0];
  if (deg && ['sin', 'cos', 'tan'].includes(name)) {
    const angle = withoutDeg(args[0]);
    if (!angle) throw new Unsupported();
    return [name + '(' + inner(math.simplify(angle)) + ')', P.atom];
  }
  if (name === 'log') {
    return args.length === 2 ? ['log_b(' + inner(args[1]) + ',' + inner(args[0]) + ')', P.atom] : ['ln(' + inner(args[0]) + ')', P.atom];
  }
  if (name === 'nthRoot') {
    return args.length === 2 ? ['ˣ√(' + inner(args[1]) + ',' + inner(args[0]) + ')', P.atom] : ['√(' + inner(args[0]) + ')', P.atom];
  }
  if (name === 'exp') return ['e^(' + inner(args[0]) + ')', P.pow];
  if (!NAMES[name] || args.length !== 1) throw new Unsupported();
  return [NAMES[name] + '(' + inner(args[0]) + ')', P.atom];
}

/** True if the calculator expression `text` equals ref(x) at the sample points. */
function sameFunction(text, angle, ref) {
  const g = fnOfExpr(text, angle);
  if (!g) return false;
  let valid = 0;
  for (const x of SAMPLES) {
    let want;
    try {
      want = ref(x);
    } catch {
      continue;
    }
    const got = g(x);
    if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
    if (Math.abs(got - want) > 1e-8 * Math.max(1, Math.abs(want))) return false;
    valid++;
  }
  return valid >= 3;
}

/**
 * d/dx(f) without a point, anywhere in the expression ("d/dx(x³)×2" too).
 * @returns {null | {text: string} | {value: number} | {error: string}}
 *   null when there is no such d/dx (evaluate as usual); value when the
 *   result has no x left, e.g. d/dx(3x) = 3
 */
export function symbolicDerivative(expr, angle = 'deg') {
  if (!expr.includes('d/dx(')) return null;
  let tree;
  try {
    tree = math.parse(toMathjs(expr));
  } catch {
    return null; // let evaluate() report the syntax error
  }
  if (!tree.filter((n) => math.isFunctionNode(n) && n.fn.name === 'deriv' && n.args.length === 1).length) return null;

  try {
    const result = math.simplify(reciprocals(toStandard(tree, angle)), RULES);
    const at = (x) => result.evaluate({ ...DEG_SCOPE, x });
    if (!usesX(result)) {
      const v = at(0);
      return typeof v === 'number' && Number.isFinite(v) ? { value: v } : { error: 'Check the expression' };
    }
    const text = print(result, angle === 'deg')[0];
    if (!sameFunction(text, angle, at)) throw new Unsupported(); // never show a misprinted formula
    return { text };
  } catch {
    return { error: 'No formula for this one. Add a point, e.g. d/dx(f(x), 2)' };
  }
}

/**
 * f when the whole expression is ∫(f) (no limits). f must work out to a
 * number somewhere, so nonsense never reaches the AI (or the daily quota).
 * @returns {null | {f: string} | {error: string}}
 */
export function indefiniteIntegrand(expr, angle = 'deg') {
  let found = null;
  for (let i = expr.indexOf('∫('); i >= 0; i = expr.indexOf('∫(', i + 1)) {
    const { args, close } = callArgs(expr, i + 1);
    if (args.length !== 1) continue;
    if (i === 0 && close === expr.length - 1) found = { f: args[0].text };
    else return { error: 'Use ∫ without limits on its own' };
  }
  if (!found) return null;
  const fx = fnOfExpr(found.f, angle);
  if (!fx || !SAMPLES.some((x) => Number.isFinite(fx(x)))) return { error: 'Check the function in the ∫' };
  return found;
}

/** Calculator notation for a checked F: x^3/3 -> x³÷3 (falls back to F as written). */
function pretty(F, angle) {
  try {
    const tree = toStandard(math.parse(toMathjs(F)), angle);
    const text = print(tree, angle === 'deg')[0];
    return sameFunction(text, angle, fnOfExpr(F, angle)) ? text : F;
  } catch {
    return F;
  }
}

/**
 * The AI's antiderivative, if it really is one: F′(x) = f(x) at every sample
 * point where both are defined (at least 4).
 * @returns {string|null} F in calculator notation, without "+C"
 */
export function checkAntiderivative(f, candidate, angle = 'deg') {
  if (typeof candidate !== 'string') return null;
  const F = closeParens(normalizeExpr(candidate).replace(/\+[Cc]$/, ''));
  if (!F || hasCalculus(F) || F.includes('□')) return null;
  const Fx = fnOfExpr(F, angle);
  const fx = fnOfExpr(f, angle);
  if (!Fx || !fx) return null;
  let valid = 0;
  for (const x of SAMPLES) {
    const want = fx(x);
    const got = differentiate(Fx, x);
    if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
    if (Math.abs(got - want) > 1e-6 * Math.max(1, Math.abs(want))) return null;
    valid++;
  }
  return valid >= 4 ? pretty(F, angle) : null;
}

/**
 * ∫(f) without limits: ask the AI for F, check it, ask once more for a
 * different answer if the first one is wrong.
 * @param {(opts: {retry: boolean}) => Promise<string>} ask  returns F ('' if there is none)
 * @returns {Promise<{text: string} | {error: string}>}
 */
export async function findAntiderivative(f, angle, ask) {
  for (const retry of [false, true]) {
    const candidate = await ask({ retry });
    if (!candidate) return { error: 'No simple formula for this one. Add limits to get a number' };
    const F = checkAntiderivative(f, candidate, angle);
    if (F) return { text: F + '+C' };
  }
  return { error: 'Couldn’t find a formula for this integral' };
}
