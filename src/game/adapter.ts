/**
 * Adapts a generated day specification to the reducer machine shape.
 *
 * The generator produces a day as machines whose examples and challenges are typed
 * values: a number, a list of numbers, a word, or a list of words. The reducer instead
 * speaks in chip strings, where a list is a run of chips separated by spaces. This
 * module converts a generated day for a date into that shape. It depends on the
 * generation engine, so it runs at build time inside the precompute step rather than
 * in the browser; the runtime calendar reads the precomputed result instead.
 */

import { generateDay, type DayMachine, type IoPair } from "../engine/generate";
import type { Value } from "../engine/ops";
import type { ChipPair, Machine } from "./types";

/** The separator between chips of a list when rendered as a chip string. */
const CHIP_SEPARATOR = " ";

/**
 * Renders a value as a chip string, joining the items of a list with the chip
 * separator.
 * @param value The value to render.
 * @returns The chip string.
 */
function valueToChips(value: Value): string {
  return Array.isArray(value) ? value.map(String).join(CHIP_SEPARATOR) : String(value);
}

/**
 * Converts an input and output pair to a chip pair.
 * @param pair The generated pair.
 * @returns The chip pair the reducer consumes.
 */
function pairToChipPair(pair: IoPair): ChipPair {
  return [valueToChips(pair.input), valueToChips(pair.output)];
}

/**
 * Converts a generated machine to the reducer machine shape.
 * @param machine The generated machine.
 * @returns The reducer machine.
 */
function machineFromDay(machine: DayMachine): Machine {
  return {
    rule: machine.rule,
    ex: machine.examples.map(pairToChipPair),
    ch: machine.challenges.map(pairToChipPair),
  };
}

/**
 * Generates the puzzle for a date and adapts it to the reducer machine set. Used by
 * the build time precompute step.
 * @param date The date in year month day form.
 * @returns The machines for that date.
 */
export function generateMachinesForDate(date: string): Machine[] {
  return generateDay(date).machines.map(machineFromDay);
}
