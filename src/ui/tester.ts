/**
 * Headless logic for Test mode, the strategic probe the player spends a small budget of tries
 * on before committing to a guess or a recipe. A test takes a chip set the player chooses and
 * shows the true output, computed by running the machine's own pipeline with the bundled
 * operation functions, so a test never touches the engine generator. A test input must look
 * like a real puzzle input and must not be one already in play, so the player cannot spend a
 * test to read off a graded answer. This module holds no view code so it can be unit tested
 * without a browser; it pairs with the test bench component that renders it.
 */

import { tokenize } from "../game/reducer";
import { applyTrail, parseChips, valueToChips } from "./palette";
import { type RuleStep, type TestResult } from "../game/types";

export { MAX_TESTS } from "../game/types";
export type { TestResult };

/** The inclusive chip count a test input may have, mirroring the puzzle input bounds. */
const MIN_CHIP_COUNT = 1;
const MAX_CHIP_COUNT = 6;

/** The inclusive value a numeric test chip may take, mirroring the puzzle input bounds. */
const MIN_NUMBER = 1;
const MAX_NUMBER = 99;

/** The longest a word test chip may be, a generous bound so any sensible word is allowed. */
const MAX_WORD_LENGTH = 12;

/** Recognizes a whole number chip token, negatives included, and one made only of letters. */
const NUMERIC_TOKEN = /^-?\d+$/;
const WORD_TOKEN = /^[a-z]+$/;

/** The separator joining chip tokens into a normalized chip string. */
const TOKEN_JOIN = " ";

/** The verdicts a candidate test input can receive, one ok and one per rejection reason. */
export const TEST_OK = "ok";
export const TEST_EMPTY = "empty";
export const TEST_LENGTH = "length";
export const TEST_NEED_NUMBERS = "need_numbers";
export const TEST_NEED_WORDS = "need_words";
export const TEST_RANGE = "range";
export const TEST_IN_PLAY = "in_play";
export const TEST_REPEAT = "repeat";
export type TestStatus =
  | typeof TEST_OK
  | typeof TEST_EMPTY
  | typeof TEST_LENGTH
  | typeof TEST_NEED_NUMBERS
  | typeof TEST_NEED_WORDS
  | typeof TEST_RANGE
  | typeof TEST_IN_PLAY
  | typeof TEST_REPEAT;

/**
 * Normalizes a chip string to the canonical form used to compare test inputs against the
 * sets already in play, lowercasing and collapsing whitespace the same way the reducer does.
 * @param raw The raw chip string.
 * @returns The normalized chip string.
 */
export function normalizeChips(raw: string): string {
  return tokenize(raw).join(TOKEN_JOIN);
}

/**
 * Reports whether a machine reads words rather than numbers, inferred from a sample of its
 * input chips so the test bench can require the matching kind of chip.
 * @param sampleInput A chip string known to be a valid input for the machine.
 * @returns True when the machine reads words.
 */
export function machineReadsWords(sampleInput: string): boolean {
  const tokens = tokenize(sampleInput);
  return tokens.length > 0 && !tokens.every((token) => NUMERIC_TOKEN.test(token));
}

/**
 * Judges a candidate test input, returning ok when it is a fresh, well formed puzzle input
 * and otherwise the first reason it is rejected. The chips must number one to six, match the
 * machine's kind, stay in numeric range, and be neither a set already in play nor one the
 * player has already tested.
 * @param raw The raw chip string the player typed.
 * @param readsWords Whether the machine reads words.
 * @param inPlay The normalized inputs already shown as examples or challenges.
 * @param alreadyTested The normalized inputs the player has already tested this machine.
 * @returns The verdict for the candidate.
 */
export function checkTestInput(
  raw: string,
  readsWords: boolean,
  inPlay: ReadonlySet<string>,
  alreadyTested: ReadonlySet<string>,
): TestStatus {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return TEST_EMPTY;
  if (tokens.length < MIN_CHIP_COUNT || tokens.length > MAX_CHIP_COUNT) return TEST_LENGTH;

  if (readsWords) {
    if (!tokens.every((token) => WORD_TOKEN.test(token) && token.length <= MAX_WORD_LENGTH)) {
      return TEST_NEED_WORDS;
    }
  } else {
    if (!tokens.every((token) => NUMERIC_TOKEN.test(token))) return TEST_NEED_NUMBERS;
    if (!tokens.every((token) => Number(token) >= MIN_NUMBER && Number(token) <= MAX_NUMBER)) {
      return TEST_RANGE;
    }
  }

  const normalized = tokens.join(TOKEN_JOIN);
  if (inPlay.has(normalized)) return TEST_IN_PLAY;
  if (alreadyTested.has(normalized)) return TEST_REPEAT;
  return TEST_OK;
}

/**
 * Runs a test by folding the machine's pipeline over the chosen chips, producing the same
 * output the machine would give. The caller guarantees the input has already been judged ok.
 * @param raw The raw chip string the player typed.
 * @param steps The machine's true pipeline steps.
 * @returns The test result pairing the normalized input with the produced output.
 */
export function runTest(raw: string, steps: readonly RuleStep[]): TestResult {
  const input = tokenize(raw).join(TOKEN_JOIN);
  const output = valueToChips(applyTrail(parseChips(input), steps)).join(TOKEN_JOIN);
  return { input, output };
}
