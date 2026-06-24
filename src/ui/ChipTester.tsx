import { useState } from "react";
import { ChipComposer } from "./ChipComposer";
import { Pips } from "./Pips";
import {
  checkTestInput,
  machineReadsWords,
  normalizeChips,
  runTest,
  TEST_OK,
  type TestResult,
  type TestStatus,
} from "./tester";
import type { ChipPair, RuleStep } from "../game/types";
import {
  CLASS_CHIP_INPUT,
  CLASS_FEED,
  CLASS_TEST,
  CLASS_TEST_PIPS,
  COPY_TEST_RUN,
  TEST_PIP_LABEL,
} from "./constants";

/** The separator joining the budget label and its remaining count for assistive technology. */
const LABEL_SEPARATOR = ": ";

/**
 * The test bench, the Test mode input. The player spends a small budget of tries probing the
 * machine: they build a chip set with the shared composer and run it, and the result joins the
 * evidence log above as a test marked row, so a test reads as part of the running record. A test
 * input must be a well formed puzzle input the player has not already tested and is not a shown
 * example or any challenge, so a test can never read off a graded answer. Unseen examples are not
 * off limits, since they are not graded; only the shown example and the challenges are. The budget
 * shows as a row of pips that deplete, the completed tests live in the evidence so the budget
 * survives a reload, and the bench locks once it is spent. There is no rejection message: invalid
 * characters cannot be typed, and a set that is otherwise not runnable simply leaves the button
 * disabled.
 * @param props The current challenge input, the shown examples and the challenges that are off limits, the machine steps, the completed tests, and the run handler.
 */
export function ChipTester({
  challengeInput,
  examples,
  challenges,
  steps,
  tests,
  budget,
  onRun,
}: {
  readonly challengeInput: string;
  readonly examples: readonly ChipPair[];
  readonly challenges: readonly ChipPair[];
  readonly steps?: readonly RuleStep[] | undefined;
  readonly tests: readonly TestResult[];
  readonly budget: number;
  readonly onRun: (result: TestResult) => void;
}) {
  const [draft, setDraft] = useState("");

  const readsWords = machineReadsWords(challengeInput);
  const inPlay = new Set([...examples, ...challenges].map((pair) => normalizeChips(pair[0])));
  const alreadyTested = new Set(tests.map((test) => normalizeChips(test.input)));
  const used = tests.length;
  const remaining = budget - used;
  const spent = remaining <= 0;
  const status: TestStatus = checkTestInput(draft, readsWords, inPlay, alreadyTested);
  const canRun = !spent && status === TEST_OK && steps !== undefined;

  const run = (): void => {
    if (!canRun || steps === undefined) return;
    onRun(runTest(draft, steps));
    setDraft("");
  };

  return (
    <div className={CLASS_TEST}>
      <ChipComposer words={readsWords} value={draft} onChange={setDraft} role={CLASS_CHIP_INPUT} disabled={spent} />

      <Pips
        total={budget}
        active={remaining}
        variant={CLASS_TEST_PIPS}
        label={TEST_PIP_LABEL + LABEL_SEPARATOR + remaining}
      />

      <button type="button" className={CLASS_FEED} onClick={run} disabled={!canRun}>
        {COPY_TEST_RUN}
      </button>
    </div>
  );
}
