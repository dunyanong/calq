import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets } from '@/theme/fonts';
import { SettingsProvider, useSettings } from '@/features/settings/SettingsContext';
import { AuthProvider } from '@/features/auth/AuthContext';
import { HistoryProvider, useHistory } from '@/features/history/HistoryContext';
import { ToastProvider } from '@/components/Toast';
import { DrawerProvider } from '@/components/Drawer';

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { theme, ready: settingsReady } = useSettings();
  const { ready: historyReady } = useHistory();
  const ready = settingsReady && historyReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.bg } }} />
    </>
  );
}

export default function RootLayout() {
  // Load fonts before anything renders text.
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <HistoryProvider>
            <ToastProvider>
              <DrawerProvider>
                <AppShell />
              </DrawerProvider>
            </ToastProvider>
          </HistoryProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
