// The hold panel: steps on request (Steps), worked out by the app; the AI call (stubbed)
// only adds a shortcut for hard arithmetic, with AI on; Select.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HoldPanel from '@/features/calculator/components/HoldPanel';
import useAiOn from '@/features/ai/useAiOn';
import { explainSteps } from '@/services/ai';
import { light } from '@/theme/tokens';

jest.mock('@/features/ai/useAiOn', () => jest.fn(() => true));
jest.mock('@/services/ai', () => ({ explainSteps: jest.fn() }));

const item = (expr, result) => ({ id: '1', expr, result, angle: 'deg', pinned: false });
const open = (it, props = {}) => render(<HoldPanel item={it} visible session={1} t={light} onClose={() => {}} {...props} />);
const showSteps = () => fireEvent.press(screen.getByLabelText('Show steps'));

beforeEach(() => {
  explainSteps.mockReset();
  useAiOn.mockReturnValue(true);
});

test('Steps shows the app’s own steps at once, without asking the AI', () => {
  open(item('2+3×sin(30)²', '2.75'));
  expect(screen.queryByText(/STEP/)).toBeNull(); // nothing until asked
  showSteps();
  expect(screen.getByText('STEP 2 — SINE OF 30°')).toBeTruthy();
  expect(screen.getByText('2+3×0.5²')).toBeTruthy();
  expect(screen.getByText('STEP 3 — POWERS FIRST')).toBeTruthy();
  expect(screen.getAllByText('= 2.75')).toHaveLength(2); // header + final step
  expect(screen.queryByLabelText('Show steps')).toBeNull(); // the button makes way for the steps
  expect(explainSteps).not.toHaveBeenCalled(); // nothing for the AI to add here
});

test('hard arithmetic: the app’s steps first, then the AI’s shortcut replaces them', async () => {
  explainSteps.mockResolvedValue([
    { rewrite: '489×70+489×3', note: 'Split 73 into 70 + 3' },
    { parts: ['489×70', '489×3'], note: 'Multiply each part' },
    { parts: ['489×70+489×3'], note: 'Add the partial products' },
  ]);
  open(item('489×73', '35697'));
  showSteps();
  expect(screen.getByText('STEP 2 — MULTIPLY')).toBeTruthy(); // at once
  expect(screen.getByText(/Looking for a shortcut… ~5 s left/)).toBeTruthy();
  expect(await screen.findByText('STEP 2 — SPLIT 73 INTO 70 + 3')).toBeTruthy();
  expect(screen.getByText('34230+1467')).toBeTruthy();
  expect(screen.queryByText(/Looking for a shortcut/)).toBeNull();
  expect(explainSteps).toHaveBeenCalledWith('489×73', 'deg', { retry: false });
});

test('an AI plan that fails the check leaves the app’s steps as they are', async () => {
  explainSteps.mockResolvedValueOnce([{ parts: ['3+4'], note: 'Add' }]); // wrong order
  open(item('12×34+4', '412'));
  showSteps();
  await waitFor(() => expect(screen.queryByText(/Looking for a shortcut/)).toBeNull(), { timeout: 4000 });
  expect(screen.getByText('STEP 2 — MULTIPLY')).toBeTruthy();
  expect(screen.queryByText('Couldn’t explain this one')).toBeNull();
});

test('an AI error (daily limit, network) leaves the app’s steps as they are', async () => {
  explainSteps.mockRejectedValueOnce(new Error('Daily limit reached, try again tomorrow'));
  open(item('56×78', '4368'));
  showSteps();
  await waitFor(() => expect(screen.queryByText(/Looking for a shortcut/)).toBeNull(), { timeout: 4000 });
  expect(screen.getByText('STEP 2 — MULTIPLY')).toBeTruthy();
  expect(screen.queryByText('Daily limit reached, try again tomorrow')).toBeNull();
});

test('a simple calculation has no Steps button', async () => {
  open(item('5+3', '8'));
  await waitFor(() => expect(screen.getByText('= 8')).toBeTruthy());
  expect(screen.queryByLabelText('Show steps')).toBeNull();
  expect(explainSteps).not.toHaveBeenCalled();
});

test.each([true, false])('ode / solve show the solver’s own steps, never the AI (AI on: %s)', (on) => {
  useAiOn.mockReturnValue(on);
  open(item('ode(y,0,1,1)', '2.718281828'));
  showSteps();
  expect(screen.getByText('PROBLEM')).toBeTruthy();
  expect(screen.getByText('y′ = y,  y(0) = 1,  find y(1)')).toBeTruthy();
  expect(screen.getByText('METHOD — RUNGE–KUTTA (DORMAND–PRINCE RK45)')).toBeTruthy();
  expect(screen.getByText('y(1) = 2.718281828')).toBeTruthy();
  expect(screen.queryByText(/Looking for a shortcut/)).toBeNull();
  expect(explainSteps).not.toHaveBeenCalled();
});

test('other numerical keys still have no Steps button', async () => {
  open(item('∫(4÷(1+x²),0,1)', '3.141592654'));
  await waitFor(() => expect(screen.getByText('= 3.141592654')).toBeTruthy());
  expect(screen.queryByLabelText('Show steps')).toBeNull();
});

test('AI off (or a guest): the app’s steps, and no AI call even for hard arithmetic', () => {
  useAiOn.mockReturnValue(false);
  open(item('489×73', '35697'));
  showSteps();
  expect(screen.getByText('STEP 2 — MULTIPLY')).toBeTruthy();
  expect(screen.queryByText(/Looking for a shortcut/)).toBeNull();
  expect(explainSteps).not.toHaveBeenCalled();
});

test('Select starts selecting this calculation', () => {
  const onSelect = jest.fn();
  open(item('5+3', '8'), { onSelect });
  fireEvent.press(screen.getByText('Select'));
  expect(onSelect).toHaveBeenCalled();
});
