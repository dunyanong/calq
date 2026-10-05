import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F } from '@/theme/fonts';

/** Two-or-more option picker used in Settings (Degrees / Radians …). */
export default function Segmented({ options, value, onChange, t }) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.opt,
              {
                backgroundColor: on ? t.selBg : 'transparent',
                borderColor: on ? t.accent : t.divider,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.text, { color: on ? t.accentText : t.sub }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  opt: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 11, borderWidth: 1.5 },
  text: { fontFamily: F.bodyBold, fontSize: 14.5 },
});
