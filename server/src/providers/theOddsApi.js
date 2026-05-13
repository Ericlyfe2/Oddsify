/**
 * The Odds API — sportsbook prices across many bookmakers.
 * Docs: https://the-odds-api.com/liveapi/guides/v4/
 *
 * Activated automatically when ODDS_API_KEY is set in env (the existing
 * services/oddsApi.js continues to maintain fixtures; this adapter exists
 * to participate in the unified aggregator + monitoring surface).
 */
import { Provider, fixtureKey } from './base.js';

const SPORT_KEY = {
  football:   'soccer_epl,soccer_uefa_champs_league,soccer_spain_la_liga',
  basketball: 'basketball_nba',
  tennis:     'tennis_atp',
};

export class TheOddsApiProvider extends Provider {
  constructor(apiKey) {
    super({
      id: 'theOddsApi',
      label: 'The Odds API',
      enabled: !!apiKey,
      sports: ['football', 'basketball', 'tennis'],
    });
    this.apiKey = apiKey;
  }

  async fetchOdds(sport = 'football') {
    if (!this.enabled) return [];
    const sportKeys = (SPORT_KEY[sport] || '').split(',').filter(Boolean);
    const rows = [];
    for (const key of sportKeys) {
      const url = `https://api.the-odds-api.com/v4/sports/${key}/odds?regions=eu&markets=h2h,totals,btts&oddsFormat=decimal&apiKey=${this.apiKey}`;
      let data = [];
      try { data = await this.http(url, { timeoutMs: 8000 }); } catch { continue; }
      if (!Array.isArray(data)) continue;
      for (const ev of data) {
        const kickoff = ev.commence_time;
        const home = ev.home_team;
        const away = ev.away_team;
        if (!home || !away || !kickoff) continue;

        // pick best (highest) odds across bookmakers per outcome
        const markets = {};
        for (const bk of ev.bookmakers || []) {
          for (const m of bk.markets || []) {
            const mkey = m.key === 'h2h' ? '1X2' : m.key === 'totals' ? 'OU25' : m.key === 'btts' ? 'BTTS' : null;
            if (!mkey) continue;
            const target = markets[mkey] = markets[mkey] || { name: mkey, selections: {} };
            for (const o of m.outcomes || []) {
              const selKey = mapOutcome(mkey, o, home, away);
              if (!selKey) continue;
              const prev = target.selections[selKey];
              if (!prev || o.price > prev.odds) {
                target.selections[selKey] = { key: selKey, label: o.name, odds: Number(o.price.toFixed(2)) };
              }
            }
          }
        }
        const normalised = {};
        for (const [k, m] of Object.entries(markets)) {
          normalised[k] = { name: m.name, selections: Object.values(m.selections) };
        }

        rows.push({
          key: fixtureKey(sport, home, away, kickoff),
          provider: this.id,
          sport,
          sourceId: ev.id,
          home, away, kickoff,
          status: 'upcoming',
          league: { id: key, name: prettyLeague(key) },
          markets: normalised,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return rows;
  }
}

function mapOutcome(market, outcome, home, away) {
  const name = String(outcome.name || '').toLowerCase();
  if (market === '1X2') {
    if (name === home.toLowerCase()) return '1';
    if (name === away.toLowerCase()) return '2';
    if (name.includes('draw')) return 'X';
  }
  if (market === 'OU25') {
    if (name.includes('over'))  return 'Over';
    if (name.includes('under')) return 'Under';
  }
  if (market === 'BTTS') {
    if (name.startsWith('y')) return 'Yes';
    if (name.startsWith('n')) return 'No';
  }
  return null;
}

function prettyLeague(k) {
  return ({
    soccer_epl: 'Premier League',
    soccer_uefa_champs_league: 'UEFA Champions League',
    soccer_spain_la_liga: 'La Liga',
    basketball_nba: 'NBA',
    tennis_atp: 'ATP Tour',
  })[k] || k.replace(/_/g, ' ');
}
