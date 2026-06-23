import { useState } from "react";
import { ChipBuilder } from "./ChipBuilder";
import { ChipComposer } from "./ChipComposer";
import { ChipTester } from "./ChipTester";
import { MissPips } from "./Pips";
import { machineReadsWords, type TestResult } from "./tester";
import { SEEDED_EXAMPLE_COUNT, tokenize } from "../game/reducer";
import type { Step } from "./palette";
import { SUBMISSION_GUESS, type ChipPair, type RuleStep, type Submission } from "../game/types";
import {
  CLASS_BOTTOM,
  CLASS_CHIP_GUESS,
  CLASS_FEED,
  CLASS_GUESS,
  CLASS_MODE_BODY,
  CLASS_WORKSPACE,
  COPY_FEED_BUTTON,
  MODE_RECIPE,
  MODE_TEST,
  type Mode,
} from "./constants";

/** The empty guess draft and empty recipe a fresh machine starts each mode with. */
const NO_DRAFT = "";
const NO_STEPS: readonly Step[] = [];

/** The chip separator used to compose a guess submission from the drafted chips. */
const TOKEN_JOIN = " ";

/**
 * The input widget under the evidence. It shows the input for the active mode, chosen by the
 * separate mode toggle: the test bench for Test, the shared chip composer for Guess, or the
 * search only recipe builder for Recipe. Guess and Test build chips with the same composer, so the
 * two read alike. The guess draft and the authored recipe live here so switching modes keeps each
 * side intact, while the test budget lives in the persisted game state and is supplied as a prop.
 * The active mode is owned by the caller so the toggle can live as its own bar elsewhere. The
 * caller keys this component on the machine so the drafts reset when the machine changes. The test
 * bench is only reachable when the machine's steps are known.
 * @param props The active mode, the challenge input, the machine's examples and challenges, the panel operations, the machine steps, the persisted tests, and the feed and test handlers.
 */
export function Workspace({
  mode,
  challengeInput,
  examples,
  challenges,
  panelOps,
  steps,
  tests,
  misses,
  onFeed,
  onTest,
}: {
  readonly mode: Mode;
  readonly challengeInput: string;
  readonly examples: readonly ChipPair[];
  readonly challenges: readonly ChipPair[];
  readonly panelOps: readonly string[];
  readonly steps?: readonly RuleStep[] | undefined;
  readonly tests: readonly TestResult[];
  readonly misses: number;
  readonly onFeed: (submission: Submission) => void;
  readonly onTest: (result: TestResult) => void;
}) {
  const [guessDraft, setGuessDraft] = useState(NO_DRAFT);
  const [recipeSteps, setRecipeSteps] = useState<readonly Step[]>(NO_STEPS);

  const canTest = steps !== undefined && steps.length > 0;
  const guessReadsWords = machineReadsWords(examples.at(0)?.[1] ?? challengeInput);
  const guessChips = tokenize(guessDraft);

  const feedGuess = (): void => {
    onFeed({ kind: SUBMISSION_GUESS, chips: guessChips.join(TOKEN_JOIN) });
    setGuessDraft(NO_DRAFT);
  };

  let body;
  if (mode === MODE_TEST && canTest) {
    body = (
      <ChipTester
        challengeInput={challengeInput}
        examples={examples.slice(0, SEEDED_EXAMPLE_COUNT)}
        challenges={challenges}
        steps={steps}
        tests={tests}
        onRun={onTest}
      />
    );
  } else if (mode === MODE_RECIPE) {
    body = (
      <ChipBuilder
        challengeInput={challengeInput}
        truth={[...examples, ...challenges]}
        panelOps={panelOps}
        initialSteps={recipeSteps}
        misses={misses}
        onStepsChange={setRecipeSteps}
        onFeed={onFeed}
      />
    );
  } else {
    body = (
      <div className={CLASS_GUESS}>
        <ChipComposer words={guessReadsWords} value={guessDraft} onChange={setGuessDraft} role={CLASS_CHIP_GUESS} />
        <MissPips misses={misses} />
        <button type="button" className={CLASS_FEED} onClick={feedGuess} disabled={guessChips.length === 0}>
          {COPY_FEED_BUTTON}
        </button>
      </div>
    );
  }

  return (
    <div className={CLASS_BOTTOM + " " + CLASS_WORKSPACE}>
      <div className={CLASS_MODE_BODY} key={mode}>
        {body}
      </div>
    </div>
  );
}
