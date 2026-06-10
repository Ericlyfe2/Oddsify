import { useEffect, useRef } from 'react';
import { fmtCedi, useTokens } from './odd/tokens.jsx';

export default function CashoutConfirmModal({ bet, cashoutValue, open, onClose, onConfirm, busy }) {
  const T = useTokens();
  const dlgRef = useRef(null);
  const stake = Number(bet?.stake || 0);
  const potential = Number(bet?.potentialWin || bet?.potentialReturn || 0);
  const profit = Number((cashoutValue - stake).toFixed(2));
  const isProfit = profit >= 0;

  useEffect(() => {
    if (!open || !dlgRef.current) return;
    dlgRef.current.showModal();
  }, [open]);

  const handleClose = () => {
    if (!busy) onClose?.();
  };

  if (!open || !bet) return null;

  return (
    <dialog ref={dlgRef} className="bv-cashout-confirm" onClose={handleClose} onClick={handleClose}>
      <div
        className="bv-cashout-confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="cco-title"
      >
        <header className="bv-cashout-confirm-head">
          <span className="bv-cashout-confirm-badge">CASH OUT</span>
          <button
            type="button"
            className="bv-cashout-confirm-x"
            onClick={handleClose}
            aria-label="Close"
            disabled={busy}
          >
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
        </header>

        <div className="bv-cashout-confirm-icon" aria-hidden>
          <svg viewBox="0 0 48 48" width="36" height="36">
            <defs>
              <linearGradient id="ccoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff3b8" />
                <stop offset="1" stopColor="#e8b94a" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="rgba(232,185,74,.12)" />
            <path
              d="M14 28 L24 18 L34 28"
              fill="none"
              stroke="url(#ccoGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="14" y="30" width="20" height="3" rx="1.5" fill="rgba(232,185,74,.3)" />
          </svg>
        </div>

        <h3 id="cco-title" className="bv-cashout-confirm-title">
          Confirm Cashout
        </h3>
        <p className="bv-cashout-confirm-sub">You are about to cash out this bet. This action cannot be undone.</p>

        <div className="bv-cashout-confirm-amounts">
          <div className="bv-cashout-confirm-row highlight">
            <span className="lbl">Cashout Value</span>
            <span className="val">GHS {fmtCedi(cashoutValue)}</span>
          </div>
          <div className="bv-cashout-confirm-row">
            <span className="lbl">Original Stake</span>
            <span className="val">GHS {fmtCedi(stake)}</span>
          </div>
          <div className="bv-cashout-confirm-row">
            <span className="lbl">Potential Winnings</span>
            <span className="val">GHS {fmtCedi(potential)}</span>
          </div>
          <div className="bv-cashout-confirm-row">
            <span className="lbl">Profit / Loss</span>
            <span className="val" style={{ color: isProfit ? '#f7c948' : '#ff5b78' }}>
              {isProfit ? '+' : ''}GHS {fmtCedi(profit)}
            </span>
          </div>
        </div>

        <div className="bv-cashout-confirm-actions">
          <button type="button" className="bv-cashout-btn bv-cashout-btn-cancel" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="bv-cashout-btn bv-cashout-btn-confirm" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="bv-cashout-spinner" /> : `Cash Out GHS ${fmtCedi(cashoutValue)}`}
          </button>
        </div>
      </div>

      <style>{CASHOUT_CONFIRM_CSS}</style>
    </dialog>
  );
}

const CASHOUT_CONFIRM_CSS = `
.bv-cashout-confirm {
  border: none; padding: 0; background: transparent;
  width: min(380px, 92vw);
  border-radius: 22px;
  color: #f3e9cf;
}
.bv-cashout-confirm::backdrop {
  background: rgba(10,8,2,.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.bv-cashout-confirm-card {
  position: relative; z-index: 2;
  background:
    radial-gradient(360px 140px at 80% -10%, rgba(232,185,74,.1), transparent 60%),
    linear-gradient(180deg, #161513 0%, #0a0a0a 100%);
  border-radius: 22px;
  padding: 22px 22px 20px;
  box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(232,185,74,.2) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  animation: ccoPop .45s cubic-bezier(.18,.88,.36,1.2) both, ccoBorderGlow 3s ease-in-out .8s infinite;
  text-align: center;
}
@keyframes ccoPop {
  0%   { transform: scale(.85) translateY(16px); opacity: 0; }
  60%  { transform: scale(1.02) translateY(-3px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes ccoBorderGlow {
  0%, 100% { box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(232,185,74,.2) inset, 0 0 20px rgba(232,185,74,.05); }
  50% { box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(247,201,72,.45) inset, 0 0 40px rgba(232,185,74,.12); }
}
@keyframes ccoUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ccoBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes ccoIconPop { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 70% { transform: scale(1.15) rotate(4deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes ccoShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes ccoBtnGlow { 0%, 100% { box-shadow: 0 10px 24px rgba(232,185,74,.3); } 50% { box-shadow: 0 12px 34px rgba(247,201,72,.55); } }

.bv-cashout-confirm-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.bv-cashout-confirm-badge {
  font-size: 10px; letter-spacing: .18em; font-weight: 800;
  color: #f7c948;
  background: rgba(232,185,74,.1);
  border: 1px solid rgba(232,185,74,.35);
  padding: 5px 10px; border-radius: 999px;
  animation: ccoUp .35s ease .1s both;
}
.bv-cashout-confirm-x {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(243,233,207,.14);
  background: transparent;
  color: rgba(243,233,207,.65);
  cursor: pointer;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s;
}
.bv-cashout-confirm-x:hover { color: #f3e9cf; border-color: rgba(243,233,207,.3); }
.bv-cashout-confirm-x:disabled { opacity: .4; cursor: not-allowed; }

.bv-cashout-confirm-icon {
  display: flex; justify-content: center; margin-bottom: 8px;
  animation: ccoIconPop .5s cubic-bezier(.18,.88,.36,1.3) .15s both;
}
.bv-cashout-confirm-icon svg { animation: ccoBob 2.4s ease-in-out .8s infinite; }

.bv-cashout-confirm-title {
  margin: 8px 0 4px;
  font-size: 20px; font-weight: 800;
  color: #f3e9cf;
  animation: ccoUp .35s ease .25s both;
}
.bv-cashout-confirm-sub {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: rgba(243,233,207,.6);
  animation: ccoUp .35s ease .32s both;
}

.bv-cashout-confirm-amounts {
  display: flex; flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;
}
.bv-cashout-confirm-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(232,185,74,.05);
  border: 1px solid rgba(232,185,74,.1);
  animation: ccoUp .35s ease both;
}
.bv-cashout-confirm-row:nth-child(1) { animation-delay: .4s; }
.bv-cashout-confirm-row:nth-child(2) { animation-delay: .47s; }
.bv-cashout-confirm-row:nth-child(3) { animation-delay: .54s; }
.bv-cashout-confirm-row:nth-child(4) { animation-delay: .61s; }
.bv-cashout-confirm-row.highlight {
  background: rgba(232,185,74,.1);
  border-color: rgba(232,185,74,.3);
}
.bv-cashout-confirm-row .lbl {
  font-size: 12px; font-weight: 600;
  color: rgba(243,233,207,.55);
}
.bv-cashout-confirm-row .val {
  font-size: 14px; font-weight: 700;
  color: #f3e9cf;
  font-variant-numeric: tabular-nums;
}
.bv-cashout-confirm-row.highlight .val {
  font-size: 16px; font-weight: 800;
  background: linear-gradient(110deg, #e8b94a 25%, #fff7d6 50%, #e8b94a 75%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ccoShimmer 2.8s linear 1s infinite;
}

.bv-cashout-confirm-actions {
  display: grid; grid-template-columns: 1fr 2fr;
  gap: 10px;
  animation: ccoUp .35s ease .7s both;
}
.bv-cashout-btn {
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  font-weight: 700; font-size: 13px;
  cursor: pointer;
  transition: transform .12s, box-shadow .15s, background .15s;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
.bv-cashout-btn:active { transform: scale(.97); }
.bv-cashout-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.bv-cashout-btn-cancel {
  background: rgba(232,185,74,.06);
  color: #f3e9cf;
  border: 1px solid rgba(232,185,74,.2);
}
.bv-cashout-btn-cancel:hover { background: rgba(232,185,74,.12); border-color: rgba(232,185,74,.4); }
.bv-cashout-btn-confirm {
  background: linear-gradient(135deg, #f7c948 0%, #d4a72c 100%);
  color: #1a1300;
  box-shadow: 0 10px 24px rgba(232,185,74,.3);
  animation: ccoBtnGlow 2.4s ease-in-out 1.2s infinite;
}
.bv-cashout-btn-confirm:hover {
  transform: translateY(-1px);
}
.bv-cashout-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(26,19,0,.25);
  border-top-color: #1a1300;
  border-radius: 50%;
  animation: ccoSpin .6s linear infinite;
}
@keyframes ccoSpin { to { transform: rotate(360deg); } }
`;
