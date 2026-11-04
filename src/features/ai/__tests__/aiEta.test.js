// The "~6 s left" estimate under AI waits: defaults, learning from finished calls,
// export waves, and the countdown text.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { DEFAULT_TIMES, estimateAi, etaSpoken, etaText, recordAiTime, useAiEta } from '@/features/ai/aiEta';

test('starts from the typical times', () => {
  expect(estimateAi('scan')).toBe(DEFAULT_TIMES.scan);
  expect(estimateAi('notes')).toBe(DEFAULT_TIMES.notes);
});

test('countdown text', () => {
  expect(etaText(8000, 0)).toBe('~8 s left');
  expect(etaText(8000, 7200)).toBe('~1 s left');
  expect(etaText(150_000, 0)).toBe('~3 min left');
  expect(etaText(8000, 8000)).toBe('Taking longer than usual…');
  expect(etaSpoken(8000)).toBe('About 8 seconds.');
  expect(etaSpoken(1000)).toBe('About 1 second.');
});

test('learns from finished calls and keeps what it learned', () => {
  const before = estimateAi('formula');
  recordAiTime('formula', 16000);
  expect(estimateAi('formula')).toBe(Math.round(before * 0.7 + 16000 * 0.3));
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('calq.aiTimes', expect.stringContaining('"formula"'));
});

test('ignores unknown kinds and nonsense durations', () => {
  const before = estimateAi('scan');
  recordAiTime('nope', 5000);
  recordAiTime('scan', NaN);
  expect(estimateAi('scan')).toBe(before);
});

describe('useAiEta', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('counts down once a second, and is null while nothing runs', async () => {
    const { result, rerender } = renderHook(({ kind }) => useAiEta(kind), { initialProps: { kind: null } });
    expect(result.current).toBeNull();
    rerender({ kind: 'scan' });
    const total = estimateAi('scan');
    expect(result.current.text).toBe(etaText(total, 0));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.text).toBe(etaText(total, 3000));
    rerender({ kind: null });
    expect(result.current).toBeNull();
  });
});
