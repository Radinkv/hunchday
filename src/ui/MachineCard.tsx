import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChipBuilder } from "./ChipBuilder";
import { crackedCount, isLastMachine, shareText, tokenize } from "../game/reducer";
import {
  FEEDBACK_CORRECT_MORE,
  FEEDBACK_CORRECT_TWICE,
  FEEDBACK_WRONG,
  PHASE_PLAYING,
  type EvidenceRow,
  type FeedbackKind,
  type GameState,
  type Machine,
} from "../game/types";
import {
  ARROW_GLYPH,
  CLASS_ARROW,
  CLASS_BOT,
  CLASS_BOTTOM,
  CLASS_CELL_LEFT,
  CLASS_CELL_RIGHT,
  CLASS_CHIP,
  CLASS_CHIP_INPUT,
  CLASS_CHIP_OUTPUT,
  CLASS_CHOMP,
  CLASS_END_STATS,
  CLASS_EVIDENCE,
  CLASS_FEEDBACK,
  CLASS_FEEDBACK_NOPE,
  CLASS_FEEDBACK_OK,
  CLASS_LIGHT,
  CLASS_QUIET_BUTTON,
  CLASS_ROW,
  CLASS_ROW_ACTIVE,
  CLASS_RULE,
  CLASS_RULE_BOX,
  CLASS_RULE_CRACKED,
  CLASS_RULE_REVEALED,
  CLASS_SHARE,
  CLASS_WAIT_DOT,
  COPY_COPIED,
  COPY_COPY_RESULT,
  COPY_END_STATS_MIDDLE,
  COPY_END_STATS_MISSES,
  COPY_END_STATS_PREFIX,
  COPY_END_STATS_SUFFIX,
  COPY_FEEDBACK_CORRECT,
  COPY_FEEDBACK_GAVE,
  COPY_FEEDBACK_MORE,
  COPY_FEEDBACK_NOT_QUITE,
  COPY_FEEDBACK_TWICE,
  COPY_NEXT_MACHINE,
  COPY_PLAY_AGAIN,
  COPY_RULE_CRACKED_LABEL,
  COPY_RULE_REVEALED_LABEL,
  COPY_WAITING,
  WAIT_DOT_SRC,
} from "./constants";

type ChipRole = typeof CLASS_CHIP_INPUT | typeof CLASS_CHIP_OUTPUT;

const KEY_SEPARATOR_COLON = ":";
const KEY_SEPARATOR_ARROW = "->";
const KEY_SEPARATOR_PIPE = "|";
const KEY_SEPARATOR_HASH = "#";

/** The handlers the card invokes to drive the reducer. */
export interface MachineHandlers {
  readonly onFeed: (guess: string) => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
}

/**
 * Renders a chip string as a run of labelled chip spans.
 * @param props The chip string and the role that colors it.
 */
function Chips({ value, role }: { readonly value: string; readonly role: ChipRole }) {
  const tokenKeyCounts = new Map<string, number>();

  return (
    <>
      {tokenize(value).map((token) => {
        const seenCount = tokenKeyCounts.get(token) ?? 0;
        tokenKeyCounts.set(token, seenCount + 1);
        const key = role + KEY_SEPARATOR_COLON + token + KEY_SEPARATOR_COLON + String(seenCount);

        return (
          <span key={key} className={CLASS_CHIP + " " + role} aria-label={token}>
            {token}
          </span>
        );
      })}
    </>
  );
}

/**
 * Renders one evidence row on the two column grid: input chips right aligned in the left
 * cell, a fixed arrow spine, and the machine's output left aligned in the right cell, so
 * the arrow lands in the same place no matter how many chips a row has.
 * @param props The evidence row to render.
 */
function Row({ row }: { readonly row: EvidenceRow }) {
  return (
    <div className={CLASS_ROW + (row.mark ? " " + row.mark : "")}>
      <div className={CLASS_CELL_LEFT}>
        <Chips value={row.input} role={CLASS_CHIP_INPUT} />
      </div>
      <span className={CLASS_ARROW} aria-hidden="true">
        {ARROW_GLYPH}
      </span>
      <div className={CLASS_CELL_RIGHT}>
        <Chips value={row.output} role={CLASS_CHIP_OUTPUT} />
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
 * Maps a feedback kind to its rendered line, coloring the leading status word.
 * @param feedback The feedback kind to render.
 * @returns The feedback content, or null when there is none.
 */
function feedbackContent(feedback: FeedbackKind): ReactNode {
  if (feedback === FEEDBACK_CORRECT_TWICE) {
    return <span className={CLASS_FEEDBACK_OK}>{COPY_FEEDBACK_TWICE}</span>;
  }
  if (feedback === FEEDBACK_CORRECT_MORE) {
    return (
      <>
        <span className={CLASS_FEEDBACK_OK}>{COPY_FEEDBACK_CORRECT}</span>
        {COPY_FEEDBACK_MORE}
      </>
    );
  }
  if (feedback === FEEDBACK_WRONG) {
    return (
      <>
        <span className={CLASS_FEEDBACK_NOPE}>{COPY_FEEDBACK_NOT_QUITE}</span>
        {COPY_FEEDBACK_GAVE}
      </>
    );
  }
  return null;
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
 * Renders the end of game summary: the tally, the shareable result, and the controls.
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
  const share = shareText(state, machines);
  const stats =
    COPY_END_STATS_PREFIX +
    crackedCount(state) +
    COPY_END_STATS_MIDDLE +
    machines.length +
    COPY_END_STATS_SUFFIX +
    state.misses +
    COPY_END_STATS_MISSES;

  const copy = (): void => {
    if (navigator.clipboard) navigator.clipboard.writeText(share);
    setCopied(true);
  };

  return (
    <>
      <p className={CLASS_END_STATS}>{stats}</p>
      <div className={CLASS_SHARE}>{share}</div>
      <button className={CLASS_QUIET_BUTTON} onClick={copy}>
        {copied ? COPY_COPIED : COPY_COPY_RESULT}
      </button>
      <button onClick={onRestart}>{COPY_PLAY_AGAIN}</button>
    </>
  );
}

/** The machine card: the head, the evidence, and either the prompt or the reveal. */
export function MachineCard({
  machines,
  state,
  onFeed,
  onNext,
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

  const machine = machines.at(state.machineIndex);
  if (!machine) return null;

  const playing = state.phase === PHASE_PLAYING;
  const won = state.won === true;
  const challengeInput = machine.ch.at(state.challengeIndex)?.[0] ?? "";

  const handleFeed = (guess: string): void => {
    if (tokenize(guess).length === 0) return;
    onFeed(guess);
  };

  const evidenceKeyCounts = new Map<string, number>();

  return (
    <>
      <div ref={logRef} className={CLASS_EVIDENCE} aria-live="polite" aria-label="Evidence so far">
        {state.evidence.map((row) => {
          const baseKey = row.input + KEY_SEPARATOR_ARROW + row.output + KEY_SEPARATOR_PIPE + (row.mark ?? "");
          const seenCount = evidenceKeyCounts.get(baseKey) ?? 0;
          evidenceKeyCounts.set(baseKey, seenCount + 1);
          const key = baseKey + KEY_SEPARATOR_HASH + String(seenCount);

          return <Row key={key} row={row} />;
        })}
        {playing && (
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
        <p className={CLASS_FEEDBACK} aria-live="polite">
          {feedbackContent(state.feedback)}
        </p>
      </div>

      {playing ? (
        <ChipBuilder
          key={state.machineIndex}
          challengeInput={challengeInput}
          difficulty={machine.difficulty}
          panelOps={machine.panelOps}
          onFeed={handleFeed}
        />
      ) : (
        <div className={CLASS_BOTTOM + " " + CLASS_RULE_BOX}>
          <RuleBanner won={won} rule={machine.rule} />
          {isLastMachine(state, machines) ? (
            <EndScreen state={state} machines={machines} onRestart={onRestart} />
          ) : (
            <button onClick={onNext}>{COPY_NEXT_MACHINE}</button>
          )}
        </div>
      )}
    </>
  );
}
