import { describe, expect, it } from "vitest";
import {
  checkTestInput,
  machineReadsWords,
  normalizeChips,
  runTest,
  TEST_EMPTY,
  TEST_IN_PLAY,
  TEST_LENGTH,
  TEST_NEED_NUMBERS,
  TEST_NEED_WORDS,
  TEST_OK,
  TEST_RANGE,
  TEST_REPEAT,
} from "../src/ui/tester";
import type { RuleStep } from "../src/game/types";

/**
 * These tests cover the headless Test mode logic: detecting whether a machine reads words,
 * judging a candidate test input against the puzzle input bounds and the sets already in play,
 * and running a test by folding the machine's pipeline so the output matches the engine.
 */

const NUMBER_SAMPLE = "3 4";
const WORD_SAMPLE = "cat dog";
const NO_INPUTS: ReadonlySet<string> = new Set();

const DOUBLE: readonly RuleStep[] = [{ opId: "mul_k", params: { k: 2 } }];
const SUM: readonly RuleStep[] = [{ opId: "sum", params: {} }];
const COUNT_LETTERS: readonly RuleStep[] = [{ opId: "length_map", params: {} }];

describe("machineReadsWords", () => {
  it("is false for a numeric sample and true for a word sample", () => {
    expect(machineReadsWords(NUMBER_SAMPLE)).toBe(false);
    expect(machineReadsWords(WORD_SAMPLE)).toBe(true);
  });
});

describe("checkTestInput", () => {
  it("rejects an empty draft", () => {
    expect(checkTestInput("", false, NO_INPUTS, NO_INPUTS)).toBe(TEST_EMPTY);
  });

  it("rejects too many chips", () => {
    expect(checkTestInput("1 2 3 4 5 6 7", false, NO_INPUTS, NO_INPUTS)).toBe(TEST_LENGTH);
  });

  it("requires the machine's kind of chip", () => {
    expect(checkTestInput("cat", false, NO_INPUTS, NO_INPUTS)).toBe(TEST_NEED_NUMBERS);
    expect(checkTestInput("cat 7", true, NO_INPUTS, NO_INPUTS)).toBe(TEST_NEED_WORDS);
  });

  it("rejects a number outside the puzzle range", () => {
    expect(checkTestInput("100", false, NO_INPUTS, NO_INPUTS)).toBe(TEST_RANGE);
  });

  it("rejects a set already in play and one already tested", () => {
    const inPlay = new Set([normalizeChips(NUMBER_SAMPLE)]);
    const tested = new Set([normalizeChips("5 6")]);
    expect(checkTestInput("3 4", false, inPlay, tested)).toBe(TEST_IN_PLAY);
    expect(checkTestInput("5 6", false, inPlay, tested)).toBe(TEST_REPEAT);
  });

  it("accepts a fresh, well formed input", () => {
    expect(checkTestInput("5 6", false, NO_INPUTS, NO_INPUTS)).toBe(TEST_OK);
    expect(checkTestInput("owl ant", true, NO_INPUTS, NO_INPUTS)).toBe(TEST_OK);
  });
});

describe("runTest", () => {
  it("folds the pipeline over the input the way the machine would", () => {
    expect(runTest("3 4", DOUBLE)).toEqual({ input: "3 4", output: "6 8" });
    expect(runTest("1 2 3", SUM)).toEqual({ input: "1 2 3", output: "6" });
    expect(runTest("cat horse", COUNT_LETTERS)).toEqual({ input: "cat horse", output: "3 5" });
  });
});
