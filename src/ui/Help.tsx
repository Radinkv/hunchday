import { useEffect, useRef, useState } from "react";
import {
  CLASS_HELP,
  CLASS_HELP_BUTTON,
  CLASS_HELP_GOAL,
  CLASS_HELP_LIST,
  CLASS_HELP_MODE,
  CLASS_HELP_NOTE,
  CLASS_HELP_POP,
  COPY_HELP_GLYPH,
  COPY_HELP_GOAL,
  COPY_HELP_GUESS,
  COPY_HELP_NOTE,
  COPY_HELP_RECIPE,
  COPY_HELP_TEST,
  COPY_HELP_TITLE,
  COPY_MODE_GUESS,
  COPY_MODE_RECIPE,
  COPY_MODE_TEST,
} from "./constants";

/** The key that closes the popover from the keyboard. */
const ESCAPE_KEY = "Escape";

/** Each mode's one line explainer: the mode word and what to do in it. */
const HELP_MODES: readonly { readonly name: string; readonly desc: string }[] = [
  { name: COPY_MODE_TEST, desc: COPY_HELP_TEST },
  { name: COPY_MODE_GUESS, desc: COPY_HELP_GUESS },
  { name: COPY_MODE_RECIPE, desc: COPY_HELP_RECIPE },
];

/**
 * The help affordance in the navbar: a small question mark that opens a compact explainer of the
 * goal and the three modes. The rest of the interface stays word free; the rules live only here,
 * reached on demand. It opens on hover for a mouse and on tap or click for touch, and closes when
 * the pointer leaves, on a click outside, or on Escape, so it never lingers in the way.
 */
export function Help() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === ESCAPE_KEY) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={CLASS_HELP} ref={ref}>
      <button
        type="button"
        className={CLASS_HELP_BUTTON}
        aria-label={COPY_HELP_TITLE}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {COPY_HELP_GLYPH}
      </button>
      {open ? (
        <div className={CLASS_HELP_POP}>
          <p className={CLASS_HELP_GOAL}>{COPY_HELP_GOAL}</p>
          <ul className={CLASS_HELP_LIST}>
            {HELP_MODES.map((helpMode) => (
              <li key={helpMode.name}>
                <span className={CLASS_HELP_MODE}>{helpMode.name}</span> {helpMode.desc}
              </li>
            ))}
          </ul>
          <p className={CLASS_HELP_NOTE}>{COPY_HELP_NOTE}</p>
        </div>
      ) : null}
    </div>
  );
}
