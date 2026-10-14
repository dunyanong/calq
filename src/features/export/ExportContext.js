// Runs exports for the hold panel, the calculator's selection and the History screen.
//   format     csv / text / markdown / latex / pdf (the export row)
//   AI notes   with AI on (Settings → AI integration), Markdown, LaTeX and PDF ask
//              "Include AI explanation?" and can become study notes (studyNotes.js);
//              AI off, or CSV and Text, export only the calculations, without asking
//   to         the share sheet, or the connected Google Drive folder (services/drive.js)
// One export at a time, with a progress pill while the AI or Drive is working.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Loader from '@/components/Loader';
import { useToast } from '@/components/Toast';
import useAiOn from '@/features/ai/useAiOn';
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { FORMATS, exportContent, formatDate, shareFile, writeExportFile } from '@/features/history/exportHistory';
import * as Drive from '@/services/drive';
import { F } from '@/theme/fonts';
import { ACCENT_DARK, TOAST_BG } from '@/theme/tokens';
import { notesContent } from './notesFormat';
import { AI_FORMATS, makeStudyNotes } from './studyNotes';

// Outside the provider (component tests): plain exports through the share sheet.
const ExportContext = createContext({
  run: () => {},
  exportItems: () => {},
  ai: false,
  drive: null,
  destination: 'share',
  setDestination: () => {},
});

const PHASES = {
  steps: 'Working out the steps…',
  notes: 'Writing study notes…',
  drive: 'Saving to Google Drive…',
};

/** Name in Drive, e.g. "Calq study notes 2026-10-13 14-03.pdf" (no ":" for other systems). */
const driveName = (format, notes) =>
  `${notes ? 'Calq study notes' : 'Calq history'} ${formatDate(Date.now()).replace(':', '-')}.${FORMATS[format].ext}`;

/** The phase line; a new phase fades in rather than snapping. */
function PhaseText({ phase }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.Text style={[styles.text, styles.message, { opacity }]} numberOfLines={1}>
      {PHASES[phase]}
    </Animated.Text>
  );
}

/** The progress pill: rises in while there is a phase, and fades out after the last one. */
function ProgressPill({ phase, bottom, onCancel }) {
  const [shown, setShown] = useState(phase); // the last phase, kept while fading out
  const [anim] = useState(() => new Animated.Value(0));
  if (phase && phase !== shown) setShown(phase);

  useEffect(() => {
    const a = Animated.timing(anim, { toValue: phase ? 1 : 0, duration: phase ? 220 : 180, useNativeDriver: true });
    a.start(({ finished }) => finished && !phase && setShown(null));
    return () => a.stop();
  }, [anim, phase]);

  if (!shown) return null;
  return (
    <View pointerEvents={phase ? 'box-none' : 'none'} style={[styles.wrap, { bottom }]}>
      <Animated.View
        style={[styles.pill, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}
        accessibilityLiveRegion="polite"
        accessibilityElementsHidden={!phase}
        importantForAccessibility={phase ? 'auto' : 'no-hide-descendants'}
      >
        <Loader color="#fff" label="Exporting" />
        <PhaseText key={shown} phase={shown} />
        <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[styles.text, styles.cancel]}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ExportProvider({ children }) {
  const settings = useSettings();
  const { user } = useAuth();
  const ai = useAiOn();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState(null);
  const job = useRef(null); // the running export; Cancel forgets it and its result is ignored

  // Drive belongs to the Calq user who connected it
  const drive = user && settings.drive?.uid === user.uid ? settings.drive : null;
  const destination = drive && settings.exportTo === 'drive' ? 'drive' : 'share';

  /** Starts a job; returns live() (false once cancelled or replaced), or null if one is running. */
  const begin = (first) => {
    if (job.current) {
      toast('An export is already running');
      return null;
    }
    const id = {};
    job.current = id;
    setPhase(first);
    return () => job.current === id;
  };
  const finish = (live) => {
    if (!live()) return;
    job.current = null;
    setPhase(null);
  };
  const cancel = () => {
    job.current = null;
    setPhase(null);
    toast('Export cancelled');
  };

  /** Uploads a written export to the Drive folder; Retry runs it again with the same file. */
  const saveToDrive = async (file, format, notes) => {
    const live = begin('drive');
    if (!live) return;
    try {
      const folder = await Drive.ensureFolder({ id: drive.folderId, name: drive.folderName });
      if (folder.id !== drive.folderId || folder.name !== drive.folderName) {
        settings.update({ drive: { ...drive, folderId: folder.id, folderName: folder.name } }); // remade or renamed
      }
      const saved = await Drive.upload({ file, name: driveName(format, notes), mimeType: FORMATS[format].mimeType, folderId: folder.id });
      if (!live()) return;
      const open = saved.webViewLink && { label: 'Open', onPress: () => Linking.openURL(saved.webViewLink).catch(() => {}) };
      toast('Saved to Google Drive · ' + folder.name, { action: open || null });
    } catch (e) {
      if (!live()) return;
      const code = e instanceof Drive.DriveError ? e.code : 'failed';
      let action = null;
      if (code === 'reconnect' || code === 'account') action = { label: 'Settings', onPress: () => router.navigate('/settings') };
      else if (['busy', 'offline', 'failed', 'not-found'].includes(code)) action = { label: 'Retry', onPress: () => saveToDrive(file, format, notes) };
      toast(e.message || 'Google Drive could not save the file', { action });
    } finally {
      finish(live);
    }
  };

  /**
   * Exports items (oldest first) in format to the chosen destination.
   * @param {{notes?: boolean}} [opts]  notes: as AI study notes (Markdown, LaTeX and PDF, AI on)
   */
  const run = async (items, format, opts = {}) => {
    const notes = !!opts.notes && ai && AI_FORMATS.includes(format);
    const live = begin(notes ? 'notes' : destination === 'drive' ? 'drive' : null);
    if (!live) return;
    let file;
    try {
      let content;
      if (notes) {
        try {
          content = notesContent(await makeStudyNotes(items, { onPhase: (p) => live() && setPhase(p) }), format);
        } catch (e) {
          const exportPlain = { label: 'Export plain', onPress: () => run(items, format) };
          if (live()) toast('Study notes failed: ' + e.message, { action: exportPlain });
          return;
        }
        if (!live()) return;
      } else {
        content = exportContent(items, format);
      }
      file = await writeExportFile(format, content, notes ? 'calq-study-notes' : 'calq-history');
      if (!live()) return;
      if (destination === 'share') {
        setPhase(null); // the share sheet takes over
        await shareFile(file, format);
        return;
      }
    } catch (e) {
      if (live()) toast(e.message || 'Export failed');
      return;
    } finally {
      finish(live);
    }
    return saveToDrive(file, format, notes); // a job of its own, so Retry can run just this part
  };

  /**
   * The export row's tap: with AI on, Markdown, LaTeX and PDF first ask whether to add an AI explanation.
   * @param {() => void} [onGo]  runs once the export starts (not on Cancel), e.g. to close the panel
   *                             it was picked in; the question shows over that panel
   */
  const exportItems = (items, format, onGo) => {
    const go = (opts) => {
      onGo?.();
      run(items, format, opts);
    };
    if (!ai || !AI_FORMATS.includes(format)) {
      go();
      return;
    }
    Alert.alert('Include AI explanation?', 'Adds study notes with explanations and checked workings. Uses AI credits.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Calculation only', onPress: () => go() },
      { text: 'With AI explanation', onPress: () => go({ notes: true }) },
    ]);
  };

  const value = {
    run,
    exportItems,
    ai,
    drive,
    destination,
    setDestination: (to) => settings.update({ exportTo: to }),
  };

  return (
    <ExportContext.Provider value={value}>
      {children}
      <ProgressPill phase={phase} bottom={insets.bottom + 112} onCancel={cancel} />
    </ExportContext.Provider>
  );
}

/** const exporter = useExport(); exporter.exportItems(items, 'pdf') */
export function useExport() {
  return useContext(ExportContext);
}

const styles = StyleSheet.create({
  // like the toast (components/Toast.js), above it so the two never overlap
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 99, elevation: 99 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TOAST_BG,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    maxWidth: '90%',
  },
  text: { color: '#fff', fontSize: 13.5, fontFamily: F.bodySemi },
  message: { flexShrink: 1 },
  cancel: { color: ACCENT_DARK, fontFamily: F.bodyHeavy },
});
