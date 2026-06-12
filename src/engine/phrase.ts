/**
 * Renders a pipeline as the plain English sentence shown on the reveal screen.
 *
 * Each operation carries a phrase fragment written to stand on its own, such as
 * "keeps only the even chips" or "adds all the chips together". The phraser joins the
 * fragments of a pipeline into one sentence that begins with "It" and separates the
 * clauses with "then", for example "It keeps only the even chips, then adds them
 * together."
 *
 * A fragment written for standalone use names the whole collection of chips, but once
 * an operation follows another the chips it works on are the result of the previous
 * clause, which reads naturally as "them". So in every clause after the first the
 * phraser rewrites a reference to the whole collection into the pronoun. The first
 * clause is left untouched, since there the chips are the original input.
 */

import type { Pipeline } from "./compose";

const SENTENCE_PREFIX = "It ";
const CLAUSE_SEPARATOR = ", then ";
const SENTENCE_TERMINATOR = ".";

/** The pronoun a continuation clause uses in place of the whole collection of chips. */
const COLLECTION_PRONOUN = "them";

/**
 * References to the whole collection of chips, in the order they must be replaced.
 * The longer phrase comes first so that replacing the shorter one cannot leave a
 * dangling word behind, for example so "all the chips" does not become "all them".
 */
const COLLECTION_REFERENCES: readonly string[] = ["all the chips", "the chips", "every chip"];

/**
 * Rewrites a standalone fragment into the form used when it follows another clause,
 * replacing a reference to the whole collection of chips with the pronoun.
 * @param fragment The standalone phrase fragment.
 * @returns The fragment phrased as a continuation.
 */
function asContinuation(fragment: string): string {
  let result = fragment;
  for (const reference of COLLECTION_REFERENCES) {
    result = result.split(reference).join(COLLECTION_PRONOUN);
  }
  return result;
}

/**
 * Renders a pipeline as a single reveal sentence. The first operation's
 * fragment is used as written and each later fragment is phrased as a continuation,
 * then all clauses are joined and terminated.
 * @param pipeline The compiled pipeline to describe.
 * @returns The reveal sentence.
 */
export function phrasePipeline(pipeline: Pipeline): string {
  const clauses = pipeline.ops.map((op, index) => {
    const fragment = op.phrase(pipeline.steps[index].params);
    return index === 0 ? fragment : asContinuation(fragment);
  });
  return SENTENCE_PREFIX + clauses.join(CLAUSE_SEPARATOR) + SENTENCE_TERMINATOR;
}
