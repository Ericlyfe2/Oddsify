import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchBetHistory, cashOutBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import {
  fmtCedi,
  useTokens,
  OddPageHeader,
  OddSegmented,
  OddStatusChip,
  OddIcon,
} from '../components/odd/primitives.jsx';
import { TeamLogo, LeagueLogo } from '../components/odd/teamBranding.jsx';
import CashoutConfirmModal from '../components/CashoutConfirmModal.jsx';
import CashoutSuccessOverlay from '../components/CashoutSuccessOverlay.jsx';
import BetDetailModal from '../components/BetDetailModal.jsx';
import BetTimeline from '../components/BetTimeline.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'cashout', label: 'Cashout Available' },
  { value: 'live', label: 'Live Games' },
];

const STATUS_STYLE = {
  won: { bg: '#16a34a', label: 'Won', icon: 'check' },
  lost: { bg: '#dc2626', label: 'Lost', icon: 'x' },
  pending: { bg: '#d97706', label: 'Pending', icon: 'clock' },
  cashed_out: { bg: '#2563eb', label: 'Cashed Out', icon: 'dollar' },
  void: { bg: '#4b5563', label: 'Void', icon: 'slash' },
  open: { bg: '#d97706', label: 'Open', icon: 'clock' },
  cancelled: { bg: '#6b7280', label: 'Cancelled', icon: 'slash' },
};

function getStatusStyle(status) {
  return STATUS_STYLE[status] || STATUS_STYLE.pending;
}

function filterBets(bets, filter) {
  if (filter === 'all') return bets;
  return bets.filter((b) => {
    const legs = b.legs || b.selections || [];
    if (filter === 'live') return legs.some((l) => l.isLive || l.status === 'live');
    if (filter === 'cashout') {
      const offer = b.cashoutOffer || b.lastCashOutOffer?.amount || 0;
      return offer > 0;
    }
    return true;
  });
}

function filterBySearch(bets, query) {
  if (!query) return bets;
  const q = query.toLowerCase();
  return bets.filter((b) => {
    const code = (b.bookingCode || b.code || '').toLowerCase();
    const id = (b.id || '').toLowerCase();
    const legs = b.legs || b.selections || [];
    const matchNames = legs.map((l) => `${l.home || ''} ${l.away || ''}`.toLowerCase()).join(' ');
    return code.includes(q) || id.includes(q) || matchNames.includes(q);
  });
}

function makeShareUrl(code) {
  if (typeof window === 'undefined') return `/code/${code}`;
  return `${window.location.origin}/code/${code}`;
}

function shareCode(code, toast) {
  const url = makeShareUrl(code);
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Oddsify booking code', text: `Booking code ${code} on Oddsify`, url }).catch(() => {});
    return;
  }
  try {
    navigator.clipboard?.writeText(url);
    toast('Copied share link.', 'success');
  } catch {
    toast('Share unsupported.', 'warn');
  }
}

function copyCode(code, toast) {
  try {
    navigator.clipboard?.writeText(code);
    toast(`Copied ${code}.`, 'success');
  } catch {
    toast('Copy failed.', 'warn');
  }
}

function placedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dt = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' });
  const tm = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  return `${dt}, ${tm}`;
}

function formatFullDate(iso) {
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

const LEG_STATUS_COLORS = {
  won: '#16a34a',
  lost: '#dc2626',
  pending: '#d97706',
  live: '#2563eb',
};

export default function BetHistoryPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account, refresh } = useAccount();
  const { toast } = useToast();
  const { cashoutOffers, updateCashoutOffer } = useSlip();
  const initialTab = searchParams.get('tab') === 'hist' ? 'hist' : 'open';
  const [tab, setTab] = useState(initialTab);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [cashingOut, setCashingOut] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [cashoutTarget, setCashoutTarget] = useState(null);
  const [cashoutOffer, setCashoutOffer] = useState(null);
  const cashoutBusyRef = useRef(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(null);
  const [cashoutSuccessAmount, setCashoutSuccessAmount] = useState(0);

  const [detailBet, setDetailBet] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBetHistory();
      const items = data?.bets || data?.history || [];
      setBets(items);
    } catch {
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account) load();
  }, [account, load]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__oddsifyOpenCount = bets.filter((b) => b.status === 'open').length;
    }
  }, [bets]);

  useEffect(() => {
    if (!account) return;
    const off = onLive('cashout:offer', (payload) => {
      if (payload?.betId && typeof payload.cashOut === 'number') {
        updateCashoutOffer(payload.betId, payload);
      }
    });
    return () => off?.();
  }, [account, updateCashoutOffer]);

  const openBets = useMemo(() => bets.filter((b) => b.status === 'open'), [bets]);
  const settledBets = useMemo(() => bets.filter((b) => b.status !== 'open'), [bets]);
  const filteredOpen = useMemo(() => {
    let f = filterBets(openBets, filter);
    if (search) f = filterBySearch(f, search);
    return f;
  }, [openBets, filter, search]);
  const filteredHistory = useMemo(() => {
    let h = settledBets;
    if (search) h = filterBySearch(h, search);
    return h;
  }, [settledBets, search]);

  const openCashoutConfirm = (bet) => {
    const offer = cashoutOffers[bet.id];
    const value = offer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
    if (value <= 0) {
      toast('Cash-out not currently available for this bet.', 'warn');
      return;
    }
    setCashoutTarget(bet);
    setCashoutOffer(value);
  };

  const confirmCashout = async () => {
    if (!cashoutTarget || cashoutBusyRef.current) return;
    cashoutBusyRef.current = true;
    setCashingOut(cashoutTarget.id);
    try {
      const result = await cashOutBet(cashoutTarget.id, cashoutOffer);
      const bet = result?.bet || cashoutTarget;
      setCashoutSuccess(bet);
      setCashoutSuccessAmount(cashoutOffer);
      setCashoutTarget(null);
      setCashoutOffer(null);
      await refresh();
      await load();
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Cash-out failed. Please try again.', 'error');
    } finally {
      setCashingOut(null);
      cashoutBusyRef.current = false;
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (!account) return <SignedOutState navigate={navigate} />;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader
        title="My Bets"
        subtitle="Open bets & history"
        right={
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px 8px 10px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            GHS {fmtCedi(account.balance)}
          </div>
        }
      />

      <div style={{ padding: '14px 16px 8px' }}>
        <OddSegmented
          full
          options={[
            { value: 'open', label: `Open Bets · ${openBets.length}` },
            { value: 'hist', label: `History · ${settledBets.length}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tab === 'open' &&
            FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: 0,
                  background: filter === f.value ? T.greenBright : T.surfaceAlt,
                  color: filter === f.value ? T.goldDark : T.inkSoft,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
              >
                {f.label}
              </button>
            ))}
          <div style={{ flex: 1, minWidth: 120, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by code or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 28px',
                borderRadius: 999,
                border: 0,
                background: T.surfaceAlt,
                color: T.ink,
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <svg
              style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'none' }}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.inkDim}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 8px' }}>
        <button
          type="button"
          onClick={() => navigate('/codehub')}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            background: T.surfaceAlt,
            border: `1px dashed ${T.lineStrong}`,
            color: T.ink,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <OddIcon name="ticket" size={16} color={T.greenBright} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Booking Code Hub</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>Load any code, see recent codes, share.</div>
          </div>
          <OddIcon name="chevR" size={14} color={T.inkDim} />
        </button>
      </div>

      {loading ? (
        <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 12 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 220,
                borderRadius: 16,
                background: T.surface,
                border: `1px solid ${T.line}`,
                opacity: 0.6 + i * 0.2,
              }}
            />
          ))}
        </div>
      ) : tab === 'open' ? (
        filteredOpen.length === 0 ? (
          <EmptyState
            icon="ticket"
            title={
              search ? 'No bets match your search' : filter !== 'all' ? 'No bets match this filter' : 'No open bets'
            }
            hint={
              search
                ? 'Try a different search term.'
                : filter !== 'all'
                  ? 'Try switching to All bets.'
                  : 'Tap odds on a match to build a slip.'
            }
          />
        ) : (
          <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 12 }}>
            {filteredOpen.map((bet) => (
              <ExpandableBetCard
                key={bet.id}
                bet={bet}
                expanded={expandedId === bet.id}
                onToggle={() => toggleExpand(bet.id)}
                liveOffer={cashoutOffers[bet.id] || null}
                onCopy={() => copyCode(bet.bookingCode || bet.code || bet.id, toast)}
                onCashOut={() => openCashoutConfirm(bet)}
                cashingOut={cashingOut === bet.id}
                onViewDetails={() => setDetailBet(bet)}
                onViewFullPage={() => navigate(`/bets/${bet.id}`)}
              />
            ))}
          </div>
        )
      ) : filteredHistory.length === 0 ? (
        <EmptyState
          icon="ticket"
          title={search ? 'No bets match your search' : 'No bet history yet'}
          hint={search ? 'Try a different search term.' : 'Settled bets will appear here.'}
        />
      ) : (
        <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 10 }}>
          {filteredHistory.map((h) => (
            <ExpandableBetCard
              key={h.id}
              bet={h}
              expanded={expandedId === h.id}
              onToggle={() => toggleExpand(h.id)}
              onCopy={() => copyCode(h.bookingCode || h.code || h.id, toast)}
              onViewDetails={() => setDetailBet(h)}
              onViewFullPage={() => navigate(`/bets/${h.id}`)}
            />
          ))}
        </div>
      )}

      <CashoutConfirmModal
        bet={cashoutTarget}
        cashoutValue={cashoutOffer}
        open={!!cashoutTarget}
        onClose={() => {
          setCashoutTarget(null);
          setCashoutOffer(null);
        }}
        onConfirm={confirmCashout}
        busy={cashingOut === cashoutTarget?.id}
      />

      <CashoutSuccessOverlay
        bet={cashoutSuccess}
        cashoutAmount={cashoutSuccessAmount}
        open={!!cashoutSuccess}
        onClose={() => setCashoutSuccess(null)}
        onViewBets={() => {
          setCashoutSuccess(null);
          navigate('/my-bets');
        }}
      />

      <BetDetailModal bet={detailBet} open={!!detailBet} onClose={() => setDetailBet(null)} />
    </div>
  );
}

function ExpandableBetCard({
  bet,
  expanded,
  onToggle,
  liveOffer,
  onCopy,
  onCashOut,
  cashingOut,
  onViewDetails,
  onViewFullPage,
}) {
  const T = useTokens();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const expandRef = useRef(null);
  const [expandHeight, setExpandHeight] = useState(0);

  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';
  const status = bet.status || 'open';
  const ss = getStatusStyle(status);
  const isOpen = status === 'open';
  const isSettled = !isOpen;
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const isWon = status === 'won' || status === 'cashed_out';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');

  const displayOffer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
  const showCashout = displayOffer > 0 && isOpen;
  const offerStale = liveOffer && !liveOffer.cashOut;

  useEffect(() => {
    if (expanded && expandRef.current) {
      const h = expandRef.current.scrollHeight;
      setExpandHeight(h);
    } else {
      setExpandHeight(0);
    }
  }, [expanded, legs, bet]);

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook on this slip.', 'warn');
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 16,
        border: `1px solid ${T.line}`,
        overflow: 'hidden',
        transition: 'box-shadow 200ms, border-color 200ms',
        boxShadow: expanded ? `0 0 0 2px ${ss.bg}20` : 'none',
        borderColor: expanded ? `${ss.bg}40` : T.line,
      }}
    >
      <div style={{ height: 4, background: ss.bg }} />

      {/* ── Collapsed header ── */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 14px 0',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 999,
                background: ss.bg,
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
              }}
            >
              {ss.label}
            </span>
            <span
              style={{
                fontSize: 11,
                color: T.inkDim,
                fontWeight: 600,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                letterSpacing: 0.3,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onCopy?.();
              }}
              title="Copy booking code"
            >
              #{code}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, color: T.inkSoft }}>{placedAt(bet.placedAt || bet.createdAt)}</span>
            <ExpandChevron expanded={expanded} T={T} />
          </div>
        </div>

        {legs.map((leg, i) => (
          <div
            key={i}
            style={{
              padding: '7px 0',
              borderTop: i > 0 ? `1px solid ${T.line}` : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TeamLogo name={leg.home} logoUrl={leg.homeLogo} size={16} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{leg.home}</span>
                <span style={{ color: T.inkDim, fontWeight: 500, fontSize: 11 }}>vs</span>
                <TeamLogo name={leg.away} logoUrl={leg.awayLogo} size={16} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{leg.away}</span>
              </div>
              <div
                style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}
              >
                {leg.league && <span style={{ color: T.inkDim }}>{leg.league}</span>}
                <span>{leg.market || 'Match Result'}</span>
                <span style={{ color: T.greenBright, fontWeight: 600 }}>
                  {leg.pickLabel || leg.label || leg.pick || leg.key}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {Number(leg.odds || 0).toFixed(2)}
              </span>
              <SelectionDot status={legResult(leg)} />
            </div>
          </div>
        ))}

        {/* ── Selection progress bar ── */}
        <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
          {legs.map((leg, i) => {
            const lr = legResult(leg);
            return (
              <div
                key={i}
                title={`${leg.home || ''} vs ${leg.away || ''}: ${lr}`}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: LEG_STATUS_COLORS[lr] || '#374151',
                  opacity: lr === 'pending' ? 0.4 : 1,
                  transition: 'all 300ms',
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            marginTop: 8,
            paddingTop: 10,
            borderTop: `1px solid ${T.line}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: expanded ? 0 : 10,
          }}
        >
          <BetMeta label="Stake" value={`GHS ${fmtCedi(stake)}`} color={T.ink} T={T} />
          <BetMeta label="Odds" value={`${odds.toFixed(2)}x`} color={T.ink} T={T} />
          <BetMeta
            label={isSettled ? (isWon ? 'Payout' : 'Return') : 'Pot. Win'}
            value={`GHS ${fmtCedi(isSettled ? payout : potential)}`}
            color={isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright}
            T={T}
          />
          <BetMeta label="Type" value={betType} color={T.inkSoft} T={T} />
        </div>
      </div>

      {/* ── Expanded panel (animated) ── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expandHeight,
          transition: 'max-height 450ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={expandRef} style={{ padding: '0 14px 14px' }}>
          <div style={{ height: 1, background: T.line, margin: '0 0 12px' }} />

          {/* Cashout button for open bets */}
          {showCashout && (
            <button
              type="button"
              onClick={onCashOut}
              disabled={cashingOut}
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: 12,
                background: T.greenBright,
                color: T.goldDark,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 800,
                fontSize: 14,
                border: 0,
                cursor: cashingOut ? 'wait' : 'pointer',
                opacity: cashingOut ? 0.7 : 1,
                letterSpacing: 0.3,
                marginBottom: 12,
                transition: 'opacity 120ms',
              }}
            >
              {cashingOut ? 'Cashing out…' : `CASHOUT GHS ${fmtCedi(displayOffer)}`}
            </button>
          )}

          {!showCashout && offerStale && (
            <div style={{ marginBottom: 10, fontSize: 11, color: T.warn, textAlign: 'center', fontWeight: 600 }}>
              Cash-out temporarily unavailable.
            </div>
          )}

          {/* ── General Info ── */}
          <DetailSection title="General Information" T={T}>
            <InfoGrid T={T}>
              <InfoItem label="Bet ID" value={bet.id || '—'} mono T={T} />
              <InfoItem label="Booking Code" value={code} mono T={T} />
              <InfoItem label="Stake" value={`GHS ${fmtCedi(stake)}`} T={T} />
              <InfoItem label="Total Odds" value={`${odds.toFixed(2)}x`} T={T} />
              <InfoItem
                label={isSettled ? (isWon ? 'Actual Win' : 'Return') : 'Potential Win'}
                value={`GHS ${fmtCedi(isSettled ? payout : potential)}`}
                color={isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright}
                T={T}
              />
              <InfoItem
                label="Profit/Loss"
                value={`${isWon ? '+' : ''}GHS ${fmtCedi(isWon ? payout - stake : 0)}`}
                color={isWon ? '#16a34a' : '#dc2626'}
                T={T}
              />
              <InfoItem
                label="Status"
                value={<span style={{ color: ss.bg, fontWeight: 700 }}>{ss.label}</span>}
                T={T}
              />
              <InfoItem label="Bet Type" value={betType} T={T} />
              <InfoItem label="Selections" value={`${legs.length} leg${legs.length > 1 ? 's' : ''}`} T={T} />
              <InfoItem label="Placed" value={formatFullDate(bet.placedAt || bet.createdAt)} T={T} />
              {isSettled && <InfoItem label="Settled" value={formatFullDate(bet.settledAt || bet.cashOutAt)} T={T} />}
              {bet.cashOutAt && <InfoItem label="Cashout At" value={formatFullDate(bet.cashOutAt)} T={T} />}
              {bet.cashOut && (
                <InfoItem
                  label="Cashout Amount"
                  value={`GHS ${fmtCedi(Number(bet.cashOut))}`}
                  color={T.greenBright}
                  T={T}
                />
              )}
            </InfoGrid>
          </DetailSection>

          {/* ── Match Details ── */}
          {legs.length > 0 && (
            <DetailSection title="Match Details" T={T}>
              {legs.map((leg, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 6,
                    borderRadius: 12,
                    background: T.surfaceAlt,
                    border: `1px solid ${T.line}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <TeamLogo name={leg.home} logoUrl={leg.homeLogo} size={20} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                        {leg.home}
                        <span style={{ color: T.inkDim, fontWeight: 500, margin: '0 6px' }}>vs</span>
                        {leg.away}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 2,
                          fontSize: 11,
                          color: T.inkSoft,
                        }}
                      >
                        {leg.league && (
                          <>
                            <LeagueLogo name={leg.league} logoUrl={leg.leagueLogo} size={14} />
                            <span>{leg.league}</span>
                          </>
                        )}
                        {leg.country && <span>· {leg.country}</span>}
                        {leg.matchDate && <span>· {formatFullDate(leg.matchDate)}</span>}
                      </div>
                    </div>
                    {(leg.scoreHome != null || leg.scoreAway != null) && (
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: T.bg,
                          fontSize: 15,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: T.ink,
                        }}
                      >
                        {leg.scoreHome ?? '?'} - {leg.scoreAway ?? '?'}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: T.bg,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10.5, color: T.inkDim, fontWeight: 600 }}>Market</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{leg.market || 'Match Result'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10.5, color: T.inkDim, fontWeight: 600 }}>Selection</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.greenBright }}>
                        {leg.pickLabel || leg.label || leg.pick || leg.key}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10.5, color: T.inkDim, fontWeight: 600 }}>Odds</div>
                      <OddsDisplay initial={leg.initialOdds || leg.odds} current={leg.odds} T={T} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: T.inkDim, fontWeight: 600 }}>Status</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: LEG_STATUS_COLORS[legResult(leg)] || T.inkDim,
                        }}
                      >
                        {legResult(leg).toUpperCase()}
                        {legResult(leg) === 'live' && leg.minute != null && ` ${leg.minute}'`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </DetailSection>
          )}

          {/* ── Bet Timeline ── */}
          <DetailSection title="Bet Timeline" T={T}>
            <BetTimeline bet={bet} T={T} />
          </DetailSection>

          {/* ── Transaction Details ── */}
          <DetailSection title="Transaction Details" T={T}>
            <InfoGrid T={T}>
              {bet.walletBefore != null && (
                <InfoItem label="Wallet Before" value={`GHS ${fmtCedi(bet.walletBefore)}`} T={T} />
              )}
              <InfoItem label="Stake Debited" value={`-GHS ${fmtCedi(stake)}`} color="#dc2626" T={T} />
              {isWon && payout > 0 && (
                <InfoItem label="Winnings Credited" value={`+GHS ${fmtCedi(payout)}`} color="#16a34a" T={T} />
              )}
              {bet.cashOut != null && (
                <InfoItem
                  label="Cashout Credited"
                  value={`+GHS ${fmtCedi(Number(bet.cashOut))}`}
                  color="#2563eb"
                  T={T}
                />
              )}
              {bet.walletAfter != null && (
                <InfoItem label="Wallet After" value={`GHS ${fmtCedi(bet.walletAfter)}`} T={T} />
              )}
              {bet.transactionRef && <InfoItem label="Transaction Ref" value={bet.transactionRef} mono T={T} />}
              {bet.paymentRef && <InfoItem label="Payment Ref" value={bet.paymentRef} mono T={T} />}
            </InfoGrid>
          </DetailSection>

          {/* ── Booking Code ── */}
          <DetailSection title="Booking Code" T={T}>
            <div
              style={{
                textAlign: 'center',
                padding: '14px 0',
                background: T.surfaceAlt,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
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
                {code}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <CodeActionBtn
                  label="Copy Code"
                  onClick={() => {
                    navigator.clipboard?.writeText(code);
                    toast?.('Copied!');
                  }}
                  T={T}
                />
                <CodeActionBtn label="Rebook" onClick={handleRebook} T={T} primary />
                <CodeActionBtn label="Share" onClick={() => shareCode(code, toast)} T={T} />
                <CodeActionBtn label="Load Bet" onClick={() => navigate(`/code/${code}`)} T={T} />
              </div>
            </div>
          </DetailSection>

          {/* ── Cashout History ── */}
          {(bet.cashoutHistory || []).length > 0 && (
            <DetailSection title="Cashout History" T={T}>
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
                    <div style={{ fontSize: 10.5, color: T.inkSoft }}>{formatFullDate(ch.createdAt)}</div>
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
            </DetailSection>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 14px 10px',
          borderTop: expanded ? `1px solid ${T.line}` : 'none',
        }}
      >
        <ActionBtn
          icon="chevDown"
          label={expanded ? 'Collapse' : 'Expand'}
          onClick={onToggle}
          active={expanded}
          T={T}
        />
        {onViewDetails && <ActionBtn icon="info" label="Details" onClick={onViewDetails} T={T} />}
        {onViewFullPage && <ActionBtn icon="external" label="Full View" onClick={onViewFullPage} T={T} />}
        <ActionBtn icon="refresh" label="Rebook" onClick={handleRebook} T={T} />
        <ActionBtn icon="copy" label="Copy" onClick={onCopy} T={T} />
        <ActionBtn icon="upload" label="Share" onClick={() => shareCode(code, toast)} T={T} />
      </div>
    </div>
  );
}

function ExpandChevron({ expanded, T }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={T.inkDim}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 300ms',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SelectionDot({ status }) {
  const color = LEG_STATUS_COLORS[status] || '#374151';
  if (status === 'live') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          animation: 'pulse 1.5s infinite',
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        opacity: status === 'pending' ? 0.4 : 1,
      }}
    />
  );
}

function BetMeta({ label, value, color, T }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: T.inkDim, fontWeight: 600, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function DetailSection({ title, children, T }) {
  return (
    <div style={{ marginBottom: 14 }}>
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
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ children, T }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: T.surfaceAlt,
        border: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

function InfoItem({ label, value, color, mono, T }) {
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

function OddsDisplay({ initial, current, T }) {
  if (!initial || initial === current) {
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
        {Number(current || 0).toFixed(2)}
      </span>
    );
  }
  const change = current - initial;
  const isUp = change > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: T.inkDim, textDecoration: 'line-through' }}>{initial.toFixed(2)}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: isUp ? '#16a34a' : '#dc2626',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {current.toFixed(2)}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#16a34a' : '#dc2626' }}>{isUp ? '↑' : '↓'}</span>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active, T }) {
  const [hovered, setHovered] = useState(false);

  const icons = {
    chevDown: 'M6 9l6 6 6-6',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-13h-2v2h2V7Zm0 4h-2v6h2v-6Z',
    external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3',
    refresh:
      'M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z',
    copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5-5 5 5m-5 7V5',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '7px 0',
        borderRadius: 8,
        background: active || hovered ? `${T.greenBright}15` : 'transparent',
        border: 0,
        cursor: 'pointer',
        color: active ? T.greenBright : hovered ? T.greenBright : T.inkSoft,
        fontWeight: 700,
        fontSize: 10.5,
        transition: 'all 120ms',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={icons[icon] || icons.info} />
      </svg>
      {label}
    </button>
  );
}

function CodeActionBtn({ label, onClick, primary, T }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: 0,
        background: primary ? T.greenBright : hovered ? `${T.greenBright}20` : T.surfaceAlt,
        color: primary ? T.goldDark : hovered ? T.greenBright : T.ink,
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

function EmptyState({ icon, title, hint }) {
  const T = useTokens();
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 999,
          background: T.surface,
          border: `1px solid ${T.line}`,
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <OddIcon name={icon} size={26} color={T.inkDim} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>{title}</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function SignedOutState({ navigate }) {
  const T = useTokens();
  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="My Bets" subtitle="Sign in to view your slips" />
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <OddIcon name="lock" size={32} color={T.inkDim} />
        <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>Sign in to see your bets</div>
        <button
          type="button"
          onClick={() => navigate('/login?next=/my-bets')}
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
