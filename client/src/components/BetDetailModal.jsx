import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtCedi, useTokens } from './odd/tokens.jsx';
import { TeamLogo, LeagueLogo } from './odd/teamBranding.jsx';
import BetTimeline from './BetTimeline.jsx';

const STATUS_STYLE = {
  won: { bg: '#16a34a', label: 'Won' },
  lost: { bg: '#dc2626', label: 'Lost' },
  pending: { bg: '#d97706', label: 'Pending' },
  cashed_out: { bg: '#2563eb', label: 'Cashed Out' },
  void: { bg: '#4b5563', label: 'Void' },
  open: { bg: '#d97706', label: 'Open' },
  cancelled: { bg: '#6b7280', label: 'Cancelled' },
};

const LEG_STATUS_COLORS = {
  won: '#16a34a',
  lost: '#dc2626',
  pending: '#d97706',
  live: '#2563eb',
};

function getStatusStyle(status) {
  return STATUS_STYLE[status] || STATUS_STYLE.pending;
}

function fmtFull(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  );
}

function legResult(leg) {
  if (leg.status === 'won' || leg.won) return 'won';
  if (leg.status === 'lost' || leg.won === false) return 'lost';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
}

export default function BetDetailModal({ bet, open, onClose }) {
  const T = useTokens();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setVisible(true);
        setExiting(false);
      });
      setActiveTab('overview');
    } else {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 250);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!visible || !bet) return null;

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
  const isCashedOut = status === 'cashed_out';
  const cashoutHistory = bet.cashoutHistory || [];
  const profitLoss = isWon ? payout - stake : 0;

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const handleRebook = () => {
    navigate(`/code/${code}?rebook=1`);
  };

  const sections = [
    { key: 'overview', label: 'Overview' },
    { key: 'matches', label: 'Matches' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'finance', label: 'Finance' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 250ms',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: T.surface,
          borderRadius: 20,
          border: `1px solid ${T.line}`,
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          transform: exiting ? 'scale(0.95) translateY(10px)' : 'scale(1) translateY(0)',
          transition: 'transform 250ms, opacity 250ms',
          opacity: exiting ? 0 : 1,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '18px 18px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${T.line}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
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
              }}
            >
              {ss.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                color: T.inkDim,
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              #{code}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: T.surfaceAlt,
              color: T.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Tab nav ── */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '8px 18px 0',
            borderBottom: `1px solid ${T.line}`,
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveTab(s.key)}
              style={{
                padding: '8px 14px',
                border: 0,
                borderRadius: '8px 8px 0 0',
                background: activeTab === s.key ? T.surfaceAlt : 'transparent',
                color: activeTab === s.key ? T.ink : T.inkDim,
                fontWeight: 700,
                fontSize: 11.5,
                cursor: 'pointer',
                borderBottom: activeTab === s.key ? `2px solid ${T.greenBright}` : '2px solid transparent',
                transition: 'all 120ms',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {activeTab === 'overview' && (
            <OverviewTab
              bet={bet}
              legs={legs}
              code={code}
              odds={odds}
              stake={stake}
              potential={potential}
              payout={payout}
              isSettled={isSettled}
              isWon={isWon}
              isCashedOut={isCashedOut}
              profitLoss={profitLoss}
              ss={ss}
              copyText={copyText}
              onClose={onClose}
              T={T}
              cashoutHistory={cashoutHistory}
            />
          )}

          {activeTab === 'matches' && <MatchesTab bet={bet} legs={legs} T={T} />}

          {activeTab === 'timeline' && (
            <div style={{ padding: '4px 0' }}>
              <BetTimeline bet={bet} T={T} />
            </div>
          )}

          {activeTab === 'finance' && (
            <FinanceTab
              bet={bet}
              stake={stake}
              payout={payout}
              isWon={isWon}
              isCashedOut={isCashedOut}
              profitLoss={profitLoss}
              T={T}
            />
          )}
        </div>

        {/* ── Close button ── */}
        <div style={{ padding: '0 18px 16px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 12,
              background: T.greenBright,
              color: T.goldDark,
              border: 0,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 14,
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

function OverviewTab({
  bet,
  legs,
  code,
  odds,
  stake,
  potential,
  payout,
  isSettled,
  isWon,
  isCashedOut,
  profitLoss,
  ss,
  copyText,
  onClose,
  T,
  cashoutHistory,
}) {
  const navigate = useNavigate();
  const codeUpper = (code || '').toUpperCase();

  return (
    <div>
      <SectionTitle text="General Information" T={T} />
      <InfoPanel T={T}>
        <InfoRow label="Bet ID" value={bet.id || '—'} mono T={T} />
        <InfoRow label="Booking Code" value={codeUpper} mono T={T} />
        <InfoRow label="Stake" value={`GHS ${fmtCedi(stake)}`} T={T} />
        <InfoRow label="Total Odds" value={`${odds.toFixed(2)}x`} T={T} />
        <InfoRow
          label={isSettled ? 'Actual Winnings' : 'Potential Winnings'}
          value={`GHS ${fmtCedi(isSettled ? payout : potential)}`}
          color={isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright}
          T={T}
        />
        <InfoRow
          label="Profit / Loss"
          value={`${isWon ? '+' : ''}GHS ${fmtCedi(profitLoss)}`}
          color={isWon ? '#16a34a' : '#dc2626'}
          T={T}
        />
        <InfoRow label="Bet Type" value={bet.type || (legs.length > 1 ? 'Multiple' : 'Single')} T={T} />
        <InfoRow label="Selections" value={`${legs.length} leg${legs.length > 1 ? 's' : ''}`} T={T} />
        <InfoRow label="Status" value={<span style={{ color: ss.bg, fontWeight: 700 }}>{ss.label}</span>} T={T} />
        <InfoRow label="Placed" value={fmtFull(bet.placedAt || bet.createdAt)} T={T} />
        {isSettled && <InfoRow label="Settled" value={fmtFull(bet.settledAt || bet.cashOutAt)} T={T} />}
        {bet.cashOutAt && <InfoRow label="Cashout At" value={fmtFull(bet.cashOutAt)} T={T} />}
        {bet.cashOut != null && (
          <InfoRow label="Cashout Amount" value={`GHS ${fmtCedi(Number(bet.cashOut))}`} color="#2563eb" T={T} />
        )}
      </InfoPanel>

      {/* Booking Code */}
      <SectionTitle text="Booking Code" T={T} />
      <div
        style={{
          textAlign: 'center',
          padding: '14px 0',
          borderRadius: 12,
          background: T.surfaceAlt,
          border: `1px solid ${T.line}`,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            letterSpacing: 2,
            color: T.ink,
            marginBottom: 12,
          }}
        >
          {codeUpper}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ActionBtn label="Copy Code" onClick={() => copyText(codeUpper)} T={T} />
          <ActionBtn label="Rebook" onClick={() => navigate(`/code/${code}?rebook=1`)} T={T} primary />
          <ActionBtn
            label="Share"
            onClick={() => {
              const url = typeof window !== 'undefined' ? `${window.location.origin}/code/${code}` : `/code/${code}`;
              if (navigator.share)
                navigator.share({ title: 'Oddsify code', text: `Code ${codeUpper}`, url }).catch(() => {});
              else navigator.clipboard?.writeText(url);
            }}
            T={T}
          />
          <ActionBtn label="Load Bet" onClick={() => navigate(`/code/${code}`)} T={T} />
        </div>
      </div>

      {/* Cashout History */}
      {cashoutHistory.length > 0 && (
        <>
          <SectionTitle text="Cashout History" T={T} />
          <div style={{ marginBottom: 16 }}>
            {cashoutHistory.map((ch, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  marginBottom: 4,
                  borderRadius: 10,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.line}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>
                    {ch.type === 'partial' ? 'Partial Cashout' : 'Full Cashout'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft }}>{fmtFull(ch.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.greenBright }}>
                    GHS {fmtCedi(ch.amount || 0)}
                  </div>
                  {ch.remainingStake > 0 && (
                    <div style={{ fontSize: 10, color: T.inkSoft }}>Remaining: GHS {fmtCedi(ch.remainingStake)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Settlement */}
      {isSettled && (
        <>
          <SectionTitle text="Settlement Details" T={T} />
          <InfoPanel T={T}>
            <InfoRow label="Settled At" value={fmtFull(bet.settledAt)} T={T} />
            <InfoRow
              label={isCashedOut ? 'Cashout At' : 'Settled'}
              value={fmtFull(bet.cashOutAt || bet.settledAt)}
              T={T}
            />
            <InfoRow label="Payout" value={`GHS ${fmtCedi(payout)}`} T={T} />
            <InfoRow
              label="Net Result"
              value={`${isWon ? '+' : ''}GHS ${fmtCedi(profitLoss)}`}
              color={isWon ? '#16a34a' : '#dc2626'}
              T={T}
            />
          </InfoPanel>
        </>
      )}
    </div>
  );
}

function MatchesTab({ bet, legs, T }) {
  return (
    <div>
      <SectionTitle text={`Selections (${legs.length})`} T={T} />
      {legs.map((leg, i) => {
        const lr = legResult(leg);
        const oddsAtPlacement = Number(leg.initialOdds || leg.odds || 0);
        const currentOdds = Number(leg.odds || 0);
        const oddsChange = currentOdds - oddsAtPlacement;
        const hasOddsMovement = leg.initialOdds && Math.abs(oddsChange) > 0.001;

        return (
          <div
            key={i}
            style={{
              padding: '12px',
              marginBottom: 10,
              borderRadius: 14,
              background: T.surfaceAlt,
              border: `1px solid ${T.line}`,
            }}
          >
            {/* Match header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TeamLogo name={leg.home} logoUrl={leg.homeLogo} size={22} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{leg.home}</span>
              </div>
              <span style={{ fontSize: 11, color: T.inkDim, fontWeight: 500 }}>vs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TeamLogo name={leg.away} logoUrl={leg.awayLogo} size={22} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{leg.away}</span>
              </div>
            </div>

            {/* League & country */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: T.inkSoft }}
            >
              {leg.league && (
                <>
                  <LeagueLogo name={leg.league} logoUrl={leg.leagueLogo} size={14} />
                  <span>{leg.league}</span>
                </>
              )}
              {leg.country && <span>· {leg.country}</span>}
              {(leg.matchDate || bet.placedAt) && <span>· {fmtFull(leg.matchDate || bet.placedAt)}</span>}
            </div>

            {/* Score */}
            {(leg.scoreHome != null || leg.scoreAway != null) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                  padding: '4px 14px',
                  borderRadius: 8,
                  background: T.bg,
                  fontSize: 16,
                  fontWeight: 800,
                  color: T.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  {leg.home}: {leg.scoreHome ?? '?'}
                </span>
                <span style={{ color: T.inkDim }}>-</span>
                <span>
                  {leg.away}: {leg.scoreAway ?? '?'}
                </span>
              </div>
            )}

            {/* Selection details grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px 12px',
                padding: '10px 12px',
                borderRadius: 10,
                background: T.bg,
                border: `1px solid ${T.line}`,
              }}
            >
              <DetailItem label="Market" value={leg.market || 'Match Result'} T={T} />
              <DetailItem
                label="Selection"
                value={
                  <span style={{ color: T.greenBright, fontWeight: 700 }}>
                    {leg.pickLabel || leg.label || leg.pick || leg.key}
                  </span>
                }
                T={T}
              />
              <DetailItem
                label="Odds at Placement"
                value={oddsAtPlacement > 0 ? oddsAtPlacement.toFixed(2) : '—'}
                mono
                T={T}
              />
              <DetailItem label="Current Odds" value={currentOdds > 0 ? currentOdds.toFixed(2) : '—'} mono T={T} />
              {hasOddsMovement && (
                <DetailItem
                  label="Odds Change"
                  value={
                    <span style={{ color: oddsChange > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      {oddsChange > 0 ? '+' : ''}
                      {oddsChange.toFixed(2)} {oddsChange > 0 ? '↑' : '↓'}
                    </span>
                  }
                  T={T}
                />
              )}
              <DetailItem
                label="Status"
                value={
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: LEG_STATUS_COLORS[lr] || T.inkDim,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: LEG_STATUS_COLORS[lr] || T.inkDim,
                      }}
                    />
                    {lr.toUpperCase()}
                  </span>
                }
                T={T}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinanceTab({ bet, stake, payout, isWon, isCashedOut, profitLoss, T }) {
  const walletBefore = bet.walletBefore != null ? Number(bet.walletBefore) : null;
  const walletAfter = bet.walletAfter != null ? Number(bet.walletAfter) : null;

  return (
    <div>
      <SectionTitle text="Transaction Details" T={T} />
      <InfoPanel T={T}>
        {walletBefore != null && <InfoRow label="Wallet Before Bet" value={`GHS ${fmtCedi(walletBefore)}`} T={T} />}
        <InfoRow label="Stake Debited" value={`-GHS ${fmtCedi(stake)}`} color="#dc2626" T={T} />
        {isWon && <InfoRow label="Winnings Credited" value={`+GHS ${fmtCedi(payout)}`} color="#16a34a" T={T} />}
        {isCashedOut && bet.cashOut != null && (
          <InfoRow label="Cashout Credited" value={`+GHS ${fmtCedi(Number(bet.cashOut))}`} color="#2563eb" T={T} />
        )}
        <InfoRow
          label="Net Profit / Loss"
          value={`${isWon ? '+' : ''}GHS ${fmtCedi(profitLoss)}`}
          color={isWon ? '#16a34a' : '#dc2626'}
          T={T}
        />
        {walletAfter != null && <InfoRow label="Wallet After" value={`GHS ${fmtCedi(walletAfter)}`} T={T} />}
        {bet.transactionRef && <InfoRow label="Transaction ID" value={bet.transactionRef} mono T={T} />}
        {bet.paymentRef && <InfoRow label="Payment Reference" value={bet.paymentRef} mono T={T} />}
      </InfoPanel>

      {/* Cashout History */}
      {(bet.cashoutHistory || []).length > 0 && (
        <>
          <SectionTitle text="Cashout History" T={T} />
          <div style={{ marginBottom: 16 }}>
            {(bet.cashoutHistory || []).map((ch, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  marginBottom: 4,
                  borderRadius: 10,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.line}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>
                    {ch.type === 'partial' ? 'Partial Cashout' : 'Full Cashout'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft }}>{fmtFull(ch.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.greenBright }}>
                    GHS {fmtCedi(ch.amount || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ text, T }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        color: T.inkDim,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );
}

function InfoPanel({ children, T }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        marginBottom: 16,
        background: T.surfaceAlt,
        border: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value, color, mono, T }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span style={{ fontSize: 11.5, color: T.inkDim, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: color || T.ink,
          fontFamily: mono ? '"JetBrains Mono", "Fira Code", monospace' : 'inherit',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          maxWidth: '55%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function DetailItem({ label, value, mono, T }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
          fontFamily: mono ? '"JetBrains Mono", "Fira Code", monospace' : 'inherit',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, primary, T }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: 0,
        background: primary ? T.greenBright : h ? `${T.greenBright}20` : T.surfaceAlt,
        color: primary ? T.goldDark : h ? T.greenBright : T.ink,
        fontWeight: 700,
        fontSize: 11.5,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  );
}
