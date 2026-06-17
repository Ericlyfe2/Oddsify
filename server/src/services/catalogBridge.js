import * as Markets from '../db/markets.js';
import * as Sports from '../db/sports.js';
import * as Leagues from '../db/leagues.js';
import * as Teams from '../db/teams.js';
import {
  addCustomFixture,
  addCustomLeague,
  setSuspension,
  clearSuspension,
  setOddsOverride,
  setResult as sportsAdminSetResult,
} from '../db/sportsAdmin.js';
import {
  emitAll,
  emitOddsTick,
  emitAdmin,
} from './realtime.js';

function buildFixtureFromCatalog(match) {
  const sport = Sports.getSport(match.sportId);
  const league = Leagues.getLeague(match.leagueId);
  const homeTeam = Teams.getTeam(match.homeTeamId);
  const awayTeam = Teams.getTeam(match.awayTeamId);
  const sportKey = sport?.key || match.sportId || 'football';

  const startsAt = new Date(match.startsAt);
  const now = new Date();
  const isToday = startsAt.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = startsAt.toDateString() === tomorrow.toDateString();
  const hours = String(startsAt.getHours()).padStart(2, '0');
  const minutes = String(startsAt.getMinutes()).padStart(2, '0');

  let dayLabel;
  if (isToday) dayLabel = 'Today';
  else if (isTomorrow) dayLabel = 'Tomorrow';
  else {
    const diff = Math.ceil((startsAt - now) / 86_400_000);
    dayLabel = diff > 0 ? `In ${diff} days` : 'Today';
  }

  const catalogMarkets = Markets.listMarkets(match.id);
  const marketsObj = {};
  for (const mkt of catalogMarkets) {
    const selections = Markets.listSelections(mkt.id);
    marketsObj[mkt.key] = {
      name: mkt.name,
      suspended: mkt.status !== 'open',
      selections: selections.map((sel) => ({
        key: sel.outcomeKey,
        label: sel.label,
        odds: sel.price,
        suspended: !sel.active,
      })),
    };
  }

  return {
    id: match.id,
    home: homeTeam?.name || match.homeTeamName || 'Home',
    away: awayTeam?.name || match.awayTeamName || 'Away',
    kickoff: `${hours}:${minutes}`,
    day: dayLabel,
    sport: sportKey,
    leagueId: league?.id || match.leagueId,
    leagueName: league?.name || '',
    isLive: match.status === 'live',
    finished: match.status === 'settled' || match.status === 'cancelled',
    suspended: match.status === 'suspended' || match.status === 'cancelled',
    scoreHome: match.homeScore,
    scoreAway: match.awayScore,
    venue: match.venue || '',
    markets: marketsObj,
    moreMarkets: catalogMarkets.length,
    _catalogManaged: true,
  };
}

function ensureCustomLeague(leagueId, sportKey) {
  const league = Leagues.getLeague(leagueId);
  if (!league) return;
  addCustomLeague({
    id: leagueId,
    name: league.name,
    region: league.country || 'international',
    sport: sportKey,
    crest: {
      style: 'background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#fff',
      label: (league.name || '').slice(0, 3).toUpperCase(),
    },
    matches: [],
    admin: true,
  });
}

export function bridgeMatchCreated(match) {
  const sport = Sports.getSport(match.sportId);
  const sportKey = sport?.key || match.sportId || 'football';
  ensureCustomLeague(match.leagueId, sportKey);
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:created', {
    matchId: match.id,
    sport: sportKey,
    leagueId: match.leagueId,
  });
  emitAdmin('match:created', { matchId: match.id, sport: sportKey });
}

export function bridgeMatchUpdated(match) {
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:updated', { matchId: match.id });
}

export function bridgeMatchStatusChanged(match) {
  if (match.status === 'suspended' || match.status === 'cancelled') {
    setSuspension(match.id, { all: true });
  } else {
    clearSuspension(match.id);
  }
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:statusChanged', {
    matchId: match.id,
    status: match.status,
  });
  emitAdmin('match:statusChanged', { matchId: match.id, status: match.status });
}

export function bridgeMarketStatusChanged(matchId, market) {
  if (market.status === 'suspended' || market.status === 'disabled') {
    setSuspension(matchId, {
      markets: [market.key],
    });
  }

  emitAll('market:statusChanged', {
    matchId,
    marketId: market.id,
    marketKey: market.key,
    status: market.status,
  });
}

export function bridgeSelectionPriceChanged(matchId, market, selection) {
  setOddsOverride(matchId, market.key, selection.outcomeKey, selection.price);

  emitOddsTick({
    fixtureId: matchId,
    market: market.key,
    selections: Markets.listSelections(market.id).map((s) => ({
      key: s.outcomeKey,
      label: s.label,
      odds: s.price,
      direction: s.id === selection.id ? 'changed' : 'same',
    })),
  });
}

export function bridgeResultConfirmed(matchId, result) {
  sportsAdminSetResult(
    matchId,
    result.homeScore,
    result.awayScore,
    'manual',
  );

  emitAll('result:confirmed', { matchId });
  emitAdmin('result:confirmed', {
    matchId,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });
}

export function bridgeResultEntered(matchId, result) {
  emitAdmin('result:entered', {
    matchId,
    status: result.status,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });
}
