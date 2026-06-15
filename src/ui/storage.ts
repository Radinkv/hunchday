/**
 * Per day game state persistence in the browser.
 *
 * The game is local and has no server, so progress is kept in localStorage rather than
 * cookies, which would be sent on every request for no reason. State is keyed by the
 * puzzle's date so each day starts fresh and a reload resumes exactly where the player
 * left off, including the finished results screen.
 *
 * A save is stamped with a signature of the exact machine set it was played against. On
 * load the signature is recomputed from the current machines and the save is discarded on
 * any mismatch, so a redeploy that ships new puzzles for a date the player had in progress
 * silently starts a fresh game rather than resuming stale evidence over a new panel. Loads
 * are otherwise defensive: anything missing, unparseable, or shaped for a different machine
 * count is treated as no saved game.
 */

import type { GameState, Machine } from "../game/types";

/** The localStorage key prefix; the version guards against reading an old state shape. */
const STORAGE_PREFIX = "hunchday:v2:";

/** The FNV-1a constants used to derive a compact signature of the day's machine set. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;

/** The shape persisted per day: the signature of the machine set and the game state. */
interface SavedRecord {
  readonly sig: string;
  readonly state: GameState;
}

/**
 * Hashes a string to a short hex signature with FNV-1a, so a save can be matched against
 * the machine set it was played on without storing the whole set twice.
 * @param value The string to hash.
 * @returns The hex signature.
 */
function signatureOf(value: string): string {
  let hash = FNV_OFFSET_BASIS >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(HEX_RADIX);
}

/**
 * Returns the signature of a machine set, covering every field a save depends on so any
 * change to the day's puzzles, their examples, challenges, or panels changes it.
 * @param machines The day's machine set.
 * @returns The machine set signature.
 */
export function machinesSignature(machines: readonly Machine[]): string {
  return signatureOf(JSON.stringify(machines));
}

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
 * Loads the saved game for a day, or null when there is none or it cannot be trusted. The
 * save is trusted only when its stored signature matches the current machine set, so a
 * redeployed day discards the stale save instead of resuming it.
 * @param dateKey The puzzle date that scopes the saved game.
 * @param machines The day's machine set, both counted and signed for the trust checks.
 * @returns The saved game state, or null.
 */
export function loadGame(dateKey: string, machines: readonly Machine[]): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + dateKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Partial<SavedRecord>;
    if (record.sig !== machinesSignature(machines)) return null;
    return isSavedGame(record.state, machines.length) ? (record.state as GameState) : null;
  } catch {
    return null;
  }
}

/**
 * Saves the game for a day, stamped with the current machine set's signature, ignoring
 * storage failures such as private mode or quota.
 * @param dateKey The puzzle date that scopes the saved game.
 * @param state The game state to persist.
 * @param machines The day's machine set, signed into the save.
 */
export function saveGame(dateKey: string, state: GameState, machines: readonly Machine[]): void {
  try {
    const record: SavedRecord = { sig: machinesSignature(machines), state };
    localStorage.setItem(STORAGE_PREFIX + dateKey, JSON.stringify(record));
  } catch {
    return;
  }
}
