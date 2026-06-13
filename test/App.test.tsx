// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import type { Machine } from "../src/game/types";
import { COPY_FEED_BUTTON, COPY_RULE_CRACKED_LABEL, COPY_WORDMARK } from "../src/ui/constants";

/**
 * These tests cover the React interface end to end over the pure reducer, driving the
 * chip builder rather than a text field. They confirm the wordmark and the first machine
 * render, and that applying the right operation twice in a row cracks a machine and
 * prints its rule, for both a number machine and a word machine. The machine sets are
 * purpose built so their outputs are reachable by applying a single palette operation.
 */

const REVERSE_RULE = "It reverses the order.";
const REVERSE_OP = "reverses the order";
const REVERSE_TAB = "Order";
const SORT_TAB = "Words";
const NUMBER_MACHINE: Machine = {
  rule: REVERSE_RULE,
  ex: [
    ["1 2 3", "3 2 1"],
    ["4 5 6", "6 5 4"],
  ],
  ch: [
    ["7 8 9", "9 8 7"],
    ["2 4 6", "6 4 2"],
  ],
};

const SORT_RULE = "It puts the chips in alphabetical order.";
const SORT_OP = "puts the chips in alphabetical order";
const WORD_MACHINE: Machine = {
  rule: SORT_RULE,
  ex: [
    ["dog ant", "ant dog"],
    ["sun owl", "owl sun"],
  ],
  ch: [
    ["cat bee", "bee cat"],
    ["fig ace", "ace fig"],
  ],
};

afterEach(cleanup);

/**
 * Selects the palette tab, applies the named operation, and feeds the resulting chips.
 * @param tab The label of the tab holding the operation.
 * @param operation The accessible name of the operation tile to apply.
 */
function applyAndFeed(tab: string, operation: string): void {
  fireEvent.click(screen.getByRole("tab", { name: tab }));
  fireEvent.click(screen.getByRole("button", { name: operation }));
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

  it("cracks a number machine when the right operation is applied twice", () => {
    const { container } = render(<App machines={[NUMBER_MACHINE]} />);
    applyAndFeed(REVERSE_TAB, REVERSE_OP);
    applyAndFeed(REVERSE_TAB, REVERSE_OP);
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + REVERSE_RULE);
  });

  it("cracks a word machine when the right operation is applied twice", () => {
    const { container } = render(<App machines={[WORD_MACHINE]} />);
    applyAndFeed(SORT_TAB, SORT_OP);
    applyAndFeed(SORT_TAB, SORT_OP);
    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + SORT_RULE);
  });
});
