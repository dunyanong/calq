// History screen: all calculations (Recent) or pinned ones (Starred, ?filter=pinned).
// Tap a row to edit it again on the calculator; pin / copy / delete per row (delete
// and Clear can be undone); Export for the whole list.
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AngleBadge from '@/components/AngleBadge';
import ScreenHeader from '@/components/ScreenHeader';
import { CopyIcon, ExportIcon, PinIcon, TrashIcon } from '@/components/Icons';
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

function Row({ item, t, onOpen, onPin, onCopy, onDelete }) {
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: item.pinned ? t.pinnedRowBg : t.card, borderColor: t.divider },
      ]}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityHint="Opens it on the calculator to edit"
        style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.head}>
          <AngleBadge angle={item.angle} t={t} />
          <Text style={[styles.expr, { color: t.sub }]}>{item.expr}</Text>
        </View>
        <Text style={[styles.result, { color: t.text }]}>= {item.result}</Text>
        <Text style={[styles.meta, { color: t.sub }]}>
          {formatDate(item.createdAt)}
        </Text>
      </Pressable>
      <IconButton onPress={onPin} label={item.pinned ? 'Unpin' : 'Pin'}>
        <PinIcon color={item.pinned ? BLUE : t.sub} filled={item.pinned} />
      </IconButton>
      <IconButton onPress={onCopy} label="Copy result">
        <CopyIcon color={t.sub} />
      </IconButton>
      <IconButton onPress={onDelete} label="Delete">
        <TrashIcon color={t.sub} />
      </IconButton>
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
  const [exportOpen, setExportOpen] = useState(false);

  const matching = history.items.filter((it) => !starred || it.pinned); // oldest first, for export
  const items = [...matching].reverse(); // newest first

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
    Alert.alert('Clear all history?', 'This deletes every calculation, including pinned ones.', [
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
    setExportOpen(false);
    exporter.run(matching, format);
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader t={t} title={starred ? 'Starred' : 'Recent'} />

      {items.length > 0 && (
        <View style={[styles.toolbar, { borderColor: t.divider }]}>
          <Text style={[styles.count, { color: t.sub }]}>
            {items.length} {items.length === 1 ? 'calculation' : 'calculations'}
          </Text>
          <Pressable onPress={() => setExportOpen((o) => !o)} style={styles.toolBtn} hitSlop={6}>
            <ExportIcon color={exportOpen ? BLUE : t.text} size={17} />
            <Text style={[styles.toolText, { color: exportOpen ? BLUE : t.text }]}>Export</Text>
          </Pressable>
          {!starred && (
            <Pressable onPress={confirmClear} style={styles.toolBtn} hitSlop={6}>
              <TrashIcon color={t.text} size={17} />
              <Text style={[styles.toolText, { color: t.text }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}
      {exportOpen && items.length > 0 && (
        <View style={[styles.exportWrap, { backgroundColor: t.card, borderColor: t.divider }]}>
          <ExportRow onExport={onExport} t={t} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
        renderItem={({ item }) => (
          <Row
            item={item}
            t={t}
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
  expr: { fontFamily: F.mono, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  result: { fontFamily: F.monoBold, fontSize: 19, marginTop: 2 },
  meta: { fontFamily: F.label, fontSize: 11.5, marginTop: 4, letterSpacing: 0.3 },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontFamily: F.bodySemi, fontSize: 15 },
});
