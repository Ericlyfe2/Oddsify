/**
 * WinnerTicker — replaces OddPayoutTicker.
 *
 * Mobile (<768px): vertical stack of 3 items, auto-rotates every 4s.
 * Desktop (>=768px): horizontal marquee using existing `odd-marquee` keyframe.
 * Tap to expand (mobile): reveals stake/odds row.
 *
 * Data: GET /api/bet/recent-wins (15 items, real + synthetic).
 * Polling: 60s, paused when tab hidden, immediate re-fetch on regain.
 * Respects prefers-reduced-motion: no auto-rotate, no marquee, static list.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchRecentWins } from '../../api/betApi.js';
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling.js';
import { T, fmtCedi } from './tokens.js';

const ROTATE_MS = 4000;
const POLL_MS   = 60_000;

function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)          return 'just now';
  if (ms < 60 * 60_000)     return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / (60 * 60_000))}h ago`;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function WinRow({ item, expanded, onToggle }) {
  const typeLabel = item.betType === 'multi' ? `Multi (${item.legs} legs)` : 'Single';
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%',
        textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer',
        padding: '4px 0', color: '#fff',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 12, letterSpacing: 0.2, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: T.greenBright, flexShrink: 0,
        }} />
        <span style={{ color: '#fff' }}>📞 {item.phoneMasked}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ color: T.greenBright, fontWeight: 700 }}>GHS {fmtCedi(item.amountGhs)}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ opacity: 0.85 }}>{typeLabel}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ opacity: 0.5 }}>{relTime(item.settledAt)}</span>
      </span>
      {expanded && (
        <span style={{
          fontSize: 11, color: T.inkSoft, marginTop: 4, marginLeft: 14,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        }}>
          Stake — · Odds @{item.oddsTotal.toFixed(2)}
        </span>
      )}
    </button>
  );
}

export default function WinnerTicker() {
  const { data } = useVisibilityPolling(fetchRecentWins, POLL_MS, []);
  const items = data?.wins || [];
  const reduce = useMemo(prefersReducedMotion, []);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (reduce || items.length === 0) return;
    const id = setInterval(
      () => setPage((p) => (p + 1) % Math.max(1, items.length)),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [reduce, items.length]);

  const visibleMobile = useMemo(() => {
    if (items.length === 0) return [];
    if (items.length <= 3)  return items;
    const out = [];
    for (let i = 0; i < 3; i++) out.push(items[(page + i) % items.length]);
    return out;
  }, [items, page]);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recent winners"
      style={{
        background: T.greenMid, color: '#dff3e3',
        padding: '8px 16px', overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Mobile: vertical 3-item stack */}
      <div className="winner-ticker-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleMobile.map((it) => (
          <WinRow
            key={it.id}
            item={it}
            expanded={expandedId === it.id}
            onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
          />
        ))}
      </div>

      {/* Desktop: horizontal marquee */}
      <div
        className="winner-ticker-desktop"
        style={{
          display: 'none', whiteSpace: 'nowrap',
          animation: reduce ? 'none' : 'odd-marquee 60s linear infinite',
        }}
      >
        {[...items, ...items].map((it, i) => (
          <span key={`${it.id}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 48,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: T.greenBright }} />
            <span style={{ color: '#fff' }}>📞 {it.phoneMasked}</span>
            <span style={{ color: T.greenBright, fontWeight: 700 }}>GHS {fmtCedi(it.amountGhs)}</span>
            <span style={{ opacity: 0.85 }}>{it.betType === 'multi' ? `Multi (${it.legs} legs)` : 'Single'}</span>
            <span style={{ opacity: 0.5 }}>{relTime(it.settledAt)}</span>
          </span>
        ))}
      </div>

      {/* Layout switch handled by CSS so it works without JS re-render on resize. */}
      <style>{`
        @media (min-width: 768px) {
          .winner-ticker-mobile  { display: none !important; }
          .winner-ticker-desktop { display: block !important; }
        }
      `}</style>
    </div>
  );
}
