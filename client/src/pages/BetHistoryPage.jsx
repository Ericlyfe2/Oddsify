/**
 * Bet History — port of the Claude Design OddBetHistoryScreen.
 *
 * Top: page header with balance pill.
 * Tabs: Open bets / History (full-width segmented).
 * Open bets: expandable cards showing total odds, stake, potential return,
 *   booking code with copy, cash-out CTA, leg-by-leg breakdown.
 * History: compact rows with status accent + payout column.
 *
 * Data flows from /api/bet/history. Cash-out hits cashOutBet() and refreshes
 * the list on success.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBetHistory, cashOutBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import {
  fmtCedi,
  useTokens,
  OddPageHeader,
  OddSegmented,
  OddStatusChip,
  OddIcon,
} from '../components/odd/primitives.jsx';

/* ── shared booking-code helpers used by every history row ── */

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
    toast('Share unsupported — copy manually.', 'warn');
  }
}

function copyCode(code, toast) {
  try {
    navigator.clipboard?.writeText(code);
    toast(`Copied ${code}.`, 'success');
  } catch {
    toast('Copy failed — long-press to copy manually.', 'warn');
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
  const { account, refresh } = useAccount();
  const { toast } = useToast();
  const [tab, setTab] = useState('open');
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [cashingOut, setCashingOut] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBetHistory();
      const items = data?.bets || data?.history || [];
      setBets(items);
      // Auto-expand the first open bet so the user lands on leg detail,
      // matching the prototype's default state.
      const firstOpen = items.find((b) => b.status === 'open');
      if (firstOpen) setExpanded(firstOpen.id);
    } catch {
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (account) load();
  }, [account, load]);

  // Surface open-bet count on the window so the bottom nav badge (legacy
  // path) and any future consumer can read it without re-fetching.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__oddsifyOpenCount = bets.filter((b) => b.status === 'open').length;
    }
  }, [bets]);

  const openBets = useMemo(() => bets.filter((b) => b.status === 'open'), [bets]);
  const history = useMemo(() => bets.filter((b) => b.status !== 'open'), [bets]);

  const copy = (text) => {
    try {
      navigator.clipboard?.writeText(text);
      toast(`Copied code ${text}`);
    } catch {
      /* ignore */
    }
  };

  const onCashOut = async (bet) => {
    if (!bet?.cashOutValue) {
      toast('Cash-out not currently available for this bet.', 'warn');
      return;
    }
    setCashingOut(bet.id);
    try {
      await cashOutBet(bet.id, bet.cashOutValue);
      toast(`Cashed out GHS ${fmtCedi(bet.cashOutValue)}.`, 'success');
      await refresh();
      await load();
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Cash-out failed.', 'error');
    } finally {
      setCashingOut(null);
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

      {/* Code Hub shortcut — pinned to the top of the list so every
          history view advertises the load-by-code action. */}
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
        openBets.length === 0 ? (
          <EmptyState icon="ticket" title="No open bets" hint="Tap odds on a match to build a slip." />
        ) : (
          <div className="odd-cardgrid" style={{ padding: '4px 16px', gap: 12 }}>
            {openBets.map((bet) => (
              <OpenBetCard
                key={bet.id}
                bet={bet}
                open={expanded === bet.id}
                onToggle={() => setExpanded(expanded === bet.id ? null : bet.id)}
                onCopy={() => copy(bet.bookingCode || bet.code || bet.id)}
                onCashOut={() => onCashOut(bet)}
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
    </div>
  );
}

function Stat({ label, value, dark = false, accent }) {
  const T = useTokens();
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.6,
          color: dark ? 'rgba(255,255,255,0.5)' : T.inkSoft,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accent || (dark ? '#fff' : T.ink),
          letterSpacing: -0.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function OpenBetCard({ bet, open, onToggle, onCopy, onCashOut, cashingOut }) {
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
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const stake = Number(bet.stake || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const cashOutValue = Number(bet.cashOutValue || 0);

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 16,
        border: `1px solid ${T.line}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: open ? T.greenDeep : 'transparent',
          color: open ? '#fff' : T.ink,
          padding: '14px 14px 12px',
          transition: 'background 180ms',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <OddStatusChip kind="open" label={`OPEN · ${bet.type || (legs.length > 1 ? 'Multiple' : 'Single')}`} />
          <span
            style={{
              fontSize: 11,
              opacity: open ? 0.6 : 0.5,
              color: open ? '#fff' : T.inkSoft,
            }}
          >
            {legs.length} selection{legs.length === 1 ? '' : 's'} · {placedAt(bet.placedAt || bet.createdAt)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Stat label="TOTAL ODDS" value={odds.toFixed(2)} dark={open} />
          <Stat label="STAKE" value={`GHS ${fmtCedi(stake)}`} dark={open} />
          <Stat label="POTENTIAL" value={`GHS ${fmtCedi(potential)}`} dark={open} accent={T.greenBright} />
        </div>

        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: open ? 'rgba(255,255,255,0.07)' : T.surfaceAlt,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.6,
                opacity: 0.6,
              }}
            >
              BOOKING CODE
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.8,
              }}
            >
              {code}
            </div>
          </div>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy code"
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: open ? T.surfaceAlt : T.greenDeep,
                color: open ? T.ink : '#fff',
                fontSize: 11,
                fontWeight: 700,
                border: 0,
                cursor: 'pointer',
              }}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => shareCode(code, toast)}
              aria-label="Share code"
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: open ? T.surfaceAlt : T.greenDeep,
                color: open ? T.ink : '#fff',
                fontSize: 11,
                fontWeight: 700,
                border: 0,
                cursor: 'pointer',
              }}
            >
              Share
            </button>
            <button
              type="button"
              onClick={handleRebook}
              aria-label="Rebook this slip"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: T.greenBright,
                color: T.goldDark,
                fontSize: 11,
                fontWeight: 800,
                border: 0,
                cursor: 'pointer',
              }}
            >
              Rebook
            </button>
          </div>
        </div>

        {cashOutValue > 0 && (
          <button
            type="button"
            onClick={onCashOut}
            disabled={cashingOut}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              background: open ? 'rgba(247, 201, 72, 0.2)' : T.gold,
              color: open ? T.gold : T.greenDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 13,
              border: open ? `1px solid ${T.gold}` : 0,
              cursor: cashingOut ? 'wait' : 'pointer',
              opacity: cashingOut ? 0.7 : 1,
            }}
          >
            <span>{cashingOut ? 'Cashing out…' : 'Cash Out'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>GHS {fmtCedi(cashOutValue)}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: T.surface,
          borderTop: `1px solid ${T.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 600,
          color: T.inkSoft,
          border: 0,
          cursor: 'pointer',
        }}
      >
        <span>
          {open ? 'Hide' : 'Show'} {legs.length} leg{legs.length === 1 ? '' : 's'}
        </span>
        <OddIcon name={open ? 'chevU' : 'chevD'} size={14} color={T.inkSoft} />
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column' }}>
          {legs.map((leg, i) => (
            <div
              key={i}
              style={{
                padding: '12px 0',
                borderBottom: i < legs.length - 1 ? `1px dashed ${T.line}` : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.ink,
                      letterSpacing: -0.1,
                    }}
                  >
                    {leg.home} <span style={{ color: T.inkDim, fontWeight: 500 }}>vs</span> {leg.away}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    {leg.market || 'Match Result'} ·{' '}
                    <span style={{ color: T.greenBright, fontWeight: 600 }}>
                      {leg.pickLabel || leg.label || leg.pick || leg.key}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.ink,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Number(leg.odds || 0).toFixed(2)}
                  </span>
                  <OddStatusChip kind={STATUS_KIND[legResult(leg)] || 'pending'} label={legResult(leg).toUpperCase()} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ bet }) {
  const T = useTokens();
  const { loadFromSlip, rememberCode } = useSlip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isWon = bet.status === 'won' || bet.status === 'cashed_out';
  const win = Number(bet.payout || bet.winAmount || bet.win || 0);
  const odds = Number(bet.totalOdds || bet.odds || 0);
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '';
  const legs = bet.legs || bet.selections || [];

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
        borderRadius: 14,
        border: `1px solid ${T.line}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 4,
            alignSelf: 'stretch',
            borderRadius: 2,
            background: isWon ? T.greenBright : T.danger,
          }}
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
          <div style={{ fontSize: 10, color: T.inkDim, marginTop: 2 }}>{isWon ? 'Payout' : 'No return'}</div>
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
