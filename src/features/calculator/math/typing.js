// A computer keyboard and the clipboard as input (web): each typed character
// becomes a key press, and pasted text goes through normalizeExpr like a scan.
//
// Function names are typed letter by letter and become the key's token at "(":
// s i n ( -> "sin(", sqrt( -> "√(", int( -> "∫(□,□,□)". Inside a template's
// boxes, "," and ")" step over the template's own, like ▶.
import { BOX, closeBox, insertAt, isTemplate, templateText } from './entry';
import { FUNCTION_TOKENS } from './keys';
import { normalizeExpr } from './normalize';

// Keyboard characters for the calculator's symbols.
const CHARS = { '*': '×', '/': '÷', '-': '−', X: 'x' };
// Characters typed as they are; letters build up function names.
const TYPABLE = /^[0-9.+\-*/^()!,%²³a-zA-Z]$/;

// A word before "(" -> the function key it types: each key's own name
// ("sin", "log_b" as "logb", "ncr"), plus common spellings.
const FUNCTIONS = {
  ...Object.fromEntries(
    FUNCTION_TOKENS.filter((tok) => /^[A-Za-z_]+\($/.test(tok)).map((tok) => [tok.slice(0, -1).replace('_', '').toLowerCase(), tok]),
  ),
  sqrt: '√(',
  cbrt: '∛(',
  asin: 'sin⁻¹(',
  acos: 'cos⁻¹(',
  atan: 'tan⁻¹(',
  arcsin: 'sin⁻¹(',
  arccos: 'cos⁻¹(',
  arctan: 'tan⁻¹(',
  int: '∫(',
  integral: '∫(',
  integrate: '∫(',
  deriv: 'd/dx(',
  diff: 'd/dx(',
  sum: 'Σ(',
  prod: 'Π(',
  root: 'ˣ√(',
};

/** The letters just before the cursor, e.g. "sqrt" in "2+sqrt|". */
const wordBefore = (text, at) => text.slice(0, at).match(/[A-Za-z]+$/)?.[0] || '';

/** Replaces the n characters before the cursor with s. */
function replaceBefore({ text, at }, n, s, max) {
  return insertAt({ text: text.slice(0, at - n) + text.slice(at), at: at - n }, s, max);
}

/**
 * One typed character at the cursor.
 * @returns {{text: string, at: number} | null}  null: not a calculator character, or too long
 */
export function typeChar(entry, ch, max = Infinity) {
  if (!TYPABLE.test(ch)) return null;

  if (ch === ',' || ch === ')') {
    // the template's own "," or ")" just ahead (past an empty box): step over it
    const closed = ch === ',' ? closeBox(entry) : entry;
    const ahead = closed.at + (closed.text[closed.at] === BOX ? 1 : 0);
    const balanced = ch === ',' || closeBox(entry).text === entry.text;
    if (balanced && closed.text[ahead] === ch) {
      const at = ahead + 1;
      return closed.text.length > max ? null : { text: closed.text, at };
    }
  }

  if (ch === '(') {
    const word = wordBefore(entry.text, entry.at);
    const fn = word && FUNCTIONS[word.toLowerCase()];
    if (fn) return replaceBefore(entry, word.length, isTemplate(fn) ? templateText(fn) : fn, max);
  }

  const next = insertAt(entry, CHARS[ch] || ch, max);
  // "pi" -> π as soon as it is typed
  if (next && /pi$/i.test(wordBefore(next.text, next.at)) && !/[a-z]/i.test(next.text[next.at] || '')) {
    return replaceBefore(next, 2, 'π', max);
  }
  return next;
}

/**
 * Pasted text at the cursor, in calculator notation: "2*sqrt(16) - 3/4" -> "2×√(16)−3÷4".
 * @returns {{text: string, at: number} | null}  null when it is empty or too long
 */
export function pasteText(entry, text, max = Infinity) {
  const s = normalizeExpr(String(text).replace(/[\r\n]+/g, ' '));
  return s ? insertAt(entry, s, max) : null;
}
