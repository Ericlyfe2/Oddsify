import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Home, Copy, Share2, RotateCcw, ChevronRight } from 'lucide-react';
import { fetchBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { expandMarketName, getSelectionLabel, humanizePick } from '../lib/marketNames.js';

const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getLegState(leg, bet) {
  const matchId = leg.matchId || leg.gameId || leg.id;
  const market = leg.market || '1X2';
  const outcome = leg.outcome || leg.key || '';
  const resolved = (bet.legsResolved || []).find(
    (r) => r.matchId === matchId && (r.market === market || !r.market) && (r.outcome === outcome || !r.outcome),
  );
  if (resolved) {
    if (resolved.won === true) return 'won';
    if (resolved.won === false) return 'lost';
    if (resolved.won === null) return 'void';
  }
  if (leg.status === 'won' || leg.won === true) return 'won';
  if (leg.status === 'lost' || leg.won === false) return 'lost';
  if (leg.status === 'void' || leg.voided) return 'void';
  if (leg.isLive || leg.status === 'live') return 'live';
  return 'pending';
}

function getLegScore(leg, bet) {
  const matchId = leg.matchId || leg.gameId || leg.id;
  const resolved = (bet.legsResolved || []).find((r) => r.matchId === matchId);
  if (resolved && resolved.scoreHome != null) return { scoreHome: resolved.scoreHome, scoreAway: resolved.scoreAway };
  if (leg.scoreHome != null || leg.scoreAway != null) return { scoreHome: leg.scoreHome, scoreAway: leg.scoreAway };
  return null;
}

const STATUS_COLORS = {
  won: '#16a34a',
  lost: '#dc2626',
  cashed_out: '#2563eb',
  pending: '#eab308',
  open: '#eab308',
  void: '#6b7280',
  cancelled: '#6b7280',
};

const LEG_COLORS = {
  won: '#16a34a',
  lost: '#dc2626',
  pending: '#eab308',
  live: '#f97316',
  void: '#6b7280',
};

export default function BetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { account } = useAccount();
  const { toast } = useToast();
  const { loadFromSlip, rememberCode } = useSlip();
  const [bet, setBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

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

  useEffect(() => { if (account) load(); }, [account, load]);

  useEffect(() => {
    if (!account || !id) return;
    const off = onLive('bet:settled', (payload) => {
      if (payload?.betId === id) load();
    });
    return () => off?.();
  }, [account, id, load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  if (!account) {
    return (
      <Shell onBack={() => navigate('/login?next=' + window.location.pathname)}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Sign in to view ticket</div>
          <button type="button" onClick={() => navigate('/login?next=' + window.location.pathname)}
            style={{ marginTop: 16, padding: '12px 28px', background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <div style={{ padding: 16 }}>
          {[60, 200, 120, 120].map((h, i) => (
            <div key={i} style={{ height: h, background: 'var(--surface)', borderRadius: 10, marginBottom: 10, opacity: 0.4 }} />
          ))}
        </div>
      </Shell>
    );
  }

  if (error || !bet) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{error || 'Ticket not found'}</div>
          <button type="button" onClick={() => navigate('/my-bets')}
            style={{ marginTop: 16, padding: '10px 24px', background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Back to My Bets
          </button>
        </div>
      </Shell>
    );
  }

  const legs = bet.legs || bet.selections || [];
  const code = (bet.bookingCode || bet.code || bet.id?.slice(-8) || '—').toUpperCase();
  const status = bet.status || 'pending';
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const potential = Number(bet.potentialWin || bet.potentialReturn || stake * odds);
  const cashOut = Number(bet.cashOut || 0);
  const settledReturn = bet.settledReturn != null ? Number(bet.settledReturn) : null;
  const isWon = status === 'won';
  const isCashedOut = status === 'cashed_out';
  const isLost = status === 'lost';
  const isSettled = status !== 'open' && status !== 'pending';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');

  let totalReturn = potential;
  let profit = 0;
  if (settledReturn != null) {
    totalReturn = settledReturn;
    profit = Number((settledReturn - stake).toFixed(2));
  } else if (isWon) {
    totalReturn = potential;
    profit = Number((totalReturn - stake).toFixed(2));
  } else if (isCashedOut) {
    totalReturn = cashOut;
    profit = Number((totalReturn - stake).toFixed(2));
  } else if (isLost) {
    totalReturn = 0;
    profit = -stake;
  }

  const statusLabel = isCashedOut ? 'Cashed Out' : status.charAt(0).toUpperCase() + status.slice(1);
  const statusColor = STATUS_COLORS[status] || '#eab308';

  const handleRebook = () => {
    if (!legs.length) return toast('No selections to rebook.', 'warn');
    const c = bet.bookingCode || bet.code || bet.id;
    if (loadFromSlip({ bookingCode: c, legs, mode: bet.mode })) {
      if (bet.bookingCode) rememberCode(bet.bookingCode, { kind: 'placed', legs: legs.length });
      navigate('/');
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/code/${code}`;
    if (navigator.share) {
      navigator.share({ title: 'Oddsify Ticket', text: `Check out my ticket: ${code}`, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast('Link copied!', 'success');
    }
  };

  return (
    <Shell onBack={() => navigate(-1)}>
      {/* Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '14px 16px', margin: '0 12px 0', borderRadius: 10,
        background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
        color: statusColor, fontWeight: 800, fontSize: 15, textTransform: 'uppercase',
      }}>
        {statusLabel}
      </div>

      {/* Ticket Info Card */}
      <div style={{
        margin: '10px 12px 0', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--line)',
        padding: '14px 16px',
      }}>
        {/* Ticket ID + Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            TICKET <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: MONO }}>{code}</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: MONO }}>
            {fmtDate(bet.placedAt || bet.createdAt)}
          </span>
        </div>

        {/* Bet Type + Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{betType}</span>
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: statusColor, color: '#fff',
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Total Return - big */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Total Return</span>
            <span style={{
              fontSize: 24, fontWeight: 800, fontFamily: MONO,
              color: isWon || isCashedOut ? '#16a34a' : isLost ? '#dc2626' : 'var(--text)',
            }}>
              GHS {fmtMoney(totalReturn)}
            </span>
          </div>
        </div>

        {/* Summary rows */}
        <InfoRow label="Total Stake" value={`GHS ${fmtMoney(stake)}`} />
        <InfoRow label="Total Odds" value={odds.toFixed(2)} />
        {isSettled && (
          <InfoRow label="Profit / Loss"
            value={`${profit >= 0 ? '+' : ''}GHS ${fmtMoney(profit)}`}
            color={profit >= 0 ? '#16a34a' : '#dc2626'} />
        )}
        {isCashedOut && cashOut > 0 && (
          <InfoRow label="Cashout Amount" value={`GHS ${fmtMoney(cashOut)}`} color="#2563eb" />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 14 }}>
          <button type="button" onClick={handleShare} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 0', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            background: 'var(--surface-2)', color: 'var(--text)',
            border: '1px solid var(--line-strong)',
          }}>
            <Share2 size={15} /> Show Off
          </button>
          <button type="button" onClick={handleRebook} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 0', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            background: 'var(--accent)', color: 'var(--gold-ink)', border: 'none',
          }}>
            <RotateCcw size={15} /> Remix Bet
          </button>
        </div>
      </div>

      {/* Booking Code Row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>BOOKING CODE</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: MONO }}>{code}</span>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(code); toast('Copied!', 'success'); }}
            style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', padding: 2 }}>
            <Copy size={13} />
          </button>
        </div>
        <button type="button" onClick={() => navigate('/codehub')}
          style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Load Code
        </button>
      </div>

      {/* Selections Header */}
      <div style={{ padding: '0 16px 8px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        Selections ({legs.length})
      </div>

      {/* Match Legs */}
      {legs.map((leg, i) => {
        const r = getLegState(leg, bet);
        const lc = LEG_COLORS[r] || '#6b7280';
        const score = getLegScore(leg, bet);
        const hasScore = score && score.scoreHome != null;
        const selection = humanizePick(getSelectionLabel(leg), leg.home, leg.away);
        const marketName = leg.marketName || expandMarketName(leg.market);
        const legOdds = Number(leg.odds || leg.initialOdds || 0);
        const gameId = leg.gameId || leg.matchId || leg.id?.toString().slice(-6) || '—';

        return (
          <div key={i} style={{
            margin: '0 12px 8px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--line)',
            overflow: 'hidden',
          }}>
            {/* Game ID row */}
            <div style={{
              padding: '8px 14px', fontSize: 10, color: 'var(--text-dim)', fontFamily: MONO,
              borderBottom: '1px solid var(--line)',
            }}>
              Game ID: {gameId}
            </div>

            {/* Teams */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '10px 14px',
              background: 'var(--surface-2)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{leg.home}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>vs</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{leg.away}</span>
            </div>

            {/* Score */}
            {hasScore && (
              <div style={{
                padding: '6px 14px', fontSize: 12, color: 'var(--text-dim)',
                borderBottom: '1px solid var(--line)',
              }}>
                FT Score: <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: MONO }}>
                  {score.scoreHome} : {score.scoreAway}
                </span>
              </div>
            )}

            {/* Pick / Market / Outcome */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: `${lc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: lc, flexShrink: 0,
                }}>
                  {r === 'won' ? '✓' : r === 'lost' ? '✗' : '•'}
                </span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>
                    Pick: <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{selection} @{legOdds.toFixed(2)}</span>
                    {' '}<span style={{ color: lc, fontWeight: 700 }}>{r === 'won' ? '✓' : r === 'lost' ? '✗' : ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Market: {marketName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    Outcome: <span style={{ fontWeight: 600, color: lc }}>
                      {r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : r === 'live' ? 'Live' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Number of Bets */}
      <div style={{
        padding: '12px 16px',
        fontSize: 13, fontWeight: 600, color: 'var(--text)',
      }}>
        Number of Bets: {legs.length}
      </div>

      {/* Check Transaction History */}
      <button type="button" onClick={() => navigate('/my-bets')} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '14px 16px',
        background: 'var(--surface)', border: 'none', borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)',
      }}>
        <span>Check Transaction History</span>
        <ChevronRight size={16} color="var(--text-dim)" />
      </button>

      {/* Delete / Close */}
      <div style={{ padding: '20px 16px 100px', textAlign: 'center' }}>
        <button type="button" onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none',
          color: '#dc2626', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Close Ticket
        </button>
      </div>
    </Shell>
  );
}

function Shell({ onBack, children }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 414, minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Red Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 14px', background: '#c41e1e',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button type="button" onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 0, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            <ChevronLeft size={20} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Ticket Details</span>
          <button type="button" onClick={() => navigate('/')} style={{
            background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 0,
          }}>
            <Home size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text)', fontFamily: MONO }}>{value}</span>
    </div>
  );
}
