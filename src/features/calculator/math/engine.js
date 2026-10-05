// Evaluates calculator expressions with math.js (never eval / Function).
//
// The display string uses calculator symbols (×, ÷, −, π, √(, ², sin⁻¹( …).
// toMathjs() translates it token by token into math.js syntax, so anything
// that is not a known token is rejected instead of being executed.
import { create, all } from 'mathjs';

// predictable: sqrt(-1) gives NaN instead of a complex number.
export const math = create(all, { predictable: true });

// Angle unit for the trig wrappers below. Set by evaluate() before each run.
let angleMode = 'deg';

const toRad = (x) => (angleMode === 'deg' ? (x * Math.PI) / 180 : x);
const fromRad = (x) => (angleMode === 'deg' ? (x * 180) / Math.PI : x);
// Removes floating-point noise such as sin(180°) = 1.2e-16.
const clean = (v) => (Math.abs(v) < 1e-12 ? 0 : v);

function num(x) {
  if (typeof x !== 'number') throw new Error('Expected a number');
  return x;
}

math.import({
  tsin: (x) => clean(Math.sin(toRad(num(x)))),
  tcos: (x) => clean(Math.cos(toRad(num(x)))),
  ttan: (x) => {
    num(x);
    // tan(90°), tan(270°)… are undefined
    if (angleMode === 'deg' && (((x % 180) + 180) % 180) === 90) return NaN;
    return clean(Math.tan(toRad(x)));
  },
  tasin: (x) => fromRad(Math.asin(num(x))),
  tacos: (x) => fromRad(Math.acos(num(x))),
  tatan: (x) => fromRad(Math.atan(num(x))),
  logb: (b, x) => Math.log(num(x)) / Math.log(num(b)), // log_b(base, x)
  nroot: (n, x) => math.nthRoot(num(x), num(n)), // ˣ√(n, x)
});

// Display token -> math.js text. Longer tokens come first so that
// "sin⁻¹(" wins over "sin(" and "log_b(" over "log(".
const TOKENS = [
  ['sin⁻¹(', 'tasin('], ['cos⁻¹(', 'tacos('], ['tan⁻¹(', 'tatan('],
  ['sinh(', 'sinh('], ['cosh(', 'cosh('], ['tanh(', 'tanh('],
  ['sin(', 'tsin('], ['cos(', 'tcos('], ['tan(', 'ttan('],
  ['log_b(', 'logb('], ['log(', 'log10('], ['ln(', 'log('],
  ['√(', 'sqrt('], ['∛(', 'cbrt('], ['ˣ√(', 'nroot('],
  ['abs(', 'abs('], ['nPr(', 'permutations('], ['nCr(', 'combinations('],
  ['ceil(', 'ceil('], ['floor(', 'floor('], ['gcd(', 'gcd('], ['lcm(', 'lcm('],
  ['⁻¹', '^(-1)'], ['²', '^2'], ['³', '^3'],
  ['π', ' pi '], ['e^(', ' e^('], ['e', ' e '],
  ['×', '*'], ['÷', '/'], ['−', '-'], ['-', '-'], ['+', '+'], ['^', '^'],
  ['(', '('], [')', ')'], [',', ','], ['!', '!'], ['.', '.'], [' ', ''],
];

const isDigit = (c) => c >= '0' && c <= '9';

/** Adds the missing ")" at the end, like the prototype did. */
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

/**
 * Evaluates a display expression.
 * @param {string} expr  e.g. "sin(30)+√(16)×2"
 * @param {'deg'|'rad'} angle
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
