/**
 * The stateful chip model for the answer builder.
 *
 * The player reshapes the question's chips into a prediction by applying operations and
 * by moving chips between two lanes: a work lane that is the prediction, and a set aside
 * lane that holds chips left out of it. Operations act only on the work lane, so a chip
 * set aside is off the table and untouched until it is brought back, which is how the
 * player keeps some chips out of a bulk transform. The model is pure so the freeze, the
 * lane moves, and the operation results can be tested without a browser, and it reuses
 * the engine's own operation functions so a built answer matches what the machine would
 * produce.
 */

import { getOp } from "../engine/ops";
import { TYPE_NUM_LIST, TYPE_WORD_LIST, type Params, type Value, type ValueType } from "../engine/ops-types";
import { tokenize } from "../game/reducer";

/** A chip value: a single number or a single word. */
export type ChipValue = number | string;

/** One chip with a stable identity and its current value. */
export interface Chip {
  readonly id: number;
  readonly value: ChipValue;
}

/** The builder state: the prediction chips, the chips set aside, and the next chip id. */
export interface ChipState {
  readonly work: readonly Chip[];
  readonly bucket: readonly Chip[];
  readonly nextId: number;
}

/** A regular expression that recognizes a chip token made only of digits. */
const NUMERIC_TOKEN = /^\d+$/;

/**
 * Seeds the builder state from a question's input chip string, placing every chip in
 * the work lane. Tokenizing matches how the reducer compares answers, and an all digit
 * input becomes number chips while anything else becomes word chips.
 * @param input The space separated input chip string.
 * @returns The seeded state.
 */
export function seedChips(input: string): ChipState {
  const tokens = tokenize(input);
  const numeric = tokens.every((token) => NUMERIC_TOKEN.test(token));
  const work = tokens.map((token, index) => ({ id: index, value: numeric ? Number(token) : token }));
  return { work, bucket: [], nextId: tokens.length };
}

/**
 * Returns the value type of the work chips, or null when the work lane is empty or
 * holds a mix of numbers and words that no operation can act on.
 * @param state The builder state.
 * @returns The work value type, or null.
 */
export function workType(state: ChipState): ValueType | null {
  if (state.work.length === 0) return null;
  if (state.work.every((chip) => typeof chip.value === "number")) return TYPE_NUM_LIST;
  if (state.work.every((chip) => typeof chip.value === "string")) return TYPE_WORD_LIST;
  return null;
}

/**
 * Applies an operation to the work lane, leaving the set aside lane untouched. A
 * transform that keeps the chip count updates each chip's value in place, an operation
 * that changes the count produces fresh chips, and a reduction to a single value leaves
 * one chip. A mixed or empty work lane is returned unchanged.
 * @param state The builder state.
 * @param opId The operation to apply.
 * @param params The bound parameters.
 * @returns The state with the work lane transformed.
 */
export function applyOp(state: ChipState, opId: string, params: Params): ChipState {
  if (workType(state) === null) return state;
  const result = getOp(opId).apply(state.work.map((chip) => chip.value) as Value, params);
  let nextId = state.nextId;
  let work: Chip[];
  if (Array.isArray(result)) {
    if (result.length === state.work.length) {
      work = state.work.map((chip, index) => ({ id: chip.id, value: result[index] }));
    } else {
      work = result.map((value) => ({ id: nextId++, value }));
    }
  } else {
    work = [{ id: nextId++, value: result }];
  }
  return { work, bucket: state.bucket, nextId };
}

/**
 * Moves a work chip to the set aside lane, taking it out of the prediction.
 * @param state The builder state.
 * @param id The chip to set aside.
 * @returns The state with the chip set aside, or unchanged when it is not in the work lane.
 */
export function setAside(state: ChipState, id: number): ChipState {
  const chip = state.work.find((candidate) => candidate.id === id);
  if (!chip) return state;
  return {
    work: state.work.filter((candidate) => candidate.id !== id),
    bucket: [...state.bucket, chip],
    nextId: state.nextId,
  };
}

/**
 * Returns a set aside chip to the work lane at the given position, putting it back into
 * the prediction exactly as it was set aside.
 * @param state The builder state.
 * @param id The chip to return.
 * @param index The work lane position to insert at, clamped into range.
 * @returns The state with the chip returned, or unchanged when it is not set aside.
 */
export function bringBack(state: ChipState, id: number, index: number): ChipState {
  const chip = state.bucket.find((candidate) => candidate.id === id);
  if (!chip) return state;
  const work = [...state.work];
  work.splice(clampIndex(index, work.length), 0, chip);
  return { work, bucket: state.bucket.filter((candidate) => candidate.id !== id), nextId: state.nextId };
}

/**
 * Moves a work chip to a new position in the work lane.
 * @param state The builder state.
 * @param id The chip to move.
 * @param index The target position, clamped into range.
 * @returns The state with the chip reordered, or unchanged when it is not in the work lane.
 */
export function reorder(state: ChipState, id: number, index: number): ChipState {
  const from = state.work.findIndex((candidate) => candidate.id === id);
  if (from < 0) return state;
  const work = [...state.work];
  const [chip] = work.splice(from, 1);
  work.splice(clampIndex(index, work.length), 0, chip);
  return { work, bucket: state.bucket, nextId: state.nextId };
}

/**
 * Clamps a target index into the inclusive insertion range of a list.
 * @param index The requested index.
 * @param length The current list length.
 * @returns The clamped index.
 */
function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

/**
 * Builds the answer string from the work lane, the chips in order joined by spaces, so
 * it matches the string the reducer compares.
 * @param state The builder state.
 * @returns The answer string.
 */
export function answerOf(state: ChipState): string {
  return state.work.map((chip) => String(chip.value)).join(" ");
}
