import { describe, expect, it } from "vitest";
import {
  getOp,
  OP_AFFINE,
  OP_KEEP_FIRST_K,
  OP_LENGTH_MAP,
  OP_MAX,
  OP_MUL_K,
  OP_REVERSE,
  OP_SORT_ALPHA,
  OP_SUM,
} from "../src/engine/ops";
import { TYPE_NUM, TYPE_NUM_LIST, TYPE_WORD_LIST } from "../src/engine/ops-types";
import {
  groupedTilesForType,
  OP_TILES,
  searchTiles,
  SECTION_NUMBERS,
  SECTION_VOCAB,
  sectionForType,
  tileOf,
} from "../src/ui/palette";

/**
 * These tests cover the palette tile model. Every operation becomes a recipe step
 * except affine, which multiply then add reproduces. Each tile sits in the section its
 * input type implies and carries its operation's single parameter, and the offered
 * groups follow the chip type until the chips reduce to a single terminal value.
 */

describe("palette tiles", () => {
  it("maps each tile to a real operation, with no duplicates", () => {
    const tiled = OP_TILES.map((tile) => tile.opId);
    expect(new Set(tiled).size).toBe(tiled.length);
    for (const opId of tiled) {
      expect(() => getOp(opId)).not.toThrow();
    }
  });

  it("includes every operation as a step and excludes only affine", () => {
    const tiled = new Set(OP_TILES.map((tile) => tile.opId));
    expect(tiled.has(OP_MUL_K.id)).toBe(true);
    expect(tiled.has(OP_SUM.id)).toBe(true);
    expect(tiled.has(OP_LENGTH_MAP.id)).toBe(true);
    expect(tiled.has(OP_REVERSE.id)).toBe(true);
    expect(tiled.has(OP_SORT_ALPHA.id)).toBe(true);
    expect(tiled.has(OP_AFFINE.id)).toBe(false);
  });

  it("places each tile in the section its operation input type implies", () => {
    for (const tile of OP_TILES) {
      const expected = getOp(tile.opId).inputType === TYPE_WORD_LIST ? SECTION_VOCAB : SECTION_NUMBERS;
      expect(tile.section).toBe(expected);
    }
  });

  it("carries the operation's single parameter when it has one and none otherwise", () => {
    for (const tile of OP_TILES) {
      const params = getOp(tile.opId).params;
      if (params.length === 0) {
        expect(tile.param).toBeUndefined();
      } else {
        expect(params.length).toBe(1);
        expect(tile.param).toEqual(params[0]);
      }
    }
  });

  it("looks up a tile by operation", () => {
    expect(tileOf(OP_MUL_K.id)?.opId).toBe(OP_MUL_K.id);
    expect(tileOf(OP_AFFINE.id)).toBeUndefined();
  });
});

describe("groups follow the chip type", () => {
  it("offers the numbers groups for number chips", () => {
    const groups = groupedTilesForType(TYPE_NUM_LIST);
    expect(groups.every((group) => group.tiles.every((tile) => tile.section === SECTION_NUMBERS))).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("offers the vocab groups for word chips", () => {
    const groups = groupedTilesForType(TYPE_WORD_LIST);
    expect(groups.every((group) => group.tiles.every((tile) => tile.section === SECTION_VOCAB))).toBe(true);
  });

  it("offers no groups once the chips reduce to a single terminal value", () => {
    expect(sectionForType(TYPE_NUM)).toBeNull();
    expect(groupedTilesForType(TYPE_NUM)).toHaveLength(0);
  });
});

describe("searching operations", () => {
  it("finds an operation by a synonym within the section", () => {
    const hits = searchTiles(TYPE_NUM_LIST, "double");
    expect(hits.some((tile) => tile.opId === OP_MUL_K.id)).toBe(true);
    expect(hits.every((tile) => tile.section === SECTION_NUMBERS)).toBe(true);
  });

  it("ranks a closer match ahead of a looser one", () => {
    const hits = searchTiles(TYPE_NUM_LIST, "biggest");
    expect(hits.at(0)?.opId).toBe(OP_MAX.id);
  });

  it("matches a whole tab by its label", () => {
    const hits = searchTiles(TYPE_NUM_LIST, "keep");
    expect(hits.some((tile) => tile.opId === OP_KEEP_FIRST_K.id)).toBe(true);
  });

  it("returns nothing for a blank query", () => {
    expect(searchTiles(TYPE_NUM_LIST, "   ")).toHaveLength(0);
  });
});
