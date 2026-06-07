import { useEffect, useRef, useState } from 'react';

export function toBookingCode(id = '') {
  const s = String(id)
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
  if (!s) return 'XX00000';
  const letters = (s.match(/[A-Z]/g) || ['X', 'X']).slice(0, 2).join('').padEnd(2, 'X');
  const digits = (s.match(/[0-9]/g) || ['0']).slice(-5).join('').padStart(5, '0');
  return letters + digits;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BetSuccessModal({ bet, onClose, onViewBet, onGoHistory, onCopy, onShare, onRebook, onReturn }) {
  const dlgRef = useRef(null);
  const [canClose, setCanClose] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!bet) return;
    setCanClose(false);
    closeTimerRef.current = setTimeout(() => setCanClose(true), 2000);
    return () => clearTimeout(closeTimerRef.current);
  }, [bet]);

  useEffect(() => {
    if (!bet || !dlgRef.current) return;
    dlgRef.current.showModal();
  }, [bet]);

  if (!bet) return null;
  const code = bet.bookingCode || toBookingCode(bet.id);
  const ts = bet.placedAt ? new Date(bet.placedAt).toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handleClose = () => { if (canClose) onClose?.(); };
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/code/${code}` : `/code/${code}`;

  return (
    <dialog ref={dlgRef} className="bv-success" onClose={onClose} onClick={handleClose}>
      <Confetti count={52} />
      <Particles count={20} />
      <Sparkles count={12} />

      <div className="bv-success-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="bv-success-title">
        <header className="bv-success-head">
          <span className="bv-success-badge">BET CONFIRMED</span>
          {canClose && (
            <button type="button" className="bv-success-x" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </header>

        <div className="bv-success-emblem" aria-hidden>
          <TrophyIcon />
        </div>

        <div className="bv-success-glow" aria-hidden />

        <h2 id="bv-success-title" className="bv-success-title">Congratulations!</h2>
        <p className="bv-success-sub">Your bet has been placed successfully.</p>

        <div className="bv-success-amount">
          <span className="cur">GHS</span>
          <span className="amt">{fmt(bet.stake)}</span>
        </div>

        <div className="bv-success-meta">
          {bet.totalOdds ? `${bet.totalOdds.toFixed(2)}x` : ''} odds · {bet.mode || 'single'} · {
            (bet.legs?.length || 1)
          } selection{(bet.legs?.length || 1) > 1 ? 's' : ''}
        </div>

        <div className="bv-success-grid">
          <div className="bv-success-stat">
            <span className="lbl">Potential Win</span>
            <span className="val" style={{ color: '#ffc44d' }}>GHS {fmt(bet.potentialWin)}</span>
          </div>
          <div className="bv-success-stat">
            <span className="lbl">Booking Code</span>
            <span className="val val-mono">{code}</span>
          </div>
          <div className="bv-success-stat">
            <span className="lbl">Bet ID</span>
            <span className="val val-id">{bet.id?.slice(-8) || '—'}</span>
          </div>
          <div className="bv-success-stat">
            <span className="lbl">Placed At</span>
            <span className="val">{ts}</span>
          </div>
        </div>

        <div className="bv-success-actions">
          <button type="button" className="bv-success-btn bv-success-btn-primary" onClick={() => { onViewBet?.(); onClose?.(); }}>
            View Bet
          </button>
          <button type="button" className="bv-success-btn bv-success-btn-ghost" onClick={() => { onGoHistory?.(); onClose?.(); }}>
            Bet History
          </button>
          <button type="button" className="bv-success-btn bv-success-btn-ghost" onClick={() => { onCopy?.(code); }}>
            Copy Code
          </button>
          <button type="button" className="bv-success-btn bv-success-btn-ghost" onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({ title: 'Oddsify booking code', text: `Booking code ${code} on Oddsify`, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(shareUrl);
            }
            onShare?.(code);
          }}>
            Share Bet
          </button>
          <button type="button" className="bv-success-btn bv-success-btn-ghost" onClick={() => { onRebook?.(); onClose?.(); }}>
            Rebook
          </button>
          <button type="button" className="bv-success-btn bv-success-btn-ghost" onClick={() => { onReturn?.(); onClose?.(); }}>
            Sports
          </button>
        </div>
      </div>

      <style>{SUCCESS_CSS}</style>
    </dialog>
  );
}

function TrophyIcon() {
  return (
    <div className="bv-success-disc">
      <svg viewBox="0 0 72 72" width="48" height="48" aria-hidden>
        <defs>
          <linearGradient id="sCupBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3b8" />
            <stop offset=".5" stopColor="#f3a01a" />
            <stop offset="1" stopColor="#a86200" />
          </linearGradient>
          <linearGradient id="sCupBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#994d00" />
            <stop offset="1" stopColor="#4d2600" />
          </linearGradient>
          <radialGradient id="sCupGlow" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffd76d" stopOpacity=".45" />
            <stop offset="100%" stopColor="#ffd76d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="36" cy="36" r="30" fill="url(#sCupGlow)" opacity=".6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <path d="M16 14 H56 V36 C56 48 48 54 36 54 C24 54 16 48 16 36 Z" fill="url(#sCupBody)">
          <animateTransform attributeName="transform" type="scale" values="1;1.04;1" dur="1.6s" repeatCount="indefinite" additive="sum" />
        </path>
        <ellipse cx="36" cy="14" rx="20" ry="4" fill="#ffe28a" />
        <path d="M16 22 Q7 22 8 28 Q9 34 18 34" fill="none" stroke="#cc7a00" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M56 22 Q65 22 64 28 Q63 34 54 34" fill="none" stroke="#cc7a00" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M32 54 H40 V60 H32 Z" fill="url(#sCupBase)" />
        <path d="M25 60 H47 V63 H25 Z" fill="url(#sCupBase)" />
        <circle cx="36" cy="32" r="7" fill="#fff3b8" opacity=".7" />
        <path d="M36 27 l1.8 3.6 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6 z" fill="#a86200" />
      </svg>
    </div>
  );
}

function Confetti({ count = 36 }) {
  const pieces = Array.from({ length: count }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 2.6 + Math.random() * 2.4,
    rot: Math.random() * 360,
    c: ['#ffd76d', '#ffb800', '#ffd54f', '#d4a857', '#ffcc33', '#ff9f1c', '#f7c948', '#ffe28a'][i % 8],
    key: i,
    w: 5 + Math.random() * 5,
    h: 8 + Math.random() * 10,
    tx: -40 + Math.random() * 80,
  }));
  return (
    <div className="bv-success-confetti" aria-hidden>
      {pieces.map((p) => (
        <span key={p.key} style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          background: p.c,
          width: p.w,
          height: p.h,
          transform: `rotate(${p.rot}deg)`,
          '--tx': `${p.tx}px`,
        }} />
      ))}
    </div>
  );
}

function Particles({ count = 16 }) {
  const particles = Array.from({ length: count }).map((_, i) => ({
    left: 30 + Math.random() * 40,
    delay: Math.random() * 1.5,
    dur: 1.2 + Math.random() * 1.2,
    size: 2 + Math.random() * 4,
    c: ['#ffd76d', '#ffc44d', '#fff3b8', '#f3a01a'][i % 4],
    key: i,
  }));
  return (
    <div className="bv-success-particles" aria-hidden>
      {particles.map((p) => (
        <span key={p.key} style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          width: p.size,
          height: p.size,
          background: p.c,
        }} />
      ))}
    </div>
  );
}

function Sparkles({ count = 8 }) {
  const sparkles = Array.from({ length: count }).map((_, i) => ({
    top: 10 + Math.random() * 60,
    left: 10 + Math.random() * 80,
    delay: Math.random() * 2,
    dur: 0.8 + Math.random() * 1,
    size: 2 + Math.random() * 3,
    key: i,
  }));
  return (
    <div className="bv-success-sparkles" aria-hidden>
      {sparkles.map((s) => (
        <span key={s.key} style={{
          top: `${s.top}%`,
          left: `${s.left}%`,
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.dur}s`,
          width: s.size,
          height: s.size,
        }}>
          <svg viewBox="0 0 24 24" width={s.size * 4} height={s.size * 4}>
            <path d="M12 0l1.5 9 7.5-3-5 7 7 5-9-1.5L12 24l-1.5-9L3 18l5-7-7-5 9 1.5z" fill="#ffd76d" />
          </svg>
        </span>
      ))}
    </div>
  );
}

const SUCCESS_CSS = `
.bv-success {
  border: none; padding: 0; background: transparent;
  width: min(440px, 94vw);
  border-radius: 24px;
  color: #ffffff;
  overflow: visible;
}
.bv-success::backdrop {
  background: radial-gradient(900px 700px at 50% 30%, rgba(8, 60, 42, .6), rgba(0, 0, 0, .85));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.bv-success-card {
  position: relative; z-index: 2;
  background:
    radial-gradient(700px 280px at 80% -10%, rgba(255, 200, 80, .16), transparent 60%),
    linear-gradient(180deg, #0d2c1d 0%, #0a2418 100%);
  border-radius: 24px;
  padding: 24px 24px 22px;
  box-shadow:
    0 32px 96px rgba(0, 0, 0, .6),
    0 0 0 1px rgba(255, 200, 80, .2) inset,
    0 0 60px rgba(255, 200, 80, .08);
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  animation: bvSuccessPop .45s cubic-bezier(.18, .88, .36, 1.2);
  text-align: center;
}
@keyframes bvSuccessPop {
  from { transform: scale(.85) translateY(12px); opacity: 0; }
  to   { transform: scale(1)  translateY(0);   opacity: 1; }
}

.bv-success-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 6px;
}
.bv-success-badge {
  font-size: 10px; letter-spacing: .2em; font-weight: 800;
  color: #ffe28a;
  background: rgba(255, 200, 80, .1);
  border: 1px solid rgba(255, 200, 80, .35);
  padding: 5px 12px; border-radius: 999px;
}
.bv-success-x {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .14);
  background: transparent;
  color: rgba(255, 255, 255, .65);
  cursor: pointer;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s, background .15s;
}
.bv-success-x:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }

.bv-success-emblem {
  display: flex; justify-content: center; margin: 8px 0 2px;
  animation: bvSuccessBounce 2.8s ease-in-out infinite;
  position: relative; z-index: 3;
}
@keyframes bvSuccessBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
.bv-success-glow {
  position: absolute; top: 50px; left: 50%; transform: translateX(-50%);
  width: 100px; height: 100px;
  background: radial-gradient(circle, rgba(255, 200, 80, .25) 0%, transparent 70%);
  pointer-events: none;
  animation: bvSuccessGlow 2s ease-in-out infinite;
}
@keyframes bvSuccessGlow {
  0%, 100% { opacity: .5; transform: translateX(-50%) scale(1); }
  50%      { opacity: 1; transform: translateX(-50%) scale(1.3); }
}
.bv-success-disc {
  width: 72px; height: 72px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffd76d 0%, #f3a01a 60%, #b06700 100%);
  display: grid; place-items: center;
  box-shadow:
    0 16px 48px rgba(255, 180, 50, .4),
    0 0 0 4px rgba(255, 200, 80, .2),
    0 0 80px rgba(255, 180, 50, .15);
}

.bv-success-title {
  margin: 14px 0 4px;
  font-size: 26px; font-weight: 900;
  letter-spacing: -.015em;
  color: #ffffff;
}
.bv-success-sub {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, .7);
}

.bv-success-amount {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  margin: 4px 0 4px;
  font-variant-numeric: tabular-nums;
}
.bv-success-amount .cur {
  font-size: 14px; font-weight: 700;
  color: rgba(255, 200, 80, .6);
  letter-spacing: .08em;
}
.bv-success-amount .amt {
  font-size: 38px; font-weight: 900;
  letter-spacing: -.025em;
  color: #ffc44d;
  text-shadow: 0 6px 28px rgba(255, 180, 50, .4);
}
.bv-success-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, .55);
  margin-bottom: 18px;
}

.bv-success-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 18px;
}
.bv-success-stat {
  background: rgba(255, 255, 255, .04);
  border: 1px solid rgba(255, 255, 255, .06);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 3px;
  text-align: left;
}
.bv-success-stat .lbl {
  font-size: 9px; letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .42);
}
.bv-success-stat .val {
  font-size: 14px; font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}
.bv-success-stat .val-mono {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  letter-spacing: .06em;
  color: #ffe28a;
  font-size: 13px;
}
.bv-success-stat .val-id {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  color: rgba(255, 255, 255, .6);
  font-size: 12px;
}

.bv-success-actions {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.bv-success-btn {
  padding: 11px 12px;
  border-radius: 12px;
  border: none;
  font-weight: 700; font-size: 12.5px;
  letter-spacing: .02em;
  cursor: pointer;
  transition: transform .12s, box-shadow .15s, background .15s;
}
.bv-success-btn:active { transform: scale(.97); }
.bv-success-btn-primary {
  background: linear-gradient(135deg, #ffc44d 0%, #f6a200 100%);
  color: #2a1700;
  box-shadow: 0 10px 24px rgba(246, 162, 0, .35);
  grid-column: 1 / -1;
}
.bv-success-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(246, 162, 0, .5);
}
.bv-success-btn-ghost {
  background: rgba(255, 255, 255, .06);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, .12);
}
.bv-success-btn-ghost:hover {
  background: rgba(255, 255, 255, .1);
  border-color: rgba(255, 255, 255, .22);
}

/* confetti */
.bv-success-confetti {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  overflow: hidden;
}
.bv-success-confetti span {
  position: absolute;
  top: -16px;
  border-radius: 2px;
  opacity: .92;
  animation: bvSuccessFall linear infinite;
}
@keyframes bvSuccessFall {
  0%   { transform: translate(0, -20px) rotate(0); opacity: 0; }
  8%   { opacity: .95; }
  100% { transform: translate(var(--tx, 20px), 110vh) rotate(720deg); opacity: 0; }
}

/* particles */
.bv-success-particles {
  position: absolute; inset: 0; pointer-events: none; z-index: 1;
  overflow: hidden;
}
.bv-success-particles span {
  position: absolute;
  bottom: 40%;
  border-radius: 50%;
  animation: bvSuccessRise ease-out forwards;
}
@keyframes bvSuccessRise {
  0%   { transform: translateY(0) scale(1); opacity: .8; }
  100% { transform: translateY(-120px) scale(0); opacity: 0; }
}

/* sparkles */
.bv-success-sparkles {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
}
.bv-success-sparkles span {
  position: absolute;
  animation: bvSuccessSparkle ease-in-out infinite;
}
@keyframes bvSuccessSparkle {
  0%, 100% { opacity: 0; transform: scale(.5) rotate(0); }
  30%      { opacity: 1; transform: scale(1.2) rotate(180deg); }
  60%      { opacity: .6; transform: scale(.8) rotate(360deg); }
  100%     { opacity: 0; transform: scale(.5) rotate(540deg); }
}

@media (max-width: 380px) {
  .bv-success-card { padding: 20px 18px 18px; }
  .bv-success-title { font-size: 22px; }
  .bv-success-amount .amt { font-size: 32px; }
  .bv-success-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
  .bv-success-stat { padding: 8px 10px; }
  .bv-success-stat .val { font-size: 13px; }
}
`;
