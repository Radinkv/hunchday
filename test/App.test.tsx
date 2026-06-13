// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MACHINES } from "../src/game/machines";
import { COPY_FEED_BUTTON, COPY_INPUT_LABEL, COPY_RULE_CRACKED_LABEL, COPY_WORDMARK } from "../src/ui/constants";

/**
 * These tests cover the React interface end to end over the pure reducer. They confirm
 * the wordmark, the first machine, and its examples render, and that feeding two
 * correct answers cracks the machine and prints its rule. The machine set is supplied
 * as the prototype fixture so the assertions are deterministic.
 */

const FIRST_MACHINE = MACHINES[0];
const OUTPUT_FIELD = 1;

afterEach(cleanup);

describe("App", () => {
  it("renders the wordmark, the first machine, and its example chips", () => {
    render(<App machines={MACHINES} />);
    expect(screen.getByText(COPY_WORDMARK)).toBeTruthy();
    expect(screen.getByText("Machine 01")).toBeTruthy();
    expect(screen.getByText(/What comes out for/)).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("cracks the first machine when fed two correct answers in a row", () => {
    const { container } = render(<App machines={MACHINES} />);

    const submit = (answer: string): void => {
      fireEvent.change(screen.getByLabelText(COPY_INPUT_LABEL), { target: { value: answer } });
      fireEvent.click(screen.getByRole("button", { name: COPY_FEED_BUTTON }));
    };

    submit(FIRST_MACHINE.ch[0][OUTPUT_FIELD]);
    submit(FIRST_MACHINE.ch[1][OUTPUT_FIELD]);

    expect(container.textContent).toContain(COPY_RULE_CRACKED_LABEL + FIRST_MACHINE.rule);
  });
});
