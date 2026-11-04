// Web: Drive access tokens from a Google popup (Firebase Auth, with the drive.file scope).
//
// Google gives the browser an access token for about an hour and no refresh token, so
// a new one needs another popup. Browsers only open popups straight after a click, so
// when the token has run out mid-export the popup is blocked and the export says to
// reconnect in Settings, where the Connect button opens it. The token is kept for this
// tab only (sessionStorage) and is never sent to Calq's server.
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './firebase';
import { DRIVE_SCOPE, DriveError } from './driveErrors';

const KEY = 'calq.driveToken';
const MARGIN = 60_000; // treat a token as expired a minute early

const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

let cached = null; // { token, expires, email }

function load() {
  if (cached) return cached;
  try {
    cached = JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    cached = null;
  }
  return cached;
}

function save(value) {
  cached = value;
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the token lives in memory only
  }
}

const sameEmail = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Scopes Google actually granted (the user can untick Drive in the popup). */
async function grantedScopes(token) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token));
    return res.ok ? ((await res.json()).scope || '').split(' ') : [];
  } catch {
    throw new DriveError('offline');
  }
}

/** Google popup for the signed-in Calq account, asking for drive.file. */
async function popupToken(email) {
  const user = auth.currentUser;
  if (!user || !sameEmail(user.email, email)) throw new DriveError('reconnect');
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ login_hint: email });
  let result;
  try {
    result = await reauthenticateWithPopup(user, provider);
  } catch (e) {
    if (CANCELLED.includes(e?.code)) throw new DriveError('cancelled');
    if (e?.code === 'auth/user-mismatch') throw new DriveError('account', `Choose ${email}, the account you use in Calq`);
    if (e?.code === 'auth/popup-blocked') throw new DriveError('reconnect', 'Allow pop-ups for this site, then reconnect Google Drive in Settings');
    if (e?.code === 'auth/network-request-failed') throw new DriveError('offline');
    throw e;
  }
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token || !(await grantedScopes(token)).includes(DRIVE_SCOPE)) {
    throw new DriveError('cancelled', 'Calq needs permission to save files in your Google Drive');
  }
  save({ token, expires: Date.now() + 3600_000, email: user.email });
  return token;
}

/** Asks for Drive access for the signed-in Calq user (email), in a popup. */
export async function connect(email) {
  await popupToken(email);
}

/**
 * True if Drive belongs to this Calq user. A browser cannot check Google's grant
 * without a popup, so a removed grant shows up as 'reconnect' on the next export.
 */
export async function isConnected(email) {
  return sameEmail(auth.currentUser?.email, email);
}

/** Removes Calq's Drive access (when this tab still has a token) and forgets the token. */
export async function disconnect() {
  const token = load()?.token;
  save(null);
  if (!token) return;
  await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => {});
}

export async function accessToken() {
  const c = load();
  const email = auth.currentUser?.email;
  if (c && sameEmail(c.email, email) && c.expires - MARGIN > Date.now()) return c.token;
  return popupToken(email); // blocked unless a click just happened: 'reconnect'
}

/** Drive rejected the token (expired or revoked): the next request gets a new one. */
export async function forgetToken() {
  save(null);
}

/** Sign-out: drop this tab's token. */
export function forgetDriveToken() {
  save(null);
}
