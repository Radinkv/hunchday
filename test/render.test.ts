// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MACHINES } from "../src/prototype/machines";
import { feed, startGame, tokenize } from "../src/prototype/reducer";
import { render } from "../src/prototype/render";
import { MARK_MISS } from "../src/prototype/types";
import {
  CLASS_CHIP,
  CLASS_CHIP_INPUT,
  CLASS_CHIP_OUTPUT,
  CLASS_ROW,
  CLASS_RULE,
  CLASS_RULE_CRACKED,
  COPY_MACHINE_NAME_PREFIX,
  COPY_NEXT_MACHINE,
  COPY_QUESTION_PREFIX,
  COPY_RULE_CRACKED_LABEL,
  COPY_SUBTITLE_CRACKED,
  DISPLAY_FLEX,
  DISPLAY_NONE,
  ELEMENT_ID_EVIDENCE,
  ELEMENT_ID_FEED_ROW,
  ELEMENT_ID_FEEDBACK,
  ELEMENT_ID_MACHINE_NAME,
  ELEMENT_ID_MACHINE_SUBTITLE,
  ELEMENT_ID_QUESTION,
  ELEMENT_ID_RULE_BOX,
  FEEDBACK_HTML_CORRECT_TWICE,
  FEEDBACK_HTML_WRONG,
  MACHINE_NUMBER_PAD_CHAR,
  MACHINE_NUMBER_PAD_LENGTH,
  TAG_BUTTON,
} from "../src/prototype/constants";
import { byClass, byId, DOM_SKELETON, noopHandlers, within } from "./dom-helpers";

/**
 * Guards the document object model mapping: that render turns a game state into the
 * same markup the prototype's original inline script produced. These tests run under
 * jsdom so they exercise the real document path rather than a mock. Element
 * identifiers, classes, and copy come from the same registry the rendering layer
 * uses, so the test scaffolding and the assertions track the implementation.
 */

const FIRST_MACHINE = MACHINES[0];

/** A guess that is wrong for the first challenge of the first machine. */
const WRONG_GUESS = "nope";

const NOOP_HANDLERS = noopHandlers();

beforeEach(() => {
  document.body.innerHTML = DOM_SKELETON;
});

describe("render while playing", () => {
  it("seeds the two example rows and asks the first challenge", () => {
    render(startGame(MACHINES), MACHINES, NOOP_HANDLERS);

    const rows = document.querySelectorAll(within(ELEMENT_ID_EVIDENCE, byClass(CLASS_ROW)));
    expect(rows).toHaveLength(FIRST_MACHINE.ex.length);

    const firstInputChip = within(ELEMENT_ID_EVIDENCE, byClass(CLASS_CHIP, CLASS_CHIP_INPUT));
    expect(document.querySelector(firstInputChip)?.textContent).toBe(
      tokenize(FIRST_MACHINE.ex[0][0])[0],
    );

    const expectedName =
      COPY_MACHINE_NAME_PREFIX + String(1).padStart(MACHINE_NUMBER_PAD_LENGTH, MACHINE_NUMBER_PAD_CHAR);
    expect(document.querySelector(byId(ELEMENT_ID_MACHINE_NAME))?.textContent).toBe(expectedName);
    expect(document.querySelector(byId(ELEMENT_ID_QUESTION))?.innerHTML).toContain(COPY_QUESTION_PREFIX);
    expect((document.querySelector(byId(ELEMENT_ID_FEED_ROW)) as HTMLElement).style.display).toBe(
      DISPLAY_FLEX,
    );
  });
});

describe("render once revealed", () => {
  it("shows the crack banner and the rule after two correct guesses", () => {
    let state = startGame(MACHINES);
    render(state, MACHINES, NOOP_HANDLERS);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[0][1]);
    render(state, MACHINES, NOOP_HANDLERS);
    state = feed(state, MACHINES, FIRST_MACHINE.ch[1][1]);
    render(state, MACHINES, NOOP_HANDLERS);

    const crackRule = within(ELEMENT_ID_RULE_BOX, byClass(CLASS_RULE, CLASS_RULE_CRACKED));
    expect(document.querySelector(crackRule)?.textContent).toContain(
      COPY_RULE_CRACKED_LABEL + FIRST_MACHINE.rule,
    );
    expect((document.querySelector(byId(ELEMENT_ID_FEED_ROW)) as HTMLElement).style.display).toBe(
      DISPLAY_NONE,
    );
    expect(document.querySelector(byId(ELEMENT_ID_FEEDBACK))?.innerHTML).toBe(
      FEEDBACK_HTML_CORRECT_TWICE,
    );
    expect(document.querySelector(byId(ELEMENT_ID_MACHINE_SUBTITLE))?.textContent).toBe(
      COPY_SUBTITLE_CRACKED,
    );
    expect(document.querySelector(within(ELEMENT_ID_RULE_BOX, TAG_BUTTON))?.textContent).toBe(
      COPY_NEXT_MACHINE,
    );
  });

  it("applies miss styling and reveals the true output on a wrong guess", () => {
    let state = startGame(MACHINES);
    state = feed(state, MACHINES, WRONG_GUESS);
    render(state, MACHINES, NOOP_HANDLERS);

    const missRow = within(ELEMENT_ID_EVIDENCE, byClass(CLASS_ROW, MARK_MISS));
    const miss = document.querySelector(missRow);
    expect(miss).not.toBeNull();
    expect(miss?.querySelector(byClass(CLASS_CHIP, CLASS_CHIP_OUTPUT))?.textContent).toBe(
      tokenize(FIRST_MACHINE.ch[0][1])[0],
    );
    expect(document.querySelector(byId(ELEMENT_ID_FEEDBACK))?.innerHTML).toBe(FEEDBACK_HTML_WRONG);
  });
});
