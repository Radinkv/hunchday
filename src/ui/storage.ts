/**
 * Per day game state persistence in the browser.
 *
 * The game is local and has no server, so progress is kept in localStorage rather than
 * cookies, which would be sent on every request for no reason. State is keyed by the
 * puzzle's date so each day starts fresh and a reload resumes exactly where the player
 * left off, including the finished results screen. Loads are defensive: anything missing,
 * unparseable, or shaped for a different machine count is treated as no saved game.
 */

import type { GameState } from "../game/types";

/** The localStorage key prefix; the version guards against reading an old state shape. */
const STORAGE_PREFIX = "hunchday:v1:";

/**
 * Reports whether a parsed value is a usable saved game for the current machine set.
 * @param value The parsed value.
 * @param machineCount The number of machines in today's set.
 * @returns True when the value is a game state with a matching results length.
 */
function isSavedGame(value: unknown, machineCount: number): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.machineIndex === "number" &&
    Array.isArray(candidate.results) &&
    candidate.results.length === machineCount
  );
}

/**
 * Loads the saved game for a day, or null when there is none or it cannot be trusted.
 * @param dateKey The puzzle date that scopes the saved game.
 * @param machineCount The number of machines in today's set.
 * @returns The saved game state, or null.
 */
export function loadGame(dateKey: string, machineCount: number): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + dateKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed, machineCount) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Saves the game for a day, ignoring storage failures such as private mode or quota.
 * @param dateKey The puzzle date that scopes the saved game.
 * @param state The game state to persist.
 */
export function saveGame(dateKey: string, state: GameState): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + dateKey, JSON.stringify(state));
  } catch {
    return;
  }
}
