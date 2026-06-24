/**
 * Presentation constants for the view layer: the CSS class names defined in the
 * stylesheet, the player facing copy, the bot light colors, and layout numbers.
 * Components reference these so a class, a copy string, or a color is spelled in one
 * place and a change is a single edit. The domain vocabulary and the share copy live
 * with the game logic instead.
 */

/** The day progress bar in the navbar: its track and the liquid fill inside it. */
export const CLASS_JUICE = "juice";
export const CLASS_JUICE_FILL = "juicefill";

/** The accessible label for the wordless day progress bar, and the percentage unit. */
export const COPY_PROGRESS_LABEL = "Day progress";
export const PERCENT_UNIT = "%";

/** The full screen layout regions, stacked top to bottom in one flex column. */
export const CLASS_SHELL = "shell";
export const CLASS_APP = "app";
export const CLASS_HEADER = "hdr";
export const CLASS_HEADER_LEFT = "hleft";
export const CLASS_HEADER_RIGHT = "hright";

/** The help affordance: the question mark button and the explainer popover it opens. */
export const CLASS_HELP = "help";
export const CLASS_HELP_BUTTON = "helpbtn";
export const CLASS_HELP_POP = "helppop";
export const CLASS_HELP_TEXT = "helptext";

/** Copy for the help popover: a single plain paragraph, the only place the rules are spelled out. */
export const COPY_HELP_TITLE = "How to play";
export const COPY_HELP_GLYPH = "?";
export const COPY_HELP_TEXT =
  "Each machine hides a rule, and you start with a single example of what it does. Use Test to run your own chips through and see what comes back, then switch to Guess to predict the output for the chips it shows you, where two right in a row cracks it. An output can dip a little below zero, so when you guess, tap a chip to make it negative. Recipe lets you describe the rule directly as a list of steps, checked against everything the machine does. Two wrong answers are fine, and the third reveals the rule.";
export const CLASS_WORDMARK_BLOCK = "wblock";
export const CLASS_TAGLINE = "tagline";
export const CLASS_MACHINE_ZONE = "mzone";
export const CLASS_MACHINE_CAPTION = "mcap";
export const CLASS_INTRO = "intro";
export const CLASS_INTRO_COPY = "introcopy";
export const CLASS_INTRO_TITLE = "introtitle";
export const CLASS_INTRO_LEAD = "introlead";
export const CLASS_PLAY = "play";
export const CLASS_STAGE = "stage";
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
export const CLASS_CHIP_PROBE = "probe";
export const CLASS_CHIP_GUESS = "guess";
export const CLASS_CHIP_WRONG = "wrong";
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

export const COPY_RULE_CRACKED_LABEL = "Cracked it: ";
export const COPY_RULE_REVEALED_LABEL = "It reveals itself: ";
export const COPY_NEXT_MACHINE = "Next machine";
export const COPY_SEE_RESULTS = "See results";
export const COPY_COPY_RESULT = "Copy result";
export const COPY_COPIED = "Copied";
export const COPY_PLAY_AGAIN = "Play again";
export const COPY_END_STATS_PREFIX = "Done. You cracked ";
export const COPY_END_STATS_MIDDLE = " of ";
export const COPY_END_STATS_SUFFIX = " machines, with ";
export const COPY_END_STATS_MISSES = " misses.";

/** The minimal end screen: a centered result with no prose, shown when the day is done. */
export const CLASS_END = "endscreen";
export const CLASS_END_DOTS = "enddots";
export const CLASS_END_DOT = "enddot";
export const CLASS_END_DOT_CRACKED = "crack";
export const CLASS_END_DOT_REVEALED = "open";
export const CLASS_END_HEADLINE = "endhead";
export const CLASS_END_SUB = "endsub";
export const COPY_END_CRACKED_PREFIX = "Cracked ";
export const COPY_END_OF = " of ";
export const COPY_END_MISSES = " misses";
export const COPY_SHARE = "Share";

/** The arrow glyph shown between an input and an output chip. */
export const ARROW_GLYPH = "→";

/** The glyph shown on a miss row between the player's output and the true output. */
export const VERSUS_GLYPH = "✗";

/** Labels for the miss row toggle that shows or hides the chips the player guessed. */
export const COPY_SHOW_GUESS = "Show the chips you guessed";
export const COPY_HIDE_GUESS = "Hide the chips you guessed";

/** Feedback copy. The leading status word is colored; the remainder is plain. */
export const COPY_FEEDBACK_TWICE = "Correct, twice in a row.";
export const COPY_FEEDBACK_CORRECT = "Correct.";
export const COPY_FEEDBACK_MORE = " One more to confirm you have it.";
export const COPY_FEEDBACK_NOT_QUITE = "Not quite.";
export const COPY_FEEDBACK_GAVE = " It actually gave that. Added to your evidence!";

/** The label on the button that feeds the built prediction into the machine. */
export const COPY_FEED_BUTTON = "Feed it";

/**
 * The two ways to answer a machine. Guess composes an output by throwing chips and is the
 * front door; Recipe authors the rule as an ordered list of operations. The tokens are the
 * single source of truth for the active mode and the union type is derived from them.
 */
export const MODE_TEST = "test";
export const MODE_GUESS = "guess";
export const MODE_RECIPE = "recipe";
export type Mode = typeof MODE_TEST | typeof MODE_GUESS | typeof MODE_RECIPE;

/** Class names for the workspace and the borderless mode toggle. */
export const CLASS_WORKSPACE = "workspace";
export const CLASS_MODE_BODY = "modebody";
export const CLASS_GUESS = "guesspane";
export const CLASS_GUESS_HINT = "guesshint";

/**
 * The most negative a guessed chip may be, mirroring the engine's output floor. A number chip can
 * be flipped to a negative only while its magnitude keeps it at or above this, so guesses can match
 * the small negatives a subtracting machine produces without dropping past the floor.
 */
export const CHIP_FLOOR = -5;

/** The hint shown under the Guess pad, since outputs can dip a little below zero. */
export const COPY_GUESS_HINT = "Tap a chip to make it negative.";
export const CLASS_MODE_TOGGLE = "modes";
export const CLASS_MODE_OPTION = "mode";
export const CLASS_MODE_ACTIVE = "modeon";
export const CLASS_MODE_DIVIDER = "modesep";

/** Copy for the mode toggle: the three words and the divider that sits between them. */
export const COPY_MODE_TEST = "Test";
export const COPY_MODE_GUESS = "Guess";
export const COPY_MODE_RECIPE = "Recipe";
export const COPY_MODE_DIVIDER = "|";

/**
 * Class names for the shared chip composer: the chip preview, its empty hint, a placed chip,
 * the word entry field, and the number pad with its keys. The composer is the one input both
 * Guess and Test build their chips with, a tap pad for numbers and a field for words.
 */
export const CLASS_COMPOSER = "composer";
export const CLASS_COMPOSER_PREVIEW = "comprev";
export const CLASS_COMPOSER_CHIP = "compchip";
export const CLASS_COMPOSER_FIELD = "compfield";
export const CLASS_PAD = "pad";
export const CLASS_PAD_KEY = "padkey";

/** Copy for the chip composer: the keys, the chip removal label, and the word field affordance. */
export const COPY_PAD_DIGIT_PREFIX = "Type ";
export const COPY_PAD_NEXT_GLYPH = ",";
export const COPY_PAD_NEXT_LABEL = "New chip";
export const COPY_PAD_BACK_GLYPH = "⌫";
export const COPY_PAD_BACK_LABEL = "Delete chip";
export const COPY_COMPOSER_REMOVE_PREFIX = "Remove chip ";
export const COPY_COMPOSER_FLIP_PREFIX = "Flip the sign of chip ";
export const COPY_COMPOSER_LABEL = "Chips";
export const COPY_COMPOSER_HINT = "type chips";

/** Class name for the test bench. */
export const CLASS_TEST = "tester";

/**
 * The pips counter, shared by the test budget and the miss counter. The base pip is a faint dot;
 * an on pip is filled, in the machine accent for the test variant and amber for the miss variant.
 */
export const CLASS_PIPS = "pips";
export const CLASS_PIP = "pip";
export const CLASS_PIP_ON = "pipon";
export const CLASS_TEST_PIPS = "testpips";
export const CLASS_MISS_PIPS = "misspips";
export const TEST_PIP_LABEL = "Tests left";
export const MISS_PIP_LABEL = "Wrong answers";

/** The label on the button that runs a test. Invalid sets cannot be built, so there is no message. */
export const COPY_TEST_RUN = "Test it";

/** Class names for the chip thrower: the toolbar, the row, the chips, and the popups. */
export const CLASS_THROWER = "thrower";
export const CLASS_THROWER_ROW = "throwrow";
export const CLASS_TOOL = "tool";
export const CLASS_CHIP_SELECTED = "sel";
export const CLASS_CHIP_DRAGGING = "dragging";
export const CLASS_CHIP_DROP_REMOVE = "dropx";
export const CLASS_GHOST = "ghost";
export const CLASS_GHOST_TEACH = "teach";
export const CLASS_CONTROL = "ctrl";
export const CLASS_CONTROL_CARET = "caret";
export const CLASS_CONTROL_BTN = "ctrlbtn";
export const CLASS_CONTROL_REMOVE = "ctrlx";
export const CLASS_TYPE_POP = "typepop";
export const CLASS_TYPE_INPUT = "typein";

/** The fixed width of the floating control in pixels, shared with its stylesheet rule. */
export const CONTROL_WIDTH_PX = 232;

/** Copy for the chip thrower: the tool labels, the control glyphs, and their aria labels. */
export const COPY_ADD_CHIP = "Add a chip";
export const COPY_GHOST_GLYPH = "+";
export const COPY_TYPE_ROW = "Type the chips";
export const COPY_USE_PROBLEM = "Use the problem's chips";
export const COPY_RESET = "Clear the chips";
export const COPY_INCREASE = "Add one";
export const COPY_DECREASE = "Subtract one";
export const COPY_REMOVE_CHIP = "Remove this chip";
export const COPY_EDIT_CHIP = "Type this chip";
export const COPY_INCREASE_GLYPH = "+";
export const COPY_DECREASE_GLYPH = "−";
export const COPY_REMOVE_GLYPH = "×";
export const COPY_CHIP_LABEL_PREFIX = "Chip ";
export const COPY_TYPE_PLACEHOLDER = "e.g. 6 8 10";
export const COPY_TYPE_DONE = "Set";

/** Class names for the recipe builder: the step list, the tabbed folder, and the tags. */
export const CLASS_BUILDER = "builder";
export const CLASS_RECIPE = "recipe";
export const CLASS_STEP = "step";
export const CLASS_STEP_NUM = "stepnum";
export const CLASS_STEP_TEXT = "steptext";
export const CLASS_STEP_REMOVE = "stepx";
export const CLASS_NUM_TAG = "numtag";
export const CLASS_PICKER = "picker";
export const CLASS_SEARCH = "search";
export const CLASS_NO_MATCHES = "nomatch";
export const CLASS_PAGE = "page";
export const CLASS_PICKER_OP = "pickop";
export const CLASS_RECIPE_HEAD = "recipehead";
export const CLASS_RECIPE_HEAD_LABEL = "recipehl";
export const CLASS_CLEAR = "clearbtn";

/** Copy for the recipe builder: the labels, the hints, and the step controls. */
export const COPY_RECIPE_LABEL = "Your recipe";
export const COPY_PICKER_LABEL = "Add to your recipe";
export const COPY_SEARCH_LABEL = "Add a step to your recipe";
export const COPY_SEARCH_PLACEHOLDER = "Add a step (keep, double, biggest, etc.):";
export const COPY_NO_MATCHES = "Nothing matches that. Try different words.";
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
export const COPY_INTRO_TITLE = "Four machines today";
export const COPY_INTRO_LEAD = "Figure out what each one does, then crack it.";
