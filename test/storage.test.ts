// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { loadGame, machinesSignature, saveGame } from "../src/ui/storage";
import { MARK_EXAMPLE, PHASE_PLAYING, type GameState, type Machine } from "../src/game/types";

/**
 * These tests cover the per day save guard. A save resumes only when the stored signature
 * matches the current machine set, so a redeploy that ships different puzzles for a date
 * the player had in progress discards the stale save rather than resuming old evidence
 * over a new panel. This is the guard that lets the whole game redeploy safely.
 */

const DATE = "2026-06-15";

const MACHINE: Machine = {
  difficulty: "super_easy",
  rule: "It adds 2 to every chip.",
  ex: [
    ["1 2", "3 4"],
    ["5 6", "7 8"],
  ],
  ch: [["3 4", "5 6"]],
  panelOps: ["add_k", "sub_k", "mul_k"],
};

const CHANGED_MACHINE: Machine = { ...MACHINE, rule: "It multiplies every chip by 2." };

const STATE: GameState = {
  machineIndex: 0,
  challengeIndex: 0,
  streak: 1,
  misses: 0,
  results: [null],
  evidence: [{ input: "1 2", output: "3 4", mark: MARK_EXAMPLE }],
  feedback: null,
  phase: PHASE_PLAYING,
  won: null,
};

afterEach(() => {
  localStorage.clear();
});

describe("save guard", () => {
  it("resumes a save when the machine set is unchanged", () => {
    saveGame(DATE, STATE, [MACHINE]);
    expect(loadGame(DATE, [MACHINE])).toEqual(STATE);
  });

  it("discards the save when the day's puzzles changed under it", () => {
    saveGame(DATE, STATE, [MACHINE]);
    expect(loadGame(DATE, [CHANGED_MACHINE])).toBeNull();
  });

  it("returns null when there is no save", () => {
    expect(loadGame(DATE, [MACHINE])).toBeNull();
  });

  it("signs different machine sets differently", () => {
    expect(machinesSignature([MACHINE])).not.toBe(machinesSignature([CHANGED_MACHINE]));
  });
});
