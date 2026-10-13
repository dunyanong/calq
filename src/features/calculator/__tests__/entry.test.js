// Casio-style boxes: typing, ◀ ▶ and DEL inside ∫(□,□,□) and friends.
import {
  BOX,
  boxHint,
  completeEntry,
  deleteBefore,
  insertAt,
  moveCursor,
  templateText,
} from '@/features/calculator/math/entry';

const at = (text, i = text.length) => ({ text, at: i });
// type several key presses, each string being one key
const type = (e, ...keys) => keys.reduce((s, k) => insertAt(s, k), e);
// show the cursor as | for readable expectations
const show = ({ text, at: i }) => text.slice(0, i) + '|' + text.slice(i);

describe('templates', () => {
  test('∫dx types three boxes with the cursor in the first', () => {
    expect(templateText('∫(')).toBe('∫(□,□,□)');
    expect(show(insertAt(at(''), templateText('∫(')))).toBe('∫(|□,□,□)');
    expect(show(insertAt(at('2+'), templateText('d/dx(')))).toBe('2+d/dx(|□,□)');
  });

  test('typing replaces the box, ▶ goes to the next box', () => {
    let e = insertAt(at(''), templateText('∫('));
    e = type(e, 'x', '²');
    expect(show(e)).toBe('∫(x²|,□,□)');
    e = moveCursor(e, 1);
    expect(show(e)).toBe('∫(x²,|□,□)');
    e = type(e, '0');
    e = moveCursor(e, 1);
    e = type(e, '1');
    expect(show(e)).toBe('∫(x²,0,1|)');
    e = moveCursor(e, 1);
    expect(show(e)).toBe('∫(x²,0,1)|');
  });

  test('◀ ▶ hop over empty boxes in one press', () => {
    let e = insertAt(at(''), templateText('∫('));
    e = moveCursor(e, 1);
    expect(show(e)).toBe('∫(□,|□,□)');
    e = moveCursor(e, 1);
    expect(show(e)).toBe('∫(□,□,|□)');
    e = moveCursor(e, 1);
    expect(show(e)).toBe('∫(□,□,□)|');
    e = moveCursor(e, -1);
    expect(show(e)).toBe('∫(□,□,|□)');
    e = moveCursor(e, -1);
    e = moveCursor(e, -1);
    expect(show(e)).toBe('∫(|□,□,□)');
    e = moveCursor(e, -1);
    expect(show(e)).toBe('|∫(□,□,□)');
  });

  test('a template inside a box', () => {
    let e = insertAt(at(''), templateText('d/dx('));
    e = insertAt(e, templateText('log_b('));
    expect(show(e)).toBe('d/dx(log_b(|□,□),□)');
  });

  test('refuses to overflow instead of cutting a template', () => {
    expect(insertAt(at('12345'), templateText('∫('), 10)).toBeNull();
  });
});

describe('DEL inside templates', () => {
  test('DEL empties a box and the box comes back', () => {
    let e = type(insertAt(at(''), templateText('∫(')), 'x');
    e = deleteBefore(e);
    expect(show(e)).toBe('∫(|□,□,□)');
  });

  test('DEL at a comma or the closing bracket steps into the previous box', () => {
    let e = at('∫(x²,0,1)');
    e = deleteBefore(e);
    expect(show(e)).toBe('∫(x²,0,1|)');
    e = deleteBefore(e);
    expect(show(e)).toBe('∫(x²,0,|□)');
    e = deleteBefore(e); // the comma: step back, nothing deleted
    expect(show(e)).toBe('∫(x²,0|,□)');
  });

  test('DEL on an empty template removes it; a filled one is kept', () => {
    expect(show(deleteBefore(at('2+∫(□,□,□)', 4)))).toBe('2+|');
    expect(show(deleteBefore(at('∫(x,□,□)', 2)))).toBe('|∫(x,□,□)');
  });

  test('plain brackets still delete normally', () => {
    expect(show(deleteBefore(at('2×(3)')))).toBe('2×(3|');
    expect(show(deleteBefore(at('sin(')))).toBe('|');
  });
});

describe('hints and completing the entry', () => {
  test('the box under the cursor explains itself', () => {
    expect(boxHint(at('∫(□,□,□)', 2))).toMatch(/f\(x\)/);
    expect(boxHint(at('∫(x²,□,□)', 5))).toMatch(/empty for a formula/);
    expect(boxHint(at('d/dx(x³,□)', 8))).toMatch(/At x =/);
    expect(boxHint(at('∫(sin(x),□,□)', 6))).toMatch(/f\(x\)/); // inside sin( in the first box
    expect(boxHint(at('2+3'))).toBeNull();
  });

  test('empty limits / point mean "give me a formula"', () => {
    expect(completeEntry('∫(x²,□,□)')).toEqual({ expr: '∫(x²)' });
    expect(completeEntry('d/dx(x³,□)')).toEqual({ expr: 'd/dx(x³)' });
    expect(completeEntry('d/dx(x³,□)×2')).toEqual({ expr: 'd/dx(x³)×2' });
    expect(completeEntry('∫(x²,0,1)')).toEqual({ expr: '∫(x²,0,1)' });
    expect(completeEntry('d/dx(∫(x,0,x),□)')).toEqual({ expr: 'd/dx(∫(x,0,x))' });
  });

  test('a missing box gets a specific message', () => {
    expect(completeEntry('∫(□,0,1)').error).toMatch(/first box/);
    expect(completeEntry('∫(x,0,□)').error).toMatch(/both limits/);
    expect(completeEntry('log_b(2,□)').error).toMatch(/empty box/);
    expect(completeEntry('2+' + BOX).error).toMatch(/empty box/);
  });
});

describe('a forgotten ")" inside a box', () => {
  const { closeBox } = require('@/features/calculator/math/entry');

  test('▶ closes it before moving to the next box', () => {
    let e = insertAt(at(''), templateText('d/dx('));
    e = type(e, 'sin(', 'x');
    e = moveCursor(e, 1);
    expect(show(e)).toBe('d/dx(sin(x),|□)');
    e = insertAt(at(''), templateText('∫('));
    e = moveCursor(type(e, 'sin(', 'x'), 1);
    e = moveCursor(type(e, '0'), 1);
    expect(show(type(e, 'π'))).toBe('∫(sin(x),0,π|)');
  });

  test('a bracket that is already closed is left alone', () => {
    expect(show(closeBox(at('∫(sin(x),□,□)', 7)))).toBe('∫(sin(x|),□,□)');
    expect(show(closeBox(at('∫(log_b(2,□),□,□)', 9)))).toBe('∫(log_b(2|,□),□,□)');
    expect(show(closeBox(at('2+sin(3', 7)))).toBe('2+sin(3|'); // not in a box
  });

  test('= in the box does the same (closeBox before completing)', () => {
    expect(completeEntry(closeBox(at('d/dx(sin(x,□)', 10)).text)).toEqual({ expr: 'd/dx(sin(x))' });
  });
});

describe('box labels', () => {
  const { boxLabel } = require('@/features/calculator/math/entry');
  test('each empty box has a name', () => {
    expect(['∫(□,□,□)'].flatMap((s) => [2, 4, 6].map((i) => boxLabel(s, i)))).toEqual(['f(x)', 'from', 'to']);
    expect(boxLabel('d/dx(x³,□)', 8)).toBe('at x');
    expect(boxLabel('∫(log_b(□,□),□,□)', 8)).toBe('base'); // nested: the inner template wins
    expect(boxLabel('∫(log_b(□,□),□,□)', 13)).toBe('from');
  });
});
