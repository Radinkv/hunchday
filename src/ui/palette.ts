/**
 * The operation palette model for the answer builder.
 *
 * The player reshapes the question's chips into a prediction by applying operations and
 * by moving chips around by hand. This module maps the operations that genuinely change
 * a chip's value or type to palette tiles, split into the two type sections the chips
 * can be in. Reordering and filtering are not tiles: the player does those directly by
 * dragging chips and by setting chips aside, so the palette stays a small set of
 * transformations rather than a bank of buttons.
 *
 * The palette mirrors the engine's type system. Word chips expose the vocab section and
 * number chips expose the numbers section, with the one way bridge being a translate
 * operation that turns words into numbers. The affine operation has no tile, since
 * applying multiply then add reproduces it with a single cycling parameter per tile.
 */

import {
  getOp,
  OP_ADD_K,
  OP_COUNT,
  OP_COUNT_DISTINCT,
  OP_COUNT_EVEN,
  OP_DELTAS,
  OP_DIGIT_SUM_MAP,
  OP_DISTINCT_LETTERS_MAP,
  OP_FIRST,
  OP_FIRST_LETTER_POS,
  OP_INDEX_OF_MAX,
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
  OP_REVERSE_DIGITS,
  OP_RUNNING_TOTAL,
  OP_SECOND_LARGEST,
  OP_SHORTEST,
  OP_SUB_K,
  OP_SUM,
  OP_UNITS_DIGIT,
  OP_VOWEL_COUNT_MAP,
} from "../engine/ops";
import { TYPE_NUM_LIST, TYPE_WORD_LIST, type OpMeta, type ParamSpec, type ValueType } from "../engine/ops-types";

/** The two palette sections, selected by whether the chips are words or numbers. */
export const SECTION_VOCAB = "vocab";
export const SECTION_NUMBERS = "numbers";
export type Section = typeof SECTION_VOCAB | typeof SECTION_NUMBERS;

/** The sub groups that organize a section into short, scannable rows of tiles. */
export const GROUP_TRANSFORM = "transform";
export const GROUP_COMBINE = "combine";
export const GROUP_TRANSLATE = "translate";
export const GROUP_WORD_PICK = "wordpick";

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
 * The tile authoring table. It holds the operations that change a chip's value or type;
 * reordering and filtering operations are deliberately absent because the player does
 * those by hand. The section is derived from each operation's input type.
 */
const TILE_INFO: readonly TileInfo[] = [
  { op: OP_ADD_K, group: GROUP_TRANSFORM, shortLabel: "+" },
  { op: OP_SUB_K, group: GROUP_TRANSFORM, shortLabel: "−" },
  { op: OP_MUL_K, group: GROUP_TRANSFORM, shortLabel: "×" },
  { op: OP_DIGIT_SUM_MAP, group: GROUP_TRANSFORM, shortLabel: "digit sum" },
  { op: OP_REVERSE_DIGITS, group: GROUP_TRANSFORM, shortLabel: "flip digits" },
  { op: OP_UNITS_DIGIT, group: GROUP_TRANSFORM, shortLabel: "last digit" },
  { op: OP_MIN_NORMALIZE, group: GROUP_TRANSFORM, shortLabel: "− min" },
  { op: OP_RUNNING_TOTAL, group: GROUP_TRANSFORM, shortLabel: "running sum" },
  { op: OP_DELTAS, group: GROUP_TRANSFORM, shortLabel: "gaps" },

  { op: OP_SUM, group: GROUP_COMBINE, shortLabel: "sum" },
  { op: OP_COUNT, group: GROUP_COMBINE, shortLabel: "count" },
  { op: OP_MAX, group: GROUP_COMBINE, shortLabel: "max" },
  { op: OP_MIN, group: GROUP_COMBINE, shortLabel: "min" },
  { op: OP_RANGE, group: GROUP_COMBINE, shortLabel: "range" },
  { op: OP_PRODUCT, group: GROUP_COMBINE, shortLabel: "product" },
  { op: OP_FIRST, group: GROUP_COMBINE, shortLabel: "first" },
  { op: OP_LAST, group: GROUP_COMBINE, shortLabel: "last" },
  { op: OP_MEDIAN, group: GROUP_COMBINE, shortLabel: "median" },
  { op: OP_MODE, group: GROUP_COMBINE, shortLabel: "mode" },
  { op: OP_SECOND_LARGEST, group: GROUP_COMBINE, shortLabel: "2nd max" },
  { op: OP_COUNT_EVEN, group: GROUP_COMBINE, shortLabel: "# even" },
  { op: OP_COUNT_DISTINCT, group: GROUP_COMBINE, shortLabel: "# distinct" },
  { op: OP_INDEX_OF_MAX, group: GROUP_COMBINE, shortLabel: "max pos" },

  { op: OP_LENGTH_MAP, group: GROUP_TRANSLATE, shortLabel: "# letters" },
  { op: OP_VOWEL_COUNT_MAP, group: GROUP_TRANSLATE, shortLabel: "# vowels" },
  { op: OP_DISTINCT_LETTERS_MAP, group: GROUP_TRANSLATE, shortLabel: "# diff letters" },
  { op: OP_LETTER_COUNT_SQUARED, group: GROUP_TRANSLATE, shortLabel: "letters²" },
  { op: OP_FIRST_LETTER_POS, group: GROUP_TRANSLATE, shortLabel: "1st letter #" },
  { op: OP_LAST_LETTER_POS, group: GROUP_TRANSLATE, shortLabel: "last letter #" },

  { op: OP_LONGEST, group: GROUP_WORD_PICK, shortLabel: "longest" },
  { op: OP_SHORTEST, group: GROUP_WORD_PICK, shortLabel: "shortest" },
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

/** Every tile keyed by its operation, for looking up a tile by operation. */
const TILE_BY_ID: ReadonlyMap<string, OpTile> = new Map(OP_TILES.map((tile) => [tile.opId, tile]));

/**
 * Returns the tile for an operation, or undefined when the operation has none.
 * @param opId The operation identifier.
 * @returns The tile, or undefined.
 */
export function tileOf(opId: string): OpTile | undefined {
  return TILE_BY_ID.get(opId);
}

/**
 * Maps a chip value type to the palette section that can act on it, or null when the
 * chips are missing or mixed and no operation applies.
 * @param type The work chip value type, or null.
 * @returns The active section, or null.
 */
export function sectionForType(type: ValueType | null): Section | null {
  if (type === TYPE_NUM_LIST) return SECTION_NUMBERS;
  if (type === TYPE_WORD_LIST) return SECTION_VOCAB;
  return null;
}

/** The display label for each group, shown on its tab. */
const GROUP_LABELS: Readonly<Record<string, string>> = {
  [GROUP_TRANSFORM]: "Transform",
  [GROUP_COMBINE]: "Combine",
  [GROUP_TRANSLATE]: "To numbers",
  [GROUP_WORD_PICK]: "Pick a word",
};

/** The order the groups appear in within each section. */
const GROUP_ORDER_BY_SECTION: Readonly<Record<Section, readonly string[]>> = {
  [SECTION_NUMBERS]: [GROUP_TRANSFORM, GROUP_COMBINE],
  [SECTION_VOCAB]: [GROUP_TRANSLATE, GROUP_WORD_PICK],
};

/** One labelled row of tiles within the active section. */
export interface TileGroup {
  readonly group: string;
  readonly label: string;
  readonly tiles: readonly OpTile[];
}

/**
 * Groups the active section's tiles into labelled rows in display order, or returns no
 * rows when the chips are missing or mixed.
 * @param type The work chip value type, or null.
 * @returns The labelled tile rows for the active section.
 */
export function groupedTilesForType(type: ValueType | null): TileGroup[] {
  const section = sectionForType(type);
  if (section === null) return [];
  return GROUP_ORDER_BY_SECTION[section].map((group) => ({
    group,
    label: GROUP_LABELS[group],
    tiles: OP_TILES.filter((tile) => tile.section === section && tile.group === group),
  }));
}
