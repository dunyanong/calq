// "Scan a calculation": photo or screenshot -> AI reads it -> user checks/edits -> Insert.
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraIcon } from '@/components/Icons';
import Popup from '@/components/Popup';
import { evaluate } from '@/features/calculator/math/engine';
import { formatNumber } from '@/features/calculator/math/format';
import { normalizeExpr } from '@/features/calculator/math/normalize';
import { indefiniteIntegrand, symbolicDerivative } from '@/features/calculator/math/symbolic';
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
  // d/dx without a point gives a formula, or a number when no x is left (d/dx(3x) = 3)
  const formula = expr ? symbolicDerivative(expr, angle) : null;
  const value = formula ? (formula.value ?? null) : expr ? evaluate(expr, angle) : null;
  const shown =
    value !== null
      ? '= ' + formatNumber(value, output)
      : formula?.text
        ? '= ' + formula.text
        : expr && indefiniteIntegrand(expr, angle)?.f // ∫ without limits: the formula comes from the AI at =
          ? 'Insert, then press = for the formula'
          : 'Can’t work this out — edit it';

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
          <Text style={[styles.preview, { color: shown.startsWith('=') ? BLUE : '#93958f' }]}>{shown}</Text>
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
    <Popup visible={visible} session={session} t={t} onClose={onClose} style={styles.panel} contentStyle={styles.content}>
      <Body t={t} angle={angle} output={output} onInsert={onInsert} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  content: { gap: 10 },
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
