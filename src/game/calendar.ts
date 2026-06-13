/**
 * The runtime calendar. It serves the puzzle for a date from the precomputed day data
 * bundled with the application, so the browser never runs the generation engine or
 * builds the behavior universe. It resolves the player's local date and, if a date
 * falls outside the precomputed window, serves the closest available day so the game
 * is always playable. This module has no dependency on the engine, which keeps it out
 * of the client bundle.
 */

import daysData from "../data/days.json";
import type { Machine } from "./types";

/** The precomputed machine sets, keyed by date, as a typed view of the bundled data. */
const DAYS = daysData as unknown as Record<string, readonly Machine[]>;

/** The precomputed dates in ascending order, used to find the closest available day. */
const SORTED_DATES = Object.keys(DAYS).sort((a, b) => a.localeCompare(b));

const DATE_SEPARATOR = "-";
const DATE_FIELD_WIDTH = 2;
const DATE_PAD_CHAR = "0";
const MONTH_OFFSET = 1;

const NO_MACHINES: readonly Machine[] = [];

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

/**
 * Returns the machines for the latest precomputed date that is not after the given
 * date, falling back to the earliest precomputed date when the given date precedes the
 * window.
 * @param date The requested date.
 * @returns The machines for the closest available day.
 */
function closestMachines(date: string): readonly Machine[] {
  let chosenDate = SORTED_DATES.at(0) ?? date;
  for (const availableDate of SORTED_DATES) {
    if (availableDate <= date) chosenDate = availableDate;
    else break;
  }
  return DAYS[chosenDate] ?? NO_MACHINES;
}

/**
 * Returns the machines for a date from the precomputed window, or the closest
 * available day when the date is outside the window.
 * @param date The date in year month day form.
 * @returns The machines for that date.
 */
export function machinesForDate(date: string): readonly Machine[] {
  return DAYS[date] ?? closestMachines(date);
}
