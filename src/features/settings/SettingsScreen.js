// Settings screen (prototype "CalcMaster Menu" settings view).
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import ScreenHeader from '@/components/ScreenHeader';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { GoogleG } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings } from './SettingsContext';
import { F } from '@/theme/fonts';

function Section({ title, t }) {
  return <Text style={[styles.section, { color: t.sub }]}>{title}</Text>;
}

function Card({ t, children, style }) {
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.divider }, style]}>{children}</View>;
}

export default function Settings() {
  const { theme: t, angle, output, dark, update } = useSettings();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user, signIn, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const onAccountPress = async () => {
    setBusy(true);
    try {
      if (user) {
        await signOut();
        toast('Signed out');
      } else if (await signIn()) {
        toast('Signed in');
      }
    } catch (e) {
      toast(e?.message ? `Sign-in failed: ${e.message}` : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const name = user ? user.displayName || 'Signed in' : 'Guest';

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader t={t} title="Settings" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <Card t={t} style={styles.profile}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: t.accent }]}>
              <Text style={styles.avatarText}>{user ? name[0].toUpperCase() : '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.email, { color: t.sub }]} numberOfLines={1}>
              {user ? user.email : 'History is saved on this device only'}
            </Text>
            {user && (
              <Text style={[styles.email, { color: t.sub }]} numberOfLines={1}>
                History syncs across your devices
              </Text>
            )}
          </View>
        </Card>

        <Section title="CALCULATION" t={t} />
        <Card t={t} style={styles.pad}>
          <Text style={[styles.rowTitle, { color: t.text }]}>Angle unit</Text>
          <Text style={[styles.rowSub, { color: t.sub }]}>Applies to trigonometric functions</Text>
          <Segmented
            t={t}
            value={angle}
            onChange={(v) => update({ angle: v })}
            options={[
              { value: 'deg', label: 'Degrees' },
              { value: 'rad', label: 'Radians' },
            ]}
          />
        </Card>

        <Section title="OUTPUT" t={t} />
        <Card t={t} style={styles.pad}>
          <Text style={[styles.rowTitle, { color: t.text }]}>Default output</Text>
          <Text style={[styles.rowSub, { color: t.sub }]}>How results are shown</Text>
          <Segmented
            t={t}
            value={output}
            onChange={(v) => update({ output: v })}
            options={[
              { value: 'dec', label: 'Decimal' },
              { value: 'frac', label: 'Fraction' },
            ]}
          />
        </Card>

        <Section title="APPEARANCE" t={t} />
        <Card t={t}>
          <Pressable onPress={() => update({ dark: !dark })} style={styles.switchRow}>
            <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>{dark ? 'Dark mode' : 'Light mode'}</Text>
            <Switch on={dark} trackOn={t.accent} trackOff={t.switchTrack} />
          </Pressable>
        </Card>

        <Pressable
          onPress={onAccountPress}
          disabled={busy}
          style={({ pressed }) => [
            styles.google,
            { borderColor: t.divider, backgroundColor: t.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {busy ? <ActivityIndicator color={t.sub} /> : !user && <GoogleG />}
          <Text style={[styles.googleText, { color: t.text }]}>{user ? 'Sign out' : 'Continue with Google'}</Text>
        </Pressable>

        <Text style={[styles.version, { color: t.sub }]}>Calq {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 16, paddingHorizontal: 18 },
  card: { borderRadius: 18, borderWidth: 1 },
  pad: { paddingVertical: 14, paddingHorizontal: 16 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 19, fontFamily: F.bodyHeavy },
  name: { fontSize: 18, fontFamily: F.bodyBold },
  email: { fontSize: 14, fontFamily: F.body, marginTop: 2 },
  section: { fontSize: 12, fontFamily: F.bodyHeavy, letterSpacing: 1.1, paddingTop: 22, paddingHorizontal: 4, paddingBottom: 8 },
  rowTitle: { fontSize: 16, fontFamily: F.bodySemi },
  rowSub: { fontSize: 13, fontFamily: F.body, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  google: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  googleText: { fontSize: 15.5, fontFamily: F.bodyBold },
  version: { textAlign: 'center', fontSize: 12, fontFamily: F.body, paddingTop: 14, paddingBottom: 4 },
});
