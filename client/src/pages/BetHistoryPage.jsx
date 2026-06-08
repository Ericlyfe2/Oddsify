import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  RotateCcw,
  Share2,
  ChevronDown,
  ChevronRight,
  Wallet,
  Trophy,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Search,
  TrendingUp,
  TrendingDown,
  Zap,
  RefreshCw,
  Ban,
  Info,
  ArrowLeft,
  Filter,
  Calendar,
  X,
} from 'lucide-react';
import { fetchBetHistory, cashOutBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import CashoutConfirmModal from '../components/CashoutConfirmModal.jsx';
import CashoutSuccessOverlay from '../components/CashoutSuccessOverlay.jsx';
import BetTimeline from '../components/BetTimeline.jsx';

// ─── Design System ───────────────────────────────────────────────
const theme = {
  navy: '#0B1F3A',
  green: '#1FAA4A',
  greenBright: '#22C55E',
  greenSoft: '#16a34a',
  greenLight: '#DCFCE7',
  red: '#DC2626',
  redLight: '#FEE2E2',
  blue: '#2563EB',
  blueLight: '#DBEAFE',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  pageBg: '#F0F2F5',
  cardBg: '#FFFFFF',
  bodyText: '#1F2937',
  muted: '#6B7280',
  lightMuted: '#9CA3AF',
  divider: '#E5E7EB',
  border: '#E2E5EA',
  grayChip: '#F3F4F6',
  filterChipBg: '#F0F2F5',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
  radius: 10,
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
};

const STATUS_CONFIG = {
  won: { bg: theme.greenLight, text: theme.greenSoft, icon: CheckCircle2, label: 'Won', dot: theme.green },
  lost: { bg: theme.redLight, text: theme.red, icon: XCircle, label: 'Lost', dot: theme.red },
  cashed_out: { bg: theme.blueLight, text: theme.blue, icon: Copy, label: 'Cashed Out', dot: theme.blue },
  pending: { bg: theme.amberLight, text: theme.amber, icon: Clock, label: 'Pending', dot: theme.amber },
  open: { bg: theme.amberLight, text: theme.amber, icon: Clock, label: 'Open', dot: theme.amber },
  void: { bg: '#F3F4F6', text: theme.muted, icon: Ban, label: 'Void', dot: theme.muted },
  cancelled: { bg: '#F3F4F6', text: theme.muted, icon: Ban, label: 'Cancelled', dot: theme.lightMuted },
};

const LEG_STATUS = {
  won: { color: theme.green, bg: theme.greenLight, label: 'W', dot: '•' },
  lost: { color: theme.red, bg: theme.redLight, label: 'L', dot: '×' },
  live: { color: theme.blue, bg: theme.blueLight, label: '●', dot: '●' },
  pending: { color: theme.amber, bg: theme.amberLight, label: '⌛', dot: '○' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'cashout', label: 'Cashout' },
  { key: 'live', label: 'Live' },
];

// ─── Helpers ─────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toFixed(2);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  if (leg.status === 'won' || leg.won === true) return 'won';
  if (leg.status === 'lost' || leg.won === false) return 'lost';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
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

function isBetOpen(bet) {
  return bet.status === 'open' || bet.status === 'pending';
}

// ─── Component ───────────────────────────────────────────────────
export default function BetHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account, refresh } = useAccount();
  const { toast } = useToast();
  const { cashoutOffers, updateCashoutOffer } = useSlip();

  const [tab, setTab] = useState(searchParams.get('tab') === 'hist' ? 'history' : 'open');
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [cashoutTarget, setCashoutTarget] = useState(null);
  const [cashoutOffer, setCashoutOffer] = useState(null);
  const cashoutBusyRef = useRef(false);
  const [cashingOut, setCashingOut] = useState(null);
  const [cashoutSuccess, setCashoutSuccess] = useState(null);
  const [cashoutSuccessAmount, setCashoutSuccessAmount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBetHistory();
      setBets(data?.bets || data?.history || []);
    } catch (e) {
      setError(e?.body?.error || e?.message || 'Failed to load bets');
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account) load();
    else {
      setLoading(false);
      setBets([]);
    }
  }, [account, load]);

  useEffect(() => {
    if (!account) return;
    const off = onLive('cashout:offer', (payload) => {
      if (payload?.betId && typeof payload.cashOut === 'number') {
        updateCashoutOffer(payload.betId, payload);
      }
    });
    return () => off?.();
  }, [account, updateCashoutOffer]);

  useEffect(() => {
    if (!account) return;
    const off = onLive('bet:settled', () => {
      load();
    });
    return () => off?.();
  }, [account, load]);

  const openBets = useMemo(() => bets.filter((b) => isBetOpen(b)), [bets]);
  const settledBets = useMemo(() => bets.filter((b) => !isBetOpen(b)), [bets]);
  const filteredOpen = useMemo(() => {
    let f = filterBets(openBets, filter);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((b) => {
        const code = (b.bookingCode || b.code || '').toLowerCase();
        const legs = b.legs || b.selections || [];
        const matchText = legs
          .map((l) => `${l.home || ''} ${l.away || ''}`)
          .join(' ')
          .toLowerCase();
        return code.includes(q) || matchText.includes(q);
      });
    }
    return f;
  }, [openBets, filter, search]);

  const openCashoutConfirm = (bet) => {
    const offer = cashoutOffers[bet.id];
    const value = offer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
    if (value <= 0) {
      toast('Cash-out not currently available.', 'warn');
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
      await cashOutBet(cashoutTarget.id, cashoutOffer);
      setCashoutSuccess(cashoutTarget);
      setCashoutSuccessAmount(cashoutOffer);
      setCashoutTarget(null);
      setCashoutOffer(null);
      await refresh();
      await load();
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Cash-out failed.', 'error');
    } finally {
      setCashingOut(null);
      cashoutBusyRef.current = false;
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (!account) return <SignedOutState navigate={navigate} />;
  if (error && bets.length === 0) return <ErrorState message={error} onRetry={load} navigate={navigate} />;

  const balance = Number(account.balance || 0);
  const isOpen = tab === 'open';
  const displayBets = isOpen ? filteredOpen : settledBets;

  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: theme.navy }}>
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 414,
          minHeight: '100vh',
          background: theme.pageBg,
          fontFamily: theme.font,
          paddingBottom: 88,
        }}
      >
        {/* ─── Tab Bar ─── */}
        <TabBar openCount={openBets.length} activeTab={tab} onTabChange={setTab} balance={balance} />

        {/* ─── Filter Bar ─── */}
        <FilterBar
          isOpen={isOpen}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
        />

        {/* ─── Body ─── */}
        <div style={{ padding: '12px 12px 16px' }}>
          {loading ? (
            <SkeletonBlock />
          ) : displayBets.length === 0 ? (
            <EmptyState
              icon={isOpen ? Clock : Trophy}
              title={
                isOpen
                  ? search
                    ? 'No bets match your search'
                    : filter !== 'all'
                      ? 'No bets match this filter'
                      : 'No open bets'
                  : 'No bet history yet'
              }
              hint={
                isOpen
                  ? 'Tap odds on a match to build a slip and place your first bet.'
                  : 'Settled bets will appear here once you start betting.'
              }
              actionLabel={isOpen ? 'Browse Sports' : 'Start Betting'}
              onAction={() => navigate('/')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  isOpen={isOpen}
                  expanded={expandedId === bet.id}
                  onToggle={() => toggleExpand(bet.id)}
                  liveOffer={isOpen ? cashoutOffers[bet.id] || null : null}
                  cashingOut={cashingOut === bet.id}
                  onCashOut={() => openCashoutConfirm(bet)}
                  onDetails={() => navigate(`/bets/${bet.id}`)}
                  onRebook={(e) => handleRebook(e, bet, navigate, toast)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
        onViewBets={() => setCashoutSuccess(null)}
      />
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────
function TabBar({ openCount, activeTab, onTabChange, balance }) {
  return (
    <div className="relative flex" style={{ height: 48, background: theme.navy }}>
      {['open', 'history'].map((t) => {
        const active = activeTab === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className="flex-1 flex items-center justify-center"
            style={{
              background: active ? '#FFFFFF' : theme.navy,
              color: active ? theme.navy : '#FFFFFF',
              fontWeight: active ? 600 : 500,
              fontSize: 14,
              borderTopLeftRadius: t === 'open' ? 8 : 8,
              borderTopRightRadius: t === 'history' ? 8 : 8,
              border: 0,
              outline: 'none',
              cursor: 'pointer',
              transition: 'background 150ms',
              letterSpacing: '-0.01em',
            }}
            aria-selected={active}
            role="tab"
          >
            {t === 'open' ? `Open Bets (${openCount})` : 'Bet History'}
          </button>
        );
      })}
      <div
        className="absolute flex items-center gap-1"
        style={{
          top: 8,
          right: 12,
          background: theme.green,
          padding: '4px 10px',
          borderRadius: 999,
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: 600,
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        <Wallet size={12} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>GHS {fmt(balance)}</span>
      </div>
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────
function FilterBar({ isOpen, filter, onFilterChange, search, onSearchChange }) {
  return (
    <div style={{ background: '#FFFFFF', borderBottom: `1px solid ${theme.divider}` }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 16px' }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
                className="select-none"
                style={{
                  background: active ? theme.navy : '#F0F2F5',
                  color: active ? '#FFFFFF' : theme.bodyText,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 0,
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                  whiteSpace: 'nowrap',
                }}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div
            className="flex items-center"
            style={{
              background: '#F0F2F5',
              borderRadius: 999,
              padding: '4px 4px 4px 12px',
              transition: 'all 150ms',
              border: search ? `1px solid ${theme.green}` : '1px solid transparent',
            }}
          >
            <Search size={14} color={theme.muted} />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by code or team..."
              style={{
                background: 'none',
                border: 0,
                outline: 'none',
                fontSize: 12,
                color: theme.bodyText,
                padding: '6px 8px',
                width: search ? 120 : 80,
                transition: 'width 200ms',
              }}
              aria-label="Search bets by booking code or team name"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', outline: 'none' }}
                aria-label="Clear search"
              >
                <X size={14} color={theme.muted} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bet Card ────────────────────────────────────────────────────
function BetCard({ bet, isOpen, expanded, onToggle, liveOffer, cashingOut, onCashOut, onDetails, onRebook }) {
  const { toast } = useToast();
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const legs = bet.legs || bet.selections || [];
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const code = bet.bookingCode || bet.code || '—';
  const codeUpper = code.toUpperCase();
  const status = bet.status || (isOpen ? 'open' : 'pending');
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;
  const isSettled = !isBetOpen(bet);
  const isCashedOut = status === 'cashed_out';
  const isWon = status === 'won' || isCashedOut;
  const isLost = status === 'lost';
  const offer = isOpen ? liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0 : 0;
  const placed = new Date(bet.placedAt || bet.createdAt || Date.now());
  const profitLoss = isSettled ? (isWon ? payout - stake : 0 - stake) : 0;
  const hasLiveLeg = legs.some((l) => l.isLive || l.status === 'live');

  useEffect(() => {
    if (expanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [expanded, legs]);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(codeUpper)
      .then(() => toast('Code copied!', 'success'))
      .catch(() => {});
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = typeof window !== 'undefined' ? `${window.location.origin}/code/${code}` : `/code/${code}`;
    if (navigator.share)
      navigator.share({ title: 'Oddsify Bet', text: `Booking Code: ${codeUpper}`, url }).catch(() => {});
    else
      navigator.clipboard
        .writeText(url)
        .then(() => toast('Link copied!', 'success'))
        .catch(() => {});
  };

  // Build progress bar data
  const legResults = legs.map(legResult);
  const wonCount = legResults.filter((r) => r === 'won').length;
  const lostCount = legResults.filter((r) => r === 'lost').length;
  const totalLegs = legResults.length;

  return (
    <div
      className="select-none"
      style={{
        background: theme.cardBg,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        overflow: 'hidden',
        transition: 'box-shadow 200ms',
      }}
    >
      {/* ─── Card Header (always visible) ─── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        style={{
          background: 'none',
          border: 0,
          padding: '14px 16px 12px',
          cursor: 'pointer',
          outline: 'none',
          width: '100%',
        }}
        aria-expanded={expanded}
        aria-label={`${betType} bet, ${status}, ${legs.length} selections`}
      >
        {/* Top row: Status badge + Booking code + Chevron */}
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 999,
                background: sc.bg,
                color: sc.text,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              <StatusIcon size={12} />
              {sc.label}
            </span>
            {hasLiveLeg && (
              <span className="flex items-center gap-1" style={{ color: theme.blue, fontSize: 11, fontWeight: 600 }}>
                <Zap size={12} fill={theme.blue} />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span
              style={{ fontSize: 11, fontFamily: theme.mono, color: theme.muted, fontWeight: 600, letterSpacing: 0.3 }}
            >
              #{codeUpper}
            </span>
            <ChevronDown
              size={16}
              color={theme.muted}
              style={{
                transition: 'transform 250ms',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </div>

        {/* Middle row: Bet Type + Date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: theme.navy }}>{betType}</span>
            {legs.length > 1 && (
              <span
                style={{
                  fontSize: 11,
                  color: theme.muted,
                  fontWeight: 500,
                  background: theme.grayChip,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {legs.length}-fold
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: theme.lightMuted, fontWeight: 500 }}>
            {fmtDate(bet.placedAt || bet.createdAt)}
          </span>
        </div>

        {/* Selection progress bar */}
        {legs.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
              {legResults.map((r, i) => {
                const ls = LEG_STATUS[r] || LEG_STATUS.pending;
                return (
                  <span
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        r === 'won'
                          ? theme.green
                          : r === 'lost'
                            ? theme.red
                            : r === 'live'
                              ? theme.blue
                              : theme.divider,
                      display: 'inline-block',
                      transition: 'background 300ms',
                    }}
                    title={`Selection ${i + 1}: ${r}`}
                  />
                );
              })}
            </div>
            <div
              style={{
                flex: 1,
                height: 3,
                background: theme.divider,
                borderRadius: 999,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {wonCount > 0 && <div style={{ height: '100%', background: theme.green, flex: wonCount }} />}
              {lostCount > 0 && <div style={{ height: '100%', background: theme.red, flex: lostCount }} />}
              {totalLegs - wonCount - lostCount > 0 && (
                <div style={{ height: '100%', background: theme.amber, flex: totalLegs - wonCount - lostCount }} />
              )}
            </div>
          </div>
        )}

        {/* Stake / Odds / Payout row */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.divider}` }}
        >
          <StatItem label="Stake" value={`GHS ${fmt(stake)}`} />
          <StatItem label="Odds" value={`${Number(odds).toFixed(2)}`} />
          <StatItem
            label={isSettled ? 'Payout' : 'Potential'}
            value={`GHS ${fmt(isSettled ? payout : potential)}`}
            valueColor={isSettled ? (isWon ? theme.green : theme.muted) : theme.navy}
          />
          {isSettled && (
            <StatItem
              label="P/L"
              value={`${profitLoss >= 0 ? '+' : ''}GHS ${fmt(Math.abs(profitLoss))}`}
              valueColor={isWon ? theme.green : theme.red}
            />
          )}
        </div>
      </button>

      {/* ─── Expanded Content ─── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: contentHeight,
          transition: 'max-height 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div ref={contentRef} style={{ borderTop: `1px solid ${theme.divider}` }}>
          <div style={{ padding: '14px 16px 16px' }}>
            {/* Selections detail */}
            <SectionTitle text={isOpen ? `Selections (${legs.length})` : 'Selections'} />
            {legs.map((leg, i) => (
              <SelectionRow key={i} leg={leg} status={legResult(leg)} />
            ))}

            {/* Match info */}
            {(isOpen || isSettled) && (
              <>
                <SectionTitle text="Match Information" style={{ marginTop: 14 }} />
                <div style={{ background: theme.grayChip, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  {legs.map((leg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                      style={{
                        padding: '6px 0',
                        borderBottom: i < legs.length - 1 ? `1px solid ${theme.divider}` : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.bodyText }}>
                          {leg.home || 'Home'} vs {leg.away || 'Away'}
                        </div>
                        <div style={{ fontSize: 11, color: theme.lightMuted, marginTop: 2 }}>
                          {leg.league && `${leg.league}${leg.country ? ` · ${leg.country}` : ''}`}
                          {leg.matchDate && ` · ${fmtDate(leg.matchDate)}`}
                        </div>
                      </div>
                      {(leg.scoreHome != null || leg.scoreAway != null) && (
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: theme.navy,
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                            marginLeft: 12,
                          }}
                        >
                          {leg.scoreHome ?? '?'} - {leg.scoreAway ?? '?'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Bet Timeline */}
            {isSettled && (
              <>
                <SectionTitle text="Timeline" style={{ marginTop: 14 }} />
                <div style={{ marginBottom: 14 }}>
                  <BetTimeline bet={bet} />
                </div>
              </>
            )}

            {/* Transaction Details */}
            {isSettled && (
              <>
                <SectionTitle text="Transaction Details" />
                <div style={{ background: theme.grayChip, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <DetailRow label="Stake" value={`GHS ${fmt(stake)}`} />
                  <DetailRow label="Total Odds" value={`${Number(odds).toFixed(3)}x`} />
                  {isWon && <DetailRow label="Payout" value={`GHS ${fmt(payout)}`} valueColor={theme.green} />}
                  {isCashedOut && (
                    <DetailRow
                      label="Cashout Amount"
                      value={`GHS ${fmt(Number(bet.cashOut || 0))}`}
                      valueColor={theme.blue}
                    />
                  )}
                  <DetailRow
                    label="Profit / Loss"
                    value={`${profitLoss >= 0 ? '+' : ''}GHS ${fmt(Math.abs(profitLoss))}`}
                    valueColor={isWon ? theme.green : theme.red}
                  />
                  {bet.transactionRef && <DetailRow label="Transaction ID" value={bet.transactionRef} mono />}
                  {bet.placedAt && <DetailRow label="Placed" value={fmtFull(bet.placedAt)} />}
                  {bet.settledAt && <DetailRow label="Settled" value={fmtFull(bet.settledAt)} />}
                  {bet.cashOutAt && <DetailRow label="Cashed Out" value={fmtFull(bet.cashOutAt)} />}
                </div>
              </>
            )}

            {/* Booking Code Actions */}
            <SectionTitle text="Booking Code" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{ fontSize: 14, fontWeight: 800, fontFamily: theme.mono, color: theme.navy, letterSpacing: 1 }}
              >
                {codeUpper}
              </span>
              <button type="button" onClick={handleCopy} style={actionBtnStyle} aria-label="Copy booking code">
                <Copy size={13} /> Copy
              </button>
              <button
                type="button"
                onClick={onRebook}
                style={{ ...actionBtnStyle, background: theme.green, color: '#fff' }}
                aria-label="Rebook"
              >
                <RotateCcw size={13} /> Rebook
              </button>
              <button type="button" onClick={handleShare} style={actionBtnStyle} aria-label="Share bet">
                <Share2 size={13} /> Share
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDetails();
                }}
                style={actionBtnStyle}
                aria-label="Full details"
              >
                <ExternalLink size={13} /> Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Cashout Button ─── */}
      {isOpen && offer > 0 && (
        <div style={{ padding: '0 16px 14px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCashOut();
            }}
            disabled={cashingOut}
            className="w-full flex items-center justify-center"
            style={{
              background: theme.green,
              borderRadius: 8,
              border: 0,
              outline: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.2,
              padding: '13px 0',
              cursor: cashingOut ? 'wait' : 'pointer',
              opacity: cashingOut ? 0.7 : 1,
              gap: 8,
              transition: 'background 150ms, transform 100ms',
              boxShadow: '0 4px 14px rgba(31,170,74,0.3)',
            }}
            onMouseEnter={(e) => {
              if (!cashingOut) e.currentTarget.style.background = '#1B9740';
            }}
            onMouseLeave={(e) => {
              if (!cashingOut) e.currentTarget.style.background = theme.green;
            }}
          >
            {cashingOut ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" /> Cashing out…
              </span>
            ) : (
              <>
                <Zap size={16} /> Cashout GHS {fmt(offer)} <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────
function StatItem({ label, value, valueColor }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 9.5,
          color: theme.muted,
          fontWeight: 500,
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 13, fontWeight: 700, color: valueColor || theme.navy, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
    </div>
  );
}

function SelectionRow({ leg, status: rs }) {
  const ls = LEG_STATUS[rs] || LEG_STATUS.pending;
  const oddsAtPlacement = Number(leg.initialOdds || leg.odds || 0);
  const currentOdds = Number(leg.odds || 0);
  const oddsChange = currentOdds - oddsAtPlacement;
  const hasOddsMovement = leg.initialOdds && Math.abs(oddsChange) > 0.001;

  return (
    <div
      className="flex items-center"
      style={{
        padding: '8px 10px',
        marginBottom: 6,
        borderRadius: 8,
        background:
          rs === 'won'
            ? theme.greenLight
            : rs === 'lost'
              ? theme.redLight
              : rs === 'live'
                ? theme.blueLight
                : theme.grayChip,
        border: rs === 'live' ? `1px solid ${theme.blue}40` : '1px solid transparent',
        transition: 'all 200ms',
        gap: 10,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: ls.color,
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {rs === 'won' ? 'W' : rs === 'lost' ? 'L' : rs === 'live' ? '●' : '—'}
        </span>
      </div>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: theme.navy }}>
            {leg.pickLabel || leg.label || leg.pick || leg.key || 'Selection'}
          </span>
          <span style={{ fontWeight: 400, fontSize: 12, color: theme.lightMuted }}>
            @ {Number(oddsAtPlacement || leg.odds || 0).toFixed(2)}
          </span>
          <span
            style={{
              fontWeight: 400,
              fontSize: 11,
              color: theme.lightMuted,
              background: theme.grayChip,
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {leg.market || '1X2'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: theme.bodyText, marginTop: 2 }}>
          {leg.home || 'Home'} vs {leg.away || 'Away'}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {hasOddsMovement && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 11,
              fontWeight: 600,
              color: oddsChange > 0 ? theme.green : theme.red,
            }}
          >
            {oddsChange > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {oddsChange > 0 ? '+' : ''}
            {oddsChange.toFixed(2)}
          </div>
        )}
        {rs === 'live' && (
          <span className="flex items-center gap-1" style={{ fontSize: 10, color: theme.blue, fontWeight: 700 }}>
            <Zap size={10} /> LIVE
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ text, style: extraStyle }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: theme.muted,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 7,
        ...extraStyle,
      }}
    >
      {text}
    </div>
  );
}

function DetailRow({ label, value, valueColor, mono }) {
  return (
    <div className="flex justify-between" style={{ padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: theme.muted, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: valueColor || theme.bodyText,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: mono ? theme.mono : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const actionBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 10px',
  borderRadius: 6,
  background: theme.grayChip,
  color: theme.bodyText,
  border: 0,
  outline: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  transition: 'background 120ms',
};

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div
      style={{
        background: theme.cardBg,
        borderRadius: theme.radius,
        padding: '48px 24px',
        textAlign: 'center',
        boxShadow: theme.shadow,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: '#F0F2F5',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon && <Icon size={28} color={theme.lightMuted} />}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, color: theme.navy, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>{hint}</div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 20,
            padding: '12px 28px',
            background: theme.green,
            color: '#FFFFFF',
            border: 0,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'background 150ms, transform 100ms',
            boxShadow: '0 4px 14px rgba(31,170,74,0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1B9740';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.green;
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────
function ErrorState({ message, onRetry, navigate }) {
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: theme.navy }}>
      <div
        className="w-full flex flex-col"
        style={{ maxWidth: 414, minHeight: '100vh', background: theme.pageBg, fontFamily: theme.font }}
      >
        <div style={{ height: 48, background: theme.navy }} />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: theme.redLight,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={28} color={theme.red} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.navy, marginBottom: 4 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: theme.muted, marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
            {message}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: '12px 24px',
                background: theme.green,
                color: '#FFFFFF',
                border: 0,
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                padding: '12px 24px',
                background: theme.grayChip,
                color: theme.bodyText,
                border: 0,
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Signed Out State ────────────────────────────────────────────
function SignedOutState({ navigate }) {
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: theme.navy }}>
      <div
        className="w-full"
        style={{ maxWidth: 414, minHeight: '100vh', background: theme.pageBg, fontFamily: theme.font }}
      >
        <div style={{ height: 48, background: theme.navy }} />
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎲</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: theme.navy, marginBottom: 6 }}>
            Sign in to view your bets
          </div>
          <div style={{ fontSize: 13, color: theme.muted, marginBottom: 20 }}>
            Track your open bets, cash out, and review your betting history.
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/my-bets')}
            style={{
              padding: '12px 28px',
              background: theme.green,
              color: '#FFFFFF',
              border: 0,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(31,170,74,0.3)',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────
function SkeletonBlock() {
  return (
    <div>
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: theme.cardBg,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: '16px',
            marginBottom: 12,
          }}
        >
          <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
            <div style={{ width: 90, height: 20, background: '#E5E7EB', borderRadius: 999 }} />
            <div style={{ width: 80, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
          </div>
          <div style={{ width: '40%', height: 14, background: '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: '100%', height: 4, background: '#E5E7EB', borderRadius: 999, marginBottom: 10 }} />
          <div className="flex justify-between" style={{ paddingTop: 8, borderTop: `1px solid ${theme.divider}` }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 50, height: 10, background: '#E5E7EB', borderRadius: 4, marginBottom: 4 }} />
              <div style={{ width: 40, height: 14, background: '#E5E7EB', borderRadius: 4, margin: '0 auto' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 50, height: 10, background: '#E5E7EB', borderRadius: 4, marginBottom: 4 }} />
              <div style={{ width: 40, height: 14, background: '#E5E7EB', borderRadius: 4, margin: '0 auto' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 50, height: 10, background: '#E5E7EB', borderRadius: 4, marginBottom: 4 }} />
              <div style={{ width: 40, height: 14, background: '#E5E7EB', borderRadius: 4, margin: '0 auto' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Rebook helper ───────────────────────────────────────────────
function handleRebook(e, bet, navigate, toast) {
  e.stopPropagation();
  const legs = bet.legs || bet.selections || [];
  if (!legs.length) {
    toast('No selections to rebook.', 'warn');
    return;
  }
  const code = bet.bookingCode || bet.code || bet.id;
  if (bet.bookingCode) {
    navigate(`/code/${bet.bookingCode}?rebook=1`);
  } else {
    navigate(`/?rebook=${bet.id}`);
  }
}
