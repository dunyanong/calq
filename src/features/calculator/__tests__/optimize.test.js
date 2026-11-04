// Optimisation and root finding: textbook problems with known answers, and
// inputs that must throw a short message instead of a wrong number.
import {
  linprog,
  minimize1,
  minimizeConstrained,
  minimizeN,
  polyRoots,
  rootBracket,
  rootNewton,
} from '@/features/calculator/math/optimize';

describe('minimize1', () => {
  test('parabola', () => {
    const r = minimize1((x) => (x - 2) ** 2, -10, 10);
    expect(r.x).toBeCloseTo(2, 7);
    expect(r.f).toBe(0);
  });

  test('global minimum of sin on [0, 10]', () => {
    const r = minimize1(Math.sin, 0, 10);
    expect(r.x).toBeCloseTo((3 * Math.PI) / 2, 6);
    expect(r.f).toBeCloseTo(-1, 12);
  });

  test('endpoint minimum', () => {
    expect(minimize1((x) => x, 0, 1)).toEqual({ x: 0, f: 0 });
    expect(minimize1((x) => -x, 0, 1).x).toBe(1);
  });

  test('NaN samples are ignored', () => {
    expect(minimize1((x) => Math.sqrt(x), -5, 5)).toEqual({ x: 0, f: 0 });
    expect(() => minimize1(() => NaN, 0, 1)).toThrow('No minimum found');
  });
});

describe('minimizeN', () => {
  test('Rosenbrock from [−1.2, 1]', () => {
    const r = minimizeN(([x, y]) => 100 * (y - x * x) ** 2 + (1 - x) ** 2, [-1.2, 1]);
    expect(Math.abs(r.x[0] - 1)).toBeLessThan(1e-6);
    expect(Math.abs(r.x[1] - 1)).toBeLessThan(1e-6);
  });

  test('separable quadratic', () => {
    const r = minimizeN(([x, y]) => (x - 1) ** 2 + (y + 2) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(1, 8);
    expect(r.x[1]).toBeCloseTo(-2, 8);
    expect(r.f).toBe(0);
  });

  test('kink handled by the Nelder–Mead fallback', () => {
    const r = minimizeN(([x, y]) => Math.abs(x - 3) + (y - 1) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 5);
    expect(r.x[1]).toBeCloseTo(1, 5);
  });

  test('unbounded below throws', () => {
    expect(() => minimizeN(([x]) => x, [0])).toThrow('No minimum found');
    expect(() => minimizeN(([x, y]) => x * y, [1, 2])).toThrow('No minimum found');
  });
});

describe('minimizeConstrained', () => {
  test('min x + y on the unit circle', () => {
    const r = minimizeConstrained(([x, y]) => x + y, [{ g: ([x, y]) => x * x + y * y - 1, type: 'eq' }], [0, 0]);
    expect(r.x[0]).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(r.x[1]).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(r.f).toBeCloseTo(-Math.SQRT2, 6);
    expect(r.multipliers[0]).toBeCloseTo(Math.SQRT1_2, 5);
  });

  test('inequalities, one active', () => {
    const r = minimizeConstrained(
      ([x, y]) => (x - 2) ** 2 + (y - 1) ** 2,
      [
        { g: ([x, y]) => x + y - 2, type: 'le' },
        { g: ([x]) => x, type: 'ge' },
      ],
      [0, 0],
    );
    expect(r.x[0]).toBeCloseTo(1.5, 6);
    expect(r.x[1]).toBeCloseTo(0.5, 6);
    expect(r.multipliers[0]).toBeCloseTo(1, 5);
    expect(r.multipliers[1]).toBe(0);
  });

  test('infeasible constraints throw', () => {
    expect(() =>
      minimizeConstrained(([x]) => x * x, [{ g: ([x]) => x * x + 1, type: 'eq' }], [0]),
    ).toThrow('No feasible point found');
  });
});

describe('linprog', () => {
  test('textbook LP', () => {
    const r = linprog([3, 5], [[1, 0], [0, 2], [3, 2]], [4, 12, 18]);
    expect(r.value).toBe(36);
    expect(r.x).toEqual([2, 6]);
  });

  test('negative b needs phase 1', () => {
    // max −x − y with x + y ≥ 2 (−x − y ≤ −2), x ≤ 3
    const r = linprog([-1, -1], [[-1, -1], [1, 0]], [-2, 3]);
    expect(r.value).toBeCloseTo(-2, 12);
  });

  test('unbounded and infeasible', () => {
    expect(() => linprog([1, 1], [[1, -1]], [1])).toThrow('LP is unbounded');
    expect(() => linprog([1, 1], [[1, 1], [-1, -1]], [1, -2])).toThrow('LP is infeasible');
  });

  test('integer program', () => {
    const A = [[6, 4], [1, 2]];
    const lp = linprog([5, 4], A, [24, 6]);
    expect(lp.value).toBeCloseTo(21, 12);
    expect(lp.x[0]).toBeCloseTo(3, 12);
    expect(lp.x[1]).toBeCloseTo(1.5, 12);
    const ilp = linprog([5, 4], A, [24, 6], { integer: true });
    expect(ilp).toEqual({ x: [4, 0], value: 20 });
  });

  test('integer program with no integer point', () => {
    // 0.2 ≤ x ≤ 0.8
    expect(() => linprog([1], [[1], [-1]], [0.8, -0.2], { integer: true })).toThrow('No integer solution');
  });
});

describe('roots', () => {
  test('rootBracket', () => {
    expect(rootBracket(Math.cos, 0, 2)).toBeCloseTo(Math.PI / 2, 14);
    expect(rootBracket((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 14);
    expect(() => rootBracket((x) => x * x + 1, -1, 1)).toThrow('No sign change in [a, b]');
    expect(() => rootBracket((x) => 1 / x, -1, 2)).toThrow('f jumps across 0 in [a, b]');
  });

  test('rootNewton', () => {
    expect(rootNewton((x) => x ** 3 - 2 * x - 5, 2)).toBeCloseTo(2.0945514815, 10);
    expect(rootNewton((x) => Math.exp(x) - 2, 10)).toBeCloseTo(Math.LN2, 12);
    expect(rootNewton((x) => (x - 1) ** 2, 3)).toBeCloseTo(1, 6);
    expect(() => rootNewton((x) => x * x + 1, 0.5)).toThrow('No root found near the guess');
  });

  test('polyRoots', () => {
    expect(polyRoots([1, 0, 1])).toEqual([
      { re: 0, im: -1 },
      { re: 0, im: 1 },
    ]);
    const r = polyRoots([1, -6, 11, -6]);
    expect(r.map((z) => z.im)).toEqual([0, 0, 0]);
    r.forEach((z, i) => expect(z.re).toBeCloseTo(i + 1, 12));
    expect(polyRoots([0, 2, -4])).toEqual([{ re: 2, im: 0 }]); // leading zero stripped
    expect(polyRoots([1, 0, 0]).length).toBe(2);
    expect(() => polyRoots([0, 5])).toThrow('Not a polynomial');
  });
});
