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
  MarketsSheet,
} from '../components/odd/primitives.jsx';
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

      <SectionHeader
        icon={
          <span
            className="odd-live-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: T.danger,
            }}
          />
        }
        title="Live now"
        count={liveCount}
        action="All live →"
        onAction={() => navigate('/sports')}
      />

      <MatchList
        loading={loading}
        err={err}
        matches={liveMatches}
        picks={picks}
        onPick={togglePick}
        onMore={setSheetMatch}
        emptyLabel="No live matches right now — check back at kickoff."
      />

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
const WT_MIN = 200_000; // GHS 200,000
const WT_MAX = 800_000_000_000; // GHS 800,000,000,000

function generateWithdrawals(count = 12) {
  const used = new Set();
  const out = [];
  let safety = 0;
  while (out.length < count && safety++ < 200) {
    // Skew toward the lower end on a log scale so smaller (still huge)
    // amounts appear more often than the top-of-range billions — gives
    // a more varied marquee instead of every entry being 700B+.
    const u = Math.random();
    const amount = Math.floor(Math.exp(Math.log(WT_MIN) + u * (Math.log(WT_MAX) - Math.log(WT_MIN))));
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
 *   - 5 rows with unique amounts in the GHS 1M–10M range
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
const GP_MIN_AMOUNT = 1_000_000;
const GP_MAX_AMOUNT = 9_999_999;
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
      <div style={{ textAlign: 'center', padding: '4px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2, fontFamily: '"Space Grotesk", system-ui, sans-serif', margin: 0 }}>
          Grand Prize Winners
        </h3>
        <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{rows.length}</span>
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
                boxShadow: '0 4px 16px -10px rgba(0,0,0,0.4)',
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
                  fontSize: 18,
                  fontWeight: 800,
                  color: T.greenBright,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.4,
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
              >
                GHS{fmtCedi(w.amountGhs, true)}
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
