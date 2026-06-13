import { describe, expect, it } from "vitest";
import { machinesForDate, todayDate } from "../src/game/calendar";

/**
 * These tests cover the runtime calendar, which serves precomputed days without the
 * generation engine. A date in the window returns its four machines, a date outside
 * the window falls back to the closest available day, and the local date is well
 * formed.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IN_WINDOW_DATE = "2026-06-20";
const BEFORE_WINDOW_DATE = "2020-01-01";
const AFTER_WINDOW_DATE = "2030-01-01";
const EXPECTED_MACHINE_COUNT = 4;

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
