// The advanced keys end to end: display notation -> compute() -> result text, as the
// calculator shows it. The algorithms have their own tests (linalg, multivar, ode …).
import { compute, isHeavy, usesComplex } from '@/features/calculator/math/engine';
import { formatValue, matrixRows } from '@/features/calculator/math/format';
import { symbolicDerivative } from '@/features/calculator/math/symbolic';

const show = (expr, angle = 'rad', numbers = 'real', output = 'dec') => {
  const res = compute(expr, angle, numbers);
  return res.error ? 'Error: ' + res.error : formatValue(res, output);
};

describe('linear algebra', () => {
  test.each([
    ['det([1,2;3,4])', '-2'],
    ['[1,2;3,4]ᵀ', '[1,3;2,4]'],
    ['[1,2;3,4]⁻¹', '[-2,1;1.5,-0.5]'],
    ['inv([2,0;0,4])', '[0.5,0;0,0.25]'],
    ['[1,2;3,4]×[5;6]', '[17;39]'],
    ['rank([1,2;2,4])', '1'],
    ['trace([1,2;3,4])', '5'],
    ['solve([2,1;1,−1],[5,1])', '[2,1]'],
    ['rref([1,2,3;4,5,6;7,8,9])', '[1,0,-1;0,1,2;0,0,0]'],
    ['chol([4,2;2,3])', '[2,0;1,1.414213562]'],
    ['posdef([2,−1;−1,2])', '1'],
    ['jordan([1,1;0,1])', '[1,1;0,1]'],
    ['I(2)', '[1,0;0,1]'],
    ['cross([1,0,0],[0,1,0])', '[0,0,1]'],
    ['dot([1,2,3],[4,5,6])', '32'],
    ['norm([3,4])', '5'],
  ])('%s = %s', (expr, want) => expect(show(expr)).toBe(want));

  test('several results are named', () => {
    expect(show('eig([2,0;0,3])')).toMatch(/^λ=\[2,3\], V=/);
    expect(show('svd([3,0;4,5])')).toMatch(/^U=\[.*\], Σ=\[6\.708203932,2\.236067977\], V=/);
    expect(show('lu([1,2;3,4])')).toMatch(/^L=\[.*\], U=\[.*\], P=\[0,1;1,0\]$/);
  });

  test('a rotation has complex eigenvalues, even in real mode', () => {
    expect(show('eig([0,1;−1,0])')).toMatch(/^λ=\[i,−i\]|^λ=\[−i,i\]/);
  });

  test('clear messages for wrong sizes', () => {
    expect(show('det([1,2,3;4,5,6])')).toBe('Error: Matrix must be square');
    expect(show('[1,2]+[1,2,3]')).toBe('Error: Matrix sizes don’t match');
    expect(show('inv([1,2;2,4])')).toMatch(/^Error: /);
  });
});

describe('complex numbers', () => {
  test('real mode keeps √(−4) an error, with a hint', () => {
    expect(show('√(−4)')).toBe('Error: Check the expression');
    expect(show('ln(−1)', 'rad', 'real')).toBe('Error: Check the expression');
  });

  test.each([
    ['√(−4)', '2i'],
    ['(3+4i)×(1−2i)', '11−2i'],
    ['abs(3+4i)', '5'],
    ['i²', '-1'],
    ['e^(iπ)', '-1'],
    ['conj(2+3i)', '2−3i'],
    ['re(2+3i)+im(2+3i)', '5'],
    ['sin⁻¹(2)', '1.570796327−1.316957897i'],
  ])('complex mode: %s = %s', (expr, want) => expect(show(expr, 'rad', 'complex')).toBe(want));

  test('an i switches to complex numbers by itself', () => {
    expect(usesComplex('2+3i')).toBe(true);
    expect(usesComplex('sin(30)')).toBe(false);
    expect(show('(1+i)²')).toBe('2i');
  });

  test('arg follows the angle mode', () => {
    expect(show('arg(i)', 'deg')).toBe('90');
    expect(show('arg(i)', 'rad')).toBe('1.570796327');
  });
});

describe('multivariable calculus', () => {
  test.each([
    ['∬(x×y,0,1,0,x)', '0.125'],
    ['∬(1,−1,1,−√(1−x²),√(1−x²))', '3.141592654'],
    ['∭(x+y+z,0,1,0,1,0,1)', '1.5'],
    ['∂x(x²y,1,2)', '4'],
    ['∂y(x²y,1,2)', '1'],
    ['grad(x²y,[1,2])', '[4,1]'],
    ['hess(x²y+y³,[1,2])', '[4,2;2,12]'],
    ['curl([−y,x,0],[1,2,3])', '[0,0,2]'],
    ['lap(x²+y²+z²,[1,2,3])', '6'],
    ['lim(sin(x)÷x,0)', '1'],
    ['lim((1+1÷x)^x,∞)', '2.718281828'],
  ])('%s = %s', (expr, want) => expect(show(expr)).toBe(want));

  test('formulas: partial derivatives and Taylor polynomials', () => {
    expect(symbolicDerivative('∂x(x²y)', 'rad')).toEqual({ text: '2yx' });
    expect(symbolicDerivative('∂y(x²y+y³)', 'rad').text).toMatch(/x²\+3y²|3y²\+x²/);
    expect(symbolicDerivative('taylor(e^(x),0,3)', 'rad').text).toMatch(/x³÷6/);
    expect(symbolicDerivative('taylor(e^(x),0,30)', 'rad')).toEqual({ error: 'taylor needs a whole n from 0 to 12' });
  });
});

describe('differential equations', () => {
  test.each([
    ['ode(y,0,1,1)', '2.718281828'],
    ['ode2(−y,0,0,1,π÷2)', '1'],
    ['bvp(−y,0,0,π÷2,1,π÷4)', '0.7071067812'],
  ])('%s = %s', (expr, want) => expect(show(expr)).toBe(want));

  test('stability of an equilibrium', () => {
    expect(show('stab([0,1;−1,0])')).toMatch(/^centre, λ=/);
    expect(show('stab([1,0;0,−1])')).toMatch(/^saddle/);
  });
});

describe('optimisation and equations', () => {
  test.each([
    ['min((x−2)²+1,−10,10)', 'x=2, min=1'],
    ['max(−(x−1)²,−5,5)', 'x=1, max=0'],
    ['min((x−1)²+(y+2)²,[0,0])', 'x=1, y=-2, min=0'],
    ['lp([3,5],[1,0;0,2;3,2],[4,12,18])', 'x=[2,6], max=36'],
    ['ilp([5,4],[6,4;1,2],[24,6])', 'x=[4,0], max=20'],
    ['root(cos(x),0,2)', '1.570796327'],
    ['nsolve(x³=2x+5,2)', '2.094551482'],
    ['roots([1,−6,11,−6])', '[1,2,3]'],
    ['roots([1,0,1])', '[−i,i]'],
    ['min(3,5)', '3'], // plain numbers: as before
  ])('%s = %s', (expr, want) => expect(show(expr)).toBe(want));

  test('constrained: min x+y on the unit circle', () => {
    expect(show('minc(x+y,[x²+y²=1],[−1,0])')).toBe('x=-0.7071067812, y=-0.7071067812, min=-1.414213562, λ=[0.7071067812]');
  });

  test('a bad constraint is explained', () => {
    expect(show('minc(x+y,[x+y],[0,0])')).toBe('Error: Write constraints with =, ≤ or ≥');
  });
});

describe('discrete maths and graphs', () => {
  test.each([
    ['mod(−7,3)', '2'],
    ['isprime(97)', '1'],
    ['factor(360)', '2³×3²×5'],
    ['φ(36)', '12'],
    ['modinv(3,11)', '4'],
    ['modpow(4,13,497)', '445'],
    ['and(1,0)+or(1,0)+xor(1,1)+not(0)', '2'],
    ['rec(2x+1,0,10)', '1023'],
    ['catalan(5)', '42'],
    ['stirling(5,2)', '15'],
    ['bell(5)', '52'],
    ['union([3,1],[2,3])', '[1,2,3]'],
    ['inter([1,2,3],[2,3,4])', '[2,3]'],
    ['path([0,1,4;1,0,2;4,2,0],1,3)', 'd=3, path=[1,2,3]'],
    ['flow([0,3,2;0,0,2;0,0,0],1,3)', '4'],
    ['assign([4,1,3;2,0,5;3,2,2])', 'cost=5, match=[2,1,3]'],
    ['colour([0,1,1;1,0,1;1,1,0])', 'χ=3, colours=[1,2,3]'],
    ['trees([0,1,1,1;1,0,1,1;1,1,0,1;1,1,1,0])', '16'],
    ['comps([0,1,0;1,0,0;0,0,0])', '2'],
  ])('%s = %s', (expr, want) => expect(show(expr)).toBe(want));
});

describe('the variables outside their keys', () => {
  test('x alone is explained', () => expect(show('2x')).toBe('Error: Use x, y, z inside ∫, ∂, min, ode …'));
});

test('slow keys skip the live preview', () => {
  expect(isHeavy('∬(x,0,1,0,1)')).toBe(true);
  expect(isHeavy('min(x²,0,1)')).toBe(true);
  expect(isHeavy('det([1,2;3,4])')).toBe(false);
});

test('a matrix result is drawn as aligned rows', () => {
  expect(matrixRows('[1,-2;30,4]')).toEqual([' 1  -2', '30   4']);
  expect(matrixRows('[1,2,3]')).toBeNull(); // a vector stays on one line
  expect(matrixRows('x=1, min=2')).toBeNull();
});
