// Keypad layout: a Casio-style keypad where every key works.
//
// Each key: { face, kind, main, shift?, alpha?, hyp?, fracFace? }
//   kind  'num' | 'op' | 'fn' | 'del' | 'eq'   (colour group)
//   main / shift / hyp:  { token } inserts text ({ token, template: true }
//                        types it with input boxes, e.g. ∫(□,□,□): entry.js),
//                        { action } runs a command (CalculatorScreen ACTIONS)
//   alpha                the variable this key stands for after ALPHA, STO or RCL
//                        ('x' is the unknown for ∫, d/dx, Σ, Π: ALPHA types it, it stores nothing)
//   shift.label / alpha  small labels shown above the key (accent / grey)
//   fracFace             face while results are fractions (the a/b key shows
//                        what a tap switches to)

const t = (token) => ({ token });
const box = (token) => ({ token, template: true });
const a = (action) => ({ action });
const sh = (label, act) => ({ label, ...act });

export const NUMERIC_ROWS = [
  [
    { face: '(', kind: 'fn', main: t('('), alpha: 'A' },
    { face: ')', kind: 'fn', main: t(')'), shift: sh(',', t(',')), alpha: 'B' },
    { face: '%', kind: 'fn', main: t('%'), alpha: 'C' },
    { face: 'x²', kind: 'fn', main: t('²'), shift: sh('x³', t('³')), alpha: 'D' },
    { face: '√', kind: 'fn', main: t('√('), shift: sh('∛', t('∛(')), alpha: 'x' },
  ],
  [
    { face: '7', kind: 'num', main: t('7') },
    { face: '8', kind: 'num', main: t('8') },
    { face: '9', kind: 'num', main: t('9') },
    { face: 'DEL', kind: 'del', main: a('del'), shift: sh('Copy', a('copy')) },
    { face: 'AC', kind: 'del', main: a('clear') },
  ],
  [
    { face: '4', kind: 'num', main: t('4') },
    { face: '5', kind: 'num', main: t('5') },
    { face: '6', kind: 'num', main: t('6') },
    { face: '×', kind: 'op', main: t('×'), shift: sh('nPr', box('nPr(')) },
    { face: '÷', kind: 'op', main: t('÷'), shift: sh('nCr', box('nCr(')) },
  ],
  [
    { face: '1', kind: 'num', main: t('1'), shift: sh('Ceil', t('ceil(')) },
    { face: '2', kind: 'num', main: t('2'), shift: sh('Floor', t('floor(')) },
    { face: '3', kind: 'num', main: t('3'), shift: sh('Round', t('round(')) },
    { face: '+', kind: 'op', main: t('+'), shift: sh('GCD', box('gcd(')) },
    { face: '−', kind: 'op', main: t('−'), shift: sh('LCM', box('lcm(')) },
  ],
  [
    { face: '0', kind: 'num', main: t('0'), shift: sh('Rand', a('ran')) },
    { face: '.', kind: 'num', main: t('.'), shift: sh('RandInt', box('RanInt(')) },
    // Casio's modern name for EXP: 1.5×10ˣ−3 is typed as 1.5E−3
    { face: '×10ˣ', kind: 'fn', main: t('E'), shift: sh('π', t('π')), alpha: 'F' },
    { face: 'Ans', kind: 'fn', main: a('ans'), shift: sh('e', t('e')), alpha: 'M' },
    { face: '=', kind: 'eq', main: a('equals'), shift: sh('History', a('history')) },
  ],
];

export const SCIENTIFIC_ROWS = [
  [
    // ∫(□,□,□), d/dx(□,□), Σ(□,□,□); x is the variable
    { face: '∫dx', kind: 'fn', main: box('∫(') },
    { face: 'd/dx', kind: 'fn', main: box('d/dx(') },
    { face: 'x', kind: 'fn', main: t('x') },
    { face: 'Σ', kind: 'fn', main: box('Σ('), shift: sh('Π', box('Π(')) },
    { face: 'log_b', kind: 'fn', main: box('log_b(') },
    { face: '|x|', kind: 'fn', main: t('abs(') },
  ],
  [
    { face: 'x²', kind: 'fn', main: t('²'), shift: sh('x³', t('³')) },
    { face: 'xʸ', kind: 'fn', main: t('^'), shift: sh('ˣ√', box('ˣ√(')) },
    { face: '√', kind: 'fn', main: t('√('), shift: sh('∛', t('∛(')) },
    { face: 'x⁻¹', kind: 'fn', main: t('⁻¹'), shift: sh('n!', t('!')) },
    { face: 'log', kind: 'fn', main: t('log('), shift: sh('10ˣ', t('10^(')) },
    { face: 'ln', kind: 'fn', main: t('ln('), shift: sh('eˣ', t('e^(')) },
  ],
  [
    { face: 'hyp', kind: 'fn', main: a('hyp') },
    { face: 'sin', kind: 'fn', main: t('sin('), shift: sh('sin⁻¹', t('sin⁻¹(')), hyp: { face: 'sinh', token: 'sinh(' } },
    { face: 'cos', kind: 'fn', main: t('cos('), shift: sh('cos⁻¹', t('cos⁻¹(')), hyp: { face: 'cosh', token: 'cosh(' } },
    { face: 'tan', kind: 'fn', main: t('tan('), shift: sh('tan⁻¹', t('tan⁻¹(')), hyp: { face: 'tanh', token: 'tanh(' } },
    { face: 'π', kind: 'fn', main: t('π'), shift: sh('e', t('e')) },
    { face: 'a/b', fracFace: '0.5', kind: 'fn', main: a('sd') },
  ],
  [
    { face: '(', kind: 'fn', main: t('(') },
    { face: ')', kind: 'fn', main: t(')') },
    { face: ',', kind: 'fn', main: t(',') },
    { face: 'RCL', kind: 'fn', main: a('rcl'), shift: sh('STO', a('sto')) },
    { face: 'M+', kind: 'fn', main: a('mplus'), shift: sh('M−', a('mminus')) },
    { face: 'Ans', kind: 'fn', main: a('ans') },
  ],
];

// The advanced pages: matrices (typed [1,2;3,4]), complex numbers and calculus in
// several variables; then optimisation, ODEs, discrete maths and graphs (given as
// adjacency / weight matrices). See advanced.js for what each key works out.
export const MATRIX_ROWS = [
  [
    { face: '[', kind: 'fn', main: t('[') },
    { face: ']', kind: 'fn', main: t(']') },
    { face: ',', kind: 'fn', main: t(',') },
    { face: ';', kind: 'fn', main: t(';') },
    { face: 'Aᵀ', kind: 'fn', main: t('ᵀ'), shift: sh('∞', t('∞')) },
    { face: 'i', kind: 'fn', main: t('i') },
  ],
  [
    { face: 'x', kind: 'fn', main: t('x') },
    { face: 'y', kind: 'fn', main: t('y') },
    { face: 'z', kind: 'fn', main: t('z') },
    { face: 'det', kind: 'fn', main: t('det('), shift: sh('inv', t('inv(')) },
    { face: 'eig', kind: 'fn', main: t('eig('), shift: sh('svd', t('svd(')) },
    { face: 'rank', kind: 'fn', main: t('rank('), shift: sh('trace', t('trace(')) },
  ],
  [
    { face: 'solve', kind: 'fn', main: box('solve('), shift: sh('rref', t('rref(')) },
    { face: 'LU', kind: 'fn', main: t('lu('), shift: sh('QR', t('qr(')) },
    { face: 'null', kind: 'fn', main: t('null('), shift: sh('Jordan', t('jordan(')) },
    { face: 'chol', kind: 'fn', main: t('chol('), shift: sh('posdef', t('posdef(')) },
    { face: 'norm', kind: 'fn', main: t('norm('), shift: sh('dot', box('dot(')) },
    { face: 'cross', kind: 'fn', main: box('cross('), shift: sh('kron', box('kron(')) },
  ],
  [
    { face: '∬', kind: 'fn', main: box('∬('), shift: sh('∭', box('∭(')) },
    { face: '∂/∂x', kind: 'fn', main: box('∂x('), shift: sh('∂/∂y', box('∂y(')) },
    { face: '∇f', kind: 'fn', main: box('grad('), shift: sh('∂/∂z', box('∂z(')) },
    { face: 'Jac', kind: 'fn', main: box('jac('), shift: sh('Hess', box('hess(')) },
    { face: 'div', kind: 'fn', main: box('div('), shift: sh('curl', box('curl(')) },
    { face: '∇²', kind: 'fn', main: box('lap('), shift: sh('Taylor', box('taylor(')) },
  ],
  [
    { face: 'lim', kind: 'fn', main: box('lim('), shift: sh('Iₙ', t('I(')) },
    { face: 'Re', kind: 'fn', main: t('re('), shift: sh('Im', t('im(')) },
    { face: 'z̄', kind: 'fn', main: t('conj('), shift: sh('arg', t('arg(')) },
    { face: '|x|', kind: 'fn', main: t('abs(') },
    { face: '(', kind: 'fn', main: t('(') },
    { face: ')', kind: 'fn', main: t(')') },
  ],
];

export const SOLVE_ROWS = [
  [
    { face: '[', kind: 'fn', main: t('[') },
    { face: ']', kind: 'fn', main: t(']') },
    { face: ',', kind: 'fn', main: t(',') },
    { face: 'x', kind: 'fn', main: t('x'), shift: sh('z', t('z')) },
    { face: 'y', kind: 'fn', main: t('y'), shift: sh('y′', t('y′')) },
    { face: 'n', kind: 'fn', main: t('n') },
  ],
  [
    { face: 'min', kind: 'fn', main: box('min('), shift: sh('minc', box('minc(')) },
    { face: 'max', kind: 'fn', main: box('max('), shift: sh('maxc', box('maxc(')) },
    { face: 'LP', kind: 'fn', main: box('lp('), shift: sh('ILP', box('ilp(')) },
    { face: 'a=b', kind: 'fn', main: t('='), shift: sh('∞', t('∞')) }, // = of an equation; the = key works it out
    { face: '≤', kind: 'fn', main: t('≤'), shift: sh('≥', t('≥')) },
    { face: 'roots', kind: 'fn', main: t('roots(') },
  ],
  [
    { face: 'solve', kind: 'fn', main: box('nsolve('), shift: sh('root', box('root(')) },
    { face: 'ODE', kind: 'fn', main: box('ode('), shift: sh('ODE2', box('ode2(')) },
    { face: 'BVP', kind: 'fn', main: box('bvp('), shift: sh('stab', t('stab(')) },
    { face: 'mod', kind: 'fn', main: box('mod('), shift: sh('φ', t('φ(')) },
    { face: 'prime?', kind: 'fn', main: t('isprime('), shift: sh('factor', t('factor(')) },
    { face: 'modinv', kind: 'fn', main: box('modinv('), shift: sh('modpow', box('modpow(')) },
  ],
  [
    { face: 'and', kind: 'fn', main: box('and('), shift: sh('or', box('or(')) },
    { face: 'not', kind: 'fn', main: t('not('), shift: sh('xor', box('xor(')) },
    { face: 'rec', kind: 'fn', main: box('rec('), shift: sh('⇒', box('implies(')) },
    { face: 'Cat', kind: 'fn', main: t('catalan('), shift: sh('S(n,k)', box('stirling(')) },
    { face: 'Bell', kind: 'fn', main: t('bell('), shift: sh('A∪B', box('union(')) },
    { face: 'A∩B', kind: 'fn', main: box('inter('), shift: sh('A∖B', box('setdiff(')) },
  ],
  [
    { face: 'path', kind: 'fn', main: box('path('), shift: sh('MST', t('mst(')) },
    { face: 'flow', kind: 'fn', main: box('flow('), shift: sh('assign', t('assign(')) },
    { face: 'χ(G)', kind: 'fn', main: t('colour('), shift: sh('comps', t('comps(')) },
    { face: 'trees', kind: 'fn', main: t('trees('), shift: sh('λ₂', t('fiedler(')) },
    { face: '(', kind: 'fn', main: t('(') },
    { face: ')', kind: 'fn', main: t(')') },
  ],
];

// Stored variables. E is missing on purpose (it is the ×10ˣ exponent), and so are X and Y:
// they looked like the unknown x, and ∫(2X,…) silently became ∫(2(0),…).
export const VARIABLES = ['A', 'B', 'C', 'D', 'F', 'M'];

// Modes in which the next key picks a variable: type it, store in it, or recall its value.
const LETTER_MODES = ['alpha', 'sto', 'rcl'];
export const isLetterMode = (mode) => LETTER_MODES.includes(mode);

/**
 * What a key shows and does in the current modifier mode.
 * In ALPHA, STO and RCL a key without a variable is dimmed; pressing it leaves the mode.
 * @param {'shift'|'alpha'|'sto'|'rcl'|'hyp'|null} mode
 * @param {'dec'|'frac'} [output]  result format, for the a/b key's face
 * @returns {{face: string, act: object, active: string|null, dim?: boolean}}
 */
export function resolveKey(key, mode, output = 'dec') {
  const face = output === 'frac' && key.fracFace ? key.fracFace : key.face;
  if (isLetterMode(mode)) {
    if (VARIABLES.includes(key.alpha)) return { face: key.alpha, act: { variable: key.alpha }, active: mode };
    // ALPHA x types the unknown (like the x key on the scientific page); STO / RCL have nothing to do with it
    if (key.alpha === 'x' && mode === 'alpha') return { face: 'x', act: { token: 'x' }, active: mode };
    return { face, act: { cancel: true }, active: null, dim: true };
  }
  if (mode === 'shift' && key.shift) return { face: key.shift.label, act: key.shift, active: 'shift' };
  if (mode === 'hyp' && key.hyp) return { face: key.hyp.face, act: { token: key.hyp.token }, active: 'hyp' };
  return { face, act: key.main, active: null };
}

// Digits and operators are the big, primary glyphs; function names are smaller.
const KIND_SIZE = { num: 22, op: 24, eq: 24, del: 15 };

/** Font size of a key face. kind 'fn' (also any SHIFT/ALPHA face) shrinks with the label length. */
export function faceSize(face, kind = 'fn') {
  if (KIND_SIZE[kind]) return KIND_SIZE[kind];
  if (face.length > 5) return 12;
  if (face.length > 3) return 13.5;
  return 16;
}

// Every multi-character token a key can insert, longest first.
const MULTI_TOKENS = [...NUMERIC_ROWS, ...SCIENTIFIC_ROWS, ...MATRIX_ROWS, ...SOLVE_ROWS]
  .flat()
  .flatMap((k) => [k.main?.token, k.shift?.token, k.hyp?.token])
  .filter((tok) => tok && tok.length > 1)
  .sort((x, y) => y.length - x.length);

/** The function keys' tokens, e.g. "sin(", "log_b(", "∫(" (typing them by name: typing.js). */
export const FUNCTION_TOKENS = MULTI_TOKENS.filter((tok) => tok.endsWith('('));

/** Length of the key press that ends `s` ("sin(" is one step, not four). */
export function tokenBefore(s) {
  if (!s) return 0;
  const tok = MULTI_TOKENS.find((x) => s.endsWith(x));
  return tok ? tok.length : 1;
}

/** Length of the key press that starts `s`. */
export function tokenAfter(s) {
  if (!s) return 0;
  const tok = MULTI_TOKENS.find((x) => s.startsWith(x));
  return tok ? tok.length : 1;
}
