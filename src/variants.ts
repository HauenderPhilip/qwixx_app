export type Color = 'red' | 'yellow' | 'green' | 'blue';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

export type Cell = { number: number; color: Color };

export type RowDef = {
  cells: Cell[];
  /** Farbe des Schlosses und des Wertungsfelds der Reihe. */
  lockColor: Color;
};

export type Variant = {
  id: VariantId;
  name: string;
  description: string;
  rows: RowDef[];
};

/** Feste Blöcke haben einen Namen als Id, Zufallsblöcke `random:<Code>` (z. B. `random:M4821`). */
export type VariantId = string;

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
const ZIGZAG_OUT = [2, 12, 3, 11, 4, 10, 5, 9, 6, 8, 7];
const ZIGZAG_IN = [7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12];

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
  {
    id: 'mirrored',
    name: 'Gespiegelt',
    description: 'Wie klassisch, nur andersherum: Rot & Gelb absteigend, Grün & Blau aufsteigend.',
    rows: [row(R, DESC), row(Y, DESC), row(G, ASC), row(B, ASC)],
  },
  {
    id: 'zigzag',
    name: 'Zickzack',
    description:
      'Rot & Gelb springen von außen nach innen und enden bei der 7, Grün & Blau von innen nach außen.',
    rows: [row(R, ZIGZAG_OUT), row(Y, ZIGZAG_OUT), row(G, ZIGZAG_IN), row(B, ZIGZAG_IN)],
  },
];

export function getVariant(id: VariantId): Variant {
  if (id.startsWith(RANDOM_PREFIX)) {
    const code = parseRandomCode(id.slice(RANDOM_PREFIX.length));
    if (code) {
      if (!randomVariantCache.has(code)) randomVariantCache.set(code, generateRandomVariant(code));
      return randomVariantCache.get(code)!;
    }
  }
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}

// ---------------------------------------------------------------------------
// Zufallsblock
// ---------------------------------------------------------------------------

/** Z = Zahlen gemischt, F = Farben gemischt, M = beides gemischt. */
export type RandomMode = 'Z' | 'F' | 'M';

export const RANDOM_MODES: { mode: RandomMode; label: string }[] = [
  { mode: 'Z', label: 'Zahlen' },
  { mode: 'F', label: 'Farben' },
  { mode: 'M', label: 'Beides' },
];

const RANDOM_PREFIX = 'random:';

/** Normalisiert Eingaben wie „m 4821“ oder „M-4821“ zu „M4821“; ungültig → null. */
export function parseRandomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[ZFM]\d{4}$/.test(code) ? code : null;
}

export function formatRandomCode(code: string): string {
  return `${code[0]}-${code.slice(1)}`;
}

export function randomVariantId(mode: RandomMode, random: () => number = Math.random): VariantId {
  const digits = String(Math.floor(random() * 10000)).padStart(4, '0');
  return RANDOM_PREFIX + mode + digits;
}

export function randomCodeOf(id: VariantId): string | null {
  return id.startsWith(RANDOM_PREFIX) ? parseRandomCode(id.slice(RANDOM_PREFIX.length)) : null;
}

/** Deterministischer Zufallsgenerator, damit derselbe Code überall denselben Block ergibt. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Alle Aufteilungen einer Reihe in 4 Farbabschnitte mit je 2–4 Feldern. */
const SEGMENT_LENGTHS: number[][] = (() => {
  const result: number[][] = [];
  for (const a of [2, 3, 4])
    for (const b of [2, 3, 4])
      for (const c of [2, 3, 4]) {
        const d = 11 - a - b - c;
        if (d >= 2 && d <= 4) result.push([a, b, c, d]);
      }
  return result;
})();

/**
 * Jede Reihe besteht aus 4 Farbabschnitten (jede Farbe einmal). Jede Farbe soll insgesamt 11 Felder
 * haben und jede Reihe mit einer anderen Farbe enden. Die ersten drei Reihen sind zufällig, die
 * letzte gleicht die Farbsummen aus.
 */
function randomColorLayout(random: () => number): Color[][] {
  const expand = (order: Color[], lengths: number[]) =>
    order.flatMap((color, i) => Array<Color>(lengths[i]).fill(color));
  for (;;) {
    const rows = [0, 1, 2].map(() =>
      expand(
        shuffle(COLORS, random),
        SEGMENT_LENGTHS[Math.floor(random() * SEGMENT_LENGTHS.length)],
      ),
    );
    const lastColors = rows.map((r) => r[r.length - 1]);
    if (new Set(lastColors).size !== 3) continue;
    const need = COLORS.map((color) => 11 - rows.flat().filter((c) => c === color).length);
    if (need.some((n) => n < 2 || n > 4)) continue;
    const finalColor = COLORS.find((c) => !lastColors.includes(c))!;
    const order = [...shuffle(COLORS.filter((c) => c !== finalColor), random), finalColor];
    rows.push(expand(order, order.map((c) => need[COLORS.indexOf(c)])));
    return rows;
  }
}

const randomVariantCache = new Map<string, Variant>();

function generateRandomVariant(code: string): Variant {
  const random = mulberry32(hashCode(code));
  const mode = code[0] as RandomMode;
  const mixNumbers = mode === 'Z' || mode === 'M';
  const mixColors = mode === 'F' || mode === 'M';

  const numbers = COLORS.map((_, r) =>
    mixNumbers ? shuffle(ASC, random) : r < 2 ? ASC : DESC,
  );
  const colors = mixColors
    ? randomColorLayout(random)
    : COLORS.map((color) => Array<Color>(11).fill(color));

  const label = RANDOM_MODES.find((m) => m.mode === mode)?.label ?? '';
  return {
    id: RANDOM_PREFIX + code,
    name: 'Zufallsblock',
    description: `${label} gemischt · Code ${formatRandomCode(code)}`,
    rows: numbers.map((nums, r) => ({
      cells: nums.map((number, c) => ({ number, color: colors[r][c] })),
      lockColor: colors[r][10],
    })),
  };
}
