// Web: the app in a phone-width column, centred on wide screens. The drawer, toasts
// and panels position themselves inside it, so they stay in the column too.
import { StyleSheet, View } from 'react-native';
import { useSettings } from '@/features/settings/SettingsContext';

const MAX_WIDTH = 480;

export default function AppFrame({ children }) {
  const { theme } = useSettings();
  return (
    <View style={[styles.page, { backgroundColor: theme.dark ? '#0b0f14' : '#dfe4ea' }]}>
      <View style={[styles.column, { backgroundColor: theme.bg }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0,0,0,.18)',
  },
});
