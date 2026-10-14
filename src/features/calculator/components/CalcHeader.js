// Calculator header: menu button, Calq logo, pinned-calculations pill, refresh (new session).
// While calculations are selected: close, "N selected" and Export instead.
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '@/components/Logo';
import { CloseIcon, ExportIcon, Hamburger, PinSolid, RefreshIcon } from '@/components/Icons';
import { useDrawer } from '@/components/Drawer';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

function PinPill({ label, active, onPress }) {
  // pops in with a small overshoot
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

/**
 * @param {object} p
 * @param {number|null} p.selected  how many calculations are selected; null when not selecting
 */
export default function CalcHeader({ t, pinCount, pinFilter, onPinPill, onNewSession, selected = null, onEndSelect, onExportSelected }) {
  const insets = useSafeAreaInsets();
  const drawer = useDrawer();
  const selecting = selected !== null;
  return (
    <View style={[styles.calcHeader, { backgroundColor: t.header, paddingTop: insets.top + 6 }]}>
      {selecting ? (
        <Pressable
          onPress={onEndSelect}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cancel selection"
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <CloseIcon color={t.headerInk} size={22} />
        </Pressable>
      ) : (
        <Pressable
          onPress={drawer.open}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <Hamburger color={t.headerInk} />
        </Pressable>
      )}
      <View style={styles.logo}>
        {selecting ? (
          <Text style={[styles.count, { color: t.headerInk }]} accessibilityLiveRegion="polite">
            {selected} selected
          </Text>
        ) : (
          <Logo color={t.headerInk} />
        )}
      </View>
      {!selecting && pinCount > 0 && <PinPill label={pinFilter ? 'All' : String(pinCount)} active={pinFilter} onPress={onPinPill} />}
      {selecting ? (
        <Pressable
          onPress={onExportSelected}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={'Export ' + selected + ' selected'}
          style={({ pressed }) => [styles.export, pressed && { opacity: 0.5 }]}
        >
          <ExportIcon color={t.headerInk} size={20} />
          <Text style={[styles.exportText, { color: t.headerInk }]}>Export</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onNewSession}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="New session"
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <RefreshIcon color={t.headerInk} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 8 },
  logo: { flex: 1, minWidth: 0, paddingTop: 8 },
  count: { fontFamily: F.bodyBold, fontSize: 18, paddingBottom: 6 },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exportText: { fontFamily: F.bodyBold, fontSize: 15 },
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
