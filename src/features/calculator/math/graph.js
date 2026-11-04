// Graph algorithms on weight / adjacency matrices.
//
// W[i][j] nonzero and finite means an edge i→j with that weight; 0 or
// Infinity means no edge, and the diagonal is ignored. A symmetric matrix is
// an undirected graph. Vertices are numbered from 1 for the user. Bad input
// throws an Error whose message is short enough for a toast.

import { eigs } from 'mathjs';

/** Checks A is a non-empty square matrix of numbers (±Infinity allowed). */
function checkSquare(A) {
  if (!Array.isArray(A) || !A.length || !Array.isArray(A[0])) throw new Error('Not a matrix');
  const n = A.length;
  for (const row of A) {
    if (!Array.isArray(row) || row.length !== n) throw new Error('Matrix must be square');
    for (const v of row) if (typeof v !== 'number' || Number.isNaN(v)) throw new Error('Matrix entries must be numbers');
  }
  return n;
}

/** 1-based vertex number → 0-based index. */
function vertex(v, n) {
  if (!Number.isInteger(v) || v < 1 || v > n) throw new Error(`Vertex must be 1 to ${n}`);
  return v - 1;
}

const isEdge = (A, i, j) => i !== j && A[i][j] !== 0 && Number.isFinite(A[i][j]);
const linked = (A, i, j) => isEdge(A, i, j) || isEdge(A, j, i);

function isSymmetric(A) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = A[i][j];
      const b = A[j][i];
      if (a !== b && !(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)))) return false;
    }
  }
  return true;
}

/** Union–find with path halving. */
function makeSets(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
    return true;
  };
  return { find, union };
}

/**
 * Shortest path from s to t: Dijkstra, or Bellman–Ford when a weight is
 * negative.
 * @param {number[][]} W weight matrix
 * @param {number} s start vertex (1-based)
 * @param {number} t end vertex (1-based)
 * @returns {{ dist: number, path: number[] }} path as 1-based vertices
 */
export function shortestPath(W, s, t) {
  const n = checkSquare(W);
  const src = vertex(s, n);
  const dst = vertex(t, n);
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  dist[src] = 0;

  let negative = false;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (isEdge(W, i, j) && W[i][j] < 0) negative = true;

  if (!negative) {
    const done = new Array(n).fill(false);
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === dst) break;
      done[u] = true;
      for (let v = 0; v < n; v++) {
        if (isEdge(W, u, v) && dist[u] + W[u][v] < dist[v]) {
          dist[v] = dist[u] + W[u][v];
          prev[v] = u;
        }
      }
    }
  } else {
    for (let round = 0; round < n; round++) {
      let changed = false;
      for (let u = 0; u < n; u++) {
        if (dist[u] === Infinity) continue;
        for (let v = 0; v < n; v++) {
          if (isEdge(W, u, v) && dist[u] + W[u][v] < dist[v]) {
            dist[v] = dist[u] + W[u][v];
            prev[v] = u;
            changed = true;
          }
        }
      }
      if (!changed) break;
      if (round === n - 1) throw new Error('Negative cycle');
    }
  }

  if (dist[dst] === Infinity) throw new Error(`No path from ${s} to ${t}`);
  const path = [];
  for (let v = dst; v !== -1; v = prev[v]) path.unshift(v + 1);
  return { dist: dist[dst], path };
}

/**
 * Minimum spanning tree (Kruskal) of an undirected graph.
 * @param {number[][]} W symmetric weight matrix
 * @returns {{ weight: number, edges: [number, number, number][] }} edges as [u, v, w], u < v, 1-based
 */
export function mst(W) {
  const n = checkSquare(W);
  if (!isSymmetric(W)) throw new Error('MST needs a symmetric matrix');
  const all = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (isEdge(W, i, j)) all.push([i, j, W[i][j]]);
  all.sort((a, b) => a[2] - b[2]);
  const sets = makeSets(n);
  const edges = [];
  let weight = 0;
  for (const [u, v, w] of all) {
    if (!sets.union(u, v)) continue;
    edges.push([u + 1, v + 1, w]);
    weight += w;
  }
  if (edges.length !== n - 1) throw new Error('Graph is not connected');
  return { weight, edges };
}

/**
 * Maximum flow from s to t (Edmonds–Karp).
 * @param {number[][]} C capacities, C[i][j] ≥ 0
 * @param {number} s source (1-based)
 * @param {number} t sink (1-based)
 * @returns {number}
 */
export function maxFlow(C, s, t) {
  const n = checkSquare(C);
  const src = vertex(s, n);
  const dst = vertex(t, n);
  if (src === dst) throw new Error('Source and sink must differ');
  const R = C.map((row, i) =>
    row.map((c, j) => {
      if (i === j || !Number.isFinite(c)) return 0;
      if (c < 0) throw new Error('Capacities must be ≥ 0');
      return c;
    }),
  );
  let flow = 0;
  for (;;) {
    // shortest augmenting path by BFS
    const prev = new Array(n).fill(-1);
    prev[src] = src;
    const queue = [src];
    while (queue.length && prev[dst] < 0) {
      const u = queue.shift();
      for (let v = 0; v < n; v++) {
        if (prev[v] < 0 && R[u][v] > 0) {
          prev[v] = u;
          queue.push(v);
        }
      }
    }
    if (prev[dst] < 0) return flow;
    let push = Infinity;
    for (let v = dst; v !== src; v = prev[v]) push = Math.min(push, R[prev[v]][v]);
    for (let v = dst; v !== src; v = prev[v]) {
      R[prev[v]][v] -= push;
      R[v][prev[v]] += push;
    }
    flow += push;
  }
}

/**
 * Minimum-cost perfect assignment of rows to columns (Hungarian, O(n³)).
 * @param {number[][]} W square cost matrix
 * @returns {{ cost: number, match: number[] }} match[i] is the 1-based column for row i + 1
 */
export function assignment(W) {
  const n = checkSquare(W);
  for (const row of W) for (const v of row) if (!Number.isFinite(v)) throw new Error('Costs must be finite');
  // potentials u (rows), v (columns); p[j] = row matched to column j, 1-based with 0 as a dummy
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = W[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const match = new Array(n);
  for (let j = 1; j <= n; j++) match[p[j] - 1] = j;
  const cost = match.reduce((s, j, i) => s + W[i][j - 1], 0);
  return { cost, match };
}

/**
 * Chromatic number by backtracking; edges in either direction count.
 * @param {number[][]} A adjacency matrix, at most 12 vertices
 * @returns {{ k: number, colours: number[] }} colours[i] in 1..k for vertex i + 1
 */
export function chromatic(A) {
  const n = checkSquare(A);
  if (n > 12) throw new Error('Colouring needs ≤ 12 vertices');
  const adj = Array.from({ length: n }, (_, i) => {
    const out = [];
    for (let j = 0; j < n; j++) if (linked(A, i, j)) out.push(j);
    return out;
  });
  // colour high-degree vertices first: fewer dead ends
  const order = adj.map((_, i) => i).sort((a, b) => adj[b].length - adj[a].length);
  const colours = new Array(n).fill(0);
  const fill = (at, k) => {
    if (at === n) return true;
    const x = order[at];
    // a new colour only one more than the largest used so far (symmetry)
    let top = 0;
    for (let i = 0; i < at; i++) top = Math.max(top, colours[order[i]]);
    for (let c = 1; c <= Math.min(k, top + 1); c++) {
      if (adj[x].some((y) => colours[y] === c)) continue;
      colours[x] = c;
      if (fill(at + 1, k)) return true;
    }
    colours[x] = 0;
    return false;
  };
  for (let k = 1; ; k++) if (fill(0, k)) return { k, colours: colours.slice() };
}

/**
 * Number of connected components (weakly connected for a directed graph).
 * @param {number[][]} A adjacency matrix
 * @returns {number}
 */
export function components(A) {
  const n = checkSquare(A);
  const sets = makeSets(n);
  let count = n;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (linked(A, i, j) && sets.union(i, j)) count--;
  return count;
}

/** Unweighted Laplacian of the undirected graph behind A. */
function laplacian(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!linked(A, i, j)) continue;
      L[i][j] = -1;
      L[i][i]++;
    }
  }
  return L;
}

/** Determinant by elimination with partial pivoting. */
function det(M) {
  const A = M.map((row) => row.slice());
  const n = A.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (A[p][c] === 0) return 0;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      d = -d;
    }
    d *= A[c][c];
    for (let i = c + 1; i < n; i++) {
      const f = A[i][c] / A[c][c];
      for (let j = c; j < n; j++) A[i][j] -= f * A[c][j];
    }
  }
  return d;
}

/**
 * Number of spanning trees (Kirchhoff's matrix-tree theorem) of the
 * undirected, unweighted graph behind A.
 * @param {number[][]} A adjacency matrix
 * @returns {number}
 */
export function spanningTrees(A) {
  const n = checkSquare(A);
  if (n === 1) return 1;
  const L = laplacian(A);
  const r = Math.round(det(L.slice(1).map((row) => row.slice(1))));
  return r === 0 ? 0 : r; // no −0
}

/**
 * Algebraic connectivity: the second-smallest eigenvalue of the Laplacian of
 * the undirected, unweighted graph behind A (0 when disconnected).
 * @param {number[][]} A adjacency matrix, at least 2 vertices
 * @returns {number}
 */
export function fiedler(A) {
  const n = checkSquare(A);
  if (n < 2) throw new Error('Needs at least 2 vertices');
  const values = eigs(laplacian(A), { eigenvectors: false }).values;
  const list = (Array.isArray(values) ? values : values.toArray()).map(Number).sort((a, b) => a - b);
  const l = list[1];
  if (Math.abs(l) < 1e-12) return 0;
  return Math.abs(l - Math.round(l)) < 1e-9 ? Math.round(l) : l;
}
