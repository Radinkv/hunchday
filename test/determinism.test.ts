import { describe, expect, it } from "vitest";
import { generateDay, type DayMachine, type DaySpec } from "../src/engine/generate";
import { behaviorClasses } from "../src/engine/universe";
import { hash64hex } from "../src/engine/rng";
import { validate } from "../src/engine/validate";

/**
 * These are the non-negotiable determinism and soak guards. They pin the size and the
 * identity of the behavior class table and the signatures of ten known dates, so any
 * change to the registry, the hash, the generator, or the validators fails the build.
 * The soak generates a full year of consecutive days and asserts that every machine is
 * valid, that no slot deadlocks, that no pipeline repeats within the no repeat window,
 * and that every slot draws a healthy variety of pipelines.
 */

const EPOCH = "2026-06-15";
const SOAK_DAYS = 365;
const NO_REPEAT_WINDOW = 13;
const SLOT_COUNT = 4;
const MS_PER_DAY = 86400000;
const SOAK_TIMEOUT_MS = 120000;

const EXPECTED_CLASS_COUNT = 43378;
const EXPECTED_CLASS_KEY_HASH = "ce367e698ef76647";

/** The fewest distinct pipelines each slot must draw over the soak, in slot order. */
const VARIETY_FLOOR: readonly number[] = [80, 220, 260, 260];

const PINNED_SIGNATURES: Readonly<Record<string, string>> = {
  "2026-06-16": 'add_k{"k":2}>drop_first{} ## sub_k{"k":1}>keep_gt_k{"k":5}>affine{"a":3,"b":1} ## add_k{"k":1}>keep_gt_k{"k":5}>every_other{} ## reverse_digits{}>add_k{"k":4}>keep_lt_k{"k":8}',
  "2026-06-18": 'sub_k{"k":3}>sort_asc{} ## last_letter_pos{}>count_even{} ## add_k{"k":4}>keep_gt_first{}>sort_asc{} ## reverse{}>running_total{}>keep_gt_k{"k":4}',
  "2026-06-20": 'sub_k{"k":3}>drop_first{} ## keep_lt_k{"k":5}>sub_k{"k":3}>drop_last{} ## units_digit{}>keep_gt_k{"k":5}>count_distinct{} ## deltas{}>keep_lt_k{"k":6}>add_k{"k":5}',
  "2026-06-22": 'add_k{"k":5}>sort_asc{} ## add_k{"k":2}>keep_gt_k{"k":9}>affine{"a":3,"b":1} ## keep_startswith_vowel{}>length_map{}>keep_odd{} ## add_k{"k":3}>reverse_digits{}>keep_gt_k{"k":7}',
  "2026-06-25": 'reverse{}>drop_last{} ## keep_gt_k{"k":7}>add_k{"k":3}>drop_first{} ## units_digit{}>keep_lt_k{"k":3}>sum{} ## last_letter_pos{}>digit_sum_map{}>median{}',
  "2026-06-28": 'mul_k{"k":2}>sort_desc{} ## keep_lt_k{"k":7}>every_other{} ## min_normalize{}>keep_lt_k{"k":8}>rotate_left{} ## units_digit{}>deltas{}>sub_k{"k":2}',
  "2026-07-01": 'add_k{"k":4}>sum{} ## letter_count_squared{}>digit_sum_map{} ## units_digit{}>sort_asc{}>keep_gt_k{"k":3} ## reverse_digits{}>keep_gt_k{"k":4}>affine{"a":3,"b":1}',
  "2026-07-05": 'mul_k{"k":2}>first{} ## keep_lt_k{"k":9}>drop_first{} ## keep_gt_first{}>every_other{}>keep_gt_k{"k":6} ## mul_k{"k":2}>running_total{}>keep_gt_k{"k":4}',
  "2026-07-10": 'add_k{"k":3}>sort_desc{} ## keep_even{}>swap_ends{}>mul_k{"k":3} ## reverse{}>keep_gt_k{"k":4}>keep_dups{} ## keep_gt_k{"k":7}>reverse_digits{}>sum{}',
  "2026-07-15": 'reverse{}>drop_last{} ## affine{"a":3,"b":3}>affine{"a":3,"b":2}>last{} ## sort_desc{}>units_digit{}>affine{"a":2,"b":1} ## reverse_digits{}>dedup{}>drop_last{}',
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

/**
 * Validates a machine on its own examples and challenges.
 * @param machine The machine to validate.
 * @returns Whether the machine passes validation.
 */
function machineValidates(machine: DayMachine): boolean {
  return validate({
    steps: machine.steps,
    difficulty: machine.difficulty,
    exampleInputs: machine.examples.map((pair) => pair.input),
    challengeInputs: machine.challenges.map((pair) => pair.input),
  }).ok;
}

describe("behavior class table", () => {
  it("holds the pinned number of classes", () => {
    expect(behaviorClasses().size).toBe(EXPECTED_CLASS_COUNT);
  });

  it("holds the pinned class identity", () => {
    const keyHash = hash64hex(
      [...behaviorClasses().keys()].sort((a, b) => a.localeCompare(b)).join(","),
    );
    expect(keyHash).toBe(EXPECTED_CLASS_KEY_HASH);
  });
});

describe("generateDay pinned dates", () => {
  for (const [date, signature] of Object.entries(PINNED_SIGNATURES)) {
    it(`matches the pinned signature for ${date}`, () => {
      expect(daySignature(generateDay(date))).toBe(signature);
    });
  }
});

describe("year long soak", () => {
  it(
    "generates a valid year with no deadlock, no in window repeat, and healthy variety",
    () => {
      const recentBySlot: string[][] = Array.from({ length: SLOT_COUNT }, () => []);
      const distinctBySlot: Set<string>[] = Array.from({ length: SLOT_COUNT }, () => new Set());

      for (let dayIndex = 0; dayIndex < SOAK_DAYS; dayIndex++) {
        const spec = generateDay(shiftDate(EPOCH, dayIndex));
        expect(spec.machines).toHaveLength(SLOT_COUNT);

        spec.machines.forEach((machine, slot) => {
          expect(machineValidates(machine)).toBe(true);

          const signature = machineSignature(machine);
          expect(recentBySlot[slot]).not.toContain(signature);
          recentBySlot[slot].push(signature);
          if (recentBySlot[slot].length > NO_REPEAT_WINDOW) recentBySlot[slot].shift();
          distinctBySlot[slot].add(signature);
        });
      }

      distinctBySlot.forEach((distinct, slot) => {
        expect(distinct.size).toBeGreaterThanOrEqual(VARIETY_FLOOR[slot] ?? 0);
      });
    },
    SOAK_TIMEOUT_MS,
  );
});
