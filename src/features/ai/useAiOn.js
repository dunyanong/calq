// The AI switch (Settings → AI integration), for signed-in users only. When it is off
// the app shows no AI at all: no scan key, workings, ∫ formulas or AI exports.
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings } from '@/features/settings/SettingsContext';

export default function useAiOn() {
  const { ai } = useSettings();
  const { user } = useAuth();
  return !!user && ai;
}
