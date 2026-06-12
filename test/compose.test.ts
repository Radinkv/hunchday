import { describe, expect, it } from "vitest";
import { compose, execute, run, step, type PipelineStep } from "../src/engine/compose";
import {
  TYPE_NUM,
  TYPE_NUM_LIST,
  TYPE_WORD_LIST,
  OP_ADD_K,
  OP_COUNT,
  OP_FIRST,
  OP_KEEP_EVEN,
  OP_LENGTH_MAP,
  OP_REVERSE,
  OP_SORT_ASC,
  OP_SUM,
  type Value,
  type ValueType,
} from "../src/engine/ops";

/**
 * These tests cover pipeline construction and execution. Construction must type check
 * the chain and expose the composition signature, and must reject an empty pipeline, a
 * type mismatch, a missing parameter, and an unknown operation. Execution must apply
 * the operations in order, work across the value types, and leave its input untouched.
 * Pipelines are built from the same operation descriptors and type tags the registry
 * uses, and the deliberately invalid identifier is named for intent.
 */

const UNKNOWN_OP_ID = "no_such_op";

interface SignatureCase {
  readonly steps: readonly PipelineStep[];
  readonly inputType: ValueType;
  readonly outputType: ValueType;
}

const SIGNATURE_CASES: readonly SignatureCase[] = [
  { steps: [step(OP_KEEP_EVEN), step(OP_SUM)], inputType: TYPE_NUM_LIST, outputType: TYPE_NUM },
  { steps: [step(OP_REVERSE)], inputType: TYPE_NUM_LIST, outputType: TYPE_NUM_LIST },
  { steps: [step(OP_LENGTH_MAP), step(OP_SORT_ASC)], inputType: TYPE_WORD_LIST, outputType: TYPE_NUM_LIST },
];

interface ExecutionCase {
  readonly steps: readonly PipelineStep[];
  readonly input: Value;
  readonly expected: Value;
}

const EXECUTION_CASES: readonly ExecutionCase[] = [
  { steps: [step(OP_KEEP_EVEN), step(OP_SUM)], input: [1, 2, 3, 4], expected: 6 },
  { steps: [step(OP_LENGTH_MAP), step(OP_SORT_ASC)], input: ["cat", "ox", "house"], expected: [2, 3, 5] },
  { steps: [step(OP_KEEP_EVEN), step(OP_SORT_ASC), step(OP_FIRST)], input: [4, 1, 2, 6, 3], expected: 2 },
];

interface RejectionCase {
  readonly reason: string;
  readonly steps: readonly PipelineStep[];
}

const REJECTION_CASES: readonly RejectionCase[] = [
  { reason: "an empty pipeline", steps: [] },
  { reason: "a type mismatch between operations", steps: [step(OP_SUM), step(OP_ADD_K, { k: 1 })] },
  { reason: "a step that omits a declared parameter", steps: [step(OP_ADD_K)] },
  { reason: "an unknown operation", steps: [{ opId: UNKNOWN_OP_ID, params: {} }] },
];

describe("compose signatures", () => {
  for (const testCase of SIGNATURE_CASES) {
    it(`reports ${testCase.inputType} to ${testCase.outputType}`, () => {
      const pipeline = compose(testCase.steps);
      expect(pipeline.inputType).toBe(testCase.inputType);
      expect(pipeline.outputType).toBe(testCase.outputType);
      expect(pipeline.steps).toHaveLength(testCase.steps.length);
    });
  }
});

describe("compose rejections", () => {
  for (const testCase of REJECTION_CASES) {
    it(`rejects ${testCase.reason}`, () => {
      expect(() => compose(testCase.steps)).toThrow();
    });
  }
});

describe("execute", () => {
  for (const testCase of EXECUTION_CASES) {
    it(`runs ${JSON.stringify(testCase.input)} to ${JSON.stringify(testCase.expected)}`, () => {
      expect(run(testCase.steps, testCase.input)).toEqual(testCase.expected);
    });
  }

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    run([step(OP_SORT_ASC), step(OP_COUNT)], input);
    expect(input).toEqual([3, 1, 2]);
  });

  it("matches composing then executing separately", () => {
    const steps = [step(OP_KEEP_EVEN), step(OP_SUM)];
    expect(execute(compose(steps), [2, 5, 4])).toEqual(run(steps, [2, 5, 4]));
  });
});
