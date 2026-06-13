// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import type { Machine } from "../src/game/types";
import { COPY_FEED_BUTTON, COPY_RULE_CRACKED_LABEL, COPY_WORDMARK } from "../src/ui/constants";

/**
 * These tests cover the React interface end to end over the pure reducer, driving the
 * chip builder rather than a text field. They confirm the wordmark and the first machine
 * render, and that applying the right transformation twice in a row cracks a machine and
 * prints its rule, for both a number machine and a word machine. The machine sets are
 * purpose built so their outputs are reachable by applying a single palette tile.
 */

const MULTIPLY_RULE = "It multiplies every chip by 2.";
const MULTIPLY_OP = "multiplies every chip by 2";
const MULTIPLY_TAB = "Transform";
const NUMBER_MACHINE: Machine = {
  rule: MULTIPLY_RULE,
  ex: [
    ["1 2 3", "2 4 6"],
    ["4 5 6", "8 10 12"],
  ],
  ch: [
    ["3 4", "6 8"],
    ["5 1", "10 2"],
  ],
};

const LETTERS_RULE = "It counts the letters in every chip.";
const LETTERS_OP = "counts the letters in every chip";
const LETTERS_TAB = "To numbers";
const WORD_MACHINE: Machine = {
  rule: LETTERS_RULE,
  ex: [
    ["dog ant", "3 3"],
    ["horse ox", "5 2"],
  ],
  ch: [
    ["cat bee", "3 3"],
    ["fig ace", "3 3"],
  ],
};

afterEach(cleanup);

/**
 * Selects the palette tab, applies the named operation, and feeds the resulting chips.
 * @param tab The label of the tab holding the operation.
 * @param operation The accessible name of the operation tile to apply.
 */
function applyAndFeed(tab: string, operation: string): void {
  fireEvent.click(screen.getByRole("tab", { name: tab }));
  fireEvent.click(screen.getByRole("button", { name: operation }));
  fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
}

describe("App", () => {
  it("renders the wordmark, the first machine, and its example chips", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.getByText(COPY_WORDMARK)).toBeTruthy();
    expect(screen.getByText("Machine 01")).toBeTruthy();
    expect(screen.getByText(/What comes out for/)).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("cracks a number machine when the right transformation is applied twice", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    applyAndFeed(MULTIPLY_TAB, MULTIPLY_OP);
    applyAndFeed(MULTIPLY_TAB, MULTIPLY_OP);
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + MULTIPLY_RULE);
  });

  it("cracks a word machine when the right transformation is applied twice", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    applyAndFeed(LETTERS_TAB, LETTERS_OP);
    applyAndFeed(LETTERS_TAB, LETTERS_OP);
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + LETTERS_RULE);
  });
});
