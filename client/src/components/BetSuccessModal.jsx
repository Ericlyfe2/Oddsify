/**
 * Shown immediately after a bet is placed.
 * Mirrors the "Bet Successful" pattern: stake / potential win / booking code
 * (with copy), plus Rebet and OK actions.
 */
import { useEffect, useRef, useState } from 'react';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toBookingCode(id) {
  if (!id) return '';
  const tail = String(id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-10);
  return tail.padStart(10, '0');
}

export default function BetSuccessModal({ bet, onClose, onRebet }) {
  const dlgRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bet) return;
    dlgRef.current?.showModal?.();
    setCopied(false);
    const onCancel = (e) => { e.preventDefault(); onClose?.(); };
    const node = dlgRef.current;
    node?.addEventListener('cancel', onCancel);
    return () => node?.removeEventListener('cancel', onCancel);
  }, [bet, onClose]);

  if (!bet) return null;

  const code = toBookingCode(bet.id);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };

  return (
    <dialog ref={dlgRef} className="bv-success">
      <div className="bv-success-card" role="alertdialog" aria-labelledby="bv-success-title">
        <div className="bv-success-emblem" aria-hidden>
          <svg viewBox="0 0 64 64" width="56" height="56">
            <defs>
              <linearGradient id="bvSuccessCup" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--accent, #c5ff3d)" />
                <stop offset="1" stopColor="#9be800" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="30" fill="var(--accent, #c5ff3d)" opacity=".15" />
            <path d="M20 14h24v18c0 8-6 14-12 14s-12-6-12-14V14z" fill="url(#bvSuccessCup)" />
            <path d="M22 18h20v2H22z" fill="#ffffff" opacity=".55" />
            <path d="M28 46h8v6h-8z" fill="#33402a" />
            <path d="M22 52h20v3H22z" fill="#33402a" />
          </svg>
        </div>

        <h2 id="bv-success-title" className="bv-success-title">Bet Successful</h2>
        <p className="bv-success-sub">Your ticket has been placed.</p>

        <div className="bv-success-grid">
          <div className="bv-success-stat">
            <span className="lbl">Total Stake</span>
            <span className="val">GHS {fmt(bet.stake)}</span>
          </div>
          <div className="bv-success-stat">
            <span className="lbl">Potential Win</span>
            <span className="val val-accent">GHS {fmt(bet.potentialWin)}</span>
          </div>
          <div className="bv-success-stat">
            <span className="lbl">Booking Code</span>
            <span className="val val-mono">{code}</span>
          </div>
        </div>

        <button type="button" className="bv-success-copy" onClick={copy} aria-live="polite">
          {copied ? '✓ Copied' : 'Copy code'}
        </button>

        <div className="bv-success-actions">
          <button type="button" className="btn btn-ghost bv-success-btn" onClick={() => { onRebet?.(); onClose?.(); }}>
            Rebet
          </button>
          <button type="button" className="btn btn-primary bv-success-btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
      <style>{BET_SUCCESS_CSS}</style>
    </dialog>
  );
}

const BET_SUCCESS_CSS = `
.bv-success {
  border: none; padding: 0; background: transparent;
  width: min(420px, 92vw);
  border-radius: 22px;
}
.bv-success::backdrop {
  background: radial-gradient(700px 500px at 50% 30%, rgba(0, 0, 0, .55), rgba(0, 0, 0, .82));
  backdrop-filter: blur(6px);
}
.bv-success-card {
  background: var(--surface, #131a18);
  color: var(--text, #e8edea);
  border-radius: 22px;
  padding: 28px 24px 22px;
  text-align: center;
  border: 1px solid var(--surface-2, #1a2421);
  box-shadow: 0 30px 80px rgba(0, 0, 0, .55);
  animation: bvSuccessPop .35s cubic-bezier(.18, .8, .36, 1.18);
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}
@keyframes bvSuccessPop {
  from { transform: scale(.92) translateY(8px); opacity: 0; }
  to   { transform: scale(1)   translateY(0);   opacity: 1; }
}
.bv-success-emblem {
  display: flex; justify-content: center;
  filter: drop-shadow(0 8px 18px rgba(197, 255, 61, .35));
  animation: bvSuccessBounce 2.4s ease-in-out infinite;
}
@keyframes bvSuccessBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
.bv-success-title {
  margin: 12px 0 4px;
  font-size: 22px; font-weight: 800; letter-spacing: -.01em;
}
.bv-success-sub {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-soft, #a0a8a4);
}
.bv-success-grid {
  display: flex; flex-direction: column; gap: 8px;
  margin: 8px 0 12px;
}
.bv-success-stat {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px;
  background: var(--surface-2, #1a2421);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, .04);
}
.bv-success-stat .lbl {
  font-size: 12px; color: var(--text-dim, #5d6764);
  text-transform: uppercase; letter-spacing: .08em;
}
.bv-success-stat .val {
  font-size: 15px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.bv-success-stat .val-accent { color: var(--accent, #c5ff3d); }
.bv-success-stat .val-mono {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  letter-spacing: .04em;
  color: var(--accent-cool, #6ad0ff);
}
.bv-success-copy {
  width: 100%;
  margin: 4px 0 14px;
  padding: 10px 12px;
  background: transparent;
  border: 1px dashed var(--text-dim, #5d6764);
  border-radius: 10px;
  color: var(--text-soft, #a0a8a4);
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease;
}
.bv-success-copy:hover { border-color: var(--accent, #c5ff3d); color: var(--accent, #c5ff3d); }
.bv-success-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.bv-success-btn { padding: 12px; font-weight: 700; }

/* tighter spacing on small phones */
@media (max-width: 380px) {
  .bv-success-card { padding: 24px 18px 18px; }
  .bv-success-title { font-size: 20px; }
  .bv-success-stat { padding: 10px 12px; }
}
`;
