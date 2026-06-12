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
export interface SlotPolicy {
  readonly maxLength: number;
  readonly ceiling: number;
  readonly requireDecoy: boolean;
}

export const SLOT_POLICIES: Readonly<Record<Difficulty, SlotPolicy>> = {
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
export function valuesEqual(a: Value, b: Value): boolean {
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
export function outputInRange(output: Value): boolean {
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
 * Checks that every candidate input has the expected list shape and, for numeric
 * pipelines, that every numeric item stays inside the allowed input range.
 * @param inputs The example and challenge inputs to inspect.
 * @param isNumeric Whether the pipeline consumes numeric lists.
 * @returns A passing result or the first input failure.
 */
function validateInputs(inputs: readonly Value[], isNumeric: boolean): ValidationResult {
  for (const input of inputs) {
    if (!Array.isArray(input)) return fail(REASON_LIST_LENGTH);
    if (input.length < MIN_LIST_LENGTH || input.length > MAX_LIST_LENGTH) return fail(REASON_LIST_LENGTH);
    if (
      isNumeric &&
      !input.every((value) => typeof value === "number" && value >= MIN_INPUT_VALUE && value <= MAX_INPUT_VALUE)
    ) {
      return fail(REASON_INPUT_RANGE);
    }
  }
  return PASS;
}

/**
 * Checks the example outputs against the output range and against their matching
 * inputs.
 * @param pipeline The composed pipeline for the candidate.
 * @param exampleInputs The example inputs used to generate the outputs.
 * @returns A passing result or the first output failure.
 */
function validateExampleOutputs(pipeline: ReturnType<typeof compose>, exampleInputs: readonly Value[]): ValidationResult {
  const exampleOutputs = exampleInputs.map((input) => execute(pipeline, input));

  for (let index = 0; index < exampleOutputs.length; index++) {
    const output = exampleOutputs[index];
    if (!outputInRange(output)) return fail(REASON_OUTPUT_RANGE);
    if (valuesEqual(output, exampleInputs[index])) return fail(REASON_OUTPUT_EQUALS_INPUT);
  }

  if (valuesEqual(exampleInputs[FIRST_EXAMPLE], exampleInputs[SECOND_EXAMPLE])) {
    return fail(REASON_DUPLICATE_EXAMPLE);
  }
  if (valuesEqual(exampleOutputs[FIRST_EXAMPLE], exampleOutputs[SECOND_EXAMPLE])) {
    return fail(REASON_EXAMPLES_SAME_OUTPUT);
  }

  return PASS;
}

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
  const inputs = [...candidate.exampleInputs, ...candidate.challengeInputs];
  const inputValidation = validateInputs(inputs, isNumeric);
  if (!inputValidation.ok) return inputValidation;

  return validateExampleOutputs(pipeline, candidate.exampleInputs);
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

/** The derived state used while checking ambiguity and discrimination. */
interface AmbiguitySnapshot {
  readonly policy: SlotPolicy;
  readonly trueFingerprint: string;
  readonly trueOutputs: readonly Value[];
  readonly evaluations: readonly Evaluation[];
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
 * Builds the shared ambiguity snapshot once so the gate can work from one derived
 * view of the candidate instead of recomputing the same pieces in place.
 * @param candidate The candidate to inspect.
 * @returns The derived ambiguity snapshot.
 */
function buildAmbiguitySnapshot(candidate: Candidate): AmbiguitySnapshot {
  const policy = SLOT_POLICIES[candidate.difficulty];
  const pipeline = compose(candidate.steps);
  const inputs = [...candidate.exampleInputs, ...candidate.challengeInputs];
  const trueOutputs = inputs.map((input) => execute(pipeline, input));

  return {
    policy,
    trueFingerprint: fingerprintOfSteps(candidate.steps),
    trueOutputs,
    evaluations: evaluateAdmissibleClasses(policy, inputs),
  };
}

/**
 * Returns the behavior class evaluations that still match the true rule at one
 * example index.
 * @param evaluations The class evaluations to filter.
 * @param trueOutputs The outputs from the candidate's true pipeline.
 * @param exampleIndex The example index to compare.
 * @returns The surviving evaluations.
 */
function survivorsAtExample(
  evaluations: readonly Evaluation[],
  trueOutputs: readonly Value[],
  exampleIndex: number,
): Evaluation[] {
  return evaluations.filter((evaluation) => valuesEqual(evaluation.outputs[exampleIndex], trueOutputs[exampleIndex]));
}

/**
 * Finds the decoy that the second example kills for a mystery slot.
 * @param survivorsAfterFirst The evaluations that survived the first example.
 * @param trueFingerprint The fingerprint of the candidate's true rule.
 * @param trueOutputs The outputs from the candidate's true pipeline.
 * @returns The trap decoy, if one exists.
 */
function findTrapDecoy(
  survivorsAfterFirst: readonly Evaluation[],
  trueFingerprint: string,
  trueOutputs: readonly Value[],
): Evaluation | undefined {
  return survivorsAfterFirst.find(
    (evaluation) => evaluation.fingerprint !== trueFingerprint && !valuesEqual(evaluation.outputs[SECOND_EXAMPLE], trueOutputs[SECOND_EXAMPLE]),
  );
}

/**
 * Derives the note text for a trap decoy when the mystery slot keeps one alive.
 * @param trapDecoy The surviving decoy.
 * @returns The note text, or undefined when the decoy cannot be resolved.
 */
function noteForTrapDecoy(trapDecoy: Evaluation | undefined): string | undefined {
  if (!trapDecoy) return undefined;
  const trapClass = behaviorClasses().get(trapDecoy.fingerprint);
  if (!trapClass) return undefined;
  return phrasePipeline(compose(trapClass.representative));
}

/**
 * Checks the mystery slot path, where a decoy must survive the first example and
 * be destroyed by the second one.
 * @param snapshot The derived ambiguity snapshot.
 * @param candidate The candidate under inspection.
 * @returns A passing result, possibly carrying a note, or the first failure.
 */
function checkMysteryAmbiguity(snapshot: AmbiguitySnapshot, candidate: Candidate): ValidationResult {
  const survivorsAfterFirst = survivorsAtExample(snapshot.evaluations, snapshot.trueOutputs, FIRST_EXAMPLE);
  const trapDecoy = findTrapDecoy(survivorsAfterFirst, snapshot.trueFingerprint, snapshot.trueOutputs);
  if (!trapDecoy) return fail(REASON_NO_DECOY);

  const survivorsAfterBoth = survivorsAtExample(survivorsAfterFirst, snapshot.trueOutputs, SECOND_EXAMPLE);
  if (survivorsAfterBoth.length < MIN_SURVIVORS_MYSTERY) return fail(REASON_NOT_AMBIGUOUS_ENOUGH);

  const decoysAfterBoth = survivorsAfterBoth.filter((evaluation) => evaluation.fingerprint !== snapshot.trueFingerprint);
  const discrimination = checkDiscrimination(decoysAfterBoth, snapshot.trueOutputs, candidate.exampleInputs.length);
  if (!discrimination.ok) return discrimination;

  const notes = noteForTrapDecoy(trapDecoy);
  return notes === undefined ? PASS : { ok: true, notes };
}

/**
 * Checks the solvable slot path, where the examples should narrow the class map
 * without leaving too many surviving theories or letting the easy slot stay vague.
 * @param snapshot The derived ambiguity snapshot.
 * @param candidate The candidate under inspection.
 * @returns A passing result or the first failure.
 */
function checkSolvableAmbiguity(snapshot: AmbiguitySnapshot, candidate: Candidate): ValidationResult {
  const survivorsAfterFirst = survivorsAtExample(snapshot.evaluations, snapshot.trueOutputs, FIRST_EXAMPLE);
  const survivorsAfterBoth = survivorsAtExample(survivorsAfterFirst, snapshot.trueOutputs, SECOND_EXAMPLE);

  if (survivorsAfterBoth.length > MAX_SURVIVORS_SOLVABLE) return fail(REASON_TOO_AMBIGUOUS);

  if (candidate.difficulty === DIFFICULTY_EASY) {
    const uniqueAndTrue =
      survivorsAfterFirst.length === UNIQUE_SURVIVOR_COUNT && survivorsAfterFirst[0].fingerprint === snapshot.trueFingerprint;
    if (!uniqueAndTrue) return fail(REASON_EASY_NOT_UNIQUE);
  }

  const decoysAfterBoth = survivorsAfterBoth.filter((evaluation) => evaluation.fingerprint !== snapshot.trueFingerprint);
  return checkDiscrimination(decoysAfterBoth, snapshot.trueOutputs, candidate.exampleInputs.length);
}

/**
 * Checks the numeric-slot ambiguity and discrimination rules from a derived
 * snapshot, returning a pass or the first named failure.
 * @param snapshot The derived ambiguity snapshot.
 * @param candidate The candidate under inspection.
 * @returns A passing result, possibly carrying a note, or the first failure.
 */
function checkAmbiguitySnapshot(snapshot: AmbiguitySnapshot, candidate: Candidate): ValidationResult {
  if (snapshot.policy.requireDecoy) {
    return checkMysteryAmbiguity(snapshot, candidate);
  }

  return checkSolvableAmbiguity(snapshot, candidate);
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
  return checkAmbiguitySnapshot(buildAmbiguitySnapshot(candidate), candidate);
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
