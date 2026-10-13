// Modal opened from the angle badge: pick degrees, radians or gradians, then OK.
// Each unit shows one sine that comes out to exactly 1 in it and one that does not,
// worked out by the engine so the examples can never disagree with the calculator.
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ANGLE_MODES, ANGLE_UNITS } from '@/components/AngleBadge';
import { AngleIcon, CloseIcon } from '@/components/Icons';
import { evaluate } from '@/features/calculator/math/engine';
import { formatNumber } from '@/features/calculator/math/format';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

// [right angle in this unit, a familiar input from another unit]
const EXAMPLES = {
  deg: ['sin(90)', 'sin(π)'],
  rad: ['sin(π÷2)', 'sin(90)'],
  grad: ['sin(100)', 'sin(π)'],
};

const example = (expr, unit) => expr + '=' + formatNumber(evaluate(expr, unit));

function UnitRow({ unit, selected, t, onPress }) {
  const m = ANGLE_MODES[unit];
  const ink = t[m.ink];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={m.label}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: t.displayRule },
        selected && { backgroundColor: t[m.bg] },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? ink : t.panelAction }]}>
        {selected && <View style={[styles.dot, { backgroundColor: ink }]} />}
      </View>
      <Text style={[styles.unit, { color: selected ? ink : t.panelInk }]}>{m.long}</Text>
      <View style={styles.examples}>
        {EXAMPLES[unit].map((expr, i) => (
          <Text key={expr} style={[i ? styles.other : styles.main, { color: t.panelInk }]} numberOfLines={1}>
            {example(expr, unit)}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function PickerBody({ angle, t, onClose, onChoose }) {
  const [choice, setChoice] = useState(ANGLE_MODES[angle] ? angle : 'deg');
  const [anim] = useState(() => new Animated.Value(0));

  // same entrance as the hold panel
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          backgroundColor: t.panelBg,
          opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        },
      ]}
    >
      {/* swallows taps so they don't reach the scrim */}
      <Pressable onPress={() => {}} accessibilityRole="radiogroup">
        <View style={styles.head}>
          <AngleIcon color={t.panelInk} />
          <Text style={[styles.title, { color: t.panelInk }]} accessibilityRole="header">
            Angle unit
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => pressed && { opacity: 0.55 }}
          >
            <CloseIcon color={t.panelAction} />
          </Pressable>
        </View>
        {ANGLE_UNITS.map((u) => (
          <UnitRow key={u} unit={u} selected={u === choice} t={t} onPress={() => setChoice(u)} />
        ))}
        <View style={[styles.foot, { borderTopColor: t.displayRule }]}>
          <Pressable
            onPress={() => onChoose(choice)}
            accessibilityRole="button"
            accessibilityLabel="OK"
            style={({ pressed }) => [styles.ok, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * @param {object} p
 * @param {boolean} p.visible
 * @param {number} p.session            changes on every open, so the choice starts from `angle` again
 * @param {'deg'|'rad'|'grad'} p.angle  current unit
 * @param {(unit: string) => void} p.onChoose  OK was pressed
 * @param {() => void} p.onClose        ✕, the scrim or back: nothing changes
 */
export default function AnglePicker({ visible, session, angle, t, onClose, onChoose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <PickerBody key={session} angle={angle} t={t} onClose={onClose} onChoose={onChoose} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(14,24,34,.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgb(5,14,24)',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 26 },
    elevation: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  title: { flex: 1, fontFamily: F.bodySemi, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  unit: { width: 92, fontFamily: F.labelBold, fontSize: 13, letterSpacing: 0.5 },
  examples: { flex: 1, gap: 4, minWidth: 0 },
  main: { fontFamily: F.monoBold, fontSize: 15 },
  other: { fontFamily: F.mono, fontSize: 12, opacity: 0.6 },
  foot: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  ok: { borderWidth: 1.5, borderColor: BLUE, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  okText: { fontFamily: F.labelBold, fontSize: 15, color: BLUE },
});
