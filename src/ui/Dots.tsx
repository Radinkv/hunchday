import { CLASS_DOT, CLASS_DOT_CRACKED, CLASS_DOT_CURRENT, CLASS_DOT_REVEALED, CLASS_DOTS } from "./constants";

/**
 * The progress dots. Each machine shows as cracked, revealed, the current machine, or
 * not yet reached. Decorative, so it is hidden from assistive technology.
 */
export function Dots({
  machineIndex,
  results,
}: {
  readonly machineIndex: number;
  readonly results: ReadonlyArray<boolean | null>;
}) {
  return (
    <div className={CLASS_DOTS} aria-hidden="true">
      {results.map((result, index) => {
        let className = CLASS_DOT;
        if (result === true) className += " " + CLASS_DOT_CRACKED;
        else if (result === false) className += " " + CLASS_DOT_REVEALED;
        else if (index === machineIndex) className += " " + CLASS_DOT_CURRENT;
        return <span key={index} className={className} />;
      })}
    </div>
  );
}
