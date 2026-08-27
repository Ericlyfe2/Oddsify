import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Static default tokens (dark-mode fallback). Components should always
 * use `useTokens()` for theme-aware values — the static `T` only exists
 * for SSR safety and for files that haven't been migrated yet.
 */
export const T = {
  bg: '#0b120d',
  surface: '#131d15',
  surfaceAlt: '#1c2a20',
  ink: '#eaf8e8',
  inkSoft: '#9db89d',
  inkDim: '#5e6e5e',
  line: 'rgba(234, 248, 232, 0.08)',
  lineStrong: 'rgba(234, 248, 232, 0.16)',

  greenDeep: '#0b120d',
  greenMid: '#16221a',
  greenBright: '#7ed957',
  greenSoft: 'rgba(126, 217, 87, 0.16)',

  gold: '#a8e6a3',
  goldDark: '#0b2e12',
  goldInk: '#0b2e12',
  goldSoft: 'rgba(126, 217, 87, 0.16)',
  danger: '#ff6b6b',
  warn: '#e0a83d',

  headerBg: 'rgba(11, 18, 13, 0.86)',
  bgSoft: '#0f1811',
  accent: '#7ed957',
  accentWarm: '#a8e6a3',
  accentHot: '#ff6b6b',
  accentCool: '#6ad0ff',
};

/** Light-mode hardcoded fallback used when CSS hasn't loaded yet.
 *  Keep in sync with the html[data-theme='light'] block in app.css. */
const T_LIGHT = {
  ...T,
  bg: '#ffffff',
  bgSoft: '#f7faf7',
  surface: '#ffffff',
  surfaceAlt: '#f3fbf1',
  ink: '#172117',
  inkSoft: '#657365',
  inkDim: '#93a693',
  line: 'rgba(23, 33, 23, 0.08)',
  lineStrong: 'rgba(23, 33, 23, 0.16)',
  headerBg: 'rgba(255, 255, 255, 0.86)',
  accent: '#15803d',
  accentWarm: '#16a34a',
  accentHot: '#dc2626',
  accentCool: '#2563eb',
  gold: '#16a34a',
  goldInk: '#ffffff',
  goldSoft: 'rgba(21, 128, 61, 0.12)',
  greenBright: '#16a34a',
  greenMid: '#eaf8e8',
  danger: '#dc2626',
  warn: '#b45309',
};

const VAR_MAP = [
  ['bg', '--bg'],
  ['bgSoft', '--bg-soft'],
  ['surface', '--surface'],
  ['surfaceAlt', '--surface-2'],
  ['ink', '--text'],
  ['inkSoft', '--text-soft'],
  ['inkDim', '--text-dim'],
  ['line', '--line'],
  ['lineStrong', '--line-strong'],
  ['headerBg', '--header-bg'],
  ['accent', '--accent'],
  ['accentWarm', '--accent-warm'],
  ['accentHot', '--accent-hot'],
  ['accentCool', '--accent-cool'],
  ['gold', '--gold'],
  ['goldInk', '--gold-ink'],
  ['goldSoft', '--gold-soft'],
  ['greenBright', '--green-bright'],
  ['greenDeep', '--green-deep'],
  ['greenMid', '--green-mid'],
  ['danger', '--danger'],
  ['warn', '--warn'],
];

function readThemeTokens() {
  if (typeof document === 'undefined') return T;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const out = { ...T };
  let hasAny = false;
  for (const [key, cssVar] of VAR_MAP) {
    const val = style.getPropertyValue(cssVar).trim();
    if (val) {
      out[key] = val;
      hasAny = true;
    }
  }
  // If CSS variables aren't defined yet (CSS loads async in production),
  // fall back to hardcoded values based on the current data-theme.
  if (!hasAny) {
    return root.dataset.theme === 'light' ? { ...T_LIGHT } : { ...T };
  }
  return out;
}

const TokensCtx = createContext(T);

export function TokensProvider({ children }) {
  const [tokens, setTokens] = useState(readThemeTokens);
  const observerRef = useRef(null);

  useEffect(() => {
    // Re-read after the first paint — by then the CSS file should be loaded
    // and CSS custom properties available.  This fixes a race where async
    // CSS arrives after useState(readThemeTokens) ran.
    requestAnimationFrame(() => setTokens(readThemeTokens()));

    observerRef.current = new MutationObserver(() => {
      setTokens(readThemeTokens());
    });
    observerRef.current.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const value = useMemo(() => tokens, [tokens]);
  return <TokensCtx.Provider value={value}>{children}</TokensCtx.Provider>;
}

/** Hook returning theme-aware token values. Components that use inline styles
 *  should always use `useTokens()` to react to theme changes.
 *  Example:  const T = useTokens();  // T.ink, T.bg, T.surface etc. */
export function useTokens() {
  return useContext(TokensCtx);
}

export function fmtCedi(n) {
  const v = Math.abs(Number(n) || 0);
  return v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
