import { stepsFromPlan } from '@/features/calculator/math/aiSteps';
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

  test('a part listed again after it was worked out is skipped (real model plans)', () => {
    const plan = [
      { rewrite: '1200÷2+34÷2+17×19', note: 'Split 1234 into 1200 + 34' },
      { parts: ['1200÷2', '34÷2', '17×19'], note: 'Divide and multiply each part' },
      { parts: ['1200÷2+34÷2', '17×19'], note: 'Add partial quotients' },
      { parts: ['1200÷2+34÷2+17×19'], note: 'Add to get the result' },
    ];
    expect(exprs(stepsFromPlan('1234÷2+17×19', '940', 'deg', plan))).toEqual([
      '1234÷2+17×19',
      '1200÷2+34÷2+17×19',
      '600+17+323',
      '617+323',
      '= 940',
    ]);
    const regroup = [
      { rewrite: '25×4×9÷(2^3+1)', note: 'Regroup 36 as 4×9' },
      { parts: ['2^3'], note: 'Power first' },
      { parts: ['2^3+1'], note: 'Addition in denominator' },
      { parts: ['25×4×9', '2^3+1'], note: 'Multiply numerator parts' },
      { parts: ['25×4×9÷(2^3+1)'], note: 'Divide to get result' },
    ];
    expect(stepsFromPlan('25×36÷(2^3+1)', '100', 'deg', regroup)).not.toBeNull();
  });

  test('rejects a rewrite of only part of the expression (a real model mistake)', () => {
    const plan = [
      { rewrite: '7×70−7×1', note: 'Replace 69 with 70−1' }, // drops the ×3
      { parts: ['7×70', '7×1'], note: 'Multiply each part' },
      { parts: ['7×70−7×1'], note: 'Subtract to get result' },
    ];
    expect(stepsFromPlan('7×69×3', '1449', 'deg', plan)).toBeNull();
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
