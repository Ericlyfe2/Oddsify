import { Provider, fixtureKey } from './base.js';

export class RapidApiFootballProvider extends Provider {
  constructor(apiKey, host = 'free-api-live-football-data.p.rapidapi.com') {
    super({
      id: 'rapidApiFootball',
      label: 'RapidAPI Free Football',
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

  url(path) {
    return `https://${this.host}${path}`;
  }

  async fetchScores(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const json = await this.http(this.url('/football-current-live'), { headers: this.headers() });
    const fixtures = json?.response?.live || [];
    return fixtures.map((r) => normaliseFixture(r, this.id));
  }

  async fetchFixtures(sport = 'football') {
    return this.fetchScores(sport);
  }

  async fetchOdds() {
    return [];
  }
}

function normaliseFixture(r, providerId) {
  const home = r.home?.name || '';
  const away = r.away?.name || '';
  const kickoff = r.status?.utcTime || '';
  const isLive = r.status?.ongoing === true;
  const finished = r.status?.finished === true;
  const cancelled = r.status?.cancelled === true;
  const minute = r.status?.liveTime?.short ? r.status.liveTime.short.replace(/\s*[‎]?\s*’\s*$/, "'") : null;
  const half = r.status?.liveTime?.basePeriod === 45 ? '1H' : '2H';

  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(r.id || ''),
    sport: 'football',
    league: {
      id: String(r.leagueId || ''),
      name: null,
      country: null,
    },
    home,
    away,
    kickoff,
    status: cancelled ? 'finished' : finished ? 'finished' : isLive ? 'live' : 'upcoming',
    minute: isLive ? minute : null,
    scoreHome: r.home?.score ?? null,
    scoreAway: r.away?.score ?? null,
    updatedAt: new Date().toISOString(),
    _half: isLive ? half : null,
  };
}
