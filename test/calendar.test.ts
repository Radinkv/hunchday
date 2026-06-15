import { describe, expect, it } from "vitest";
import { machinesForDate, todayDate } from "../src/game/calendar";
import daysData from "../src/data/days.json";
import type { Machine } from "../src/game/types";

/**
 * These tests cover the runtime calendar, which serves precomputed days without the
 * generation engine. A date in the window returns its four machines, a date outside
 * the window falls back to the closest available day, and the local date is well
 * formed. A final invariant scans the whole precomputed window to guard the five chip
 * working memory rule: no machine may pose an input wider than five chips.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IN_WINDOW_DATE = "2026-06-20";
const BEFORE_WINDOW_DATE = "2020-01-01";
const AFTER_WINDOW_DATE = "2030-01-01";
const EXPECTED_MACHINE_COUNT = 4;

/** The permanent ceiling on how many chips an input may show, the five chip rule. */
const MAX_INPUT_CHIPS = 5;
const CHIP_SEPARATOR = " ";
const PAIR_INPUT_INDEX = 0;

/** Every precomputed day keyed by date, as a typed view of the bundled data. */
const ALL_DAYS = daysData as unknown as Record<string, readonly Machine[]>;

describe("todayDate", () => {
  it("returns a year month day string", () => {
    expect(todayDate()).toMatch(DATE_PATTERN);
  });
});

describe("machinesForDate", () => {
  it("serves four machines for a date in the precomputed window", () => {
    expect(machinesForDate(IN_WINDOW_DATE)).toHaveLength(EXPECTED_MACHINE_COUNT);
  });

  it("serves the closest available day for a date outside the window", () => {
    expect(machinesForDate(BEFORE_WINDOW_DATE)).toHaveLength(EXPECTED_MACHINE_COUNT);
    expect(machinesForDate(AFTER_WINDOW_DATE)).toHaveLength(EXPECTED_MACHINE_COUNT);
  });
});

describe("five chip rule", () => {
  it("never poses an input wider than five chips across the whole precomputed window", () => {
    let widest = 0;
    for (const machines of Object.values(ALL_DAYS)) {
      for (const machine of machines) {
        for (const pair of [...machine.ex, ...machine.ch]) {
          const chipCount = pair[PAIR_INPUT_INDEX].split(CHIP_SEPARATOR).length;
          widest = Math.max(widest, chipCount);
        }
      }
    }
    expect(widest).toBeLessThanOrEqual(MAX_INPUT_CHIPS);
  });
});
