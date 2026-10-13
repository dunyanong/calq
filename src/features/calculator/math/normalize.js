// Turns typed or OCR'd text into the calculator's display symbols, so that
// "2*sqrt(16) - 3/4" becomes "2×√(16)−3÷4". The result still goes through
// toMathjs(), which rejects anything it does not know.

const DERIV = '\u0001'; // keeps "d/dx(" away from the ÷ and × rules

const RULES = [
  [/\s+/g, ''],
  [/=.*$/, ''], // "3+4=" or "3+4=7": keep the left side
  [/d\/dx\(/g, DERIV],
  [/(?:integral|integrate|int)\(/gi, '∫('],
  [/[?°]/g, ''],
  [/[[{]/g, '('],
  [/[\]}]/g, ')'],
  [/\*\*/g, '^'],
  [/[*·⋅∙✕✖]/g, '×'],
  // "x" between numbers is times ("3x4"); anywhere else it is the variable x,
  // so "2x+1" fails to evaluate instead of becoming 2×+1 = 2
  [/([\d.)])[xX](?=[\d.])/g, '$1×'],
  [/X/g, 'x'],
  [/[/∕:]/g, '÷'],
  [/[-‐‑‒–—﹣－]/g, '−'],
  [/a(?:rc)?(sin|cos|tan)\(/g, '$1⁻¹('],
  [/(sin|cos|tan)\^\(?−1\)?\(/g, '$1⁻¹('],
  [/log10\(/g, 'log('],
  [/sqrt\(/gi, '√('],
  [/cbrt\(/gi, '∛('],
  [/pi|Π(?!\()/gi, 'π'], // Π( is the product key
  [/([√∛])(\d+(?:\.\d+)?)/g, '$1($2)'], // √16 -> √(16)
  [new RegExp(DERIV, 'g'), 'd/dx('],
];

/** @param {string} text */
export function normalizeExpr(text) {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), String(text));
}
