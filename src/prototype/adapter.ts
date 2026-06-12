/**
 * Adapts a generated day specification to the prototype game loop.
 *
 * The generator produces a day as machines whose examples and challenges are typed
 * values: a number, a list of numbers, a word, or a list of words. The prototype
 * reducer instead speaks in chip strings, where a list is a run of chips separated by
 * spaces. This module converts a generated day for a date into the machine shape the
 * reducer consumes, and resolves the player's local date, so the page can render the
 * real puzzle for today instead of the hardcoded sample set.
 */

import { generateDay, type DayMachine, type IoPair } from "../engine/generate";
import type { Value } from "../engine/ops";
import type { ChipPair, Machine } from "./types";

/** The separator between chips of a list when rendered as a chip string. */
const CHIP_SEPARATOR = " ";

/** The separator between the fields of a date string. */
const DATE_SEPARATOR = "-";

/** The width each numeric date field is padded to. */
const DATE_FIELD_WIDTH = 2;

/** The character used to pad a date field. */
const DATE_PAD_CHAR = "0";

/** The offset between a zero based month and its calendar number. */
const MONTH_OFFSET = 1;

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
 * Generates the puzzle for a date and adapts it to the reducer machine set.
 * @param date The date in year month day form.
 * @returns The machines for that date.
 */
export function machinesForDate(date: string): Machine[] {
  return generateDay(date).machines.map(machineFromDay);
}

/**
 * Resolves the player's local calendar date in year month day form, so every player
 * sharing a local date plays the same puzzle.
 * @returns The local date string.
 */
export function todayDate(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(DATE_FIELD_WIDTH, DATE_PAD_CHAR);
  return [String(now.getFullYear()), pad(now.getMonth() + MONTH_OFFSET), pad(now.getDate())].join(
    DATE_SEPARATOR,
  );
}
