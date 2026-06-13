import { useState, type ReactNode } from "react";
import { getOp } from "../engine/ops";
import type { Params } from "../engine/ops-types";
import {
  applyTrail,
  groupedTilesForType,
  parseChips,
  seedTypeOf,
  typeAfter,
  valueToChips,
  type OpTile,
  type Step,
} from "./palette";
import {
  CLASS_ADD_STEP,
  CLASS_BUILDER,
  CLASS_BUILDER_ACTIONS,
  CLASS_PICKER,
  CLASS_PICKER_GROUP,
  CLASS_PICKER_GROUP_LABEL,
  CLASS_PICKER_OP,
  CLASS_QUIET_BUTTON,
  CLASS_RECIPE,
  CLASS_RECIPE_EMPTY,
  CLASS_STEP,
  CLASS_STEP_NUM,
  CLASS_STEP_REMOVE,
  CLASS_STEP_TEXT,
  CLASS_STEPPER,
  CLASS_STEPPER_BUTTON,
  CLASS_TERMINAL_HINT,
  COPY_ADD_STEP,
  COPY_CLEAR,
  COPY_FEED_BUTTON,
  COPY_PARAM_DOWN,
  COPY_PARAM_DOWN_PREFIX,
  COPY_PARAM_UP,
  COPY_PARAM_UP_PREFIX,
  COPY_PICKER_LABEL,
  COPY_RECIPE_EMPTY,
  COPY_RECIPE_LABEL,
  COPY_REMOVE_FROM_PREFIX,
  COPY_STEP_REMOVE_GLYPH,
  COPY_TERMINAL_HINT,
} from "./constants";

/** The amount added to a zero based step index to show it as a human step number. */
const STEP_NUMBER_OFFSET = 1;

/** The amount a stepper press moves a step's parameter, in either direction. */
const PARAM_STEP = 1;

/** The separator joining a step's operation and index into a stable render key. */
const STEP_KEY_SEPARATOR = ":";

/** The empty trail folded over a seed when the recipe has no steps yet. */
const NO_STEPS: readonly Step[] = [];

/**
 * Returns the parameters a freshly added step starts with: its single parameter at the
 * low end of its range, or none when the operation takes no parameter.
 * @param tile The tile being added to the recipe.
 * @returns The starting bound parameters.
 */
function defaultParams(tile: OpTile): Params {
  return tile.param ? { [tile.param.name]: tile.param.min } : {};
}

/**
 * The recipe builder. The player proves they understand a machine by writing a recipe
 * for it: an ordered list of the machine's own operations, authored on faith without
 * seeing the chips transform. Only the operations valid for the recipe's running type
 * are offered, so an invalid step is impossible, and once the recipe reduces to a single
 * chip it is complete. Feeding folds the recipe over the current challenge input and
 * submits the result as the same string the reducer compares; nothing is computed on
 * screen until the machine gives its verdict. The recipe is owned by the caller's key,
 * so it persists across a machine's challenges and resets when the machine changes.
 * @param props The challenge input chips and the feed handler.
 */
export function ChipBuilder({
  challengeInput,
  onFeed,
}: {
  readonly challengeInput: string;
  readonly onFeed: (guess: string) => void;
}) {
  const [steps, setSteps] = useState<readonly Step[]>(NO_STEPS);
  const [pickerOpen, setPickerOpen] = useState(false);

  const runningType = typeAfter(seedTypeOf(parseChips(challengeInput)), steps);
  const groups = groupedTilesForType(runningType);
  const terminal = groups.length === 0;

  const addStep = (tile: OpTile): void => {
    setSteps([...steps, { opId: tile.opId, params: defaultParams(tile) }]);
    setPickerOpen(false);
  };
  const removeFrom = (index: number): void => {
    setSteps(steps.slice(0, index));
    setPickerOpen(false);
  };
  const adjustParam = (index: number, delta: number): void => {
    const spec = getOp(steps[index].opId).params.at(0);
    if (!spec) return;
    const current = steps[index].params[spec.name] ?? spec.min;
    const next = Math.max(spec.min, Math.min(spec.max, current + delta));
    setSteps(steps.map((step, at) => (at === index ? { opId: step.opId, params: { [spec.name]: next } } : step)));
  };
  const clear = (): void => {
    setSteps(NO_STEPS);
    setPickerOpen(false);
  };
  const feed = (): void => onFeed(valueToChips(applyTrail(parseChips(challengeInput), steps)).join(" "));

  const renderStep = (step: Step, index: number): ReactNode => {
    const op = getOp(step.opId);
    const spec = op.params.at(0);
    const stepNumber = index + STEP_NUMBER_OFFSET;
    return (
      <li key={step.opId + STEP_KEY_SEPARATOR + index} className={CLASS_STEP}>
        <span className={CLASS_STEP_NUM}>{stepNumber}</span>
        <span className={CLASS_STEP_TEXT}>{op.phrase(step.params)}</span>
        {spec ? (
          <span className={CLASS_STEPPER}>
            <button
              type="button"
              className={CLASS_STEPPER_BUTTON}
              aria-label={COPY_PARAM_DOWN_PREFIX + stepNumber}
              onClick={() => adjustParam(index, -PARAM_STEP)}
            >
              {COPY_PARAM_DOWN}
            </button>
            <button
              type="button"
              className={CLASS_STEPPER_BUTTON}
              aria-label={COPY_PARAM_UP_PREFIX + stepNumber}
              onClick={() => adjustParam(index, PARAM_STEP)}
            >
              {COPY_PARAM_UP}
            </button>
          </span>
        ) : null}
        <button
          type="button"
          className={CLASS_STEP_REMOVE}
          aria-label={COPY_REMOVE_FROM_PREFIX + stepNumber}
          onClick={() => removeFrom(index)}
        >
          {COPY_STEP_REMOVE_GLYPH}
        </button>
      </li>
    );
  };

  return (
    <div className={CLASS_BUILDER}>
      <ol className={CLASS_RECIPE} aria-label={COPY_RECIPE_LABEL} aria-live="polite">
        {steps.length === 0 ? <li className={CLASS_RECIPE_EMPTY}>{COPY_RECIPE_EMPTY}</li> : steps.map((element, index) => renderStep(element, index))}
      </ol>

      {terminal ? (
        <p className={CLASS_TERMINAL_HINT}>{COPY_TERMINAL_HINT}</p>
      ) : (
        <div>
          <button
            type="button"
            className={CLASS_ADD_STEP}
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(!pickerOpen)}
          >
            {COPY_ADD_STEP}
          </button>
          {pickerOpen ? (
            <fieldset className={CLASS_PICKER} aria-label={COPY_PICKER_LABEL}>
              {groups.map((tileGroup) => (
                <div key={tileGroup.group} className={CLASS_PICKER_GROUP}>
                  <span className={CLASS_PICKER_GROUP_LABEL}>{tileGroup.label}</span>
                  {tileGroup.tiles.map((tile) => (
                    <button key={tile.opId} type="button" className={CLASS_PICKER_OP} onClick={() => addStep(tile)}>
                      {getOp(tile.opId).phrase(defaultParams(tile))}
                    </button>
                  ))}
                </div>
              ))}
            </fieldset>
          ) : null}
        </div>
      )}

      <div className={CLASS_BUILDER_ACTIONS}>
        {steps.length > 0 ? (
          <button type="button" className={CLASS_QUIET_BUTTON} onClick={clear}>
            {COPY_CLEAR}
          </button>
        ) : null}
        <button type="button" onClick={feed}>
          {COPY_FEED_BUTTON}
        </button>
      </div>
    </div>
  );
}
