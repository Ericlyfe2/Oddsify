/**
 * Oddsify shared primitives — wordmark, odds tile, segmented toggle,
 * status chip, flag badge, page headers, payout marquee, league row,
 * category grid, promo banner, match card.
 *
 * All ported from the Claude Design Oddsify.html prototype (bits.jsx +
 * screens-home.jsx + screens-other.jsx) with original visual rules intact.
 * Inline styles match the source so token churn touches one file.
 */
import { useEffect, useState } from 'react';
import { T, fmtCedi, useTokens } from './tokens.jsx';
import OddIcon from './Icon.jsx';
import { TeamLogo, LeagueLogo } from './teamBranding.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';
import { humanizePick } from '../../lib/marketNames.js';
import { ensure1X2Order, sortOddsEntries } from '../../lib/marketUtils.js';

/* ─── Oddsify wordmark ─────────────────────────────────────── */
export function OddsifyWordmark({ size = 22, color = '#ffffff', accent = T.greenBright }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0,
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -0.6,
        color,
        lineHeight: 1,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
        <span style={{ color: accent }}>O</span>
        <span>ddsify</span>
        <span
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 5,
            height: 5,
            borderRadius: 999,
            background: accent,
          }}
        />
      </span>
    </div>
  );
}

/* ─── Odds tile — the 1/X/2 button you tap to add to slip ─── */
export function OddsTile({ label, value, locked = false, selected = false, onClick, accent }) {
  const T = useTokens();
  accent ??= 'var(--green-bright)';
  const bg = selected ? accent : T.surfaceAlt;
  const fg = selected ? T.goldDark : locked ? T.inkDim : T.ink;
  return (
    <button
      onClick={onClick}
      disabled={locked}
      type="button"
      className={selected ? 'odd-odd-pop' : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        height: 52,
        background: bg,
        borderRadius: 10,
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        cursor: locked ? 'not-allowed' : 'pointer',
        border: selected ? `1px solid ${accent}` : `1px solid ${T.line}`,
        transition: 'transform 80ms ease, background 120ms ease',
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          color: locked ? T.inkDim : T.inkSoft,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {locked ? (
        <OddIcon name="lock" size={14} color={T.inkDim} />
      ) : (
        <span style={{ fontSize: 15, fontWeight: 700, color: fg, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      )}
    </button>
  );
}

/* ─── Segmented (pill) toggle ──────────────────────────────── */
export function OddSegmented({ options, value, onChange, accent, full = false }) {
  const T = useTokens();
  accent ??= 'var(--green-bright)';
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: T.surfaceAlt,
        borderRadius: 12,
        width: full ? '100%' : 'fit-content',
        border: `1px solid ${T.line}`,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            type="button"
            style={{
              flex: full ? 1 : undefined,
              padding: '9px 18px',
              borderRadius: 9,
              background: isActive ? accent : 'transparent',
              color: isActive ? T.goldDark : T.ink,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: -0.1,
              transition: 'background 150ms ease',
              whiteSpace: 'nowrap',
              border: 0,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Status chip (pill with optional dot) ─────────────────── */
export function OddStatusChip({ kind, label }) {
  const T = useTokens();
  const map = {
    pending: { bg: 'color-mix(in srgb, var(--warn) 18%, transparent)', fg: 'var(--warn)', dot: 'var(--warn)' },
    rejected: { bg: 'color-mix(in srgb, var(--danger) 16%, transparent)', fg: 'var(--danger)', dot: 'var(--danger)' },
    won: { bg: 'color-mix(in srgb, var(--accent) 18%, transparent)', fg: 'var(--accent)', dot: 'var(--accent)' },
    completed: {
      bg: 'color-mix(in srgb, var(--green-bright) 16%, transparent)',
      fg: 'var(--green-bright)',
      dot: 'var(--green-bright)',
    },
    approved: {
      bg: 'color-mix(in srgb, var(--green-bright) 16%, transparent)',
      fg: 'var(--green-bright)',
      dot: 'var(--green-bright)',
    },
    live: { bg: 'color-mix(in srgb, var(--danger) 16%, transparent)', fg: 'var(--danger)', dot: 'var(--danger)' },
    open: { bg: 'var(--accent)', fg: 'var(--gold-ink)', dot: null },
    soon: { bg: 'color-mix(in srgb, var(--accent) 18%, transparent)', fg: 'var(--accent)', dot: 'var(--accent)' },
    lost: { bg: 'color-mix(in srgb, var(--danger) 16%, transparent)', fg: 'var(--danger)', dot: 'var(--danger)' },
    cashed_out: { bg: 'color-mix(in srgb, var(--accent) 18%, transparent)', fg: 'var(--accent)', dot: 'var(--accent)' },
    void: { bg: T.surfaceAlt, fg: T.inkSoft, dot: T.inkDim },
  };
  const c = map[kind] || map.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 7px',
        borderRadius: 6,
        background: c.bg,
        color: c.fg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      }}
    >
      {c.dot && (
        <span
          className={kind === 'live' ? 'odd-live-dot' : undefined}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: c.dot,
          }}
        />
      )}
      <span className={kind === 'live' ? 'odd-live-blink' : undefined}>{label || kind}</span>
    </span>
  );
}

/* ─── Flag badge — round chip with league logo (falls back to code) ─
 * Logo URLs come from api-sports.io's public CDN, keyed by the
 * upstream league id. Codes that don't have a mapped logo render the
 * legacy colored-circle monogram so unknown competitions still look
 * intentional. New leagues: add the api-football league id below. */
const LEAGUE_LOGO_BY_CODE = {
  EPL: 39,
  PL: 39,
  LIG: 140,
  ESP: 140,
  LAL: 140,
  ITA: 135,
  SEA: 135,
  BUN: 78,
  GER: 78,
  FRA: 61,
  L1: 61,
  POR: 94,
  UCL: 2,
  CL: 2,
  UEL: 3,
  EL: 3,
  GHA: 297,
  GH: 297,
};
function leagueLogoUrl(code) {
  const id = LEAGUE_LOGO_BY_CODE[String(code || '').toUpperCase()];
  return id ? `https://media.api-sports.io/football/leagues/${id}.png` : null;
}
export function FlagBadge({ code, color, size = 40 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const T = useTokens();
  const url = imgFailed ? null : leagueLogoUrl(code);
  if (url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: T.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1.5px solid ${T.greenSoft}`,
          boxShadow: `0 0 0 1px ${T.line} inset`,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <img
          src={url}
          alt={`${code} logo`}
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          style={{ objectFit: 'contain' }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color || T.surfaceAlt,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.ink,
        fontWeight: 700,
        fontSize: Math.round(size * 0.3),
        letterSpacing: 0.3,
        border: `1.5px solid ${T.greenSoft}`,
        boxShadow: `0 0 0 1px ${T.line} inset`,
        flexShrink: 0,
      }}
    >
      {code}
    </div>
  );
}

/* ─── Page header used by non-Home screens (Sports/Bets/etc) ─ */
export function OddPageHeader({ title, subtitle, right }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '16px 16px 10px',
        gap: 8,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: -0.5,
            color: 'var(--text)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-soft)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/* ─── Home top header — wordmark + balance pill ────────────── */
export function OddTopHeader({ user, onAuth, onSearch, onBalanceClick }) {
  const T = useTokens();
  const { theme, toggleTheme } = useTheme();
  return (
    <div
      style={{
        background: 'var(--header-bg)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        padding: '58px 16px 14px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OddsifyWordmark size={22} color="var(--text)" accent="var(--green-bright)" />
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleTheme}
              type="button"
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={onSearch}
              type="button"
              className="theme-toggle"
              aria-label="Search"
            >
              <OddIcon name="search" size={18} color="var(--text)" />
            </button>
            <button
              type="button"
              onClick={onBalanceClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px 7px 10px',
                borderRadius: 999,
                background: 'var(--green-bright)',
                color: 'var(--gold-ink)',
                fontWeight: 700,
                fontSize: 13,
                border: 0,
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
              }}
              aria-label="Open wallet"
            >
              <OddIcon name="coin" size={16} color="var(--gold-ink)" />
              GHS {fmtCedi(user.balance)}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleTheme}
              type="button"
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => onAuth?.('signup')}
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                background: 'var(--text)',
                color: 'var(--bg)',
                fontWeight: 700,
                fontSize: 13,
                border: 0,
                cursor: 'pointer',
              }}
            >
              Join Now
            </button>
            <button
              onClick={() => onAuth?.('login')}
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                background: 'transparent',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13,
                border: '1px solid var(--line-strong)',
                cursor: 'pointer',
              }}
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Payout marquee — deprecated alias, prefer WinnerTicker.
   Kept for one release so any external import path keeps working. ─ */
export { default as OddPayoutTicker } from './WinnerTicker.jsx';

/* ─── Promo banner carousel ───────────────────────────────── */
const DEFAULT_BANNERS = [
  {
    id: 'bn1',
    tag: 'NEW USERS',
    title: 'Instant MoMo\nDeposits & Withdrawals',
    body: 'Topup any wallet with MTN, Telecel, Vodafone or AirtelTigo in seconds.',
    cta: 'Get bonus',
    tint: '#0a0a0a',
    accent: '#e8b94a',
    glyph: 'wallet',
  },
  {
    id: 'bn2',
    tag: 'FAST PAYOUTS',
    title: 'GHS 50,000\nMatch on first bet',
    body: '100% bonus up to GHS 50,000 when you stake your first slip this week.',
    cta: 'Learn more',
    tint: '#1a1306',
    accent: '#f7c948',
    glyph: 'fire',
  },
  {
    id: 'bn3',
    tag: 'JACKPOT',
    title: 'Win GHS 1.2M\non this weekend’s 12-leg slip',
    body: 'Pick winners across 12 European leagues. Entries close Sat 14:00.',
    cta: 'Enter now',
    tint: '#0d0c08',
    accent: '#d4a857',
    glyph: 'trophy',
  },
];
const PROMO_INTERVAL = 5500;
export function OddPromoBanner({ items = DEFAULT_BANNERS, onAction }) {
  const T = useTokens();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), PROMO_INTERVAL);
    return () => clearInterval(t);
  }, [items.length]);

  const b = items[idx];
  return (
    <div style={{ padding: '14px 16px 6px' }}>
      <div
        key={b.id}
        className="odd-banner-slide"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${b.tint} 0%, ${b.tint} 60%, ${b.accent}22 100%)`,
          borderRadius: 18,
          padding: '18px 20px',
          color: '#fff',
          minHeight: 154,
        }}
      >
        {/* grid overlay */}
        <svg
          style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }}
          width="100%"
          height="100%"
        >
          <defs>
            <pattern id={`grid-${b.id}`} width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M 22 0 L 0 0 0 22" fill="none" stroke={b.accent} strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${b.id})`} />
        </svg>

        {/* decorative glyph */}
        <div
          style={{
            position: 'absolute',
            right: -14,
            bottom: -14,
            width: 130,
            height: 130,
            borderRadius: 999,
            background: `${b.accent}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="odd-float"
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              background: b.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(-8deg)',
            }}
          >
            <OddIcon name={b.glyph} size={36} color={b.tint} strokeWidth={2.2} />
          </div>
        </div>

        <div style={{ position: 'relative', maxWidth: '70%' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: b.accent,
              padding: '4px 8px',
              borderRadius: 4,
              background: `${b.accent}22`,
              marginBottom: 12,
            }}
          >
            {b.tag}
          </span>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.15,
              whiteSpace: 'pre-line',
              letterSpacing: -0.4,
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
            }}
          >
            {b.title}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.4 }}>{b.body}</div>
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: 12,
              padding: '8px 14px',
              borderRadius: 999,
              background: b.accent,
              color: b.tint,
              fontWeight: 700,
              fontSize: 12,
              border: 0,
              cursor: 'pointer',
            }}
          >
            {b.cta} →
          </button>
        </div>

        {/* fill bar — sweeps left→right over the rotation interval */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: 'rgba(255,255,255,0.10)',
          }}
        >
          <div
            key={b.id}
            className="odd-banner-progress-fill"
            style={{
              height: '100%',
              background: b.accent,
              animationDuration: `${PROMO_INTERVAL}ms`,
            }}
          />
        </div>
      </div>

      {/* dot indicator */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? 18 : 6,
              height: 6,
              borderRadius: 999,
              background: i === idx ? T.greenBright : T.lineStrong,
              transition: 'width 250ms ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Category quick-grid (Upcoming / Live / Casino / Jackpot) ─ */
const DEFAULT_CATEGORIES = [
  { id: 'upc', label: 'Upcoming', icon: 'soccer', tint: '#e8b94a', to: '/' },
  { id: 'live', label: 'Live', icon: 'bolt', tint: '#ff5b78', to: '/sports' },
  { id: 'casino', label: 'Casino', icon: 'cards', tint: '#f7c948', to: '/casino' },
  { id: 'jack', label: 'Jackpot', icon: 'trophy', tint: '#c9a3ff', to: '/jackpot' },
];
export function OddCategoryGrid({ items = DEFAULT_CATEGORIES, onPick, liveCount }) {
  const T = useTokens();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        padding: '4px 16px 12px',
      }}
    >
      {items.map((c) => {
        const count = c.id === 'live' ? liveCount : c.count;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick?.(c)}
            style={{
              background: T.surface,
              borderRadius: 14,
              padding: '12px 4px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${T.line}`,
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: `${c.tint}1f`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: c.tint,
              }}
            >
              <OddIcon name={c.icon} size={20} color={c.tint} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{c.label}</span>
            {count !== undefined && count !== null && (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: c.tint,
                  color: '#fff',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Top-leagues horizontal scroller ──────────────────────── */
const DEFAULT_LEAGUES = [
  { id: 'eng', name: 'England · Premier', short: 'England', code: 'EPL', color: '#3d195b', live: 7 },
  { id: 'esp', name: 'Spain · La Liga', short: 'Spain', code: 'LIG', color: '#c8102e', live: 4 },
  { id: 'ita', name: 'Italy · Serie A', short: 'Italy', code: 'ITA', color: '#0b6623', live: 3 },
  { id: 'ger', name: 'Germany · Bundesliga', short: 'Germany', code: 'BUN', color: '#1c1c1c', live: 5 },
  { id: 'fra', name: 'France · Ligue 1', short: 'France', code: 'FRA', color: '#0055a4', live: 2 },
  { id: 'por', name: 'Portugal · Primeira', short: 'Portugal', code: 'POR', color: '#006a44', live: 6 },
];
export function OddLeagueRow({ leagues = DEFAULT_LEAGUES, onPick }) {
  const T = useTokens();
  const base = leagues && leagues.length ? leagues : DEFAULT_LEAGUES;
  const reps = Math.max(2, Math.ceil(12 / base.length));
  const oneSet = Array.from({ length: reps }, () => base).flat();
  const loop = [...oneSet, ...oneSet];

  return (
    <div
      className="odd-pane"
      style={{
        overflowX: 'hidden',
        padding: '0 16px 8px',
      }}
    >
      <div
        className="odd-league-track"
        style={{
          display: 'flex',
          width: 'max-content',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {loop.map((l, i) => (
          <button
            key={`${l.id}-${i}`}
            type="button"
            onClick={() => onPick?.(l)}
            aria-hidden={i >= base.length}
            tabIndex={i >= base.length ? -1 : 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px 6px 6px',
              borderRadius: 999,
              background: 'transparent',
              border: `1px solid ${T.line}`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <FlagBadge code={l.code} color={l.color} size={28} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft }}>{l.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Match card with 1/X/2 odds tiles ─────────────────────── */
export function OddMatchCard({ match, picks, onPick, onMore }) {
  const T = useTokens();
  const live = match.isLive;
  const pickedKey = picks?.[match.id]?.key;
  const odds = match.odds || {};
  const oddsEntries = sortOddsEntries(odds);
  const leagueCode = match.league || match.leagueCode || match.leagueName?.split(' · ')[0] || '—';

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 16,
        padding: '12px 14px 12px',
        color: T.ink,
        border: `1px solid ${T.line}`,
        boxShadow: `0 8px 24px -16px ${T.line}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LeagueLogo name={match.leagueName || match.league || leagueCode} size={16} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              color: T.inkSoft,
              textTransform: 'uppercase',
            }}
          >
            {leagueCode}
          </span>
          <span style={{ fontSize: 10, color: T.inkDim }}>·</span>
          <span style={{ fontSize: 10, color: T.inkSoft }}>{(match.sport || 'SOCCER').toUpperCase()}</span>
        </div>
        {live ? (
          <OddStatusChip kind="live" label={`LIVE ${match.minute || ''}`.trim()} />
        ) : (
          <span
            style={{
              fontSize: 11,
              color: T.inkSoft,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {match.day || ''}
            {match.day && match.time ? ' · ' : ''}
            {match.time || match.kickoff || ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {[
          ['home', match.scoreH],
          ['away', match.scoreA],
        ].map(([side, score], i) => {
          const name = side === 'home' ? match.home : match.away;
          const logoUrl = side === 'home' ? match.homeLogo : match.awayLogo;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamLogo name={name} logoUrl={logoUrl} size={20} />
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1, color: T.ink }}>{name}</span>
              </div>
              {live && score !== undefined && score !== null && (
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: T.ink,
                  }}
                >
                  {score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {oddsEntries.length > 0 ? (
          oddsEntries.map(([key, value]) => (
            <OddsTile
              key={key}
              label={key === 'X' ? 'Draw' : key === '1' ? (match.home || 'Home') : (match.away || 'Away')}
              value={Number(value).toFixed(2)}
              selected={pickedKey === key}
              onClick={() => onPick?.(match, key, Number(value))}
            />
          ))
        ) : (
          <div
            style={{
              flex: 1,
              padding: '14px 10px',
              borderRadius: 10,
              background: T.surfaceAlt,
              textAlign: 'center',
              fontSize: 11,
              color: T.inkSoft,
            }}
          >
            Markets opening soon
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onMore}
        style={{
          marginTop: 10,
          width: '100%',
          padding: '7px 0',
          borderRadius: 8,
          background: T.surfaceAlt,
          fontSize: 11,
          fontWeight: 600,
          color: T.inkSoft,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          border: 0,
          cursor: 'pointer',
        }}
      >
        More markets <OddIcon name="chevR" size={12} color={T.inkSoft} />
        {match.marketCount && (
          <span style={{ marginLeft: 4, fontSize: 10, color: T.greenBright }}>+{match.marketCount}</span>
        )}
      </button>
    </div>
  );
}

/* ─── Correct Score grid (SportyBet-style 3-column table) ── */

function CorrectScoreGrid({ selections, suspended, pickedSel, marketKey, match, onPick, T }) {
  const selMap = {};
  selections.forEach((s) => { selMap[s.key] = s; });

  const homeWins = [];
  const draws = [];
  const awayWins = [];
  const others = [];

  selections.forEach((s) => {
    const k = s.key;
    if (k.startsWith('OTHER')) { others.push(s); return; }
    const parts = k.split('-');
    if (parts.length !== 2) return;
    const [h, a] = parts.map(Number);
    if (isNaN(h) || isNaN(a)) return;
    if (h > a) homeWins.push(s);
    else if (h === a) draws.push(s);
    else awayWins.push(s);
  });

  const maxRows = Math.max(homeWins.length, draws.length, awayWins.length);
  const cols = [homeWins, draws, awayWins];

  const headerBg = T.greenBright;
  const headerColor = T.goldDark;
  const rowBg = T.surfaceAlt;
  const rowBgAlt = T.surface;
  const borderColor = T.line;
  const selectedBg = T.greenBright;
  const selectedColor = T.goldDark;
  const cellText = T.ink;
  const oddsColor = T.ink;

  const cellStyle = (isSelected, rowIdx) => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 6px', cursor: 'pointer',
    background: isSelected ? selectedBg : (rowIdx % 2 === 0 ? rowBg : rowBgAlt),
    borderBottom: `1px solid ${borderColor}`,
    transition: 'background 120ms ease',
    minHeight: 36,
  });

  const renderCell = (sel, rowIdx) => {
    if (!sel) return <div style={{ ...cellStyle(false, rowIdx), cursor: 'default' }} />;
    const selected = pickedSel?.key === sel.key && pickedSel?.market === marketKey;
    const locked = suspended || sel.suspended;
    const label = sel.label || sel.key.replace('-', ':');
    return (
      <button
        type="button" disabled={locked}
        onClick={() => onPick?.(match, sel.key, sel.odds, marketKey, sel.label || sel.key)}
        className={selected ? 'odd-odd-pop' : undefined}
        style={{
          ...cellStyle(selected, rowIdx),
          border: 'none', width: '100%', textAlign: 'left',
          cursor: locked ? 'not-allowed' : 'pointer',
          color: selected ? selectedColor : cellText,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label.replace('-', ':')}</span>
        {locked ? (
          <OddIcon name="lock" size={12} color="#999" />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: selected ? selectedColor : oddsColor, fontVariantNumeric: 'tabular-nums' }}>
            {Number(sel.odds).toFixed(2)}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
        {['Home', 'Draw', 'Away'].map((h) => (
          <div key={h} style={{
            background: headerBg, color: headerColor,
            fontSize: 12, fontWeight: 700, textAlign: 'center',
            padding: '8px 4px', borderRight: h !== 'Away' ? `1px solid rgba(255,255,255,0.2)` : 'none',
          }}>
            {h}
          </div>
        ))}
      </div>
      {Array.from({ length: maxRows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {cols.map((col, colIdx) => (
            <div key={colIdx} style={{ borderRight: colIdx < 2 ? `1px solid ${borderColor}` : 'none' }}>
              {renderCell(col[rowIdx], rowIdx)}
            </div>
          ))}
        </div>
      ))}
      {others.length > 0 && others.map((sel, idx) => {
        const selected = pickedSel?.key === sel.key && pickedSel?.market === marketKey;
        const locked = suspended || sel.suspended;
        const otherLabel = sel.key === 'OTHER_HOME' ? 'Other (Home)' : sel.key === 'OTHER_AWAY' ? 'Other (Away)' : sel.key === 'OTHER_DRAW' ? 'Other (Draw)' : 'Other';
        return (
          <button
            key={sel.key} type="button" disabled={locked}
            onClick={() => onPick?.(match, sel.key, sel.odds, marketKey, sel.label || sel.key)}
            className={selected ? 'odd-odd-pop' : undefined}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '8px 6px',
              background: selected ? selectedBg : ((maxRows + idx) % 2 === 0 ? rowBg : rowBgAlt),
              borderTop: idx === 0 ? `1px solid ${borderColor}` : 'none',
              borderBottom: idx < others.length - 1 ? `1px solid ${borderColor}` : 'none',
              cursor: locked ? 'not-allowed' : 'pointer',
              color: selected ? selectedColor : cellText,
              transition: 'background 120ms ease',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>{otherLabel}</span>
            {locked ? (
              <OddIcon name="lock" size={12} color="#999" />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: selected ? selectedColor : oddsColor, fontVariantNumeric: 'tabular-nums' }}>
                {Number(sel.odds).toFixed(2)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Markets bottom sheet ────────────────────────────────── */

const MARKET_LABELS = {
  '1X2': 'Match Result', DC: 'Double Chance', DNB: 'Draw No Bet',
  BTTS: 'Both Teams To Score', CS: 'Correct Score',
  HTFT: 'Half Time / Full Time', WINBTTS: 'Result & BTTS',
  WINOU25: 'Result & Over/Under 2.5', BTTSOU25: 'BTTS & Over/Under 2.5',
  '1H1X2': '1st Half Result', '1HBTTS': '1st Half BTTS', '1HOU05': '1st Half Over/Under 0.5',
  ML: 'Moneyline', TP: 'Total Points', HCAP: 'Handicap',
};
function marketLabel(key, market) {
  return market?.name || MARKET_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim();
}

export function MarketsSheet({ match, picks, onPick, onClose }) {
  const T = useTokens();
  if (!match) return null;
  const markets = match.markets || {};
  const entries = Object.entries(markets);
  const pickedSel = picks?.[match.id];

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '85vh',
          background: T.bg, borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{
          padding: '16px 16px 12px', borderBottom: `1px solid ${T.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{match.home} vs {match.away}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
              {entries.length} market{entries.length !== 1 ? 's' : ''} available
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: T.surfaceAlt, border: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <OddIcon name="x" size={14} color={T.ink} />
          </button>
        </div>

        {/* scrollable market list */}
        <div style={{ overflowY: 'auto', padding: '8px 16px 24px', flex: 1 }}>
          {entries.map(([key, mkt]) => {
            const sels = ensure1X2Order(mkt.selections || []);
            const suspended = mkt.suspended;
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  color: T.inkSoft, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {marketLabel(key, mkt)}
                </div>
                {key === 'CS' ? (
                  <CorrectScoreGrid
                    selections={sels} suspended={suspended}
                    pickedSel={pickedSel} marketKey={key}
                    match={match} onPick={onPick} T={T}
                  />
                ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                }}>
                  {sels.map((sel) => {
                    const selected = pickedSel?.key === sel.key && pickedSel?.market === key;
                    const locked = suspended || sel.suspended;
                    return (
                      <button
                        key={sel.key} type="button" disabled={locked}
                        onClick={() => onPick?.(match, sel.key, sel.odds, key, sel.label || sel.key)}
                        className={selected ? 'odd-odd-pop' : undefined}
                        style={{
                          flex: sels.length <= 3 ? 1 : '0 0 calc(33.33% - 4px)',
                          minWidth: 0, padding: '8px 6px', borderRadius: 10,
                          background: selected ? T.greenBright : T.surfaceAlt,
                          border: selected ? `1px solid ${T.greenBright}` : `1px solid ${T.line}`,
                          cursor: locked ? 'not-allowed' : 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          transition: 'transform 80ms ease, background 120ms ease',
                        }}
                      >
                        <span style={{
                          fontSize: 10, color: locked ? T.inkDim : T.inkSoft,
                          textAlign: 'center', lineHeight: 1.2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}>
                          {sel.label || humanizePick(sel.key, match.home, match.away)}
                        </span>
                        {locked ? (
                          <OddIcon name="lock" size={12} color={T.inkDim} />
                        ) : (
                          <span style={{
                            fontSize: 14, fontWeight: 700,
                            color: selected ? T.goldDark : T.ink,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {Number(sel.odds).toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: T.inkSoft, fontSize: 12 }}>
              No markets available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Re-export for one-liner imports from pages ──────────── */
export { T, fmtCedi, useTokens, OddIcon };
