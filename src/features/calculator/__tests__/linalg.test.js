import { svd, rref, rank, nullspace, cholesky, isPosDef, jordan, identity } from '@/features/calculator/math/linalg';

const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
const T = (A) => A[0].map((_, j) => A.map((row) => row[j]));
const near = (A, B, tol = 1e-9) => {
  expect(A.length).toBe(B.length);
  A.forEach((row, i) => row.forEach((v, j) => expect(Math.abs(v - B[i][j])).toBeLessThan(tol)));
};
// deterministic pseudo-random matrix
const rand = (m, n, seed = 1) => {
  let x = seed;
  return Array.from({ length: m }, () =>
    Array.from({ length: n }, () => {
      x = (x * 16807) % 2147483647;
      return (x / 2147483647) * 10 - 5;
    }),
  );
};

describe('svd', () => {
  it.each([
    [3, 2],
    [2, 3],
    [4, 4],
  ])('reconstructs a random %i×%i matrix', (m, n) => {
    const A = rand(m, n, m * 7 + n);
    const { U, S, V } = svd(A);
    const r = Math.min(m, n);
    expect(S).toHaveLength(r);
    expect(U).toHaveLength(m);
    expect(V).toHaveLength(n);
    for (let i = 1; i < r; i++) expect(S[i]).toBeLessThanOrEqual(S[i - 1]);
    const D = S.map((s, i) => S.map((_, j) => (i === j ? s : 0)));
    near(mul(mul(U, D), T(V)), A);
    near(mul(T(U), U), identity(r));
    near(mul(T(V), V), identity(r));
  });

  it('gets known singular values', () => {
    const { S } = svd([
      [3, 0],
      [4, 5],
    ]);
    expect(S[0]).toBeCloseTo(Math.sqrt(45), 12);
    expect(S[1]).toBeCloseTo(Math.sqrt(5), 12);
  });

  it('keeps U orthonormal for a rank-deficient matrix', () => {
    const { U, S } = svd([
      [1, 2],
      [2, 4],
      [3, 6],
    ]);
    expect(S[1]).toBe(0);
    near(mul(T(U), U), identity(2));
  });
});

describe('rref, rank, nullspace', () => {
  const A = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it('row reduces', () => {
    near(rref(A), [
      [1, 0, -1],
      [0, 1, 2],
      [0, 0, 0],
    ]);
    near(rref([[0, 2, 4], [1, 1, 1]]), [[1, 0, -1], [0, 1, 2]]);
  });

  it('finds the rank', () => {
    expect(rank(A)).toBe(2);
    expect(rank(identity(4))).toBe(4);
    expect(rank([[0, 0], [0, 0]])).toBe(0);
    expect(rank([[1, 2, 3]])).toBe(1);
  });

  it('gives a null space basis as columns', () => {
    const N = nullspace(A);
    expect(N).toHaveLength(3);
    expect(N[0]).toHaveLength(1);
    near(mul(A, N), [[0], [0], [0]]);
    const B = [[1, 1, 1, 1]];
    const NB = nullspace(B);
    expect(NB[0]).toHaveLength(3);
    near(mul(B, NB), [[0, 0, 0]]);
    expect(nullspace(identity(3))).toEqual([]);
  });

  it('rejects ragged input', () => {
    expect(() => rank([[1, 2], [3]])).toThrow('Rows must be the same length');
  });
});

describe('cholesky', () => {
  it('factors a textbook matrix', () => {
    near(
      cholesky([
        [4, 12, -16],
        [12, 37, -43],
        [-16, -43, 98],
      ]),
      [
        [2, 0, 0],
        [6, 1, 0],
        [-8, 5, 3],
      ],
    );
  });

  it('rejects non-positive-definite and non-symmetric matrices', () => {
    expect(() => cholesky([[1, 2], [2, 1]])).toThrow('Not positive definite');
    expect(() => cholesky([[2, 1], [0, 2]])).toThrow('Not positive definite');
    expect(() => cholesky([[1, 2, 3]])).toThrow('Matrix must be square');
    expect(isPosDef([[2, -1], [-1, 2]])).toBe(1);
    expect(isPosDef([[1, 2], [2, 1]])).toBe(0);
  });
});

describe('jordan', () => {
  it('finds a 2×2 block', () => {
    const { J, eigenvalues } = jordan([
      [5, 4, 2, 1],
      [0, 1, -1, -1],
      [-1, -1, 3, 0],
      [1, 1, -1, 2],
    ]);
    expect(eigenvalues).toEqual([1, 2, 4, 4]);
    expect(J).toEqual([
      [1, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 4, 1],
      [0, 0, 0, 4],
    ]);
  });

  it('keeps a Jordan block and diagonalises a diagonalisable matrix', () => {
    expect(jordan([[1, 1], [0, 1]]).J).toEqual([[1, 1], [0, 1]]);
    expect(jordan([[2, 0], [0, 2]]).J).toEqual([[2, 0], [0, 2]]);
    expect(jordan([[2, 1], [1, 2]]).J).toEqual([[1, 0], [0, 3]]);
  });

  it('throws on complex eigenvalues', () => {
    expect(() => jordan([[0, -1], [1, 0]])).toThrow('Jordan form needs real eigenvalues');
  });
});
