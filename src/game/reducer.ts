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
  MARK_EXAMPLE,
  MARK_HIT,
  MARK_MISS,
  MARK_TEST,
  MAX_TESTS,
  PHASE_PLAYING,
  PHASE_REVEALED,
  SUBMISSION_RECIPE,
} from "./types";
import type { EvidenceRow, GameState, Machine, Submission, TestResult } from "./types";
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

/**
 * Number of wrong answers on a machine that ends it without a crack. A machine reveals as a loss
 * on the third miss, so two wrong guesses or recipes are survivable and the third is fatal.
 */
export const MISSES_TO_FAIL = 3;

/** Number of example pairs shown for free when a machine loads; the rest are earned by playing. */
export const SEEDED_EXAMPLE_COUNT = 1;

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
export function chipsEqual(a: string, b: string): boolean {
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
 * Builds the seeded evidence rows for a machine. Only the first example is shown for free; the
 * player earns more of the machine's behaviour by testing and by guessing the challenges that the
 * Guess tab reveals one at a time.
 * @param machine The machine whose first example becomes the initial evidence.
 * @returns A single evidence row carrying the example mark.
 */
function exampleRows(machine: Machine): EvidenceRow[] {
  return machine.ex.slice(0, SEEDED_EXAMPLE_COUNT).map(([input, output]) => buildEvidenceRow(input, output, MARK_EXAMPLE));
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
    ended: false,
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
    ended: false,
  };
  return loadMachine(blank, machines, FIRST_MACHINE_INDEX);
}

/**
 * Appends every generated example and challenge that has not already been shown, as example rows,
 * so a revealed machine displays its full behaviour. On a crack this confirms the rule against the
 * whole set; on a loss it fills in the remaining answers the player never reached. Rows whose input
 * is already in the evidence, whether a shown example, a tested input, a hit, or a miss, are not
 * repeated.
 * @param machine The current machine whose full example and challenge set is revealed.
 * @param evidence The evidence gathered so far.
 * @returns The evidence with the remaining example and challenge rows appended.
 */
function withRemainingRevealed(machine: Machine, evidence: EvidenceRow[]): EvidenceRow[] {
  const remaining = [...machine.ex, ...machine.ch].filter(
    ([input]) => !evidence.some((row) => chipsEqual(row.input, input)),
  );
  return [...evidence, ...remaining.map(([input, output]) => buildEvidenceRow(input, output, MARK_EXAMPLE))];
}

/**
 * Produces the revealed state for the current machine and records its outcome.
 * The transition writes the outcome into a copied results list so the input state
 * remains unchanged, appends the machine's remaining examples and answers, then marks
 * the machine phase as revealed.
 * @param state The current state whose machine is being revealed.
 * @param machine The current machine, whose full example set is revealed.
 * @param evidence The evidence list to carry into the revealed state.
 * @param streak The streak value to record.
 * @param misses The cumulative miss count to record.
 * @param won Whether the machine was cracked.
 * @returns The revealed state.
 */
function reveal(
  state: GameState,
  machine: Machine,
  evidence: EvidenceRow[],
  streak: number,
  misses: number,
  won: boolean,
): GameState {
  const results = state.results.slice();
  results[state.machineIndex] = won;
  const fullEvidence = withRemainingRevealed(machine, evidence);
  return { ...state, streak, misses, results, evidence: fullEvidence, feedback: null, phase: PHASE_REVEALED, won };
}

/**
 * Records a wrong answer for the current challenge and returns the next state. The true
 * output is added as a fresh evidence row, the miss count rises, and play advances to the next
 * challenge. The machine reveals as a loss once this machine has reached the miss limit, so the
 * second wrong answer ends it, and also if the challenges somehow run out first. Both a guess
 * and a recipe attach the chips the player produced for the challenge so the row can show them
 * beside the truth; the chips are omitted only when none were produced, leaving a clean reveal.
 * @param state The current game state.
 * @param machine The current machine.
 * @param guess The player's chips to show beside the truth, or undefined for a clean reveal.
 * @returns The next game state.
 */
function recordMiss(state: GameState, machine: Machine, guess?: string): GameState {
  const [challengeInput, challengeOutput] = machine.ch[state.challengeIndex];
  const misses = state.misses + NEXT_INDEX_DELTA;
  const evidence = [...state.evidence, buildEvidenceRow(challengeInput, challengeOutput, MARK_MISS, guess)];
  const challengeIndex = state.challengeIndex + NEXT_INDEX_DELTA;
  const missesThisMachine = evidence.filter((row) => row.mark === MARK_MISS).length;
  if (missesThisMachine >= MISSES_TO_FAIL || challengeIndex >= machine.ch.length) {
    return reveal(state, machine, evidence, RESET_STREAK, misses, false);
  }
  return { ...state, streak: RESET_STREAK, misses, evidence, challengeIndex };
}

/**
 * Processes one submission against the current machine and returns the next state. A
 * submission after the machine has been revealed keeps the state unchanged. A recipe is
 * judged against every example at once by the submitting layer: a recipe that reproduces
 * them all cracks the machine on its own, while a wrong recipe records a miss showing what
 * the recipe produced on the challenge beside the truth. A guess is judged against the
 * current challenge: a correct guess appends a hit row and cracks once two land in a row or
 * the final challenge is answered, while a wrong guess appends a miss row showing the
 * player's chips beside the truth. No transition sets player facing feedback text; the
 * evidence rows carry the whole story.
 * @param state The current game state.
 * @param machines The full machine set.
 * @param submission The guess or recipe being judged.
 * @returns The next game state.
 */
export function feed(state: GameState, machines: readonly Machine[], submission: Submission): GameState {
  if (state.phase !== PHASE_PLAYING) return state;

  const machine = machines[state.machineIndex];
  const [challengeInput, challengeOutput] = machine.ch[state.challengeIndex];

  if (submission.kind === SUBMISSION_RECIPE) {
    if (submission.matchesAllExamples) {
      const evidence = [...state.evidence, buildEvidenceRow(challengeInput, challengeOutput, MARK_HIT)];
      return reveal(state, machine, evidence, state.streak, state.misses, true);
    }
    return recordMiss(state, machine, submission.chips);
  }

  if (!chipsEqual(submission.chips, challengeOutput)) {
    return recordMiss(state, machine, submission.chips);
  }

  const streak = state.streak + NEXT_INDEX_DELTA;
  const evidence = [...state.evidence, buildEvidenceRow(challengeInput, challengeOutput, MARK_HIT)];
  if (streak >= STREAK_TO_CRACK) {
    return reveal(state, machine, evidence, streak, state.misses, true);
  }
  const challengeIndex = state.challengeIndex + NEXT_INDEX_DELTA;
  if (challengeIndex >= machine.ch.length) {
    return reveal(state, machine, evidence, streak, state.misses, true);
  }
  return { ...state, streak, evidence, challengeIndex };
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
 * Counts the tests already run against the current machine, read from the evidence so the
 * budget needs no separate state and survives a reload along with the rest of the log.
 * @param state The current game state.
 * @returns The number of test marked evidence rows.
 */
export function testsRun(state: GameState): number {
  return state.evidence.filter((row) => row.mark === MARK_TEST).length;
}

/**
 * Records one completed test against the current machine as a test marked evidence row, so it
 * shows in the running log like any other input. A test is ignored once the machine is no longer
 * being played or the budget is already spent, so the bench cannot be reloaded for more tries.
 * @param state The current game state.
 * @param result The completed test to record.
 * @returns The next game state with the test appended, or the state unchanged.
 */
export function recordTest(state: GameState, result: TestResult): GameState {
  if (state.phase !== PHASE_PLAYING || testsRun(state) >= MAX_TESTS) return state;
  const evidence = [...state.evidence, buildEvidenceRow(result.input, result.output, MARK_TEST)];
  return { ...state, evidence };
}

/**
 * Ends the game from the final machine's revealed state, so the player dismisses the last
 * reveal before the results screen is shown rather than skipping straight past it.
 * @param state The current revealed state of the final machine.
 * @returns The state marked as ended.
 */
export function finish(state: GameState): GameState {
  return { ...state, ended: true };
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
