import { describe, expect, it } from "vitest";
import { fingerprint, PROBE_BATTERY, type ProbeRun } from "../src/engine/fingerprint";

/**
 * These tests pin the probe battery and the fingerprint primitive. The battery is
 * frozen content, so its size and shape are asserted to catch an accidental edit. The
 * fingerprint of a fixed pipeline is pinned to a known vector so a change to the
 * battery, the serialization, or the hash fails loudly. The remaining tests confirm
 * the properties the validators rely on: distinct behavior yields distinct
 * fingerprints, identical behavior yields identical fingerprints, and a pipeline that
 * throws on some input still fingerprints stably.
 */

const BATTERY_SIZE = 40;
const PROBE_MIN_LENGTH = 1;
const PROBE_MAX_LENGTH = 6;
const FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;
const FINGERPRINT_OF_IDENTITY = "7d6fd1a2ac48dd91";

const identity: ProbeRun = (probe) => probe;
const double: ProbeRun = (probe) => probe.map((value) => value * 2);
const reverse: ProbeRun = (probe) => [...probe].reverse();
const sum: ProbeRun = (probe) => probe.reduce((total, value) => total + value, 0);

describe("PROBE_BATTERY", () => {
  it("holds the frozen number of probes", () => {
    expect(PROBE_BATTERY).toHaveLength(BATTERY_SIZE);
  });

  it("contains only lists within the puzzle length bounds", () => {
    for (const probe of PROBE_BATTERY) {
      expect(probe.length).toBeGreaterThanOrEqual(PROBE_MIN_LENGTH);
      expect(probe.length).toBeLessThanOrEqual(PROBE_MAX_LENGTH);
    }
  });
});

describe("fingerprint", () => {
  it("matches the known vector for the identity pipeline", () => {
    expect(fingerprint(identity)).toBe(FINGERPRINT_OF_IDENTITY);
  });

  it("is a sixteen character lowercase hex string", () => {
    expect(fingerprint(identity)).toMatch(FINGERPRINT_PATTERN);
    expect(fingerprint(sum)).toMatch(FINGERPRINT_PATTERN);
  });

  it("is deterministic across repeated calls", () => {
    expect(fingerprint(double)).toBe(fingerprint(double));
  });

  it("distinguishes pipelines that behave differently", () => {
    const fingerprints = new Set([
      fingerprint(identity),
      fingerprint(double),
      fingerprint(reverse),
      fingerprint(sum),
    ]);
    expect(fingerprints.size).toBe(4);
  });

  it("matches for two distinct functions that behave identically", () => {
    const addOneA: ProbeRun = (probe) => probe.map((value) => value + 1);
    const addOneB: ProbeRun = (probe) => probe.map((value) => 1 + value);
    expect(fingerprint(addOneA)).toBe(fingerprint(addOneB));
  });

  it("fingerprints stably even when the pipeline throws on some inputs", () => {
    const throwsOnSingletons: ProbeRun = (probe) => {
      if (probe.length === 1) throw new Error("no singletons");
      return probe;
    };
    expect(fingerprint(throwsOnSingletons)).toMatch(FINGERPRINT_PATTERN);
    expect(fingerprint(throwsOnSingletons)).toBe(fingerprint(throwsOnSingletons));
    expect(fingerprint(throwsOnSingletons)).not.toBe(fingerprint(identity));
  });
});
