// Export calculations as CSV, plain text or Markdown through the native share sheet.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const pad = (n) => String(n).padStart(2, '0');

// Local time, e.g. 2026-10-05 14:03
export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const angleLabel = (angle) => (angle === 'rad' ? 'RAD' : 'DEG');

// Quote a CSV field when it holds a comma, quote or line break.
const csvField = (v) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(items) {
  const rows = items.map((it) =>
    [it.expr, it.result, angleLabel(it.angle), it.pinned ? 'yes' : 'no', formatDate(it.createdAt)].map(csvField).join(','),
  );
  // BOM so Excel reads ×, √, π as UTF-8
  return '﻿' + ['Expression,Result,Angle,Pinned,Date', ...rows].join('\r\n') + '\r\n';
}

export function toText(items) {
  return items.map((it) => `${it.expr} = ${it.result}   (${angleLabel(it.angle)}, ${formatDate(it.createdAt)})`).join('\n') + '\n';
}

export function toMarkdown(items) {
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const rows = items.map(
    (it) => `| ${cell(it.expr)} | ${cell(it.result)} | ${angleLabel(it.angle)} | ${formatDate(it.createdAt)} |`,
  );
  return ['# Calq history', '', '| Expression | Result | Angle | Date |', '|---|---|---|---|', ...rows].join('\n') + '\n';
}

const FORMATS = {
  csv: { build: toCSV, ext: 'csv', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  text: { build: toText, ext: 'txt', mimeType: 'text/plain', UTI: 'public.plain-text' },
  markdown: { build: toMarkdown, ext: 'md', mimeType: 'text/markdown', UTI: 'net.daringfireball.markdown' },
};

// format: 'csv' | 'text' | 'markdown'. Resolves when the share sheet closes.
export async function shareExport(items, format) {
  const f = FORMATS[format];
  if (!f) throw new Error(`Unknown export format: ${format}`);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');

  const file = new File(Paths.cache, `calq-history.${f.ext}`);
  file.create({ overwrite: true });
  file.write(f.build(items));
  await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, UTI: f.UTI, dialogTitle: 'Export calculations' });
}
