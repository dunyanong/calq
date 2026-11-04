// Turns typed or OCR'd text into the calculator's display symbols, so that
// "2*sqrt(16) - 3/4" becomes "2×√(16)−3÷4". The result still goes through
// toMathjs(), which rejects anything it does not know.

const DERIV = '\u0001'; // keeps "d/dx(" away from the ÷ and × rules

/**
 * "3+4=" or "3+4=7": keeps the left side. Only an = outside brackets is an answer;
 * nsolve(x²=2,1) and minc(f,[x+y=1],[0,0]) keep theirs.
 */
function dropAnswer(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if ('([{'.includes(s[i])) depth++;
    else if (')]}'.includes(s[i])) depth--;
    else if (s[i] === '=' && depth === 0) return s.slice(0, i);
  }
  return s;
}

/**
 * [ ] stay for matrices and lists ([1,2;3,4], [x+y=1,x≥0]): those with a , or ; of their
 * own. Any other [ ] or { } is just a bracket.
 */
function brackets(s) {
  const out = s.split('');
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) stack.push({ at: i, list: false });
    else if (')]}'.includes(c)) {
      const open = stack.pop();
      const keep = open && s[open.at] === '[' && c === ']' && open.list;
      if (!keep) {
        if (open) out[open.at] = '(';
        out[i] = ')';
      }
    } else if ((c === ',' || c === ';') && stack.length) stack[stack.length - 1].list = true;
  }
  for (const open of stack) if (s[open.at] !== '[') out[open.at] = '('; // unclosed { -> (
  return out.join('');
}

const RULES = [
  [/\s+/g, ''],
  [/==/g, '='],
  [/<=/g, '≤'],
  [/>=/g, '≥'],
  dropAnswer,
  [/d\/dx\(/g, DERIV],
  [/∂\/∂([xyz])\(/g, '∂$1('], // ∂/∂x(f) -> ∂x(f)
  [/(?:integral|integrate|int)\(/gi, '∫('],
  [/∫∫∫\(/g, '∭('],
  [/∫∫\(/g, '∬('],
  [/∇²\(/g, 'lap('],
  [/∇\(/g, 'grad('],
  // nested lists [[1,2],[3,4]] are the matrix [1,2;3,4] (only inside [[ … ]]: minc(f,[…],[…]) keeps its lists)
  [/\[\[([^[\]]*(?:\],\[[^[\]]*)*)\]\]/g, (_, rows) => '[' + rows.replace(/\],\[/g, ';') + ']'],
  // det [1,2;3,4] without brackets: the closing ) is added at the end (engine closeParens)
  [/(det|inv|rank|trace|eig|svd|rref|null|norm|chol|jordan)\[/g, '$1(['],
  [/∑/g, 'Σ'],
  [/∏/g, 'Π'],
  [/[?°]/g, ''],
  brackets,
  [/\*\*/g, '^'],
  [/\^\(?T\)?/g, 'ᵀ'], // Aᵀ written A^T
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
  [/infinity|inf(?![a-z])/gi, '∞'],
  [/pi|Π(?!\()/gi, 'π'], // Π( is the product key
  [/ⅈ/g, 'i'],
  [/(\d)j(?![a-z(])/g, '$1i'], // engineers' 3+4j
  [/([√∛])(\d+(?:\.\d+)?)/g, '$1($2)'], // √16 -> √(16)
  [new RegExp(DERIV, 'g'), 'd/dx('],
];

/** @param {string} text */
export function normalizeExpr(text) {
  return RULES.reduce((s, rule) => (typeof rule === 'function' ? rule(s) : s.replace(rule[0], rule[1])), String(text));
}
