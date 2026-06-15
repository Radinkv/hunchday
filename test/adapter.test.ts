import { describe, expect, it } from "vitest";
import { generateMachinesForDate } from "../src/game/adapter";
import { feed, startGame } from "../src/game/reducer";

/**
 * These tests cover the build time bridge from the generated day to the reducer. They
 * confirm a date yields four playable machines with the right shape and that the chip
 * strings the adapter produces are exactly what the reducer accepts as a correct
 * answer, including a word machine.
 */

const SAMPLE_DATE = "2026-06-20";
const EXPECTED_MACHINE_COUNT = 3;
const EXAMPLE_COUNT = 2;
const CHALLENGE_COUNT = 5;
const WORD_SLOT = 2;

describe("generateMachinesForDate", () => {
  const machines = generateMachinesForDate(SAMPLE_DATE);

  it("produces three machines with the expected shape", () => {
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
    const word = machines[WORD_SLOT];
    const state = feed(startGame([word]), [word], word.ch[0][1]);
    expect(state.streak).toBe(1);
  });
});
