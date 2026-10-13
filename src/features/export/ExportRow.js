// Export buttons (hold panel and History screen): where to send it when Google Drive
// is connected, then one tap per format. ✦ marks the formats that become AI study notes.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CsvIcon, DriveIcon, LatexIcon, MarkdownIcon, PdfIcon, SparkleIcon, TextIcon } from '@/components/Icons';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';
import { useExport } from './ExportContext';
import { AI_FORMATS } from './studyNotes';

const EXPORT_FORMATS = [
  { key: 'csv', label: 'CSV', color: '#3d9c8b', Icon: CsvIcon },
  { key: 'text', label: 'Text', color: BLUE, Icon: TextIcon },
  { key: 'markdown', label: 'Markdown', color: '#727d8b', Icon: MarkdownIcon },
  { key: 'latex', label: 'LaTeX', color: '#7a5cc4', Icon: LatexIcon },
  { key: 'pdf', label: 'PDF', color: '#d0473f', Icon: PdfIcon },
];

function Destination({ label, active, onPress, t, children }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={'Send to ' + label}
      style={({ pressed }) => [
        styles.dest,
        { borderColor: active ? BLUE : t.divider, backgroundColor: active ? t.selBg : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {children}
      <Text style={[styles.destText, { color: active ? t.accentText : t.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** @param {{onExport: (format: string) => void, t: object}} p */
export default function ExportRow({ onExport, t }) {
  const { ai, drive, destination, setDestination } = useExport();
  return (
    <View style={styles.wrap}>
      {drive && (
        <View style={styles.destRow} accessibilityRole="radiogroup">
          <Text style={[styles.sendTo, { color: t.sub }]}>Send to</Text>
          <Destination label="Share" active={destination === 'share'} onPress={() => setDestination('share')} t={t} />
          <Destination label={'Drive · ' + drive.folderName} active={destination === 'drive'} onPress={() => setDestination('drive')} t={t}>
            <DriveIcon size={14} color={destination === 'drive' ? t.accentText : t.sub} />
          </Destination>
        </View>
      )}
      <View style={styles.exportRow}>
        {EXPORT_FORMATS.map(({ key, label, color, Icon }) => {
          const notes = ai && AI_FORMATS.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => onExport(key)}
              accessibilityRole="button"
              accessibilityLabel={label + (notes ? ' study notes' : '')}
              style={({ pressed }) => [styles.exportBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View>
                <Icon color={color} />
                {notes && (
                  <View style={styles.spark}>
                    <SparkleIcon color={BLUE} size={10} />
                  </View>
                )}
              </View>
              <Text style={[styles.exportText, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {ai && (
        <View style={styles.aiHint}>
          <SparkleIcon color={BLUE} size={10} />
          <Text style={[styles.aiText, { color: t.sub }]}>Markdown, LaTeX and PDF export as AI study notes</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  sendTo: { fontFamily: F.labelBold, fontSize: 10.5, letterSpacing: 0.4, marginRight: 2 },
  dest: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 9, flexShrink: 1 },
  destText: { fontFamily: F.labelBold, fontSize: 11.5, flexShrink: 1 },
  exportRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  exportBtn: { alignItems: 'center', gap: 4, width: 56 }, // five fit the 308px panel
  exportText: { fontFamily: F.labelBold, fontSize: 10 },
  spark: { position: 'absolute', top: -5, right: -7 },
  aiHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  aiText: { fontFamily: F.label, fontSize: 11 },
});
