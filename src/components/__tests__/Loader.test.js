import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import Loader, { Skeleton, SkeletonGroup } from '@/components/Loader';

test('Loader is a labelled progress bar', () => {
  render(<Loader color="#000" label="Reading the image" />);
  expect(screen.getByRole('progressbar', { name: 'Reading the image' })).toBeTruthy();
});

test('placeholders are hidden from screen readers', () => {
  render(
    <SkeletonGroup>
      <Skeleton width={40} color="#000" />
    </SkeletonGroup>,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('unmounts cleanly while looping', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const { unmount } = render(<Loader color="#000" />);
  await act(async () => {});
  unmount();
});
