// Evaluates calculator expressions with math.js (never eval / Function).
//
// The display string uses calculator symbols (×, ÷, −, π, √(, ², sin⁻¹( …).
// toMathjs() translates it token by token into math.js syntax, so anything
// that is not a known token is rejected instead of being executed.
//
// ∫(f(x),a,b), d/dx(f(x),a), Σ(f(x),a,b), Π(f(x),a,b) and the advanced keys that
// take a function (∬, ∂x, min, ode … in advanced.js) are the only places the
// variables x, y, z are defined; anywhere else they are an "Undefined symbol" error.
//
// Real numbers use `math`; Complex mode (Settings) or an i in the expression use
// `cmath`, where √(−4) = 2i.
import { create, all } from 'mathjs';
import { differentiate, integrate } from './calculus';
import { Parts, advancedFns } from './advanced';

// predictable: sqrt(-1) gives NaN instead of a complex number.
export const math = create(all, { predictable: true });
export const cmath = create(all);

// Angle unit for the trig wrappers below. Set by evaluate() before each run.
let angleMode = 'deg';
// True while ∫ or d/dx samples f(x): they need the raw values (ln(sin x) near π).
let sampling = false;

/** Radians in one unit of each angle mode (a full turn is 360°, 2π rad or 400 grad). */
export const RAD_PER = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200 };
// Size of a right angle in each mode, for the exact "tan undefined" check.
const QUARTER = { deg: 90, grad: 100 };

const toRad = (x) => x * (RAD_PER[angleMode] ?? 1);
const fromRad = (x) => x / (RAD_PER[angleMode] ?? 1);
// Removes floating-point noise such as sin(180°) = 1.2e-16.
const clean = (v) => (!sampling && Math.abs(v) < 1e-12 ? 0 : v);

function num(x) {
  if (typeof x !== 'number') throw new Error('Expected a number');
  return x;
}

/**
 * The angle-mode functions for instance m. Real numbers take the exact paths below;
 * in the complex instance a complex argument (or sin⁻¹(2)) goes through m itself.
 */
function angleFns(m) {
  const complex = m === cmath;
  const real = (x) => typeof x === 'number' || !complex;
  const rad = () => RAD_PER[angleMode] ?? 1;
  const arc = (name, x) =>
    real(x) && (!complex || Math.abs(x) <= 1 || name === 'atan')
      ? fromRad(Math[name](num(x)))
      : m.divide(m[name](x), rad());
  return {
    tsin: (x) => (real(x) ? clean(Math.sin(toRad(num(x)))) : m.sin(m.multiply(x, rad()))),
    tcos: (x) => (real(x) ? clean(Math.cos(toRad(num(x)))) : m.cos(m.multiply(x, rad()))),
    ttan: (x) => {
      if (!real(x)) return m.tan(m.multiply(x, rad()));
      num(x);
      // tan(90°), tan(270°), tan(100 grad)… are undefined
      const q = QUARTER[angleMode];
      if (q && (((x % (2 * q)) + 2 * q) % (2 * q)) === q) return NaN;
      return clean(Math.tan(toRad(x)));
    },
    tasin: (x) => arc('asin', x),
    tacos: (x) => arc('acos', x),
    tatan: (x) => arc('atan', x),
    // log_b(base, x)
    logb: (b, x) => (real(x) && real(b) && (!complex || (x > 0 && b > 0)) ? Math.log(num(x)) / Math.log(num(b)) : m.divide(m.log(x), m.log(b))),
    nroot: (n, x) => m.nthRoot(complex ? x : num(x), num(n)), // ˣ√(n, x)
  };
}

/**
 * f(...values) from an unevaluated argument (∫, ∬, min, ode …), with vars set to the
 * values in order. Outer variables stay visible, so ∫(x×∫(x,0,x),0,1) uses the outer
 * x as the inner limit.
 * @param {string[]} vars  e.g. ['x'] or ['x', 'y']
 * @param {boolean} raw  skip the trig rounding clean-up (∫ and d/dx sample between points)
 */
function fnOf(node, scope, vars, raw = true) {
  const code = node.compile();
  const inner = new Map(scope);
  return (...values) => {
    vars.forEach((v, i) => inner.set(v, values[i]));
    const outer = sampling;
    sampling = raw;
    try {
      return num(code.evaluate(inner));
    } finally {
      sampling = outer;
    }
  };
}

const fnOfX = (node, scope, raw = true) => fnOf(node, scope, ['x'], raw);

// rawArgs: math.js passes the argument nodes, so f can be evaluated at many x.
function integ(args, _math, scope) {
  if (args.length !== 3) throw new Error('∫ needs (f(x), a, b)');
  const [a, b] = args.slice(1).map((n) => num(n.compile().evaluate(scope)));
  return integrate(fnOfX(args[0], scope), a, b);
}
integ.rawArgs = true;

function deriv(args, _math, scope) {
  if (args.length !== 2) throw new Error('d/dx needs (f(x), a)');
  return differentiate(fnOfX(args[0], scope), num(args[1].compile().evaluate(scope)));
}
deriv.rawArgs = true;

const MAX_TERMS = 100000;

/** Σ / Π over the integers a..b. */
function series(args, scope, name, step, empty) {
  if (args.length !== 3) throw new Error(name + ' needs (f(x), a, b)');
  const [a, b] = args.slice(1).map((n) => num(n.compile().evaluate(scope)));
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a || b - a >= MAX_TERMS) {
    throw new Error(name + ' needs whole-number limits a ≤ b');
  }
  const f = fnOfX(args[0], scope, false);
  let acc = empty;
  for (let x = a; x <= b; x++) acc = step(acc, f(x));
  return acc;
}

function sumx(args, _math, scope) {
  return series(args, scope, 'Σ', (s, v) => s + v, 0);
}
sumx.rawArgs = true;

function prodx(args, _math, scope) {
  return series(args, scope, 'Π', (p, v) => p * v, 1);
}
prodx.rawArgs = true;

for (const m of [math, cmath]) {
  m.import({ ...angleFns(m), integ, deriv, sumx, prodx });
  m.import(advancedFns(m, { cm: cmath, fnOf, num, fromRad }));
}

// Display token -> math.js text, matched longest first (sorted below), so that
// "sin⁻¹(" wins over "sin(", "det(" over "e" and "inv(" over "i".
// π, e, i and the variables are bracketed so "π(2)" or "x(x+1)" multiply
// instead of being read as function calls.
const TOKENS = [
  ['∫(', 'integ('], ['d/dx(', 'deriv('], ['Σ(', 'sumx('], ['Π(', 'prodx('],
  ['x', '(x)'], ['y', '(y)'], ['z', '(z)'], ['n', '(n)'], ['y′', '(yp)'], ['i', '(i)'], ['∞', 'Infinity'],
  // matrices [1,2;3,4], transpose, and the =, ≤, ≥ of equations and constraints
  ['[', '['], [']', ']'], [';', ';'], ['ᵀ', "'"], ['=', '=='], ['≤', '<='], ['≥', '>='],
  ['det(', 'det('], ['inv(', 'inv('], ['rank(', 'rank('], ['trace(', 'trace('], ['eig(', 'eig('],
  ['svd(', 'svd('], ['lu(', 'lu('], ['qr(', 'qrd('], ['rref(', 'rref('], ['null(', 'nullsp('],
  ['solve(', 'linsolve('], ['norm(', 'norm('], ['dot(', 'dot('], ['cross(', 'cross('], ['kron(', 'kron('],
  ['chol(', 'chol('], ['posdef(', 'posdef('], ['jordan(', 'jordan('], ['I(', 'identity('],
  ['re(', 're('], ['im(', 'im('], ['conj(', 'conj('], ['arg(', 'targ('],
  ['∬(', 'integ2('], ['∭(', 'integ3('], ['∂x(', 'pdx('], ['∂y(', 'pdy('], ['∂z(', 'pdz('],
  ['grad(', 'gradf('], ['jac(', 'jac('], ['hess(', 'hess('], ['div(', 'divg('], ['curl(', 'curl('],
  ['lap(', 'lap('], ['taylor(', 'taylor('], ['lim(', 'lim('],
  ['ode(', 'ode('], ['ode2(', 'ode2('], ['bvp(', 'bvp('], ['stab(', 'stab('],
  ['min(', 'optmin('], ['max(', 'optmax('], ['minc(', 'minc('], ['maxc(', 'maxc('], ['lp(', 'lp('], ['ilp(', 'ilp('],
  ['root(', 'root('], ['nsolve(', 'nsolve('], ['roots(', 'roots('],
  ['mod(', 'mod('], ['isprime(', 'isprime('], ['factor(', 'factorInt('], ['φ(', 'totient('],
  ['modinv(', 'modinv('], ['modpow(', 'modpow('], ['and(', 'land('], ['or(', 'lor('], ['not(', 'lnot('],
  ['xor(', 'lxor('], ['implies(', 'limp('], ['rec(', 'rec('], ['catalan(', 'catalanN('], ['stirling(', 'stirling('],
  ['bell(', 'bell('], ['union(', 'union('], ['inter(', 'inter('], ['setdiff(', 'setdiff('],
  ['path(', 'gpath('], ['mst(', 'mst('], ['flow(', 'flow('], ['assign(', 'assign('], ['colour(', 'colour('],
  ['comps(', 'comps('], ['trees(', 'trees('], ['fiedler(', 'fiedler('],
  ['sin⁻¹(', 'tasin('], ['cos⁻¹(', 'tacos('], ['tan⁻¹(', 'tatan('],
  ['sinh(', 'sinh('], ['cosh(', 'cosh('], ['tanh(', 'tanh('],
  ['sin(', 'tsin('], ['cos(', 'tcos('], ['tan(', 'ttan('],
  ['log_b(', 'logb('], ['log(', 'log10('], ['ln(', 'log('],
  ['√(', 'sqrt('], ['∛(', 'cbrt('], ['ˣ√(', 'nroot('],
  ['abs(', 'abs('], ['nPr(', 'permutations('], ['nCr(', 'combinations('],
  ['ceil(', 'ceil('], ['floor(', 'floor('], ['round(', 'round('], ['gcd(', 'gcd('], ['lcm(', 'lcm('],
  ['⁻¹', '^(-1)'], ['²', '^2'], ['³', '^3'],
  ['π', '(pi)'], ['e^(', '(e)^('], ['e', '(e)'],
  ['×', '*'], ['÷', '/'], ['−', '-'], ['-', '-'], ['+', '+'], ['^', '^'],
  ['(', '('], [')', ')'], [',', ','], ['!', '!'], ['%', '%'], ['.', '.'], [' ', ''],
].sort((p, q) => q[0].length - p[0].length);

const isDigit = (c) => c >= '0' && c <= '9';

/** Adds the missing ")" at the end. */
export function closeParens(expr) {
  let depth = 0;
  for (const c of expr) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return depth > 0 ? expr + ')'.repeat(depth) : expr;
}

/** Translates a display expression to math.js syntax. Throws on unknown input. */
export function toMathjs(expr) {
  const s = closeParens(String(expr));
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (isDigit(c)) { out += c; i++; continue; }
    if (c === 'E') {
      // EXP key: "1.5E−3" -> 1.5e-3. Must sit between a number and an exponent.
      const prev = s[i - 1];
      const next = s[i + 1];
      if (!(isDigit(prev) || prev === '.') || !(isDigit(next) || next === '−' || next === '-' || next === '+')) {
        throw new Error('Misplaced E');
      }
      out += 'e';
      i++;
      continue;
    }
    const hit = TOKENS.find(([t]) => s.startsWith(t, i));
    if (!hit) throw new Error('Unknown symbol: ' + c);
    out += hit[1];
    i += hit[0].length;
  }
  return out;
}

/** True if the expression uses ∫, d/dx, Σ, Π or another calculus key (the keys that define x). */
export const hasCalculus = (expr) => /∫\(|d\/dx\(|Σ\(|Π\(|[∬∭∂]|grad\(|jac\(|hess\(|div\(|curl\(|lap\(|taylor\(|lim\(|ode2?\(|bvp\(/.test(expr);

// Keys that can take a moment (sampling f many times, searching): no live preview.
const SLOW = /(?:min|max|minc|maxc|lp|ilp|root|nsolve|colour|rec|path|flow|assign)\(/;

/** True if working the expression out can take a while (∫, ∬, ode, min, colour …). */
export const isHeavy = (expr) => hasCalculus(expr) || SLOW.test(expr);

/** True if the expression uses sin/cos/tan or their inverses (which follow the angle mode). */
export const hasTrig = (expr) => /(?:sin|cos|tan)(?:⁻¹)?\(/.test(expr);

/**
 * Evaluates a display expression.
 * @param {string} expr  e.g. "sin(30)+√(16)×2"
 * @param {'deg'|'rad'|'grad'} angle
 * @returns {number|null} the value, or null for errors / non-finite results
 */
export function evaluate(expr, angle = 'deg') {
  if (!String(expr).trim()) return null;
  try {
    const src = toMathjs(expr);
    angleMode = angle;
    const v = math.evaluate(src);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// math.js's own messages ("Unexpected type of argument …") mean nothing to a student.
const MATHJS_ERROR = /Unexpected|Undefined|Parenthesis|Value expected|Unknown symbol|Misplaced E|Cannot|Expected|argument|Too (?:few|many)|is not a function|Index out|Dimension/i;

/** A thrown error as a toast message. */
function friendly(e) {
  const msg = String(e?.message || '');
  if (/Undefined symbol [xyzn]\b|Undefined symbol yp/.test(msg)) return 'Use x, y, z inside ∫, ∂, min, ode …';
  if (/must be square|square matri/i.test(msg)) return 'Matrix must be square';
  if (/Dimension mismatch|shape mismatch|broadcast/i.test(msg)) return 'Matrix sizes don’t match';
  if (/singular/i.test(msg)) return 'Matrix is singular (no inverse)';
  if (/Expected a matrix|Expected a list|needs|Use |Write /.test(msg)) return msg;
  return !msg || msg.length > 60 || MATHJS_ERROR.test(msg) ? 'Check the expression' : msg;
}

/** True if the expression needs complex numbers: an i, or re / im / conj / arg. */
export function usesComplex(expr) {
  try {
    return /\(i\)|\b(?:re|im|conj|targ)\(/.test(toMathjs(expr));
  } catch {
    return false;
  }
}

const TINY = 1e-12;
const isComplex = (v) => v && typeof v === 'object' && v.isComplex;
/** z without rounding noise: (1+i)² is 2i, not 1.2×10^-16+2i. */
function tidyComplex(z) {
  const size = Math.max(1, Math.hypot(z.re, z.im));
  return { re: Math.abs(z.re) <= TINY * size ? 0 : z.re, im: Math.abs(z.im) <= TINY * size ? 0 : z.im };
}
// i·0 left over from complex arithmetic is a real number
const realPart = (z) => {
  const t = tidyComplex(z);
  return t.im === 0 ? t.re : null;
};

/** Matrix entries as numbers, or { re, im } where they are complex; null if any is not finite. */
function entries(a) {
  const ok = (x) =>
    typeof x === 'number' ? Number.isFinite(x) : isComplex(x) ? Number.isFinite(x.re) && Number.isFinite(x.im) : false;
  const flat = a.flat(Infinity);
  if (!flat.every(ok)) return null;
  const tidy = (x) => (isComplex(x) ? (realPart(x) ?? tidyComplex(x)) : x);
  return a.map((r) => (Array.isArray(r) ? r.map(tidy) : tidy(r)));
}

/**
 * A value as a calculator result.
 * @returns {{kind: 'number', value: number} | {kind: 'complex', value: {re: number, im: number}} |
 *   {kind: 'matrix', value: (number|object)[] | (number|object)[][]} | {kind: 'parts', value: [string, object][]} |
 *   {kind: 'text', value: string} | {error: string}}
 */
function classify(v, complex) {
  if (typeof v === 'boolean') return { kind: 'number', value: v ? 1 : 0 };
  if (typeof v === 'number') return Number.isFinite(v) ? { kind: 'number', value: v } : { error: 'Check the expression' };
  if (isComplex(v)) {
    const re = realPart(v);
    if (re !== null) return classify(re, complex);
    if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) return { error: 'Check the expression' };
    return complex ? { kind: 'complex', value: tidyComplex(v) } : { error: 'Non-real result: turn on Complex in Settings' };
  }
  if (math.isMatrix(v) || Array.isArray(v)) {
    const a = entries(math.isMatrix(v) ? v.toArray() : v);
    if (!a || !a.length) return { error: 'Check the expression' };
    return { kind: 'matrix', value: a };
  }
  if (v instanceof Parts) {
    const parts = [];
    for (const [name, x] of v.list) {
      const r = typeof x === 'string' ? { kind: 'text', value: x } : classify(x, true);
      if (r.error) return r;
      parts.push([name, r]);
    }
    return { kind: 'parts', value: parts };
  }
  if (typeof v === 'string') return { kind: 'text', value: v };
  return { error: 'Check the expression' };
}

/**
 * Works out any calculator expression: numbers, complex numbers, matrices and the
 * advanced keys with several results (x=…, min=…).
 * @param {'deg'|'rad'|'grad'} angle
 * @param {'real'|'complex'} numbers  Settings → Numbers; an i in the expression always means complex
 * @returns {ReturnType<typeof classify>}
 */
export function compute(expr, angle = 'deg', numbers = 'real') {
  if (!String(expr).trim()) return { error: 'Check the expression' };
  try {
    const src = toMathjs(expr);
    const complex = numbers === 'complex' || usesComplex(expr);
    angleMode = angle;
    return classify((complex ? cmath : math).evaluate(src), complex);
  } catch (e) {
    return { error: friendly(e) };
  }
}

/** Value of a parsed math.js node in the given angle mode (throws if it is not a number). */
export function evaluateNode(node, angle = 'deg') {
  angleMode = angle;
  return num(node.compile().evaluate(new Map()));
}

/**
 * f(x) for an expression in x, e.g. "x²+sin(x)", or null if it does not parse.
 * y and z can be given too, for formulas such as ∂x(x²y) = 2xy.
 * Used to check symbolic answers numerically. f returns NaN where undefined.
 */
export function fnOfExpr(expr, angle = 'deg') {
  let code;
  try {
    code = math.parse(toMathjs(expr)).compile();
  } catch {
    return null;
  }
  const scope = new Map();
  return (x, y = 0, z = 0) => {
    scope.set('x', x);
    scope.set('y', y);
    scope.set('z', z);
    angleMode = angle;
    const outer = sampling;
    sampling = true;
    try {
      const v = code.evaluate(scope);
      return typeof v === 'number' ? v : NaN;
    } catch {
      return NaN;
    } finally {
      sampling = outer;
    }
  };
}

/**
 * RanInt(a,b) is random, so it is replaced by the drawn integer when the
 * calculation is saved. That way the workings can be recomputed later.
 */
export function freezeRandom(expr, angle = 'deg') {
  return expr.replace(/RanInt\(([^()]*)\)?/g, (whole, args) => {
    const parts = args.split(',');
    if (parts.length !== 2) return whole;
    const a = evaluate(parts[0], angle);
    const b = evaluate(parts[1], angle);
    if (a === null || b === null) return whole;
    const lo = Math.ceil(Math.min(a, b));
    const hi = Math.floor(Math.max(a, b));
    if (hi < lo) return whole;
    return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
  });
}
