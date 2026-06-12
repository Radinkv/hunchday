/**
 * The deterministic daily generator.
 *
 * The puzzle for a date is a pure function of that date. There is no database and no
 * server: generateDay turns a date string into a day specification of four machines,
 * one per difficulty slot, and the same date always yields the same specification on
 * every device. A hand authored override for a date wins outright, which is how launch
 * week stays hand written and how any bad generated day is hot fixed.
 *
 * Each slot is filled from the precomputed behavior classes. The true pipeline is
 * drawn from the class representatives, which are the simplest member of their class,
 * so a generated machine never collapses onto a simpler one. For the solvable slots
 * the example inputs are chosen so that the true rule is uniquely pinned among the
 * theories a player would consider, which makes the ambiguity and discrimination gates
 * pass by construction rather than by luck. The mystery slot is filled with a word
 * machine, whose validation needs only sanity and interestingness; generating a
 * numeric mystery with a deliberate decoy trap is left as a later addition.
 *
 * Repeat suppression rejects a pipeline whose signature appeared in the shipped puzzle
 * of any of the previous thirteen days, looking back no earlier than the launch date.
 * Those previous days are generated the same way and cached, so the lookback is bounded
 * and needs no stored history beyond the cache. When a slot cannot be filled the
 * generator reseeds with the next nonce and tries again, so every client walks the same
 * retry path to the same puzzle.
 */

import { compose, execute, step, type Pipeline, type PipelineStep } from "./compose";
import { createRng, hash32, type Rng } from "./rng";
import { ALL_LEXICON_NAMES, getLexicon, type LexiconName } from "./lexicon";
import {
  getOp,
  OP_AFFINE,
  OP_COUNT_DISTINCT,
  OP_FIRST_LETTER_POS,
  OP_KEEP_STARTSWITH_VOWEL,
  OP_LENGTH_MAP,
  OP_LONGEST,
  OP_MAX,
  OP_MIN,
  OP_RANGE,
  OP_SORT_ALPHA,
  OP_SUM,
  OP_VOWEL_COUNT_MAP,
  type OpMeta,
  type Value,
} from "./ops";
import { phrasePipeline } from "./phrase";
import { behaviorClasses, fingerprintOfSteps, type BehaviorClass } from "./universe";
import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_MYSTERY,
  outputInRange,
  SLOT_POLICIES,
  validate,
  valuesEqual,
  type Candidate,
  type Difficulty,
} from "./validate";

/** One input and the output the machine produces for it. */
export interface IoPair {
  readonly input: Value;
  readonly output: Value;
}

/** One machine of a day: its pipeline, reveal sentence, examples, and challenges. */
export interface DayMachine {
  readonly difficulty: Difficulty;
  readonly steps: readonly PipelineStep[];
  readonly rule: string;
  readonly examples: readonly IoPair[];
  readonly challenges: readonly IoPair[];
  readonly notes?: string;
}

/** The four machines generated for a date. */
export interface DaySpec {
  readonly date: string;
  readonly machines: readonly DayMachine[];
}

/** The salt that fixes this generator version. Changing it changes every puzzle. */
const GENERATOR_SALT = "hunchday-v1";

/** The slots of a day, in the order they are shown. */
const DIFFICULTY_ORDER: readonly Difficulty[] = [
  DIFFICULTY_EASY,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_HARD,
  DIFFICULTY_MYSTERY,
];

const EXAMPLE_COUNT = 2;
const CHALLENGE_COUNT = 5;

/** The number of valid inputs gathered before selecting examples and challenges. */
const INPUT_POOL_SIZE = 28;

/** The largest number of input draws made while gathering a pool. */
const MAX_INPUT_DRAWS = 240;

/** The largest nonce a slot may reach before generation is considered deadlocked. */
const MAX_SLOT_NONCE = 96;

/** The no repeat window in days, so a pipeline must differ from the previous thirteen. */
const REPEAT_WINDOW = 14;

const MIN_DRAW_LENGTH = 2;
const MAX_DRAW_LENGTH = 6;
const MIN_DRAW_VALUE = 1;
const MAX_DRAW_VALUE = 12;

const MIN_WORD_COUNT = 3;
const MAX_WORD_COUNT = 5;

/** The grammar bounds for the rung of a drawn pipeline at each solvable slot. */
const EASY_MIN_RUNG = 1;
const EASY_MAX_RUNG = 2;
const MEDIUM_MIN_RUNG = 2;
const MEDIUM_MAX_RUNG = 3;
const HARD_MAX_RUNG = 4;
const SINGLE_OP_LENGTH = 1;
const TWO_OP_LENGTH = 2;

const SEED_SEPARATOR = "|";
const SIGNATURE_OP_SEPARATOR = ">";
const SIGNATURE_PARAM_SEPARATOR = ",";
const SIGNATURE_PARAM_ASSIGN = "=";
const SIGNATURE_PARAMS_OPEN = "(";
const SIGNATURE_PARAMS_CLOSE = ")";
const INPUT_KEY_SEPARATOR = ",";
const DATE_SEPARATOR = "-";
const DATE_PAD_CHAR = "0";
const DATE_FIELD_WIDTH = 2;
const MS_PER_DAY = 86400000;
const MONTH_OFFSET = 1;

const ERROR_SLOT_DEADLOCK = "could not fill slot after the nonce bound for ";

/**
 * The word pipeline shapes the mystery slot may draw. There are more than the no
 * repeat window needs, so consecutive mystery days do not have to reuse a shape.
 */
const WORD_SHAPES: readonly (readonly OpMeta[])[] = [
  [OP_LENGTH_MAP, OP_SUM],
  [OP_LENGTH_MAP, OP_MAX],
  [OP_LENGTH_MAP, OP_MIN],
  [OP_LENGTH_MAP, OP_RANGE],
  [OP_LENGTH_MAP, OP_COUNT_DISTINCT],
  [OP_VOWEL_COUNT_MAP, OP_SUM],
  [OP_VOWEL_COUNT_MAP, OP_MAX],
  [OP_VOWEL_COUNT_MAP, OP_RANGE],
  [OP_FIRST_LETTER_POS, OP_SUM],
  [OP_FIRST_LETTER_POS, OP_MAX],
  [OP_FIRST_LETTER_POS, OP_MIN],
  [OP_SORT_ALPHA],
  [OP_LONGEST],
  [OP_KEEP_STARTSWITH_VOWEL, OP_LENGTH_MAP, OP_SUM],
  [OP_KEEP_STARTSWITH_VOWEL, OP_LONGEST],
];

/** A behavior class compiled for evaluation, with its fingerprint and pipeline. */
interface CompiledTheory {
  readonly fingerprint: string;
  readonly pipeline: Pipeline;
}

const theoryCache = new Map<Difficulty, CompiledTheory[]>();
const generationRepsCache = new Map<Difficulty, PipelineStep[][]>();

/** The hand authored overrides, keyed by date. A registered date wins outright. */
export const OVERRIDES = new Map<string, DaySpec>();

/** The launch date. No puzzle exists before it, so suppression looks back only to it. */
const GENERATOR_EPOCH = "2026-06-15";

const shippedDayCache = new Map<string, DaySpec>();

/**
 * Builds the seed for a slot from its date, difficulty, and retry nonce.
 * @param date The date being generated.
 * @param difficulty The slot being generated.
 * @param nonce The retry nonce.
 * @returns The seed for the slot generator.
 */
function seedFor(date: string, difficulty: Difficulty, nonce: number): number {
  return hash32([date, difficulty, GENERATOR_SALT, String(nonce)].join(SEED_SEPARATOR));
}

/**
 * Builds the stable signature of a pipeline from its operations and parameters.
 * @param steps The pipeline steps.
 * @returns The signature string.
 */
function signatureOf(steps: readonly PipelineStep[]): string {
  return steps
    .map((pipelineStep) => {
      const params = Object.keys(pipelineStep.params)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => name + SIGNATURE_PARAM_ASSIGN + pipelineStep.params[name])
        .join(SIGNATURE_PARAM_SEPARATOR);
      return pipelineStep.opId + SIGNATURE_PARAMS_OPEN + params + SIGNATURE_PARAMS_CLOSE;
    })
    .join(SIGNATURE_OP_SEPARATOR);
}

/**
 * Returns the theories admissible for a slot, compiled and cached.
 * @param difficulty The slot difficulty.
 * @returns The compiled admissible theories.
 */
function theoriesFor(difficulty: Difficulty): CompiledTheory[] {
  const cached = theoryCache.get(difficulty);
  if (cached) return cached;

  const policy = SLOT_POLICIES[difficulty];
  const theories: CompiledTheory[] = [];
  for (const [classFingerprint, behaviorClass] of behaviorClasses()) {
    if (behaviorClass.length <= policy.maxLength && behaviorClass.maxRung <= policy.ceiling) {
      theories.push({ fingerprint: classFingerprint, pipeline: compose(behaviorClass.representative) });
    }
  }
  theoryCache.set(difficulty, theories);
  return theories;
}

/**
 * Reports whether a behavior class matches the generation grammar of a solvable slot.
 * @param difficulty The slot difficulty.
 * @param behaviorClass The class to test.
 * @returns True when the class may be drawn as a true rule for the slot.
 */
function matchesGenerationShape(difficulty: Difficulty, behaviorClass: BehaviorClass): boolean {
  if (difficulty === DIFFICULTY_EASY) {
    return (
      behaviorClass.length === SINGLE_OP_LENGTH &&
      behaviorClass.maxRung >= EASY_MIN_RUNG &&
      behaviorClass.maxRung <= EASY_MAX_RUNG &&
      behaviorClass.representative.at(0)?.opId !== OP_AFFINE.id
    );
  }
  if (difficulty === DIFFICULTY_MEDIUM) {
    return (
      behaviorClass.length === SINGLE_OP_LENGTH &&
      behaviorClass.maxRung >= MEDIUM_MIN_RUNG &&
      behaviorClass.maxRung <= MEDIUM_MAX_RUNG
    );
  }
  if (difficulty === DIFFICULTY_HARD) {
    return behaviorClass.length === TWO_OP_LENGTH && behaviorClass.maxRung <= HARD_MAX_RUNG;
  }
  return false;
}

/**
 * Returns the true rule pipelines a solvable slot may draw, cached.
 * @param difficulty The slot difficulty.
 * @returns The candidate true pipelines.
 */
function generationReps(difficulty: Difficulty): PipelineStep[][] {
  const cached = generationRepsCache.get(difficulty);
  if (cached) return cached;

  const reps: PipelineStep[][] = [];
  for (const behaviorClass of behaviorClasses().values()) {
    if (matchesGenerationShape(difficulty, behaviorClass)) reps.push([...behaviorClass.representative]);
  }
  generationRepsCache.set(difficulty, reps);
  return reps;
}

/**
 * Draws a list of numbers within the draw bounds.
 * @param rng The slot generator.
 * @returns A drawn number list.
 */
function drawNumList(rng: Rng): number[] {
  const length = rng.intInRange(MIN_DRAW_LENGTH, MAX_DRAW_LENGTH);
  return Array.from({ length }, () => rng.intInRange(MIN_DRAW_VALUE, MAX_DRAW_VALUE));
}

/**
 * Draws a list of distinct words from a lexicon.
 * @param rng The slot generator.
 * @param lexicon The lexicon name to draw from.
 * @returns A drawn word list.
 */
function drawWordList(rng: Rng, lexicon: LexiconName): string[] {
  const entries = getLexicon(lexicon);
  const count = rng.intInRange(MIN_WORD_COUNT, MAX_WORD_COUNT);
  const words: string[] = [];
  const used = new Set<string>();
  let guard = 0;
  const guardLimit = count * MAX_DRAW_LENGTH;
  while (words.length < count && guard < guardLimit) {
    guard++;
    const word = rng.pick(entries).word;
    if (used.has(word)) continue;
    used.add(word);
    words.push(word);
  }
  return words;
}

/**
 * Reports whether an input is usable as an example or challenge for a pipeline: every
 * operation finds it interesting, the output is in range, and the output differs from
 * the input.
 * @param steps The pipeline steps.
 * @param input The input to test.
 * @returns True when the input is usable.
 */
function inputUsable(steps: readonly PipelineStep[], input: Value): boolean {
  let value = input;
  for (const pipelineStep of steps) {
    const op = getOp(pipelineStep.opId);
    if (!op.isInteresting(value, pipelineStep.params)) return false;
    value = op.apply(value, pipelineStep.params);
  }
  return outputInRange(value) && !valuesEqual(value, input);
}

/**
 * Gathers a pool of distinct usable inputs by repeated drawing.
 * @param steps The pipeline steps.
 * @param draw A function that draws one input.
 * @returns The gathered pool.
 */
function gatherPool(steps: readonly PipelineStep[], draw: () => Value): Value[] {
  const pool: Value[] = [];
  const seen = new Set<string>();
  for (let drawIndex = 0; drawIndex < MAX_INPUT_DRAWS && pool.length < INPUT_POOL_SIZE; drawIndex++) {
    const input = draw();
    const key = Array.isArray(input) ? input.join(INPUT_KEY_SEPARATOR) : String(input);
    if (seen.has(key)) continue;
    if (!inputUsable(steps, input)) continue;
    seen.add(key);
    pool.push(input);
  }
  return pool;
}

/** A pool input with its true output and the theories that reproduce it. */
interface PoolEvaluation {
  readonly input: Value;
  readonly output: Value;
  readonly survivors: readonly string[];
}

/** The chosen example and challenge inputs for a slot. */
interface Selection {
  readonly exampleInputs: readonly Value[];
  readonly challengeInputs: readonly Value[];
}

/**
 * Reports whether the theories common to two survivor sets are exactly the true rule.
 * @param first The first survivor set.
 * @param second The second survivor set.
 * @param trueFingerprint The fingerprint of the true rule.
 * @returns True when the only common survivor is the true rule.
 */
function intersectionIsTrueOnly(
  first: readonly string[],
  second: readonly string[],
  trueFingerprint: string,
): boolean {
  const secondSet = new Set(second);
  const common = first.filter((value) => secondSet.has(value));
  return common.length === 1 && common.at(0) === trueFingerprint;
}

/**
 * Selects example and challenge inputs that uniquely pin the true rule for a solvable
 * slot, so no decoy survives the examples.
 * @param difficulty The slot difficulty.
 * @param pipeline The true pipeline.
 * @param trueFingerprint The fingerprint of the true rule.
 * @param theories The admissible theories for the slot.
 * @param pool The pool of usable inputs.
 * @returns A selection, or null when no unique pinning could be found.
 */
function selectUniquePin(
  difficulty: Difficulty,
  pipeline: Pipeline,
  trueFingerprint: string,
  theories: readonly CompiledTheory[],
  pool: readonly Value[],
): Selection | null {
  if (pool.length < EXAMPLE_COUNT + CHALLENGE_COUNT) return null;

  const evaluations: PoolEvaluation[] = pool.map((input) => {
    const output = execute(pipeline, input);
    const survivors = theories
      .filter((theory) => valuesEqual(execute(theory.pipeline, input), output))
      .map((theory) => theory.fingerprint);
    return { input, output, survivors };
  });

  const distinctFrom = (candidate: PoolEvaluation, chosen: PoolEvaluation): boolean =>
    candidate !== chosen &&
    !valuesEqual(candidate.input, chosen.input) &&
    !valuesEqual(candidate.output, chosen.output);

  const uniqueFirst = evaluations.find(
    (evaluation) => evaluation.survivors.length === 1 && evaluation.survivors.at(0) === trueFingerprint,
  );

  let first: PoolEvaluation;
  if (uniqueFirst) {
    first = uniqueFirst;
  } else if (difficulty === DIFFICULTY_EASY) {
    return null;
  } else {
    const fallbackFirst = [...evaluations].sort((a, b) => a.survivors.length - b.survivors.length).at(0);
    if (!fallbackFirst) return null;
    first = fallbackFirst;
  }

  const second = uniqueFirst
    ? evaluations.find((evaluation) => distinctFrom(evaluation, first))
    : evaluations.find(
        (evaluation) =>
          distinctFrom(evaluation, first) &&
          intersectionIsTrueOnly(first.survivors, evaluation.survivors, trueFingerprint),
      );

  if (!second) return null;
  return assembleSelection(evaluations, first, second);
}

/**
 * Selects example inputs whose outputs differ for a slot whose ambiguity is not scored,
 * such as a word machine.
 * @param pipeline The true pipeline.
 * @param pool The pool of usable inputs.
 * @returns A selection, or null when distinct example outputs could not be found.
 */
function selectByDistinctOutput(pipeline: Pipeline, pool: readonly Value[]): Selection | null {
  if (pool.length < EXAMPLE_COUNT + CHALLENGE_COUNT) return null;

  const evaluations: PoolEvaluation[] = pool.map((input) => ({
    input,
    output: execute(pipeline, input),
    survivors: [],
  }));
  const first = evaluations.at(0);
  if (!first) return null;
  const second = evaluations.find(
    (evaluation) =>
      evaluation !== first &&
      !valuesEqual(evaluation.input, first.input) &&
      !valuesEqual(evaluation.output, first.output),
  );
  if (!second) return null;
  return assembleSelection(evaluations, first, second);
}

/**
 * Assembles a selection from two chosen examples and the remaining pool as challenges.
 * @param evaluations The evaluated pool.
 * @param first The first example.
 * @param second The second example.
 * @returns A selection, or null when there are too few challenges.
 */
function assembleSelection(
  evaluations: readonly PoolEvaluation[],
  first: PoolEvaluation,
  second: PoolEvaluation,
): Selection | null {
  const challenges = evaluations
    .filter((evaluation) => evaluation !== first && evaluation !== second)
    .slice(0, CHALLENGE_COUNT);
  if (challenges.length < CHALLENGE_COUNT) return null;
  return {
    exampleInputs: [first.input, second.input],
    challengeInputs: challenges.map((evaluation) => evaluation.input),
  };
}

/**
 * Builds a day machine from a validated selection.
 * @param difficulty The slot difficulty.
 * @param steps The pipeline steps.
 * @param pipeline The compiled pipeline.
 * @param selection The chosen inputs.
 * @param notes An optional curation note, such as a decoy phrase.
 * @returns The day machine.
 */
function buildMachine(
  difficulty: Difficulty,
  steps: readonly PipelineStep[],
  pipeline: Pipeline,
  selection: Selection,
  notes: string | undefined,
): DayMachine {
  const toPair = (input: Value): IoPair => ({ input, output: execute(pipeline, input) });
  const machine: DayMachine = {
    difficulty,
    steps,
    rule: phrasePipeline(pipeline),
    examples: selection.exampleInputs.map(toPair),
    challenges: selection.challengeInputs.map(toPair),
  };
  return notes === undefined ? machine : { ...machine, notes };
}

/**
 * Attempts to fill a solvable slot once with the given generator.
 * @param difficulty The slot difficulty.
 * @param rng The slot generator.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns A day machine, or null when this attempt failed.
 */
function attemptSolvableSlot(difficulty: Difficulty, rng: Rng, forbidden: ReadonlySet<string>): DayMachine | null {
  const reps = generationReps(difficulty);
  if (reps.length === 0) return null;

  const steps = reps.at(rng.intInRange(0, reps.length - 1));
  if (!steps) return null;
  if (forbidden.has(signatureOf(steps))) return null;

  const pipeline = compose(steps);
  const trueFingerprint = fingerprintOfSteps(steps);
  const pool = gatherPool(steps, () => drawNumList(rng));
  const selection = selectUniquePin(difficulty, pipeline, trueFingerprint, theoriesFor(difficulty), pool);
  if (!selection) return null;

  const candidate: Candidate = {
    steps,
    difficulty,
    exampleInputs: selection.exampleInputs,
    challengeInputs: selection.challengeInputs,
  };
  const result = validate(candidate);
  if (!result.ok) return null;

  return buildMachine(difficulty, steps, pipeline, selection, result.notes);
}

/**
 * Attempts to fill the mystery slot once with a word machine.
 * @param rng The slot generator.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns A day machine, or null when this attempt failed.
 */
function attemptWordMysterySlot(rng: Rng, forbidden: ReadonlySet<string>): DayMachine | null {
  const shape = WORD_SHAPES.at(rng.intInRange(0, WORD_SHAPES.length - 1));
  if (!shape) return null;
  const steps = shape.map((op) => step(op));
  if (forbidden.has(signatureOf(steps))) return null;

  const pipeline = compose(steps);
  const lexicon = ALL_LEXICON_NAMES.at(rng.intInRange(0, ALL_LEXICON_NAMES.length - 1));
  if (!lexicon) return null;
  const pool = gatherPool(steps, () => drawWordList(rng, lexicon));
  const selection = selectByDistinctOutput(pipeline, pool);
  if (!selection) return null;

  const candidate: Candidate = {
    steps,
    difficulty: DIFFICULTY_MYSTERY,
    exampleInputs: selection.exampleInputs,
    challengeInputs: selection.challengeInputs,
  };
  const result = validate(candidate);
  if (!result.ok) return null;

  return buildMachine(DIFFICULTY_MYSTERY, steps, pipeline, selection, result.notes);
}

/**
 * Fills one slot, reseeding with the next nonce until a machine is produced.
 * @param difficulty The slot difficulty.
 * @param date The date being generated.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns The filled day machine.
 */
function generateSlot(difficulty: Difficulty, date: string, forbidden: ReadonlySet<string>): DayMachine {
  for (let nonce = 0; nonce < MAX_SLOT_NONCE; nonce++) {
    const rng = createRng(seedFor(date, difficulty, nonce));
    const machine =
      difficulty === DIFFICULTY_MYSTERY
        ? attemptWordMysterySlot(rng, forbidden)
        : attemptSolvableSlot(difficulty, rng, forbidden);
    if (machine) return machine;
  }
  throw new Error(ERROR_SLOT_DEADLOCK + difficulty + SEED_SEPARATOR + date);
}

/**
 * Generates the four machines of a day under a set of forbidden signatures.
 * @param date The date being generated.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns The day specification.
 */
function composeDay(date: string, forbidden: ReadonlySet<string>): DaySpec {
  return { date, machines: DIFFICULTY_ORDER.map((difficulty) => generateSlot(difficulty, date, forbidden)) };
}

/**
 * Pads a date field to a fixed width.
 * @param value The numeric field.
 * @returns The padded field.
 */
function padDateField(value: number): string {
  return String(value).padStart(DATE_FIELD_WIDTH, DATE_PAD_CHAR);
}

/**
 * Shifts a date by a number of days, working in coordinated universal time.
 * @param date The starting date.
 * @param deltaDays The number of days to add, which may be negative.
 * @returns The shifted date string.
 */
function shiftDate(date: string, deltaDays: number): string {
  const parts = date.split(DATE_SEPARATOR).map(Number);
  const year = parts.at(0) ?? 0;
  const month = parts.at(1) ?? MONTH_OFFSET;
  const day = parts.at(2) ?? MONTH_OFFSET;
  const shifted = new Date(Date.UTC(year, month - MONTH_OFFSET, day) + deltaDays * MS_PER_DAY);
  return [
    String(shifted.getUTCFullYear()),
    padDateField(shifted.getUTCMonth() + MONTH_OFFSET),
    padDateField(shifted.getUTCDate()),
  ].join(DATE_SEPARATOR);
}

/**
 * Returns the override for a date, if one is registered.
 * @param date The date to look up.
 * @returns The override day specification, or undefined.
 */
function overrideFor(date: string): DaySpec | undefined {
  return OVERRIDES.get(date);
}

/**
 * Collects the pipeline signatures of the shipped puzzles for the previous days within
 * the no repeat window, looking back no earlier than the launch date.
 * @param date The date being generated.
 * @returns The forbidden signatures.
 */
function forbiddenSignatures(date: string): Set<string> {
  const forbidden = new Set<string>();
  for (let back = 1; back < REPEAT_WINDOW; back++) {
    const prior = shiftDate(date, -back);
    if (prior < GENERATOR_EPOCH) break;
    for (const machine of generateDay(prior).machines) {
      forbidden.add(signatureOf(machine.steps));
    }
  }
  return forbidden;
}

/**
 * Generates the puzzle for a date, caching the result. A registered override wins
 * outright; otherwise the four slots are filled while avoiding any pipeline shipped in
 * the previous thirteen days. The same date always yields the same puzzle.
 * @param date The date in year month day form.
 * @returns The day specification.
 */
export function generateDay(date: string): DaySpec {
  const cached = shippedDayCache.get(date);
  if (cached) return cached;

  const override = overrideFor(date);
  const spec = override ?? composeDay(date, forbiddenSignatures(date));
  shippedDayCache.set(date, spec);
  return spec;
}
