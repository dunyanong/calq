// Left slide-in menu shared by all screens: pages, dark mode and, with AI on, today's AI credits.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import Logo from './Logo';
import { Skeleton } from './Loader';
import Switch from './Switch';
import { ClockIcon, GearIcon, HomeIcon, MoonIcon, StarIcon, SunIcon } from './Icons';
import { useSettings } from '@/features/settings/SettingsContext';
import useAiOn from '@/features/ai/useAiOn';
import { useAuth } from '@/features/auth/AuthContext';
import { aiCredits } from '@/services/ai';
import { F } from '@/theme/fonts';

const WIDTH = 270;
const DrawerContext = createContext({ open: () => {} });

const NAV = [
  { key: 'calc', label: 'Calculator', href: '/', Icon: HomeIcon },
  { key: 'recent', label: 'Recent', href: '/history', Icon: ClockIcon },
  { key: 'starred', label: 'Starred', href: '/history?filter=pinned', Icon: StarIcon },
  { key: 'settings', label: 'Settings', href: '/settings', Icon: GearIcon },
];

/**
 * "AI credits · 82% left today": fetched each time the menu opens. Hidden on any
 * error (offline, or the function not deployed yet), so it never shows a wrong number.
 */
function AiCredits({ t, open }) {
  const [credits, setCredits] = useState({ status: 'loading' }); // loading | done (left 0..1) | error
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setCredits((c) => (c.status === 'done' ? c : { status: 'loading' })); // keep the last numbers while refreshing
    aiCredits()
      .then(({ used, limit }) => {
        if (cancelled) return;
        if (!(limit > 0)) throw new Error('no limit');
        setCredits({ status: 'done', left: Math.max(0, Math.min(1, 1 - used / limit)) });
      })
      .catch(() => !cancelled && setCredits({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (credits.status === 'error') return null;
  const pct = credits.status === 'done' ? Math.round(credits.left * 100) : null;
  return (
    <View style={styles.credits} accessible accessibilityLabel={pct === null ? 'AI credits loading' : `AI credits, ${pct}% left today`}>
      <View style={styles.creditsHead}>
        <Text style={[styles.creditsLabel, { color: t.text }]}>AI credits</Text>
        {pct !== null && <Text style={[styles.creditsValue, { color: t.sub }]}>{pct}% left today</Text>}
      </View>
      {pct === null ? (
        <Skeleton width="100%" height={6} radius={3} color={t.switchTrack} />
      ) : (
        <View style={[styles.track, { backgroundColor: t.switchTrack }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct <= 10 ? '#c0564b' : t.accent }]} />
        </View>
      )}
    </View>
  );
}

export function DrawerProvider({ children }) {
  const [isOpen, setOpen] = useState(false);
  const [anim] = useState(() => new Animated.Value(0)); // 0 closed, 1 open
  const { theme: t, dark, update } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const { filter } = useGlobalSearchParams();
  const { user } = useAuth();
  const aiOn = useAiOn();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(anim, { toValue: isOpen ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [isOpen, anim]);

  // Android back button closes the drawer first.
  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [isOpen]);

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  const activeKey =
    pathname === '/settings'
      ? 'settings'
      : pathname === '/history'
        ? filter === 'pinned'
          ? 'starred'
          : 'recent'
        : 'calc';

  // The calculator stays at the bottom of the stack with its entry, Ans and memory.
  // (router.navigate would push a second calculator: it only reuses the current screen.)
  const go = (item) => {
    setOpen(false);
    if (item.key === activeKey) return;
    if (item.key === 'calc') router.dismissTo('/');
    else if (activeKey === 'calc') router.navigate(item.href);
    else router.replace(item.href); // History <-> Settings: never more than one screen above the calculator
  };

  return (
    <DrawerContext.Provider value={ctx}>
      {children}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.scrim, { opacity: anim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: t.drawerBg,
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH - 8, 0] }) }],
          },
        ]}
      >
        <View style={[styles.head, { backgroundColor: t.header, paddingTop: insets.top + 22 }]}>
          <Logo color={t.headerText} size={26} />
          <Text style={[styles.email, { color: t.headerText }]} numberOfLines={1}>
            {user ? user.displayName || user.email : 'Guest · not signed in'}
          </Text>
        </View>

        <View style={styles.nav}>
          {NAV.map((item) => {
            const active = item.key === activeKey;
            const color = active ? t.accentText : t.text;
            return (
              <Pressable
                key={item.key}
                onPress={() => go(item)}
                style={({ pressed }) => [
                  styles.navItem,
                  { backgroundColor: active ? t.navActiveBg : pressed ? 'rgba(43,127,196,.08)' : 'transparent' },
                ]}
              >
                <View style={styles.navIcon}>
                  <item.Icon color={color} />
                </View>
                <Text style={[styles.navLabel, { color, fontFamily: active ? F.bodyBold : F.bodySemi }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.foot, { paddingBottom: insets.bottom + 26 }]}>
          <View style={[styles.rule, { backgroundColor: t.divider }]} />
          <Pressable onPress={() => update({ dark: !dark })} style={styles.navItem}>
            <View style={styles.navIcon}>{dark ? <MoonIcon color={t.text} /> : <SunIcon color={t.text} />}</View>
            <Text style={[styles.navLabel, { color: t.text, fontFamily: F.bodySemi }]}>{dark ? 'Dark mode' : 'Light mode'}</Text>
            <Switch on={dark} trackOn={t.accent} trackOff={t.switchTrack} />
          </Pressable>
          {aiOn && <AiCredits t={t} open={isOpen} />}
        </View>
      </Animated.View>
    </DrawerContext.Provider>
  );
}

/** const drawer = useDrawer(); drawer.open() */
export function useDrawer() {
  return useContext(DrawerContext);
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(8,20,36,.46)', zIndex: 40, elevation: 40 },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: WIDTH,
    zIndex: 41,
    elevation: 41,
    shadowColor: 'rgb(6,18,34)',
    shadowOpacity: 0.28,
    shadowRadius: 15,
    shadowOffset: { width: 8, height: 0 },
  },
  head: { paddingHorizontal: 22, paddingBottom: 18 },
  email: { fontSize: 12.5, fontFamily: F.bodySemi, opacity: 0.72, marginTop: 1 },
  nav: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12 },
  navIcon: { width: 22, alignItems: 'center' },
  navLabel: { flex: 1, fontSize: 17 },
  foot: { paddingTop: 14, paddingHorizontal: 12 },
  rule: { height: 1, marginHorizontal: 6, marginBottom: 12 },
  credits: { gap: 8, paddingTop: 10, paddingHorizontal: 14 },
  creditsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  creditsLabel: { fontSize: 14, fontFamily: F.bodySemi },
  creditsValue: { fontSize: 12.5, fontFamily: F.body },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
