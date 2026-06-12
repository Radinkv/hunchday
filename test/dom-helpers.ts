import { vi } from "vitest";
import type { Handlers } from "../src/prototype/render";
import {
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
 * Shared document object model helpers for the interface tests. The page skeleton is
 * built from the same element identifiers the rendering layer queries, and the
 * selector helpers build the selectors used to read the rendered output, so the tests
 * track the implementation rather than hardcoding markup.
 */

/**
 * Builds a selector for an element identifier.
 * @param id The element identifier.
 * @returns The identifier selector.
 */
export function byId(id: string): string {
  return "#" + id;
}

/**
 * Builds a selector for one or more class names joined into a single compound.
 * @param names The class names to combine.
 * @returns The compound class selector.
 */
export function byClass(...names: string[]): string {
  return names.map((name) => "." + name).join("");
}

/**
 * Builds a descendant selector from a parent identifier and a descendant selector.
 * @param parentId The identifier of the ancestor element.
 * @param descendant The descendant selector.
 * @returns The combined descendant selector.
 */
export function within(parentId: string, descendant: string): string {
  return byId(parentId) + " " + descendant;
}

/** The page skeleton the rendering layer expects, built from the element identifiers. */
export const DOM_SKELETON = `
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

/**
 * Builds a set of handlers whose callbacks do nothing, for renders that do not drive
 * interface events.
 * @returns The inert handlers.
 */
export function noopHandlers(): Handlers {
  return { onFeed: vi.fn(), onNext: vi.fn(), onRestart: vi.fn() };
}
