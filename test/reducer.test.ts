import { describe, expect, it } from "vitest";
import { MACHINES } from "../src/game/machines";
import {
  crackedCount,
  feed,
  isLastMachine,
  MISSES_TO_FAIL,
  missLimitFor,
  nextMachine,
  recordTest,
  shareText,
  startGame,
  testsRun,
  tokenize,
} from "../src/game/reducer";
import {
  MARK_EXAMPLE,
  MARK_HIT,
  MARK_MISS,
  PHASE_PLAYING,
  PHASE_REVEALED,
  SUBMISSION_GUESS,
  SUBMISSION_RECIPE,
  testBudgetFor,
  type GameState,
  type Machine,
  type Submission,
} from "../src/game/types";
import {
  EMOJI_CRACKED,
  SHARE_COUNT_SEPARATOR,
  SHARE_CRACKED_LABEL,
  SHARE_HEADER,
  SHARE_LINE_BREAK,
  SHARE_MISS_SUFFIX,
  SHARE_STAT_SEPARATOR,
} from "../src/game/constants";

/**
 * These tests pin the reducer to the exact behavior of the prototype's original feed
 * loop. They are the regression guard for the converted interface: if a later phase
 * changes the loop, it must change these expectations too, which makes any behavior
 * change a deliberate and visible decision. State tokens and copy come from the same
 * sources the implementation uses, so a renamed token updates the tests in step.
 */

const FIRST_MACHINE = MACHINES[0];
const SECOND_MACHINE = MACHINES[1];

/** A guess that is wrong for every challenge in the prototype set. */
const WRONG_GUESS = "nope";

/**
 * Wraps chips as a guess submission, the per challenge answer judged two in a row.
 * @param chips The composed output chips.
 * @returns A guess submission.
 */
function guess(chips: string): Submission {
  return { kind: SUBMISSION_GUESS, chips };
}

/**
 * Wraps a recipe verdict as a recipe submission, judged against every example at once.
 * @param matchesAllExamples Whether the recipe reproduces every example.
 * @returns A recipe submission.
 */
function recipe(matchesAllExamples: boolean): Submission {
  return { kind: SUBMISSION_RECIPE, matchesAllExamples };
}

/**
 * Builds the expected seeded evidence rows for a machine, only the first example, so the
 * expectation tracks the source data rather than duplicating chip strings.
 * @param machine The machine whose first example seeds the evidence.
 * @returns The evidence rows expected at the start of that machine.
 */
function expectedExampleRows(machine: Machine) {
  return machine.ex.slice(0, 1).map(([input, output]) => ({ input, output, mark: MARK_EXAMPLE }));
}

/**
 * Plays a machine to a crack by answering its first two challenges correctly.
 * @param state The state positioned at the start of a machine.
 * @param machines The full machine set.
 * @returns The revealed state after cracking the machine.
 */
function crack(state: GameState, machines: readonly Machine[]): GameState {
  const machine = machines[state.machineIndex];
  let result = feed(state, machines, guess(machine.ch[0][1]));
  result = feed(result, machines, guess(machine.ch[1][1]));
  return result;
}

describe("tokenize", () => {
  it("lowercases, splits on whitespace and commas, and drops empty tokens", () => {
    expect(tokenize("  6   8 ")).toEqual(["6", "8"]);
    expect(tokenize("6, 8")).toEqual(["6", "8"]);
    expect(tokenize("CAT")).toEqual(["cat"]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("startGame", () => {
  it("seeds examples as evidence and leaves every result unplayed", () => {
    const state = startGame(MACHINES);
    expect(state.machineIndex).toBe(0);
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.results).toEqual(MACHINES.map(() => null));
    expect(state.evidence).toEqual(expectedExampleRows(FIRST_MACHINE));
    expect(state.misses).toBe(0);
  });
});

describe("feed", () => {
  it("treats an empty computed result as a wrong guess rather than a no-op", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess("   "));
    expect(state.misses).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.evidence.at(-1)?.mark).toBe(MARK_MISS);
  });

  it("cracks the machine after two correct guesses in a row", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[0][1]));
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.streak).toBe(1);
    expect(state.challengeIndex).toBe(1);
    expect(state.evidence.at(-1)).toEqual({
      input: FIRST_MACHINE.ch[0][0],
      output: FIRST_MACHINE.ch[0][1],
      mark: MARK_HIT,
    });

    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[1][1]));
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(true);
    expect(state.streak).toBe(2);
    expect(state.results[0]).toBe(true);
  });

  it("cracks the machine on a single recipe that matches every example", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, recipe(true));
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(true);
    expect(state.results[0]).toBe(true);
    expect(state.misses).toBe(0);
    expect(state.evidence.some((row) => row.mark === MARK_HIT)).toBe(true);
  });

  /**
   * Revealing a machine fills in its whole behaviour: every generated example and challenge input
   * appears in the evidence once the machine is cracked, so the player sees the full set.
   */
  it("reveals every example and challenge input when the machine is cracked", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, recipe(true));
    const allInputs = [...FIRST_MACHINE.ex, ...FIRST_MACHINE.ch].map(([input]) => input);
    for (const input of allInputs) {
      expect(state.evidence.some((row) => row.input === input)).toBe(true);
    }
  });

  it("reveals the next example with no player chips when a recipe misses", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, recipe(false));
    expect(state.misses).toBe(1);
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.evidence.at(-1)).toEqual({
      input: FIRST_MACHINE.ch[0][0],
      output: FIRST_MACHINE.ch[0][1],
      mark: MARK_MISS,
    });
  });

  it("accepts answers regardless of comma and space formatting", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess("6,  8"));
    expect(state.streak).toBe(1);
  });

  it("reveals the true output, counts a miss, and resets the streak on a wrong guess", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[0][1]));
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    expect(state.misses).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.evidence.at(-1)).toEqual({
      input: FIRST_MACHINE.ch[1][0],
      output: FIRST_MACHINE.ch[1][1],
      mark: MARK_MISS,
      guess: WRONG_GUESS,
    });
  });

  /**
   * Two wrong answers are survivable: after two misses the machine stays in play, and two correct
   * guesses in a row still crack it. This pins that the third miss, not the second, is fatal.
   */
  it("survives two wrong answers and still cracks on two correct in a row", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.misses).toBe(2);

    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[2][1]));
    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[3][1]));
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(true);
  });

  it("reveals as a loss on the third wrong answer", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    expect(state.phase).toBe(PHASE_PLAYING);

    state = feed(state, MACHINES, guess(WRONG_GUESS));
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(false);
    expect(state.results[0]).toBe(false);
    expect(state.misses).toBe(MISSES_TO_FAIL);
  });

  it("ignores further feeds once the machine is revealed", () => {
    const revealed = crack(startGame(MACHINES), MACHINES);
    expect(feed(revealed, MACHINES, guess(WRONG_GUESS))).toBe(revealed);
  });
});

describe("per difficulty limits", () => {
  const HARD_MACHINE: Machine = {
    difficulty: "hard",
    rule: "It is the hard finale.",
    ex: [["1", "2"]],
    ch: [
      ["1", "0"],
      ["2", "0"],
      ["3", "0"],
      ["4", "0"],
      ["5", "0"],
    ],
    panelOps: [],
  };

  it("derives the test budget and miss limit from difficulty", () => {
    expect(testBudgetFor("hard")).toBe(3);
    expect(testBudgetFor("easy")).toBe(2);
    expect(missLimitFor("hard")).toBe(4);
    expect(missLimitFor("easy")).toBe(3);
  });

  it("lets the hard machine survive three wrong answers and fail on the fourth", () => {
    let state = startGame([HARD_MACHINE]);
    for (let attempt = 0; attempt < 3; attempt++) state = feed(state, [HARD_MACHINE], guess(WRONG_GUESS));
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.misses).toBe(3);

    state = feed(state, [HARD_MACHINE], guess(WRONG_GUESS));
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(false);
    expect(state.misses).toBe(missLimitFor("hard"));
  });

  it("grants the hard machine three test probes before locking", () => {
    let state = startGame([HARD_MACHINE]);
    for (let probe = 0; probe < 4; probe++) {
      state = recordTest(state, HARD_MACHINE, { input: String(probe + 10), output: "x" });
    }
    expect(testsRun(state)).toBe(testBudgetFor("hard"));
  });
});

describe("machine progression", () => {
  it("resets per machine fields on advance while carrying results and misses forward", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, guess(WRONG_GUESS));
    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[1][1]));
    state = feed(state, MACHINES, guess(FIRST_MACHINE.ch[2][1]));
    expect(state.results[0]).toBe(true);
    expect(state.misses).toBe(1);

    state = nextMachine(state, MACHINES);
    expect(state.machineIndex).toBe(1);
    expect(state.challengeIndex).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.misses).toBe(1);
    expect(state.results[0]).toBe(true);
    expect(state.evidence).toEqual(expectedExampleRows(SECOND_MACHINE));
  });

  it("reports the last machine only on the final index", () => {
    const state = startGame(MACHINES);
    expect(isLastMachine(state, MACHINES)).toBe(false);
    expect(isLastMachine({ ...state, machineIndex: MACHINES.length - 1 }, MACHINES)).toBe(true);
  });
});

describe("end screen", () => {
  it("reports a clean sweep through cracked count and share text", () => {
    let state = startGame(MACHINES);
    for (const _element of MACHINES) {
      state = crack(state, MACHINES);
      if (!isLastMachine(state, MACHINES)) state = nextMachine(state, MACHINES);
    }
    expect(crackedCount(state)).toBe(MACHINES.length);

    const noMisses = 0;
    const expectedShare =
      SHARE_HEADER +
      SHARE_LINE_BREAK +
      EMOJI_CRACKED.repeat(MACHINES.length) +
      SHARE_LINE_BREAK +
      SHARE_CRACKED_LABEL +
      MACHINES.length +
      SHARE_COUNT_SEPARATOR +
      MACHINES.length +
      SHARE_STAT_SEPARATOR +
      noMisses +
      SHARE_MISS_SUFFIX;
    expect(shareText(state, MACHINES)).toBe(expectedShare);
  });
});
