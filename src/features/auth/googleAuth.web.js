// Web: Google sign-in in a popup, straight into Firebase Auth.
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { forgetDriveToken } from '@/services/driveAuth';

// The user closed the popup, or a second click replaced the first popup.
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

// Returns true when signed in, false when the user cancelled. Throws on real errors.
export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    return true;
  } catch (e) {
    if (CANCELLED.includes(e?.code)) return false;
    if (e?.code === 'auth/popup-blocked') throw new Error('Allow pop-ups for this site to sign in');
    throw e;
  }
}

export async function signOut() {
  forgetDriveToken();
  await fbSignOut(auth);
}
