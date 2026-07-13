/**
 * live-score-api.com (livescore-api.com api-client).
 *
 * Live scores + fixtures, plus 1X2 odds embedded on both endpoints (pre-match
 * and in-play). Auth is `key` + `secret` query params on every request (no
 * headers).
 *
 * Response shape is flat (home_name/away_name/home_id/away_id, not nested
 * home:{name}), confirmed against a live account — the shape shown in the
 * public docs samples doesn't match what this endpoint actually returns.
 *
 * Activate with LIVESCOREAPI_KEY + LIVESCOREAPI_SECRET. Starter plan is
 * 14,500 req/day; each fetch* method is exactly one HTTP call (the Provider
 * base class paces calls ~8.6s apart on this budget, so firing two requests
 * inside one method trips its own pacing gate — don't do that). Pre-match
 * odds live on /fixtures/matches.json (roughly 60% of fixtures are priced in
 * practice), so fetchFixtures() attaches them as `preOdds` on each Fixture
 * row instead of fetchOdds() making a second call. Default budget of 10,000
 * leaves headroom. Override via LIVESCOREAPI_DAILY_BUDGET on a higher tier.
 */
import { Provider, fixtureKey } from './base.js';

export class LiveScoreApiProvider extends Provider {
  constructor(key, secret, base = 'https://livescore-api.com/api-client', dailyBudget = null) {
    const budget = Number.isFinite(dailyBudget) && dailyBudget > 0 ? dailyBudget : 10_000;
    super({
      id: 'liveScoreApi',
      label: 'live-score-api.com',
      enabled: !!key && !!secret,
      sports: ['football'],
      dailyBudget: budget,
    });
    this.key = key;
    this.secret = secret;
    this.base = base;
  }

  authQuery() {
    return `key=${encodeURIComponent(this.key)}&secret=${encodeURIComponent(this.secret)}`;
  }

  /** Live + recently-finished matches (last 3-4h). */
  async fetchScores(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const url = `${this.base}/scores/live.json?${this.authQuery()}`;
    const json = await this.http(url);
    const matches = json?.data?.match || [];
    return matches.map((m) => normaliseLive(m, this.id));
  }

  /** Today's scheduled fixtures. */
  async fetchFixtures(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const today = new Date().toISOString().slice(0, 10);
    const url = `${this.base}/fixtures/matches.json?date=${today}&${this.authQuery()}`;
    const json = await this.http(url);
    const fixtures = json?.data?.fixtures || [];
    return fixtures.map((m) => normaliseFixture(m, this.id));
  }

  /** 1X2 odds for live/in-play + recently-finished matches. */
  async fetchOdds(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const url = `${this.base}/scores/live.json?${this.authQuery()}`;
    const json = await this.http(url);
    const matches = json?.data?.match || [];
    return matches.filter((m) => hasOdds(m.odds?.live) || hasOdds(m.odds?.pre)).map((m) => normaliseLiveOdds(m, this.id));
  }
}

function hasOdds(o) {
  return o && (o['1'] != null || o['X'] != null || o['2'] != null);
}

function parseScore(s) {
  const [h, a] = String(s || '')
    .split('-')
    .map((v) => {
      const n = Number(String(v).trim());
      return Number.isFinite(n) ? n : null;
    });
  return [h ?? null, a ?? null];
}

function statusFromLive(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FINISHED') return 'finished';
  if (s === 'IN PLAY' || s === 'HALF TIME BREAK') return 'live';
  return 'upcoming';
}

function normaliseLive(m, providerId) {
  const home = m.home_name || '';
  const away = m.away_name || '';
  const addedDate = String(m.added || '').slice(0, 10);
  const kickoff = addedDate && m.scheduled ? `${addedDate}T${m.scheduled}:00` : '';
  const status = statusFromLive(m.status);
  const [scoreHome, scoreAway] = parseScore(m.score);

  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(m.id || ''),
    sport: 'football',
    league: {
      id: String(m.competition_id || ''),
      name: m.competition_name || null,
      country: m.country?.name || null,
    },
    home,
    away,
    kickoff,
    homeId: m.home_id != null ? String(m.home_id) : null,
    awayId: m.away_id != null ? String(m.away_id) : null,
    status,
    scoreHome,
    scoreAway,
    minute: status === 'live' ? String(m.time || '') : null,
    updatedAt: new Date().toISOString(),
  };
}

function normaliseFixture(m, providerId) {
  const home = m.home_name || '';
  const away = m.away_name || '';
  const kickoff = m.date && m.time ? `${m.date}T${m.time}` : '';
  const pre = hasOdds(m.odds?.pre) ? m.odds.pre : null;

  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(m.id || ''),
    sport: 'football',
    league: {
      id: String(m.competition?.id || m.competition_id || ''),
      name: m.competition?.name || null,
      country: null,
    },
    home,
    away,
    kickoff,
    homeId: m.home_id != null ? String(m.home_id) : null,
    awayId: m.away_id != null ? String(m.away_id) : null,
    status: 'upcoming',
    scoreHome: null,
    scoreAway: null,
    minute: null,
    // Not part of the shared Fixture contract — an extra hint so
    // providerSnapshot.js can price fixtures that fetchOdds() (live-only)
    // never sees. Ignored by any consumer that doesn't know about it.
    preOdds: pre ? { 1: Number(pre['1']), X: Number(pre.X), 2: Number(pre['2']) } : null,
    updatedAt: new Date().toISOString(),
  };
}

function oddsSelections(set) {
  const selections = [];
  if (set?.['1'] != null) selections.push({ key: '1', label: 'Home', odds: Number(set['1']) });
  if (set?.X != null) selections.push({ key: 'X', label: 'Draw', odds: Number(set.X) });
  if (set?.['2'] != null) selections.push({ key: '2', label: 'Away', odds: Number(set['2']) });
  return selections;
}

function normaliseLiveOdds(m, providerId) {
  const home = m.home_name || '';
  const away = m.away_name || '';
  const addedDate = String(m.added || '').slice(0, 10);
  const kickoff = addedDate && m.scheduled ? `${addedDate}T${m.scheduled}:00` : '';
  const live = statusFromLive(m.status) === 'live';
  const set = live ? m.odds?.live : m.odds?.pre;

  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    bookmaker: 'live-score-api.com',
    markets: {
      '1X2': { name: '1X2', selections: oddsSelections(set) },
    },
    updatedAt: new Date().toISOString(),
  };
}
