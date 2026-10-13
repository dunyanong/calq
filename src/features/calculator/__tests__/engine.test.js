import { evaluate, toMathjs, closeParens, freezeRandom } from '@/features/calculator/math/engine';
import { freezeVars } from '@/features/calculator/math/entry';
import { formatNumber, asOperand, operandIn } from '@/features/calculator/math/format';

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

  test('gradians: 100 grad is a right angle', () => {
    expect(calc('sin(100)', 'grad')).toBe('1');
    expect(calc('cos(200)', 'grad')).toBe('-1');
    expect(calc('sin(400)', 'grad')).toBe('0');
    expect(calc('tan(50)', 'grad')).toBe('1');
    expect(calc('sin⁻¹(1)', 'grad')).toBe('100');
    expect(calc('cos⁻¹(0)', 'grad')).toBe('100');
    expect(calc('tan⁻¹(1)', 'grad')).toBe('50');
    expect(evaluate('tan(100)', 'grad')).toBeNull();
    expect(evaluate('tan(−300)', 'grad')).toBeNull();
    expect(evaluate('tan(90)', 'grad')).not.toBeNull(); // only right angles are undefined
    expect(evaluate('tan(100)', 'deg')).not.toBeNull();
  });

  test('implicit multiplication and constants', () => {
    expect(calc('2π')).toBe('6.283185307');
    expect(calc('2(3+1)')).toBe('8');
    expect(calc('e')).toBe('2.718281828');
    expect(calc('e^(1)')).toBe('2.718281828');
    // a bracket after π or e multiplies, it is not a function call
    expect(calc('π(2)')).toBe('6.283185307');
    expect(calc('e(2)')).toBe('5.436563657');
    expect(calc('2π²')).toBe('19.7392088');
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

  test('percent, round, Σ and Π', () => {
    expect(calc('100+10%')).toBe('110');
    expect(calc('200×15%')).toBe('30');
    expect(calc('50%')).toBe('0.5');
    expect(calc('round(2.567)')).toBe('3');
    expect(calc('round(2.567,2)')).toBe('2.57');
    expect(calc('Σ(x,1,100)')).toBe('5050');
    expect(calc('Σ(x²,1,10)')).toBe('385');
    expect(calc('Σ(1÷x²,1,1000)')).toBe('1.643934567');
    expect(calc('Π(x,1,5)')).toBe('120');
    expect(calc('Σ(sin(90x),1,4)', 'deg')).toBe('0'); // values at exact points keep the trig clean-up
    expect(evaluate('Σ(x,1.5,3)')).toBeNull(); // whole-number limits only
    expect(evaluate('Σ(x,5,1)')).toBeNull();
    expect(evaluate('Σ(x,1,10^6)')).toBeNull(); // too many terms
    expect(evaluate('Σ(x,1)')).toBeNull();
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

describe('values typed into an expression', () => {
  test('operandIn brackets a value only where it would merge with its neighbours', () => {
    expect(operandIn('', 0, 0, 79)).toBe('79');
    expect(operandIn('2+', 2, 2, 79)).toBe('79');
    expect(operandIn('2', 1, 1, 79)).toBe('(79)'); // 2 then Ans is 2×79, not 279
    expect(operandIn('3²', 2, 2, 79)).toBe('(79)'); // not 3^279
    expect(operandIn('(5', 1, 1, 79)).toBe('(79)'); // a digit after it
    expect(operandIn('2', 1, 1, -3)).toBe('(-3)');
    expect(calc('2' + operandIn('2', 1, 1, 79))).toBe('158');
  });

  test('freezeVars puts in the stored values', () => {
    const vars = { A: 12, B: 5, C: 0, D: -3, F: 1.5e-9, M: 2 };
    expect(freezeVars('A+B', vars)).toBe('12+5');
    expect(freezeVars('2A', vars)).toBe('2(12)');
    expect(freezeVars('AB', vars)).toBe('12(5)');
    expect(freezeVars('A2', vars)).toBe('(12)2');
    expect(freezeVars('A²', vars)).toBe('12²');
    expect(freezeVars('D²', vars)).toBe('(-3)²');
    expect(freezeVars('F', vars)).toBe('(1.5×10^-9)');
    expect(freezeVars('∫(2x,2,100)', vars)).toBe('∫(2x,2,100)'); // x is the unknown, never a value
    expect(freezeVars('nCr(5,2)+C', vars)).toBe('nCr(5,2)+0'); // the C of nCr( is not a variable
    expect(freezeVars('∫(Ax,0,1)', vars)).toBe('∫(12x,0,1)');
    expect(freezeVars('M', {})).toBe('0'); // never stored
    expect(calc(freezeVars('2A+B', vars))).toBe('29');
    expect(calc(freezeVars('D²', vars))).toBe('9');
    expect(calc(freezeVars('A2', vars))).toBe('24');
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

describe('keypad', () => {
  const { NUMERIC_ROWS, SCIENTIFIC_ROWS, resolveKey } = require('@/features/calculator/math/keys');
  const keys = [...NUMERIC_ROWS, ...SCIENTIFIC_ROWS].flat();
  const ACTIONS = ['del', 'clear', 'equals', 'ans', 'ran', 'copy', 'history', 'hyp', 'rcl', 'sto', 'mplus', 'mminus', 'sd'];

  test('every key works: no "coming soon" in main, SHIFT or hyp', () => {
    for (const k of keys) {
      for (const act of [k.main, k.shift, k.hyp]) {
        if (!act) continue;
        expect(act.soon).toBeUndefined();
        if (act.action) expect(ACTIONS).toContain(act.action);
        // every token is accepted by the parser (E only between numbers, RanInt is replaced before parsing)
        else if (!['E', 'RanInt('].includes(act.token)) expect(() => toMathjs('2' + act.token)).not.toThrow();
      }
    }
  });

  test('numeric page is 5 × 5, scientific 6 × 4; each variable is on one numeric key', () => {
    const { VARIABLES } = require('@/features/calculator/math/keys');
    expect(NUMERIC_ROWS.map((r) => r.length)).toEqual([5, 5, 5, 5, 5]);
    expect(SCIENTIFIC_ROWS.map((r) => r.length)).toEqual([6, 6, 6, 6]);
    const letters = NUMERIC_ROWS.flat().map((k) => k.alpha).filter((a) => a && a !== 'x');
    expect(letters.sort()).toEqual([...VARIABLES].sort());
    expect(SCIENTIFIC_ROWS.flat().some((k) => k.alpha)).toBe(false);
  });

  test('ALPHA / STO / RCL: letter keys pick a variable, the others only leave the mode', () => {
    const open = keys.find((k) => k.face === '(');
    const seven = keys.find((k) => k.face === '7');
    for (const mode of ['alpha', 'sto', 'rcl']) {
      expect(resolveKey(open, mode)).toMatchObject({ face: 'A', act: { variable: 'A' }, active: mode });
      expect(resolveKey(seven, mode)).toMatchObject({ face: '7', act: { cancel: true }, dim: true });
    }
  });

  test('ALPHA √ types the unknown x; STO and RCL cannot use it', () => {
    const root = keys.find((k) => k.face === '√');
    expect(resolveKey(root, 'alpha')).toMatchObject({ face: 'x', act: { token: 'x' } });
    expect(resolveKey(root, 'sto')).toMatchObject({ act: { cancel: true }, dim: true });
    expect(resolveKey(root, 'rcl')).toMatchObject({ act: { cancel: true }, dim: true });
  });

  test('a/b shows the other format', () => {
    const ab = keys.find((k) => k.face === 'a/b');
    expect(resolveKey(ab, null, 'dec').face).toBe('a/b');
    expect(resolveKey(ab, null, 'frac').face).toBe('0.5');
  });
});

describe('tokenBefore / tokenAfter', () => {
  const { tokenBefore, tokenAfter } = require('@/features/calculator/math/keys');
  test('cursor steps over whole key presses', () => {
    expect(tokenBefore('2+sin(')).toBe(4);
    expect(tokenBefore('2+3')).toBe(1);
    expect(tokenBefore('')).toBe(0);
    expect(tokenAfter('sin⁻¹(30)')).toBe(6);
    expect(tokenAfter('d/dx(x²,2)')).toBe(5);
    expect(tokenAfter('')).toBe(0);
  });

  test('a function key is one press', () => {
    expect(tokenBefore('sin⁻¹(')).toBe(6);
    expect(tokenBefore('log_b(')).toBe(6);
    expect(tokenBefore('∫(')).toBe(2);
    expect(tokenBefore('2+d/dx(')).toBe(5);
    expect(tokenBefore('∫(x')).toBe(1);
    expect(tokenBefore('12')).toBe(1);
  });
});
