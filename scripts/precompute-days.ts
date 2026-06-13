import { mkdirSync, writeFileSync } from "node:fs";
import { generateMachinesForDate } from "../src/game/adapter";
import type { Machine } from "../src/game/types";

/**
 * Build time precompute. Generates the reducer machine set for a fixed window of dates
 * and writes them to a bundled JSON file. The browser then loads that JSON and never
 * runs the generation engine or builds the behavior universe, so the page is
 * interactive instantly instead of pausing while the universe is computed.
 *
 * The window is fixed here so the output is deterministic and reviewable in version
 * control. A production deployment would regenerate a forward window relative to the
 * release date on a schedule.
 */

const WINDOW_START = "2026-06-08";
const WINDOW_DAYS = 100;
const OUTPUT_DIR = "src/data";
const OUTPUT_PATH = "src/data/days.json";
const MS_PER_DAY = 86400000;
const MONTH_OFFSET = 1;
const DATE_FIELD_WIDTH = 2;
const DATE_PAD_CHAR = "0";

function shiftDate(date: string, days: number): string {
  const parts = date.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(parts.at(0) ?? 0, (parts.at(1) ?? MONTH_OFFSET) - MONTH_OFFSET, parts.at(2) ?? MONTH_OFFSET) +
      days * MS_PER_DAY,
  );
  const pad = (value: number): string => String(value).padStart(DATE_FIELD_WIDTH, DATE_PAD_CHAR);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + MONTH_OFFSET)}-${pad(shifted.getUTCDate())}`;
}

const days: Record<string, Machine[]> = {};
for (let dayIndex = 0; dayIndex < WINDOW_DAYS; dayIndex++) {
  const date = shiftDate(WINDOW_START, dayIndex);
  days[date] = generateMachinesForDate(date);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(days, null, 2) + "\n");
console.log(`precomputed ${WINDOW_DAYS} days from ${WINDOW_START} to ${OUTPUT_PATH}`);
