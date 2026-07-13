/**
 * live-score-api.com (livescore-api.com api-client).
 *
 * Uses the OFFICIAL documented endpoints (from the account's Postman docs):
 *   - live scores : /matches/live.json
 *   - fixtures    : /fixtures/list.json?date=YYYY-MM-DD   (the `today` keyword
 *                   returns nothing — an explicit ISO date is required)
 *   - history     : /matches/history.json                (not wired here yet)
 *
 * Both live + fixtures return the same NESTED shape:
 *   home/away  : { id, name, logo, country_id, stadium }
 *   competition: { id, name, is_cup, is_league, tier }
 *   country    : { id, name, flag }        (null on some fixtures)
 *   odds       : { pre:{1,X,2}, live:{1,X,2} }
 *   scores     : { score:"1 - 0", ht_score, ... }   (live only)
 *   status/time: "IN PLAY"|"HALF TIME BREAK"|"FINISHED"|... / "HT"|minute
 * so a single normaliser handles both. Team logos + country flag are carried
 * through for the UI (real crests instead of generated initials).
 *
 * Auth is `key` + `secret` query params on every request (no headers).
 * Activate with LIVESCOREAPI_KEY + LIVESCOREAPI_SECRET. Professional plan is
 * 50,000 req/day. Each fetch* method is exactly one HTTP call — the Provider
 * base paces calls, so firing two requests inside one method trips its own
 * pacing gate; pre-match odds ride along on the fixture row (`preOdds`)
 * instead of fetchOdds() making a second call. Default budget 10,000; override
 * via LIVESCOREAPI_DAILY_BUDGET.
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
      // No per-call pacing. The base class defaults to spreading the daily
      // budget evenly across 24h (~2.4s/call here), which is meant for tiny
      // free-tier quotas — but it makes the snapshot's burst of concurrent
      // fixtures+scores+odds calls deny each other, causing a cold-start
      // fallback until they self-heal. The Professional plan's 50k/day quota
      // has ample headroom, so the daily budget cap alone is the guardrail.
      minCallIntervalMs: 0,
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
    const url = `${this.base}/matches/live.json?${this.authQuery()}`;
    const json = await this.http(url);
    const matches = json?.data?.match || [];
    return matches.map((m) => normalise(m, this.id, 'live'));
  }

  /** Scheduled fixtures for today. */
  async fetchFixtures(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const today = new Date().toISOString().slice(0, 10);
    const url = `${this.base}/fixtures/list.json?date=${today}&${this.authQuery()}`;
    const json = await this.http(url);
    const fixtures = json?.data?.fixtures || [];
    return fixtures.map((m) => normalise(m, this.id, 'fixture'));
  }

  /** 1X2 odds for live/in-play + recently-finished matches. */
  async fetchOdds(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const url = `${this.base}/matches/live.json?${this.authQuery()}`;
    const json = await this.http(url);
    const matches = json?.data?.match || [];
    return matches
      .filter((m) => hasOdds(m.odds?.live) || hasOdds(m.odds?.pre))
      .map((m) => normaliseOdds(m, this.id));
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

/** Map the provider's status string to our unified status. */
function unifyStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FINISHED' || s === 'FT' || s === 'AET') return 'finished';
  if (s === 'IN PLAY' || s === 'HALF TIME BREAK' || s === 'HT' || s === 'LIVE') return 'live';
  return 'upcoming';
}

/**
 * Build kickoff ISO from either a fixture (date + "HH:MM:SS") or a live match
 * (added date + scheduled "HH:MM"). The fixtureKey only keys on the DAY, so
 * live and fixture rows for the same match dedup to the same key.
 */
function kickoffIso(m, kind) {
  if (kind === 'fixture') {
    return m.date && m.time ? `${m.date}T${m.time}` : m.date || '';
  }
  const day = String(m.added || '').slice(0, 10);
  return day && m.scheduled ? `${day}T${m.scheduled}:00` : '';
}

/** Nested-shape normaliser shared by matches/live.json + fixtures/list.json. */
function normalise(m, providerId, kind) {
  const home = m.home?.name || '';
  const away = m.away?.name || '';
  const kickoff = kickoffIso(m, kind);
  const status = unifyStatus(m.status);
  const [scoreHome, scoreAway] = kind === 'live' ? parseScore(m.scores?.score) : [null, null];
  const pre = hasOdds(m.odds?.pre) ? m.odds.pre : null;

  return {
    key: fixtureKey('football', home, away, kickoff),
    provider: providerId,
    sourceId: String(m.id || ''),
    sport: 'football',
    league: {
      id: String(m.competition?.id || ''),
      name: m.competition?.name || null,
      country: m.country?.name || null,
    },
    home,
    away,
    kickoff,
    homeId: m.home?.id != null ? String(m.home.id) : null,
    awayId: m.away?.id != null ? String(m.away.id) : null,
    // UI enrichment — real team crests + country flag. Not part of the shared
    // Fixture contract; consumers that don't know about these ignore them.
    homeLogo: m.home?.logo || null,
    awayLogo: m.away?.logo || null,
    countryFlag: m.country?.flag || null,
    status,
    scoreHome,
    scoreAway,
    minute: status === 'live' && kind === 'live' ? String(m.time || '') : null,
    // Pre-match odds attached so providerSnapshot.js can price upcoming
    // fixtures that fetchOdds() (live-only) never sees.
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

function normaliseOdds(m, providerId) {
  const home = m.home?.name || '';
  const away = m.away?.name || '';
  const kickoff = kickoffIso(m, 'live');
  const live = unifyStatus(m.status) === 'live';
  const set = live && hasOdds(m.odds?.live) ? m.odds.live : m.odds?.pre;

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
