// Keyboard typing and pasting on the web: characters become key presses.
import { pasteText, typeChar } from '../math/typing';

const EMPTY = { text: '', at: 0 };
/** Types s one character at a time, as a keyboard would. */
const type = (s, entry = EMPTY) => [...s].reduce((e, ch) => typeChar(e, ch) || e, entry);

describe('typeChar', () => {
  test.each([
    ['2*3', '2×3'],
    ['8/2-1', '8÷2−1'],
    ['2^10', '2^10'],
    ['5!', '5!'],
    ['(1+2)%', '(1+2)%'],
    ['sin(30', 'sin(30'],
    ['sqrt(16)', '√(16)'],
    ['asin(0.5)', 'sin⁻¹(0.5)'],
    ['ln(e)', 'ln(e)'],
    ['logb(2,8)', 'log_b(2,8)'],
    ['2pi', '2π'],
    ['X+1', 'x+1'],
  ])('%s -> %s', (keys, want) => {
    expect(type(keys).text).toBe(want);
  });

  test('a template opens its boxes; "," and ")" step over the template', () => {
    const e = type('int(');
    expect(e).toEqual({ text: '∫(□,□,□)', at: 2 });
    expect(type('x^2,0,3)', e)).toEqual({ text: '∫(x^2,0,3)', at: 10 });
  });

  test('"," closes brackets still open in a box', () => {
    expect(type('int(sin(x,0,1)').text).toBe('∫(sin(x),0,1)');
  });

  test('")" inside a box closes the inner bracket first', () => {
    const e = type('int(sin(x)');
    expect(e.text).toBe('∫(sin(x),□,□)');
    expect(e.at).toBe(8);
  });

  test('an empty box can be skipped with ","', () => {
    expect(type('deriv(x^3,)').text).toBe('d/dx(x^3,□)');
  });

  test('characters the calculator has no key for are ignored', () => {
    expect(typeChar(EMPTY, '#')).toBeNull();
    expect(typeChar(EMPTY, ' ')).toBeNull();
  });

  test('respects the entry length limit', () => {
    expect(typeChar({ text: '123', at: 3 }, '4', 3)).toBeNull();
  });
});

describe('pasteText', () => {
  test('converts to calculator notation at the cursor', () => {
    expect(pasteText(EMPTY, '2*sqrt(16) - 3/4')).toEqual({ text: '2×√(16)−3÷4', at: 11 });
    expect(pasteText({ text: '1+', at: 2 }, '(3+4)*2 = 14').text).toBe('1+(3+4)×2');
  });

  test('empty or too long is refused', () => {
    expect(pasteText(EMPTY, '   ')).toBeNull();
    expect(pasteText(EMPTY, '1234', 3)).toBeNull();
  });
});
