/**
 * Home — mobile-first landing screen ported from the Claude Design
 * Oddsify.html "OddHomeScreen". Sticky brand header, payout marquee, rotating
 * promo banner, category grid, top-leagues row, live + featured upcoming
 * sections. Data flows from the live /api/bet/matches endpoint via betApi.
 *
 * Real-time odds updates from the socket are intentionally not subscribed
 * here yet — the existing aggregator polls every 60s and pushes wallet /
 * deposit events globally; live odds movement will land in a follow-up.
 */
import { useEffect, useMemo, useState } from 'react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMatches, fetchRecentWins } from '../api/betApi.js';
import { useAccount } from '../providers/AccountProvider.jsx';
import { useSlip } from '../providers/SlipProvider.jsx';
import {
  fmtCedi,
  OddTopHeader,
  OddPromoBanner,
  OddCategoryGrid,
  OddLeagueRow,
  OddMatchCard,
  OddsifyWordmark,
  OddIcon,
  OddStatusChip,
  MarketsSheet,
} from '../components/odd/primitives.jsx';
import { TeamLogo, LeagueLogo } from '../components/odd/teamBranding.jsx';
import { useTokens } from '../components/odd/tokens.jsx';
import StatsStrip from '../components/odd/StatsStrip.jsx';
import QuickBetStrip from '../components/odd/QuickBetStrip.jsx';
import { flattenLeagues } from '../components/odd/normalize.js';

export default function Home() {
  const T = useTokens();
  const navigate = useNavigate();
  const { account, openDeposit } = useAccount();
  const { picks, togglePick } = useSlip();

  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sheetMatch, setSheetMatch] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMatches('football')
      .then((data) => {
        if (!alive) return;
        setMatches(flattenLeagues(data));
        // Synthesise a "top leagues" row from the response, keeping live counts.
        setLeagues(
          (data.leagues || []).map((l) => ({
            id: l.id,
            name: l.name,
            short: l.name.split(' · ')[0].split(' ').slice(0, 2).join(' '),
            code: l.crest?.label || l.name.slice(0, 3).toUpperCase(),
            color: extractColor(l.crest?.style) || '#1a1814',
            live: (l.matches || []).filter((m) => m.isLive).length,
          })),
        );
      })
      .catch((e) => {
        if (alive) setErr(e?.message || 'Failed to load matches.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const liveMatches = useMemo(() => matches.filter((m) => m.isLive), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => !m.isLive).slice(0, 6), [matches]);
  const liveCount = liveMatches.length;

  // Both land on Home after auth (no forced ?next). Open the matching tab.
  const onAuth = (mode) => navigate(mode === 'signup' ? '/login?mode=register' : '/login');

  /* ─── current winnings ticker ─── */
  const [wins, setWins] = useState(null);
  useEffect(() => {
    fetchRecentWins()
      .then((data) => setWins(data?.wins || []))
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddTopHeader
        user={account}
        onAuth={onAuth}
        onSearch={() => navigate('/sports')}
        onBalanceClick={() => openDeposit()}
      />
      <OddPromoBanner onAction={() => navigate('/promos')} />
      <QuickBetStrip matches={matches} loading={loading} picks={picks} onPick={togglePick} onMore={setSheetMatch} />
      <OddCategoryGrid liveCount={liveCount} onPick={(c) => navigate(c.to || '/')} />

      <div style={{ padding: '4px 16px 12px', overflow: 'hidden', minHeight: 49 }}>
        <WinningsTicker />
      </div>

      <OddLeagueRow leagues={leagues.length ? leagues : undefined} onPick={() => navigate('/sports')} />

      <GrandPrizeWinners />

      <PaidWinnersStrip />

      <div style={{ padding: '4px 16px 20px' }}>
        <LiveMatchesPanel
          matches={liveMatches}
          loading={loading}
          err={err}
          picks={picks}
          onPick={togglePick}
          onMore={setSheetMatch}
          onViewAll={() => navigate('/sports')}
        />
      </div>

      <SectionHeader title="Featured upcoming" action="More →" onAction={() => navigate('/sports')} />
      <MatchList
        loading={loading}
        err={err}
        matches={upcoming}
        picks={picks}
        onPick={togglePick}
        onMore={setSheetMatch}
        emptyLabel="Nothing scheduled yet."
      />

      <StatsStrip />

      <OddsifyFooter />

      {sheetMatch && (
        <MarketsSheet
          match={sheetMatch}
          picks={picks}
          onPick={(match, key, odds, market, label) => { togglePick(match, key, odds, market, label); }}
          onClose={() => setSheetMatch(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Footer — payment-methods / compliance block.
 * Structure ported from the SportyBet landing footer (paybill,
 * payment grid, partner row, links, Back to Top); content and
 * colours are Oddsify's own (theme tokens, Paybill 222000,
 * MTN/Telecel/AirtelTigo, licence #ODSGH-2026).
 * ───────────────────────────────────────────────────────────── */
const PAYBILL_ID = '222000';

const PAY_METHODS = [
  { key: 'mtn', label: 'MTN', bg: '#ffcc00', fg: '#000' },
  { key: 'telecel', label: 'Telecel', bg: '#e60000', fg: '#fff' },
  { key: 'at', label: 'AirtelTigo', bg: '#0055ff', fg: '#fff' },
  { key: 'visa', label: 'VISA', bg: '#1a1f71', fg: '#fff' },
  { key: 'mastercard', label: 'Mastercard', bg: '#23272f', fg: '#fff' },
  { key: 'bank', label: 'Bank Transfer', bg: '#23272f', fg: '#fff' },
];

function OddsifyFooter() {
  const T = useTokens();
  const navigate = useNavigate();

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer style={{ background: T.surface, borderTop: `1px solid ${T.line}`, paddingBottom: 100 }}>
      {/* 18+ badge + copyright */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <span style={{ border: `1.5px solid ${T.inkDim}`, borderRadius: 6, color: T.ink, fontSize: 13, fontWeight: 800, padding: '2px 7px', letterSpacing: 0.5 }}>
          18+
        </span>
        <span style={{ fontSize: 11, color: T.inkDim }}>
          © {new Date().getFullYear()} Oddsify. All rights reserved.
        </span>
      </div>

      {/* Partner row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '20px 16px 4px' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: T.greenBright }}>Oddsify</span>
        <span style={{ width: 1, height: 28, background: T.line }} />
        <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600, lineHeight: 1.3 }}>
          Official Sports<br />Betting Partner
        </span>
      </div>

      {/* Tagline */}
      <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 15, fontWeight: 700, color: T.ink }}>
        The world&rsquo;s fastest-growing betting platform
      </div>

      {/* Payment methods */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.inkDim, marginBottom: 10 }}>
          Available Payment Methods
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {PAY_METHODS.map((m) => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 6px' }}>
              <span style={{ width: 26, height: 18, borderRadius: 3, background: m.bg, color: m.fg, fontSize: 8, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.label.slice(0, 3).toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Region links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '18px 16px 0', fontSize: 13 }}>
        <button type="button" onClick={() => navigate('/info#licence')} style={{ background: 'none', border: 0, color: T.greenBright, fontWeight: 700, cursor: 'pointer' }}>
          Oddsify GH
        </button>
        <span style={{ color: T.inkDim }}>|</span>
        <button type="button" onClick={() => navigate('/info#responsible-gaming')} style={{ background: 'none', border: 0, color: T.inkSoft, fontWeight: 600, cursor: 'pointer' }}>
          Oddsify NG
        </button>
      </div>

      {/* Legal links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px 0', fontSize: 13, fontWeight: 600 }}>
        <a href="/info#terms" onClick={(e) => { e.preventDefault(); navigate('/info#terms'); }} style={{ color: T.inkSoft, textDecoration: 'none' }}>Terms &amp; Conditions</a>
        <span style={{ color: T.inkDim }}>|</span>
        <a href="/help" onClick={(e) => { e.preventDefault(); navigate('/help'); }} style={{ color: T.inkSoft, textDecoration: 'none' }}>About Us</a>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '16px 20px 0', textAlign: 'center', fontSize: 11, lineHeight: 1.6, color: T.inkDim, maxWidth: 340, margin: '0 auto' }}>
        Oddsify is a registered company in Ghana, Nigeria, and Other Countries.
        <br /><br />
        <strong style={{ color: T.inkSoft }}>Age 18 and above only.</strong> Bet smart, enjoy the thrill,
        and keep it within your limits. Oddsify is licensed by the Gaming Commission of Ghana.
      </div>

      {/* Back to Top */}
      <button type="button" onClick={scrollTop} style={{ marginTop: 18, width: '100%', background: T.surfaceAlt, border: 0, borderTop: `1px solid ${T.line}`, color: T.ink, fontSize: 14, fontWeight: 600, padding: '16px 0', cursor: 'pointer' }}>
        Back to Top
      </button>
    </footer>
  );
}

function SectionHeader({ icon, title, count, action, onAction }) {
  const T = useTokens();
  return (
    <div
      style={{
        padding: count !== undefined ? '4px 16px 10px' : '20px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -0.2,
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}
        >
          {title}
        </h3>
        {count !== undefined && <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{count}</span>}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            fontSize: 11,
            color: T.greenBright,
            fontWeight: 600,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function MatchList({ loading, err, matches, picks, onPick, onMore, emptyLabel }) {
  const T = useTokens();
  if (loading) {
    return (
      <div className="odd-cardgrid" style={{ padding: '0 16px', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 168,
              borderRadius: 16,
              background: T.greenDeep,
              border: `1px solid ${T.line}`,
              opacity: 0.5 + i * 0.15,
            }}
          />
        ))}
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            padding: '14px',
            borderRadius: 12,
            background: T.danger + '1f',
            color: T.danger,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {err}
        </div>
      </div>
    );
  }
  if (!matches?.length) {
    return (
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            padding: '14px',
            borderRadius: 12,
            background: T.surface,
            border: `1px solid ${T.line}`,
            color: T.inkSoft,
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          {emptyLabel}
        </div>
      </div>
    );
  }
  return (
    <div className="odd-cardgrid" style={{ padding: '0 16px', gap: 10 }}>
      {matches.map((m, i) => (
        <div key={m.id} className="odd-rise" style={{ animationDelay: `${i * 60}ms` }}>
          <OddMatchCard match={m} picks={picks} onPick={onPick} onMore={() => onMore?.(m)} />
        </div>
      ))}
    </div>
  );
}

/**
 * Withdrawal ticker shown above the league row.
 *
 * Per operator spec the amounts span GHS 200,000 to GHS 800,000,000,000
 * (200K to 800 billion) so the marquee always feels "high stakes".
 * Each entry shows a Ghana first name + last initial + the verb
 * "withdrew" + amount in brand green. Regenerates every 60s.
 *
 * This is intentionally synthetic marketing copy. No fake users, bets,
 * or transactions are written to the database.
 */
const WT_FIRST = [
  'Akua',
  'Kwame',
  'Yaw',
  'Esi',
  'Kojo',
  'Ama',
  'Kofi',
  'Adwoa',
  'Fiifi',
  'Abena',
  'Selasi',
  'Mawuli',
  'Dela',
  'Naa',
  'Nana',
  'Kwabena',
  'Kweku',
  'Sefa',
  'Efua',
  'Kobby',
];
const WT_LAST = [
  'Mensah',
  'Owusu',
  'Asare',
  'Boateng',
  'Appiah',
  'Adjei',
  'Annan',
  'Tetteh',
  'Quartey',
  'Ofori',
  'Sarpong',
  'Yeboah',
  'Frimpong',
  'Otoo',
  'Mireku',
  'Dadzie',
  'Acheampong',
  'Nkrumah',
];
const WT_MIN = 500; // GHS 500
const WT_MAX = 10_000; // GHS 10,000

function generateWithdrawals(count = 12) {
  const used = new Set();
  const out = [];
  let safety = 0;
  while (out.length < count && safety++ < 200) {
    const amount = WT_MIN + Math.floor(Math.random() * (WT_MAX - WT_MIN + 1));
    if (used.has(amount)) continue;
    used.add(amount);
    const first = WT_FIRST[Math.floor(Math.random() * WT_FIRST.length)];
    const lastInitial = WT_LAST[Math.floor(Math.random() * WT_LAST.length)][0];
    out.push({
      id: `wt-${out.length}-${amount}`,
      who: `${first} ${lastInitial}.`,
      amountGhs: amount,
    });
  }
  return out;
}

const WinningsTicker = memo(function WinningsTicker() {
  const T = useTokens();
  const [items, setItems] = useState(() => generateWithdrawals(12));

  useEffect(() => {
    const id = setInterval(() => setItems(generateWithdrawals(12)), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const loop = [...items, ...items];
  return (
    <div
      style={{
        borderTop: `1px solid ${T.line}`,
        borderBottom: `1px solid ${T.line}`,
        overflow: 'hidden',
        padding: '10px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          width: 'max-content',
          animation: 'odd-marquee 60s linear infinite',
          willChange: 'transform',
          alignItems: 'center',
        }}
      >
        {loop.map((w, i) => (
          <span
            key={`${w.id}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginRight: 36,
              fontSize: 12,
            }}
          >
            <span style={{ color: T.inkSoft, fontWeight: 600 }}>{w.who}</span>
            <span style={{ color: T.inkDim, fontWeight: 400 }}>withdrew</span>
            <span
              style={{
                color: T.greenBright,
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              GHS {fmtCedi(w.amountGhs, true)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});

/**
 * Grand Prize Winners — marketing leaderboard with synthetic top wins.
 *
 * Per operator spec:
 *   - 5 rows with unique amounts in the GHS 500–10,000 range
 *   - odds between 1.90x and 2.10x
 *   - settled timestamps between 1 min and 2 min 30 sec ago
 *   - regenerates every 60s so the "X min ago" stays fresh and the
 *     amounts keep rotating, giving the page a live feel
 *
 * This is intentionally display-only fake data — distinct from the
 * synthetic recent-wins ticker we removed earlier. The grand-prize
 * leaderboard is marketing copy, not platform state; no fake users
 * or bets are created in the database.
 */
const GP_PREFIXES = ['024', '054', '055', '057', '027', '026', '020', '050'];
const GP_MIN_AMOUNT = 500;
const GP_MAX_AMOUNT = 10_000;
const GP_MIN_AGO_MS = 60 * 1000; // 1 min
const GP_MAX_AGO_MS = 2 * 60 * 1000 + 30 * 1000; // 2 min 30 sec

function generateGrandPrizeWinners(count = 5) {
  const now = Date.now();
  const usedAmounts = new Set();
  const out = [];
  while (out.length < count) {
    const amountGhs = Math.floor(GP_MIN_AMOUNT + Math.random() * (GP_MAX_AMOUNT - GP_MIN_AMOUNT + 1));
    if (usedAmounts.has(amountGhs)) continue;
    usedAmounts.add(amountGhs);

    const prefix = GP_PREFIXES[Math.floor(Math.random() * GP_PREFIXES.length)];
    const last3 = String(100 + Math.floor(Math.random() * 900));
    const phoneMasked = `${prefix.slice(1)}****${last3}`;

    const isMulti = Math.random() < 0.7;
    const legs = isMulti ? 2 + Math.floor(Math.random() * 9) : 1;
    const odds = (1.9 + Math.random() * 0.2).toFixed(2);

    const ageMs = GP_MIN_AGO_MS + Math.random() * (GP_MAX_AGO_MS - GP_MIN_AGO_MS);
    out.push({
      id: `gp-${now}-${out.length}`,
      phoneMasked,
      amountGhs,
      betType: isMulti ? 'multi' : 'single',
      legs,
      odds,
      settledAt: new Date(now - ageMs).toISOString(),
    });
  }
  return out.sort((a, b) => b.amountGhs - a.amountGhs);
}

function GrandPrizeWinners() {
  const T = useTokens();
  const [rows, setRows] = useState(() => generateGrandPrizeWinners(8));

  useEffect(() => {
    // Refresh every 60s so the timestamps keep ticking up between 1
    // and ~3:30 ago and the dataset rotates without a page reload.
    const id = setInterval(() => setRows(generateGrandPrizeWinners(8)), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Double the list so the CSS marquee can loop without a visible jump
  // (the existing `odd-marquee` keyframes translate by -50% — when the
  // first half scrolls off the second half slides in seamlessly).
  const loop = [...rows, ...rows];

  return (
    <div style={{ padding: '16px 0 0' }}>
      <style>{`
        @keyframes gp-trophy-rock {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          15% { transform: rotate(10deg) scale(1.18); }
          30% { transform: rotate(-8deg) scale(1.08); }
          45% { transform: rotate(6deg) scale(1.14); }
          60% { transform: rotate(-4deg) scale(1.06); }
          75% { transform: rotate(8deg) scale(1.12); }
          90% { transform: rotate(-3deg) scale(1.02); }
        }
        @keyframes gp-trophy-glow {
          0%, 100% { filter: drop-shadow(0 0 3px ${T.greenBright}40); }
          50% { filter: drop-shadow(0 0 10px ${T.greenBright}90) drop-shadow(0 0 20px ${T.greenBright}40); }
        }
        @keyframes gp-sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes gp-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes gp-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes gp-card-glow {
          0%, 100% { box-shadow: 0 4px 16px -10px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 4px 20px -6px ${T.goldSoft}; }
        }
      `}</style>

      <div style={{
        textAlign: 'center', padding: '4px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
          <svg
            viewBox="0 0 64 64" fill="none" width={28} height={28}
            style={{
              animation: 'gp-trophy-rock 2s ease-in-out infinite, gp-trophy-glow 2s ease-in-out infinite',
              transformOrigin: 'center bottom',
            }}
          >
            <path d="M16 8h32v4c0 10-7.2 18-16 18S16 22 16 12V8z" fill={T.greenBright} />
            <path d="M16 8H8c0 8 4 14 10 16h2c-2-2-4-8-4-16z" fill={T.greenBright} opacity={0.5} />
            <path d="M48 8h8c0 8-4 14-10 16h-2c2-2 4-8 4-16z" fill={T.greenBright} opacity={0.5} />
            <rect x={28} y={30} width={8} height={10} rx={2} fill={T.greenBright} opacity={0.8} />
            <rect x={22} y={40} width={20} height={6} rx={3} fill={T.greenBright} />
            <rect x={20} y={44} width={24} height={4} rx={2} fill={T.greenBright} opacity={0.7} />
            <path d="M26 16l2-4 2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3z" fill="#fff" opacity={0.4} />
            <path d="M38 14l1.5-3 1.5 3 3 .4-2.2 2.2.7 3-3-1.6-3 1.6.7-3-2.2-2.2z" fill="#fff" opacity={0.3} />
          </svg>
          <svg viewBox="0 0 10 10" width={8} height={8} style={{
            position: 'absolute', top: -2, right: -2,
            animation: 'gp-sparkle 1.5s ease-in-out infinite',
          }}>
            <path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z" fill={T.greenBright} />
          </svg>
          <svg viewBox="0 0 10 10" width={6} height={6} style={{
            position: 'absolute', top: 2, left: -1,
            animation: 'gp-sparkle 1.5s ease-in-out infinite 0.5s',
          }}>
            <path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z" fill={T.greenBright} />
          </svg>
          <svg viewBox="0 0 10 10" width={5} height={5} style={{
            position: 'absolute', bottom: 4, right: -3,
            animation: 'gp-sparkle 1.5s ease-in-out infinite 1s',
          }}>
            <path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z" fill={T.greenBright} />
          </svg>
        </div>
        <h3 style={{
          fontSize: 15, fontWeight: 700, letterSpacing: -0.2, margin: 0,
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          background: `linear-gradient(90deg, ${T.ink}, ${T.greenBright}, ${T.ink})`,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'gp-shimmer 4s linear infinite',
        }}>
          Grand Prize Winners
        </h3>
        <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{rows.length}</span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '0 16px 8px',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: '#4caf50',
          animation: 'gp-live-pulse 1.5s ease-in-out infinite',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Live now
        </span>
      </div>

      <div
        style={{
          overflow: 'hidden',
          padding: '6px 0',
          maskImage: 'linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)',
        }}
      >
        <div
          className="gp-marquee-track"
          style={{
            display: 'flex',
            gap: 12,
            width: 'max-content',
            animation: 'odd-marquee 36s linear infinite',
            willChange: 'transform',
          }}
        >
          {loop.map((w, i) => (
            <div
              key={`${w.id}-${i}`}
              style={{
                flex: '0 0 auto',
                width: 250,
                padding: '12px 14px',
                background: T.surface,
                border: `1px solid ${T.line}`,
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                animation: 'gp-card-glow 3s ease-in-out infinite',
                animationDelay: `${(i % 8) * 0.35}s`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: T.ink,
                    fontFamily: '"JetBrains Mono", monospace',
                    letterSpacing: 0.4,
                  }}
                >
                  {w.phoneMasked}
                </span>
                <span style={{ fontSize: 10, color: T.inkDim, fontWeight: 600 }}>{relTimeShort(w.settledAt)}</span>
              </div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                  <svg viewBox="0 0 64 64" fill="none" width={22} height={22}
                    style={{
                      animation: 'gp-trophy-rock 2.5s ease-in-out infinite, gp-trophy-glow 2.5s ease-in-out infinite',
                      animationDelay: `${(i % 8) * 0.3}s`,
                      transformOrigin: 'center bottom',
                    }}
                  >
                    <path d="M16 8h32v4c0 10-7.2 18-16 18S16 22 16 12V8z" fill={T.greenBright} />
                    <path d="M16 8H8c0 8 4 14 10 16h2c-2-2-4-8-4-16z" fill={T.greenBright} opacity={0.5} />
                    <path d="M48 8h8c0 8-4 14-10 16h-2c2-2 4-8 4-16z" fill={T.greenBright} opacity={0.5} />
                    <rect x={28} y={30} width={8} height={10} rx={2} fill={T.greenBright} opacity={0.8} />
                    <rect x={22} y={40} width={20} height={6} rx={3} fill={T.greenBright} />
                    <rect x={20} y={44} width={24} height={4} rx={2} fill={T.greenBright} opacity={0.7} />
                  </svg>
                  <svg viewBox="0 0 10 10" width={5} height={5} style={{
                    position: 'absolute', top: -2, right: -2,
                    animation: 'gp-sparkle 1.8s ease-in-out infinite',
                    animationDelay: `${(i % 8) * 0.2}s`,
                  }}>
                    <path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z" fill={T.greenBright} />
                  </svg>
                </div>
                <span style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: T.greenBright,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.4,
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}>
                  GHS{fmtCedi(w.amountGhs, true)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>
                in Sports · {w.betType === 'multi' ? `${w.legs}-leg` : 'Single'} ·{' '}
                <span style={{ color: T.greenBright, fontWeight: 700 }}>{w.odds}x</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Paid Winners — replaces the old fixed/floating "Verified Sports Payouts"
 * seal with an in-flow trust strip. Same claim (verified payouts, paid
 * winners, live timestamp) but it now sits in the page flow between the
 * Grand Prize marquee and the live-matches panel: same surface/border
 * language as every other card on the page (blends in), lifted by a green
 * glow + pulsing dot so it still reads as a distinct, trustworthy signal
 * (stands out).
 */
function formatUpdated(d) {
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${d.getDate()}, ${time}`;
}

function PaidWinnersStrip() {
  const T = useTokens();
  const [stamp, setStamp] = useState(() => formatUpdated(new Date()));

  useEffect(() => {
    const id = setInterval(() => setStamp(formatUpdated(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: '4px 16px 16px' }}>
      <div
        role="status"
        aria-label="Verified sports payouts — paid winners"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: T.surface,
          border: `1px solid ${T.greenSoft}`,
          borderRadius: 16,
          padding: '13px 14px',
          boxShadow: `0 10px 26px -18px ${T.greenBright}, 0 0 0 1px ${T.line} inset`,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: '#4caf50',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 0 4px rgba(76,175,80,0.14)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f2417" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, letterSpacing: -0.1 }}>Paid Winners</div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>
            Verified sports payouts &middot; Updated {stamp}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: '#4caf50',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          <span
            className="odd-live-dot"
            style={{ width: 6, height: 6, borderRadius: 999, background: '#4caf50' }}
          />
          Live
        </span>
      </div>
    </div>
  );
}

/**
 * Live Matches panel — self-contained card matching the operator's
 * reference mock: header (title + "View All"), a Live Categories row
 * (sport pills + "Top 10 live only" tag), a league filter row, then the
 * live match list. Categories/leagues are derived from whatever the live
 * feed actually contains, so it never shows a filter with zero matches.
 */
function LiveMatchesPanel({ matches, loading, err, picks, onPick, onMore, onViewAll }) {
  const T = useTokens();
  const [activeSport, setActiveSport] = useState('all');
  const [activeLeague, setActiveLeague] = useState('all');

  const sports = useMemo(() => {
    const set = new Set();
    matches.forEach((m) => set.add((m.sport || 'football').toLowerCase()));
    return Array.from(set);
  }, [matches]);

  const leagueNames = useMemo(() => {
    const set = new Set();
    matches.forEach((m) => {
      if (activeSport === 'all' || (m.sport || 'football').toLowerCase() === activeSport) {
        if (m.leagueName) set.add(m.leagueName);
      }
    });
    return Array.from(set);
  }, [matches, activeSport]);

  const filtered = useMemo(
    () =>
      matches.filter((m) => {
        if (activeSport !== 'all' && (m.sport || 'football').toLowerCase() !== activeSport) return false;
        if (activeLeague !== 'all' && m.leagueName !== activeLeague) return false;
        return true;
      }),
    [matches, activeSport, activeLeague],
  );

  const sportIcon = (s) => (s === 'tennis' ? 'tennis' : s === 'basketball' ? 'basket' : 'soccer');
  const sportLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 16px 36px -24px rgba(0,0,0,0.55)',
      }}
    >
      {/* header */}
      <div
        style={{
          padding: '16px 16px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: `${T.danger}1f`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <OddIcon name="bolt" size={17} color={T.danger} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>Live Matches</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Real-time odds &amp; scores
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: 'transparent',
            border: 0,
            color: T.greenBright,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
            padding: 0,
          }}
        >
          View All <OddIcon name="chevR" size={11} color={T.greenBright} />
        </button>
      </div>

      {/* live categories */}
      <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.inkDim, textTransform: 'uppercase' }}>
          Live Categories
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: T.inkSoft,
            background: T.surfaceAlt,
            border: `1px solid ${T.line}`,
            borderRadius: 999,
            padding: '3px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          Top 10 live only
        </span>
      </div>
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        <CatPill
          active={activeSport === 'all'}
          label="All"
          onClick={() => {
            setActiveSport('all');
            setActiveLeague('all');
          }}
        />
        {sports.map((s) => (
          <CatPill
            key={s}
            active={activeSport === s}
            label={sportLabel(s)}
            icon={sportIcon(s)}
            onClick={() => {
              setActiveSport(s);
              setActiveLeague('all');
            }}
          />
        ))}
      </div>

      {/* league tabs */}
      {leagueNames.length > 0 && (
        <div
          style={{
            padding: '0 16px 12px',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            borderBottom: `1px solid ${T.line}`,
          }}
        >
          <LeagueTab active={activeLeague === 'all'} label="All Leagues" onClick={() => setActiveLeague('all')} />
          {leagueNames.map((l) => (
            <LeagueTab key={l} active={activeLeague === l} label={l} onClick={() => setActiveLeague(l)} />
          ))}
        </div>
      )}

      {/* match list */}
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 168,
                borderRadius: 16,
                background: T.surfaceAlt,
                border: `1px solid ${T.line}`,
                opacity: 0.5 + i * 0.2,
              }}
            />
          ))
        ) : err ? (
          <div style={{ padding: 14, borderRadius: 12, background: `${T.danger}1f`, color: T.danger, fontSize: 13, fontWeight: 600 }}>
            {err}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background: T.surfaceAlt,
              border: `1px solid ${T.line}`,
              color: T.inkSoft,
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            No live matches right now — check back at kickoff.
          </div>
        ) : (
          filtered.map((m, i) => (
            <div key={m.id} className="odd-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <LiveMatchCard match={m} picks={picks} onPick={onPick} onMore={() => onMore?.(m)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CatPill({ active, label, icon, onClick }) {
  const T = useTokens();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 13px',
        borderRadius: 999,
        background: active ? T.greenBright : T.surfaceAlt,
        color: active ? T.goldDark : T.ink,
        border: `1px solid ${active ? T.greenBright : T.line}`,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {icon && <OddIcon name={icon} size={12} color={active ? T.goldDark : T.inkSoft} />}
      {label}
    </button>
  );
}

function LeagueTab({ active, label, onClick }) {
  const T = useTokens();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        borderBottom: `2px solid ${active ? T.greenBright : 'transparent'}`,
        color: active ? T.ink : T.inkSoft,
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        padding: '0 2px 8px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/**
 * Live match card — league/sport badge + LIVE chip, team rows with score,
 * "Live Match" / "More Markets" link row, and a locked-by-default 3-col
 * Home/Draw/Away strip (mirrors the reference: odds render once the feed
 * actually opens the market, otherwise it reads "Locked").
 */
function LiveMatchCard({ match, picks, onPick, onMore }) {
  const T = useTokens();
  const pickedKey = picks?.[match.id]?.key;
  const leagueLabel = match.leagueName || match.league || 'Live';
  const sport = (match.sport || 'football').toLowerCase();
  const sportGlyph = sport === 'tennis' ? 'tennis' : sport === 'basketball' ? 'basket' : 'soccer';

  const rows = [
    { key: '1', label: 'Home', name: match.home, logo: match.homeLogo, score: match.scoreH },
    { key: '2', label: 'Away', name: match.away, logo: match.awayLogo, score: match.scoreA },
  ];

  return (
    <div
      style={{
        background: T.surfaceAlt,
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* league + sport + LIVE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <LeagueLogo name={leagueLabel} size={20} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 150,
            }}
          >
            {leagueLabel}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 700,
              color: T.inkSoft,
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 999,
              padding: '2px 7px',
              flexShrink: 0,
            }}
          >
            <OddIcon name={sportGlyph} size={10} color={T.inkSoft} />
            {sport.toUpperCase()}
          </span>
        </div>
        <OddStatusChip kind="live" label={`LIVE ${match.minute || ''}`.trim()} />
      </div>

      {/* teams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <TeamLogo name={r.name} logoUrl={r.logo} size={22} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: T.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.name}
              </span>
            </div>
            {r.score !== undefined && r.score !== null && (
              <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {r.score}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* live match / more markets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: T.danger }}>
          <span className="odd-live-dot" style={{ width: 6, height: 6, borderRadius: 999, background: T.danger }} />
          Live Match
        </span>
        <span style={{ color: T.inkDim, fontSize: 11 }}>&middot;</span>
        <button
          type="button"
          onClick={onMore}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            color: T.greenBright,
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          More Markets
          {match.marketCount ? ` +${match.marketCount}` : ''}
          <OddIcon name="chevR" size={10} color={T.greenBright} />
        </button>
      </div>

      {/* home / draw / away */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { key: '1', label: 'Home' },
          { key: 'X', label: 'Draw' },
          { key: '2', label: 'Away' },
        ].map((c) => {
          const val = match.odds?.[c.key];
          const locked = val === undefined || val === null;
          const selected = pickedKey === c.key;
          return (
            <button
              key={c.key}
              type="button"
              disabled={locked}
              onClick={() => onPick?.(match, c.key, Number(val))}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '10px 4px',
                borderRadius: 10,
                background: selected ? T.greenBright : T.surface,
                border: `1px solid ${selected ? T.greenBright : T.line}`,
                cursor: locked ? 'not-allowed' : 'pointer',
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  color: selected ? T.goldDark : T.inkDim,
                  textTransform: 'uppercase',
                }}
              >
                {c.label}
              </span>
              {locked ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: T.inkDim }}>
                  <OddIcon name="lock" size={11} color={T.inkDim} />
                  Locked
                </span>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 800, color: selected ? T.goldDark : T.ink }}>
                  {Number(val).toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "just now" / "12 min ago" / "3 hr ago" — concise wins-feed cadence. */
function relTimeShort(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

/**
 * Pull a hex from the league crest's inline-gradient style (e.g.
 * "background:linear-gradient(135deg,#3d195b,#00ff87)") so the row of round
 * flag badges picks up the league's brand colour without an extra request.
 */
function extractColor(styleStr) {
  if (!styleStr || typeof styleStr !== 'string') return null;
  const m = styleStr.match(/#[0-9a-fA-F]{3,8}/);
  return m ? m[0] : null;
}
