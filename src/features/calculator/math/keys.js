// Keypad layout, copied from the prototype's numeric() and scientific().
//
// Each key: { face, kind, size?, main, shift?, alpha, hyp? }
//   kind  'num' | 'op' | 'fn' | 'eq'   (colour)
//   main / shift / hyp:  { token } inserts text, { action } runs a command,
//                        { soon: true } shows a "coming soon" toast
//   shift.label / alpha  small labels shown above the key
//
// src/app/index.js runs actions (see ACTIONS).

const t = (token) => ({ token });
const a = (action) => ({ action });
const soon = { soon: true };
const sh = (label, rest = soon) => ({ label, ...rest });

export const NUMERIC_ROWS = [
  [
    { face: '7', kind: 'num', main: t('7'), shift: sh('MATRIX'), alpha: 'A' },
    { face: '8', kind: 'num', main: t('8'), shift: sh('VECTOR'), alpha: 'B' },
    { face: '9', kind: 'num', main: t('9'), shift: sh('FUNC'), alpha: 'C' },
    { face: 'DEL', kind: 'op', size: 13, main: a('del'), shift: sh('nPr', t('nPr(')), alpha: 'D' },
    { face: 'CLR', kind: 'op', size: 13, main: a('clear'), shift: sh('nCr', t('nCr(')), alpha: 'E' },
  ],
  [
    { face: '4', kind: 'num', main: t('4'), shift: sh('STAT'), alpha: 'F' },
    { face: '5', kind: 'num', main: t('5'), shift: sh('CMPLX'), alpha: 'G' },
    { face: '6', kind: 'num', main: t('6'), shift: sh('DISTR'), alpha: 'H' },
    { face: '×', kind: 'op', main: t('×'), shift: sh('Pol'), alpha: 'I' },
    { face: '÷', kind: 'op', main: t('÷'), shift: sh('Ceil', t('ceil(')), alpha: 'J' },
  ],
  [
    { face: '1', kind: 'num', main: t('1'), shift: sh('Rec'), alpha: 'K' },
    { face: '2', kind: 'num', main: t('2'), shift: sh('Floor', t('floor(')), alpha: 'L' },
    { face: '3', kind: 'num', main: t('3'), shift: sh('GCD', t('gcd(')), alpha: 'M' },
    { face: '+', kind: 'op', main: t('+'), shift: sh('LCM', t('lcm(')), alpha: 'N' },
    { face: '−', kind: 'op', main: t('−'), shift: sh('Copy', a('copy')), alpha: 'O' },
  ],
  [
    { face: '0', kind: 'num', main: t('0'), shift: sh('Ran#', a('ran')), alpha: 'P' },
    { face: '.', kind: 'num', main: t('.'), shift: sh('RanInt', t('RanInt(')), alpha: 'Q' },
    { face: 'EXP', kind: 'fn', size: 13, main: t('E'), shift: sh('π', t('π')), alpha: 'R' },
    { face: 'Ans', kind: 'fn', size: 13, main: a('ans'), shift: sh('e', t('e')), alpha: 'S' },
    { face: '=', kind: 'eq', size: 18, main: a('equals'), shift: sh('History', a('history')), alpha: 'T' },
  ],
];

export const SCIENTIFIC_ROWS = [
  [
    { face: 'CALC', kind: 'fn', size: 11, main: soon, shift: sh('SOLVE'), alpha: 'U' },
    { face: '∫dx', kind: 'fn', size: 12, main: soon, shift: sh('d/dx'), alpha: 'V' },
    { face: '⊙', kind: 'fn', main: soon, shift: sh('Σ'), alpha: 'W' },
    { face: '⌄', kind: 'fn', main: soon, shift: sh('Π'), alpha: 'X' },
    { face: 'x⁻¹', kind: 'fn', size: 12, main: t('⁻¹'), shift: sh('■⁻¹', t('⁻¹')), alpha: 'Y' },
    { face: 'Log', kind: 'fn', size: 12, main: t('log('), shift: sh('10^■', t('10^(')), alpha: 'Z' },
  ],
  [
    { face: '■/■', kind: 'fn', size: 12, main: t('÷'), shift: sh('FACT', t('!')), alpha: 'a' },
    { face: '√', kind: 'fn', main: t('√('), shift: sh('∛', t('∛(')), alpha: 'b' },
    { face: 'x²', kind: 'fn', size: 13, main: t('²'), shift: sh('x³', t('³')), alpha: 'c' },
    { face: 'x^y', kind: 'fn', size: 12, main: t('^'), shift: sh('ˣ√', t('ˣ√(')), alpha: 'd' },
    { face: 'log_b', kind: 'fn', size: 11, main: t('log_b('), shift: sh('log', t('log(')), alpha: 'e' },
    { face: 'ln', kind: 'fn', size: 13, main: t('ln('), shift: sh('e^x', t('e^(')), alpha: 'f' },
  ],
  [
    { face: '(−)', kind: 'fn', size: 12, main: t('−'), shift: sh('Abs', t('abs(')), alpha: 'g' },
    { face: '° ′ ″', kind: 'fn', size: 10.5, main: soon, shift: sh('←', a('del')), alpha: 'h' },
    { face: 'hyp', kind: 'fn', size: 12, main: a('hyp'), shift: sh('FACT', t('!')), alpha: 'i' },
    { face: 'sin', kind: 'fn', size: 12, main: t('sin('), shift: sh('sin⁻¹', t('sin⁻¹(')), hyp: { face: 'sinh', token: 'sinh(' }, alpha: 'j' },
    { face: 'cos', kind: 'fn', size: 12, main: t('cos('), shift: sh('cos⁻¹', t('cos⁻¹(')), hyp: { face: 'cosh', token: 'cosh(' }, alpha: 'k' },
    { face: 'tan', kind: 'fn', size: 12, main: t('tan('), shift: sh('tan⁻¹', t('tan⁻¹(')), hyp: { face: 'tanh', token: 'tanh(' }, alpha: 'l' },
  ],
  [
    { face: 'RCL', kind: 'fn', size: 12, main: a('rcl'), shift: sh('STO'), alpha: 'm' },
    { face: 'ENG', kind: 'fn', size: 12, main: soon, shift: sh('←', a('del')), alpha: 'n' },
    // SHIFT-( is "," (the prototype had "{") because nPr, log_b, gcd… need two arguments
    { face: '(', kind: 'fn', main: t('('), shift: sh(',', t(',')), alpha: 'o' },
    { face: ')', kind: 'fn', main: t(')'), shift: sh('}'), alpha: 'p' },
    { face: 'S⇄D', kind: 'fn', size: 11, main: a('sd'), shift: sh('a b/c'), alpha: 'q' },
    { face: 'M+', kind: 'fn', size: 13, main: a('mplus'), shift: sh('M−', a('mminus')), alpha: 'M' },
  ],
];

/**
 * What a key shows and does in the current modifier mode.
 * @param {'shift'|'alpha'|'hyp'|null} mode
 */
export function resolveKey(key, mode) {
  if (mode === 'shift' && key.shift) return { face: key.shift.label, act: key.shift, active: 'shift' };
  if (mode === 'alpha' && key.alpha) return { face: key.alpha, act: { alphaVar: key.alpha }, active: 'alpha' };
  if (mode === 'hyp' && key.hyp) return { face: key.hyp.face, act: { token: key.hyp.token }, active: 'hyp' };
  return { face: key.face, act: key.main, active: null };
}

/** Font size rule from the prototype: long faces get smaller text. */
export function faceSize(face, base) {
  if (face.length > 5) return 11;
  if (face.length > 3) return 12.5;
  return base || 16;
}

// Every multi-character token a key can insert, longest first.
const MULTI_TOKENS = [...NUMERIC_ROWS, ...SCIENTIFIC_ROWS]
  .flat()
  .flatMap((k) => [k.main?.token, k.shift?.token, k.hyp?.token])
  .filter((tok) => tok && tok.length > 1)
  .sort((x, y) => y.length - x.length);

/** DEL: removes the last key press, so "sin(" goes in one step, not "(" then "n". */
export function deleteLast(entry) {
  const tok = MULTI_TOKENS.find((x) => entry.endsWith(x));
  return entry.slice(0, entry.length - (tok ? tok.length : 1));
}
