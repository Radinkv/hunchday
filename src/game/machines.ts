import type { Machine } from "./types";

/**
 * The prototype's machine set, lifted from the original inline script in index.html.
 * A later phase will replace this with a generated day specification produced for the
 * current date. Until then it is the fixture that the interface parity tests pin
 * against. The data is frozen as a readonly tuple so the literal types are preserved
 * and the set cannot be mutated at runtime. The difficulties are illustrative spreads
 * for the fixture rather than measured, since these rules predate the difficulty model.
 */
export const MACHINES = [
  {
    difficulty: "easy",
    rule: "It doubles every chip.",
    ex: [["1 2", "2 4"], ["5", "10"]],
    ch: [["3 4", "6 8"], ["10", "20"], ["0 1", "0 2"], ["7", "14"], ["2 6", "4 12"]],
  },
  {
    difficulty: "easy",
    rule: "It reverses the order.",
    ex: [["1 2 3", "3 2 1"], ["7 8", "8 7"]],
    ch: [["4 5 6", "6 5 4"], ["9 9 1", "1 9 9"], ["2 0", "0 2"], ["5 6 7 8", "8 7 6 5"], ["3 1", "1 3"]],
  },
  {
    difficulty: "easy",
    rule: "It counts how many chips went in.",
    ex: [["4 4 4", "3"], ["9", "1"]],
    ch: [["1 2 3 4 5", "5"], ["0 0", "2"], ["7 7 7 7", "4"], ["3", "1"], ["8 8 8 8 8 8", "6"]],
  },
  {
    difficulty: "easy",
    rule: "It adds all the chips together.",
    ex: [["3 1", "4"], ["2 2 2", "6"]],
    ch: [["5 5", "10"], ["1 2 3", "6"], ["9", "9"], ["4 4 1", "9"], ["10 10", "20"]],
  },
  {
    difficulty: "medium",
    rule: "It adds up only the even chips.",
    ex: [["1 2 3 4", "6"], ["5 5", "0"]],
    ch: [["6 1", "6"], ["2 2 9", "4"], ["8", "8"], ["3 4 4 3", "8"], ["7 7 7", "0"]],
  },
  {
    difficulty: "medium",
    rule: "Biggest chip minus smallest chip.",
    ex: [["3 9 1", "8"], ["5 5", "0"]],
    ch: [["10 2 4", "8"], ["7 1", "6"], ["6 6 2", "4"], ["1 12", "11"], ["9 3 9", "6"]],
  },
  {
    difficulty: "medium",
    rule: "It counts the letters in the word.",
    ex: [["cat", "3"], ["house", "5"]],
    ch: [["zebra", "5"], ["ox", "2"], ["rabbit", "6"], ["bee", "3"], ["elephant", "8"]],
  },
  {
    difficulty: "hard",
    rule: "It keeps only chips bigger than the first one.",
    ex: [["3 5 1 4", "5 4"], ["6 2 9", "9"]],
    ch: [["4 9 1 6", "9 6"], ["5 3 8", "8"], ["2 1 7 3", "7 3"], ["10 4 12", "12"], ["1 5 2", "5 2"]],
  },
  {
    difficulty: "hard",
    rule: "It sorts the chips and throws away duplicates.",
    ex: [["3 1 3", "1 3"], ["2 2 2", "2"]],
    ch: [["5 1 5 4", "1 4 5"], ["9 9 3", "3 9"], ["4 2 4 2", "2 4"], ["8 1 8", "1 8"], ["6 3 3 1", "1 3 6"]],
  },
  {
    difficulty: "mystery",
    rule: "It adds the digits of the number together.",
    ex: [["23", "5"], ["19", "10"]],
    ch: [["47", "11"], ["88", "16"], ["30", "3"], ["56", "11"], ["72", "9"]],
  },
] as const satisfies readonly Machine[];
