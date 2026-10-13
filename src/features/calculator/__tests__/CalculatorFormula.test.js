// ∫ without limits for a signed-in user: the AI's answer is checked before it is shown.
import { renderRouter, screen, fireEvent, act } from 'expo-router/testing-library';

// signed in, with cloud history stubbed out
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({ uid: 'u1', displayName: 'Test', email: 't@example.com' });
    return () => {};
  },
  GoogleAuthProvider: { credential: jest.fn() },
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/history/historyCloud', () => ({
  subscribe: () => () => {},
  put: () => Promise.resolve(),
  patch: () => Promise.resolve(),
  del: () => Promise.resolve(),
  mergeLocal: () => Promise.resolve(),
  clearAll: () => Promise.resolve(),
}));
const mockIntegrate = jest.fn();
jest.mock('@/services/ai', () => ({
  integrateFormula: (...args) => mockIntegrate(...args),
  explainSteps: jest.fn(() => Promise.resolve([])),
  scanEquation: jest.fn(),
}));

const press = (label) => fireEvent.press(screen.getAllByText(label).at(-1));

async function typeIntegralOfXSquared() {
  renderRouter('./src/app');
  await act(async () => {});
  for (const k of ['∫dx', 'x', 'x²']) press(k);
  await act(async () => press('='));
}

beforeEach(() => mockIntegrate.mockReset());

test('shows the checked formula with +C', async () => {
  mockIntegrate.mockResolvedValue('x^3/3');
  await typeIntegralOfXSquared();
  expect(mockIntegrate).toHaveBeenCalledWith('x²', 'deg', { retry: false });
  expect(screen.getByText('∫(x²)')).toBeTruthy();
  expect(screen.getByText('= x³÷3+C')).toBeTruthy();
});

test('a wrong answer is never shown: it asks once more, then says so', async () => {
  mockIntegrate.mockResolvedValue('x^3'); // wrong: its derivative is 3x²
  await typeIntegralOfXSquared();
  expect(mockIntegrate).toHaveBeenCalledTimes(2);
  expect(mockIntegrate.mock.calls[1][2]).toEqual({ retry: true });
  expect(screen.getByText('Couldn’t find a formula for this integral')).toBeTruthy();
  expect(screen.queryByText('= x^3+C')).toBeNull();
});

test('network or quota errors are shown', async () => {
  mockIntegrate.mockRejectedValue(new Error('Daily limit reached, try again tomorrow'));
  await typeIntegralOfXSquared();
  expect(screen.getByText('Daily limit reached, try again tomorrow')).toBeTruthy();
});
