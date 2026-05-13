/**
 * SportMonks — premium football data with advanced analytics.
 * Activate with SPORTMONKS_TOKEN. Endpoint shape per their v3 docs.
 */
import { Provider, fixtureKey } from './base.js';

export class SportMonksProvider extends Provider {
  constructor(token, base = 'https://api.sportmonks.com/v3/football') {
    super({
      id: 'sportMonks',
      label: 'SportMonks',
      enabled: !!token,
      sports: ['football'],
    });
    this.token = token;
    this.base = base;
  }

  async fetchFixtures() {
    if (!this.enabled) return [];
    const today = new Date().toISOString().slice(0, 10);
    const url = `${this.base}/fixtures/date/${today}?api_token=${this.token}&include=participants;league;scores`;
    const json = await this.http(url);
    return (json?.data || []).map((r) => normalise(r, this.id));
  }

  async fetchScores() {
    if (!this.enabled) return [];
    const url = `${this.base}/livescores?api_token=${this.token}&include=participants;scores`;
    const json = await this.http(url);
    return (json?.data || []).map((r) => normalise(r, this.id));
  }
}

function normalise(r, providerId) {
  const parts = r.participants || [];
  const home = parts.find((p) => p.meta?.location === 'home')?.name || parts[0]?.name;
  const away = parts.find((p) => p.meta?.location === 'away')?.name || parts[1]?.name;
  const kickoff = r.starting_at || r.starts_at;
  const finished = (r.state_id || r.state?.id) >= 5; // sportmonks state convention
  const isLive   = !!r.is_live;
  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(r.id),
    sport: 'football',
    league: { id: String(r.league_id || r.league?.id || ''), name: r.league?.name },
    home, away, kickoff,
    status: finished ? 'finished' : isLive ? 'live' : 'upcoming',
    scoreHome: pickScore(r.scores, 'home'),
    scoreAway: pickScore(r.scores, 'away'),
    minute: r.time?.minute ? `${r.time.minute}'` : null,
    updatedAt: new Date().toISOString(),
  };
}

function pickScore(scores, side) {
  if (!Array.isArray(scores)) return null;
  const final = scores.find((s) => s.description === 'CURRENT' && s.participant === side);
  return final?.score?.goals ?? null;
}
