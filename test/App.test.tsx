// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MAX_TESTS } from "../src/ui/tester";
import type { Machine } from "../src/game/types";
import {
  CLASS_CHIP_GUESS,
  CLASS_CHIP_WRONG,
  CLASS_MISS_PIPS,
  CLASS_PIP_ON,
  COPY_WAITING,
  COPY_END_CRACKED_PREFIX,
  COPY_END_OF,
  COPY_COMPOSER_FLIP_PREFIX,
  COPY_FEED_BUTTON,
  COPY_HELP_TEXT,
  COPY_HELP_TITLE,
  COPY_MODE_GUESS,
  COPY_MODE_RECIPE,
  COPY_MODE_TEST,
  COPY_PAD_BACK_LABEL,
  COPY_PAD_DIGIT_PREFIX,
  COPY_PAD_NEXT_LABEL,
  COPY_TEST_RUN,
  COPY_NEXT_MACHINE,
  COPY_PLAY,
  COPY_PLAY_AGAIN,
  COPY_SEE_RESULTS,
  COPY_SHOW_GUESS,
  COPY_WORDMARK,
} from "../src/ui/constants";

/**
 * These tests cover the React interface end to end over the pure reducer. Guess is the
 * default input, so recipe tests first switch to Recipe mode and find the operation by
 * search. A recipe that reproduces every example cracks its machine on a single submission,
 * while a wrong guess shows the player's chips beside the truth with no feedback text. Both
 * a number and a word machine are covered, along with the minimal end screen.
 */

const MULTIPLY_RULE = "It multiplies every chip by 2.";
const MULTIPLY_OP = "multiplies every chip by 2";
const SEARCH_SUM = "sum";
const SUM_OP = "adds all the chips together";
const SEARCH_DOUBLE = "double";
const SEARCH_COUNT_LETTERS = "count letters";
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
const SEARCH_LETTERS_OP = SEARCH_COUNT_LETTERS;
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

const PROGRESS_EMPTY = "0";
const PROGRESS_HALF = "50";
const PROGRESS_NOW_ATTR = "aria-valuenow";
const RETIRED_WORDS = ["Easy", "Medium", "Hard", "Warm-up"];

/** A machine carrying its pipeline steps, so the Test tab is offered. */
const TESTABLE_MACHINE: Machine = {
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
  steps: [{ opId: "mul_k", params: { k: 2 } }],
};

const TEST_INPUT_FRESH = "7 8";
const TEST_OUTPUT_FRESH = "14";
const TEST_INPUT_IN_PLAY = "3 4";

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
 * Switches the workspace from the default Guess mode to Recipe mode.
 */
function toRecipe(): void {
  fireEvent.click(screen.getByRole("tab", { name: COPY_MODE_RECIPE }));
}

/**
 * Switches the workspace back to Guess mode.
 */
function toGuess(): void {
  fireEvent.click(screen.getByRole("tab", { name: COPY_MODE_GUESS }));
}

/**
 * Switches to Recipe mode, finds the operation by search, adds it, and feeds the recipe.
 * @param query The words to search for the operation.
 * @param operation The operation phrase shown in the results.
 */
function recipeAndFeed(query: string, operation: string): void {
  toRecipe();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
  fireEvent.click(screen.getByRole("button", { name: operation }));
  fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
}

/**
 * Dismisses the final machine's reveal to advance to the results screen.
 */
function seeResults(): void {
  fireEvent.click(screen.getByRole("button", { name: COPY_SEE_RESULTS }));
}

/**
 * Switches the workspace to the Test tab.
 */
function toTest(): void {
  fireEvent.click(screen.getByRole("tab", { name: COPY_MODE_TEST }));
}

/**
 * Composes a chip set on the active number pad, pressing each digit and starting a new chip
 * between tokens, the way a player builds chips without a keyboard.
 * @param value The space separated chips to compose.
 */
function composeChips(value: string): void {
  value.split(" ").forEach((token, index) => {
    if (index > 0) fireEvent.click(screen.getByRole("button", { name: COPY_PAD_NEXT_LABEL }));
    for (const digit of token) {
      fireEvent.click(screen.getByRole("button", { name: COPY_PAD_DIGIT_PREFIX + digit }));
    }
  });
}

/**
 * Composes a chip set on the test bench and runs it.
 * @param value The chips to test.
 */
function runTestInput(value: string): void {
  composeChips(value);
  fireEvent.click(screen.getByRole("button", { name: COPY_TEST_RUN }));
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

  it("cracks a number machine on a single recipe that fits every example", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    recipeAndFeed(SEARCH_DOUBLE, MULTIPLY_OP);
    seeResults();
    expect(screen.getByRole("button", { name: COPY_PLAY_AGAIN })).toBeTruthy();
    expect(container.textContent).toContain(COPY_END_CRACKED_PREFIX + "1" + COPY_END_OF + "1");
  });

  it("cracks a word machine on a single recipe that fits every example", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    play();
    recipeAndFeed(SEARCH_LETTERS_OP, LETTERS_OP);
    seeResults();
    expect(screen.getByRole("button", { name: COPY_PLAY_AGAIN })).toBeTruthy();
    expect(container.textContent).toContain(COPY_END_CRACKED_PREFIX + "1" + COPY_END_OF + "1");
  });

  it("shows the final machine's reveal first and only opens the results after See results", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    play();
    recipeAndFeed(SEARCH_DOUBLE, MULTIPLY_OP);
    expect(screen.getByRole("button", { name: COPY_SEE_RESULTS })).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY_PLAY_AGAIN })).toBeNull();

    seeResults();
    expect(screen.queryByRole("button", { name: COPY_SEE_RESULTS })).toBeNull();
    expect(screen.getByRole("button", { name: COPY_PLAY_AGAIN })).toBeTruthy();
  });

  it("offers a Test tab that runs a chosen input and blocks a set already in play", () => {
    render(<App machines={[TESTABLE_MACHINE]} />);
    play();
    toTest();
    runTestInput(TEST_INPUT_FRESH);
    expect(screen.getAllByText(TEST_OUTPUT_FRESH).length).toBeGreaterThan(0);

    composeChips(TEST_INPUT_IN_PLAY);
    const runButton = screen.getByRole("button", { name: COPY_TEST_RUN }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
  });

  it("blocks the shown example from the test bench", () => {
    render(<App machines={[TESTABLE_MACHINE]} />);
    play();
    toTest();
    composeChips("1 2 3");
    expect((screen.getByRole("button", { name: COPY_TEST_RUN }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("allows testing an unseen example input that is not graded", () => {
    render(<App machines={[TESTABLE_MACHINE]} />);
    play();
    toTest();
    composeChips("4 5 6");
    expect((screen.getByRole("button", { name: COPY_TEST_RUN }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("locks the test bench once the test budget is spent", () => {
    render(<App machines={[TESTABLE_MACHINE]} />);
    play();
    toTest();
    for (let index = 0; index < MAX_TESTS; index++) {
      runTestInput(index + 7 + " " + (index + 8));
    }
    const aDigitKey = screen.getByRole("button", { name: COPY_PAD_DIGIT_PREFIX + "1" }) as HTMLButtonElement;
    const runButton = screen.getByRole("button", { name: COPY_TEST_RUN }) as HTMLButtonElement;
    expect(aDigitKey.disabled).toBe(true);
    expect(runButton.disabled).toBe(true);
  });

  it("shows a wrong recipe's own chips behind the cross toggle on the revealed challenge", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    recipeAndFeed(SEARCH_SUM, SUM_OP);
    expect(container.querySelector("." + CLASS_CHIP_WRONG)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY_SHOW_GUESS }));
    expect(container.querySelector("." + CLASS_CHIP_WRONG)).toBeTruthy();
  });

  it("hides a wrong guess behind the cross toggle, revealing it on tap with no feedback text", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    composeChips("1");
    fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
    expect(container.querySelector("." + CLASS_CHIP_WRONG)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY_SHOW_GUESS }));
    expect(container.querySelector("." + CLASS_CHIP_WRONG)).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY_FEED_BUTTON })).toBeTruthy();
  });

  it("fills the day progress as machines are finished, and never shows a difficulty word", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE, WORD_MACHINE]} />);
    play();
    expect(screen.getByRole("progressbar").getAttribute(PROGRESS_NOW_ATTR)).toBe(PROGRESS_EMPTY);
    for (const word of RETIRED_WORDS) expect(container.textContent).not.toContain(word);

    recipeAndFeed(SEARCH_DOUBLE, MULTIPLY_OP);
    fireEvent.click(screen.getByRole("button", { name: COPY_NEXT_MACHINE }));

    expect(screen.getByRole("progressbar").getAttribute(PROGRESS_NOW_ATTR)).toBe(PROGRESS_HALF);
    for (const word of RETIRED_WORDS) expect(container.textContent).not.toContain(word);
  });

  it("defaults to Guess and shows the search only recipe builder after switching", () => {
    render(<App machines={[SUPER_EASY_MACHINE]} />);
    play();
    expect(screen.getByRole("button", { name: COPY_PAD_DIGIT_PREFIX + "1" })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();

    toRecipe();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: MULTIPLY_OP })).toBeNull();
  });

  it("keeps the thrown chips when switching to Recipe and back", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    composeChips("6 8");
    expect(container.querySelectorAll("." + CLASS_CHIP_GUESS).length).toBe(2);

    toRecipe();
    toGuess();
    expect(container.querySelectorAll("." + CLASS_CHIP_GUESS).length).toBe(2);
  });

  it("deletes a whole chip and clears the composer after feeding", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    composeChips("6 8");
    expect(container.querySelectorAll("." + CLASS_CHIP_GUESS).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: COPY_PAD_BACK_LABEL }));
    expect(container.querySelectorAll("." + CLASS_CHIP_GUESS).length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
    expect(container.querySelectorAll("." + CLASS_CHIP_GUESS).length).toBe(0);
  });

  it("shows the flashing challenge row only on the Guess tab", () => {
    render(<App machines={[TESTABLE_MACHINE]} />);
    play();
    expect(screen.queryByAltText(COPY_WAITING)).toBeTruthy();

    toRecipe();
    expect(screen.queryByAltText(COPY_WAITING)).toBeNull();

    toTest();
    expect(screen.queryByAltText(COPY_WAITING)).toBeNull();

    toGuess();
    expect(screen.queryByAltText(COPY_WAITING)).toBeTruthy();
  });

  it("flips a small number chip to negative on tap, but leaves a large one unchanged", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    play();

    composeChips("3");
    const small = screen.getByRole("button", { name: COPY_COMPOSER_FLIP_PREFIX + "1" });
    expect(small.textContent).toBe("3");
    fireEvent.click(small);
    expect(screen.getByRole("button", { name: COPY_COMPOSER_FLIP_PREFIX + "1" }).textContent).toBe("-3");

    fireEvent.click(screen.getByRole("button", { name: COPY_PAD_NEXT_LABEL }));
    composeChips("7");
    const large = screen.getByRole("button", { name: COPY_COMPOSER_FLIP_PREFIX + "2" });
    fireEvent.click(large);
    expect(screen.getByRole("button", { name: COPY_COMPOSER_FLIP_PREFIX + "2" }).textContent).toBe("7");
  });

  it("fills a miss pip for each wrong answer in Guess", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    const onPip = "." + CLASS_MISS_PIPS + " ." + CLASS_PIP_ON;
    expect(container.querySelectorAll(onPip).length).toBe(0);

    composeChips("1");
    fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
    expect(container.querySelectorAll(onPip).length).toBe(1);
  });

  it("opens the help popover from the navbar and closes it again", () => {
    render(<App machines={[NUMBER_MACHINE]} />);
    const help = screen.getByRole("button", { name: COPY_HELP_TITLE });
    expect(screen.queryByText(COPY_HELP_TEXT)).toBeNull();

    fireEvent.click(help);
    expect(screen.getByText(COPY_HELP_TEXT)).toBeTruthy();

    fireEvent.click(help);
    expect(screen.queryByText(COPY_HELP_TEXT)).toBeNull();
  });

  it("resumes the saved game mid play on reload instead of showing the intro", () => {
    const first = render(<App machines={[NUMBER_MACHINE]} />);
    play();
    composeChips("1");
    fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
    first.unmount();

    render(<App machines={[NUMBER_MACHINE]} />);
    expect(screen.queryByRole("button", { name: COPY_PLAY })).toBeNull();
    expect(screen.getByRole("button", { name: COPY_FEED_BUTTON })).toBeTruthy();
  });
});
