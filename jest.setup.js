// Jest: replace Google sign-in and Firebase with stubs. Tests run as a signed-out guest.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
    signOut: jest.fn(() => Promise.resolve()),
  },
  isSuccessResponse: (res) => res.type === 'success',
  isErrorWithCode: (e) => !!e?.code,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));

jest.mock('@/services/firebase', () => ({ auth: {}, db: {} }));

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
