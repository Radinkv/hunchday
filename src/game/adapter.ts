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
import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_SUPER_EASY,
  type ChipPair,
  type Difficulty,
  type Machine,
} from "./types";

/** The separator between chips of a list when rendered as a chip string. */
const CHIP_SEPARATOR = " ";

/**
 * The difficulty shown to the player, by slot position, so the tier rises across the day regardless
 * of the generation grammar. The generator labels the high rung word machine "hard" and the
 * multi-step numeric machine "medium", but the player meets the words machine third and the tougher
 * multi-step numeric last, so the displayed tiers are pinned to position: the third machine reads as
 * medium and the fourth, the multi-step numeric finale, reads as hard. This also sets the per
 * difficulty test budget and miss limit, so the finale grants the extra probe and forgiving guess.
 */
const DIFFICULTY_BY_SLOT: readonly Difficulty[] = [
  DIFFICULTY_SUPER_EASY,
  DIFFICULTY_EASY,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_HARD,
];

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
 * Converts a generated machine to the reducer machine shape, pinning the displayed difficulty to
 * the slot position rather than the generation label.
 * @param machine The generated machine.
 * @param slot The slot position the machine occupies in the day.
 * @returns The reducer machine.
 */
function machineFromDay(machine: DayMachine, slot: number): Machine {
  return {
    difficulty: DIFFICULTY_BY_SLOT[slot] ?? machine.difficulty,
    rule: machine.rule,
    ex: machine.examples.map(pairToChipPair),
    ch: machine.challenges.map(pairToChipPair),
    panelOps: machine.panelOps,
    steps: machine.steps.map((pipelineStep) => ({ opId: pipelineStep.opId, params: pipelineStep.params })),
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
