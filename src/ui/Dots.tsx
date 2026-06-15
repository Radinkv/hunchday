import type { CSSProperties } from "react";
import { CLASS_DOT, CLASS_DOTS } from "./constants";

/** The opacity of a tier dot that has not yet been reached. */
const DOT_DIM = 0.4;
const DOT_FULL = 1;

/** The hex alpha suffix giving the current machine's dot a soft halo in its tier hue. */
const HALO_ALPHA = "59";
const HALO_WIDTH = "2.5px";

/**
 * The progress dots, one per machine. Each dot carries its tier's colour, so the row is a
 * standing colour-and-position legend; the current and finished machines read at full
 * strength while the ones not yet reached are dimmed, and the current machine wears a soft
 * halo in its own hue. Decorative, so it is hidden from assistive technology.
 */
export function Dots({
  machineIndex,
  results,
  tierColors,
}: {
  readonly machineIndex: number;
  readonly results: ReadonlyArray<boolean | null>;
  readonly tierColors: readonly string[];
}) {
  return (
    <div className={CLASS_DOTS} aria-hidden="true">
      {results.map((result, index) => {
        const tier = tierColors[index] ?? tierColors[0];
        const played = result !== null;
        const current = result === null && index === machineIndex;
        const style: CSSProperties = {
          backgroundColor: tier,
          opacity: played || current ? DOT_FULL : DOT_DIM,
          boxShadow: current ? `0 0 0 ${HALO_WIDTH} ${tier}${HALO_ALPHA}` : undefined,
        };
        return <span key={tier} className={CLASS_DOT} style={style} />;
      })}
    </div>
  );
}
