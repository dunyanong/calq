// Numeric multivariable calculus: double and triple integrals over regions
// with curved bounds, partial derivatives and the vector-calculus operators
// built on them, and two-sided limits.
//
// Everything works on plain JS closures. Points and vectors are 1-D arrays,
// matrices 2-D arrays. A doubtful answer throws a short Error the calculator
// can show instead of a wrong number.

import { differentiate, integrate } from './calculus';

// Inner integrals are looser so their rounding noise does not stall the outer one.
const INNER_TOL = 1e-10;
const MIDDLE_TOL = 1e-9;
const OUTER_TOL = 1e-9;
const DOUBLE_BUDGET = 2e6;
const TRIPLE_BUDGET = 4e6;

class OutOfBudget extends Error {}

const snap = (v) => (Math.abs(v) < 1e-12 ? 0 : v);

/** Wraps f so every call counts against one shared budget. */
function budgeted(f, limit) {
  let calls = 0;
  return (...args) => {
    if (++calls > limit) throw new OutOfBudget();
    return f(...args);
  };
}

/** Runs a nested integral, turning NaN and an exhausted budget into messages. */
function run(compute) {
  let v;
  try {
    v = compute();
  } catch (e) {
    if (e instanceof OutOfBudget) throw new Error('Too slow — narrow the region');
    throw e;
  }
  if (!Number.isFinite(v)) throw new Error('Integral does not converge');
  return snap(v);
}

/**
 * ∫_a^b ∫_{c(x)}^{d(x)} f(x, y) dy dx.
 * @param {(x: number, y: number) => number} f
 * @param {(x: number) => number} c lower y bound (pass () => k for a constant)
 * @param {(x: number) => number} d upper y bound
 * @returns {number}
 */
export function double(f, a, b, c, d) {
  const g = budgeted(f, DOUBLE_BUDGET);
  return run(() =>
    integrate((x) => integrate((y) => g(x, y), c(x), d(x), { tol: INNER_TOL }), a, b, { tol: OUTER_TOL }),
  );
}

/**
 * ∫_a^b ∫_{c(x)}^{d(x)} ∫_{p(x,y)}^{q(x,y)} f(x, y, z) dz dy dx.
 * @param {(x: number, y: number, z: number) => number} f
 * @returns {number}
 */
export function triple(f, a, b, c, d, p, q) {
  const g = budgeted(f, TRIPLE_BUDGET);
  const inner = (x, y) => integrate((z) => g(x, y, z), p(x, y), q(x, y), { tol: INNER_TOL });
  const middle = (x) => integrate((y) => inner(x, y), c(x), d(x), { tol: MIDDLE_TOL });
  return run(() => integrate(middle, a, b, { tol: OUTER_TOL }));
}

/** ∂f/∂x_i at point, NaN where it does not exist. */
function rawPartial(f, point, i) {
  return differentiate((t) => {
    const p = point.slice();
    p[i] = t;
    return f(p);
  }, point[i]);
}

function checked(v) {
  if (!Number.isFinite(v)) throw new Error('Not differentiable here');
  return snap(v);
}

/**
 * ∂f/∂(variable i) at point.
 * @param {(p: number[]) => number} f
 * @param {number[]} point
 * @param {number} i
 * @returns {number}
 */
export function partial(f, point, i) {
  return checked(rawPartial(f, point, i));
}

/**
 * ∇f at point.
 * @param {(p: number[]) => number} f
 * @returns {number[]}
 */
export function gradient(f, point) {
  return point.map((_, i) => partial(f, point, i));
}

/**
 * Jacobian matrix J[i][j] = ∂f_i/∂x_j.
 * @param {((p: number[]) => number)[]} fs
 * @returns {number[][]}
 */
export function jacobian(fs, point) {
  return fs.map((f) => gradient(f, point));
}

/**
 * Hessian matrix of second partials: nested Ridders, then symmetrised.
 * @param {(p: number[]) => number} f
 * @returns {number[][]}
 */
export function hessian(f, point) {
  const n = point.length;
  const h = [];
  for (let i = 0; i < n; i++) {
    h.push([]);
    for (let j = 0; j < n; j++) {
      // ∂/∂x_j of ∂f/∂x_i
      h[i][j] = checked(
        differentiate((t) => {
          const p = point.slice();
          p[j] = t;
          return rawPartial(f, p, i);
        }, point[j]),
      );
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) h[i][j] = h[j][i] = snap((h[i][j] + h[j][i]) / 2);
  }
  return h;
}

/**
 * ∇·F at point.
 * @param {((p: number[]) => number)[]} fs one component per coordinate
 * @returns {number}
 */
export function divergence(fs, point) {
  if (fs.length !== point.length) throw new Error('Need one component per variable');
  return snap(fs.reduce((sum, f, i) => sum + partial(f, point, i), 0));
}

/**
 * ∇×F at point: a 3-vector for (P, Q, R), the scalar ∂Q/∂x − ∂P/∂y for (P, Q).
 * @param {((p: number[]) => number)[]} fs
 * @returns {number[] | number}
 */
export function curl(fs, point) {
  const d = (k, i) => partial(fs[k], point, i);
  if (fs.length === 2 && point.length === 2) return snap(d(1, 0) - d(0, 1));
  if (fs.length === 3 && point.length === 3) {
    return [d(2, 1) - d(1, 2), d(0, 2) - d(2, 0), d(1, 0) - d(0, 1)].map(snap);
  }
  throw new Error('Curl needs 2 or 3 components');
}

/**
 * ∇²f at point: the trace of the Hessian.
 * @param {(p: number[]) => number} f
 * @returns {number}
 */
export function laplacian(f, point) {
  const h = hessian(f, point);
  return snap(h.reduce((sum, row, i) => sum + row[i], 0));
}

// Limits: g(h) for h = H0·2^-k → 0+, Richardson-extrapolated in powers of h.
const STEPS = 25;
const H0 = 0.125;
const LIMIT_TOL = 1e-8;

/** g(h) as h → 0+: a number, ±Infinity, or NaN when there is none. */
function oneSided(g, scale) {
  const raw = [];
  for (let k = 0; k < STEPS; k++) {
    const v = g(H0 * scale * 2 ** -k);
    if (Number.isNaN(v)) return NaN;
    if (!Number.isFinite(v)) return v; // overflowed on the way in
    raw.push(v);
  }

  // Richardson table, keeping the entry that agrees best with its neighbours.
  const rows = [];
  let best = raw[raw.length - 1];
  let err = Infinity;
  for (let i = 0; i < raw.length; i++) {
    const row = [raw[i]];
    let fac = 1;
    for (let j = 1; j <= Math.min(i, 8); j++) {
      fac *= 2;
      row[j] = row[j - 1] + (row[j - 1] - rows[i - 1][j - 1]) / (fac - 1);
      const errj = Math.max(Math.abs(row[j] - row[j - 1]), Math.abs(row[j] - rows[i - 1][j - 1]));
      if (errj <= err) {
        err = errj;
        best = row[j];
      }
    }
    rows.push(row);
  }
  if (err <= LIMIT_TOL * Math.max(1, Math.abs(best))) return Math.abs(best) <= 100 * err ? 0 : best;

  // Not a power series in h: steady or growing steps mean it runs off to ±∞ (ln x, 1/x).
  const tail = raw.slice(-8);
  const steps = tail.slice(1).map((v, i) => v - tail[i]);
  const sign = Math.sign(steps[0]);
  if (sign !== 0 && steps.every((s, i) => Math.sign(s) === sign && (i === 0 || Math.abs(s) >= 0.9 * Math.abs(steps[i - 1])))) {
    return sign * Infinity;
  }

  // Geometric convergence at a fractional rate (√x at 0): Aitken on the last samples.
  const aitken = (i) => {
    const [x0, x1, x2] = [raw[i - 2], raw[i - 1], raw[i]];
    const den = x2 - 2 * x1 + x0;
    return den === 0 ? x2 : x2 - ((x2 - x1) * (x2 - x1)) / den;
  };
  const n = raw.length - 1;
  const a1 = aitken(n - 1);
  const a2 = aitken(n);
  const ratio = Math.abs((raw[n] - raw[n - 1]) / (raw[n - 1] - raw[n - 2]));
  if (ratio < 0.9 && Math.abs(a2 - a1) <= 1e-7 * Math.max(1, Math.abs(a2))) return Math.abs(a2) < 1e-9 ? 0 : a2;
  return NaN;
}

/**
 * lim f(x) as x → a, from both sides (a may be ±Infinity).
 * @param {(x: number) => number} f
 * @param {number} a
 * @returns {number}
 */
export function limit(f, a) {
  if (Number.isNaN(a)) throw new Error('Limit does not exist');
  let sides;
  if (a === Infinity) sides = [oneSided((t) => f(1 / t), 1)];
  else if (a === -Infinity) sides = [oneSided((t) => f(-1 / t), 1)];
  else {
    const scale = Math.max(1, Math.abs(a));
    sides = [oneSided((h) => f(a + h), scale), oneSided((h) => f(a - h), scale)];
    // only one side in the domain (√x at 0): use that side
    if (Number.isNaN(sides[0]) !== Number.isNaN(sides[1])) sides = sides.filter((s) => !Number.isNaN(s));
  }
  if (sides.some(Number.isNaN)) throw new Error('Limit does not exist');
  const [l, r = l] = sides;
  if (!Number.isFinite(l) || !Number.isFinite(r)) {
    if (l === r) throw new Error('Limit is infinite');
    throw new Error('Limit does not exist');
  }
  if (Math.abs(l - r) > 1e-6 * Math.max(1, Math.abs(l), Math.abs(r))) throw new Error('Limit does not exist');
  return snap((l + r) / 2);
}
