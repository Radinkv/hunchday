import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { getOp } from "../engine/ops";
import type { Params } from "../engine/ops-types";
import {
  answerOf,
  applyOp,
  bringBack,
  reorder,
  seedChips,
  setAside,
  workType,
  type Chip,
  type ChipState,
} from "./chips";
import { groupedTilesForType, type OpTile } from "./palette";
import {
  CLASS_BUCKET,
  CLASS_BUCKET_EMPTY,
  CLASS_BUILDER,
  CLASS_BUILDER_ACTIONS,
  CLASS_CHIP,
  CLASS_DRAG_GHOST,
  CLASS_LANE,
  CLASS_LANE_DROP,
  CLASS_LANE_LABEL,
  CLASS_PALETTE,
  CLASS_PALETTE_GROUP,
  CLASS_PARAM,
  CLASS_QUIET_BUTTON,
  CLASS_TAB,
  CLASS_TAB_ACTIVE,
  CLASS_TABS,
  CLASS_TILE,
  CLASS_TILE_WRAP,
  CLASS_WORK,
  COPY_BUCKET_EMPTY,
  COPY_BUCKET_LABEL,
  COPY_CYCLE_PARAM_PREFIX,
  COPY_FEED_BUTTON,
  COPY_OPERATIONS_LABEL,
  COPY_PUT_BACK_SUFFIX,
  COPY_RESET,
  COPY_SET_ASIDE_SUFFIX,
  COPY_UNDO,
  COPY_WORK_LABEL,
} from "./constants";

/** The lane a press or drop concerns. */
const LANE_WORK = "work";
const LANE_BUCKET = "bucket";
type Lane = typeof LANE_WORK | typeof LANE_BUCKET;

/** The distance in pixels a pointer must move on an element before it counts as a drag. */
const DRAG_THRESHOLD_PX = 8;

/** The kinds of thing that can be dragged. */
const PRESS_TILE = "tile";
const PRESS_CHIP = "chip";

/** An in progress press, tracked until it becomes a tap or a drag. */
interface PressState {
  readonly kind: typeof PRESS_TILE | typeof PRESS_CHIP;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly label: string;
  readonly tile?: OpTile;
  readonly chipId?: number;
  readonly from?: Lane;
  moved: boolean;
}

/** The floating ghost shown while dragging, following the pointer. */
interface DragState {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly over: Lane | null;
}

/**
 * Returns the bound parameters a tile applies with: its pending value, defaulting to the
 * low end of its range, or none when the operation takes no parameter.
 * @param tile The tile being applied.
 * @param pending The pending parameter values keyed by operation.
 * @returns The bound parameters.
 */
function tileParams(tile: OpTile, pending: Readonly<Record<string, number>>): Params {
  if (!tile.param) return {};
  return { [tile.param.name]: pending[tile.opId] ?? tile.param.min };
}

/**
 * Reports whether a point lies within the bounding rectangle of an element.
 * @param element The element, or null.
 * @param x The point x coordinate.
 * @param y The point y coordinate.
 * @returns True when the element exists and the point is inside it.
 */
function isWithin(element: HTMLElement | null, x: number, y: number): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Computes the position a chip should be inserted at within a lane from the pointer
 * location, by counting the chips that read before the pointer and skipping the chip
 * being dragged.
 * @param container The lane chip container, or null.
 * @param x The pointer x coordinate.
 * @param y The pointer y coordinate.
 * @param draggedId The id of the chip being dragged.
 * @returns The insertion index.
 */
function insertionIndex(container: HTMLElement | null, x: number, y: number, draggedId: number): number {
  if (!container) return 0;
  let index = 0;
  for (const element of container.querySelectorAll<HTMLElement>("[data-chip-id]")) {
    if (Number(element.dataset.chipId) === draggedId) continue;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const before = centerY < y - rect.height / 2 || (Math.abs(centerY - y) <= rect.height / 2 && centerX < x);
    if (before) index++;
  }
  return index;
}

/**
 * The answer builder. The player reshapes the question's chips into a prediction by
 * applying transformation tiles and by moving chips between the work lane and the set
 * aside lane. Tiles act only on the work lane, so a set aside chip is frozen until it is
 * brought back. A chip is moved by tapping it to swap lanes or by dragging it for a
 * precise position, every action can be undone or reset, and feeding submits the work
 * lane as the same string the reducer compares.
 * @param props The challenge input chips and the feed handler.
 */
export function ChipBuilder({
  challengeInput,
  onFeed,
}: {
  readonly challengeInput: string;
  readonly onFeed: (guess: string) => void;
}) {
  const [state, setState] = useState<ChipState>(() => seedChips(challengeInput));
  const [history, setHistory] = useState<readonly ChipState[]>([]);
  const [pending, setPending] = useState<Readonly<Record<string, number>>>({});
  const [activeGroup, setActiveGroup] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const workRef = useRef<HTMLDivElement>(null);
  const bucketRef = useRef<HTMLDivElement>(null);
  const press = useRef<PressState | null>(null);
  const suppressClick = useRef(false);

  const groups = groupedTilesForType(workType(state));
  const activeGroupId = groups.some((tileGroup) => tileGroup.group === activeGroup)
    ? activeGroup
    : (groups.at(0)?.group ?? "");
  const activeTiles = groups.find((tileGroup) => tileGroup.group === activeGroupId)?.tiles ?? [];

  const act = (next: ChipState): void => {
    setHistory([...history, state]);
    setState(next);
  };
  const undo = (): void => {
    const previous = history.at(-1);
    if (!previous) return;
    setState(previous);
    setHistory(history.slice(0, -1));
  };
  const reset = (): void => {
    setState(seedChips(challengeInput));
    setHistory([]);
  };
  const feed = (): void => onFeed(answerOf(state));

  const tookAction = history.length > 0;

  const applyTile = (tile: OpTile): void => act(applyOp(state, tile.opId, tileParams(tile, pending)));
  const cyclePending = (tile: OpTile): void => {
    const spec = tile.param;
    if (!spec) return;
    const current = pending[tile.opId] ?? spec.min;
    const next = current >= spec.max ? spec.min : current + 1;
    setPending({ ...pending, [tile.opId]: next });
  };

  const startPress = (event: ReactPointerEvent<HTMLButtonElement>, partial: Omit<PressState, "pointerId" | "startX" | "startY" | "moved">): void => {
    suppressClick.current = false;
    press.current = { ...partial, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  };
  const movePress = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.moved && distance < DRAG_THRESHOLD_PX) return;
    if (!current.moved) {
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    let over: Lane | null = null;
    if (isWithin(workRef.current, event.clientX, event.clientY)) over = LANE_WORK;
    else if (isWithin(bucketRef.current, event.clientX, event.clientY)) over = LANE_BUCKET;
    setDrag({ label: current.label, x: event.clientX, y: event.clientY, over });
  };
  const endPress = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const current = press.current;
    press.current = null;
    setDrag(null);
    if (!current || current.pointerId !== event.pointerId || !current.moved) return;
    suppressClick.current = true;
    const x = event.clientX;
    const y = event.clientY;
    const overWork = isWithin(workRef.current, x, y);
    const overBucket = isWithin(bucketRef.current, x, y);
    if (current.kind === PRESS_TILE && current.tile && overWork) {
      applyTile(current.tile);
      return;
    }
    const chipId = current.chipId;
    if (current.kind !== PRESS_CHIP || chipId === undefined) return;
    if (current.from === LANE_WORK && overBucket) act(setAside(state, chipId));
    else if (current.from === LANE_WORK && overWork) act(reorder(state, chipId, insertionIndex(workRef.current, x, y, chipId)));
    else if (current.from === LANE_BUCKET && overWork) act(bringBack(state, chipId, insertionIndex(workRef.current, x, y, chipId)));
  };

  const onChipClick = (chip: Chip, from: Lane): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (from === LANE_WORK) act(setAside(state, chip.id));
    else act(bringBack(state, chip.id, state.work.length));
  };
  const onTileClick = (tile: OpTile): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    applyTile(tile);
  };

  const renderChip = (chip: Chip, from: Lane): ReactNode => (
    <button
      key={chip.id}
      type="button"
      data-chip-id={chip.id}
      className={CLASS_CHIP}
      aria-label={String(chip.value) + (from === LANE_WORK ? COPY_SET_ASIDE_SUFFIX : COPY_PUT_BACK_SUFFIX)}
      onClick={() => onChipClick(chip, from)}
      onPointerDown={(event) => startPress(event, { kind: PRESS_CHIP, label: String(chip.value), chipId: chip.id, from })}
      onPointerMove={movePress}
      onPointerUp={endPress}
    >
      {String(chip.value)}
    </button>
  );

  return (
    <div className={CLASS_BUILDER}>
      <div className={CLASS_LANE + " " + CLASS_WORK + (drag?.over === LANE_WORK ? " " + CLASS_LANE_DROP : "")}>
        <span className={CLASS_LANE_LABEL}>{COPY_WORK_LABEL}</span>
        <div ref={workRef} className={CLASS_WORK} aria-label={COPY_WORK_LABEL} aria-live="polite">
          {state.work.map((chip) => renderChip(chip, LANE_WORK))}
        </div>
      </div>

      <div className={CLASS_LANE + " " + CLASS_BUCKET + (drag?.over === LANE_BUCKET ? " " + CLASS_LANE_DROP : "")}>
        <span className={CLASS_LANE_LABEL}>{COPY_BUCKET_LABEL}</span>
        <div ref={bucketRef} className={CLASS_BUCKET} aria-label={COPY_BUCKET_LABEL}>
          {state.bucket.length === 0 ? (
            <span className={CLASS_BUCKET_EMPTY}>{COPY_BUCKET_EMPTY}</span>
          ) : (
            state.bucket.map((chip) => renderChip(chip, LANE_BUCKET))
          )}
        </div>
      </div>

      {groups.length > 0 ? (
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
            {activeTiles.map((tile) => {
              const tileButton = (
                <button
                  type="button"
                  className={CLASS_TILE}
                  aria-label={getOp(tile.opId).phrase(tileParams(tile, pending))}
                  onClick={() => onTileClick(tile)}
                  onPointerDown={(event) => startPress(event, { kind: PRESS_TILE, label: tile.shortLabel, tile })}
                  onPointerMove={movePress}
                  onPointerUp={endPress}
                >
                  {tile.shortLabel}
                </button>
              );
              if (!tile.param) return <span key={tile.opId}>{tileButton}</span>;
              return (
                <span key={tile.opId} className={CLASS_TILE_WRAP}>
                  {tileButton}
                  <button
                    type="button"
                    className={CLASS_PARAM}
                    aria-label={COPY_CYCLE_PARAM_PREFIX + getOp(tile.opId).phrase(tileParams(tile, pending))}
                    onClick={() => cyclePending(tile)}
                  >
                    {pending[tile.opId] ?? tile.param.min}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={CLASS_BUILDER_ACTIONS}>
        <button type="button" className={CLASS_QUIET_BUTTON} onClick={undo} disabled={!tookAction}>
          {COPY_UNDO}
        </button>
        <button type="button" className={CLASS_QUIET_BUTTON} onClick={reset} disabled={!tookAction}>
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
          {drag.label}
        </div>
      ) : null}
    </div>
  );
}
