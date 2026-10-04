import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RowState, cellStatus, isRowClosed } from '../game';
import { PALETTE, UI } from '../theme';
import { RowDef } from '../variants';

type Props = {
  def: RowDef;
  state: RowState;
  size: number;
  onMark: (cellIndex: number) => void;
  onLockPress: () => void;
};

export function RowView({ def, state, size, onMark, onLockPress }: Props) {
  const closed = isRowClosed(state);
  const pad = Math.round(size * 0.07);
  const inner = size - pad * 2;
  const fontSize = Math.round(inner * 0.52);

  return (
    <View style={[styles.row, closed && !state.locked && styles.closedRow]}>
      {def.cells.map((cell, i) => {
        const status = cellStatus(state, i);
        const palette = PALETTE[cell.color];
        const isFirst = i === 0;
        return (
          <View
            key={i}
            style={[
              styles.band,
              { backgroundColor: palette.band, padding: pad, width: size, height: size },
              isFirst && { borderTopLeftRadius: pad * 2, borderBottomLeftRadius: pad * 2 },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cell.number} ${status === 'marked' ? 'angekreuzt' : ''}`}
              disabled={status !== 'available'}
              onPress={() => onMark(i)}
              style={({ pressed }) => [
                styles.cell,
                {
                  width: inner,
                  height: inner,
                  borderRadius: inner * 0.18,
                  backgroundColor: palette.cell,
                  opacity: status === 'skipped' ? 0.35 : status === 'blocked' && closed ? 0.55 : 1,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.number, { color: palette.text, fontSize }]}>{cell.number}</Text>
              {status === 'marked' && <Cross size={inner} />}
            </Pressable>
          </View>
        );
      })}
      <View
        style={[
          styles.band,
          {
            backgroundColor: PALETTE[def.lockColor].band,
            width: size,
            height: size,
            padding: pad,
            borderTopRightRadius: pad * 2,
            borderBottomRightRadius: pad * 2,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schloss: Reihe von Mitspieler geschlossen"
          disabled={state.locked}
          onPress={onLockPress}
          style={({ pressed }) => [
            styles.lock,
            {
              width: inner * 0.9,
              height: inner * 0.9,
              borderRadius: inner,
              backgroundColor: state.closedByOther ? UI.grey : '#FFFFFF',
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={{ fontSize: inner * 0.42 }}>{closed ? '🔒' : '🔓'}</Text>
          {state.locked && <Cross size={inner * 0.9} />}
        </Pressable>
      </View>
    </View>
  );
}

function Cross({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.crossWrap]}>
      <Text style={[styles.cross, { fontSize: size * 0.95, lineHeight: size }]}>✕</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  closedRow: { opacity: 0.6 },
  band: { alignItems: 'center', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  number: { fontWeight: '800' },
  lock: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.92 }] },
  crossWrap: { alignItems: 'center', justifyContent: 'center' },
  cross: { color: UI.ink, fontWeight: '900', textAlign: 'center' },
});
