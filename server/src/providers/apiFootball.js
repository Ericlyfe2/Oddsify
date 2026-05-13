/**
 * API Football (api-football.com / RapidAPI).
 * Provides fixtures, live scores, stats, standings, predictions.
 * Activate with APIFOOTBALL_KEY (use the v3.football.api-sports.io host).
 */
import { Provider, fixtureKey } from './base.js';

export class ApiFootballProvider extends Provider {
  constructor(apiKey, host = 'v3.football.api-sports.io') {
    super({
      id: 'apiFootball',
      label: 'API Football',
      enabled: !!apiKey,
      sports: ['football'],
    });
    this.apiKey = apiKey;
    this.host = host;
  }

  headers() {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.host,
    };
  }

  async fetchFixtures(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://${this.host}/fixtures?date=${today}`;
    const json = await this.http(url, { headers: this.headers() });
    return (json?.response || []).map((r) => normaliseFixture(r, this.id));
  }

  async fetchScores(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const url = `https://${this.host}/fixtures?live=all`;
    const json = await this.http(url, { headers: this.headers() });
    return (json?.response || []).map((r) => normaliseFixture(r, this.id));
  }
}

function normaliseFixture(r, providerId) {
  const home = r.teams?.home?.name;
  const away = r.teams?.away?.name;
  const kickoff = r.fixture?.date;
  const status = r.fixture?.status?.short || '';
  const isLive   = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);
  const finished = ['FT', 'AET', 'PEN'].includes(status);
  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(r.fixture?.id || ''),
    sport: 'football',
    league: { id: String(r.league?.id || ''), name: r.league?.name, country: r.league?.country },
    home, away, kickoff,
    status: finished ? 'finished' : isLive ? 'live' : 'upcoming',
    minute: r.fixture?.status?.elapsed ? `${r.fixture.status.elapsed}'` : null,
    scoreHome: r.goals?.home ?? null,
    scoreAway: r.goals?.away ?? null,
    updatedAt: new Date().toISOString(),
  };
}
