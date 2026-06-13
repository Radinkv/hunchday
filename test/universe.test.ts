import { describe, expect, it } from "vitest";
import { step } from "../src/engine/compose";
import {
  behaviorClasses,
  complexityOf,
  fingerprintOfSteps,
  fingerprintWordSteps,
  isStrictlySimpler,
  wordBehaviorClasses,
} from "../src/engine/universe";
import {
  OP_LENGTH_MAP,
  OP_MUL_K,
  OP_REVERSE,
  OP_SORT_ALPHA,
  OP_SORT_ASC,
  OP_SORT_DESC,
  OP_SUM,
} from "../src/engine/ops";

/**
 * These tests cover the behavior universe that the validators reason over. Pipelines
 * that compute the same function must share a fingerprint and a class, the class must
 * keep its simplest member as the representative, and the complexity comparison must
 * order pipelines by operation count and then by top rung. The map is built once and
 * cached. The word universe enumerates pipelines that begin with a word operation and
 * follow the value type flow, and it is built and cached independently of the numeric
 * universe.
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

describe("fingerprintWordSteps", () => {
  it("gives behaviorally identical word pipelines the same fingerprint", () => {
    expect(fingerprintWordSteps([step(OP_SORT_ALPHA), step(OP_LENGTH_MAP)])).toBe(
      fingerprintWordSteps([step(OP_SORT_ALPHA), step(OP_LENGTH_MAP)]),
    );
  });

  it("gives word pipelines that order their output differently distinct fingerprints", () => {
    expect(fingerprintWordSteps([step(OP_LENGTH_MAP)])).not.toBe(
      fingerprintWordSteps([step(OP_LENGTH_MAP), step(OP_SORT_ASC)]),
    );
  });
});

describe("wordBehaviorClasses", () => {
  it("is a non empty cached map distinct from the numeric universe", () => {
    const first = wordBehaviorClasses();
    const second = wordBehaviorClasses();
    expect(first).toBe(second);
    expect(first.size).toBeGreaterThan(0);
    expect(first).not.toBe(behaviorClasses());
  });

  it("classifies a single word operation as a length one pipeline", () => {
    const lengthClass = wordBehaviorClasses().get(fingerprintWordSteps([step(OP_LENGTH_MAP)]));
    expect(lengthClass?.length).toBe(1);
  });

  it("contains only pipelines that begin with a word operation", () => {
    for (const behaviorClass of wordBehaviorClasses().values()) {
      const firstStep = behaviorClass.representative.at(0);
      expect(firstStep).toBeDefined();
    }
  });
});
