// Google Drive for exports (Settings → Google Drive).
//
// Uses the Google sign-in Calq already has, plus the drive.file scope, which is asked
// for only when the user connects Drive. With drive.file Calq can see and change only
// the files and folders it creates, nothing else in the user's Drive. Access tokens
// come from Google Sign-In for each request and are never stored by Calq or sent to
// its server.
import { Platform } from 'react-native';
import {
  GoogleSignin,
  ios_only_SCOPES_ALREADY_GRANTED,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { randomUUID } from 'expo-crypto';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const ROOT = { id: 'root', name: 'My Drive' };
export const DEFAULT_FOLDER = 'Calq';

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';
const MAX_UPLOAD = 5 * 1024 * 1024; // Drive's limit for a multipart upload

const MESSAGES = {
  reconnect: 'Reconnect Google Drive in Settings',
  account: 'Google Drive is connected to a different Google account. Reconnect it in Settings',
  setup: 'Google Drive is not set up for Calq yet',
  full: 'Your Google Drive is full',
  busy: 'Google Drive is busy, try again',
  offline: 'No connection. Check your network',
  'too-large': 'This export is too big to save to Google Drive',
  'not-found': 'That Drive folder no longer exists',
  cancelled: 'Google Drive was not connected',
  failed: 'Google Drive could not save the file',
};

/** Error with a message that can be shown to the user; code is a key of MESSAGES. */
export class DriveError extends Error {
  constructor(code, message = MESSAGES[code]) {
    super(message);
    this.code = code;
  }
}

const sameEmail = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const hasDrive = (user) => !!user?.scopes?.includes(DRIVE_SCOPE);
const cancelled = (e) => isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED;

/** The Google account signed in on this device (restored silently after a restart), or null. */
async function googleUser() {
  const current = GoogleSignin.getCurrentUser();
  if (current) return current;
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  try {
    const res = await GoogleSignin.signInSilently();
    return isSuccessResponse(res) ? res.data : null;
  } catch {
    return null;
  }
}

/** Google's account picker; null when the user backs out. */
async function pickAccount() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const res = await GoogleSignin.signIn();
    return isSuccessResponse(res) ? res.data : null;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/**
 * Asks for Drive access for the signed-in Calq user (email). Throws DriveError
 * 'cancelled' when the user says no, 'account' for a different Google account.
 */
export async function connect(email) {
  let user = await googleUser();
  if (!sameEmail(user?.user.email, email)) {
    // signed out of Google on this device, or another account is current: pick this one
    if (user) await GoogleSignin.signOut();
    user = await pickAccount();
    if (!user) throw new DriveError('cancelled');
    if (!sameEmail(user.user.email, email)) throw new DriveError('account', `Choose ${email}, the account you use in Calq`);
  }
  if (hasDrive(user)) return;
  let res;
  try {
    res = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === ios_only_SCOPES_ALREADY_GRANTED) return;
    if (cancelled(e)) throw new DriveError('cancelled');
    throw e;
  }
  if (!res || !isSuccessResponse(res) || !hasDrive(res.data)) throw new DriveError('cancelled', 'Calq needs permission to save files in your Google Drive');
}

/** True if Drive can be used for this Calq user right now (no network call). */
export async function isConnected(email) {
  const user = await googleUser();
  return sameEmail(user?.user.email, email) && hasDrive(user);
}

/**
 * Removes Calq's access to the user's Google account (Drive included). The files
 * stay in Drive. The Calq (Firebase) session is separate and stays signed in.
 */
export async function disconnect() {
  if (await googleUser()) await GoogleSignin.revokeAccess();
}

async function accessToken() {
  if (!hasDrive(await googleUser())) throw new DriveError('reconnect');
  try {
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (e) {
    throw new DriveError(isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED ? 'reconnect' : 'offline');
  }
}

/** DriveError for a failed Drive API response. */
async function responseError(res) {
  let reason = '';
  try {
    const body = await res.json();
    reason = body?.error?.errors?.[0]?.reason || '';
  } catch {
    // no JSON body
  }
  if (reason === 'storageQuotaExceeded') return new DriveError('full');
  if (reason === 'accessNotConfigured') return new DriveError('setup'); // Drive API off in the Cloud project
  if (res.status === 429 || res.status >= 500 || /rateLimitExceeded/i.test(reason)) return new DriveError('busy');
  if (res.status === 401 || res.status === 403) return new DriveError('reconnect');
  if (res.status === 404) return new DriveError('not-found');
  if (res.status === 413) return new DriveError('too-large');
  return new DriveError('failed');
}

/** Drive API call with the user's token; a rejected token is replaced once. */
async function request(url, init = {}, retried = false) {
  const token = await accessToken();
  let res;
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + token } });
  } catch {
    throw new DriveError('offline');
  }
  if (res.status === 401 && !retried) {
    // expired or revoked: forget the cached token (Android; iOS refreshes in getTokens)
    if (Platform.OS === 'android') await GoogleSignin.clearCachedAccessToken(token).catch(() => {});
    return request(url, init, true);
  }
  if (!res.ok) throw await responseError(res);
  return res.json();
}

const query = (params) =>
  Object.entries(params)
    .map(([k, v]) => k + '=' + encodeURIComponent(v))
    .join('&');

/** Folders Calq created (drive.file shows no others), by name: [{ id, name }]. */
export async function listFolders() {
  const { files } = await request(
    FILES + '?' + query({ q: `mimeType='${FOLDER_TYPE}' and trashed=false`, fields: 'files(id,name)', orderBy: 'name', pageSize: 100 }),
  );
  return Array.isArray(files) ? files : [];
}

/** New folder at the top of My Drive: { id, name }. */
export function createFolder(name) {
  return request(FILES + '?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name, mimeType: FOLDER_TYPE }),
  });
}

/**
 * The folder to save into: folder itself if it is still there, otherwise (deleted
 * or in the trash, where uploads would end up unseen) Calq's folder with the same
 * name, made again if needed. My Drive is always there.
 * @param {{id?: string, name?: string}} [folder]
 * @returns {Promise<{id: string, name: string}>}
 */
export async function ensureFolder(folder) {
  if (folder?.id === ROOT.id) return ROOT;
  if (folder?.id) {
    try {
      const f = await request(`${FILES}/${encodeURIComponent(folder.id)}?fields=id,name,trashed`);
      if (!f.trashed) return { id: f.id, name: f.name };
    } catch (e) {
      if (e.code !== 'not-found') throw e;
    }
  }
  const name = folder?.name || DEFAULT_FOLDER;
  const existing = (await listFolders()).find((f) => f.name === name);
  return existing || createFolder(name);
}

/**
 * Uploads an export file (expo-file-system File) into a folder.
 * @returns {Promise<{id: string, name: string, webViewLink: string}>}
 */
export async function upload({ file, name, mimeType, folderId }) {
  if (file.size > MAX_UPLOAD) throw new DriveError('too-large');
  const data = await file.base64();
  const boundary = 'calq-' + randomUUID();
  const body = [
    '--' + boundary,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name, mimeType, parents: [folderId || ROOT.id] }),
    '--' + boundary,
    'Content-Type: ' + mimeType,
    'Content-Transfer-Encoding: base64',
    '',
    data,
    '--' + boundary + '--',
    '',
  ].join('\r\n');
  return request(UPLOAD, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
}
