// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import {
  COPY_BUCKET_LABEL,
  COPY_CYCLE_PARAM_PREFIX,
  COPY_FEED_BUTTON,
  COPY_PUT_BACK_SUFFIX,
  COPY_RESET,
  COPY_SET_ASIDE_SUFFIX,
  COPY_UNDO,
  COPY_WORK_LABEL,
} from "../src/ui/constants";

/**
 * These tests cover the chip builder. Operations are grouped into tabs and act only on
 * the work lane. Tapping a chip moves it to or from the set aside lane, where it is
 * frozen against later transforms, undo and reset walk the history, and feeding submits
 * the work lane as the same string the reducer compares.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const MULTIPLY_BY_THREE = "multiplies every chip by 3";
const SUM = "adds all the chips together";
const COUNT_LETTERS = "counts the letters in every chip";
const COUNT_VOWELS = "counts the vowels in every chip";
const CYCLE_MULTIPLY = COPY_CYCLE_PARAM_PREFIX + MULTIPLY_BY_TWO;

const TAB_COMBINE = "Combine";

afterEach(cleanup);

/**
 * Reads the chip tokens in the lane with the given accessible label.
 * @param label The lane label.
 * @returns The chip tokens in order.
 */
function laneChips(label: string): string[] {
  const lane = screen.getByLabelText(label);
  return Array.from(lane.querySelectorAll("[data-chip-id]")).map((chip) => chip.textContent ?? "");
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

describe("ChipBuilder transforms", () => {
  it("applies an operation to the work lane and feeds the result", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="3 1 4 1" onFeed={onFeed} />);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["3", "1", "4", "1"]);

    clickButton(MULTIPLY_BY_TWO);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["6", "2", "8", "2"]);

    selectTab(TAB_COMBINE);
    clickButton(SUM);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["18"]);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("18");
  });

  it("cycles a tile parameter before applying it", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="2 5" onFeed={onFeed} />);

    clickButton(CYCLE_MULTIPLY);
    clickButton(MULTIPLY_BY_THREE);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["6", "15"]);
  });

  it("undoes and resets through the history", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="1 2 3" onFeed={onFeed} />);

    clickButton(MULTIPLY_BY_TWO);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["2", "4", "6"]);
    clickButton(COPY_UNDO);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["1", "2", "3"]);

    clickButton(MULTIPLY_BY_TWO);
    clickButton(COPY_RESET);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["1", "2", "3"]);
  });
});

describe("ChipBuilder set aside lane", () => {
  it("freezes a set aside chip while the work lane is transformed, then returns it", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="2 5 9" onFeed={onFeed} />);

    clickButton("5" + COPY_SET_ASIDE_SUFFIX);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["2", "9"]);
    expect(laneChips(COPY_BUCKET_LABEL)).toEqual(["5"]);

    clickButton(MULTIPLY_BY_TWO);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["4", "18"]);
    expect(laneChips(COPY_BUCKET_LABEL)).toEqual(["5"]);

    clickButton("5" + COPY_PUT_BACK_SUFFIX);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["4", "18", "5"]);
    expect(laneChips(COPY_BUCKET_LABEL)).toEqual([]);
  });

  it("feeds only the chips left in the work lane", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="dog ant cat" onFeed={onFeed} />);

    clickButton("ant" + COPY_SET_ASIDE_SUFFIX);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith("dog cat");
  });
});

describe("ChipBuilder type sectioning", () => {
  it("flips from vocab to numbers when a translate operation is applied", () => {
    const onFeed = vi.fn();
    render(<ChipBuilder challengeInput="ox cat horse" onFeed={onFeed} />);
    expect(screen.queryByRole("button", { name: MULTIPLY_BY_TWO })).toBeNull();

    clickButton(COUNT_LETTERS);
    expect(laneChips(COPY_WORK_LABEL)).toEqual(["2", "3", "5"]);
    expect(screen.getByRole("button", { name: MULTIPLY_BY_TWO })).toBeTruthy();
    expect(screen.queryByRole("button", { name: COUNT_VOWELS })).toBeNull();
  });
});
