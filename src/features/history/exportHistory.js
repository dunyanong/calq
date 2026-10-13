// Export calculations as CSV, plain text, Markdown, LaTeX or PDF through the native share sheet.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { angleMode } from '@/components/AngleBadge';
import { latexText, toLatexMath } from './latex';

const pad = (n) => String(n).padStart(2, '0');

// Local time, e.g. 2026-10-05 14:03
export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const angleLabel = (angle) => angleMode(angle).short;

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

// A LaTeX document (amsmath) that compiles as is, e.g. on Overleaf. A "+C" stays as written.
export function toLatex(items) {
  const rows = items.map((it) => {
    const result = it.result.endsWith('+C') ? toLatexMath(it.result.slice(0, -2)) + '+C' : toLatexMath(it.result);
    return `  ${toLatexMath(it.expr)} &= ${result} && \\text{${angleLabel(it.angle)}, ${latexText(formatDate(it.createdAt))}}`;
  });
  return [
    '% Exported from Calq',
    '\\documentclass{article}',
    '\\usepackage{amsmath}',
    '\\allowdisplaybreaks',
    '\\begin{document}',
    '\\section*{Calq history}',
    '\\begin{align*}',
    rows.join(' \\\\\n'),
    '\\end{align*}',
    '\\end{document}',
    '',
  ].join('\n');
}

const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Page for the PDF: a table like the Markdown export.
export function toHtml(items) {
  const rows = items
    .map(
      (it) =>
        `<tr><td class="mono">${html(it.expr)}</td><td class="mono strong">${html(it.result)}</td>` +
        `<td>${angleLabel(it.angle)}</td><td>${html(formatDate(it.createdAt))}</td></tr>`,
    )
    .join('\n');
  const count = items.length === 1 ? '1 calculation' : `${items.length} calculations`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1d2630; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #93958f; font-size: 12px; margin: 0 0 18px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { text-align: left; border-bottom: 1.5px solid #1d2630; padding: 6px 8px; }
  td { border-bottom: 1px solid #e9e5db; padding: 6px 8px; vertical-align: top; }
  .mono { font-family: Menlo, 'Roboto Mono', monospace; }
  .strong { font-weight: 700; }
</style></head><body>
<h1>Calq history</h1>
<p>${count} · exported ${html(formatDate(Date.now()))}</p>
<table><thead><tr><th>Expression</th><th>Result</th><th>Angle</th><th>Date</th></tr></thead><tbody>
${rows}
</tbody></table>
</body></html>
`;
}

// build: the file's text; html: a page that is printed to PDF instead
const FORMATS = {
  csv: { build: toCSV, ext: 'csv', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  text: { build: toText, ext: 'txt', mimeType: 'text/plain', UTI: 'public.plain-text' },
  markdown: { build: toMarkdown, ext: 'md', mimeType: 'text/markdown', UTI: 'net.daringfireball.markdown' },
  latex: { build: toLatex, ext: 'tex', mimeType: 'application/x-tex', UTI: 'public.plain-text' },
  pdf: { html: toHtml, ext: 'pdf', mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
};

// format: 'csv' | 'text' | 'markdown' | 'latex' | 'pdf'. Resolves when the share sheet closes.
export async function shareExport(items, format) {
  const f = FORMATS[format];
  if (!f) throw new Error(`Unknown export format: ${format}`);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');

  const file = new File(Paths.cache, `calq-history.${f.ext}`);
  if (f.html) {
    // expo-print saves under a random name; move it so the shared file is calq-history.pdf
    const { uri } = await Print.printToFileAsync({ html: f.html(items) });
    if (file.exists) file.delete();
    new File(uri).move(file);
  } else {
    file.create({ overwrite: true });
    file.write(f.build(items));
  }
  await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, UTI: f.UTI, dialogTitle: 'Export calculations' });
}
