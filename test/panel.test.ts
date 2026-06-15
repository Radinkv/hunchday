import { describe, expect, it } from "vitest";
import { generateDay } from "../src/engine/generate";
import { computePanelOps, PANEL_TARGET_EASY } from "../src/engine/panel";
import { OP_ADD_K, OP_AFFINE, OP_MUL_K } from "../src/engine/ops";

/**
 * These tests guard the operation panel's contract. The panel is baked at build time and
 * shared by every player, so the same date must produce the same panel in the same order:
 * the determinism guarantee the social layer rests on. The true operation must always be
 * present so the puzzle stays solvable from the panel, an easy panel must never fall below
 * its target so the list never looks suspiciously short, and the true operation must not
 * sit at a predictable position, which would leak the answer to anyone who noticed.
 */

const EPOCH = "2026-06-16";
const SAMPLE_DAYS = 16;
const SUPER_EASY_SLOT = 0;
const EASY_SLOT = 1;
const MS_PER_DAY = 86400000;
const FRONT_POSITION_BOUND = 3;
const MIN_DISTINCT_POSITIONS = 3;

/**
 * Shifts a date by a number of days in coordinated universal time.
 * @param date The starting date.
 * @param days The number of days to add.
 * @returns The shifted date string.
 */
function shiftDate(date: string, days: number): string {
  const parts = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(parts.at(0) ?? 0, (parts.at(1) ?? 1) - 1, parts.at(2) ?? 1) + days * MS_PER_DAY);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** The sample dates the panel guards run over. */
const SAMPLE_DATES: readonly string[] = Array.from({ length: SAMPLE_DAYS }, (_value, index) => shiftDate(EPOCH, index));

/**
 * Returns the tile operations that build a pipeline operation, expanding the affine map
 * to the multiply and add a player would use in its place.
 * @param opId The pipeline operation identifier.
 * @returns The tile operations.
 */
function tileOpIdsOf(opId: string): readonly string[] {
  return opId === OP_AFFINE.id ? [OP_MUL_K.id, OP_ADD_K.id] : [opId];
}

describe("operation panel", () => {
  it("produces an identical panel, in identical order, for the same date", () => {
    for (const date of SAMPLE_DATES) {
      const spec = generateDay(date);
      const openerPanel = new Set(spec.machines[SUPER_EASY_SLOT].panelOps);
      spec.machines.forEach((machine, slot) => {
        const inputs = machine.examples.map((pair) => pair.input);
        const avoid = slot === EASY_SLOT ? openerPanel : undefined;
        const first = computePanelOps(machine.steps, machine.difficulty, inputs, date, avoid);
        const second = computePanelOps(machine.steps, machine.difficulty, inputs, date, avoid);
        expect(first).toEqual(second);
        expect(machine.panelOps).toEqual(first);
      });
    }
  });

  it("always includes the operations that build the true rule", () => {
    for (const date of SAMPLE_DATES) {
      for (const machine of generateDay(date).machines) {
        const panel = new Set(machine.panelOps);
        for (const aStep of machine.steps) {
          for (const tileId of tileOpIdsOf(aStep.opId)) {
            expect(panel.has(tileId)).toBe(true);
          }
        }
      }
    }
  });

  it("never leaves an easy panel below its target", () => {
    for (const date of SAMPLE_DATES) {
      const easy = generateDay(date).machines[EASY_SLOT];
      expect(easy.panelOps.length).toBeGreaterThanOrEqual(PANEL_TARGET_EASY);
    }
  });

  it("does not place the true operation at a predictable position", () => {
    const positions = SAMPLE_DATES.map((date) => {
      const easy = generateDay(date).machines[EASY_SLOT];
      return easy.panelOps.indexOf(easy.steps[0].opId);
    });
    expect(Math.max(...positions)).toBeGreaterThanOrEqual(FRONT_POSITION_BOUND);
    expect(new Set(positions).size).toBeGreaterThanOrEqual(MIN_DISTINCT_POSITIONS);
  });
});
