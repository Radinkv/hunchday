/**
 * Presentation constants for the view layer: the CSS class names defined in the
 * stylesheet, the player facing copy, the bot light colors, and layout numbers.
 * Components reference these so a class, a copy string, or a color is spelled in one
 * place and a change is a single edit. The domain vocabulary and the share copy live
 * with the game logic instead.
 */

import {
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  DIFFICULTY_MEDIUM,
  DIFFICULTY_MYSTERY,
  type Difficulty,
} from "../game/types";

export const CLASS_DOTS = "dots";
export const CLASS_DOT = "dot";
export const CLASS_DOT_CURRENT = "now";
export const CLASS_DOT_CRACKED = "crack";
export const CLASS_DOT_REVEALED = "open";

/** The full screen layout regions, stacked top to bottom in one flex column. */
export const CLASS_APP = "app";
export const CLASS_HEADER = "hdr";
export const CLASS_HEADER_LEFT = "hleft";
export const CLASS_DIFFICULTY = "diff";
export const CLASS_WORDMARK_BLOCK = "wblock";
export const CLASS_TAGLINE = "tagline";
export const CLASS_MACHINE_ZONE = "mzone";
export const CLASS_MACHINE_CAPTION = "mcap";
export const CLASS_INTRO = "intro";
export const CLASS_INTRO_LEAD = "introlead";
export const CLASS_BOTTOM = "bottom";
export const CLASS_FEED = "feed";

export const CLASS_MACHINE_NAME = "mname";
export const CLASS_MACHINE_SUBTITLE = "msub";
export const CLASS_BOT = "bot";
export const CLASS_CHOMP = "chomp";
export const CLASS_LIGHT = "light";

export const CLASS_EVIDENCE = "evidence";
export const CLASS_ROW = "row";
export const CLASS_CELL_LEFT = "cleft";
export const CLASS_CELL_RIGHT = "cright";
export const CLASS_ROW_HIT = "hit";
export const CLASS_ROW_MISS = "miss";
export const CLASS_CHIP = "chip";
export const CLASS_CHIP_INPUT = "in";
export const CLASS_CHIP_OUTPUT = "out";
export const CLASS_CHIP_GUESS = "guess";
export const CLASS_ARROW = "arrow";
export const CLASS_VERSUS = "vs";

export const CLASS_ROW_ACTIVE = "active";
export const CLASS_WAIT_DOT = "waitdot";
export const WAIT_DOT_SRC = "/wait-dot.svg";
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
export const COPY_WAITING = "The machine is waiting for your guess";

/** The header label shown for each difficulty; the mystery slot reads as "???". */
export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  [DIFFICULTY_EASY]: "Easy",
  [DIFFICULTY_MEDIUM]: "Medium",
  [DIFFICULTY_HARD]: "Hard",
  [DIFFICULTY_MYSTERY]: "???",
};

/**
 * Difficulty ordering for presentation thresholds, easy lowest. The panel renders as a
 * flat list of operations at or below the flat rank, and as the searchable tabbed palette
 * above it. This is the single knob for where the panel switches from list to palette.
 */
const DIFFICULTY_RANK: Readonly<Record<Difficulty, number>> = {
  [DIFFICULTY_EASY]: 0,
  [DIFFICULTY_MEDIUM]: 1,
  [DIFFICULTY_HARD]: 2,
  [DIFFICULTY_MYSTERY]: 3,
};
export const PANEL_FLAT_MAX_RANK = 1;

/**
 * Reports whether a difficulty shows the flat operation list rather than the tabbed,
 * searchable palette.
 * @param difficulty The machine difficulty.
 * @returns True for a flat list, false for the tabbed palette.
 */
export function panelIsFlat(difficulty: Difficulty): boolean {
  return DIFFICULTY_RANK[difficulty] <= PANEL_FLAT_MAX_RANK;
}
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

/** The glyph shown on a miss row between the player's output and the true output. */
export const VERSUS_GLYPH = "✗";

/** Feedback copy. The leading status word is colored; the remainder is plain. */
export const COPY_FEEDBACK_TWICE = "Correct, twice in a row.";
export const COPY_FEEDBACK_CORRECT = "Correct.";
export const COPY_FEEDBACK_MORE = " One more to confirm you have it.";
export const COPY_FEEDBACK_NOT_QUITE = "Not quite.";
export const COPY_FEEDBACK_GAVE = " It actually gave that. Added to your evidence!";

/** The label on the button that feeds the built prediction into the machine. */
export const COPY_FEED_BUTTON = "Feed it";

/** Class names for the recipe builder: the step list, the tabbed folder, and the tags. */
export const CLASS_BUILDER = "builder";
export const CLASS_RECIPE = "recipe";
export const CLASS_RECIPE_EMPTY = "recipeempty";
export const CLASS_STEP = "step";
export const CLASS_STEP_NUM = "stepnum";
export const CLASS_STEP_TEXT = "steptext";
export const CLASS_STEP_REMOVE = "stepx";
export const CLASS_NUM_TAG = "numtag";
export const CLASS_PICKER = "picker";
export const CLASS_SEARCH = "search";
export const CLASS_NO_MATCHES = "nomatch";
export const CLASS_FOLDER_ICON = "foldericon";
export const CLASS_TABS = "tabs";
export const CLASS_TAB = "tab";
export const CLASS_TAB_ACTIVE = "on";
export const CLASS_PAGE = "page";
export const CLASS_PICKER_OP = "pickop";
export const CLASS_RECIPE_HEAD = "recipehead";
export const CLASS_RECIPE_HEAD_LABEL = "recipehl";
export const CLASS_CLEAR = "clearbtn";

/** Copy for the recipe builder: the labels, the hints, and the step controls. */
export const COPY_RECIPE_LABEL = "Your recipe";
export const COPY_RECIPE_EMPTY = "Write a recipe you think the machine follows.";
export const COPY_PICKER_LABEL = "Add to your recipe";
export const COPY_SEARCH_LABEL = "Search your hunch in words";
export const COPY_SEARCH_PLACEHOLDER = "search your hunch";
export const COPY_NO_MATCHES = "Nothing matches that. Try a tab, or different words.";
export const COPY_CLEAR = "Clear";
export const COPY_NUMBER_TAG_PREFIX = "Change the number in step ";
export const COPY_REMOVE_FROM_PREFIX = "Remove step ";
export const COPY_STEP_REMOVE_GLYPH = "✕";

/** Duration in milliseconds that the bot holds its chomp animation after a feed. */
export const CHOMP_DURATION_MS = 180;

/** Page level copy. */
export const COPY_WORDMARK = "Hunchday";
export const COPY_TAGLINE = "Daily machine puzzles";
export const COPY_PLAY = "Play";
export const COPY_INTRO_LEAD = "Four machines today. Work out what each one does, then prove it twice.";
