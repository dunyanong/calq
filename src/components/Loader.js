// The app's loading marks: three breathing dots (Loader) for "working on it",
// and placeholder bars (Skeleton) where content of a known shape is on its way.
// Both wait a moment before fading in, so quick work shows nothing at all,
// and hold still when the system asks for reduced motion.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

const GRACE = 150; // ms before anything shows
const DOT_CYCLE = 1000;
const BREATH = 1100;

// Reduced motion, shared by every loader on screen.
let reduceMotion = false;
const listeners = new Set();
const setReduceMotion = (on) => {
  if (on === reduceMotion) return;
  reduceMotion = on;
  listeners.forEach((l) => l());
};
let watching = false;
function subscribe(listener) {
  if (!watching) {
    watching = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => setReduceMotion(!!on))
      .catch(() => {});
    AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setReduceMotion(!!on));
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const useReduceMotion = () => useSyncExternalStore(subscribe, () => reduceMotion);

/** Opacity 0 → 1 after the grace period. */
function useAppear() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: 1, duration: 200, delay: GRACE, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [anim]);
  return anim;
}

/** A value looping 0 → 1 (cycle) or 0 → 1 → 0 (breath); still at `rest` with reduced motion. */
function useLoop(duration, breathe, rest) {
  const still = useReduceMotion();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) {
      anim.setValue(rest);
      return undefined;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      breathe
        ? Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: duration / 2, easing: ease, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: duration / 2, easing: ease, useNativeDriver: true }),
          ])
        : Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [anim, duration, breathe, rest, still]);
  return anim;
}

/**
 * Three dots that brighten one after another.
 * @param {object} p
 * @param {string} p.color
 * @param {number} [p.size]   dot diameter
 * @param {string} [p.label]  read out by screen readers
 */
export default function Loader({ color, size = 5, label = 'Loading', style }) {
  const appear = useAppear();
  const still = useReduceMotion();
  const cycle = useLoop(DOT_CYCLE, false, 0);
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.dots, { gap: Math.round(size * 0.8), height: size * 2, opacity: appear }, style]}
    >
      {[0, 1, 2].map((i) => {
        // each dot peaks a little after the one before it
        const at = i * 0.16;
        const pulse = still
          ? new Animated.Value(0.45)
          : cycle.interpolate({
              inputRange: [0, at, at + 0.28, at + 0.56, 1],
              outputRange: [0, 0, 1, 0, 0],
            });
        return (
          <Animated.View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/**
 * A rounded placeholder bar that breathes softly.
 * @param {object} p
 * @param {number|string} p.width
 * @param {number} [p.height]
 * @param {string} p.color
 */
export function Skeleton({ width, height = 10, color, radius = 4, style }) {
  const appear = useAppear();
  const breath = useLoop(BREATH, true, 0.5);
  const opacity = Animated.multiply(appear, breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: color, opacity }, style]} />;
}

/** Keeps a row of placeholders out of the accessibility tree. */
export function SkeletonGroup({ style, children }) {
  return (
    <View style={style} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
