/**
 * A Hunchday puzzle is fair only when a human can recover the rule from the evidence,
 * which means the rule must be invertible from what the player sees. Invertibility fails
 * two ways. Literal information loss: the composition destroys data so several rules fit
 * the same evidence, as when a value shift between two filters entangles which filter
 * dropped a chip. Conceptual non invertibility: the data survives but recovering it is a
 * per element computation rather than an all at once realization, as with a per element
 * numeric word map. This module names those failures as structural patterns over the
 * operation sequence, so a candidate can be rejected by shape before it is ever executed.
 *
 * It is pure and structural: it reasons over operation identifiers, their families, and
 * their positions only, and never runs a pipeline. Every family tag and role set lives
 * here as the single source of fairness knowledge, the same one file of knobs shape the
 * panel module uses. Nothing wires it into validation yet; that is a later step.
 */

import {
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
} from "./ops";
import type { OpMeta } from "./ops-types";
import type { PipelineStep } from "./compose";

/** The behavior families every operation is tagged with. */
export const FAMILY_VALUE_MAP_MONOTONIC = "value_map_monotonic";
export const FAMILY_VALUE_MAP_DIGIT = "value_map_digit";
export const FAMILY_WORD_NUM_MAP = "word_num_map";
export const FAMILY_RESHAPE = "reshape";
export const FAMILY_REORDER = "reorder";
export const FAMILY_FILTER_VALUE = "filter_value";
export const FAMILY_FILTER_POSITION = "filter_position";
export const FAMILY_FILTER_RELATIONAL = "filter_relational";
export const FAMILY_REDUCER = "reducer";

/** The catalog pattern identifiers the matcher reports. */
export const PATTERN_L1 = "L1";
export const PATTERN_L2 = "L2";
export const PATTERN_L3 = "L3";
export const PATTERN_L4 = "L4";
export const PATTERN_C1 = "C1";
export const PATTERN_C2 = "C2";
export const PATTERN_C3 = "C3";
export const PATTERN_C4 = "C4";
export const PATTERN_L5 = "L5";
export const PATTERN_L6 = "L6";

const MONOTONIC_OPS: readonly OpMeta[] = [OP_ADD_K, OP_SUB_K, OP_MUL_K, OP_AFFINE];
const DIGIT_OPS: readonly OpMeta[] = [OP_UNITS_DIGIT, OP_DIGIT_SUM_MAP, OP_REVERSE_DIGITS];
const WORD_NUM_OPS: readonly OpMeta[] = [
  OP_LENGTH_MAP,
  OP_VOWEL_COUNT_MAP,
  OP_DISTINCT_LETTERS_MAP,
  OP_FIRST_LETTER_POS,
  OP_LAST_LETTER_POS,
  OP_LETTER_COUNT_SQUARED,
];
const RESHAPE_OPS: readonly OpMeta[] = [OP_DELTAS, OP_MIN_NORMALIZE, OP_RUNNING_TOTAL];
const REORDER_OPS: readonly OpMeta[] = [
  OP_REVERSE,
  OP_SORT_ASC,
  OP_SORT_DESC,
  OP_SWAP_ENDS,
  OP_ROTATE_LEFT,
  OP_SORT_ALPHA,
  OP_SORT_BY_LENGTH,
];
const FILTER_VALUE_OPS: readonly OpMeta[] = [
  OP_KEEP_EVEN,
  OP_KEEP_ODD,
  OP_KEEP_GT_K,
  OP_KEEP_LT_K,
  OP_DEDUP,
  OP_KEEP_DUPS,
  OP_KEEP_STARTSWITH_VOWEL,
];
const FILTER_POSITION_OPS: readonly OpMeta[] = [
  OP_KEEP_FIRST_K,
  OP_KEEP_LAST_K,
  OP_DROP_FIRST,
  OP_DROP_LAST,
  OP_EVERY_OTHER,
];
const FILTER_RELATIONAL_OPS: readonly OpMeta[] = [OP_KEEP_GT_FIRST];
const REDUCER_OPS: readonly OpMeta[] = [
  OP_SUM,
  OP_COUNT,
  OP_MAX,
  OP_MIN,
  OP_RANGE,
  OP_PRODUCT,
  OP_FIRST,
  OP_LAST,
  OP_MEDIAN,
  OP_MODE,
  OP_SECOND_LARGEST,
  OP_COUNT_EVEN,
  OP_INDEX_OF_MAX,
  OP_COUNT_DISTINCT,
  OP_LONGEST,
  OP_SHORTEST,
];

/** The family each group of operations is tagged with, in tag order. */
const FAMILY_GROUPS: readonly (readonly [string, readonly OpMeta[]])[] = [
  [FAMILY_VALUE_MAP_MONOTONIC, MONOTONIC_OPS],
  [FAMILY_VALUE_MAP_DIGIT, DIGIT_OPS],
  [FAMILY_WORD_NUM_MAP, WORD_NUM_OPS],
  [FAMILY_RESHAPE, RESHAPE_OPS],
  [FAMILY_REORDER, REORDER_OPS],
  [FAMILY_FILTER_VALUE, FILTER_VALUE_OPS],
  [FAMILY_FILTER_POSITION, FILTER_POSITION_OPS],
  [FAMILY_FILTER_RELATIONAL, FILTER_RELATIONAL_OPS],
  [FAMILY_REDUCER, REDUCER_OPS],
];

const FAMILY_OF: ReadonlyMap<string, string> = new Map(
  FAMILY_GROUPS.flatMap(([family, ops]) => ops.map((op) => [op.id, family] as const)),
);

/**
 * Returns the behavior family of an operation, or undefined when it is untagged.
 * @param opId The operation identifier.
 * @returns The family, or undefined.
 */
export function familyOf(opId: string): string | undefined {
  return FAMILY_OF.get(opId);
}

/**
 * Builds a set of operation identifiers from one or more family groups.
 * @param groups The operation groups to union.
 * @returns The set of their identifiers.
 */
function idSet(...groups: readonly (readonly OpMeta[])[]): ReadonlySet<string> {
  return new Set(groups.flatMap((group) => group.map((op) => op.id)));
}

/** Any operation that changes element values, the middle of an L1 or L2 entanglement. */
const VALUE_SHIFTING = idSet(MONOTONIC_OPS, DIGIT_OPS, RESHAPE_OPS, WORD_NUM_OPS);

/**
 * Per element value maps whose stacking is a C3 grind. The glanceable length map is
 * excluded, so counting letters then applying one arithmetic map ("twice the letters")
 * stays a fair word puzzle rather than reading as a grind. The length map still belongs
 * to the value shifting set above, so it can mask a filter in L1.
 */
const ELEMENTWISE_MAP: ReadonlySet<string> = new Set(
  [...idSet(MONOTONIC_OPS, DIGIT_OPS, WORD_NUM_OPS)].filter((id) => id !== OP_LENGTH_MAP.id),
);

/** The whole list reshapes, which lose absolute level or scramble structure. */
const RESHAPE_SET = idSet(RESHAPE_OPS);

/**
 * Every value transform: each per element map, including the glanceable length map, and
 * each whole list reshape. Two stacked transforms with at least one reshape are a C3
 * grind that also masks an arithmetic step before a level destroying reshape, since
 * adding a constant is invisible to the gaps and to subtracting the smallest.
 */
const TRANSFORM = idSet(MONOTONIC_OPS, DIGIT_OPS, WORD_NUM_OPS, RESHAPE_OPS);

/** Operations that destroy the absolute value level, lossy after a value filter. */
const ABSOLUTE_LEVEL_DESTROYER = idSet([OP_DELTAS, OP_MIN_NORMALIZE]);

/** Filters and reducers that select on position, the ends of an L4 entanglement. */
const POSITION_SELECTIVE = idSet(FILTER_POSITION_OPS, [OP_FIRST, OP_LAST, OP_INDEX_OF_MAX]);

/** Reducers that select on rank or extreme, the tail of an L2 entanglement. */
const RANK_REDUCER = idSet([OP_MAX, OP_MIN, OP_MEDIAN, OP_MODE, OP_RANGE, OP_SECOND_LARGEST, OP_INDEX_OF_MAX]);

/** The many to one digit maps that lose value information next to a filter. */
const MANY_TO_ONE_DIGIT = idSet(DIGIT_OPS);

/** The computation word maps, every word to number map except the glanceable length map. */
const COMPUTATION_WORD_MAP: ReadonlySet<string> = new Set(
  WORD_NUM_OPS.filter((op) => op.id !== OP_LENGTH_MAP.id).map((op) => op.id),
);

/** The arithmetic maps counted toward the C2 stacking limit. */
const ARITHMETIC_COUNT_OPS = idSet([OP_ADD_K, OP_SUB_K, OP_MUL_K]);

/** The smallest number of stacked arithmetic maps that reads as a coefficient solve. */
const C2_ARITHMETIC_LIMIT = 2;

/** Every filter, of any selection property. */
const FILTER_ANY = idSet(FILTER_VALUE_OPS, FILTER_POSITION_OPS, FILTER_RELATIONAL_OPS);

const FILTER_VALUE_SET = idSet(FILTER_VALUE_OPS);
const REORDER_SET = idSet(REORDER_OPS);

/** Every catalog pattern, in report order, for iteration in tests and reports. */
export const ALL_PATTERNS: readonly string[] = [
  PATTERN_L1,
  PATTERN_L2,
  PATTERN_L3,
  PATTERN_L4,
  PATTERN_C1,
  PATTERN_C2,
  PATTERN_C3,
  PATTERN_C4,
  PATTERN_L5,
  PATTERN_L6,
];

/**
 * Reports every fairness pattern a pipeline violates, by its shape alone. An empty set
 * means the pipeline is structurally fair. A pipeline may match several patterns; all
 * are reported so a rejection reason can name each.
 * @param steps The pipeline steps to inspect.
 * @returns The set of violated pattern identifiers.
 */
export function matchPatterns(steps: readonly PipelineStep[]): Set<string> {
  const ids = steps.map((aStep) => aStep.opId);
  const matched = new Set<string>();

  matchTriplePatterns(ids, matched);
  matchLevelDestroyerPattern(ids, matched);
  matchPairPatterns(ids, matched);
  matchSinglePatterns(ids, matched);

  return matched;
}

function matchTriplePatterns(ids: string[], matched: Set<string>): void {
  for (let i = 0; i + 2 < ids.length; i++) {
    if (FILTER_VALUE_SET.has(ids[i]) && VALUE_SHIFTING.has(ids[i + 1]) && FILTER_VALUE_SET.has(ids[i + 2])) {
      matched.add(PATTERN_L1);
    }
    if (FILTER_VALUE_SET.has(ids[i]) && VALUE_SHIFTING.has(ids[i + 1]) && RANK_REDUCER.has(ids[i + 2])) {
      matched.add(PATTERN_L2);
    }
    if (POSITION_SELECTIVE.has(ids[i]) && REORDER_SET.has(ids[i + 1]) && POSITION_SELECTIVE.has(ids[i + 2])) {
      matched.add(PATTERN_L4);
    }
  }
}

function matchLevelDestroyerPattern(ids: string[], matched: Set<string>): void {
  for (let j = 0; j < ids.length; j++) {
    if (ABSOLUTE_LEVEL_DESTROYER.has(ids[j]) && ids.slice(0, j).some((id) => FILTER_VALUE_SET.has(id))) {
      matched.add(PATTERN_L3);
    }
  }
}

function matchPairPatterns(ids: string[], matched: Set<string>): void {
  for (let i = 0; i + 1 < ids.length; i++) {
    if (ELEMENTWISE_MAP.has(ids[i]) && ELEMENTWISE_MAP.has(ids[i + 1])) matched.add(PATTERN_C3);
    if (TRANSFORM.has(ids[i]) && TRANSFORM.has(ids[i + 1]) && (RESHAPE_SET.has(ids[i]) || RESHAPE_SET.has(ids[i + 1]))) {
      matched.add(PATTERN_C4);
    }
    if (MANY_TO_ONE_DIGIT.has(ids[i]) && FILTER_ANY.has(ids[i + 1])) matched.add(PATTERN_L5);
    if (FILTER_ANY.has(ids[i]) && MANY_TO_ONE_DIGIT.has(ids[i + 1])) matched.add(PATTERN_L6);
  }
}

function matchSinglePatterns(ids: string[], matched: Set<string>): void {
  if (ids.some((id) => COMPUTATION_WORD_MAP.has(id))) matched.add(PATTERN_C1);
  if (ids.includes(OP_AFFINE.id) || ids.filter((id) => ARITHMETIC_COUNT_OPS.has(id)).length >= C2_ARITHMETIC_LIMIT) {
    matched.add(PATTERN_C2);
  }
}
