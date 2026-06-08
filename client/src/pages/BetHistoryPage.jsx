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
import CashoutConfirmModal from '../components/CashoutConfirmModal.jsx';
import CashoutSuccessOverlay from '../components/CashoutSuccessOverlay.jsx';
import BetDetailModal from '../components/BetDetailModal.jsx';

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
    toast(`Copied share link.`, 'success');
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

function legResult(leg) {
  if (leg.status === 'won') return 'won';
  if (leg.status === 'lost') return 'lost';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
}

const STATUS_KIND = {
  open: 'open',
  won: 'won',
  lost: 'rejected',
  cashed_out: 'cashed_out',
  void: 'void',
  rejected: 'rejected',
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
  const [cashingOut, setCashingOut] = useState(null);

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
  const filteredOpen = useMemo(() => filterBets(openBets, filter), [openBets, filter]);
  const history = useMemo(() => bets.filter((b) => b.status !== 'open'), [bets]);

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

  if (!account) return <SignedOutState navigate={navigate} />;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader
        title="My Bets"
        subtitle="Open bets & history"
        right={
          <div style={{
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
          }}>
            GHS {fmtCedi(account.balance)}
          </div>
        }
      />

      <div style={{ padding: '14px 16px 8px' }}>
        <OddSegmented
          full
          options={[
            { value: 'open', label: `Open Bets · ${openBets.length}` },
            { value: 'hist', label: 'Bet History' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'open' && (
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
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
        </div>
      )}

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
            title={filter !== 'all' ? 'No bets match this filter' : 'No open bets'}
            hint={filter !== 'all' ? 'Try switching to All bets.' : 'Tap odds on a match to build a slip.'}
          />
        ) : (
          <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 12 }}>
            {filteredOpen.map((bet) => (
              <SportyBetCard
                key={bet.id}
                bet={bet}
                liveOffer={cashoutOffers[bet.id] || null}
                onCopy={() => copyCode(bet.bookingCode || bet.code || bet.id, toast)}
                onCashOut={() => openCashoutConfirm(bet)}
                cashingOut={cashingOut === bet.id}
                onViewDetails={() => setDetailBet(bet)}
              />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <EmptyState icon="ticket" title="No bet history yet" hint="Settled bets will appear here." />
      ) : (
        <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 10 }}>
          {history.map((h) => (
            <SportyBetCard
              key={h.id}
              bet={h}
              onCopy={() => copyCode(h.bookingCode || h.code || h.id, toast)}
              onViewDetails={() => setDetailBet(h)}
            />
          ))}
        </div>
      )}

      <CashoutConfirmModal
        bet={cashoutTarget}
        cashoutValue={cashoutOffer}
        open={!!cashoutTarget}
        onClose={() => { setCashoutTarget(null); setCashoutOffer(null); }}
        onConfirm={confirmCashout}
        busy={cashingOut === cashoutTarget?.id}
      />

      <CashoutSuccessOverlay
        bet={cashoutSuccess}
        cashoutAmount={cashoutSuccessAmount}
        open={!!cashoutSuccess}
        onClose={() => setCashoutSuccess(null)}
        onViewBets={() => { setCashoutSuccess(null); navigate('/my-bets'); }}
      />

      <BetDetailModal
        bet={detailBet}
        open={!!detailBet}
        onClose={() => setDetailBet(null)}
      />
    </div>
  );
}

function SportyBetCard({ bet, liveOffer, onCopy, onCashOut, cashingOut, onViewDetails }) {
  const T = useTokens();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const isWon = bet.status === 'won' || bet.status === 'cashed_out';

  const displayOffer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
  const showCashout = displayOffer > 0 && isOpen;
  const offerStale = liveOffer && !liveOffer.cashOut;

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook on this slip.', 'warn');
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  return (
    <div style={{
      background: T.surface,
      borderRadius: 16,
      border: `1px solid ${T.line}`,
      overflow: 'hidden',
      transition: 'box-shadow 150ms',
    }}>
      <div style={{
        height: 4,
        background: ss.bg,
      }} />

      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
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
            }}>
              {ss.label}
            </span>
            <span style={{
              fontSize: 11,
              color: T.inkDim,
              fontWeight: 600,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              letterSpacing: 0.3,
              cursor: 'pointer',
            }} onClick={onCopy} title="Copy booking code">
              #{code}
            </span>
          </div>
          <span style={{ fontSize: 10.5, color: T.inkSoft }}>
            {placedAt(bet.placedAt || bet.createdAt)}
          </span>
        </div>

        {legs.map((leg, i) => (
          <div
            key={i}
            style={{
              padding: '8px 0',
              borderTop: i > 0 ? `1px solid ${T.line}` : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                {leg.home} <span style={{ color: T.inkDim, fontWeight: 500, fontSize: 11 }}>vs</span> {leg.away}
              </div>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span>{leg.market || 'Match Result'}</span>
                <span style={{ color: T.greenBright, fontWeight: 600 }}>{leg.pickLabel || leg.label || leg.pick || leg.key}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: T.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Number(leg.odds || 0).toFixed(2)}
              </span>
              {isSettled && (
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: leg.status === 'won' ? '#16a34a' : leg.status === 'lost' ? '#dc2626' : '#6b7280',
                }} />
              )}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 8,
          paddingTop: 10,
          borderTop: `1px solid ${T.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600 }}>Stake</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
              GHS {fmtCedi(stake)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600 }}>Odds</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
              {odds.toFixed(2)}x
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: T.inkDim, fontWeight: 600 }}>
              {isSettled ? (isWon ? 'Payout' : 'Return') : 'Pot. Win'}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isSettled ? (isWon ? '#16a34a' : T.inkDim) : T.greenBright,
            }}>
              GHS {fmtCedi(isSettled ? payout : potential)}
            </div>
          </div>
        </div>

        {showCashout && (
          <button
            type="button"
            onClick={onCashOut}
            disabled={cashingOut}
            style={{
              marginTop: 10,
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
              transition: 'opacity 120ms',
            }}
          >
            {cashingOut ? 'Cashing out…' : `CASHOUT GHS ${fmtCedi(displayOffer)}`}
          </button>
        )}

        {!showCashout && offerStale && (
          <div style={{ marginTop: 6, fontSize: 11, color: T.warn, textAlign: 'center', fontWeight: 600 }}>
            Cash-out temporarily unavailable.
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        padding: '10px 14px',
      }}>
        {onViewDetails && (
          <ActionIcon icon="info" label="Details" onClick={onViewDetails} T={T} />
        )}
        <ActionIcon icon="refresh" label="Rebook" onClick={handleRebook} T={T} />
        <ActionIcon icon="copy" label="Copy" onClick={onCopy} T={T} />
        <ActionIcon icon="upload" label="Share" onClick={() => shareCode(code, toast)} T={T} />
      </div>
    </div>
  );
}

function ActionIcon({ icon, label, onClick, T: theme }) {
  const T = theme;
  const [hovered, setHovered] = useState(false);

  const iconMap = {
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-13h-2v2h2V7Zm0 4h-2v6h2v-6Z',
    refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z',
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
        gap: 5,
        padding: '8px 0',
        borderRadius: 8,
        background: hovered ? `${T.greenBright}15` : 'transparent',
        border: 0,
        cursor: 'pointer',
        color: hovered ? T.greenBright : T.inkSoft,
        fontWeight: 700,
        fontSize: 11,
        transition: 'all 120ms',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={iconMap[icon] || iconMap.info} />
      </svg>
      {label}
    </button>
  );
}

function EmptyState({ icon, title, hint }) {
  const T = useTokens();
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        width: 60, height: 60, borderRadius: 999, background: T.surface,
        border: `1px solid ${T.line}`, margin: '0 auto 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
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
            marginTop: 16, padding: '12px 24px', borderRadius: 999,
            background: T.greenBright, color: T.goldDark, fontWeight: 700,
            fontSize: 13, border: 0, cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
