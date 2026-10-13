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
