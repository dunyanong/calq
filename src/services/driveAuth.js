// Drive access tokens on Android and iOS: Google Sign-In, plus the drive.file scope.
// The web build uses driveAuth.web.js instead.
import { Platform } from 'react-native';
import {
  GoogleSignin,
  ios_only_SCOPES_ALREADY_GRANTED,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE, DriveError } from './driveErrors';

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

export async function accessToken() {
  if (!hasDrive(await googleUser())) throw new DriveError('reconnect');
  try {
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (e) {
    throw new DriveError(isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED ? 'reconnect' : 'offline');
  }
}

/** Drive rejected token (expired or revoked): forget it (Android; iOS refreshes in getTokens). */
export async function forgetToken(token) {
  if (Platform.OS === 'android') await GoogleSignin.clearCachedAccessToken(token).catch(() => {});
}
