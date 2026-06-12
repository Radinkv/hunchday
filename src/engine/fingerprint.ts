/**
 * Behavioral fingerprinting for pipelines.
 *
 * A pipeline is a function that transforms a list of numbers. Two pipelines are
 * behaviorally identical when they produce the same output for every input, and the
 * validators in a later phase reject a candidate that behaves like a simpler one and
 * measure how many pipelines survive a pair of examples. Comparing pipelines directly
 * across a full input space is expensive, so each pipeline is reduced to a fingerprint
 * instead: it is run over one fixed battery of probe inputs, its outputs are
 * serialized in a canonical form, and that serialization is hashed to a short stable
 * string. Pipelines with the same fingerprint behave the same on the battery, which
 * turns collapse detection and ambiguity scoring into fingerprint comparisons.
 *
 * The battery is frozen as part of the generator version. Changing it changes every
 * fingerprint and therefore the validator outcomes, so it is treated with the same
 * care as the seed and the registry. The probe inputs deliberately span short and
 * long lists, ascending and descending order, repeated values, all even and all odd
 * lists, and a few values outside the puzzle input range, so that pipelines which
 * differ only on an unusual input are still told apart.
 */

import { hash64hex } from "./rng";

/**
 * A value a pipeline may produce on a probe input: a single number, a single word, or
 * a list of such values. Defined here without depending on the operation types so the
 * fingerprint primitive can be built before the operation registry exists.
 */
export type ProbeValue = number | string | readonly ProbeValue[];

/** A pipeline executor: it maps one probe input list to the pipeline output. */
export type ProbeRun = (probe: readonly number[]) => ProbeValue;

/** Canonical serialization tags that keep numbers, words, and lists distinguishable. */
const SERIAL_NUMBER_TAG = "n";
const SERIAL_STRING_TAG = "s";
const SERIAL_LIST_TAG = "l";
const SERIAL_UNKNOWN_TAG = "u";

/** Separates serialized items within a list, and serialized outputs across the battery. */
const SERIAL_ITEM_SEPARATOR = ",";
const SERIAL_RECORD_SEPARATOR = "|";

/** Recorded in place of an output when a pipeline throws on a probe input. */
const SERIAL_ERROR_TOKEN = "x";

/**
 * The frozen probe battery. Forty input lists chosen to discriminate the behavior of
 * the operation set across length, order, repetition, parity, and out of range values.
 */
export const PROBE_BATTERY: ReadonlyArray<readonly number[]> = [
  [1],
  [2],
  [5],
  [1, 2],
  [2, 1],
  [3, 3],
  [1, 2, 3],
  [3, 2, 1],
  [2, 2, 2],
  [1, 3, 2],
  [4, 1, 5, 2],
  [5, 5, 1, 1],
  [9, 1, 9, 1],
  [1, 2, 3, 4],
  [4, 3, 2, 1],
  [2, 4, 6, 8],
  [1, 3, 5, 7],
  [6, 6, 6, 6],
  [1, 2, 2, 3],
  [7, 7, 1, 1, 1],
  [1, 2, 3, 4, 5],
  [5, 4, 3, 2, 1],
  [2, 2, 4, 4, 6],
  [9, 8, 7, 6, 5],
  [1, 1, 1, 1, 1],
  [3, 1, 4, 1, 5],
  [1, 2, 3, 4, 5, 6],
  [6, 5, 4, 3, 2, 1],
  [2, 4, 6, 1, 3, 5],
  [10, 5, 10, 5, 10, 5],
  [12, 1],
  [1, 12],
  [0, 1, 2],
  [0, 0, 0],
  [11, 9, 7, 5, 3, 1],
  [2, 3, 5, 7, 11],
  [4, 4, 4, 2],
  [8, 1, 8, 1, 8],
  [10, 11, 12],
  [1, 10, 2, 9, 3],
];

/**
 * Serializes a probe output into a canonical string. Each kind of value carries a
 * leading tag so that a number, a word, and a single item list never collide, and
 * lists serialize their items in order.
 * @param value The probe output to serialize.
 * @returns The canonical serialization of the value.
 */
function serializeProbeValue(value: ProbeValue): string {
  if (typeof value === "number") return SERIAL_NUMBER_TAG + value;
  if (typeof value === "string") return SERIAL_STRING_TAG + value;
  if (Array.isArray(value)) {
    return SERIAL_LIST_TAG + value.map(serializeProbeValue).join(SERIAL_ITEM_SEPARATOR);
  }
  return SERIAL_UNKNOWN_TAG;
}

/**
 * Computes the behavioral fingerprint of a pipeline by running it over the frozen
 * probe battery, serializing each output, and hashing the joined serialization. A
 * probe input on which the pipeline throws contributes a fixed error token, so a
 * single failing probe does not prevent fingerprinting and still distinguishes a
 * pipeline that fails there from one that does not.
 * @param run The pipeline executor to fingerprint.
 * @returns A stable sixteen character hex fingerprint of the pipeline behavior.
 */
export function fingerprint(run: ProbeRun): string {
  const records = PROBE_BATTERY.map((probe) => {
    try {
      return serializeProbeValue(run(probe));
    } catch {
      return SERIAL_ERROR_TOKEN;
    }
  });
  return hash64hex(records.join(SERIAL_RECORD_SEPARATOR));
}
