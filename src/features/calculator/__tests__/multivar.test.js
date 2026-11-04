// Multivariable calculus: textbook integrals over curved regions, the
// vector-calculus operators, and limits that must exist or must throw.
import {
  curl,
  divergence,
  double,
  gradient,
  hessian,
  jacobian,
  laplacian,
  limit,
  partial,
  triple,
} from '@/features/calculator/math/multivar';

const k = (v) => () => v;
const close = (actual, expected, digits = 8) => expect(actual).toBeCloseTo(expected, digits);
const closeAll = (actual, expected, digits = 6) =>
  expected.flat().forEach((e, i) => close(actual.flat()[i], e, digits));

describe('double', () => {
  test('x·y over the triangle 0 ≤ y ≤ x ≤ 1', () => {
    close(double((x, y) => x * y, 0, 1, k(0), (x) => x), 1 / 8, 10);
  });
  test('area of the unit disc', () => {
    const top = (x) => Math.sqrt(1 - x * x);
    close(double(() => 1, -1, 1, (x) => -top(x), top), Math.PI, 8);
  });
  test('Gaussian over [−5, 5]²', () => {
    close(double((x, y) => Math.exp(-x * x - y * y), -5, 5, k(-5), k(5)), Math.PI, 8);
  });
  test('reversed limits change the sign', () => {
    close(double((x, y) => x + y, 1, 0, k(0), k(1)), -1, 10);
  });
  test('divergent integral throws', () => {
    expect(() => double((x, y) => 1 / (x * y), 0, 1, k(0), k(1))).toThrow('Integral does not converge');
  });
});

describe('triple', () => {
  test('volume of the unit cube', () => {
    close(triple(() => 1, 0, 1, k(0), k(1), k(0), k(1)), 1, 10);
  });
  test('x + y + z over the unit cube', () => {
    close(triple((x, y, z) => x + y + z, 0, 1, k(0), k(1), k(0), k(1)), 1.5, 10);
  });
  test('volume of the unit ball', () => {
    const r = (x) => Math.sqrt(Math.max(0, 1 - x * x));
    const s = (x, y) => Math.sqrt(Math.max(0, 1 - x * x - y * y));
    close(triple(() => 1, -1, 1, (x) => -r(x), r, (x, y) => -s(x, y), s), (4 / 3) * Math.PI, 6);
  });
});

describe('derivatives', () => {
  test('partial', () => {
    close(partial(([x, y]) => x * x * y, [1, 2], 0), 4);
    close(partial(([x, y]) => x * x * y, [1, 2], 1), 1);
  });
  test('gradient of x²y at (1, 2)', () => {
    closeAll(gradient(([x, y]) => x * x * y, [1, 2]), [4, 1], 8);
  });
  test('hessian of x²y + y³ at (1, 2)', () => {
    const h = hessian(([x, y]) => x * x * y + y ** 3, [1, 2]);
    closeAll(h, [[4, 2], [2, 12]], 5);
    expect(h[0][1]).toBe(h[1][0]);
  });
  test('jacobian of (x²y, 5x + sin y) at (1, 0)', () => {
    closeAll(jacobian([([x, y]) => x * x * y, ([x, y]) => 5 * x + Math.sin(y)], [1, 0]), [[0, 1], [5, 1]], 8);
  });
  test('divergence of (x, y, z) is 3', () => {
    close(divergence([([x]) => x, ([, y]) => y, ([, , z]) => z], [1, 2, 3]), 3);
  });
  test('curl of (−y, x, 0) is (0, 0, 2)', () => {
    expect(curl([([, y]) => -y, ([x]) => x, () => 0], [1, 2, 3])).toEqual([0, 0, expect.any(Number)]);
    close(curl([([, y]) => -y, ([x]) => x, () => 0], [1, 2, 3])[2], 2);
  });
  test('2-D curl is a scalar', () => {
    close(curl([([, y]) => -y, ([x]) => x], [0.5, 0.5]), 2);
  });
  test('laplacian of x² + y² + z² is 6', () => {
    close(laplacian(([x, y, z]) => x * x + y * y + z * z, [1, -2, 0.5]), 6, 5);
  });
  test('corner throws', () => {
    expect(() => gradient(([x, y]) => Math.abs(x) + y, [0, 1])).toThrow('Not differentiable here');
  });
});

describe('limit', () => {
  test.each([
    ['sin(x)/x at 0', (x) => Math.sin(x) / x, 0, 1],
    ['(1 + 1/x)^x at ∞', (x) => (1 + 1 / x) ** x, Infinity, Math.E],
    ['(x² − 1)/(x − 1) at 1', (x) => (x * x - 1) / (x - 1), 1, 2],
    ['(1 − cos x)/x² at 0', (x) => (1 - Math.cos(x)) / (x * x), 0, 0.5],
    ['e^x at −∞', (x) => Math.exp(x), -Infinity, 0],
    ['x² at 3', (x) => x * x, 3, 9],
  ])('%s', (_, f, a, expected) => close(limit(f, a), expected, 7));

  test('1/x at 0 does not exist', () => {
    expect(() => limit((x) => 1 / x, 0)).toThrow('Limit does not exist');
  });
  test('|x|/x at 0 does not exist', () => {
    expect(() => limit((x) => Math.abs(x) / x, 0)).toThrow('Limit does not exist');
  });
  test('1/x² at 0 is infinite', () => {
    expect(() => limit((x) => 1 / (x * x), 0)).toThrow('Limit is infinite');
  });
  test('x at ∞ is infinite', () => {
    expect(() => limit((x) => x, Infinity)).toThrow('Limit is infinite');
  });
});
