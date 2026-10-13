// Calculator header: menu button, Calq logo, pinned-calculations pill, + (new session).
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '@/components/Logo';
import { Hamburger, PinSolid, PlusIcon } from '@/components/Icons';
import { useDrawer } from '@/components/Drawer';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

function PinPill({ label, active, onPress }) {
  // prototype calqPill: pops in with a small overshoot
  const [pop] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: active ? '#1d2630' : BLUE, transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
      >
        <PinSolid color="#fff" />
        <Text style={styles.pillText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function CalcHeader({ t, pinCount, pinFilter, onPinPill, onNewSession }) {
  const insets = useSafeAreaInsets();
  const drawer = useDrawer();
  return (
    <View style={[styles.calcHeader, { backgroundColor: t.header, paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={drawer.open}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Menu"
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        <Hamburger color={t.headerInk} />
      </Pressable>
      <View style={styles.logo}>
        <Logo color={t.headerInk} />
      </View>
      {pinCount > 0 && <PinPill label={pinFilter ? 'All' : String(pinCount)} active={pinFilter} onPress={onPinPill} />}
      <Pressable
        onPress={onNewSession}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="New session"
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        <PlusIcon color={t.headerInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 8 },
  logo: { flex: 1, minWidth: 0, paddingTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    shadowColor: 'rgb(55,138,221)',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillText: { color: '#fff', fontFamily: F.monoBold, fontSize: 12, letterSpacing: 0.4 },
});
