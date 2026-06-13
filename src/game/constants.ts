/**
 * Game copy constants used by the reducer to build the shareable result.
 *
 * These are the only player facing strings the pure game logic needs. Interface copy,
 * class names, and colors live with the view layer instead, so the game logic stays
 * free of presentation concerns.
 */

export const EMOJI_CRACKED = "\u{1F7E2}";
export const EMOJI_REVEALED = "\u{1F7E0}";

export const SHARE_HEADER = "Hunchday";
export const SHARE_CRACKED_LABEL = "cracked ";
export const SHARE_COUNT_SEPARATOR = "/";
export const SHARE_STAT_SEPARATOR = " · ";
export const SHARE_MISS_SUFFIX = " misses";
export const SHARE_LINE_BREAK = "\n";
