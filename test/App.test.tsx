// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import type { Machine } from "../src/game/types";
import { COPY_FEED_BUTTON, COPY_PLAY, COPY_RULE_CRACKED_LABEL, COPY_WORDMARK } from "../src/ui/constants";

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
const TAB_MATH = "Math";
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
const TAB_LETTERS = "Letters";
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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/**
 * Presses Play to start a fresh game from the intro.
 */
function play(): void {
  fireEvent.click(screen.getByRole("button", { name: COPY_PLAY }));
}

/**
 * Switches to the named tab, pulls the operation into the recipe, and feeds it.
 * @param tab The tab heading holding the operation.
 * @param operation The operation phrase to pull out.
 */
function pullOutAndFeed(tab: string, operation: string): void {
  fireEvent.click(screen.getByRole("tab", { name: tab }));
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
  it("shows the intro, then the first machine after pressing Play", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.getByText(COPY_WORDMARK)).toBeTruthy();
    expect(screen.queryByText(/What comes out for/)).toBeNull();

    play();
    expect(screen.getByText("Machine 01")).toBeTruthy();
    expect(screen.getByText(/What comes out for/)).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("cracks a number machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    pullOutAndFeed(TAB_MATH, MULTIPLY_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + MULTIPLY_RULE);
  });

  it("cracks a word machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    play();
    pullOutAndFeed(TAB_LETTERS, LETTERS_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + LETTERS_RULE);
  });

  it("resumes the saved game on reload instead of showing the intro", () => {
    const first = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    pullOutAndFeed(TAB_MATH, MULTIPLY_OP);
    first.unmount();

    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.queryByRole("button", { name: COPY_PLAY })).toBeNull();
    expect(screen.getByText(/What comes out for/)).toBeTruthy();
  });
});
