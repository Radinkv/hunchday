import { CLASS_JUICE, CLASS_JUICE_FILL, COPY_PROGRESS_LABEL, PERCENT_UNIT } from "./constants";

/** The progress range, expressed as a whole number percentage from empty to full. */
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

/** The bounds a progress fraction is clamped to before it is scaled to a percentage. */
const FRACTION_FLOOR = 0;
const FRACTION_CEILING = 1;

/**
 * The day's progress as a small liquid bar in the navbar. It starts empty and the machine
 * coloured fill grows proportionally as each machine of the day is finished, giving a wordless
 * sense of advancing through the day. It carries no visible label and is exposed to assistive
 * technology as a progress bar.
 * @param props The progress as a fraction from zero to one.
 */
export function Juice({ fraction }: { readonly fraction: number }) {
  const clamped = Math.max(FRACTION_FLOOR, Math.min(FRACTION_CEILING, fraction));
  const percent = Math.round(clamped * PROGRESS_MAX);
  return (
    <div
      className={CLASS_JUICE}
      role="progressbar"
      aria-label={COPY_PROGRESS_LABEL}
      aria-valuemin={PROGRESS_MIN}
      aria-valuemax={PROGRESS_MAX}
      aria-valuenow={percent}
    >
      <span className={CLASS_JUICE_FILL} style={{ width: percent + PERCENT_UNIT }} />
    </div>
  );
}
