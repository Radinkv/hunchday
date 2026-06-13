// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import type { Machine } from "../src/game/types";
import { COPY_ADD_STEP, COPY_FEED_BUTTON, COPY_RULE_CRACKED_LABEL, COPY_WORDMARK } from "../src/ui/constants";

/**
 * These tests cover the React interface end to end over the pure reducer, driving the
 * recipe builder rather than a text field. They confirm the wordmark and the first
 * machine render, and that a recipe matching the machine cracks it when proven twice.
 * Because the recipe persists across a machine's challenges, the second proof is a bare
 * feed of the recipe already authored for the first, which is the adjust your recipe
 * loop the builder is built around. Both a number machine and a word machine are covered.
 */

const MULTIPLY_RULE = "It multiplies every chip by 2.";
const MULTIPLY_OP = "multiplies every chip by 2";
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
 * Opens the picker, adds the named operation to the recipe, and feeds it.
 * @param operation The accessible name of the operation in the picker.
 */
function addStepAndFeed(operation: string): void {
  fireEvent.click(screen.getByRole("button", { name: COPY_ADD_STEP }));
  fireEvent.click(screen.getByRole("button", { name: operation }));
  fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
}

/**
 * Feeds the recipe as it stands, without adding a step.
 */
function feedAgain(): void {
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

  it("cracks a number machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    addStepAndFeed(MULTIPLY_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + MULTIPLY_RULE);
  });

  it("cracks a word machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    addStepAndFeed(LETTERS_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + LETTERS_RULE);
  });
});
