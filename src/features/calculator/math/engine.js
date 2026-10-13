// Evaluates calculator expressions with math.js (never eval / Function).
//
// The display string uses calculator symbols (×, ÷, −, π, √(, ², sin⁻¹( …).
// toMathjs() translates it token by token into math.js syntax, so anything
// that is not a known token is rejected instead of being executed.
//
// ∫(f(x),a,b), d/dx(f(x),a), Σ(f(x),a,b) and Π(f(x),a,b) are the only places
// the variable x is defined; anywhere else it is an "Undefined symbol" error.
import { create, all } from 'mathjs';
import { differentiate, integrate } from './calculus';

// predictable: sqrt(-1) gives NaN instead of a complex number.
export const math = create(all, { predictable: true });

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

math.import({
  tsin: (x) => clean(Math.sin(toRad(num(x)))),
  tcos: (x) => clean(Math.cos(toRad(num(x)))),
  ttan: (x) => {
    num(x);
    // tan(90°), tan(270°), tan(100 grad)… are undefined
    const q = QUARTER[angleMode];
    if (q && (((x % (2 * q)) + 2 * q) % (2 * q)) === q) return NaN;
    return clean(Math.tan(toRad(x)));
  },
  tasin: (x) => fromRad(Math.asin(num(x))),
  tacos: (x) => fromRad(Math.acos(num(x))),
  tatan: (x) => fromRad(Math.atan(num(x))),
  logb: (b, x) => Math.log(num(x)) / Math.log(num(b)), // log_b(base, x)
  nroot: (n, x) => math.nthRoot(num(x), num(n)), // ˣ√(n, x)
});

/**
 * f(x) from the unevaluated first argument of ∫, d/dx, Σ or Π. Outer variables
 * stay visible, so ∫(x×∫(x,0,x),0,1) uses the outer x as the inner limit.
 * @param {boolean} raw  skip the trig rounding clean-up (∫ and d/dx sample between points)
 */
function fnOfX(node, scope, raw = true) {
  const code = node.compile();
  const inner = new Map(scope);
  return (x) => {
    inner.set('x', x);
    const outer = sampling;
    sampling = raw;
    try {
      return num(code.evaluate(inner));
    } finally {
      sampling = outer;
    }
  };
}

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

math.import({ integ, deriv, sumx, prodx });

// Display token -> math.js text. Longer tokens come first so that
// "sin⁻¹(" wins over "sin(" and "log_b(" over "log(".
// π, e and x are bracketed so "π(2)" or "x(x+1)" multiply instead of
// being read as function calls.
const TOKENS = [
  ['∫(', 'integ('], ['d/dx(', 'deriv('], ['Σ(', 'sumx('], ['Π(', 'prodx('], ['x', '(x)'],
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
];

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

/** True if the expression uses ∫, d/dx, Σ or Π (the keys that define x). */
export const hasCalculus = (expr) => /∫\(|d\/dx\(|Σ\(|Π\(/.test(expr);

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

/** Value of a parsed math.js node in the given angle mode (throws if it is not a number). */
export function evaluateNode(node, angle = 'deg') {
  angleMode = angle;
  return num(node.compile().evaluate(new Map()));
}

/**
 * f(x) for an expression in x, e.g. "x²+sin(x)", or null if it does not parse.
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
  return (x) => {
    scope.set('x', x);
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
