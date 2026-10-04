import { getVariant } from './variants';
import type { Color, Variant, VariantId } from './variants';

export const MAX_PENALTIES = 4;
export const PENALTY_POINTS = 5;
/** Kreuze, die in einer Reihe nötig sind, bevor das letzte Feld angekreuzt werden darf. */
export const MIN_MARKS_TO_LOCK = 5;

export type RowState = {
  marked: boolean[];
  /** Selbst abgeschlossen (letztes Feld + Schloss angekreuzt). */
  locked: boolean;
  /** Von einem Mitspieler abgeschlossen – keine Kreuze mehr möglich. */
  closedByOther: boolean;
};

export type GameState = {
  variantId: VariantId;
  rows: RowState[];
  penalties: number;
};

export function newGame(variantId: VariantId): GameState {
  const variant = getVariant(variantId);
  return {
    variantId,
    rows: variant.rows.map((r) => ({
      marked: r.cells.map(() => false),
      locked: false,
      closedByOther: false,
    })),
    penalties: 0,
  };
}

export function markCount(row: RowState): number {
  return row.marked.filter(Boolean).length;
}

export function lastMarkedIndex(row: RowState): number {
  return row.marked.lastIndexOf(true);
}

export function isRowClosed(row: RowState): boolean {
  return row.locked || row.closedByOther;
}

export type CellStatus = 'marked' | 'available' | 'skipped' | 'blocked';

/**
 * marked:    angekreuzt
 * available: darf jetzt angekreuzt werden
 * skipped:   liegt links vom letzten Kreuz (übersprungen, verloren)
 * blocked:   Reihe geschlossen oder letztes Feld noch nicht erlaubt
 */
export function cellStatus(row: RowState, index: number): CellStatus {
  if (row.marked[index]) return 'marked';
  if (index < lastMarkedIndex(row)) return 'skipped';
  if (isRowClosed(row)) return 'blocked';
  const isLast = index === row.marked.length - 1;
  if (isLast && markCount(row) < MIN_MARKS_TO_LOCK) return 'blocked';
  return 'available';
}

export function canMark(row: RowState, index: number): boolean {
  return cellStatus(row, index) === 'available';
}

/** Kreuzt ein Feld an. Das letzte Feld schließt die Reihe automatisch ab (Schloss). */
export function markCell(state: GameState, rowIndex: number, cellIndex: number): GameState {
  const row = state.rows[rowIndex];
  if (!canMark(row, cellIndex)) return state;
  const marked = row.marked.map((m, i) => m || i === cellIndex);
  const locked = cellIndex === row.marked.length - 1;
  const rows = state.rows.map((r, i) => (i === rowIndex ? { ...r, marked, locked } : r));
  return { ...state, rows };
}

export function toggleClosedByOther(state: GameState, rowIndex: number): GameState {
  const row = state.rows[rowIndex];
  if (row.locked) return state;
  const rows = state.rows.map((r, i) =>
    i === rowIndex ? { ...r, closedByOther: !r.closedByOther } : r,
  );
  return { ...state, rows };
}

export function addPenalty(state: GameState): GameState {
  if (state.penalties >= MAX_PENALTIES) return state;
  return { ...state, penalties: state.penalties + 1 };
}

export function pointsForCrosses(n: number): number {
  return (n * (n + 1)) / 2;
}

export type RowScore = {
  /** Farbe des Wertungsfelds – die Farbe des Schlosses dieser Reihe. */
  color: Color;
  crosses: number;
  points: number;
};

export type Score = {
  rows: RowScore[];
  penaltyPoints: number;
  total: number;
};

/** Gewertet wird pro Reihe: angekreuzte Felder plus Schloss, egal welche Farbe die Felder haben. */
export function computeScore(state: GameState, variant: Variant): Score {
  const rows = variant.rows.map((rowDef, r) => {
    const row = state.rows[r];
    const crosses = markCount(row) + (row.locked ? 1 : 0);
    return { color: rowDef.lockColor, crosses, points: pointsForCrosses(crosses) };
  });
  const penaltyPoints = state.penalties * PENALTY_POINTS;
  const total = rows.reduce((sum, row) => sum + row.points, 0) - penaltyPoints;
  return { rows, penaltyPoints, total };
}

export function closedRowCount(state: GameState): number {
  return state.rows.filter(isRowClosed).length;
}

/** Spielende: zwei Reihen geschlossen oder vier Fehlwürfe. */
export function isGameOver(state: GameState): boolean {
  return closedRowCount(state) >= 2 || state.penalties >= MAX_PENALTIES;
}
