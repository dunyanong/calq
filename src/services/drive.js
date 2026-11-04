// Google Drive for exports (Settings → Google Drive).
//
// Uses the Google sign-in Calq already has, plus the drive.file scope, which is asked
// for only when the user connects Drive. With drive.file Calq can see and change only
// the files and folders it creates, nothing else in the user's Drive. Access tokens
// are never sent to Calq's server.
//
// Getting the token differs by platform: driveAuth.js (Google Sign-In on Android
// and iOS) or driveAuth.web.js (a Google popup in the browser).
import { randomUUID } from 'expo-crypto';
import { DRIVE_SCOPE, DriveError } from './driveErrors';
import { accessToken, forgetToken } from './driveAuth';

export { DRIVE_SCOPE, DriveError };
export { connect, disconnect, isConnected } from './driveAuth';
export const ROOT = { id: 'root', name: 'My Drive' };
export const DEFAULT_FOLDER = 'Calq';

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';
const MAX_UPLOAD = 5 * 1024 * 1024; // Drive's limit for a multipart upload

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

/**
 * Drive API call with the user's token; a rejected token is replaced once.
 * @returns the JSON reply, or the Response itself when raw (a file download)
 */
async function request(url, init = {}, { raw = false, retried = false } = {}) {
  const token = await accessToken();
  let res;
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + token } });
  } catch {
    throw new DriveError('offline');
  }
  if (res.status === 401 && !retried) {
    await forgetToken(token); // expired or revoked
    return request(url, init, { raw, retried: true });
  }
  if (!res.ok) throw await responseError(res);
  return raw ? res : res.json();
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

/** Multipart upload of base64 data with its Drive metadata. */
function uploadBase64(meta, contentType, data) {
  const boundary = 'calq-' + randomUUID();
  const body = [
    '--' + boundary,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    '--' + boundary,
    'Content-Type: ' + contentType,
    'Content-Transfer-Encoding: base64',
    '',
    data,
    '--' + boundary + '--',
    '',
  ].join('\r\n');
  return request(UPLOAD, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
}

/**
 * PDF of an HTML page, made by Drive: upload it as a Google Doc, export that as
 * PDF, delete the Doc. Browsers cannot print to a file, so the web build saves a
 * PDF to Drive this way.
 * @returns {Promise<string>} the PDF as base64
 */
async function pdfFromHtml(html, folderId) {
  const doc = await uploadBase64(
    { name: 'Calq export (converting)', mimeType: 'application/vnd.google-apps.document', parents: [folderId] },
    'text/html; charset=UTF-8',
    html.base64,
  );
  try {
    const res = await request(`${FILES}/${encodeURIComponent(doc.id)}/export?mimeType=application/pdf`, {}, { raw: true });
    return blobBase64(await res.blob());
  } finally {
    request(`${FILES}/${encodeURIComponent(doc.id)}`, { method: 'DELETE' }, { raw: true }).catch(() => {});
  }
}

const blobBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new DriveError('failed'));
    reader.readAsDataURL(blob);
  });

/**
 * Uploads an export file into a folder: an expo-file-system File, or on the web
 * the file from exportFile.web.js (a PDF there is still HTML: printHtml).
 * @returns {Promise<{id: string, name: string, webViewLink: string}>}
 */
export async function upload({ file, name, mimeType, folderId }) {
  if (file.size > MAX_UPLOAD) throw new DriveError('too-large');
  const parent = folderId || ROOT.id;
  const data = file.printHtml ? await pdfFromHtml(file.printHtml, parent) : await file.base64();
  return uploadBase64({ name, mimeType, parents: [parent] }, mimeType, data);
}
