export type Color = 'red' | 'yellow' | 'green' | 'blue';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

export type Cell = { number: number; color: Color };

export type RowDef = {
  cells: Cell[];
  /** Farbe des Schlosses: zählt beim Abschließen als zusätzliches Kreuz dieser Farbe. */
  lockColor: Color;
};

export type Variant = {
  id: VariantId;
  name: string;
  description: string;
  rows: RowDef[];
};

export type VariantId = 'classic' | 'mixx-numbers' | 'mixx-colors';

const R: Color = 'red';
const Y: Color = 'yellow';
const G: Color = 'green';
const B: Color = 'blue';

function row(color: Color, numbers: number[]): RowDef {
  return { cells: numbers.map((number) => ({ number, color })), lockColor: color };
}

function mixedRow(lockColor: Color, cells: [number, Color][]): RowDef {
  return { cells: cells.map(([number, color]) => ({ number, color })), lockColor };
}

const ASC = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DESC = [...ASC].reverse();

export const VARIANTS: Variant[] = [
  {
    id: 'classic',
    name: 'Klassisch',
    description: 'Rot & Gelb aufsteigend, Grün & Blau absteigend.',
    rows: [row(R, ASC), row(Y, ASC), row(G, DESC), row(B, DESC)],
  },
  {
    id: 'mixx-numbers',
    name: 'Gemischte Zahlen',
    description: 'Jede Reihe einfarbig, die Zahlen sind durcheinander.',
    rows: [
      row(R, [10, 6, 2, 8, 3, 4, 12, 5, 9, 7, 11]),
      row(Y, [9, 12, 4, 6, 7, 2, 5, 8, 11, 3, 10]),
      row(G, [8, 2, 10, 12, 6, 9, 7, 4, 5, 11, 3]),
      row(B, [5, 7, 11, 9, 12, 3, 8, 10, 2, 6, 4]),
    ],
  },
  {
    id: 'mixx-colors',
    name: 'Gemischte Farben',
    description: 'Zahlen geordnet, aber die Farben wechseln innerhalb der Reihen.',
    rows: [
      mixedRow(R, [[2, Y], [3, Y], [4, Y], [5, B], [6, B], [7, B], [8, G], [9, G], [10, G], [11, R], [12, R]]),
      mixedRow(Y, [[2, R], [3, R], [4, G], [5, G], [6, G], [7, G], [8, B], [9, B], [10, Y], [11, Y], [12, Y]]),
      mixedRow(G, [[12, B], [11, B], [10, B], [9, Y], [8, Y], [7, Y], [6, R], [5, R], [4, R], [3, G], [2, G]]),
      mixedRow(B, [[12, G], [11, G], [10, R], [9, R], [8, R], [7, R], [6, Y], [5, Y], [4, B], [3, B], [2, B]]),
    ],
  },
];

export function getVariant(id: VariantId): Variant {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}
