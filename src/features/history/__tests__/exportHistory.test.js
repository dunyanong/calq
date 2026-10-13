import { toCSV, toHtml, toLatex, toMarkdown, toText } from '../exportHistory';
import { toLatexMath } from '../latex';

jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: {} }));
jest.mock('expo-sharing', () => ({}));

const at = new Date(2026, 9, 5, 14, 3).getTime(); // 2026-10-05 14:03 local
const items = [
  { id: 'a', expr: '(3+4)×12−5', result: '79', angle: 'deg', pinned: true, createdAt: at, updatedAt: at },
  { id: 'b', expr: 'sin(π÷2)', result: '1', angle: 'rad', pinned: false, createdAt: at, updatedAt: at },
];

test('CSV has a BOM, header and one row per item', () => {
  const csv = toCSV(items);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv.slice(1).split('\r\n')).toEqual([
    'Expression,Result,Angle,Pinned,Date',
    '(3+4)×12−5,79,DEG,yes,2026-10-05 14:03',
    'sin(π÷2),1,RAD,no,2026-10-05 14:03',
    '',
  ]);
});

test('CSV quotes fields with commas and quotes', () => {
  const csv = toCSV([{ ...items[0], expr: 'gcd(4,6)', result: 'say "hi"' }]);
  expect(csv).toContain('"gcd(4,6)","say ""hi"""');
});

test('plain text: one line per calculation', () => {
  expect(toText(items)).toBe(
    '(3+4)×12−5 = 79   (DEG, 2026-10-05 14:03)\nsin(π÷2) = 1   (RAD, 2026-10-05 14:03)\n',
  );
});

test('markdown: table with escaped pipes', () => {
  const md = toMarkdown([{ ...items[0], expr: '|−3|' }]);
  expect(md).toContain('| Expression | Result | Angle | Date |');
  expect(md).toContain('| \\|−3\\| | 79 | DEG | 2026-10-05 14:03 |');
});

test('LaTeX: a document with one align* row per calculation', () => {
  const tex = toLatex(items);
  expect(tex).toContain('\\documentclass{article}');
  expect(tex).toContain('\\begin{align*}\n  \\left(3+4\\right)\\times 12-5 &= 79 && \\text{DEG, 2026-10-05 14:03} \\\\\n');
  expect(tex).toContain('  \\sin\\left(\\pi \\div 2\\right) &= 1 && \\text{RAD, 2026-10-05 14:03}\n\\end{align*}');
  expect(tex.trim().endsWith('\\end{document}')).toBe(true);
});

test('LaTeX maths keeps what was typed', () => {
  expect(toLatexMath('200+10%')).toBe('200+10\\%');
  expect(toLatexMath('√(16)×2³')).toBe('\\sqrt{16}\\times 2^{3}');
  expect(toLatexMath('sin⁻¹(0.5)')).toBe('\\sin^{-1}\\left(0.5\\right)');
  expect(toLatexMath('∫(x²,0,1)')).toBe('\\int_{0}^{1} x^{2}\\,dx');
  expect(toLatexMath('d/dx(x³,2)')).toBe('\\left.\\frac{d}{dx}\\left(x^{3}\\right)\\right|_{x=2}');
  expect(toLatexMath('Σ(x+1,1,10)')).toBe('\\sum_{x=1}^{10} \\left(x+1\\right)');
  expect(toLatexMath('nCr(5,2)')).toBe('\\binom{5}{2}');
  expect(toLatexMath('log_b(2,8)')).toBe('\\log_{2}\\left(8\\right)');
  expect(toLatexMath('2^(3+1)')).toBe('2^{3+1}');
  expect(toLatexMath('e^(2)')).toBe('e^{2}');
  expect(toLatexMath('1.5E−3')).toBe('1.5\\times 10^{-3}');
  expect(toLatexMath('1.5×10^-9')).toBe('1.5\\times 10^{-9}');
  expect(toLatexMath('3/4')).toBe('\\frac{3}{4}');
  expect(toLatexMath('a_b')).toBe('\\text{a\\_b}'); // unknown: kept as text
});

test('LaTeX: an indefinite integral keeps its +C', () => {
  const tex = toLatex([{ ...items[0], expr: '∫(x²)', result: 'x³÷3+C' }]);
  expect(tex).toContain('\\int x^{2}\\,dx &= x^{3}\\div 3+C');
});

test('PDF page: a table with escaped text', () => {
  const page = toHtml([{ ...items[0], expr: '1<2&3' }]);
  expect(page).toContain('<td class="mono">1&lt;2&amp;3</td><td class="mono strong">79</td><td>DEG</td><td>2026-10-05 14:03</td>');
  expect(page).toContain('1 calculation ·');
});
