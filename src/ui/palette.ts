/**
 * The operation palette model and the pure apply-trail core for the answer builder.
 *
 * The player builds a prediction by applying operations to the current question's
 * chips and watching them transform, rather than by typing values. This module is the
 * headless half of that: it maps each operation to a palette tile, splits the tiles
 * into the two type sections the chips can be in, and folds an ordered trail of applied
 * operations over a seed value. It holds no view code so it can be unit tested without
 * a browser, and it reuses the engine's own operation functions so a built answer is
 * byte identical to what the machine would produce.
 *
 * The palette mirrors the engine's type system. Word chips expose the vocab section,
 * number chips expose the numbers section, and the one way bridge between them is a
 * translate operation that turns a word list into a number list. There is no operation
 * that turns numbers back into words, and once an operation reduces a list to a single
 * value no further operation can consume it, so the available tiles follow the running
 * value type exactly as pipeline composition does. The affine operation is intentionally
 * absent: applying multiply then add reproduces it, and a tile carries a single cycling
 * parameter rather than two.
 */

import {
  getOp,
  OP_ADD_K,
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
} from "../engine/ops";
import { TYPE_NUM_LIST, TYPE_WORD_LIST, type OpMeta, type ParamSpec, type Value, type ValueType } from "../engine/ops-types";
import type { PipelineStep } from "../engine/compose";
import { tokenize } from "../game/reducer";

/** One applied operation in the trail: the operation and its bound parameters. */
export type Step = PipelineStep;

/** The two palette sections, selected by whether the chips are words or numbers. */
export const SECTION_VOCAB = "vocab";
export const SECTION_NUMBERS = "numbers";
export type Section = typeof SECTION_VOCAB | typeof SECTION_NUMBERS;

/** The sub groups that organize a section into short, scannable rows of tiles. */
export const GROUP_MATH = "math";
export const GROUP_ORDER = "order";
export const GROUP_PICK = "pick";
export const GROUP_SHAPE = "shape";
export const GROUP_TRANSLATE = "translate";
export const GROUP_WORDS = "words";

/**
 * One palette tile: the operation it applies, the section and group it lives in, the
 * short label shown on it, and its single cycling parameter when it has one.
 */
export interface OpTile {
  readonly opId: string;
  readonly section: Section;
  readonly group: string;
  readonly shortLabel: string;
  readonly param?: ParamSpec;
}

/** The group and short label authored for each tiled operation, keyed by operation. */
interface TileInfo {
  readonly op: OpMeta;
  readonly group: string;
  readonly shortLabel: string;
}

/**
 * The tile authoring table. Every operation except affine appears exactly once; the
 * section is derived from the operation's input type rather than repeated here.
 */
const TILE_INFO: readonly TileInfo[] = [
  { op: OP_ADD_K, group: GROUP_MATH, shortLabel: "+" },
  { op: OP_SUB_K, group: GROUP_MATH, shortLabel: "−" },
  { op: OP_MUL_K, group: GROUP_MATH, shortLabel: "×" },
  { op: OP_DIGIT_SUM_MAP, group: GROUP_MATH, shortLabel: "digit sum" },
  { op: OP_REVERSE_DIGITS, group: GROUP_MATH, shortLabel: "flip digits" },
  { op: OP_UNITS_DIGIT, group: GROUP_MATH, shortLabel: "last digit" },

  { op: OP_REVERSE, group: GROUP_ORDER, shortLabel: "reverse" },
  { op: OP_SORT_ASC, group: GROUP_ORDER, shortLabel: "sort ↑" },
  { op: OP_SORT_DESC, group: GROUP_ORDER, shortLabel: "sort ↓" },
  { op: OP_SWAP_ENDS, group: GROUP_ORDER, shortLabel: "swap ends" },
  { op: OP_ROTATE_LEFT, group: GROUP_ORDER, shortLabel: "rotate" },
  { op: OP_EVERY_OTHER, group: GROUP_ORDER, shortLabel: "every other" },
  { op: OP_KEEP_FIRST_K, group: GROUP_ORDER, shortLabel: "first k" },
  { op: OP_KEEP_LAST_K, group: GROUP_ORDER, shortLabel: "last k" },

  { op: OP_SUM, group: GROUP_PICK, shortLabel: "sum" },
  { op: OP_COUNT, group: GROUP_PICK, shortLabel: "count" },
  { op: OP_MAX, group: GROUP_PICK, shortLabel: "max" },
  { op: OP_MIN, group: GROUP_PICK, shortLabel: "min" },
  { op: OP_RANGE, group: GROUP_PICK, shortLabel: "range" },
  { op: OP_PRODUCT, group: GROUP_PICK, shortLabel: "product" },
  { op: OP_FIRST, group: GROUP_PICK, shortLabel: "first" },
  { op: OP_LAST, group: GROUP_PICK, shortLabel: "last" },
  { op: OP_MEDIAN, group: GROUP_PICK, shortLabel: "median" },
  { op: OP_MODE, group: GROUP_PICK, shortLabel: "mode" },
  { op: OP_SECOND_LARGEST, group: GROUP_PICK, shortLabel: "2nd max" },
  { op: OP_COUNT_EVEN, group: GROUP_PICK, shortLabel: "# even" },
  { op: OP_COUNT_DISTINCT, group: GROUP_PICK, shortLabel: "# distinct" },
  { op: OP_INDEX_OF_MAX, group: GROUP_PICK, shortLabel: "max pos" },

  { op: OP_KEEP_EVEN, group: GROUP_SHAPE, shortLabel: "keep even" },
  { op: OP_KEEP_ODD, group: GROUP_SHAPE, shortLabel: "keep odd" },
  { op: OP_KEEP_GT_K, group: GROUP_SHAPE, shortLabel: "keep >" },
  { op: OP_KEEP_LT_K, group: GROUP_SHAPE, shortLabel: "keep <" },
  { op: OP_KEEP_GT_FIRST, group: GROUP_SHAPE, shortLabel: "> first" },
  { op: OP_DEDUP, group: GROUP_SHAPE, shortLabel: "dedup" },
  { op: OP_KEEP_DUPS, group: GROUP_SHAPE, shortLabel: "keep dups" },
  { op: OP_DROP_FIRST, group: GROUP_SHAPE, shortLabel: "drop first" },
  { op: OP_DROP_LAST, group: GROUP_SHAPE, shortLabel: "drop last" },
  { op: OP_MIN_NORMALIZE, group: GROUP_SHAPE, shortLabel: "− min" },
  { op: OP_RUNNING_TOTAL, group: GROUP_SHAPE, shortLabel: "running sum" },
  { op: OP_DELTAS, group: GROUP_SHAPE, shortLabel: "gaps" },

  { op: OP_LENGTH_MAP, group: GROUP_TRANSLATE, shortLabel: "# letters" },
  { op: OP_VOWEL_COUNT_MAP, group: GROUP_TRANSLATE, shortLabel: "# vowels" },
  { op: OP_DISTINCT_LETTERS_MAP, group: GROUP_TRANSLATE, shortLabel: "# diff letters" },
  { op: OP_LETTER_COUNT_SQUARED, group: GROUP_TRANSLATE, shortLabel: "letters²" },
  { op: OP_FIRST_LETTER_POS, group: GROUP_TRANSLATE, shortLabel: "1st letter #" },
  { op: OP_LAST_LETTER_POS, group: GROUP_TRANSLATE, shortLabel: "last letter #" },

  { op: OP_SORT_ALPHA, group: GROUP_WORDS, shortLabel: "A→Z" },
  { op: OP_SORT_BY_LENGTH, group: GROUP_WORDS, shortLabel: "by length" },
  { op: OP_LONGEST, group: GROUP_WORDS, shortLabel: "longest" },
  { op: OP_SHORTEST, group: GROUP_WORDS, shortLabel: "shortest" },
  { op: OP_KEEP_STARTSWITH_VOWEL, group: GROUP_WORDS, shortLabel: "vowel start" },
];

/**
 * Builds the palette tiles from the authoring table, deriving each tile's section from
 * its operation's input type and attaching its single parameter when it has one.
 * @returns The palette tiles in authoring order.
 */
function buildTiles(): OpTile[] {
  return TILE_INFO.map((info) => {
    const op = getOp(info.op.id);
    const section = op.inputType === TYPE_WORD_LIST ? SECTION_VOCAB : SECTION_NUMBERS;
    const param = op.params.at(0);
    const base: OpTile = { opId: op.id, section, group: info.group, shortLabel: info.shortLabel };
    return param === undefined ? base : { ...base, param };
  });
}

/** Every palette tile, one per tiled operation, in a stable order. */
export const OP_TILES: readonly OpTile[] = buildTiles();

/** The empty tile list returned when no operation can apply to the current chips. */
const NO_TILES: readonly OpTile[] = [];

/** Every tile keyed by its operation, for looking up a tile shown in the trail. */
const TILE_BY_ID: ReadonlyMap<string, OpTile> = new Map(OP_TILES.map((tile) => [tile.opId, tile]));

/**
 * Returns the tile for an operation, used to label a step already in the trail.
 * @param opId The operation identifier.
 * @returns The tile, or undefined when the operation has none.
 */
export function tileOf(opId: string): OpTile | undefined {
  return TILE_BY_ID.get(opId);
}

/**
 * Folds an ordered trail of applied operations over a seed value using the engine's own
 * operation functions, so the resulting chips match what the machine would produce.
 * @param seed The starting chips, the question's input.
 * @param steps The operations applied so far, in order.
 * @returns The chips after applying every step.
 */
export function applyTrail(seed: Value, steps: readonly Step[]): Value {
  let value = seed;
  for (const appliedStep of steps) {
    value = getOp(appliedStep.opId).apply(value, appliedStep.params);
  }
  return value;
}

/**
 * Infers the value type of a freshly seeded chip list from its first element, which the
 * question input always has.
 * @param seed The question's input chips.
 * @returns The word list type for word chips, the number list type otherwise.
 */
export function seedTypeOf(seed: Value): ValueType {
  const sample = Array.isArray(seed) ? seed.at(0) : seed;
  return typeof sample === "string" ? TYPE_WORD_LIST : TYPE_NUM_LIST;
}

/**
 * Returns the value type the chips have after a trail, by following each operation's
 * output type from the seed type, the same way composition tracks the running type.
 * @param seedType The value type of the seed chips.
 * @param steps The operations applied so far, in order.
 * @returns The value type after the last step.
 */
export function typeAfter(seedType: ValueType, steps: readonly Step[]): ValueType {
  let type = seedType;
  for (const appliedStep of steps) {
    type = getOp(appliedStep.opId).outputType;
  }
  return type;
}

/**
 * Maps a running value type to the palette section that can act on it, or null when the
 * value is a single number or word that no operation consumes.
 * @param type The running value type.
 * @returns The active section, or null when the chips are terminal.
 */
export function sectionForType(type: ValueType): Section | null {
  if (type === TYPE_NUM_LIST) return SECTION_NUMBERS;
  if (type === TYPE_WORD_LIST) return SECTION_VOCAB;
  return null;
}

/**
 * Returns the tiles the player may apply to chips of the given type: the tiles of the
 * active section, or none when the chips are terminal.
 * @param type The running value type.
 * @returns The applicable tiles.
 */
export function tilesForType(type: ValueType): readonly OpTile[] {
  const section = sectionForType(type);
  return section === null ? NO_TILES : OP_TILES.filter((tile) => tile.section === section);
}

/** A regular expression that recognizes a chip token made only of digits. */
const NUMERIC_TOKEN = /^\d+$/;

/**
 * Parses a question's input chip string into a typed chip value: a number list when
 * every token is digits, a word list otherwise. Tokenizing matches how the reducer
 * compares answers, so the chips a player builds line up with the expected output.
 * @param input The space separated input chip string.
 * @returns The parsed chip value.
 */
export function parseChips(input: string): Value {
  const tokens = tokenize(input);
  return tokens.every((token) => NUMERIC_TOKEN.test(token)) ? tokens.map(Number) : tokens;
}

/**
 * Renders a chip value as the list of display tokens, treating a single reduced value
 * as a one chip list.
 * @param value The chip value.
 * @returns The display tokens, one per chip.
 */
export function valueToChips(value: Value): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
}

/** The display label for each group, shown above its row of tiles. */
const GROUP_LABELS: Readonly<Record<string, string>> = {
  [GROUP_MATH]: "Math",
  [GROUP_ORDER]: "Order",
  [GROUP_PICK]: "Pick",
  [GROUP_SHAPE]: "Filter",
  [GROUP_TRANSLATE]: "Words to numbers",
  [GROUP_WORDS]: "Words",
};

/** The order the groups appear in within each section. */
const GROUP_ORDER_BY_SECTION: Readonly<Record<Section, readonly string[]>> = {
  [SECTION_NUMBERS]: [GROUP_MATH, GROUP_ORDER, GROUP_PICK, GROUP_SHAPE],
  [SECTION_VOCAB]: [GROUP_TRANSLATE, GROUP_WORDS],
};

/** One labelled row of tiles within the active section. */
export interface TileGroup {
  readonly group: string;
  readonly label: string;
  readonly tiles: readonly OpTile[];
}

/**
 * Groups the active section's tiles into labelled rows in display order, or returns no
 * rows when the chips are terminal.
 * @param type The running value type.
 * @returns The labelled tile rows for the active section.
 */
export function groupedTilesForType(type: ValueType): TileGroup[] {
  const section = sectionForType(type);
  if (section === null) return [];
  return GROUP_ORDER_BY_SECTION[section].map((group) => ({
    group,
    label: GROUP_LABELS[group],
    tiles: OP_TILES.filter((tile) => tile.section === section && tile.group === group),
  }));
}
