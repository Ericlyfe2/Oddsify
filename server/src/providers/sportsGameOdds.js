/**
 * SportsGameOdds — backup odds + live bookmaker feeds.
 * Activate with SPORTSGAMEODDS_KEY.
 */
import { Provider, fixtureKey } from './base.js';

export class SportsGameOddsProvider extends Provider {
  constructor(apiKey, base = 'https://api.sportsgameodds.com/v2') {
    super({
      id: 'sportsGameOdds',
      label: 'SportsGameOdds',
      enabled: !!apiKey,
      sports: ['football', 'basketball', 'tennis'],
    });
    this.apiKey = apiKey;
    this.base = base;
  }

  async fetchOdds(sport = 'football') {
    if (!this.enabled) return [];
    const url = `${this.base}/odds?sport=${sport}&apiKey=${this.apiKey}`;
    const json = await this.http(url);
    return (json?.data || []).map((r) => normalise(r, sport, this.id));
  }
}

function normalise(r, sport, providerId) {
  const home = r.homeTeam || r.teams?.home;
  const away = r.awayTeam || r.teams?.away;
  const kickoff = r.commenceTime || r.startTime;
  const markets = {};
  for (const m of r.markets || []) {
    markets[m.key] = {
      name: m.name || m.key,
      selections: (m.outcomes || []).map((o) => ({ key: o.name, label: o.name, odds: Number(o.price) })),
    };
  }
  return {
    key: fixtureKey(sport, home, away, kickoff),
    provider: providerId,
    sourceId: String(r.id),
    sport,
    league: { id: r.league?.id, name: r.league?.name },
    home, away, kickoff,
    status: r.status || 'upcoming',
    markets,
    updatedAt: new Date().toISOString(),
  };
}
