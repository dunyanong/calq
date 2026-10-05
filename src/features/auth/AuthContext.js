// Google sign-in -> Firebase Auth. Google is the only provider.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase';

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

const AuthContext = createContext({ user: null, ready: true, signIn: async () => false, signOut: async () => {} });

// Returns true when signed in, false when the user cancelled. Throws on real errors.
async function signIn() {
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

async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // not signed in to Google on this device; Firebase sign-out still runs
  }
  await fbSignOut(auth);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
