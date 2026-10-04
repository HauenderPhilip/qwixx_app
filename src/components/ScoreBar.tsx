import { StyleSheet, Text, View } from 'react-native';
import { Score } from '../game';
import { PALETTE, UI } from '../theme';

type Props = { score: Score; size: number; gameOver: boolean };

export function ScoreBar({ score, size, gameOver }: Props) {
  const box = { width: size * 1.3, height: size * 0.95, borderRadius: size * 0.18 };
  const big = { fontSize: size * 0.42 };
  const small = { fontSize: size * 0.2 };
  const op = { fontSize: size * 0.4, marginHorizontal: size * 0.12 };

  return (
    <View style={styles.bar}>
      {score.rows.map((row, i) => (
        <View key={i} style={styles.group}>
          {i > 0 && <Text style={[styles.op, op]}>+</Text>}
          <View style={[styles.box, box, { borderColor: PALETTE[row.color].band }]}>
            <Text style={[styles.points, big]}>{row.points}</Text>
            <Text style={[styles.crosses, small]}>{row.crosses}×</Text>
          </View>
        </View>
      ))}
      <Text style={[styles.op, op]}>−</Text>
      <View style={[styles.box, box, { borderColor: UI.penalty }]}>
        <Text style={[styles.points, big]}>{score.penaltyPoints}</Text>
        <Text style={[styles.crosses, small]}>Fehlwürfe</Text>
      </View>
      <Text style={[styles.op, op]}>=</Text>
      <View
        style={[
          styles.box,
          box,
          styles.totalBox,
          { width: size * 1.9 },
          gameOver && styles.totalOver,
        ]}
      >
        <Text style={[styles.points, big, gameOver && styles.totalOverText]}>{score.total}</Text>
        <Text style={[styles.crosses, small, gameOver && styles.totalOverText]}>
          {gameOver ? 'Endstand' : 'Gesamt'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  group: { flexDirection: 'row', alignItems: 'center' },
  box: {
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBox: { borderColor: UI.ink },
  totalOver: { backgroundColor: UI.ink },
  totalOverText: { color: '#FFFFFF' },
  points: { fontWeight: '800', color: UI.ink },
  crosses: { color: UI.muted, fontWeight: '600' },
  op: { color: UI.muted, fontWeight: '700' },
});
