import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  CLASS_BUILDER_READY,
  CLASS_CHIP,
  CLASS_DRAG_GHOST,
  CLASS_PALETTE,
  CLASS_PALETTE_GROUP,
  CLASS_PARAM,
  CLASS_QUIET_BUTTON,
  CLASS_STEP_REMOVE,
  CLASS_TAB,
  CLASS_TAB_ACTIVE,
  CLASS_TABS,
  CLASS_TILE,
  CLASS_TRAIL,
  CLASS_TRAIL_EMPTY,
  CLASS_TRAIL_STEP,
  CLASS_TRAY,
  CLASS_TRAY_DROP,
  COPY_BUILDER_READY,
  COPY_CYCLE_PARAM_PREFIX,
  COPY_FEED_BUTTON,
  COPY_OPERATIONS_LABEL,
  COPY_REMOVE_STEP_PREFIX,
  COPY_RESET,
  COPY_TRAIL_EMPTY,
  COPY_TRAIL_LABEL,
  COPY_TRAY_LABEL,
} from "./constants";

/** The glyph shown on the button that removes a step from the trail. */
const REMOVE_GLYPH = "✕";

/** The distance in pixels a pointer must move on a tile before it counts as a drag. */
const DRAG_THRESHOLD_PX = 8;

/** A tile being dragged, with the pointer position the ghost follows. */
interface DragState {
  readonly tile: OpTile;
  readonly x: number;
  readonly y: number;
}

/** The in progress press on a tile, tracked until it becomes a tap or a drag. */
interface PressState {
  readonly tile: OpTile;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

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
 * The label shown on a tile: its short label, with its starting parameter appended when
 * it has one.
 * @param tile The tile to label.
 * @returns The tile label text.
 */
function tileLabel(tile: OpTile): string {
  return tile.param ? tile.shortLabel + " " + tile.param.min : tile.shortLabel;
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
 * Reports whether a point lies within a rectangle, used to test a drop onto the tray.
 * @param x The point x coordinate.
 * @param y The point y coordinate.
 * @param rect The rectangle to test against.
 * @returns True when the point is inside the rectangle.
 */
function isWithin(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * The answer builder. The player applies operations to the question's chips and watches
 * them transform; the resulting chips are the prediction. Operations are grouped into
 * tabs so one group shows at a time, each can be tapped or dragged onto the chips, the
 * applied trail can be cycled or rewound, and feeding submits the transformed chips as
 * the same string the reducer compares.
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
  const [activeGroup, setActiveGroup] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const press = useRef<PressState | null>(null);
  const suppressClick = useRef(false);

  const seed = useMemo(() => parseChips(challengeInput), [challengeInput]);
  const seedType = useMemo(() => seedTypeOf(seed), [seed]);
  const currentType = typeAfter(seedType, steps);
  const chips = valueToChips(applyTrail(seed, steps));
  const chipCells = chips.map((value, index) => ({ value, key: index + ":" + value }));
  const groups = groupedTilesForType(currentType);
  const activeGroupId = groups.some((tileGroup) => tileGroup.group === activeGroup)
    ? activeGroup
    : (groups.at(0)?.group ?? "");
  const activeTiles = groups.find((tileGroup) => tileGroup.group === activeGroupId)?.tiles ?? [];

  const apply = (tile: OpTile): void => {
    setSteps([...steps, { opId: tile.opId, params: initialParams(tile) }]);
  };
  const cycle = (index: number): void => {
    setSteps(steps.map((appliedStep, i) => (i === index ? cycledStep(appliedStep) : appliedStep)));
  };
  const rewindTo = (index: number): void => setSteps(steps.slice(0, index));
  const reset = (): void => setSteps([]);
  const feed = (): void => onFeed(chips.join(" "));

  const onTileClick = (tile: OpTile): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    apply(tile);
  };
  const onTilePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, tile: OpTile): void => {
    suppressClick.current = false;
    press.current = { tile, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  };
  const onTilePointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.moved && distance < DRAG_THRESHOLD_PX) return;
    if (!current.moved) {
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag({ tile: current.tile, x: event.clientX, y: event.clientY });
  };
  const onTilePointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const current = press.current;
    press.current = null;
    setDrag(null);
    if (!current || current.pointerId !== event.pointerId || !current.moved) return;
    suppressClick.current = true;
    const tray = trayRef.current;
    if (tray && isWithin(event.clientX, event.clientY, tray.getBoundingClientRect())) apply(current.tile);
  };

  return (
    <div className={CLASS_BUILDER}>
      <div
        ref={trayRef}
        className={CLASS_TRAY + (drag ? " " + CLASS_TRAY_DROP : "")}
        aria-label={COPY_TRAY_LABEL}
        aria-live="polite"
      >
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

      {groups.length === 0 ? (
        <p className={CLASS_BUILDER_READY}>{COPY_BUILDER_READY}</p>
      ) : (
        <div className={CLASS_PALETTE}>
          <div className={CLASS_TABS} role="tablist" aria-label={COPY_OPERATIONS_LABEL}>
            {groups.map((tileGroup) => (
              <button
                key={tileGroup.group}
                type="button"
                role="tab"
                aria-selected={tileGroup.group === activeGroupId}
                className={CLASS_TAB + (tileGroup.group === activeGroupId ? " " + CLASS_TAB_ACTIVE : "")}
                onClick={() => setActiveGroup(tileGroup.group)}
              >
                {tileGroup.label}
              </button>
            ))}
          </div>
          <div className={CLASS_PALETTE_GROUP} role="tabpanel">
            {activeTiles.map((tile) => (
              <button
                key={tile.opId}
                type="button"
                className={CLASS_TILE}
                aria-label={getOp(tile.opId).phrase(initialParams(tile))}
                onClick={() => onTileClick(tile)}
                onPointerDown={(event) => onTilePointerDown(event, tile)}
                onPointerMove={onTilePointerMove}
                onPointerUp={onTilePointerUp}
              >
                {tileLabel(tile)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={CLASS_BUILDER_ACTIONS}>
        <button type="button" className={CLASS_QUIET_BUTTON} onClick={reset} disabled={steps.length === 0}>
          {COPY_RESET}
        </button>
        <button type="button" onClick={feed}>
          {COPY_FEED_BUTTON}
        </button>
      </div>

      {drag ? (
        <div
          className={CLASS_DRAG_GHOST}
          aria-hidden="true"
          style={{ transform: "translate(" + drag.x + "px, " + drag.y + "px) translate(-50%, -50%)" }}
        >
          {tileLabel(drag.tile)}
        </div>
      ) : null}
    </div>
  );
}
