import { useCallback, useEffect, useRef, useState } from 'react';
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
  Share2,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { fetchBet } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { expandMarketName, getSelectionLabel, humanizePick } from '../lib/marketNames.js';

const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

const STATUS = {
  won: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)', border: '#16a34a', label: 'Won', Icon: Trophy },
  cashed_out: { color: '#2563eb', bg: 'rgba(37,99,235,0.12)', border: '#2563eb', label: 'Cashed Out', Icon: Copy },
  lost: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: '#dc2626', label: 'Lost', Icon: XCircle },
  pending: { color: '#d97706', bg: 'rgba(217,119,6,0.12)', border: '#d97706', label: 'Pending', Icon: Clock },
  open: { color: '#d97706', bg: 'rgba(217,119,6,0.12)', border: '#d97706', label: 'Open', Icon: Clock },
  void: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: '#6b7280', label: 'Void', Icon: Ban },
  cancelled: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: '#6b7280', label: 'Cancelled', Icon: Ban },
};

const LEG_STATUS = {
  won: { icon: CheckCircle2, color: '#16a34a', bg: 'rgba(22,163,74,0.15)', border: '#16a34a', label: 'WON' },
  lost: { icon: XCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: '#dc2626', label: 'LOST' },
  pending: { icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: '#d97706', label: 'PENDING' },
  live: { icon: Clock, color: '#2563eb', bg: 'rgba(37,99,235,0.1)', border: '#2563eb', label: 'LIVE' },
  void: { icon: Ban, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: '#6b7280', label: 'VOID' },
};

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getStatusFromBet(bet) {
  const s = bet.status || 'pending';
  return STATUS[s] || STATUS.pending;
}

function getLegState(leg, bet) {
  const matchId = leg.matchId || leg.gameId || leg.id;
  const market = leg.market || '1X2';
  const outcome = leg.outcome || leg.key || '';
  const resolved = (bet.legsResolved || []).find(
    (r) => r.matchId === matchId && (r.market === market || !r.market) && (r.outcome === outcome || !r.outcome),
  );

  if (resolved) {
    const won = resolved.won;
    if (won === true) return 'won';
    if (won === false) return 'lost';
    if (won === null) return 'void';
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

const KEYFRAMES = `
@keyframes tktFadeSlide {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes tktBannerIn {
  from { opacity: 0; transform: translateY(-20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tktLegIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
`;

export default function BetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { account } = useAccount();
  const { toast } = useToast();
  const { loadFromSlip, rememberCode } = useSlip();
  const [bet, setBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animReady, setAnimReady] = useState(false);
  const [visibleLegs, setVisibleLegs] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setAnimReady(false);
    setVisibleLegs(0);
    try {
      const data = await fetchBet(id);
      setBet(data?.bet || data);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (mountedRef.current) setAnimReady(true);
        });
      });
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!animReady || !bet) return;
    const legs = bet.legs || bet.selections || [];
    if (legs.length === 0) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleLegs(i);
      if (i >= legs.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [animReady, bet]);

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
      navigator.share({ title: 'Oddsify Ticket', text: `Check out my ticket: ${code}`, url }).catch(() => {});
    } else {
      setShareOpen(true);
    }
  };

  const shareTo = (target, c) => {
    const url = `${window.location.origin}/code/${c}`;
    const text = `Check out this ticket ${c} on Oddsify`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);
    let href = '';
    switch (target) {
      case 'whatsapp':
        href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`; break;
      case 'telegram':
        href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`; break;
      case 'twitter':
        href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`; break;
      case 'facebook':
        href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`; break;
      default:
        navigator.clipboard?.writeText(url);
        toast('Share link copied!', 'success');
        return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (!account) {
    return (
      <Frame onBack={() => navigate('/login?next=' + window.location.pathname)}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Sign in to view ticket</div>
          <button type="button" onClick={() => navigate('/login?next=' + window.location.pathname)}
            style={{ marginTop: 16, padding: '12px 28px', background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </Frame>
    );
  }

  if (loading) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: 12 }}><SkeletonLoader /></div>
      </Frame>
    );
  }

  if (error || !bet) {
    return (
      <Frame onBack={() => navigate(-1)}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <XCircle size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{error || 'Ticket not found'}</div>
          <button type="button" onClick={() => navigate('/my-bets')}
            style={{ marginTop: 16, padding: '10px 24px', background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Back to My Bets
          </button>
        </div>
      </Frame>
    );
  }

  const legs = bet.legs || bet.selections || [];
  const code = bet.bookingCode || bet.code || bet.id?.slice(-8) || '—';
  const status = bet.status || 'pending';
  const ss = getStatusFromBet(bet);
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || bet.odds || 1);
  const payout = Number(bet.payout || bet.winAmount || bet.cashOut || bet.win || 0);
  const potential = Number(bet.potentialReturn || bet.win || stake * odds);
  const bonus = Number(bet.bonus || bet.bonusAmount || 0);
  const isWon = status === 'won' || status === 'cashed_out';
  const isSettled = status !== 'open' && status !== 'pending';
  const isCashedOut = status === 'cashed_out';
  const betType = bet.type || (legs.length > 1 ? 'Multiple' : 'Single');
  const totalReturn = isSettled ? payout : potential;
  const profit = isWon ? totalReturn - stake : 0;
  const StatusIcon = ss.Icon;

  return (
    <Frame onBack={() => navigate(-1)}>
      {/* Status Banner */}
      <div style={{ padding: '0 12px', marginTop: 0, animation: animReady ? 'tktBannerIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '14px 16px', borderRadius: 12, fontWeight: 800, fontSize: 16,
          letterSpacing: 0.5, textTransform: 'uppercase',
          background: isCashedOut ? 'rgba(37,99,235,0.15)' : ss.bg,
          color: isCashedOut ? '#2563eb' : ss.color,
          border: `1px solid ${isCashedOut ? 'rgba(37,99,235,0.3)' : ss.border}`,
        }}>
          <StatusIcon size={22} />
          <span>{isCashedOut ? 'CASHED OUT' : ss.label.toUpperCase()}</span>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{ padding: '12px 12px 0', animation: animReady ? 'tktFadeSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none' }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)',
          padding: '16px 16px 0', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>TICKET</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: MONO, letterSpacing: 0.5 }}>
                {code.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: MONO }}>
              {fmtDate(bet.placedAt || bet.createdAt)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{betType}</span>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 999,
              background: isCashedOut ? 'rgba(37,99,235,0.15)' : ss.bg,
              color: isCashedOut ? '#2563eb' : ss.color,
              fontWeight: 700, fontSize: 12,
            }}>
              <StatusIcon size={14} />
              <span>{isCashedOut ? 'Cashed Out' : ss.label}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', padding: '14px 0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {isSettled ? 'Total Return' : 'Potential Return'}
              </span>
              <span style={{
                fontSize: 26, fontWeight: 800,
                color: isWon ? '#16a34a' : 'var(--text)',
                fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
                textShadow: isWon ? '0 0 20px rgba(22,163,74,0.3)' : 'none',
              }}>
                GHS {fmtMoney(totalReturn)}
              </span>
            </div>
          </div>

          <SummaryRow label="Total Stake" value={`GHS ${fmtMoney(stake)}`} />
          <SummaryRow label="Total Odds" value={odds.toFixed(2)} />
          {bonus > 0 && <SummaryRow label="Bonus" value={`GHS ${fmtMoney(bonus)}`} accent />}
          {isSettled && (
            <SummaryRow label="Profit / Loss" value={`${isWon ? '+' : ''}GHS ${fmtMoney(profit)}`} valueColor={isWon ? '#16a34a' : '#dc2626'} />
          )}
          {isCashedOut && bet.cashOut != null && (
            <SummaryRow label="Cashout Amount" value={`GHS ${fmtMoney(Number(bet.cashOut))}`} accentBlue />
          )}

          <div style={{ display: 'flex', gap: 10, padding: '14px 0' }}>
            <button type="button" onClick={handleShowOff}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 120ms' }}>
              <Share2 size={16} /> Show Off
            </button>
            <button type="button" onClick={handleRebook}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <RotateCcw size={16} /> Remix Bet
            </button>
          </div>
        </div>
      </div>

      {/* Booking Code */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px', animation: animReady ? 'tktFadeSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none', animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>BOOKING CODE</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: MONO, letterSpacing: 0.5 }}>{code.toUpperCase()}</span>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(code.toUpperCase()); toast('Code copied!', 'success'); }} style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', padding: 4 }}>
            <Copy size={14} />
          </button>
        </div>
        <button type="button" onClick={() => navigate('/codehub')} style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Load Code
        </button>
      </div>

      {/* Selections */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '0 4px 10px' }}>
          Selections ({legs.length})
        </div>
        {legs.map((leg, i) => (
          <LegCard key={i} leg={leg} bet={bet} index={i} visible={visibleLegs > i} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 16px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: '14px', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Selections: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{legs.length}</span>
          </span>
          <button type="button" onClick={() => navigate('/wallet')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 0, color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Wallet size={14} /> Transactions
          </button>
        </div>
        <button type="button" onClick={() => navigate('/help')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: '14px', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Headphones size={16} /> Need Help?</span>
          <ChevronRight size={14} color="var(--text-dim)" />
        </button>
      </div>

      {/* Share Sheet */}
      {shareOpen && (
        <>
          <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 92 }} aria-hidden="true" />
          <div role="dialog" aria-label="Share ticket" style={{ position: 'fixed', left: 8, right: 8, bottom: 16, maxWidth: 560, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, zIndex: 93 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Share Ticket</div>
              <button type="button" onClick={() => setShareOpen(false)} style={{ background: 'none', border: 0, color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}>
                <ChevronLeft size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
                { id: 'telegram', label: 'Telegram', color: '#229ED9' },
                { id: 'twitter', label: 'X', color: 'var(--text)' },
                { id: 'facebook', label: 'Facebook', color: '#1877F2' },
              ].map((opt) => (
                <button key={opt.id} type="button" onClick={() => shareTo(opt.id, code)} style={{ padding: '12px 0', borderRadius: 12, background: 'var(--surface-2)', color: opt.color, border: 0, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/code/${code}`); toast('Link copied!', 'success'); setShareOpen(false); }} style={{ width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 12, background: 'var(--accent)', color: 'var(--gold-ink)', border: 0, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Copy Share Link
            </button>
          </div>
        </>
      )}

      <style>{KEYFRAMES}</style>
    </Frame>
  );
}

function Frame({ onBack, children }) {
  const frameNav = useNavigate();
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full flex flex-col" style={{ maxWidth: 414, minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)', padding: '12px 14px', position: 'sticky', top: 0, zIndex: 10, animation: 'tktFadeSlide 0.3s ease both' }}>
          <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 0, color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={20} /> Back
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ticket Details</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-soft)' }}>
            <button type="button" onClick={() => frameNav('/')} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}>
              <Home size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueColor, accent, accentBlue }) {
  const c = accent ? 'var(--accent)' : accentBlue ? '#2563eb' : valueColor || 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function LegCard({ leg, bet, index, visible }) {
  const r = getLegState(leg, bet);
  const ls = LEG_STATUS[r] || LEG_STATUS.pending;
  const StatusIcon = ls.icon;
  const won = r === 'won';
  const lost = r === 'lost';
  const score = getLegScore(leg, bet);

  const home = leg.home || '';
  const away = leg.away || '';
  const marketKey = leg.market || '1X2';
  const marketName = leg.marketName || expandMarketName(marketKey);
  const rawSelection = getSelectionLabel(leg);
  const selection = humanizePick(rawSelection, home, away);
  const odds = Number(leg.odds || 0);
  const gameId = leg.gameId || leg.matchId || leg.id?.toString().slice(-6) || '—';
  const dt = leg.matchDate || leg.kickoff;
  const dtFormatted = dt ? fmtShortDate(dt) : '';
  const league = leg.league || '';
  const hasScore = score && score.scoreHome != null;

  return (
    <div style={{
      marginBottom: 10, borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${won ? 'rgba(22,163,74,0.4)' : lost ? 'rgba(220,38,38,0.4)' : ls.border}`,
      background: 'var(--surface)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-10px)',
      transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      transitionDelay: `${index * 0.06}s`,
    }}>
      {/* Result Banner Bar */}
      {r !== 'pending' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: ls.bg,
          borderBottom: `1px solid ${ls.border}40`,
        }}>
          <StatusIcon size={14} color={ls.color} />
          <span style={{ fontSize: 11, fontWeight: 800, color: ls.color, letterSpacing: 0.5 }}>{ls.label}</span>
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {/* Game ID + League + Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: MONO }}>
            Game ID: {gameId}{league ? <> · {league}</> : null}
          </span>
          {dtFormatted && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: MONO }}>{dtFormatted}</span>}
        </div>

        {/* Teams */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--surface-2)', marginBottom: 10,
        }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text)', textAlign: 'right' }}>{home}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, flexShrink: 0 }}>vs</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text)', textAlign: 'left' }}>{away}</span>
        </div>

        {/* Score */}
        {hasScore && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 6, marginBottom: 10,
            background: 'var(--surface-2)', fontSize: 15, fontWeight: 800,
            color: 'var(--text)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
          }}>
            <span>{score.scoreHome}</span>
            <span style={{ color: 'var(--text-dim)' }}>-</span>
            <span>{score.scoreAway}</span>
          </div>
        )}

        {/* Market / Selection / Odds grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px',
          padding: '10px 12px', borderRadius: 8,
          background: won ? 'rgba(22,163,74,0.06)' : lost ? 'rgba(220,38,38,0.06)' : 'var(--bg)',
          border: `1px solid ${won ? 'rgba(22,163,74,0.2)' : lost ? 'rgba(220,38,38,0.2)' : 'var(--line)'}`,
        }}>
          <DetailItem label="Pick" value={selection} valueColor={won ? '#16a34a' : lost ? '#dc2626' : 'var(--accent)'} />
          <DetailItem label="Market" value={marketName} />
          <DetailItem label="Selection" value={selection} valueColor={won ? '#16a34a' : lost ? '#dc2626' : 'var(--text)'} />
          <DetailItem label="Odds" value={odds > 0 ? odds.toFixed(2) : '—'} mono />
          {hasScore && <DetailItem label="Final Score" value={`${score.scoreHome} - ${score.scoreAway}`} mono />}
          <DetailItem label="Result" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: ls.color, fontWeight: 800 }}>
              <StatusIcon size={12} /> {ls.label}
            </span>
          } />
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, valueColor, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: valueColor || 'var(--text)', fontFamily: mono ? MONO : 'inherit', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div>
      <div style={{ height: 60, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 12, opacity: 0.5 }} />
      <div style={{ height: 180, background: 'var(--surface)', borderRadius: 12, marginBottom: 12, border: '1px solid var(--line)' }} />
      {[1, 2].map((i) => (
        <div key={i} style={{ height: 130, background: 'var(--surface)', borderRadius: 12, marginBottom: 10, border: '1px solid var(--line)' }} />
      ))}
    </div>
  );
}
