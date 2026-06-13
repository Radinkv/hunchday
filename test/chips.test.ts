import { describe, expect, it } from "vitest";
import { TYPE_NUM_LIST, TYPE_WORD_LIST } from "../src/engine/ops-types";
import { OP_LENGTH_MAP, OP_MUL_K, OP_SUM } from "../src/engine/ops";
import {
  answerOf,
  applyOp,
  bringBack,
  reorder,
  seedChips,
  setAside,
  workType,
  type ChipState,
} from "../src/ui/chips";

/**
 * These tests cover the stateful chip model. Seeding fills the work lane, operations act
 * only on the work lane and leave the set aside lane frozen, lane moves preserve chip
 * values and order, and the answer is the work lane joined in order.
 */

/**
 * Returns the work lane values of a state.
 * @param state The builder state.
 * @returns The work chip values in order.
 */
function work(state: ChipState): Array<number | string> {
  return state.work.map((chip) => chip.value);
}

/**
 * Returns the set aside values of a state.
 * @param state The builder state.
 * @returns The set aside chip values in order.
 */
function bucket(state: ChipState): Array<number | string> {
  return state.bucket.map((chip) => chip.value);
}

describe("seedChips", () => {
  it("fills the work lane with number chips for a numeric input", () => {
    const state = seedChips("3 1 4");
    expect(work(state)).toEqual([3, 1, 4]);
    expect(state.bucket).toHaveLength(0);
    expect(workType(state)).toBe(TYPE_NUM_LIST);
  });

  it("fills the work lane with word chips for a word input", () => {
    const state = seedChips("dog ant");
    expect(work(state)).toEqual(["dog", "ant"]);
    expect(workType(state)).toBe(TYPE_WORD_LIST);
  });
});

describe("applyOp", () => {
  it("transforms every work chip for a map and keeps the count", () => {
    const state = applyOp(seedChips("2 5"), OP_MUL_K.id, { k: 2 });
    expect(work(state)).toEqual([4, 10]);
  });

  it("reduces the work lane to a single chip for a reducer", () => {
    const state = applyOp(seedChips("3 1 4"), OP_SUM.id, {});
    expect(work(state)).toEqual([8]);
  });

  it("translates word chips into number chips", () => {
    const state = applyOp(seedChips("ox cat horse"), OP_LENGTH_MAP.id, {});
    expect(work(state)).toEqual([2, 3, 5]);
    expect(workType(state)).toBe(TYPE_NUM_LIST);
  });
});

describe("set aside lane freezes chips", () => {
  it("leaves a set aside chip untouched while the work lane is transformed", () => {
    const seeded = seedChips("2 5 9");
    const aside = setAside(seeded, seeded.work[1].id);
    expect(work(aside)).toEqual([2, 9]);
    expect(bucket(aside)).toEqual([5]);

    const transformed = applyOp(aside, OP_MUL_K.id, { k: 2 });
    expect(work(transformed)).toEqual([4, 18]);
    expect(bucket(transformed)).toEqual([5]);

    const returned = bringBack(transformed, seeded.work[1].id, 1);
    expect(work(returned)).toEqual([4, 5, 18]);
    expect(returned.bucket).toHaveLength(0);
  });
});

describe("reorder and answer", () => {
  it("moves a work chip to a new position", () => {
    const seeded = seedChips("1 2 3");
    const moved = reorder(seeded, seeded.work[0].id, 2);
    expect(work(moved)).toEqual([2, 3, 1]);
  });

  it("builds the answer from the work lane in order", () => {
    const seeded = seedChips("7 8 9");
    const aside = setAside(seeded, seeded.work[0].id);
    expect(answerOf(aside)).toBe("8 9");
  });
});
