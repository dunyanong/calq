// Typing and reading the advanced notation: OCR text -> display symbols, the
// boxes of the advanced keys, [ ] inside boxes, and the LaTeX export.
import { compute } from '@/features/calculator/math/engine';
import { boxHint, callArgs, completeEntry, deleteBefore, templateText } from '@/features/calculator/math/entry';
import { MATRIX_ROWS, SOLVE_ROWS, tokenAfter, tokenBefore } from '@/features/calculator/math/keys';
import { normalizeExpr } from '@/features/calculator/math/normalize';
import { toLatexMath } from '@/features/history/latex';

describe('normalizeExpr: OCR text in the new notation', () => {
  test.each([
    ['det [[1, 2],[3, 4]]', 'det([1,2;3,4]'],
    ['[1, 2; 3, 4]*[5; 6]', '[1,2;3,4]×[5;6]'],
    ['2*[x+1]', '2×(x+1)'], // a [ ] without , or ; is just a bracket
    ['A^T', 'Aᵀ'],
    ['3+4j', '3+4i'],
    ['∂/∂x(x^2*y, 1, 2)', '∂x(x^2×y,1,2)'],
    ['∫∫(x*y, 0, 1, 0, x)', '∬(x×y,0,1,0,x)'],
    ['nsolve(cos(x)=x, 1)', 'nsolve(cos(x)=x,1)'], // an = inside brackets stays
    ['minc(x+y, [x^2+y^2==1, x>=0], [0,0])', 'minc(x+y,[x^2+y^2=1,x≥0],[0,0])'],
    ['3+4=7', '3+4'], // an answer after = goes
    ['lim(sin(x)/x, infinity)', 'lim(sin(x)÷x,∞)'],
    ['∑(x, 1, 10)', 'Σ(x,1,10)'],
  ])('%s -> %s', (text, want) => expect(normalizeExpr(text)).toBe(want));

  test('scanned matrices work out', () => {
    expect(compute(normalizeExpr('det [[1, 2],[3, 4]]'))).toEqual({ kind: 'number', value: -2 });
  });
});

describe('boxes of the advanced keys', () => {
  test('∬ types five boxes with hints', () => {
    const text = templateText('∬(');
    expect(text).toBe('∬(□,□,□,□,□)');
    expect(boxHint({ text, at: 2 })).toBe('∬ f(x,y) dy dx');
    expect(boxHint({ text, at: 10 })).toBe('y to (may use x)');
  });

  test('the commas of a matrix inside a box belong to the matrix', () => {
    const text = 'solve([1,2;3,4],□)';
    expect(callArgs(text, 5).args.map((a) => a.text)).toEqual(['[1,2;3,4]', '□']);
    expect(boxHint({ text, at: text.indexOf('□') })).toBe('b: the right-hand side, e.g. [5,6]');
  });

  test('∂x: an empty point asks for the formula, a partial point drops the rest', () => {
    expect(completeEntry('∂x(x²y,□,□,□)')).toEqual({ expr: '∂x(x²y)' });
    expect(completeEntry('∂x(x²y,1,2,□)')).toEqual({ expr: '∂x(x²y,1,2)' });
    expect(completeEntry('min(x²,[1,2],□)')).toEqual({ expr: 'min(x²,[1,2])' });
    expect(completeEntry('∬(x,0,1,□,1)')).toEqual({ error: 'Fill in the empty box' });
  });

  test('"ilp(" is not mistaken for "lp(", nor "xor(" for "or("', () => {
    expect(boxHint({ text: templateText('ilp('), at: 4 })).toBe('c: maximise c·x, whole x');
    expect(boxHint({ text: templateText('xor('), at: 4 })).toBe('p (0 or 1)');
  });

  test('DEL removes an empty advanced template in one go', () => {
    const text = templateText('grad(');
    expect(deleteBefore({ text, at: 'grad('.length })).toEqual({ text: '', at: 0 });
  });

  test('every key token is one cursor step', () => {
    for (const key of [...MATRIX_ROWS, ...SOLVE_ROWS].flat()) {
      for (const tok of [key.main?.token, key.shift?.token].filter(Boolean)) {
        expect(tokenBefore('2' + tok)).toBe(tok.length);
        expect(tokenAfter(tok + '2')).toBe(tok.length);
      }
    }
  });

  test('every advanced key types something the engine reads', () => {
    for (const key of [...MATRIX_ROWS, ...SOLVE_ROWS].flat()) {
      for (const act of [key.main, key.shift].filter((a) => a?.token)) {
        const typed = act.template ? templateText(act.token) : act.token;
        // a parse error would say "Check the expression"; anything else means it was understood
        expect(compute(typed.replaceAll('□', '1')).error ?? '').not.toMatch(/^Unknown symbol/);
      }
    }
  });
});

describe('LaTeX export', () => {
  test.each([
    ['det([1,2;3,4])', '\\det\\left(\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}\\right)'],
    ['[1,2;3,4]ᵀ', '\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}^{\\mathsf{T}}'],
    ['∬(x×y,0,1,0,x)', '\\int_{0}^{1}\\int_{0}^{x} x\\times y\\,dy\\,dx'],
    ['lim(sin(x)÷x,0)', '\\lim_{x\\to 0} \\sin\\left(x\\right)\\div x'],
    ['3+4i', '3+4i'],
  ])('%s', (expr, want) => expect(toLatexMath(expr)).toBe(want));

  test('named results', () => {
    expect(toLatexMath('λ=[1,3]')).toBe('\\lambda =\\begin{bmatrix}1 & 3\\end{bmatrix}');
  });
});
