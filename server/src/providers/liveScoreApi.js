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

  /**
   * League/cup standings for a competition. Returns a normalised shape:
   *   { competition:{id,name}, season:{name}, groups:[
   *       { id, name, rows:[{ rank, team, teamLogo, played, won, drawn, lost,
   *                            gf, ga, gd, points }] } ] }
   * Multi-group tournaments (World Cup / UCL group stage) return several
   * groups; single-table leagues return one group. Not part of the shared
   * Provider contract — called directly by the /standings route.
   */
  async fetchStandings(competitionId) {
    if (!this.enabled || !competitionId) return null;
    const url = `${this.base}/competitions/table.json?competition_id=${encodeURIComponent(competitionId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data;
    if (!data) return null;
    return normaliseStandings(data);
  }

  /**
   * Match event timeline (goals, cards, subs). `matchId` is the score-feed id
   * (our `sourceId` on live/finished matches). Returns [] for matches that
   * haven't produced events (e.g. upcoming fixtures). Not a shared-contract
   * method — called directly by the /match-detail route.
   */
  async fetchEvents(matchId) {
    if (!this.enabled || !matchId) return [];
    const url = `${this.base}/matches/events.json?match_id=${encodeURIComponent(matchId)}&${this.authQuery()}`;
    const json = await this.http(url);
    return (json?.data?.event || []).map(normaliseEvent);
  }

  /**
   * Match lineups: { home:{team,starters[],subs[]}, away:{...} } or null when
   * lineups aren't published. Players carry shirt number + photo.
   */
  async fetchLineups(matchId) {
    if (!this.enabled || !matchId) return null;
    const url = `${this.base}/matches/lineups.json?match_id=${encodeURIComponent(matchId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const lu = json?.data?.lineup;
    if (!lu || (!lu.home && !lu.away)) return null;
    return { home: normaliseLineupSide(lu.home), away: normaliseLineupSide(lu.away) };
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

/**
 * Flatten table.json's { stages:[{ stage, groups:[{ id, name, standings }] }] }
 * into a flat list of groups with tidy rows. Each stage's groups are prefixed
 * with the stage name when there's more than one stage (e.g. "Group Stage" vs
 * "Knockout"), so the client can render sensible section headers.
 */
function normaliseStandings(data) {
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const multiStage = stages.length > 1;
  const groups = [];
  for (const stage of stages) {
    const stageName = stage?.stage?.name || '';
    for (const g of stage?.groups || []) {
      const rows = (g?.standings || []).map((r) => ({
        rank: r.rank ?? null,
        team: r.team?.name || '',
        teamId: r.team?.id != null ? String(r.team.id) : null,
        teamLogo: r.team?.logo || null,
        played: r.matches ?? null,
        won: r.won ?? null,
        drawn: r.drawn ?? null,
        lost: r.lost ?? null,
        gf: r.goals_scored ?? null,
        ga: r.goals_conceded ?? null,
        gd: r.goal_diff ?? null,
        points: r.points ?? null,
      }));
      if (!rows.length) continue;
      // Single-group leagues return a group named "A" or "1"; drop the
      // redundant label unless it's genuinely a multi-group competition.
      const label =
        (stage?.groups?.length || 0) > 1 || multiStage
          ? [multiStage ? stageName : '', g?.name ? `Group ${g.name}` : ''].filter(Boolean).join(' · ')
          : '';
      groups.push({ id: String(g?.id || ''), name: label, rows });
    }
  }
  return {
    competition: { id: data.competition?.id ?? null, name: data.competition?.name || '' },
    season: { name: data.season?.name || '' },
    groups,
  };
}

/** matches/events.json event → tidy timeline entry. */
function normaliseEvent(e) {
  return {
    id: e.id != null ? String(e.id) : null,
    type: e.event || '', // GOAL, YELLOW_CARD, RED_CARD, SUBSTITUTION, ...
    label: e.label || '',
    minute: e.time != null ? String(e.time) : null,
    side: e.is_home ? 'home' : e.is_away ? 'away' : null,
    player: e.player?.name || null,
    // For SUBSTITUTION this is the player coming off; for GOAL, the assist.
    player2: e.info?.name || null,
  };
}

/** One side of matches/lineups.json → { team, starters[], subs[] }. */
function normaliseLineupSide(side) {
  if (!side) return null;
  const players = (side.players || []).map((p) => ({
    id: p.id != null ? String(p.id) : null,
    name: p.name || '',
    number: p.shirt_number != null ? String(p.shirt_number) : '',
    photo: p.photo || null,
    isSub: String(p.substitution) === '1',
  }));
  return {
    team: side.team?.name || '',
    starters: players.filter((p) => !p.isSub),
    subs: players.filter((p) => p.isSub),
  };
}
