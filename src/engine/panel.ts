/**
 * Build time computation of a machine's operation panel.
 *
 * The panel is the set of operations a machine offers the player, sized to its
 * difficulty. It is the operations honestly in play given the examples: the true rule
 * together with the decoy theories that still fit both examples, expressed as the tiles
 * a player can actually pick. That core is padded with same section, similar rung
 * operations up to a per difficulty target so an easy panel is never suspiciously short,
 * while the mystery slot exposes the whole catalogue. The entire ordering is one seeded
 * shuffle keyed off the date and slot, so the same puzzle shows the same panel in the
 * same order to every player, yet no position betrays which operation is the answer.
 *
 * This runs only at build time, inside the precompute step, and the result is baked into
 * the day data. The browser reads the baked list and never rebuilds the behavior
 * universe. The affine map has no player tile because multiply then add reproduces it,
 * so wherever a pipeline names affine the panel lists multiply and add in its place.
 */

import { getOp, OP_ADD_K, OP_AFFINE, OP_MUL_K, REGISTRY } from "./ops";
import { TYPE_NUM_LIST, TYPE_WORD_LIST, type Value } from "./ops-types";
import { compose, execute, type PipelineStep } from "./compose";
import { behaviorClasses, wordBehaviorClasses } from "./universe";
import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_MYSTERY,
  DIFFICULTY_SUPER_EASY,
  SLOT_POLICIES,
  valuesEqual,
  type Difficulty,
} from "./validate";
import { createRng, hash32, type Rng } from "./rng";

/**
 * The number of operations each difficulty's panel aims for. A panel never falls below
 * its target: it is padded up to this many when the in play operations are fewer. The
 * mystery target is the whole catalogue rather than a count, so its panel is the full
 * set of tiles. These are the difficulty knobs; adjust them here and nowhere else.
 */
export const PANEL_TARGET_SUPER_EASY = 6;
export const PANEL_TARGET_EASY = 6;
export const PANEL_TARGET_MEDIUM = 8;
export const PANEL_TARGET_HARD = 16;
export const PANEL_TARGET_FULL = Number.POSITIVE_INFINITY;

const PANEL_TARGETS: Readonly<Record<Difficulty, number>> = {
  [DIFFICULTY_SUPER_EASY]: PANEL_TARGET_SUPER_EASY,
  [DIFFICULTY_EASY]: PANEL_TARGET_EASY,
  [DIFFICULTY_MEDIUM]: PANEL_TARGET_MEDIUM,
  [DIFFICULTY_HARD]: PANEL_TARGET_HARD,
  [DIFFICULTY_MYSTERY]: PANEL_TARGET_FULL,
};

/** The two palette sections an operation falls into, by the chips it reads. */
const SECTION_NUMBERS = "numbers";
const SECTION_VOCAB = "vocab";

const SEED_SEPARATOR = "|";
const PADDING_SALT = "panel-pad";
const ORDERING_SALT = "panel-order";

/** The default empty avoid set, used when a panel has no neighbouring panel to differ from. */
const NO_AVOID: ReadonlySet<string> = new Set();

/** The operations a player can pick as tiles: every operation except the affine map. */
const TILE_OP_IDS: readonly string[] = REGISTRY.filter((op) => op.id !== OP_AFFINE.id).map((op) => op.id);

/**
 * Expands a pipeline operation to the player tiles that build it. Every operation maps
 * to itself except the affine map, which a player reproduces with multiply then add.
 * @param opId The pipeline operation identifier.
 * @returns The tile identifiers that build the operation.
 */
function tileOpIdsOf(opId: string): readonly string[] {
  if (opId === OP_AFFINE.id) return [OP_MUL_K.id, OP_ADD_K.id];
  return [opId];
}

/**
 * Returns the palette section an operation belongs to, derived from the chips it reads:
 * word reading operations sit in the vocab section, all others in the numbers section.
 * @param opId The operation identifier.
 * @returns The section name.
 */
function sectionOfOp(opId: string): string {
  return getOp(opId).inputType === TYPE_WORD_LIST ? SECTION_VOCAB : SECTION_NUMBERS;
}

/** One admissible decoy theory: its compiled pipeline and the tiles that build it. */
interface AdmissibleTheory {
  readonly outputsOf: (inputs: readonly Value[]) => Value[];
  readonly tileOpIds: readonly string[];
}

const admissibleCache = new Map<string, AdmissibleTheory[]>();

/**
 * Returns the decoy theories admissible for a slot in one universe: the behavior classes
 * within the slot's length and rung policy, each compiled once with the tiles that build
 * it. Cached per difficulty and universe, so the universe is scanned a handful of times
 * across a whole build rather than once per machine.
 * @param difficulty The slot difficulty.
 * @param isWord Whether the machine reads words.
 * @returns The admissible theories.
 */
function admissibleTheories(difficulty: Difficulty, isWord: boolean): AdmissibleTheory[] {
  const cacheKey = difficulty + SEED_SEPARATOR + String(isWord);
  const cached = admissibleCache.get(cacheKey);
  if (cached) return cached;

  const classes = isWord ? wordBehaviorClasses() : behaviorClasses();
  const policy = SLOT_POLICIES[difficulty];
  const theories: AdmissibleTheory[] = [];
  for (const behaviorClass of classes.values()) {
    if (behaviorClass.length > policy.maxLength || behaviorClass.maxRung > policy.ceiling) continue;
    const pipeline = compose(behaviorClass.representative);
    theories.push({
      outputsOf: (inputs) => inputs.map((input) => execute(pipeline, input)),
      tileOpIds: behaviorClass.representative.flatMap((aStep) => tileOpIdsOf(aStep.opId)),
    });
  }
  admissibleCache.set(cacheKey, theories);
  return theories;
}

/**
 * Collects the operations honestly in play: the tiles that build the true rule, plus the
 * tiles of every admissible decoy theory whose outputs match the true rule on both
 * examples. These are the operations a player who reasoned from the examples would still
 * be weighing.
 * @param steps The true rule pipeline.
 * @param difficulty The slot difficulty.
 * @param exampleInputs The example inputs the panel is judged against.
 * @returns The in play tile identifiers, in a stable discovery order.
 */
function corePanelOpIds(
  steps: readonly PipelineStep[],
  difficulty: Difficulty,
  exampleInputs: readonly Value[],
): string[] {
  const truePipeline = compose(steps);
  const isWord = truePipeline.inputType !== TYPE_NUM_LIST;
  const trueOutputs = exampleInputs.map((input) => execute(truePipeline, input));

  const core = new Set<string>();
  for (const aStep of steps) for (const tileId of tileOpIdsOf(aStep.opId)) core.add(tileId);

  for (const theory of admissibleTheories(difficulty, isWord)) {
    const outputs = theory.outputsOf(exampleInputs);
    const survives = outputs.every((output, index) => valuesEqual(output, trueOutputs[index]));
    if (!survives) continue;
    for (const tileId of theory.tileOpIds) core.add(tileId);
  }
  return [...core];
}

/**
 * Chooses padding operations to fill a panel up to its target: tiles of the machine's
 * own section that are not already in play, ranked by how close their rung is to the true
 * rule's top rung, with a seeded tiebreak so different machines draw different filler
 * while the choice stays reproducible for a given date.
 * @param core The in play tile identifiers.
 * @param topRung The true rule's top rung, the rung padding aims near.
 * @param section The machine's section.
 * @param need The number of padding tiles to add.
 * @param seed The padding seed.
 * @returns The chosen padding tile identifiers.
 */
function paddingOpIds(
  core: readonly string[],
  topRung: number,
  section: string,
  need: number,
  seed: number,
  avoid: ReadonlySet<string>,
): string[] {
  const taken = new Set(core);
  return TILE_OP_IDS.filter((opId) => !taken.has(opId) && !avoid.has(opId) && sectionOfOp(opId) === section)
    .map((opId) => ({ opId, distance: Math.abs(getOp(opId).rung - topRung), key: hash32(opId, seed) }))
    .sort((a, b) => a.distance - b.distance || a.key - b.key)
    .slice(0, need)
    .map((entry) => entry.opId);
}

/**
 * Shuffles a list in place order with a seeded generator, so the order is reproducible
 * for a given seed yet carries no information about which entry is meaningful.
 * @param opIds The operations to order.
 * @param rng The seeded generator.
 * @returns The shuffled operations.
 */
function seededShuffle(opIds: readonly string[], rng: Rng): string[] {
  const ordered = [...opIds];
  for (let index = ordered.length - 1; index > 0; index--) {
    const swap = rng.intInRange(0, index);
    const held = ordered[index];
    ordered[index] = ordered[swap];
    ordered[swap] = held;
  }
  return ordered;
}

/**
 * Computes a machine's operation panel: the operations in play padded up to the slot's
 * target, then shuffled into one reproducible-but-unpredictable order seeded from the
 * date and slot. The true operation is always present, the panel never falls below its
 * target, and the mystery slot returns the whole catalogue.
 * @param steps The true rule pipeline.
 * @param difficulty The slot difficulty.
 * @param exampleInputs The example inputs the panel is judged against.
 * @param date The date the machine belongs to, which seeds the ordering.
 * @returns The ordered panel operation identifiers.
 */
export function computePanelOps(
  steps: readonly PipelineStep[],
  difficulty: Difficulty,
  exampleInputs: readonly Value[],
  date: string,
  avoid: ReadonlySet<string> = NO_AVOID,
): string[] {
  const orderingSeed = hash32([date, difficulty, ORDERING_SALT].join(SEED_SEPARATOR));
  const target = PANEL_TARGETS[difficulty];
  if (!Number.isFinite(target)) {
    return seededShuffle(TILE_OP_IDS, createRng(orderingSeed));
  }

  const core = corePanelOpIds(steps, difficulty, exampleInputs);
  if (core.length >= target) return seededShuffle(core, createRng(orderingSeed));

  const section = compose(steps).inputType === TYPE_NUM_LIST ? SECTION_NUMBERS : SECTION_VOCAB;
  const topRung = Math.max(...steps.map((aStep) => getOp(aStep.opId).rung));
  const paddingSeed = hash32([date, difficulty, PADDING_SALT].join(SEED_SEPARATOR));
  const padding = paddingOpIds(core, topRung, section, target - core.length, paddingSeed, avoid);
  return seededShuffle([...core, ...padding], createRng(orderingSeed));
}
