// Study notes as Markdown, LaTeX and the PDF page: the app writes the markup, the
// model's prose is escaped, and the plain export's table is always at the end.
import { htmlTable, latexAlign, markdownTable } from '@/features/history/exportHistory';
import { latexProse, notesContent, notesToHtml, notesToLatex, notesToMarkdown } from '@/features/export/notesFormat';

const at = new Date(2026, 9, 13, 14, 3).getTime();
const item = (expr, result, angle = 'deg') => ({ id: expr, expr, result, angle, pinned: false, createdAt: at, updatedAt: at });
const trig = item('2+3×sin(30)²', '2.75');
const integral = item('∫(x²)', 'x³÷3+C', 'rad');
const fraction = item('1÷4+1÷2', '3/4');

const notes = (over = {}) => ({
  title: 'Trig & integrals: 100% {sure}',
  intro: 'Covers `sin(30)` and ∫ in degrees.',
  keyIdeas: ['Brackets → powers → × ÷ → + −'],
  summary: 'Mind $, \\, ~, ^, _ and #.',
  sections: [
    {
      item: trig,
      title: 'Order of operations',
      explanation: 'A <b>sine</b> comes first: `sin(30)` in deg.',
      workings: [
        { expr: '2+3×0.5²', label: 'Sine of 30°', why: 'Functions first.' },
        { expr: '= 2.75', label: 'result', why: '' },
      ],
      mistake: 'Adding *first*.',
      tip: 'Check `sin(30)=0.5`.',
    },
    { item: integral, title: '', explanation: 'F is checked by differentiating.', workings: [], mistake: '', tip: '' },
  ],
  all: [trig, integral],
  ...over,
});

describe('Markdown', () => {
  const md = notesToMarkdown(notes());

  test('title, sections, workings and the full table', () => {
    expect(md.startsWith('# Trig & integrals: 100% {sure}\n')).toBe(true);
    expect(md).toContain('## 1. Order of operations\n\n`2+3×sin(30)²` = `2.75` · DEG');
    expect(md).toContain('**Workings** (each value computed by Calq)\n\n1. `2+3×0.5²`: Sine of 30°. Functions first.\n2. `= 2.75`: result\n');
    expect(md).toContain('**Tip:** Check `sin(30)=0.5`.');
    expect(md).toContain('## 2. `∫(x²)`'); // no title: the expression
    expect(md.trimEnd().endsWith(markdownTable([trig, integral]))).toBe(true);
  });

  test('prose cannot inject markup; maths spans stay code', () => {
    expect(md).toContain('A \\<b\\>sine\\</b\\> comes first: `sin(30)` in deg.');
    expect(md).toContain('**Common mistake:** Adding \\*first\\*.');
    expect(md).toContain('Mind $, \\\\, \\~, ^, \\_ and \\#.');
  });

  test('says when only the most recent calculations got notes', () => {
    const many = notesToMarkdown(notes({ all: [trig, integral, fraction] }));
    expect(many).toContain('These notes cover your 2 most recent calculations. All 3 are listed at the end.');
    expect(md).not.toContain('These notes cover');
  });
});

describe('LaTeX', () => {
  const tex = notesToLatex(notes());

  test('a pdflatex document with the calculations typeset as maths', () => {
    expect(tex).toContain('\\documentclass[11pt]{article}');
    expect(tex).toContain('\\section*{Trig \\& integrals: 100\\% \\{sure\\}}');
    expect(tex).toContain('\\subsection*{1.\\ Order of operations}');
    expect(tex).toContain('\\[ 2+3\\times \\sin\\left(30\\right)^{2} = 2.75 \\qquad \\text{(DEG)} \\]');
    expect(tex).toContain('\\item $2+3\\times 0.5^{2}$ \\quad Sine of 30\\textdegree{}. Functions first.');
    expect(tex).toContain('\\item $= 2.75$ \\quad result');
    expect(tex).toContain('\\[ \\int x^{2}\\,dx = x^{3}\\div 3+C \\qquad \\text{(RAD)} \\]');
    expect(tex).toContain(latexAlign([trig, integral]));
    expect(tex.trim().endsWith('\\end{document}')).toBe(true);
  });

  test('braces and maths delimiters are balanced', () => {
    const body = tex.replace(/\\[{}$%&#_]/g, ''); // escaped characters are not delimiters
    expect(body.split('{').length).toBe(body.split('}').length);
    expect((body.match(/\$/g) || []).length % 2).toBe(0);
  });

  test('prose escapes LaTeX specials and typesets symbols pdflatex cannot print', () => {
    expect(latexProse('Mind $, \\, ~, ^, _, #, % and &.')).toBe(
      'Mind \\$, \\textbackslash{}, \\~{}, \\^{}, \\_, \\#, \\% and \\&.',
    );
    expect(latexProse('30° × π ≈ 94 → done … “ok” ½')).toBe(
      "30\\textdegree{} $\\times$ $\\pi$ $\\approx$ 94 $\\to$ done \\dots{} ``ok'' $\\tfrac{1}{2}$",
    );
    expect(latexProse('café, x < y | z')).toBe('café, x \\textless{} y \\textbar{} z');
    expect(latexProse('emoji 🙂 and ☃ go')).toBe('emoji and go');
    expect(latexProse('use `x³÷3` and `√(16)=4`')).toBe('use $x^{3}\\div 3$ and $\\sqrt{16} = 4$');
  });

  test('a fraction result is a \\frac', () => {
    const t = notesToLatex(notes({ sections: [{ ...notes().sections[1], item: fraction }], all: [fraction] }));
    expect(t).toContain('= \\frac{3}{4} \\qquad');
  });
});

describe('PDF page', () => {
  const page = notesToHtml(notes());

  test('escaped prose, code spans, and the full table', () => {
    expect(page).toContain('<h1>Trig &amp; integrals: 100% {sure}</h1>');
    expect(page).toContain('A &lt;b&gt;sine&lt;/b&gt; comes first: <code>sin(30)</code> in deg.');
    expect(page).toContain('<div class="calc">2+3×sin(30)² = <strong>2.75</strong><span class="badge">DEG</span></div>');
    expect(page).toContain('<li><code>2+3×0.5²</code>: Sine of 30°. Functions first.</li>');
    expect(page).toContain(htmlTable([trig, integral]));
  });
});

test('CSV and Text have no study notes', () => {
  expect(() => notesContent(notes(), 'csv')).toThrow();
  expect(notesContent(notes(), 'markdown')).toBe(notesToMarkdown(notes()));
});
