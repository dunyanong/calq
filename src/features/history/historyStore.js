// History on this device (AsyncStorage).
// Guests use GUEST_KEY. Signed-in users keep an offline copy of their cloud history under userKey(uid).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GUEST_KEY = 'calq.history';
export const userKey = (uid) => `calq.history.${uid}`;

export async function loadHistory(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function saveHistory(key, items) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch {
    // keep working in memory if storage fails
  }
}

export async function clearHistory(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
