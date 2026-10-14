// Settings → AI integration (the AI switch) and Google Drive.
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { DRIVE_SCOPE } from '@/services/drive';

let mockAuthUser = null;
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(mockAuthUser);
    return () => {};
  },
  GoogleAuthProvider: { credential: jest.fn() },
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/history/historyCloud', () => ({
  subscribe: () => () => {},
  put: () => Promise.resolve(),
  patch: () => Promise.resolve(),
  del: () => Promise.resolve(),
  mergeLocal: () => Promise.resolve(),
  clearAll: () => Promise.resolve(),
}));

const TEST_USER = { uid: 'u1', displayName: 'Test', email: 't@example.com' };
const saved = async () => JSON.parse(await AsyncStorage.getItem('calq.settings'));
const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

async function openSettings(settings) {
  if (settings) await AsyncStorage.setItem('calq.settings', JSON.stringify(settings));
  renderRouter('./src/app', { initialUrl: '/settings' });
  await act(async () => {});
}

let scopes;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAuthUser = TEST_USER;
  // Google on the device: the same account, Drive access only once addScopes is accepted
  scopes = [];
  GoogleSignin.getCurrentUser.mockImplementation(() => ({ user: { email: 't@example.com' }, scopes }));
  GoogleSignin.addScopes.mockImplementation(async () => {
    scopes = [DRIVE_SCOPE];
    return { type: 'success', data: { user: { email: 't@example.com' }, scopes } };
  });
  global.fetch = jest.fn();
});

test('guests are asked to sign in for AI features and Drive', async () => {
  mockAuthUser = null;
  await openSettings();
  expect(screen.getByText('AI INTEGRATION')).toBeTruthy();
  expect(screen.getByText('GOOGLE DRIVE')).toBeTruthy();
  expect(screen.queryByText('EXPORT')).toBeNull();
  expect(screen.getByText('Sign in to get AI help')).toBeTruthy();
  expect(screen.getByText('Sign in with Google to save exports to your Drive')).toBeTruthy();
  expect(screen.getByRole('switch').props.accessibilityState).toEqual({ checked: false, disabled: true });
  fireEvent.press(screen.getByText('AI help'));
  expect(screen.getAllByText('Sign in to get AI help')).toHaveLength(2); // + the toast
  expect(await saved()).toBeNull(); // nothing changed
});

test('the AI switch starts on, says what AI help does, and is saved', async () => {
  await openSettings();
  expect(screen.getByRole('switch').props.accessibilityState).toEqual({ checked: true, disabled: false });
  expect(screen.getByText('Solve a problem from a photo')).toBeTruthy();
  expect(screen.getByText('Your calculations are sent to an AI service to do this.')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByText('AI help')));
  expect((await saved()).ai).toBe(false);
  expect(screen.getByText('AI help is off')).toBeTruthy();
  expect(screen.getByText('Off · Calq works as a plain calculator')).toBeTruthy();
  expect(screen.queryByText('Solve a problem from a photo')).toBeNull();

  await act(async () => fireEvent.press(screen.getByText('AI help')));
  expect((await saved()).ai).toBe(true);
  expect(screen.getByText('AI help is on')).toBeTruthy();
});

test('connect Google Drive, pick a folder, disconnect', async () => {
  fetch
    .mockImplementationOnce(() => json({ files: [] })) // no "Calq" folder yet
    .mockImplementationOnce(() => json({ id: 'f1', name: 'Calq' })); // made
  await openSettings();
  await act(async () => fireEvent.press(screen.getByText('Connect Google Drive')));

  expect(GoogleSignin.addScopes).toHaveBeenCalledWith({ scopes: [DRIVE_SCOPE] });
  expect(screen.getByText('Connected · t@example.com')).toBeTruthy();
  expect(screen.getByText('Google Drive connected · exports go to Calq')).toBeTruthy();
  expect(await saved()).toMatchObject({ exportTo: 'drive', drive: { uid: 'u1', email: 't@example.com', folderId: 'f1', folderName: 'Calq' } });
  expect(JSON.stringify(await saved())).not.toContain('token'); // nothing secret on the device

  fetch.mockImplementationOnce(() => json({ files: [{ id: 'f1', name: 'Calq' }, { id: 'f2', name: 'Physics' }] }));
  await act(async () => fireEvent.press(screen.getByLabelText('Drive folder: Calq')));
  expect(screen.getByLabelText('My Drive')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByLabelText('Physics')));
  expect(screen.getByText('Exports go to Physics')).toBeTruthy();
  expect((await saved()).drive).toMatchObject({ folderId: 'f2', folderName: 'Physics' });

  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons[1].onPress());
  await act(async () => fireEvent.press(screen.getByText('Disconnect')));
  expect(GoogleSignin.revokeAccess).toHaveBeenCalled();
  expect(screen.getByText('Connect Google Drive')).toBeTruthy();
  expect(await saved()).toMatchObject({ drive: null, exportTo: 'share' });
  alert.mockRestore();
});

test('saying no to Google leaves Drive disconnected', async () => {
  GoogleSignin.addScopes.mockResolvedValueOnce({ type: 'cancelled', data: null });
  await openSettings();
  await act(async () => fireEvent.press(screen.getByText('Connect Google Drive')));
  expect(screen.getByText('Calq needs permission to save files in your Google Drive')).toBeTruthy();
  expect(screen.getByText('Connect Google Drive')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test('access removed outside Calq shows Reconnect, which keeps the folder', async () => {
  fetch.mockImplementationOnce(() => json({ id: 'f2', name: 'Physics', trashed: false }));
  await openSettings({ exportTo: 'drive', drive: { uid: 'u1', email: 't@example.com', folderId: 'f2', folderName: 'Physics' } });
  expect(screen.getByText('Reconnect needed: Calq no longer has access')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Reconnect Google Drive')));
  expect(screen.getByText('Connected · t@example.com')).toBeTruthy();
  expect(screen.getByText('Physics ›')).toBeTruthy();
});
