// Smoke test: renders the real screens and presses some keys.
import { renderRouter, screen, fireEvent, act } from 'expo-router/testing-library';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => 'id-' + ++n };
});
// Fonts are not needed to test behaviour.
jest.mock('expo-font', () => ({ useFonts: () => [true], loadAsync: jest.fn() }));

// A key's face is rendered after the small SHIFT label above it, so press the last match.
const press = (label) => fireEvent.press(screen.getAllByText(label).at(-1));

async function renderApp() {
  renderRouter('./src/app');
  // let SettingsProvider finish loading from AsyncStorage
  await act(async () => {});
}

test('calculates (3+4)×12−5 and shows it in the history', async () => {
  await renderApp();
  for (const k of ['(', '3', '+', '4', ')', '×', '1', '2', '−', '5']) press(k);
  expect(screen.getByText('(3+4)×12−5')).toBeTruthy();
  press('=');
  expect(screen.getByText('= 79')).toBeTruthy();
});

test('degree mode is the default: sin(30) = 0.5', async () => {
  await renderApp();
  for (const k of ['sin', '3', '0']) press(k);
  press('=');
  expect(screen.getByText('= 0.5')).toBeTruthy();
});

test('SHIFT changes key faces and inserts the shifted token', async () => {
  await renderApp();
  press('SHIFT');
  expect(screen.getByText('SHIFT ON')).toBeTruthy();
  press('sin⁻¹'); // shifted face of "sin"
  press('1');
  press('=');
  expect(screen.getByText('= 90')).toBeTruthy();
});

test('DEL removes a whole function token', async () => {
  await renderApp();
  press('2');
  press('sin');
  expect(screen.getByText('2sin(')).toBeTruthy();
  press('DEL');
  expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  expect(screen.queryByText('2sin(')).toBeNull();
});

test('holding a calculation shows workings, and Pin adds the pinned pill', async () => {
  await renderApp();
  for (const k of ['(', '3', '+', '4', ')', '×', '2']) press(k);
  press('=');
  fireEvent(screen.getByText('= 14').parent, 'longPress');
  expect(screen.getByText('STEP 2 — GROUPED TERMS RESOLVED')).toBeTruthy();
  expect(screen.getByText('7×2')).toBeTruthy();
  expect(screen.getByText('Sign in for detailed steps')).toBeTruthy(); // tests run as a guest
  const ones = screen.getAllByText('1').length; // the "1" key
  press('Pin');
  // the pinned pill appears showing "1"
  expect(screen.getAllByText('1').length).toBe(ones + 1);
});
