/**
 * Domain vocabulary and structural types for the prototype game loop.
 *
 * This module holds the token constants that name the discrete states the game can
 * be in, the union types derived from those tokens, and the structural shapes that
 * carry game content and game state. The state vocabulary lives here as named tokens
 * rather than as inline string literals so that every place that tests or assigns a
 * phase, a feedback kind, or an evidence mark refers to one source of truth. A later
 * phase could promote any of these token groups to an enumeration without touching
 * the call sites.
 *
 * A Machine is the per machine content shape that the prototype originally expressed
 * as an inline object: a plain English rule together with example pairs and
 * challenge pairs, where each pair holds a space separated input chip string and the
 * corresponding output chip string. A later phase will produce these from a generated
 * day specification rather than from a hardcoded list, so the reducer never needs to
 * know where a machine came from.
 */

/**
 * Evidence marks. An example row carries the empty mark, a correct attempt carries
 * the hit mark, and a wrong attempt carries the miss mark. The values double as the
 * CSS modifier classes applied to an evidence row, so they match the class names
 * styled in index.html.
 */
export const MARK_EXAMPLE = "";
export const MARK_HIT = "hit";
export const MARK_MISS = "miss";
export type Mark = typeof MARK_EXAMPLE | typeof MARK_HIT | typeof MARK_MISS;

/**
 * Phases. A machine is either still being played or has been revealed. These tokens
 * are the discriminant for branching between the playing interface and the reveal.
 */
export const PHASE_PLAYING = "playing";
export const PHASE_REVEALED = "revealed";
export type Phase = typeof PHASE_PLAYING | typeof PHASE_REVEALED;

/**
 * Feedback kinds. The reducer stays free of markup and emits one of these tokens,
 * and the rendering layer maps the token to the player facing text. A null value
 * means no feedback is currently shown.
 */
export const FEEDBACK_CORRECT_TWICE = "correct_twice";
export const FEEDBACK_CORRECT_MORE = "correct_more";
export const FEEDBACK_WRONG = "wrong";
export type FeedbackKind =
  | null
  | typeof FEEDBACK_CORRECT_TWICE
  | typeof FEEDBACK_CORRECT_MORE
  | typeof FEEDBACK_WRONG;

/** A single input and output pairing, both expressed as space separated chip text. */
export type ChipPair = readonly [input: string, output: string];

/** One mystery machine: its rule, its seeded examples, and its challenge prompts. */
export interface Machine {
  readonly rule: string;
  readonly ex: ReadonlyArray<ChipPair>;
  readonly ch: ReadonlyArray<ChipPair>;
}

/**
 * A single line of evidence shown to the player, holding the input chips, the output
 * chips, and the mark that classifies the row.
 */
export interface EvidenceRow {
  readonly input: string;
  readonly output: string;
  readonly mark: Mark;
}

/**
 * The complete game state. Everything the interface shows is derivable from this
 * object, which is what allows the reducer to be exercised without a document object
 * model. A result entry is true when the machine was cracked, false when it was
 * revealed without a crack, and null while it has not yet been played. The won field
 * is populated once the phase becomes revealed and is null while playing.
 */
export interface GameState {
  readonly machineIndex: number;
  readonly challengeIndex: number;
  readonly streak: number;
  readonly misses: number;
  readonly results: ReadonlyArray<boolean | null>;
  readonly evidence: ReadonlyArray<EvidenceRow>;
  readonly feedback: FeedbackKind;
  readonly phase: Phase;
  readonly won: boolean | null;
}
