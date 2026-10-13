// Jest: stubs for native modules, Google sign-in and Firebase. Tests run as a
// signed-out guest; a test file can override any of these with its own jest.mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => 'id-' + ++n };
});
jest.mock('expo-font', () => ({ useFonts: () => [true], loadAsync: jest.fn() })); // fonts don't affect behaviour
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: {} }));
jest.mock('expo-sharing', () => ({}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
    signOut: jest.fn(() => Promise.resolve()),
    // Google Drive (services/drive.js): nobody is signed in to Google on the device
    getCurrentUser: jest.fn(() => null),
    hasPreviousSignIn: jest.fn(() => false),
    signInSilently: jest.fn(() => Promise.resolve({ type: 'noSavedCredentialFound', data: null })),
    addScopes: jest.fn(() => Promise.resolve(null)),
    getTokens: jest.fn(() => Promise.resolve({ accessToken: 'token', idToken: 'id' })),
    revokeAccess: jest.fn(() => Promise.resolve(null)),
    clearCachedAccessToken: jest.fn(() => Promise.resolve(null)),
  },
  isSuccessResponse: (res) => res?.type === 'success',
  isErrorWithCode: (e) => !!e?.code,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED' },
  ios_only_SCOPES_ALREADY_GRANTED: 'SCOPES_ALREADY_GRANTED',
}));

jest.mock('@/services/firebase', () => ({ auth: {}, db: {}, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null);
    return () => {};
  },
  GoogleAuthProvider: { credential: jest.fn() },
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/firestore', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
// setOptions only works in native builds; the JS stub warns on every render
jest.mock('expo-splash-screen', () => ({ ...jest.requireActual('expo-splash-screen'), setOptions: jest.fn() }));
