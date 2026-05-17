// components/BetSuccessModal.jsx
import { useEffect, useRef } from 'react';

// Fallback derivation for older receipts that pre-date server-side codes.
export function toBookingCode(id = '') {
  const s = String(id).replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!s) return 'XX00000';
  const letters = (s.match(/[A-Z]/g) || ['X', 'X']).slice(0, 2).join('').padEnd(2, 'X');
  const digits  = (s.match(/[0-9]/g) || ['0']).slice(-5).join('').padStart(5, '0');
  return letters + digits;
}

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BetSuccessModal({ bet, onClose, onRebet }) {
  const dlg = useRef(null);

  useEffect(() => {
    if (!bet || !dlg.current) return;
    if (!dlg.current.open) dlg.current.showModal();
  }, [bet]);

  if (!bet) return null;
  const code = bet.bookingCode || toBookingCode(bet.id);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch {/* ignore */}
  };

  return (
    <dialog
      ref={dlg}
      className="bv-dialog success-dlg"
      onClose={onClose}
      style={{ 
        maxWidth: 360, 
        padding: '32px 24px 24px', 
        border: 'none', 
        borderRadius: 24, 
        background: '#ffffff', 
        color: '#000000',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 16px',
          borderRadius: '50%', background: '#f0f9f3',
          display: 'grid', placeItems: 'center', fontSize: 32,
        }}>🏆</div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Bet Successful</h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666' }}>
          Bet successful
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Total Stake</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>GHS {formatAmt(bet.stake)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Potential Win</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>GHS {formatAmt(bet.potentialWin)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Booking Code</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{code}</div>
          </div>
          <button type="button" onClick={copy} style={{ background: 'none', border: 'none', color: '#116f43', fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}>COPY</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => { dlg.current?.close(); onRebet?.(); }}
          style={{ flex: 1, padding: '15px 0', borderRadius: 12, border: 'none', background: '#f0f9f3', color: '#116f43', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
        >Rebet</button>
        <button
          type="button"
          onClick={() => dlg.current?.close()}
          style={{ flex: 1, padding: '15px 0', borderRadius: 12, border: 'none', background: '#116f43', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
        >OK</button>
      </div>
    </dialog>
  );
}
