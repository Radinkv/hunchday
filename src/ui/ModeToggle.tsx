import { Fragment } from "react";
import {
  CLASS_MODE_ACTIVE,
  CLASS_MODE_DIVIDER,
  CLASS_MODE_OPTION,
  CLASS_MODE_TOGGLE,
  COPY_MODE_DIVIDER,
  COPY_MODE_GUESS,
  COPY_MODE_RECIPE,
  COPY_MODE_TEST,
  MODE_GUESS,
  MODE_RECIPE,
  MODE_TEST,
  type Mode,
} from "./constants";

/** The label shown on each mode tab, keyed by mode. */
const MODE_LABEL: Readonly<Record<Mode, string>> = {
  [MODE_TEST]: COPY_MODE_TEST,
  [MODE_GUESS]: COPY_MODE_GUESS,
  [MODE_RECIPE]: COPY_MODE_RECIPE,
};

/** The tab order with and without the test bench, which appears only when steps are known. */
const MODES_WITH_TEST: readonly Mode[] = [MODE_TEST, MODE_GUESS, MODE_RECIPE];
const MODES_WITHOUT_TEST: readonly Mode[] = [MODE_GUESS, MODE_RECIPE];

/**
 * Returns the modes the toggle offers. The test bench appears only when the machine's steps are
 * known, so a machine without steps offers just Guess and Recipe.
 * @param hasSteps Whether the machine carries its pipeline steps.
 * @returns The available modes in tab order.
 */
export function modesForSteps(hasSteps: boolean): readonly Mode[] {
  return hasSteps ? MODES_WITH_TEST : MODES_WITHOUT_TEST;
}

/**
 * The borderless mode toggle, a standalone bar centered at the bottom of the play area below both
 * the input widget and the evidence. The available words are split by dividers, the active one
 * carried in the machine accent and the rest quiet, with no outline, pill, or background of its
 * own. It is detached from the input column so switching modes never shifts it.
 * @param props The available modes, the active mode, and the handler that selects a mode.
 */
export function ModeToggle({
  modes,
  mode,
  onSelect,
}: {
  readonly modes: readonly Mode[];
  readonly mode: Mode;
  readonly onSelect: (mode: Mode) => void;
}) {
  return (
    <div className={CLASS_MODE_TOGGLE} role="tablist">
      {modes.map((option, index) => (
        <Fragment key={option}>
          {index > 0 ? (
            <span className={CLASS_MODE_DIVIDER} aria-hidden="true">
              {COPY_MODE_DIVIDER}
            </span>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={mode === option}
            className={CLASS_MODE_OPTION + (mode === option ? " " + CLASS_MODE_ACTIVE : "")}
            onClick={() => onSelect(option)}
          >
            {MODE_LABEL[option]}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
