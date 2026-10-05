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
