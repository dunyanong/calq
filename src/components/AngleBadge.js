// Small colour-coded pill showing the angle unit a calculation used.
import { StyleSheet, Text, View } from 'react-native';
import { F } from '@/theme/fonts';

// One entry per angle unit, in picker order; ink / bg name the theme tokens for its colours.
// Adding a unit only needs a new entry here, its tokens, and its size in math/engine.js (RAD_PER).
export const ANGLE_MODES = {
  deg: { short: 'DEG', long: 'DEGREES', label: 'Degrees', a11y: 'Degree mode', ink: 'angleDeg', bg: 'angleDegBg' },
  rad: { short: 'RAD', long: 'RADIANS', label: 'Radians', a11y: 'Radian mode', ink: 'angleRad', bg: 'angleRadBg' },
  grad: { short: 'GRAD', long: 'GRADIANS', label: 'Gradians', a11y: 'Gradian mode', ink: 'angleGrad', bg: 'angleGradBg' },
};

/** Every angle unit key: ['deg', 'rad', 'grad']. */
export const ANGLE_UNITS = Object.keys(ANGLE_MODES);

/** Mode info for an angle value; unknown or missing values fall back to degrees (the app default). */
export const angleMode = (angle) => ANGLE_MODES[angle] || ANGLE_MODES.deg;

/**
 * @param {object} p
 * @param {string} p.angle   key of ANGLE_MODES
 * @param {boolean} [p.long] full word instead of the short label
 */
export default function AngleBadge({ angle, t, long, style }) {
  const m = angleMode(angle);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={m.a11y}
      style={[styles.pill, { backgroundColor: t[m.bg], borderColor: t[m.ink] }, style]}
    >
      <Text style={[styles.text, { color: t[m.ink] }]}>{long ? m.long : m.short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  // never below 12 so it stays readable
  text: { fontFamily: F.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
});
