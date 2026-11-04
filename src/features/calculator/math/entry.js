// Editing the entry line: typing at the cursor, Casio-style boxes for keys
// that take several inputs (∫dx types ∫(□,□,□)), and ◀ ▶ / DEL that move
// between those boxes instead of breaking them.
//
// The cursor never rests just after a □: it sits in front of it, so typing
// replaces the box.
import { operandIn } from './format';
import { VARIABLES, tokenAfter, tokenBefore } from './keys';

export const BOX = '□';

// Keys that insert boxes, with what each box is for (shown under the entry).
const TEMPLATES = {
  '∫(': ['∫ f(x) dx · ▶ for the limits', 'From · leave both limits empty for a formula', 'To · leave both limits empty for a formula'],
  'd/dx(': ['d/dx of f(x) · ▶ for the point', 'At x = · leave empty for the formula'],
  'Σ(': ['Σ: the term, using x', 'x from (whole number)', 'x to (whole number)'],
  'Π(': ['Π: the term, using x', 'x from (whole number)', 'x to (whole number)'],
  'log_b(': ['Base', 'Number'],
  'ˣ√(': ['Which root (n)', 'Number'],
  'nPr(': ['n', 'r'],
  'nCr(': ['n', 'r'],
  'gcd(': ['First number', 'Second number'],
  'lcm(': ['First number', 'Second number'],
  'RanInt(': ['From', 'To'],
  // advanced pages (advanced.js)
  'solve(': ['A: the matrix, e.g. [1,2;3,4]', 'b: the right-hand side, e.g. [5,6]'],
  'dot(': ['First vector', 'Second vector'],
  'cross(': ['First vector [a,b,c]', 'Second vector'],
  'kron(': ['First matrix', 'Second matrix'],
  '∬(': ['∬ f(x,y) dy dx', 'x from', 'x to', 'y from (may use x)', 'y to (may use x)'],
  '∭(': ['∭ f(x,y,z) dz dy dx', 'x from', 'x to', 'y from (may use x)', 'y to (may use x)', 'z from (may use x, y)', 'z to (may use x, y)'],
  '∂x(': ['∂/∂x of f(x,y,z)', 'At x = · leave the point empty for the formula', 'y =', 'z ='],
  '∂y(': ['∂/∂y of f(x,y,z)', 'At x = · leave the point empty for the formula', 'y =', 'z ='],
  '∂z(': ['∂/∂z of f(x,y,z)', 'At x = · leave the point empty for the formula', 'y =', 'z ='],
  'grad(': ['∇f of f(x,y,z)', 'At the point, e.g. [1,2]'],
  'jac(': ['Functions [f1,f2,…] of x, y, z', 'At the point, e.g. [1,2]'],
  'hess(': ['Hessian of f(x,y,z)', 'At the point, e.g. [1,2]'],
  'div(': ['Field [P,Q,R] of x, y, z', 'At the point, e.g. [1,2,3]'],
  'curl(': ['Field [P,Q,R] of x, y, z', 'At the point, e.g. [1,2,3]'],
  'lap(': ['∇² of f(x,y,z)', 'At the point, e.g. [1,2]'],
  'taylor(': ['Taylor series of f(x)', 'About x =', 'Up to the power n (0 to 12)'],
  'lim(': ['Limit of f(x)', 'As x → (∞ on SHIFT ᵀ)'],
  'ode(': ['y′ = f(x,y)', 'Start x₀', 'y(x₀)', 'Find y at x ='],
  'ode2(': ['y″ = f(x,y,y′)', 'Start x₀', 'y(x₀)', 'y′(x₀)', 'Find y at x ='],
  'bvp(': ['y″ = f(x,y,y′)', 'a', 'y(a)', 'b', 'y(b)', 'Find y at x ='],
  'min(': ['Minimise f(x) or f(x,y)', 'From a, or a start point [x,y]', 'To b · leave empty with a start point'],
  'max(': ['Maximise f(x) or f(x,y)', 'From a, or a start point [x,y]', 'To b · leave empty with a start point'],
  'minc(': ['Minimise f(x,y)', 'Constraints, e.g. [x+y=1,x≥0]', 'Start point, e.g. [0,0]'],
  'maxc(': ['Maximise f(x,y)', 'Constraints, e.g. [x+y=1,x≥0]', 'Start point, e.g. [0,0]'],
  'lp(': ['c: maximise c·x', 'A in Ax ≤ b (x ≥ 0)', 'b'],
  'ilp(': ['c: maximise c·x, whole x', 'A in Ax ≤ b (x ≥ 0)', 'b'],
  'root(': ['f(x) = 0, or an equation', 'Search from a', 'To b'],
  'nsolve(': ['f(x) = 0, or an equation', 'Guess'],
  'mod(': ['a', 'm'],
  'modinv(': ['a', 'm'],
  'modpow(': ['Base', 'Power', 'm'],
  'and(': ['p (0 or 1)', 'q (0 or 1)'],
  'or(': ['p (0 or 1)', 'q (0 or 1)'],
  'xor(': ['p (0 or 1)', 'q (0 or 1)'],
  'implies(': ['p (0 or 1)', 'q (0 or 1)'],
  'rec(': ['Next term from n and the term x', 'x₀', 'Find term N'],
  'stirling(': ['n', 'k'],
  'union(': ['Set A, e.g. [1,2,3]', 'Set B'],
  'inter(': ['Set A, e.g. [1,2,3]', 'Set B'],
  'setdiff(': ['Set A, e.g. [1,2,3]', 'Set B'],
  'path(': ['W: weight matrix (0 = no edge)', 'From vertex', 'To vertex'],
  'flow(': ['C: capacity matrix', 'Source vertex', 'Sink vertex'],
};

// Short names drawn inside empty boxes: ∫( f(x) , from , to ).
const LABELS = {
  '∫(': ['f(x)', 'from', 'to'],
  'd/dx(': ['f(x)', 'at x'],
  'Σ(': ['term', 'from', 'to'],
  'Π(': ['term', 'from', 'to'],
  'log_b(': ['base', 'number'],
  'ˣ√(': ['n', 'number'],
  'nPr(': ['n', 'r'],
  'nCr(': ['n', 'r'],
  'gcd(': ['a', 'b'],
  'lcm(': ['a', 'b'],
  'RanInt(': ['from', 'to'],
  'solve(': ['A', 'b'],
  'dot(': ['u', 'v'],
  'cross(': ['u', 'v'],
  'kron(': ['A', 'B'],
  '∬(': ['f(x,y)', 'x from', 'x to', 'y from', 'y to'],
  '∭(': ['f', 'x from', 'x to', 'y from', 'y to', 'z from', 'z to'],
  '∂x(': ['f', 'x', 'y', 'z'],
  '∂y(': ['f', 'x', 'y', 'z'],
  '∂z(': ['f', 'x', 'y', 'z'],
  'grad(': ['f', 'point'],
  'jac(': ['[f1,f2]', 'point'],
  'hess(': ['f', 'point'],
  'div(': ['[P,Q,R]', 'point'],
  'curl(': ['[P,Q,R]', 'point'],
  'lap(': ['f', 'point'],
  'taylor(': ['f(x)', 'about', 'n'],
  'lim(': ['f(x)', 'x →'],
  'ode(': ['f(x,y)', 'x₀', 'y₀', 'at x'],
  'ode2(': ['f(x,y,y′)', 'x₀', 'y₀', 'y′₀', 'at x'],
  'bvp(': ['f(x,y,y′)', 'a', 'y(a)', 'b', 'y(b)', 'at x'],
  'min(': ['f', 'a or start', 'b'],
  'max(': ['f', 'a or start', 'b'],
  'minc(': ['f', 'constraints', 'start'],
  'maxc(': ['f', 'constraints', 'start'],
  'lp(': ['c', 'A', 'b'],
  'ilp(': ['c', 'A', 'b'],
  'root(': ['f(x)', 'from', 'to'],
  'nsolve(': ['f(x)', 'guess'],
  'mod(': ['a', 'm'],
  'modinv(': ['a', 'm'],
  'modpow(': ['base', 'power', 'm'],
  'and(': ['p', 'q'],
  'or(': ['p', 'q'],
  'xor(': ['p', 'q'],
  'implies(': ['p', 'q'],
  'rec(': ['f(n,x)', 'x₀', 'N'],
  'stirling(': ['n', 'k'],
  'union(': ['A', 'B'],
  'inter(': ['A', 'B'],
  'setdiff(': ['A', 'B'],
  'path(': ['W', 'from', 'to'],
  'flow(': ['C', 'source', 'sink'],
};

// Boxes from this index on may be left empty: ∂x(f,1,□,□) is ∂x at x = 1 (f of x
// only), min(f,[0,0],□) starts from a point. All of ∂x's empty means the formula.
const OPTIONAL_FROM = { '∂x(': 1, '∂y(': 1, '∂z(': 1, 'min(': 2, 'max(': 2 };

/** What a template key types: "∫(" -> "∫(□,□,□)". */
export const templateText = (opener) => opener + TEMPLATES[opener].map(() => BOX).join(',') + ')';

// [ ] of matrices and lists nest like ( ): their commas belong to them, not to a box.
const isOpen = (c) => c === '(' || c === '[';
const isClose = (c) => c === ')' || c === ']';

/** Index of the "(" (or "[") whose brackets enclose position pos, or -1. */
function openBefore(text, pos) {
  let depth = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (isClose(text[i])) depth++;
    else if (isOpen(text[i])) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Index of the ")" matching the "(" at open, or -1 if it is not closed. */
function closeAfter(text, open) {
  let depth = 0;
  for (let i = open + 1; i < text.length; i++) {
    if (isOpen(text[i])) depth++;
    else if (isClose(text[i])) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

// longest first, so "ilp(" is not taken for "lp(" nor "xor(" for "or("
const OPENERS = Object.keys(TEMPLATES).sort((a, b) => b.length - a.length);

/** Template opener ending at the "(" at index open, if any. */
const openerAt = (text, open) => OPENERS.find((o) => text.slice(0, open + 1).endsWith(o));

/** The template whose own argument list directly contains position pos (not one nested deeper). */
function directTemplate(text, pos) {
  const open = openBefore(text, pos);
  const opener = open >= 0 && openerAt(text, open);
  return opener ? { opener, open } : null;
}

/** The innermost template around pos, looking outwards through ordinary brackets. */
function enclosingTemplate(text, pos) {
  for (let open = openBefore(text, pos); open >= 0; open = openBefore(text, open)) {
    const opener = openerAt(text, open);
    if (opener) return { opener, open };
  }
  return null;
}

/** Inputs of the call whose "(" is at open: [{ start, end, text }], split at its own commas. */
export function callArgs(text, open) {
  const close = closeAfter(text, open);
  const end = close < 0 ? text.length : close;
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < end; i++) {
    if (isOpen(text[i])) depth++;
    else if (isClose(text[i])) depth--;
    else if (text[i] === ',' && depth === 0) {
      args.push({ start, end: i, text: text.slice(start, i) });
      start = i + 1;
    }
  }
  args.push({ start, end, text: text.slice(start, end) });
  return { args, close };
}

// a position just after a □ is not a resting place: step to its front
const settle = (text, at) => (text[at - 1] === BOX ? at - 1 : at);

/**
 * Types s at the cursor. Typing into an empty box replaces the □; a template
 * puts the cursor in its first box.
 * @returns {{text: string, at: number} | null}  null when it would not fit in max
 */
export function insertAt({ text, at }, s, max = Infinity) {
  const base = text[at] === BOX ? text.slice(0, at) + text.slice(at + 1) : text;
  const next = base.slice(0, at) + s + base.slice(at);
  if (next.length > max) return null; // refuse rather than cut a template in half
  const box = s.indexOf(BOX);
  return { text: next, at: box >= 0 ? at + box : at + s.length };
}

/**
 * Leaving a box closes the brackets still open in it, like the edge of a
 * Casio box: ∫(sin(x|,□,□) -> ∫(sin(x)|,□,□). Otherwise "," would end up
 * inside sin( and the boxes could not be told apart.
 */
export function closeBox({ text, at }) {
  if (text[at] !== ',' && text[at] !== ')') return { text, at };
  const t = enclosingTemplate(text, at);
  // all boxes still separate: nothing swallowed a ","
  if (!t || callArgs(text, t.open).args.length >= TEMPLATES[t.opener].length) return { text, at };
  let open = 0;
  for (let i = t.open + 1; i < at; i++) {
    if (text[i] === '(') open++;
    else if (text[i] === ')') open--;
  }
  if (open <= 0) return { text, at };
  const closing = ')'.repeat(open);
  return { text: text.slice(0, at) + closing + text.slice(at), at: at + open };
}

/** ◀ / ▶ by one key press, hopping over boxes; jump goes to the start / end. */
export function moveCursor(entry, dir, jump = false) {
  const { text, at } = dir > 0 ? closeBox(entry) : entry;
  if (jump) return { text, at: dir < 0 ? 0 : text.length };
  let a = at;
  if (dir < 0) {
    a = settle(text, a - tokenBefore(text.slice(0, a)));
  } else {
    a += tokenAfter(text.slice(a));
    if (text[a - 1] === BOX && a < text.length) a += tokenAfter(text.slice(a)); // past "□," to the next box
  }
  return { text, at: Math.max(0, Math.min(text.length, a)) };
}

/**
 * DEL: removes the key press before the cursor. Inside a template it never
 * breaks the structure: at a "," or ")" it steps into the previous box, a box
 * emptied by DEL shows □ again, and DEL on the opener removes the template
 * once all its boxes are empty.
 */
export function deleteBefore({ text, at }) {
  if (at === 0) return { text, at };
  const ch = text[at - 1];
  if (ch === BOX) return { text, at: at - 1 };
  if (ch === ',' && directTemplate(text, at)) return { text, at: settle(text, at - 1) };
  if (ch === ')' && directTemplate(text, at - 1)) return { text, at: settle(text, at - 1) };

  const n = tokenBefore(text.slice(0, at));
  const opener = text.slice(at - n, at);
  if (TEMPLATES[opener]) {
    const { args, close } = callArgs(text, at - 1);
    if (close >= 0 && args.every((x) => x.text === BOX)) {
      return { text: text.slice(0, at - n) + text.slice(close + 1), at: at - n };
    }
    return { text, at: at - n }; // boxes still filled: step out, delete nothing
  }

  let next = text.slice(0, at - n) + text.slice(at);
  const pos = at - n;
  const emptied = '(,'.includes(next[pos - 1]) && ',)'.includes(next[pos]);
  if (emptied && directTemplate(next, pos)) next = next.slice(0, pos) + BOX + next.slice(pos);
  return { text: next, at: pos };
}

/** The template around position pos and which of its boxes pos is in. */
function boxAt(text, pos) {
  const t = enclosingTemplate(text, pos);
  if (!t) return null;
  let depth = 0;
  let index = 0;
  for (let i = t.open + 1; i < pos; i++) {
    if (isOpen(text[i])) depth++;
    else if (isClose(text[i])) depth--;
    else if (text[i] === ',' && depth === 0) index++;
  }
  return { opener: t.opener, index };
}

/** What the box under the cursor is for, or null outside templates. */
export function boxHint({ text, at }) {
  const b = boxAt(text, at);
  return (b && TEMPLATES[b.opener][b.index]) || null;
}

/** Placeholder name for the empty □ at index i ("from"), or null. */
export function boxLabel(text, i) {
  const b = boxAt(text, i);
  return (b && LABELS[b.opener][b.index]) || null;
}

/**
 * The expression to work out: empty optional boxes are dropped, so
 * ∫(f,□,□) becomes ∫(f) (a formula), d/dx(f,□) becomes d/dx(f) and
 * ∂x(f,2,3,□) becomes ∂x(f,2,3).
 * @returns {{expr: string} | {error: string}}
 */
export function completeEntry(text) {
  let s = text;
  // right to left, so earlier indices stay valid
  for (let i = s.length - 1; i >= 0; i--) {
    const opener = s[i] === '(' && openerAt(s, i);
    if (OPTIONAL_FROM[opener]) {
      const { args } = callArgs(s, i);
      if (args[0].text === BOX) return { error: 'Type the function in the first box' };
      let keep = args.length;
      while (keep > OPTIONAL_FROM[opener] && args[keep - 1].text === BOX) keep--;
      if (keep < args.length) s = s.slice(0, args[keep - 1].end) + s.slice(args[args.length - 1].end);
      continue;
    }
    if (opener !== '∫(' && opener !== 'd/dx(') continue;
    const { args } = callArgs(s, i);
    if (args[0].text === BOX) return { error: 'Type the function in the first box' };
    if (opener === 'd/dx(' && args.length === 2 && args[1].text === BOX) {
      s = s.slice(0, args[0].end) + s.slice(args[1].end);
    } else if (opener === '∫(' && args.length === 3) {
      const empty = [args[1], args[2]].filter((x) => x.text === BOX).length;
      if (empty === 1) return { error: 'Fill in both limits, or leave both empty for a formula' };
      if (empty === 2) s = s.slice(0, args[0].end) + s.slice(args[2].end);
    }
  }
  if (s.includes(BOX)) return { error: 'Fill in the empty box' };
  return { expr: s };
}

/**
 * Replaces the variables A–D, F, M with their stored values (0 if never
 * stored), so the saved calculation does not change when a variable does.
 * Whole key presses are skipped, so the C in nCr( stays.
 * @param {Record<string, number>} vars
 */
export function freezeVars(expr, vars) {
  let out = '';
  for (let i = 0; i < expr.length; ) {
    const n = tokenAfter(expr.slice(i));
    out += n === 1 && VARIABLES.includes(expr[i]) ? operandIn(expr, i, i + 1, vars?.[expr[i]] ?? 0) : expr.slice(i, i + n);
    i += n;
  }
  return out;
}
