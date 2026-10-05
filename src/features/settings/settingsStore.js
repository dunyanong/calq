import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'calq.settings';

export const DEFAULT_SETTINGS = {
  angle: 'deg', // 'deg' | 'rad'
  output: 'dec', // 'dec' | 'frac'
  dark: false,
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // settings are a convenience; ignore storage errors
  }
}
