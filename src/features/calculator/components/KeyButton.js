import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F } from '@/theme/fonts';
import { pad } from '@/theme/tokens';

/**
 * One keypad key. The 2px bottom "shadow" from the prototype is drawn by
 * leaving a strip of the darker outer view visible; pressing moves the key
 * down 1px and hides it (prototype :active style).
 */
function KeyButton({ face, size, bg, ink, radius = 10, minHeight = 34, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.outer, { borderRadius: radius, minHeight }]} hitSlop={2}>
      {({ pressed }) => (
        <View
          style={[
            styles.inner,
            { backgroundColor: bg, borderRadius: radius, top: pressed ? 1 : 0, bottom: pressed ? 1 : 2 },
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
  outer: { flex: 1, backgroundColor: pad.shadow },
  inner: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  face: { fontFamily: F.bodyBold, includeFontPadding: false },
});
