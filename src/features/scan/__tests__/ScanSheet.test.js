// Scan sheet: the preview under the scanned text, with the photo and the AI call stubbed.
import { render, screen, fireEvent } from '@testing-library/react-native';
import ScanSheet from '@/features/scan/ScanSheet';
import { scanEquation } from '@/services/ai';
import { light } from '@/theme/tokens';

jest.mock('@/features/scan/pickImage', () => ({
  pickImage: jest.fn(() => Promise.resolve({ uri: 'file://scan.jpg', base64: 'abc' })),
}));
jest.mock('@/services/ai', () => ({ scanEquation: jest.fn() }));

const scan = async (expr) => {
  scanEquation.mockResolvedValue({ expr, note: '' });
  render(<ScanSheet visible session={1} t={light} angle="deg" output="dec" onClose={() => {}} onInsert={() => {}} />);
  fireEvent.press(screen.getByText('Choose image'));
  return screen.findByDisplayValue(expr);
};

test('shows the value of a plain calculation', async () => {
  await scan('2×(3+4)');
  expect(screen.getByText('= 14')).toBeTruthy();
});

test('d/dx without a point: a formula, or a number when no x is left', async () => {
  const input = await scan('d/dx(x²)');
  expect(screen.getByText('= 2x')).toBeTruthy();
  fireEvent.changeText(input, 'd/dx(3x)');
  expect(screen.getByText('= 3')).toBeTruthy();
});

test('∫ without limits waits for = (the formula comes from the AI)', async () => {
  await scan('∫(2x)');
  expect(screen.getByText('Insert, then press = for the formula')).toBeTruthy();
});

test('text that is not a calculation asks for an edit', async () => {
  await scan('2×(');
  expect(screen.getByText('Can’t work this out — edit it')).toBeTruthy();
});

test('a scanned matrix, complex number or double integral', async () => {
  const input = await scan('det([1,2;3,4])');
  expect(screen.getByText('= -2')).toBeTruthy();
  fireEvent.changeText(input, '(3+4i)×(1−2i)');
  expect(screen.getByText('= 11−2i')).toBeTruthy();
  fireEvent.changeText(input, '∬(x×y,0,1,0,x)'); // slow keys are worked out at =
  expect(screen.getByText('Insert, then press = to work it out')).toBeTruthy();
});

test('the wait shows how long reading should take', async () => {
  scanEquation.mockReturnValue(new Promise(() => {})); // still reading
  render(<ScanSheet visible session={1} t={light} angle="deg" output="dec" onClose={() => {}} onInsert={() => {}} />);
  fireEvent.press(screen.getByText('Choose image'));
  expect(await screen.findByText(/Reading… ~\d+ s left/)).toBeTruthy();
});
