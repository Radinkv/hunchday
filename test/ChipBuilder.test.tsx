// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import { COPY_FEED_BUTTON, COPY_RESET, COPY_TRAIL_LABEL, COPY_TRAY_LABEL } from "../src/ui/constants";

/**
 * These tests cover the chip builder. Operations are grouped into tabs, so a tab is
 * selected before an operation in it is applied. The tray must show the live result, a
 * parameter must cycle in place, reset must restore the question chips, the active
 * section must follow the chip type, and feeding must submit the transformed chips as
 * the same string the reducer compares.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const SUM = "adds all the chips together";
const REVERSE = "reverses the order";
const SORT_ALPHA = "puts the chips in alphabetical order";
const COUNT_LETTERS = "counts the letters in every chip";
const MAX = "finds the biggest chip";
const PARAM_TWO = "2";

const TAB_PICK = "Pick";
const TAB_ORDER = "Order";
const TAB_WORDS = "Words";

const INPUT_NUMBERS_MULTI = "3 1 4 1";
const INPUT_NUMBERS_PAIR = "2 5";
const INPUT_NUMBERS_RESET = "1 2 3";
const INPUT_WORDS_SORT = "dog ant cat";
const INPUT_WORDS_NUMERIC = "ox cat horse";

afterEach(cleanup);

/**
 * Reads the chip tokens currently shown in the prediction tray.
 * @returns The tray chip tokens in order.
 */
function trayChips(): string[] {
  const tray = screen.getByLabelText(COPY_TRAY_LABEL);
  return Array.from(tray.querySelectorAll("span")).map((chip) => chip.textContent ?? "");
}

/**
 * Selects the palette tab with the given label.
 * @param label The tab label.
 */
function selectTab(label: string): void {
  fireEvent.click(screen.getByRole("tab", { name: label }));
}

/**
 * Clicks the button with the given accessible name.
 * @param name The accessible name.
 */
function clickButton(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ChipBuilder over the Numbers section", () => {
  it("transforms the chips by applying operations and feeds the result", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_MULTI} onFeed={onFeed} />);
    expect(trayChips()).toEqual(["3", "1", "4", "1"]);

    clickButton(MULTIPLY_BY_TWO);
    expect(trayChips()).toEqual(["6", "2", "8", "2"]);

    selectTab(TAB_PICK);
    clickButton(SUM);
    expect(trayChips()).toEqual(["18"]);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("18");
  });

  it("cycles a parameter in place and updates the chips", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_PAIR} onFeed={onFeed} />);

    clickButton(MULTIPLY_BY_TWO);
    expect(trayChips()).toEqual(["4", "10"]);

    const trail = screen.getByLabelText(COPY_TRAIL_LABEL);
    fireEvent.click(within(trail).getByText(PARAM_TWO));
    expect(trayChips()).toEqual(["6", "15"]);
  });

  it("rewinds the trail and resets to the question chips", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_RESET} onFeed={onFeed} />);

    selectTab(TAB_ORDER);
    clickButton(REVERSE);
    expect(trayChips()).toEqual(["3", "2", "1"]);

    clickButton(COPY_RESET);
    expect(trayChips()).toEqual(["1", "2", "3"]);
  });
});

describe("ChipBuilder type sectioning", () => {
  it("offers only vocab operations for word chips and feeds a word answer", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_SORT} onFeed={onFeed} />);
    expect(screen.queryByRole("button", { name: SUM })).toBeNull();

    selectTab(TAB_WORDS);
    clickButton(SORT_ALPHA);
    expect(trayChips()).toEqual(["ant", "cat", "dog"]);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("ant cat dog");
  });

  it("flips from vocab to numbers when a translate operation is applied", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_NUMERIC} onFeed={onFeed} />);
    expect(screen.queryByRole("button", { name: MAX })).toBeNull();

    clickButton(COUNT_LETTERS);
    expect(trayChips()).toEqual(["2", "3", "5"]);
    expect(screen.queryByRole("button", { name: SORT_ALPHA })).toBeNull();

    selectTab(TAB_PICK);
    expect(screen.getByRole("button", { name: MAX })).toBeTruthy();
  });

  it("locks the palette once a reducer makes the chips terminal", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_NUMERIC} onFeed={onFeed} />);

    clickButton(COUNT_LETTERS);
    selectTab(TAB_PICK);
    clickButton(MAX);
    expect(trayChips()).toEqual(["5"]);
    expect(screen.queryByRole("button", { name: MAX })).toBeNull();
    expect(screen.queryByRole("button", { name: SUM })).toBeNull();
  });
});
