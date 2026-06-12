import { describe, expect, it } from "vitest";
import { machinesForDate, todayDate } from "../src/prototype/adapter";
import { feed, startGame } from "../src/prototype/reducer";

/**
 * These tests cover the bridge from the generated day to the prototype reducer. They
 * confirm a date yields four playable machines with the right shape, that the chip
 * strings the adapter produces are exactly what the reducer accepts as a correct
 * answer, including a word machine, and that the local date is well formed.
 */

const SAMPLE_DATE = "2026-06-20";
const EXPECTED_MACHINE_COUNT = 4;
const EXAMPLE_COUNT = 2;
const CHALLENGE_COUNT = 5;
const MYSTERY_SLOT = 3;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("machinesForDate", () => {
  const machines = machinesForDate(SAMPLE_DATE);

  it("produces four machines with the expected shape", () => {
    expect(machines).toHaveLength(EXPECTED_MACHINE_COUNT);
    for (const machine of machines) {
      expect(machine.rule.length).toBeGreaterThan(0);
      expect(machine.ex).toHaveLength(EXAMPLE_COUNT);
      expect(machine.ch).toHaveLength(CHALLENGE_COUNT);
      for (const [input, output] of [...machine.ex, ...machine.ch]) {
        expect(input.length).toBeGreaterThan(0);
        expect(output.length).toBeGreaterThan(0);
      }
    }
  });

  it("produces chip strings the reducer accepts as the correct answer", () => {
    for (const machine of machines) {
      const correctOutput = machine.ch[0][1];
      const state = feed(startGame([machine]), [machine], correctOutput);
      expect(state.streak).toBe(1);
      expect(state.misses).toBe(0);
    }
  });

  it("renders a word machine that round trips through the reducer", () => {
    const mystery = machines[MYSTERY_SLOT];
    const state = feed(startGame([mystery]), [mystery], mystery.ch[0][1]);
    expect(state.streak).toBe(1);
  });
});

describe("todayDate", () => {
  it("returns a year month day string", () => {
    expect(todayDate()).toMatch(DATE_PATTERN);
  });
});
