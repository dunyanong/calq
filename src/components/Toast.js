import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F } from '@/theme/fonts';
import { ACCENT_DARK, TOAST_BG } from '@/theme/tokens';

const ToastContext = createContext(() => {});

/**
 * Small pill message at the bottom of the screen (prototype "flash").
 * toast(message) shows it for 1.5 s; toast(message, { action: { label, onPress } })
 * adds a button (e.g. Undo) and stays 4 s.
 */
export function ToastProvider({ children }) {
  const [shown, setShown] = useState({ message: '', action: null });
  const [visible, setVisible] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setVisible(false);
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [opacity]);

  const show = useCallback(
    (message, { action = null } = {}) => {
      setShown({ message, action });
      setVisible(true);
      clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, action ? 4000 : 1500);
    },
    [opacity, hide],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const { message, action } = shown;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* only an action toast takes touches, and only while it is showing */}
      <View pointerEvents={visible && action ? 'box-none' : 'none'} style={[styles.wrap, { bottom: insets.bottom + 64 }]}>
        <Animated.View style={[styles.pill, { opacity }]}>
          <Text style={[styles.text, styles.message]} numberOfLines={1}>
            {message}
          </Text>
          {action && (
            <Pressable
              onPress={() => {
                hide();
                action.onPress();
              }}
              hitSlop={10}
              accessibilityRole="button"
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={[styles.text, styles.action]}>{action.label}</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast('Copied') */
export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, elevation: 100 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: TOAST_BG,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    maxWidth: '90%',
  },
  text: { color: '#fff', fontSize: 13.5, fontFamily: F.bodySemi },
  message: { flexShrink: 1 },
  action: { color: ACCENT_DARK, fontFamily: F.bodyHeavy },
});
