/**
 * The controller and entry point for the prototype.
 *
 * This module owns the single piece of mutable state in the application and wires
 * the page to the pure reducer. Each interface event computes a new game state
 * through the reducer and then re renders. It also initializes the analytics and
 * performance instrumentation that the page previously loaded inline.
 */

import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

import { MACHINES } from "./machines";
import { feed, nextMachine, restart, startGame } from "./reducer";
import { chompBot, render, type Handlers } from "./render";
import { PHASE_PLAYING, type GameState } from "./types";
import { ELEMENT_ID_FEED_BUTTON, ELEMENT_ID_GUESS_INPUT } from "./constants";

/** Keyboard key that submits the current guess from the input field. */
const INPUT_KEY_ENTER = "Enter";

inject();
injectSpeedInsights();

/**
 * The single mutable state cell. Every interaction derives a new state from the pure
 * reducer and then renders it, so this variable is the only place state changes.
 */
let state: GameState = startGame(MACHINES);

/**
 * Replaces the current state and re renders the interface from it.
 * @param next The state to adopt and render.
 */
function update(next: GameState): void {
  state = next;
  render(state, MACHINES, handlers);
}

/**
 * Reads the current guess input element.
 * @returns The guess input element.
 */
function guessInput(): HTMLInputElement {
  return document.getElementById(ELEMENT_ID_GUESS_INPUT) as HTMLInputElement;
}

const handlers: Handlers = {
  onFeed: () => {
    const input = guessInput();
    if (state.phase === PHASE_PLAYING) chompBot();
    update(feed(state, MACHINES, input.value));
    input.value = "";
  },
  onNext: () => update(nextMachine(state, MACHINES)),
  onRestart: () => update(restart(MACHINES)),
};

const feedButton = document.getElementById(ELEMENT_ID_FEED_BUTTON);
if (feedButton) feedButton.onclick = handlers.onFeed;
guessInput().addEventListener("keydown", (event) => {
  if (event.key === INPUT_KEY_ENTER) handlers.onFeed();
});

render(state, MACHINES, handlers);
