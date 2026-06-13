/**
 * The deterministic daily generator.
 *
 * The puzzle for a date is a pure function of that date. There is no database and no
 * server: generateDay turns a date string into a day specification of four machines,
 * one per difficulty slot, and the same date always yields the same specification on
 * every device. A hand authored override for a date wins outright, which is how launch
 * week stays hand written and how any bad generated day is hot fixed.
 *
 * Each slot is filled from the precomputed behavior classes. The difficulty of a slot
 * is its operation count: the easy slot draws a two operation rule, and the harder
 * slots draw three operation rules at rising rungs. A rule may be numeric or word
 * based, drawn from whichever universe holds a class of the right shape, so a word
 * machine is judged by its operation count like any other rather than forming its own
 * difficulty. The true pipeline is a class representative, the simplest member of its
 * class, so a generated machine never collapses onto a simpler one.
 *
 * The example inputs are chosen against the decoy theory space of the slot, the short
 * pipelines a player would actually test. A solvable slot keeps few decoys surviving
 * the examples and every survivor must answer differently on the challenges, so a
 * correct prediction proves understanding. The mystery slot additionally requires a
 * trap decoy that fits the first example and is broken by the second, with at least one
 * other decoy still fitting both, so the rule stays uncertain until the challenges.
 *
 * Repeat suppression rejects a pipeline whose signature appeared in the shipped puzzle
 * of any of the previous eighty nine days, looking back no earlier than the launch date.
 * Those previous days are generated the same way and cached, so the lookback is bounded
 * and needs no stored history beyond the cache. When a slot cannot be filled the
 * generator reseeds with the next nonce and tries again, so every client walks the same
 * retry path to the same puzzle.
 */

import { compose, execute, type Pipeline, type PipelineStep } from "./compose";
import { createRng, hash32, type Rng } from "./rng";
import { ALL_LEXICON_NAMES, getLexicon, type LexiconName } from "./lexicon";
import { getOp, OP_ADD_K, OP_AFFINE, OP_MUL_K, OP_SUB_K } from "./ops";
import { TYPE_NUM_LIST, type Value } from "./ops-types";
import { phrasePipeline } from "./phrase";
import {
  behaviorClasses,
  fingerprintOfSteps,
  fingerprintWordSteps,
  wordBehaviorClasses,
  type BehaviorClass,
} from "./universe";
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

/** The no repeat window in days, so a pipeline must differ from the previous eighty nine. */
const REPEAT_WINDOW = 90;

const MIN_DRAW_LENGTH = 2;
const MAX_DRAW_LENGTH = 6;
const MIN_DRAW_VALUE = 1;
const MAX_DRAW_VALUE = 12;

const MIN_WORD_COUNT = 3;
const MAX_WORD_COUNT = 5;

/**
 * The grammar of a drawn true rule at each slot, by operation count and top rung. The
 * difficulty axis is the operation count first and the top rung second. The easy slot is
 * a two operation rule at the lowest rungs. The medium slot is everything in between: a
 * two operation rule that reaches a higher rung, or a three operation rule that stays at
 * the lower rungs. The hard and mystery slots are three operation rules at the two most
 * demanding rungs. Every shape from two to three operations falls into exactly one slot,
 * so no valid rule is wasted and word rules, whose operations sit at the higher rungs,
 * land naturally in the medium slot and above.
 */
const SHORT_LENGTH = 2;
const LONG_LENGTH = 3;
const EASY_MAX_RUNG = 2;
const MEDIUM_MIN_SHORT_RUNG = 3;
const MEDIUM_MAX_LONG_RUNG = 3;
const HARD_RUNG = 4;
const MYSTERY_RUNG = 5;

/**
 * The arithmetic maps that transform every chip by the same rule. Two of them in a row
 * compose into one opaque linear mapping, and the affine map folds a multiply and an add
 * into a single step, so the easy slot allows at most one of these and never the affine
 * map. This keeps an easy rule to a single arithmetic handle plus an obvious structural
 * step rather than a puzzle that reads as three operations at once.
 */
const ARITHMETIC_MAP_OP_IDS: ReadonlySet<string> = new Set([
  OP_ADD_K.id,
  OP_SUB_K.id,
  OP_MUL_K.id,
  OP_AFFINE.id,
]);
const EASY_MAX_ARITHMETIC_OPS = 1;

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

/** A behavior class compiled for evaluation, with its fingerprint and pipeline. */
interface CompiledTheory {
  readonly fingerprint: string;
  readonly pipeline: Pipeline;
}

/**
 * The behavior universe a true rule and its decoys are drawn from. A rule that consumes
 * a number list belongs to the numeric universe, and a rule that consumes a word list
 * belongs to the word universe, which fingerprints over the word probe battery instead.
 */
interface Universe {
  readonly isWord: boolean;
  readonly classes: Map<string, BehaviorClass>;
  readonly fingerprintSteps: (steps: readonly PipelineStep[]) => string;
}

/**
 * Returns the behavior universe a rule belongs to from whether it consumes words.
 * @param isWord Whether the rule consumes a word list.
 * @returns The matching universe, built and cached by the universe module.
 */
function universeFor(isWord: boolean): Universe {
  return isWord
    ? { isWord, classes: wordBehaviorClasses(), fingerprintSteps: fingerprintWordSteps }
    : { isWord, classes: behaviorClasses(), fingerprintSteps: fingerprintOfSteps };
}

/**
 * Returns the universe a true rule belongs to from the type its pipeline consumes.
 * @param steps The pipeline steps of the rule.
 * @returns The numeric universe for a numeric rule, the word universe otherwise.
 */
function universeOf(steps: readonly PipelineStep[]): Universe {
  return universeFor(compose(steps).inputType !== TYPE_NUM_LIST);
}

/** The true rule pipelines a slot may draw, split by the universe they come from. */
interface SlotReps {
  readonly numeric: PipelineStep[][];
  readonly word: PipelineStep[][];
}

const theoryCache = new Map<string, CompiledTheory[]>();
const generationRepsCache = new Map<Difficulty, SlotReps>();

/**
 * The share, out of one hundred, of slots eligible for both universes that draw a word
 * rule. Word operations sit at the higher rungs, so word rules only qualify for the
 * medium slot and above; within those slots this gives them a regular presence without
 * letting the far larger numeric pool crowd them out.
 */
const WORD_DRAW_PERCENT = 35;
const PERCENT_CEILING = 100;

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
 * Returns the decoy theories admissible for a slot in one universe, compiled and cached.
 * These are the short pipelines a player would test, drawn from the same universe as the
 * true rule so a numeric rule is judged against numeric decoys and a word rule against
 * word decoys.
 * @param difficulty The slot difficulty.
 * @param universe The universe the true rule belongs to.
 * @returns The compiled admissible decoy theories.
 */
function theoriesFor(difficulty: Difficulty, universe: Universe): CompiledTheory[] {
  const cacheKey = difficulty + SEED_SEPARATOR + String(universe.isWord);
  const cached = theoryCache.get(cacheKey);
  if (cached) return cached;

  const policy = SLOT_POLICIES[difficulty];
  const theories: CompiledTheory[] = [];
  for (const [classFingerprint, behaviorClass] of universe.classes) {
    if (behaviorClass.length <= policy.maxLength && behaviorClass.maxRung <= policy.ceiling) {
      theories.push({ fingerprint: classFingerprint, pipeline: compose(behaviorClass.representative) });
    }
  }
  theoryCache.set(cacheKey, theories);
  return theories;
}

/**
 * Reports whether a behavior class matches the generation grammar of a slot, by
 * operation count and top rung. The grammar is the same in both universes, so a word
 * class and a numeric class of the same shape qualify for the same slot.
 * @param difficulty The slot difficulty.
 * @param behaviorClass The class to test.
 * @returns True when the class may be drawn as a true rule for the slot.
 */
function matchesGenerationShape(difficulty: Difficulty, behaviorClass: BehaviorClass): boolean {
  const { length, maxRung, representative } = behaviorClass;
  if (difficulty === DIFFICULTY_EASY) {
    if (length !== SHORT_LENGTH || maxRung > EASY_MAX_RUNG) return false;
    if (representative.some((pipelineStep) => pipelineStep.opId === OP_AFFINE.id)) return false;
    const opIds = representative.map((pipelineStep) => pipelineStep.opId);
    if (new Set(opIds).size !== opIds.length) return false;
    const arithmeticOps = opIds.filter((opId) => ARITHMETIC_MAP_OP_IDS.has(opId)).length;
    return arithmeticOps <= EASY_MAX_ARITHMETIC_OPS;
  }
  if (difficulty === DIFFICULTY_MEDIUM) {
    const shortHighRung = length === SHORT_LENGTH && maxRung >= MEDIUM_MIN_SHORT_RUNG;
    const longLowRung = length === LONG_LENGTH && maxRung <= MEDIUM_MAX_LONG_RUNG;
    return shortHighRung || longLowRung;
  }
  if (difficulty === DIFFICULTY_HARD) {
    return length === LONG_LENGTH && maxRung === HARD_RUNG;
  }
  return length === LONG_LENGTH && maxRung === MYSTERY_RUNG;
}

/**
 * Returns the true rule pipelines a slot may draw, gathered from both universes and
 * cached, split by universe so the draw can balance the two. A rule may be numeric or
 * word based as long as its class matches the slot grammar.
 * @param difficulty The slot difficulty.
 * @returns The candidate true pipelines, split by universe.
 */
function generationReps(difficulty: Difficulty): SlotReps {
  const cached = generationRepsCache.get(difficulty);
  if (cached) return cached;

  const collect = (universe: Universe): PipelineStep[][] => {
    const reps: PipelineStep[][] = [];
    for (const behaviorClass of universe.classes.values()) {
      if (matchesGenerationShape(difficulty, behaviorClass)) reps.push([...behaviorClass.representative]);
    }
    return reps;
  };

  const reps: SlotReps = { numeric: collect(universeFor(false)), word: collect(universeFor(true)) };
  generationRepsCache.set(difficulty, reps);
  return reps;
}

/**
 * Chooses the pool of true rules to draw from for one attempt, giving word rules a
 * regular share of the slots that admit them while leaving the numeric pool to fill the
 * rest, and falling back to whichever pool is non empty.
 * @param reps The candidate true rules split by universe.
 * @param rng The slot generator.
 * @returns The chosen pool, or null when no rule is available.
 */
function chooseRepPool(reps: SlotReps, rng: Rng): PipelineStep[][] | null {
  const drawWord = rng.intInRange(0, PERCENT_CEILING - 1) < WORD_DRAW_PERCENT;
  if (drawWord && reps.word.length > 0) return reps.word;
  if (reps.numeric.length > 0) return reps.numeric;
  return reps.word.length > 0 ? reps.word : null;
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
 * Reports whether a candidate example differs from a chosen one in both its input and
 * its output, so the two examples teach something distinct.
 * @param candidate The candidate example.
 * @param chosen The already chosen example.
 * @returns True when the input and output both differ.
 */
function isDistinctExample(candidate: PoolEvaluation, chosen: PoolEvaluation): boolean {
  return (
    candidate !== chosen &&
    !valuesEqual(candidate.input, chosen.input) &&
    !valuesEqual(candidate.output, chosen.output)
  );
}

/**
 * Returns the number of decoys that survive both survivor sets.
 * @param first The first survivor set.
 * @param second The second survivor set.
 * @returns The size of the intersection.
 */
function commonSurvivorCount(first: readonly string[], second: readonly string[]): number {
  const secondSet = new Set(second);
  return first.filter((fingerprint) => secondSet.has(fingerprint)).length;
}

/**
 * Evaluates the pool against the slot's decoy theories, recording for each input the
 * true output and the decoys that reproduce it.
 * @param pipeline The true pipeline.
 * @param theories The decoy theories for the slot.
 * @param pool The pool of usable inputs.
 * @returns One evaluation per pool input.
 */
function evaluatePool(
  pipeline: Pipeline,
  theories: readonly CompiledTheory[],
  pool: readonly Value[],
): PoolEvaluation[] {
  return pool.map((input) => {
    const output = execute(pipeline, input);
    const survivors = theories
      .filter((theory) => valuesEqual(execute(theory.pipeline, input), output))
      .map((theory) => theory.fingerprint);
    return { input, output, survivors };
  });
}

/**
 * Selects examples that uniquely pin the true rule of an easy slot, where the true rule
 * is itself among the decoy theories, so the first example alone leaves only the true
 * rule.
 * @param evaluations The evaluated pool.
 * @param trueFingerprint The fingerprint of the true rule.
 * @returns A selection, or null when no unique pinning could be found.
 */
function selectUniquePin(evaluations: readonly PoolEvaluation[], trueFingerprint: string): Selection | null {
  const first = evaluations.find(
    (evaluation) => evaluation.survivors.length === 1 && evaluation.survivors.at(0) === trueFingerprint,
  );
  if (!first) return null;

  const second = evaluations.find((evaluation) => isDistinctExample(evaluation, first));
  if (!second) return null;
  return assembleSelection(evaluations, first, second);
}

/**
 * Selects examples for a solvable slot whose true rule is more complex than the decoy
 * space, choosing the two examples that leave the fewest decoys surviving both, so the
 * player is led to the true rule and any survivors are caught by the challenges.
 * @param evaluations The evaluated pool.
 * @returns A selection, or null when no distinct pair could be found.
 */
function selectFewestSurvivors(evaluations: readonly PoolEvaluation[]): Selection | null {
  const byFewest = [...evaluations].sort((a, b) => a.survivors.length - b.survivors.length);
  const first = byFewest.at(0);
  if (!first) return null;

  let second: PoolEvaluation | null = null;
  let fewestCommon = Number.POSITIVE_INFINITY;
  for (const evaluation of byFewest) {
    if (!isDistinctExample(evaluation, first)) continue;
    const common = commonSurvivorCount(first.survivors, evaluation.survivors);
    if (common < fewestCommon) {
      fewestCommon = common;
      second = evaluation;
      if (common === 0) break;
    }
  }

  if (!second) return null;
  return assembleSelection(evaluations, first, second);
}

/**
 * Selects examples for a mystery slot, finding a first example that several decoys fit
 * and a second example that breaks at least one of them while leaving at least one decoy
 * still fitting both, so a trap is set and the rule stays uncertain until the challenges.
 * @param evaluations The evaluated pool.
 * @returns A selection, or null when no trap pair could be found.
 */
function selectWithTrap(evaluations: readonly PoolEvaluation[]): Selection | null {
  const byMost = [...evaluations].sort((a, b) => b.survivors.length - a.survivors.length);
  for (const first of byMost) {
    if (first.survivors.length === 0) continue;
    for (const second of evaluations) {
      if (!isDistinctExample(second, first)) continue;
      const secondSet = new Set(second.survivors);
      const survivesBoth = first.survivors.some((fingerprint) => secondSet.has(fingerprint));
      const trapKilled = first.survivors.some((fingerprint) => !secondSet.has(fingerprint));
      if (survivesBoth && trapKilled) return assembleSelection(evaluations, first, second);
    }
  }
  return null;
}

/**
 * Selects the examples for a slot from its evaluated pool, choosing the strategy that
 * matches the slot: a unique pin for the easy slot, a trap for the mystery slot, and the
 * fewest surviving decoys otherwise.
 * @param difficulty The slot difficulty.
 * @param pipeline The true pipeline.
 * @param trueFingerprint The fingerprint of the true rule.
 * @param theories The decoy theories for the slot.
 * @param pool The pool of usable inputs.
 * @returns A selection, or null when no suitable examples could be found.
 */
function selectExamples(
  difficulty: Difficulty,
  pipeline: Pipeline,
  trueFingerprint: string,
  theories: readonly CompiledTheory[],
  pool: readonly Value[],
): Selection | null {
  if (pool.length < EXAMPLE_COUNT + CHALLENGE_COUNT) return null;
  const evaluations = evaluatePool(pipeline, theories, pool);
  if (difficulty === DIFFICULTY_EASY) return selectUniquePin(evaluations, trueFingerprint);
  if (difficulty === DIFFICULTY_MYSTERY) return selectWithTrap(evaluations);
  return selectFewestSurvivors(evaluations);
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
 * Draws one input for a rule from its universe: a word list from a fixed lexicon for a
 * word rule, or a number list otherwise.
 * @param rng The slot generator.
 * @param universe The universe the rule belongs to.
 * @returns A function that draws one input, or null when no lexicon is available.
 */
function drawerFor(rng: Rng, universe: Universe): (() => Value) | null {
  if (!universe.isWord) return () => drawNumList(rng);
  if (ALL_LEXICON_NAMES.length === 0) return null;
  const lexicon = ALL_LEXICON_NAMES.at(rng.intInRange(0, ALL_LEXICON_NAMES.length - 1));
  if (!lexicon) return null;
  return () => drawWordList(rng, lexicon);
}

/**
 * Attempts to fill a slot once: draws a true rule of the slot's shape from either
 * universe, gathers inputs, selects examples against the slot's decoy space, and
 * validates the result.
 * @param difficulty The slot difficulty.
 * @param rng The slot generator.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns A day machine, or null when this attempt failed.
 */
function attemptSlot(difficulty: Difficulty, rng: Rng, forbidden: ReadonlySet<string>): DayMachine | null {
  const repPool = chooseRepPool(generationReps(difficulty), rng);
  if (!repPool) return null;

  const steps = repPool.at(rng.intInRange(0, repPool.length - 1));
  if (!steps) return null;
  if (forbidden.has(signatureOf(steps))) return null;

  const universe = universeOf(steps);
  const draw = drawerFor(rng, universe);
  if (!draw) return null;

  const pipeline = compose(steps);
  const trueFingerprint = universe.fingerprintSteps(steps);
  const pool = gatherPool(steps, draw);
  const theories = theoriesFor(difficulty, universe);
  const selection = selectExamples(difficulty, pipeline, trueFingerprint, theories, pool);
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
 * Fills one slot, reseeding with the next nonce until a machine is produced.
 * @param difficulty The slot difficulty.
 * @param date The date being generated.
 * @param forbidden The signatures forbidden by repeat suppression.
 * @returns The filled day machine.
 */
function generateSlot(difficulty: Difficulty, date: string, forbidden: ReadonlySet<string>): DayMachine {
  for (let nonce = 0; nonce < MAX_SLOT_NONCE; nonce++) {
    const rng = createRng(seedFor(date, difficulty, nonce));
    const machine = attemptSlot(difficulty, rng, forbidden);
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
 * the previous eighty nine days. The same date always yields the same puzzle.
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
