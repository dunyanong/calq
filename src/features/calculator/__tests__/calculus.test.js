// Stress test for ∫dx and d/dx: textbook values, awkward integrands, and
// inputs that must give Error instead of a wrong number.
import { evaluate } from '@/features/calculator/math/engine';
import { differentiate, integrate } from '@/features/calculator/math/calculus';
import { formatNumber } from '@/features/calculator/math/format';

const calc = (expr, angle = 'rad', output = 'dec') => formatNumber(evaluate(expr, angle), output);
const shown = (v) => formatNumber(v); // the 10 digits the display shows

describe('∫(f(x),a,b)', () => {
  test.each([
    ['∫(x²,0,1)', 1 / 3],
    ['∫(x³−2x+1,−1,2)', 3.75],
    ['∫(sin(x),0,π)', 2],
    ['∫(cos(x),0,π÷2)', 1],
    ['∫(e^(x),0,1)', Math.E - 1],
    ['∫(1÷x,1,e)', 1],
    ['∫(x²,1,0)', -1 / 3], // reversed limits
    ['∫(5,2,2)', 0], // equal limits
    ['∫(1÷√(x),0,1)', 2], // endpoint singularity
    ['∫(ln(x),0,1)', -1],
    ['∫(√(1−x²),−1,1)', Math.PI / 2], // vertical tangents at both ends
    ['∫(1÷√(1−x²),−1,1)', Math.PI], // singular at both ends
    ['∫(x^(−0.9),0,1)', 10], // strong endpoint singularity
    ['∫(ln(sin(x)),0,π)', -Math.PI * Math.LN2],
    ['∫(e^(−x²),−10,10)', Math.sqrt(Math.PI)],
    ['∫(1÷(1+x²),−1000,1000)', 2 * Math.atan(1000)],
    ['∫(sin(50x),0,π)', 0], // oscillating
    ['∫(sin(x),0,100π)', 0],
    ['∫(abs(x),−1,2)', 2.5], // corner
    ['∫(floor(x),0,3)', 3], // jumps
    ['∫(x^x,0,1)', 0.7834305107121344],
    ['∫(x×∫(x,0,x),0,1)', 1 / 8], // nested: inner limit is the outer x
    ['2∫(x,0,1)+1', 2], // inside a larger expression
    ['∫(x(x+1),0,1)', 5 / 6], // x( multiplies
    ['∫(πx,0,1)', Math.PI / 2],
  ])('%s', (expr, want) => {
    expect(calc(expr)).toBe(shown(want));
  });

  test('fraction output', () => {
    expect(calc('∫(x²,0,1)', 'rad', 'frac')).toBe('1/3');
  });

  test('trig follows the angle mode, like a Casio', () => {
    // ∫ sin(x°) dx from 0 to 90 = 180/π
    expect(calc('∫(sin(x),0,90)', 'deg')).toBe(shown(180 / Math.PI));
    expect(calc('∫(sin(x),0,100)', 'grad')).toBe(shown(200 / Math.PI));
  });

  test.each([
    '∫(1÷x,−1,1)', // pole inside
    '∫(√(x),−1,1)', // undefined on part of the range
    '∫(1÷x²,0,1)', // diverges
    '∫(x²,0)', // missing limit
    '∫(x²,0,1,2)',
    '∫(x²,0,x)', // x is not defined outside
    '∫(tan(x),0,π)', // pole at π/2 that is never sampled exactly
    '∫(tan(x),0,3)',
    '∫(1÷(x−0.3),0,1)',
  ])('%s is an error', (expr) => {
    expect(evaluate(expr, 'rad')).toBeNull();
  });
});

describe('d/dx(f(x),a)', () => {
  test.each([
    ['d/dx(x³,2)', 12],
    ['d/dx(x²+3x,−1)', 1],
    ['d/dx(sin(x),0)', 1],
    ['d/dx(cos(x),π÷2)', -1],
    ['d/dx(e^(x),1)', Math.E],
    ['d/dx(ln(x),0.001)', 1000], // close to where ln is undefined
    ['d/dx(√(x),4)', 0.25],
    ['d/dx(x^10,3)', 10 * 3 ** 9],
    ['d/dx(tan(x),1.5)', 1 / Math.cos(1.5) ** 2], // steep, next to a pole
    ['d/dx(x²,10^6)', 2e6],
    ['d/dx(1÷x,−2)', -0.25],
    ['d/dx(abs(x),3)', 1],
    ['d/dx(floor(x),0.5)', 0],
    ['d/dx(d/dx(x³,x),2)', 12], // second derivative
    ['d/dx(∫(x²,0,x),3)', 9], // fundamental theorem
    ['d/dx(x³−3x,1)', 0], // stationary point: no rounding noise
    ['d/dx(sin(x),π÷2)', 0],
  ])('%s', (expr, want) => {
    expect(calc(expr)).toBe(shown(want));
  });

  test('trig follows the angle mode, like a Casio', () => {
    expect(calc('d/dx(sin(x),0)', 'deg')).toBe(shown(Math.PI / 180));
    expect(calc('d/dx(sin(x),0)', 'grad')).toBe(shown(Math.PI / 200));
  });

  test.each([
    'd/dx(abs(x),0)', // corner
    'd/dx(√(x),0)', // undefined on the left
    'd/dx(1÷x,0)', // pole
    'd/dx(floor(x),1)', // jump
    'd/dx(x²)', // missing point
    'd/dx(x²,1,2)',
  ])('%s is an error', (expr) => {
    expect(evaluate(expr, 'rad')).toBeNull();
  });
});

describe('outside calculus', () => {
  test('x is not defined', () => {
    expect(evaluate('x+1')).toBeNull();
    expect(evaluate('2x')).toBeNull();
  });
});

describe('numeric routines', () => {
  test('a divergent integral gives up quickly', () => {
    let calls = 0;
    const t0 = Date.now();
    expect(integrate((x) => (calls++, 1 / x), 0, 1)).toBeNaN();
    expect(calls).toBeLessThanOrEqual(20015);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  test('infinite limits are not supported', () => {
    expect(integrate((x) => x, 0, Infinity)).toBeNaN();
    expect(differentiate((x) => x, NaN)).toBeNaN();
  });
});
