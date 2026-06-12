import { describe, expect, it } from "vitest";
import { step } from "../src/engine/compose";
import {
  behaviorClasses,
  complexityOf,
  fingerprintOfSteps,
  isStrictlySimpler,
} from "../src/engine/universe";
import { OP_MUL_K, OP_REVERSE, OP_SORT_ASC, OP_SORT_DESC, OP_SUM } from "../src/engine/ops";

/**
 * These tests cover the behavior universe that the validators reason over. Pipelines
 * that compute the same function must share a fingerprint and a class, the class must
 * keep its simplest member as the representative, and the complexity comparison must
 * order pipelines by operation count and then by top rung. The map is built once and
 * cached.
 */

describe("fingerprintOfSteps", () => {
  it("gives behaviorally identical pipelines the same fingerprint", () => {
    expect(fingerprintOfSteps([step(OP_REVERSE), step(OP_SORT_ASC)])).toBe(
      fingerprintOfSteps([step(OP_SORT_ASC)]),
    );
    expect(fingerprintOfSteps([step(OP_SORT_DESC), step(OP_SORT_ASC)])).toBe(
      fingerprintOfSteps([step(OP_SORT_ASC)]),
    );
  });

  it("gives behaviorally different pipelines different fingerprints", () => {
    expect(fingerprintOfSteps([step(OP_SORT_ASC)])).not.toBe(fingerprintOfSteps([step(OP_SORT_DESC)]));
  });

  it("is deterministic", () => {
    expect(fingerprintOfSteps([step(OP_MUL_K, { k: 2 }), step(OP_SUM)])).toBe(
      fingerprintOfSteps([step(OP_MUL_K, { k: 2 }), step(OP_SUM)]),
    );
  });
});

describe("complexityOf", () => {
  it("reports operation count and top rung", () => {
    expect(complexityOf([step(OP_REVERSE)])).toEqual({ length: 1, maxRung: 1 });
    expect(complexityOf([step(OP_REVERSE), step(OP_SORT_ASC)])).toEqual({ length: 2, maxRung: 2 });
  });
});

describe("isStrictlySimpler", () => {
  it("prefers fewer operations, then a lower top rung", () => {
    expect(isStrictlySimpler({ length: 1, maxRung: 5 }, { length: 2, maxRung: 1 })).toBe(true);
    expect(isStrictlySimpler({ length: 2, maxRung: 1 }, { length: 2, maxRung: 3 })).toBe(true);
    expect(isStrictlySimpler({ length: 2, maxRung: 3 }, { length: 1, maxRung: 5 })).toBe(false);
    expect(isStrictlySimpler({ length: 1, maxRung: 2 }, { length: 1, maxRung: 2 })).toBe(false);
  });
});

describe("behaviorClasses", () => {
  it("is a non empty cached map", () => {
    const first = behaviorClasses();
    const second = behaviorClasses();
    expect(first).toBe(second);
    expect(first.size).toBeGreaterThan(0);
  });

  it("keeps the simplest pipeline as the representative of a class", () => {
    const sortClass = behaviorClasses().get(fingerprintOfSteps([step(OP_SORT_ASC)]));
    expect(sortClass?.length).toBe(1);
  });
});
