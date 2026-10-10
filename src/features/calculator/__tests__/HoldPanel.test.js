// Steps in the hold panel for a signed-in user, with the AI call stubbed.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HoldPanel from '@/features/calculator/components/HoldPanel';
import { explainSteps } from '@/services/ai';
import { light } from '@/theme/tokens';

jest.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/services/ai', () => ({ explainSteps: jest.fn() }));

const item = (expr, result) => ({ id: '1', expr, result, angle: 'deg', pinned: false });
const open = (it) => render(<HoldPanel item={it} visible session={1} t={light} onClose={() => {}} />);

beforeEach(() => explainSteps.mockReset());

test('loads the steps on open, values computed by the app', async () => {
  explainSteps.mockResolvedValue([
    { rewrite: '489×70+489×3', note: 'Split 73 into 70 + 3' },
    { parts: ['489×70', '489×3'], note: 'Multiply each part' },
    { parts: ['489×70+489×3'], note: 'Add the partial products' },
  ]);
  open(item('489×73', '35697'));
  expect(screen.getByText('Working out the steps…')).toBeTruthy();
  expect(await screen.findByText('STEP 2 — SPLIT 73 INTO 70 + 3')).toBeTruthy();
  expect(screen.getByText('34230+1467')).toBeTruthy();
  expect(screen.getAllByText('= 35697')).toHaveLength(2); // header + final step
  expect(explainSteps).toHaveBeenCalledWith('489×73', 'deg', { retry: false });
});

test('a plan that fails the check is not shown, and Retry asks for a new one', async () => {
  explainSteps.mockResolvedValueOnce([{ parts: ['3+4'], note: 'Add' }]); // wrong order
  open(item('2×3+4', '10'));
  expect(await screen.findByText('Couldn’t explain this one')).toBeTruthy();
  expect(screen.queryByText('2×7')).toBeNull();

  explainSteps.mockResolvedValueOnce([{ parts: ['2×3'], note: 'Multiply first' }]);
  fireEvent.press(screen.getByText('Retry'));
  expect(await screen.findByText('STEP 2 — MULTIPLY FIRST')).toBeTruthy();
  expect(explainSteps).toHaveBeenLastCalledWith('2×3+4', 'deg', { retry: true });
});

test('shows the service error with Retry', async () => {
  explainSteps.mockRejectedValue(new Error('Daily limit reached, try again tomorrow'));
  open(item('2×3+4', '10'));
  expect(await screen.findByText('Daily limit reached, try again tomorrow')).toBeTruthy();
  expect(screen.getByText('Retry')).toBeTruthy();
});

test('a simple calculation shows no steps and makes no call', async () => {
  open(item('5+3', '8'));
  await waitFor(() => expect(screen.getByText('= 8')).toBeTruthy());
  expect(screen.queryByText('Working out the steps…')).toBeNull();
  expect(explainSteps).not.toHaveBeenCalled();
});
