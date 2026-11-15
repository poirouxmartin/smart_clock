import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { DEFAULT_THEME_ID, getPalette, PALETTES, type Palette, type ThemeId } from './themes';

const THEME_KEY = 'theme_id';

interface ThemeContextValue {
  themeId: ThemeId;
  palette: Palette;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  palette: getPalette(DEFAULT_THEME_ID),
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    getDatabaseService()
      .getSetting<string>(THEME_KEY, DEFAULT_THEME_ID)
      .then(saved => {
        if (saved in PALETTES) setThemeIdState(saved as ThemeId);
      })
      .catch(e => console.error('Load theme error:', e));
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    getDatabaseService()
      .setSetting(THEME_KEY, id)
      .catch(e => console.error('Save theme error:', e));
  }, []);

  const value = useMemo(() => ({ themeId, palette: getPalette(themeId), setThemeId }), [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
