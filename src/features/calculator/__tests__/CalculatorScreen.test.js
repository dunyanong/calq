// Smoke test: renders the real screens and presses some keys.
import { renderRouter, screen, fireEvent, act } from 'expo-router/testing-library';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => 'id-' + ++n };
});
// Fonts are not needed to test behaviour.
jest.mock('expo-font', () => ({ useFonts: () => [true], loadAsync: jest.fn() }));

// A key's face is rendered after the small SHIFT label above it, so press the last match.
const press = (label) => fireEvent.press(screen.getAllByText(label).at(-1));

async function renderApp() {
  const app = renderRouter('./src/app');
  // let SettingsProvider finish loading from AsyncStorage
  await act(async () => {});
  return app;
}

test('calculates (3+4)×12−5 and shows it in the history', async () => {
  await renderApp();
  for (const k of ['(', '3', '+', '4', ')', '×', '1', '2', '−', '5']) press(k);
  expect(screen.getByText('(3+4)×12−5')).toBeTruthy();
  press('=');
  expect(screen.getByText('= 79')).toBeTruthy();
});

test('degree mode is the default: sin(30) = 0.5', async () => {
  await renderApp();
  for (const k of ['sin', '3', '0']) press(k);
  press('=');
  expect(screen.getByText('= 0.5')).toBeTruthy();
});

test('SHIFT changes key faces and inserts the shifted token', async () => {
  await renderApp();
  press('SHIFT');
  expect(screen.getByText('SHIFT ON')).toBeTruthy();
  press('sin⁻¹'); // shifted face of "sin"
  press('1');
  press('=');
  expect(screen.getByText('= 90')).toBeTruthy();
});

test('DEL removes a whole function token', async () => {
  await renderApp();
  press('2');
  press('sin');
  expect(screen.getByText('2sin(')).toBeTruthy();
  press('DEL');
  expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  expect(screen.queryByText('2sin(')).toBeNull();
});

const right = () => fireEvent.press(screen.getByLabelText('Cursor right'));

test('∫dx types boxes: fill f(x), ▶, the limits, =', async () => {
  await renderApp();
  press('∫dx');
  expect(screen.getByText(/∫ f\(x\) dx/)).toBeTruthy(); // what the first box is for
  for (const name of ['f(x)', 'from', 'to']) expect(screen.getByText('\u2009' + name + '\u2009')).toBeTruthy();
  press('x');
  expect(screen.queryByText('\u2009f(x)\u2009')).toBeNull(); // typing replaces the placeholder
  press('x²');
  right();
  expect(screen.getByText(/leave both limits empty for a formula/)).toBeTruthy();
  press('0');
  right();
  press('1');
  press('=');
  expect(screen.getByText('∫(x²,0,1)')).toBeTruthy();
  expect(screen.getByText('= 0.3333333333')).toBeTruthy();
});

test('d/dx with a point gives a number, without one a formula', async () => {
  await renderApp();
  press('d/dx');
  press('x');
  press('SHIFT');
  press('x³');
  right();
  press('2');
  press('=');
  expect(screen.getByText('= 12')).toBeTruthy();

  press('d/dx');
  press('x');
  press('SHIFT');
  press('x³');
  press('='); // point left empty
  expect(screen.getByText('d/dx(x³)')).toBeTruthy();
  expect(screen.getByText('= 3x²')).toBeTruthy();
});

test('an empty first box or one missing limit says what to fill in', async () => {
  await renderApp();
  press('∫dx');
  press('=');
  expect(screen.getByText('Type the function in the first box')).toBeTruthy();
});

test('∫ without limits needs sign-in (the formula comes from the AI)', async () => {
  await renderApp();
  for (const k of ['∫dx', 'x', 'x²', '=']) press(k);
  expect(screen.getByText('Sign in to get a formula for ∫ without limits')).toBeTruthy();
});

test('x outside ∫, d/dx or Σ explains itself', async () => {
  await renderApp();
  for (const k of ['2', 'x', '=']) press(k);
  expect(screen.getByText('Use x inside ∫, d/dx or Σ')).toBeTruthy();
});

test('brackets and % are on the numeric page', async () => {
  await renderApp();
  for (const k of ['(', '2', '+', '3', ')', '×', '4', '0', '%']) press(k);
  press('=');
  expect(screen.getByText('= 2')).toBeTruthy();
});

// The caret splits the entry text in two, so tests read it with the cursor at the end.
const toEnd = () => fireEvent(screen.getByLabelText('Cursor right'), 'longPress');

test('◀ ▶ move the cursor one key press at a time', async () => {
  await renderApp();
  for (const k of ['2', '+', '3', '×', '5']) press(k);
  for (let i = 0; i < 3; i++) fireEvent.press(screen.getByLabelText('Cursor left')); // before "3"
  press('(');
  for (let i = 0; i < 3; i++) fireEvent.press(screen.getByLabelText('Cursor right'));
  press(')');
  expect(screen.getByText('2+(3×5)')).toBeTruthy();
  press('=');
  expect(screen.getByText('= 17')).toBeTruthy(); // results stay unique: history persists between tests
});

test('long-press ◀ jumps to the start to add a forgotten bracket', async () => {
  await renderApp();
  for (const k of ['2', '+', '3', ')', '×', '4']) press(k);
  fireEvent(screen.getByLabelText('Cursor left'), 'longPress');
  press('(');
  toEnd();
  expect(screen.getByText('(2+3)×4')).toBeTruthy();
  press('=');
  expect(screen.getByText('= 20')).toBeTruthy();
});

test('DEL removes the whole key press before the cursor', async () => {
  await renderApp();
  for (const k of ['sin', '3', '0']) press(k);
  fireEvent(screen.getByLabelText('Cursor left'), 'longPress');
  press('2');
  fireEvent.press(screen.getByLabelText('Cursor right')); // past "sin(" in one step
  press('DEL'); // removes "sin("
  toEnd();
  expect(screen.getByText('230')).toBeTruthy();
});

test('live preview shows the value while typing', async () => {
  await renderApp();
  for (const k of ['1', '2', '×', '3']) press(k);
  expect(screen.getByText('= 36')).toBeTruthy();
});

test('tapping the DEG badge switches to radians', async () => {
  await renderApp();
  fireEvent.press(screen.getByLabelText('Degrees. Tap for radians'));
  expect(screen.getByLabelText('Radians. Tap for degrees')).toBeTruthy();
  for (const k of ['sin', 'π']) press(k);
  press('÷');
  press('2');
  press('=');
  expect(screen.getByText('= 1')).toBeTruthy();
});

test('a/b shows the format a tap switches to', async () => {
  await renderApp();
  for (const k of ['3', '÷', '4']) press(k);
  press('a/b');
  expect(screen.getAllByText('0.5').length).toBeGreaterThan(0); // the key now offers decimals
  press('=');
  expect(screen.getByText('= 3/4')).toBeTruthy();
});

test('holding a calculation asks guests to sign in for steps, and Pin adds the pinned pill', async () => {
  await renderApp();
  for (const k of ['(', '3', '+', '4', ')', '×', '2']) press(k);
  press('=');
  fireEvent(screen.getByText('= 14').parent, 'longPress');
  expect(screen.getByText('Sign in to see steps')).toBeTruthy(); // tests run as a guest
  const ones = screen.getAllByText('1').length; // the "1" key
  press('Pin');
  // the pinned pill appears showing "1"
  expect(screen.getAllByText('1').length).toBe(ones + 1);
});

test('2 then Ans multiplies (2(43)), it does not make 243', async () => {
  await renderApp();
  for (const k of ['4', '3', '=']) press(k);
  press('2');
  press('Ans');
  press('=');
  expect(screen.getByText('2(43)')).toBeTruthy();
  expect(screen.getByText('= 86')).toBeTruthy();
});

test('STO stores the entry in a letter, ALPHA types it, = saves its value', async () => {
  await renderApp();
  for (const k of ['1', '2']) press(k);
  press('SHIFT');
  press('STO'); // shifted face of RCL
  expect(screen.getByText('A=0  B=0  C=0  D=0  F=0  M=0')).toBeTruthy(); // the values, while picking a letter
  press('A'); // the "(" key
  expect(screen.getByText('A = 12')).toBeTruthy();
  press('AC');
  press('2');
  press('ALPHA');
  press('A');
  expect(screen.getByText('= 24')).toBeTruthy(); // preview
  press('=');
  expect(screen.getByText('2(12)')).toBeTruthy(); // history keeps the value, not the letter
});

test('variables survive a restart, and RCL inserts the value', async () => {
  await renderApp();
  for (const k of ['3', '5']) press(k);
  press('SHIFT');
  press('STO');
  press('F'); // the ×10ˣ key
  expect(screen.getByText('F = 35')).toBeTruthy();
  await act(async () => {}); // saved
  screen.unmount();

  await renderApp();
  press('RCL');
  press('F');
  for (const k of ['×', '2', '=']) press(k);
  expect(screen.getByText('35×2')).toBeTruthy();
  expect(screen.getByText('= 70')).toBeTruthy();
});

test('in ALPHA mode a key without a letter only leaves the mode', async () => {
  await renderApp();
  press('ALPHA');
  expect(screen.getByText('ALPHA ON')).toBeTruthy();
  press('7'); // dimmed: nothing is typed
  expect(screen.queryByText('ALPHA ON')).toBeNull();
  for (const k of ['6', '0', '=']) press(k);
  expect(screen.getByText('= 60')).toBeTruthy();
});

test('M+ adds the entry to M, also with RanInt in it, and shows the M pill', async () => {
  await renderApp();
  expect(screen.queryByLabelText('Memory M in use')).toBeNull();
  press('SHIFT');
  press('RandInt'); // RanInt(□,□)
  press('4');
  right();
  press('4');
  press('M+');
  expect(screen.getByText('M = 4')).toBeTruthy();
  expect(screen.getByLabelText('Memory M in use')).toBeTruthy();
});

test('tapping a past calculation puts it back in the entry', async () => {
  await renderApp();
  for (const k of ['9', '×', '9', '=']) press(k);
  fireEvent.press(screen.getByText('= 81'));
  expect(screen.getAllByText('9×9')).toHaveLength(2); // the card and the entry
});

test('the menu goes back to the same calculator, with its entry', async () => {
  const app = await renderApp();
  for (const k of ['8', '÷']) press(k);
  fireEvent.press(screen.getByLabelText('Menu'));
  press('Settings');
  fireEvent.press(screen.getAllByLabelText('Menu').at(-1));
  press('Recent');
  fireEvent.press(screen.getAllByLabelText('Menu').at(-1));
  press('Calculator');
  expect(screen.getByText('8÷')).toBeTruthy();
  expect(app.getRouterState().routes).toHaveLength(1); // no second calculator on the stack
});

test('New session clears the screen and the memory, keeps History, and can be undone', async () => {
  await renderApp();
  for (const k of ['5', '5', '5', '=']) press(k);
  press('7');
  press('SHIFT');
  press('STO');
  press('B'); // B = 7
  const menu = () => fireEvent.press(screen.getAllByLabelText('Menu').at(-1));

  fireEvent.press(screen.getByLabelText('New session')); // + at the top right
  expect(screen.queryByText('= 555')).toBeNull(); // off the calculator screen…
  expect(screen.getByText('New session · history is in Recent')).toBeTruthy();
  menu();
  press('Recent');
  expect(screen.getByText('555')).toBeTruthy(); // …but still in History
  menu();
  press('Calculator');
  press('SHIFT');
  press('STO');
  expect(screen.getByText('A=0  B=0  C=0  D=0  F=0  M=0')).toBeTruthy(); // Ans and variables reset
  press('7'); // leave STO

  press('Undo');
  expect(screen.getByText('= 555')).toBeTruthy();
  press('SHIFT');
  press('STO');
  expect(screen.getByText(/B=7/)).toBeTruthy();
});

test('ALPHA √ is the unknown x: ∫(2x,2,100) = 9996, not 0', async () => {
  await renderApp();
  press('∫dx');
  press('2');
  press('ALPHA');
  // the √ key while ALPHA is on: after its grey label, before the scientific page's own x key
  fireEvent.press(screen.getAllByText('x')[1]);
  right();
  press('2');
  right();
  for (const k of ['1', '0', '0', '=']) press(k);
  expect(screen.getByText('∫(2x,2,100)')).toBeTruthy();
  expect(screen.getByText('= 9996')).toBeTruthy();
});
