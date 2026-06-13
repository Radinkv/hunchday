import { describe, expect, it } from "vitest";
import { generateDay, type DayMachine, type DaySpec } from "../src/engine/generate";
import { behaviorClasses, wordBehaviorClasses } from "../src/engine/universe";
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
const NO_REPEAT_WINDOW = 89;
const SLOT_COUNT = 4;
const MS_PER_DAY = 86400000;
const SOAK_TIMEOUT_MS = 120000;

const EXPECTED_CLASS_COUNT = 82044;
const EXPECTED_WORD_CLASS_COUNT = 13383;
const EXPECTED_CLASS_KEY_HASH = "46e882e31a60d3a0";

/** The fewest distinct pipelines each slot must draw over the soak, in slot order. */
const VARIETY_FLOOR: readonly number[] = [180, 300, 300, 300];

const PINNED_SIGNATURES: Readonly<Record<string, string>> = {
  "2026-06-16": 'add_k{"k":9}>reverse{} ## keep_gt_k{"k":6}>sum{} ## min_normalize{}>affine{"a":3,"b":1}>keep_last_k{"k":3} ## deltas{}>running_total{}>keep_gt_k{"k":3}',
  "2026-06-18": 'add_k{"k":1}>keep_last_k{"k":3} ## distinct_letters_map{}>keep_dups{} ## drop_last{}>rotate_left{}>units_digit{} ## running_total{}>add_k{"k":1}>keep_gt_k{"k":5}',
  "2026-06-20": 'sub_k{"k":5}>keep_first_k{"k":2} ## add_k{"k":3}>keep_gt_k{"k":4}>keep_first_k{"k":4} ## mul_k{"k":3}>min_normalize{}>keep_dups{} ## running_total{}>every_other{}>range{}',
  "2026-06-22": 'add_k{"k":8}>keep_last_k{"k":2} ## sub_k{"k":3}>keep_lt_k{"k":4}>keep_first_k{"k":2} ## length_map{}>add_k{"k":2}>keep_first_k{"k":2} ## first_letter_pos{}>keep_lt_k{"k":5}>min{}',
  "2026-06-25": 'sub_k{"k":3}>sort_desc{} ## sub_k{"k":3}>drop_last{}>keep_lt_k{"k":7} ## units_digit{}>add_k{"k":9}>keep_odd{} ## deltas{}>keep_last_k{"k":3}>keep_lt_k{"k":5}',
  "2026-06-28": 'add_k{"k":1}>drop_last{} ## sub_k{"k":2}>keep_odd{}>dedup{} ## keep_lt_k{"k":5}>add_k{"k":9}>mode{} ## add_k{"k":3}>digit_sum_map{}>add_k{"k":9}',
  "2026-07-01": 'add_k{"k":1}>keep_first_k{"k":2} ## letter_count_squared{}>mul_k{"k":2} ## units_digit{}>keep_last_k{"k":4}>max{} ## affine{"a":2,"b":2}>digit_sum_map{}>keep_lt_k{"k":9}',
  "2026-07-05": 'add_k{"k":5}>sort_asc{} ## add_k{"k":1}>keep_last_k{"k":3}>keep_gt_k{"k":8} ## mul_k{"k":3}>min_normalize{}>keep_odd{} ## dedup{}>deltas{}>keep_lt_k{"k":6}',
  "2026-07-10": 'sub_k{"k":1}>drop_last{} ## sub_k{"k":2}>drop_last{}>keep_gt_k{"k":5} ## reverse{}>keep_gt_first{}>rotate_left{} ## reverse_digits{}>keep_gt_k{"k":5}>keep_first_k{"k":3}',
  "2026-07-15": 'add_k{"k":1}>reverse{} ## keep_lt_k{"k":5}>keep_first_k{"k":2}>sum{} ## units_digit{}>keep_lt_k{"k":9}>keep_dups{} ## deltas{}>keep_lt_k{"k":9}>running_total{}',
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

  it("holds the pinned number of word classes, guarding against a word universe blow up", () => {
    expect(wordBehaviorClasses().size).toBe(EXPECTED_WORD_CLASS_COUNT);
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
