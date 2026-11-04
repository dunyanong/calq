// Number theory, counting and logic for the discrete-maths keys.
//
// Integer work goes through BigInt so results stay exact up to 2^53. Bad input
// throws an Error whose message is short enough for a toast.

const MAX = 2 ** 53;

function checkInt(n, min = 0, max = MAX) {
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new Error('Needs an integer');
  if (n < min) throw new Error(`Needs an integer ≥ ${min}`);
  if (n > max) throw new Error(`Needs an integer ≤ ${max === MAX ? '2^53' : max}`);
}

/** b^e mod m with BigInts. */
function powB(b, e, m) {
  let r = 1n;
  b %= m;
  if (b < 0n) b += m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

const gcdB = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
};

// enough bases for every n < 3.3·10^24
const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

function isPrimeB(n) {
  if (n < 2n) return false;
  for (const p of MR_BASES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  outer: for (const a of MR_BASES) {
    let x = powB(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

/**
 * 1 when n is prime (deterministic Miller–Rabin), else 0.
 * @param {number} n
 * @returns {0 | 1}
 */
export function isPrime(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 2) return 0;
  if (n > MAX) throw new Error('Needs an integer ≤ 2^53');
  return isPrimeB(BigInt(n)) ? 1 : 0;
}

/** A non-trivial factor of the odd composite n (Pollard rho, Brent's variant). */
function rho(n) {
  for (let c = 1n; ; c++) {
    const f = (x) => (x * x + c) % n;
    let y = 2n;
    let x = 2n;
    let g = 1n;
    let q = 1n;
    let ys = 2n;
    let r = 1;
    const m = 64;
    while (g === 1n) {
      x = y;
      for (let i = 0; i < r; i++) y = f(y);
      for (let k = 0; k < r && g === 1n; k += m) {
        ys = y;
        for (let i = 0; i < Math.min(m, r - k); i++) {
          y = f(y);
          q = (q * (x > y ? x - y : y - x)) % n;
        }
        g = gcdB(q, n);
      }
      r *= 2;
    }
    if (g === n) {
      // the batch overshot; step one at a time
      do {
        ys = f(ys);
        g = gcdB(x > ys ? x - ys : ys - x, n);
      } while (g === 1n);
    }
    if (g !== n) return g;
  }
}

function factorB(n, out) {
  if (n === 1n) return;
  if (isPrimeB(n)) {
    out.push(n);
    return;
  }
  const d = rho(n);
  factorB(d, out);
  factorB(n / d, out);
}

/**
 * Prime factorisation.
 * @param {number} n integer, 2 ≤ n ≤ 2^53
 * @returns {[number, number][]} [prime, exponent] pairs, primes ascending
 */
export function factorInt(n) {
  checkInt(n, 2);
  let m = BigInt(n);
  const primes = [];
  for (let p = 2n; p < 1000n && p * p <= m; p += p === 2n ? 1n : 2n) {
    while (m % p === 0n) {
      primes.push(p);
      m /= p;
    }
  }
  factorB(m, primes);
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out = [];
  for (const p of primes) {
    const last = out[out.length - 1];
    if (last && last[0] === Number(p)) last[1]++;
    else out.push([Number(p), 1]);
  }
  return out;
}

/**
 * Euler's totient φ(n): how many of 1..n are coprime to n.
 * @param {number} n integer ≥ 1
 * @returns {number}
 */
export function totient(n) {
  checkInt(n, 1);
  if (n === 1) return 1;
  let r = BigInt(n);
  for (const [p] of factorInt(n)) r = (r / BigInt(p)) * BigInt(p - 1);
  return Number(r);
}

/**
 * b^e mod m, exact.
 * @param {number} b integer
 * @param {number} e integer ≥ 0
 * @param {number} m integer ≥ 1
 * @returns {number} in 0..m−1
 */
export function modPow(b, e, m) {
  if (!Number.isInteger(b)) throw new Error('Needs an integer');
  checkInt(e, 0);
  checkInt(m, 1);
  return Number(powB(BigInt(b), BigInt(e), BigInt(m)));
}

/**
 * x with a·x ≡ 1 (mod m).
 * @param {number} a integer
 * @param {number} m integer ≥ 1
 * @returns {number} in 0..m−1
 */
export function modInverse(a, m) {
  if (!Number.isInteger(a)) throw new Error('Needs an integer');
  checkInt(m, 1);
  const M = BigInt(m);
  let [r0, r1] = [((BigInt(a) % M) + M) % M, M];
  let [s0, s1] = [1n, 0n];
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n && m !== 1) throw new Error('No inverse: gcd ≠ 1');
  return Number(((s0 % M) + M) % M);
}

/**
 * a mod m with the sign of m (so in [0, m) for m > 0); works on non-integers.
 * @param {number} a
 * @param {number} m nonzero
 * @returns {number}
 */
export function mod(a, m) {
  if (m === 0) throw new Error('Modulus must not be 0');
  const r = a % m;
  if (r === 0) return 0; // also turns −0 into 0
  return r < 0 !== m < 0 ? r + m : r;
}

/**
 * x_N for x_{n+1} = f(n, x_n), x_0 = x0.
 * @param {(n: number, x: number) => number} f
 * @param {number} x0
 * @param {number} N integer 0..100000
 * @returns {number}
 */
export function recurrence(f, x0, N) {
  if (!Number.isInteger(N) || N < 0 || N > 100000) throw new Error('N must be an integer 0 to 100000');
  let x = x0;
  for (let n = 0; n < N; n++) x = f(n, x);
  return x;
}

/**
 * n-th Catalan number C(2n, n)/(n + 1).
 * @param {number} n integer 0..10000
 * @returns {number} Infinity once beyond double range
 */
export function catalan(n) {
  checkInt(n, 0, 10000);
  let c = 1n;
  for (let k = 0; k < n; k++) c = (c * BigInt(2 * (2 * k + 1))) / BigInt(k + 2);
  return Number(c);
}

/**
 * Stirling number of the second kind: ways to split n items into k
 * non-empty groups.
 * @param {number} n integer 0..1000
 * @param {number} k integer ≥ 0
 * @returns {number}
 */
export function stirling2(n, k) {
  checkInt(n, 0, 1000);
  checkInt(k, 0);
  if (k > n) return 0;
  // row of S(i, 0..k), built up i = 0..n
  let row = [1n, ...new Array(k).fill(0n)];
  for (let i = 1; i <= n; i++) {
    const next = new Array(k + 1).fill(0n);
    for (let j = 1; j <= Math.min(i, k); j++) next[j] = BigInt(j) * row[j] + row[j - 1];
    row = next;
  }
  return Number(row[k]);
}

/**
 * Bell number: ways to partition n items (Bell triangle).
 * @param {number} n integer 0..1000
 * @returns {number}
 */
export function bell(n) {
  checkInt(n, 0, 1000);
  let row = [1n];
  for (let i = 0; i < n; i++) {
    const next = [row[row.length - 1]];
    for (const v of row) next.push(next[next.length - 1] + v);
    row = next;
  }
  return Number(row[0]);
}

const truth = (x) => (x ? 1 : 0); // 0 and NaN are false

/** Logical AND of numbers: 1 or 0. */
export const and = (a, b) => truth(truth(a) && truth(b));
/** Logical OR of numbers: 1 or 0. */
export const or = (a, b) => truth(truth(a) || truth(b));
/** Logical NOT of a number: 1 or 0. */
export const not = (a) => 1 - truth(a);
/** Exclusive OR of numbers: 1 or 0. */
export const xor = (a, b) => truth(a) ^ truth(b);
/** a ⇒ b: 0 only when a is true and b false. */
export const implies = (a, b) => truth(!truth(a) || truth(b));

export const logic = { and, or, not, xor, implies };
