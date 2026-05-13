/**
 * Celebration modal shown when the player has freshly-settled winning bets
 * they haven't acknowledged yet. Pure SVG trophy + confetti — no assets.
 */
import { useEffect, useMemo, useRef } from 'react';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WinTrophyModal({ wins = [], onClose }) {
  const dlgRef = useRef(null);

  useEffect(() => {
    if (!wins.length) return;
    dlgRef.current?.showModal?.();
    const onCancel = (e) => { e.preventDefault(); onClose?.(); };
    const node = dlgRef.current;
    node?.addEventListener('cancel', onCancel);
    return () => node?.removeEventListener('cancel', onCancel);
  }, [wins.length, onClose]);

  const totalPayout = useMemo(() => wins.reduce((s, b) => s + (Number(b.potentialWin) || 0), 0), [wins]);
  const totalStake  = useMemo(() => wins.reduce((s, b) => s + (Number(b.stake)        || 0), 0), [wins]);
  const profit      = totalPayout - totalStake;

  if (!wins.length) return null;

  return (
    <dialog ref={dlgRef} className="bv-trophy">
      <div className="bv-trophy-bg">
        <div className="bv-trophy-orb" />
        <div className="bv-trophy-orb b" />
      </div>

      <Confetti count={48} />

      <div className="bv-trophy-card" role="alertdialog" aria-labelledby="bv-trophy-title">
        <div className="bv-trophy-emblem" aria-hidden>
          <TrophySVG />
        </div>

        <div className="bv-trophy-eyebrow">CONGRATULATIONS</div>
        <h2 id="bv-trophy-title" className="bv-trophy-title">
          {wins.length === 1 ? 'You won!' : `You won ${wins.length} bets!`}
        </h2>
        <p className="bv-trophy-sub">
          {wins.length === 1
            ? `Your bet just settled in your favour. The payout has hit your wallet.`
            : `Multiple tickets just settled in your favour. Payouts are in your wallet.`}
        </p>

        <div className="bv-trophy-amount">
          <span className="cur">GHS</span>
          <span className="amt">{fmt(totalPayout)}</span>
        </div>
        <div className="bv-trophy-meta">
          <span>Stake <strong>GHS {fmt(totalStake)}</strong></span>
          <span className="dot" />
          <span>Profit <strong style={{ color: '#18f0a1' }}>+GHS {fmt(profit)}</strong></span>
        </div>

        <ul className="bv-trophy-list">
          {wins.slice(0, 3).map((b) => (
            <li key={b.id}>
              <span className="lbl">
                {(b.legs?.[0]?.home || 'Bet')} {b.legs?.length > 1 ? <em>+{b.legs.length - 1}</em> : null}
              </span>
              <span className="val">GHS {fmt(b.potentialWin)}</span>
            </li>
          ))}
          {wins.length > 3 && <li><span className="lbl">… and {wins.length - 3} more</span></li>}
        </ul>

        <div className="bv-trophy-actions">
          <button type="button" className="btn btn-primary bv-trophy-btn" onClick={onClose}>
            Awesome — let&apos;s go
          </button>
        </div>
      </div>

      <style>{TROPHY_CSS}</style>
    </dialog>
  );
}

function TrophySVG() {
  return (
    <svg viewBox="0 0 200 200" width="160" height="160" aria-hidden>
      <defs>
        <linearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd76d" />
          <stop offset=".55" stopColor="#f6a200" />
          <stop offset="1" stopColor="#c46500" />
        </linearGradient>
        <linearGradient id="cup-hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3a1a" />
          <stop offset="1" stopColor="#2c1c0a" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#ffce5c" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffce5c" stopOpacity="0" />
        </radialGradient>
        <filter id="shine" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>
      <circle cx="100" cy="92" r="80" fill="url(#glow)" />
      {/* Handles */}
      <path d="M48 60 Q12 60 16 95 Q19 130 60 124" fill="none" stroke="url(#cup)" strokeWidth="10" strokeLinecap="round" />
      <path d="M152 60 Q188 60 184 95 Q181 130 140 124" fill="none" stroke="url(#cup)" strokeWidth="10" strokeLinecap="round" />
      {/* Cup body */}
      <path d="M50 36 H150 V92 Q150 138 100 142 Q50 138 50 92 Z" fill="url(#cup)" stroke="#7a3f00" strokeWidth="2.5" />
      {/* Highlight */}
      <path d="M62 42 H92 Q86 80 70 110 Z" fill="url(#cup-hi)" filter="url(#shine)" />
      {/* Rim */}
      <ellipse cx="100" cy="38" rx="52" ry="10" fill="#ffe28a" stroke="#7a3f00" strokeWidth="2" />
      <ellipse cx="100" cy="36" rx="48" ry="6" fill="#fff3c4" opacity=".7" />
      {/* Star plate */}
      <circle cx="100" cy="86" r="20" fill="#fff8d6" stroke="#7a3f00" strokeWidth="1.6" />
      <path d="M100 70 l5.3 11 12 1.6 -9 8.4 2.3 12 -10.6 -6.2 -10.6 6.2 2.3 -12 -9 -8.4 12 -1.6 z" fill="#f6a200" />
      {/* Stem */}
      <path d="M86 142 H114 V160 H86 Z" fill="url(#base)" />
      <path d="M76 158 H124 V170 H76 Z" fill="url(#base)" />
      <path d="M64 168 H136 V184 H64 Z" fill="url(#base)" />
      <text x="100" y="180" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="9" fill="#ffd76d">CHAMPION</text>
    </svg>
  );
}

function Confetti({ count = 36 }) {
  const pieces = Array.from({ length: count }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 1.4;
    const dur   = 2.4 + Math.random() * 2.2;
    const rot   = Math.random() * 360;
    const colors = ['#ffd76d', '#7c5cff', '#22d3ee', '#18f0a1', '#ff5fb1', '#4f8bff'];
    const c = colors[i % colors.length];
    return { left, delay, dur, rot, c, key: i, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9 };
  });
  return (
    <div className="bv-confetti" aria-hidden>
      {pieces.map((p) => (
        <span key={p.key} style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          background: p.c,
          width: p.w, height: p.h,
          transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

const TROPHY_CSS = `
.bv-trophy {
  border: none; padding: 0; background: transparent;
  width: min(440px, 92vw); max-width: 100%;
  border-radius: 24px; overflow: visible;
  color: #0e1330;
}
.bv-trophy::backdrop {
  background: radial-gradient(900px 600px at 50% 30%, rgba(124,92,255,.55), rgba(8, 10, 22, .88));
  backdrop-filter: blur(8px);
}
.bv-trophy-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.bv-trophy-orb {
  position: absolute; width: 320px; height: 320px;
  background: radial-gradient(circle, rgba(255, 215, 109, .5), transparent 60%);
  border-radius: 50%; top: -120px; left: -60px;
  filter: blur(8px);
  animation: bvFloat 7s ease-in-out infinite;
}
.bv-trophy-orb.b {
  background: radial-gradient(circle, rgba(124, 92, 255, .55), transparent 60%);
  top: auto; bottom: -120px; right: -60px; left: auto;
  animation-delay: 1.5s;
}
@keyframes bvFloat {
  0%,100% { transform: translate(0,0); }
  50%     { transform: translate(20px, -20px); }
}
.bv-trophy-card {
  position: relative; z-index: 2;
  background: linear-gradient(180deg, #fff 0%, #fff 100%);
  border-radius: 24px;
  padding: 18px 26px 26px;
  box-shadow: 0 20px 80px rgba(8, 12, 40, .55), 0 0 0 1px rgba(255, 215, 109, .55);
  text-align: center;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  animation: bvPop .35s cubic-bezier(.18, .8, .36, 1.18);
}
@keyframes bvPop {
  from { transform: scale(.86); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.bv-trophy-emblem {
  margin-top: -78px;
  display: flex; justify-content: center;
  filter: drop-shadow(0 14px 24px rgba(255, 184, 50, .55));
  animation: bvSpin 6s ease-in-out infinite;
}
@keyframes bvSpin {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(3deg); }
}
.bv-trophy-eyebrow {
  margin-top: -6px;
  font-size: 11px; letter-spacing: .42em; font-weight: 800;
  color: #b07300;
}
.bv-trophy-title {
  font-size: 30px; line-height: 1.05;
  font-weight: 900; letter-spacing: -.02em;
  margin: 6px 0 6px;
  background: linear-gradient(120deg, #7c5cff, #f6a200 60%, #ff5fb1);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.bv-trophy-sub {
  color: #525879;
  font-size: 13.5px;
  margin: 0 0 14px;
}
.bv-trophy-amount {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  margin: 6px 0 8px;
}
.bv-trophy-amount .cur { font-size: 14px; font-weight: 800; color: #8088b3; letter-spacing: .08em; }
.bv-trophy-amount .amt {
  font-size: 44px; font-weight: 900; letter-spacing: -.02em;
  background: linear-gradient(135deg, #7c5cff, #22d3ee);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.bv-trophy-meta {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-size: 13px; color: #525879;
}
.bv-trophy-meta .dot { width: 4px; height: 4px; border-radius: 50%; background: #cbd0e6; }
.bv-trophy-list {
  list-style: none; padding: 0;
  margin: 16px 0 12px;
  display: flex; flex-direction: column; gap: 6px;
  text-align: left;
  font-size: 13px;
}
.bv-trophy-list li {
  display: flex; justify-content: space-between;
  background: linear-gradient(180deg, rgba(124,92,255,.08), rgba(34,211,238,.05));
  padding: 8px 12px; border-radius: 10px;
  border: 1px solid rgba(124,92,255,.18);
}
.bv-trophy-list .lbl { color: #2e3559; font-weight: 600; }
.bv-trophy-list .lbl em { color: #7c5cff; font-style: normal; margin-left: 4px; }
.bv-trophy-list .val { color: #0e1330; font-weight: 800; font-variant-numeric: tabular-nums; }
.bv-trophy-actions {
  display: flex; gap: 8px; justify-content: center; margin-top: 4px;
}
.bv-trophy-btn {
  background: linear-gradient(135deg, #7c5cff, #4f8bff 60%, #22d3ee);
  color: #fff; border: none;
  padding: 12px 22px; border-radius: 12px;
  font-weight: 800; font-size: 14px;
  letter-spacing: -.005em;
  box-shadow: 0 16px 36px rgba(124, 92, 255, .35);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease;
}
.bv-trophy-btn:hover { transform: translateY(-1px); box-shadow: 0 20px 48px rgba(124, 92, 255, .5); }

.bv-confetti {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  overflow: hidden;
}
.bv-confetti span {
  position: absolute;
  top: -16px;
  border-radius: 2px;
  opacity: .92;
  animation: bvFall linear infinite;
}
@keyframes bvFall {
  0%   { transform: translate(0, -20px) rotate(0); opacity: 0; }
  10%  { opacity: .95; }
  100% { transform: translate(20px, 110vh) rotate(720deg); opacity: 0; }
}
`;
