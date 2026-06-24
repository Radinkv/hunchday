import { describe, expect, it } from "vitest";
import {
  ALL_PATTERNS,
  familyOf,
  matchPatterns,
  PATTERN_C1,
  PATTERN_C2,
  PATTERN_C3,
  PATTERN_C4,
  PATTERN_C5,
  PATTERN_L1,
  PATTERN_L2,
  PATTERN_L3,
  PATTERN_L4,
  PATTERN_L5,
  PATTERN_L6,
} from "../src/engine/fairness";
import { step } from "../src/engine/compose";
import type { OpMeta } from "../src/engine/ops-types";
import {
  REGISTRY,
  OP_ADD_K,
  OP_AFFINE,
  OP_DELTAS,
  OP_DROP_FIRST,
  OP_KEEP_DUPS,
  OP_KEEP_EVEN,
  OP_KEEP_FIRST_K,
  OP_KEEP_GT_K,
  OP_KEEP_LT_K,
  OP_LENGTH_MAP,
  OP_LETTER_COUNT_SQUARED,
  OP_MEDIAN,
  OP_MIN_NORMALIZE,
  OP_MODE,
  OP_MUL_K,
  OP_REVERSE,
  OP_RUNNING_TOTAL,
  OP_SORT_ASC,
  OP_SUB_K,
  OP_SUM,
  OP_UNITS_DIGIT,
} from "../src/engine/ops";

/**
 * These tests pin the structural fairness catalog: the family tagging covers every
 * operation, the matcher flags each catalogued unfairness pattern on a representative
 * pipeline including the two shipped failures, and it leaves known fair rules untouched.
 * The matcher reasons over shape alone, so a pipeline is built from operation meta and
 * empty parameters; the parameters never affect the structural verdict.
 */

/**
 * Builds a parameterless pipeline from a list of operation meta, since the matcher
 * ignores parameters and reads only the operation sequence.
 * @param ops The operations in order.
 * @returns The pipeline steps.
 */
function pipeline(...ops: readonly OpMeta[]) {
  return ops.map((op) => step(op));
}

describe("fairness family tags", () => {
  it("tags every operation in the registry with a family", () => {
    const untagged = REGISTRY.filter((op) => familyOf(op.id) === undefined).map((op) => op.id);
    expect(untagged).toEqual([]);
  });
});

describe("fairness matcher — shipped failures", () => {
  it("flags Example 1 as literal loss L1", () => {
    const example1 = pipeline(OP_KEEP_LT_K, OP_ADD_K, OP_KEEP_GT_K);
    expect(matchPatterns(example1).has(PATTERN_L1)).toBe(true);
  });

  it("flags Example 2 as computation grind C1", () => {
    const example2 = pipeline(OP_LETTER_COUNT_SQUARED);
    expect(matchPatterns(example2).has(PATTERN_C1)).toBe(true);
  });
});

describe("fairness matcher — one positive case per pattern", () => {
  const cases: ReadonlyArray<readonly [string, readonly OpMeta[]]> = [
    [PATTERN_L1, [OP_KEEP_LT_K, OP_ADD_K, OP_KEEP_GT_K]],
    [PATTERN_L2, [OP_KEEP_GT_K, OP_MUL_K, OP_MEDIAN]],
    [PATTERN_L3, [OP_KEEP_GT_K, OP_DELTAS]],
    [PATTERN_L4, [OP_DROP_FIRST, OP_REVERSE, OP_KEEP_FIRST_K]],
    [PATTERN_C1, [OP_LETTER_COUNT_SQUARED]],
    [PATTERN_C2, [OP_AFFINE]],
    [PATTERN_C3, [OP_UNITS_DIGIT, OP_ADD_K]],
    [PATTERN_C4, [OP_DELTAS, OP_RUNNING_TOTAL]],
    [PATTERN_C5, [OP_SUB_K, OP_KEEP_LT_K]],
    [PATTERN_L5, [OP_UNITS_DIGIT, OP_KEEP_GT_K]],
    [PATTERN_L6, [OP_KEEP_GT_K, OP_UNITS_DIGIT]],
  ];

  for (const [pattern, ops] of cases) {
    it(`flags ${pattern}`, () => {
      expect(matchPatterns(pipeline(...ops)).has(pattern)).toBe(true);
    });
  }
});

describe("fairness matcher — reshape rules that pre-C4 slipped through fire C4", () => {
  const reshapeRules: ReadonlyArray<readonly [string, readonly OpMeta[]]> = [
    ["A: subtract, running total, normalize", [OP_SUB_K, OP_RUNNING_TOTAL, OP_MIN_NORMALIZE]],
    ["B: multiply, normalize, keep dups", [OP_MUL_K, OP_MIN_NORMALIZE, OP_KEEP_DUPS]],
    ["C: count letters, normalize, mode", [OP_LENGTH_MAP, OP_MIN_NORMALIZE, OP_MODE]],
    ["D: gaps, running total, keep big", [OP_DELTAS, OP_RUNNING_TOTAL, OP_KEEP_GT_K]],
  ];

  for (const [name, ops] of reshapeRules) {
    it(`flags ${name}`, () => {
      expect(matchPatterns(pipeline(...ops)).has(PATTERN_C4)).toBe(true);
    });
  }
});

describe("fairness matcher — known fair rules pass", () => {
  const fair: ReadonlyArray<readonly [string, readonly OpMeta[]]> = [
    ["keep then total", [OP_KEEP_EVEN, OP_SUM]],
    ["a single reorder", [OP_REVERSE]],
    ["gaps alone", [OP_DELTAS]],
    ["count the letters then total", [OP_LENGTH_MAP, OP_SUM]],
    ["double then keep the big ones", [OP_MUL_K, OP_KEEP_GT_K]],
    ["sort then keep the first few", [OP_SORT_ASC, OP_KEEP_FIRST_K]],
    ["keep the big ones then add", [OP_KEEP_GT_K, OP_ADD_K]],
    ["count letters then double", [OP_LENGTH_MAP, OP_MUL_K]],
    ["value filter, shift, position filter", [OP_KEEP_LT_K, OP_ADD_K, OP_KEEP_FIRST_K]],
    ["total of the gaps", [OP_DELTAS, OP_SUM]],
    ["subtract the smallest then total", [OP_MIN_NORMALIZE, OP_SUM]],
    ["a lone running total", [OP_RUNNING_TOTAL]],
  ];

  for (const [name, ops] of fair) {
    it(`passes ${name}`, () => {
      expect(matchPatterns(pipeline(...ops)).size).toBe(0);
    });
  }

  it("does not flag the glanceable length map as computation", () => {
    expect(matchPatterns(pipeline(OP_LENGTH_MAP, OP_SUM)).has(PATTERN_C1)).toBe(false);
  });

  it("keeps count letters then double fair, so C4 did not break the fair word puzzle", () => {
    const matched = matchPatterns(pipeline(OP_LENGTH_MAP, OP_MUL_K));
    expect(matched.has(PATTERN_C3)).toBe(false);
    expect(matched.has(PATTERN_C4)).toBe(false);
  });

  it("fires L1 only when both bracketing filters select on value, not a mixed family", () => {
    expect(matchPatterns(pipeline(OP_KEEP_LT_K, OP_ADD_K, OP_KEEP_GT_K)).has(PATTERN_L1)).toBe(true);
    expect(matchPatterns(pipeline(OP_KEEP_LT_K, OP_ADD_K, OP_KEEP_FIRST_K)).has(PATTERN_L1)).toBe(false);
  });
});

describe("fairness matcher — shift then threshold fusion (C5)", () => {
  it("rejects a shift that moves chips toward the threshold it filters on", () => {
    expect(matchPatterns(pipeline(OP_SUB_K, OP_KEEP_LT_K)).has(PATTERN_C5)).toBe(true);
    expect(matchPatterns(pipeline(OP_ADD_K, OP_KEEP_GT_K)).has(PATTERN_C5)).toBe(true);
  });

  it("permits a shift that pulls away from the threshold, staying independently readable", () => {
    expect(matchPatterns(pipeline(OP_SUB_K, OP_KEEP_GT_K)).has(PATTERN_C5)).toBe(false);
    expect(matchPatterns(pipeline(OP_ADD_K, OP_KEEP_LT_K)).has(PATTERN_C5)).toBe(false);
  });

  it("checks every consecutive position, not only the start", () => {
    expect(matchPatterns(pipeline(OP_REVERSE, OP_SUB_K, OP_KEEP_LT_K)).has(PATTERN_C5)).toBe(true);
  });
});

describe("fairness matcher — catalog coverage", () => {
  it("has a positive case asserting every catalog pattern is reachable", () => {
    const covered = new Set([
      PATTERN_L1,
      PATTERN_L2,
      PATTERN_L3,
      PATTERN_L4,
      PATTERN_C1,
      PATTERN_C2,
      PATTERN_C3,
      PATTERN_C4,
      PATTERN_C5,
      PATTERN_L5,
      PATTERN_L6,
    ]);
    expect([...ALL_PATTERNS].sort((a, b) => a.localeCompare(b)))
      .toEqual([...covered].sort((a, b) => a.localeCompare(b)));
  });
});
