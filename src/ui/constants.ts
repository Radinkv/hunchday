/**
 * Presentation constants for the view layer: the CSS class names defined in the
 * stylesheet, the player facing copy, the bot light colors, and layout numbers.
 * Components reference these so a class, a copy string, or a color is spelled in one
 * place and a change is a single edit. The domain vocabulary and the share copy live
 * with the game logic instead.
 */

export const CLASS_DOTS = "dots";
export const CLASS_DOT = "dot";
export const CLASS_DOT_CURRENT = "now";
export const CLASS_DOT_CRACKED = "crack";
export const CLASS_DOT_REVEALED = "open";

export const CLASS_CARD = "card";
export const CLASS_MACHINE_HEAD = "mhead";
export const CLASS_MACHINE_NAME = "mname";
export const CLASS_MACHINE_SUBTITLE = "msub";
export const CLASS_BOT = "bot";
export const CLASS_CHOMP = "chomp";
export const CLASS_LIGHT = "light";

export const CLASS_EVIDENCE = "evidence";
export const CLASS_ROW = "row";
export const CLASS_ROW_HIT = "hit";
export const CLASS_ROW_MISS = "miss";
export const CLASS_CHIP = "chip";
export const CLASS_CHIP_INPUT = "in";
export const CLASS_CHIP_OUTPUT = "out";
export const CLASS_ARROW = "arrow";

export const CLASS_QUESTION = "question";
export const CLASS_FEED_ROW = "feedrow";
export const CLASS_FEEDBACK = "feedback";
export const CLASS_FEEDBACK_OK = "ok";
export const CLASS_FEEDBACK_NOPE = "nope";
export const CLASS_RULE_BOX = "rulebox";
export const CLASS_RULE = "rule";
export const CLASS_RULE_CRACKED = "crack";
export const CLASS_RULE_REVEALED = "open";
export const CLASS_END_STATS = "endstats";
export const CLASS_SHARE = "share";
export const CLASS_QUIET_BUTTON = "quiet";

/** The bot status light color for each state. */
export const LIGHT_COLOR_IDLE = "#C9C7EE";
export const LIGHT_COLOR_CRACKED = "#5DCAA5";
export const LIGHT_COLOR_REVEALED = "#FAC775";

export const COPY_MACHINE_NAME_PREFIX = "Machine ";
export const MACHINE_NUMBER_PAD_LENGTH = 2;
export const MACHINE_NUMBER_PAD_CHAR = "0";
export const COPY_SUBTITLE_PLAYING = "What does it do?";
export const COPY_SUBTITLE_CRACKED = "Cracked";
export const COPY_SUBTITLE_REVEALED = "Revealed";
export const COPY_QUESTION_PREFIX = "What comes out for ";
export const COPY_QUESTION_SUFFIX = " ?";
export const COPY_RULE_CRACKED_LABEL = "Cracked it: ";
export const COPY_RULE_REVEALED_LABEL = "It reveals itself: ";
export const COPY_NEXT_MACHINE = "Next machine";
export const COPY_COPY_RESULT = "Copy result";
export const COPY_COPIED = "Copied";
export const COPY_PLAY_AGAIN = "Play again";
export const COPY_END_STATS_PREFIX = "Done. You cracked ";
export const COPY_END_STATS_MIDDLE = " of ";
export const COPY_END_STATS_SUFFIX = " machines, with ";
export const COPY_END_STATS_MISSES = " misses.";

/** The arrow glyph shown between an input and an output chip. */
export const ARROW_GLYPH = "→";

/** Feedback copy. The leading status word is colored; the remainder is plain. */
export const COPY_FEEDBACK_TWICE = "Correct, twice in a row.";
export const COPY_FEEDBACK_CORRECT = "Correct.";
export const COPY_FEEDBACK_MORE = " One more to confirm you have it.";
export const COPY_FEEDBACK_NOT_QUITE = "Not quite.";
export const COPY_FEEDBACK_GAVE = " It actually gave that — added to your evidence.";

/** The label on the button that feeds the built prediction into the machine. */
export const COPY_FEED_BUTTON = "Feed it";

/** Class names and copy for the chip builder: the tray, the trail, and the palette. */
export const CLASS_BUILDER = "builder";
export const CLASS_TRAY = "tray";
export const CLASS_TRAIL = "trail";
export const CLASS_TRAIL_STEP = "tstep";
export const CLASS_TRAIL_EMPTY = "tempty";
export const CLASS_PARAM = "param";
export const CLASS_STEP_REMOVE = "tx";
export const CLASS_PALETTE = "palette";
export const CLASS_PALETTE_GROUP = "pgroup";
export const CLASS_PALETTE_LABEL = "plabel";
export const CLASS_TILE = "tile";
export const CLASS_BUILDER_ACTIONS = "bactions";

export const COPY_TRAIL_EMPTY = "Tap operations below to transform the chips.";
export const COPY_RESET = "Reset";
export const COPY_TRAY_LABEL = "Your prediction so far";
export const COPY_TRAIL_LABEL = "Operations you have applied";
export const COPY_REMOVE_STEP_PREFIX = "Remove ";
export const COPY_CYCLE_PARAM_PREFIX = "Change the value of ";

/** Duration in milliseconds that the bot holds its chomp animation after a feed. */
export const CHOMP_DURATION_MS = 180;

/** Page level copy. */
export const COPY_WORDMARK = "Hunchday";
export const COPY_TAGLINE = "Figure out what each machine does. Prove it twice.";
export const COPY_FOOTER = "hunchday · today's set of four machines";
