// Turns typed or OCR'd text into the calculator's display symbols, so that
// "2*sqrt(16) - 3/4" becomes "2×√(16)−3÷4". The result still goes through
// toMathjs(), which rejects anything it does not know.

const RULES = [
  [/\s+/g, ''],
  [/=.*$/, ''], // "3+4=" or "3+4=7": keep the left side
  [/[?°]/g, ''],
  [/[[{]/g, '('],
  [/[\]}]/g, ')'],
  [/\*\*/g, '^'],
  [/[*·⋅∙xX✕✖]/g, '×'], // no token uses ASCII x (ˣ√ is a different character)
  [/[/∕:]/g, '÷'],
  [/[-‐‑‒–—﹣－]/g, '−'],
  [/a(?:rc)?(sin|cos|tan)\(/g, '$1⁻¹('],
  [/(sin|cos|tan)\^\(?−1\)?\(/g, '$1⁻¹('],
  [/log10\(/g, 'log('],
  [/sqrt\(/gi, '√('],
  [/cbrt\(/gi, '∛('],
  [/pi|Π/gi, 'π'],
  [/([√∛])(\d+(?:\.\d+)?)/g, '$1($2)'], // √16 -> √(16)
];

/** @param {string} text */
export function normalizeExpr(text) {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), String(text));
}
