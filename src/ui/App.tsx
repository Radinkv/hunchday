import { useState } from "react";
import { feed, nextMachine, restart, startGame } from "../game/reducer";
import type { GameState, Machine } from "../game/types";
import { Dots } from "./Dots";
import { MachineCard } from "./MachineCard";
import { COPY_FOOTER, COPY_TAGLINE, COPY_WORDMARK } from "./constants";

/**
 * The whole interface. It owns the single piece of game state, derives each new state
 * from the pure reducer, and lays out the wordmark, progress dots, machine card, and
 * footer. The machine set is supplied as a prop so the entry decides where it comes
 * from, which keeps this component testable with a fixed set.
 */
export function App({ machines }: { readonly machines: readonly Machine[] }) {
  const [state, setState] = useState<GameState>(() => startGame(machines));

  return (
    <>
      <header>
        <h1>{COPY_WORDMARK}</h1>
        <p>{COPY_TAGLINE}</p>
      </header>
      <main>
        <Dots machineIndex={state.machineIndex} results={state.results} />
        <MachineCard
          machines={machines}
          state={state}
          onFeed={(guess) => setState((current) => feed(current, machines, guess))}
          onNext={() => setState((current) => nextMachine(current, machines))}
          onRestart={() => setState(restart(machines))}
        />
      </main>
      <footer>{COPY_FOOTER}</footer>
    </>
  );
}
