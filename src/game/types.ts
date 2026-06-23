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
export const MARK_TEST = "test";
export type Mark = typeof MARK_EXAMPLE | typeof MARK_HIT | typeof MARK_MISS | typeof MARK_TEST;

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

/**
 * Difficulty slots. A day fills one machine per slot in rising order. The tokens mirror
 * the generator's own difficulty vocabulary as the same string literals, so a generated
 * machine's difficulty carries through the adapter unchanged while the view layer keeps
 * its independence from the engine. The mystery slot is shown to the player as "???".
 */
export const DIFFICULTY_SUPER_EASY = "super_easy";
export const DIFFICULTY_EASY = "easy";
export const DIFFICULTY_MEDIUM = "medium";
export const DIFFICULTY_HARD = "hard";
export const DIFFICULTY_MYSTERY = "mystery";
export type Difficulty =
  | typeof DIFFICULTY_SUPER_EASY
  | typeof DIFFICULTY_EASY
  | typeof DIFFICULTY_MEDIUM
  | typeof DIFFICULTY_HARD
  | typeof DIFFICULTY_MYSTERY;

/** A single input and output pairing, both expressed as space separated chip text. */
export type ChipPair = readonly [input: string, output: string];

/** The number of tests a player may run on a single machine before the bench locks. */
export const MAX_TESTS = 2;

/** One completed test: the chips fed in and the chips the machine produced for them. */
export interface TestResult {
  readonly input: string;
  readonly output: string;
}

/**
 * One operation of a machine's true pipeline, named by its operation identifier and the
 * numeric parameters bound to it. The shape mirrors the engine's pipeline step without
 * importing the engine, so the view can run a machine on the player's own test inputs using
 * the bundled operation functions while the engine stays out of the client bundle.
 */
export interface RuleStep {
  readonly opId: string;
  readonly params: Readonly<Record<string, number>>;
}

/**
 * One mystery machine: its difficulty, its rule, its seeded examples, its challenges,
 * the operation panel the player builds from, and its true pipeline steps. The panel is the
 * ordered set of operation identifiers offered for this machine, sized to its difficulty and
 * baked in at build time so every player sees the same operations in the same order. The
 * steps are the executable rule, used only by the Test mode to compute the output for an
 * input the player chooses; they are optional so fixtures without a pipeline still type check.
 */
export interface Machine {
  readonly difficulty: Difficulty;
  readonly rule: string;
  readonly ex: ReadonlyArray<ChipPair>;
  readonly ch: ReadonlyArray<ChipPair>;
  readonly panelOps: ReadonlyArray<string>;
  readonly steps?: ReadonlyArray<RuleStep>;
}

/**
 * A single line of evidence shown to the player, holding the input chips, the output
 * chips, and the mark that classifies the row. A miss row also carries the guess the
 * player's recipe produced, so the row can show what they got against the true output.
 */
export interface EvidenceRow {
  readonly input: string;
  readonly output: string;
  readonly mark: Mark;
  readonly guess?: string;
}

/**
 * The complete game state. Everything the interface shows is derivable from this
 * object, which is what allows the reducer to be exercised without a document object
 * model. A result entry is true when the machine was cracked, false when it was
 * revealed without a crack, and null while it has not yet been played. The won field
 * is populated once the phase becomes revealed and is null while playing. The ended flag
 * stays false until the player dismisses the final machine's reveal, so the last reveal is
 * seen before the results screen replaces it. A player's completed tests live in the evidence
 * as test marked rows, so they read as part of the running log and their budget survives a
 * reload, and they clear with the rest of the evidence when the machine changes.
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
  readonly ended: boolean;
}

/**
 * The two kinds of answer a player can submit, which the reducer judges differently. A
 * guess is the output chips composed in the thrower, judged against the current challenge
 * and requiring two correct in a row to crack. A recipe is the ordered operations, judged
 * against every example at once: a recipe that reproduces them all is provably the rule and
 * cracks the machine on a single submission. The submitting layer computes the recipe
 * verdict because the operations live with the view. Both kinds carry the chips they produced
 * for the current challenge so a wrong answer can show the player's chips beside the truth; a
 * recipe's chips are what running it on the challenge input would yield.
 */
export const SUBMISSION_GUESS = "guess";
export const SUBMISSION_RECIPE = "recipe";
export type Submission =
  | { readonly kind: typeof SUBMISSION_GUESS; readonly chips: string }
  | { readonly kind: typeof SUBMISSION_RECIPE; readonly matchesAllExamples: boolean; readonly chips?: string };
