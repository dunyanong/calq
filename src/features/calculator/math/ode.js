// Numeric ODEs: initial value problems (first order, second order as a
// system), two-point boundary value problems by shooting, and the stability
// of a linear system's equilibrium.
//
// Solvers return the value at one point, like a calculator key, and throw a
// short Error the calculator can show instead of a wrong number.

import { eigs } from 'mathjs';

const RTOL = 1e-12; // the display shows 10 digits
const ATOL = 1e-14;
const MAX_STEPS = 100000;

// Dormand–Prince 5(4) tableau.
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84], // 5th-order weights, last stage reused (FSAL)
];
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40]; // B − B*

const snap = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
const finite = (Y) => Y.every(Number.isFinite);

/**
 * Y′ = F(x, Y) from Y(x0) = Y0 to x1 (x1 may be below x0): adaptive
 * Dormand–Prince RK45.
 * @param {(x: number, Y: number[]) => number[]} F
 * @param {number[]} Y0
 * @param {(x: number, Y: number[], h: number) => void} [onStep]  called after each accepted step (the hold panel's workings)
 * @returns {number[]} Y(x1)
 */
export function solveSystem(F, x0, Y0, x1, onStep) {
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !finite(Y0)) throw new Error('Invalid starting values');
  const n = Y0.length;
  let x = x0;
  let Y = Y0.slice();
  if (x0 === x1) return Y.map(snap);
  const dir = Math.sign(x1 - x0);
  const span = Math.abs(x1 - x0);
  const deriv = (xs, Ys) => {
    const d = F(xs, Ys);
    if (!finite(d)) throw new Error('Solution blows up');
    return d;
  };

  let k1 = deriv(x, Y);
  let h = Math.min(span, 1e-2 * Math.max(1, span));
  for (let step = 0; ; step++) {
    if (step >= MAX_STEPS) throw new Error('ODE step limit reached');
    const last = h >= Math.abs(x1 - x);
    if (last) h = Math.abs(x1 - x);
    const hs = dir * h;

    const K = [k1];
    let Ynew;
    for (let s = 1; s < 7; s++) {
      const Ys = Y.map((y, i) => {
        let sum = y;
        for (let j = 0; j < s; j++) sum += hs * A[s][j] * K[j][i];
        return sum;
      });
      if (s === 6) Ynew = Ys;
      K.push(deriv(x + C[s] * hs, Ys));
    }

    // RMS of the error scaled by atol + rtol·|y|
    let err = 0;
    for (let i = 0; i < n; i++) {
      let e = 0;
      for (let s = 0; s < 7; s++) e += E[s] * K[s][i];
      e *= hs;
      const sc = ATOL + RTOL * Math.max(Math.abs(Y[i]), Math.abs(Ynew[i]));
      err += (e / sc) ** 2;
    }
    err = Math.sqrt(err / n);
    if (!Number.isFinite(err)) throw new Error('Solution blows up');

    if (err <= 1) {
      x = last ? x1 : x + hs;
      Y = Ynew;
      k1 = K[6];
      if (onStep) onStep(x, Y, hs);
      if (last) return Y.map(snap);
    }
    h *= Math.min(5, Math.max(0.2, 0.9 * err ** -0.2));
    // the step shrank to nothing: a singularity in the way (y′ = y² from 0 to 2)
    if (x + dir * h === x) throw new Error('Solution blows up');
  }
}

/**
 * y′ = f(x, y), y(x0) = y0: returns y(x1).
 * @param {(x: number, y: number) => number} f
 * @param {(x: number, Y: number[], h: number) => void} [onStep]  see solveSystem
 * @returns {number}
 */
export function ode1(f, x0, y0, x1, onStep) {
  return solveSystem((x, [y]) => [f(x, y)], x0, [y0], x1, onStep)[0];
}

/**
 * y″ = f(x, y, y′), y(x0) = y0, y′(x0) = yp0: returns y(x1).
 * @param {(x: number, y: number, yp: number) => number} f
 * @param {(x: number, Y: number[], h: number) => void} [onStep]  see solveSystem (Y is [y, y′])
 * @returns {number}
 */
export function ode2(f, x0, y0, yp0, x1, onStep) {
  return solveSystem((x, [y, yp]) => [yp, f(x, y, yp)], x0, [y0, yp0], x1, onStep)[0];
}

/**
 * y″ = f(x, y, y′), y(a) = ya, y(b) = yb: returns y(x) for x between a and b.
 * Shoots on the initial slope: secant first, bisection if that fails.
 * @param {(x: number, y: number, yp: number) => number} f
 * @returns {number}
 */
export function bvp(f, a, ya, b, yb, x) {
  if (![a, ya, b, yb, x].every(Number.isFinite) || a === b) throw new Error('Invalid boundary values');
  if ((x - a) * (x - b) > 0) throw new Error('x must lie between a and b');
  const F = (t, [y, yp]) => [yp, f(t, y, yp)];
  // miss(s): how far the shot with slope s lands from yb, NaN if it blows up
  const miss = (s) => {
    try {
      return solveSystem(F, a, [ya, s], b)[0] - yb;
    } catch {
      return NaN;
    }
  };
  const tol = 1e-10 * Math.max(1, Math.abs(yb));
  const answer = (s) => solveSystem(F, a, [ya, s], x)[0];

  // secant
  let s0 = (yb - ya) / (b - a);
  let s1 = s0 + 1;
  let m0 = miss(s0);
  let m1 = miss(s1);
  for (let i = 0; i < 50 && Number.isFinite(m0) && Number.isFinite(m1); i++) {
    if (Math.abs(m1) <= tol) return answer(s1);
    if (m1 === m0) break;
    const s2 = s1 - (m1 * (s1 - s0)) / (m1 - m0);
    [s0, m0, s1, m1] = [s1, m1, s2, miss(s2)];
  }

  // bisection: widen a bracket around the straight-line slope until the miss changes sign
  const mid = (yb - ya) / (b - a);
  let lo = NaN;
  let hi = NaN;
  for (let w = 1; w <= 1e6 && Number.isNaN(lo); w *= 2) {
    const ml = miss(mid - w);
    const mh = miss(mid + w);
    if (Number.isFinite(ml) && Number.isFinite(mh) && ml * mh <= 0) [lo, hi] = [mid - w, mid + w];
  }
  if (Number.isNaN(lo)) throw new Error('No solution found');
  let mlo = miss(lo);
  for (let i = 0; i < 200; i++) {
    const s = (lo + hi) / 2;
    const m = miss(s);
    if (!Number.isFinite(m)) break;
    if (Math.abs(m) <= tol || s === lo || s === hi) return answer(s);
    if (Math.sign(m) === Math.sign(mlo)) [lo, mlo] = [s, m];
    else hi = s;
  }
  throw new Error('No solution found');
}

/**
 * Classifies the equilibrium of x′ = Jx. 2×2 by trace and determinant
 * ('stable node', 'saddle', 'centre', …); larger by eigenvalues
 * ('asymptotically stable', 'unstable', 'marginally stable').
 * @param {number[][]} J square matrix
 * @returns {{ type: string, eigenvalues: (number | { re: number, im: number })[] }}
 */
export function stability(J) {
  const n = Array.isArray(J) ? J.length : 0;
  if (n === 0 || !J.every((row) => Array.isArray(row) && row.length === n && finite(row))) {
    throw new Error('Need a square matrix');
  }
  const scale = Math.max(1, ...J.flat().map(Math.abs));
  const eps = 1e-12 * scale;

  if (n === 2) {
    const [[p, q], [r, s]] = J;
    const tr = p + s;
    const det = p * s - q * r;
    const disc = tr * tr - 4 * det;
    const zero = (v, sc = scale) => Math.abs(v) <= 1e-12 * sc;
    let eigenvalues;
    if (disc >= 0 || zero(disc, scale * scale)) {
      const root = Math.sqrt(Math.max(0, disc));
      eigenvalues = [snap((tr + root) / 2), snap((tr - root) / 2)];
    } else {
      const im = snap(Math.sqrt(-disc) / 2);
      eigenvalues = [{ re: snap(tr / 2), im }, { re: snap(tr / 2), im: -im }];
    }
    let type;
    if (zero(det, scale * scale)) type = 'degenerate';
    else if (det < 0) type = 'saddle';
    else if (zero(tr)) type = 'centre';
    else if (disc < 0 && !zero(disc, scale * scale)) type = tr < 0 ? 'stable spiral' : 'unstable spiral';
    else type = tr < 0 ? 'stable node' : 'unstable node';
    return { type, eigenvalues };
  }

  let values;
  try {
    ({ values } = eigs(J));
  } catch {
    throw new Error('Eigenvalues did not converge');
  }
  const list = Array.isArray(values) ? values : values.toArray();
  const eigenvalues = list.map((v) => {
    if (typeof v === 'number') return snap(v);
    const re = snap(v.re);
    const im = snap(v.im);
    return Math.abs(im) <= eps ? re : { re, im };
  });
  const maxRe = Math.max(...eigenvalues.map((v) => (typeof v === 'number' ? v : v.re)));
  let type = 'marginally stable';
  if (maxRe < -1e-9 * scale) type = 'asymptotically stable';
  else if (maxRe > 1e-9 * scale) type = 'unstable';
  return { type, eigenvalues };
}
