import { useMemo } from 'react';
import { fetchRecentWins } from '../../api/betApi.js';
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling.js';
import { T, fmtCedi } from './tokens.js';

const POLL_MS = 60_000;

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

export default function WinnerTicker() {
  const { data } = useVisibilityPolling(fetchRecentWins, POLL_MS, []);
  const items = data?.wins || [];
  const reduce = useMemo(prefersReducedMotion, []);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recent winners"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        className="winner-ticker-track"
        style={{
          background: T.greenMid,
          padding: '12px 16px',
          overflow: 'hidden',
          borderRadius: 12,
          whiteSpace: 'nowrap',
          maxWidth: '90vw',
          color: '#dff3e3',
          animation: reduce ? 'none' : 'odd-marquee 33.33s linear infinite',
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
    </div>
  );
}
