import { useEffect, useRef, useState } from 'react';
import { fmtCedi } from './odd/tokens.jsx';

export default function CashoutSuccessOverlay({ bet, cashoutAmount, open, onClose, onViewBets }) {
  const [canClose, setCanClose] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => setVisible(true));
    setCanClose(false);
    timerRef.current = setTimeout(() => setCanClose(true), 2500);
    return () => clearTimeout(timerRef.current);
  }, [open]);

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

  if (!open || !bet) return null;

  const stake = Number(bet.stake || 0);
  const profit = Number((cashoutAmount - stake).toFixed(2));
  const isProfit = profit >= 0;
  const ts = bet.cashOutAt
    ? new Date(bet.cashOutAt).toLocaleString('en-GH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-GH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div
      className={`cso-overlay ${visible ? 'cso-visible' : ''} ${exiting ? 'cso-exiting' : ''}`}
      onClick={handleClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cso-title"
    >
      <div className="cso-bg" />

      <div className="cso-confetti-layer" aria-hidden>
        {Array.from({ length: 50 }).map((_, i) => (
          <span
            key={i}
            className="cso-confetti-piece"
            style={{
              '--x': `${Math.random() * 100}%`,
              '--d': `${Math.random() * 1.6}s`,
              '--r': `${Math.random() * 360}deg`,
              '--c': ['#4ade80', '#22c55e', '#16a34a', '#ffd76d', '#ffb800', '#86efac', '#bbf7d0'][i % 7],
              '--w': `${5 + Math.random() * 6}px`,
              '--h': `${8 + Math.random() * 12}px`,
              '--tx': `${-40 + Math.random() * 80}px`,
            }}
          />
        ))}
      </div>

      <div className="cso-particle-layer" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="cso-particle"
            style={{
              '--x': `${20 + Math.random() * 60}%`,
              '--d': `${Math.random() * 2}s`,
              '--s': `${3 + Math.random() * 5}px`,
              '--c': ['#4ade80', '#22c55e', '#86efac'][i % 3],
            }}
          />
        ))}
      </div>

      <div className="cso-card" onClick={(e) => e.stopPropagation()}>
        <header className="cso-head">
          <span className="cso-badge">CASHOUT SUCCESSFUL</span>
          {canClose && (
            <button type="button" className="cso-x" onClick={handleClose} aria-label="Close">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>

        <div className="cso-emblem" aria-hidden>
          <TrophyBadge isProfit={isProfit} />
        </div>

        <div className="cso-glow" aria-hidden />

        <h2 id="cso-title" className="cso-title">
          Cashout Successful!
        </h2>
        <p className="cso-sub">Your cash-out has been credited to your wallet.</p>

        <div className="cso-amount">
          <span className="cso-cur">GHS</span>
          <span className="cso-amt">{fmtCedi(cashoutAmount)}</span>
        </div>

        <div className="cso-profit-row">
          <span className="cso-profit-label">Profit / Loss</span>
          <span className="cso-profit-val" style={{ color: isProfit ? '#4ade80' : '#ff5b78' }}>
            {isProfit ? '+' : ''}GHS {fmtCedi(Math.abs(profit))} {isProfit ? 'profit' : 'loss'}
          </span>
        </div>

        <div className="cso-grid">
          <div className="cso-stat">
            <span className="cso-lbl">Transaction ID</span>
            <span className="cso-val cso-val-mono">{bet.id?.slice(-8) || '—'}</span>
          </div>
          <div className="cso-stat">
            <span className="cso-lbl">Original Stake</span>
            <span className="cso-val">GHS {fmtCedi(stake)}</span>
          </div>
          <div className="cso-stat">
            <span className="cso-lbl">Booking Code</span>
            <span className="cso-val cso-val-mono">{bet.bookingCode || '—'}</span>
          </div>
          <div className="cso-stat">
            <span className="cso-lbl">Completed At</span>
            <span className="cso-val">{ts}</span>
          </div>
        </div>

        <div className="cso-actions">
          <button
            type="button"
            className="cso-btn cso-btn-primary"
            onClick={() => {
              onViewBets?.();
              handleClose();
            }}
          >
            View My Bets
          </button>
          <button type="button" className="cso-btn cso-btn-ghost" onClick={handleClose}>
            Awesome
          </button>
        </div>

        {!canClose && <div className="cso-countdown" />}
      </div>

      <style>{CSO_CSS}</style>
    </div>
  );
}

function TrophyBadge({ isProfit }) {
  const color = isProfit ? '#4ade80' : '#ffd76d';
  const bgGrad = isProfit
    ? 'radial-gradient(circle at 35% 30%, #4ade80 0%, #16a34a 60%, #14532d 100%)'
    : 'radial-gradient(circle at 35% 30%, #ffd76d 0%, #f3a01a 60%, #b06700 100%)';
  return (
    <div className="cso-disc" style={{ background: bgGrad }}>
      <svg viewBox="0 0 64 64" width="42" height="42" aria-hidden>
        <defs>
          <linearGradient id="csoCup" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3b8" />
            <stop offset=".55" stopColor="#f3a01a" />
            <stop offset="1" stopColor="#a86200" />
          </linearGradient>
        </defs>
        <path d="M14 12 H50 V30 C50 40 42 46 32 46 C22 46 14 40 14 30 Z" fill="url(#csoCup)" />
        <ellipse cx="32" cy="12" rx="18" ry="3.6" fill="#ffe28a" />
        <path d="M14 18 Q7 18 8 24 Q9 30 16 30" fill="none" stroke="#cc7a00" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 18 Q57 18 56 24 Q55 30 48 30" fill="none" stroke="#cc7a00" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 46 H36 V52 H28 Z" fill="#7a3f00" />
        <path d="M22 52 H42 V55 H22 Z" fill="#3a1f00" />
        <circle cx="32" cy="26" r="6" fill="#fff3b8" opacity=".75" />
        <path
          d="M32 22 l1.6 3.2 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5 z"
          fill="#a86200"
        />
      </svg>
    </div>
  );
}

const CSO_CSS = `
@keyframes csoFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes csoFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes csoCardIn { from { transform: scale(.88) translateY(14px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes csoCardOut { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(.88) translateY(14px); opacity: 0; } }
@keyframes csoBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes csoGlow { 0%, 100% { opacity: .4; transform: translate(-50%,-50%) scale(1); } 50% { opacity: .9; transform: translate(-50%,-50%) scale(1.2); } }
@keyframes csoFall { 0% { transform: translate(0,-20px) rotate(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(var(--tx,20px),110vh) rotate(720deg); opacity: 0; } }
@keyframes csoRise { 0% { transform: translateY(0) scale(1); opacity: .8; } 100% { transform: translateY(-120px) scale(0); opacity: 0; } }
@keyframes csoCountdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }

.cso-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity .3s ease;
  padding: 16px;
  overflow: hidden;
}
.cso-overlay.cso-visible { opacity: 1; pointer-events: auto; }
.cso-overlay.cso-exiting { opacity: 0; }

.cso-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 40%, rgba(5,46,22,.92), rgba(0,0,0,.95));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.cso-confetti-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
.cso-confetti-piece { position: absolute; top: -16px; left: var(--x); width: var(--w); height: var(--h); border-radius: 2px; background: var(--c); animation: csoFall linear var(--d) both; animation-duration: 2.8s; transform: rotate(var(--r)); }

.cso-particle-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.cso-particle { position: absolute; bottom: 40%; left: var(--x); width: var(--s); height: var(--s); border-radius: 50%; background: var(--c); animation: csoRise 1.5s ease-out var(--d) both; }

.cso-card {
  position: relative; z-index: 2;
  width: min(420px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(500px 200px at 80% -10%, rgba(74,222,128,.12), transparent 60%),
    linear-gradient(180deg, #052e16 0%, #022008 100%);
  border-radius: 24px;
  padding: 28px 24px 22px;
  box-shadow: 0 32px 96px rgba(0,0,0,.6), 0 0 0 1px rgba(74,222,128,.15) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  text-align: center;
  animation: csoCardIn .45s cubic-bezier(.18,.88,.36,1.2) both;
  color: #fff;
  scrollbar-width: thin;
}
.cso-exiting .cso-card { animation: csoCardOut .3s ease both; }

.cso-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.cso-badge { font-size: 10px; letter-spacing: .18em; font-weight: 800; color: #4ade80; background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.35); padding: 5px 10px; border-radius: 999px; }
.cso-x { width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,.14); background: transparent; color: rgba(255,255,255,.65); cursor: pointer; display: grid; place-items: center; transition: color .15s, border-color .15s; }
.cso-x:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }

.cso-emblem { display: flex; justify-content: center; margin: 8px 0 4px; animation: csoBounce 2.6s ease-in-out infinite; }
.cso-glow {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 120px; height: 120px;
  background: radial-gradient(circle, rgba(74,222,128,.15) 0%, transparent 70%);
  pointer-events: none;
  animation: csoGlow 2s ease-in-out infinite;
}
.cso-disc { width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 14px 36px rgba(74,222,128,.3), 0 0 0 4px rgba(74,222,128,.18); }

.cso-title { margin: 10px 0 4px; font-size: 26px; font-weight: 900; letter-spacing: -.01em; }
.cso-sub { margin: 0 0 14px; font-size: 13px; color: rgba(255,255,255,.72); }

.cso-amount { display: flex; align-items: baseline; justify-content: center; gap: 8px; font-variant-numeric: tabular-nums; margin: 4px 0 4px; }
.cso-amount .cso-cur { font-size: 14px; font-weight: 700; color: rgba(74,222,128,.6); letter-spacing: .08em; }
.cso-amount .cso-amt { font-size: 40px; font-weight: 900; letter-spacing: -.025em; color: #4ade80; text-shadow: 0 6px 24px rgba(74,222,128,.35); }

.cso-profit-row { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 14px; margin: 6px auto 12px; width: fit-content; background: rgba(255,255,255,.04); border-radius: 999px; }
.cso-profit-label { font-size: 11px; color: rgba(255,255,255,.5); }
.cso-profit-val { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }

.cso-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
.cso-stat { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.cso-stat .cso-lbl { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.42); }
.cso-stat .cso-val { font-size: 14px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.cso-stat .cso-val-mono { font-family: 'JetBrains Mono','Roboto Mono',monospace; letter-spacing: .04em; color: rgba(255,255,255,.65); }

.cso-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cso-btn { padding: 12px 16px; border-radius: 12px; border: none; font-weight: 800; font-size: 13px; cursor: pointer; transition: transform .12s, box-shadow .15s, background .15s; font-family: inherit; }
.cso-btn:active { transform: scale(.97); }
.cso-btn-primary { background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%); color: #052e16; box-shadow: 0 10px 24px rgba(22,163,74,.35); }
.cso-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(22,163,74,.5); }
.cso-btn-ghost { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.14); }
.cso-btn-ghost:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.25); }

.cso-countdown { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #4ade80, #16a34a); transform-origin: left; animation: csoCountdown 2.5s linear both; border-radius: 0 0 24px 24px; }

@media (max-width: 380px) {
  .cso-card { padding: 22px 16px 18px; }
  .cso-title { font-size: 22px; }
  .cso-amount .cso-amt { font-size: 32px; }
  .cso-disc { width: 56px; height: 56px; }
  .cso-disc svg { width: 34px; height: 34px; }
}
@media (min-width: 768px) {
  .cso-card { width: min(460px, 90vw); padding: 32px 28px 26px; }
  .cso-title { font-size: 30px; }
  .cso-amount .cso-amt { font-size: 46px; }
}
`;
