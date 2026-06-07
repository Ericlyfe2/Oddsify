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
    <dialog
      ref={dlgRef}
      className="bv-cashout-confirm"
      onClose={handleClose}
      onClick={handleClose}
    >
      <div className="bv-cashout-confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="cco-title">
        <header className="bv-cashout-confirm-head">
          <span className="bv-cashout-confirm-badge">CASH OUT</span>
          <button type="button" className="bv-cashout-confirm-x" onClick={handleClose} aria-label="Close" disabled={busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="bv-cashout-confirm-icon" aria-hidden>
          <svg viewBox="0 0 48 48" width="36" height="36">
            <defs>
              <linearGradient id="ccoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffd76d" />
                <stop offset="1" stopColor="#f3a01a" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="rgba(255,200,80,.12)" />
            <path d="M14 28 L24 18 L34 28" fill="none" stroke="url(#ccoGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="14" y="30" width="20" height="3" rx="1.5" fill="rgba(255,200,80,.3)" />
          </svg>
        </div>

        <h3 id="cco-title" className="bv-cashout-confirm-title">Confirm Cashout</h3>
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
            <span className="val" style={{ color: isProfit ? '#4ade80' : '#ff5b78' }}>
              {isProfit ? '+' : ''}GHS {fmtCedi(profit)}
            </span>
          </div>
        </div>

        <div className="bv-cashout-confirm-actions">
          <button type="button" className="bv-cashout-btn bv-cashout-btn-cancel" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="bv-cashout-btn bv-cashout-btn-confirm" onClick={onConfirm} disabled={busy}>
            {busy ? (
              <span className="bv-cashout-spinner" />
            ) : (
              `Cash Out GHS ${fmtCedi(cashoutValue)}`
            )}
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
  color: #ffffff;
}
.bv-cashout-confirm::backdrop {
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.bv-cashout-confirm-card {
  position: relative; z-index: 2;
  background: linear-gradient(180deg, #0d2c1d 0%, #0a2418 100%);
  border-radius: 22px;
  padding: 22px 22px 20px;
  box-shadow: 0 24px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,200,80,.15) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  animation: ccoPop .35s cubic-bezier(.18,.88,.36,1.2);
  text-align: center;
}
@keyframes ccoPop {
  from { transform: scale(.9) translateY(8px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}

.bv-cashout-confirm-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.bv-cashout-confirm-badge {
  font-size: 10px; letter-spacing: .18em; font-weight: 800;
  color: #ffc44d;
  background: rgba(255,200,80,.1);
  border: 1px solid rgba(255,200,80,.35);
  padding: 5px 10px; border-radius: 999px;
}
.bv-cashout-confirm-x {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.14);
  background: transparent;
  color: rgba(255,255,255,.65);
  cursor: pointer;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s;
}
.bv-cashout-confirm-x:hover { color: #fff; border-color: rgba(255,255,255,.3); }
.bv-cashout-confirm-x:disabled { opacity: .4; cursor: not-allowed; }

.bv-cashout-confirm-icon {
  display: flex; justify-content: center; margin-bottom: 8px;
}

.bv-cashout-confirm-title {
  margin: 8px 0 4px;
  font-size: 20px; font-weight: 800;
  color: #ffffff;
}
.bv-cashout-confirm-sub {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: rgba(255,255,255,.6);
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
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
}
.bv-cashout-confirm-row.highlight {
  background: rgba(255,200,80,.08);
  border-color: rgba(255,200,80,.25);
}
.bv-cashout-confirm-row .lbl {
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,.55);
}
.bv-cashout-confirm-row .val {
  font-size: 14px; font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}
.bv-cashout-confirm-row.highlight .val {
  font-size: 16px; font-weight: 800;
  color: #ffc44d;
}

.bv-cashout-confirm-actions {
  display: grid; grid-template-columns: 1fr 2fr;
  gap: 10px;
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
  background: rgba(255,255,255,.06);
  color: #ffffff;
  border: 1px solid rgba(255,255,255,.14);
}
.bv-cashout-btn-cancel:hover { background: rgba(255,255,255,.1); }
.bv-cashout-btn-confirm {
  background: linear-gradient(135deg, #ffc44d 0%, #f6a200 100%);
  color: #2a1700;
  box-shadow: 0 10px 24px rgba(246,162,0,.35);
}
.bv-cashout-btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(246,162,0,.5);
}
.bv-cashout-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(42,23,0,.25);
  border-top-color: #2a1700;
  border-radius: 50%;
  animation: ccoSpin .6s linear infinite;
}
@keyframes ccoSpin { to { transform: rotate(360deg); } }
`;
