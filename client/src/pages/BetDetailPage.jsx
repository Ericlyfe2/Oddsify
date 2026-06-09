/* BetDetailPage — Oddsify Ticket Details.
   Ported from the Claude Design "Oddsify Design System" handoff bundle
   (ui_kits/bet-slips/TicketDetailScreen.jsx). Recolored SportyBet ticket
   structure → dark gold-accented Oddsify chrome: bg-soft header with the
   gold "Back" link, surface summary card with the gold return figure,
   gold-tinted won-leg boxes with trophy watermark, gold Remix Bet CTA
   with the brand gold-glow shadow. */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Headphones,
  Trophy,
  XCircle,
  CheckCircle2,
  Clock,
  Copy,
  Ban,
} from 'lucide-react';
import { fetchBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';

const MONO = 'var(--font-mono, "JetBrains Mono", "SF Mono", monospace)';

const STATUS = {
  won: { color: 'var(--accent)', label: 'Won', Icon: Trophy },
  cashed_out: { color: 'var(--accent-cool)', label: 'Cashed Out', Icon: Copy },
  lost: { color: 'var(--danger)', label: 'Lost', Icon: XCircle },
  pending: { color: 'var(--warn)', label: 'Pending', Icon: Clock },
  open: { color: 'var(--warn)', label: 'Pending', Icon: Clock },
  void: { color: 'var(--text-dim)', label: 'Void', Icon: Ban },
  cancelled: { color: 'var(--text-dim)', label: 'Cancelled', Icon: Ban },
};

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Sign in to view ticket</div>
        </div>
      </Frame>
    );
  }

  if (loading) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: 12 }}>
          <Skeleton h={220} />
          <Skeleton h={140} style={{ marginTop: 10 }} />
        </div>
      </Frame>
    );
  }

  if (error || !bet) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <XCircle size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{error || 'Ticket not found'}</div>
          <button
            type="button"
            onClick={() => navigate('/my-bets')}
            style={{
              marginTop: 16,
              padding: '10px 24px',
              background: 'var(--accent)',
              color: 'var(--gold-ink)',
              border: 0,
              borderRadius: 'var(--r-pill, 999px)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-cta, 0 4px 14px rgba(232,185,74,0.3))',
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
  const StatusIcon = ss.Icon;

  return (
    <Frame onBack={() => navigate(-1)}>
      {/* ── Summary card ── */}
      <div style={{ padding: '12px 12px 0' }}>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--r-md, 10px)',
            border: '1px solid var(--line)',
            padding: '14px 14px 0',
            boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.12))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
              Ticket ID:{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: MONO }}>{code.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: MONO }}>
              {fmtTicketDate(bet.placedAt || bet.createdAt)}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingBottom: 12,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{betType}</span>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: ss.color, fontWeight: 700, fontSize: 15 }}
            >
              <StatusIcon size={18} /> {ss.label}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', padding: '14px 0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Total Oddsify Return</span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: isWon ? 'var(--accent)' : 'var(--text)',
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(totalReturn)}
              </span>
            </div>
          </div>

          <SumRow label="Total Stake" value={fmtMoney(stake)} />
          <SumRow label="Total Odds" value={odds.toFixed(2)} />
          {bonus > 0 && <SumRow label="Total Bonus" value={fmtMoney(bonus)} strong="var(--accent-warm)" />}

          {/* Show Off / Remix Bet */}
          <div style={{ display: 'flex', gap: 10, padding: '14px 0' }}>
            <button
              type="button"
              onClick={handleShowOff}
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--r-sm, 6px)',
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
              style={{
                flex: 1,
                background: 'var(--accent)',
                color: 'var(--gold-ink)',
                border: 0,
                borderRadius: 'var(--r-sm, 6px)',
                padding: '12px 0',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-cta, 0 4px 14px rgba(232,185,74,0.3))',
              }}
            >
              Remix Bet
            </button>
          </div>
        </div>
      </div>

      {/* Verify code */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 8px',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
          Verify Code:{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: MONO }}>{code.toUpperCase()}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code.toUpperCase());
            toast('Code copied!', 'success');
          }}
          style={{
            background: 'none',
            border: 0,
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Bet Details
        </button>
      </div>

      {/* Legs */}
      <div style={{ padding: '0 12px' }}>
        {legs.map((leg, i) => (
          <LegCard key={i} leg={leg} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 16px 100px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            borderRadius: 'var(--r, 8px)',
            border: '1px solid var(--line)',
            padding: '14px',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Number of Bets: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{legs.length}</span>
          </span>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 0,
              color: 'var(--accent)',
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'var(--surface)',
            borderRadius: 'var(--r, 8px)',
            border: '1px solid var(--line)',
            padding: '14px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <span>Check Transaction History</span>
          <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
            <ChevronRight size={14} />
          </span>
        </button>
      </div>
    </Frame>
  );
}

// ─── Header frame — bg-soft, gold "Back" link, headphones/home icons ────
function Frame({ onBack, children }) {
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 'var(--col-max, 414px)',
          minHeight: '100vh',
          background: 'var(--bg)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-soft)',
            borderBottom: '1px solid var(--gold-soft)',
            padding: '12px 14px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 0,
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ChevronLeft size={20} /> Back
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ticket Details</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-soft)' }}>
            <Headphones size={18} />
            <Home size={18} />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

// ─── Summary card row (mono value) ────
function SumRow({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: strong || 'var(--text)',
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Per-leg card with gold-tinted won box + trophy watermark ────
function LegCard({ leg }) {
  const r = legResult(leg);
  const won = r === 'won';
  const lost = r === 'lost';
  const c = won ? 'var(--accent)' : lost ? 'var(--danger)' : 'var(--text-dim)';
  const tintBg = won ? 'var(--gold-soft)' : lost ? 'rgba(var(--danger-rgb, 255, 91, 120), 0.1)' : 'var(--surface-2)';

  const home = leg.home || '';
  const away = leg.away || '';
  const sHome = leg.scoreHome ?? '?';
  const sAway = leg.scoreAway ?? '?';
  const outcome =
    leg.outcomeLabel ||
    (leg.scoreHome != null || leg.scoreAway != null ? `${home} ${sHome} - ${sAway} ${away}` : `${home} vs ${away}`);
  const pick = leg.pickLabel || leg.label || leg.pick || leg.key || '—';
  const odds = Number(leg.odds || 0);
  const gameId = leg.gameId || leg.matchId || leg.id?.toString().slice(-6) || '—';
  const dt = leg.matchDate || leg.kickoff;
  const dtFormatted = dt ? fmtMatchDate(dt) : '';

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        background: 'var(--surface)',
        borderRadius: 'var(--r, 8px)',
        padding: '12px 14px',
        marginBottom: 10,
        border: '1px solid var(--line)',
        alignItems: 'stretch',
      }}
    >
      {/* Status circle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0, paddingTop: 8 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: c,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg)',
          }}
        >
          {won ? (
            <CheckCircle2 size={15} strokeWidth={2.4} />
          ) : lost ? (
            <XCircle size={15} strokeWidth={2.4} />
          ) : (
            <Clock size={14} />
          )}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: MONO,
            marginBottom: 6,
          }}
        >
          Game ID: {gameId}
          {dtFormatted && <> · {dtFormatted}</>}
        </div>

        {/* Pick / Market / Outcome box (tinted + trophy watermark when won) */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: tintBg,
            borderRadius: 'var(--r-sm, 6px)',
            padding: '8px 10px',
          }}
        >
          {won && (
            <span
              style={{
                position: 'absolute',
                right: 6,
                bottom: -8,
                opacity: 0.16,
                color: 'var(--accent)',
                pointerEvents: 'none',
              }}
            >
              <Trophy size={56} />
            </span>
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <LegRow
              label="Pick"
              value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {pick}{' '}
                  {odds > 0 && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>@{odds.toFixed(2)}</span>}{' '}
                  {won && <CheckCircle2 size={12} color="var(--accent)" />}
                  {lost && <XCircle size={12} color="var(--danger)" />}
                </span>
              }
              valueColor={c}
            />
            <LegRow label="Market" value={leg.market || 'Match Result'} />
            <LegRow label="Outcome" value={outcome} valueColor={c} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LegRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: valueColor || 'var(--text)',
          textAlign: 'right',
          marginLeft: 10,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Skeleton({ h, style }) {
  return (
    <div
      style={{
        height: h,
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r, 8px)',
        opacity: 0.6,
        ...style,
      }}
    />
  );
}
