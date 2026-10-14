// Export for the calculations selected on the calculator (header → Export).
import { StyleSheet, Text } from 'react-native';
import Popup from '@/components/Popup';
import ExportRow from '@/features/export/ExportRow';
import { F } from '@/theme/fonts';

/**
 * @param {object} p
 * @param {number} p.count       calculations selected
 * @param {number} p.session     changes on every open
 * @param {(format: string) => void} p.onExport
 */
export default function ExportSheet({ visible, session, count, t, onClose, onExport }) {
  return (
    <Popup visible={visible} session={session} t={t} onClose={onClose} style={styles.panel}>
      <Text style={[styles.title, { color: t.panelInk }]}>
        Export {count} {count === 1 ? 'calculation' : 'calculations'}
      </Text>
      <ExportRow onExport={onExport} t={t} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  panel: { paddingTop: 15, paddingHorizontal: 16, paddingBottom: 13 },
  title: { fontFamily: F.bodyBold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
});
