// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import { COPY_FEED_BUTTON, COPY_RESET, COPY_TRAIL_LABEL, COPY_TRAY_LABEL } from "../src/ui/constants";

/**
 * These tests cover the chip builder over the Numbers section. The player applies
 * operations to the question's chips and the tray must show the live result, a
 * parameter must cycle in place, reset must restore the question chips, and feeding must
 * submit the transformed chips as the same string the reducer compares.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const SUM = "adds all the chips together";
const REVERSE = "reverses the order";
const SORT_ALPHA = "puts the chips in alphabetical order";
const COUNT_LETTERS = "counts the letters in every chip";
const MAX = "finds the biggest chip";
const ROLE_BUTTON = "button";
const PARAM_TWO = "2";

const INPUT_NUMBERS_MULTI = "3 1 4 1";
const INPUT_NUMBERS_PAIR = "2 5";
const INPUT_NUMBERS_RESET = "1 2 3";
const INPUT_WORDS_SORT = "dog ant cat";
const INPUT_WORDS_NUMERIC = "ox cat horse";

const TRAY_NUMBERS_MULTI_INITIAL = ["3", "1", "4", "1"];
const TRAY_NUMBERS_MULTI_AFTER_MULTIPLY = ["6", "2", "8", "2"];
const TRAY_NUMBERS_MULTI_AFTER_SUM = ["18"];
const FEED_NUMBERS_MULTI_AFTER_SUM = "18";

const TRAY_NUMBERS_PAIR_AFTER_MULTIPLY = ["4", "10"];
const TRAY_NUMBERS_PAIR_AFTER_PARAM_CYCLE = ["6", "15"];

const TRAY_NUMBERS_RESET_AFTER_REVERSE = ["3", "2", "1"];
const TRAY_NUMBERS_RESET_AFTER_RESET = ["1", "2", "3"];

const TRAY_WORDS_SORT_AFTER_SORT = ["ant", "cat", "dog"];
const FEED_WORDS_SORT_AFTER_SORT = "ant cat dog";

const TRAY_WORDS_NUMERIC_AFTER_COUNT = ["2", "3", "5"];
const TRAY_WORDS_NUMERIC_AFTER_MAX = ["5"];

afterEach(cleanup);

/**
 * Reads the chip tokens currently shown in the prediction tray.
 * @returns The tray chip tokens in order.
 */
function trayChips(): string[] {
  const tray = screen.getByLabelText(COPY_TRAY_LABEL);
  return Array.from(tray.querySelectorAll("span")).map((chip) => chip.textContent ?? "");
}

describe("ChipBuilder over the Numbers section", () => {
  it("transforms the chips by applying operations and feeds the result", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_MULTI} onFeed={onFeed} />);
    expect(trayChips()).toEqual(TRAY_NUMBERS_MULTI_INITIAL);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: MULTIPLY_BY_TWO }));
    expect(trayChips()).toEqual(TRAY_NUMBERS_MULTI_AFTER_MULTIPLY);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: SUM }));
    expect(trayChips()).toEqual(TRAY_NUMBERS_MULTI_AFTER_SUM);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: COPY_FEED_BUTTON }));
    expect(onFeed).toHaveBeenCalledWith(FEED_NUMBERS_MULTI_AFTER_SUM);
  });

  it("cycles a parameter in place and updates the chips", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_PAIR} onFeed={onFeed} />);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: MULTIPLY_BY_TWO }));
    expect(trayChips()).toEqual(TRAY_NUMBERS_PAIR_AFTER_MULTIPLY);

    const trail = screen.getByLabelText(COPY_TRAIL_LABEL);
    fireEvent.click(within(trail).getByText(PARAM_TWO));
    expect(trayChips()).toEqual(TRAY_NUMBERS_PAIR_AFTER_PARAM_CYCLE);
  });

  it("rewinds the trail and resets to the question chips", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_NUMBERS_RESET} onFeed={onFeed} />);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: REVERSE }));
    expect(trayChips()).toEqual(TRAY_NUMBERS_RESET_AFTER_REVERSE);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: COPY_RESET }));
    expect(trayChips()).toEqual(TRAY_NUMBERS_RESET_AFTER_RESET);
  });
});

describe("ChipBuilder type sectioning", () => {
  it("offers only vocab operations for word chips and feeds a word answer", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_SORT} onFeed={onFeed} />);

    expect(screen.getByRole(ROLE_BUTTON, { name: SORT_ALPHA })).toBeTruthy();
    expect(screen.queryByRole(ROLE_BUTTON, { name: SUM })).toBeNull();

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: SORT_ALPHA }));
    expect(trayChips()).toEqual(TRAY_WORDS_SORT_AFTER_SORT);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: COPY_FEED_BUTTON }));
    expect(onFeed).toHaveBeenCalledWith(FEED_WORDS_SORT_AFTER_SORT);
  });

  it("flips from vocab to numbers when a translate operation is applied", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_NUMERIC} onFeed={onFeed} />);
    expect(screen.queryByRole(ROLE_BUTTON, { name: MAX })).toBeNull();

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: COUNT_LETTERS }));
    expect(trayChips()).toEqual(TRAY_WORDS_NUMERIC_AFTER_COUNT);
    expect(screen.getByRole(ROLE_BUTTON, { name: MAX })).toBeTruthy();
    expect(screen.queryByRole(ROLE_BUTTON, { name: SORT_ALPHA })).toBeNull();
  });

  it("locks the palette once a reducer makes the chips terminal", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput={INPUT_WORDS_NUMERIC} onFeed={onFeed} />);

    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: COUNT_LETTERS }));
    fireEvent.click(screen.getByRole(ROLE_BUTTON, { name: MAX }));
    expect(trayChips()).toEqual(TRAY_WORDS_NUMERIC_AFTER_MAX);
    expect(screen.queryByRole(ROLE_BUTTON, { name: MAX })).toBeNull();
    expect(screen.queryByRole(ROLE_BUTTON, { name: SUM })).toBeNull();
  });
});
