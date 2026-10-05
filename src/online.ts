import { MAX_PENALTIES, newGame } from './game';
import type { GameState, RowState } from './game';
import { getVariant } from './variants';
import type { VariantId } from './variants';

/**
 * Online-Spiel über einen öffentlichen MQTT-Server. Jeder Raum ist ein Themenbaum:
 *   <ROOT>/<RAUM>/config      – Block und Runde (retained)
 *   <ROOT>/<RAUM>/p/<id>      – Spielstand eines Spielers (retained)
 *   <ROOT>/<RAUM>/on/<id>     – „1“ online / „0“ offline (retained, „0“ als Last Will)
 * Retained-Nachrichten sorgen dafür, dass später Beitretende sofort alles sehen.
 */

export const BROKER_URLS = ['wss://broker.emqx.io:8084/mqtt'];

const ROOT = 'kreuzblock-7f3k/v1';

export const NAME_MAX_LENGTH = 16;

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export type OnlineSession = {
  room: string;
  playerId: string;
  name: string;
  /** Runde, zu der der eigene Block gehört; 0 = noch keine Runde übernommen. */
  round: number;
};

export type RoomConfig = { variantId: VariantId; round: number };

export type Player = {
  id: string;
  name: string;
  round: number;
  game: GameState;
  online: boolean;
};

export const topics = {
  config: (room: string) => `${ROOT}/${room}/config`,
  player: (room: string, id: string) => `${ROOT}/${room}/p/${id}`,
  online: (room: string, id: string) => `${ROOT}/${room}/on/${id}`,
  allPlayers: (room: string) => `${ROOT}/${room}/p/+`,
  allOnline: (room: string) => `${ROOT}/${room}/on/+`,
};

/** Zerlegt ein empfangenes Thema in Art und Spieler-Id. */
export function parseTopic(
  room: string,
  topic: string,
): { kind: 'config' } | { kind: 'player' | 'online'; id: string } | null {
  const prefix = `${ROOT}/${room}/`;
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  if (rest === 'config') return { kind: 'config' };
  const [kind, id, ...extra] = rest.split('/');
  if (extra.length || !id) return null;
  if (kind === 'p') return { kind: 'player', id };
  if (kind === 'on') return { kind: 'online', id };
  return null;
}

export function randomRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

export function parseRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z]/g, '');
  return code.length === 4 && [...code].every((c) => ROOM_ALPHABET.includes(c)) ? code : null;
}

export function randomPlayerId(random: () => number = Math.random): string {
  return Array.from({ length: 10 }, () => Math.floor(random() * 36).toString(36)).join('');
}

export function cleanName(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}

// ---------------------------------------------------------------------------
// Nachrichten (alles, was ankommt, ist fremde Eingabe und wird geprüft)
// ---------------------------------------------------------------------------

export function encodeConfig(config: RoomConfig): string {
  return JSON.stringify({ v: config.variantId, r: config.round });
}

export function decodeConfig(payload: string): RoomConfig | null {
  try {
    const data = JSON.parse(payload);
    if (typeof data?.v !== 'string' || !Number.isInteger(data?.r) || data.r < 1) return null;
    const variant = getVariant(data.v);
    if (variant.id !== data.v) return null;
    return { variantId: data.v, round: data.r };
  } catch {
    return null;
  }
}

/** Kompakt: pro Reihe [Bitmaske der Kreuze, selbst abgeschlossen, von anderen gesperrt]. */
export function encodePlayer(name: string, round: number, game: GameState): string {
  return JSON.stringify({
    n: name,
    r: round,
    b: game.variantId,
    s: game.rows.map((row) => [
      row.marked.reduce((mask, m, i) => (m ? mask | (1 << i) : mask), 0),
      row.locked ? 1 : 0,
      row.closedByOther ? 1 : 0,
    ]),
    f: game.penalties,
  });
}

export function decodePlayer(id: string, payload: string): Omit<Player, 'online'> | null {
  try {
    const data = JSON.parse(payload);
    if (typeof data?.n !== 'string' || !Number.isInteger(data?.r) || typeof data?.b !== 'string')
      return null;
    const variant = getVariant(data.b);
    if (variant.id !== data.b || !Array.isArray(data.s) || data.s.length !== variant.rows.length)
      return null;
    const base = newGame(variant.id);
    const rows: RowState[] = base.rows.map((row, r) => {
      const [mask, locked, closed] = data.s[r] ?? [];
      if (!Number.isInteger(mask)) throw new Error('row');
      return {
        marked: row.marked.map((_, i) => (mask & (1 << i)) !== 0),
        locked: locked === 1,
        closedByOther: closed === 1,
      };
    });
    const penalties = Math.max(0, Math.min(MAX_PENALTIES, Number(data.f) | 0));
    return {
      id,
      name: cleanName(data.n) || 'Unbekannt',
      round: data.r,
      game: { variantId: variant.id, rows, penalties },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Spielregeln über alle Spieler hinweg
// ---------------------------------------------------------------------------

/** Reihen, die ein anderer Spieler derselben Runde abgeschlossen hat. */
export function rowsLockedByOthers(players: Player[], round: number, rowCount: number): boolean[] {
  return Array.from({ length: rowCount }, (_, r) =>
    players.some((p) => p.round === round && p.game.rows[r]?.locked),
  );
}

/** Eigener Block mit allen Sperren, die von Mitspielern kommen. */
export function withRemoteLocks(game: GameState, lockedByOthers: boolean[]): GameState {
  if (!lockedByOthers.some(Boolean)) return game;
  return {
    ...game,
    rows: game.rows.map((row, r) =>
      lockedByOthers[r] && !row.locked && !row.closedByOther ? { ...row, closedByOther: true } : row,
    ),
  };
}

export function anyPlayerOutOfThrows(players: Player[], round: number): boolean {
  return players.some((p) => p.round === round && p.game.penalties >= MAX_PENALTIES);
}
