// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { machinesForDate } from "../src/prototype/adapter";
import { feed, startGame } from "../src/prototype/reducer";
import { render } from "../src/prototype/render";
import {
  CLASS_ROW,
  CLASS_RULE,
  CLASS_RULE_CRACKED,
  COPY_QUESTION_PREFIX,
  ELEMENT_ID_EVIDENCE,
  ELEMENT_ID_QUESTION,
  ELEMENT_ID_RULE_BOX,
} from "../src/prototype/constants";
import { byClass, byId, DOM_SKELETON, noopHandlers, within } from "./dom-helpers";

/**
 * This test exercises the whole playable chain end to end: a generated day is adapted
 * to reducer machines, started, rendered into the page, and the first machine is
 * cracked by feeding its own correct answers. It confirms a real generated puzzle
 * renders and plays through the prototype interface, which is what the daily entry
 * point does on load. Element identifiers, classes, and copy come from the same
 * registry the interface uses.
 */

const SAMPLE_DATE = "2026-06-20";
const FIRST_MACHINE_INDEX = 0;
const FIRST_CHALLENGE_INDEX = 0;
const SECOND_CHALLENGE_INDEX = 1;
const OUTPUT_FIELD = 1;

const NOOP_HANDLERS = noopHandlers();

describe("playing a generated day", () => {
  it("renders the first machine and cracks it with its own answers", () => {
    document.body.innerHTML = DOM_SKELETON;
    const machines = machinesForDate(SAMPLE_DATE);

    const first = machines.at(FIRST_MACHINE_INDEX);
    const firstChallenge = first?.ch.at(FIRST_CHALLENGE_INDEX);
    const secondChallenge = first?.ch.at(SECOND_CHALLENGE_INDEX);
    expect(first).toBeDefined();
    expect(firstChallenge).toBeDefined();
    expect(secondChallenge).toBeDefined();
    if (!first || !firstChallenge || !secondChallenge) return;

    let state = startGame(machines);
    render(state, machines, NOOP_HANDLERS);
    expect(document.querySelectorAll(within(ELEMENT_ID_EVIDENCE, byClass(CLASS_ROW)))).toHaveLength(
      first.ex.length,
    );
    expect(document.querySelector(byId(ELEMENT_ID_QUESTION))?.innerHTML).toContain(COPY_QUESTION_PREFIX);

    state = feed(state, machines, firstChallenge[OUTPUT_FIELD]);
    state = feed(state, machines, secondChallenge[OUTPUT_FIELD]);
    render(state, machines, NOOP_HANDLERS);

    expect(state.won).toBe(true);
    expect(
      document.querySelector(within(ELEMENT_ID_RULE_BOX, byClass(CLASS_RULE, CLASS_RULE_CRACKED)))?.textContent,
    ).toContain(first.rule);
  });
});
