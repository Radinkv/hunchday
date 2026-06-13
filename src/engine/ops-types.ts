/**
 * Shared operation contracts and value tags.
 *
 * This module defines the stable type vocabulary that the engine layers share:
 * value type tags, runtime value unions, parameter shapes, and operation contracts.
 * Keeping these contracts separate from the concrete registry lets modules depend on
 * the common shape without importing the full operation catalogue.
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
 * renders it on the reveal screen.
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
