import { useEffect, useRef, useState } from "react";
import { Workspace } from "./Workspace";
import { ModeToggle, modesForSteps } from "./ModeToggle";
import { Chips } from "./Chips";
import { crackedCount, isLastMachine, missLimitFor, shareText } from "../game/reducer";
import {
  MARK_MISS,
  MARK_TEST,
  PHASE_PLAYING,
  testBudgetFor,
  type EvidenceRow,
  type GameState,
  type Machine,
  type Submission,
  type TestResult,
} from "../game/types";
import {
  ARROW_GLYPH,
  CLASS_ARROW,
  CLASS_BOT,
  CLASS_BOTTOM,
  CLASS_CELL_LEFT,
  CLASS_CELL_RIGHT,
  CLASS_CHIP_INPUT,
  CLASS_CHIP_OUTPUT,
  CLASS_CHIP_PROBE,
  CLASS_CHIP_WRONG,
  CLASS_CHOMP,
  CLASS_END,
  CLASS_END_DOT,
  CLASS_END_DOT_CRACKED,
  CLASS_END_DOT_REVEALED,
  CLASS_END_DOTS,
  CLASS_END_HEADLINE,
  CLASS_END_SUB,
  CLASS_EVIDENCE,
  CLASS_PLAY,
  CLASS_STAGE,
  CLASS_LIGHT,
  CLASS_QUIET_BUTTON,
  CLASS_ROW,
  CLASS_ROW_ACTIVE,
  CLASS_RULE,
  CLASS_RULE_BOX,
  CLASS_RULE_CRACKED,
  CLASS_RULE_REVEALED,
  CLASS_VERSUS,
  CLASS_WAIT_DOT,
  COPY_COPIED,
  COPY_HIDE_GUESS,
  COPY_SHOW_GUESS,
  COPY_END_CRACKED_PREFIX,
  COPY_END_MISSES,
  COPY_END_OF,
  COPY_NEXT_MACHINE,
  COPY_PLAY_AGAIN,
  COPY_SEE_RESULTS,
  COPY_RULE_CRACKED_LABEL,
  COPY_RULE_REVEALED_LABEL,
  COPY_SHARE,
  COPY_WAITING,
  LIGHT_COLOR_IDLE,
  MODE_GUESS,
  VERSUS_GLYPH,
  WAIT_DOT_SRC,
  type Mode,
} from "./constants";

const KEY_SEPARATOR_ARROW = "->";
const KEY_SEPARATOR_PIPE = "|";
const KEY_SEPARATOR_HASH = "#";

/**
 * Maps the player's completed tests out of the evidence, so the test bench can show how many
 * tries remain and which sets are already used without a second source of truth.
 * @param evidence The current machine's evidence rows.
 * @returns The test marked rows as input and output pairs.
 */
function testsFrom(evidence: readonly EvidenceRow[]): TestResult[] {
  return evidence.filter((row) => row.mark === MARK_TEST).map((row) => ({ input: row.input, output: row.output }));
}

/** The handlers the card invokes to drive the reducer. */
export interface MachineHandlers {
  readonly onFeed: (submission: Submission) => void;
  readonly onTest: (result: TestResult) => void;
  readonly onNext: () => void;
  readonly onFinish: () => void;
  readonly onRestart: () => void;
}

/**
 * Renders one evidence row on the two column grid: input chips right aligned in the left
 * cell, a fixed arrow spine, and the output left aligned in the right cell, so the arrow
 * lands in the same place no matter how many chips a row has. A miss carrying the player's
 * guess keeps the row to one line: the cross sits on the left of the right cell as a toggle that
 * swaps the chips beside it between the true output and the greyed chips the player guessed,
 * never showing both at once. A miss without a guess, the way a wrong recipe reveals the next
 * example, shows only the true output.
 * @param props The evidence row to render.
 */
function Row({ row }: { readonly row: EvidenceRow }) {
  const showsGuess = row.guess !== undefined;
  const [guessShown, setGuessShown] = useState(false);
  const outputRole = row.mark === MARK_TEST ? CLASS_CHIP_PROBE : CLASS_CHIP_OUTPUT;
  return (
    <div className={CLASS_ROW + (row.mark ? " " + row.mark : "")}>
      <div className={CLASS_CELL_LEFT}>
        <Chips value={row.input} role={CLASS_CHIP_INPUT} />
      </div>
      <span className={CLASS_ARROW} aria-hidden="true">
        {ARROW_GLYPH}
      </span>
      <div className={CLASS_CELL_RIGHT}>
        {showsGuess ? (
          <button
            type="button"
            className={CLASS_VERSUS}
            aria-label={guessShown ? COPY_HIDE_GUESS : COPY_SHOW_GUESS}
            aria-expanded={guessShown}
            onClick={() => setGuessShown((shown) => !shown)}
          >
            {VERSUS_GLYPH}
          </button>
        ) : null}
        {showsGuess && guessShown ? (
          <Chips value={row.guess ?? ""} role={CLASS_CHIP_WRONG} />
        ) : (
          <Chips value={row.output} role={outputRole} />
        )}
      </div>
    </div>
  );
}

/**
 * Renders the bot, coloring its status light and squashing it while chomping.
 * @param props The light color and whether the bot is mid chomp.
 */
export function Bot({ lightColor, chomping }: { readonly lightColor: string; readonly chomping: boolean }) {
  return (
    <svg
      className={CLASS_BOT + (chomping ? " " + CLASS_CHOMP : "")}
      width="46"
      height="42"
      viewBox="0 0 46 42"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="38" height="28" rx="8" fill="#44418F" />
      <rect x="11" y="16" width="24" height="7" rx="3.5" fill="#EDEDFB" />
      <circle className={CLASS_LIGHT} cx="23" cy="30" r="2.6" fill={lightColor} />
      <rect x="20" y="2" width="6" height="6" rx="2" fill="#44418F" />
      <rect x="0" y="18" width="5" height="9" rx="2.5" fill="#44418F" />
      <rect x="41" y="18" width="5" height="9" rx="2.5" fill="#44418F" />
    </svg>
  );
}

/**
 * Renders the rule banner shown when a machine is revealed.
 * @param props Whether the machine was cracked and its rule sentence.
 */
function RuleBanner({ won, rule }: { readonly won: boolean; readonly rule: string }) {
  return (
    <div className={CLASS_RULE + " " + (won ? CLASS_RULE_CRACKED : CLASS_RULE_REVEALED)}>
      <b>{won ? COPY_RULE_CRACKED_LABEL : COPY_RULE_REVEALED_LABEL}</b>
      {rule}
    </div>
  );
}

/**
 * Renders the end of day result as a quiet centered screen: the bot, a row of result dots,
 * a single short tally line, and the two actions. There is no prose and no raw share block,
 * so the close reads like the home screen rather than a wall of text. Share copies the same
 * summary to the clipboard.
 * @param props The final state, the machine set, and the restart handler.
 */
function EndScreen({
  state,
  machines,
  onRestart,
}: {
  readonly state: GameState;
  readonly machines: readonly Machine[];
  readonly onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const cracked = crackedCount(state);

  const copy = (): void => {
    if (navigator.clipboard) navigator.clipboard.writeText(shareText(state, machines));
    setCopied(true);
  };

  return (
    <div className={CLASS_END}>
      <Bot lightColor={LIGHT_COLOR_IDLE} chomping={false} />
      <div className={CLASS_END_DOTS}>
        {state.results.map((result, index) => (
          <span
            key={`dot-${index}-${result}`}
            className={CLASS_END_DOT + " " + (result ? CLASS_END_DOT_CRACKED : CLASS_END_DOT_REVEALED)}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className={CLASS_END_HEADLINE}>
        {COPY_END_CRACKED_PREFIX}
        {cracked}
        {COPY_END_OF}
        {machines.length}
      </p>
      <p className={CLASS_END_SUB}>
        {state.misses}
        {COPY_END_MISSES}
      </p>
      <button type="button" className={CLASS_QUIET_BUTTON} onClick={copy}>
        {copied ? COPY_COPIED : COPY_SHARE}
      </button>
      <button type="button" onClick={onRestart}>
        {COPY_PLAY_AGAIN}
      </button>
    </div>
  );
}

/** The machine card: the head, the evidence, and either the prompt or the reveal. */
export function MachineCard({
  machines,
  state,
  onFeed,
  onTest,
  onNext,
  onFinish,
  onRestart,
}: {
  readonly machines: readonly Machine[];
  readonly state: GameState;
} & MachineHandlers) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.evidence.length, state.challengeIndex]);

  const [mode, setMode] = useState<Mode>(MODE_GUESS);
  useEffect(() => {
    setMode(MODE_GUESS);
  }, [state.machineIndex]);

  const machine = machines.at(state.machineIndex);
  if (!machine) return null;

  const playing = state.phase === PHASE_PLAYING;
  const won = state.won === true;
  const lastMachine = isLastMachine(state, machines);
  const challengeInput = machine.ch.at(state.challengeIndex)?.[0] ?? "";
  const modes = modesForSteps((machine.steps?.length ?? 0) > 0);
  const misses = state.evidence.filter((row) => row.mark === MARK_MISS).length;
  const testBudget = testBudgetFor(machine.difficulty);
  const missLimit = missLimitFor(machine.difficulty);

  if (state.ended) {
    return <EndScreen state={state} machines={machines} onRestart={onRestart} />;
  }

  const evidenceKeyCounts = new Map<string, number>();

  return (
    <div className={CLASS_PLAY}>
      <div className={CLASS_STAGE}>
        <div ref={logRef} className={CLASS_EVIDENCE} aria-live="polite" aria-label="Evidence so far">
          {state.evidence.map((row) => {
            const baseKey =
              row.input + KEY_SEPARATOR_ARROW + row.output + KEY_SEPARATOR_PIPE + (row.guess ?? "") + (row.mark ?? "");
            const seenCount = evidenceKeyCounts.get(baseKey) ?? 0;
            evidenceKeyCounts.set(baseKey, seenCount + 1);
            const key = baseKey + KEY_SEPARATOR_HASH + String(seenCount);

            return <Row key={key} row={row} />;
          })}
          {playing && mode === MODE_GUESS && (
            <div className={CLASS_ROW + " " + CLASS_ROW_ACTIVE}>
              <div className={CLASS_CELL_LEFT}>
                <Chips value={challengeInput} role={CLASS_CHIP_INPUT} />
              </div>
              <span className={CLASS_ARROW} aria-hidden="true">
                {ARROW_GLYPH}
              </span>
              <div className={CLASS_CELL_RIGHT}>
                <img className={CLASS_WAIT_DOT} src={WAIT_DOT_SRC} alt={COPY_WAITING} width={10} height={10} />
              </div>
            </div>
          )}
        </div>

        {playing ? (
          <Workspace
            key={state.machineIndex}
            mode={mode}
            challengeInput={challengeInput}
            examples={machine.ex}
            challenges={machine.ch}
            panelOps={machine.panelOps}
            steps={machine.steps}
            tests={testsFrom(state.evidence)}
            misses={misses}
            testBudget={testBudget}
            missLimit={missLimit}
            onFeed={onFeed}
            onTest={onTest}
          />
        ) : (
          <div className={CLASS_BOTTOM + " " + CLASS_RULE_BOX}>
            <RuleBanner won={won} rule={machine.rule} />
            <button onClick={lastMachine ? onFinish : onNext}>
              {lastMachine ? COPY_SEE_RESULTS : COPY_NEXT_MACHINE}
            </button>
          </div>
        )}
      </div>

      {playing ? <ModeToggle modes={modes} mode={mode} onSelect={setMode} /> : null}
    </div>
  );
}
