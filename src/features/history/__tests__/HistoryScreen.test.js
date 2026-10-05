// History persists on the device and shows on the History screen (guest mode).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderRouter, screen, fireEvent, act } from 'expo-router/testing-library';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => 'id-' + ++n };
});
jest.mock('expo-font', () => ({ useFonts: () => [true], loadAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: {} }));
jest.mock('expo-sharing', () => ({}));

const press = (label) => fireEvent.press(screen.getAllByText(label).at(-1));

async function render(url = '/') {
  renderRouter('./src/app', { initialUrl: url });
  await act(async () => {}); // let providers load from AsyncStorage
}

beforeEach(() => AsyncStorage.clear());

test('a calculation survives an app restart and appears in Recent', async () => {
  await render();
  for (const k of ['6', '×', '7']) press(k);
  press('=');
  expect(screen.getByText('= 42')).toBeTruthy();
  await act(async () => {}); // save to storage
  screen.unmount();

  await render('/history');
  expect(screen.getAllByText('Recent')).toHaveLength(2); // header + drawer
  expect(screen.getByText('6×7')).toBeTruthy();
  expect(screen.getByText('= 42')).toBeTruthy();
  expect(screen.getByText('1 calculation')).toBeTruthy();
});

test('Starred shows only pinned items, and delete removes a row', async () => {
  const now = Date.now();
  const item = (id, expr, result, pinned) => ({ id, expr, result, angle: 'deg', pinned, createdAt: now, updatedAt: now });
  await AsyncStorage.setItem('calq.history', JSON.stringify([item('a', '1+1', '2', true), item('b', '2+3', '5', false)]));

  await render('/history?filter=pinned');
  expect(screen.getAllByText('Starred')).toHaveLength(2); // header + drawer
  expect(screen.getByText('1+1')).toBeTruthy();
  expect(screen.queryByText('2+3')).toBeNull();

  fireEvent.press(screen.getByLabelText('Delete'));
  expect(screen.getByText('No starred items yet.')).toBeTruthy();
});

test('empty history shows the empty state', async () => {
  await render('/history');
  expect(screen.getByText('Nothing here yet.')).toBeTruthy();
});
