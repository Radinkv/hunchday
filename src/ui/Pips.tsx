import { MISSES_TO_FAIL } from "../game/reducer";
import { CLASS_MISS_PIPS, CLASS_PIP, CLASS_PIP_ON, CLASS_PIPS, MISS_PIP_LABEL } from "./constants";

/** The number of survivable misses, the pips a player fills before the fatal next one. */
const SURVIVABLE_MISSES = MISSES_TO_FAIL - 1;

/** The separator between the miss label and its count for assistive technology. */
const LABEL_SEPARATOR = ": ";

/**
 * A small row of pips that fill from the start. It is the shared counter for both the test budget
 * (machine accent, showing tries remaining) and the miss counter (amber, showing wrong answers so
 * far). The colour comes from the variant class; the first `active` of `total` pips are filled.
 * @param props The number of pips, how many are filled, the variant class, and the accessible label.
 */
export function Pips({
  total,
  active,
  variant,
  label,
}: {
  readonly total: number;
  readonly active: number;
  readonly variant: string;
  readonly label: string;
}) {
  return (
    <div className={CLASS_PIPS + " " + variant} role="img" aria-label={label}>
      {Array.from({ length: total }, (_unused, index) => (
        <span key={index} className={CLASS_PIP + (index < active ? " " + CLASS_PIP_ON : "")} />
      ))}
    </div>
  );
}

/**
 * The miss counter shown in Guess and Recipe: amber pips that start empty and fill as wrong
 * answers accrue. There is one pip per survivable miss; filling the last one means the next wrong
 * answer ends the machine. Guess and Recipe share the same machine miss count, so both show it.
 * @param props The number of wrong answers so far on the current machine.
 */
export function MissPips({ misses }: { readonly misses: number }) {
  return (
    <Pips
      total={SURVIVABLE_MISSES}
      active={Math.min(misses, SURVIVABLE_MISSES)}
      variant={CLASS_MISS_PIPS}
      label={MISS_PIP_LABEL + LABEL_SEPARATOR + misses}
    />
  );
}
