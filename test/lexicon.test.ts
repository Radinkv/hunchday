import { describe, expect, it } from "vitest";
import { ALL_LEXICON_NAMES, getLexicon, type LexiconEntry } from "../src/engine/lexicon";

/**
 * These tests are the lint that guards the bundled lexicons. They enforce the lexicon
 * rules so that a bad entry fails the build rather than reaching a puzzle: every word
 * is three to eight lowercase letters, the precomputed letter count, vowel count, and
 * first letter agree with the word, words are unique within a lexicon, and no two
 * entries in a lexicon differ only by a plural ending. They also require each lexicon
 * to carry enough words for variety. The metadata is trusted by the generator only
 * because these checks pass.
 */

const VOWELS = "aeiou";
const WORD_PATTERN = /^[a-z]+$/;
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 8;
const MIN_LEXICON_SIZE = 30;
const PLURAL_SUFFIXES: readonly string[] = ["s", "es"];

/**
 * Counts the vowels in a word using the same vowel set the operations use.
 * @param word The word to scan.
 * @returns The number of vowel letters.
 */
function countVowels(word: string): number {
  return [...word].filter((letter) => VOWELS.includes(letter)).length;
}

/**
 * Reports whether two words differ only by a plural ending.
 * @param singular The candidate singular word.
 * @param other The other word.
 * @returns True when the other word is the singular plus a plural ending.
 */
function isPluralTwin(singular: string, other: string): boolean {
  return PLURAL_SUFFIXES.some((suffix) => singular + suffix === other);
}

describe.each(ALL_LEXICON_NAMES)("lexicon %s", (name) => {
  const entries = getLexicon(name);

  it("carries enough words for variety", () => {
    expect(entries.length).toBeGreaterThanOrEqual(MIN_LEXICON_SIZE);
  });

  it("contains only unique words", () => {
    const words = entries.map((entry) => entry.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it("contains no plural twins", () => {
    const words = new Set(entries.map((entry) => entry.word));
    for (const word of words) {
      for (const suffix of PLURAL_SUFFIXES) {
        expect(words.has(word + suffix)).toBe(false);
      }
    }
  });

  it.each(entries)("entry $word is well formed with matching metadata", (entry: LexiconEntry) => {
    expect(entry.word).toMatch(WORD_PATTERN);
    expect(entry.word.length).toBeGreaterThanOrEqual(MIN_WORD_LENGTH);
    expect(entry.word.length).toBeLessThanOrEqual(MAX_WORD_LENGTH);
    expect(entry.letters).toBe(entry.word.length);
    expect(entry.vowels).toBe(countVowels(entry.word));
    expect(entry.first).toBe(entry.word[0]);
  });
});

describe("isPluralTwin", () => {
  it("recognizes a simple and an es plural", () => {
    expect(isPluralTwin("cat", "cats")).toBe(true);
    expect(isPluralTwin("fox", "foxes")).toBe(true);
    expect(isPluralTwin("cat", "dog")).toBe(false);
  });
});
