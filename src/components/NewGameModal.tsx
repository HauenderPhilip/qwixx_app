import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DISCLAIMER, PALETTE, UI } from '../theme';
import {
  RANDOM_MODES,
  RandomMode,
  VARIANTS,
  Variant,
  VariantId,
  parseRandomCode,
  randomVariantId,
} from '../variants';

type Props = {
  visible: boolean;
  currentVariant: VariantId;
  onSelect: (id: VariantId) => void;
  onCancel: () => void;
  /** Im Online-Raum startet die Auswahl eine neue Runde für alle. */
  online?: boolean;
};

export function NewGameModal({ visible, currentVariant, onSelect, onCancel, online }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{online ? 'Neue Runde' : 'Neues Spiel'}</Text>
          <Text style={styles.subtitle}>
            {online
              ? 'Wähle einen Spielblock – die Runde startet für alle im Raum neu.'
              : 'Wähle einen Spielblock – der aktuelle Block wird geleert.'}
          </Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            <RandomSection onSelect={onSelect} />
            {VARIANTS.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => onSelect(v.id)}
                style={({ pressed }) => [
                  styles.option,
                  v.id === currentVariant && styles.optionCurrent,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={styles.optionTitle}>{v.name}</Text>
                <Text style={styles.optionText}>{v.description}</Text>
                <Preview variant={v} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
            <Pressable onPress={onCancel} style={styles.cancel}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RandomSection({ onSelect }: { onSelect: (id: VariantId) => void }) {
  const [mode, setMode] = useState<RandomMode>('M');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState(false);

  const join = () => {
    const code = parseRandomCode(codeInput);
    if (!code) {
      setError(true);
      return;
    }
    setError(false);
    setCodeInput('');
    onSelect('random:' + code);
  };

  return (
    <View style={[styles.option, styles.randomCard]}>
      <Text style={styles.optionTitle}>Zufallsblock</Text>
      <Text style={styles.optionText}>
        Jedes Spiel ein neuer Block. Mitspieler geben deinen Code ein und bekommen denselben Block.
      </Text>
      <View style={styles.randomRows}>
        <View style={styles.randomRow}>
          <Text style={styles.randomLabel}>Mischen:</Text>
          <View style={styles.segments}>
            {RANDOM_MODES.map((m) => (
              <Pressable
                key={m.mode}
                onPress={() => setMode(m.mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m.mode }}
                style={[styles.segment, mode === m.mode && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === m.mode && styles.segmentTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => onSelect(randomVariantId(mode))}
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Text style={styles.primaryText}>Neuen Block würfeln</Text>
          </Pressable>
        </View>
        <View style={styles.randomRow}>
          <Text style={styles.randomLabel}>Code:</Text>
          <TextInput
            value={codeInput}
            onChangeText={(t) => {
              setCodeInput(t);
              setError(false);
            }}
            onSubmitEditing={join}
            placeholder="z. B. M-4821"
            placeholderTextColor={UI.grey}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={[styles.codeInput, error && styles.codeInputError]}
          />
          <Pressable
            onPress={join}
            style={({ pressed }) => [styles.secondary, pressed && styles.primaryPressed]}
          >
            <Text style={styles.secondaryText}>Mitspielen</Text>
          </Pressable>
          {error && <Text style={styles.error}>Code ungültig</Text>}
        </View>
      </View>
    </View>
  );
}

function Preview({ variant }: { variant: Variant }) {
  return (
    <View style={styles.preview}>
      {variant.rows.map((row, r) => (
        <View key={r} style={styles.previewRow}>
          {row.cells.map((cell, c) => (
            <View key={c} style={[styles.previewCell, { backgroundColor: PALETTE[cell.color].band }]}>
              <Text style={styles.previewNumber}>{cell.number}</Text>
            </View>
          ))}
          <View style={[styles.previewCell, { backgroundColor: PALETTE[row.lockColor].band }]}>
            <Text style={styles.previewNumber}>🔓</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: UI.sheet,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 720,
    maxHeight: '100%',
  },
  title: { fontSize: 22, fontWeight: '800', color: UI.ink },
  subtitle: { fontSize: 13, color: UI.muted, marginTop: 2, marginBottom: 10 },
  scroll: { flexShrink: 1 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  randomCard: { flexBasis: '100%' },
  randomRows: { gap: 8, marginTop: 4 },
  randomRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  randomLabel: { width: 62, fontSize: 13, fontWeight: '700', color: UI.ink },
  segments: { flexDirection: 'row', borderWidth: 1.5, borderColor: UI.grey, borderRadius: 8 },
  segment: { paddingVertical: 6, paddingHorizontal: 12 },
  segmentActive: { backgroundColor: UI.ink, borderRadius: 6 },
  segmentText: { fontSize: 13, fontWeight: '700', color: UI.ink },
  segmentTextActive: { color: '#FFFFFF' },
  primary: { backgroundColor: UI.ink, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  primaryPressed: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  secondary: {
    borderWidth: 1.5,
    borderColor: UI.ink,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  secondaryText: { color: UI.ink, fontWeight: '700', fontSize: 13 },
  codeInput: {
    width: 130,
    borderWidth: 1.5,
    borderColor: UI.grey,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: UI.ink,
    letterSpacing: 1,
  },
  codeInputError: { borderColor: '#C8102E' },
  error: { fontSize: 12, fontWeight: '700', color: '#C8102E' },
  option: {
    flexGrow: 1,
    flexBasis: 200,
    borderWidth: 2,
    borderColor: '#E3E3E6',
    borderRadius: 12,
    padding: 10,
  },
  optionCurrent: { borderColor: UI.ink },
  optionPressed: { backgroundColor: '#F2F2F4' },
  optionTitle: { fontSize: 16, fontWeight: '800', color: UI.ink },
  optionText: { fontSize: 12, color: UI.muted, marginVertical: 4 },
  preview: { gap: 2, marginTop: 4 },
  previewRow: { flexDirection: 'row', gap: 1 },
  previewCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewNumber: { color: '#FFFFFF', fontSize: 7, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  disclaimer: { flex: 1, fontSize: 11, lineHeight: 15, color: UI.muted },
  cancel: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 15, fontWeight: '700', color: UI.muted },
});
