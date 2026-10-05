// Header for non-calculator screens: menu button + title (or custom content).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hamburger } from './Icons';
import { useDrawer } from './Drawer';
import { F } from '@/theme/fonts';

export default function ScreenHeader({ t, title, children }) {
  const insets = useSafeAreaInsets();
  const drawer = useDrawer();
  return (
    <View style={[styles.screenHeader, { backgroundColor: t.header, paddingTop: insets.top + 10 }]}>
      <Pressable onPress={drawer.open} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
        <Hamburger color={t.headerText} width={30} />
      </Pressable>
      <View style={styles.screenHeaderBody}>
        {children || <Text style={[styles.title, { color: t.headerText }]}>{title}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14 },
  screenHeaderBody: { flex: 1, marginLeft: 12, minHeight: 40, justifyContent: 'center' },
  title: { fontFamily: F.bodyHeavy, fontSize: 22, letterSpacing: -0.3 },
});
