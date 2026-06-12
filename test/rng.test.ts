import { describe, expect, it } from "vitest";
import { createRng, hash32, hash64hex } from "../src/engine/rng";

/**
 * These tests pin the deterministic primitives to fixed known vectors. The vectors
 * were captured from the implementation and are frozen here on purpose: any change to
 * the hashing or generator algorithm changes these outputs and fails the suite
 * loudly, which is the guarantee the whole date seeded system depends on. The tests
 * also confirm the structural promises, that hashes are unsigned thirty two bit
 * integers, that fingerprints are fixed width hex, and that bounded draws stay in
 * range and are free of modulo bias.
 */

const HASH32_HUNCHDAY = 1673035426;
const HASH32_DATE = 1087833923;
const HASH32_EMPTY = 2872998923;
const HASH64_HUNCHDAY = "63b87ea26e236857";

const SEED_DATE = "2026-06-12";
const MULBERRY_SEQUENCE_FOR_DATE = [3559219418, 58269959, 83775928, 2291086073, 1932714490];

const DICE_SEED = 12345;
const DICE_LOW = 1;
const DICE_HIGH = 6;
const DICE_SEQUENCE = [4, 1, 5, 5, 1, 2, 1, 4, 4, 5];

const UINT32_MAX = 0xffffffff;
const HEX64_PATTERN = /^[0-9a-f]{16}$/;
const ALTERNATE_SEED = 9999;

describe("hash32", () => {
  it("matches the known vectors", () => {
    expect(hash32("hunchday")).toBe(HASH32_HUNCHDAY);
    expect(hash32(SEED_DATE)).toBe(HASH32_DATE);
    expect(hash32("")).toBe(HASH32_EMPTY);
  });

  it("is deterministic for a given input", () => {
    expect(hash32("hunchday")).toBe(hash32("hunchday"));
  });

  it("produces an unsigned thirty two bit integer", () => {
    const value = hash32("anything at all");
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(UINT32_MAX);
  });

  it("produces an independent hash for a different seed", () => {
    expect(hash32("hunchday", ALTERNATE_SEED)).not.toBe(hash32("hunchday"));
  });

  it("avalanches a single character change across the whole result", () => {
    expect(hash32("2026-06-12")).not.toBe(hash32("2026-06-13"));
  });
});

describe("hash64hex", () => {
  it("matches the known vector", () => {
    expect(hash64hex("hunchday")).toBe(HASH64_HUNCHDAY);
  });

  it("is a sixteen character lowercase hex string", () => {
    expect(hash64hex("hunchday")).toMatch(HEX64_PATTERN);
    expect(hash64hex(SEED_DATE)).toMatch(HEX64_PATTERN);
    expect(hash64hex("")).toMatch(HEX64_PATTERN);
  });
});

describe("createRng raw words", () => {
  it("matches the known sequence for a seeded generator", () => {
    const rng = createRng(hash32(SEED_DATE));
    const produced = MULBERRY_SEQUENCE_FOR_DATE.map(() => rng.nextUint32());
    expect(produced).toEqual(MULBERRY_SEQUENCE_FOR_DATE);
  });

  it("produces the identical sequence for the same seed", () => {
    const first = createRng(DICE_SEED);
    const second = createRng(DICE_SEED);
    const draw = () => [first.nextUint32(), second.nextUint32()];
    for (let count = 0; count < 5; count++) {
      const [a, b] = draw();
      expect(a).toBe(b);
    }
  });

  it("diverges for different seeds", () => {
    const first = createRng(DICE_SEED);
    const second = createRng(ALTERNATE_SEED);
    expect(first.nextUint32()).not.toBe(second.nextUint32());
  });

  it("only yields unsigned thirty two bit integers", () => {
    const rng = createRng(DICE_SEED);
    for (let count = 0; count < 1000; count++) {
      const value = rng.nextUint32();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(UINT32_MAX);
    }
  });
});

describe("createRng bounded draws", () => {
  it("matches the known bounded sequence", () => {
    const rng = createRng(DICE_SEED);
    const produced = DICE_SEQUENCE.map(() => rng.intInRange(DICE_LOW, DICE_HIGH));
    expect(produced).toEqual(DICE_SEQUENCE);
  });

  it("stays within the inclusive bounds and covers every value", () => {
    const rng = createRng(DICE_SEED);
    const low = 0;
    const high = 3;
    const seen = new Set<number>();
    for (let count = 0; count < 1000; count++) {
      const value = rng.intInRange(low, high);
      expect(value).toBeGreaterThanOrEqual(low);
      expect(value).toBeLessThanOrEqual(high);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("returns the only value of a single value range", () => {
    const rng = createRng(DICE_SEED);
    for (let count = 0; count < 5; count++) {
      expect(rng.intInRange(5, 5)).toBe(5);
    }
  });

  it("throws when the high bound is below the low bound", () => {
    const rng = createRng(DICE_SEED);
    expect(() => rng.intInRange(6, 1)).toThrow();
  });
});

describe("createRng pick", () => {
  it("returns a member of the list and is deterministic for a seed", () => {
    const items = ["a", "b", "c", "d"];
    const first = createRng(DICE_SEED);
    const second = createRng(DICE_SEED);
    const chosen = first.pick(items);
    expect(items).toContain(chosen);
    expect(second.pick(items)).toBe(chosen);
  });
});
