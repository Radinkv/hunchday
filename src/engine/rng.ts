/**
 * Deterministic pseudo random primitives for date seeded generation.
 *
 * The generator must produce the identical puzzle for a given date on every device
 * and every JavaScript engine, forever. That guarantee rests entirely on this module
 * being deterministic and engine stable, so everything here uses integer arithmetic
 * through bitwise operators and the integer multiply intrinsic. No floating point
 * rounding ever influences a result. The only non integer literal is the unsigned 32
 * bit range, which is an exact integer value held in a double and used only for
 * modulus and comparison.
 *
 * The hashing follows FNV-1a with a MurmurHash3 style finalizer for avalanche, and
 * the generator follows Mulberry32. Both are small, well known, public domain
 * algorithms. The integer constants below are the defining parameters of those
 * algorithms rather than arbitrary values.
 */

const FNV32_OFFSET_BASIS = 0x811c9dc5;
const FNV32_PRIME = 0x01000193;
const FINALIZER_MULTIPLIER_ONE = 0x85ebca6b;
const FINALIZER_MULTIPLIER_TWO = 0xc2b2ae35;

/** Seeds used to derive the two halves of a sixty four bit fingerprint hash. */
const HASH64_PRIMARY_SEED = FNV32_OFFSET_BASIS;
const HASH64_SECONDARY_SEED = 0x9e3779b9;

const MULBERRY_INCREMENT = 0x6d2b79f5;

/** The number of distinct unsigned thirty two bit values, equal to two to the power thirty two. */
const UINT32_RANGE = 0x1_00_00_00_00;

const HEX_RADIX = 16;
const HEX_HALF_WIDTH = 8;
const HEX_PAD_CHARACTER = "0";

const ERROR_INVALID_RANGE = "intInRange requires the high bound to be at least the low bound";

/**
 * A deterministic source of pseudo random integers seeded from a single value. The
 * same seed always yields the same sequence. Consumers draw raw unsigned thirty two
 * bit words or bounded integers, and bounded draws are free of modulo bias.
 */
export interface Rng {
  /** Returns the next raw unsigned thirty two bit word in the sequence. */
  nextUint32(): number;
  /**
   * Returns the next integer in the inclusive range, drawn without modulo bias.
   * @param lowInclusive The smallest value that may be returned.
   * @param highInclusive The largest value that may be returned.
   */
  intInRange(lowInclusive: number, highInclusive: number): number;
  /**
   * Returns one item chosen uniformly from a non empty list.
   * @param items The list to choose from.
   */
  pick<T>(items: readonly T[]): T;
}

/**
 * Hashes a string to an unsigned thirty two bit integer using FNV-1a followed by a
 * MurmurHash3 style finalizer so that small input changes avalanche across the whole
 * result. Used to derive a generator seed from a date string and salt.
 * @param value The string to hash.
 * @param seed The starting basis, defaulting to the FNV offset basis. A different
 *   seed produces an independent hash of the same input.
 * @returns The unsigned thirty two bit hash.
 */
export function hash32(value: string, seed: number = FNV32_OFFSET_BASIS): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, FNV32_PRIME);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, FINALIZER_MULTIPLIER_ONE);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, FINALIZER_MULTIPLIER_TWO);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Formats an unsigned thirty two bit integer as a fixed width lowercase hex string.
 * @param value The integer to format.
 * @returns An eight character hex string.
 */
function toHexHalf(value: number): string {
  return (value >>> 0).toString(HEX_RADIX).padStart(HEX_HALF_WIDTH, HEX_PAD_CHARACTER);
}

/**
 * Hashes a string to a sixty four bit fingerprint expressed as a sixteen character
 * hex string. Two independent thirty two bit hashes are concatenated, which gives a
 * collision space large enough to bucket many thousands of pipelines safely while
 * remaining fully integer based and engine stable.
 * @param value The string to hash.
 * @returns A sixteen character lowercase hex fingerprint.
 */
export function hash64hex(value: string): string {
  const high = hash32(value, HASH64_PRIMARY_SEED);
  const low = hash32(value, HASH64_SECONDARY_SEED);
  return toHexHalf(high) + toHexHalf(low);
}

/**
 * Creates a deterministic generator from a seed. The returned generator holds its
 * own private state and is independent of any other generator.
 * @param seed The seed that fixes the entire output sequence.
 * @returns A generator over the seeded sequence.
 */
export function createRng(seed: number): Rng {
  let state = Math.trunc(seed);

  function nextUint32(): number {
    state = Math.trunc(state + MULBERRY_INCREMENT);
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return (mixed ^ (mixed >>> 14)) >>> 0;
  }

  function intInRange(lowInclusive: number, highInclusive: number): number {
    if (highInclusive < lowInclusive) throw new Error(ERROR_INVALID_RANGE);
    const span = highInclusive - lowInclusive + 1;
    const rejectionLimit = UINT32_RANGE - (UINT32_RANGE % span);
    let candidate = nextUint32();
    while (candidate >= rejectionLimit) {
      candidate = nextUint32();
    }
    return lowInclusive + (candidate % span);
  }

  function pick<T>(items: readonly T[]): T {
    return items[intInRange(0, items.length - 1)];
  }

  return { nextUint32, intInRange, pick };
}
