import { useEffect, useState } from "react";
import { feed, nextMachine, restart, startGame } from "../game/reducer";
import { todayDate } from "../game/calendar";
import type { GameState, Machine } from "../game/types";
import { Dots } from "./Dots";
import { Bot, MachineCard } from "./MachineCard";
import { loadGame, saveGame } from "./storage";
import {
  CLASS_APP,
  CLASS_FEED,
  CLASS_HEADER,
  CLASS_INTRO,
  CLASS_INTRO_LEAD,
  CLASS_TAGLINE,
  CLASS_WORDMARK_BLOCK,
  COPY_INTRO_LEAD,
  COPY_PLAY,
  COPY_TAGLINE,
  COPY_WORDMARK,
  LIGHT_COLOR_IDLE,
} from "./constants";

/** The starting machine index shown by the progress dots before a game has begun. */
const FIRST_MACHINE_INDEX = 0;

/**
 * The whole interface as a full height flex column. It owns the single piece of game
 * state, derives each new state from the pure reducer, and persists it per day so a
 * reload resumes where the player left off, including the finished results screen. Until
 * the player presses Play on a fresh day the body is the intro; after that it is the
 * machine card's regions. The machine set is supplied as a prop so the entry decides
 * where it comes from, which keeps this component testable with a fixed set.
 */
export function App({ machines }: { readonly machines: readonly Machine[] }) {
  const today = todayDate();
  const [state, setState] = useState<GameState | null>(() => loadGame(today, machines.length));

  useEffect(() => {
    if (state) saveGame(today, state);
  }, [state, today]);

  const idleResults = machines.map(() => null);

  return (
    <div className={CLASS_APP}>
      <header className={CLASS_HEADER}>
        <div className={CLASS_WORDMARK_BLOCK}>
          <h1>{COPY_WORDMARK}</h1>
          <span className={CLASS_TAGLINE}>{COPY_TAGLINE}</span>
        </div>
        <Dots machineIndex={state?.machineIndex ?? FIRST_MACHINE_INDEX} results={state?.results ?? idleResults} />
      </header>
      {state ? (
        <MachineCard
          machines={machines}
          state={state}
          onFeed={(guess) => setState((current) => (current ? feed(current, machines, guess) : current))}
          onNext={() => setState((current) => (current ? nextMachine(current, machines) : current))}
          onRestart={() => setState(restart(machines))}
        />
      ) : (
        <div className={CLASS_INTRO}>
          <Bot lightColor={LIGHT_COLOR_IDLE} chomping={false} />
          <p className={CLASS_INTRO_LEAD}>{COPY_INTRO_LEAD}</p>
          <button type="button" className={CLASS_FEED} onClick={() => setState(startGame(machines))}>
            {COPY_PLAY}
          </button>
        </div>
      )}
    </div>
  );
}
