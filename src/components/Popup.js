// Centred card over a dimmed backdrop (hold panel, angle picker, scan sheet).
// Tapping the backdrop or Back calls onClose.
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';

function Card({ t, style, contentStyle, accessibilityRole, children }) {
  const [anim] = useState(() => new Animated.Value(0));
  // scale up from .9 with a slight overshoot
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.card,
        style,
        {
          backgroundColor: t.panelBg,
          opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {/* swallows taps so they don't reach the backdrop */}
      <Pressable onPress={() => {}} style={contentStyle} accessibilityRole={accessibilityRole}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * @param {object} p
 * @param {boolean} p.visible
 * @param {number} p.session       changes on every open, so the card and its content start fresh
 * @param {() => void} p.onClose   backdrop tap or Back
 * @param {object} [p.style]       card size and padding
 * @param {object} [p.contentStyle] layout of the content (e.g. gap)
 */
export default function Popup({ visible, session, t, onClose, style, contentStyle, accessibilityRole, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose}>
          <Card key={session} t={t} style={style} contentStyle={contentStyle} accessibilityRole={accessibilityRole}>
            {children}
          </Card>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(14,24,34,.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    shadowColor: 'rgb(5,14,24)',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 26 },
    elevation: 24,
  },
});
