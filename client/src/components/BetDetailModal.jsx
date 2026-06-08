import { useEffect, useState } from 'react';
import { fmtCedi, useTokens } from './odd/tokens.jsx';

const STATUS_STYLE = {
  won: { bg: '#16a34a', label: 'Won' },
  lost: { bg: '#dc2626', label: 'Lost' },
  pending: { bg: '#d97706', label: 'Pending' },
  cashed_out: { bg: '#2563eb', label: 'Cashed Out' },
  void: { bg: '#4b5563', label: 'Void' },
  open: { bg: '#d97706', label: 'Open' },
};

function getStatusStyle(status) {
  return STATUS_STYLE[status] || STATUS_STYLE.pending;
}

function placedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dt = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const tm = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  return `${dt}, ${tm}`;
}

export default function BetDetailModal({ bet, open, onClose }) {
  const T = useTokens();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      setExiting(false);
    } else {
      setExiting(true);
      setTimeout(() => { setVisible(false); setExiting(false); }, 250);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!visible) return null;

  if (!bet) return null;

  const status = bet.status || 'open';
  const ss = getStatusStyle(status);
  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const isSettled = status !== 'open';
  const isWon = status === 'won' || status === 'cashed_out';
  const isCasheOut = status === 'cashed_out';
  const txns = bet.transactions || [];
  const cashoutHistory = bet.cashoutHistory || [];

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      opacity: exiting ? 0 : 1,
      transition: 'opacity 250ms',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        width: '100%',
        maxWidth: 500,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: T.surface,
        borderRadius: 20,
        border: `1px solid ${T.line}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        transform: exiting ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 250ms, opacity 250ms',
        opacity: exiting ? 0 : 1,
      }}>
        <div style={{
          padding: '18px 18px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${T.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 999,
              background: ss.bg,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 0.4,
            }}>
              {ss.label}
            </span>
            <span style={{
              fontSize: 12,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color: T.inkDim,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}>
              #{code}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 999, border: 0,
              background: T.surfaceAlt, color: T.ink, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: T.inkDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Selections
          </div>
          {legs.map((leg, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              marginBottom: 6,
              borderRadius: 12,
              background: T.surfaceAlt,
              border: `1px solid ${T.line}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                    {leg.home} vs {leg.away}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ color: T.inkDim }}>{leg.market || 'Match Result'}</span>
                    <span style={{ color: T.greenBright, fontWeight: 600 }}>
                      {leg.pickLabel || leg.label || leg.pick || leg.key}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {Number(leg.odds || 0).toFixed(2)}
                  </div>
                  {isSettled && (
                    <div style={{
                      fontSize: 10, fontWeight: 700, marginTop: 2,
                      color: leg.status === 'won' ? '#16a34a' : leg.status === 'lost' ? '#dc2626' : T.inkDim,
                    }}>
                      {(leg.status || 'pending').toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          margin: '0 18px 16px',
          padding: '14px 16px',
          borderRadius: 14,
          background: T.surfaceAlt,
          border: `1px solid ${T.line}`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <InfoRow label="Placed" value={placedAt(bet.placedAt || bet.createdAt)} T={T} />
            <InfoRow label="Status" value={
              <span style={{ color: ss.bg, fontWeight: 700 }}>{ss.label}</span>
            } T={T} />
            <InfoRow label="Stake" value={`GHS ${fmtCedi(stake)}`} T={T} />
            <InfoRow label="Total Odds" value={`${odds.toFixed(2)}x`} T={T} />
            <InfoRow label={isSettled ? (isWon ? 'Payout' : 'Return') : 'Potential Win'} value={
              <span style={{ color: isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright, fontWeight: 700 }}>
                GHS {fmtCedi(isSettled ? payout : potential)}
              </span>
            } T={T} />
            <InfoRow label="Bet Type" value={getBetType(bet, legs)} T={T} />
          </div>
        </div>

        <div style={{ padding: '0 18px 16px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => copyText(code)}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: T.surfaceAlt, border: 0, cursor: 'pointer',
                color: T.ink, fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <CopyIcon T={T} />
              Copy Code
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  const url = typeof window !== 'undefined'
                    ? `${window.location.origin}/code/${code}`
                    : `/code/${code}`;
                  if (navigator.share) { navigator.share({ title: 'Oddsify booking code', text: `Code ${code} on Oddsify`, url }); }
                  else { navigator.clipboard?.writeText(url); }
                } catch {}
              }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: T.surfaceAlt, border: 0, cursor: 'pointer',
                color: T.ink, fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <ShareIcon T={T} />
              Share
            </button>
          </div>
        </div>

        {isCasheOut && cashoutHistory.length > 0 && (
          <div style={{ padding: '0 18px 16px' }}>
            <div style={{ fontSize: 11, color: T.inkDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Cashout History
            </div>
            {cashoutHistory.map((ch, i) => (
              <div key={i} style={{
                padding: '10px 12px', marginBottom: 4, borderRadius: 10,
                background: T.surfaceAlt, border: `1px solid ${T.line}`,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>
                    {ch.type === 'partial' ? 'Partial Cashout' : 'Full Cashout'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft }}>{placedAt(ch.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.greenBright }}>
                    GHS {fmtCedi(ch.amount || 0)}
                  </div>
                  {ch.remainingStake > 0 && (
                    <div style={{ fontSize: 10, color: T.inkSoft }}>
                      Remaining: GHS {fmtCedi(ch.remainingStake)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isSettled && (
          <div style={{ padding: '0 18px 16px' }}>
            <div style={{ fontSize: 11, color: T.inkDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Settlement Details
            </div>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: T.surfaceAlt, border: `1px solid ${T.line}`,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <InfoRow label="Settled At" value={placedAt(bet.settledAt)} T={T} />
                <InfoRow label={isCasheOut ? 'Cashout At' : 'Settled'} value={placedAt(bet.cashOutAt || bet.settledAt)} T={T} />
                <InfoRow label="Payout" value={`GHS ${fmtCedi(payout)}`} T={T} />
                <InfoRow label="Profit/Loss" value={
                  <span style={{ color: isWon ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {isWon ? '+' : ''}GHS {fmtCedi(isWon ? payout - stake : 0)}
                  </span>
                } T={T} />
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '0 18px 16px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12,
              background: T.greenBright, color: T.goldDark, border: 0,
              cursor: 'pointer', fontWeight: 800, fontSize: 14,
              letterSpacing: 0.3,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, T }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>
        {value}
      </div>
    </div>
  );
}

function getBetType(bet, legs) {
  if (bet.type) return bet.type;
  if (legs.length > 1) return 'Multiple';
  if (legs.length === 1) return 'Single';
  return '—';
}

function CopyIcon({ T }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon({ T }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
