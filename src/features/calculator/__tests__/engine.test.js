import { evaluate, toMathjs, closeParens, freezeRandom } from '@/features/calculator/math/engine';
import { formatNumber, asOperand } from '@/features/calculator/math/format';
import { buildSteps } from '@/features/calculator/math/steps';

const calc = (expr, angle = 'deg', output = 'dec') => formatNumber(evaluate(expr, angle), output);

describe('evaluate', () => {
  test('basic operators with calculator symbols', () => {
    expect(calc('(3+4)×12−5')).toBe('79');
    expect(calc('8÷2×2')).toBe('8');
    expect(calc('0.1+0.2')).toBe('0.3');
    expect(calc('−2²')).toBe('-4');
  });

  test('degrees vs radians', () => {
    expect(calc('sin(30)', 'deg')).toBe('0.5');
    expect(calc('cos(60)', 'deg')).toBe('0.5');
    expect(calc('sin(180)', 'deg')).toBe('0');
    expect(calc('sin(0.5)', 'rad')).toBe('0.4794255386');
    expect(calc('sin(π)', 'rad')).toBe('0');
    expect(calc('sin⁻¹(0.5)', 'deg')).toBe('30');
    expect(calc('tan⁻¹(1)', 'rad')).toBe('0.7853981634');
    expect(evaluate('tan(90)', 'deg')).toBeNull();
    expect(calc('sinh(0)')).toBe('0');
  });

  test('implicit multiplication and constants', () => {
    expect(calc('2π')).toBe('6.283185307');
    expect(calc('2(3+1)')).toBe('8');
    expect(calc('e')).toBe('2.718281828');
    expect(calc('e^(1)')).toBe('2.718281828');
  });

  test('logs and roots', () => {
    expect(calc('log_b(2,8)')).toBe('3');
    expect(calc('log(1000)')).toBe('3');
    expect(calc('ln(e)')).toBe('1');
    expect(calc('√(16)')).toBe('4');
    expect(calc('∛(27)')).toBe('3');
    expect(calc('ˣ√(3,27)')).toBe('3');
    expect(calc('10^(2)')).toBe('100');
  });

  test('powers, inverse, factorial and integer functions', () => {
    expect(calc('3²')).toBe('9');
    expect(calc('2³')).toBe('8');
    expect(calc('4⁻¹')).toBe('0.25');
    expect(calc('2^10')).toBe('1024');
    expect(calc('5!')).toBe('120');
    expect(calc('nPr(5,2)')).toBe('20');
    expect(calc('nCr(5,2)')).toBe('10');
    expect(calc('gcd(12,18)')).toBe('6');
    expect(calc('lcm(4,6)')).toBe('12');
    expect(calc('floor(2.7)')).toBe('2');
    expect(calc('ceil(2.1)')).toBe('3');
    expect(calc('abs(−3)')).toBe('3');
  });

  test('EXP key', () => {
    expect(calc('1E3')).toBe('1000');
    expect(calc('2.5E−3')).toBe('0.0025');
    expect(calc('2÷1E3')).toBe('0.002');
    expect(evaluate('E3')).toBeNull();
  });

  test('auto-closes brackets', () => {
    expect(closeParens('√(16')).toBe('√(16)');
    expect(calc('√(16')).toBe('4');
    expect(calc('(3+4×(2')).toBe('11');
  });

  test('errors return null', () => {
    expect(evaluate('')).toBeNull();
    expect(evaluate('1÷0')).toBeNull();
    expect(evaluate('√(−1)')).toBeNull();
    expect(evaluate('2++')).toBeNull();
    expect(evaluate('3)')).toBeNull();
    expect(formatNumber(null)).toBe('Error');
  });

  test('rejects anything that is not a calculator token (no code execution)', () => {
    expect(() => toMathjs('alert(1)')).toThrow();
    expect(evaluate('import(1)')).toBeNull();
    expect(evaluate('x=2')).toBeNull();
  });
});

describe('formatNumber', () => {
  test('10 significant digits', () => {
    expect(formatNumber(1 / 3)).toBe('0.3333333333');
    expect(formatNumber(123456.789012345)).toBe('123456.789');
  });

  test('scientific style for big and tiny numbers', () => {
    expect(formatNumber(1234567890123)).toBe('1.23456789×10^12');
    expect(formatNumber(1.5e-9)).toBe('1.5×10^-9');
  });

  test('fraction output', () => {
    expect(formatNumber(0.75, 'frac')).toBe('3/4');
    expect(formatNumber(-1 / 3, 'frac')).toBe('-1/3');
    expect(formatNumber(4, 'frac')).toBe('4');
    expect(formatNumber(Math.PI, 'frac')).toBe('3.141592654');
  });

  test('asOperand brackets values that are not plain numbers', () => {
    expect(asOperand(2.5)).toBe('2.5');
    expect(asOperand(-3)).toBe('(-3)');
    expect(asOperand(1.5e-9)).toBe('(1.5×10^-9)');
    // re-entering a formatted value gives the same number back
    expect(calc('2÷' + asOperand(1.5e-9))).toBe('1333333333');
  });
});

describe('freezeRandom', () => {
  test('replaces RanInt with an integer in range', () => {
    for (let i = 0; i < 20; i++) {
      const out = freezeRandom('RanInt(1,6)+1');
      const n = Number(out.replace('+1', ''));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('buildSteps', () => {
  test('matches the prototype example', () => {
    const steps = buildSteps('sin(0.5)+√(16)×2', calc('sin(0.5)+√(16)×2', 'rad'), 'rad');
    expect(steps[0].expr).toBe('sin(0.5)+√(16)×2');
    expect(steps[1].expr).toBe('0.4794255386+4×2');
    expect(steps[2].expr).toBe('0.4794255386+8');
    expect(steps[steps.length - 1].expr).toBe('= 8.479425539');
  });

  test('grouped terms', () => {
    const steps = buildSteps('(3+4)×12−5', '79');
    expect(steps.map((s) => s.expr)).toEqual(['(3+4)×12−5', '7×12−5', '84−5', '= 79']);
  });
});

describe('deleteLast', () => {
  const { deleteLast } = require('@/features/calculator/math/keys');
  test('removes whole function tokens', () => {
    expect(deleteLast('2+sin(')).toBe('2+');
    expect(deleteLast('sin⁻¹(')).toBe('');
    expect(deleteLast('log_b(')).toBe('');
    expect(deleteLast('12')).toBe('1');
    expect(deleteLast('')).toBe('');
  });
});
