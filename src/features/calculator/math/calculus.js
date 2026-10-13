// Numeric calculus for the ∫dx and d/dx keys (like a Casio: definite
// integrals and derivatives at a point, no symbolic algebra).
//
// Both return NaN instead of a doubtful number, so the calculator shows
// "Error" for a divergent integral or a point where f has no derivative.

// Gauss–Kronrod 7/15 nodes and weights on [-1, 1] (QUADPACK qk15).
// Kronrod nodes, largest first; the odd indices are the Gauss nodes.
const XK = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
  0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
  0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
];
const WK = [
  0.022935322010529224963732008058970, 0.063092092629978553290700663189204,
  0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
  0.169004726639267902826583426598550, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
const WG = [
  0.129484966168869693270611432679082, 0.279705391489276667901467771423780,
  0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
];

// Error target relative to ∫|f|, below the 10 digits the display shows.
const TOL = 1e-11;
const MAX_EVALS = 20000; // a divergent integral gives up in a fraction of a second
const FIRST_SPLIT = 4; // a jump cannot hide between the nodes of a single first panel

class NotFinite extends Error {}

/** Kronrod estimate on [a, b], its error (difference from Gauss), and ∫|f|. */
function gk15(f, a, b) {
  const c = (a + b) / 2;
  const h = (b - a) / 2;
  const fc = f(c);
  let k = fc * WK[7];
  let g = fc * WG[3];
  let abs = Math.abs(fc) * WK[7];
  for (let j = 0; j < 7; j++) {
    const dx = h * XK[j];
    const l = f(c - dx);
    const r = f(c + dx);
    k += WK[j] * (l + r);
    abs += WK[j] * (Math.abs(l) + Math.abs(r));
    if (j % 2 === 1) g += WG[(j - 1) / 2] * (l + r);
  }
  return { a, b, value: k * h, error: Math.abs((k - g) * h), abs: abs * Math.abs(h) };
}

/**
 * ∫ f(x) dx from a to b: adaptive Gauss–Kronrod, always splitting the panel
 * with the largest error.
 *
 * x = a + (b−a)(3t² − 2t³) packs the samples towards both limits, so endpoint
 * singularities such as ∫(1/√x, 0, 1) or ∫(1/√(1−x²), −1, 1) converge.
 * @param {(x: number) => number} f
 * @returns {number} NaN when f is not finite inside (a, b) or it does not converge
 */
export function integrate(f, a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  if (a === b) return 0;
  const w = b - a;
  let evals = 0;
  const g = (t) => {
    evals++;
    const x = a + w * t * t * (3 - 2 * t);
    const y = f(x) * 6 * w * t * (1 - t);
    if (!Number.isFinite(y)) throw new NotFinite();
    return y;
  };

  try {
    const segs = [];
    for (let i = 0; i < FIRST_SPLIT; i++) segs.push(gk15(g, i / FIRST_SPLIT, (i + 1) / FIRST_SPLIT));
    for (;;) {
      let total = 0;
      let error = 0;
      let abs = 0;
      let worst = segs[0];
      for (const s of segs) {
        total += s.value;
        error += s.error;
        abs += s.abs;
        if (s.error > worst.error) worst = s;
      }
      // a sum can overflow even when every sample is finite (∫(1/x, 0, 1))
      if (!Number.isFinite(total) || !Number.isFinite(error) || !Number.isFinite(abs)) return NaN;
      if (error <= TOL * abs) {
        // cancellation noise: ∫(sin(x), 0, 100π) is 0, not 1.5×10^-13
        return Math.abs(total) <= TOL * abs ? 0 : total;
      }
      const m = (worst.a + worst.b) / 2;
      // out of budget or cannot split further: diverges (∫(tan x, 0, π)) or oscillates forever
      if (evals >= MAX_EVALS || m === worst.a || m === worst.b) return NaN;
      segs.splice(segs.indexOf(worst), 1, gk15(g, worst.a, m), gk15(g, m, worst.b));
    }
  } catch (e) {
    if (e instanceof NotFinite) return NaN;
    throw e;
  }
}

/**
 * f′(x0): Ridders' extrapolation of central differences.
 * Returns NaN where f is not differentiable: undefined at or next to x0
 * (√x at 0, 1/x at 0) or with a corner or jump (|x| at 0, floor at 1).
 * @param {(x: number) => number} f
 * @returns {number}
 */
export function differentiate(f, x0) {
  if (!Number.isFinite(x0)) return NaN;
  const scale = Math.max(1, Math.abs(x0));

  // Left and right slopes must agree.
  const e = 1e-5 * scale;
  const f0 = f(x0);
  const left = (f0 - f(x0 - e)) / e;
  const right = (f(x0 + e) - f0) / e;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
  if (Math.abs(left - right) > 0.05 * Math.max(1, Math.abs(left), Math.abs(right))) return NaN;

  // Largest step that keeps both samples finite (ln x close to 0).
  let h = 1e-3 * scale;
  const central = (step) => (f(x0 + step) - f(x0 - step)) / (2 * step);
  while (!Number.isFinite(central(h))) {
    h /= 2;
    if (h < e) return NaN;
  }

  // Ridders: each row halves h, each column removes the next error term.
  const rows = [];
  let best = NaN;
  let err = Infinity;
  for (let i = 0; i < 10; i++, h /= 2) {
    const row = [central(h)];
    let fac = 1;
    for (let j = 1; j <= i; j++) {
      fac *= 4;
      row[j] = (row[j - 1] * fac - rows[i - 1][j - 1]) / (fac - 1);
      const errj = Math.max(Math.abs(row[j] - row[j - 1]), Math.abs(row[j] - rows[i - 1][j - 1]));
      if (errj <= err) {
        err = errj;
        best = row[j];
      }
    }
    rows.push(row);
    // higher orders got worse: stop with the best so far
    if (i > 0 && Math.abs(row[i] - rows[i - 1][i - 1]) >= 2 * err) break;
  }
  if (!Number.isFinite(best)) return NaN;
  // rounding noise: d/dx(x³−3x, 1) is 0, not −3.5×10^-13 (real slopes are ~10^11 × err)
  return Math.abs(best) <= 100 * err ? 0 : best;
}
