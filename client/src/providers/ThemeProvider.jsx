import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

const ThemeCtx = createContext(null);
const STORAGE_KEY = 'betnexa_theme';

function readInitial() {
  // BetNexa's flagship identity is white + light green, so a first-time
  // visitor with no saved preference and no explicit dark OS preference
  // lands on that look rather than the dark adaptation.
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = useState(readInitial);

  // The initial data-theme is already set by the inline script in index.html.
  // useLayoutEffect runs synchronously after DOM commit, keeping theme synced
  // without side-effecting inside the render body.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0b120d' : '#ffffff';
  }, [theme]);

  const setTheme = useCallback((t) => {
    const next = t === 'light' ? 'light' : 'dark';
    setThemeRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeRaw((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} };
  return ctx;
}
