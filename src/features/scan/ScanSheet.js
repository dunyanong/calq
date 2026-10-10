// "Scan a calculation": photo or screenshot -> AI reads it -> user checks/edits -> Insert.
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraIcon } from '@/components/Icons';
import { evaluate } from '@/features/calculator/math/engine';
import { formatNumber } from '@/features/calculator/math/format';
import { normalizeExpr } from '@/features/calculator/math/normalize';
import { scanEquation } from '@/services/ai';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';
import { pickImage } from './pickImage';

const EMPTY = { status: 'choose', uri: null, text: '', note: '', error: '' };

function Button({ label, onPress, primary, disabled, t, children }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: BLUE } : { borderColor: t.displayRule, borderWidth: 1 },
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      {children}
      <Text style={[styles.buttonText, { color: primary ? '#fff' : t.panelInk }]}>{label}</Text>
    </Pressable>
  );
}

function Body({ t, angle, output, onInsert }) {
  const [s, setS] = useState(EMPTY);

  const scan = async (source) => {
    try {
      const img = await pickImage(source);
      if (!img) return;
      setS({ ...EMPTY, status: 'reading', uri: img.uri });
      const { expr, note } = await scanEquation(img.base64);
      setS((p) => ({ ...p, status: 'review', text: normalizeExpr(expr), note: expr ? note : note || 'No calculation found' }));
    } catch (e) {
      setS((p) => ({ ...p, status: 'error', error: e.message }));
    }
  };

  const expr = normalizeExpr(s.text);
  const value = expr ? evaluate(expr, angle) : null;

  return (
    <>
      <Text style={[styles.title, { color: t.panelInk }]}>Scan a calculation</Text>

      {s.uri && <Image source={{ uri: s.uri }} style={[styles.photo, { borderColor: t.displayRule }]} resizeMode="contain" />}

      {s.status === 'choose' && (
        <>
          <Text style={styles.hint}>Handwriting, textbooks and screenshots all work.</Text>
          <View style={styles.row}>
            <Button label="Take photo" primary t={t} onPress={() => scan('camera')}>
              <CameraIcon color="#fff" />
            </Button>
            <Button label="Choose image" t={t} onPress={() => scan('library')} />
          </View>
        </>
      )}

      {s.status === 'reading' && (
        <View style={styles.reading}>
          <ActivityIndicator color={BLUE} />
          <Text style={styles.hint}>Reading…</Text>
        </View>
      )}

      {s.status === 'review' && (
        <>
          <Text style={styles.label}>CHECK IT, EDIT IF NEEDED</Text>
          <TextInput
            value={s.text}
            onChangeText={(text) => setS((p) => ({ ...p, text }))}
            style={[styles.input, { color: t.panelInk, borderColor: t.displayRule }]}
            autoCorrect={false}
            autoCapitalize="none"
            multiline
            placeholder="e.g. 2×(3+4)"
            placeholderTextColor="#93958f"
          />
          <Text style={[styles.preview, { color: value === null ? '#93958f' : BLUE }]}>
            {value === null ? 'Can’t evaluate this yet' : '= ' + formatNumber(value, output)}
          </Text>
          {!!s.note && <Text style={styles.hint}>{s.note}</Text>}
          <View style={styles.row}>
            <Button label="Retake" t={t} onPress={() => setS(EMPTY)} />
            <Button label="Insert" primary t={t} disabled={!expr} onPress={() => onInsert(expr)} />
          </View>
        </>
      )}

      {s.status === 'error' && (
        <>
          <Text style={[styles.hint, { color: '#c0564b' }]}>{s.error}</Text>
          <View style={styles.row}>
            <Button label="Try again" primary t={t} onPress={() => setS(EMPTY)} />
          </View>
        </>
      )}
    </>
  );
}

/**
 * @param {object} p
 * @param {number} p.session   changes on every open, so the sheet starts fresh
 * @param {(expr: string) => void} p.onInsert
 */
export default function ScanSheet({ visible, session, t, angle, output, onClose, onInsert }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose}>
          {/* Inner Pressable swallows taps so they don't close the sheet */}
          <Pressable onPress={() => {}} style={[styles.panel, { backgroundColor: t.panelBg }]}>
            <Body key={session} t={t} angle={angle} output={output} onInsert={onInsert} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(14,24,34,.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: 'rgb(5,14,24)',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 26 },
    elevation: 24,
  },
  title: { fontFamily: F.labelBold, fontSize: 15 },
  hint: { fontFamily: F.label, fontSize: 12, color: '#93958f' },
  label: { fontFamily: F.labelBold, fontSize: 10.5, letterSpacing: 0.5, color: BLUE },
  photo: { width: '100%', height: 140, borderRadius: 12, borderWidth: 1 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  input: { fontFamily: F.monoBold, fontSize: 16, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  preview: { fontFamily: F.mono, fontSize: 13, textAlign: 'right' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  buttonText: { fontFamily: F.labelBold, fontSize: 13 },
});
