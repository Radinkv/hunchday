/**
 * The quality gates that decide whether a candidate machine is fit to ship.
 *
 * The generator proposes a machine as a pipeline together with two example inputs and
 * several challenge inputs. This module decides whether that machine is a fair, clear
 * puzzle. The craft of the game lives here rather than in hoping the random draw was
 * kind. A candidate passes only when every gate passes, and the first gate to fail
 * returns a named reason so the generator can retry and the curation preview can
 * explain a rejection.
 *
 * The gates are, in order: sanity of inputs and outputs, interestingness of every
 * operation on every example, collapse onto a simpler pipeline, ambiguity of the rule
 * after the examples, and discrimination of the challenges. The collapse, ambiguity,
 * and discrimination gates reason over the precomputed behavior classes and apply only
 * to numeric machines, whose inputs are lists of numbers. Word machines, whose inputs
 * are lists of words, are checked for sanity and interestingness; their ambiguity is
 * left to the required decoy structure and the human curation pass.
 */

import { compose, execute, type PipelineStep } from "./compose";
import { getOp, TYPE_NUM_LIST, type Value } from "./ops";
import { phrasePipeline } from "./phrase";
import { behaviorClasses, complexityOf, fingerprintOfSteps, isStrictlySimpler } from "./universe";

export const DIFFICULTY_EASY = "easy";
export const DIFFICULTY_MEDIUM = "medium";
export const DIFFICULTY_HARD = "hard";
export const DIFFICULTY_MYSTERY = "mystery";

/** The difficulty slot a candidate is generated for. */
export type Difficulty =
  | typeof DIFFICULTY_EASY
  | typeof DIFFICULTY_MEDIUM
  | typeof DIFFICULTY_HARD
  | typeof DIFFICULTY_MYSTERY;

/** A candidate machine awaiting validation. */
export interface Candidate {
  readonly steps: readonly PipelineStep[];
  readonly difficulty: Difficulty;
  readonly exampleInputs: readonly Value[];
  readonly challengeInputs: readonly Value[];
}

/** The outcome of validation: ok, or a named reason for the first failure. */
export interface ValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly notes?: string;
}

export const REASON_EXAMPLE_COUNT = "example_count";
export const REASON_INPUT_RANGE = "input_range";
export const REASON_LIST_LENGTH = "list_length";
export const REASON_OUTPUT_RANGE = "output_range";
export const REASON_OUTPUT_EQUALS_INPUT = "output_equals_input";
export const REASON_DUPLICATE_EXAMPLE = "duplicate_example";
export const REASON_EXAMPLES_SAME_OUTPUT = "examples_same_output";
export const REASON_NOT_INTERESTING = "not_interesting";
export const REASON_COLLAPSE = "collapse";
export const REASON_TOO_AMBIGUOUS = "too_ambiguous";
export const REASON_EASY_NOT_UNIQUE = "easy_not_unique";
export const REASON_NO_DECOY = "no_decoy";
export const REASON_NOT_AMBIGUOUS_ENOUGH = "not_ambiguous_enough";
export const REASON_NOT_DISCRIMINATING = "not_discriminating";

/** The number of example pairs a candidate must carry. */
const EXAMPLE_COUNT = 2;

/** The inclusive range a puzzle input value may take, one to two digit and positive. */
const MIN_INPUT_VALUE = 1;
const MAX_INPUT_VALUE = 99;

/** The inclusive length a chip list may take. */
const MIN_LIST_LENGTH = 1;
const MAX_LIST_LENGTH = 6;

/** The inclusive range a numeric output value may take. */
const MIN_OUTPUT_VALUE = 0;
const MAX_OUTPUT_VALUE = 99;

/** The largest number of surviving theories a solvable slot may leave after examples. */
const MAX_SURVIVORS_SOLVABLE = 2;

/** The smallest number of survivors a mystery slot needs so a clue is required. */
const MIN_SURVIVORS_MYSTERY = 2;

/** The index of the first example, used when reading the example outputs. */
const FIRST_EXAMPLE = 0;
const SECOND_EXAMPLE = 1;

/** A unique survivor count, used by the easy slot smell test. */
const UNIQUE_SURVIVOR_COUNT = 1;

/** How a slot bounds the theories a player would consider, and whether it needs a decoy. */
interface SlotPolicy {
  readonly maxLength: number;
  readonly ceiling: number;
  readonly requireDecoy: boolean;
}

const SLOT_POLICIES: Readonly<Record<Difficulty, SlotPolicy>> = {
  [DIFFICULTY_EASY]: { maxLength: 1, ceiling: 2, requireDecoy: false },
  [DIFFICULTY_MEDIUM]: { maxLength: 1, ceiling: 3, requireDecoy: false },
  [DIFFICULTY_HARD]: { maxLength: 2, ceiling: 4, requireDecoy: false },
  [DIFFICULTY_MYSTERY]: { maxLength: 3, ceiling: 5, requireDecoy: true },
};

/**
 * Reports whether two values are equal, comparing lists element by element.
 * @param a The first value.
 * @param b The second value.
 * @returns True when the values are equal.
 */
function valuesEqual(a: Value, b: Value): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/**
 * Reports whether an output is within the allowed numeric range, ignoring word
 * outputs, which carry no numeric range.
 * @param output The output to check.
 * @returns True when every numeric part of the output is in range.
 */
function outputInRange(output: Value): boolean {
  if (typeof output === "number") return output >= MIN_OUTPUT_VALUE && output <= MAX_OUTPUT_VALUE;
  if (Array.isArray(output)) {
    return output.every(
      (item) => typeof item !== "number" || (item >= MIN_OUTPUT_VALUE && item <= MAX_OUTPUT_VALUE),
    );
  }
  return true;
}

/**
 * Produces a failing result with the given reason.
 * @param reason The named reason for the failure.
 * @returns The failing result.
 */
function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

/** A passing result with no reason. */
const PASS: ValidationResult = { ok: true };

/**
 * Checks the sanity gate: inputs in range and the right lengths, outputs in range and
 * never identical to the input, distinct examples, and examples with differing outputs.
 * @param candidate The candidate to check.
 * @returns A passing result or the first sanity failure.
 */
function checkSanity(candidate: Candidate): ValidationResult {
  if (candidate.exampleInputs.length !== EXAMPLE_COUNT) return fail(REASON_EXAMPLE_COUNT);

  const pipeline = compose(candidate.steps);
  const isNumeric = pipeline.inputType === TYPE_NUM_LIST;

  for (const input of [...candidate.exampleInputs, ...candidate.challengeInputs]) {
    if (!Array.isArray(input)) return fail(REASON_LIST_LENGTH);
    if (input.length < MIN_LIST_LENGTH || input.length > MAX_LIST_LENGTH) return fail(REASON_LIST_LENGTH);
    if (isNumeric) {
      const list = input as number[];
      if (!list.every((value) => value >= MIN_INPUT_VALUE && value <= MAX_INPUT_VALUE)) {
        return fail(REASON_INPUT_RANGE);
      }
    }
  }

  const exampleOutputs = candidate.exampleInputs.map((input) => execute(pipeline, input));
  for (let index = 0; index < exampleOutputs.length; index++) {
    const output = exampleOutputs[index];
    if (!outputInRange(output)) return fail(REASON_OUTPUT_RANGE);
    if (valuesEqual(output, candidate.exampleInputs[index])) return fail(REASON_OUTPUT_EQUALS_INPUT);
  }

  if (valuesEqual(candidate.exampleInputs[FIRST_EXAMPLE], candidate.exampleInputs[SECOND_EXAMPLE])) {
    return fail(REASON_DUPLICATE_EXAMPLE);
  }
  if (valuesEqual(exampleOutputs[FIRST_EXAMPLE], exampleOutputs[SECOND_EXAMPLE])) {
    return fail(REASON_EXAMPLES_SAME_OUTPUT);
  }

  return PASS;
}

/**
 * Checks the interestingness gate: every operation must satisfy its predicate on the
 * value that actually reaches it for each example.
 * @param candidate The candidate to check.
 * @returns A passing result or the interestingness failure.
 */
function checkInterestingness(candidate: Candidate): ValidationResult {
  for (const input of candidate.exampleInputs) {
    let value = input;
    for (const pipelineStep of candidate.steps) {
      const op = getOp(pipelineStep.opId);
      if (!op.isInteresting(value, pipelineStep.params)) return fail(REASON_NOT_INTERESTING);
      value = op.apply(value, pipelineStep.params);
    }
  }
  return PASS;
}

/**
 * Checks the collapse gate: the candidate must not behave identically to a strictly
 * simpler pipeline.
 * @param candidate The candidate to check.
 * @returns A passing result or the collapse failure.
 */
function checkCollapse(candidate: Candidate): ValidationResult {
  const behaviorClass = behaviorClasses().get(fingerprintOfSteps(candidate.steps));
  if (behaviorClass && isStrictlySimpler(behaviorClass, complexityOf(candidate.steps))) {
    return fail(REASON_COLLAPSE);
  }
  return PASS;
}

/** A behavior class evaluated on a candidate's inputs. */
interface Evaluation {
  readonly fingerprint: string;
  readonly outputs: readonly Value[];
}

/**
 * Evaluates every behavior class admissible for the slot on the given inputs, so that
 * survival and discrimination can be read from the outputs without re-running anything.
 * @param policy The slot policy bounding which classes a player would consider.
 * @param inputs The inputs to evaluate, the examples followed by the challenges.
 * @returns One evaluation per admissible class.
 */
function evaluateAdmissibleClasses(policy: SlotPolicy, inputs: readonly Value[]): Evaluation[] {
  const evaluations: Evaluation[] = [];
  for (const [classFingerprint, behaviorClass] of behaviorClasses()) {
    if (behaviorClass.length > policy.maxLength || behaviorClass.maxRung > policy.ceiling) continue;
    const pipeline = compose(behaviorClass.representative);
    evaluations.push({
      fingerprint: classFingerprint,
      outputs: inputs.map((input) => execute(pipeline, input)),
    });
  }
  return evaluations;
}

/**
 * Checks the ambiguity and discrimination gates for a numeric candidate. A solvable
 * slot must leave at most two surviving theories after the examples, and the easy slot
 * must be uniquely determined by the first example alone. A mystery slot must leave a
 * trap decoy that the second example kills and must stay ambiguous after both examples.
 * In every case each surviving decoy must give a different answer from the true rule on
 * every challenge.
 * @param candidate The numeric candidate to check.
 * @returns A passing result, possibly carrying a decoy note, or the first failure.
 */
function checkAmbiguity(candidate: Candidate): ValidationResult {
  const policy = SLOT_POLICIES[candidate.difficulty];
  const pipeline = compose(candidate.steps);
  const trueFingerprint = fingerprintOfSteps(candidate.steps);

  const inputs = [...candidate.exampleInputs, ...candidate.challengeInputs];
  const trueOutputs = inputs.map((input) => execute(pipeline, input));
  const evaluations = evaluateAdmissibleClasses(policy, inputs);

  const reproduces = (evaluation: Evaluation, exampleIndex: number): boolean =>
    valuesEqual(evaluation.outputs[exampleIndex], trueOutputs[exampleIndex]);

  const survivorsAfterFirst = evaluations.filter((evaluation) => reproduces(evaluation, FIRST_EXAMPLE));
  const survivorsAfterBoth = survivorsAfterFirst.filter((evaluation) => reproduces(evaluation, SECOND_EXAMPLE));
  const decoysAfterBoth = survivorsAfterBoth.filter((evaluation) => evaluation.fingerprint !== trueFingerprint);

  let notes: string | undefined;

  if (policy.requireDecoy) {
    const trapDecoy = survivorsAfterFirst.find(
      (evaluation) => evaluation.fingerprint !== trueFingerprint && !reproduces(evaluation, SECOND_EXAMPLE),
    );
    if (!trapDecoy) return fail(REASON_NO_DECOY);
    if (survivorsAfterBoth.length < MIN_SURVIVORS_MYSTERY) return fail(REASON_NOT_AMBIGUOUS_ENOUGH);
    const trapClass = behaviorClasses().get(trapDecoy.fingerprint);
    if (trapClass) notes = phrasePipeline(compose(trapClass.representative));
  } else {
    if (survivorsAfterBoth.length > MAX_SURVIVORS_SOLVABLE) return fail(REASON_TOO_AMBIGUOUS);
    if (candidate.difficulty === DIFFICULTY_EASY) {
      const uniqueAndTrue =
        survivorsAfterFirst.length === UNIQUE_SURVIVOR_COUNT &&
        survivorsAfterFirst[0].fingerprint === trueFingerprint;
      if (!uniqueAndTrue) return fail(REASON_EASY_NOT_UNIQUE);
    }
  }

  const discrimination = checkDiscrimination(decoysAfterBoth, trueOutputs, candidate.exampleInputs.length);
  if (!discrimination.ok) return discrimination;

  return notes === undefined ? PASS : { ok: true, notes };
}

/**
 * Checks that every surviving decoy gives a different answer from the true rule on
 * every challenge, so that any correct prediction proves understanding.
 * @param decoys The surviving decoys after both examples.
 * @param trueOutputs The true outputs over the examples followed by the challenges.
 * @param challengeStart The index in the outputs where the challenges begin.
 * @returns A passing result or the discrimination failure.
 */
function checkDiscrimination(
  decoys: readonly Evaluation[],
  trueOutputs: readonly Value[],
  challengeStart: number,
): ValidationResult {
  for (const decoy of decoys) {
    for (let index = challengeStart; index < trueOutputs.length; index++) {
      if (valuesEqual(decoy.outputs[index], trueOutputs[index])) return fail(REASON_NOT_DISCRIMINATING);
    }
  }
  return PASS;
}

/**
 * Runs every quality gate against a candidate and returns the first failure or a pass.
 * The collapse, ambiguity, and discrimination gates run only for numeric candidates.
 * @param candidate The candidate machine to validate.
 * @returns The validation result.
 */
export function validate(candidate: Candidate): ValidationResult {
  const sanity = checkSanity(candidate);
  if (!sanity.ok) return sanity;

  const interestingness = checkInterestingness(candidate);
  if (!interestingness.ok) return interestingness;

  const pipeline = compose(candidate.steps);
  if (pipeline.inputType !== TYPE_NUM_LIST) return PASS;

  const collapse = checkCollapse(candidate);
  if (!collapse.ok) return collapse;

  return checkAmbiguity(candidate);
}
