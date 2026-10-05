import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NAME_MAX_LENGTH, OnlineSession, cleanName, parseRoomCode } from '../online';
import { UI } from '../theme';
import { RoomStatus } from '../useOnlineRoom';

type Props = {
  visible: boolean;
  session: OnlineSession | null;
  status: RoomStatus;
  defaultName: string;
  blockName: string;
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (name: string, room: string) => void;
  onLeave: () => void;
  onClose: () => void;
};

const STATUS_TEXT: Record<RoomStatus, string> = {
  connecting: 'Verbinde …',
  connected: 'Verbunden',
  disconnected: 'Keine Verbindung – versuche es erneut …',
};

export function OnlineModal(props: Props) {
  const { visible, session, onClose } = props;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Online spielen</Text>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {session ? <InRoom {...props} session={session} /> : <Lobby {...props} />}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Lobby({ defaultName, blockName, error, onCreate, onJoin }: Props) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const shownError = problem ?? error;

  const withName = (action: (n: string) => void) => {
    const clean = cleanName(name);
    if (!clean) {
      setProblem('Bitte gib zuerst deinen Namen ein.');
      return;
    }
    setProblem(null);
    action(clean);
  };

  const join = () =>
    withName((n) => {
      const room = parseRoomCode(code);
      if (!room) {
        setProblem('Der Raumcode besteht aus 4 Buchstaben, z. B. KTRM.');
        return;
      }
      onJoin(n, room);
    });

  return (
    <View style={styles.section}>
      <Text style={styles.text}>
        Jeder spielt auf seinem eigenen Handy. Ihr seht die Punkte der anderen live, und schließt
        jemand eine Reihe ab, ist sie bei allen gesperrt.
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>Dein Name</Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setProblem(null);
          }}
          placeholder="z. B. Philip"
          placeholderTextColor={UI.grey}
          maxLength={NAME_MAX_LENGTH}
          autoCorrect={false}
          style={[styles.input, styles.nameInput]}
        />
      </View>
      <View style={styles.choices}>
        <View style={styles.choice}>
          <Text style={styles.choiceTitle}>Neuen Raum erstellen</Text>
          <Text style={styles.small}>
            Mit dem Block „{blockName}“. Du bekommst einen Code für deine Mitspieler.
          </Text>
          <Pressable
            onPress={() => withName(onCreate)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Raum erstellen</Text>
          </Pressable>
        </View>
        <View style={styles.choice}>
          <Text style={styles.choiceTitle}>Raum beitreten</Text>
          <Text style={styles.small}>Gib den Code ein, den dir dein Mitspieler nennt.</Text>
          <View style={styles.row}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setProblem(null);
              }}
              onSubmitEditing={join}
              placeholder="Code"
              placeholderTextColor={UI.grey}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[styles.input, styles.codeInput]}
            />
            <Pressable
              onPress={join}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Beitreten</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {shownError && <Text style={styles.error}>{shownError}</Text>}
      <Text style={styles.note}>
        Die Verbindung läuft über einen öffentlichen Server. Namen und Punkte kann jeder sehen, der
        den Raumcode kennt. Im claude.ai-Link funktioniert das Online-Spiel nicht.
      </Text>
    </View>
  );
}

function InRoom({ session, status, onLeave }: Props & { session: OnlineSession }) {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Raumcode</Text>
          <Text style={styles.roomCode} selectable>
            {session.room}
          </Text>
        </View>
        <Text style={[styles.text, styles.flex]}>
          Nenne deinen Mitspielern diesen Code. Sie tippen auf „Online spielen“, geben ihren
          Namen ein und treten bei.
        </Text>
      </View>
      <Text style={styles.text}>
        Du spielst als <Text style={styles.bold}>{session.name}</Text> ·{' '}
        <Text style={status === 'connected' ? styles.ok : styles.warn}>{STATUS_TEXT[status]}</Text>
      </Text>
      <Text style={styles.small}>
        „Neue Runde“ startet für alle im Raum eine neue Runde, mit dem Block, den du auswählst.
      </Text>
      <Pressable
        onPress={onLeave}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>Raum verlassen</Text>
      </Pressable>
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
  scroll: { flexShrink: 1 },
  title: { fontSize: 22, fontWeight: '800', color: UI.ink, marginBottom: 6 },
  section: { gap: 10 },
  text: { fontSize: 14, lineHeight: 20, color: UI.ink },
  small: { fontSize: 12, lineHeight: 17, color: UI.muted },
  note: { fontSize: 11, lineHeight: 15, color: UI.muted },
  bold: { fontWeight: '800' },
  ok: { color: '#1F8A3A', fontWeight: '700' },
  warn: { color: '#C8102E', fontWeight: '700' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: '700', color: UI.ink },
  input: {
    borderWidth: 1.5,
    borderColor: UI.grey,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: UI.ink,
  },
  nameInput: { width: 200 },
  codeInput: { width: 90, letterSpacing: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: {
    flexGrow: 1,
    flexBasis: 240,
    gap: 6,
    borderWidth: 2,
    borderColor: '#E3E3E6',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
  },
  choiceTitle: { fontSize: 15, fontWeight: '800', color: UI.ink },
  roomCode: { fontSize: 30, fontWeight: '900', color: UI.ink, letterSpacing: 4 },
  primary: { backgroundColor: UI.ink, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: UI.ink,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  secondaryText: { color: UI.ink, fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },
  error: { fontSize: 13, fontWeight: '700', color: '#C8102E' },
  close: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14 },
  closeText: { fontSize: 15, fontWeight: '700', color: UI.muted },
});
