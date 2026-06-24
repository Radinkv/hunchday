import { useEffect, useState, type ReactNode } from "react";
import { getOp } from "../engine/ops";
import type { OpDef, Params, ParamSpec } from "../engine/ops-types";
import { chipsEqual } from "../game/reducer";
import { SUBMISSION_RECIPE, type ChipPair, type Submission } from "../game/types";
import { MissPips } from "./Pips";
import {
  applyTrail,
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
  CLASS_BUILDER,
  CLASS_CLEAR,
  CLASS_FEED,
  CLASS_NO_MATCHES,
  CLASS_NUM_TAG,
  CLASS_PAGE,
  CLASS_PICKER,
  CLASS_PICKER_OP,
  CLASS_RECIPE,
  CLASS_RECIPE_HEAD,
  CLASS_RECIPE_HEAD_LABEL,
  CLASS_SEARCH,
  CLASS_STEP,
  CLASS_STEP_NUM,
  CLASS_STEP_REMOVE,
  CLASS_STEP_TEXT,
  COPY_CLEAR,
  COPY_FEED_BUTTON,
  COPY_NO_MATCHES,
  COPY_NUMBER_TAG_PREFIX,
  COPY_PICKER_LABEL,
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

/**
 * The recipe builder, the Recipe mode input. The player proves they understand a machine
 * by writing a recipe for it: an ordered list of the machine's own operations in plain
 * English, authored on faith without seeing the chips transform. Operations are found only
 * by searching in words over the machine's own restricted panel set, so the fairness
 * boundary holds and no browsable list or tabbed folder is shown. Only operations valid
 * for the recipe's running type can match, and once the recipe reduces to a single chip the
 * next operation still applies to it as a one item list. A step's number shows as a small
 * circular tag, so it reads as changeable; tapping the tag cycles it. Feeding folds the
 * recipe over every example input and reports whether it reproduces them all, so a recipe
 * that fits every example cracks the machine on a single submission; nothing is computed on
 * screen until the machine gives its verdict. The recipe is folded over the machine's full
 * generated truth set, not only the one example shown, so a recipe cracks only when it
 * reproduces the real rule rather than the single visible pair. The recipe is seeded from and
 * synced back to the caller, so it survives switching modes and a machine's challenges, and
 * resets only when the machine changes.
 * @param props The challenge input, the full truth set to check against, the panel operations, the seeded recipe, the recipe change report, and the feed handler.
 */
export function ChipBuilder({
  challengeInput,
  truth,
  panelOps,
  initialSteps,
  misses,
  missLimit,
  onStepsChange,
  onFeed,
}: {
  readonly challengeInput: string;
  readonly truth: readonly ChipPair[];
  readonly panelOps: readonly string[];
  readonly initialSteps?: readonly Step[];
  readonly misses: number;
  readonly missLimit: number;
  readonly onStepsChange?: (steps: readonly Step[]) => void;
  readonly onFeed: (submission: Submission) => void;
}) {
  const [steps, setSteps] = useState<readonly Step[]>(() => initialSteps ?? NO_STEPS);
  const [query, setQuery] = useState("");

  useEffect(() => {
    onStepsChange?.(steps);
  }, [steps]);

  const panelSet = new Set(panelOps);
  const inPanel = (tile: OpTile): boolean => panelSet.has(tile.opId);

  const seedType = seedTypeOf(parseChips(challengeInput));
  const pickerType = listTypeOf(typeAfter(seedType, steps));
  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;
  const results = searching ? searchTiles(pickerType, trimmedQuery).filter(inPanel) : NO_TILES;
  const hasSteps = steps.length > 0;
  const hasResults = results.length > 0;

  const addStep = (tile: OpTile): void => {
    setSteps((previous) => [...previous, { opId: tile.opId, params: defaultParams(tile) }]);
    setQuery("");
  };
  const removeStep = (index: number): void => setSteps((previous) => previous.filter((_, at) => at !== index));
  const cycleParam = (index: number): void => {
    const step = steps[index];
    if (!step) return;
    const spec = getOp(step.opId).params.at(0);
    if (!spec) return;
    const current = step.params[spec.name] ?? spec.min;
    const next = current >= spec.max ? spec.min : current + 1;
    setSteps((previous) =>
      previous.map((element, at) =>
        at === index ? { opId: element.opId, params: { [spec.name]: next } } : element,
      ),
    );
  };
  const clear = (): void => setSteps(NO_STEPS);
  const recipeOutputFor = (input: string): string => valueToChips(applyTrail(parseChips(input), steps)).join(" ");
  const feed = (): void => {
    const matchesAllExamples =
      truth.length > 0 && truth.every(([input, output]) => chipsEqual(recipeOutputFor(input), output));
    onFeed({ kind: SUBMISSION_RECIPE, matchesAllExamples, chips: recipeOutputFor(challengeInput) });
  };

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
          onClick={() => removeStep(index)}
        >
          {COPY_STEP_REMOVE_GLYPH}
        </button>
      </li>
    );
  };

  let searchResults: ReactNode = null;
  if (searching) {
    searchResults = hasResults ? (
      <ul className={CLASS_PAGE}>{results.map(renderOp)}</ul>
    ) : (
      <p className={CLASS_NO_MATCHES}>{COPY_NO_MATCHES}</p>
    );
  }

  return (
    <div className={CLASS_BUILDER}>
      {hasSteps ? (
        <div className={CLASS_RECIPE_HEAD}>
          <span className={CLASS_RECIPE_HEAD_LABEL}>{COPY_RECIPE_LABEL}</span>
          <button type="button" className={CLASS_CLEAR} onClick={clear}>
            {COPY_CLEAR}
          </button>
        </div>
      ) : null}
      {hasSteps ? (
        <ol className={CLASS_RECIPE} aria-label={COPY_RECIPE_LABEL} aria-live="polite">
          {steps.map((element, index) => renderStep(element, index))}
        </ol>
      ) : null}

      <div className={CLASS_PICKER} aria-label={COPY_PICKER_LABEL}>
        <input
          type="search"
          className={CLASS_SEARCH}
          value={query}
          aria-label={COPY_SEARCH_LABEL}
          placeholder={COPY_SEARCH_PLACEHOLDER}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searchResults}
      </div>

      <MissPips misses={misses} limit={missLimit} />

      <button type="button" className={CLASS_FEED} onClick={feed}>
        {COPY_FEED_BUTTON}
      </button>
    </div>
  );
}
