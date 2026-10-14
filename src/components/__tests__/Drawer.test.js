// The menu's AI credits bar: fetched when the menu opens, only with AI on, hidden on errors.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DrawerProvider, useDrawer } from '@/components/Drawer';
import { SettingsProvider } from '@/features/settings/SettingsContext';
import { aiCredits } from '@/services/ai';

let mockUser = null;
jest.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() }),
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
}));
jest.mock('@/services/ai', () => ({ aiCredits: jest.fn() }));

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
let drawer;
function Probe() {
  drawer = useDrawer();
  return null;
}

async function openMenu(saved = {}, user = { uid: 'u1', email: 'a@example.com' }) {
  mockUser = user;
  await AsyncStorage.setItem('calq.settings', JSON.stringify(saved));
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SettingsProvider>
        <DrawerProvider>
          <Probe />
        </DrawerProvider>
      </SettingsProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {}); // settings load
  await act(async () => drawer.open());
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('shows what is left of today\'s credits, fetched when the menu opens', async () => {
  aiCredits.mockResolvedValue({ used: 60, limit: 300 });
  await openMenu();
  expect(aiCredits).toHaveBeenCalledTimes(1);
  expect(screen.getByText('AI credits')).toBeTruthy();
  expect(screen.getByText('80% left today')).toBeTruthy();
  expect(screen.getByLabelText('AI credits, 80% left today')).toBeTruthy();
});

test('hidden when the credits cannot be fetched', async () => {
  aiCredits.mockRejectedValue(new Error('This feature is not set up on the server yet'));
  await openMenu();
  expect(screen.queryByText('AI credits')).toBeNull();
});

test.each([
  ['AI off', { ai: false }, { uid: 'u1' }],
  ['a guest', {}, null],
])('%s: no credits bar and no call', async (_, saved, user) => {
  await openMenu(saved, user);
  expect(screen.queryByText('AI credits')).toBeNull();
  expect(aiCredits).not.toHaveBeenCalled();
});
