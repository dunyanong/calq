import { compute } from '../math/engine';
import { formatValue } from '../math/format';
import { hasNumericSteps, numericSteps } from '../math/numericSteps';

const last = (steps) => steps[steps.length - 1];

describe('hasNumericSteps', () => {
  it('is true for one ode, ode2 or nsolve call', () => {
    expect(hasNumericSteps('ode(y,0,1,1)')).toBe(true);
    expect(hasNumericSteps('ode2(−y,0,0,1,1)')).toBe(true);
    expect(hasNumericSteps('nsolve(e^(x)=3,1)')).toBe(true);
  });

  it('is false for anything else', () => {
    expect(hasNumericSteps('ode(y,0,1,1)+1')).toBe(false);
    expect(hasNumericSteps('2×ode(y,0,1,1)')).toBe(false);
    expect(hasNumericSteps('∫(x²,0,1)')).toBe(false);
    expect(hasNumericSteps('5+3')).toBe(false);
    expect(hasNumericSteps('')).toBe(false);
  });
});

describe('numericSteps', () => {
  it('shows the Runge–Kutta steps of ode and ends on the same result', () => {
    const steps = numericSteps('ode(y,0,1,1)', 'deg');
    expect(steps[0]).toEqual({ label: 'Problem', expr: 'y′ = y,  y(0) = 1,  find y(1)' });
    expect(steps[1].label).toMatch(/Runge–Kutta/);
    expect(steps.some((s) => /^… \d+ more steps$/.test(s.label))).toBe(true);
    expect(last(steps)).toEqual({ label: 'Result', expr: 'y(1) = 2.718281828' });
    // the last solver row reaches x = 1 with the same y
    expect(steps[steps.length - 2]).toEqual(expect.objectContaining({ label: expect.stringMatching(/· x = 1 ·/), expr: 'y = 2.718281828' }));
  });

  it('shows ode2 as a system with y and y′', () => {
    const steps = numericSteps('ode2(−y,0,0,1,1)', 'deg');
    expect(steps[0].expr).toBe('y″ = −y,  y(0) = 0,  y′(0) = 1,  find y(1)');
    expect(steps[1].expr).toMatch(/^y′ = v,  v′ = −y/);
    expect(steps[1].expr).toMatch(/RK45, \d+ steps$/);
    expect(steps[2].expr).toMatch(/^y = .+,  y′ = /);
    expect(last(steps).expr).toBe('y(1) = ' + formatValue(compute('ode2(−y,0,0,1,1)')));
  });

  it('shows every Newton iteration of solve', () => {
    const steps = numericSteps('nsolve(e^(x)=3,1)', 'deg');
    expect(steps[0].expr).toBe('e^(x)=3,  starting from x₀ = 1');
    expect(steps[2].expr).toMatch(/^x₀ = 1,  f\(x₀\) = -0\.28/);
    expect(steps[3]).toEqual(expect.objectContaining({ label: 'Iteration 1' }));
    expect(steps[3].expr).toMatch(/^x = 1\.103638324/);
    expect(last(steps)).toEqual({ label: 'Result', expr: 'x = 1.098612289' });
  });

  it('returns null when the calculation fails or is not one of these keys', () => {
    expect(numericSteps('nsolve(x²+1,0)', 'deg')).toBeNull();
    expect(numericSteps('5+3', 'deg')).toBeNull();
  });

  it('leaves the results themselves unchanged', () => {
    for (const e of ['ode(y,0,1,1)', 'ode2(−y,0,0,1,1)', 'nsolve(e^(x)=3,1)']) {
      const before = formatValue(compute(e));
      numericSteps(e, 'deg');
      expect(formatValue(compute(e))).toBe(before);
    }
  });
});
