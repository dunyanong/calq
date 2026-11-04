// Workings for the numerical keys in the hold panel's Steps: the solver's own steps,
// recorded while the calculation is worked out again on the device (advanced.js withTrace).
// No AI is involved. Covered: ode (Runge–Kutta), ode2 (as a system) and solve (Newton).
import { withTrace } from './advanced';
import { compute } from './engine';
import { callArgs } from './entry';
import { formatNumber, formatValue } from './format';

const CALL = /^(ode2|ode|nsolve)\(/;
const SHOWN_HEAD = 2; // solver rows shown before the "… more" row
const SHOWN_TAIL = 1;

/** True when the whole calculation is one ode(…), ode2(…) or nsolve(…) call. */
export function hasNumericSteps(expr) {
  const src = String(expr ?? '').trim();
  const m = src.match(CALL);
  if (!m) return false;
  const { close } = callArgs(src, m[1].length);
  return close === src.length - 1;
}

const n = (v) => formatNumber(v);
// intermediate rows: fewer digits, so each fits on one line of the panel
const short = (v, digits = 6) => formatNumber(Number(v.toPrecision(digits)));

/** First and last solver rows, with one row saying how many are skipped. */
function rows(trace, row) {
  const all = trace.map(row);
  if (all.length <= SHOWN_HEAD + SHOWN_TAIL + 1) return all;
  const skipped = all.length - SHOWN_HEAD - SHOWN_TAIL;
  return [...all.slice(0, SHOWN_HEAD), { label: `… ${skipped} more steps`, expr: '⋮' }, ...all.slice(-SHOWN_TAIL)];
}

/**
 * @param {string} expr   calculation as entered, e.g. "ode(y,0,1,1)"
 * @param {'deg'|'rad'|'grad'} angle
 * @param {'real'|'complex'} [numbers]
 * @returns {{label: string, expr: string}[] | null}  null when there is nothing to show
 */
export function numericSteps(expr, angle, numbers = 'real') {
  if (!hasNumericSteps(expr)) return null;
  const src = String(expr).trim();
  const name = src.match(CALL)[1];
  const a = callArgs(src, name.length).args.map((x) => x.text.trim());

  let run;
  try {
    run = withTrace(() => compute(src, angle, numbers));
  } catch {
    return null;
  }
  const res = run.value;
  if (res.error || !run.trace.length) return null;
  const result = formatValue(res);

  if (name === 'nsolve') {
    const [start, ...iters] = run.trace;
    const label = (s, i) => (s.method === 'secant' ? 'Secant step ' : 'Iteration ') + (i + 1);
    return [
      { label: 'Problem', expr: `${a[0]},  starting from x₀ = ${a[1]}` },
      { label: 'Method — Newton–Raphson', expr: 'xₙ₊₁ = xₙ − f(xₙ) ÷ f′(xₙ)' },
      { label: 'Start', expr: `x₀ = ${n(start.x)},  f(x₀) = ${short(start.fx, 4)}` },
      ...rows(iters, (s, i) => ({ label: label(s, i), expr: `x = ${n(s.x)},  f(x) = ${short(s.fx, 4)}` })),
      { label: 'Result', expr: `x = ${result}` },
    ];
  }

  const second = name === 'ode2';
  const problem = second
    ? `y″ = ${a[0]},  y(${a[1]}) = ${a[2]},  y′(${a[1]}) = ${a[3]},  find y(${a[4]})`
    : `y′ = ${a[0]},  y(${a[1]}) = ${a[2]},  find y(${a[3]})`;
  const count = run.trace.length + (run.trace.length === 1 ? ' step' : ' steps');
  const method = second
    ? { label: 'Method — as a system, then Runge–Kutta', expr: `y′ = v,  v′ = ${a[0].replace(/y′/g, 'v')};  RK45, ${count}` }
    : { label: 'Method — Runge–Kutta (Dormand–Prince RK45)', expr: `${count}, each error below 10⁻¹²` };
  return [
    { label: 'Problem', expr: problem },
    method,
    ...rows(run.trace, (s, i, all) => {
      const f = i === all.length - 1 ? n : short; // the last step reaches the answer: all its digits
      return {
        label: `Step ${i + 1} · x = ${f(s.x)} · h = ${short(s.h, 4)}`,
        expr: `y = ${f(s.Y[0])}` + (second ? `,  y′ = ${f(s.Y[1])}` : ''),
      };
    }),
    { label: 'Result', expr: `y(${a[second ? 4 : 3]}) = ${result}` },
  ];
}
