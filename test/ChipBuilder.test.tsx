// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import {
  COPY_ADD_STEP,
  COPY_FEED_BUTTON,
  COPY_PARAM_UP_PREFIX,
  COPY_REMOVE_FROM_PREFIX,
  COPY_TERMINAL_HINT,
} from "../src/ui/constants";

/**
 * These tests cover the recipe builder. The player authors an ordered recipe of the
 * machine's operations without seeing the chips change; only the operations valid for
 * the recipe's running type are offered, a step's amount is adjusted in place, removing
 * a step rolls the recipe back to before it, a recipe that ends on a single chip locks,
 * and feeding folds the recipe over the input into the string the reducer compares.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const SUM = "adds all the chips together";
const COUNT_LETTERS = "counts the letters in every chip";
const COUNT_VOWELS = "counts the vowels in every chip";

const FIRST_STEP_REMOVE = COPY_REMOVE_FROM_PREFIX + "1";
const SECOND_STEP_REMOVE = COPY_REMOVE_FROM_PREFIX + "2";
const FIRST_STEP_UP = COPY_PARAM_UP_PREFIX + "1";

afterEach(cleanup);

/**
 * Clicks the button with the given accessible name.
 * @param name The accessible name.
 */
function clickButton(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

/**
 * Opens the op picker and adds the step with the given operation phrase.
 * @param operation The accessible name of the operation in the picker.
 */
function addStep(operation: string): void {
  clickButton(COPY_ADD_STEP);
  clickButton(operation);
}

describe("ChipBuilder recipe", () => {
  it("folds an authored recipe over the input and feeds the result", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="3 1 4 1" onFeed={onFeed} />);

    addStep(MULTIPLY_BY_TWO);
    addStep(SUM);
    expect(screen.getByText(COPY_TERMINAL_HINT)).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY_ADD_STEP })).toBeNull();

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("18");
  });

  it("feeds the unchanged input when the recipe is empty", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="3 1 4 1" onFeed={onFeed} />);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("3 1 4 1");
  });

  it("adjusts a step's amount in place", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="2 5" onFeed={onFeed} />);

    addStep(MULTIPLY_BY_TWO);
    clickButton(FIRST_STEP_UP);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("6 15");
  });

  it("rolls the recipe back when a step is removed", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="3 1 4 1" onFeed={onFeed} />);

    addStep(MULTIPLY_BY_TWO);
    addStep(SUM);
    clickButton(SECOND_STEP_REMOVE);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("6 2 8 2");
  });

  it("removes the whole recipe when the first step is removed", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="3 1 4 1" onFeed={onFeed} />);

    addStep(MULTIPLY_BY_TWO);
    clickButton(FIRST_STEP_REMOVE);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("3 1 4 1");
  });

  it("offers only the operations valid for the recipe's running type", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="ox cat horse" onFeed={onFeed} />);

    clickButton(COPY_ADD_STEP);
    expect(screen.queryByRole("button", { name: MULTIPLY_BY_TWO })).toBeNull();
    clickButton(COUNT_LETTERS);

    clickButton(COPY_ADD_STEP);
    expect(screen.getByRole("button", { name: MULTIPLY_BY_TWO })).toBeTruthy();
    expect(screen.queryByRole("button", { name: COUNT_VOWELS })).toBeNull();

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("2 3 5");
  });
});
