/**
 * The chip lexicons.
 *
 * Word machines draw their chips from small curated word lists bundled with the
 * application as JSON. These files are the entire word database; there is no server
 * and no query. Each entry carries its word together with metadata computed ahead of
 * time, the letter count, the vowel count, and the first letter, so the generator can
 * filter and group candidates by these properties without doing any string work at
 * generation time. The lint test guarantees the metadata matches the word, so the
 * precomputed values can be trusted.
 *
 * The lexicons are named by stable tokens with a union type derived from them, so the
 * generator refers to a lexicon by name rather than by a raw string, and a new
 * expansion lexicon is added by dropping in another JSON file and one token.
 */

import animalsData from "../data/lexicons/animals.json";
import fruitsData from "../data/lexicons/fruits.json";
import namesData from "../data/lexicons/names.json";

/** One lexicon entry: a word and the metadata precomputed from it. */
export interface LexiconEntry {
  readonly word: string;
  readonly letters: number;
  readonly vowels: number;
  readonly first: string;
}

export const LEXICON_ANIMALS = "animals";
export const LEXICON_FRUITS = "fruits";
export const LEXICON_NAMES = "names";

/** The name of a bundled lexicon. */
export type LexiconName = typeof LEXICON_ANIMALS | typeof LEXICON_FRUITS | typeof LEXICON_NAMES;

/** Every lexicon, keyed by name. */
export const LEXICONS: Readonly<Record<LexiconName, readonly LexiconEntry[]>> = {
  [LEXICON_ANIMALS]: animalsData,
  [LEXICON_FRUITS]: fruitsData,
  [LEXICON_NAMES]: namesData,
};

/** The names of every lexicon, in a stable order. */
export const ALL_LEXICON_NAMES: readonly LexiconName[] = [LEXICON_ANIMALS, LEXICON_FRUITS, LEXICON_NAMES];

/**
 * Returns the entries of a lexicon by name.
 * @param name The lexicon name.
 * @returns The lexicon entries.
 */
export function getLexicon(name: LexiconName): readonly LexiconEntry[] {
  return LEXICONS[name];
}
