import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, loadSettings } from '../settingsStore';

beforeEach(() => AsyncStorage.clear());

const saved = (s) => AsyncStorage.setItem('calq.settings', JSON.stringify(s));

test('nothing saved: the defaults (degrees)', async () => {
  expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test.each(['deg', 'rad', 'grad'])('keeps a saved %s angle unit', async (angle) => {
  await saved({ angle });
  expect((await loadSettings()).angle).toBe(angle);
});

test.each(['turn', null, 7])('an unknown angle unit (%p) falls back to degrees', async (angle) => {
  await saved({ angle, output: 'frac' });
  const s = await loadSettings();
  expect(s.angle).toBe('deg');
  expect(s.output).toBe('frac'); // the rest is kept
});

test('export settings: unknown or malformed values fall back to the defaults', async () => {
  await saved({ exportTo: 'ftp', ai: 'yes', drive: { uid: 'u1' } });
  const s = await loadSettings();
  expect(s.exportTo).toBe('share');
  expect(s.ai).toBe(true);
  expect(s.drive).toBeNull();
});

test('AI is on unless it was turned off; the old AI notes switch is dropped', async () => {
  expect((await loadSettings()).ai).toBe(true);
  await saved({ ai: false, aiNotes: true });
  const s = await loadSettings();
  expect(s.ai).toBe(false);
  expect(s).not.toHaveProperty('aiNotes');
});

test('a connected Drive and the AI switch are kept', async () => {
  const drive = { uid: 'u1', email: 'a@example.com', folderId: 'f1', folderName: 'Calq' };
  await saved({ exportTo: 'drive', ai: false, drive });
  expect(await loadSettings()).toMatchObject({ exportTo: 'drive', ai: false, drive });
});
