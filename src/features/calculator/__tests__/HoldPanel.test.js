// The hold panel: steps on request (✦ AI) for a signed-in user with AI on, the AI call
// stubbed; no AI at all when it is off; Select.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HoldPanel from '@/features/calculator/components/HoldPanel';
import useAiOn from '@/features/ai/useAiOn';
import { explainSteps } from '@/services/ai';
import { light } from '@/theme/tokens';

jest.mock('@/features/ai/useAiOn', () => jest.fn(() => true));
jest.mock('@/services/ai', () => ({ explainSteps: jest.fn() }));

const item = (expr, result) => ({ id: '1', expr, result, angle: 'deg', pinned: false });
const open = (it, props = {}) => render(<HoldPanel item={it} visible session={1} t={light} onClose={() => {}} {...props} />);
const askAi = () => fireEvent.press(screen.getByLabelText('AI explanation'));

beforeEach(() => {
  explainSteps.mockReset();
  useAiOn.mockReturnValue(true);
});

test('opens without calling the AI; the AI button loads the steps, values computed by the app', async () => {
  explainSteps.mockResolvedValue([
    { rewrite: '489×70+489×3', note: 'Split 73 into 70 + 3' },
    { parts: ['489×70', '489×3'], note: 'Multiply each part' },
    { parts: ['489×70+489×3'], note: 'Add the partial products' },
  ]);
  open(item('489×73', '35697'));
  expect(explainSteps).not.toHaveBeenCalled();
  expect(screen.queryByText('Working out the steps…')).toBeNull();

  askAi();
  expect(screen.getByText('Working out the steps…')).toBeTruthy();
  expect(screen.queryByLabelText('AI explanation')).toBeNull(); // the button makes way for the steps
  expect(await screen.findByText('STEP 2 — SPLIT 73 INTO 70 + 3')).toBeTruthy();
  expect(screen.getByText('34230+1467')).toBeTruthy();
  expect(screen.getAllByText('= 35697')).toHaveLength(2); // header + final step
  expect(explainSteps).toHaveBeenCalledWith('489×73', 'deg', { retry: false });
});

test('a plan that fails the check is not shown, and Retry asks for a new one', async () => {
  explainSteps.mockResolvedValueOnce([{ parts: ['3+4'], note: 'Add' }]); // wrong order
  open(item('2×3+4', '10'));
  askAi();
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
  askAi();
  expect(await screen.findByText('Daily limit reached, try again tomorrow')).toBeTruthy();
  expect(screen.getByText('Retry')).toBeTruthy();
});

test('a simple calculation has no AI button', async () => {
  open(item('5+3', '8'));
  await waitFor(() => expect(screen.getByText('= 8')).toBeTruthy());
  expect(screen.queryByLabelText('AI explanation')).toBeNull();
  expect(explainSteps).not.toHaveBeenCalled();
});

test('AI off (or a guest): no AI button, only the solution', () => {
  useAiOn.mockReturnValue(false);
  open(item('489×73', '35697'));
  expect(screen.getByText('= 35697')).toBeTruthy();
  expect(screen.queryByLabelText('AI explanation')).toBeNull();
  expect(screen.queryByText('Sign in to see steps')).toBeNull();
});

test('Select starts selecting this calculation', () => {
  const onSelect = jest.fn();
  open(item('5+3', '8'), { onSelect });
  fireEvent.press(screen.getByText('Select'));
  expect(onSelect).toHaveBeenCalled();
});
