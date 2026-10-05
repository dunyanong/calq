import { toCSV, toMarkdown, toText } from '../exportHistory';

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
