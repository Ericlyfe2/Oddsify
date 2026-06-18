import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  RotateCcw,
  Share2,
  ChevronDown,
  ChevronUp,
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
  Sun,
  Moon,
  X,
  Crosshair,
  Play,
  Pencil,
  LayoutGrid,
  Calendar,
  FileDown,
} from 'lucide-react';
import { fetchBetHistory, cashOutBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { useTokens, fmtCedi } from '../components/odd/tokens.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { expandMarketName, getSelectionLabel } from '../lib/marketNames.js';
import CashoutConfirmModal from '../components/CashoutConfirmModal.jsx';
import CashoutSuccessOverlay from '../components/CashoutSuccessOverlay.jsx';
import BetTimeline from '../components/BetTimeline.jsx';

const MONO = 'var(--font-mono, "JetBrains Mono", "SF Mono", monospace)';
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'cashout', label: 'Cashout Available' },
  { key: 'live', label: 'Live Games' },
];

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

function handleRebook(e, bet, navigate, toast) {
  e.stopPropagation();
  const legs = bet.legs || bet.selections || [];
  if (!legs.length) {
    toast('No selections to rebook.', 'warn');
    return;
  }
  const code = bet.bookingCode || bet.code || bet.id;
  if (bet.bookingCode) navigate(`/code/${bet.bookingCode}?rebook=1`);
  else navigate(`/?rebook=${bet.id}`);
}

// ─── Main Component ──────────────────────────────────────────────
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
    <div className="min-h-screen flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full flex flex-col" style={{ maxWidth: 414, minHeight: '100vh', background: 'var(--bg)' }}>
        <TabBar openCount={openBets.length} activeTab={tab} onTabChange={setTab} balance={balance} />
        <FilterBar filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} />

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {displayBets.map((bet) =>
                isOpen ? (
                  <OpenBetCard
                    key={bet.id}
                    bet={bet}
                    liveOffer={cashoutOffers[bet.id] || null}
                    cashingOut={cashingOut === bet.id}
                    onCashOut={() => openCashoutConfirm(bet)}
                    onDetails={() => navigate(`/bets/${bet.id}`)}
                    onRebook={(e) => handleRebook(e, bet, navigate, toast)}
                  />
                ) : (
                  <HistoryRow
                    key={bet.id}
                    bet={bet}
                    onOpen={() => navigate(`/bets/${bet.id}`)}
                    onRebook={(e) => handleRebook(e, bet, navigate, toast)}
                  />
                ),
              )}
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
  const T = useTokens();
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="relative flex"
      style={{ position: 'relative', display: 'flex', height: 48, background: 'var(--surface)' }}
    >
      {['open', 'history'].map((t) => {
        const active = activeTab === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className="flex-1 flex items-center justify-center"
            style={{
              background: active ? 'var(--bg)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              fontWeight: active ? 600 : 500,
              fontSize: 14,
              borderTopLeftRadius: t === 'open' ? 8 : 8,
              borderTopRightRadius: t === 'history' ? 8 : 8,
              border: 0,
              outline: 'none',
              cursor: 'pointer',
              transition: 'all 150ms',
              letterSpacing: '-0.01em',
            }}
            aria-selected={active}
            role="tab"
          >
            {t === 'open' ? `Open Bets (${openCount})` : 'Bet History'}
          </button>
        );
      })}

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute flex items-center justify-center"
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          top: 8,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 999,
          border: `1px solid var(--line)`,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 150ms',
          zIndex: 10,
        }}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
      </button>

      {/* Balance */}
      <div
        className="absolute flex items-center gap-1"
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          top: 8,
          right: 44,
          background: 'var(--accent)',
          padding: '4px 10px',
          borderRadius: 999,
          color: 'var(--gold-ink)',
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
function FilterBar({ filter, onFilterChange, search, onSearchChange }) {
  const T = useTokens();

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
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
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? 'var(--gold-ink)' : 'var(--text-soft)',
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
              background: 'var(--surface-2)',
              borderRadius: 999,
              padding: '4px 4px 4px 12px',
              transition: 'all 150ms',
              border: search ? '1px solid var(--accent)' : '1px solid transparent',
            }}
          >
            <Search size={14} color="var(--text-dim)" />
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
                color: 'var(--text)',
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
                <X size={14} color="var(--text-dim)" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bet Card ────────────────────────────────────────────────────
// ─── OpenBetCard — design port (SportyBet layout / Oddsify gold) ────
function OpenBetCard({ bet, liveOffer, cashingOut, onCashOut, onDetails, onRebook }) {
  const [open, setOpen] = useState(true);
  const legs = bet.legs || bet.selections || [];
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const offer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;

  const actions = [
    { Icon: RotateCcw, label: 'Rebet', handler: onRebook },
    { Icon: Play, label: 'SIM', handler: null },
    { Icon: Share2, label: null, handler: null },
    { Icon: Pencil, label: 'Edit Bet', handler: onDetails },
  ];

  return (
    <div>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md, 10px)',
          padding: '14px 16px',
          boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.12))',
          border: '1px solid var(--line)',
        }}
      >
        {/* Header: type + Rebet/SIM/Share/Edit actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{betType}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {actions.map(({ Icon, label, handler }, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handler?.(e);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--accent)',
                }}
                aria-label={label || 'Share'}
              >
                <Icon size={14} />
                {label && <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Selection rows */}
        {legs.map((leg, i) => (
          <SelectionRow key={i} leg={leg} last={i === legs.length - 1} />
        ))}

        {/* Hide/Show match details toggle */}
        <div style={{ borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              width: '100%',
              gap: 4,
              padding: '10px 0',
              background: 'none',
              border: 0,
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {open ? 'Hide Match Details' : 'Show Match Details'}
            <span
              style={{
                display: 'inline-flex',
                transition: 'transform 200ms',
                transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            >
              <ChevronUp size={14} />
            </span>
          </button>
        </div>

        {/* Stake / Pot. Win — gated by toggle */}
        {open && (
          <div>
            {[
              { l: 'Stake', v: stake },
              { l: 'Pot. Win', v: potential },
            ].map(({ l, v }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-soft)', fontSize: 13, fontWeight: 500 }}>{l}</span>
                <span
                  style={{
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: MONO,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gold Cashout CTA with Zap left + Chevron right */}
      {offer > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCashOut();
          }}
          disabled={cashingOut}
          style={{
            marginTop: 12,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: 'var(--gold-ink)',
            fontWeight: 700,
            fontSize: 15,
            padding: '14px 0',
            borderRadius: 'var(--r-btn, 8px)',
            border: 0,
            cursor: cashingOut ? 'wait' : 'pointer',
            opacity: cashingOut ? 0.7 : 1,
            boxShadow: 'var(--shadow-cta, 0 4px 14px rgba(232,185,74,0.3))',
            transition: 'transform 100ms',
          }}
        >
          {cashingOut ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Cashing out…
            </>
          ) : (
            <>
              <Zap size={16} /> Cashout GHS {fmt(offer)} <ChevronRight size={16} />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── SelectionRow — clock + crosshair + underlined match name ────
function SelectionRow({ leg, last }) {
  const pick = getSelectionLabel(leg);
  const market = leg.marketName || expandMarketName(leg.market);
  const odds = Number(leg.odds || 0);
  const home = leg.home || '';
  const away = leg.away || '';
  const dt = leg.matchDate || leg.kickoff;
  const dtFormatted = dt ? fmtDate(dt) : '';

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--line)',
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: 2, color: 'var(--text-soft)' }}>
        <Clock size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Crosshair size={14} />
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text)',
              fontFamily: MONO,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {pick} @ {odds.toFixed(2)}
          </span>
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-dim)' }}>{market}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span
            style={{
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'underline',
              textDecorationColor: 'var(--line-strong)',
              textUnderlineOffset: 2,
            }}
          >
            {home} vs {away}
          </span>
        </div>
        {dtFormatted && (
          <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 12, fontFamily: MONO }}>{dtFormatted}</div>
        )}
      </div>
    </div>
  );
}

// ─── HistoryRow — date rail + status pill + matches + Rebook ────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function HistoryStatusPill({ status }) {
  const cfg = {
    won: { bg: 'rgba(var(--accent-rgb), 0.2)', color: 'var(--accent)', Icon: Trophy, label: 'Won' },
    cashed_out: {
      bg: 'rgba(var(--accent-cool-rgb), 0.2)',
      color: 'var(--accent-cool)',
      Icon: Copy,
      label: 'Cashed Out',
    },
    lost: { bg: 'rgba(var(--danger-rgb), 0.18)', color: 'var(--danger)', Icon: XCircle, label: 'Lost' },
    pending: { bg: 'rgba(var(--warn-rgb), 0.2)', color: 'var(--warn)', Icon: Clock, label: 'Pending' },
    void: { bg: 'var(--surface-2)', color: 'var(--text-dim)', Icon: Ban, label: 'Void' },
    cancelled: { bg: 'var(--surface-2)', color: 'var(--text-dim)', Icon: Ban, label: 'Cancelled' },
  }[status] || { bg: 'var(--surface-2)', color: 'var(--text-dim)', Icon: Clock, label: status || '—' };
  const { Icon } = cfg;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

function HistoryRow({ bet, onOpen, onRebook }) {
  const legs = bet.legs || bet.selections || [];
  const stake = Number(bet.stake || 0);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const status = bet.status || 'pending';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const isWon = status === 'won' || status === 'cashed_out';

  const placed = new Date(bet.placedAt || bet.createdAt || Date.now());
  const day = placed.getDate();
  const month = MONTH_NAMES[placed.getMonth()];

  const visible = legs.slice(0, 3);
  const extra = Math.max(0, legs.length - visible.length);

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* Date rail */}
      <div style={{ width: 34, flexShrink: 0, textAlign: 'center', paddingTop: 10 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1,
            fontFamily: MONO,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {day}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginTop: 2,
          }}
        >
          {month}
        </div>
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'var(--surface)',
          borderRadius: 'var(--r-md, 10px)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.12))',
          overflow: 'hidden',
          cursor: 'pointer',
          padding: 0,
          color: 'inherit',
        }}
      >
        {/* Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{betType}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HistoryStatusPill status={status} />
            <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
              <ChevronRight size={16} />
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 500 }}>Total Stake (GHS)</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text)',
                fontFamily: MONO,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(stake)}
            </span>
          </div>

          {/* Match list */}
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55, marginBottom: 8 }}>
            {visible.map((m, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.home || ''} v {m.away || ''}
              </div>
            ))}
            {extra > 0 && <div style={{ color: 'var(--text-dim)' }}>…(and {extra} other matches)</div>}
          </div>

          {/* Total Return + Rebook */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid var(--line)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}
              >
                Total Return
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                  color: isWon ? 'var(--accent)' : 'var(--text-dim)',
                }}
              >
                {fmt(payout)}
              </div>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onRebook?.(e);
              }}
              role="button"
              tabIndex={0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--accent)',
                color: 'var(--gold-ink)',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 14px',
                borderRadius: 'var(--r-sm, 6px)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} /> Rebook
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
function STATUS_CONFIG(T) {
  return {
    won: { bg: 'rgba(var(--accent-rgb, 232, 185, 74), 0.2)', text: 'var(--accent)', icon: CheckCircle2, label: 'Won' },
    lost: { bg: 'rgba(var(--danger-rgb, 255, 91, 120), 0.2)', text: 'var(--danger)', icon: XCircle, label: 'Lost' },
    cashed_out: {
      bg: 'rgba(var(--accent-cool-rgb, 106, 208, 255), 0.2)',
      text: 'var(--accent-cool)',
      icon: Copy,
      label: 'Cashed Out',
    },
    pending: { bg: 'rgba(var(--warn-rgb, 240, 160, 64), 0.2)', text: 'var(--warn)', icon: Clock, label: 'Pending' },
    open: { bg: 'rgba(var(--warn-rgb, 240, 160, 64), 0.2)', text: 'var(--warn)', icon: Clock, label: 'Open' },
    void: { bg: 'var(--surface-2)', text: 'var(--text-dim)', icon: Ban, label: 'Void' },
    cancelled: { bg: 'var(--surface-2)', text: 'var(--text-dim)', icon: Ban, label: 'Cancelled' },
  };
}

function StatItem({ label, value, valueColor }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 9.5,
          color: 'var(--text-dim)',
          fontWeight: 500,
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: valueColor || 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ text, style: extraStyle }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--text-dim)',
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
      <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: valueColor || 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: mono ? MONO : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 6,
        background: primary ? 'var(--accent)' : 'var(--surface-2)',
        color: primary ? 'var(--gold-ink)' : 'var(--text)',
        border: 0,
        outline: 'none',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        transition: 'background 120ms',
      }}
      aria-label={label}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: 'var(--surface-2)',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon && <Icon size={28} color="var(--text-dim)" />}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
        {hint}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 20,
            padding: '12px 28px',
            background: 'var(--accent)',
            color: 'var(--gold-ink)',
            border: 0,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(232,185,74,0.3)',
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
    <div className="min-h-screen flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full flex flex-col" style={{ maxWidth: 414, minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ height: 48, background: 'var(--surface)' }} />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'rgba(var(--danger-rgb, 255, 91, 120), 0.2)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={28} color="var(--danger)" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>
            Something went wrong
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}
          >
            {message}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: '12px 24px',
                background: 'var(--accent)',
                color: 'var(--gold-ink)',
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
                background: 'var(--surface-2)',
                color: 'var(--text)',
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
    <div className="min-h-screen flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full" style={{ maxWidth: 414, minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ height: 48, background: 'var(--surface)' }} />
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'var(--surface-2)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trophy size={28} color="var(--text-dim)" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>
            Sign in to view your bets
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 20 }}>
            Track your open bets, cash out, and review your betting history.
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/my-bets')}
            style={{
              padding: '12px 28px',
              background: 'var(--accent)',
              color: 'var(--gold-ink)',
              border: 0,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(232,185,74,0.3)',
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
        <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
            <div style={{ width: 90, height: 20, background: 'var(--surface-2)', borderRadius: 999 }} />
            <div style={{ width: 80, height: 14, background: 'var(--surface-2)', borderRadius: 4 }} />
          </div>
          <div style={{ width: '40%', height: 14, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 8 }} />
          <div
            style={{ width: '100%', height: 4, background: 'var(--surface-2)', borderRadius: 999, marginBottom: 10 }}
          />
          <div className="flex justify-between" style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            {[1, 2, 3].map((j) => (
              <div key={j} style={{ textAlign: 'center' }}>
                <div
                  style={{ width: 50, height: 10, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4 }}
                />
                <div
                  style={{ width: 40, height: 14, background: 'var(--surface-2)', borderRadius: 4, margin: '0 auto' }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
