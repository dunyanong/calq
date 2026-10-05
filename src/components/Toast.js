import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F } from '@/theme/fonts';
import { TOAST_BG } from '@/theme/tokens';

const ToastContext = createContext(() => {});

/** Small pill message at the bottom of the screen (prototype "flash"). */
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (msg, ms = 1500) => {
      setMessage(msg);
      clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }, ms);
    },
    [opacity],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 64 }]}>
        <Animated.View style={[styles.pill, { opacity }]}>
          <Text style={styles.text} numberOfLines={1}>
            {message}
          </Text>
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
  pill: { backgroundColor: TOAST_BG, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, maxWidth: '90%' },
  text: { color: '#fff', fontSize: 13.5, fontFamily: F.bodySemi },
});
