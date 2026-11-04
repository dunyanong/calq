import {
  isPrime,
  factorInt,
  totient,
  modPow,
  modInverse,
  mod,
  recurrence,
  catalan,
  stirling2,
  bell,
  logic,
} from '@/features/calculator/math/discrete';

describe('primes and factors', () => {
  it('tests primality', () => {
    expect([0, 1, 2, 3, 4, 17, 561, 7919].map(isPrime)).toEqual([0, 0, 1, 1, 0, 1, 0, 1]);
    expect(isPrime(9007199254740881)).toBe(1); // largest prime below 2^53
    expect(isPrime(3215031751)).toBe(0); // strong pseudoprime to bases 2, 3, 5, 7
  });

  it('factors', () => {
    expect(factorInt(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(factorInt(97)).toEqual([[97, 1]]);
    expect(factorInt(2 ** 53)).toEqual([[2, 53]]);
    expect(factorInt(9007199254740879)).toEqual([[3, 2], [43, 1], [642739, 1], [36211303, 1]]);
    // product of two large primes, needs Pollard rho
    expect(factorInt(94906249 * 94906247)).toEqual([[94906247, 1], [94906249, 1]]);
    expect(factorInt(999999000001 * 7)).toEqual([[7, 1], [999999000001, 1]]);
    expect(() => factorInt(1)).toThrow();
    expect(() => factorInt(2.5)).toThrow('Needs an integer');
  });

  it("computes Euler's totient", () => {
    expect(totient(36)).toBe(12);
    expect(totient(1)).toBe(1);
    expect(totient(97)).toBe(96);
  });
});

describe('modular arithmetic', () => {
  it('powers', () => {
    expect(modPow(4, 13, 497)).toBe(445);
    expect(modPow(2, 100, 1000000007)).toBe(976371285);
    expect(modPow(-2, 3, 5)).toBe(2);
  });

  it('inverses', () => {
    expect(modInverse(3, 11)).toBe(4);
    expect(modInverse(-3, 11)).toBe(7);
    expect(() => modInverse(6, 9)).toThrow('No inverse: gcd ≠ 1');
  });

  it('mod is non-negative for a positive modulus', () => {
    expect(mod(-7, 3)).toBe(2);
    expect(mod(7, 3)).toBe(1);
    expect(mod(-6, 3)).toBe(0);
    expect(mod(5.5, 2)).toBe(1.5);
    expect(mod(-0.5, 2)).toBe(1.5);
    expect(mod(7, -3)).toBe(-2);
  });
});

describe('recurrence', () => {
  it('iterates x_{n+1} = f(n, x_n)', () => {
    expect(recurrence((n, x) => 2 * x + 1, 0, 10)).toBe(1023);
    expect(recurrence((n, x) => x * (n + 1), 1, 5)).toBe(120);
    expect(recurrence(() => 0, 7, 0)).toBe(7);
    expect(() => recurrence((n, x) => x, 0, 100001)).toThrow();
    expect(() => recurrence((n, x) => x, 0, 1.5)).toThrow();
  });
});

describe('counting', () => {
  it('catalan, stirling2, bell', () => {
    expect([0, 1, 2, 3, 4, 5].map(catalan)).toEqual([1, 1, 2, 5, 14, 42]);
    expect(stirling2(5, 2)).toBe(15);
    expect(stirling2(0, 0)).toBe(1);
    expect(stirling2(3, 5)).toBe(0);
    expect([0, 1, 2, 3, 4, 5].map(bell)).toEqual([1, 1, 2, 5, 15, 52]);
  });
});

describe('logic', () => {
  it('works on truthy numbers', () => {
    const { and, or, not, xor, implies } = logic;
    expect([and(1, 1), and(2, 0), or(0, 0), or(0, -3)]).toEqual([1, 0, 0, 1]);
    expect([not(0), not(5), xor(1, 1), xor(1, 0)]).toEqual([1, 0, 0, 1]);
    expect([implies(1, 0), implies(0, 0), implies(1, 1), implies(0, 1)]).toEqual([0, 1, 1, 1]);
  });
});
