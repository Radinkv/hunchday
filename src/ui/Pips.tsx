import { CLASS_MISS_PIPS, CLASS_PIP, CLASS_PIP_ON, CLASS_PIPS, MISS_PIP_LABEL } from "./constants";

/** The fatal miss is not shown as a pip, so the survivable count is one below the machine's limit. */
const FATAL_MISS = 1;

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
 * answers accrue. There is one pip per survivable miss, one below the machine's miss limit; filling
 * the last one means the next wrong answer ends the machine. The harder finale carries a larger
 * limit, so it shows more pips. Guess and Recipe share the same machine miss count, so both show it.
 * @param props The number of wrong answers so far and the machine's miss limit.
 */
export function MissPips({ misses, limit }: { readonly misses: number; readonly limit: number }) {
  const survivable = limit - FATAL_MISS;
  return (
    <Pips
      total={survivable}
      active={Math.min(misses, survivable)}
      variant={CLASS_MISS_PIPS}
      label={MISS_PIP_LABEL + LABEL_SEPARATOR + misses}
    />
  );
}
