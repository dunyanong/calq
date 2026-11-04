// Numeric optimisation and root finding for the solver keys: minima in one
// and many variables, constrained minima, linear and integer programs, roots
// of f(x) = 0 and every root of a polynomial.
//
// Functions are plain JS closures; points are 1-D arrays, matrices 2-D
// arrays. Anything that cannot be answered throws an Error whose message is
// short enough for the display. Maximising is left to the caller (negate f).

const EPS = Number.EPSILON;
const MAX_ITER = 10000; // BFGS iterations before minimizeN gives up
const GRAD_TOL = 1e-9;
const FEAS_TOL = 1e-7; // constraint violation a constrained answer may keep
const LP_EPS = 1e-9;
const MAX_NODES = 10000; // branch-and-bound nodes before an ILP is "too large"

/** Rounds tiny |v| < 1e-12 to 0. */
const clean = (v) => (Math.abs(v) < 1e-12 ? 0 : v);

/** f(x) with NaN and ±∞ mapped to +∞, so a search steps away from them. */
const safe = (f) => (x) => {
  const y = f(x);
  return Number.isFinite(y) ? y : Infinity;
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const dot = (u, v) => u.reduce((s, ui, i) => s + ui * v[i], 0);
const norm = (v) => Math.sqrt(dot(v, v));

function checkPoint(p) {
  if (!Array.isArray(p) || p.length === 0 || !p.every(isNum)) throw new Error('Bad starting point');
}

// ---------------------------------------------------------------- 1-D minimum

/** Brent's minimisation of f on [a, b] (golden section + parabolic steps). */
function brentMin(f, a, b) {
  const C = (3 - Math.sqrt(5)) / 2;
  let x = a + C * (b - a);
  let w = x;
  let v = x;
  let fx = f(x);
  let fw = fx;
  let fv = fx;
  let d = 0;
  let e = 0;
  for (let iter = 0; iter < 500; iter++) {
    const m = (a + b) / 2;
    const tol1 = 1.5e-8 * Math.abs(x) + 1e-12;
    const tol2 = 2 * tol1;
    if (Math.abs(x - m) <= tol2 - (b - a) / 2) break;
    let golden = true;
    if (Math.abs(e) > tol1) {
      // parabola through x, w, v
      const r = (x - w) * (fx - fv);
      let q = (x - v) * (fx - fw);
      let p = (x - v) * q - (x - w) * r;
      q = 2 * (q - r);
      if (q > 0) p = -p;
      else q = -q;
      const etemp = e;
      e = d;
      if (Math.abs(p) < Math.abs(0.5 * q * etemp) && p > q * (a - x) && p < q * (b - x)) {
        d = p / q;
        const u = x + d;
        if (u - a < tol2 || b - u < tol2) d = m >= x ? tol1 : -tol1;
        golden = false;
      }
    }
    if (golden) {
      e = x >= m ? a - x : b - x;
      d = C * e;
    }
    const u = Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1);
    const fu = f(u);
    if (fu <= fx) {
      if (u >= x) a = x;
      else b = x;
      v = w;
      fv = fw;
      w = x;
      fw = fx;
      x = u;
      fx = fu;
    } else {
      if (u < x) a = u;
      else b = u;
      if (fu <= fw || w === x) {
        v = w;
        fv = fw;
        w = u;
        fw = fu;
      } else if (fu <= fv || v === x || v === w) {
        v = u;
        fv = fu;
      }
    }
  }
  return { x, f: fx };
}

/**
 * Global minimum of f on the closed interval [a, b] (endpoints count):
 * 2000-point scan, then Brent's method around the best few dips.
 * @param {(x: number) => number} f
 * @returns {{ x: number, f: number }}
 */
export function minimize1(f, a, b) {
  if (!isNum(a) || !isNum(b)) throw new Error('Bad interval');
  if (a > b) [a, b] = [b, a];
  const F = safe(f);
  const N = a === b ? 0 : 2000;
  const xs = [];
  const ys = [];
  for (let i = 0; i <= N; i++) {
    const x = i === N ? b : a + ((b - a) * i) / N;
    xs.push(x);
    ys.push(F(x));
  }
  // local dips of the scan (endpoints included), best first
  const dips = [];
  for (let i = 0; i <= N; i++) {
    if (ys[i] === Infinity) continue;
    const l = i > 0 ? ys[i - 1] : Infinity;
    const r = i < N ? ys[i + 1] : Infinity;
    if (ys[i] <= l && ys[i] <= r) dips.push(i);
  }
  if (dips.length === 0) throw new Error('No minimum found');
  dips.sort((i, j) => ys[i] - ys[j]);

  let best = { x: xs[dips[0]], f: ys[dips[0]] };
  for (const i of dips.slice(0, 5)) {
    const lo = xs[Math.max(0, i - 1)];
    const hi = xs[Math.min(N, i + 1)];
    if (lo === hi) continue;
    const m = brentMin(F, lo, hi);
    if (m.f < best.f) best = m;
  }
  return { x: clean(best.x), f: clean(best.f) };
}

// ---------------------------------------------------------------- n-D minimum

/** Gradient of F at x by 4th-order central differences. */
function gradient(F, x) {
  const g = new Array(x.length);
  const p = x.slice();
  const at = (i, v) => {
    p[i] = v;
    const y = F(p);
    p[i] = x[i];
    return y;
  };
  for (let i = 0; i < x.length; i++) {
    const h = 2e-4 * Math.max(1, Math.abs(x[i]));
    const d1 = at(i, x[i] + h) - at(i, x[i] - h);
    const d2 = at(i, x[i] + 2 * h) - at(i, x[i] - 2 * h);
    g[i] = (8 * d1 - d2) / (12 * h);
  }
  return g;
}

/** Nelder–Mead from x with an initial simplex of the given relative scale. */
function nelderMead(F, x0, scale) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += scale * Math.max(1, Math.abs(p[i]));
    pts.push(p);
  }
  let vals = pts.map(F);
  for (let iter = 0; iter < 2000 * n; iter++) {
    const order = vals.map((_, i) => i).sort((i, j) => vals[i] - vals[j]);
    pts = order.map((i) => pts[i]);
    vals = order.map((i) => vals[i]);
    const spread = Math.abs(vals[n] - vals[0]);
    let size = 0;
    for (let i = 1; i <= n; i++) {
      for (let k = 0; k < n; k++) size = Math.max(size, Math.abs(pts[i][k] - pts[0][k]));
    }
    if (spread <= 1e-15 * (Math.abs(vals[0]) + 1e-300) && size <= 1e-12 * (norm(pts[0]) + 1)) break;
    if (size <= 1e-15 * (norm(pts[0]) + 1)) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) c[k] += pts[i][k] / n;
    const along = (t) => c.map((ck, k) => ck + t * (pts[n][k] - ck));
    const r = along(-1);
    const fr = F(r);
    if (fr < vals[0]) {
      const e = along(-2);
      const fe = F(e);
      if (fe < fr) [pts[n], vals[n]] = [e, fe];
      else [pts[n], vals[n]] = [r, fr];
    } else if (fr < vals[n - 1]) {
      [pts[n], vals[n]] = [r, fr];
    } else {
      const k = fr < vals[n] ? along(-0.5) : along(0.5);
      const fk = F(k);
      if (fk < Math.min(fr, vals[n])) {
        [pts[n], vals[n]] = [k, fk];
      } else {
        // shrink towards the best point
        for (let i = 1; i <= n; i++) {
          pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j]));
          vals[i] = F(pts[i]);
        }
      }
    }
  }
  const i = vals.indexOf(Math.min(...vals));
  return { x: pts[i], f: vals[i] };
}

/**
 * Local minimum of f(point) from start: BFGS with a central-difference
 * gradient and Armijo backtracking, falling back to Nelder–Mead when BFGS
 * stalls (a noisy gradient or a kink).
 * @param {(p: number[]) => number} f
 * @param {number[]} start
 * @returns {{ x: number[], f: number }}
 */
export function minimizeN(f, start) {
  checkPoint(start);
  return bfgs(f, start, GRAD_TOL);
}

/** minimizeN with its gradient-norm tolerance as a parameter. */
function bfgs(f, start, gtol) {
  const F = safe(f);
  const n = start.length;
  let x = start.slice();
  let fx = F(x);
  if (fx === Infinity) throw new Error('f is undefined at the start');
  let iter = 0;
  const diverged = () => !(Math.abs(fx) < 1e100) || x.some((v) => !(Math.abs(v) < 1e12));

  for (let restart = 0; ; restart++) {
    // BFGS on the inverse Hessian H; fresh while H is still the identity
    const eye = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    let H = eye();
    let fresh = true;
    let g = gradient(F, x);
    let stalled = false;
    while (norm(g) > gtol) {
      if (++iter > MAX_ITER) throw new Error('No minimum found');
      let d = H.map((row) => -dot(row, g));
      let slope = dot(g, d);
      if (!(slope < 0)) {
        H = eye();
        fresh = true;
        d = g.map((v) => -v);
        slope = -dot(g, g);
      }
      // Armijo backtracking; where f is flat to rounding a shrinking
      // gradient decides instead
      const flat = fx + 8 * EPS * Math.abs(fx);
      let t = 1;
      let xt;
      let ft;
      let gt = null;
      for (;;) {
        xt = x.map((v, i) => v + t * d[i]);
        ft = F(xt);
        if (ft <= fx + 1e-4 * t * slope || t < 1e-20) break;
        if (ft <= flat) {
          gt = gradient(F, xt);
          if (norm(gt) < norm(g)) break;
          gt = null;
        }
        t /= 2;
      }
      if (!gt) {
        if (t === 1) {
          // a full step that keeps paying off is stretched
          for (let k = 0; k < 60; k++) {
            const x2 = x.map((v, i) => v + 2 * t * d[i]);
            const f2 = F(x2);
            if (!(f2 < ft && f2 <= fx + 2e-4 * t * slope)) break;
            t *= 2;
            xt = x2;
            ft = f2;
          }
        }
        if (!(ft <= fx + 1e-4 * t * slope) || ft >= fx) {
          if (fresh) {
            stalled = true;
            break;
          }
          H = eye(); // retry once from steepest descent before calling it a stall
          fresh = true;
          continue;
        }
      }
      const s = xt.map((v, i) => v - x[i]);
      x = xt;
      fx = ft;
      if (diverged()) throw new Error('No minimum found');
      const g2 = gt || gradient(F, x);
      const y = g2.map((v, i) => v - g[i]);
      g = g2;
      const sy = dot(s, y);
      if (sy > 1e-14 * norm(s) * norm(y)) {
        if (fresh) {
          const k = sy / dot(y, y); // scale the identity to the curvature seen
          H = H.map((row, i) => row.map((_, j) => (i === j ? k : 0)));
          fresh = false;
        }
        const rho = 1 / sy;
        const Hy = H.map((row) => dot(row, y));
        const yHy = dot(y, Hy);
        H = H.map((row, i) =>
          row.map((v, j) => v - rho * (Hy[i] * s[j] + s[i] * Hy[j]) + (rho * rho * yHy + rho) * s[i] * s[j]),
        );
      }
    }
    if (!stalled || restart >= 5) break;
    const nm = nelderMead(F, x, 1e-3);
    if (!(nm.f < fx - 1e-12 * Math.max(1, Math.abs(fx)))) break;
    x = nm.x;
    fx = nm.f;
    if (diverged()) throw new Error('No minimum found');
  }
  return { x: x.map(clean), f: clean(fx) };
}

// ------------------------------------------------------- constrained minimum

/**
 * Minimum of f(point) subject to constraints [{ g, type }] where type is
 * 'eq' (g = 0), 'le' (g ≤ 0) or 'ge' (g ≥ 0): augmented Lagrangian with
 * minimizeN for the inner solves.
 *
 * multipliers follow the constraint order with ∇f + Σ λ∇g = 0, where a 'ge'
 * constraint counts as −g ≤ 0; inequality multipliers are ≥ 0.
 * @param {(p: number[]) => number} f
 * @param {{ g: (p: number[]) => number, type: 'eq'|'le'|'ge' }[]} constraints
 * @param {number[]} start
 * @returns {{ x: number[], f: number, multipliers: number[] }}
 */
export function minimizeConstrained(f, constraints, start) {
  checkPoint(start);
  if (!Array.isArray(constraints)) throw new Error('Bad constraints');
  const cons = constraints.map((c) => {
    if (!c || typeof c.g !== 'function' || !['eq', 'le', 'ge'].includes(c.type)) throw new Error('Bad constraints');
    return { h: c.type === 'ge' ? (p) => -c.g(p) : c.g, eq: c.type === 'eq' };
  });
  if (cons.length === 0) return { ...minimizeN(f, start), multipliers: [] };

  const violation = (p) =>
    cons.reduce((m, c) => {
      const v = c.h(p);
      return Math.max(m, c.eq ? Math.abs(v) : Math.max(0, v));
    }, 0);
  const lam = cons.map(() => 0);
  let rho = 10;
  let x = start.slice();
  let viol = Infinity;
  for (let outer = 0; outer < 100; outer++) {
    const L = (p) => {
      let s = f(p);
      for (let i = 0; i < cons.length; i++) {
        const h = cons[i].h(p);
        if (cons[i].eq) s += lam[i] * h + (rho / 2) * h * h;
        else {
          const t = Math.max(0, lam[i] / rho + h);
          s += (rho / 2) * (t * t - (lam[i] / rho) ** 2);
        }
      }
      return s;
    };
    x = bfgs(L, x, 1e-11).x; // tighter than minimizeN, or λ stops improving
    const v = violation(x);
    let change = 0;
    for (let i = 0; i < cons.length; i++) {
      const h = cons[i].h(x);
      const next = cons[i].eq ? lam[i] + rho * h : Math.max(0, lam[i] + rho * h);
      change = Math.max(change, Math.abs(next - lam[i]) / Math.max(1, Math.abs(next)));
      lam[i] = next;
    }
    if (v <= 1e-10 && change <= 1e-9) break;
    // stiffen the penalty only while feasibility is still slow to come
    if (v > 1e-8 && v > 0.25 * viol && rho < 1e8) rho *= 10;
    viol = Math.min(viol, v);
  }
  if (!(violation(x) <= FEAS_TOL)) throw new Error('No feasible point found');
  const fx = f(x);
  if (!Number.isFinite(fx)) throw new Error('No minimum found');
  return { x: x.map(clean), f: clean(fx), multipliers: lam.map(clean) };
}

// ------------------------------------------------------------ linear programs

/** Pivots tableau T (with objective row obj) on row r, column c. */
function pivot(T, obj, r, c) {
  const row = T[r];
  const p = row[c];
  for (let j = 0; j < row.length; j++) row[j] /= p;
  for (const other of [...T, obj]) {
    if (other === row) continue;
    const k = other[c];
    if (k !== 0) for (let j = 0; j < row.length; j++) other[j] -= k * row[j];
  }
}

/**
 * Simplex iterations (Bland's rule) maximising the objective row obj, where
 * obj[j] is the reduced cost −c_j and obj[last] the current value.
 * Columns ≥ limit may not enter. Returns false when unbounded.
 */
function simplex(T, obj, basis, limit) {
  const rhs = obj.length - 1;
  for (let iter = 0; iter < 50000; iter++) {
    let c = -1;
    for (let j = 0; j < limit; j++) {
      if (obj[j] < -LP_EPS) {
        c = j;
        break;
      }
    }
    if (c < 0) return true;
    let r = -1;
    let best = Infinity;
    for (let i = 0; i < T.length; i++) {
      if (T[i][c] > LP_EPS) {
        const ratio = T[i][rhs] / T[i][c];
        if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[r])) {
          best = ratio;
          r = i;
        }
      }
    }
    if (r < 0) return false;
    pivot(T, obj, r, c);
    basis[r] = c;
  }
  throw new Error('LP did not converge');
}

/** Two-phase simplex: { status: 'ok' | 'unbounded' | 'infeasible', x, value }. */
function solveLP(c, A, b) {
  const m = A.length;
  const n = c.length;
  const arts = b.filter((v) => v < 0).length;
  const width = n + m + arts + 1;
  const rhs = width - 1;
  const T = [];
  const basis = [];
  let k = 0;
  for (let i = 0; i < m; i++) {
    const row = new Array(width).fill(0);
    const s = b[i] < 0 ? -1 : 1;
    for (let j = 0; j < n; j++) row[j] = s * A[i][j];
    row[n + i] = s;
    row[rhs] = s * b[i];
    if (s < 0) {
      row[n + m + k] = 1;
      basis.push(n + m + k);
      k++;
    } else basis.push(n + i);
    T.push(row);
  }

  // phase 1: maximise −Σ artificials
  if (arts > 0) {
    const obj = new Array(width).fill(0);
    for (let j = n + m; j < rhs; j++) obj[j] = 1;
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n + m) for (let j = 0; j < width; j++) obj[j] -= T[i][j];
    }
    simplex(T, obj, basis, rhs);
    if (obj[rhs] < -1e-7) return { status: 'infeasible' };
    // drive artificials still in the basis (at 0) out of it
    for (let i = 0; i < m; i++) {
      if (basis[i] < n + m) continue;
      const j = T[i].findIndex((v, col) => col < n + m && Math.abs(v) > LP_EPS);
      if (j >= 0) {
        pivot(T, obj, i, j);
        basis[i] = j;
      }
    }
  }

  // phase 2
  const obj = new Array(width).fill(0);
  for (let j = 0; j < n; j++) obj[j] = -c[j];
  for (let i = 0; i < m; i++) {
    const cb = basis[i] < n ? c[basis[i]] : 0;
    if (cb !== 0) for (let j = 0; j < width; j++) obj[j] += cb * T[i][j];
  }
  if (!simplex(T, obj, basis, n + m)) return { status: 'unbounded' };
  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][rhs]);
  return { status: 'ok', x, value: dot(c, x) };
}

/** Snaps v to the nearest integer when within tol (relative to |v| ≥ 1). */
const snap = (v, tol) => {
  const r = Math.round(v);
  return Math.abs(v - r) <= tol * Math.max(1, Math.abs(v)) ? r : v;
};

/**
 * Maximises cᵀx subject to A x ≤ b, x ≥ 0 (two-phase simplex, Bland's rule;
 * b may be negative). With integer: true every x is an integer, found by
 * branch and bound.
 * @param {number[]} c
 * @param {number[][]} A
 * @param {number[]} b
 * @param {{ integer?: boolean }} [options]
 * @returns {{ x: number[], value: number }}
 */
export function linprog(c, A, b, { integer = false } = {}) {
  if (!Array.isArray(c) || c.length === 0 || !c.every(isNum)) throw new Error('Bad objective');
  if (!Array.isArray(A) || !Array.isArray(b) || A.length !== b.length || !b.every(isNum)) {
    throw new Error('Bad constraints');
  }
  if (!A.every((row) => Array.isArray(row) && row.length === c.length && row.every(isNum))) {
    throw new Error('Bad constraints');
  }

  const root = solveLP(c, A, b);
  if (root.status === 'unbounded') throw new Error('LP is unbounded');
  if (root.status === 'infeasible') throw new Error('LP is infeasible');
  if (!integer) {
    const x = root.x.map((v) => clean(snap(v, 1e-11)));
    return { x, value: clean(snap(root.value, 1e-11)) };
  }

  // branch and bound, depth first; each branch adds a bound row
  let best = null;
  let nodes = 0;
  const stack = [{ A, b }];
  while (stack.length) {
    if (++nodes > MAX_NODES) throw new Error('ILP too large');
    const node = stack.pop();
    const r = solveLP(c, node.A, node.b);
    if (r.status === 'infeasible') continue;
    if (r.status === 'unbounded') throw new Error('LP is unbounded');
    if (best && r.value <= best.value + 1e-9) continue;
    const j = r.x.findIndex((v) => Math.abs(v - Math.round(v)) > 1e-9);
    if (j < 0) {
      const x = r.x.map((v) => clean(Math.round(v)));
      const value = dot(c, x);
      if (!best || value > best.value) best = { x, value };
      continue;
    }
    const unit = (s) => c.map((_, i) => (i === j ? s : 0));
    // x_j ≥ ceil first, x_j ≤ floor popped next
    stack.push({ A: [...node.A, unit(-1)], b: [...node.b, -Math.ceil(r.x[j])] });
    stack.push({ A: [...node.A, unit(1)], b: [...node.b, Math.floor(r.x[j])] });
  }
  if (!best) throw new Error('No integer solution');
  return { x: best.x, value: clean(snap(best.value, 1e-9)) };
}

// --------------------------------------------------------------------- roots

/**
 * Root of f in [a, b] by Brent's method; f(a) and f(b) must differ in sign.
 * @param {(x: number) => number} f
 * @returns {number}
 */
export function rootBracket(f, a, b) {
  if (!isNum(a) || !isNum(b)) throw new Error('Bad interval');
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return clean(a);
  if (fb === 0) return clean(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || Math.sign(fa) === Math.sign(fb)) {
    throw new Error('No sign change in [a, b]');
  }
  const bound = Math.max(Math.abs(fa), Math.abs(fb));
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 0; iter < 500; iter++) {
    if (Math.sign(fb) === Math.sign(fc)) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol = 2 * EPS * Math.abs(b) + 1e-300;
    const m = (c - b) / 2;
    if (Math.abs(m) <= tol || fb === 0) break;
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      // secant or inverse quadratic interpolation
      const s = fb / fa;
      let p;
      let q;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = m;
      }
    } else {
      d = m;
      e = m;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol ? d : m > 0 ? tol : -tol;
    fb = f(b);
    if (Number.isNaN(fb)) throw new Error('f is undefined in [a, b]');
  }
  // a pole such as 1/x also changes sign; its "root" has a huge |f|
  if (!(Math.abs(fb) <= bound)) throw new Error('f jumps across 0 in [a, b]');
  return clean(b);
}

/**
 * Root of f near x0: damped Newton with a numeric derivative, falling back
 * to the secant method.
 * @param {(x: number) => number} f
 * @param {number} x0
 * @param {(s: {x: number, fx: number, method: 'newton'|'secant'}) => void} [onStep]  called after each
 *   iteration (the hold panel's workings)
 * @returns {number}
 */
export function rootNewton(f, x0, onStep) {
  if (!isNum(x0)) throw new Error('Bad starting guess');
  const fail = () => new Error('No root found near the guess');
  const small = (x, fx) => {
    if (fx === 0) return true;
    // a sign change right next to x, or a value at rounding level
    const h = 1e-12 * Math.max(1, Math.abs(x));
    const l = f(x - h);
    const r = f(x + h);
    return Math.sign(l) !== Math.sign(r) || Math.abs(fx) < 1e-14;
  };

  let x = x0;
  let fx = f(x);
  if (!Number.isFinite(fx)) throw fail();
  for (let iter = 0; iter < 200; iter++) {
    if (fx === 0) return clean(x);
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const df = (f(x + h) - f(x - h)) / (2 * h);
    if (!Number.isFinite(df) || df === 0) break;
    const step = fx / df;
    let t = 1;
    let xn = x - step;
    let fn = f(xn);
    while (!(Math.abs(fn) < Math.abs(fx)) && t > 1e-6) {
      t /= 2;
      xn = x - t * step;
      fn = f(xn);
    }
    if (!(Math.abs(fn) < Math.abs(fx))) {
      if (Math.abs(step) <= 1e-12 * Math.max(1, Math.abs(x)) && small(x, fx)) return clean(x);
      break;
    }
    const moved = Math.abs(xn - x);
    x = xn;
    fx = fn;
    if (onStep) onStep({ x, fx, method: 'newton' });
    if (Math.abs(x) > 1e15) throw fail();
    if (moved <= 4 * EPS * Math.max(1, Math.abs(x)) && small(x, fx)) return clean(x);
  }

  // secant from where Newton stopped
  let x1 = x;
  let f1 = fx;
  let x2 = x + 1e-4 * Math.max(1, Math.abs(x));
  let f2 = f(x2);
  for (let iter = 0; iter < 200; iter++) {
    if (!Number.isFinite(f2) || Math.abs(x2) > 1e15) throw fail();
    if (f2 === 0) return clean(x2);
    if (f2 === f1) break;
    const x3 = x2 - (f2 * (x2 - x1)) / (f2 - f1);
    x1 = x2;
    f1 = f2;
    x2 = x3;
    f2 = f(x2);
    if (onStep) onStep({ x: x2, fx: f2, method: 'secant' });
    if (Math.abs(x2 - x1) <= 4 * EPS * Math.max(1, Math.abs(x2)) && Number.isFinite(f2) && small(x2, f2)) {
      return clean(x2);
    }
  }
  if (Number.isFinite(f2) && small(x2, f2)) return clean(x2);
  throw fail();
}

/** p(z) and p'(z) by Horner, coefficients highest power first. */
function horner(a, re, im) {
  let pr = a[0];
  let pi = 0;
  let dr = 0;
  let di = 0;
  for (let k = 1; k < a.length; k++) {
    // d = d·z + p ; p = p·z + a_k
    const ndr = dr * re - di * im + pr;
    di = dr * im + di * re + pi;
    dr = ndr;
    const npr = pr * re - pi * im + a[k];
    pi = pr * im + pi * re;
    pr = npr;
  }
  return [pr, pi, dr, di];
}

/** a / b for complex numbers as [re, im]. */
function cdiv(ar, ai, br, bi) {
  const d = br * br + bi * bi;
  return [(ar * br + ai * bi) / d, (ai * br - ar * bi) / d];
}

/**
 * Every complex root of a polynomial (coefficients highest power first,
 * e.g. [1, 0, −1] for x² − 1) by Aberth's method, polished with Newton.
 * @param {number[]} coeffs
 * @returns {{ re: number, im: number }[]} sorted by re then im
 */
export function polyRoots(coeffs) {
  if (!Array.isArray(coeffs) || !coeffs.every(isNum)) throw new Error('Bad coefficients');
  let a = coeffs.slice();
  while (a.length && a[0] === 0) a.shift();
  if (a.length < 2) throw new Error('Not a polynomial');
  const roots = [];
  while (a[a.length - 1] === 0) {
    a.pop(); // x is a factor: root 0 exactly
    roots.push([0, 0]);
  }
  a = a.map((v) => v / a[0]);
  const n = a.length - 1;

  if (n > 0) {
    // start on a circle of the roots' typical size, off the real axis
    const R = Math.max(...a.slice(1).map((v, k) => Math.abs(v) ** (1 / (k + 1))), 1e-3);
    const z = Array.from({ length: n }, (_, k) => {
      const t = (2 * Math.PI * k) / n + 0.4;
      return [R * Math.cos(t), R * Math.sin(t)];
    });
    for (let iter = 0; iter < 2000; iter++) {
      let moved = 0;
      for (let k = 0; k < n; k++) {
        const [pr, pi, dr, di] = horner(a, z[k][0], z[k][1]);
        if (pr === 0 && pi === 0) continue;
        const [qr, qi] = cdiv(pr, pi, dr, di); // p / p'
        let sr = 0;
        let si = 0;
        for (let j = 0; j < n; j++) {
          if (j === k) continue;
          const [ur, ui] = cdiv(1, 0, z[k][0] - z[j][0], z[k][1] - z[j][1]);
          sr += ur;
          si += ui;
        }
        // w = q / (1 − q·Σ)
        const [wr, wi] = cdiv(qr, qi, 1 - (qr * sr - qi * si), -(qr * si + qi * sr));
        if (!Number.isFinite(wr) || !Number.isFinite(wi)) continue;
        z[k][0] -= wr;
        z[k][1] -= wi;
        moved = Math.max(moved, Math.hypot(wr, wi) / Math.max(1, Math.hypot(z[k][0], z[k][1])));
      }
      if (moved < 1e-15) break;
    }
    // Newton polish on the full polynomial
    for (const r of z) {
      for (let k = 0; k < 5; k++) {
        const [pr, pi, dr, di] = horner(a, r[0], r[1]);
        if (pr === 0 && pi === 0) break;
        const [qr, qi] = cdiv(pr, pi, dr, di);
        if (!Number.isFinite(qr) || !Number.isFinite(qi)) break;
        const nr = r[0] - qr;
        const ni = r[1] - qi;
        const [tr, ti] = horner(a, nr, ni);
        if (!(Math.hypot(tr, ti) < Math.hypot(pr, pi))) break;
        r[0] = nr;
        r[1] = ni;
      }
      roots.push(r);
    }
  }

  const out = roots.map(([re, im]) => ({ re: clean(re), im: Math.abs(im) < 1e-10 ? 0 : clean(im) }));
  return out.sort((p, q) => {
    const tol = 1e-9 * Math.max(1, Math.abs(p.re), Math.abs(q.re));
    return Math.abs(p.re - q.re) > tol ? p.re - q.re : p.im - q.im;
  });
}
