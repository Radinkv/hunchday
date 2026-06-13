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

/**
 * The intuitive tabs the picker sorts operations into. These read like the headings in
 * a short machine manual, so a player with a hunch can find the operation they want
 * without learning the engine: keep first and keep last live under Keep, not Order.
 */
export const GROUP_MATH = "math";
export const GROUP_LETTERS = "letters";
export const GROUP_REORDER = "reorder";
export const GROUP_KEEP = "keep";
export const GROUP_PICK_ONE = "pickone";
export const GROUP_TOTALS = "totals";

/**
 * One palette tile: the operation it applies, the section it belongs to, the tab it is
 * filed under, and its single parameter when it has one.
 */
export interface OpTile {
  readonly opId: string;
  readonly section: Section;
  readonly group: string;
  readonly param?: ParamSpec;
}

/** The tab authored for each tiled operation, keyed by operation. */
interface TileInfo {
  readonly op: OpMeta;
  readonly group: string;
}

/**
 * The tile authoring table. Every operation except affine appears exactly once; the
 * section is derived from the operation's input type rather than repeated here.
 */
const TILE_INFO: readonly TileInfo[] = [
  { op: OP_ADD_K, group: GROUP_MATH },
  { op: OP_SUB_K, group: GROUP_MATH },
  { op: OP_MUL_K, group: GROUP_MATH },
  { op: OP_DIGIT_SUM_MAP, group: GROUP_MATH },
  { op: OP_REVERSE_DIGITS, group: GROUP_MATH },
  { op: OP_UNITS_DIGIT, group: GROUP_MATH },
  { op: OP_MIN_NORMALIZE, group: GROUP_MATH },
  { op: OP_RUNNING_TOTAL, group: GROUP_MATH },
  { op: OP_DELTAS, group: GROUP_MATH },

  { op: OP_LENGTH_MAP, group: GROUP_LETTERS },
  { op: OP_VOWEL_COUNT_MAP, group: GROUP_LETTERS },
  { op: OP_DISTINCT_LETTERS_MAP, group: GROUP_LETTERS },
  { op: OP_LETTER_COUNT_SQUARED, group: GROUP_LETTERS },
  { op: OP_FIRST_LETTER_POS, group: GROUP_LETTERS },
  { op: OP_LAST_LETTER_POS, group: GROUP_LETTERS },

  { op: OP_REVERSE, group: GROUP_REORDER },
  { op: OP_SORT_ASC, group: GROUP_REORDER },
  { op: OP_SORT_DESC, group: GROUP_REORDER },
  { op: OP_SWAP_ENDS, group: GROUP_REORDER },
  { op: OP_ROTATE_LEFT, group: GROUP_REORDER },
  { op: OP_SORT_ALPHA, group: GROUP_REORDER },
  { op: OP_SORT_BY_LENGTH, group: GROUP_REORDER },

  { op: OP_KEEP_FIRST_K, group: GROUP_KEEP },
  { op: OP_KEEP_LAST_K, group: GROUP_KEEP },
  { op: OP_KEEP_EVEN, group: GROUP_KEEP },
  { op: OP_KEEP_ODD, group: GROUP_KEEP },
  { op: OP_KEEP_GT_K, group: GROUP_KEEP },
  { op: OP_KEEP_LT_K, group: GROUP_KEEP },
  { op: OP_KEEP_GT_FIRST, group: GROUP_KEEP },
  { op: OP_KEEP_DUPS, group: GROUP_KEEP },
  { op: OP_DEDUP, group: GROUP_KEEP },
  { op: OP_DROP_FIRST, group: GROUP_KEEP },
  { op: OP_DROP_LAST, group: GROUP_KEEP },
  { op: OP_EVERY_OTHER, group: GROUP_KEEP },
  { op: OP_KEEP_STARTSWITH_VOWEL, group: GROUP_KEEP },

  { op: OP_FIRST, group: GROUP_PICK_ONE },
  { op: OP_LAST, group: GROUP_PICK_ONE },
  { op: OP_MAX, group: GROUP_PICK_ONE },
  { op: OP_MIN, group: GROUP_PICK_ONE },
  { op: OP_MEDIAN, group: GROUP_PICK_ONE },
  { op: OP_MODE, group: GROUP_PICK_ONE },
  { op: OP_SECOND_LARGEST, group: GROUP_PICK_ONE },
  { op: OP_LONGEST, group: GROUP_PICK_ONE },
  { op: OP_SHORTEST, group: GROUP_PICK_ONE },

  { op: OP_SUM, group: GROUP_TOTALS },
  { op: OP_COUNT, group: GROUP_TOTALS },
  { op: OP_PRODUCT, group: GROUP_TOTALS },
  { op: OP_RANGE, group: GROUP_TOTALS },
  { op: OP_COUNT_EVEN, group: GROUP_TOTALS },
  { op: OP_COUNT_DISTINCT, group: GROUP_TOTALS },
  { op: OP_INDEX_OF_MAX, group: GROUP_TOTALS },
];

/**
 * Extra words a player might type to find an operation, keyed by operation id. These are
 * everyday synonyms and turns of phrase rather than the engine's wording, so searching
 * "double", "head", or "spread" lands on the right operation even when its formal phrase
 * uses none of those words. They double as a plain language gloss of what each does.
 */
const SEARCH_TERMS: Readonly<Record<string, readonly string[]>> = {
  [OP_ADD_K.id]: ["add", "plus", "increase", "increment", "raise", "more"],
  [OP_SUB_K.id]: ["subtract", "minus", "take away", "decrease", "reduce", "lower", "less"],
  [OP_MUL_K.id]: ["multiply", "times", "scale", "double", "triple", "grow"],
  [OP_DIGIT_SUM_MAP.id]: ["digit sum", "add the digits", "sum of digits"],
  [OP_REVERSE_DIGITS.id]: ["flip the digits", "reverse digits", "mirror digits", "swap digits"],
  [OP_UNITS_DIGIT.id]: ["last digit", "ones digit", "units", "final digit", "ending digit"],
  [OP_MIN_NORMALIZE.id]: ["subtract the smallest", "subtract min", "normalize", "offset", "shift down"],
  [OP_RUNNING_TOTAL.id]: ["running total", "cumulative", "accumulate", "prefix sum", "add up so far"],
  [OP_DELTAS.id]: ["gaps", "differences", "deltas", "steps", "change between", "spacing", "intervals"],

  [OP_LENGTH_MAP.id]: ["count letters", "length", "how long", "word length", "size"],
  [OP_VOWEL_COUNT_MAP.id]: ["count vowels", "vowels", "aeiou"],
  [OP_DISTINCT_LETTERS_MAP.id]: ["different letters", "unique letters", "distinct letters", "variety"],
  [OP_LETTER_COUNT_SQUARED.id]: ["letters squared", "length squared", "square the letters"],
  [OP_FIRST_LETTER_POS.id]: ["first letter position", "alphabet position", "first letter number", "a is 1"],
  [OP_LAST_LETTER_POS.id]: ["last letter position", "alphabet position", "last letter number"],

  [OP_REVERSE.id]: ["reverse", "backwards", "mirror", "flip", "invert", "last to first"],
  [OP_SORT_ASC.id]: ["sort", "ascending", "smallest first", "low to high", "increasing", "order up"],
  [OP_SORT_DESC.id]: ["sort", "descending", "biggest first", "high to low", "decreasing", "order down"],
  [OP_SWAP_ENDS.id]: ["swap ends", "swap first and last", "exchange ends", "switch ends"],
  [OP_ROTATE_LEFT.id]: ["rotate", "shift", "cycle", "move first to end", "spin"],
  [OP_SORT_ALPHA.id]: ["alphabetical", "a to z", "abc", "dictionary order", "sort words"],
  [OP_SORT_BY_LENGTH.id]: ["by length", "shortest first", "sort by size", "length order"],

  [OP_KEEP_FIRST_K.id]: ["keep first", "first few", "first n", "take first", "head", "top", "beginning", "leading"],
  [OP_KEEP_LAST_K.id]: ["keep last", "last few", "last n", "take last", "tail", "end", "trailing"],
  [OP_KEEP_EVEN.id]: ["keep even", "evens", "divisible by two"],
  [OP_KEEP_ODD.id]: ["keep odd", "odds", "not even"],
  [OP_KEEP_GT_K.id]: ["keep bigger", "greater than", "more than", "above", "over", "larger than"],
  [OP_KEEP_LT_K.id]: ["keep smaller", "less than", "under", "below", "fewer than"],
  [OP_KEEP_GT_FIRST.id]: ["bigger than first", "greater than first", "above the first"],
  [OP_KEEP_DUPS.id]: ["keep duplicates", "repeats", "duplicates", "repeated"],
  [OP_DEDUP.id]: ["remove duplicates", "dedupe", "unique", "distinct", "no repeats"],
  [OP_DROP_FIRST.id]: ["drop first", "remove first", "skip first", "without the first"],
  [OP_DROP_LAST.id]: ["drop last", "remove last", "skip last", "without the last"],
  [OP_EVERY_OTHER.id]: ["every other", "alternate", "skip one", "every second"],
  [OP_KEEP_STARTSWITH_VOWEL.id]: ["starts with vowel", "vowel start", "begins with a vowel", "aeiou start"],

  [OP_FIRST.id]: ["first", "head", "beginning", "front"],
  [OP_LAST.id]: ["last", "end", "tail", "back"],
  [OP_MAX.id]: ["biggest", "max", "maximum", "largest", "highest", "greatest", "top"],
  [OP_MIN.id]: ["smallest", "min", "minimum", "lowest", "least"],
  [OP_MEDIAN.id]: ["median", "middle", "center", "midpoint"],
  [OP_MODE.id]: ["most common", "mode", "frequent", "popular", "appears most"],
  [OP_SECOND_LARGEST.id]: ["second biggest", "second largest", "runner up", "next biggest"],
  [OP_LONGEST.id]: ["longest", "biggest word", "most letters"],
  [OP_SHORTEST.id]: ["shortest", "smallest word", "fewest letters"],

  [OP_SUM.id]: ["sum", "total", "add all", "add up", "combine", "altogether"],
  [OP_COUNT.id]: ["count", "how many", "number of", "tally", "quantity"],
  [OP_PRODUCT.id]: ["product", "multiply all", "times all", "multiplied together"],
  [OP_RANGE.id]: ["range", "spread", "biggest minus smallest", "max minus min"],
  [OP_COUNT_EVEN.id]: ["how many even", "number of evens", "count evens"],
  [OP_COUNT_DISTINCT.id]: ["how many different", "distinct count", "unique count", "variety"],
  [OP_INDEX_OF_MAX.id]: ["position of the biggest", "where the biggest is", "index of max", "location of max"],
};

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
    const base: OpTile = { opId: op.id, section, group: info.group };
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
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/** The label shown on each tab. */
const GROUP_LABELS: Readonly<Record<string, string>> = {
  [GROUP_MATH]: "Math",
  [GROUP_LETTERS]: "Letters",
  [GROUP_REORDER]: "Reorder",
  [GROUP_KEEP]: "Keep & drop",
  [GROUP_PICK_ONE]: "Pick one",
  [GROUP_TOTALS]: "Totals",
};

/** The order the tabs appear in within each section. */
const GROUP_ORDER_BY_SECTION: Readonly<Record<Section, readonly string[]>> = {
  [SECTION_NUMBERS]: [GROUP_MATH, GROUP_REORDER, GROUP_KEEP, GROUP_PICK_ONE, GROUP_TOTALS],
  [SECTION_VOCAB]: [GROUP_LETTERS, GROUP_REORDER, GROUP_KEEP, GROUP_PICK_ONE],
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

/** The match scores a query term earns against a tile, best first. */
const SCORE_NONE = 0;
const SCORE_SUBSTRING = 1;
const SCORE_WORD_PREFIX = 2;
const SCORE_WORD_EXACT = 3;
const SCORE_PRIMARY = 5;

/** The position of an operation's headline synonym within its search term list. */
const PRIMARY_TERM_INDEX = 0;

/**
 * Builds the lowercased text a tile is searched against: its phrase, its tab label, and
 * its authored search terms, so a query can match the wording, the category, or a synonym.
 * @param tile The tile to describe.
 * @returns The searchable text.
 */
function searchableText(tile: OpTile): string {
  const op = getOp(tile.opId);
  const params = tile.param ? { [tile.param.name]: tile.param.min } : {};
  const terms = SEARCH_TERMS[tile.opId] ?? [];
  return [op.phrase(params), GROUP_LABELS[tile.group], ...terms].join(" ").toLowerCase();
}

/** Splits a query into the lowercased terms a tile must contain to match. */
function queryTerms(query: string): string[] {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** The words of an operation's headline synonym, the strongest signal of what it is for. */
function primaryWords(tile: OpTile): readonly string[] {
  const primary = (SEARCH_TERMS[tile.opId] ?? [])[PRIMARY_TERM_INDEX] ?? "";
  return primary.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Scores a tile against the query terms, requiring every term to appear and rewarding a
 * whole word or word prefix over a bare substring, and a match on the operation's
 * headline synonym above all, or zero when a term is absent.
 * @param text The tile's searchable text.
 * @param primary The words of the tile's headline synonym.
 * @param terms The query terms.
 * @returns The total score, or zero when the tile does not match every term.
 */
function scoreTile(text: string, primary: readonly string[], terms: readonly string[]): number {
  const words = text.split(/\s+/);
  let total = SCORE_NONE;
  for (const term of terms) {
    let best = SCORE_NONE;
    if (words.includes(term)) best = SCORE_WORD_EXACT;
    else if (words.some((word) => word.startsWith(term))) best = SCORE_WORD_PREFIX;
    else if (text.includes(term)) best = SCORE_SUBSTRING;
    if (best === SCORE_NONE) return SCORE_NONE;
    if (primary.some((word) => word === term || word.startsWith(term))) best = SCORE_PRIMARY;
    total += best;
  }
  return total;
}

/**
 * Searches the operations valid for the current chip type, returning those that match
 * every query term ordered by how well they match. An empty query matches nothing, so
 * the caller can fall back to the browseable tabs.
 * @param type The running value type.
 * @param query The raw search query.
 * @returns The matching tiles, best match first.
 */
export function searchTiles(type: ValueType, query: string): readonly OpTile[] {
  const terms = queryTerms(query);
  const section = sectionForType(type);
  if (terms.length === 0 || section === null) return NO_TILES;
  return OP_TILES.filter((tile) => tile.section === section)
    .map((tile) => ({ tile, score: scoreTile(searchableText(tile), primaryWords(tile), terms) }))
    .filter((entry) => entry.score > SCORE_NONE)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.tile);
}
