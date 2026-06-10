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
              '--c': ['#f7c948', '#e8b94a', '#d4a72c', '#fff3b8', '#ffb800', '#b8860b', '#f3e9cf'][i % 7],
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
              '--c': ['#f7c948', '#e8b94a', '#fff3b8'][i % 3],
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
          <TrophyBadge />
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
          <span className="cso-profit-val" style={{ color: isProfit ? '#f7c948' : '#ff5b78' }}>
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

function TrophyBadge() {
  return (
    <div className="cso-disc">
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
@keyframes csoCardIn { 0% { transform: scale(.8) translateY(28px); opacity: 0; } 60% { transform: scale(1.03) translateY(-4px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes csoCardOut { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(.88) translateY(14px); opacity: 0; } }
@keyframes csoBounce { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
@keyframes csoGlow { 0%, 100% { opacity: .35; transform: translate(-50%,-50%) scale(1); } 50% { opacity: .85; transform: translate(-50%,-50%) scale(1.25); } }
@keyframes csoFall { 0% { transform: translate(0,-20px) rotate(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(var(--tx,20px),110vh) rotate(720deg); opacity: 0; } }
@keyframes csoRise { 0% { transform: translateY(0) scale(1); opacity: .8; } 100% { transform: translateY(-140px) scale(0); opacity: 0; } }
@keyframes csoCountdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes csoUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes csoTrophyPop { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 70% { transform: scale(1.15) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes csoRingPulse { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2); opacity: 0; } }
@keyframes csoShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes csoBorderGlow { 0%, 100% { box-shadow: 0 32px 96px rgba(0,0,0,.7), 0 0 0 1px rgba(232,185,74,.2) inset, 0 0 24px rgba(232,185,74,.05); } 50% { box-shadow: 0 32px 96px rgba(0,0,0,.7), 0 0 0 1px rgba(247,201,72,.45) inset, 0 0 48px rgba(232,185,74,.14); } }
@keyframes csoBtnGlow { 0%, 100% { box-shadow: 0 10px 24px rgba(232,185,74,.3); } 50% { box-shadow: 0 12px 36px rgba(247,201,72,.55); } }

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
  background: radial-gradient(ellipse at 50% 40%, rgba(26,19,0,.92), rgba(0,0,0,.96));
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
    radial-gradient(500px 200px at 80% -10%, rgba(232,185,74,.12), transparent 60%),
    linear-gradient(180deg, #161513 0%, #0a0a0a 100%);
  border-radius: 24px;
  padding: 28px 24px 22px;
  box-shadow: 0 32px 96px rgba(0,0,0,.7), 0 0 0 1px rgba(232,185,74,.2) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  text-align: center;
  animation: csoCardIn .55s cubic-bezier(.18,.88,.36,1.2) both, csoBorderGlow 3s ease-in-out 1s infinite;
  color: #f3e9cf;
  scrollbar-width: thin;
}
.cso-exiting .cso-card { animation: csoCardOut .3s ease both; }

.cso-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.cso-badge { font-size: 10px; letter-spacing: .18em; font-weight: 800; color: #f7c948; background: rgba(232,185,74,.1); border: 1px solid rgba(232,185,74,.35); padding: 5px 10px; border-radius: 999px; animation: csoUp .4s ease .15s both; }
.cso-x { width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,.14); background: transparent; color: rgba(255,255,255,.65); cursor: pointer; display: grid; place-items: center; transition: color .15s, border-color .15s; }
.cso-x:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }

.cso-emblem { display: flex; justify-content: center; margin: 8px 0 4px; animation: csoTrophyPop .6s cubic-bezier(.18,.88,.36,1.3) .2s both; }
.cso-glow {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 120px; height: 120px;
  background: radial-gradient(circle, rgba(232,185,74,.18) 0%, transparent 70%);
  pointer-events: none;
  animation: csoGlow 2s ease-in-out infinite;
}
.cso-disc { position: relative; width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #fff3b8 0%, #e8b94a 55%, #b8860b 100%); box-shadow: 0 14px 36px rgba(232,185,74,.35), 0 0 0 4px rgba(232,185,74,.18); animation: csoBounce 2.6s ease-in-out 1s infinite; }
.cso-disc::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid rgba(247,201,72,.5); opacity: 0; animation: csoRingPulse 2s ease-out .9s infinite; }

.cso-title { margin: 10px 0 4px; font-size: 26px; font-weight: 900; letter-spacing: -.01em; animation: csoUp .4s ease .35s both; }
.cso-sub { margin: 0 0 14px; font-size: 13px; color: rgba(243,233,207,.72); animation: csoUp .4s ease .45s both; }

.cso-amount { display: flex; align-items: baseline; justify-content: center; gap: 8px; font-variant-numeric: tabular-nums; margin: 4px 0 4px; animation: csoUp .4s ease .55s both; }
.cso-amount .cso-cur { font-size: 14px; font-weight: 700; color: rgba(247,201,72,.6); letter-spacing: .08em; }
.cso-amount .cso-amt { font-size: 40px; font-weight: 900; letter-spacing: -.025em; background: linear-gradient(110deg, #e8b94a 25%, #fff7d6 50%, #e8b94a 75%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: csoShimmer 2.8s linear 1.2s infinite; filter: drop-shadow(0 6px 24px rgba(232,185,74,.35)); }

.cso-profit-row { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 14px; margin: 6px auto 12px; width: fit-content; background: rgba(232,185,74,.06); border: 1px solid rgba(232,185,74,.12); border-radius: 999px; animation: csoUp .4s ease .65s both; }
.cso-profit-label { font-size: 11px; color: rgba(243,233,207,.5); }
.cso-profit-val { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }

.cso-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
.cso-stat { background: rgba(232,185,74,.05); border: 1px solid rgba(232,185,74,.1); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; text-align: left; animation: csoUp .4s ease both; }
.cso-stat:nth-child(1) { animation-delay: .7s; }
.cso-stat:nth-child(2) { animation-delay: .78s; }
.cso-stat:nth-child(3) { animation-delay: .86s; }
.cso-stat:nth-child(4) { animation-delay: .94s; }
.cso-stat .cso-lbl { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: rgba(243,233,207,.45); }
.cso-stat .cso-val { font-size: 14px; font-weight: 700; color: #f3e9cf; font-variant-numeric: tabular-nums; }
.cso-stat .cso-val-mono { font-family: 'JetBrains Mono','Roboto Mono',monospace; letter-spacing: .04em; color: rgba(243,233,207,.65); }

.cso-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; animation: csoUp .4s ease 1.05s both; }
.cso-btn { padding: 12px 16px; border-radius: 12px; border: none; font-weight: 800; font-size: 13px; cursor: pointer; transition: transform .12s, box-shadow .15s, background .15s; font-family: inherit; }
.cso-btn:active { transform: scale(.97); }
.cso-btn-primary { background: linear-gradient(135deg, #f7c948 0%, #d4a72c 100%); color: #1a1300; box-shadow: 0 10px 24px rgba(232,185,74,.3); animation: csoBtnGlow 2.4s ease-in-out 1.6s infinite; }
.cso-btn-primary:hover { transform: translateY(-1px); }
.cso-btn-ghost { background: rgba(232,185,74,.06); color: #f3e9cf; border: 1px solid rgba(232,185,74,.2); }
.cso-btn-ghost:hover { background: rgba(232,185,74,.12); border-color: rgba(232,185,74,.4); }

.cso-countdown { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #f7c948, #b8860b); transform-origin: left; animation: csoCountdown 2.5s linear both; border-radius: 0 0 24px 24px; }

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
