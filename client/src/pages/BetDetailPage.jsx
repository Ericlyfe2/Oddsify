import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { fmtCedi, useTokens, OddPageHeader, OddIcon } from '../components/odd/primitives.jsx';
import { TeamLogo, LeagueLogo } from '../components/odd/teamBranding.jsx';
import BetTimeline from '../components/BetTimeline.jsx';

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

export default function BetDetailPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { id } = useParams();
  const { account } = useAccount();
  const { toast } = useToast();
  const { loadFromSlip, rememberCode, cashoutOffers } = useSlip();
  const [bet, setBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBet(id);
      setBet(data?.bet || data);
    } catch (e) {
      setError(e?.body?.error || e?.message || 'Failed to load bet details.');
      setBet(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (account) load();
  }, [account, load]);

  useEffect(() => {
    if (!account || !id) return;
    const off = onLive('cashout:offer', (payload) => {
      if (payload?.betId === id && typeof payload.cashOut === 'number') {
        setBet((prev) =>
          prev
            ? { ...prev, cashoutOffer: payload.cashOut, lastCashOutOffer: { amount: payload.cashOut, ts: payload.ts } }
            : prev,
        );
      }
    });
    return () => off?.();
  }, [account, id]);

  useEffect(() => {
    if (!account || !id) return;
    const off = onLive('bet:settled', (payload) => {
      if (payload?.betId === id) load();
    });
    return () => off?.();
  }, [account, id, load]);

  if (!account) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh' }}>
        <OddPageHeader title="Bet Details" subtitle="Sign in to view" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <OddIcon name="lock" size={32} color={T.inkDim} />
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>Sign in to view bet details</div>
          <button
            type="button"
            onClick={() => navigate('/login?next=' + window.location.pathname)}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh' }}>
        <OddPageHeader title="Bet Details" subtitle="Loading..." onBack={() => navigate(-1)} />
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 160,
                borderRadius: 16,
                background: T.surface,
                border: `1px solid ${T.line}`,
                opacity: 0.4 + i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !bet) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh' }}>
        <OddPageHeader title="Bet Details" subtitle="Error" onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <OddIcon name="alert" size={32} color={T.danger} />
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>{error || 'Bet not found'}</div>
          <button
            type="button"
            onClick={() => navigate('/my-bets')}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Back to My Bets
          </button>
        </div>
      </div>
    );
  }

  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';
  const status = bet.status || 'open';
  const ss = getStatusStyle(status);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const isSettled = status !== 'open';
  const isWon = status === 'won' || status === 'cashed_out';
  const isCashedOut = status === 'cashed_out';
  const profitLoss = isWon ? payout - stake : 0;
  const liveOffer = cashoutOffers[bet.id] || null;
  const displayOffer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
  const showCashout = displayOffer > 0 && status === 'open';

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook.', 'warn');
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  const sections = [
    { key: 'overview', label: 'Overview' },
    { key: 'matches', label: 'Matches' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'finance', label: 'Finance' },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 100 }}>
      <OddPageHeader
        title={`Bet #${code}`}
        subtitle={ss.label}
        onBack={() => navigate(-1)}
        right={
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px 6px 10px',
              borderRadius: 999,
              background: ss.bg,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {ss.label}
          </div>
        }
      />

      {/* Cashout banner */}
      {showCashout && (
        <div
          style={{
            margin: '0 16px 12px',
            padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Cashout Available</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              GHS {fmtCedi(displayOffer)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/my-bets?cashout=${bet.id}`)}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 0,
              background: '#fff',
              color: '#16a34a',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            CASH OUT
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          padding: '0 16px 16px',
        }}
      >
        <SummaryCard label="Stake" value={`GHS ${fmtCedi(stake)}`} T={T} />
        <SummaryCard label="Odds" value={`${odds.toFixed(2)}x`} T={T} />
        <SummaryCard
          label={isSettled ? 'Payout' : 'Potential'}
          value={`GHS ${fmtCedi(isSettled ? payout : potential)}`}
          color={isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright}
          T={T}
        />
        <SummaryCard
          label="Profit/Loss"
          value={`${isWon ? '+' : ''}GHS ${fmtCedi(profitLoss)}`}
          color={isWon ? '#16a34a' : '#dc2626'}
          T={T}
        />
      </div>

      {/* Section tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 16px',
          borderBottom: `1px solid ${T.line}`,
          overflowX: 'auto',
          marginBottom: 16,
        }}
      >
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            style={{
              padding: '10px 16px',
              border: 0,
              borderRadius: '8px 8px 0 0',
              background: activeSection === s.key ? T.surfaceAlt : 'transparent',
              color: activeSection === s.key ? T.ink : T.inkDim,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderBottom: activeSection === s.key ? `2px solid ${T.greenBright}` : '2px solid transparent',
              transition: 'all 120ms',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {activeSection === 'overview' && (
          <div>
            {/* General Information */}
            <SectionTitle text="General Information" T={T} />
            <InfoPanel T={T}>
              <InfoRow label="Bet ID" value={bet.id || '—'} mono T={T} />
              <InfoRow label="Booking Code" value={code.toUpperCase()} mono T={T} />
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
              <InfoRow label="Status" value={ss.label} T={T} />
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
                padding: '16px 0',
                borderRadius: 12,
                marginBottom: 16,
                background: T.surfaceAlt,
                border: `1px solid ${T.line}`,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  letterSpacing: 2.5,
                  color: T.ink,
                  marginBottom: 12,
                }}
              >
                {code.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <CodeBtn label="Copy Code" onClick={() => navigator.clipboard?.writeText(code.toUpperCase())} T={T} />
                <CodeBtn label="Rebook" onClick={handleRebook} T={T} primary />
                <CodeBtn
                  label="Share"
                  onClick={() => {
                    const url = `${window.location.origin}/code/${code}`;
                    if (navigator.share)
                      navigator
                        .share({ title: 'Oddsify code', text: `Code ${code.toUpperCase()}`, url })
                        .catch(() => {});
                    else navigator.clipboard?.writeText(url);
                  }}
                  T={T}
                />
                <CodeBtn label="Load Bet" onClick={() => navigate(`/code/${code}`)} T={T} />
              </div>
            </div>

            {/* Cashout History */}
            {(bet.cashoutHistory || []).length > 0 && (
              <>
                <SectionTitle text="Cashout History" T={T} />
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
              </>
            )}

            {/* Settlement */}
            {isSettled && (
              <>
                <SectionTitle text="Settlement Details" T={T} />
                <InfoPanel T={T}>
                  <InfoRow label="Settled At" value={fmtFull(bet.settledAt)} T={T} />
                  <InfoRow
                    label={isCashedOut ? 'Cashout At' : 'Completed'}
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

            {/* Actions */}
            <SectionTitle text="Actions" T={T} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <ActionButton label="Back to My Bets" onClick={() => navigate('/my-bets')} T={T} />
              <ActionButton label="Booking Code Hub" onClick={() => navigate('/codehub')} T={T} />
            </div>
          </div>
        )}

        {activeSection === 'matches' && (
          <div>
            <SectionTitle text={`Selections (${legs.length})`} T={T} />
            {legs.map((leg, i) => {
              const lr = legResult(leg);
              const initOdds = Number(leg.initialOdds || leg.odds || 0);
              const currOdds = Number(leg.odds || 0);
              const change = currOdds - initOdds;
              const hasChange = leg.initialOdds && Math.abs(change) > 0.001;

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TeamLogo name={leg.home} logoUrl={leg.homeLogo} size={22} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{leg.home}</span>
                    </div>
                    <span style={{ fontSize: 11, color: T.inkDim }}>vs</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TeamLogo name={leg.away} logoUrl={leg.awayLogo} size={22} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{leg.away}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 8,
                      fontSize: 11,
                      color: T.inkSoft,
                    }}
                  >
                    {leg.league && (
                      <>
                        <LeagueLogo name={leg.league} size={14} />
                        <span>{leg.league}</span>
                      </>
                    )}
                    {leg.country && <span>· {leg.country}</span>}
                    {leg.matchDate && <span>· {fmtFull(leg.matchDate)}</span>}
                  </div>

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
                      {leg.home}: {leg.scoreHome ?? '?'} <span style={{ color: T.inkDim }}>-</span> {leg.away}:{' '}
                      {leg.scoreAway ?? '?'}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
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
                    <DetailItem label="Odds at Placement" value={initOdds > 0 ? initOdds.toFixed(2) : '—'} mono T={T} />
                    <DetailItem label="Current Odds" value={currOdds > 0 ? currOdds.toFixed(2) : '—'} mono T={T} />
                    {hasChange && (
                      <DetailItem
                        label="Odds Change"
                        value={
                          <span style={{ color: change > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {change > 0 ? '+' : ''}
                            {change.toFixed(2)} {change > 0 ? '↑' : '↓'}
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: LEG_STATUS_COLORS[lr] || T.inkDim,
                            fontWeight: 700,
                          }}
                        >
                          <span
                            style={{
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
        )}

        {activeSection === 'timeline' && (
          <div style={{ padding: '4px 0' }}>
            <BetTimeline bet={bet} T={T} />
          </div>
        )}

        {activeSection === 'finance' && (
          <div>
            <SectionTitle text="Transaction Details" T={T} />
            <InfoPanel T={T}>
              {bet.walletBefore != null && (
                <InfoRow label="Wallet Before Bet" value={`GHS ${fmtCedi(Number(bet.walletBefore))}`} T={T} />
              )}
              <InfoRow label="Stake Debited" value={`-GHS ${fmtCedi(stake)}`} color="#dc2626" T={T} />
              {isWon && <InfoRow label="Winnings Credited" value={`+GHS ${fmtCedi(payout)}`} color="#16a34a" T={T} />}
              {isCashedOut && bet.cashOut != null && (
                <InfoRow
                  label="Cashout Credited"
                  value={`+GHS ${fmtCedi(Number(bet.cashOut))}`}
                  color="#2563eb"
                  T={T}
                />
              )}
              <InfoRow
                label="Net Profit / Loss"
                value={`${isWon ? '+' : ''}GHS ${fmtCedi(profitLoss)}`}
                color={isWon ? '#16a34a' : '#dc2626'}
                T={T}
              />
              {bet.walletAfter != null && (
                <InfoRow label="Wallet After" value={`GHS ${fmtCedi(Number(bet.walletAfter))}`} T={T} />
              )}
              {bet.transactionRef && <InfoRow label="Transaction ID" value={bet.transactionRef} mono T={T} />}
              {bet.paymentRef && <InfoRow label="Payment Reference" value={bet.paymentRef} mono T={T} />}
            </InfoPanel>

            {(bet.cashoutHistory || []).length > 0 && (
              <>
                <SectionTitle text="Cashout History" T={T} />
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, T }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: T.surface,
        border: `1px solid ${T.line}`,
      }}
    >
      <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || T.ink, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
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

function CodeBtn({ label, onClick, primary, T }) {
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

function ActionButton({ label, onClick, T }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        flex: 1,
        padding: '12px 0',
        borderRadius: 10,
        border: 0,
        background: h ? `${T.greenBright}20` : T.surfaceAlt,
        color: h ? T.greenBright : T.ink,
        fontWeight: 700,
        fontSize: 12.5,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  );
}
