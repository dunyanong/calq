// Study notes (studyNotes.js checkNotes) as Markdown, LaTeX or the HTML page printed to PDF.
// The app writes all the markup; the model's prose is escaped for each format, and
// `maths` spans in it are typeset like the calculations. Every format ends with the
// plain export's table of all calculations.
import {
  HTML_STYLE,
  angleLabel,
  countLabel,
  formatDate,
  html,
  htmlTable,
  latexAlign,
  markdownTable,
} from '@/features/history/exportHistory';
import { latexText, toLatexMath } from '@/features/history/latex';

/** Prose split into plain text and `maths` spans: [{ text, math }]. */
const spans = (s) =>
  String(s)
    .split('`')
    .map((text, i) => ({ text, math: i % 2 === 1 }))
    .filter((p) => p.text);

/** "These notes cover…" when only the most recent calculations got notes. */
function coverage(notes) {
  const left = notes.all.length - notes.sections.length;
  if (left <= 0) return '';
  return `These notes cover your ${notes.sections.length} most recent calculations. All ${notes.all.length} are listed at the end.`;
}

const byline = (notes) => `Study notes from Calq · ${countLabel(notes.sections.length)} · ${formatDate(Date.now())}`;

// ---- Markdown ---------------------------------------------------------------------

// Backslash-escaped so the prose cannot start a list, link, emphasis or HTML tag.
const mdText = (s) => s.replace(/[\\`*_[\]<>#|~]/g, '\\$&');
const mdCode = (s) => '`' + String(s).replace(/`/g, '') + '`';
const mdProse = (s) => spans(s).map((p) => (p.math ? mdCode(p.text) : mdText(p.text))).join('');

export function notesToMarkdown(notes) {
  const out = [`# ${mdText(notes.title)}`, '', `_${mdText(byline(notes))}_`, ''];
  const para = (s) => s && out.push(mdProse(s), '');
  para(notes.intro);
  para(coverage(notes));
  if (notes.keyIdeas.length) out.push('## Key ideas', '', ...notes.keyIdeas.map((k) => '- ' + mdProse(k)), '');

  notes.sections.forEach((s, i) => {
    out.push(`## ${i + 1}. ${s.title ? mdProse(s.title) : mdCode(s.item.expr)}`, '');
    out.push(`${mdCode(s.item.expr)} = ${mdCode(s.item.result)} · ${angleLabel(s.item.angle)}`, '');
    para(s.explanation);
    if (s.workings.length) {
      out.push('**Workings** (each value computed by Calq)', '');
      s.workings.forEach((w, k) => out.push(`${k + 1}. ${mdCode(w.expr)}: ${mdProse(w.label)}${w.why ? '. ' + mdProse(w.why) : ''}`));
      out.push('');
    }
    if (s.mistake) out.push(`**Common mistake:** ${mdProse(s.mistake)}`, '');
    if (s.tip) out.push(`**Tip:** ${mdProse(s.tip)}`, '');
  });

  if (notes.summary) out.push('## Summary', '', mdProse(notes.summary), '');
  out.push('## All calculations', '', markdownTable(notes.all), '');
  return out.join('\n');
}

// ---- LaTeX (pdflatex, e.g. Overleaf) --------------------------------------------------

// Characters pdflatex cannot print as they are in text mode.
const TEX_CHARS = {
  '<': '\\textless{}', '>': '\\textgreater{}', '|': '\\textbar{}', '"': "''",
  '°': '\\textdegree{}', '×': '$\\times$', '÷': '$\\div$', '−': '$-$', '·': '$\\cdot$', '±': '$\\pm$',
  'π': '$\\pi$', '√': '$\\surd$', '∛': '$\\sqrt[3]{\\phantom{x}}$', '∫': '$\\int$', 'Σ': '$\\Sigma$', 'Π': '$\\Pi$',
  '≈': '$\\approx$', '≤': '$\\le$', '≥': '$\\ge$', '≠': '$\\ne$', '∞': '$\\infty$', '′': "$'$", '″': "$''$",
  '²': '\\textsuperscript{2}', '³': '\\textsuperscript{3}', '¹': '\\textsuperscript{1}', 'ˣ': '\\textsuperscript{x}',
  '⁻': '\\textsuperscript{$-$}', '…': '\\dots{}', '—': '---', '–': '--', '‘': '`', '’': "'", '“': '``', '”': "''",
  'α': '$\\alpha$', 'β': '$\\beta$', 'γ': '$\\gamma$', 'δ': '$\\delta$', 'Δ': '$\\Delta$', 'θ': '$\\theta$',
  'λ': '$\\lambda$', 'μ': '$\\mu$', 'µ': '$\\mu$', 'σ': '$\\sigma$', 'φ': '$\\phi$', 'ω': '$\\omega$',
  '→': '$\\to$', '←': '$\\leftarrow$', '⇒': '$\\Rightarrow$', '½': '$\\tfrac{1}{2}$', '¼': '$\\tfrac{1}{4}$', '¾': '$\\tfrac{3}{4}$',
};

/**
 * Text that is safe in a pdflatex document: LaTeX specials escaped, maths symbols
 * typeset, accented Latin letters kept, anything else dropped.
 */
export function latexProseText(s) {
  let out = '';
  for (const c of String(s)) {
    if (TEX_CHARS[c]) out += TEX_CHARS[c];
    else if ('\\{}$&#^_%~'.includes(c)) out += latexText(c);
    else if (c.charCodeAt(0) < 0x80 || /[À-ÖØ-öø-ÿ]/.test(c)) out += c;
  }
  return out.replace(/ {2,}/g, ' '); // where a dropped character stood
}

/** A `maths` span: calculator notation as LaTeX maths (= and ≈ may join several parts). */
function latexMath(s) {
  return s
    .split(/\s*([=≈])\s*/)
    .map((part, i) => {
      if (i % 2) return part === '=' ? '=' : '\\approx';
      if (!part) return '';
      const tex = toLatexMath(part);
      // toLatexMath falls back to \text{…}, which would keep symbols pdflatex cannot print
      return tex.startsWith('\\text{') ? '\\text{' + latexProseText(part) + '}' : tex;
    })
    .join(' ')
    .trim();
}

export const latexProse = (s) =>
  spans(s)
    .map((p) => (p.math ? '$' + latexMath(p.text) + '$' : latexProseText(p.text)))
    .join('');

/** A result in maths; a "+C" stays as written. */
const latexAnswer = (r) => (r.endsWith('+C') ? latexMath(r.slice(0, -2)) + '+C' : latexMath(r));

/** A working: an expression, or "= result" for the last step. */
const latexStep = (expr) => (expr.startsWith('= ') ? '= ' + latexAnswer(expr.slice(2)) : latexMath(expr));

export function notesToLatex(notes) {
  const out = [
    '% Study notes exported from Calq',
    '\\documentclass[11pt]{article}',
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage{amsmath}',
    '\\allowdisplaybreaks',
    '\\setlength{\\parindent}{0pt}',
    '\\setlength{\\parskip}{6pt}',
    '\\begin{document}',
    `\\section*{${latexProse(notes.title)}}`,
    `\\textit{${latexProseText(byline(notes))}}`,
    '',
  ];
  const para = (s) => s && out.push(latexProse(s), '');
  para(notes.intro);
  para(coverage(notes));
  if (notes.keyIdeas.length) {
    out.push('\\subsection*{Key ideas}', '\\begin{itemize}', ...notes.keyIdeas.map((k) => '  \\item ' + latexProse(k)), '\\end{itemize}', '');
  }

  notes.sections.forEach((s, i) => {
    const heading = s.title ? latexProse(s.title) : '$' + latexMath(s.item.expr) + '$';
    out.push(`\\subsection*{${i + 1}.\\ ${heading}}`);
    out.push(`\\[ ${latexMath(s.item.expr)} = ${latexAnswer(s.item.result)} \\qquad \\text{(${angleLabel(s.item.angle)})} \\]`);
    para(s.explanation);
    if (s.workings.length) {
      out.push('\\paragraph{Workings} (each value computed by Calq)', '\\begin{enumerate}');
      for (const w of s.workings) {
        out.push(`  \\item $${latexStep(w.expr)}$ \\quad ${latexProse(w.label)}${w.why ? '. ' + latexProse(w.why) : ''}`);
      }
      out.push('\\end{enumerate}', '');
    }
    if (s.mistake) out.push('\\paragraph{Common mistake} ' + latexProse(s.mistake), '');
    if (s.tip) out.push('\\paragraph{Tip} ' + latexProse(s.tip), '');
  });

  if (notes.summary) out.push('\\subsection*{Summary}', latexProse(notes.summary), '');
  out.push('\\subsection*{All calculations}', latexAlign(notes.all), '\\end{document}', '');
  return out.join('\n');
}

// ---- HTML page for the PDF ---------------------------------------------------------

const htmlProse = (s) => spans(s).map((p) => (p.math ? `<code>${html(p.text)}</code>` : html(p.text))).join('');

const NOTES_STYLE = `  h2 { font-size: 15px; margin: 26px 0 6px; page-break-after: avoid; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #2a7093; margin: 14px 0 4px; }
  .body { color: #1d2630; font-size: 13px; line-height: 1.5; margin: 0 0 10px; }
  .calc { font-family: Menlo, 'Roboto Mono', monospace; font-size: 14px; background: #f8f5ef; border-radius: 8px; padding: 8px 10px; margin: 6px 0 10px; }
  .badge { font-family: -apple-system, Roboto, Arial, sans-serif; font-size: 10px; color: #93958f; margin-left: 8px; }
  code { font-family: Menlo, 'Roboto Mono', monospace; background: #f1ede4; border-radius: 3px; padding: 0 3px; }
  ol, ul { font-size: 13px; line-height: 1.5; margin: 0 0 10px; padding-left: 22px; }
  li { margin: 3px 0; }
  .note { border-left: 3px solid #378ADD; padding: 4px 10px; margin: 8px 0; font-size: 12.5px; line-height: 1.5; }
  .section { page-break-inside: avoid; }`;

export function notesToHtml(notes) {
  const out = [`<h1>${html(notes.title)}</h1>`, `<p>${html(byline(notes))}</p>`];
  const para = (s) => s && out.push(`<p class="body">${htmlProse(s)}</p>`);
  para(notes.intro);
  para(coverage(notes));
  if (notes.keyIdeas.length) out.push('<h2>Key ideas</h2>', '<ul>' + notes.keyIdeas.map((k) => `<li>${htmlProse(k)}</li>`).join('') + '</ul>');

  notes.sections.forEach((s, i) => {
    out.push('<div class="section">');
    out.push(`<h2>${i + 1}. ${s.title ? htmlProse(s.title) : `<code>${html(s.item.expr)}</code>`}</h2>`);
    out.push(`<div class="calc">${html(s.item.expr)} = <strong>${html(s.item.result)}</strong><span class="badge">${angleLabel(s.item.angle)}</span></div>`);
    para(s.explanation);
    if (s.workings.length) {
      out.push('<h3>Workings · each value computed by Calq</h3>');
      out.push(
        '<ol>' +
          s.workings.map((w) => `<li><code>${html(w.expr)}</code>: ${htmlProse(w.label)}${w.why ? '. ' + htmlProse(w.why) : ''}</li>`).join('') +
          '</ol>',
      );
    }
    if (s.mistake) out.push(`<div class="note"><strong>Common mistake:</strong> ${htmlProse(s.mistake)}</div>`);
    if (s.tip) out.push(`<div class="note"><strong>Tip:</strong> ${htmlProse(s.tip)}</div>`);
    out.push('</div>');
  });

  if (notes.summary) out.push('<h2>Summary</h2>', `<p class="body">${htmlProse(notes.summary)}</p>`);
  out.push('<h2>All calculations</h2>', htmlTable(notes.all));
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${HTML_STYLE}
${NOTES_STYLE}
</style></head><body>
${out.join('\n')}
</body></html>
`;
}

/** The notes in an export format: the file's text, or the HTML page for a PDF. */
export function notesContent(notes, format) {
  if (format === 'markdown') return notesToMarkdown(notes);
  if (format === 'latex') return notesToLatex(notes);
  if (format === 'pdf') return notesToHtml(notes);
  throw new Error(`No study notes for ${format}`);
}
