import { describe, expect, it } from "vitest";
import { generateDay, type DayMachine, type DaySpec } from "../src/engine/generate";
import { behaviorClasses, wordBehaviorClasses } from "../src/engine/universe";
import { hash64hex } from "../src/engine/rng";
import { OUTPUT_FLOOR, validate } from "../src/engine/validate";
import { compose, execute } from "../src/engine/compose";
import { TYPE_NUM_LIST, type Value } from "../src/engine/ops-types";

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
const SOAK_TIMEOUT_MS = 180000;

/**
 * The no recent repeat window each slot is held to, in slot order. The super easy opener
 * cycles a small roster on a short window of its own; the other slots use the long window.
 */
const SUPER_EASY_NO_REPEAT = 14;
const WINDOW_BY_SLOT: readonly number[] = [SUPER_EASY_NO_REPEAT, NO_REPEAT_WINDOW, NO_REPEAT_WINDOW, NO_REPEAT_WINDOW];

/** How many soak days to process before yielding so the test runner can stay responsive. */
const SOAK_YIELD_INTERVAL = 25;

/** Yields to the event loop so the long synchronous soak does not stall the worker. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve);
  });
}

const EXPECTED_CLASS_COUNT = 82044;
const EXPECTED_WORD_CLASS_COUNT = 13383;
const EXPECTED_CLASS_KEY_HASH = "46e882e31a60d3a0";

/** The fewest distinct pipelines each slot must draw over the soak, in slot order. */
const VARIETY_FLOOR: readonly number[] = [20, 150, 300, 300];

const PINNED_SIGNATURES: Readonly<Record<string, string>> = {
  "2026-06-16": 'add_k{"k":3} ## add_k{"k":9}>reverse{} ## min_normalize{}>keep_gt_k{"k":8}>add_k{"k":7} ## keep_gt_k{"k":6}>sum{}',
  "2026-06-18": 'sort_asc{} ## add_k{"k":1}>keep_last_k{"k":3} ## length_map{}>add_k{"k":7}>sort_asc{} ## reverse_digits{}>mode{}',
  "2026-06-20": 'length_map{} ## sub_k{"k":5}>keep_first_k{"k":2} ## length_map{}>dedup{}>rotate_left{} ## mul_k{"k":2}>keep_first_k{"k":2}>keep_lt_k{"k":9}',
  "2026-06-22": 'max{} ## add_k{"k":8}>keep_last_k{"k":2} ## length_map{}>add_k{"k":2}>keep_first_k{"k":2} ## keep_first_k{"k":4}>min_normalize{}',
  "2026-06-25": 'count{} ## sub_k{"k":3}>sort_desc{} ## length_map{}>add_k{"k":5}>sort_desc{} ## sub_k{"k":3}>drop_last{}>keep_lt_k{"k":7}',
  "2026-06-28": 'add_k{"k":4} ## add_k{"k":1}>drop_last{} ## mul_k{"k":2}>swap_ends{}>keep_gt_first{} ## sub_k{"k":2}>keep_odd{}>dedup{}',
  "2026-07-01": 'add_k{"k":6} ## add_k{"k":1}>keep_first_k{"k":2} ## length_map{}>drop_first{}>min_normalize{} ## add_k{"k":3}>sort_asc{}>keep_lt_k{"k":9}',
  "2026-07-05": 'length_map{} ## add_k{"k":5}>sort_asc{} ## length_map{}>sub_k{"k":5}>keep_last_k{"k":3} ## add_k{"k":1}>keep_last_k{"k":3}>keep_gt_k{"k":8}',
  "2026-07-10": 'max{} ## sub_k{"k":1}>drop_last{} ## reverse{}>keep_gt_first{}>rotate_left{} ## sub_k{"k":2}>drop_last{}>keep_gt_k{"k":5}',
  "2026-07-15": 'sum{} ## add_k{"k":1}>reverse{} ## keep_odd{}>mul_k{"k":4}>every_other{} ## keep_lt_k{"k":5}>keep_first_k{"k":2}>sum{}',
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

/**
 * Reduces an output value to its numeric parts, ignoring word outputs, so the floor can be checked.
 * @param output The output value.
 * @returns The numeric parts of the output.
 */
function toNumberArray(output: Value): number[] {
  if (typeof output === "number") return [output];
  if (Array.isArray(output)) return output.filter((item): item is number => typeof item === "number");
  return [];
}

describe("output floor", () => {
  const FLOOR_PROBE_DAYS = 60;
  const FLOOR_PROBE_LENGTHS = [1, 2, 3, 4, 5, 6];
  const FLOOR_PROBE_INPUTS: number[][] = FLOOR_PROBE_LENGTHS.flatMap((length) => [
    Array.from({ length }, () => 1),
    Array.from({ length }, () => 2),
  ]);

  it("never lets a generated machine fall below the output floor on small inputs", () => {
    for (let dayIndex = 0; dayIndex < FLOOR_PROBE_DAYS; dayIndex++) {
      const spec = generateDay(shiftDate(EPOCH, dayIndex));
      for (const machine of spec.machines) {
        const pipeline = compose(machine.steps);
        if (pipeline.inputType !== TYPE_NUM_LIST) continue;
        for (const input of FLOOR_PROBE_INPUTS) {
          for (const value of toNumberArray(execute(pipeline, input))) {
            expect(value).toBeGreaterThanOrEqual(OUTPUT_FLOOR);
          }
        }
      }
    }
  });
});

describe("year long soak", () => {
  it(
    "generates a valid year with no deadlock, no in window repeat, and healthy variety",
    async () => {
      const recentBySlot: string[][] = Array.from({ length: SLOT_COUNT }, () => []);
      const distinctBySlot: Set<string>[] = Array.from({ length: SLOT_COUNT }, () => new Set());

      for (let dayIndex = 0; dayIndex < SOAK_DAYS; dayIndex++) {
        if (dayIndex % SOAK_YIELD_INTERVAL === 0) await yieldToEventLoop();
        const spec = generateDay(shiftDate(EPOCH, dayIndex));
        expect(spec.machines).toHaveLength(SLOT_COUNT);

        spec.machines.forEach((machine, slot) => {
          expect(machineValidates(machine)).toBe(true);

          const signature = machineSignature(machine);
          const window = WINDOW_BY_SLOT[slot] ?? NO_REPEAT_WINDOW;
          expect(recentBySlot[slot]).not.toContain(signature);
          recentBySlot[slot].push(signature);
          if (recentBySlot[slot].length > window) recentBySlot[slot].shift();
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
