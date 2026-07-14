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
import { MAJOR_LEAGUES } from './liveScoreLeagues.js';

// The bulk `/fixtures/list.json?date=` endpoint silently omits some curated
// competitions even when they have real fixtures that day — confirmed by
// probing `/fixtures/list.json?competition_id=362` (FIFA World Cup) directly:
// it returns live semi-final fixtures (France v Spain, England v Argentina)
// that the date-only query drops entirely. So on every fetchFixtures() call
// we additionally fetch each curated competition by id and merge the
// results in. This is safe budget-wise: fetchFixtures() itself is only
// called every REFRESH_TTL_MS (4h, see matchesData.ensureFreshLeagues), so
// the extra MAJOR_LEAGUES.length calls amount to a few dozen/day, nowhere
// near the daily budget.
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

  /**
   * Scheduled fixtures for today, plus every curated major competition's
   * fixtures fetched explicitly by id (see the module comment — the
   * date-only query silently drops some of them).
   */
  async fetchFixtures(sport = 'football') {
    if (!this.enabled || sport !== 'football') return [];
    const today = new Date().toISOString().slice(0, 10);
    const url = `${this.base}/fixtures/list.json?date=${today}&${this.authQuery()}`;
    const json = await this.http(url);
    const fixtures = (json?.data?.fixtures || []).map((m) => normalise(m, this.id, 'fixture'));

    const majorResults = await Promise.allSettled(
      MAJOR_LEAGUES.map((l) =>
        this.http(`${this.base}/fixtures/list.json?competition_id=${l.id}&${this.authQuery()}`),
      ),
    );
    const majorFixtures = majorResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r.value?.data?.fixtures || []).map((m) => normalise(m, this.id, 'fixture')));

    const byKey = new Map();
    for (const fx of [...fixtures, ...majorFixtures]) byKey.set(fx.key, fx);
    return [...byKey.values()];
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

  /**
   * Top goalscorers for a competition's current edition. Returns
   *   { competition:{id,name}, season:{name}, rows:[{ rank, player, playerId,
   *     photo, team, teamId, teamLogo, goals, assists, played }] }
   * `rank` is derived from list order (the feed is already sorted by goals).
   */
  async fetchTopScorers(competitionId) {
    if (!this.enabled || !competitionId) return null;
    const url = `${this.base}/competitions/topscorers.json?competition_id=${encodeURIComponent(competitionId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data;
    if (!data) return null;
    return normaliseTopScorers(data);
  }

  /**
   * The list of groups/stages in a competition (World Cup, UCL group stage…).
   * Returns [{ id, name, stage }]; each `id` feeds fetchGroupTable(). Empty for
   * single-table leagues.
   */
  async fetchCompetitionGroups(competitionId) {
    if (!this.enabled || !competitionId) return [];
    const url = `${this.base}/competitions/groups.json?competition_id=${encodeURIComponent(competitionId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const groups = Array.isArray(json?.data) ? json.data : [];
    return groups.map((g) => ({
      id: g.id != null ? String(g.id) : '',
      name: g.name || '',
      stage: g.stage || '',
    }));
  }

  /**
   * Standings for a single group (by `group_id` from fetchCompetitionGroups).
   * Returns { competition:{id,name}, season:{name}, stage:{id,name},
   *           group:{ id, name, rows:[…standings] } } or null.
   */
  async fetchGroupTable(groupId) {
    if (!this.enabled || !groupId) return null;
    const url = `${this.base}/groups/table.json?group_id=${encodeURIComponent(groupId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data;
    if (!data || !data.group) return null;
    return {
      competition: { id: data.competition?.id ?? null, name: data.competition?.name || '' },
      season: { name: data.season?.name || '' },
      stage: { id: data.stage?.id ?? null, name: data.stage?.name || '' },
      group: {
        id: data.group.id != null ? String(data.group.id) : '',
        name: data.group.name || '',
        rows: (data.group.standings || []).map(normaliseStandingRow),
      },
    };
  }

  /**
   * Full rosters for every team in a competition. Populated for national-team
   * tournaments (World Cup, Euros, AFCON); empty `teams` for club leagues.
   *   { competition:{id,name}, teams:[{ team, teamId, teamLogo,
   *     players:[{ id, name, number, position }] }] }
   */
  async fetchRosters(competitionId) {
    if (!this.enabled || !competitionId) return null;
    const url = `${this.base}/competitions/rosters.json?competition_id=${encodeURIComponent(competitionId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data;
    if (!data) return null;
    return {
      competition: { id: data.competition?.id ?? null, name: data.competition?.name || '' },
      teams: (data.teams || []).map(normaliseRosterTeam),
    };
  }

  /**
   * A single team's squad within a competition. Unlike rosters.json, squads.json
   * returns `data` as a FLAT array of players ({ id, name, shirt_number,
   * position }) with no team/competition metadata, so those echo the args.
   *   { competitionId, teamId, players:[{ id, name, number, position }] } | null.
   */
  async fetchSquad(competitionId, teamId) {
    if (!this.enabled || !competitionId || !teamId) return null;
    const url = `${this.base}/competitions/squads.json?competition_id=${encodeURIComponent(competitionId)}&team_id=${encodeURIComponent(teamId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const arr = Array.isArray(json?.data) ? json.data : json?.data?.squad || [];
    if (!arr.length) return null;
    const players = arr.map((p) => ({
      id: p.id != null ? String(p.id) : p.player?.id != null ? String(p.player.id) : null,
      name: p.name || p.player?.name || '',
      number: p.shirt_number != null ? String(p.shirt_number) : '',
      position: p.position || '',
    }));
    return { competitionId: String(competitionId), teamId: String(teamId), players };
  }

  /**
   * Finished-match results, filterable. Reuses the shared nested-match
   * normaliser (`history` kind parses final scores). Returns
   *   { matches:[…normalised], totalPages }.
   * All filters optional: { competitionId, teamId, from, to, round }.
   */
  async fetchHistory({ competitionId, teamId, from, to, round } = {}) {
    if (!this.enabled) return { matches: [], totalPages: 0 };
    const params = [];
    if (competitionId) params.push(`competition_id=${encodeURIComponent(competitionId)}`);
    if (teamId) params.push(`team_id=${encodeURIComponent(teamId)}`);
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    if (round) params.push(`round=${encodeURIComponent(round)}`);
    const q = params.length ? `${params.join('&')}&` : '';
    const url = `${this.base}/matches/history.json?${q}${this.authQuery()}`;
    const json = await this.http(url);
    const matches = json?.data?.match || [];
    return {
      matches: matches.map((m) => normalise(m, this.id, 'history')),
      totalPages: Number(json?.data?.total_pages) || 0,
    };
  }

  /**
   * Per-match team statistics (possession, shots, corners…). Returns
   *   { stats:[{ type, label, home, away }] }  (empty for matches without stats).
   */
  async fetchMatchStatistics(matchId) {
    if (!this.enabled || !matchId) return { stats: [] };
    const url = `${this.base}/statistics/matches.json?match_id=${encodeURIComponent(matchId)}&${this.authQuery()}`;
    const json = await this.http(url);
    const rows = Array.isArray(json?.data) ? json.data : [];
    return {
      stats: rows.map((r) => ({
        type: r.type || '',
        label: r.label || '',
        home: r.home ?? null,
        away: r.away ?? null,
      })),
    };
  }

  /**
   * Head-to-head between two teams: each team's overall + h2h form, their last
   * six matches, and the shared history. Returns
   *   { team1, team2, h2h:[…tidy], team1LastSix:[…], team2LastSix:[…] } or null.
   */
  async fetchH2H(team1Id, team2Id) {
    if (!this.enabled || !team1Id || !team2Id) return null;
    const url = `${this.base}/teams/head2head.json?team1_id=${encodeURIComponent(team1Id)}&team2_id=${encodeURIComponent(team2Id)}&${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data;
    if (!data || (!data.team1 && !data.team2)) return null;
    return {
      team1: normaliseH2HTeam(data.team1),
      team2: normaliseH2HTeam(data.team2),
      h2h: (data.h2h || []).map(normaliseH2HMatch),
      team1LastSix: (data.team1_last_6 || []).map(normaliseH2HMatch),
      team2LastSix: (data.team2_last_6 || []).map(normaliseH2HMatch),
    };
  }

  /**
   * Paginated team directory, filterable by country/federation. Returns
   *   { teams:[{ id, name, logo, stadium, countryId }], page, pages, total }.
   */
  async fetchTeams({ countryId, federationId, page } = {}) {
    if (!this.enabled) return { teams: [], page: 1, pages: 0, total: 0 };
    const params = [];
    if (countryId) params.push(`country_id=${encodeURIComponent(countryId)}`);
    if (federationId) params.push(`federation_id=${encodeURIComponent(federationId)}`);
    if (page) params.push(`page=${encodeURIComponent(page)}`);
    const q = params.length ? `${params.join('&')}&` : '';
    const url = `${this.base}/teams/list.json?${q}${this.authQuery()}`;
    const json = await this.http(url);
    const data = json?.data || {};
    return {
      teams: (data.teams || []).map((t) => ({
        id: t.id != null ? String(t.id) : '',
        name: t.name || '',
        logo: t.logo || null,
        stadium: t.stadium || '',
        countryId: t.country_id != null ? String(t.country_id) : null,
      })),
      page: Number(page) || 1,
      pages: Number(data.pages) || 0,
      total: Number(data.total) || 0,
    };
  }

  /**
   * Competitions directory, filterable by country/federation. Returns a flat
   * list of { id, name, tier, isCup, isLeague, active, hasGroups, country, season }.
   */
  async fetchCompetitions({ countryId, federationId } = {}) {
    if (!this.enabled) return [];
    const params = [];
    if (countryId) params.push(`country_id=${encodeURIComponent(countryId)}`);
    if (federationId) params.push(`federation_id=${encodeURIComponent(federationId)}`);
    const q = params.length ? `${params.join('&')}&` : '';
    const url = `${this.base}/competitions/list.json?${q}${this.authQuery()}`;
    const json = await this.http(url);
    return (json?.data?.competition || []).map(normaliseCompetition);
  }

  /** Countries directory, optionally filtered by federation. [{ id, name, flag, fifaCode, uefaCode }]. */
  async fetchCountries({ federationId } = {}) {
    if (!this.enabled) return [];
    const q = federationId ? `federation_id=${encodeURIComponent(federationId)}&` : '';
    const url = `${this.base}/countries/list.json?${q}${this.authQuery()}`;
    const json = await this.http(url);
    return (json?.data?.country || []).map((c) => ({
      id: c.id != null ? String(c.id) : '',
      name: c.name || '',
      flag: c.flag || null,
      fifaCode: c.fifa_code || '',
      uefaCode: c.uefa_code || '',
    }));
  }

  /** Confederations list. [{ id, name }]. */
  async fetchFederations() {
    if (!this.enabled) return [];
    const url = `${this.base}/federations/list.json?${this.authQuery()}`;
    const json = await this.http(url);
    return (json?.data?.federation || []).map((f) => ({
      id: f.id != null ? String(f.id) : '',
      name: f.name || '',
    }));
  }

  /** Seasons list. [{ id, name, start, end }]. */
  async fetchSeasons() {
    if (!this.enabled) return [];
    const url = `${this.base}/seasons/list.json?${this.authQuery()}`;
    const json = await this.http(url);
    return (json?.data?.seasons || []).map((s) => ({
      id: s.id != null ? String(s.id) : '',
      name: s.name || '',
      start: s.start || '',
      end: s.end || '',
    }));
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
  // History rows carry an explicit `date` (YYYY-MM-DD) + `scheduled` (HH:MM),
  // like fixtures but with `time` holding the status ("FT") instead of a clock.
  if (kind === 'history') {
    if (m.date) return m.scheduled ? `${m.date}T${m.scheduled}:00` : m.date;
    const histDay = String(m.added || '').slice(0, 10);
    return histDay && m.scheduled ? `${histDay}T${m.scheduled}:00` : '';
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
  const hasScore = kind === 'live' || kind === 'history';
  const [scoreHome, scoreAway] = hasScore ? parseScore(m.scores?.score) : [null, null];
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
      const rows = (g?.standings || []).map(normaliseStandingRow);
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

/** One standings row (table.json + groups/table.json share this shape). */
function normaliseStandingRow(r) {
  return {
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
  };
}

/** competitions/topscorers.json → tidy leaderboard. Rank comes from list order. */
function normaliseTopScorers(data) {
  const rows = (data.topscorers || []).map((s, i) => ({
    rank: i + 1,
    player: s.player?.name || '',
    playerId: s.player?.id != null ? String(s.player.id) : null,
    photo: s.player?.photo || null,
    team: s.team?.name || '',
    teamId: s.team?.id != null ? String(s.team.id) : null,
    teamLogo: s.team?.logo || null,
    goals: s.goals ?? null,
    assists: s.assists ?? null,
    played: s.played ?? null,
  }));
  return {
    competition: { id: data.competition?.id ?? null, name: data.competition?.name || '' },
    season: { name: data.season?.name || '' },
    rows,
  };
}

/** One team block from rosters.json / squads.json → tidy squad. */
function normaliseRosterTeam(t) {
  const players = (t.squad || []).map((row) => ({
    id: row.player?.id != null ? String(row.player.id) : null,
    name: row.player?.name || '',
    number: row.shirt_number != null ? String(row.shirt_number) : '',
    position: row.position || '',
  }));
  return {
    team: t.team?.name || '',
    teamId: t.team?.id != null ? String(t.team.id) : null,
    teamLogo: t.team?.logo || null,
    players,
  };
}

/** head2head.json team block → { id, name, stadium, overallForm[], h2hForm[] }. */
function normaliseH2HTeam(t) {
  if (!t) return null;
  return {
    id: t.id != null ? String(t.id) : null,
    name: t.name || '',
    stadium: t.stadium || '',
    overallForm: Array.isArray(t.overall_form) ? t.overall_form : [],
    h2hForm: Array.isArray(t.h2h_form) ? t.h2h_form : [],
  };
}

/** One match row inside head2head.json (h2h / last_6 lists). */
function normaliseH2HMatch(m) {
  return {
    id: m.id != null ? String(m.id) : null,
    date: m.date || '',
    home: m.home_name || '',
    away: m.away_name || '',
    score: m.score || m.ft_score || '',
    htScore: m.ht_score || '',
    status: m.status || m.time || '',
  };
}

/** competitions/list.json entry → tidy competition record. */
function normaliseCompetition(c) {
  const country = Array.isArray(c.countries) && c.countries[0] ? c.countries[0] : null;
  return {
    id: c.id != null ? String(c.id) : '',
    name: (c.name || '').trim(),
    tier: c.tier != null ? Number(c.tier) : null,
    isCup: String(c.is_cup) === '1' || c.is_cup === true,
    isLeague: String(c.is_league) === '1' || c.is_league === true,
    active: String(c.active) === '1' || c.active === true,
    hasGroups: String(c.has_groups) === '1' || c.has_groups === true,
    country: country ? { id: String(country.id), name: country.name || '', flag: country.flag || null } : null,
    season: c.season ? { id: c.season.id != null ? String(c.season.id) : null, name: c.season.name || '' } : null,
  };
}
