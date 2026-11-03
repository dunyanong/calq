// Web: remember the user in IndexedDB (localStorage in private windows), and the
// popup resolver that signInWithPopup needs (initializeAuth leaves it out, unlike getAuth).
import { browserLocalPersistence, browserPopupRedirectResolver, indexedDBLocalPersistence } from 'firebase/auth';

export const authOptions = {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
};
