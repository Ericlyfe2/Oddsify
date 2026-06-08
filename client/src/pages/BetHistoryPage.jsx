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
import CashoutSuccessModal from '../components/CashoutSuccessModal.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'cashout', label: 'Cashout Available' },
  { value: 'live', label: 'Live Games' },
];

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

const STATUS_KIND = {
  open: 'open',
  won: 'won',
  lost: 'rejected',
  cashed_out: 'cashed_out',
  void: 'void',
  rejected: 'rejected',
};

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

  /* ── cashout modals state ── */
  const [cashoutTarget, setCashoutTarget] = useState(null);
  const [cashoutOffer, setCashoutOffer] = useState(null);
  const cashoutBusyRef = useRef(false);
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
    if (typeof window !== 'undefined') {
      window.__oddsifyOpenCount = bets.filter((b) => b.status === 'open').length;
    }
  }, [bets]);

  /* ── live cashout offers via socket ── */
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

  const copy = (text) => {
    try {
      navigator.clipboard?.writeText(text);
      toast(`Copied code ${text}`);
    } catch {}
  };

  /* ── cashout flow ── */
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
              <OpenBetCard
                key={bet.id}
                bet={bet}
                liveOffer={cashoutOffers[bet.id] || null}
                onCopy={() => copy(bet.bookingCode || bet.code || bet.id)}
                onCashOut={() => openCashoutConfirm(bet)}
                cashingOut={cashingOut === bet.id}
              />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <EmptyState icon="ticket" title="No bet history yet" hint="Settled bets will appear here." />
      ) : (
        <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 10 }}>
          {history.map((h) => (
            <HistoryRow key={h.id} bet={h} />
          ))}
        </div>
      )}

      {/* Cashout confirmation modal */}
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

      {/* Cashout success celebration */}
      <CashoutSuccessModal
        bet={cashoutSuccess}
        cashoutAmount={cashoutSuccessAmount}
        open={!!cashoutSuccess}
        onClose={() => setCashoutSuccess(null)}
        onViewBets={() => {
          setCashoutSuccess(null);
          navigate('/my-bets');
        }}
      />
    </div>
  );
}

function OpenBetCard({ bet, liveOffer, onCopy, onCashOut, cashingOut }) {
  const T = useTokens();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook on this slip.', 'warn');
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  const handleSim = () => {
    toast('Simulation view coming soon.', 'info');
  };

  const handleEditBet = () => {
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
      toast('Bet loaded — adjust and place.', 'success');
    }
  };

  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);

  const displayOffer = liveOffer?.cashOut || bet.cashoutOffer || bet.cashOutValue || 0;
  const showCashout = displayOffer > 0 && bet.status === 'open';
  const offerStale = liveOffer && !liveOffer.cashOut;

  return (
    <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
      <div style={{ padding: '14px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <OddStatusChip kind="open" label={`OPEN · ${bet.type || (legs.length > 1 ? 'Multiple' : 'Single')}`} />
          <span style={{ fontSize: 11, color: T.inkSoft }}>
            {legs.length} selection{legs.length === 1 ? '' : 's'} · {placedAt(bet.placedAt || bet.createdAt)}
          </span>
        </div>

        {legs.map((leg, i) => (
          <div
            key={i}
            style={{
              padding: '10px 0',
              borderTop: i > 0 ? `1px solid ${T.line}` : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.1 }}>
                {leg.home} <span style={{ color: T.inkDim, fontWeight: 500 }}>vs</span> {leg.away}
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                {leg.market || 'Match Result'} ·{' '}
                <span style={{ color: T.greenBright, fontWeight: 600 }}>
                  {leg.pickLabel || leg.label || leg.pick || leg.key}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {Number(leg.odds || 0).toFixed(2)}
              </span>
              <OddStatusChip kind={STATUS_KIND[legResult(leg)] || 'pending'} label={legResult(leg).toUpperCase()} />
            </div>
          </div>
        ))}

        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${T.line}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
            Stake <span style={{ fontVariantNumeric: 'tabular-nums' }}>GHS {fmtCedi(stake)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.greenBright }}>
            Pot. Win <span style={{ fontVariantNumeric: 'tabular-nums' }}>GHS {fmtCedi(potential)}</span>
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

      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 14px 10px',
          justifyContent: 'center',
        }}
      >
        <ActionIcon icon="refresh" label="Rebet" onClick={handleRebook} />
        <ActionIcon icon="play" label="SIM" onClick={handleSim} />
        <ActionIcon icon="upload" label="Share" onClick={() => shareCode(code, toast)} />
        <ActionIcon icon="edit" label="Edit Bet" onClick={handleEditBet} />
      </div>

      <div style={{ padding: '0 14px 10px', textAlign: 'center' }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: 0.5,
            color: T.inkDim,
            cursor: 'pointer',
          }}
          onClick={onCopy}
          title="Copy booking code"
        >
          {code}
        </span>
      </div>
    </div>
  );
}

function ActionIcon({ icon, label, onClick }) {
  const T = useTokens();
  const [hovered, setHovered] = useState(false);

  const iconPath = icon === 'edit' ? (
    <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17v3ZM16 6l2 2" />
  ) : (
    <OddIcon name={icon} size={16} color={hovered ? T.greenBright : T.inkSoft} />
  );

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
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        color: hovered ? T.greenBright : T.inkSoft,
        fontWeight: 700,
        fontSize: 11,
        transition: 'all 120ms',
      }}
    >
      {icon === 'edit' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hovered ? T.greenBright : T.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17v3ZM16 6l2 2" />
        </svg>
      ) : (
        <OddIcon name={icon} size={16} color={hovered ? T.greenBright : T.inkSoft} />
      )}
      {label}
    </button>
  );
}

function HistoryRow({ bet }) {
  const T = useTokens();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isWon = bet.status === 'won' || bet.status === 'cashed_out';
  const win = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const odds = Number(bet.totalOdds || bet.odds || 0);
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '';
  const legs = bet.legs || bet.selections || [];
  const isCashedOut = bet.status === 'cashed_out';

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook on this slip.', 'warn');
    if (loadFromSlip({ bookingCode: code, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: isWon ? T.greenBright : T.danger }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: T.ink,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: code && code.length === 7 ? '"JetBrains Mono", monospace' : 'inherit',
                letterSpacing: code && code.length === 7 ? 0.4 : 0,
              }}
            >
              #{code || '—'}
            </span>
            <OddStatusChip kind={STATUS_KIND[bet.status] || bet.status} label={(bet.status || '').toUpperCase()} />
            {isCashedOut && <span style={{ fontSize: 10, color: T.greenBright, fontWeight: 600 }}>CASHD OUT</span>}
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft }}>
            {placedAt(bet.placedAt || bet.createdAt)} · stake GHS {fmtCedi(bet.stake)} · {odds.toFixed(2)}x
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isWon ? T.greenBright : T.inkDim,
            }}
          >
            {isWon ? '+' : ''}GHS {fmtCedi(win)}
          </div>
          <div style={{ fontSize: 10, color: T.inkDim, marginTop: 2 }}>
            {isWon ? (isCashedOut ? 'Cash-out' : 'Payout') : 'No return'}
          </div>
        </div>
      </div>
      {code && legs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px 12px', borderTop: `1px solid ${T.line}` }}>
          <button
            type="button"
            onClick={() => copyCode(code, toast)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              background: T.surfaceAlt,
              color: T.ink,
              border: 0,
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => shareCode(code, toast)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              background: T.surfaceAlt,
              color: T.ink,
              border: 0,
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleRebook}
            style={{
              flex: 1.2,
              padding: '8px 0',
              borderRadius: 8,
              background: T.greenBright,
              color: T.goldDark,
              border: 0,
              fontWeight: 800,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            Rebook
          </button>
        </div>
      )}
    </div>
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
