// Matrix decompositions the mathjs functions do not cover: SVD, rref, rank,
// null space, Cholesky and the Jordan form.
//
// Matrices are plain row-major 2-D arrays of numbers. Bad input throws an
// Error whose message is short enough for a toast.

import { eigs } from 'mathjs';

const EPS = 2.220446049250313e-16;
const NOISE = 1e-12; // smaller than this in a result is shown as 0

/** Checks A is a non-empty rectangular matrix of finite numbers. */
function check(A) {
  if (!Array.isArray(A) || !A.length || !Array.isArray(A[0]) || !A[0].length) {
    throw new Error('Not a matrix');
  }
  const n = A[0].length;
  for (const row of A) {
    if (!Array.isArray(row) || row.length !== n) throw new Error('Rows must be the same length');
    for (const v of row) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Matrix entries must be numbers');
  }
}

function checkSquare(A) {
  check(A);
  if (A.length !== A[0].length) throw new Error('Matrix must be square');
}

const clean = (v) => (Math.abs(v) < NOISE ? 0 : v);
const cleanM = (A) => A.map((row) => row.map(clean));
const copy = (A) => A.map((row) => row.slice());
const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));

function mul(A, B) {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(n).fill(0);
    for (let k = 0; k < p; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < n; j++) row[j] += a * B[k][j];
    }
    C.push(row);
  }
  return C;
}

/** The n×n identity matrix. */
export function identity(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('Size must be a positive integer');
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/** Raw one-sided Jacobi on a tall (m ≥ n) matrix, no cleaning. */
function jacobiTall(A) {
  const m = A.length;
  const n = A[0].length;
  const U = copy(A);
  const V = identity(n);
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let a = 0;
        let b = 0;
        let c = 0;
        for (let i = 0; i < m; i++) {
          a += U[i][p] * U[i][p];
          b += U[i][q] * U[i][q];
          c += U[i][p] * U[i][q];
        }
        if (Math.abs(c) <= EPS * Math.sqrt(a * b) || c === 0) continue;
        rotated = true;
        // rotation that makes columns p and q orthogonal
        const zeta = (b - a) / (2 * c);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const cs = 1 / Math.sqrt(1 + t * t);
        const sn = cs * t;
        for (let i = 0; i < m; i++) {
          const x = U[i][p];
          const y = U[i][q];
          U[i][p] = cs * x - sn * y;
          U[i][q] = sn * x + cs * y;
        }
        for (let i = 0; i < n; i++) {
          const x = V[i][p];
          const y = V[i][q];
          V[i][p] = cs * x - sn * y;
          V[i][q] = sn * x + cs * y;
        }
      }
    }
    if (!rotated) break;
  }

  // singular values are the column norms; sort descending
  const S = [];
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += U[i][j] * U[i][j];
    S.push(Math.sqrt(s));
  }
  const order = S.map((_, j) => j).sort((x, y) => S[y] - S[x]);
  const Us = U.map((row) => order.map((j) => row[j]));
  const Vs = V.map((row) => order.map((j) => row[j]));
  const Ss = order.map((j) => S[j]);

  // normalise U's columns; a zero singular value gets any unit vector orthogonal to the rest
  const tiny = Math.max(m, n) * EPS * (Ss[0] || 0);
  for (let j = 0; j < n; j++) {
    if (Ss[j] > tiny && Ss[j] > 0) {
      for (let i = 0; i < m; i++) Us[i][j] /= Ss[j];
      continue;
    }
    for (let e = 0; e < m; e++) {
      const v = new Array(m).fill(0);
      v[e] = 1;
      for (let k = 0; k < j; k++) {
        let d = 0;
        for (let i = 0; i < m; i++) d += Us[i][k] * v[i];
        for (let i = 0; i < m; i++) v[i] -= d * Us[i][k];
      }
      const norm = Math.hypot(...v);
      if (norm > 1e-6) {
        for (let i = 0; i < m; i++) Us[i][j] = v[i] / norm;
        break;
      }
    }
  }
  return { U: Us, S: Ss, V: Vs };
}

/**
 * Thin singular value decomposition A = U·diag(S)·Vᵀ by one-sided Jacobi.
 * For an m×n matrix with r = min(m, n): U is m×r, S has r values (largest
 * first) and V is n×r.
 * @param {number[][]} A
 * @returns {{ U: number[][], S: number[], V: number[][] }}
 */
export function svd(A) {
  check(A);
  const wide = A.length < A[0].length;
  const r = jacobiTall(wide ? transpose(A) : A);
  return wide
    ? { U: cleanM(r.V), S: r.S.map(clean), V: cleanM(r.U) }
    : { U: cleanM(r.U), S: r.S.map(clean), V: cleanM(r.V) };
}

/** Rank from singular values with the given relative tolerance (null: the usual one). */
function rankOf(A, rel) {
  const wide = A.length < A[0].length;
  const { S } = jacobiTall(wide ? transpose(A) : A);
  if (!S[0]) return 0;
  const tol = rel == null ? Math.max(A.length, A[0].length) * EPS * S[0] : rel * Math.max(1, S[0]);
  return S.filter((s) => s > tol).length;
}

/**
 * Reduced row echelon form, with partial pivoting.
 * @param {number[][]} A
 * @returns {number[][]}
 */
export function rref(A) {
  check(A);
  return cleanM(rrefRaw(A).R);
}

/** rref plus the pivot columns. */
function rrefRaw(A) {
  const R = copy(A);
  const m = R.length;
  const n = R[0].length;
  let big = 0;
  for (const row of R) for (const v of row) big = Math.max(big, Math.abs(v));
  const tol = 1e-10 * big;
  const pivots = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = r;
    for (let i = r + 1; i < m; i++) if (Math.abs(R[i][c]) > Math.abs(R[p][c])) p = i;
    if (Math.abs(R[p][c]) <= tol) {
      for (let i = r; i < m; i++) R[i][c] = 0;
      continue;
    }
    [R[r], R[p]] = [R[p], R[r]];
    const d = R[r][c];
    for (let j = 0; j < n; j++) R[r][j] /= d;
    for (let i = 0; i < m; i++) {
      if (i === r || R[i][c] === 0) continue;
      const f = R[i][c];
      for (let j = 0; j < n; j++) R[i][j] -= f * R[r][j];
      R[i][c] = 0;
    }
    pivots.push(c);
    r++;
  }
  return { R, pivots };
}

/**
 * Rank: singular values above max(m, n)·eps·σ₁.
 * @param {number[][]} A
 * @returns {number}
 */
export function rank(A) {
  check(A);
  return rankOf(A, null);
}

/**
 * Basis of the null space {x : A·x = 0}, read off the rref.
 * @param {number[][]} A
 * @returns {number[][]} n×k matrix whose columns are the basis; [] when only x = 0
 */
export function nullspace(A) {
  check(A);
  const n = A[0].length;
  const { R, pivots } = rrefRaw(A);
  const free = [];
  for (let c = 0; c < n; c++) if (!pivots.includes(c)) free.push(c);
  if (!free.length) return [];
  const N = Array.from({ length: n }, () => new Array(free.length).fill(0));
  free.forEach((f, k) => {
    N[f][k] = 1;
    pivots.forEach((pc, r) => {
      N[pc][k] = -R[r][f];
    });
  });
  return cleanM(N);
}

/**
 * Cholesky factor: lower-triangular L with A = L·Lᵀ.
 * @param {number[][]} A symmetric positive definite
 * @returns {number[][]}
 */
export function cholesky(A) {
  checkSquare(A);
  const n = A.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > 1e-9 * Math.max(1, Math.abs(A[i][j]))) {
        throw new Error('Not positive definite');
      }
    }
  }
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let d = A[j][j];
    for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k];
    if (!(d > 0)) throw new Error('Not positive definite');
    L[j][j] = Math.sqrt(d);
    for (let i = j + 1; i < n; i++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = s / L[j][j];
    }
  }
  return cleanM(L);
}

/**
 * 1 when A is symmetric positive definite, else 0.
 * @param {number[][]} A
 * @returns {0 | 1}
 */
export function isPosDef(A) {
  checkSquare(A);
  try {
    cholesky(A);
    return 1;
  } catch {
    return 0;
  }
}

/**
 * Jordan canonical form of a real matrix with real eigenvalues.
 *
 * Eigenvalues come from mathjs, are grouped (within 1e-6) and rounded to 9
 * digits; the number of blocks of size ≥ k for λ is
 * rank((A−λI)^(k−1)) − rank((A−λI)^k). Blocks go by eigenvalue ascending,
 * larger blocks first.
 * @param {number[][]} A
 * @returns {{ J: number[][], eigenvalues: number[] }} eigenvalues with multiplicity, ascending
 */
export function jordan(A) {
  checkSquare(A);
  const n = A.length;
  const values = eigs(A, { eigenvectors: false }).values;
  const list = (Array.isArray(values) ? values : values.toArray()).map((v) => {
    if (typeof v === 'number') return v;
    if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) throw new Error('Jordan form needs real eigenvalues');
    return v.re;
  });
  list.sort((a, b) => a - b);

  // group equal eigenvalues; each group's value is its mean, rounded
  const groups = [];
  for (const v of list) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(v - g.sum / g.count) <= 1e-6 * Math.max(1, Math.abs(v))) {
      g.sum += v;
      g.count++;
    } else groups.push({ sum: v, count: 1 });
  }

  const J = Array.from({ length: n }, () => new Array(n).fill(0));
  const eigenvalues = [];
  let at = 0;
  for (const g of groups) {
    const lambda = clean(Number((g.sum / g.count).toPrecision(9)));
    const B = A.map((row, i) => row.map((v, j) => (i === j ? v - lambda : v)));
    // ranks of B^0, B^1, ... until the multiplicity is used up
    const ranks = [n];
    let P = identity(n);
    while (n - ranks[ranks.length - 1] < g.count && ranks.length <= g.count) {
      P = mul(P, B);
      const r = rankOf(P, 1e-7);
      if (r === ranks[ranks.length - 1]) break;
      ranks.push(r);
    }
    // atLeast[k] = number of blocks of size ≥ k
    const atLeast = [0];
    for (let k = 1; k < ranks.length; k++) atLeast.push(ranks[k - 1] - ranks[k]);
    atLeast.push(0);
    const sizes = [];
    for (let k = atLeast.length - 2; k >= 1; k--) {
      for (let c = 0; c < atLeast[k] - atLeast[k + 1]; c++) sizes.push(k);
    }
    if (sizes.reduce((s, x) => s + x, 0) !== g.count) throw new Error('Jordan form is ill-conditioned');
    for (const size of sizes) {
      for (let i = 0; i < size; i++) {
        J[at + i][at + i] = lambda;
        if (i < size - 1) J[at + i][at + i + 1] = 1;
      }
      at += size;
    }
    for (let c = 0; c < g.count; c++) eigenvalues.push(lambda);
  }
  return { J, eigenvalues };
}
