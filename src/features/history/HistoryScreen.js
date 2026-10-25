// History screen: all calculations (Recent) or pinned ones (Starred, ?filter=pinned).
// Tap a row to edit it again on the calculator; pin / copy / delete per row (delete
// and Clear can be undone). Select, then tap rows (or All), then Export them.
import { useEffect, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/components/showAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AngleBadge from '@/components/AngleBadge';
import ScreenHeader from '@/components/ScreenHeader';
import { CloseIcon, CopyIcon, ExportIcon, PinIcon, SelectIcon, TrashIcon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useExport } from '@/features/export/ExportContext';
import ExportRow from '@/features/export/ExportRow';
import { useSettings } from '@/features/settings/SettingsContext';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';
import { useHistory } from './HistoryContext';
import { formatDate } from './exportHistory';

function IconButton({ onPress, label, children }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

function Row({ item, t, selecting, selected, onOpen, onToggle, onPin, onCopy, onDelete }) {
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: item.pinned ? t.pinnedRowBg : t.card, borderColor: t.divider },
        selected && { backgroundColor: t.selBg, borderColor: BLUE },
      ]}
    >
      <Pressable
        onPress={selecting ? onToggle : onOpen}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked: selected } : undefined}
        accessibilityHint={selecting ? 'Tap to select or deselect' : 'Opens it on the calculator to edit'}
        style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.head}>
          <View style={styles.badges}>
            {selecting && (
              <View style={[styles.check, selected ? styles.checkOn : { borderColor: t.sub }]}>
                {selected && <Text style={styles.checkMark}>✓</Text>}
              </View>
            )}
            <AngleBadge angle={item.angle} t={t} />
          </View>
          <Text style={[styles.expr, { color: t.sub }]}>{item.expr}</Text>
        </View>
        <Text style={[styles.result, { color: t.text }]}>= {item.result}</Text>
        <Text style={[styles.meta, { color: t.sub }]}>
          {formatDate(item.createdAt)}
        </Text>
      </Pressable>
      {!selecting && (
        <>
          <IconButton onPress={onPin} label={item.pinned ? 'Unpin' : 'Pin'}>
            <PinIcon color={item.pinned ? BLUE : t.sub} filled={item.pinned} />
          </IconButton>
          <IconButton onPress={onCopy} label="Copy result">
            <CopyIcon color={t.sub} />
          </IconButton>
          <IconButton onPress={onDelete} label="Delete">
            <TrashIcon color={t.sub} />
          </IconButton>
        </>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { theme: t } = useSettings();
  const history = useHistory();
  const toast = useToast();
  const exporter = useExport();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { filter } = useLocalSearchParams();
  const starred = filter === 'pinned';
  const [selected, setSelected] = useState(null); // Set of ids while selecting, else null
  const [exportOpen, setExportOpen] = useState(false);
  const selecting = selected !== null;

  const matching = history.items.filter((it) => !starred || it.pinned); // oldest first, for export
  const items = [...matching].reverse(); // newest first
  const picked = selecting ? matching.filter((it) => selected.has(it.id)) : []; // oldest first
  const allPicked = selecting && picked.length === matching.length;

  const startSelect = () => setSelected(new Set());
  const endSelect = () => {
    setSelected(null);
    setExportOpen(false);
  };
  const toggle = (id) =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(matching.map((it) => it.id)));

  // the export formats only make sense with something selected
  useEffect(() => {
    if (picked.length === 0) setExportOpen(false);
  }, [picked.length]);
  // nothing left to select (Clear, or the last starred one unpinned)
  useEffect(() => {
    if (matching.length === 0) setSelected(null);
  }, [matching.length]);
  // Android back ends selecting first
  useEffect(() => {
    if (!selecting) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      setExportOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
    toast('Copied');
  };

  const undo = (deleted) => ({ label: 'Undo', onPress: () => history.restore(deleted) });

  const remove = (item) => {
    history.remove(item.id);
    toast('Deleted', { action: undo([item]) });
  };

  const confirmClear = () =>
    showAlert('Clear all history?', 'This deletes every calculation, including pinned ones.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          const all = history.items;
          history.clear();
          toast('History cleared', { action: undo(all) });
        },
      },
    ]);

  // back to the calculator (the one already open, see Drawer) with this calculation in the entry
  const open = (item) => router.dismissTo({ pathname: '/', params: { recall: item.id } });

  const onExport = (format) => {
    exporter.exportItems(picked, format, endSelect);
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader t={t} title={starred ? 'Starred' : 'Recent'} />

      {items.length > 0 &&
        (selecting ? (
          <View style={[styles.toolbar, { borderColor: t.divider }]}>
            <Pressable onPress={endSelect} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel selection">
              <CloseIcon color={t.text} size={19} />
            </Pressable>
            <Text style={[styles.count, { color: t.text }]} accessibilityLiveRegion="polite">
              {picked.length} selected
            </Text>
            <Pressable onPress={toggleAll} style={styles.toolBtn} hitSlop={6} accessibilityRole="button">
              <Text style={[styles.toolText, { color: t.text }]}>{allPicked ? 'None' : 'All'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setExportOpen((o) => !o)}
              disabled={picked.length === 0}
              style={[styles.toolBtn, picked.length === 0 && styles.disabled]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={'Export ' + picked.length + ' selected'}
              accessibilityState={{ disabled: picked.length === 0 }}
            >
              <ExportIcon color={exportOpen ? BLUE : t.text} size={17} />
              <Text style={[styles.toolText, { color: exportOpen ? BLUE : t.text }]}>Export</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.toolbar, { borderColor: t.divider }]}>
            <Text style={[styles.count, { color: t.sub }]}>
              {items.length} {items.length === 1 ? 'calculation' : 'calculations'}
            </Text>
            <Pressable onPress={startSelect} style={styles.toolBtn} hitSlop={6} accessibilityRole="button">
              <SelectIcon color={t.text} size={17} />
              <Text style={[styles.toolText, { color: t.text }]}>Select</Text>
            </Pressable>
            {!starred && (
              <Pressable onPress={confirmClear} style={styles.toolBtn} hitSlop={6} accessibilityRole="button">
                <TrashIcon color={t.text} size={17} />
                <Text style={[styles.toolText, { color: t.text }]}>Clear</Text>
              </Pressable>
            )}
          </View>
        ))}
      {exportOpen && picked.length > 0 && (
        <View style={[styles.exportWrap, { backgroundColor: t.card, borderColor: t.divider }]}>
          <ExportRow onExport={onExport} t={t} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
        extraData={selected}
        renderItem={({ item }) => (
          <Row
            item={item}
            t={t}
            selecting={selecting}
            selected={!!selected?.has(item.id)}
            onToggle={() => toggle(item.id)}
            onOpen={() => open(item)}
            onPin={() => history.togglePin(item.id)}
            onCopy={() => copy(item.result)}
            onDelete={() => remove(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.sub }]}>{starred ? 'No starred items yet.' : 'Nothing here yet.'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  count: { flex: 1, fontFamily: F.bodySemi, fontSize: 14 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolText: { fontFamily: F.bodyBold, fontSize: 14.5 },
  disabled: { opacity: 0.35 },
  exportWrap: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
  },
  // badge pinned top-left, expression top-right
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // like the calculator's cards (DisplayPanel)
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: BLUE, borderColor: BLUE },
  checkMark: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: F.bodyHeavy },
  expr: { fontFamily: F.mono, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  result: { fontFamily: F.monoBold, fontSize: 19, marginTop: 2 },
  meta: { fontFamily: F.label, fontSize: 11.5, marginTop: 4, letterSpacing: 0.3 },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontFamily: F.bodySemi, fontSize: 15 },
});
