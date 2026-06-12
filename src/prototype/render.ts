/**
 * The rendering layer for the prototype.
 *
 * Every function here is a pure function of the game state and a set of callbacks.
 * The layer reads state and writes the page but holds no game state of its own. The
 * markup it emits reproduces exactly what the prototype's inline script produced, so
 * the converted page is visually identical. All literal identifiers, classes,
 * colors, and copy come from the shared presentation registry.
 */

import {
  FEEDBACK_CORRECT_MORE,
  FEEDBACK_CORRECT_TWICE,
  FEEDBACK_WRONG,
  PHASE_PLAYING,
  type FeedbackKind,
  type GameState,
  type Machine,
} from "./types";
import { crackedCount, isLastMachine, shareText, tokenize } from "./reducer";
import {
  ARROW_HTML_ENTITY,
  CHOMP_DURATION_MS,
  CLASS_ARROW,
  CLASS_CHIP,
  CLASS_CHIP_INPUT,
  CLASS_CHIP_OUTPUT,
  CLASS_CHOMP,
  CLASS_DOT,
  CLASS_DOT_CRACKED,
  CLASS_DOT_CURRENT,
  CLASS_DOT_REVEALED,
  CLASS_END_STATS,
  CLASS_QUIET_BUTTON,
  CLASS_ROW,
  CLASS_RULE,
  CLASS_RULE_CRACKED,
  CLASS_RULE_REVEALED,
  CLASS_SHARE,
  COPY_COPIED,
  COPY_COPY_RESULT,
  COPY_END_STATS_MIDDLE,
  COPY_END_STATS_MISSES,
  COPY_END_STATS_PREFIX,
  COPY_END_STATS_SUFFIX,
  COPY_MACHINE_NAME_PREFIX,
  COPY_NEXT_MACHINE,
  COPY_PLAY_AGAIN,
  COPY_QUESTION_PREFIX,
  COPY_QUESTION_SUFFIX,
  COPY_RULE_CRACKED_LABEL,
  COPY_RULE_REVEALED_LABEL,
  COPY_SUBTITLE_CRACKED,
  COPY_SUBTITLE_PLAYING,
  COPY_SUBTITLE_REVEALED,
  DISPLAY_BLOCK,
  DISPLAY_FLEX,
  DISPLAY_NONE,
  ELEMENT_ID_DOTS,
  ELEMENT_ID_EVIDENCE,
  ELEMENT_ID_FEED_ROW,
  ELEMENT_ID_FEEDBACK,
  ELEMENT_ID_GUESS_INPUT,
  ELEMENT_ID_LIGHT,
  ELEMENT_ID_MACHINE_NAME,
  ELEMENT_ID_MACHINE_SUBTITLE,
  ELEMENT_ID_QUESTION,
  ELEMENT_ID_RULE_BOX,
  ELEMENT_ID_BOT,
  FEEDBACK_HTML_CORRECT_MORE,
  FEEDBACK_HTML_CORRECT_TWICE,
  FEEDBACK_HTML_WRONG,
  LIGHT_COLOR_CRACKED,
  LIGHT_COLOR_IDLE,
  LIGHT_COLOR_REVEALED,
  MACHINE_NUMBER_PAD_CHAR,
  MACHINE_NUMBER_PAD_LENGTH,
  STYLE_NEXT_BUTTON_MARGIN_TOP,
  STYLE_PLAY_AGAIN_MARGIN_LEFT,
  TAG_BUTTON,
  TAG_DIV,
  TAG_PARAGRAPH,
} from "./constants";

/** Name of the fill attribute used to color the bot status light. */
const ATTRIBUTE_FILL = "fill";

/** Prefix for the error thrown when an expected element is absent from the page. */
const ERROR_MISSING_ELEMENT_PREFIX = "missing element #";

/**
 * The callbacks the controller supplies so that interface events drive the reducer.
 * The rendering layer invokes these but never decides game logic itself.
 */
export interface Handlers {
  onFeed: () => void;
  onNext: () => void;
  onRestart: () => void;
}

/**
 * Resolves a required element by identifier, throwing when it is absent so that a
 * missing structural element fails loudly rather than producing silent null access.
 * @param id The element identifier to resolve.
 * @returns The element with the given identifier.
 */
function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(ERROR_MISSING_ELEMENT_PREFIX + id);
  return element;
}

/**
 * Renders a chip string as a run of chip spans of the given role.
 * @param value The chip string to render.
 * @param role The chip role class, either the input role or the output role.
 * @returns The concatenated span markup for the chips.
 */
function chips(value: string, role: typeof CLASS_CHIP_INPUT | typeof CLASS_CHIP_OUTPUT): string {
  return tokenize(value)
    .map((token) => '<span class="' + CLASS_CHIP + " " + role + '">' + token + "</span>")
    .join("");
}

/**
 * Maps a feedback kind to its fully formed markup. A null kind renders nothing.
 * @param feedback The feedback kind to render.
 * @returns The feedback markup, or an empty string when there is no feedback.
 */
function feedbackHtml(feedback: FeedbackKind): string {
  switch (feedback) {
    case FEEDBACK_CORRECT_TWICE:
      return FEEDBACK_HTML_CORRECT_TWICE;
    case FEEDBACK_CORRECT_MORE:
      return FEEDBACK_HTML_CORRECT_MORE;
    case FEEDBACK_WRONG:
      return FEEDBACK_HTML_WRONG;
    case null:
      return "";
  }
}

/**
 * Renders the progress dots, marking each machine as cracked, revealed, the current
 * machine, or not yet reached.
 * @param state The current game state.
 */
function renderDots(state: GameState): void {
  requireElement(ELEMENT_ID_DOTS).innerHTML = state.results
    .map((result, index) => {
      let className = CLASS_DOT;
      if (result === true) className += " " + CLASS_DOT_CRACKED;
      else if (result === false) className += " " + CLASS_DOT_REVEALED;
      else if (index === state.machineIndex) className += " " + CLASS_DOT_CURRENT;
      return '<span class="' + className + '"></span>';
    })
    .join("");
}

/**
 * Renders the evidence list, one row per recorded input and output pairing, carrying
 * any hit or miss styling.
 * @param state The current game state.
 */
function renderEvidence(state: GameState): void {
  requireElement(ELEMENT_ID_EVIDENCE).innerHTML = state.evidence
    .map((row) => {
      const className = CLASS_ROW + (row.mark ? " " + row.mark : "");
      return (
        '<div class="' +
        className +
        '">' +
        chips(row.input, CLASS_CHIP_INPUT) +
        '<span class="' +
        CLASS_ARROW +
        '">' +
        ARROW_HTML_ENTITY +
        "</span>" +
        chips(row.output, CLASS_CHIP_OUTPUT) +
        "</div>"
      );
    })
    .join("");
}

/**
 * Effect: Triggers the bot chomp animation and clears it after the configured
 * duration. This is a purely visual effect with no game state meaning.
 */
export function chompBot(): void {
  const bot = requireElement(ELEMENT_ID_BOT);
  bot.classList.add(CLASS_CHOMP);
  setTimeout(() => bot.classList.remove(CLASS_CHOMP), CHOMP_DURATION_MS);
}

/**
 * Effect: Renders the entire interface from the given state. While playing it shows
 * the dots, evidence, current question, and input row. Once revealed it shows the
 * outcome banner with the machine rule and either a next machine control or the end
 * screen. Primary operations: writes the dots, evidence, machine name, and feedback,
 * then branches on the phase to render either the playing controls or the reveal.
 * @param state The current game state.
 * @param machines The full machine set.
 * @param handlers The controller callbacks for interface events.
 */
export function render(state: GameState, machines: readonly Machine[], handlers: Handlers): void {
  renderDots(state);
  renderEvidence(state);

  requireElement(ELEMENT_ID_MACHINE_NAME).textContent =
    COPY_MACHINE_NAME_PREFIX +
    String(state.machineIndex + 1).padStart(MACHINE_NUMBER_PAD_LENGTH, MACHINE_NUMBER_PAD_CHAR);
  requireElement(ELEMENT_ID_FEEDBACK).innerHTML = feedbackHtml(state.feedback);

  const feedRow = requireElement(ELEMENT_ID_FEED_ROW);
  const question = requireElement(ELEMENT_ID_QUESTION);
  const ruleBox = requireElement(ELEMENT_ID_RULE_BOX);
  const light = requireElement(ELEMENT_ID_LIGHT);

  if (state.phase === PHASE_PLAYING) {
    requireElement(ELEMENT_ID_MACHINE_SUBTITLE).textContent = COPY_SUBTITLE_PLAYING;
    light.setAttribute(ATTRIBUTE_FILL, LIGHT_COLOR_IDLE);
    const challenge = machines[state.machineIndex].ch[state.challengeIndex];
    question.innerHTML = COPY_QUESTION_PREFIX + chips(challenge[0], CLASS_CHIP_INPUT) + COPY_QUESTION_SUFFIX;
    question.style.display = DISPLAY_BLOCK;
    feedRow.style.display = DISPLAY_FLEX;
    ruleBox.innerHTML = "";
    (requireElement(ELEMENT_ID_GUESS_INPUT) as HTMLInputElement).focus();
    return;
  }

  const won = state.won === true;
  requireElement(ELEMENT_ID_MACHINE_SUBTITLE).textContent = won
    ? COPY_SUBTITLE_CRACKED
    : COPY_SUBTITLE_REVEALED;
  light.setAttribute(ATTRIBUTE_FILL, won ? LIGHT_COLOR_CRACKED : LIGHT_COLOR_REVEALED);
  feedRow.style.display = DISPLAY_NONE;
  question.style.display = DISPLAY_NONE;

  ruleBox.innerHTML =
    '<div class="' +
    CLASS_RULE +
    " " +
    (won ? CLASS_RULE_CRACKED : CLASS_RULE_REVEALED) +
    '"><b>' +
    (won ? COPY_RULE_CRACKED_LABEL : COPY_RULE_REVEALED_LABEL) +
    "</b>" +
    machines[state.machineIndex].rule +
    "</div>";

  if (!isLastMachine(state, machines)) {
    const button = document.createElement(TAG_BUTTON);
    button.style.marginTop = STYLE_NEXT_BUTTON_MARGIN_TOP;
    button.textContent = COPY_NEXT_MACHINE;
    button.onclick = handlers.onNext;
    ruleBox.appendChild(button);
    return;
  }

  renderEndScreen(state, machines, handlers);
}

/**
 * Effect: Renders the end of game summary into the rule box: a statistics line, the
 * shareable result text, a copy control, and a restart control. Primary operations:
 * computes the cracked count and share text and appends the summary elements.
 * System interactions: the copy control writes the share text to the clipboard when
 * a clipboard is available.
 * @param state The final game state.
 * @param machines The full machine set.
 * @param handlers The controller callbacks for interface events.
 */
function renderEndScreen(state: GameState, machines: readonly Machine[], handlers: Handlers): void {
  const ruleBox = requireElement(ELEMENT_ID_RULE_BOX);
  const cracked = crackedCount(state);
  const share = shareText(state, machines);

  const stats = document.createElement(TAG_PARAGRAPH);
  stats.className = CLASS_END_STATS;
  stats.textContent =
    COPY_END_STATS_PREFIX +
    cracked +
    COPY_END_STATS_MIDDLE +
    machines.length +
    COPY_END_STATS_SUFFIX +
    state.misses +
    COPY_END_STATS_MISSES;
  ruleBox.appendChild(stats);

  const shareBox = document.createElement(TAG_DIV);
  shareBox.className = CLASS_SHARE;
  shareBox.textContent = share;
  ruleBox.appendChild(shareBox);

  const copy = document.createElement(TAG_BUTTON);
  copy.className = CLASS_QUIET_BUTTON;
  copy.textContent = COPY_COPY_RESULT;
  copy.onclick = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(share);
    copy.textContent = COPY_COPIED;
  };
  ruleBox.appendChild(copy);

  const again = document.createElement(TAG_BUTTON);
  again.style.marginLeft = STYLE_PLAY_AGAIN_MARGIN_LEFT;
  again.textContent = COPY_PLAY_AGAIN;
  again.onclick = handlers.onRestart;
  ruleBox.appendChild(again);
}
