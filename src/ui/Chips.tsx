import { tokenize } from "../game/reducer";
import { CLASS_CHIP } from "./constants";

/** The separator joining a chip's role, token, and repeat index into a stable render key. */
const KEY_SEPARATOR = ":";

/**
 * Renders a chip string as a run of labelled chip spans, one per token, coloured by the role
 * it is given. Repeated tokens are keyed by their occurrence so duplicate chips keep stable
 * keys. Shared by the evidence rows and the test bench so a chip looks the same everywhere.
 * @param props The chip string and the role class that colours it.
 */
export function Chips({ value, role }: { readonly value: string; readonly role: string }) {
  const seenCount = new Map<string, number>();
  return (
    <>
      {tokenize(value).map((token) => {
        const seen = seenCount.get(token) ?? 0;
        seenCount.set(token, seen + 1);
        const key = role + KEY_SEPARATOR + token + KEY_SEPARATOR + String(seen);
        return (
          <span key={key} className={CLASS_CHIP + " " + role} aria-label={token}>
            {token}
          </span>
        );
      })}
    </>
  );
}
