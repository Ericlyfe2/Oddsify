import { useEffect, useRef, useState } from 'react';

export function toBookingCode(id = '') {
  const s = String(id).replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!s) return 'XX00000';
  const letters = (s.match(/[A-Z]/g) || ['X', 'X']).slice(0, 2).join('').padEnd(2, 'X');
  const digits = (s.match(/[0-9]/g) || ['0']).slice(-5).join('').padStart(5, '0');
  return letters + digits;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BetSuccessOverlay({ bet, onClose, onViewBet, onGoHistory, onCopy, onShare, onRebook, onReturn }) {
  const [canClose, setCanClose] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (!bet) return;
    requestAnimationFrame(() => setVisible(true));
    setCanClose(false);
    timerRef.current = setTimeout(() => setCanClose(true), 2200);
    return () => clearTimeout(timerRef.current);
  }, [bet]);

  const handleClose = () => {
    if (!canClose) return;
    setExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onClose?.();
    }, 300);
    return () => clearTimeout(exitTimerRef.current);
  };

  if (!bet) return null;
  const code = bet.bookingCode || toBookingCode(bet.id);
  const ts = bet.placedAt
    ? new Date(bet.placedAt).toLocaleString('en-GH', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/code/${code}` : `/code/${code}`;

  return (
    <div
      className={`bso-overlay ${visible ? 'bso-visible' : ''} ${exiting ? 'bso-exiting' : ''}`}
      onClick={handleClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bso-title"
    >
      <div className="bso-bg" />

      <div className="bso-confetti-layer" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="bso-confetti-piece"
            style={{
              '--x': `${Math.random() * 100}%`,
              '--d': `${Math.random() * 1.5}s`,
              '--r': `${Math.random() * 720}deg`,
              '--c': ['#4ade80', '#22c55e', '#16a34a', '#ffd76d', '#ffb800', '#fff'][i % 6],
              '--w': `${5 + Math.random() * 6}px`,
              '--h': `${8 + Math.random() * 10}px`,
              '--tx': `${-40 + Math.random() * 80}px`,
            }}
          />
        ))}
      </div>

      <div className="bso-particle-layer" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="bso-particle"
            style={{
              '--x': `${20 + Math.random() * 60}%`,
              '--d': `${Math.random() * 2}s`,
              '--s': `${3 + Math.random() * 5}px`,
              '--c': ['#4ade80', '#22c55e', '#86efac', '#bbf7d0'][i % 4],
            }}
          />
        ))}
      </div>

      <div className="bso-sparkle-layer" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="bso-sparkle"
            style={{
              '--y': `${10 + Math.random() * 80}%`,
              '--x': `${10 + Math.random() * 80}%`,
              '--d': `${Math.random() * 2.5}s`,
              '--s': `${2 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      <div className="bso-card" onClick={(e) => e.stopPropagation()}>
        <div className="bso-checkmark-circle" aria-hidden>
          <svg viewBox="0 0 120 120" className="bso-checkmark-svg">
            <circle cx="60" cy="60" r="52" className="bso-checkmark-ring" />
            <path d="M38 62l14 14 30-32" className="bso-checkmark-path" />
          </svg>
        </div>

        <div className="bso-glow-ring" aria-hidden />

        <h2 id="bso-title" className="bso-title">Congratulations!</h2>
        <p className="bso-sub">Your Bet Has Been Successfully Placed</p>

        <div className="bso-amount">
          <span className="bso-cur">GHS</span>
          <span className="bso-amt">{fmt(bet.stake)}</span>
        </div>

        <div className="bso-odds-row">
          {bet.totalOdds ? `${bet.totalOdds.toFixed(2)}x` : ''} odds &middot; {bet.mode || 'single'} &middot; {bet.legs?.length || 1} selection{(bet.legs?.length || 1) > 1 ? 's' : ''}
        </div>

        <div className="bso-details">
          <div className="bso-stat">
            <span className="bso-lbl">Bet ID</span>
            <span className="bso-val bso-val-id">{bet.id?.slice(-8) || '—'}</span>
          </div>
          <div className="bso-stat">
            <span className="bso-lbl">Booking Code</span>
            <span className="bso-val bso-val-code">{code}</span>
          </div>
          <div className="bso-stat">
            <span className="bso-lbl">Total Odds</span>
            <span className="bso-val">{bet.totalOdds?.toFixed(2) || '—'}x</span>
          </div>
          <div className="bso-stat">
            <span className="bso-lbl">Pot. Winnings</span>
            <span className="bso-val bso-val-win">GHS {fmt(bet.potentialWin)}</span>
          </div>
          <div className="bso-stat">
            <span className="bso-lbl">Placed At</span>
            <span className="bso-val">{ts}</span>
          </div>
        </div>

        <div className="bso-actions">
          <button type="button" className="bso-btn bso-btn-primary" onClick={() => { onViewBet?.(); handleClose(); }}>
            View Bet
          </button>
          <button type="button" className="bso-btn bso-btn-ghost" onClick={() => { onGoHistory?.(); handleClose(); }}>
            Bet History
          </button>
          <button type="button" className="bso-btn bso-btn-ghost" onClick={() => onCopy?.(code)}>
            Copy Code
          </button>
          <button type="button" className="bso-btn bso-btn-ghost" onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({ title: 'Oddsify booking code', text: `Booking code ${code} on Oddsify`, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(shareUrl);
            }
            onShare?.(code);
          }}>
            Share Bet
          </button>
          <button type="button" className="bso-btn bso-btn-ghost" onClick={() => { onRebook?.(); handleClose(); }}>
            Rebook
          </button>
          <button type="button" className="bso-btn bso-btn-ghost" onClick={() => { onReturn?.(); handleClose(); }}>
            Sports
          </button>
        </div>

        {!canClose && <div className="bso-countdown" />}
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
@keyframes bsoFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes bsoFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes bsoCardIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes bsoCardOut { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.85) translateY(20px); opacity: 0; } }
@keyframes bsoCheckIn { 0% { stroke-dashoffset: 330; opacity: 0; } 30% { opacity: 1; } 100% { stroke-dashoffset: 0; } }
@keyframes bsoRingIn { 0% { stroke-dashoffset: 340; } 100% { stroke-dashoffset: 0; } }
@keyframes bsoGlowPulse { 0%, 100% { opacity: 0.3; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%,-50%) scale(1.15); } }
@keyframes bsoFall { 0% { transform: translate(0, -20px) rotate(0); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(var(--tx,20px), 110vh) rotate(720deg); opacity: 0; } }
@keyframes bsoRise { 0% { transform: translateY(0) scale(1); opacity: 0.8; } 100% { transform: translateY(-120px) scale(0); opacity: 0; } }
@keyframes bsoSparkleAnim { 0%, 100% { opacity: 0; transform: scale(0.3) rotate(0); } 30% { opacity: 1; transform: scale(1.2) rotate(180deg); } 60% { opacity: 0.6; transform: scale(0.8) rotate(360deg); } 100% { opacity: 0; transform: scale(0.3) rotate(540deg); } }
@keyframes bsoCountdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes bsoTitleIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bsoSubIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bsoDetailsIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bsoActionsIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.bso-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s ease;
  padding: 16px;
  overflow: hidden;
}
.bso-overlay.bso-visible { opacity: 1; pointer-events: auto; }
.bso-overlay.bso-exiting { opacity: 0; }

.bso-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 40%, rgba(5, 46, 22, 0.92), rgba(0, 0, 0, 0.95));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.bso-confetti-layer {
  position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden;
}
.bso-confetti-piece {
  position: absolute; top: -16px; left: var(--x);
  width: var(--w); height: var(--h);
  border-radius: 2px;
  background: var(--c);
  animation: bsoFall linear var(--d) both;
  animation-duration: 2.8s;
  transform: rotate(var(--r));
}

.bso-particle-layer {
  position: absolute; inset: 0; pointer-events: none; z-index: 1;
}
.bso-particle {
  position: absolute; bottom: 40%; left: var(--x);
  width: var(--s); height: var(--s);
  border-radius: 50%;
  background: var(--c);
  animation: bsoRise 1.5s ease-out var(--d) both;
}

.bso-sparkle-layer {
  position: absolute; inset: 0; pointer-events: none; z-index: 1;
}
.bso-sparkle {
  position: absolute; top: var(--y); left: var(--x);
  width: var(--s); height: var(--s);
  animation: bsoSparkleAnim 2s ease-in-out var(--d) infinite;
}
.bso-sparkle::after {
  content: ''; display: block; width: 100%; height: 100%;
  background: #ffd76d;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}

.bso-card {
  position: relative; z-index: 2;
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(500px 200px at 80% -10%, rgba(74, 222, 128, 0.12), transparent 60%),
    linear-gradient(180deg, #052e16 0%, #022008 100%);
  border-radius: 24px;
  padding: 32px 24px 24px;
  box-shadow: 0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(74,222,128,0.15) inset;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  text-align: center;
  animation: bsoCardIn 0.5s cubic-bezier(0.18, 0.88, 0.36, 1.2) both;
  color: #fff;
  scrollbar-width: thin;
}
.bso-exiting .bso-card {
  animation: bsoCardOut 0.3s ease both;
}

.bso-checkmark-circle {
  width: 100px; height: 100px;
  margin: 0 auto 4px;
  position: relative;
}
.bso-checkmark-svg {
  width: 100%; height: 100%;
  display: block;
}
.bso-checkmark-ring {
  fill: none;
  stroke: #4ade80;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 340;
  animation: bsoRingIn 0.7s ease-out 0.1s both;
  transform-origin: center;
  transform: rotate(-90deg);
}
.bso-checkmark-path {
  fill: none;
  stroke: #4ade80;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 120;
  stroke-dashoffset: 120;
  animation: bsoCheckIn 0.5s ease-out 0.5s both;
}

.bso-glow-ring {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 140px; height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%);
  pointer-events: none;
  animation: bsoGlowPulse 2.5s ease-in-out infinite;
}

.bso-title {
  margin: 12px 0 4px;
  font-size: 28px; font-weight: 900;
  letter-spacing: -0.015em;
  animation: bsoTitleIn 0.4s ease 0.6s both;
}
.bso-sub {
  margin: 0 0 14px;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  animation: bsoSubIn 0.4s ease 0.7s both;
}

.bso-amount {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  font-variant-numeric: tabular-nums;
  margin: 4px 0 4px;
  animation: bsoTitleIn 0.4s ease 0.8s both;
}
.bso-amount .bso-cur {
  font-size: 14px; font-weight: 700;
  color: rgba(74,222,128,0.6);
  letter-spacing: 0.08em;
}
.bso-amount .bso-amt {
  font-size: 42px; font-weight: 900;
  letter-spacing: -0.025em;
  color: #4ade80;
  text-shadow: 0 6px 28px rgba(74,222,128,0.35);
}
.bso-odds-row {
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  margin-bottom: 16px;
  animation: bsoSubIn 0.4s ease 0.9s both;
}

.bso-details {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 18px;
  animation: bsoDetailsIn 0.4s ease 1s both;
}
.bso-stat {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 3px;
  text-align: left;
}
.bso-stat .bso-lbl {
  font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
}
.bso-stat .bso-val {
  font-size: 14px; font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.bso-stat .bso-val-code {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  letter-spacing: 0.06em;
  color: #4ade80;
  font-size: 13px;
}
.bso-stat .bso-val-id {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  color: rgba(255,255,255,0.6);
  font-size: 12px;
}
.bso-stat .bso-val-win {
  color: #4ade80;
}

.bso-actions {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  animation: bsoActionsIn 0.4s ease 1.1s both;
}
.bso-btn {
  padding: 11px 12px;
  border-radius: 12px;
  border: none;
  font-weight: 700; font-size: 12.5px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.15s, background 0.15s;
  font-family: inherit;
}
.bso-btn:active { transform: scale(0.97); }
.bso-btn-primary {
  background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%);
  color: #052e16;
  box-shadow: 0 10px 24px rgba(22,163,74,0.35);
  grid-column: 1 / -1;
}
.bso-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(22,163,74,0.5);
}
.bso-btn-ghost {
  background: rgba(255,255,255,0.06);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.12);
}
.bso-btn-ghost:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.22);
}

.bso-countdown {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #4ade80, #22c55e);
  transform-origin: left;
  animation: bsoCountdown 2.2s linear both;
  border-radius: 0 0 24px 24px;
}

@media (max-width: 380px) {
  .bso-card { padding: 24px 18px 20px; }
  .bso-title { font-size: 24px; }
  .bso-amount .bso-amt { font-size: 34px; }
  .bso-checkmark-circle { width: 80px; height: 80px; }
  .bso-details { grid-template-columns: 1fr 1fr; gap: 6px; }
  .bso-stat { padding: 8px 10px; }
  .bso-stat .bso-val { font-size: 13px; }
}
@media (min-width: 768px) {
  .bso-card { width: min(480px, 90vw); padding: 40px 32px 28px; }
  .bso-title { font-size: 32px; }
  .bso-amount .bso-amt { font-size: 48px; }
  .bso-checkmark-circle { width: 120px; height: 120px; }
}
`;
