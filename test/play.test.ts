// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { machinesForDate } from "../src/prototype/adapter";
import { feed, startGame } from "../src/prototype/reducer";
import { render, type Handlers } from "../src/prototype/render";
import {
  CLASS_ROW,
  CLASS_RULE,
  CLASS_RULE_CRACKED,
  COPY_QUESTION_PREFIX,
  ELEMENT_ID_BOT,
  ELEMENT_ID_DOTS,
  ELEMENT_ID_EVIDENCE,
  ELEMENT_ID_FEED_BUTTON,
  ELEMENT_ID_FEED_ROW,
  ELEMENT_ID_FEEDBACK,
  ELEMENT_ID_GUESS_INPUT,
  ELEMENT_ID_LIGHT,
  ELEMENT_ID_MACHINE_NAME,
  ELEMENT_ID_MACHINE_SUBTITLE,
  ELEMENT_ID_QUESTION,
  ELEMENT_ID_RULE_BOX,
} from "../src/prototype/constants";

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

/**
 * Builds a selector for an element identifier.
 * @param id The element identifier.
 * @returns The identifier selector.
 */
function byId(id: string): string {
  return "#" + id;
}

/**
 * Builds a selector for one or more class names joined into a single compound.
 * @param names The class names to combine.
 * @returns The compound class selector.
 */
function byClass(...names: string[]): string {
  return names.map((name) => "." + name).join("");
}

/**
 * Builds a descendant selector from a parent identifier and a descendant selector.
 * @param parentId The identifier of the ancestor element.
 * @param descendant The descendant selector.
 * @returns The combined descendant selector.
 */
function within(parentId: string, descendant: string): string {
  return byId(parentId) + " " + descendant;
}

const SKELETON = `
  <div id="${ELEMENT_ID_DOTS}"></div>
  <svg id="${ELEMENT_ID_BOT}"><circle id="${ELEMENT_ID_LIGHT}"></circle></svg>
  <div id="${ELEMENT_ID_MACHINE_NAME}"></div>
  <div id="${ELEMENT_ID_MACHINE_SUBTITLE}"></div>
  <div id="${ELEMENT_ID_EVIDENCE}"></div>
  <p id="${ELEMENT_ID_QUESTION}"></p>
  <div id="${ELEMENT_ID_FEED_ROW}"><input id="${ELEMENT_ID_GUESS_INPUT}" type="text"><button id="${ELEMENT_ID_FEED_BUTTON}"></button></div>
  <p id="${ELEMENT_ID_FEEDBACK}"></p>
  <div id="${ELEMENT_ID_RULE_BOX}"></div>
`;

const NOOP_HANDLERS: Handlers = { onFeed: vi.fn(), onNext: vi.fn(), onRestart: vi.fn() };

describe("playing a generated day", () => {
  it("renders the first machine and cracks it with its own answers", () => {
    document.body.innerHTML = SKELETON;
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
