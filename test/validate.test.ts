import { describe, expect, it } from "vitest";
import { step, type PipelineStep } from "../src/engine/compose";
import { generateDay } from "../src/engine/generate";
import {
  OP_ADD_K,
  OP_COUNT,
  OP_KEEP_EVEN,
  OP_REVERSE,
  OP_SORT_ASC,
  OP_SUM,
  type Value,
} from "../src/engine/ops";
import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  REASON_COLLAPSE,
  REASON_DUPLICATE_EXAMPLE,
  REASON_EASY_NOT_UNIQUE,
  REASON_EXAMPLES_SAME_OUTPUT,
  REASON_INPUT_RANGE,
  REASON_LIST_LENGTH,
  REASON_NOT_DISCRIMINATING,
  REASON_NOT_INTERESTING,
  REASON_OUTPUT_EQUALS_INPUT,
  validate,
  type Candidate,
  type Difficulty,
} from "../src/engine/validate";

/**
 * These tests cover the quality gates. The first block confirms a well formed machine
 * passes every gate. The second block drives a table of candidates that each trip one
 * gate, asserting the named reason, and it includes the three adversarial fixtures the
 * milestone requires: a pipeline that collapses onto a simpler one, an ambiguous easy
 * machine, and a machine whose challenge fails to discriminate a surviving decoy.
 */

/**
 * Builds a candidate from its parts.
 * @param steps The pipeline steps.
 * @param difficulty The difficulty slot.
 * @param exampleInputs The two example inputs.
 * @param challengeInputs The challenge inputs.
 * @returns The candidate.
 */
function candidate(
  steps: readonly PipelineStep[],
  difficulty: Difficulty,
  exampleInputs: readonly Value[],
  challengeInputs: readonly Value[],
): Candidate {
  return { steps, difficulty, exampleInputs, challengeInputs };
}

describe("validate accepts a well formed machine", () => {
  it("passes every machine the generator ships for a day", () => {
    for (const machine of generateDay("2026-06-20").machines) {
      const result = validate(
        candidate(
          machine.steps,
          machine.difficulty,
          machine.examples.map((pair) => pair.input),
          machine.challenges.map((pair) => pair.input),
        ),
      );
      expect(result.ok).toBe(true);
    }
  });
});

interface RejectionCase {
  readonly name: string;
  readonly candidate: Candidate;
  readonly reason: string;
}

const REJECTION_CASES: readonly RejectionCase[] = [
  {
    name: "an input value out of range",
    candidate: candidate([step(OP_ADD_K, { k: 1 })], DIFFICULTY_EASY, [[100, 1], [2, 3]], [[4, 5]]),
    reason: REASON_INPUT_RANGE,
  },
  {
    name: "a list that is too long",
    candidate: candidate([step(OP_ADD_K, { k: 1 })], DIFFICULTY_EASY, [[1, 2, 3, 4, 5, 6, 7], [1, 2]], [[3, 4]]),
    reason: REASON_LIST_LENGTH,
  },
  {
    name: "an output identical to the input",
    candidate: candidate([step(OP_REVERSE)], DIFFICULTY_EASY, [[1, 2, 1], [3, 1, 3]], [[2, 4, 2]]),
    reason: REASON_OUTPUT_EQUALS_INPUT,
  },
  {
    name: "two examples that produce the same output",
    candidate: candidate([step(OP_COUNT)], DIFFICULTY_MEDIUM, [[1, 2, 3], [4, 5, 6]], [[7, 8, 9]]),
    reason: REASON_EXAMPLES_SAME_OUTPUT,
  },
  {
    name: "a duplicated example input",
    candidate: candidate([step(OP_ADD_K, { k: 1 })], DIFFICULTY_EASY, [[1, 2], [1, 2]], [[3, 4]]),
    reason: REASON_DUPLICATE_EXAMPLE,
  },
  {
    name: "a filter that keeps nothing on an example",
    candidate: candidate(
      [step(OP_KEEP_EVEN), step(OP_SUM)],
      DIFFICULTY_HARD,
      [[1, 2, 3, 4], [5, 7]],
      [[2, 4]],
    ),
    reason: REASON_NOT_INTERESTING,
  },
  {
    name: "a pipeline that collapses onto a simpler one",
    candidate: candidate([step(OP_REVERSE), step(OP_SORT_ASC)], DIFFICULTY_HARD, [[3, 1, 2], [2, 5, 1]], [[4, 2, 6]]),
    reason: REASON_COLLAPSE,
  },
  {
    name: "an ambiguous easy machine",
    candidate: candidate([step(OP_ADD_K, { k: 1 })], DIFFICULTY_EASY, [[1, 1], [3, 5]], [[2, 4]]),
    reason: REASON_EASY_NOT_UNIQUE,
  },
  {
    name: "a challenge that fails to discriminate a decoy",
    candidate: candidate(
      [step(OP_KEEP_EVEN), step(OP_SUM)],
      DIFFICULTY_HARD,
      [[2, 3, 4, 1], [6, 5, 2, 7]],
      [[8, 1, 3], [4, 2, 5], [2, 9, 6]],
    ),
    reason: REASON_NOT_DISCRIMINATING,
  },
];

describe("validate rejects with a named reason", () => {
  for (const testCase of REJECTION_CASES) {
    it(`rejects ${testCase.name}`, () => {
      const result = validate(testCase.candidate);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(testCase.reason);
    });
  }
});
