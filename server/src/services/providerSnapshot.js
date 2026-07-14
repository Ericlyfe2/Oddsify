/**
 * Builds the public match-list snapshot (the shape matchesData.js expects)
 * from the multi-provider registry (apiFootball, rapidApiFootball,
 * liveScoreApi, footballDataOrg, sportMonks, ...) instead of theOddsApi.
 *
 * This is the "real" live-scores source once at least one football-capable
 * provider is enabled. matchesData.ensureFreshLeagues() tries this first and
 * falls back to theOddsApi, then to the static demo leagues.
 *
 * Football only — none of the registry providers currently cover
 * basketball/tennis, so other sports keep using theOddsApi / fallback data.
 *
 * IMPORTANT: each match's `id` is set to the provider's canonical
 * fixtureKey (e.g. "football|arsenal|vs|chelsea|2026-07-13"), not a
 * synthetic id. The live-tick loop (oddsAggregator.js) and cash-out engine
 * correlate bets to fixtures by this exact key, so keeping id === fixtureKey
 * is what makes real-time score/odds updates and cash-out actually apply to
 * these matches after a bet is placed.
 */
import { fetchFixturesAll, fetchLiveScoresAll, fetchLiveOddsAll } from './providerRegistry.js';
import { buildFootballMarkets, commenceToHumanTime, formDots } from './oddsApi.js';
import { getLeague, getLeagueByName } from '../providers/liveScoreLeagues.js';

const MAX_LEAGUES = 20;
const MAX_MATCHES_PER_LEAGUE = 15;

function slugify(s) {
  return (
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'other'
  );
}

/** Deterministic gradient + initials badge from the league name, so every
 * league gets a stable-looking crest without hand-authoring one. */
function crestFor(name) {
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40) % 360;
  const label =
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || '?';
  return {
    style: `background:linear-gradient(135deg,hsl(${hue1} 70% 32%),hsl(${hue2} 70% 45%));color:#fff`,
    label,
  };
}

/** Merge a provider fixture + its freshest matching score row (scores win on
 * status/score/minute; fixtures supply upcoming matches scores doesn't have). */
function mergeFixturesAndScores(fixtures, scores) {
  const byKey = new Map();
  for (const fx of fixtures) {
    if (!fx?.key || !fx.home || !fx.away) continue;
    byKey.set(fx.key, fx);
  }
  for (const sc of scores) {
    if (!sc?.key || !sc.home || !sc.away) continue;
    const existing = byKey.get(sc.key);
    byKey.set(sc.key, existing ? { ...existing, ...sc } : sc);
  }
  return byKey;
}

/** key -> { 1, X, 2 }, keeping only the freshest odds row per fixture. */
function indexOdds(oddsRows) {
  const idx = new Map();
  for (const row of oddsRows) {
    if (!row?.key) continue;
    const sel = row.markets?.['1X2']?.selections || [];
    const home = sel.find((s) => s.key === '1')?.odds;
    const draw = sel.find((s) => s.key === 'X')?.odds;
    const away = sel.find((s) => s.key === '2')?.odds;
    if (home == null || draw == null || away == null) continue;
    const prev = idx.get(row.key);
    if (!prev || (row.updatedAt || '') > prev._updatedAt) {
      idx.set(row.key, { 1: home, X: draw, 2: away, _updatedAt: row.updatedAt || '' });
    }
  }
  return idx;
}

export async function fetchProviderSnapshot(sportId) {
  if (sportId !== 'football') return [];

  const [fixtures, scores, oddsRows] = await Promise.all([
    fetchFixturesAll('football').catch(() => []),
    fetchLiveScoresAll('football').catch(() => []),
    fetchLiveOddsAll('football').catch(() => []),
  ]);

  const merged = mergeFixturesAndScores(fixtures, scores);
  const oddsIndex = indexOdds(oddsRows);
  const leagueMap = new Map();

  for (const [key, fx] of merged) {
    // fetchLiveOddsAll only covers live/in-play matches; pre-match odds for
    // upcoming fixtures ride along on the fixture row itself (some
    // providers, e.g. liveScoreApi, embed odds on their fixtures endpoint).
    const odds = oddsIndex.get(key) || (fx.preOdds ? { ...fx.preOdds } : null);
    if (!odds) continue; // no priced 1X2 → not bettable, skip

    const { kickoff, day } = commenceToHumanTime(fx.kickoff);
    const markets = buildFootballMarkets(odds['1'], odds.X, odds['2']);
    const isLive = fx.status === 'live';

    const match = {
      id: key,
      sport: 'football',
      // live-score-api match id (score-feed id on live/finished rows) — lets
      // the client fetch this match's events + lineups. On upcoming fixtures
      // this is the fixture id, which has no events/lineups yet (handled
      // gracefully client-side).
      sourceMatchId: fx.sourceId || null,
      home: fx.home,
      away: fx.away,
      // live-score-api team ids — let the client request head-to-head data
      // for this fixture. Absent on static/admin matches (no H2H link).
      homeId: fx.homeId || null,
      awayId: fx.awayId || null,
      // Real team crests + country flag when the provider supplies them —
      // the client (normalize.js) reads home_logo/away_logo/league.logo.
      home_logo: fx.homeLogo || undefined,
      away_logo: fx.awayLogo || undefined,
      kickoff,
      day,
      isLive,
      finished: fx.status === 'finished',
      scoreHome: fx.scoreHome ?? undefined,
      scoreAway: fx.scoreAway ?? undefined,
      minute: fx.minute || undefined,
      moreMarkets: Object.keys(markets).length,
      odds: { 1: odds['1'], X: odds.X, 2: odds['2'] },
      markets,
      form: { home: formDots(), away: formDots() },
    };

    const leagueName = fx.league?.name || 'International';
    const leagueKey = fx.league?.country ? `${slugify(leagueName)}-${slugify(fx.league.country)}` : slugify(leagueName);
    let league = leagueMap.get(leagueKey);
    if (!league) {
      league = {
        id: leagueKey,
        name: leagueName,
        region: fx.league?.country ? 'international' : 'global',
        countryMeta: fx.league?.country ? String(fx.league.country).toUpperCase() : '',
        crest: crestFor(leagueName),
        // Numeric live-score-api competition id — lets the client request the
        // standings table for this league. Only present on provider-sourced
        // leagues (static/admin leagues have none, so no standings link).
        competitionId: fx.league?.id ? String(fx.league.id) : null,
        matches: [],
      };
      leagueMap.set(leagueKey, league);
    }
    league.matches.push(match);
  }

  return [...leagueMap.values()]
    .map((lg) => ({
      ...lg,
      matches: lg.matches.sort((a, b) => Number(b.isLive) - Number(a.isLive)).slice(0, MAX_MATCHES_PER_LEAGUE),
    }))
    .filter((lg) => lg.matches.length > 0)
    .sort((a, b) => {
      const aLive = a.matches.some((m) => m.isLive) ? 1 : 0;
      const bLive = b.matches.some((m) => m.isLive) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      // Curated major leagues (EPL, LaLiga, Serie A, World Cup, ...) surface
      // before the long tail, regardless of how many fixtures each has —
      // otherwise a lower-tier league with a big fixture list crowds out
      // competitions users actually recognise. Competition ids only match
      // the catalog for live-score-api fixtures, so fall back to matching
      // on the league's display name for apiFootball/rapidApiFootball rows.
      const aPriority = getLeague(a.competitionId)?.priority ?? getLeagueByName(a.name)?.priority ?? Infinity;
      const bPriority = getLeague(b.competitionId)?.priority ?? getLeagueByName(b.name)?.priority ?? Infinity;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.matches.length - a.matches.length;
    })
    .slice(0, MAX_LEAGUES);
}
