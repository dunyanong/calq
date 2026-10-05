import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsStore';
import { light, dark } from '@/theme/tokens';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
  }, []);

  const value = useMemo(() => {
    const update = (patch) =>
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        return next;
      });
    return { ...settings, ready, update, theme: settings.dark ? dark : light };
  }, [settings, ready]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** { angle, output, dark, theme, update(patch), ready } */
export function useSettings() {
  return useContext(SettingsContext);
}
