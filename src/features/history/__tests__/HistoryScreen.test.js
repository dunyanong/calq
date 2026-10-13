// History persists on the device and shows on the History screen (guest mode).
import { Alert } from 'react-native';
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

test('each row shows the angle mode it was calculated in', async () => {
  const now = Date.now();
  const item = (id, angle) => ({ id, expr: 'sin(6.25)', result: '0', angle, pinned: false, createdAt: now, updatedAt: now });
  await AsyncStorage.setItem('calq.history', JSON.stringify([item('a', 'rad'), item('b', 'deg'), item('c', 'grad')]));

  await render('/history');
  expect(screen.getByLabelText('Radian mode')).toBeTruthy();
  expect(screen.getByLabelText('Degree mode')).toBeTruthy();
  expect(screen.getByText('RAD')).toBeTruthy();
  expect(screen.getByText('DEG')).toBeTruthy();
  expect(screen.getByLabelText('Gradian mode')).toBeTruthy();
  expect(screen.getByText('GRAD')).toBeTruthy();
});

const seed = (...items) => {
  const now = Date.now();
  const all = items.map(([id, expr, result], i) => ({ id, expr, result, angle: 'deg', pinned: false, createdAt: now + i, updatedAt: now + i }));
  return AsyncStorage.setItem('calq.history', JSON.stringify(all));
};

test('a deleted row comes back with Undo', async () => {
  await seed(['a', '1+1', '2'], ['b', '2+3', '5']);
  await render('/history');
  fireEvent.press(screen.getAllByLabelText('Delete')[1]); // newest first: 1+1
  expect(screen.queryByText('1+1')).toBeNull();
  press('Undo');
  expect(screen.getByText('1+1')).toBeTruthy();
  expect(screen.getByText('2 calculations')).toBeTruthy();
});

test('Clear can be undone', async () => {
  await seed(['a', '1+1', '2'], ['b', '2+3', '5']);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => buttons[1].onPress());
  await render('/history');
  press('Clear');
  expect(screen.getByText('Nothing here yet.')).toBeTruthy();
  press('Undo');
  expect(screen.getByText('2 calculations')).toBeTruthy();
  alert.mockRestore();
});

test('tapping a row opens it on the calculator to edit', async () => {
  await seed(['a', '7×6', '42']);
  await render('/history');
  fireEvent.press(screen.getByText('7×6'));
  await act(async () => {});
  expect(screen.getByLabelText('Cursor left')).toBeTruthy(); // on the calculator
  expect(screen.getAllByText('7×6')).toHaveLength(2); // the history card and the entry
});
