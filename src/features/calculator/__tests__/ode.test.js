// ODE solvers: initial and boundary value problems with known closed forms,
// and the classification of linear equilibria.
import { bvp, ode1, ode2, solveSystem, stability } from '@/features/calculator/math/ode';

describe('ode1', () => {
  test("y′ = y, y(0) = 1 gives e at 1", () => {
    expect(Math.abs(ode1((x, y) => y, 0, 1, 1) - Math.E)).toBeLessThan(1e-9);
  });
  test("y′ = −2xy, y(0) = 1 gives e^−4 at 2", () => {
    expect(Math.abs(ode1((x, y) => -2 * x * y, 0, 1, 2) - Math.exp(-4))).toBeLessThan(1e-10);
  });
  test('backwards in x', () => {
    expect(ode1((x, y) => y, 1, Math.E, 0)).toBeCloseTo(1, 9);
  });
  test('same point returns y0', () => {
    expect(ode1((x, y) => y, 2, 5, 2)).toBe(5);
  });
  test('blow-up throws', () => {
    expect(() => ode1((x, y) => y * y, 0, 1, 2)).toThrow();
  });
});

describe('ode2 and solveSystem', () => {
  test("y″ = −y, y(0) = 0, y′(0) = 1 gives 1 at π/2", () => {
    expect(ode2((x, y) => -y, 0, 0, 1, Math.PI / 2)).toBeCloseTo(1, 9);
  });
  test('rotation system', () => {
    const [c, s] = solveSystem((x, [u, v]) => [-v, u], 0, [1, 0], 1);
    expect(c).toBeCloseTo(Math.cos(1), 9);
    expect(s).toBeCloseTo(Math.sin(1), 9);
  });
});

describe('bvp', () => {
  test("y″ = −y, y(0) = 0, y(π/2) = 1 gives sin(π/4)", () => {
    expect(bvp((x, y) => -y, 0, 0, Math.PI / 2, 1, Math.PI / 4)).toBeCloseTo(Math.SQRT1_2, 9);
  });
  test("nonlinear: y″ = 1.5y², y(0) = 4, y(1) = 1 has y = 4/(1+x)²", () => {
    expect(bvp((x, y) => 1.5 * y * y, 0, 4, 1, 1, 0.5)).toBeCloseTo(4 / 2.25, 7);
  });
  test('x outside [a, b] throws', () => {
    expect(() => bvp((x, y) => -y, 0, 0, 1, 1, 2)).toThrow();
  });
  test('no solution: y″ = −y, y(0) = 0, y(π) = 1', () => {
    expect(() => bvp((x, y) => -y, 0, 0, Math.PI, 1, 1)).toThrow('No solution found');
  });
});

describe('stability', () => {
  test.each([
    [[[-1, 0], [0, -2]], 'stable node'],
    [[[1, 0], [0, 2]], 'unstable node'],
    [[[0, 1], [-1, 0]], 'centre'],
    [[[1, 0], [0, -1]], 'saddle'],
    [[[-1, 2], [-2, -1]], 'stable spiral'],
    [[[1, 2], [-2, 1]], 'unstable spiral'],
    [[[1, 0], [0, 0]], 'degenerate'],
    [[[-1, 0, 0], [0, -2, 1], [0, 0, -3]], 'asymptotically stable'],
    [[[0, 1, 0], [-1, 0, 0], [0, 0, 1]], 'unstable'],
    [[[0, 1, 0], [-1, 0, 0], [0, 0, -1]], 'marginally stable'],
  ])('%j is %s', (J, type) => expect(stability(J).type).toBe(type));

  test('eigenvalues', () => {
    expect(stability([[-1, 0], [0, -2]]).eigenvalues).toEqual([-1, -2]);
    expect(stability([[0, 1], [-1, 0]]).eigenvalues).toEqual([{ re: 0, im: 1 }, { re: 0, im: -1 }]);
    const big = stability([[0, 1, 0], [-1, 0, 0], [0, 0, -1]]).eigenvalues;
    expect(big).toHaveLength(3);
    expect(big.some((v) => typeof v === 'object' && Math.abs(v.im - 1) < 1e-9)).toBe(true);
  });
  test('non-square throws', () => {
    expect(() => stability([[1, 2]])).toThrow('Need a square matrix');
  });
});
