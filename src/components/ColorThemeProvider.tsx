'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ColorTheme = 'default' | 'blue' | 'orange' | 'green';

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorTheme] = useState<ColorTheme>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('app-color-theme') as ColorTheme | null;
      if (saved) {
        setColorTheme(saved);
        document.documentElement.setAttribute('data-color', saved);
      }
    } catch (e) {}
  }, []);

  const changeColorTheme = (theme: ColorTheme) => {
    setColorTheme(theme);
    try {
      localStorage.setItem('app-color-theme', theme);
      document.documentElement.setAttribute('data-color', theme);
    } catch (e) {}
  };

  // Render children immediately but don't provide context functions until mounted
  // Since colorTheme is mainly used for settings panel, this is fine
  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme: changeColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export const useColorTheme = () => {
  const context = useContext(ColorThemeContext);
  if (!context) throw new Error('useColorTheme must be used within ColorThemeProvider');
  return context;
};
