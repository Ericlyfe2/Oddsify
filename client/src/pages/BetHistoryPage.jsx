import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  RotateCcw,
  Play,
  Share2,
  Pencil,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Wallet,
  Crosshair,
  ChevronRight,
  Trophy,
  XCircle,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';
import { fetchBetHistory, cashOutBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { useTokens } from '../components/odd/tokens.jsx';
import CashoutConfirmModal from '../components/CashoutConfirmModal.jsx';
import CashoutSuccessOverlay from '../components/CashoutSuccessOverlay.jsx';

/**
 * Oddsify theme-aware palette. Maps this page's legacy Sportybet-style color
 * slots onto the shared design tokens (`useTokens`) so the Bet History screen
 * matches the rest of the app in both dark and light themes.
 */
function usePalette() {
  const T = useTokens();
  return {
    navy: T.ink,           // primary text / brand ink
    bar: T.surfaceAlt,     // top tab bar, frame, card strip
    onBar: T.ink,          // text/icons on bars
    green: T.greenBright,  // accent (Oddsify gold) — positive, buttons, links
    greenSoft: T.greenBright,
    onAccent: T.goldInk,   // text on accent/gold backgrounds
    red: T.danger,
    dateRed: T.accentHot,
    blue: T.accentCool,
    amber: T.warn,
    bodyText: T.inkSoft,
    muted: T.inkSoft,
    lightMuted: T.inkDim,
    pageBg: T.bg,
    cardBg: T.surface,
    cardStrip: T.surfaceAlt,
    divider: T.lineStrong,
    chipBg: T.surfaceAlt,
    skeleton: T.surfaceAlt,
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'cashout', label: 'Cashout Available' },
  { key: 'live', label: 'Live Games' },
];

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toFixed(2);
}

function fmtDateShort(iso) {
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

export default function BetHistoryPage() {
  const S = usePalette();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account, refresh } = useAccount();
  const { toast } = useToast();
  const { cashoutOffers, updateCashoutOffer } = useSlip();
  const initialTab = searchParams.get('tab') === 'hist' ? 'history' : 'open';
  const [tab, setTab] = useState(initialTab);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [cashoutTarget, setCashoutTarget] = useState(null);
  const [cashoutOffer, setCashoutOffer] = useState(null);
  const cashoutBusyRef = useRef(false);
  const [cashingOut, setCashingOut] = useState(null);
  const [cashoutSuccess, setCashoutSuccess] = useState(null);
  const [cashoutSuccessAmount, setCashoutSuccessAmount] = useState(0);

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
  const filteredOpen = useMemo(() => filterBets(openBets, filter), [openBets, filter]);

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

  if (!account) return <SignedOutState navigate={navigate} />;

  const balance = Number(account.balance || 0);

  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: S.bar }}>
      <div
        className="w-full flex flex-col"
        style={{ maxWidth: 414, minHeight: '100vh', background: S.pageBg, fontFamily: S.font, paddingBottom: 88 }}
      >
        {/* ── Top tab bar ── */}
        <div className="relative flex" style={{ height: 48, background: S.bar }}>
          <TabBtn
            active={tab === 'open'}
            onClick={() => setTab('open')}
            label={`Open Bets (${openBets.length})`}
          />
          <TabBtn
            active={tab === 'history'}
            onClick={() => setTab('history')}
            label="Bet History"
          />
          <div
            className="absolute flex items-center gap-1"
            style={{
              top: 8,
              right: 12,
              background: S.green,
              padding: '4px 10px',
              borderRadius: 999,
              color: S.onAccent,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Wallet size={12} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>GHS {fmtMoney(balance)}</span>
          </div>
        </div>

        {/* ── Filter row (Open Bets only) ── */}
        {tab === 'open' && (
          <div
            className="flex items-center justify-between"
            style={{ background: S.cardBg, padding: '12px 16px' }}
          >
            <div className="flex items-center" style={{ gap: 8 }}>
              {FILTERS.map(({ key, label }) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    style={{
                      background: active ? S.green : S.chipBg,
                      color: active ? S.onAccent : S.bodyText,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 16,
                      border: 0,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              style={{ background: 'none', border: 0, padding: 0, outline: 'none', cursor: 'pointer' }}
              aria-label="Toggle view"
            >
              <LayoutGrid size={20} color={S.muted} />
            </button>
          </div>
        )}

        {/* ── Filter row (Bet History) ── */}
        {tab === 'history' && (
          <div
            className="flex items-center justify-between"
            style={{ background: S.cardBg, padding: '12px 16px' }}
          >
            <div className="flex items-center" style={{ gap: 8 }}>
              <FilterChip label="Settled" />
              <FilterChip label="Bet Result" />
            </div>
            <div className="flex items-center" style={{ gap: 14 }}>
              <button
                type="button"
                aria-label="Pick date"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              >
                <Calendar size={20} color={S.muted} />
              </button>
              <button
                type="button"
                aria-label="Clear filters"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              >
                <X size={20} color={S.muted} />
              </button>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ padding: '12px 12px 16px' }}>
          {loading ? (
            <SkeletonCard />
          ) : tab === 'open' ? (
            filteredOpen.length === 0 ? (
              <EmptyState
                title={filter === 'all' ? 'No open bets' : 'No bets match this filter'}
                hint={filter === 'all' ? 'Tap odds on a match to build a slip.' : 'Try switching to All bets.'}
                onAction={() => navigate('/')}
              />
            ) : (
              filteredOpen.map((bet) => (
                <OpenBetCard
                  key={bet.id}
                  bet={bet}
                  liveOffer={cashoutOffers[bet.id] || null}
                  cashingOut={cashingOut === bet.id}
                  onCashOut={() => openCashoutConfirm(bet)}
                  onDetails={() => navigate(`/bets/${bet.id}`)}
                />
              ))
            )
          ) : settledBets.length === 0 ? (
            <EmptyState title="No bet history yet" hint="Settled bets will appear here." onAction={() => navigate('/')} />
          ) : (
            settledBets.map((bet) => <HistoryBetCard key={bet.id} bet={bet} onClick={() => navigate(`/bets/${bet.id}`)} />)
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

function TabBtn({ active, onClick, label }) {
  const S = usePalette();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center"
      style={{
        background: active ? S.cardBg : S.bar,
        color: active ? S.navy : S.muted,
        fontWeight: active ? 600 : 500,
        fontSize: 15,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        border: 0,
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function OpenBetCard({ bet, liveOffer, cashingOut, onCashOut, onDetails }) {
  const S = usePalette();
  const [showDetails, setShowDetails] = useState(true);
  const legs = bet.legs || bet.selections || [];
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const offer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;

  return (
    <div
      style={{
        background: S.cardBg,
        borderRadius: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 700, fontSize: 15, color: S.navy }}>{betType}</span>
        <div className="flex items-center" style={{ gap: 14 }}>
          {[
            { icon: RotateCcw, label: 'Rebet' },
            { icon: Play, label: 'SIM', fill: true },
            { icon: Share2 },
            { icon: Pencil, label: 'Edit Bet' },
          ].map(({ icon: Icon, label, fill }, i) => (
            <button
              key={i}
              type="button"
              className="flex items-center gap-1"
              style={{ background: 'none', border: 0, padding: 0, outline: 'none', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (label === 'Edit Bet') onDetails?.();
              }}
              aria-label={label || 'action'}
            >
              <Icon size={14} color={S.green} {...(fill ? { fill: S.green } : {})} />
              {label && <span style={{ color: S.green, fontSize: 12, fontWeight: 500 }}>{label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Legs */}
      {showDetails &&
        legs.map((leg, i) => (
          <div
            key={i}
            className="flex"
            style={{
              gap: 12,
              padding: '12px 0',
              borderBottom: i < legs.length - 1 ? `1px solid ${S.divider}` : 'none',
            }}
          >
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              <Clock size={18} color={S.muted} />
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="flex items-center" style={{ gap: 6 }}>
                <Crosshair size={14} color={S.navy} />
                <span
                  style={{ fontWeight: 700, fontSize: 14, color: S.navy, fontVariantNumeric: 'tabular-nums' }}
                >
                  {leg.pickLabel || leg.label || leg.pick || leg.key} @ {Number(leg.odds || 0).toFixed(2)}
                </span>
                <span style={{ fontWeight: 400, fontSize: 12, color: S.lightMuted }}>
                  {leg.market || '1X2'}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    color: S.navy,
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  {leg.home} vs {leg.away}
                </span>
              </div>
              <div style={{ marginTop: 4, color: S.lightMuted, fontSize: 12, fontWeight: 400 }}>
                {fmtDateShort(leg.matchDate || leg.kickoff)}
              </div>
            </div>
          </div>
        ))}

      {/* Toggle details */}
      <div style={{ borderTop: `1px solid ${S.divider}` }}>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-end w-full"
          style={{
            gap: 4,
            padding: '10px 0',
            background: 'none',
            border: 0,
            outline: 'none',
            color: S.green,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {showDetails ? 'Hide Match Details' : 'Show Match Details'}
          <ChevronUp
            size={14}
            color={S.green}
            style={{ transition: 'transform 200ms', transform: showDetails ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </button>
      </div>

      {/* Stake / Pot. Win */}
      <div>
        <Row label="Stake" value={fmtMoney(stake)} />
        <Row label="Pot. Win" value={fmtMoney(potential)} />
      </div>

      {/* Cashout button */}
      {offer > 0 && (
        <button
          type="button"
          onClick={onCashOut}
          disabled={cashingOut}
          className="w-full flex items-center justify-center"
          style={{
            marginTop: 12,
            background: S.green,
            borderRadius: 8,
            border: 0,
            outline: 'none',
            color: S.onAccent,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.2,
            padding: '12px 0',
            cursor: cashingOut ? 'wait' : 'pointer',
            opacity: cashingOut ? 0.7 : 1,
            gap: 8,
          }}
        >
          {cashingOut ? 'Cashing out…' : `Cashout GHS ${fmtMoney(offer)}`}
          {!cashingOut && <ChevronRight size={16} />}
        </button>
      )}
    </div>
  );
}

function FilterChip({ label }) {
  const S = usePalette();
  return (
    <button
      type="button"
      className="flex items-center"
      style={{
        gap: 6,
        background: S.chipBg,
        color: S.bodyText,
        padding: '6px 14px',
        borderRadius: 16,
        border: 0,
        outline: 'none',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
      <ChevronDown size={14} color={S.bodyText} />
    </button>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function HistoryBetCard({ bet, onClick }) {
  const S = usePalette();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();

  const legs = bet.legs || bet.selections || [];
  const stake = Number(bet.stake || 0);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const status = bet.status || 'pending';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const isWon = status === 'won' || status === 'cashed_out';
  const isLost = status === 'lost';

  const placed = new Date(bet.placedAt || bet.createdAt || Date.now());
  const day = placed.getDate();
  const month = MONTHS[placed.getMonth()];

  const visibleMatches = legs.slice(0, 3);
  const overflow = Math.max(0, legs.length - visibleMatches.length);

  const handleRebook = (e) => {
    e.stopPropagation();
    if (!legs.length) return toast('No selections to rebook.', 'warn');
    const code = bet.bookingCode || bet.code || bet.id;
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  return (
    <div className="flex" style={{ gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
      {/* Date column */}
      <div
        style={{
          width: 32,
          flexShrink: 0,
          textAlign: 'center',
          color: S.dateRed,
          paddingTop: 4,
          lineHeight: 1,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{day}</div>
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{month}</div>
      </div>

      {/* Card */}
      <div
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          background: S.cardBg,
          borderRadius: 6,
          overflow: 'hidden',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header strip */}
        <div
          className="flex items-center justify-between"
          style={{ background: S.cardStrip, padding: '8px 12px', color: S.onBar }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>{betType}</span>
          <div className="flex items-center" style={{ gap: 4 }}>
            {isWon ? (
              <>
                <Trophy size={14} color={S.green} fill={S.green} />
                <span style={{ color: S.green, fontSize: 13, fontWeight: 700 }}>Won</span>
              </>
            ) : isLost ? (
              <>
                <XCircle size={14} color={S.red} />
                <span style={{ color: S.red, fontSize: 13, fontWeight: 700 }}>Lost</span>
              </>
            ) : (
              <>
                <Clock size={14} color={S.amber} />
                <span style={{ color: S.amber, fontSize: 13, fontWeight: 700 }}>Pending</span>
              </>
            )}
            <ChevronRight size={14} color={S.onBar} />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px 12px', color: S.bodyText }}>
          <div className="flex justify-between" style={{ fontSize: 12 }}>
            <span style={{ color: S.muted }}>Total Stake(GHS)</span>
            <span style={{ color: S.navy, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(stake)}
            </span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 12, marginTop: 3 }}>
            <span style={{ color: S.muted }}>Total Return</span>
            <span
              style={{
                color: isWon ? S.green : S.navy,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtMoney(payout)}
            </span>
          </div>

          <div
            className="flex items-end justify-between"
            style={{ marginTop: 10, gap: 10 }}
          >
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: S.bodyText, lineHeight: 1.55 }}>
              {visibleMatches.map((leg, i) => (
                <div
                  key={i}
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {leg.home} v {leg.away}
                </div>
              ))}
              {overflow > 0 && (
                <div style={{ color: S.muted }}>
                  …(and {overflow} other matches)
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRebook}
              style={{
                background: S.green,
                color: S.onAccent,
                border: 0,
                borderRadius: 4,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                outline: 'none',
              }}
            >
              Remix Bet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  const S = usePalette();
  return (
    <div className="flex justify-between" style={{ padding: '4px 0' }}>
      <span style={{ color: S.bodyText, fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color: S.navy, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function SkeletonCard() {
  const S = usePalette();
  return (
    <div
      style={{
        background: S.cardBg,
        borderRadius: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        padding: '14px 16px',
      }}
    >
      <div className="flex justify-between items-center">
        <div style={{ width: 80, height: 18, background: S.skeleton, borderRadius: 4 }} />
        <div style={{ width: 120, height: 14, background: S.skeleton, borderRadius: 4 }} />
      </div>
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start"
          style={{ gap: 12, padding: '12px 0', borderBottom: i < 2 ? `1px solid ${S.divider}` : 'none' }}
        >
          <div style={{ width: 18, height: 18, background: S.skeleton, borderRadius: 999, flexShrink: 0 }} />
          <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: '60%', height: 14, background: S.skeleton, borderRadius: 4 }} />
            <div style={{ width: '80%', height: 14, background: S.skeleton, borderRadius: 4 }} />
            <div style={{ width: '40%', height: 12, background: S.skeleton, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, hint, onAction }) {
  const S = usePalette();
  return (
    <div
      style={{
        background: S.cardBg,
        borderRadius: 10,
        padding: '40px 24px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: S.chipBg,
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Clock size={24} color={S.lightMuted} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: S.navy }}>{title}</div>
      <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{hint}</div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            background: S.green,
            color: S.onAccent,
            border: 0,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Browse Sports
        </button>
      )}
    </div>
  );
}

function SignedOutState({ navigate }) {
  const S = usePalette();
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: S.bar }}>
      <div
        className="w-full"
        style={{ maxWidth: 414, minHeight: '100vh', background: S.pageBg, fontFamily: S.font }}
      >
        <div style={{ height: 48, background: S.bar }} />
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: S.navy }}>Sign in to view your bets</div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/my-bets')}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              background: S.green,
              color: S.onAccent,
              border: 0,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
