import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GameState } from './game';
import { MqttClient, MqttStatus } from './net/mqtt';
import {
  BROKER_URLS,
  OnlineSession,
  Player,
  RoomConfig,
  decodeConfig,
  decodePlayer,
  encodeConfig,
  encodePlayer,
  parseTopic,
  topics,
} from './online';

export type RoomStatus = MqttStatus;

/** Im Browser lässt sich zum Testen ein anderer Server angeben: `?broker=ws://…` */
function brokerUrls(): string[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const override = new URLSearchParams(window.location.search).get('broker');
      if (override) return [override];
    } catch {}
  }
  return BROKER_URLS;
}

const NOT_FOUND_AFTER_MS = 6000;

type Options = {
  session: OnlineSession | null;
  /** Beim Erstellen: diese Konfiguration nach dem Verbinden veröffentlichen. */
  createConfig: RoomConfig | null;
  game: GameState;
  onConfig: (config: RoomConfig) => void;
  /** Beim Beitreten kam keine Raum-Konfiguration: den Raum gibt es nicht. */
  onNotFound: () => void;
};

export function useOnlineRoom({ session, createConfig, game, onConfig, onNotFound }: Options) {
  const [status, setStatus] = useState<RoomStatus>('disconnected');
  const [players, setPlayers] = useState<Player[]>([]);
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const myPayloadRef = useRef<string | null>(null);
  const leftRef = useRef(false);
  const onConfigRef = useRef(onConfig);
  const onNotFoundRef = useRef(onNotFound);
  const createConfigRef = useRef(createConfig);
  useEffect(() => {
    onConfigRef.current = onConfig;
    onNotFoundRef.current = onNotFound;
    createConfigRef.current = createConfig;
  });

  const room = session?.room ?? null;
  const playerId = session?.playerId ?? null;

  // Verbindung pro Raum
  useEffect(() => {
    if (!room || !playerId) return;
    leftRef.current = false;
    const online = new Map<string, boolean>();
    const sheets = new Map<string, Omit<Player, 'online'>>();
    let gotConfig = false;
    const refresh = () =>
      setPlayers(
        [...sheets.values()]
          .filter((p) => p.id !== playerId)
          .map((p) => ({ ...p, online: online.get(p.id) ?? false })),
      );

    const client = new MqttClient({
      urls: brokerUrls(),
      clientId: `kb-${playerId}-${Math.floor(Math.random() * 1e6)}`,
      will: { topic: topics.online(room, playerId), payload: '0', retain: true },
      onStatus: setStatus,
      onConnect: () => {
        const create = createConfigRef.current;
        if (create && !gotConfig) client.publish(topics.config(room), encodeConfig(create), true);
        client.publish(topics.online(room, playerId), '1', true);
        if (myPayloadRef.current)
          client.publish(topics.player(room, playerId), myPayloadRef.current, true);
      },
      onMessage: ({ topic, payload }) => {
        const parsed = parseTopic(room, topic);
        if (!parsed) return;
        if (parsed.kind === 'config') {
          const next = decodeConfig(payload);
          if (!next) return;
          gotConfig = true;
          setConfig(next);
          onConfigRef.current(next);
        } else if (parsed.kind === 'online') {
          online.set(parsed.id, payload === '1');
          refresh();
        } else {
          const player = payload ? decodePlayer(parsed.id, payload) : null;
          if (player) sheets.set(parsed.id, player);
          else sheets.delete(parsed.id);
          refresh();
        }
      },
    });
    client.subscribe(topics.config(room));
    client.subscribe(topics.allPlayers(room));
    client.subscribe(topics.allOnline(room));
    clientRef.current = client;

    // Wer einem Raum beitritt, den es nicht gibt, bekommt nie eine Konfiguration.
    const notFoundTimer = setTimeout(() => {
      if (!gotConfig && !createConfigRef.current && client.isConnected()) onNotFoundRef.current();
    }, NOT_FOUND_AFTER_MS);

    return () => {
      clearTimeout(notFoundTimer);
      if (!leftRef.current) client.publish(topics.online(room, playerId), '0', true);
      client.close();
      clientRef.current = null;
      setPlayers([]);
      setConfig(null);
      setStatus('disconnected');
    };
  }, [room, playerId]);

  // Eigenen Stand veröffentlichen, sobald er sich ändert
  const name = session?.name ?? '';
  const round = session?.round ?? 0;
  useEffect(() => {
    if (!room || !playerId || round === 0) return;
    const payload = encodePlayer(name, round, game);
    if (payload === myPayloadRef.current) return;
    myPayloadRef.current = payload;
    clientRef.current?.publish(topics.player(room, playerId), payload, true);
  }, [room, playerId, name, round, game]);

  /** Neue Runde für alle starten. Liefert false, wenn gerade keine Verbindung besteht. */
  const startRound = useCallback(
    (variantId: string) => {
      const client = clientRef.current;
      if (!room || !client?.isConnected()) return false;
      const next: RoomConfig = { variantId, round: (config?.round ?? 0) + 1 };
      return client.publish(topics.config(room), encodeConfig(next), true);
    },
    [room, config],
  );

  /** Raum verlassen: eigenen Eintrag löschen, damit er bei anderen verschwindet. */
  const leave = useCallback(() => {
    const client = clientRef.current;
    if (!room || !playerId || !client) return;
    client.publish(topics.player(room, playerId), '', true);
    client.publish(topics.online(room, playerId), '', true);
    myPayloadRef.current = null;
    leftRef.current = true;
  }, [room, playerId]);

  return { status, players, config, startRound, leave };
}
