/**
 * The typed operation registry.
 *
 * A machine is a pipeline of operations, and this module is the catalogue of every
 * operation the generator may use. Each operation is data: it declares an identifier,
 * an input value type and an output value type, a difficulty rung, the parameters it
 * accepts with their inclusive ranges, a pure executable function, a plain English
 * phrase fragment for the reveal sentence, and an interestingness predicate that says
 * whether a given input makes the operation worth showing. Keeping operations as data
 * lets the composer type check pipelines, the generator draw and parameterize them,
 * the phraser describe them, and the validators reason about them, all without any
 * operation specific code outside this file.
 *
 * An operation's identity and its phrase are two halves of one thing: the phrase
 * describes exactly the operation the identifier names, and the two always change
 * together. They are therefore grouped into a single descriptor, the OpMeta, rather
 * than kept in parallel pools of identifier constants and phrase constants that have
 * to be matched up by hand. Each operation has one exported descriptor holding its
 * identifier and its phrase, and the behavior builders consume that descriptor. The
 * other meaningful literals, the value type tags and the parameter names, remain named
 * constants so the definitions read as a table of references rather than raw strings.
 *
 * Every function uses integer arithmetic and stable sorts only, and digit operations 
 * work on the decimal text of an integer so no division or floating point is involved. 
 * The same pipeline on the same input always yields the same result on every engine.
 *
 * The interestingness predicate captures only the local rule an input must satisfy
 * for the operation to teach something, such as a filter keeping some chips and
 * removing others, a median needing an odd length, or a mode needing a single most
 * frequent value. Cross operation concerns, such as one pipeline collapsing onto a
 * simpler one, live in the validators rather than here.
 */

export const TYPE_NUM_LIST = "NumList";
export const TYPE_NUM = "Num";
export const TYPE_WORD_LIST = "WordList";
export const TYPE_WORD = "Word";

/** The four value types that flow through a pipeline. */
export type ValueType = typeof TYPE_NUM_LIST | typeof TYPE_NUM | typeof TYPE_WORD_LIST | typeof TYPE_WORD;

/** A concrete value of one of the four types. */
export type Value = number | number[] | string | string[];

/** Bound parameter values for one operation instance, keyed by parameter name. */
export type Params = Readonly<Record<string, number>>;

/** A parameter an operation accepts, with the inclusive range it may take. */
export interface ParamSpec {
  readonly name: string;
  readonly min: number;
  readonly max: number;
}

/** A phrase given either as a fixed fragment or as a builder over the parameters. */
export type PhraseSource = string | ((params: Params) => string);

/**
 * The descriptive half of an operation: its stable identifier and the phrase that
 * renders it on the reveal screen. Identifier and phrase are grouped here because
 * they always describe the same operation and change together, so the registry never
 * has to keep a separate identifier and a separate phrase in agreement by hand.
 */
export interface OpMeta {
  readonly id: string;
  readonly phrase: PhraseSource;
}

/**
 * A single operation definition. The apply function transforms a value of the input
 * type into a value of the output type, the phrase function renders the operation as
 * a clause, and isInteresting reports whether an input is worth showing.
 */
export interface OpDef {
  readonly id: string;
  readonly inputType: ValueType;
  readonly outputType: ValueType;
  readonly rung: number;
  readonly params: readonly ParamSpec[];
  apply(input: Value, params: Params): Value;
  phrase(params: Params): string;
  isInteresting(input: Value, params: Params): boolean;
}

/** Parameter names shared between an operation's range, function, and phrase. */
const PARAM_K = "k";
const PARAM_A = "a";
const PARAM_B = "b";

export const OP_ADD_K: OpMeta = { id: "add_k", phrase: (params) => `adds ${params[PARAM_K]} to every chip` };
export const OP_SUB_K: OpMeta = {
  id: "sub_k",
  phrase: (params) => `takes ${params[PARAM_K]} away from every chip`,
};
export const OP_MUL_K: OpMeta = {
  id: "mul_k",
  phrase: (params) => `multiplies every chip by ${params[PARAM_K]}`,
};
export const OP_AFFINE: OpMeta = {
  id: "affine",
  phrase: (params) => `multiplies every chip by ${params[PARAM_A]}, then adds ${params[PARAM_B]}`,
};
export const OP_REVERSE_DIGITS: OpMeta = { id: "reverse_digits", phrase: "flips the digits of every chip" };
export const OP_DIGIT_SUM_MAP: OpMeta = {
  id: "digit_sum_map",
  phrase: "adds together the digits of every chip",
};
export const OP_REVERSE: OpMeta = { id: "reverse", phrase: "reverses the order" };
export const OP_SORT_ASC: OpMeta = { id: "sort_asc", phrase: "sorts the chips smallest to biggest" };
export const OP_SORT_DESC: OpMeta = { id: "sort_desc", phrase: "sorts the chips biggest to smallest" };
export const OP_SWAP_ENDS: OpMeta = { id: "swap_ends", phrase: "swaps the first and last chips" };
export const OP_ROTATE_LEFT: OpMeta = { id: "rotate_left", phrase: "moves the first chip to the end" };
export const OP_SUM: OpMeta = { id: "sum", phrase: "adds all the chips together" };
export const OP_COUNT: OpMeta = { id: "count", phrase: "counts the chips" };
export const OP_MAX: OpMeta = { id: "max", phrase: "finds the biggest chip" };
export const OP_MIN: OpMeta = { id: "min", phrase: "finds the smallest chip" };
export const OP_RANGE: OpMeta = { id: "range", phrase: "subtracts the smallest chip from the biggest" };
export const OP_PRODUCT: OpMeta = { id: "product", phrase: "multiplies all the chips together" };
export const OP_FIRST: OpMeta = { id: "first", phrase: "keeps only the first chip" };
export const OP_LAST: OpMeta = { id: "last", phrase: "keeps only the last chip" };
export const OP_MEDIAN: OpMeta = { id: "median", phrase: "sorts the chips and keeps the middle one" };
export const OP_MODE: OpMeta = { id: "mode", phrase: "keeps the chip that appears most often" };
export const OP_KEEP_EVEN: OpMeta = { id: "keep_even", phrase: "keeps only the even chips" };
export const OP_KEEP_ODD: OpMeta = { id: "keep_odd", phrase: "keeps only the odd chips" };
export const OP_KEEP_GT_K: OpMeta = {
  id: "keep_gt_k",
  phrase: (params) => `keeps only chips bigger than ${params[PARAM_K]}`,
};
export const OP_KEEP_LT_K: OpMeta = {
  id: "keep_lt_k",
  phrase: (params) => `keeps only chips smaller than ${params[PARAM_K]}`,
};
export const OP_DEDUP: OpMeta = { id: "dedup", phrase: "throws away duplicates" };
export const OP_KEEP_DUPS: OpMeta = {
  id: "keep_dups",
  phrase: "keeps only chips that appear more than once",
};
export const OP_DROP_FIRST: OpMeta = { id: "drop_first", phrase: "throws away the first chip" };
export const OP_DROP_LAST: OpMeta = { id: "drop_last", phrase: "throws away the last chip" };
export const OP_EVERY_OTHER: OpMeta = {
  id: "every_other",
  phrase: "keeps every other chip, starting with the first",
};
export const OP_KEEP_GT_FIRST: OpMeta = {
  id: "keep_gt_first",
  phrase: "keeps only chips bigger than the first one",
};
export const OP_INDEX_OF_MAX: OpMeta = {
  id: "index_of_max",
  phrase: "tells you the position of the biggest chip",
};
export const OP_DELTAS: OpMeta = { id: "deltas", phrase: "finds the gaps between neighbouring chips" };
export const OP_COUNT_DISTINCT: OpMeta = {
  id: "count_distinct",
  phrase: "counts how many different chips there are",
};
export const OP_LENGTH_MAP: OpMeta = { id: "length_map", phrase: "counts the letters in every chip" };
export const OP_VOWEL_COUNT_MAP: OpMeta = { id: "vowel_count_map", phrase: "counts the vowels in every chip" };
export const OP_FIRST_LETTER_POS: OpMeta = {
  id: "first_letter_pos",
  phrase: "reads the alphabet position of each chip's first letter",
};
export const OP_SORT_ALPHA: OpMeta = { id: "sort_alpha", phrase: "puts the chips in alphabetical order" };
export const OP_LONGEST: OpMeta = { id: "longest", phrase: "keeps the chip with the most letters" };
export const OP_KEEP_STARTSWITH_VOWEL: OpMeta = {
  id: "keep_startswith_vowel",
  phrase: "keeps chips that start with a vowel",
};

const NO_PARAMS: readonly ParamSpec[] = [];

/** The set of vowels used by the word operations. */
const VOWELS = "aeiou";

/** The lowercase alphabet, used to map a word's first letter to its position. */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** Smallest list length for an operation that needs at least two chips to be useful. */
const PAIR_LENGTH = 2;

/** Smallest list length for an operation that needs at least three chips to be useful. */
const TRIPLE_LENGTH = 3;

/** Input length and chip ceiling for the product reducer, kept small to bound the result. */
const PRODUCT_MAX_LENGTH = 3;
const PRODUCT_MAX_CHIP = 5;

const ERROR_UNKNOWN_OP = "no operation registered with id ";

/**
 * Reports whether two number lists are equal element by element.
 * @param a The first list.
 * @param b The second list.
 * @returns True when the lists have the same length and the same values in order.
 */
function listsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Reports whether two word lists are equal element by element.
 * @param a The first list.
 * @param b The second list.
 * @returns True when the lists have the same length and the same words in order.
 */
function wordListsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Returns the largest value in a non empty list.
 * @param values The list to scan.
 * @returns The maximum value.
 */
function maxOf(values: readonly number[]): number {
  return values.reduce((best, value) => Math.max(best, value), values[0]);
}

/**
 * Returns the smallest value in a non empty list.
 * @param values The list to scan.
 * @returns The minimum value.
 */
function minOf(values: readonly number[]): number {
  return values.reduce((best, value) => Math.min(best, value), values[0]);
}

/**
 * Returns a copy of a list sorted from smallest to largest using a stable sort.
 * @param values The list to sort.
 * @returns The ascending copy.
 */
function sortedAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Returns a copy of a list sorted from largest to smallest using a stable sort.
 * @param values The list to sort.
 * @returns The descending copy.
 */
function sortedDescending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => b - a);
}

/**
 * Counts how many times each value occurs in a list.
 * @param values The list to tally.
 * @returns A map from value to occurrence count.
 */
function valueCounts(values: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/**
 * Returns the value that occurs most often, breaking ties toward the value seen first.
 * @param values The list to examine.
 * @returns The most frequent value.
 */
function mostFrequentValue(values: readonly number[]): number {
  const counts = valueCounts(values);
  let bestValue = values[0];
  let bestCount = 0;
  for (const value of values) {
    const count = counts.get(value) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }
  return bestValue;
}

/**
 * Reports whether exactly one value attains the highest occurrence count above one.
 * @param values The list to examine.
 * @returns True when a single value is strictly the most frequent and repeats.
 */
function hasUniqueMode(values: readonly number[]): boolean {
  const counts = valueCounts(values);
  const highest = Math.max(...counts.values());
  if (highest < PAIR_LENGTH) return false;
  let atHighest = 0;
  for (const count of counts.values()) {
    if (count === highest) atHighest++;
  }
  return atHighest === 1;
}

/**
 * Reverses the decimal digits of an integer, dropping any leading zeros that result.
 * @param value The integer to flip.
 * @returns The integer formed by the reversed digits.
 */
function reverseDigits(value: number): number {
  return Number([...String(value)].reverse().join(""));
}

/**
 * Adds the decimal digits of an integer together.
 * @param value The integer whose digits are summed.
 * @returns The sum of the digits.
 */
function digitSum(value: number): number {
  return [...String(value)].reduce((total, digit) => total + Number(digit), 0);
}

/**
 * Counts the vowels in a word.
 * @param word The word to scan.
 * @returns The number of vowel letters.
 */
function vowelCount(word: string): number {
  return [...word.toLowerCase()].filter((letter) => VOWELS.includes(letter)).length;
}

/**
 * Returns the alphabet position of the first letter of a word, counting from one.
 * @param word The word whose first letter is measured.
 * @returns The position of the first letter, where a is one and z is twenty six.
 */
function firstLetterPosition(word: string): number {
  return ALPHABET.indexOf(word[0].toLowerCase()) + 1;
}

/**
 * Reports whether a filter that kept the given count from the given input both kept
 * at least one chip and removed at least one chip.
 * @param input The list the filter was applied to.
 * @param keptCount The number of chips the filter kept.
 * @returns True when the filter is non trivial on this input.
 */
function keepsSomeAndRemovesSome(input: readonly number[], keptCount: number): boolean {
  return keptCount >= 1 && keptCount < input.length;
}

/**
 * Normalizes a phrase source into a phrase function.
 * @param phrase The fixed fragment or builder.
 * @returns A function that renders the phrase from parameters.
 */
function toPhrase(phrase: PhraseSource): (params: Params) => string {
  return typeof phrase === "string" ? () => phrase : phrase;
}

/**
 * Builds an operation that maps a number list to a number list.
 * @param config The operation specifics, including its grouped identity and phrase.
 * @returns The operation definition.
 */
function defNumListToNumList(config: {
  op: OpMeta;
  rung: number;
  params?: readonly ParamSpec[];
  apply: (input: readonly number[], params: Params) => number[];
  isInteresting?: (input: readonly number[], params: Params) => boolean;
}): OpDef {
  return {
    id: config.op.id,
    inputType: TYPE_NUM_LIST,
    outputType: TYPE_NUM_LIST,
    rung: config.rung,
    params: config.params ?? NO_PARAMS,
    apply: (input, params) => config.apply(input as readonly number[], params),
    phrase: toPhrase(config.op.phrase),
    isInteresting: (input, params) =>
      config.isInteresting ? config.isInteresting(input as readonly number[], params) : true,
  };
}

/**
 * Builds an operation that reduces a number list to a single number.
 * @param config The operation specifics, including its grouped identity and phrase.
 * @returns The operation definition.
 */
function defNumListToNum(config: {
  op: OpMeta;
  rung: number;
  params?: readonly ParamSpec[];
  apply: (input: readonly number[], params: Params) => number;
  isInteresting?: (input: readonly number[], params: Params) => boolean;
}): OpDef {
  return {
    id: config.op.id,
    inputType: TYPE_NUM_LIST,
    outputType: TYPE_NUM,
    rung: config.rung,
    params: config.params ?? NO_PARAMS,
    apply: (input, params) => config.apply(input as readonly number[], params),
    phrase: toPhrase(config.op.phrase),
    isInteresting: (input, params) =>
      config.isInteresting ? config.isInteresting(input as readonly number[], params) : true,
  };
}

/**
 * Builds an operation that maps a word list to a number list.
 * @param config The operation specifics, including its grouped identity and phrase.
 * @returns The operation definition.
 */
function defWordListToNumList(config: {
  op: OpMeta;
  rung: number;
  apply: (input: readonly string[]) => number[];
  isInteresting?: (input: readonly string[]) => boolean;
}): OpDef {
  return {
    id: config.op.id,
    inputType: TYPE_WORD_LIST,
    outputType: TYPE_NUM_LIST,
    rung: config.rung,
    params: NO_PARAMS,
    apply: (input) => config.apply(input as readonly string[]),
    phrase: toPhrase(config.op.phrase),
    isInteresting: (input) => (config.isInteresting ? config.isInteresting(input as readonly string[]) : true),
  };
}

/**
 * Builds an operation that maps a word list to a word list.
 * @param config The operation specifics, including its grouped identity and phrase.
 * @returns The operation definition.
 */
function defWordListToWordList(config: {
  op: OpMeta;
  rung: number;
  apply: (input: readonly string[]) => string[];
  isInteresting?: (input: readonly string[]) => boolean;
}): OpDef {
  return {
    id: config.op.id,
    inputType: TYPE_WORD_LIST,
    outputType: TYPE_WORD_LIST,
    rung: config.rung,
    params: NO_PARAMS,
    apply: (input) => config.apply(input as readonly string[]),
    phrase: toPhrase(config.op.phrase),
    isInteresting: (input) => (config.isInteresting ? config.isInteresting(input as readonly string[]) : true),
  };
}

/**
 * Builds an operation that reduces a word list to a single word.
 * @param config The operation specifics, including its grouped identity and phrase.
 * @returns The operation definition.
 */
function defWordListToWord(config: {
  op: OpMeta;
  rung: number;
  apply: (input: readonly string[]) => string;
  isInteresting?: (input: readonly string[]) => boolean;
}): OpDef {
  return {
    id: config.op.id,
    inputType: TYPE_WORD_LIST,
    outputType: TYPE_WORD,
    rung: config.rung,
    params: NO_PARAMS,
    apply: (input) => config.apply(input as readonly string[]),
    phrase: toPhrase(config.op.phrase),
    isInteresting: (input) => (config.isInteresting ? config.isInteresting(input as readonly string[]) : true),
  };
}

/** Maps that transform every chip of a number list. */
const MAP_OPS: readonly OpDef[] = [
  defNumListToNumList({
    op: OP_ADD_K,
    rung: 1,
    params: [{ name: PARAM_K, min: 1, max: 5 }],
    apply: (input, params) => input.map((value) => value + params[PARAM_K]),
  }),
  defNumListToNumList({
    op: OP_SUB_K,
    rung: 1,
    params: [{ name: PARAM_K, min: 1, max: 3 }],
    apply: (input, params) => input.map((value) => value - params[PARAM_K]),
  }),
  defNumListToNumList({
    op: OP_MUL_K,
    rung: 1,
    params: [{ name: PARAM_K, min: 2, max: 3 }],
    apply: (input, params) => input.map((value) => value * params[PARAM_K]),
  }),
  defNumListToNumList({
    op: OP_AFFINE,
    rung: 2,
    params: [
      { name: PARAM_A, min: 2, max: 3 },
      { name: PARAM_B, min: 1, max: 3 },
    ],
    apply: (input, params) => input.map((value) => value * params[PARAM_A] + params[PARAM_B]),
  }),
  defNumListToNumList({
    op: OP_REVERSE_DIGITS,
    rung: 5,
    apply: (input) => input.map(reverseDigits),
    isInteresting: (input) => !listsEqual(input.map(reverseDigits), input),
  }),
  defNumListToNumList({
    op: OP_DIGIT_SUM_MAP,
    rung: 5,
    apply: (input) => input.map(digitSum),
    isInteresting: (input) => !listsEqual(input.map(digitSum), input),
  }),
];

/** Reorders that rearrange a number list without changing its contents. */
const REORDER_OPS: readonly OpDef[] = [
  defNumListToNumList({
    op: OP_REVERSE,
    rung: 1,
    apply: (input) => [...input].reverse(),
    isInteresting: (input) => !listsEqual([...input].reverse(), input),
  }),
  defNumListToNumList({
    op: OP_SORT_ASC,
    rung: 2,
    apply: (input) => sortedAscending(input),
    isInteresting: (input) => !listsEqual(sortedAscending(input), input),
  }),
  defNumListToNumList({
    op: OP_SORT_DESC,
    rung: 2,
    apply: (input) => sortedDescending(input),
    isInteresting: (input) => !listsEqual(sortedDescending(input), input),
  }),
  defNumListToNumList({
    op: OP_SWAP_ENDS,
    rung: 3,
    apply: (input) => {
      const copy = [...input];
      const lastIndex = copy.length - 1;
      const first = copy[0];
      copy[0] = copy[lastIndex];
      copy[lastIndex] = first;
      return copy;
    },
    isInteresting: (input) => input.length >= PAIR_LENGTH && input[0] !== input.at(-1),
  }),
  defNumListToNumList({
    op: OP_ROTATE_LEFT,
    rung: 3,
    apply: (input) => [...input.slice(1), input[0]],
    isInteresting: (input) => input.length >= PAIR_LENGTH && new Set(input).size > 1,
  }),
];

/** Reducers that collapse a number list to a single number. */
const REDUCER_OPS: readonly OpDef[] = [
  defNumListToNum({
    op: OP_SUM,
    rung: 2,
    apply: (input) => input.reduce((total, value) => total + value, 0),
  }),
  defNumListToNum({
    op: OP_COUNT,
    rung: 2,
    apply: (input) => input.length,
  }),
  defNumListToNum({
    op: OP_MAX,
    rung: 2,
    apply: (input) => maxOf(input),
  }),
  defNumListToNum({
    op: OP_MIN,
    rung: 2,
    apply: (input) => minOf(input),
  }),
  defNumListToNum({
    op: OP_RANGE,
    rung: 3,
    apply: (input) => maxOf(input) - minOf(input),
    isInteresting: (input) => maxOf(input) !== minOf(input),
  }),
  defNumListToNum({
    op: OP_PRODUCT,
    rung: 3,
    apply: (input) => input.reduce((total, value) => total * value, 1),
    isInteresting: (input) =>
      input.length >= PAIR_LENGTH &&
      input.length <= PRODUCT_MAX_LENGTH &&
      input.every((value) => value <= PRODUCT_MAX_CHIP),
  }),
  defNumListToNum({
    op: OP_FIRST,
    rung: 1,
    apply: (input) => input[0],
    isInteresting: (input) => input.length >= PAIR_LENGTH,
  }),
  defNumListToNum({
    op: OP_LAST,
    rung: 1,
    apply: (input) => input[input.length - 1],
    isInteresting: (input) => input.length >= PAIR_LENGTH,
  }),
  defNumListToNum({
    op: OP_MEDIAN,
    rung: 3,
    apply: (input) => sortedAscending(input)[(input.length - 1) >> 1],
    isInteresting: (input) => input.length >= TRIPLE_LENGTH && input.length % 2 === 1,
  }),
  defNumListToNum({
    op: OP_MODE,
    rung: 4,
    apply: (input) => mostFrequentValue(input),
    isInteresting: (input) => hasUniqueMode(input),
  }),
];

/** Filters that drop some chips from a number list. */
const FILTER_OPS: readonly OpDef[] = [
  defNumListToNumList({
    op: OP_KEEP_EVEN,
    rung: 3,
    apply: (input) => input.filter((value) => value % 2 === 0),
    isInteresting: (input) => keepsSomeAndRemovesSome(input, input.filter((value) => value % 2 === 0).length),
  }),
  defNumListToNumList({
    op: OP_KEEP_ODD,
    rung: 3,
    apply: (input) => input.filter((value) => value % 2 === 1),
    isInteresting: (input) => keepsSomeAndRemovesSome(input, input.filter((value) => value % 2 === 1).length),
  }),
  defNumListToNumList({
    op: OP_KEEP_GT_K,
    rung: 3,
    params: [{ name: PARAM_K, min: 3, max: 9 }],
    apply: (input, params) => input.filter((value) => value > params[PARAM_K]),
    isInteresting: (input, params) =>
      keepsSomeAndRemovesSome(input, input.filter((value) => value > params[PARAM_K]).length),
  }),
  defNumListToNumList({
    op: OP_KEEP_LT_K,
    rung: 3,
    params: [{ name: PARAM_K, min: 3, max: 9 }],
    apply: (input, params) => input.filter((value) => value < params[PARAM_K]),
    isInteresting: (input, params) =>
      keepsSomeAndRemovesSome(input, input.filter((value) => value < params[PARAM_K]).length),
  }),
  defNumListToNumList({
    op: OP_DEDUP,
    rung: 3,
    apply: (input) => [...new Set(input)],
    isInteresting: (input) => new Set(input).size < input.length,
  }),
  defNumListToNumList({
    op: OP_KEEP_DUPS,
    rung: 4,
    apply: (input) => {
      const counts = valueCounts(input);
      return input.filter((value) => (counts.get(value) ?? 0) > 1);
    },
    isInteresting: (input) => {
      const counts = valueCounts(input);
      return keepsSomeAndRemovesSome(input, input.filter((value) => (counts.get(value) ?? 0) > 1).length);
    },
  }),
  defNumListToNumList({
    op: OP_DROP_FIRST,
    rung: 2,
    apply: (input) => input.slice(1),
    isInteresting: (input) => input.length >= PAIR_LENGTH,
  }),
  defNumListToNumList({
    op: OP_DROP_LAST,
    rung: 2,
    apply: (input) => input.slice(0, -1),
    isInteresting: (input) => input.length >= PAIR_LENGTH,
  }),
  defNumListToNumList({
    op: OP_EVERY_OTHER,
    rung: 4,
    apply: (input) => input.filter((_value, index) => index % 2 === 0),
    isInteresting: (input) => input.length >= TRIPLE_LENGTH,
  }),
];

/** Relational operations whose result depends on comparisons across the chips. */
const RELATIONAL_OPS: readonly OpDef[] = [
  defNumListToNumList({
    op: OP_KEEP_GT_FIRST,
    rung: 4,
    apply: (input) => input.filter((value) => value > input[0]),
    isInteresting: (input) => keepsSomeAndRemovesSome(input, input.filter((value) => value > input[0]).length),
  }),
  defNumListToNum({
    op: OP_INDEX_OF_MAX,
    rung: 4,
    apply: (input) => input.indexOf(maxOf(input)) + 1,
    isInteresting: (input) => input.filter((value) => value === maxOf(input)).length === 1,
  }),
  defNumListToNumList({
    op: OP_DELTAS,
    rung: 5,
    apply: (input) => input.slice(1).map((value, index) => Math.abs(value - input[index])),
    isInteresting: (input) => input.length >= TRIPLE_LENGTH,
  }),
  defNumListToNum({
    op: OP_COUNT_DISTINCT,
    rung: 4,
    apply: (input) => new Set(input).size,
    isInteresting: (input) => new Set(input).size < input.length,
  }),
];

/** Word operations that read chips as words rather than numbers. */
const WORD_OPS: readonly OpDef[] = [
  defWordListToNumList({
    op: OP_LENGTH_MAP,
    rung: 4,
    apply: (input) => input.map((word) => word.length),
    isInteresting: (input) => new Set(input.map((word) => word.length)).size > 1,
  }),
  defWordListToNumList({
    op: OP_VOWEL_COUNT_MAP,
    rung: 5,
    apply: (input) => input.map(vowelCount),
    isInteresting: (input) => new Set(input.map(vowelCount)).size > 1,
  }),
  defWordListToNumList({
    op: OP_FIRST_LETTER_POS,
    rung: 5,
    apply: (input) => input.map(firstLetterPosition),
    isInteresting: (input) => new Set(input.map(firstLetterPosition)).size > 1,
  }),
  defWordListToWordList({
    op: OP_SORT_ALPHA,
    rung: 3,
    apply: (input) => [...input].sort((a, b) => a.localeCompare(b)),
    isInteresting: (input) => !wordListsEqual([...input].sort((a, b) => a.localeCompare(b)), input),
  }),
  defWordListToWord({
    op: OP_LONGEST,
    rung: 3,
    apply: (input) => input.reduce((best, word) => (word.length > best.length ? word : best), input[0]),
    isInteresting: (input) => {
      const longestLength = maxOf(input.map((word) => word.length));
      return input.filter((word) => word.length === longestLength).length === 1;
    },
  }),
  defWordListToWordList({
    op: OP_KEEP_STARTSWITH_VOWEL,
    rung: 4,
    apply: (input) => input.filter((word) => VOWELS.includes(word[0].toLowerCase())),
    isInteresting: (input) => {
      const kept = input.filter((word) => VOWELS.includes(word[0].toLowerCase())).length;
      return kept >= 1 && kept < input.length;
    },
  }),
];

/** Every operation the generator may use, in a stable order. */
export const REGISTRY: readonly OpDef[] = [
  ...MAP_OPS,
  ...REORDER_OPS,
  ...REDUCER_OPS,
  ...FILTER_OPS,
  ...RELATIONAL_OPS,
  ...WORD_OPS,
];

const REGISTRY_BY_ID: ReadonlyMap<string, OpDef> = new Map(REGISTRY.map((op) => [op.id, op]));

/**
 * Looks up an operation by identifier.
 * @param id The operation identifier.
 * @returns The operation definition.
 */
export function getOp(id: string): OpDef {
  const op = REGISTRY_BY_ID.get(id);
  if (!op) throw new Error(ERROR_UNKNOWN_OP + id);
  return op;
}
