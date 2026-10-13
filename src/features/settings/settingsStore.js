import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANGLE_UNITS } from '@/components/AngleBadge';

const KEY = 'calq.settings';

export const DEFAULT_SETTINGS = {
  angle: 'deg', // 'deg' | 'rad' | 'grad'
  output: 'dec', // 'dec' | 'frac'
  dark: false,
  // calculator memory, kept here so it survives a restart like on a Casio
  ans: 0,
  vars: { A: 0, B: 0, C: 0, D: 0, F: 0, M: 0 },
  // New session (+ in the calculator header): the calculator shows calculations from this time on
  sessionStart: 0,
  // Export: Markdown / LaTeX / PDF as AI study notes (signed in only), and where exports go
  aiNotes: false,
  exportTo: 'share', // 'share' | 'drive'
  // Google Drive connected for one Calq user: { uid, email, folderId, folderName }. No tokens:
  // Google Sign-In keeps those (services/drive.js).
  drive: null,
};

const EXPORT_TO = ['share', 'drive'];

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw);
    const settings = { ...DEFAULT_SETTINGS, ...saved, vars: { ...DEFAULT_SETTINGS.vars, ...saved.vars } };
    // an unknown unit (corrupt or from a newer build) would be read as radians by the engine
    if (!ANGLE_UNITS.includes(settings.angle)) settings.angle = DEFAULT_SETTINGS.angle;
    if (!EXPORT_TO.includes(settings.exportTo)) settings.exportTo = DEFAULT_SETTINGS.exportTo;
    if (typeof settings.drive?.uid !== 'string' || typeof settings.drive.folderId !== 'string') settings.drive = null;
    settings.aiNotes = settings.aiNotes === true;
    return settings;
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
