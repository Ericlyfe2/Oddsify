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

const LEG_COLORS = {
  won: 'var(--win)',
  lost: 'var(--danger)',
  pending: 'var(--warn)',
  live: 'var(--accent-hot)',
  void: 'var(--text-dim)',
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
          {[180, 100, 100].map((h, i) => (
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
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');

  let totalReturn = potential;
  if (settledReturn != null) totalReturn = settledReturn;
  else if (isCashedOut) totalReturn = cashOut;
  else if (isLost) totalReturn = 0;

  // Outcome-based ticket tone: won/cashed out → green, lost → ash/grey
  const tone =
    isWon || isCashedOut
      ? 'rgba(34, 197, 94, 0.12)'
      : isLost
        ? 'rgba(120, 120, 130, 0.14)'
        : 'var(--bg)';

  // Big-win celebration: single selection that returned far more than staked
  const showCheer = isWon && legs.length === 1 && stake > 0 && totalReturn / stake >= 10;

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
    <Shell onBack={() => navigate(-1)} tone={tone}>
      {/* Summary card */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Ticket No. <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: MONO }}>{code}</span>
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: MONO }}>
              {fmtDate(bet.placedAt || bet.createdAt)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{betType}</span>
            <StatusPill status={status} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Total Return</span>
          <span style={{
            fontSize: 26, fontWeight: 800, fontFamily: MONO, letterSpacing: '-0.5px',
            color: isWon || isCashedOut ? 'var(--win)' : 'var(--text-dim)',
          }}>
            {fmtMoney(totalReturn)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Total Stake</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: 'var(--text)' }}>{fmtMoney(stake)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Total Odds</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: 'var(--text)' }}>{odds.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Celebration banner */}
      {showCheer && (
        <div style={{
          margin: '12px 16px 0', borderRadius: 10, padding: '11px 14px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-strong, var(--accent)))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-ink)' }}>Congratulations!</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold-ink)', opacity: 0.85 }}>You are Amazing! 🎉</span>
          </div>
          <button type="button" onClick={handleShare} style={{
            background: 'var(--bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 800,
            padding: '8px 16px', borderRadius: 7, border: 0, cursor: 'pointer',
          }}>
            Show Off
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 8px' }}>
        <button type="button" onClick={handleShare} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '12px 0', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer',
          background: 'var(--accent)', color: 'var(--gold-ink)', border: 'none',
        }}>
          <Share2 size={15} /> Show Off
        </button>
        <button type="button" onClick={handleRebook} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '12px 0', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer',
          background: 'var(--win, #16a05a)', color: '#fff', border: 'none',
        }}>
          <RotateCcw size={15} /> Remix Bet
        </button>
      </div>

      {/* Verify Code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 16px 10px' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Verify Code:</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)', fontFamily: MONO, letterSpacing: 0.5 }}>{code}</span>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(code); toast('Copied!', 'success'); }}
          style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', padding: 2 }}>
          <Copy size={12} />
        </button>
      </div>

      {/* Match Legs */}
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {legs.map((leg, i) => {
          const r = getLegState(leg, bet);
          const lc = LEG_COLORS[r] || 'var(--text-dim)';
          const score = getLegScore(leg, bet);
          const hasScore = score && score.scoreHome != null;
          const selection = humanizePick(getSelectionLabel(leg), leg.home, leg.away);
          const marketName = leg.marketName || expandMarketName(leg.market);
          const dt = leg.matchDate || leg.kickoff;
          const dtFormatted = dt ? fmtDate(dt) : '';

          return (
            <div key={i} style={{
              background: '#19222b', border: '1px solid #222e38', borderRadius: 10, padding: '12px 14px',
            }}>
              {/* Meta line */}
              <div style={{ fontSize: 10.5, color: '#56636d', marginBottom: 10 }}>
                {leg.gameId ? `Game ID: ${leg.gameId} · ` : ''}{dtFormatted}{(dtFormatted && (leg.league || leg.competition)) ? ' · ' : ''}{leg.league || leg.competition || (betType === 'Single' ? 'QuickGame' : '')}
              </div>
              {/* Mark + team names */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: r === 'won' ? 'rgba(34,198,110,.16)' : r === 'lost' ? 'rgba(138,152,163,.16)' : 'rgba(234,179,8,.16)',
                  color: lc, fontSize: 13, fontWeight: 800,
                }}>
                  {r === 'won' ? '✓' : r === 'lost' ? '✗' : '•'}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{leg.home} vs {leg.away}</span>
              </div>
              {/* Match Tracker + FT score */}
              {hasScore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 32 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--win, #22c66e)', background: 'rgba(34,198,110,.12)', padding: '3px 8px', borderRadius: 999 }}>
                    ⟲ Match Tracker
                  </span>
                  <span style={{ color: '#56636d', fontSize: 11 }}>FT</span>
                  <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 800, fontFamily: MONO }}>
                    {score.scoreHome} : {score.scoreAway}
                  </span>
                </div>
              )}
              {/* Market / Outcome rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 32, marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, color: '#56636d' }}>Market</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>{marketName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, color: '#56636d' }}>Outcome</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: lc }}>{selection}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: number of bets + transaction history link */}
      <button type="button" onClick={() => navigate('/my-bets')} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '16px 16px 20px',
        background: 'transparent', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Number of Bets: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{legs.length}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 2 }}>
          Bet Details <ChevronRight size={14} />
        </span>
      </button>

      <div style={{ height: 24 }} />
    </Shell>
  );
}

function StatusPill({ status }) {
  const cfg = {
    won: { bg: 'rgba(34,198,110,.16)', fg: 'var(--win, #22c66e)', icon: '🏆', label: 'Won' },
    cashed_out: { bg: 'rgba(106,208,255,.16)', fg: 'var(--accent-cool, #6ad0ff)', icon: '↩', label: 'Cashed Out' },
    lost: { bg: 'rgba(138,152,163,.14)', fg: 'var(--text-dim)', icon: '✕', label: 'Lost' },
    pending: { bg: 'rgba(234,179,8,.16)', fg: 'var(--warn, #eab308)', icon: '⏱', label: 'Pending' },
    open: { bg: 'rgba(234,179,8,.16)', fg: 'var(--warn, #eab308)', icon: '⏱', label: 'Open' },
    void: { bg: 'var(--surface-2)', fg: 'var(--text-dim)', icon: '–', label: 'Void' },
  }[status] || { bg: 'var(--surface-2)', fg: 'var(--text-dim)', icon: '', label: status || '—' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 6, background: cfg.bg,
    }}>
      <span style={{ fontSize: 12 }}>{cfg.icon}</span>
      <span style={{ color: cfg.fg, fontSize: 12, fontWeight: 800 }}>{cfg.label}</span>
    </div>
  );
}

function Shell({ onBack, children, tone = 'var(--bg)' }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 414, minHeight: '100vh', background: tone }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 14px', background: 'var(--bg-soft)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button type="button" onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 0, color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            <ChevronLeft size={20} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ticket Details</span>
          <button type="button" onClick={() => navigate('/')} style={{
            background: 'none', border: 0, color: 'var(--text-soft)', cursor: 'pointer', padding: 0,
          }}>
            <Home size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
