import { describe, expect, it } from "vitest";
import { MACHINES } from "../src/prototype/machines";
import {
  crackedCount,
  feed,
  isLastMachine,
  nextMachine,
  shareText,
  startGame,
  tokenize,
} from "../src/prototype/reducer";
import {
  FEEDBACK_CORRECT_MORE,
  FEEDBACK_CORRECT_TWICE,
  FEEDBACK_WRONG,
  MARK_EXAMPLE,
  MARK_HIT,
  MARK_MISS,
  PHASE_PLAYING,
  PHASE_REVEALED,
  type GameState,
  type Machine,
} from "../src/prototype/types";
import {
  EMOJI_CRACKED,
  SHARE_COUNT_SEPARATOR,
  SHARE_CRACKED_LABEL,
  SHARE_HEADER,
  SHARE_LINE_BREAK,
  SHARE_MISS_SUFFIX,
  SHARE_STAT_SEPARATOR,
} from "../src/prototype/constants";

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
 * Builds the expected seeded evidence rows for a machine from its example pairs, so
 * the expectation tracks the source data rather than duplicating chip strings.
 * @param machine The machine whose examples seed the evidence.
 * @returns The evidence rows expected at the start of that machine.
 */
function expectedExampleRows(machine: Machine) {
  return machine.ex.map(([input, output]) => ({ input, output, mark: MARK_EXAMPLE }));
}

/**
 * Plays a machine to a crack by answering its first two challenges correctly.
 * @param state The state positioned at the start of a machine.
 * @param machines The full machine set.
 * @returns The revealed state after cracking the machine.
 */
function crack(state: GameState, machines: readonly Machine[]): GameState {
  const machine = machines[state.machineIndex];
  let result = feed(state, machines, machine.ch[0][1]);
  result = feed(result, machines, machine.ch[1][1]);
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
  it("returns the same state reference on empty input", () => {
    const state = startGame(MACHINES);
    expect(feed(state, MACHINES, "   ")).toBe(state);
  });

  it("cracks the machine after two correct answers in a row", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[0][1]);
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.streak).toBe(1);
    expect(state.challengeIndex).toBe(1);
    expect(state.feedback).toBe(FEEDBACK_CORRECT_MORE);
    expect(state.evidence.at(-1)).toEqual({
      input: FIRST_MACHINE.ch[0][0],
      output: FIRST_MACHINE.ch[0][1],
      mark: MARK_HIT,
    });

    state = feed(state, MACHINES, FIRST_MACHINE.ch[1][1]);
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(true);
    expect(state.streak).toBe(2);
    expect(state.feedback).toBe(FEEDBACK_CORRECT_TWICE);
    expect(state.results[0]).toBe(true);
  });

  it("accepts answers regardless of comma and space formatting", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, "6,  8");
    expect(state.streak).toBe(1);
  });

  it("reveals the true output, counts a miss, and resets the streak on a wrong guess", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[0][1]);
    state = feed(state, MACHINES, WRONG_GUESS);
    expect(state.misses).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.phase).toBe(PHASE_PLAYING);
    expect(state.evidence.at(-1)).toEqual({
      input: FIRST_MACHINE.ch[1][0],
      output: FIRST_MACHINE.ch[1][1],
      mark: MARK_MISS,
    });
    expect(state.feedback).toBe(FEEDBACK_WRONG);
  });

  /**
   * The original prototype cracked a machine when the final challenge was answered
   * correctly even if the streak was only one, because reaching the end of the
   * challenges with a correct final guess ends the machine as a win. This test pins
   * that behavior so it stays a deliberate decision rather than an accident.
   */
  it("treats a correct final guess as a crack even at a streak of one", () => {
    let state = startGame(MACHINES);
    const lastChallengeIndex = FIRST_MACHINE.ch.length - 1;
    for (let attempt = 0; attempt < lastChallengeIndex; attempt++) {
      state = feed(state, MACHINES, WRONG_GUESS);
    }
    expect(state.challengeIndex).toBe(lastChallengeIndex);
    expect(state.streak).toBe(0);
    expect(state.misses).toBe(lastChallengeIndex);

    state = feed(state, MACHINES, FIRST_MACHINE.ch[lastChallengeIndex][1]);
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(true);
    expect(state.feedback).toBe(FEEDBACK_CORRECT_MORE);
  });

  it("reveals as a loss when the final guess is wrong", () => {
    let state = startGame(MACHINES);
    for (const _element of FIRST_MACHINE.ch) {
      state = feed(state, MACHINES, WRONG_GUESS);
    }
    expect(state.phase).toBe(PHASE_REVEALED);
    expect(state.won).toBe(false);
    expect(state.results[0]).toBe(false);
    expect(state.misses).toBe(FIRST_MACHINE.ch.length);
  });

  it("ignores further feeds once the machine is revealed", () => {
    const revealed = crack(startGame(MACHINES), MACHINES);
    expect(feed(revealed, MACHINES, WRONG_GUESS)).toBe(revealed);
  });
});

describe("machine progression", () => {
  it("resets per machine fields on advance while carrying results and misses forward", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, WRONG_GUESS);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[1][1]);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[2][1]);
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
