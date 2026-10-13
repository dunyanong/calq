// AI study notes: the model's prose is checked before it reaches an export.
import { checkNotes, guard, makeStudyNotes, MAX_NOTE_ITEMS } from '@/features/export/studyNotes';
import { explainSteps, studyNotes } from '@/services/ai';

jest.mock('@/services/ai', () => ({ explainSteps: jest.fn(), studyNotes: jest.fn() }));

const at = new Date(2026, 9, 13, 14, 3).getTime();
const item = (expr, result, angle = 'deg') => ({ id: expr, expr, result, angle, pinned: false, createdAt: at, updatedAt: at });
const allow = (...n) => new Set(n);

beforeEach(() => {
  explainSteps.mockReset();
  studyNotes.mockReset();
});

describe('guard', () => {
  test('drops a sentence with a number that is not allowed, keeps the rest', () => {
    expect(guard('Sine first. The result is 2.7. Then add 2.75 to finish.', allow(2.75), 500)).toBe(
      'Sine first. Then add 2.75 to finish.',
    );
  });

  test('small counts and angle facts are always allowed', () => {
    const free = new Set([...Array(13).keys(), 90, 180, 360, 100, 200, 400]);
    expect(guard('There are 3 steps. A full turn is 360° or 400 grad.', free, 500)).toBe(
      'There are 3 steps. A full turn is 360° or 400 grad.',
    );
  });

  test('numbers inside `maths` spans are checked too', () => {
    expect(guard('Check `sin(30)=0.5`. Or `√(16)=4`.', allow(30, 0.5, 4), 500)).toBe('Check `sin(30)=0.5`.');
  });

  test('"½" counts as 0.5', () => {
    expect(guard('It is ½.', allow(), 100)).toBe('');
    expect(guard('It is ½.', allow(0.5), 100)).toBe('It is ½.');
  });

  test('markup outside spans is removed; an unpaired backtick drops all of them', () => {
    expect(guard('**Bold** <b>tag</b> # head and `log_b(2,8)`', allow(2, 8), 500)).toBe('Bold tag head and `log_b(2,8)`');
    expect(guard('odd ` tick', allow(), 500)).toBe('odd tick');
  });

  test('a claim about what an expression is worth is worked out in the angle unit', () => {
    const any = new Set([...Array(100).keys(), 0.5]);
    expect(guard('So `tan(50)` in grad mode gives `2`. Fine.', any, 500, ['grad'])).toBe('Fine.'); // tan(50) is 1
    expect(guard('So `tan(50)` gives `1`.', any, 500, ['grad'])).toBe('So `tan(50)` gives `1`.');
    expect(guard('`nCr(5,2)` gives 10, and `3!` is 6.', any, 500, ['deg'])).toBe('`nCr(5,2)` gives 10, and `3!` is 6.');
    expect(guard('Here `3!` is 7.', any, 500, ['deg'])).toBe('');
    expect(guard('Check `sin(30)=0.5`.', any, 500, ['deg'])).toBe('Check `sin(30)=0.5`.');
    expect(guard('Check `sin(30)=0.5`.', any, 500, ['rad'])).toBe('');
    expect(guard('Check `sin(30)=0.5`.', any, 500, ['rad', 'deg'])).toBe('Check `sin(30)=0.5`.'); // overview: any unit in use
    expect(guard('`∫(x²,0,1)` is `1÷3`.', any, 500, ['rad'])).toBe('`∫(x²,0,1)` is `1÷3`.');
  });

  test('claims about formulas cannot be worked out to a number and are kept', () => {
    const any = new Set([...Array(10).keys()]);
    expect(guard('So `d/dx(x³) = 3x²`.', any, 500, ['rad'])).toBe('So `d/dx(x³) = 3x²`.');
    expect(guard('Here `x²` is the integrand.', any, 500, ['rad'])).toBe('Here `x²` is the integrand.');
  });

  test('cuts at a sentence end, and ignores non-strings', () => {
    expect(guard('One. Two words here. Three.', allow(), 15)).toBe('One.');
    expect(guard(undefined, allow(), 10)).toBe('');
    expect(guard({ x: 1 }, allow(), 10)).toBe('');
  });
});

describe('checkNotes', () => {
  const items = [item('2+3×sin(30)²', '2.75'), item('nCr(5,2)', '10')];
  const workings = [
    [
      { label: 'Sine of 30°', expr: '2+3×0.5²' },
      { label: 'Add 99', expr: '= 2.75' },
    ],
    [],
  ];

  test('matches sections by number, checks every field and keeps workings in line', () => {
    const notes = checkNotes(
      {
        title: 'Trig and counting',
        intro: 'Two calculations. One gives 999.',
        keyIdeas: ['Order matters', 'Uses 77 wrongly', ''],
        summary: 'Practise `nCr(5,2)`.',
        sections: [
          { n: 2, title: 'Choosing 2 of 5', explanation: 'nCr counts choices. It is 10.', why: [], mistake: 'Order is not 20 here.', tip: 'nPr counts order.' },
          { n: 1, title: 'Order of operations', explanation: 'Sine first.', why: ['Function first.', 'Gives 2.75.', 'extra'], mistake: '', tip: '' },
        ],
      },
      items,
      workings,
      items,
    );
    expect(notes.title).toBe('Trig and counting');
    expect(notes.intro).toBe('Two calculations.');
    expect(notes.keyIdeas).toEqual(['Order matters']);
    expect(notes.summary).toBe('Practise `nCr(5,2)`.');
    const [first, second] = notes.sections;
    expect(first.item).toBe(items[0]);
    expect(first.title).toBe('Order of operations');
    expect(first.workings).toEqual([
      { expr: '2+3×0.5²', label: 'Sine of 30°', why: 'Function first.' },
      { expr: '= 2.75', label: 'worked out', why: 'Gives 2.75.' }, // the step note's 99 is not in the calculation
    ]);
    expect(second.explanation).toBe('nCr counts choices. It is 10.');
    expect(second.mistake).toBe(''); // 20 is not in nCr(5,2) = 10
  });

  test('a missing or garbled reply keeps the calculations and their workings', () => {
    for (const reply of [null, 'text', { sections: 'no' }, { sections: [{ n: 7, title: 'x' }] }]) {
      const notes = checkNotes(reply, items, workings, items);
      expect(notes.title).toBe('Calq study notes');
      expect(notes.sections.map((s) => s.title)).toEqual(['', '']);
      expect(notes.sections[0].workings.map((w) => w.expr)).toEqual(['2+3×0.5²', '= 2.75']);
    }
  });
});

describe('makeStudyNotes', () => {
  test('checked workings from the steps pipeline, then the explanations', async () => {
    explainSteps.mockResolvedValue([
      { parts: ['sin(30)'], note: 'Sine of 30°' },
      { parts: ['sin(30)²'], note: 'Square it' },
      { parts: ['3×sin(30)²'], note: 'Multiply' },
      { parts: ['2+3×sin(30)²'], note: 'Add' },
    ]);
    studyNotes.mockResolvedValue({ title: 'Notes', sections: [{ n: 1, title: 'Order', why: ['a.', 'b.', 'c.', 'd.'] }] });
    const phases = [];
    const items = [item('2+3×sin(30)²', '2.75'), item('5+3', '8')];
    const notes = await makeStudyNotes(items, { onPhase: (p) => phases.push(p) });

    expect(phases).toEqual(['steps', 'notes']);
    expect(explainSteps).toHaveBeenCalledTimes(1); // 5+3 needs no workings
    expect(explainSteps).toHaveBeenCalledWith('2+3×sin(30)²', 'deg');
    expect(studyNotes).toHaveBeenCalledWith([
      {
        expr: '2+3×sin(30)²',
        result: '2.75',
        angle: 'deg',
        workings: [
          { label: 'Sine of 30°', expr: '2+3×0.5²' },
          { label: 'Square it', expr: '2+3×0.25' },
          { label: 'Multiply', expr: '2+0.75' },
          { label: 'Add', expr: '= 2.75' },
        ],
      },
      { expr: '5+3', result: '8', angle: 'deg', workings: [] },
    ]);
    expect(notes.sections[0].workings.map((w) => w.why)).toEqual(['a.', 'b.', 'c.', 'd.']);
    expect(notes.all).toBe(items);
  });

  test('a plan that fails the check or a failed steps call means no workings, not no notes', async () => {
    explainSteps.mockResolvedValueOnce([{ parts: ['3+4'], note: 'Add' }]); // wrong order for 2×3+4
    explainSteps.mockRejectedValueOnce(new Error('Daily limit reached, try again tomorrow'));
    studyNotes.mockResolvedValue({ sections: [] });
    const notes = await makeStudyNotes([item('2×3+4', '10'), item('489×73', '35697')]);
    expect(studyNotes.mock.calls[0][0].map((x) => x.workings)).toEqual([[], []]);
    expect(notes.sections).toHaveLength(2);
  });

  test(`notes cover the ${MAX_NOTE_ITEMS} most recent; every calculation is kept for the list`, async () => {
    studyNotes.mockResolvedValue({ sections: [] });
    const items = Array.from({ length: 25 }, (_, i) => item(String(i + 1), String(i + 1)));
    const notes = await makeStudyNotes(items);
    expect(studyNotes.mock.calls[0][0].map((x) => x.expr)).toEqual(items.slice(5).map((it) => it.expr));
    expect(notes.sections).toHaveLength(MAX_NOTE_ITEMS);
    expect(notes.all).toHaveLength(25);
  });

  test('an error from the notes call reaches the caller', async () => {
    studyNotes.mockRejectedValue(new Error('AI service unavailable, try again'));
    await expect(makeStudyNotes([item('5+3', '8')])).rejects.toThrow('AI service unavailable');
  });
});
