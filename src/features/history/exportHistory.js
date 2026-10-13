// Export calculations as CSV, plain text, Markdown, LaTeX or PDF through the native share sheet.
// The table builders are also the "All calculations" appendix of the AI study notes
// (features/export/notesFormat.js).
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

export const angleLabel = (angle) => angleMode(angle).short;

/** "1 calculation", "12 calculations" */
export const countLabel = (n) => (n === 1 ? '1 calculation' : `${n} calculations`);

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

/** Markdown table cell text: a | would end the cell. */
export const mdCell = (s) => String(s).replace(/\|/g, '\\|');

/** The calculations as a Markdown table. */
export function markdownTable(items) {
  const rows = items.map(
    (it) => `| ${mdCell(it.expr)} | ${mdCell(it.result)} | ${angleLabel(it.angle)} | ${formatDate(it.createdAt)} |`,
  );
  return ['| Expression | Result | Angle | Date |', '|---|---|---|---|', ...rows].join('\n');
}

export function toMarkdown(items) {
  return ['# Calq history', '', markdownTable(items)].join('\n') + '\n';
}

/** A result in LaTeX maths. A "+C" stays as written. */
export const latexResult = (result) =>
  result.endsWith('+C') ? toLatexMath(result.slice(0, -2)) + '+C' : toLatexMath(result);

/** The calculations as an align* block (amsmath), one row each. */
export function latexAlign(items) {
  const rows = items.map(
    (it) =>
      `  ${toLatexMath(it.expr)} &= ${latexResult(it.result)} && \\text{${angleLabel(it.angle)}, ${latexText(formatDate(it.createdAt))}}`,
  );
  return ['\\begin{align*}', rows.join(' \\\\\n'), '\\end{align*}'].join('\n');
}

// A LaTeX document (amsmath) that compiles as is, e.g. on Overleaf.
export function toLatex(items) {
  return [
    '% Exported from Calq',
    '\\documentclass{article}',
    '\\usepackage{amsmath}',
    '\\allowdisplaybreaks',
    '\\begin{document}',
    '\\section*{Calq history}',
    latexAlign(items),
    '\\end{document}',
    '',
  ].join('\n');
}

export const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Page style for the PDF exports (the study notes add their own rules after these).
export const HTML_STYLE = `  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1d2630; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #93958f; font-size: 12px; margin: 0 0 18px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { text-align: left; border-bottom: 1.5px solid #1d2630; padding: 6px 8px; }
  td { border-bottom: 1px solid #e9e5db; padding: 6px 8px; vertical-align: top; }
  .mono { font-family: Menlo, 'Roboto Mono', monospace; }
  .strong { font-weight: 700; }`;

/** The calculations as an HTML table. */
export function htmlTable(items) {
  const rows = items
    .map(
      (it) =>
        `<tr><td class="mono">${html(it.expr)}</td><td class="mono strong">${html(it.result)}</td>` +
        `<td>${angleLabel(it.angle)}</td><td>${html(formatDate(it.createdAt))}</td></tr>`,
    )
    .join('\n');
  return `<table><thead><tr><th>Expression</th><th>Result</th><th>Angle</th><th>Date</th></tr></thead><tbody>
${rows}
</tbody></table>`;
}

// Page for the PDF: a table like the Markdown export.
export function toHtml(items) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${HTML_STYLE}
</style></head><body>
<h1>Calq history</h1>
<p>${countLabel(items.length)} · exported ${html(formatDate(Date.now()))}</p>
${htmlTable(items)}
</body></html>
`;
}

// build: the file's text; html: a page that is printed to PDF instead
export const FORMATS = {
  csv: { build: toCSV, ext: 'csv', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  text: { build: toText, ext: 'txt', mimeType: 'text/plain', UTI: 'public.plain-text' },
  markdown: { build: toMarkdown, ext: 'md', mimeType: 'text/markdown', UTI: 'net.daringfireball.markdown' },
  latex: { build: toLatex, ext: 'tex', mimeType: 'application/x-tex', UTI: 'public.plain-text' },
  pdf: { html: toHtml, ext: 'pdf', mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
};

/** The plain export of items: the file's text, or the HTML page for a PDF. */
export function exportContent(items, format) {
  const f = FORMATS[format];
  return (f.html || f.build)(items);
}

/**
 * Writes an export to the cache as <name>.<ext> and returns the File.
 * @param {string} content  the file's text, or the HTML page that is printed for a PDF
 */
export async function writeExportFile(format, content, name = 'calq-history') {
  const f = FORMATS[format];
  if (!f) throw new Error(`Unknown export format: ${format}`);
  const file = new File(Paths.cache, `${name}.${f.ext}`);
  if (f.html) {
    // expo-print saves under a random name; move it so the shared file is <name>.pdf
    const { uri } = await Print.printToFileAsync({ html: content });
    if (file.exists) file.delete();
    new File(uri).move(file);
  } else {
    file.create({ overwrite: true });
    file.write(content);
  }
  return file;
}

/** Opens the share sheet for a written export. Resolves when it closes. */
export async function shareFile(file, format) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const f = FORMATS[format];
  await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, UTI: f.UTI, dialogTitle: 'Export calculations' });
}

// format: 'csv' | 'text' | 'markdown' | 'latex' | 'pdf'. Resolves when the share sheet closes.
export async function shareExport(items, format) {
  if (!FORMATS[format]) throw new Error(`Unknown export format: ${format}`);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = await writeExportFile(format, exportContent(items, format));
  await shareFile(file, format);
}
