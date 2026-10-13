// Google Drive: drive.file access through Google Sign-In, folders, uploads and errors.
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE, DriveError, ROOT, connect, disconnect, ensureFolder, isConnected, listFolders, upload } from '@/services/drive';

const EMAIL = 'ada@example.com';
const googleUser = (scopes = [], email = EMAIL) => ({ user: { email }, scopes, idToken: 'id' });
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
const driveError = (status, reason) => json(status, { error: { code: status, errors: [{ reason }] } });

beforeEach(() => {
  jest.clearAllMocks();
  GoogleSignin.getCurrentUser.mockReturnValue(googleUser([DRIVE_SCOPE]));
  global.fetch = jest.fn();
});

/** The DriveError code a promise rejects with. */
const codeOf = (p) => p.then(() => 'resolved', (e) => (e instanceof DriveError ? e.code : 'other: ' + e.message));

describe('connect', () => {
  test('asks for drive.file only, and only when it is missing', async () => {
    await connect(EMAIL);
    expect(GoogleSignin.addScopes).not.toHaveBeenCalled();

    GoogleSignin.getCurrentUser.mockReturnValue(googleUser([]));
    GoogleSignin.addScopes.mockResolvedValueOnce({ type: 'success', data: googleUser([DRIVE_SCOPE]) });
    await connect('ADA@example.com'); // same account, different case
    expect(GoogleSignin.addScopes).toHaveBeenCalledWith({ scopes: ['https://www.googleapis.com/auth/drive.file'] });
  });

  test('saying no is "cancelled"', async () => {
    GoogleSignin.getCurrentUser.mockReturnValue(googleUser([]));
    GoogleSignin.addScopes.mockResolvedValueOnce({ type: 'cancelled', data: null });
    expect(await codeOf(connect(EMAIL))).toBe('cancelled');
    GoogleSignin.addScopes.mockResolvedValueOnce({ type: 'success', data: googleUser([]) }); // unticked the box
    expect(await codeOf(connect(EMAIL))).toBe('cancelled');
  });

  test('restores the Google session after a restart, or opens the account picker', async () => {
    GoogleSignin.getCurrentUser.mockReturnValue(null);
    GoogleSignin.hasPreviousSignIn.mockReturnValueOnce(true);
    GoogleSignin.signInSilently.mockResolvedValueOnce({ type: 'success', data: googleUser([DRIVE_SCOPE]) });
    await connect(EMAIL);
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();

    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'success', data: googleUser([DRIVE_SCOPE]) });
    await connect(EMAIL);
    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);
  });

  test('Drive must belong to the Calq account', async () => {
    GoogleSignin.getCurrentUser.mockReturnValue(googleUser([DRIVE_SCOPE], 'other@example.com'));
    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'success', data: googleUser([DRIVE_SCOPE], 'other@example.com') });
    expect(await codeOf(connect(EMAIL))).toBe('account');
    expect(GoogleSignin.signOut).toHaveBeenCalled(); // the picker was offered first

    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    expect(await codeOf(connect(EMAIL))).toBe('cancelled');
  });

  test('isConnected and disconnect', async () => {
    expect(await isConnected(EMAIL)).toBe(true);
    expect(await isConnected('bob@example.com')).toBe(false);
    GoogleSignin.getCurrentUser.mockReturnValue(googleUser([]));
    expect(await isConnected(EMAIL)).toBe(false);

    await disconnect();
    expect(GoogleSignin.revokeAccess).toHaveBeenCalled();
  });
});

describe('requests', () => {
  test('the access token comes from Google Sign-In for each call', async () => {
    fetch.mockResolvedValue(json(200, { files: [{ id: 'f1', name: 'Calq' }] }));
    expect(await listFolders()).toEqual([{ id: 'f1', name: 'Calq' }]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("q=mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse");
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  test('without drive.file nothing is sent', async () => {
    GoogleSignin.getCurrentUser.mockReturnValue(googleUser([]));
    expect(await codeOf(listFolders())).toBe('reconnect');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('a rejected token is replaced once, then it is "reconnect"', async () => {
    fetch.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(200, { files: [] }));
    expect(await listFolders()).toEqual([]);
    expect(GoogleSignin.getTokens).toHaveBeenCalledTimes(2);

    fetch.mockResolvedValue(json(401, {}));
    expect(await codeOf(listFolders())).toBe('reconnect');
  });

  test.each([
    { what: '403 storageQuotaExceeded', res: driveError(403, 'storageQuotaExceeded'), code: 'full' },
    { what: '403 accessNotConfigured (Drive API off)', res: driveError(403, 'accessNotConfigured'), code: 'setup' },
    { what: '403 userRateLimitExceeded', res: driveError(403, 'userRateLimitExceeded'), code: 'busy' },
    { what: '403 insufficientPermissions', res: driveError(403, 'insufficientPermissions'), code: 'reconnect' },
    { what: '429', res: json(429, {}), code: 'busy' },
    { what: '503', res: json(503, {}), code: 'busy' },
    { what: '400', res: json(400, {}), code: 'failed' },
  ])('$what is "$code"', async ({ res, code }) => {
    fetch.mockResolvedValue(res);
    expect(await codeOf(listFolders())).toBe(code);
  });

  test('no network is "offline"', async () => {
    fetch.mockRejectedValue(new TypeError('Network request failed'));
    const e = await listFolders().catch((x) => x);
    expect(e.code).toBe('offline');
    expect(e.message).toBe('No connection. Check your network');
  });
});

describe('ensureFolder', () => {
  test('a folder that is still there is used as is; My Drive needs no call', async () => {
    fetch.mockResolvedValueOnce(json(200, { id: 'f1', name: 'Revision', trashed: false }));
    expect(await ensureFolder({ id: 'f1', name: 'Old name' })).toEqual({ id: 'f1', name: 'Revision' });
    expect(await ensureFolder(ROOT)).toBe(ROOT);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('a trashed folder is not used: Calq finds or makes one with the same name', async () => {
    fetch
      .mockResolvedValueOnce(json(200, { id: 'f1', name: 'Calq', trashed: true }))
      .mockResolvedValueOnce(json(200, { files: [{ id: 'f2', name: 'Calq' }] }));
    expect(await ensureFolder({ id: 'f1', name: 'Calq' })).toEqual({ id: 'f2', name: 'Calq' });

    fetch.mockResolvedValueOnce(json(404, {})).mockResolvedValueOnce(json(200, { files: [] })).mockResolvedValueOnce(json(200, { id: 'f3', name: 'Calq' }));
    expect(await ensureFolder({ id: 'f1', name: 'Calq' })).toEqual({ id: 'f3', name: 'Calq' });
    const [url, init] = fetch.mock.calls.at(-1);
    expect(url).toContain('/drive/v3/files?fields=id,name');
    expect(JSON.parse(init.body)).toEqual({ name: 'Calq', mimeType: 'application/vnd.google-apps.folder' });
  });
});

describe('upload', () => {
  const file = (size = 3) => ({ size, base64: jest.fn(() => Promise.resolve('QUJD')) });

  test('one multipart request: metadata, then the file as base64', async () => {
    fetch.mockResolvedValue(json(200, { id: 'x1', name: 'n', webViewLink: 'https://drive.google.com/file/d/x1/view' }));
    const res = await upload({ file: file(), name: 'Calq history 2026-10-13 14-03.pdf', mimeType: 'application/pdf', folderId: 'f1' });
    expect(res.webViewLink).toContain('x1');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
    const boundary = /boundary=(.+)$/.exec(init.headers['Content-Type'])[1];
    expect(init.headers['Content-Type']).toBe('multipart/related; boundary=' + boundary);
    expect(init.body.split('\r\n')).toEqual([
      '--' + boundary,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: 'Calq history 2026-10-13 14-03.pdf', mimeType: 'application/pdf', parents: ['f1'] }),
      '--' + boundary,
      'Content-Type: application/pdf',
      'Content-Transfer-Encoding: base64',
      '',
      'QUJD',
      '--' + boundary + '--',
      '',
    ]);
  });

  test('over 5 MB is refused before anything is read or sent', async () => {
    const big = file(6 * 1024 * 1024);
    expect(await codeOf(upload({ file: big, name: 'n', mimeType: 'text/csv', folderId: 'root' }))).toBe('too-large');
    expect(big.base64).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
