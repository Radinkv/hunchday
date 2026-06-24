// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChipBuilder } from "../src/ui/ChipBuilder";
import { OP_TILES } from "../src/ui/palette";
import { SUBMISSION_RECIPE, type ChipPair, type Submission } from "../src/game/types";
import {
  COPY_FEED_BUTTON,
  COPY_NO_MATCHES,
  COPY_NUMBER_TAG_PREFIX,
  COPY_REMOVE_FROM_PREFIX,
} from "../src/ui/constants";

/**
 * These tests cover the recipe builder now that a submission reports whether the recipe
 * reproduces every example rather than a per challenge output string. Operations are found
 * only by searching over the machine's panel set, with no browsable list or tabs. Only
 * operations valid for the running type match, removing a step rolls the recipe back, and
 * cycling a step's number changes what the recipe computes, all observable through the
 * match against the supplied examples.
 */

const MULTIPLY_BY_TWO = "multiplies every chip by 2";
const SUM = "adds all the chips together";
const COUNT_LETTERS = "counts the letters in every chip";

const SEARCH_DOUBLE = "double";
const SEARCH_SUM = "sum";
const SEARCH_COUNT_LETTERS = "count letters";

const FIRST_STEP_TAG = COPY_NUMBER_TAG_PREFIX + "1";
const FIRST_STEP_REMOVE = COPY_REMOVE_FROM_PREFIX + "1";

/** Every panel operation, so the builder can search across the whole palette. */
const ALL_OPS: readonly string[] = OP_TILES.map((tile) => tile.opId);

/**
 * The recipe verdicts the builder reports for a matching and a non matching recipe. A
 * submission also carries the chips the recipe produced for the challenge, which these
 * verdict tests do not pin, so the calls are matched on the verdict fields alone.
 */
const MATCHES_ALL = expect.objectContaining<Submission>({ kind: SUBMISSION_RECIPE, matchesAllExamples: true });
const MATCHES_NONE = expect.objectContaining<Submission>({ kind: SUBMISSION_RECIPE, matchesAllExamples: false });

/**
 * Renders the search only builder over the full panel and the given truth pairs.
 * @param challengeInput The challenge input chips.
 * @param truth The pairs the recipe is checked against.
 * @param onFeed The submission handler.
 */
function renderBuilder(challengeInput: string, truth: readonly ChipPair[], onFeed: (s: Submission) => void): void {
  render(
    <ChipBuilder
      challengeInput={challengeInput}
      truth={truth}
      panelOps={ALL_OPS}
      misses={0}
      missLimit={3}
      onFeed={onFeed}
    />,
  );
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
 * Types a query into the search box and adds the operation with the given phrase.
 * @param query The words to search.
 * @param operation The operation phrase shown in the results.
 */
function searchAndAdd(query: string, operation: string): void {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
  clickButton(operation);
}

describe("ChipBuilder recipe", () => {
  it("reports a recipe that reproduces every example as a match", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1", [["3 1", "4"], ["2 5", "7"]], onFeed);

    searchAndAdd(SEARCH_SUM, SUM);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith(MATCHES_ALL);
  });

  it("reports an empty recipe that fits no example as a miss", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1", [["3 1", "4"], ["2 5", "7"]], onFeed);

    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith(MATCHES_NONE);
  });

  it("rolls back a removed step, flipping the verdict", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1", [["3 1", "4"], ["2 5", "7"]], onFeed);

    searchAndAdd(SEARCH_DOUBLE, MULTIPLY_BY_TWO);
    searchAndAdd(SEARCH_SUM, SUM);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenLastCalledWith(MATCHES_NONE);

    clickButton(FIRST_STEP_REMOVE);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenLastCalledWith(MATCHES_ALL);
  });

  it("flips the verdict when a step's number is cycled", () => {
    const onFeed = vi.fn();
    renderBuilder("3 1", [["3 1", "6 2"], ["2 5", "4 10"]], onFeed);

    searchAndAdd(SEARCH_DOUBLE, MULTIPLY_BY_TWO);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenLastCalledWith(MATCHES_ALL);

    clickButton(FIRST_STEP_TAG);
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenLastCalledWith(MATCHES_NONE);
  });

  it("only matches operations valid for the recipe's running type", () => {
    const onFeed = vi.fn();
    renderBuilder("ox cat horse", [["ox cat horse", "2 3 5"]], onFeed);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: SEARCH_DOUBLE } });
    expect(screen.queryByRole("button", { name: MULTIPLY_BY_TWO })).toBeNull();
    expect(screen.getByText(COPY_NO_MATCHES)).toBeTruthy();

    searchAndAdd(SEARCH_COUNT_LETTERS, COUNT_LETTERS);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: SEARCH_DOUBLE } });
    expect(screen.getByRole("button", { name: MULTIPLY_BY_TWO })).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    clickButton(COPY_FEED_BUTTON);
    expect(onFeed).toHaveBeenCalledWith(MATCHES_ALL);
  });
});
