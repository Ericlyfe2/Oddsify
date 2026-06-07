import { useEffect, useRef, useState } from 'react';
import { fmtCedi } from './odd/tokens.jsx';

export default function CashoutSuccessModal({ bet, cashoutAmount, open, onClose, onViewBets }) {
  const dlgRef = useRef(null);
  const [canClose, setCanClose] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCanClose(false);
    closeTimerRef.current = setTimeout(() => setCanClose(true), 2500);
    return () => clearTimeout(closeTimerRef.current);
  }, [open]);

  useEffect(() => {
    if (!open || !dlgRef.current) return;
    dlgRef.current.showModal();
  }, [open]);

  if (!open || !bet) return null;

  const stake = Number(bet.stake || 0);
  const profit = Number((cashoutAmount - stake).toFixed(2));
  const isProfit = profit >= 0;
  const ts = bet.cashOutAt ? new Date(bet.cashOutAt).toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleClose = () => { if (canClose) onClose?.(); };

  return (
    <dialog ref={dlgRef} className="bv-cashout-success" onClose={onClose} onClick={handleClose}>
      <Confetti count={40} />
      <div className="bv-cashout-success-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="cso-title">
        <header className="bv-cashout-success-head">
          <span className="bv-cashout-success-badge">CASH-OUT CONFIRMED</span>
          {canClose && (
            <button type="button" className="bv-cashout-success-x" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </header>

        <div className="bv-cashout-success-emblem" aria-hidden>
          <CashIcon />
        </div>

        <div className="bv-cashout-success-glow" aria-hidden />

        <h2 id="cso-title" className="bv-cashout-success-title">Cash-out Successful!</h2>
        <p className="bv-cashout-success-sub">Your cash-out has been credited to your wallet.</p>

        <div className="bv-cashout-success-amount">
          <span className="cur">GHS</span>
          <span className="amt">{fmtCedi(cashoutAmount)}</span>
        </div>

        <div className="bv-cashout-success-meta">
          <span className={isProfit ? 'profit' : 'loss'}>
            {isProfit ? '+' : ''}GHS {fmtCedi(profit)} {isProfit ? 'profit' : 'loss'}
          </span>
          {' · '}GHS {fmtCedi(stake)} stake
        </div>

        <div className="bv-cashout-success-grid">
          <div className="bv-cashout-success-stat">
            <span className="lbl">Transaction ID</span>
            <span className="val val-mono">{bet.id?.slice(-8) || '—'}</span>
          </div>
          <div className="bv-cashout-success-stat">
            <span className="lbl">Completed At</span>
            <span className="val">{ts}</span>
          </div>
          <div className="bv-cashout-success-stat">
            <span className="lbl">Booking Code</span>
            <span className="val val-mono">{bet.bookingCode || '—'}</span>
          </div>
          <div className="bv-cashout-success-stat">
            <span className="lbl">Status</span>
            <span className="val" style={{ color: '#ffc44d' }}>Cashed Out</span>
          </div>
        </div>

        <div className="bv-cashout-success-actions">
          <button type="button" className="bv-cashout-success-btn bv-cashout-success-btn-primary" onClick={() => { onViewBets?.(); onClose?.(); }}>
            View My Bets
          </button>
          <button type="button" className="bv-cashout-success-btn bv-cashout-success-btn-ghost" onClick={onClose}>
            Awesome
          </button>
        </div>
      </div>

      <style>{CASHOUT_SUCCESS_CSS}</style>
    </dialog>
  );
}

function CashIcon() {
  return (
    <div className="bv-cashout-success-disc">
      <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden>
        <defs>
          <linearGradient id="csoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3b8" />
            <stop offset=".5" stopColor="#f3a01a" />
            <stop offset="1" stopColor="#a86200" />
          </linearGradient>
        </defs>
        <rect x="6" y="14" width="36" height="20" rx="4" fill="url(#csoGrad)" />
        <text x="24" y="28" textAnchor="middle" fill="#4d2600" fontSize="14" fontWeight="800" fontFamily="sans-serif">¢</text>
        <circle cx="24" cy="24" r="5" fill="none" stroke="#4d2600" strokeWidth="1.5" opacity=".5" />
        <path d="M12 14 V10 H36 V14" fill="none" stroke="url(#csoGrad)" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 14 C4 14 4 18 8 18" fill="none" stroke="#cc7a00" strokeWidth="1.5" />
        <path d="M40 14 C44 14 44 18 40 18" fill="none" stroke="#cc7a00" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function Confetti({ count = 32 }) {
  const pieces = Array.from({ length: count }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 2.4 + Math.random() * 2.4,
    rot: Math.random() * 360,
    c: ['#4ade80', '#22c55e', '#16a34a', '#ffd76d', '#ffb800', '#ffcc33'][i % 6],
    key: i,
    w: 5 + Math.random() * 5,
    h: 8 + Math.random() * 10,
    tx: -30 + Math.random() * 60,
  }));
  return (
    <div className="bv-cashout-success-confetti" aria-hidden>
      {pieces.map((p) => (
        <span key={p.key} style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          background: p.c,
          width: p.w, height: p.h,
          transform: `rotate(${p.rot}deg)`,
          '--tx': `${p.tx}px`,
        }} />
      ))}
    </div>
  );
}

const CASHOUT_SUCCESS_CSS = `
.bv-cashout-success {
  border: none; padding: 0; background: transparent;
  width: min(420px, 92vw);
  border-radius: 24px;
  color: #ffffff;
  overflow: visible;
}
.bv-cashout-success::backdrop {
  background: radial-gradient(800px 600px at 50% 30%, rgba(8,60,42,.55), rgba(0,0,0,.82));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.bv-cashout-success-card {
  position: relative; z-index: 2;
  background:
    radial-gradient(600px 220px at 80% -10%, rgba(255,200,80,.14), transparent 60%),
    linear-gradient(180deg, #0d2c1d 0%, #0a2418 100%);
  border-radius: 24px;
  padding: 24px 24px 20px;
  box-shadow: 0 32px 96px rgba(0,0,0,.6), 0 0 0 1px rgba(255,200,80,.18) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  animation: csoPop .42s cubic-bezier(.18,.88,.36,1.2);
  text-align: center;
}
@keyframes csoPop {
  from { transform: scale(.88) translateY(10px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}
.bv-cashout-success-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 6px;
}
.bv-cashout-success-badge {
  font-size: 10px; letter-spacing: .18em; font-weight: 800;
  color: #4ade80;
  background: rgba(74,222,128,.1);
  border: 1px solid rgba(74,222,128,.35);
  padding: 5px 10px; border-radius: 999px;
}
.bv-cashout-success-x {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.14);
  background: transparent;
  color: rgba(255,255,255,.65);
  cursor: pointer;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s;
}
.bv-cashout-success-x:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }
.bv-cashout-success-emblem {
  display: flex; justify-content: center; margin: 8px 0 2px;
  animation: csoBounce 2.6s ease-in-out infinite;
}
@keyframes csoBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.bv-cashout-success-glow {
  position: absolute; top: 52px; left: 50%; transform: translateX(-50%);
  width: 80px; height: 80px;
  background: radial-gradient(circle, rgba(74,222,128,.2) 0%, transparent 70%);
  pointer-events: none;
  animation: csoGlow 2s ease-in-out infinite;
}
@keyframes csoGlow {
  0%, 100% { opacity: .4; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.3); }
}
.bv-cashout-success-disc {
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #4ade80 0%, #16a34a 60%, #14532d 100%);
  display: grid; place-items: center;
  box-shadow: 0 14px 36px rgba(74,222,128,.3), 0 0 0 4px rgba(74,222,128,.18);
}
.bv-cashout-success-title {
  margin: 12px 0 4px;
  font-size: 24px; font-weight: 900;
  letter-spacing: -.01em;
  color: #ffffff;
}
.bv-cashout-success-sub {
  margin: 0 0 14px;
  font-size: 12.5px;
  color: rgba(255,255,255,.72);
}
.bv-cashout-success-amount {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  font-variant-numeric: tabular-nums;
  margin: 4px 0 4px;
}
.bv-cashout-success-amount .cur {
  font-size: 14px; font-weight: 700;
  color: rgba(74,222,128,.6);
  letter-spacing: .08em;
}
.bv-cashout-success-amount .amt {
  font-size: 36px; font-weight: 900;
  letter-spacing: -.025em;
  color: #4ade80;
  text-shadow: 0 6px 24px rgba(74,222,128,.35);
}
.bv-cashout-success-meta {
  font-size: 12px;
  margin-bottom: 18px;
}
.bv-cashout-success-meta .profit { color: #4ade80; font-weight: 700; }
.bv-cashout-success-meta .loss { color: #ff5b78; font-weight: 700; }
.bv-cashout-success-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 18px;
}
.bv-cashout-success-stat {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 3px;
  text-align: left;
}
.bv-cashout-success-stat .lbl {
  font-size: 9px; letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.42);
}
.bv-cashout-success-stat .val {
  font-size: 13px; font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}
.bv-cashout-success-stat .val-mono {
  font-family: 'JetBrains Mono','Roboto Mono',monospace;
  letter-spacing: .04em;
  color: rgba(255,255,255,.65);
}
.bv-cashout-success-actions {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bv-cashout-success-btn {
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  font-weight: 800; font-size: 13px;
  cursor: pointer;
  transition: transform .12s, box-shadow .15s, background .15s;
}
.bv-cashout-success-btn:active { transform: scale(.97); }
.bv-cashout-success-btn-primary {
  background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%);
  color: #052e16;
  box-shadow: 0 10px 24px rgba(22,163,74,.35);
}
.bv-cashout-success-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(22,163,74,.5);
}
.bv-cashout-success-btn-ghost {
  background: rgba(255,255,255,.06);
  color: #ffffff;
  border: 1px solid rgba(255,255,255,.14);
}
.bv-cashout-success-btn-ghost:hover {
  background: rgba(255,255,255,.1);
  border-color: rgba(255,255,255,.25);
}
.bv-cashout-success-confetti {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  overflow: hidden;
}
.bv-cashout-success-confetti span {
  position: absolute;
  top: -16px;
  border-radius: 2px;
  opacity: .92;
  animation: csoFall linear infinite;
}
@keyframes csoFall {
  0%   { transform: translate(0,-20px) rotate(0); opacity: 0; }
  8%   { opacity: .95; }
  100% { transform: translate(var(--tx,20px),110vh) rotate(720deg); opacity: 0; }
}
@media (max-width: 380px) {
  .bv-cashout-success-card { padding: 18px 16px 16px; }
  .bv-cashout-success-title { font-size: 20px; }
  .bv-cashout-success-amount .amt { font-size: 30px; }
}
`;
