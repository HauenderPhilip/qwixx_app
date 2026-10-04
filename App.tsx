import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NewGameModal } from './src/components/NewGameModal';
import { RowView } from './src/components/RowView';
import { ScoreBar } from './src/components/ScoreBar';
import {
  GameState,
  MAX_PENALTIES,
  MIN_MARKS_TO_LOCK,
  PENALTY_POINTS,
  addPenalty,
  computeScore,
  isGameOver,
  markCell,
  newGame,
  toggleClosedByOther,
} from './src/game';
import { UI } from './src/theme';
import { VariantId, getVariant } from './src/variants';

const STORAGE_KEY = 'qwixx-scoreboard/v1';
const MAX_HISTORY = 200;
const PADDING = 12;
const GAP = 12;
const ROW_GAP = 6;
const SIDE_PANEL_CELLS = 2.6;

type Saved = { game: GameState; history: GameState[] };

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Saved;
        if (saved?.game?.rows) {
          setGame(saved.game);
          setHistory(saved.history ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const saved: Saved = { game, history };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [game, history, loaded]);

  const variant = getVariant(game.variantId);
  const score = useMemo(() => computeScore(game, variant), [game, variant]);
  const gameOver = isGameOver(game);

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
    setGame(newGame(id));
    setHistory([]);
    setShowNewGame(false);
  };

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
                state={game.rows[r]}
                size={size}
                onMark={(c) => apply(markCell(game, r, c))}
                onLockPress={() => apply(toggleClosedByOther(game, r))}
              />
            ))}
          </View>
          <View style={{ marginTop: GAP }}>
            <ScoreBar score={score} size={size} gameOver={gameOver} />
          </View>
        </View>

        <View style={[styles.side, { width: size * SIDE_PANEL_CELLS }]}>
          <Text style={styles.variantName} numberOfLines={2}>
            {variant.name}
          </Text>

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

          <View style={styles.buttons}>
            <SideButton label="↶ Rückgängig" onPress={undo} disabled={history.length === 0} />
            <SideButton label="Neues Spiel" onPress={() => setShowNewGame(true)} />
            <SideButton label="Regeln" onPress={() => setShowHelp(true)} subtle />
          </View>
        </View>
      </View>

      <NewGameModal
        visible={showNewGame}
        currentVariant={game.variantId}
        onSelect={startNewGame}
        onCancel={() => setShowNewGame(false)}
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
            zusätzliches Kreuz in der Farbe des Schlosses.{'\n'}
            • Schließt ein Mitspieler eine Reihe ab, tippe auf das Schloss dieser Reihe – sie wird
            für dich gesperrt (erneut tippen hebt das wieder auf).{'\n'}
            • Bei „Gemischte Farben“ zählen die Kreuze nach der Farbe des Feldes, nicht der Reihe.
            {'\n'}• Jeder Fehlwurf kostet {PENALTY_POINTS} Punkte.{'\n'}
            • Spielende: zwei Reihen abgeschlossen oder vier Fehlwürfe.{'\n'}
            • Vertippt? „Rückgängig“ nimmt den letzten Schritt zurück.
          </Text>
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
  variantName: { fontSize: 15, fontWeight: '800', color: UI.ink },
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
  helpClose: { fontSize: 12, color: UI.muted, marginTop: 10, textAlign: 'right' },
});
