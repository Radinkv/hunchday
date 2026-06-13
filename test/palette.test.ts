import { describe, expect, it } from "vitest";
import { run, step } from "../src/engine/compose";
import { getOp, OP_AFFINE, REGISTRY } from "../src/engine/ops";
import { TYPE_NUM, TYPE_NUM_LIST, TYPE_WORD_LIST } from "../src/engine/ops-types";
import {
  OP_LENGTH_MAP,
  OP_MUL_K,
  OP_REVERSE,
  OP_SORT_ALPHA,
  OP_SUM,
} from "../src/engine/ops";
import {
  applyTrail,
  OP_TILES,
  SECTION_NUMBERS,
  SECTION_VOCAB,
  sectionForType,
  seedTypeOf,
  tilesForType,
  typeAfter,
} from "../src/ui/palette";

/**
 * These tests cover the headless palette model and the apply-trail core that the answer
 * builder is built on. Every operation except affine must map to exactly one tile in the
 * section its input type implies, each tile must carry its operation's single parameter,
 * the trail fold must reproduce the engine's own execution, and the running value type
 * must drive which tiles are offered until the chips become terminal.
 */

const AFFINE_EXCLUDED_COUNT = 1;

describe("palette tiles", () => {
  it("covers every operation except affine, exactly once", () => {
    const tiled = new Set(OP_TILES.map((tile) => tile.opId));
    expect(tiled.size).toBe(OP_TILES.length);
    expect(OP_TILES.length).toBe(REGISTRY.length - AFFINE_EXCLUDED_COUNT);
    expect(tiled.has(OP_AFFINE.id)).toBe(false);
    for (const op of REGISTRY) {
      if (op.id === OP_AFFINE.id) continue;
      expect(tiled.has(op.id)).toBe(true);
    }
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
});

describe("applyTrail", () => {
  it("reproduces the engine execution for a numeric pipeline", () => {
    const steps = [step(OP_MUL_K, { k: 2 }), step(OP_REVERSE), step(OP_SUM)];
    const input = [3, 1, 4, 1];
    expect(applyTrail(input, steps)).toEqual(run(steps, input));
  });

  it("reproduces the engine execution for a word pipeline", () => {
    const steps = [step(OP_SORT_ALPHA), step(OP_LENGTH_MAP)];
    const input = ["dog", "ant", "cat"];
    expect(applyTrail(input, steps)).toEqual(run(steps, input));
  });

  it("returns the seed unchanged for an empty trail", () => {
    expect(applyTrail([5, 6, 7], [])).toEqual([5, 6, 7]);
  });
});

describe("running type drives the offered tiles", () => {
  it("offers the numbers section for number chips", () => {
    expect(seedTypeOf([1, 2, 3])).toBe(TYPE_NUM_LIST);
    expect(sectionForType(TYPE_NUM_LIST)).toBe(SECTION_NUMBERS);
    expect(tilesForType(TYPE_NUM_LIST).every((tile) => tile.section === SECTION_NUMBERS)).toBe(true);
  });

  it("offers the vocab section for word chips and flips to numbers after a translate", () => {
    expect(seedTypeOf(["a", "bb"])).toBe(TYPE_WORD_LIST);
    expect(sectionForType(TYPE_WORD_LIST)).toBe(SECTION_VOCAB);
    expect(typeAfter(TYPE_WORD_LIST, [step(OP_LENGTH_MAP)])).toBe(TYPE_NUM_LIST);
  });

  it("offers no tiles once a reducer makes the chips terminal", () => {
    const terminal = typeAfter(TYPE_NUM_LIST, [step(OP_SUM)]);
    expect(terminal).toBe(TYPE_NUM);
    expect(sectionForType(terminal)).toBeNull();
    expect(tilesForType(terminal)).toHaveLength(0);
  });
});
