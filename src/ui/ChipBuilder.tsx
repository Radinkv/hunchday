import { useState, type ReactNode } from "react";
import { getOp } from "../engine/ops";
import type { OpDef, Params, ParamSpec } from "../engine/ops-types";
import {
  applyTrail,
  groupedTilesForType,
  listTypeOf,
  parseChips,
  searchTiles,
  seedTypeOf,
  typeAfter,
  valueToChips,
  type OpTile,
  type Step,
} from "./palette";
import {
  CLASS_BOTTOM,
  CLASS_BUILDER,
  CLASS_CLEAR,
  CLASS_FEED,
  CLASS_FOLDER_ICON,
  CLASS_NO_MATCHES,
  CLASS_NUM_TAG,
  CLASS_PAGE,
  CLASS_PICKER,
  CLASS_PICKER_OP,
  CLASS_RECIPE,
  CLASS_RECIPE_EMPTY,
  CLASS_RECIPE_HEAD,
  CLASS_RECIPE_HEAD_LABEL,
  CLASS_SEARCH,
  CLASS_STEP,
  CLASS_STEP_NUM,
  CLASS_STEP_REMOVE,
  CLASS_STEP_TEXT,
  CLASS_TAB,
  CLASS_TAB_ACTIVE,
  CLASS_TABS,
  COPY_CLEAR,
  COPY_FEED_BUTTON,
  COPY_NO_MATCHES,
  COPY_NUMBER_TAG_PREFIX,
  COPY_PICKER_LABEL,
  COPY_RECIPE_EMPTY,
  COPY_RECIPE_LABEL,
  COPY_REMOVE_FROM_PREFIX,
  COPY_SEARCH_LABEL,
  COPY_SEARCH_PLACEHOLDER,
  COPY_STEP_REMOVE_GLYPH,
} from "./constants";

/** The amount added to a zero based step index to show it as a human step number. */
const STEP_NUMBER_OFFSET = 1;

/** The separator joining a step's operation and index into a stable render key. */
const STEP_KEY_SEPARATOR = ":";

/** The index a substring search returns when the value is not found in a phrase. */
const NOT_FOUND = -1;

/** The empty trail folded over a seed when the recipe has no steps yet. */
const NO_STEPS: readonly Step[] = [];

/** The empty result list used while the search box is blank. */
const NO_TILES: readonly OpTile[] = [];

/** The active tab value meaning every folder is collapsed. */
const NO_TAB = "";

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
 * Renders an operation phrase with its number shown as a circular tag in place, so the
 * number reads as something set apart and changeable rather than fixed prose.
 * @param phrase The full operation phrase.
 * @param valueText The number as it appears in the phrase.
 * @param tag The circular tag element to drop in where the number is.
 * @returns The phrase with the tag spliced in.
 */
function withTag(phrase: string, valueText: string, tag: ReactNode): ReactNode {
  const at = phrase.indexOf(valueText);
  if (at === NOT_FOUND) {
    return (
      <>
        {phrase} {tag}
      </>
    );
  }
  return (
    <>
      {phrase.slice(0, at)}
      {tag}
      {phrase.slice(at + valueText.length)}
    </>
  );
}

/** A small folder glyph that gives the operations drawer its machine manual feel. */
function FolderIcon() {
  return (
    <svg className={CLASS_FOLDER_ICON} width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
      <path
        d="M1 3.5A1.5 1.5 0 0 1 2.5 2h4l1.5 1.6h6.5A1.5 1.5 0 0 1 16 5.1v8.4A1.5 1.5 0 0 1 14.5 15h-12A1.5 1.5 0 0 1 1 13.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The recipe builder. The player proves they understand a machine by writing a recipe
 * for it: an ordered list of the machine's own operations in plain English, authored on
 * faith without seeing the chips transform. Operations are filed into tabs the player
 * flips between like the headings of a short manual, only the tabs valid for the running
 * type are shown, and once the recipe reduces to a single chip it is complete. A step's
 * number, and the same number in the menu, shows as a small circular tag, so it reads as
 * changeable; tapping the tag on a step cycles it. Feeding folds the recipe over the
 * current challenge input and submits the result as the same string the reducer
 * compares; nothing is computed on screen until the machine gives its verdict. The
 * recipe is owned by the caller's key, so it persists across a machine's challenges and
 * resets when the machine changes.
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
  const [activeTab, setActiveTab] = useState(NO_TAB);
  const [query, setQuery] = useState("");

  const seedType = seedTypeOf(parseChips(challengeInput));
  const pickerType = listTypeOf(typeAfter(seedType, steps));
  const tabs = groupedTilesForType(pickerType);
  const activeFolder = tabs.find((tab) => tab.group === activeTab);
  const searching = query.trim().length > 0;
  const results = searching ? searchTiles(pickerType, query) : NO_TILES;

  const addStep = (tile: OpTile): void => {
    setSteps([...steps, { opId: tile.opId, params: defaultParams(tile) }]);
    setQuery("");
  };
  const removeFrom = (index: number): void => setSteps(steps.slice(0, index));
  const cycleParam = (index: number): void => {
    const spec = getOp(steps[index].opId).params.at(0);
    if (!spec) return;
    const current = steps[index].params[spec.name] ?? spec.min;
    const next = current >= spec.max ? spec.min : current + 1;
    setSteps(steps.map((step, at) => (at === index ? { opId: step.opId, params: { [spec.name]: next } } : step)));
  };
  const clear = (): void => setSteps(NO_STEPS);
  const feed = (): void => onFeed(valueToChips(applyTrail(parseChips(challengeInput), steps)).join(" "));

  const stepContent = (op: OpDef, step: Step, index: number, spec: ParamSpec): ReactNode => {
    const value = step.params[spec.name] ?? spec.min;
    const tag = (
      <button
        type="button"
        className={CLASS_NUM_TAG}
        aria-label={COPY_NUMBER_TAG_PREFIX + (index + STEP_NUMBER_OFFSET)}
        onClick={() => cycleParam(index)}
      >
        {value}
      </button>
    );
    return withTag(op.phrase(step.params), String(value), tag);
  };

  const menuContent = (tile: OpTile): ReactNode => {
    const op = getOp(tile.opId);
    const params = defaultParams(tile);
    if (!tile.param) return op.phrase(params);
    const value = params[tile.param.name];
    const tag = <span className={CLASS_NUM_TAG}>{value}</span>;
    return withTag(op.phrase(params), String(value), tag);
  };

  const renderOp = (tile: OpTile): ReactNode => (
    <li key={tile.opId}>
      <button type="button" className={CLASS_PICKER_OP} onClick={() => addStep(tile)}>
        {menuContent(tile)}
      </button>
    </li>
  );

  const renderStep = (step: Step, index: number): ReactNode => {
    const op = getOp(step.opId);
    const spec = op.params.at(0);
    const stepNumber = index + STEP_NUMBER_OFFSET;
    return (
      <li key={step.opId + STEP_KEY_SEPARATOR + index} className={CLASS_STEP}>
        <span className={CLASS_STEP_NUM} aria-hidden="true">
          {stepNumber}
        </span>
        <span className={CLASS_STEP_TEXT}>{spec ? stepContent(op, step, index, spec) : op.phrase(step.params)}</span>
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
    <div className={CLASS_BUILDER + " " + CLASS_BOTTOM}>
      {steps.length > 0 ? (
        <div className={CLASS_RECIPE_HEAD}>
          <span className={CLASS_RECIPE_HEAD_LABEL}>{COPY_RECIPE_LABEL}</span>
          <button type="button" className={CLASS_CLEAR} onClick={clear}>
            {COPY_CLEAR}
          </button>
        </div>
      ) : null}
      <ol className={CLASS_RECIPE} aria-label={COPY_RECIPE_LABEL} aria-live="polite">
        {steps.length === 0 ? <li className={CLASS_RECIPE_EMPTY}>{COPY_RECIPE_EMPTY}</li> : steps.map((element, index) => renderStep(element, index))}
      </ol>

      <div className={CLASS_PICKER} aria-label={COPY_PICKER_LABEL}>
        <input
          type="search"
          className={CLASS_SEARCH}
          value={query}
          aria-label={COPY_SEARCH_LABEL}
          placeholder={COPY_SEARCH_PLACEHOLDER}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? (
          (() => {
            if (results.length > 0) {
              return <ul className={CLASS_PAGE}>{results.map(renderOp)}</ul>;
            }
            return <p className={CLASS_NO_MATCHES}>{COPY_NO_MATCHES}</p>;
          })()
        ) : (
          <>
            <div className={CLASS_TABS} role="tablist">
              <FolderIcon />
              {tabs.map((tab) => (
                <button
                  key={tab.group}
                  type="button"
                  role="tab"
                  aria-selected={tab.group === activeTab}
                  className={CLASS_TAB + (tab.group === activeTab ? " " + CLASS_TAB_ACTIVE : "")}
                  onClick={() => setActiveTab(activeTab === tab.group ? NO_TAB : tab.group)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {(() => {
              if (activeFolder) {
                return (
                  <ul className={CLASS_PAGE} role="tabpanel">
                    {activeFolder.tiles.map(renderOp)}
                  </ul>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      <button type="button" className={CLASS_FEED} onClick={feed}>
        {COPY_FEED_BUTTON}
      </button>
    </div>
  );
}
