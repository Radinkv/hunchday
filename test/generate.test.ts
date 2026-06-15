import { afterEach, describe, expect, it } from "vitest";
import { generateDay, OVERRIDES, type DaySpec, type DayMachine } from "../src/engine/generate";
import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_SUPER_EASY,
  validate,
  type Difficulty,
} from "../src/engine/validate";

/**
 * These tests cover the daily generator. They pin two known dates to their pipeline
 * signatures so that any change to the registry, the hash, the generator, or the
 * validators fails the suite. They confirm every generated day is four valid machines
 * in slot order, that a registered override wins outright, and that a run of
 * consecutive days never repeats a pipeline within the no repeat window and never
 * deadlocks.
 */

const EXPECTED_MACHINE_COUNT = 4;
const EXAMPLE_COUNT = 2;
const CHALLENGE_COUNT = 5;
const SLOT_ORDER: readonly Difficulty[] = [
  DIFFICULTY_SUPER_EASY,
  DIFFICULTY_EASY,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_HARD,
];

const SOAK_START = "2026-06-20";
const SOAK_DAYS = 30;
const NO_REPEAT_WINDOW = 89;
const SUPER_EASY_NO_REPEAT = 14;
const WINDOW_BY_SLOT: readonly number[] = [SUPER_EASY_NO_REPEAT, NO_REPEAT_WINDOW, NO_REPEAT_WINDOW, NO_REPEAT_WINDOW];
const MS_PER_DAY = 86400000;

const PINNED_SIGNATURES: Readonly<Record<string, string>> = {
  "2026-06-20": 'length_map{} ## sub_k{"k":5}>keep_first_k{"k":2} ## mul_k{"k":2}>keep_first_k{"k":2}>keep_lt_k{"k":9} ## length_map{}>dedup{}>rotate_left{}',
  "2026-07-01": 'add_k{"k":6} ## add_k{"k":1}>keep_first_k{"k":2} ## add_k{"k":3}>sort_asc{}>keep_lt_k{"k":9} ## length_map{}>drop_first{}>min_normalize{}',
};

/**
 * Builds the signature string of one machine from its operations and parameters.
 * @param machine The machine to describe.
 * @returns The signature string.
 */
function machineSignature(machine: DayMachine): string {
  return machine.steps.map((pipelineStep) => pipelineStep.opId + JSON.stringify(pipelineStep.params)).join(">");
}

/**
 * Builds the signature string of a whole day from its machines.
 * @param spec The day specification.
 * @returns The day signature string.
 */
function daySignature(spec: DaySpec): string {
  return spec.machines.map(machineSignature).join(" ## ");
}

/**
 * Shifts a date by a number of days in coordinated universal time.
 * @param date The starting date.
 * @param days The number of days to add.
 * @returns The shifted date string.
 */
function shiftDate(date: string, days: number): string {
  const parts = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(parts.at(0) ?? 0, (parts.at(1) ?? 1) - 1, parts.at(2) ?? 1) + days * MS_PER_DAY);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

afterEach(() => {
  OVERRIDES.clear();
});

describe("generateDay determinism", () => {
  for (const [date, signature] of Object.entries(PINNED_SIGNATURES)) {
    it(`matches the pinned signature for ${date}`, () => {
      expect(daySignature(generateDay(date))).toBe(signature);
    });
  }

  it("returns an equal specification on repeated calls", () => {
    expect(generateDay("2026-06-25")).toEqual(generateDay("2026-06-25"));
  });
});

describe("generateDay structure", () => {
  const spec = generateDay("2026-06-22");

  it("produces four machines in slot order", () => {
    expect(spec.machines).toHaveLength(EXPECTED_MACHINE_COUNT);
    expect(spec.machines.map((machine) => machine.difficulty)).toEqual(SLOT_ORDER);
  });

  it("gives every machine a rule, two examples, and the challenge count", () => {
    for (const machine of spec.machines) {
      expect(machine.rule.length).toBeGreaterThan(0);
      expect(machine.examples).toHaveLength(EXAMPLE_COUNT);
      expect(machine.challenges).toHaveLength(CHALLENGE_COUNT);
    }
  });

  it("passes validation for every machine", () => {
    for (const machine of spec.machines) {
      const result = validate({
        steps: machine.steps,
        difficulty: machine.difficulty,
        exampleInputs: machine.examples.map((pair) => pair.input),
        challengeInputs: machine.challenges.map((pair) => pair.input),
      });
      expect(result.ok).toBe(true);
    }
  });
});

describe("generateDay overrides", () => {
  it("returns a registered override outright", () => {
    const date = "2030-01-01";
    const override: DaySpec = { date, machines: [] };
    OVERRIDES.set(date, override);
    expect(generateDay(date)).toBe(override);
  });
});

describe("generateDay soak", () => {
  it("generates a run of days that are all valid and never repeat within the window", () => {
    const recentBySlot: string[][] = SLOT_ORDER.map(() => []);

    for (let dayIndex = 0; dayIndex < SOAK_DAYS; dayIndex++) {
      const spec = generateDay(shiftDate(SOAK_START, dayIndex));
      expect(spec.machines).toHaveLength(EXPECTED_MACHINE_COUNT);

      spec.machines.forEach((machine, slot) => {
        const result = validate({
          steps: machine.steps,
          difficulty: machine.difficulty,
          exampleInputs: machine.examples.map((pair) => pair.input),
          challengeInputs: machine.challenges.map((pair) => pair.input),
        });
        expect(result.ok).toBe(true);

        const signature = machineSignature(machine);
        const window = WINDOW_BY_SLOT[slot] ?? NO_REPEAT_WINDOW;
        expect(recentBySlot[slot]).not.toContain(signature);
        recentBySlot[slot].push(signature);
        if (recentBySlot[slot].length > window) recentBySlot[slot].shift();
      });
    }
  });
});
