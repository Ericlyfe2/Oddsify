import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchMatches,
  placeBet,
  fetchBetHistory,
  cashOutBet,
} from '../api/betApi.js';
import { useToast, useAccount } from '../layout/AppShell.jsx';

const BONUS = 0.08;

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pickLabel(market, key, match) {
  if (market === '1X2') {
    if (key === '1') return `${match.home} to win`;
    if (key === '2') return `${match.away} to win`;
    return 'Draw';
  }
  if (market === 'ML') return `${key === '1' ? match.home : match.away} to win`;
  if (market === 'OU25') return `${key} 2.5 goals`;
  if (market === 'BTTS') return `Both Teams To Score · ${key}`;
  if (market === 'DC') {
    if (key === '1X') return `${match.home} or Draw`;
    if (key === 'X2') return `Draw or ${match.away}`;
    return `${match.home} or ${match.away}`;
  }
  if (market === 'TP')   return `${key} ${match.line || ''} pts`;
  if (market === 'SETS') return `${key} 2.5 sets`;
  if (market === 'HCAP') return `Handicap ${key}`;
  return `${market} · ${key}`;
}

function matchMeta(match) {
  const h = match.home, a = match.away;
  if (match.isLive) return `${h} vs ${a} · LIVE ${match.minute || ''}`;
  return `${h} vs ${a} · ${[match.kickoff, match.day].filter(Boolean).join(' ')}`;
}

function parseStake(raw) {
  const n = parseFloat(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function FormDots({ pattern }) {
  const chars = (pattern || '').split('');
  return (
    <span className="form-dots">
      {chars.map((c, i) => <span key={i} className={`form-dot ${c}`} />)}
    </span>
  );
}

export default function Home({ initialChip, initialSlipTab }) {
  const { toast } = useToast();
  const { account, adjustBalance } = useAccount();
  const [searchParams] = useSearchParams();
  const sportParam = searchParams.get('sport') || 'football';

  const [sportId, setSportId]       = useState(sportParam);
  const [snapshot, setSnapshot]     = useState(null);
  const [loadErr, setLoadErr]       = useState(null);
  const [selections, setSelections] = useState([]);
  const [betMode, setBetMode]       = useState('multiple');
  const [slipPanel, setSlipPanel]   = useState(initialSlipTab === 'mybets' ? 'mybets' : 'slip');
  const [chip, setChip]             = useState(initialChip || 'all');
  const [activeLeague, setActiveLeague] = useState(null);
  const [stake, setStake]           = useState('50.00');
  const [starred, setStarred]       = useState({});
  const [history, setHistory]       = useState([]);
  const [marketsForMatch, setMarketsForMatch] = useState(null);
  const marketsDlg = useRef(null);

  // Initial sport from URL change
  useEffect(() => { setSportId(sportParam); }, [sportParam]);

  // Load matches when sport changes
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadErr(null);
    (async () => {
      try {
        const data = await fetchMatches(sportId);
        if (cancelled) return;
        setSnapshot(data);
        if (sportId === 'football' && selections.length === 0) {
          setSelections((data.seedSlip || []).map((s) => ({ ...s })));
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e.message || 'Could not load fixtures.');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportId]);

  // Refresh My Bets when tab opens
  useEffect(() => {
    if (slipPanel !== 'mybets') return;
    fetchBetHistory().then((d) => setHistory(d.bets || [])).catch(() => {});
  }, [slipPanel]);

  // 30-second odds refresh on football
  useEffect(() => {
    if (sportId !== 'football') return;
    const t = setInterval(() => {
      fetchMatches(sportId).then((d) => setSnapshot(d)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [sportId]);

  const featured = useMemo(() => {
    if (!snapshot?.leagues?.length) return null;
    const id = snapshot.featuredMatchId;
    for (const lg of snapshot.leagues) {
      const m = lg.matches.find((x) => x.id === id);
      if (m) return { league: lg, match: m };
    }
    const lg = snapshot.leagues[0];
    return { league: lg, match: lg.matches[0] };
  }, [snapshot]);

  const upsertSelection = useCallback((row) => {
    setSelections((prev) => {
      const i = prev.findIndex((s) => s.matchId === row.matchId && s.market === row.market);
      if (i === -1) return [...prev, row];
      const next = [...prev];
      next[i] = { ...row, id: prev[i].id };
      return next;
    });
  }, []);

  const removeBy = useCallback((matchId, market) => {
    setSelections((prev) => prev.filter((s) => !(s.matchId === matchId && s.market === market)));
  }, []);

  const removeById = useCallback((id) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleSelection = useCallback((league, match, market, key, odds) => {
    const existing = selections.find((s) => s.matchId === match.id && s.market === market);
    if (existing && existing.outcome === key) {
      removeBy(match.id, market);
      return;
    }
    if (odds == null) return;
    upsertSelection({
      id: existing?.id || `sel-${crypto.randomUUID?.() || Date.now()}`,
      matchId: match.id,
      market,
      outcome: key,
      odds,
      pickLabel: pickLabel(market, key, match),
      marketLabel: market === '1X2' || market === 'ML' ? `Match · ${key}` : `${market} · ${key}`,
      meta: matchMeta(match),
      trend: null,
    });
  }, [selections, upsertSelection, removeBy]);

  const onHeroPill = (key) => {
    if (!featured) return;
    const m = featured.match.markets?.['1X2'] || featured.match.markets?.['ML'];
    const sel = m?.selections.find((s) => s.key === key);
    if (sel) toggleSelection(featured.league, featured.match, m === featured.match.markets?.['1X2'] ? '1X2' : 'ML', key, sel.odds);
  };

  const totalOdds = useMemo(() => {
    if (!selections.length) return 0;
    if (betMode === 'single') return selections[0].odds;
    return selections.reduce((p, s) => p * s.odds, 1);
  }, [selections, betMode]);

  const payout = useMemo(() => {
    const st = parseStake(stake);
    if (!selections.length || !totalOdds || st <= 0) return 0;
    return st * totalOdds * (1 + BONUS);
  }, [selections.length, stake, totalOdds]);

  const mainClass = useMemo(() => {
    const c = [];
    if (chip === 'live') c.push('main-filter-live');
    if (chip === 'soon') c.push('main-filter-soon');
    if (chip === 'africa') c.push('main-region-africa');
    if (chip === 'europe') c.push('main-region-europe');
    return c.join(' ');
  }, [chip]);

  const onPlaceBet = async () => {
    if (!selections.length) { toast('Add at least one selection to your bet slip.'); return; }
    const st = parseStake(stake);
    if (st <= 0) { toast('Enter a stake amount.'); return; }
    if (!account) { toast('Sign in to place a bet.'); return; }
    if (st > account.balance) { toast('Insufficient balance — top up to continue.'); return; }
    try {
      const res = await placeBet({
        mode: betMode,
        stake: st,
        selections: selections.map((s) => ({
          matchId: s.matchId, market: s.market, outcome: s.outcome, odds: s.odds,
        })),
      });
      adjustBalance(-st, `Bet placed — receipt ${res.bet.id.slice(-6)}.`);
      setSelections([]);
      setSlipPanel('mybets');
    } catch (e) {
      if (e.status === 409) {
        toast('Odds changed — refreshing.');
        try { setSnapshot(await fetchMatches(sportId)); } catch {/* ignore */}
      } else {
        toast(e.message || 'Could not place bet.');
      }
    }
  };

  const onCashOut = async (id) => {
    try {
      const res = await cashOutBet(id);
      const cash = res.bet.cashOut || 0;
      adjustBalance(cash, `Cashed out: GHS ${formatAmt(cash)}.`);
      const refreshed = await fetchBetHistory();
      setHistory(refreshed.bets || []);
    } catch (e) {
      toast(e.message || 'Cash-out unavailable.');
    }
  };

  const openMarkets = (league, match) => {
    setMarketsForMatch({ league, match });
    requestAnimationFrame(() => marketsDlg.current?.showModal());
  };

  if (loadErr) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-hot)', marginBottom: 16 }}>{loadErr}</p>
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>Refresh the page to retry.</p>
      </main>
    );
  }
  if (!snapshot) return <main style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)' }}>Loading fixtures…</main>;

  const isStarred = (m) => (starred[m.id] === undefined ? !!m.starred : starred[m.id]);
  const heroMain  = featured?.match.markets?.['1X2'] || featured?.match.markets?.['ML'];
  const heroKeys  = heroMain?.selections.map((s) => s.key) || [];
  const heroPick  = heroMain && selections.find((s) => s.matchId === featured.match.id && (s.market === '1X2' || s.market === 'ML'))?.outcome;

  const visibleLeagues = activeLeague
    ? snapshot.leagues.filter((l) => l.id === activeLeague)
    : snapshot.leagues;

  const sportTabs = snapshot.sports || [{ id: 'football', name: 'Football' }];

  return (
    <>
      {featured && (
      <section className="hero">
        <div className="hero-main fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="hero-content">
            <div className="live-badge">
              {featured.match.isLive ? `LIVE NOW · ${featured.match.minute || ''}` : 'FEATURED MATCH'}
            </div>
            <h1>Bet beyond <em>the whistle.</em></h1>
            <p className="hero-sub">Sharper odds. Cleaner cash-outs. Built for the way you actually watch — every league, every market, in real time.</p>
            <div className="match-card">
              <div className="team">
                <div className="team-crest" style={{ background: '#ef0107' }}>
                  {featured.match.home.slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <div className="team-name">{featured.match.home}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>{featured.league.name.slice(0,4).toUpperCase()} · HOME</div>
                </div>
              </div>
              <div>
                <div className="score">
                  {featured.match.isLive
                    ? <>{featured.match.scoreHome} — {featured.match.scoreAway}</>
                    : <>vs</>}
                </div>
                <div className="score-meta">
                  {featured.match.isLive ? `● ${featured.match.minute || ''}` : `${featured.match.kickoff || ''} · ${featured.match.day || ''}`}
                </div>
              </div>
              <div className="team away">
                <div className="team-crest" style={{ background: '#034694', color: '#fff' }}>
                  {featured.match.away.slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <div className="team-name">{featured.match.away}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>{featured.league.name.slice(0,4).toUpperCase()} · AWAY</div>
                </div>
              </div>
              <div className="hero-odds">
                {heroKeys.map((k) => {
                  const sel = heroMain.selections.find((s) => s.key === k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`odd-pill${heroPick === k ? ' selected' : ''}`}
                      onClick={() => onHeroPill(k)}
                    >
                      <div className="label">{k}</div>
                      <div className="val">{sel?.odds.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="hero-side">
          <div className="promo promo-1 fade-up" style={{ animationDelay: '0.15s' }}>
            <div>
              <div className="promo-tag">welcome bonus</div>
              <h3>200% on your <em>first deposit</em></h3>
            </div>
            <a href="/promos" className="promo-cta">Claim bonus →</a>
          </div>
          <div className="promo promo-2 fade-up" style={{ animationDelay: '0.25s' }}>
            <div>
              <div className="promo-tag" style={{ color: 'var(--accent-warm)' }}>mega-13 jackpot</div>
              <h3>GHS <em>1.84M</em><br />up for grabs</h3>
            </div>
            <a href="/jackpot" className="promo-cta">Play jackpot →</a>
          </div>
        </div>
      </section>
      )}

      <div className="sports-tabs-wrap">
        <div className="sports-tabs">
          {sportTabs.map((s) => (
            <a
              key={s.id}
              href={`?sport=${s.id}`}
              className={`sport-tab${sportId === s.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                window.history.replaceState({}, '', `?sport=${s.id}`);
                setSportId(s.id);
                setActiveLeague(null);
              }}
            >
              {s.name} <span className="count">{s.count}</span>
            </a>
          ))}
        </div>
      </div>

      <section className="main-grid" id="fixtures">
        <aside className="rail">
          <h4>{snapshot.sport === 'football' ? 'Top Leagues' : 'Competitions'}</h4>
          <div className="league-list">
            <span
              className={`league${activeLeague === null ? ' active' : ''}`}
              onClick={() => setActiveLeague(null)}
              style={{ cursor: 'pointer' }}
            >
              <span className="league-name">All competitions</span>
              <span className="league-count">{snapshot.leagues.reduce((n, l) => n + l.matches.length, 0)}</span>
            </span>
            {snapshot.leagues.map((lg) => (
              <span
                key={lg.id}
                className={`league${activeLeague === lg.id ? ' active' : ''}`}
                onClick={() => setActiveLeague(lg.id)}
                style={{ cursor: 'pointer' }}
              >
                <span className="league-name">{lg.name}</span>
                <span className="league-count">{lg.matches.length}</span>
              </span>
            ))}
          </div>
        </aside>

        <main id="main-matches" className={mainClass}>
          <div className="col-header">
            <h2>{sportTabs.find((s) => s.id === sportId)?.name || 'Sports'} <em>today</em></h2>
            <div className="meta">
              {visibleLeagues.reduce((n, l) => n + l.matches.length, 0)} matches · auto-refreshed every 30s
            </div>
          </div>

          <div className="filter-bar">
            {[
              ['all', 'All matches'],
              ['live', 'Live now'],
              ['soon', 'Starting soon'],
              ['africa', 'Africa'],
              ['europe', 'Europe'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip${chip === key ? ' active' : ''}`}
                onClick={() => setChip(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleLeagues.map((lg) => (
            <div key={lg.id} className="league-section fade-up" data-region={lg.region}>
              <div className="league-bar">
                <div className="crest" style={crestToStyle(lg.crest?.style)}>{lg.crest?.label}</div>
                <h5>{lg.name}</h5>
                <span className="country">{lg.countryMeta}</span>
              </div>
              <div className="odds-headers">
                <span>Time</span>
                <span>Match</span>
                {(lg.matches[0]?.markets?.['1X2'] || lg.matches[0]?.markets?.['ML'])?.selections.map((s) => (
                  <span key={s.key}>{s.key}</span>
                ))}
                {/* spacer for +N + star buttons */}
                <span></span>
                <span></span>
              </div>
              <div className="matches">
                {lg.matches.map((match) => {
                  const main = match.markets?.['1X2'] || match.markets?.['ML'];
                  if (!main) return null;
                  const myMain = selections.find((s) => s.matchId === match.id && (s.market === '1X2' || s.market === 'ML'));
                  return (
                    <div key={match.id} className={`match${match.isLive ? ' live' : ''}`}>
                      <div className={`match-time${match.isLive ? ' live-time' : ''}`}>
                        {match.isLive ? (
                          <>
                            <div>● LIVE</div>
                            <div className="scoreline">{match.scoreHome}-{match.scoreAway}</div>
                            <div className="date">{match.minute}</div>
                          </>
                        ) : (
                          <>
                            <div>{match.kickoff}</div>
                            <div className="date">{match.day}</div>
                          </>
                        )}
                      </div>
                      <div className="teams-stack">
                        <div className="team-line">
                          {match.home}
                          {match.form?.home && <FormDots pattern={match.form.home.join('')} />}
                        </div>
                        <div className="team-line">
                          {match.away}
                          {match.form?.away && <FormDots pattern={match.form.away.join('')} />}
                        </div>
                      </div>
                      {main.selections.map((s) => {
                        const isSel = myMain?.outcome === s.key;
                        const oc = match.oddClasses?.[s.key];
                        return (
                          <button
                            key={s.key}
                            type="button"
                            className={`odd-btn${isSel ? ' selected' : ''}${oc ? ` ${oc}` : ''}`}
                            onClick={() => toggleSelection(lg, match, match.markets['1X2'] ? '1X2' : 'ML', s.key, s.odds)}
                          >
                            <span className="ol">{s.key}</span>
                            <span className="ov">{s.odds.toFixed(2)}</span>
                          </button>
                        );
                      })}
                      <button type="button" className="more-markets" onClick={() => openMarkets(lg, match)}>
                        +{match.moreMarkets}
                      </button>
                      <button
                        type="button"
                        className={`star-btn${isStarred(match) ? ' starred' : ''}`}
                        onClick={() => setStarred((prev) => {
                          const cur = prev[match.id] === undefined ? !!match.starred : prev[match.id];
                          return { ...prev, [match.id]: !cur };
                        })}
                      >★</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </main>

        <aside className="betslip-wrap">
          <div className="betslip fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="slip-tabs">
              <button type="button" className={`slip-tab${slipPanel === 'slip' ? ' active' : ''}`} onClick={() => setSlipPanel('slip')}>
                Bet slip <span className="badge">{selections.length}</span>
              </button>
              <button type="button" className={`slip-tab${slipPanel === 'mybets' ? ' active' : ''}`} onClick={() => setSlipPanel('mybets')}>
                My bets <span className="badge badge-muted">{history.length}</span>
              </button>
            </div>
            <div className="slip-body">
              {slipPanel === 'slip' ? (
                <div>
                  <div className="slip-mode">
                    {(['single', 'multiple', 'system']).map((m) => (
                      <button key={m} type="button" className={`mode-btn${betMode === m ? ' active' : ''}`} onClick={() => setBetMode(m)}>
                        {m === 'single' ? 'Single' : m === 'multiple' ? 'Multiple' : 'System'}
                      </button>
                    ))}
                  </div>
                  {selections.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px 0' }}>
                      Tap any odds to add a selection. Mix markets across matches.
                    </p>
                  )}
                  <div className="selections">
                    {selections.map((s) => (
                      <div key={s.id} className="selection">
                        <button type="button" className="x" aria-label="Remove" onClick={() => removeById(s.id)}>×</button>
                        <div className="sel-pick">{s.pickLabel}</div>
                        <div className="sel-market">{s.marketLabel}</div>
                        <div className="sel-teams">{s.meta}</div>
                        <div className="sel-odds">
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>@{s.odds.toFixed(2)}</span>
                          <span className="sel-odds-val">{s.odds.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="stake-block">
                    <div className="stake-input">
                      <span>GHS</span>
                      <input
                        type="text"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                    <div className="quick-stakes">
                      {[10, 50, 100].map((n) => (
                        <button key={n} type="button" className="quick-stake" onClick={() => setStake(formatAmt(parseStake(stake) + n))}>+{n}</button>
                      ))}
                      <button type="button" className="quick-stake" onClick={() => setStake(formatAmt(account?.balance || 0))}>MAX</button>
                    </div>
                    <div className="summary">
                      <div className="sum-row"><span className="lbl">Total odds</span><span className="val">{selections.length ? totalOdds.toFixed(2) : '—'}</span></div>
                      <div className="sum-row"><span className="lbl">Stake</span><span className="val">GHS {formatAmt(parseStake(stake))}</span></div>
                      <div className="sum-row"><span className="lbl">Bonus boost</span><span className="val" style={{ color: 'var(--accent)' }}>+8%</span></div>
                      <div className="sum-row payout">
                        <span className="lbl" style={{ color: 'var(--text)', fontWeight: 700 }}>Potential win</span>
                        <span className="val">{payout > 0 ? `GHS ${formatAmt(payout)}` : '—'}</span>
                      </div>
                    </div>
                    <button type="button" className="place-bet" onClick={onPlaceBet}>
                      <span>Place bet</span><span className="arrow">→</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {history.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>No bets yet — place one to see it here.</p>
                  ) : history.map((b) => (
                    <div key={b.id} className="selection">
                      <div className={`bet-status ${b.status === 'open' ? 'open' : b.status === 'cashed_out' ? 'won' : 'lost'}`}>
                        {b.status === 'open' ? 'Open ticket' : b.status === 'cashed_out' ? `Cashed out · GHS ${formatAmt(b.cashOut)}` : 'Settled'}
                      </div>
                      <div className="sel-pick">{b.legs.length}-leg {b.mode}</div>
                      <div className="sel-market">Stake GHS {formatAmt(b.stake)} · odds {b.totalOdds.toFixed(2)}</div>
                      <div className="sel-teams">Potential GHS {formatAmt(b.potentialWin)}</div>
                      {b.status === 'open' && (
                        <button type="button" className="quick-stake" style={{ marginTop: 6 }} onClick={() => onCashOut(b.id)}>
                          Cash out
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      <section className="stats-strip fade-up" style={{ animationDelay: '0.5s' }}>
        <div className="stat">
          <div className="stat-label">Live matches</div>
          <div className="stat-value">{visibleLeagues.reduce((n, l) => n + l.matches.filter((m) => m.isLive).length, 0)}<em>/{visibleLeagues.reduce((n, l) => n + l.matches.length, 0)}</em></div>
          <div className="stat-trend">● refreshing every 30s</div>
        </div>
        <div className="stat">
          <div className="stat-label">My selections</div>
          <div className="stat-value">{selections.length}<em> on slip</em></div>
          <div className="stat-trend">{selections.length ? `Total @ ${totalOdds.toFixed(2)}` : 'Tap odds to add'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Open tickets</div>
          <div className="stat-value">{history.filter((b) => b.status === 'open').length}</div>
          <div className="stat-trend">Cash-out enabled live</div>
        </div>
        <div className="stat">
          <div className="stat-label">Mega-13 jackpot</div>
          <div className="stat-value">1.84<em>M</em></div>
          <div className="stat-trend">Drops in 4d 12h 32m</div>
        </div>
      </section>

      {/* Markets dialog */}
      <dialog ref={marketsDlg} className="bv-dialog markets-dlg" style={{ maxWidth: 560 }}>
        {marketsForMatch && (
          <>
            <h3>{marketsForMatch.match.home} vs {marketsForMatch.match.away}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
              {marketsForMatch.league.name} · {matchMeta(marketsForMatch.match)}
            </p>
            {Object.entries(marketsForMatch.match.markets || {}).map(([mkey, mkt]) => (
              <div key={mkey} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', marginBottom: 8 }}>{mkt.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  {mkt.selections.map((s) => {
                    const sel = selections.find((x) => x.matchId === marketsForMatch.match.id && x.market === mkey && x.outcome === s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        className={`odd-btn${sel ? ' selected' : ''}`}
                        onClick={() => toggleSelection(marketsForMatch.league, marketsForMatch.match, mkey, s.key, s.odds)}
                        style={{ padding: '10px 12px' }}
                      >
                        <span className="ol" style={{ fontSize: 11 }}>{s.label}</span>
                        <span className="ov">{s.odds.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="bv-dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => marketsDlg.current?.close()}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => { marketsDlg.current?.close(); setSlipPanel('slip'); }}>
                Done · {selections.length} on slip
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

function crestToStyle(str) {
  if (!str || typeof str !== 'string') return {};
  const o = {};
  str.split(';').forEach((segment) => {
    const i = segment.indexOf(':');
    if (i === -1) return;
    const k = segment.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const v = segment.slice(i + 1).trim();
    if (k) o[k] = v;
  });
  return o;
}
