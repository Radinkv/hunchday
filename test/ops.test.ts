import { describe, expect, it } from "vitest";
import {
  getOp,
  REGISTRY,
  TYPE_NUM,
  TYPE_NUM_LIST,
  TYPE_WORD,
  TYPE_WORD_LIST,
  OP_ADD_K,
  OP_AFFINE,
  OP_COUNT,
  OP_COUNT_DISTINCT,
  OP_COUNT_EVEN,
  OP_DEDUP,
  OP_DELTAS,
  OP_DIGIT_SUM_MAP,
  OP_DISTINCT_LETTERS_MAP,
  OP_DROP_FIRST,
  OP_DROP_LAST,
  OP_EVERY_OTHER,
  OP_FIRST,
  OP_FIRST_LETTER_POS,
  OP_INDEX_OF_MAX,
  OP_KEEP_DUPS,
  OP_KEEP_EVEN,
  OP_KEEP_FIRST_K,
  OP_KEEP_GT_FIRST,
  OP_KEEP_GT_K,
  OP_KEEP_LAST_K,
  OP_KEEP_LT_K,
  OP_KEEP_ODD,
  OP_KEEP_STARTSWITH_VOWEL,
  OP_LAST,
  OP_LAST_LETTER_POS,
  OP_LENGTH_MAP,
  OP_LETTER_COUNT_SQUARED,
  OP_LONGEST,
  OP_MAX,
  OP_MEDIAN,
  OP_MIN,
  OP_MIN_NORMALIZE,
  OP_MODE,
  OP_MUL_K,
  OP_PRODUCT,
  OP_RANGE,
  OP_REVERSE,
  OP_REVERSE_DIGITS,
  OP_ROTATE_LEFT,
  OP_RUNNING_TOTAL,
  OP_SECOND_LARGEST,
  OP_SHORTEST,
  OP_SORT_ALPHA,
  OP_SORT_ASC,
  OP_SORT_BY_LENGTH,
  OP_SORT_DESC,
  OP_SUB_K,
  OP_SUM,
  OP_SWAP_ENDS,
  OP_UNITS_DIGIT,
  OP_VOWEL_COUNT_MAP,
  type OpDef,
  type OpMeta,
  type Params,
  type Value,
  type ValueType,
} from "../src/engine/ops";

/**
 * These tests exercise every operation in the registry. For each operation they pin
 * the function output on a representative input, confirm the interestingness predicate
 * accepts an interesting input and rejects a boring one, and check that the phrase
 * renders with any parameters substituted. A registry wide block then asserts the
 * structural promises every operation must keep: a unique identifier, a rung in range,
 * sane parameter ranges, and an output whose runtime shape matches its declared type.
 * Cases refer to operations through the same grouped descriptors the registry uses, so
 * an operation's identity, its phrase, and the tests stay in agreement.
 */

const LOWEST_RUNG = 1;
const HIGHEST_RUNG = 5;

/** A valid sample input for each input type, used for the output type check. */
const SAMPLE_INPUT: Record<ValueType, Value> = {
  [TYPE_NUM_LIST]: [4, 1, 5, 9, 3, 4],
  [TYPE_WORD_LIST]: ["apple", "fig", "kiwi", "ox"],
  [TYPE_NUM]: 7,
  [TYPE_WORD]: "apple",
};

/**
 * Builds a parameter set at the midpoint of each declared range.
 * @param op The operation whose parameters are sampled.
 * @returns A parameter set within the declared ranges.
 */
function midParams(op: OpDef): Params {
  const params: Record<string, number> = {};
  for (const spec of op.params) {
    params[spec.name] = Math.floor((spec.min + spec.max) / 2);
  }
  return params;
}

/**
 * Reports whether a runtime value matches a declared value type.
 * @param value The value produced by an operation.
 * @param type The declared output type.
 * @returns True when the runtime shape matches the type.
 */
function matchesType(value: Value, type: ValueType): boolean {
  switch (type) {
    case TYPE_NUM_LIST:
      return Array.isArray(value) && value.every((item) => typeof item === "number");
    case TYPE_WORD_LIST:
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case TYPE_NUM:
      return typeof value === "number";
    case TYPE_WORD:
      return typeof value === "string";
  }
}

interface FnCase {
  readonly op: OpMeta;
  readonly input: Value;
  readonly params?: Params;
  readonly expected: Value;
}

const FN_CASES: readonly FnCase[] = [
  { op: OP_ADD_K, input: [1, 2, 3], params: { k: 2 }, expected: [3, 4, 5] },
  { op: OP_SUB_K, input: [3, 4, 5], params: { k: 1 }, expected: [2, 3, 4] },
  { op: OP_MUL_K, input: [1, 2, 3], params: { k: 3 }, expected: [3, 6, 9] },
  { op: OP_AFFINE, input: [1, 2, 3], params: { a: 2, b: 1 }, expected: [3, 5, 7] },
  { op: OP_REVERSE_DIGITS, input: [23, 10, 5], expected: [32, 1, 5] },
  { op: OP_DIGIT_SUM_MAP, input: [23, 19, 5], expected: [5, 10, 5] },
  { op: OP_REVERSE, input: [1, 2, 3], expected: [3, 2, 1] },
  { op: OP_SORT_ASC, input: [3, 1, 2], expected: [1, 2, 3] },
  { op: OP_SORT_DESC, input: [1, 3, 2], expected: [3, 2, 1] },
  { op: OP_SWAP_ENDS, input: [1, 2, 3, 4], expected: [4, 2, 3, 1] },
  { op: OP_ROTATE_LEFT, input: [1, 2, 3], expected: [2, 3, 1] },
  { op: OP_SUM, input: [3, 1], expected: 4 },
  { op: OP_COUNT, input: [4, 4, 4], expected: 3 },
  { op: OP_MAX, input: [3, 9, 1], expected: 9 },
  { op: OP_MIN, input: [3, 9, 1], expected: 1 },
  { op: OP_RANGE, input: [3, 9, 1], expected: 8 },
  { op: OP_PRODUCT, input: [2, 3, 4], expected: 24 },
  { op: OP_FIRST, input: [5, 6, 7], expected: 5 },
  { op: OP_LAST, input: [5, 6, 7], expected: 7 },
  { op: OP_MEDIAN, input: [3, 1, 2], expected: 2 },
  { op: OP_MODE, input: [4, 4, 1], expected: 4 },
  { op: OP_KEEP_EVEN, input: [1, 2, 3, 4], expected: [2, 4] },
  { op: OP_KEEP_ODD, input: [1, 2, 3, 4], expected: [1, 3] },
  { op: OP_KEEP_GT_K, input: [1, 4, 5, 2], params: { k: 3 }, expected: [4, 5] },
  { op: OP_KEEP_LT_K, input: [1, 4, 5, 2], params: { k: 3 }, expected: [1, 2] },
  { op: OP_DEDUP, input: [3, 1, 3, 2], expected: [3, 1, 2] },
  { op: OP_KEEP_DUPS, input: [3, 1, 3, 2], expected: [3, 3] },
  { op: OP_DROP_FIRST, input: [1, 2, 3], expected: [2, 3] },
  { op: OP_DROP_LAST, input: [1, 2, 3], expected: [1, 2] },
  { op: OP_EVERY_OTHER, input: [1, 2, 3, 4, 5], expected: [1, 3, 5] },
  { op: OP_KEEP_GT_FIRST, input: [3, 5, 1, 4], expected: [5, 4] },
  { op: OP_INDEX_OF_MAX, input: [3, 9, 1], expected: 2 },
  { op: OP_DELTAS, input: [1, 4, 2], expected: [3, 2] },
  { op: OP_COUNT_DISTINCT, input: [4, 4, 1], expected: 2 },
  { op: OP_LENGTH_MAP, input: ["cat", "house"], expected: [3, 5] },
  { op: OP_VOWEL_COUNT_MAP, input: ["cat", "queue"], expected: [1, 4] },
  { op: OP_FIRST_LETTER_POS, input: ["cat", "dog"], expected: [3, 4] },
  { op: OP_SORT_ALPHA, input: ["dog", "cat", "ant"], expected: ["ant", "cat", "dog"] },
  { op: OP_LONGEST, input: ["cat", "house", "ox"], expected: "house" },
  { op: OP_KEEP_STARTSWITH_VOWEL, input: ["apple", "cat", "egg"], expected: ["apple", "egg"] },
  { op: OP_UNITS_DIGIT, input: [23, 10, 5], expected: [3, 0, 5] },
  { op: OP_MIN_NORMALIZE, input: [5, 3, 9], expected: [2, 0, 6] },
  { op: OP_RUNNING_TOTAL, input: [1, 2, 3], expected: [1, 3, 6] },
  { op: OP_SECOND_LARGEST, input: [3, 9, 1], expected: 3 },
  { op: OP_COUNT_EVEN, input: [1, 2, 3, 4], expected: 2 },
  { op: OP_LETTER_COUNT_SQUARED, input: ["cat", "house"], expected: [9, 25] },
  { op: OP_DISTINCT_LETTERS_MAP, input: ["egg", "cat"], expected: [2, 3] },
  { op: OP_LAST_LETTER_POS, input: ["cat", "dog"], expected: [20, 7] },
  { op: OP_SORT_BY_LENGTH, input: ["house", "ox", "cat"], expected: ["ox", "cat", "house"] },
  { op: OP_SHORTEST, input: ["cat", "house", "ox"], expected: "ox" },
  { op: OP_KEEP_FIRST_K, input: [1, 2, 3, 4, 5], params: { k: 2 }, expected: [1, 2] },
  { op: OP_KEEP_LAST_K, input: [1, 2, 3, 4, 5], params: { k: 2 }, expected: [4, 5] },
];

interface PredicateCase {
  readonly op: OpMeta;
  readonly input: Value;
  readonly params?: Params;
  readonly interesting: boolean;
}

const PREDICATE_CASES: readonly PredicateCase[] = [
  { op: OP_KEEP_EVEN, input: [1, 2], interesting: true },
  { op: OP_KEEP_EVEN, input: [2, 4], interesting: false },
  { op: OP_KEEP_ODD, input: [1, 2], interesting: true },
  { op: OP_KEEP_ODD, input: [2, 4], interesting: false },
  { op: OP_KEEP_GT_K, input: [1, 5], params: { k: 3 }, interesting: true },
  { op: OP_KEEP_GT_K, input: [1, 2], params: { k: 3 }, interesting: false },
  { op: OP_KEEP_LT_K, input: [1, 5], params: { k: 3 }, interesting: true },
  { op: OP_KEEP_LT_K, input: [5, 6], params: { k: 3 }, interesting: false },
  { op: OP_MEDIAN, input: [1, 2, 3], interesting: true },
  { op: OP_MEDIAN, input: [1, 2], interesting: false },
  { op: OP_DELTAS, input: [1, 2, 3], interesting: true },
  { op: OP_DELTAS, input: [1, 2], interesting: false },
  { op: OP_MODE, input: [4, 4, 1], interesting: true },
  { op: OP_MODE, input: [1, 2, 3], interesting: false },
  { op: OP_MODE, input: [4, 4, 1, 1], interesting: false },
  { op: OP_PRODUCT, input: [2, 3], interesting: true },
  { op: OP_PRODUCT, input: [2, 3, 4, 5], interesting: false },
  { op: OP_PRODUCT, input: [2, 6], interesting: false },
  { op: OP_SWAP_ENDS, input: [1, 2, 3], interesting: true },
  { op: OP_SWAP_ENDS, input: [5, 5], interesting: false },
  { op: OP_ROTATE_LEFT, input: [1, 2, 3], interesting: true },
  { op: OP_ROTATE_LEFT, input: [2, 2, 2], interesting: false },
  { op: OP_REVERSE, input: [1, 2, 3], interesting: true },
  { op: OP_REVERSE, input: [1, 2, 1], interesting: false },
  { op: OP_SORT_ASC, input: [3, 1, 2], interesting: true },
  { op: OP_SORT_ASC, input: [1, 2, 3], interesting: false },
  { op: OP_RANGE, input: [3, 9], interesting: true },
  { op: OP_RANGE, input: [5, 5], interesting: false },
  { op: OP_DEDUP, input: [1, 1, 2], interesting: true },
  { op: OP_DEDUP, input: [1, 2, 3], interesting: false },
  { op: OP_COUNT_DISTINCT, input: [1, 1, 2], interesting: true },
  { op: OP_COUNT_DISTINCT, input: [1, 2, 3], interesting: false },
  { op: OP_KEEP_GT_FIRST, input: [3, 5, 1], interesting: true },
  { op: OP_KEEP_GT_FIRST, input: [9, 1, 2], interesting: false },
  { op: OP_INDEX_OF_MAX, input: [3, 9, 1], interesting: true },
  { op: OP_INDEX_OF_MAX, input: [9, 9, 1], interesting: false },
  { op: OP_EVERY_OTHER, input: [1, 2, 3], interesting: true },
  { op: OP_EVERY_OTHER, input: [1, 2], interesting: false },
  { op: OP_FIRST, input: [1, 2], interesting: true },
  { op: OP_FIRST, input: [5], interesting: false },
  { op: OP_REVERSE_DIGITS, input: [23, 10], interesting: true },
  { op: OP_REVERSE_DIGITS, input: [5, 5], interesting: false },
  { op: OP_DIGIT_SUM_MAP, input: [23], interesting: true },
  { op: OP_DIGIT_SUM_MAP, input: [5], interesting: false },
  { op: OP_LONGEST, input: ["cat", "house"], interesting: true },
  { op: OP_LONGEST, input: ["cat", "dog"], interesting: false },
  { op: OP_KEEP_STARTSWITH_VOWEL, input: ["apple", "cat"], interesting: true },
  { op: OP_KEEP_STARTSWITH_VOWEL, input: ["cat", "dog"], interesting: false },
  { op: OP_UNITS_DIGIT, input: [23, 5], interesting: true },
  { op: OP_UNITS_DIGIT, input: [5, 3], interesting: false },
  { op: OP_MIN_NORMALIZE, input: [5, 3], interesting: true },
  { op: OP_MIN_NORMALIZE, input: [4, 4], interesting: false },
  { op: OP_RUNNING_TOTAL, input: [1, 2], interesting: true },
  { op: OP_RUNNING_TOTAL, input: [5], interesting: false },
  { op: OP_SECOND_LARGEST, input: [3, 9], interesting: true },
  { op: OP_SECOND_LARGEST, input: [5], interesting: false },
  { op: OP_COUNT_EVEN, input: [1, 2], interesting: true },
  { op: OP_COUNT_EVEN, input: [2, 4], interesting: false },
  { op: OP_COUNT_EVEN, input: [1, 3], interesting: false },
  { op: OP_LETTER_COUNT_SQUARED, input: ["cat", "house"], interesting: true },
  { op: OP_LETTER_COUNT_SQUARED, input: ["cat", "dog"], interesting: false },
  { op: OP_DISTINCT_LETTERS_MAP, input: ["egg", "cat"], interesting: true },
  { op: OP_DISTINCT_LETTERS_MAP, input: ["cat", "dog"], interesting: false },
  { op: OP_LAST_LETTER_POS, input: ["cat", "dog"], interesting: true },
  { op: OP_LAST_LETTER_POS, input: ["cat", "hat"], interesting: false },
  { op: OP_SORT_BY_LENGTH, input: ["house", "ox"], interesting: true },
  { op: OP_SORT_BY_LENGTH, input: ["ox", "cat"], interesting: false },
  { op: OP_SHORTEST, input: ["cat", "ox"], interesting: true },
  { op: OP_SHORTEST, input: ["cat", "dog"], interesting: false },
  { op: OP_KEEP_FIRST_K, input: [1, 2, 3], params: { k: 2 }, interesting: true },
  { op: OP_KEEP_FIRST_K, input: [1, 2], params: { k: 2 }, interesting: false },
  { op: OP_KEEP_LAST_K, input: [1, 2, 3], params: { k: 2 }, interesting: true },
  { op: OP_KEEP_LAST_K, input: [1, 2], params: { k: 2 }, interesting: false },
];

interface PhraseCase {
  readonly op: OpMeta;
  readonly params?: Params;
  readonly expected: string;
}

const PHRASE_CASES: readonly PhraseCase[] = [
  { op: OP_ADD_K, params: { k: 3 }, expected: "adds 3 to every chip" },
  { op: OP_SUB_K, params: { k: 2 }, expected: "takes 2 away from every chip" },
  { op: OP_MUL_K, params: { k: 2 }, expected: "multiplies every chip by 2" },
  { op: OP_AFFINE, params: { a: 2, b: 1 }, expected: "multiplies every chip by 2, then adds 1" },
  { op: OP_KEEP_GT_K, params: { k: 5 }, expected: "keeps only chips bigger than 5" },
  { op: OP_KEEP_LT_K, params: { k: 5 }, expected: "keeps only chips smaller than 5" },
  { op: OP_REVERSE, expected: "reverses the order" },
  { op: OP_LONGEST, expected: "keeps the chip with the most letters" },
  { op: OP_KEEP_FIRST_K, params: { k: 2 }, expected: "keeps only the first 2 chips" },
  { op: OP_KEEP_LAST_K, params: { k: 3 }, expected: "keeps only the last 3 chips" },
];

describe("registry structure", () => {
  it("gives every operation a unique identifier", () => {
    const ids = REGISTRY.map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns every operation a rung within range", () => {
    for (const op of REGISTRY) {
      expect(op.rung).toBeGreaterThanOrEqual(LOWEST_RUNG);
      expect(op.rung).toBeLessThanOrEqual(HIGHEST_RUNG);
    }
  });

  it("declares sane parameter ranges", () => {
    for (const op of REGISTRY) {
      for (const spec of op.params) {
        expect(spec.min).toBeLessThanOrEqual(spec.max);
      }
    }
  });

  it("produces an output whose shape matches the declared output type", () => {
    for (const op of REGISTRY) {
      const output = op.apply(SAMPLE_INPUT[op.inputType], midParams(op));
      expect(matchesType(output, op.outputType)).toBe(true);
    }
  });

  it("renders a non empty phrase for every operation", () => {
    for (const op of REGISTRY) {
      expect(op.phrase(midParams(op)).length).toBeGreaterThan(0);
    }
  });
});

describe("operation functions", () => {
  it("covers every operation in the registry", () => {
    const tested = new Set(FN_CASES.map((testCase) => testCase.op.id));
    expect(tested.size).toBe(REGISTRY.length);
  });

  for (const testCase of FN_CASES) {
    it(`computes ${testCase.op.id}`, () => {
      expect(getOp(testCase.op.id).apply(testCase.input, testCase.params ?? {})).toEqual(testCase.expected);
    });
  }
});

describe("operation predicates", () => {
  for (const testCase of PREDICATE_CASES) {
    const label = testCase.interesting ? "accepts" : "rejects";
    it(`${testCase.op.id} ${label} ${JSON.stringify(testCase.input)}`, () => {
      expect(getOp(testCase.op.id).isInteresting(testCase.input, testCase.params ?? {})).toBe(
        testCase.interesting,
      );
    });
  }
});

describe("operation phrases", () => {
  for (const testCase of PHRASE_CASES) {
    it(`renders ${testCase.op.id}`, () => {
      expect(getOp(testCase.op.id).phrase(testCase.params ?? {})).toBe(testCase.expected);
    });
  }
});
