import { useEffect, useState } from "react";
import { feed, finish, nextMachine, recordTest, restart, startGame } from "../game/reducer";
import { todayDate } from "../game/calendar";
import type { GameState, Machine } from "../game/types";
import { Juice } from "./Juice";
import { Help } from "./Help";
import { Bot, MachineCard } from "./MachineCard";
import { loadGame, saveGame } from "./storage";
import {
  CLASS_APP,
  CLASS_FEED,
  CLASS_HEADER,
  CLASS_HEADER_LEFT,
  CLASS_HEADER_RIGHT,
  CLASS_INTRO,
  CLASS_INTRO_COPY,
  CLASS_INTRO_TITLE,
  CLASS_INTRO_LEAD,
  CLASS_SHELL,
  COPY_INTRO_TITLE,
  COPY_INTRO_LEAD,
  COPY_PLAY,
  COPY_WORDMARK,
  LIGHT_COLOR_IDLE,
} from "./constants";

/** The progress of a day with no machine finished yet, used before the first reveal. */
const NO_PROGRESS = 0;

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
  const [state, setState] = useState<GameState | null>(() => loadGame(today, machines));

  useEffect(() => {
    if (state) saveGame(today, state, machines);
  }, [state, today, machines]);

  const finished = (state?.results ?? []).filter((result) => result !== null).length;
  const fraction = machines.length === 0 ? NO_PROGRESS : finished / machines.length;

  return (
    <div className={CLASS_SHELL}>
      <header className={CLASS_HEADER}>
        <div className={CLASS_HEADER_LEFT}>
          <Bot lightColor={LIGHT_COLOR_IDLE} chomping={false} />
          <h1>{COPY_WORDMARK}</h1>
        </div>
        <div className={CLASS_HEADER_RIGHT}>
          <Juice fraction={fraction} />
          <Help />
        </div>
      </header>
      <div className={CLASS_APP}>
        {state ? (
          <MachineCard
            machines={machines}
            state={state}
            onFeed={(submission) => setState((current) => (current ? feed(current, machines, submission) : current))}
            onTest={(result) => setState((current) => (current ? recordTest(current, result) : current))}
            onNext={() => setState((current) => (current ? nextMachine(current, machines) : current))}
            onFinish={() => setState((current) => (current ? finish(current) : current))}
            onRestart={() => setState(restart(machines))}
          />
        ) : (
          <div className={CLASS_INTRO}>
            <Bot lightColor={LIGHT_COLOR_IDLE} chomping={false} />
            <div className={CLASS_INTRO_COPY}>
              <h2 className={CLASS_INTRO_TITLE}>{COPY_INTRO_TITLE}</h2>
              <p className={CLASS_INTRO_LEAD}>{COPY_INTRO_LEAD}</p>
            </div>
            <button type="button" className={CLASS_FEED} onClick={() => setState(startGame(machines))}>
              {COPY_PLAY}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
