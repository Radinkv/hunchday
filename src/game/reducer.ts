/**
 * Pure game logic for the prototype loop.
 *
 * There is no document object model access and no shared mutable state here. Every
 * transition is a pure function from a state, the machine set, and an input to a new
 * state, which is what lets the interface behavior be verified without a browser.
 * This module is the future machine reducer for the generated content phase; the
 * only thing that changes later is where the machine set originates.
 */

import {
  FEEDBACK_CORRECT_MORE,
  FEEDBACK_CORRECT_TWICE,
  FEEDBACK_WRONG,
  MARK_EXAMPLE,
  MARK_HIT,
  MARK_MISS,
  PHASE_PLAYING,
  PHASE_REVEALED,
} from "./types";
import type { EvidenceRow, FeedbackKind, GameState, Machine } from "./types";
import {
  EMOJI_CRACKED,
  EMOJI_REVEALED,
  SHARE_COUNT_SEPARATOR,
  SHARE_CRACKED_LABEL,
  SHARE_HEADER,
  SHARE_LINE_BREAK,
  SHARE_MISS_SUFFIX,
  SHARE_STAT_SEPARATOR,
} from "./constants";

/** Number of consecutive correct answers that cracks a machine. */
const STREAK_TO_CRACK = 2;

/** Initial indexes and counters used when loading a machine or starting a game. */
const FIRST_MACHINE_INDEX = 0;
const INITIAL_CHALLENGE_INDEX = 0;
const INITIAL_STREAK = 0;
const INITIAL_MISS_COUNT = 0;
const NEXT_INDEX_DELTA = 1;

/** Counter resets applied when a guess is wrong. */
const RESET_STREAK = 0;

/**
 * Splits a chip string into normalized tokens the same way the prototype did:
 * lowercases the text, splits on any run of whitespace or commas, and drops empty
 * tokens. Used both for rendering chips and for comparing a guess to an answer.
 * @param value The raw chip string to tokenize.
 * @returns The ordered list of normalized chip tokens.
 */
export function tokenize(value: string): string[] {
  return String(value).toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
}

/**
 * Reports whether two chip strings are equal by comparing their token sequences,
 * so differences in spacing, comma usage, or letter case do not matter.
 * @param a The first chip string.
 * @param b The second chip string.
 * @returns True when the two strings tokenize to the same sequence.
 */
function chipsEqual(a: string, b: string): boolean {
  return tokenize(a).join(",") === tokenize(b).join(",");
}

/**
 * Builds one evidence row with a mark that remains inside the EvidenceRow mark
 * vocabulary instead of widening to a generic string. A guess is attached only when
 * given, so a miss row can show the player's output beside the true output.
 * @param input The challenge input chips.
 * @param output The challenge output chips.
 * @param mark The evidence mark token.
 * @param guess The player's guessed output, for a miss row.
 * @returns One evidence row.
 */
function buildEvidenceRow(input: string, output: string, mark: EvidenceRow["mark"], guess?: string): EvidenceRow {
  return guess === undefined ? { input, output, mark } : { input, output, mark, guess };
}

/**
 * Builds the seeded evidence rows for a machine from its example pairs.
 * @param machine The machine whose examples become the initial evidence.
 * @returns One evidence row per example, each carrying the example mark.
 */
function exampleRows(machine: Machine): EvidenceRow[] {
  return machine.ex.map(([input, output]) => buildEvidenceRow(input, output, MARK_EXAMPLE));
}

/**
 * Produces a fresh state positioned at the start of the requested machine while
 * carrying cumulative results and miss count forward from the previous state.
 * The transition resets challenge progress, streak, seeded evidence, feedback,
 * phase, and machine outcome fields for the loaded machine.
 * @param previous The state to carry cumulative progress from.
 * @param machines The full machine set.
 * @param machineIndex The index of the machine to load.
 * @returns The state ready to play the requested machine.
 */
function loadMachine(previous: GameState, machines: readonly Machine[], machineIndex: number): GameState {
  return {
    machineIndex,
    challengeIndex: INITIAL_CHALLENGE_INDEX,
    streak: INITIAL_STREAK,
    misses: previous.misses,
    results: previous.results,
    evidence: exampleRows(machines[machineIndex]),
    feedback: null,
    phase: PHASE_PLAYING,
    won: null,
  };
}

/**
 * Begins a fresh game at the first machine with no recorded results and no misses.
 * It seeds a baseline state and then loads machine zero through the same transition
 * used for later machine changes.
 * @param machines The full machine set.
 * @returns The starting state for a new game.
 */
export function startGame(machines: readonly Machine[]): GameState {
  const blank: GameState = {
    machineIndex: FIRST_MACHINE_INDEX,
    challengeIndex: INITIAL_CHALLENGE_INDEX,
    streak: INITIAL_STREAK,
    misses: INITIAL_MISS_COUNT,
    results: machines.map(() => null),
    evidence: [],
    feedback: null,
    phase: PHASE_PLAYING,
    won: null,
  };
  return loadMachine(blank, machines, FIRST_MACHINE_INDEX);
}

/**
 * Produces the revealed state for the current machine and records its outcome.
 * The transition writes the outcome into a copied results list so the input state
 * remains unchanged, then marks the machine phase as revealed.
 * @param state The current state whose machine is being revealed.
 * @param evidence The evidence list to carry into the revealed state.
 * @param streak The streak value to record.
 * @param misses The cumulative miss count to record.
 * @param won Whether the machine was cracked.
 * @param feedback The feedback kind to display alongside the reveal.
 * @returns The revealed state.
 */
function reveal(
  state: GameState,
  evidence: EvidenceRow[],
  streak: number,
  misses: number,
  won: boolean,
  feedback: FeedbackKind,
): GameState {
  const results = state.results.slice();
  results[state.machineIndex] = won;
  return { ...state, streak, misses, results, evidence, feedback, phase: PHASE_REVEALED, won };
}

/**
 * Processes one guess against the current challenge and returns the next state.
 * Empty input and input submitted after reveal both keep the state unchanged.
 * A correct guess appends a hit row and advances the streak. A wrong guess appends
 * a miss row with the revealed output, increments misses, and resets the streak.
 * When the challenge list is exhausted, the machine reveals with the same win and
 * loss behavior as the original prototype loop.
 * @param state The current game state.
 * @param machines The full machine set.
 * @param guess The player guess for the current challenge.
 * @returns The next game state.
 */
export function feed(state: GameState, machines: readonly Machine[], guess: string): GameState {
  if (state.phase !== PHASE_PLAYING) return state;
  if (tokenize(guess).length === 0) return state;

  const machine = machines[state.machineIndex];
  const [challengeInput, challengeOutput] = machine.ch[state.challengeIndex];
  const correct = chipsEqual(guess, challengeOutput);

  if (correct) {
    const streak = state.streak + 1;
    const evidence = [...state.evidence, buildEvidenceRow(challengeInput, challengeOutput, MARK_HIT)];
    if (streak >= STREAK_TO_CRACK) {
      return reveal(state, evidence, streak, state.misses, true, FEEDBACK_CORRECT_TWICE);
    }
    const challengeIndex = state.challengeIndex + NEXT_INDEX_DELTA;
    if (challengeIndex >= machine.ch.length) {
      return reveal(state, evidence, streak, state.misses, true, FEEDBACK_CORRECT_MORE);
    }
    return { ...state, streak, evidence, challengeIndex, feedback: FEEDBACK_CORRECT_MORE };
  }

  const misses = state.misses + NEXT_INDEX_DELTA;
  const evidence = [...state.evidence, buildEvidenceRow(challengeInput, challengeOutput, MARK_MISS, guess)];
  const challengeIndex = state.challengeIndex + NEXT_INDEX_DELTA;
  if (challengeIndex >= machine.ch.length) {
    return reveal(state, evidence, RESET_STREAK, misses, false, FEEDBACK_WRONG);
  }
  return { ...state, streak: RESET_STREAK, misses, evidence, challengeIndex, feedback: FEEDBACK_WRONG };
}

/**
 * Advances from a revealed machine to the next machine in sequence.
 * This function assumes the caller has already validated that a next machine exists.
 * @param state The current revealed state.
 * @param machines The full machine set.
 * @returns The state ready to play the following machine.
 */
export function nextMachine(state: GameState, machines: readonly Machine[]): GameState {
  return loadMachine(state, machines, state.machineIndex + NEXT_INDEX_DELTA);
}

/**
 * Restarts the full game from its initial state.
 * @param machines The full machine set.
 * @returns A fresh starting state.
 */
export function restart(machines: readonly Machine[]): GameState {
  return startGame(machines);
}

/**
 * Reports whether the current machine is the final one in the set.
 * @param state The current game state.
 * @param machines The full machine set.
 * @returns True when the current machine is the last machine.
 */
export function isLastMachine(state: GameState, machines: readonly Machine[]): boolean {
  return state.machineIndex === machines.length - 1;
}

/**
 * Counts how many machines have been cracked.
 * @param state The current game state.
 * @returns The number of machines whose result is recorded as cracked.
 */
export function crackedCount(state: GameState): number {
  return state.results.filter((result) => result === true).length;
}

/**
 * Builds the shareable result summary using the same wording and structure as the
 * prototype output. The summary includes a header line, a machine result grid,
 * and a final tally line with cracked count and misses.
 * @param state The current game state.
 * @param machines The full machine set.
 * @returns The multi line share text.
 */
export function shareText(state: GameState, machines: readonly Machine[]): string {
  const grid = state.results.map((result) => (result ? EMOJI_CRACKED : EMOJI_REVEALED)).join("");
  const cracked = crackedCount(state);
  return (
    SHARE_HEADER +
    SHARE_LINE_BREAK +
    grid +
    SHARE_LINE_BREAK +
    SHARE_CRACKED_LABEL +
    cracked +
    SHARE_COUNT_SEPARATOR +
    machines.length +
    SHARE_STAT_SEPARATOR +
    state.misses +
    SHARE_MISS_SUFFIX
  );
}
