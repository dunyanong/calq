import { localSteps, stepsFromPlan } from '@/features/calculator/math/aiSteps';
import { evaluate } from '@/features/calculator/math/engine';
import { formatNumber } from '@/features/calculator/math/format';
import { normalizeExpr } from '@/features/calculator/math/normalize';

const exprs = (steps) => steps.map((s) => s.expr);

describe('stepsFromPlan', () => {
  test('computes every value itself and labels steps with the notes', () => {
    const plan = [
      { parts: ['sin(30)'], note: 'Sine of 30°' },
      { parts: ['sin(30)²'], note: 'Square it' },
      { parts: ['3×sin(30)²'], note: 'Multiply before adding' },
      { parts: ['2+3×sin(30)²'], note: 'Add to get the result' },
    ];
    const steps = stepsFromPlan('2+3×sin(30)²', '2.75', 'deg', plan);
    expect(exprs(steps)).toEqual(['2+3×sin(30)²', '2+3×0.5²', '2+3×0.25', '2+0.75', '= 2.75']);
    expect(steps[1].label).toBe('Step 2 — Sine of 30°');
    expect(steps[4].label).toBe('Step 5 — Add to get the result');
  });

  test('several parts in one step, repeated text uses the next free occurrence', () => {
    const plan = [
      { parts: ['√(16)', '√(9)'], note: 'Square roots' },
      { parts: ['2×√(16)', '2×√(9)'], note: 'Multiply' },
    ];
    const steps = stepsFromPlan('2×√(16)+2×√(9)', '14', 'deg', plan);
    expect(exprs(steps)).toEqual(['2×√(16)+2×√(9)', '2×4+2×3', '8+6', '= 14']);
    expect(steps[3].label).toBe('Step 4 — result');
  });

  test('ignores model numbers: the plan has none, values come from math.js', () => {
    const steps = stepsFromPlan('sin(37)×100', '60.18150232', 'deg', [{ parts: ['sin(37)'], note: 'Sine' }]);
    expect(exprs(steps)).toEqual(['sin(37)×100', '0.6018150232×100', '= 60.18150232']);
  });

  test('keeps implicit multiplication readable', () => {
    const steps = stepsFromPlan('2(3+4)', '14', 'deg', [{ parts: ['(3+4)'], note: 'Brackets first' }]);
    expect(steps[1].expr).toBe('2(7)');
  });

  test('accepts ASCII minus / times from the model', () => {
    const steps = stepsFromPlan('10−2×3', '4', 'deg', [{ parts: ['2*3'], note: 'Multiply' }]);
    expect(steps[1].expr).toBe('10−6');
  });

  test('rewrites break down hard arithmetic, then parts quote the rewrite', () => {
    const plan = [
      { rewrite: '489×70+489×3+12', note: 'Split 73 into 70 + 3' },
      { parts: ['489×70', '489×3'], note: 'Multiply each part' },
      { parts: ['489×70+489×3'], note: 'Add the partial products' },
      { parts: ['489×70+489×3+12'], note: 'Add 12' },
    ];
    const steps = stepsFromPlan('489×73+12', '35709', 'deg', plan);
    expect(exprs(steps)).toEqual(['489×73+12', '489×70+489×3+12', '34230+1467+12', '35697+12', '= 35709']);
    expect(steps[1].label).toBe('Step 2 — Split 73 into 70 + 3');
  });

  test('rejects a rewrite with a wrong number, even off by one in a big result', () => {
    expect(stepsFromPlan('489×73', '35697', 'deg', [{ rewrite: '489×70+489×4', note: 'x' }])).toBeNull();
    expect(stepsFromPlan('4890001×73', '356970073', 'deg', [{ rewrite: '356970074', note: 'x' }])).toBeNull();
  });

  test('rejects a wrong order of operations', () => {
    expect(stepsFromPlan('2×3+4', '10', 'deg', [{ parts: ['3+4'], note: 'Add' }])).toBeNull();
  });

  test('rejects parts that are not in the expression or partly overlap', () => {
    expect(stepsFromPlan('2+3', '5', 'deg', [{ parts: ['7'], note: '?' }])).toBeNull();
    const overlap = [
      { parts: ['2×3'], note: 'a' },
      { parts: ['3+4'], note: 'b' },
    ];
    expect(stepsFromPlan('2×3+4', '10', 'deg', overlap)).toBeNull();
  });

  test('rejects empty or useless plans', () => {
    expect(stepsFromPlan('2+3', '5', 'deg', [])).toBeNull();
    expect(stepsFromPlan('2+3', '5', 'deg', null)).toBeNull();
    expect(stepsFromPlan('2+3', '5', 'deg', [{ parts: [], note: 'x' }])).toBeNull();
  });
});

describe('normalizeExpr', () => {
  test('ASCII and OCR symbols become calculator symbols', () => {
    expect(normalizeExpr('2 * sqrt(16) - 3/4')).toBe('2×√(16)−3÷4');
    expect(normalizeExpr('3 x 4 = 12')).toBe('3×4');
    expect(normalizeExpr('asin(0.5) + pi')).toBe('sin⁻¹(0.5)+π');
    expect(normalizeExpr('sin^-1(1)')).toBe('sin⁻¹(1)');
    expect(normalizeExpr('√16 + [2+3]')).toBe('√(16)+(2+3)');
    expect(normalizeExpr('2**3 – 1')).toBe('2^3−1');
    expect(normalizeExpr('2x3 + 4 X 5')).toBe('2×3+4×5');
  });

  test('x next to a letter or bracket is the variable, not times', () => {
    // used to become 2×+1, which evaluated to 2
    expect(normalizeExpr('2x+1')).toBe('2x+1');
    expect(normalizeExpr('X^2')).toBe('x^2');
    expect(normalizeExpr('d/dx(x^2 - 3x, 2)')).toBe('d/dx(x^2−3x,2)');
    expect(normalizeExpr('integral(x^2, 0, 1)')).toBe('∫(x^2,0,1)');
    expect(normalizeExpr('∫(sqrt(x),0,4)')).toBe('∫(√(x),0,4)');
  });

  test('leaves calculator notation alone', () => {
    const s = 'ˣ√(3,27)+log_b(2,8)−sin⁻¹(1)×1.5E−3';
    expect(normalizeExpr(s)).toBe(s);
  });
});

describe('localSteps: workings without AI', () => {
  const steps = (expr, angle = 'deg') => {
    const r = localSteps(expr, formatNumber(evaluate(expr, angle)), angle);
    return r && r.slice(1).map((s) => s.label.replace(/^Step \d+ — /, '') + ': ' + s.expr);
  };

  test('order of operations, with what each step does', () => {
    expect(steps('2+3×sin(30)²')).toEqual(['Sine of 30°: 2+3×0.5²', 'Powers first: 2+3×0.25', 'Multiply: 2+0.75', 'Add: = 2.75']);
    expect(steps('(3+4)×12−5')).toEqual(['Brackets first: 7×12−5', 'Multiply: 84−5', 'Subtract: = 79']);
    expect(steps('5!÷3!')).toEqual(['Factorial: 120÷6', 'Divide: = 20']);
    expect(steps('√(9)×√(16)−nCr(5,2)')).toEqual(['Functions first: 3×4−10', 'Multiply: 12−10', 'Subtract: = 2']);
  });

  test('a minus sign goes with what it applies to: −2² is −4', () => {
    expect(steps('−2²+3')).toEqual(['Powers first: (-4)+3', 'Add: = -1']);
  });

  test('a chain of the same operation is one step', () => {
    expect(steps('1+2+3+4+5+6+7+8+9+10+11+12+13+14')).toEqual(['Add: = 105']);
  });

  test('implicit products follow math.js: 6÷2(1+2) is (6÷2)(3), but (7)²÷2(3) is 49÷6', () => {
    expect(steps('6÷2(1+2)')).toEqual(['Brackets first: 6÷2(3)', 'Multiply and divide, left to right: = 9']);
    // (49) keeps math.js from reading 49÷2(3) as (49÷2)(3)
    expect(steps('(7)²÷2(3)')).toEqual(['Powers first: (49)÷2(3)', 'Multiply and divide, left to right: = 8.166666667']);
  });

  test('every step keeps the value of the original', () => {
    for (const expr of ['2^3^2', '2(3+4)²', 'e^(2)−1', '3⁻¹+1÷3', '((2+3)×(4−1))÷5', 'log_b(2,8)+√(16)', '1.5E−3×2+1']) {
      expect(steps(expr)).not.toBeNull();
    }
  });

  test('a single number has no workings', () => {
    expect(steps('−1.5E−3')).toBeNull();
  });
});
