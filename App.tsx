import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NewGameModal } from './src/components/NewGameModal';
import { OnlineModal } from './src/components/OnlineModal';
import { RowView } from './src/components/RowView';
import { ScoreBar } from './src/components/ScoreBar';
import {
  GameState,
  MAX_PENALTIES,
  MIN_MARKS_TO_LOCK,
  PENALTY_POINTS,
  addPenalty,
  canMark,
  computeScore,
  isGameOver,
  markCell,
  newGame,
  toggleClosedByOther,
} from './src/game';
import {
  OnlineSession,
  RoomConfig,
  anyPlayerOutOfThrows,
  randomPlayerId,
  randomRoomCode,
  rowsLockedByOthers,
  withRemoteLocks,
} from './src/online';
import { DISCLAIMER, UI } from './src/theme';
import { useOnlineRoom } from './src/useOnlineRoom';
import { VariantId, formatRandomCode, getVariant, randomCodeOf } from './src/variants';

const STORAGE_KEY = 'kreuzblock/v1';
const MAX_HISTORY = 200;
const PADDING = 12;
const GAP = 12;
const ROW_GAP = 6;
const SIDE_PANEL_CELLS = 2.6;

type Profile = { playerId: string; name: string };

type Saved = {
  game: GameState;
  history: GameState[];
  profile?: Profile;
  session?: OnlineSession | null;
  createConfig?: RoomConfig | null;
};

type Standing = { id: string; name: string; total: number; online: boolean; isMe: boolean };

export default function App() {
  return (
    <SafeAreaProvider>
      <ScoreSheetScreen />
    </SafeAreaProvider>
  );
}

function ScoreSheetScreen() {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<GameState>(() => newGame('classic'));
  const [history, setHistory] = useState<GameState[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => ({ playerId: randomPlayerId(), name: '' }));
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [createConfig, setCreateConfig] = useState<RoomConfig | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Saved;
        if (saved?.game?.rows) {
          setGame(saved.game);
          setHistory(saved.history ?? []);
        }
        if (saved?.profile?.playerId) setProfile(saved.profile);
        if (saved?.session) setSession(saved.session);
        if (saved?.createConfig) setCreateConfig(saved.createConfig);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const saved: Saved = { game, history, profile, session, createConfig };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [game, history, profile, session, createConfig, loaded]);

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  // Neue Runde im Raum: alle übernehmen Block und Rundennummer.
  const onConfig = useCallback((config: RoomConfig) => {
    // Der Raum existiert jetzt auf dem Server; die Erstell-Konfiguration ist erledigt.
    setCreateConfig(null);
    const current = sessionRef.current;
    if (!current || current.round === config.round) return;
    setGame(newGame(config.variantId));
    setHistory([]);
    setSession({ ...current, round: config.round });
  }, []);

  const onNotFound = useCallback(() => {
    const current = sessionRef.current;
    setOnlineError(`Den Raum ${current?.room ?? ''} gibt es nicht. Prüfe den Code.`);
    setSession(null);
    setShowOnline(true);
  }, []);

  const room = useOnlineRoom({ session, createConfig, game, onConfig, onNotFound });

  const createRoom = (name: string) => {
    const config: RoomConfig = { variantId: game.variantId, round: 1 };
    setProfile((p) => ({ ...p, name }));
    setOnlineError(null);
    setCreateConfig(config);
    setGame(newGame(config.variantId));
    setHistory([]);
    setSession({ room: randomRoomCode(), playerId: profile.playerId, name, round: 1 });
  };

  const joinRoom = (name: string, code: string) => {
    setProfile((p) => ({ ...p, name }));
    setOnlineError(null);
    setCreateConfig(null);
    setSession({ room: code, playerId: profile.playerId, name, round: 0 });
  };

  const leaveRoom = () => {
    room.leave();
    setSession(null);
    setCreateConfig(null);
  };

  const variant = useMemo(() => getVariant(game.variantId), [game.variantId]);
  const randomCode = randomCodeOf(game.variantId);
  const score = useMemo(() => computeScore(game, variant), [game, variant]);

  // Online: Reihen, die ein Mitspieler abgeschlossen hat, sind auch bei mir zu.
  const inRound = session && session.round > 0 ? session.round : null;
  const lockedByOthers = useMemo(
    () => (inRound ? rowsLockedByOthers(room.players, inRound, game.rows.length) : []),
    [room.players, inRound, game.rows.length],
  );
  const sheet = useMemo(() => withRemoteLocks(game, lockedByOthers), [game, lockedByOthers]);
  const gameOver =
    isGameOver(sheet) || (inRound !== null && anyPlayerOutOfThrows(room.players, inRound));

  const standings = useMemo<Standing[]>(() => {
    if (!session) return [];
    const others = room.players
      .filter((p) => p.round === session.round)
      .map((p) => ({
        id: p.id,
        name: p.name,
        total: computeScore(p.game, getVariant(p.game.variantId)).total,
        online: p.online,
        isMe: false,
      }));
    const me = { id: session.playerId, name: session.name, total: score.total, online: true, isMe: true };
    return [me, ...others].sort((a, b) => b.total - a.total);
  }, [session, room.players, score.total]);

  const apply = (next: GameState) => {
    if (next === game) return;
    setHistory((h) => [...h, game].slice(-MAX_HISTORY));
    setGame(next);
  };

  const undo = () => {
    if (history.length === 0) return;
    setGame(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const startNewGame = (id: VariantId) => {
    setShowNewGame(false);
    if (session) {
      if (!room.startRound(id)) setNotice('Keine Verbindung – neue Runde nicht gestartet.');
      return;
    }
    setGame(newGame(id));
    setHistory([]);
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Zellgröße so wählen, dass Block + Wertung auf den Bildschirm passen.
  const availW = width - insets.left - insets.right - PADDING * 2 - GAP;
  const availH = height - insets.top - insets.bottom - PADDING * 2 - ROW_GAP * 3 - GAP;
  const size = Math.floor(Math.min(availW / (12 + SIDE_PANEL_CELLS), availH / 4.95));

  // Im Browser lässt sich das Querformat nicht erzwingen.
  if (height > width) {
    return (
      <View style={[styles.screen, styles.rotateHint]}>
        <Text style={styles.rotateIcon}>⟳</Text>
        <Text style={styles.rotateText}>Bitte das Handy quer halten</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + PADDING,
          paddingBottom: insets.bottom + PADDING,
          paddingLeft: insets.left + PADDING,
          paddingRight: insets.right + PADDING,
        },
      ]}
    >
      <StatusBar hidden />
      <View style={styles.content}>
        <View style={styles.main}>
          <View style={{ gap: ROW_GAP }}>
            {variant.rows.map((rowDef, r) => (
              <RowView
                key={r}
                def={rowDef}
                state={sheet.rows[r]}
                size={size}
                onMark={(c) => canMark(sheet.rows[r], c) && apply(markCell(game, r, c))}
                onLockPress={() => apply(toggleClosedByOther(game, r))}
              />
            ))}
          </View>
          <View style={{ marginTop: GAP }}>
            <ScoreBar score={score} size={size} gameOver={gameOver} />
          </View>
        </View>

        <View style={[styles.side, { width: size * SIDE_PANEL_CELLS }]}>
          <View style={styles.titleRow}>
            <Text style={styles.variantName} numberOfLines={2}>
              {variant.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regeln"
              onPress={() => setShowHelp(true)}
              style={styles.helpButton}
            >
              <Text style={styles.helpButtonText}>?</Text>
            </Pressable>
          </View>
          {session && (
            <View style={styles.standings}>
              <Text style={styles.label}>
                Raum {session.room}
                {room.status === 'connected' ? '' : ' · offline'}
              </Text>
              {standings.slice(0, 6).map((p, i) => (
                <View key={p.id} style={styles.standingRow}>
                  <View style={[styles.dot, !p.online && styles.dotOff]} />
                  <Text
                    style={[styles.standingName, p.isMe && styles.standingMe]}
                    numberOfLines={1}
                  >
                    {gameOver && i === 0 ? '🏆 ' : ''}
                    {p.name}
                  </Text>
                  <Text style={[styles.standingTotal, p.isMe && styles.standingMe]}>
                    {p.total}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {randomCode && (
            <View>
              <Text style={styles.label}>Code für Mitspieler</Text>
              <Text style={styles.code} selectable>
                {formatRandomCode(randomCode)}
              </Text>
            </View>
          )}

          <View>
            <Text style={styles.label}>Fehlwürfe je −{PENALTY_POINTS}</Text>
            <View style={styles.penalties}>
              {Array.from({ length: MAX_PENALTIES }, (_, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Fehlwurf ${i + 1}`}
                  disabled={i !== game.penalties}
                  onPress={() => apply(addPenalty(game))}
                  style={[
                    styles.penaltyBox,
                    { width: size * 0.55, height: size * 0.55 },
                    i === game.penalties && styles.penaltyNext,
                  ]}
                >
                  {i < game.penalties && (
                    <Text style={[styles.penaltyCross, { fontSize: size * 0.45 }]}>✕</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {gameOver && <Text style={styles.gameOver}>Spielende!</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <View style={styles.buttons}>
            <SideButton label="↶ Rückgängig" onPress={undo} disabled={history.length === 0} />
            <SideButton
              label={session ? 'Neue Runde' : 'Neues Spiel'}
              onPress={() => setShowNewGame(true)}
            />
            <SideButton
              label={session ? 'Online-Raum' : 'Online spielen'}
              onPress={() => setShowOnline(true)}
              subtle
            />
          </View>
        </View>
      </View>

      <NewGameModal
        visible={showNewGame}
        currentVariant={game.variantId}
        onSelect={startNewGame}
        onCancel={() => setShowNewGame(false)}
        online={session !== null}
      />
      <OnlineModal
        visible={showOnline}
        session={session}
        status={room.status}
        defaultName={profile.name}
        blockName={variant.name}
        error={onlineError}
        onCreate={(name) => {
          createRoom(name);
        }}
        onJoin={joinRoom}
        onLeave={leaveRoom}
        onClose={() => setShowOnline(false)}
      />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

function SideButton({
  label,
  onPress,
  disabled,
  subtle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        subtle && styles.buttonSubtle,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, subtle && styles.buttonTextSubtle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpBackdrop} onPress={onClose}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>So funktioniert der Block</Text>
          <Text style={styles.helpText}>
            • Kreuze immer von links nach rechts. Übersprungene Felder werden ausgegraut.{'\n'}
            • Das letzte Feld einer Reihe ist erst ab {MIN_MARKS_TO_LOCK} Kreuzen in dieser Reihe
            frei. Kreuzt du es an, wird die Reihe abgeschlossen und das Schloss zählt als
            zusätzliches Kreuz in dieser Reihe.{'\n'}
            • Schließt ein Mitspieler eine Reihe ab, tippe auf das Schloss dieser Reihe – sie wird
            für dich gesperrt (erneut tippen hebt das wieder auf).{'\n'}
            • Gewertet wird pro Reihe, auch wenn die Felder einer Reihe verschiedene Farben haben.
            {'\n'}• Zufallsblock: Unter „Neues Spiel“ einen Block würfeln und den Code rechts neben
            dem Block an Mitspieler weitergeben. Sie geben ihn bei „Code“ ein und spielen denselben
            Block.
            {'\n'}• Online spielen: Jeder nutzt sein eigenes Handy. Einer erstellt einen Raum, die
            anderen treten mit dem Code bei. Rechts seht ihr den Punktestand aller. Schließt jemand
            eine Reihe ab, ist sie bei allen automatisch gesperrt.
            {'\n'}• Jeder Fehlwurf kostet {PENALTY_POINTS} Punkte.{'\n'}
            • Spielende: zwei Reihen abgeschlossen oder vier Fehlwürfe.{'\n'}
            • Vertippt? „Rückgängig“ nimmt den letzten Schritt zurück.
          </Text>
          <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
          <Text style={styles.helpClose}>Tippen zum Schließen</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.background },
  rotateHint: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  rotateIcon: { fontSize: 56, color: UI.ink },
  rotateText: { fontSize: 18, fontWeight: '700', color: UI.ink, textAlign: 'center' },
  content: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: GAP },
  main: { justifyContent: 'center' },
  side: { justifyContent: 'space-between', paddingVertical: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  variantName: { flex: 1, fontSize: 15, fontWeight: '800', color: UI.ink },
  helpButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: UI.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: { fontSize: 13, fontWeight: '800', color: UI.ink },
  standings: { gap: 2 },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2E9D48' },
  dotOff: { backgroundColor: UI.grey },
  standingName: { flex: 1, fontSize: 13, color: UI.ink },
  standingTotal: { fontSize: 13, color: UI.ink, fontVariant: ['tabular-nums'] },
  standingMe: { fontWeight: '800' },
  notice: { fontSize: 12, fontWeight: '700', color: '#C8102E' },
  code: { fontSize: 20, fontWeight: '900', color: UI.ink, letterSpacing: 2 },
  label: { fontSize: 11, color: UI.muted, fontWeight: '600', marginBottom: 4 },
  penalties: { flexDirection: 'row', gap: 4 },
  penaltyBox: {
    borderWidth: 2,
    borderColor: UI.grey,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  penaltyNext: { borderColor: UI.penalty },
  penaltyCross: { color: UI.ink, fontWeight: '900' },
  gameOver: { fontSize: 16, fontWeight: '900', color: '#C8102E' },
  buttons: { gap: 6 },
  button: {
    backgroundColor: UI.ink,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  buttonSubtle: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: UI.grey },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  buttonTextSubtle: { color: UI.ink },
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  helpCard: { backgroundColor: UI.sheet, borderRadius: 16, padding: 18, maxWidth: 620 },
  helpTitle: { fontSize: 18, fontWeight: '800', color: UI.ink, marginBottom: 8 },
  helpText: { fontSize: 14, lineHeight: 21, color: UI.ink },
  disclaimer: { fontSize: 12, lineHeight: 17, color: UI.muted, marginTop: 12 },
  helpClose: { fontSize: 12, color: UI.muted, marginTop: 10, textAlign: 'right' },
});
