import { describe, expect, it } from "vitest";
import { compose, step, type PipelineStep } from "../src/engine/compose";
import { phrasePipeline } from "../src/engine/phrase";
import {
  OP_ADD_K,
  OP_COUNT,
  OP_FIRST,
  OP_KEEP_EVEN,
  OP_MUL_K,
  OP_REVERSE,
  OP_SORT_ASC,
  OP_SUM,
} from "../src/engine/ops";

/**
 * These tests pin the reveal sentences the phraser produces. A single operation reads
 * as one clause, and a chain joins clauses with "then". The flagship case is the
 * prototype's machine five, a filter into a reducer, which must read exactly as the
 * specification shows. The continuation rewrite must turn a reference to the whole
 * collection of chips into the pronoun in every clause after the first, while leaving
 * the first clause and any parameter values intact. Pipelines are built from the same
 * operation descriptors the registry uses.
 */

interface PhraseCase {
  readonly steps: readonly PipelineStep[];
  readonly expected: string;
}

const PHRASE_CASES: readonly PhraseCase[] = [
  { steps: [step(OP_REVERSE)], expected: "It reverses the order." },
  {
    steps: [step(OP_KEEP_EVEN), step(OP_SUM)],
    expected: "It keeps only the even chips, then adds them together.",
  },
  {
    steps: [step(OP_SORT_ASC), step(OP_FIRST)],
    expected: "It sorts the chips smallest to biggest, then keeps only the first chip.",
  },
  {
    steps: [step(OP_KEEP_EVEN), step(OP_COUNT)],
    expected: "It keeps only the even chips, then counts them.",
  },
  {
    steps: [step(OP_KEEP_EVEN), step(OP_SORT_ASC), step(OP_FIRST)],
    expected: "It keeps only the even chips, then sorts them smallest to biggest, then keeps only the first chip.",
  },
  { steps: [step(OP_ADD_K, { k: 3 })], expected: "It adds 3 to every chip." },
  {
    steps: [step(OP_KEEP_EVEN), step(OP_MUL_K, { k: 2 })],
    expected: "It keeps only the even chips, then multiplies them by 2.",
  },
];

describe("phrasePipeline", () => {
  for (const testCase of PHRASE_CASES) {
    it(`phrases: ${testCase.expected}`, () => {
      expect(phrasePipeline(compose(testCase.steps))).toBe(testCase.expected);
    });
  }
});
