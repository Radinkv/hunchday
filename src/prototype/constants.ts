/**
 * Shared presentation constants for the prototype.
 *
 * This module is the registry for every literal that crosses the rendering and
 * controller layers or that represents a piece of player facing copy: DOM element
 * identifiers, CSS class names, colors, display values, copy fragments, feedback
 * markup, evidence marks, and layout numbers. Centralizing these keeps raw literals
 * out of the logic, guarantees a value is spelled in exactly one place, and makes a
 * copy or styling change a single edit.
 *
 * The values here mirror the structure and class names defined in index.html. They
 * are content and styling tokens, so the strings may contain punctuation that the
 * comment prose convention forbids.
 *
 * The domain state vocabulary lives in the types module rather than here. This
 * registry covers only presentation: structure, styling, copy, and layout.
 */

export const ELEMENT_ID_DOTS = "dots";
export const ELEMENT_ID_BOT = "bot";
export const ELEMENT_ID_LIGHT = "light";
export const ELEMENT_ID_MACHINE_NAME = "mname";
export const ELEMENT_ID_MACHINE_SUBTITLE = "msub";
export const ELEMENT_ID_EVIDENCE = "evidence";
export const ELEMENT_ID_QUESTION = "question";
export const ELEMENT_ID_FEED_ROW = "feedrow";
export const ELEMENT_ID_GUESS_INPUT = "guess";
export const ELEMENT_ID_FEED_BUTTON = "feed";
export const ELEMENT_ID_FEEDBACK = "feedback";
export const ELEMENT_ID_RULE_BOX = "rulebox";

export const CLASS_ROW = "row";
export const CLASS_CHIP = "chip";
export const CLASS_CHIP_INPUT = "in";
export const CLASS_CHIP_OUTPUT = "out";
export const CLASS_ARROW = "arrow";
export const CLASS_DOT = "dot";
export const CLASS_DOT_CURRENT = "now";
export const CLASS_DOT_CRACKED = "crack";
export const CLASS_DOT_REVEALED = "open";
export const CLASS_RULE = "rule";
export const CLASS_RULE_CRACKED = "crack";
export const CLASS_RULE_REVEALED = "open";
export const CLASS_CHOMP = "chomp";
export const CLASS_END_STATS = "endstats";
export const CLASS_SHARE = "share";
export const CLASS_QUIET_BUTTON = "quiet";

/**
 * HTML tag names for the elements the rendering layer constructs at runtime. Naming
 * them keeps tag identity in one place, so adding behavior or styling tied to a tag
 * later is a single edit rather than a search through the rendering logic.
 */
export const TAG_BUTTON = "button";
export const TAG_PARAGRAPH = "p";
export const TAG_DIV = "div";

export const LIGHT_COLOR_IDLE = "#C9C7EE";
export const LIGHT_COLOR_CRACKED = "#5DCAA5";
export const LIGHT_COLOR_REVEALED = "#FAC775";

export const DISPLAY_FLEX = "flex";
export const DISPLAY_NONE = "none";
export const DISPLAY_BLOCK = "block";

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

/** HTML entity for the rightward arrow shown between an input and an output chip. */
export const ARROW_HTML_ENTITY = "&#8594;";

/**
 * Fully formed feedback markup for each feedback kind. The classes referenced here
 * are styled in index.html and color the leading status word.
 */
export const FEEDBACK_HTML_CORRECT_TWICE = '<span class="ok">Correct, twice in a row.</span>';
export const FEEDBACK_HTML_CORRECT_MORE =
  '<span class="ok">Correct.</span> One more to confirm you have it.';
export const FEEDBACK_HTML_WRONG =
  '<span class="nope">Not quite.</span> It actually gave that — added to your evidence.';

/** Duration in milliseconds that the bot holds its chomp animation after a feed. */
export const CHOMP_DURATION_MS = 180;

/** Inline spacing applied to the reveal controls, matching the original prototype. */
export const STYLE_NEXT_BUTTON_MARGIN_TOP = "10px";
export const STYLE_PLAY_AGAIN_MARGIN_LEFT = "8px";

export const EMOJI_CRACKED = "\u{1F7E2}";
export const EMOJI_REVEALED = "\u{1F7E0}";

export const SHARE_HEADER = "Mystery machine · prototype";
export const SHARE_CRACKED_LABEL = "cracked ";
export const SHARE_COUNT_SEPARATOR = "/";
export const SHARE_STAT_SEPARATOR = " · ";
export const SHARE_MISS_SUFFIX = " misses";
export const SHARE_LINE_BREAK = "\n";
