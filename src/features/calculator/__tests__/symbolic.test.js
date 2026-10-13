// Formulas instead of numbers: d/dx without a point (math.js), ∫ without
// limits (AI answer, checked here before it is shown).
import {
  checkAntiderivative,
  findAntiderivative,
  indefiniteIntegrand,
  symbolicDerivative,
} from '@/features/calculator/math/symbolic';

const d = (expr, angle = 'rad') => symbolicDerivative(expr, angle);

describe('d/dx without a point', () => {
  test.each([
    ['d/dx(x²)', '2x'],
    ['d/dx(x³)', '3x²'],
    ['d/dx(3x²−2x+1)', '6x−2'],
    ['d/dx(sin(x))', 'cos(x)'],
    ['d/dx(cos(x))', '−sin(x)'],
    ['d/dx(tan(x))', '1÷cos(x)²'],
    ['d/dx(e^(2x))', '2e^(2x)'],
    ['d/dx(ln(x))', '1÷x'],
    ['d/dx(√(x))', '1÷(2√(x))'],
    ['d/dx(1÷x)', '−1÷x²'],
    ['d/dx(x×sin(x))', 'sin(x)+x×cos(x)'],
    ['d/dx(sin⁻¹(x))', '1÷√(1−x²)'],
    ['d/dx((x+1)³)', '3(x+1)²'],
    ['d/dx(x²÷3)', '2x÷3'],
    ['d/dx(πx²)', '2πx'],
    ['d/dx(ln(x²+1))', '2x÷(x²+1)'],
    ['d/dx(x³)×2', '6x²'], // inside a larger expression
    ['d/dx(x²)+d/dx(x³)', '2x+3x²'],
    ['d/dx(d/dx(x³))', '6x'], // second derivative
  ])('%s = %s', (expr, want) => {
    expect(d(expr)).toEqual({ text: want });
  });

  test('degree mode keeps the π÷180 that degrees bring in', () => {
    expect(d('d/dx(sin(x))', 'deg')).toEqual({ text: '(π÷180)cos(x)' });
    expect(d('d/dx(x²)', 'deg')).toEqual({ text: '2x' });
  });

  test('gradian mode keeps the π÷200 that gradians bring in', () => {
    expect(d('d/dx(sin(x))', 'grad')).toEqual({ text: '(π÷200)cos(x)' });
    expect(d('d/dx(sin(x),0)', 'grad')).toBeNull(); // with a point it is numeric
  });

  test('a result without x is a number', () => {
    expect(d('d/dx(3x)')).toEqual({ value: 3 });
    expect(d('d/dx(5)')).toEqual({ value: 0 });
  });

  test('no formula: a clear message instead of "Check the expression"', () => {
    for (const expr of ['d/dx(floor(x))', 'd/dx(x!)', 'd/dx(∫(x²,0,x))']) {
      expect(d(expr).error).toMatch(/Add a point/);
    }
  });

  test('with a point it stays a number (handled by evaluate)', () => {
    expect(d('d/dx(x²,3)')).toBeNull();
    expect(d('2+3')).toBeNull();
  });
});

describe('∫ without limits', () => {
  test('only on its own', () => {
    expect(indefiniteIntegrand('∫(x²)')).toEqual({ f: 'x²' });
    expect(indefiniteIntegrand('∫(x²,0,1)')).toBeNull();
    expect(indefiniteIntegrand('2∫(x)').error).toMatch(/on its own/);
    expect(indefiniteIntegrand('∫(sin(x))+1').error).toMatch(/on its own/);
  });

  test.each([
    ['x²', 'x^3/3', 'x³÷3'],
    ['x²', 'x^3/3 + C', 'x³÷3'], // the model added + C anyway
    ['1÷x', 'ln(abs(x))', 'ln(abs(x))'],
    ['x×e^(x)', '(x-1)*e^x', '(x−1)×e^x'],
    ['1÷(1+x²)', 'arctan(x)', 'tan⁻¹(x)'],
    ['ln(x)', 'x*ln(x)-x', 'x×ln(x)−x'],
    ['√(1−x²)', '(x*sqrt(1-x^2)+asin(x))/2', '(x×√(1−x²)+sin⁻¹(x))÷2'],
  ])('∫ %s: accepts %s', (f, answer, shown) => {
    expect(checkAntiderivative(f, answer, 'rad')).toBe(shown);
  });

  test('rejects wrong answers', () => {
    expect(checkAntiderivative('x²', 'x^3', 'rad')).toBeNull();
    expect(checkAntiderivative('sin(x)', '-cos(x)', 'deg')).toBeNull(); // radian answer in degree mode
    expect(checkAntiderivative('sin(x)', '-(180/pi)*cos(x)', 'deg')).not.toBeNull();
    expect(checkAntiderivative('sin(x)', '-cos(x)', 'grad')).toBeNull();
    expect(checkAntiderivative('sin(x)', '-(180/pi)*cos(x)', 'grad')).toBeNull(); // degree answer in gradian mode
    expect(checkAntiderivative('sin(x)', '-(200/pi)*cos(x)', 'grad')).not.toBeNull();
    expect(checkAntiderivative('x²', '∫(x²)', 'rad')).toBeNull(); // no cheating
    expect(checkAntiderivative('x²', 'hello', 'rad')).toBeNull();
    expect(checkAntiderivative('x²', '', 'rad')).toBeNull();
  });

  test('asks again once when the first answer is wrong', async () => {
    const answers = ['x^3', 'x^3/3'];
    const ask = jest.fn(async () => answers.shift());
    await expect(findAntiderivative('x²', 'rad', ask)).resolves.toEqual({ text: 'x³÷3+C' });
    expect(ask.mock.calls.map((c) => c[0].retry)).toEqual([false, true]);
  });

  test('gives up after two wrong answers, and says when there is no formula', async () => {
    await expect(findAntiderivative('x²', 'rad', async () => 'x^4')).resolves.toEqual({
      error: expect.stringMatching(/Couldn’t find/),
    });
    await expect(findAntiderivative('e^(−x²)', 'rad', async () => '')).resolves.toEqual({
      error: expect.stringMatching(/Add limits/),
    });
  });
});
