import { tokenize } from "../game/reducer";
import {
  CLASS_CHIP,
  CLASS_COMPOSER,
  CLASS_COMPOSER_CHIP,
  CLASS_COMPOSER_FIELD,
  CLASS_COMPOSER_PREVIEW,
  CLASS_PAD,
  CLASS_PAD_KEY,
  COPY_COMPOSER_HINT,
  COPY_COMPOSER_LABEL,
  COPY_COMPOSER_REMOVE_PREFIX,
  COPY_PAD_BACK_GLYPH,
  COPY_PAD_BACK_LABEL,
  COPY_PAD_DIGIT_PREFIX,
  COPY_PAD_NEXT_GLYPH,
  COPY_PAD_NEXT_LABEL,
} from "./constants";

/** The most chips a composed set may hold and the most digits a single number chip may have. */
const MAX_TOKENS = 6;
const MAX_TOKEN_LENGTH = 2;

/** The longest a single word chip may be in the word entry. */
const MAX_WORD_LENGTH = 12;

/** The separator that joins chip tokens in the composed value. */
const TOKEN_JOIN = " ";

/** Matches any character that is not a lowercase letter or a space, for stripping word entry. */
const NON_WORD_CHAR = /[^a-z ]/g;

/** Matches a run of spaces, used to split the word entry into chip tokens. */
const SPACE_RUN = / +/;

/**
 * Sanitizes raw word entry so only valid chips can be typed: it lowercases, drops anything that is
 * not a letter or a space, caps the number of chips and the length of each, and keeps a single
 * trailing space so a player can start the next chip. Disallowed input simply never appears, so no
 * error message is needed.
 * @param raw The raw field value.
 * @returns The sanitized word chip string.
 */
function sanitizeWords(raw: string): string {
  const cleaned = raw.toLowerCase().replace(NON_WORD_CHAR, "");
  const tokens = cleaned
    .split(SPACE_RUN)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
    .map((token) => token.slice(0, MAX_WORD_LENGTH));
  const joined = tokens.join(TOKEN_JOIN);
  return cleaned.endsWith(TOKEN_JOIN) && tokens.length < MAX_TOKENS ? joined + TOKEN_JOIN : joined;
}

/** The number pad keys, row by row, with zero on the last row beside delete and new chip. */
const DIGIT_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];
const ZERO_DIGIT = "0";

/** The human offset turning a zero based chip index into the number spoken to a screen reader. */
const CHIP_NUMBER_OFFSET = 1;

/**
 * The shared chip composer, the one input both Guess and Test build their chips with. A number
 * machine gets a tap pad so a short list of small numbers is pressed in rather than typed on a
 * keyboard, with a new chip key to separate numbers and a delete key; a word machine gets a
 * plain text field, since words cannot be tapped out. Either way the composed chips render as a
 * live preview above the entry, and tapping a placed chip removes it. The composed value is a
 * space separated chip string owned by the caller, so it survives switching modes and the caller
 * decides what submitting it means. The whole composer locks when disabled, such as once a test
 * budget is spent.
 * @param props Whether the machine reads words, the composed value and its change handler, the chip colour role, and the disabled flag.
 */
export function ChipComposer({
  words,
  value,
  onChange,
  role,
  disabled = false,
}: {
  readonly words: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly role: string;
  readonly disabled?: boolean;
}) {
  const tokens = tokenize(value);
  const startingNewChip = value === "" || value.endsWith(TOKEN_JOIN);
  const activeToken = startingNewChip ? "" : (tokens.at(-1) ?? "");

  const pressDigit = (digit: string): void => {
    if (disabled) return;
    if (startingNewChip && tokens.length >= MAX_TOKENS) return;
    if (!startingNewChip && activeToken.length >= MAX_TOKEN_LENGTH) return;
    onChange(value + digit);
  };

  const pressNewChip = (): void => {
    if (disabled || startingNewChip || tokens.length >= MAX_TOKENS) return;
    onChange(value + TOKEN_JOIN);
  };

  const pressDelete = (): void => {
    if (disabled) return;
    const remaining = tokens.slice(0, -1);
    onChange(remaining.length === 0 ? "" : remaining.join(TOKEN_JOIN) + TOKEN_JOIN);
  };

  const removeChip = (index: number): void => {
    if (disabled) return;
    onChange(tokens.filter((_token, at) => at !== index).join(TOKEN_JOIN));
  };

  return (
    <div className={CLASS_COMPOSER}>
      <div className={CLASS_COMPOSER_PREVIEW}>
        {tokens.map((token, index) => (
          <button
            type="button"
            key={token + TOKEN_JOIN + index}
            className={CLASS_CHIP + " " + role + " " + CLASS_COMPOSER_CHIP}
            aria-label={COPY_COMPOSER_REMOVE_PREFIX + (index + CHIP_NUMBER_OFFSET)}
            disabled={disabled}
            onClick={() => removeChip(index)}
          >
            {token}
          </button>
        ))}
      </div>

      {words ? (
        <input
          className={CLASS_COMPOSER_FIELD}
          type="text"
          value={value}
          disabled={disabled}
          aria-label={COPY_COMPOSER_LABEL}
          placeholder={COPY_COMPOSER_HINT}
          onChange={(event) => onChange(sanitizeWords(event.target.value))}
        />
      ) : (
        <div className={CLASS_PAD}>
          {DIGIT_ROWS.flat().map((digit) => (
            <button
              type="button"
              key={digit}
              className={CLASS_PAD_KEY}
              aria-label={COPY_PAD_DIGIT_PREFIX + digit}
              disabled={disabled}
              onClick={() => pressDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className={CLASS_PAD_KEY}
            aria-label={COPY_PAD_NEXT_LABEL}
            disabled={disabled}
            onClick={pressNewChip}
          >
            {COPY_PAD_NEXT_GLYPH}
          </button>
          <button
            type="button"
            className={CLASS_PAD_KEY}
            aria-label={COPY_PAD_DIGIT_PREFIX + ZERO_DIGIT}
            disabled={disabled}
            onClick={() => pressDigit(ZERO_DIGIT)}
          >
            {ZERO_DIGIT}
          </button>
          <button
            type="button"
            className={CLASS_PAD_KEY}
            aria-label={COPY_PAD_BACK_LABEL}
            disabled={disabled}
            onClick={pressDelete}
          >
            {COPY_PAD_BACK_GLYPH}
          </button>
        </div>
      )}
    </div>
  );
}
