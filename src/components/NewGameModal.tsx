import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PALETTE, UI } from '../theme';
import { VARIANTS, Variant, VariantId } from '../variants';

type Props = {
  visible: boolean;
  currentVariant: VariantId;
  onSelect: (id: VariantId) => void;
  onCancel: () => void;
};

export function NewGameModal({ visible, currentVariant, onSelect, onCancel }: Props) {
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
          <Text style={styles.title}>Neues Spiel</Text>
          <Text style={styles.subtitle}>Wähle einen Spielblock – der aktuelle Block wird geleert.</Text>
          <ScrollView contentContainerStyle={styles.list}>
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
          <Pressable onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  cancel: { alignSelf: 'flex-end', marginTop: 12, paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 15, fontWeight: '700', color: UI.muted },
});
