// Calculator notation -> LaTeX maths, for the LaTeX export: 2×√(16)÷3 -> 2\times \sqrt{16}\div 3.
//
// Works on the display tokens, so the export shows what was typed. (math.js
// toTex would rewrite 200+10% as 200+200·10/100.) Anything it does not know
// throws; the export then falls back to plain \text.
import { callArgs } from '@/features/calculator/math/entry';

// a ( b ) inside  \left( \right) ; a sum inside ∫ or Σ is bracketed too
const paren = (s) => '\\left(' + s + '\\right)';
const group = (s) => (/[+-]/.test(s) ? paren(s) : s);

// Functions written as name + brackets. Longest first, so sin⁻¹( wins over sin(.
const NAMED = [
  ['sin⁻¹(', '\\sin^{-1}'], ['cos⁻¹(', '\\cos^{-1}'], ['tan⁻¹(', '\\tan^{-1}'],
  ['sinh(', '\\sinh'], ['cosh(', '\\cosh'], ['tanh(', '\\tanh'],
  ['sin(', '\\sin'], ['cos(', '\\cos'], ['tan(', '\\tan'],
  ['log(', '\\log'], ['ln(', '\\ln'],
  ['round(', '\\operatorname{round}'], ['gcd(', '\\gcd'], ['lcm(', '\\operatorname{lcm}'],
  ['RanInt(', '\\operatorname{RanInt}'],
];

// Functions with their own layout, given their inputs already in LaTeX.
const SPECIAL = {
  '√(': ([x]) => '\\sqrt{' + x + '}',
  '∛(': ([x]) => '\\sqrt[3]{' + x + '}',
  'ˣ√(': ([n, x]) => '\\sqrt[' + n + ']{' + x + '}',
  'abs(': ([x]) => '\\left|' + x + '\\right|',
  'ceil(': ([x]) => '\\left\\lceil ' + x + '\\right\\rceil ',
  'floor(': ([x]) => '\\left\\lfloor ' + x + '\\right\\rfloor ',
  'log_b(': ([b, x]) => '\\log_{' + b + '}' + paren(x),
  'nCr(': ([n, r]) => '\\binom{' + n + '}{' + r + '}',
  'nPr(': ([n, r]) => '{}^{' + n + '}P_{' + r + '}',
  '∫(': ([f, a, b]) => (a === undefined ? '\\int ' : '\\int_{' + a + '}^{' + b + '} ') + group(f) + '\\,dx',
  'd/dx(': ([f, a]) => (a === undefined ? '\\frac{d}{dx}' + paren(f) : '\\left.\\frac{d}{dx}' + paren(f) + '\\right|_{x=' + a + '}'),
  'Σ(': ([f, a, b]) => '\\sum_{x=' + a + '}^{' + b + '} ' + group(f),
  'Π(': ([f, a, b]) => '\\prod_{x=' + a + '}^{' + b + '} ' + group(f),
};

const OPENERS = [...NAMED.map(([o]) => o), ...Object.keys(SPECIAL)].sort((a, b) => b.length - a.length);

const SYMBOLS = {
  '×': '\\times ', '÷': '\\div ', '−': '-', '-': '-', '+': '+', ',': ',', '!': '!', '%': '\\%',
  'π': '\\pi ', '²': '^{2}', '³': '^{3}',
};

/** LaTeX for an expression (or one input of a function). Throws on unknown symbols. */
function convert(text) {
  const number = (from) => /^[\d.]*/.exec(text.slice(from))[0];

  /** The bracket group whose "(" is at open: its inputs in LaTeX, and the index after its ")". */
  const call = (open) => {
    const { args, close } = callArgs(text, open);
    return { args: args.map((a) => convert(a.text)), next: close < 0 ? text.length : close + 1 };
  };

  /** A function call starting at i, or null. */
  const fn = (i) => {
    const opener = OPENERS.find((o) => text.startsWith(o, i));
    if (!opener) return null;
    const { args, next } = call(i + opener.length - 1);
    const named = NAMED.find(([o]) => o === opener);
    return { tex: named ? named[1] + paren(args.join(',')) : SPECIAL[opener](args), next };
  };

  /** The power after ^: a bracket group (brackets dropped), a function, a signed number or one symbol. */
  const power = (i) => {
    if (text[i] === '(') {
      const { args, next } = call(i);
      return { tex: args.join(','), next };
    }
    const f = fn(i);
    if (f) return f;
    const sign = /^[−-]?/.exec(text.slice(i))[0];
    const n = number(i + sign.length) || text[i + sign.length] || '';
    return { tex: convert(sign + n), next: i + sign.length + n.length };
  };

  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const f = fn(i);
    if (f) {
      out += f.tex;
      i = f.next;
    } else if (/[\d.]/.test(c)) {
      const n = number(i);
      out += n;
      i += n.length;
    } else if (c === 'E') {
      // EXP key: 1.5E−3 -> 1.5\times 10^{-3}
      const sign = /^[−+-]?/.exec(text.slice(i + 1))[0];
      const n = number(i + 1 + sign.length);
      if (!n) throw new Error('Misplaced E');
      out += '\\times 10^{' + (sign === '+' ? '' : sign && '-') + n + '}';
      i += 1 + sign.length + n.length;
    } else if (c === '(') {
      const { args, next } = call(i);
      out += paren(args.join(','));
      i = next;
    } else if (c === '^') {
      const p = power(i + 1);
      out += '^{' + p.tex + '}';
      i = p.next;
    } else if (text.startsWith('⁻¹', i)) {
      out += '^{-1}';
      i += 2;
    } else if (SYMBOLS[c] !== undefined) {
      out += SYMBOLS[c];
      i++;
    } else if (/[A-Za-z]/.test(c)) {
      out += c; // x, e, a variable letter, the C of +C
      i++;
    } else if (c === ' ') {
      i++;
    } else {
      throw new Error('Unknown symbol: ' + c);
    }
  }
  return out.trim();
}

const TEXT_ESCAPES = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '^': '\\^{}', _: '\\_', '%': '\\%', '~': '\\~{}' };
/** Plain text that is safe inside \text{…}. */
export const latexText = (s) => String(s).replace(/[\\{}$&#^_%~]/g, (c) => TEXT_ESCAPES[c]);

/**
 * A calculation or result in LaTeX maths. Fraction results (3/4) become \frac;
 * anything that does not convert is kept as text.
 */
export function toLatexMath(s) {
  const frac = /^(-?)(\d+)\/(\d+)$/.exec(s);
  if (frac) return frac[1] + '\\frac{' + frac[2] + '}{' + frac[3] + '}';
  try {
    return convert(String(s));
  } catch {
    return '\\text{' + latexText(s) + '}';
  }
}
