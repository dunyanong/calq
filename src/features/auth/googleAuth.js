// Google sign-in -> Firebase Auth on Android and iOS (native account picker).
// The web build uses googleAuth.web.js instead.
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase';

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

// Returns true when signed in, false when the user cancelled. Throws on real errors.
export async function signIn() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return false; // cancelled
    const credential = GoogleAuthProvider.credential(res.data.idToken);
    await signInWithCredential(auth, credential);
    return true;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return false;
    }
    throw e;
  }
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // not signed in to Google on this device; Firebase sign-out still runs
  }
  await fbSignOut(auth);
}
