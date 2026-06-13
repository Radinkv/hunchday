import { useMemo, useState } from "react";
import { getOp } from "../engine/ops";
import type { Params } from "../engine/ops-types";
import {
  applyTrail,
  groupedTilesForType,
  parseChips,
  seedTypeOf,
  tileOf,
  typeAfter,
  valueToChips,
  type OpTile,
  type Step,
} from "./palette";
import {
  CLASS_BUILDER,
  CLASS_BUILDER_ACTIONS,
  CLASS_CHIP,
  CLASS_PALETTE,
  CLASS_PALETTE_GROUP,
  CLASS_PALETTE_LABEL,
  CLASS_PARAM,
  CLASS_QUIET_BUTTON,
  CLASS_STEP_REMOVE,
  CLASS_TILE,
  CLASS_TRAIL,
  CLASS_TRAIL_EMPTY,
  CLASS_TRAIL_STEP,
  CLASS_TRAY,
  COPY_CYCLE_PARAM_PREFIX,
  COPY_FEED_BUTTON,
  COPY_REMOVE_STEP_PREFIX,
  COPY_RESET,
  COPY_TRAIL_EMPTY,
  COPY_TRAIL_LABEL,
  COPY_TRAY_LABEL,
} from "./constants";

/** The glyph shown on the button that removes a step from the trail. */
const REMOVE_GLYPH = "✕";

/**
 * Builds the initial parameters for a freshly applied tile: its single parameter at the
 * low end of its range, or none when the operation takes no parameter.
 * @param tile The tile being applied.
 * @returns The initial bound parameters.
 */
function initialParams(tile: OpTile): Params {
  return tile.param ? { [tile.param.name]: tile.param.min } : {};
}

/**
 * Cycles a step's single parameter to the next value in its range, wrapping back to the
 * low end past the top, leaving the step unchanged when it has no parameter.
 * @param appliedStep The step whose parameter is cycled.
 * @returns The step with its parameter advanced.
 */
function cycledStep(appliedStep: Step): Step {
  const spec = getOp(appliedStep.opId).params.at(0);
  if (!spec) return appliedStep;
  const current = appliedStep.params[spec.name];
  const next = current >= spec.max ? spec.min : current + 1;
  return { opId: appliedStep.opId, params: { [spec.name]: next } };
}

/**
 * The answer builder. The player applies operations to the question's chips and watches
 * them transform; the resulting chips are the prediction. The chips start from the
 * challenge input, every applied operation is recorded in a trail that can be cycled or
 * rewound, and feeding submits the transformed chips as the same string the reducer
 * compares.
 * @param props The challenge input chips and the feed handler.
 */
export function ChipBuilder({
  challengeInput,
  onFeed,
}: {
  readonly challengeInput: string;
  readonly onFeed: (guess: string) => void;
}) {
  const [steps, setSteps] = useState<readonly Step[]>([]);

  const seed = useMemo(() => parseChips(challengeInput), [challengeInput]);
  const seedType = useMemo(() => seedTypeOf(seed), [seed]);
  const currentType = typeAfter(seedType, steps);
  const chips = valueToChips(applyTrail(seed, steps));
  const chipCells = chips.map((value, index) => ({ value, key: index + ":" + value }));
  const groups = groupedTilesForType(currentType);

  const apply = (tile: OpTile): void => {
    setSteps([...steps, { opId: tile.opId, params: initialParams(tile) }]);
  };
  const cycle = (index: number): void => {
    setSteps(steps.map((appliedStep, i) => (i === index ? cycledStep(appliedStep) : appliedStep)));
  };
  const rewindTo = (index: number): void => setSteps(steps.slice(0, index));
  const reset = (): void => setSteps([]);
  const feed = (): void => onFeed(chips.join(" "));

  return (
    <div className={CLASS_BUILDER}>
      <div className={CLASS_TRAY} aria-label={COPY_TRAY_LABEL} aria-live="polite">
        {chipCells.map((cell) => (
          <span key={cell.key} className={CLASS_CHIP} aria-label={cell.value}>
            {cell.value}
          </span>
        ))}
      </div>

      <div className={CLASS_TRAIL} aria-label={COPY_TRAIL_LABEL}>
        {steps.length === 0 ? (
          <span className={CLASS_TRAIL_EMPTY}>{COPY_TRAIL_EMPTY}</span>
        ) : (
          steps.map((appliedStep, index) => {
            const label = tileOf(appliedStep.opId)?.shortLabel ?? appliedStep.opId;
            const spec = getOp(appliedStep.opId).params.at(0);
            const phrase = getOp(appliedStep.opId).phrase(appliedStep.params);
            return (
              <span key={appliedStep.opId + "-" + index} className={CLASS_TRAIL_STEP}>
                {label}
                {spec ? (
                  <button
                    type="button"
                    className={CLASS_PARAM}
                    aria-label={COPY_CYCLE_PARAM_PREFIX + phrase}
                    onClick={() => cycle(index)}
                  >
                    {appliedStep.params[spec.name]}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={CLASS_STEP_REMOVE}
                  aria-label={COPY_REMOVE_STEP_PREFIX + phrase}
                  onClick={() => rewindTo(index)}
                >
                  {REMOVE_GLYPH}
                </button>
              </span>
            );
          })
        )}
      </div>

      <div className={CLASS_PALETTE}>
        {groups.map((tileGroup) => (
          <div key={tileGroup.group} className={CLASS_PALETTE_GROUP}>
            <span className={CLASS_PALETTE_LABEL}>{tileGroup.label}</span>
            {tileGroup.tiles.map((tile) => (
              <button
                key={tile.opId}
                type="button"
                className={CLASS_TILE}
                aria-label={getOp(tile.opId).phrase(initialParams(tile))}
                onClick={() => apply(tile)}
              >
                {tile.shortLabel}
                {tile.param ? " " + tile.param.min : ""}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className={CLASS_BUILDER_ACTIONS}>
        <button type="button" className={CLASS_QUIET_BUTTON} onClick={reset} disabled={steps.length === 0}>
          {COPY_RESET}
        </button>
        <button type="button" onClick={feed}>
          {COPY_FEED_BUTTON}
        </button>
      </div>
    </div>
  );
}
