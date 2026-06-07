import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Static default tokens (dark-mode fallback). Components should always
 * use `useTokens()` for theme-aware values — the static `T` only exists
 * for SSR safety and for files that haven't been migrated yet.
 */
export const T = {
  bg: '#0a0a0a',
  surface: '#161513',
  surfaceAlt: '#211f1a',
  ink: '#f3e9cf',
  inkSoft: '#9c9277',
  inkDim: '#5f5848',
  line: 'rgba(243, 233, 207, 0.08)',
  lineStrong: 'rgba(243, 233, 207, 0.16)',

  greenDeep: '#0f0e0c',
  greenMid: '#1a1814',
  greenBright: '#e8b94a',
  greenSoft: 'rgba(232, 185, 74, 0.16)',

  gold: '#f7c948',
  goldDark: '#1a1300',
  goldInk: '#1a1300',
  goldSoft: 'rgba(232, 185, 74, 0.16)',
  danger: '#ff5b78',
  warn: '#f0a040',

  headerBg: 'rgba(15, 14, 12, 0.86)',
  bgSoft: '#0f0e0c',
  accent: '#e8b94a',
  accentWarm: '#f7c948',
  accentHot: '#ff5b78',
  accentCool: '#6ad0ff',
};

/** Light-mode hardcoded fallback used when CSS hasn't loaded yet.
 *  Keep in sync with the html[data-theme='light'] block in app.css. */
const T_LIGHT = {
  ...T,
  bg: '#f4f1e8',
  bgSoft: '#fbf7ec',
  surface: '#fffdf6',
  surfaceAlt: '#ece6d4',
  ink: '#1a160a',
  inkSoft: '#4d4534',
  inkDim: '#6f6856',
  line: 'rgba(28, 22, 8, 0.1)',
  lineStrong: 'rgba(28, 22, 8, 0.22)',
  headerBg: 'rgba(251, 247, 236, 0.86)',
  accent: '#c8980b',
  accentWarm: '#d8a808',
  accentHot: '#d6263f',
  accentCool: '#1f8dd0',
  gold: '#c8980b',
  goldSoft: 'rgba(200, 152, 11, 0.18)',
  greenBright: '#d4a418',
  greenMid: '#e8e0d0',
  danger: '#d6263f',
  warn: '#b4720a',
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
