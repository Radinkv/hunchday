// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import type { Machine } from "../src/game/types";
import {
  COPY_FEED_BUTTON,
  COPY_NEXT_MACHINE,
  COPY_PLAY,
  COPY_RULE_CRACKED_LABEL,
  COPY_WORDMARK,
} from "../src/ui/constants";

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
  difficulty: "easy",
  rule: MULTIPLY_RULE,
  ex: [
    ["1 2 3", "2 4 6"],
    ["4 5 6", "8 10 12"],
  ],
  ch: [
    ["3 4", "6 8"],
    ["5 1", "10 2"],
  ],
  panelOps: ["mul_k", "add_k", "sum", "max", "min", "reverse"],
};

const LETTERS_RULE = "It counts the letters in every chip.";
const LETTERS_OP = "counts the letters in every chip";
const WORD_MACHINE: Machine = {
  difficulty: "medium",
  rule: LETTERS_RULE,
  ex: [
    ["dog ant", "3 3"],
    ["horse ox", "5 2"],
  ],
  ch: [
    ["cat bee", "3 3"],
    ["fig ace", "3 3"],
  ],
  panelOps: ["length_map", "sort_alpha", "longest", "reverse"],
};

const SUPER_EASY_MACHINE: Machine = {
  difficulty: "super_easy",
  rule: "It adds 1 to every chip.",
  ex: [
    ["1 2", "2 3"],
    ["4 5", "5 6"],
  ],
  ch: [["3 4", "4 5"]],
  panelOps: ["add_k", "sub_k", "mul_k", "reverse", "max", "min"],
};

const POSITION_FIRST = "1st";
const POSITION_SECOND = "2nd";
const RETIRED_WORDS = ["Easy", "Medium", "Hard", "Warm-up"];

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
 * Picks the operation from the flat panel and feeds it. The easy and medium fixtures
 * render the flat operation list, so the operation is a button with no tab to open first.
 * @param operation The operation phrase to pull out.
 */
function pickAndFeed(operation: string): void {
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
  it("shows the intro, then the play screen after pressing Play", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.getByText(COPY_WORDMARK)).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY_FEED_BUTTON })).toBeNull();

    play();
    expect(screen.queryByRole("button", { name: COPY_PLAY })).toBeNull();
    expect(screen.getByRole("button", { name: COPY_FEED_BUTTON })).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("cracks a number machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    pickAndFeed(MULTIPLY_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + MULTIPLY_RULE);
  });

  it("cracks a word machine when a matching recipe is proven twice", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    play();
    pickAndFeed(LETTERS_OP);
    feedAgain();
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + LETTERS_RULE);
  });

  it("shows the position and never a difficulty word, updating as the machine advances", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE, WORD_MACHINE]} />);
    play();
    expect(screen.getByText(POSITION_FIRST)).toBeTruthy();
    for (const word of RETIRED_WORDS) expect(container.textContent).not.toContain(word);

    pickAndFeed(MULTIPLY_OP);
    feedAgain();
    fireEvent.click(screen.getByRole("button", { name: COPY_NEXT_MACHINE }));

    expect(screen.getByText(POSITION_SECOND)).toBeTruthy();
    expect(screen.queryByText(POSITION_FIRST)).toBeNull();
    for (const word of RETIRED_WORDS) expect(container.textContent).not.toContain(word);
  });

  it("leaves the opener bare but gives later tiers a search box", () => {
    const opener = render(<App machines={[SUPER_EASY_MACHINE]} />);
    play();
    expect(screen.queryByRole("searchbox")).toBeNull();
    opener.unmount();
    localStorage.clear();

    render(<App machines={[NUMBER_MACHINE]} />);
    play();
    expect(screen.getByRole("searchbox")).toBeTruthy();
  });

  it("resumes the saved game on reload instead of showing the intro", () => {
    const first = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    pickAndFeed(MULTIPLY_OP);
    first.unmount();

    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.queryByRole("button", { name: COPY_PLAY })).toBeNull();
    expect(screen.getByRole("button", { name: COPY_FEED_BUTTON })).toBeTruthy();
  });
});
