// The advanced keys (linear algebra, multivariable calculus, ODEs, optimisation,
// discrete maths, graphs) as math.js functions. engine.js imports them into both
// its real and complex instances; the algorithms live in the modules below and
// work on plain numbers, arrays and closures.
//
// Keys that take a function (∬, ∂x, grad, min, ode …) get their arguments
// unevaluated (rawArgs), like ∫ in engine.js, so f can be sampled anywhere.
// Thrown messages are short and shown to the user as they are.
import * as linalg from './linalg';
import * as multivar from './multivar';
import * as ode from './ode';
import * as opt from './optimize';
import * as discrete from './discrete';
import * as graph from './graph';

/** A result with several named values: x=1.5, y=−2, min=3 or U=[…], Σ=[…], V=[…]. */
// Workings for the hold panel's Steps (numericSteps.js): while a trace is open, ode, ode2
// and nsolve record every solver step in it. Evaluation is synchronous, so one slot is enough.
let trace = null;

/**
 * Runs `run` with step recording on.
 * @template T
 * @param {() => T} run
 * @returns {{ value: T, trace: object[] }}
 */
export function withTrace(run) {
  const t = (trace = []);
  try {
    return { value: run(), trace: t };
  } finally {
    trace = null;
  }
}
const odeStep = () => (trace ? (x, Y, h) => trace.push({ x, Y: Y.slice(), h }) : undefined);

export class Parts {
  /** @param {[string, any][]} list  [name, value]; name '' prints the value alone */
  constructor(list) {
    this.list = list;
  }
}

const VARS = ['x', 'y', 'z'];

/**
 * @param {object} m  the math.js instance
 * @param {object} h
 * @param {object} h.cm  the complex instance (eigs never finishes on the predictable one)
 * @param {(node, scope, vars: string[]) => Function} h.fnOf  f(...values) from an unevaluated argument
 * @param {(v) => number} h.num  throws unless v is a number
 * @param {(rad: number) => number} h.fromRad  radians -> the angle mode
 */
export function advancedFns(m, { cm, fnOf, num, fromRad }) {
  const ev = (node, scope) => node.compile().evaluate(scope);
  const arr = (v) => (m.isMatrix(v) ? v.toArray() : v);
  const matrixArg = (v) => {
    const a = arr(v);
    if (!Array.isArray(a) || !Array.isArray(a[0])) throw new Error('Expected a matrix');
    return a;
  };
  const vectorArg = (v) => {
    const a = arr(v);
    if (!Array.isArray(a)) throw new Error('Expected a list like [1,2]');
    return a.flat().map(num);
  };
  // complex numbers from the modules come as { re, im }
  const scalar = (v) => (v && typeof v === 'object' && 're' in v ? (v.im === 0 ? v.re : m.complex(v.re, v.im)) : v);
  const out = (a) => m.matrix(a.map((r) => (Array.isArray(r) ? r.map(scalar) : scalar(r))));
  // nested numeric differences (the Hessian) are good to about 1e-9: 4.000000002 is 4
  const snap = (v) => {
    const r = Number(v.toPrecision(8));
    return Math.abs(r - v) <= 1e-8 * Math.max(1, Math.abs(v)) ? r : v;
  };
  const uses = (node, names) => node.filter((n) => m.isSymbolNode(n) && names.includes(n.name)).length > 0;
  const raw = (fn) => Object.assign(fn, { rawArgs: true });
  // x+y = 1 in root, nsolve and the constraints of minc: lhs − rhs
  const lhsMinusRhs = (node) =>
    m.isOperatorNode(node) && ['equal', 'smallerEq', 'largerEq', 'smaller', 'larger'].includes(node.fn)
      ? new m.OperatorNode('-', 'subtract', node.args)
      : node;
  /** f of the point [x, y, z] for the first n variables. */
  const fnOfPoint = (node, scope, n) => {
    const f = fnOf(node, scope, VARS.slice(0, n));
    return (p) => f(...p);
  };
  const listArg = (node, name) => {
    if (!m.isArrayNode(node)) throw new Error(name + ' needs a list like [f1,f2]');
    return node.items;
  };
  const pointArg = (node, scope, name) => {
    const p = vectorArg(ev(node, scope));
    if (p.length < 1 || p.length > 3) throw new Error(name + ' needs a point like [1,2]');
    return p;
  };
  const named = (point) => point.map((v, i) => [VARS[i], v]);

  /** min / max: of numbers (as before), of f(x) on [a, b], or of f(x, y, z) from a start point. */
  const optimum = (sign, word) =>
    raw((args, _m, scope) => {
      if (!args.some((a) => uses(a, VARS))) {
        const vals = args.map((a) => ev(a, scope));
        return sign > 0 ? m.min(...vals) : m.max(...vals);
      }
      if (args.length === 3) {
        const f = fnOf(args[0], scope, ['x']);
        const r = opt.minimize1((x) => sign * f(x), num(ev(args[1], scope)), num(ev(args[2], scope)));
        return new Parts([['x', r.x], [word, sign * r.f]]);
      }
      if (args.length !== 2) throw new Error(word + ' needs (f, a, b) or (f, [start])');
      const start = pointArg(args[1], scope, word);
      const f = fnOfPoint(args[0], scope, start.length);
      const r = opt.minimizeN((p) => sign * f(p), start);
      return new Parts([...named(r.x), [word, sign * r.f]]);
    });

  /** minc / maxc(f, [constraints], [start]): constraints like x+y=1, x≤2, y≥0. */
  const constrained = (sign, word) =>
    raw((args, _m, scope) => {
      if (args.length !== 3) throw new Error(word + 'c needs (f, [constraints], [start])');
      const start = pointArg(args[2], scope, word + 'c');
      const n = start.length;
      const f = fnOfPoint(args[0], scope, n);
      const cons = listArg(args[1], word + 'c').map((c) => {
        const type = { equal: 'eq', smallerEq: 'le', smaller: 'le', largerEq: 'ge', larger: 'ge' }[c.fn];
        if (!m.isOperatorNode(c) || !type) throw new Error('Write constraints with =, ≤ or ≥');
        return { g: fnOfPoint(lhsMinusRhs(c), scope, n), type };
      });
      const r = opt.minimizeConstrained((p) => sign * f(p), cons, start);
      return new Parts([...named(r.x), [word, sign * r.f], ['λ', out(r.multipliers)]]);
    });

  const linprog = (integer) => (c, A, b) => {
    const r = opt.linprog(vectorArg(c), matrixArg(A), vectorArg(b), { integer });
    return new Parts([['x', out(r.x)], ['max', r.value]]);
  };

  // real matrices can have complex eigenvalues
  const eigen = (A) => {
    const { values, eigenvectors } = cm.eigs(matrixArg(A));
    const V = m.transpose(m.matrix(eigenvectors.map((e) => arr(e.vector))));
    return new Parts([['λ', m.matrix(arr(values))], ['V', V]]);
  };

  return {
    // ---- linear algebra
    rank: (A) => linalg.rank(matrixArg(A)),
    rref: (A) => out(linalg.rref(matrixArg(A))),
    nullsp: (A) => {
      const N = linalg.nullspace(matrixArg(A));
      return N.length ? out(N) : 'only the zero vector';
    },
    chol: (A) => out(linalg.cholesky(matrixArg(A))),
    posdef: (A) => linalg.isPosDef(matrixArg(A)),
    jordan: (A) => out(linalg.jordan(matrixArg(A)).J),
    svd: (A) => {
      const { U, S, V } = linalg.svd(matrixArg(A));
      return new Parts([['U', out(U)], ['Σ', out(S)], ['V', out(V)]]);
    },
    eig: eigen,
    lu: (A) => {
      const { L, U, p } = m.lup(matrixArg(A));
      const P = p.map((col) => p.map((_, j) => (j === col ? 1 : 0)));
      return new Parts([['L', L], ['U', U], ['P', m.matrix(P)]]);
    },
    qrd: (A) => {
      const { Q, R } = m.qr(matrixArg(A));
      return new Parts([['Q', Q], ['R', R]]);
    },
    linsolve: (A, b) => {
      const M = matrixArg(A);
      const v = vectorArg(b);
      if (M.length !== v.length) throw new Error('A and b sizes don’t match');
      // square: exact solve; otherwise least squares through the pseudo-inverse
      const x = M.length === M[0].length ? m.lusolve(M, v) : m.multiply(m.pinv(M), v);
      return m.matrix(arr(x).flat());
    },

    // ---- complex
    targ: (z) => fromRad(m.arg(z)),

    // ---- multivariable calculus
    integ2: raw((args, _m, scope) => {
      if (args.length !== 5) throw new Error('∬ needs (f, x from, x to, y from, y to)');
      const [a, b] = [args[1], args[2]].map((n) => num(ev(n, scope)));
      const f = fnOf(args[0], scope, ['x', 'y']);
      return multivar.double(f, a, b, fnOf(args[3], scope, ['x']), fnOf(args[4], scope, ['x']));
    }),
    integ3: raw((args, _m, scope) => {
      if (args.length !== 7) throw new Error('∭ needs (f, x, x, y, y, z, z limits)');
      const [a, b] = [args[1], args[2]].map((n) => num(ev(n, scope)));
      return multivar.triple(
        fnOf(args[0], scope, VARS), a, b,
        fnOf(args[3], scope, ['x']), fnOf(args[4], scope, ['x']),
        fnOf(args[5], scope, ['x', 'y']), fnOf(args[6], scope, ['x', 'y']),
      );
    }),
    ...Object.fromEntries(
      VARS.map((v, i) => [
        'pd' + v,
        raw((args, _m, scope) => {
          const point = args.slice(1).map((n) => num(ev(n, scope)));
          if (point.length <= i) throw new Error(`∂${v} needs the point, e.g. ∂${v}(f,1,2)`);
          return multivar.partial(fnOfPoint(args[0], scope, point.length), point, i);
        }),
      ]),
    ),
    gradf: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('grad needs (f, [point])');
      const p = pointArg(args[1], scope, 'grad');
      return out(multivar.gradient(fnOfPoint(args[0], scope, p.length), p));
    }),
    hess: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('hess needs (f, [point])');
      const p = pointArg(args[1], scope, 'hess');
      return out(multivar.hessian(fnOfPoint(args[0], scope, p.length), p).map((row) => row.map(snap)));
    }),
    lap: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('lap needs (f, [point])');
      const p = pointArg(args[1], scope, 'lap');
      return multivar.laplacian(fnOfPoint(args[0], scope, p.length), p);
    }),
    jac: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('jac needs ([f1,f2], [point])');
      const p = pointArg(args[1], scope, 'jac');
      return out(multivar.jacobian(listArg(args[0], 'jac').map((n) => fnOfPoint(n, scope, p.length)), p));
    }),
    divg: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('div needs ([P,Q,R], [point])');
      const p = pointArg(args[1], scope, 'div');
      return multivar.divergence(listArg(args[0], 'div').map((n) => fnOfPoint(n, scope, p.length)), p);
    }),
    curl: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('curl needs ([P,Q,R], [point])');
      const p = pointArg(args[1], scope, 'curl');
      const r = multivar.curl(listArg(args[0], 'curl').map((n) => fnOfPoint(n, scope, p.length)), p);
      return Array.isArray(r) ? out(r) : r;
    }),
    lim: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('lim needs (f, a)');
      return multivar.limit(fnOf(args[0], scope, ['x']), num(ev(args[1], scope)));
    }),
    // a Taylor polynomial is a formula: symbolic.js works it out before evaluation
    taylor: raw(() => {
      throw new Error('Use taylor(f,a,n) on its own');
    }),

    // ---- differential equations
    ode: raw((args, _m, scope) => {
      if (args.length !== 4) throw new Error('ode needs (f, x0, y0, x)');
      const [x0, y0, x1] = args.slice(1).map((n) => num(ev(n, scope)));
      return ode.ode1(fnOf(args[0], scope, ['x', 'y']), x0, y0, x1, odeStep());
    }),
    ode2: raw((args, _m, scope) => {
      if (args.length !== 5) throw new Error('ode2 needs (f, x0, y0, y′0, x)');
      const [x0, y0, yp0, x1] = args.slice(1).map((n) => num(ev(n, scope)));
      return ode.ode2(fnOf(args[0], scope, ['x', 'y', 'yp']), x0, y0, yp0, x1, odeStep());
    }),
    bvp: raw((args, _m, scope) => {
      if (args.length !== 6) throw new Error('bvp needs (f, a, y(a), b, y(b), x)');
      const [a, ya, b, yb, x] = args.slice(1).map((n) => num(ev(n, scope)));
      return ode.bvp(fnOf(args[0], scope, ['x', 'y', 'yp']), a, ya, b, yb, x);
    }),
    stab: (J) => {
      const r = ode.stability(matrixArg(J));
      return new Parts([['', r.type], ['λ', out(r.eigenvalues)]]);
    },

    // ---- optimisation and equations
    optmin: optimum(1, 'min'),
    optmax: optimum(-1, 'max'),
    minc: constrained(1, 'min'),
    maxc: constrained(-1, 'max'),
    lp: linprog(false),
    ilp: linprog(true),
    root: raw((args, _m, scope) => {
      if (args.length !== 3) throw new Error('root needs (f, a, b)');
      const f = fnOf(lhsMinusRhs(args[0]), scope, ['x']);
      return opt.rootBracket(f, num(ev(args[1], scope)), num(ev(args[2], scope)));
    }),
    nsolve: raw((args, _m, scope) => {
      if (args.length !== 2) throw new Error('nsolve needs (f, guess)');
      const f = fnOf(lhsMinusRhs(args[0]), scope, ['x']);
      const x0 = num(ev(args[1], scope));
      if (trace) trace.push({ x: x0, fx: f(x0), method: 'start' });
      return opt.rootNewton(f, x0, trace ? (st) => trace.push(st) : undefined);
    }),
    roots: (coeffs) => out(opt.polyRoots(vectorArg(coeffs))),

    // ---- discrete maths
    isprime: (n) => discrete.isPrime(num(n)),
    factorInt: (n) =>
      discrete
        .factorInt(num(n))
        .map(([p, e]) => p + (e === 1 ? '' : String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])))
        .join('×'),
    totient: (n) => discrete.totient(num(n)),
    modinv: (a, n) => discrete.modInverse(num(a), num(n)),
    modpow: (b, e, n) => discrete.modPow(num(b), num(e), num(n)),
    land: (a, b) => discrete.and(num(a), num(b)),
    lor: (a, b) => discrete.or(num(a), num(b)),
    lnot: (a) => discrete.not(num(a)),
    lxor: (a, b) => discrete.xor(num(a), num(b)),
    limp: (a, b) => discrete.implies(num(a), num(b)),
    rec: raw((args, _m, scope) => {
      if (args.length !== 3) throw new Error('rec needs (f(n,x), x0, N)');
      const f = fnOf(args[0], scope, ['n', 'x']);
      return discrete.recurrence(f, num(ev(args[1], scope)), num(ev(args[2], scope)));
    }),
    catalanN: (n) => discrete.catalan(num(n)),
    stirling: (n, k) => discrete.stirling2(num(n), num(k)),
    bell: (n) => discrete.bell(num(n)),
    union: (a, b) => m.matrix(arr(m.setUnion(vectorArg(a), vectorArg(b))).sort((x, y) => x - y)),
    inter: (a, b) => m.matrix(arr(m.setIntersect(vectorArg(a), vectorArg(b))).sort((x, y) => x - y)),
    setdiff: (a, b) => m.matrix(arr(m.setDifference(vectorArg(a), vectorArg(b))).sort((x, y) => x - y)),

    // ---- graphs, given as adjacency / weight matrices
    gpath: (W, s, t) => {
      const r = graph.shortestPath(matrixArg(W), num(s), num(t));
      return new Parts([['d', r.dist], ['path', m.matrix(r.path)]]);
    },
    mst: (W) => {
      const r = graph.mst(matrixArg(W));
      return new Parts([['w', r.weight], ['edges', m.matrix(r.edges)]]);
    },
    flow: (C, s, t) => graph.maxFlow(matrixArg(C), num(s), num(t)),
    assign: (W) => {
      const r = graph.assignment(matrixArg(W));
      return new Parts([['cost', r.cost], ['match', m.matrix(r.match)]]);
    },
    colour: (A) => {
      const r = graph.chromatic(matrixArg(A));
      return new Parts([['χ', r.k], ['colours', m.matrix(r.colours)]]);
    },
    comps: (A) => graph.components(matrixArg(A)),
    trees: (A) => graph.spanningTrees(matrixArg(A)),
    fiedler: (A) => graph.fiedler(matrixArg(A)),
  };
}
