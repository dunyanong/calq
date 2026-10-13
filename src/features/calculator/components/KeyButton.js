import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { F } from '@/theme/fonts';
import { pad } from '@/theme/tokens';

/** Light tick for a key press; silently does nothing where haptics are unavailable. */
export function tick(style = 'selection') {
  const p =
    style === 'selection'
      ? Haptics.selectionAsync()
      : style === 'error'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  p?.catch?.(() => {});
}

/**
 * One keypad key. `silent` skips the tick when the key gives its own feedback (= ).
 * `dim` greys out a key that only cancels the current mode (no variable in ALPHA / STO / RCL).
 * The 2px bottom edge is drawn by leaving a strip of the outer view
 * visible; pressing moves the key down 1px, hides it and shrinks the key
 * slightly, like a real key.
 */
function KeyButton({ face, size, bg, ink, radius, minHeight, silent, dim, onPress }) {
  return (
    <Pressable
      onPress={() => {
        if (!silent) tick();
        onPress();
      }}
      style={[styles.outer, { borderRadius: radius, minHeight, backgroundColor: pad.shadow, opacity: dim ? 0.35 : 1 }]}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={face}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.inner,
            {
              backgroundColor: bg,
              borderRadius: radius,
              top: pressed ? 1 : 0,
              bottom: pressed ? 1 : 2,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Text style={[styles.face, { color: ink, fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit>
            {face}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default memo(KeyButton);

const styles = StyleSheet.create({
  outer: { flex: 1 },
  inner: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  face: { fontFamily: F.bodyBold, includeFontPadding: false },
});
