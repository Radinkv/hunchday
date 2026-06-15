// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import { OP_TILES } from "../src/ui/palette";
import { COPY_FEED_BUTTON, COPY_NUMBER_TAG_PREFIX, COPY_REMOVE_FROM_PREFIX } from "../src/ui/constants";

/**
 * These tests cover the recipe builder. Operations are filed into tabs the player flips
 * between to pull a plain English step out, only the tabs valid for the running type are
 * shown, a step's number is changed by tapping its tag, removing a step rolls the recipe
 * back to before it, a recipe that ends on a single chip locks, and feeding folds the
 * recipe over the input into the string the reducer compares.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const SUM = "adds all the chips together";
const COUNT_LETTERS = "counts the letters in every chip";

const TAB_MATH = "Math";
const TAB_TOTALS = "Totals";
const TAB_LETTERS = "Letters";

const FIRST_STEP_TAG = COPY_NUMBER_TAG_PREFIX + "1";
const FIRST_STEP_REMOVE = COPY_REMOVE_FROM_PREFIX + "1";
const SECOND_STEP_REMOVE = COPY_REMOVE_FROM_PREFIX + "2";

/** Every panel operation, so the builder shows the full tabbed palette. */
const ALL_OPS: readonly string[] = OP_TILES.map((tile) => tile.opId);

/** The hard difficulty renders the searchable tabbed palette these tests drive. */
const HARD = "hard" as const;

/**
 * Renders the builder with the full panel in tabbed mode.
 * @param challengeInput The challenge input chips.
 * @param onFeed The feed handler.
 */
function renderBuilder(challengeInput: string, onFeed: (guess: string) => void): void {
  render(<ChipBuilder challengeInput={challengeInput} difficulty={HARD} panelOps={ALL_OPS} onFeed={onFeed} />);
}

afterEach(cleanup);

/**
 * Clicks the button with the given accessible name.
 * @param name The accessible name.
 */
function clickButton(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

/**
 * Switches to the named tab and adds the operation with the given phrase from it.
 * @param tab The tab heading.
 * @param operation The operation phrase shown on the tab's page.
 */
function pullOut(tab: string, operation: string): void {
  fireEvent.click(screen.getByRole("tab", { name: tab }));
  clickButton(operation);
}

describe("ChipBuilder recipe", () => {
  it("folds an authored recipe over the input and feeds the result", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1 4 1", onFeed);

    pullOut(TAB_MATH, MULTIPLY_BY_TWO);
    pullOut(TAB_TOTALS, SUM);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("18");
  });

  it("keeps building after a reduction, applying the next op to the single result", () => {
    const onFeed = vi.fn();
    renderBuilder("2 3", onFeed);

    pullOut(TAB_TOTALS, SUM);
    expect((screen.getByRole("tab", { name: TAB_MATH }) as HTMLButtonElement).disabled).toBe(false);
    pullOut(TAB_MATH, MULTIPLY_BY_TWO);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("10");
  });

  it("feeds the unchanged input when the recipe is empty", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1 4 1", onFeed);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("3 1 4 1");
  });

  it("changes a step's number by tapping its tag", () => {
    const onFeed = vi.fn();
    renderBuilder("2 5", onFeed);

    pullOut(TAB_MATH, MULTIPLY_BY_TWO);
    clickButton(FIRST_STEP_TAG);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("6 15");
  });

  it("removes only the chosen step and keeps the rest", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1 4 1", onFeed);

    pullOut(TAB_MATH, MULTIPLY_BY_TWO);
    pullOut(TAB_TOTALS, SUM);
    clickButton(FIRST_STEP_REMOVE);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("9");
  });

  it("removes the last remaining step back to the unchanged input", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1 4 1", onFeed);

    pullOut(TAB_MATH, MULTIPLY_BY_TWO);
    pullOut(TAB_TOTALS, SUM);
    clickButton(SECOND_STEP_REMOVE);
    clickButton(FIRST_STEP_REMOVE);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("3 1 4 1");
  });

  it("finds an operation by search and adds it across tabs", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1 4 1", onFeed);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "double" } });
    clickButton(MULTIPLY_BY_TWO);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("6 2 8 2");
  });

  it("shows only the tabs valid for the recipe's running type", () => {
    const onFeed = vi.fn();
    renderBuilder("ox cat horse", onFeed);

    expect(screen.queryByRole("tab", { name: TAB_MATH })).toBeNull();
    pullOut(TAB_LETTERS, COUNT_LETTERS);
    expect(screen.getByRole("tab", { name: TAB_MATH })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: TAB_LETTERS })).toBeNull();

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("2 3 5");
  });
});
