// Settings screen: account, angle unit, output format, appearance, AI integration (the AI switch), Google Drive.
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/components/showAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Loader from '@/components/Loader';
import ScreenHeader from '@/components/ScreenHeader';
import { ANGLE_MODES, ANGLE_UNITS } from '@/components/AngleBadge';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { CameraIcon, DriveIcon, ExportIcon, GoogleG, SparkleIcon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import DriveFolderPicker from '@/features/export/DriveFolderPicker';
import * as Drive from '@/services/drive';
import { useSettings } from './SettingsContext';
import { tick } from '@/features/calculator/components/KeyButton';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

// What AI help does, in the user's words (shown while it is on).
const AI_PERKS = [
  { Icon: CameraIcon, text: 'Solve a problem from a photo' },
  { Icon: SparkleIcon, text: 'Explain answers step by step' },
  { Icon: ExportIcon, text: 'Add study notes when you export' },
];

function Section({ title, t }) {
  return <Text style={[styles.section, { color: t.sub }]}>{title}</Text>;
}

function Card({ t, children, style }) {
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.divider }, style]}>{children}</View>;
}

/**
 * Google Drive: connect (asks Google for drive.file access), the folder exports go
 * to, and disconnect. Tokens stay with Google Sign-In; only the folder is saved.
 */
function DriveCard({ t, user }) {
  const { drive: saved, update } = useSettings();
  const toast = useToast();
  const drive = user && saved?.uid === user.uid ? saved : null;
  const [busy, setBusy] = useState(null); // 'connect' | 'disconnect' while Google is working
  const [lost, setLost] = useState(false); // Google no longer gives Calq Drive access
  const [picker, setPicker] = useState({ open: false, session: 0 });

  // Access can be removed outside Calq (Google account settings) or on sign-out.
  const email = drive ? user.email : null;
  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    Drive.isConnected(email)
      .then((ok) => !cancelled && setLost(!ok))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email]);

  const connect = async () => {
    setBusy('connect');
    try {
      await Drive.connect(user.email);
      // a reconnect keeps the folder; a first connect makes (or finds) "Calq"
      const folder = await Drive.ensureFolder(drive ? { id: drive.folderId, name: drive.folderName } : { name: Drive.DEFAULT_FOLDER });
      update({ drive: { uid: user.uid, email: user.email, folderId: folder.id, folderName: folder.name }, exportTo: 'drive' });
      setLost(false);
      toast('Google Drive connected · exports go to ' + folder.name);
    } catch (e) {
      toast(e.message || 'Google Drive was not connected');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = () =>
    showAlert('Disconnect Google Drive?', 'Calq will stop saving to your Drive. Files it already saved stay there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy('disconnect');
          try {
            await Drive.disconnect();
            update({ drive: null, exportTo: 'share' });
            toast('Google Drive disconnected');
          } catch (e) {
            toast('Could not disconnect: ' + (e.message || 'try again'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const choose = (folder) => {
    setPicker((p) => ({ ...p, open: false }));
    update({ drive: { ...drive, folderId: folder.id, folderName: folder.name } });
    toast('Exports go to ' + folder.name);
  };

  const status = !user
    ? 'Sign in with Google to save exports to your Drive'
    : !drive
      ? 'Save exports straight to a folder in your Drive. Calq can only see the files it makes.'
      : lost
        ? 'Reconnect needed: Calq no longer has access'
        : 'Connected · ' + drive.email;

  return (
    <Card t={t}>
      <View style={[styles.pad, styles.driveHead]}>
        <DriveIcon color={t.text} size={20} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, { color: t.text }]}>Google Drive</Text>
          <Text style={[styles.rowSub, { color: lost ? '#c0564b' : t.sub }]}>{status}</Text>
        </View>
      </View>
      {drive && !lost && (
        <Pressable
          onPress={() => setPicker((p) => ({ open: true, session: p.session + 1 }))}
          accessibilityRole="button"
          accessibilityLabel={'Drive folder: ' + drive.folderName}
          style={({ pressed }) => [styles.switchRow, styles.ruled, { borderTopColor: t.divider, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>Folder</Text>
          <Text style={[styles.rowValue, { color: t.accentText }]} numberOfLines={1}>
            {drive.folderName} ›
          </Text>
        </Pressable>
      )}
      <View style={[styles.driveActions, { borderTopColor: t.divider }]}>
        {busy ? (
          <View style={[styles.driveBtn, styles.busyRow]} accessibilityLiveRegion="polite">
            <Loader color={t.sub} label={busy === 'connect' ? 'Connecting' : 'Disconnecting'} />
            <Text style={[styles.driveBtnText, { color: t.sub }]}>{busy === 'connect' ? 'Connecting…' : 'Disconnecting…'}</Text>
          </View>
        ) : (
          <>
            {(!drive || lost) && (
              <Pressable onPress={connect} disabled={!user} accessibilityRole="button" style={({ pressed }) => [styles.driveBtn, { opacity: !user ? 0.4 : pressed ? 0.6 : 1 }]}>
                <Text style={styles.driveBtnText}>{lost ? 'Reconnect Google Drive' : 'Connect Google Drive'}</Text>
              </Pressable>
            )}
            {drive && (
              <Pressable onPress={disconnect} accessibilityRole="button" style={({ pressed }) => [styles.driveBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.driveBtnText, { color: '#c0564b' }]}>Disconnect</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
      {drive && (
        <DriveFolderPicker
          visible={picker.open}
          session={picker.session}
          current={{ id: drive.folderId, name: drive.folderName }}
          t={t}
          onClose={() => setPicker((p) => ({ ...p, open: false }))}
          onChoose={choose}
        />
      )}
    </Card>
  );
}

export default function Settings() {
  const { theme: t, angle, output, dark, ai, update } = useSettings();
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

  const aiOn = !!user && ai;
  const toggleAi = () => {
    if (!user) {
      toast('Sign in to get AI help');
      return;
    }
    tick();
    update({ ai: !ai });
    toast(ai ? 'AI help is off' : 'AI help is on');
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
            options={ANGLE_UNITS.map((u) => ({ value: u, label: ANGLE_MODES[u].label }))}
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

        <Section title="AI INTEGRATION" t={t} />
        <Card t={t}>
          <Pressable
            onPress={toggleAi}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!user && ai, disabled: !user }}
            style={[styles.switchRow, !user && { opacity: 0.5 }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.aiTitle}>
                <SparkleIcon color={aiOn ? BLUE : t.sub} size={13} />
                <Text style={[styles.rowTitle, { color: t.text }]}>AI help</Text>
              </View>
              <Text style={[styles.rowSub, { color: t.sub }]}>
                {!user ? 'Sign in to get AI help' : aiOn ? 'On' : 'Off · Calq works as a plain calculator'}
              </Text>
            </View>
            <Switch on={aiOn} trackOn={t.accent} trackOff={t.switchTrack} />
          </Pressable>
          {aiOn && (
            <View style={[styles.perks, { borderTopColor: t.divider }]}>
              {AI_PERKS.map(({ Icon, text }) => (
                <View key={text} style={styles.perk}>
                  <View style={[styles.perkIcon, { backgroundColor: t.selBg }]}>
                    <Icon color={BLUE} size={15} />
                  </View>
                  <Text style={[styles.perkText, { color: t.text }]}>{text}</Text>
                </View>
              ))}
              <Text style={[styles.perkNote, { color: t.sub }]}>Your calculations are sent to an AI service to do this.</Text>
            </View>
          )}
        </Card>

        <Section title="GOOGLE DRIVE" t={t} />
        <DriveCard t={t} user={user} />

        <Pressable
          onPress={onAccountPress}
          disabled={busy}
          style={({ pressed }) => [
            styles.google,
            { borderColor: t.divider, backgroundColor: t.card, opacity: busy ? 0.7 : pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ busy }}
        >
          {busy ? <Loader color={t.sub} label={user ? 'Signing out' : 'Signing in'} /> : !user && <GoogleG />}
          <Text style={[styles.googleText, { color: t.text }]}>
            {busy ? (user ? 'Signing out…' : 'Signing in…') : user ? 'Sign out' : 'Continue with Google'}
          </Text>
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
  aiTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perks: { gap: 10, borderTopWidth: 1, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  perkText: { fontSize: 14.5, fontFamily: F.bodySemi, flexShrink: 1 },
  perkNote: { fontSize: 12, fontFamily: F.body, marginTop: 2 },
  driveHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruled: { borderTopWidth: 1 },
  rowValue: { fontSize: 15, fontFamily: F.bodyBold, maxWidth: '60%' },
  driveActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, borderTopWidth: 1, paddingVertical: 10, minHeight: 50, alignItems: 'center' },
  driveBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driveBtnText: { fontSize: 15, fontFamily: F.bodyBold, color: BLUE },
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
