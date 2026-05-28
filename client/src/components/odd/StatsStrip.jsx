/**
 * StatsStrip — 4 animated counters on the homepage.
 *
 * Numbers count up from 0 to value on first scroll-into-view (1.5s, ease-out
 * cubic). Subsequent re-fetches snap to the new value without re-animating
 * (avoids the perpetually-counting "casino tackiness" the spec warns about).
 * `prefers-reduced-motion` skips the animation entirely.
 *
 * Data: GET /api/stats/public, re-fetched every 60s while visible.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchPublicStats } from '../../api/betApi.js';
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling.js';
import { T, fmtCedi } from './tokens.js';

const POLL_MS = 60_000;
const ANIM_MS = 1500;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function CountUp({ value, format = (n) => n.toLocaleString('en-GH') }) {
  // If reduce-motion is on, mount already showing the final value and mark
  // "already animated" so subsequent value updates snap instead of animating.
  const reduce = prefersReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const animatedRef = useRef(reduce);

  useEffect(() => {
    if (animatedRef.current) { setDisplay(value); return; }
    const start = performance.now();
    let rafId = null;
    function frame(now) {
      const t = Math.min(1, (now - start) / ANIM_MS);
      setDisplay(Math.round(value * easeOutCubic(t)));
      if (t < 1) rafId = requestAnimationFrame(frame);
      else animatedRef.current = true;
    }
    rafId = requestAnimationFrame(frame);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [value]);

  return <>{format(display)}</>;
}

function StatCard({ label, value, sublabel, format, pulse }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
        color: T.inkSoft, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {pulse && (
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: T.danger, animation: 'odd-pulse 1.4s ease-in-out infinite',
          }} />
        )}
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700, color: T.ink,
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums',
      }}>
        {value == null
          ? '—'
          : <CountUp value={value} format={format} />}
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: T.inkSoft }}>{sublabel}</div>
      )}
    </div>
  );
}

export default function StatsStrip() {
  const { data } = useVisibilityPolling(fetchPublicStats, POLL_MS, []);
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  // Until BOTH data is loaded AND we're in view, pass undefined values so
  // each StatCard renders an "—". This avoids the placeholder-0 → real-value
  // transition that would otherwise hide the animation behind a stale ref.
  const v = (data && inView) ? data : {};

  return (
    <div ref={ref} role="region" aria-label="Site statistics" style={{
      padding: '16px',
      display: 'grid', gap: 10,
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    }} className="stats-strip">
      <StatCard label="Bets placed"    value={v.totalBets} />
      <StatCard label="GHS paid out"   value={v.totalPayoutsGhs} format={(n) => `GHS ${fmtCedi(n)}`} />
      <StatCard label="Players online" value={v.activeUsers24h} sublabel="Today" />
      <StatCard label="Live matches"   value={v.liveMatches} pulse={(v.liveMatches ?? 0) > 0} />
      <style>{`
        @media (min-width: 768px) {
          .stats-strip { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
