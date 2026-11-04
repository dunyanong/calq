import { math } from './engine';

const MAX_DENOMINATOR = 10000;

function toFraction(v) {
  if (Math.abs(v) > 1e9) return null;
  try {
    const f = math.fraction(v);
    const n = Number(f.n);
    const d = Number(f.d);
    const sign = Number(f.s) < 0 ? '-' : '';
    if (d === 1 || d > MAX_DENOMINATOR) return null;
    // only show a fraction if it is exact to double precision
    if (Math.abs((Number(f.s) * n) / d - v) > 1e-12 * Math.max(1, Math.abs(v))) return null;
    return sign + n + '/' + d;
  } catch {
    return null;
  }
}

/**
 * Formats a result to 10 significant digits.
 * Large/small numbers use the calculator style "1.23×10^12".
 * @param {number|null} v
 * @param {'dec'|'frac'} output
 */
export function formatNumber(v, output = 'dec') {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'Error';
  if (Object.is(v, -0)) v = 0;
  if (output === 'frac' && !Number.isInteger(v)) {
    const fr = toFraction(v);
    if (fr) return fr;
  }
  const s = math.format(v, { precision: 10, lowerExp: -7, upperExp: 10 });
  const m = /^(-?[\d.]+)e([+-]\d+)$/.exec(s);
  return m ? m[1] + '×10^' + Number(m[2]) : s;
}

/**
 * A number as text that can be safely inserted into an expression
 * (used by Ans, RCL and the workings). Wrapped in brackets when needed,
 * e.g. "(-3)" or "(1.2×10^-8)".
 */
export function asOperand(v) {
  const s = formatNumber(v, 'dec');
  return /^\d+(\.\d+)?$/.test(s) ? s : '(' + s + ')';
}

// Text ending like this starts a new operand, so a number can follow it as is.
const OPEN_END = /[(,+−\-×÷^]$/;

/**
 * v as text to put in place of text[start, end) (Ans, RCL, Rand, a stored
 * variable), bracketed when it would merge with its neighbours: 2 then Ans
 * gives 2(79), not 279; 3² then Ans gives 3²(79), not 3^279.
 */
export function operandIn(text, start, end, v) {
  const s = asOperand(v);
  if (s.startsWith('(')) return s;
  const before = text.slice(0, start);
  const merges = (before !== '' && !OPEN_END.test(before)) || /^[\d.]/.test(text.slice(end));
  return merges ? '(' + s + ')' : s;
}

// ---- results that are not a single real number (engine.js compute) -------------

/** A number inside a complex number or matrix: − for minus, ÷ for fractions, so it reads back in. */
const entry = (v, output) => formatNumber(v, output).replace('/', '÷');

/** 3+4i, 3−4i, 2i, −i. */
function formatComplex({ re, im }, output) {
  const imag = Math.abs(im) === 1 ? '' : entry(Math.abs(im), output);
  const i = (imag.includes('÷') || imag.includes('×') ? '(' + imag + ')' : imag) + 'i';
  if (re === 0) return (im < 0 ? '−' : '') + i;
  return entry(re, output) + (im < 0 ? '−' : '+') + i;
}

/** An entry of a matrix: a+bi is bracketed so [1,(2+i)] reads back as one entry. */
const cellText = (v, output) =>
  typeof v === 'number' ? entry(v, output) : v.re === 0 ? formatComplex(v, output) : '(' + formatComplex(v, output) + ')';

/** [1,2,3] for a vector, [1,2;3,4] for a matrix (the notation the keys type). */
function formatMatrix(a, output) {
  if (!Array.isArray(a[0])) return '[' + a.map((v) => cellText(v, output)).join(',') + ']';
  return '[' + a.map((row) => row.map((v) => cellText(v, output)).join(',')).join(';') + ']';
}

/**
 * Any compute() result as text: 2.5, 3+4i, [1,2;3,4], x=1.5, y=−2, min=3.
 * @param {ReturnType<import('./engine').compute>} res
 * @param {'dec'|'frac'} output
 */
export function formatValue(res, output = 'dec') {
  switch (res?.kind) {
    case 'number':
      return formatNumber(res.value, output);
    case 'complex':
      return formatComplex(res.value, output);
    case 'matrix':
      return formatMatrix(res.value, output);
    case 'parts':
      return res.value.map(([name, r]) => (name ? name + '=' : '') + formatValue(r, output)).join(', ');
    case 'text':
      return res.value;
    default:
      return 'Error';
  }
}

/**
 * Rows of a matrix result, padded into columns for the display, or null when the
 * result is not one matrix ([1,2;3,4] -> ['1  2', '3  4']).
 */
export function matrixRows(result) {
  const m = /^\[([^[\]]*;[^[\]]*)\]$/.exec(result);
  if (!m) return null;
  const rows = m[1].split(';').map((r) => r.split(','));
  const cols = rows[0].length;
  if (cols > 8 || rows.some((r) => r.length !== cols)) return null;
  const width = Array.from({ length: cols }, (_, j) => Math.max(...rows.map((r) => r[j].length)));
  return rows.map((r) => r.map((c, j) => c.padStart(width[j])).join('  '));
}
