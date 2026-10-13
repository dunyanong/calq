// Modal from Settings → Google Drive → Folder: where exports are saved in Drive.
// Calq only has drive.file access, so it lists My Drive and the folders Calq made;
// a new folder can be made here too.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CloseIcon, DriveIcon } from '@/components/Icons';
import Popup from '@/components/Popup';
import { ROOT, createFolder, listFolders } from '@/services/drive';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

function FolderRow({ folder, selected, t, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={folder.name}
      style={({ pressed }) => [styles.row, { borderTopColor: t.displayRule }, selected && { backgroundColor: t.selBg }, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.radio, { borderColor: selected ? BLUE : t.panelAction }]}>{selected && <View style={styles.dot} />}</View>
      <Text style={[styles.name, { color: t.panelInk }]} numberOfLines={1}>
        {folder.name}
      </Text>
    </Pressable>
  );
}

function PickerBody({ current, t, onClose, onChoose }) {
  const [folders, setFolders] = useState(null); // null while loading
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listFolders()
      .then((list) => !cancelled && setFolders(list))
      .catch((e) => {
        if (cancelled) return;
        setFolders([]);
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError('');
    try {
      onChoose(await createFolder(trimmed));
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  };

  // the current folder stays listed even if the list could not be loaded
  const all = [ROOT, ...(folders || [])];
  if (current && !all.some((f) => f.id === current.id)) all.splice(1, 0, current);

  return (
    <>
      <View style={styles.head}>
        <DriveIcon color={t.panelInk} />
        <Text style={[styles.title, { color: t.panelInk }]} accessibilityRole="header">
          Save exports in
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon color={t.panelAction} />
        </Pressable>
      </View>
      <ScrollView style={styles.list} accessibilityRole="radiogroup">
        {all.map((f) => (
          <FolderRow key={f.id} folder={f} selected={f.id === current?.id} t={t} onPress={() => onChoose(f)} />
        ))}
        {folders === null && <ActivityIndicator style={styles.loading} color={BLUE} />}
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: t.displayRule }]}>
        <Text style={styles.hint}>Calq can only see folders it made. New folder:</Text>
        <View style={styles.newRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Maths revision"
            placeholderTextColor="#93958f"
            maxLength={80}
            onSubmitEditing={create}
            style={[styles.input, { color: t.panelInk, borderColor: t.displayRule }]}
          />
          <Pressable
            onPress={create}
            disabled={creating || !name.trim()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.create, { opacity: creating || !name.trim() ? 0.4 : pressed ? 0.6 : 1 }]}
          >
            {creating ? <ActivityIndicator size="small" color={BLUE} /> : <Text style={styles.createText}>Create</Text>}
          </Pressable>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </>
  );
}

/**
 * @param {object} p
 * @param {number} p.session  changes on every open, so the list loads again
 * @param {{id: string, name: string}} p.current
 * @param {(folder: {id: string, name: string}) => void} p.onChoose
 */
export default function DriveFolderPicker({ visible, session, current, t, onClose, onChoose }) {
  return (
    <Popup visible={visible} session={session} t={t} onClose={onClose} style={styles.panel}>
      <PickerBody current={current} t={t} onClose={onClose} onChoose={onChoose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  panel: { maxWidth: 360, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  title: { flex: 1, fontFamily: F.bodySemi, fontSize: 17 },
  list: { maxHeight: 280 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderTopWidth: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: BLUE },
  name: { flex: 1, fontFamily: F.bodySemi, fontSize: 15 },
  loading: { paddingVertical: 14 },
  foot: { gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1 },
  hint: { fontFamily: F.label, fontSize: 12, color: '#93958f' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontFamily: F.body, fontSize: 15, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  create: { borderWidth: 1.5, borderColor: BLUE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 72, alignItems: 'center' },
  createText: { fontFamily: F.labelBold, fontSize: 14, color: BLUE },
  error: { fontFamily: F.label, fontSize: 12, color: '#c0564b' },
});
