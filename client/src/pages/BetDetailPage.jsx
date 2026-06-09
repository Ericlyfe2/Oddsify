import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Bell, Home, Trophy, XCircle, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { fetchBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';

const S = {
  red: '#E11E2C',
  navy: '#1C2531',
  navyDeep: '#0F1620',
  navyCard: '#1F2937',
  green: '#22C55E',
  greenDeep: '#16A34A',
  amber: '#F59E0B',
  blue: '#2563EB',
  muted: '#9CA3AF',
  divider: '#2A3441',
  whiteCard: '#FFFFFF',
  pageBg: '#F3F4F6',
  bodyText: '#374151',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const STATUS = {
  won: { color: S.green, label: 'Won', Icon: Trophy },
  lost: { color: '#DC2626', label: 'Lost', Icon: XCircle },
  cashed_out: { color: S.blue, label: 'Cashed Out', Icon: CheckCircle2 },
  pending: { color: S.amber, label: 'Pending', Icon: Clock },
  open: { color: S.amber, label: 'Pending', Icon: Clock },
  void: { color: S.muted, label: 'Void', Icon: XCircle },
  cancelled: { color: S.muted, label: 'Cancelled', Icon: XCircle },
};

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTicketDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}, ${hh}:${mi}`;
}

function fmtMatchDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function legResult(leg) {
  if (leg.status === 'won' || leg.won) return 'won';
  if (leg.status === 'lost' || leg.won === false) return 'lost';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
}

export default function BetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { account } = useAccount();
  const { toast } = useToast();
  const { loadFromSlip, rememberCode } = useSlip();
  const [bet, setBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBet(id);
      setBet(data?.bet || data);
    } catch (e) {
      setError(e?.body?.error || e?.message || 'Failed to load bet.');
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
    const off = onLive('bet:settled', (payload) => {
      if (payload?.betId === id) load();
    });
    return () => off?.();
  }, [account, id, load]);

  const handleRebook = () => {
    if (!bet) return;
    const legs = bet.legs || bet.selections || [];
    if (!legs.length) return toast('No selections to rebook.', 'warn');
    const code = bet.bookingCode || bet.code || bet.id;
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  const handleShowOff = () => {
    if (!bet) return;
    const code = bet.bookingCode || bet.code || bet.id;
    const url = `${window.location.origin}/code/${code}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title: 'Oddsify Winning Slip', text: `Check out my winning slip: ${code}`, url })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast('Share link copied!', 'success');
    }
  };

  if (!account) {
    return (
      <Frame onBack={() => navigate('/login?next=' + window.location.pathname)}>
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#FFFFFF' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Sign in to view ticket</div>
        </div>
      </Frame>
    );
  }

  if (loading) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: 16 }}>
          <div style={{ height: 220, background: S.navyCard, borderRadius: 8, opacity: 0.5 }} />
          <div style={{ height: 140, background: S.navyCard, borderRadius: 8, marginTop: 10, opacity: 0.4 }} />
        </div>
      </Frame>
    );
  }

  if (error || !bet) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#FFFFFF' }}>
          <XCircle size={36} color={S.muted} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>{error || 'Ticket not found'}</div>
          <button
            type="button"
            onClick={() => navigate('/my-bets')}
            style={{
              marginTop: 16,
              padding: '10px 24px',
              background: S.green,
              color: '#FFFFFF',
              border: 0,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back to My Bets
          </button>
        </div>
      </Frame>
    );
  }

  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';
  const status = bet.status || 'pending';
  const ss = STATUS[status] || STATUS.pending;
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const bonus = Number(bet.bonus || bet.bonusAmount || 0);
  const isWon = status === 'won' || status === 'cashed_out';
  const isSettled = status !== 'open' && status !== 'pending';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const totalReturn = isSettled ? payout : potential;

  return (
    <Frame onBack={() => navigate(-1)}>
      {/* ── Summary card ── */}
      <div style={{ padding: '12px 12px 0' }}>
        <div
          style={{
            background: S.navy,
            borderRadius: 8,
            padding: '14px 14px 0',
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontSize: 12, color: S.muted, fontWeight: 500 }}>
                Ticket ID: <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{code}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: S.muted, fontFamily: '"JetBrains Mono", monospace' }}>
              {fmtTicketDate(bet.placedAt || bet.createdAt)}
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 10, paddingBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{betType}</span>
            <div className="flex items-center" style={{ gap: 6, color: ss.color, fontWeight: 700, fontSize: 15 }}>
              <ss.Icon size={18} color={ss.color} />
              <span>{ss.label}</span>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${S.divider}`, padding: '14px 0 10px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, color: '#FFFFFF' }}>Total Oddsify Return</span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: isWon ? S.green : '#FFFFFF',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(totalReturn)}
              </span>
            </div>
          </div>

          <SumRow label="Total Stake" value={fmtMoney(stake)} />
          <SumRow label="Total Odds" value={odds.toFixed(2)} />
          {bonus > 0 && <SumRow label="Total Bonus" value={fmtMoney(bonus)} />}

          {/* Action buttons */}
          <div className="flex" style={{ gap: 10, padding: '14px 0' }}>
            <button
              type="button"
              onClick={handleShowOff}
              className="flex-1"
              style={{
                background: '#F59E0B',
                color: '#FFFFFF',
                border: 0,
                borderRadius: 6,
                padding: '12px 0',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Show Off
            </button>
            <button
              type="button"
              onClick={handleRebook}
              className="flex-1"
              style={{
                background: S.green,
                color: '#FFFFFF',
                border: 0,
                borderRadius: 6,
                padding: '12px 0',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Remix Bet
            </button>
          </div>
        </div>
      </div>

      {/* ── Verify Code: Bet Details ── */}
      <div className="flex items-center justify-between" style={{ padding: '14px 16px 8px', color: '#FFFFFF' }}>
        <span style={{ fontSize: 12, color: S.muted }}>
          Verify Code: <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{code}</span>
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(code)}
          style={{
            background: 'none',
            border: 0,
            color: S.green,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Bet Details
        </button>
      </div>

      {/* ── Leg cards ── */}
      <div style={{ padding: '0 12px' }}>
        {legs.map((leg, i) => (
          <LegCard key={i} leg={leg} index={i} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '16px 16px 100px' }}>
        <div
          className="flex items-center justify-between"
          style={{
            background: S.navy,
            borderRadius: 6,
            padding: '14px 14px',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>
            Number of Bets: <span style={{ fontWeight: 700 }}>1</span>
          </span>
          <button
            type="button"
            className="flex items-center"
            style={{
              gap: 4,
              background: 'none',
              border: 0,
              color: S.green,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Bet Details <ChevronRight size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="flex items-center justify-between w-full"
          style={{
            background: S.navy,
            borderRadius: 6,
            padding: '14px',
            color: '#FFFFFF',
            border: 0,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <span>Check Transaction History</span>
          <ChevronRight size={14} color={S.muted} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Remove this ticket from your records?')) {
              toast('Settled tickets are kept for your records and cannot be deleted.', 'warn');
            }
          }}
          className="w-full"
          style={{
            marginTop: 14,
            background: 'none',
            border: 0,
            color: '#DC2626',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Delete Ticket
        </button>
      </div>
    </Frame>
  );
}

function Frame({ onBack, children }) {
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: S.navyDeep }}>
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 414,
          minHeight: '100vh',
          background: S.navyDeep,
          fontFamily: S.font,
        }}
      >
        {/* Red header */}
        <div
          className="flex items-center justify-between"
          style={{
            background: S.red,
            padding: '10px 14px',
            color: '#FFFFFF',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center"
            style={{
              gap: 2,
              background: 'none',
              border: 0,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ticket Details</div>
          <div className="flex items-center" style={{ gap: 12 }}>
            <Headphones size={18} color="#FFFFFF" />
            <Home size={18} color="#FFFFFF" />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function SumRow({ label, value }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: S.muted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function LegCard({ leg, index }) {
  const lr = legResult(leg);
  const lrColor = lr === 'won' ? S.green : lr === 'lost' ? '#DC2626' : S.amber;
  const code = leg.gameId || leg.matchId || `Game ${index + 1}`;
  const matchDate = leg.matchDate || leg.kickoff;
  const odds = Number(leg.odds || 0);

  const showStatus = lr === 'won' || lr === 'lost';
  const pickBoxBg = lr === 'won' ? '#E6F4EA' : lr === 'lost' ? '#FBEAEA' : '#F9FAFB';

  return (
    <div
      className="flex"
      style={{
        gap: 12,
        background: S.whiteCard,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        color: S.bodyText,
        alignItems: 'stretch',
      }}
    >
      {/* Status column (left) */}
      {showStatus && (
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: lrColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {lr === 'won' ? (
              <CheckCircle2 size={16} color="#FFFFFF" fill={lrColor} />
            ) : (
              <XCircle size={16} color="#FFFFFF" fill={lrColor} />
            )}
          </div>
        </div>
      )}

      {/* Pick / Market / Outcome box (tinted by result) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: pickBoxBg,
          borderRadius: 6,
          padding: '8px 10px',
          marginTop: 8,
        }}
      >
          {lr === 'won' && (
            <Trophy
              size={56}
              color={S.green}
              style={{ position: 'absolute', right: 6, bottom: -6, opacity: 0.14, pointerEvents: 'none' }}
            />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <LegRow
              label="Pick"
              value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {leg.pickLabel || leg.label || leg.pick || leg.key}
                  {odds > 0 && <span style={{ color: '#6B7280', fontWeight: 500 }}>@{odds.toFixed(2)}</span>}
                  {lr === 'won' && <CheckCircle2 size={12} color={S.green} />}
                  {lr === 'lost' && <XCircle size={12} color="#DC2626" />}
                </span>
              }
              valueColor={lrColor}
            />
            <LegRow label="Market" value={leg.market || 'Match Result'} />
            <LegRow
              label="Outcome"
              value={leg.outcomeLabel || leg.market || 'Match Result'}
              valueColor={lr === 'won' ? S.green : lr === 'lost' ? '#DC2626' : '#374151'}
            />
          </div>
        </div>
    </div>
  );
}

function LegRow({ label, value, valueColor }) {
  return (
    <div className="flex items-start justify-between" style={{ padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: valueColor || '#374151',
          textAlign: 'right',
          marginLeft: 10,
        }}
      >
        {value}
      </span>
    </div>
  );
}
