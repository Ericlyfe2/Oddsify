import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtCedi, useTokens } from './odd/tokens.jsx';
import { expandMarketName, humanizePick, getSelectionLabel } from '../lib/marketNames.js';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GH', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  );
}

function legResult(leg) {
  if (leg.status === 'won' || leg.won) return 'won';
  if (leg.status === 'lost' || leg.won === false) return 'lost';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
}

const LEG_ICON = {
  won: { symbol: '✓', color: '#16a34a' },
  lost: { symbol: '✗', color: '#dc2626' },
  pending: { symbol: '•', color: '#eab308' },
  live: { symbol: '●', color: '#f97316' },
};

export default function BetDetailModal({ bet, open, onClose }) {
  const T = useTokens();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => { setVisible(true); setExiting(false); });
    } else {
      setExiting(true);
      setTimeout(() => { setVisible(false); setExiting(false); }, 250);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!visible || !bet) return null;

  const status = bet.status || 'open';
  const legs = bet.legs || bet.selections || [];
  const code = (bet.bookingCode || bet.code || bet.id?.slice(-8) || '—').toUpperCase();
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const isSettled = status !== 'open';
  const isWon = status === 'won' || status === 'cashed_out';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Singles');

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); } catch {}
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        opacity: exiting ? 0 : 1, transition: 'opacity 250ms',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          position: 'fixed', inset: 0,
          display: 'flex', flexDirection: 'column',
          background: T.bg,
          transform: exiting ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 300ms ease',
        }}
      >
        {/* ── Red Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: '#c41e1e',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            border: 0, background: 'none', color: '#fff',
            fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>
            ←
          </button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Ticket Details
          </span>
        </div>

        {/* ── Scrollable Content ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Ticket ID + Date */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
          }}>
            <span style={{ fontSize: 12, color: T.inkDim }}>
              Ticket ID: <span style={{ color: T.ink, fontWeight: 600 }}>{bet.id?.slice(-8) || '—'}</span>
            </span>
            <span style={{ fontSize: 12, color: T.inkDim }}>
              {fmtDate(bet.placedAt || bet.createdAt)}
            </span>
          </div>

          {/* Bet Type + Status */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{betType}</span>
            <span style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              background: status === 'won' ? '#16a34a' : status === 'lost' ? '#dc2626' : status === 'cashed_out' ? '#2563eb' : '#eab308',
              color: '#fff',
            }}>
              {status === 'cashed_out' ? 'Cashed Out' : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>

          {/* Summary Rows */}
          <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}` }}>
            <Row label="Total Return" value={`GHS ${fmtCedi(isSettled ? payout : potential)}`}
              color={isWon ? '#16a34a' : T.ink} bold T={T} />
            <Row label="Total Stake" value={`GHS ${fmtCedi(stake)}`} T={T} />
            <Row label="Total Odds" value={odds.toFixed(2)} T={T} />
          </div>

          {/* Verify Code */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
          }}>
            <div style={{ fontSize: 12, color: T.inkDim }}>
              Verify Code: <span style={{
                fontWeight: 700, color: T.ink, letterSpacing: 1,
                fontFamily: '"JetBrains Mono", monospace',
              }}>{code}</span>
            </div>
            <button onClick={copyCode} style={{
              border: 0, background: 'none', color: T.greenBright,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px',
            }}>
              Copy
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex', gap: 10, padding: '12px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
          }}>
            <ActionBtn label="Rebook" icon="🔄" onClick={() => navigate(`/code/${code}?rebook=1`)} T={T} primary />
            <ActionBtn label="Share" icon="📤" onClick={() => {
              const url = `${window.location.origin}/code/${code}`;
              if (navigator.share) navigator.share({ title: 'Oddsify Ticket', text: `Code ${code}`, url }).catch(() => {});
              else navigator.clipboard?.writeText(url);
            }} T={T} />
          </div>

          {/* ── Match Legs ── */}
          <div style={{ padding: '0' }}>
            {legs.map((leg, i) => {
              const lr = legResult(leg);
              const icon = LEG_ICON[lr];
              const selLabel = humanizePick(getSelectionLabel(leg), leg.home, leg.away);
              const marketLabel = leg.marketName || expandMarketName(leg.market);
              const legOdds = Number(leg.odds || leg.initialOdds || 0);

              return (
                <div key={i} style={{
                  padding: '12px 16px',
                  background: T.surface,
                  borderBottom: `1px solid ${T.line}`,
                }}>
                  {/* Match name */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6,
                  }}>
                    {leg.home} v {leg.away}
                  </div>

                  {/* Score if available */}
                  {(leg.scoreHome != null || leg.scoreAway != null) && (
                    <div style={{
                      fontSize: 12, color: T.inkDim, marginBottom: 6,
                    }}>
                      FT Score: <span style={{ fontWeight: 700, color: T.ink }}>
                        {leg.scoreHome ?? '?'} : {leg.scoreAway ?? '?'}
                      </span>
                    </div>
                  )}

                  {/* Pick, Market, Outcome */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: `${icon.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: icon.color, flexShrink: 0,
                    }}>
                      {icon.symbol}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.ink }}>
                        Pick: <span style={{ fontWeight: 700, color: T.greenBright }}>
                          {selLabel} @{legOdds.toFixed(2)}
                        </span>
                        {' '}
                        <span style={{ color: icon.color, fontWeight: 700, fontSize: 11 }}>
                          {icon.symbol}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: T.inkDim }}>
                        Market: {marketLabel}
                      </div>
                      <div style={{ fontSize: 11, color: T.inkDim }}>
                        Outcome: <span style={{ fontWeight: 600, color: icon.color }}>
                          {lr === 'won' ? 'Won' : lr === 'lost' ? 'Lost' : lr === 'live' ? 'Live' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Number of Bets */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Number of Bets: {legs.length}</span>
          </div>

          {/* Check Transaction History */}
          <button onClick={() => { onClose?.(); navigate('/bets'); }} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '14px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.line}`,
            border: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Check Transaction History</span>
            <span style={{ fontSize: 16, color: T.inkDim }}>›</span>
          </button>

          {/* Delete / Close */}
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none',
              color: '#dc2626', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', padding: '8px 16px',
            }}>
              Close Ticket
            </button>
          </div>

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, bold, T }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 16px',
      borderBottom: `1px solid ${T.line}`,
    }}>
      <span style={{ fontSize: 13, color: T.inkDim }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: bold ? 800 : 600,
        color: color || T.ink,
      }}>{value}</span>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, primary, T }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: primary ? T.greenBright : T.surfaceAlt,
      color: primary ? T.goldDark : T.ink,
      fontWeight: 700, fontSize: 13,
    }}>
      {icon} {label}
    </button>
  );
}
