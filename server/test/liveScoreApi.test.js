import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LiveScoreApiProvider } from '../src/providers/liveScoreApi.js';
import { MAJOR_LEAGUES, getLeague, isMajorLeague } from '../src/providers/liveScoreLeagues.js';

/**
 * Unit tests for the live-score-api normalisers. Each provider method makes
 * exactly one HTTP call via `this.http`, so we stub that with a fixture shaped
 * like the real API response (captured 2026-07-13) and assert the normalised
 * output. This exercises the real code path without hitting the network.
 */
function providerReturning(json) {
  const p = new LiveScoreApiProvider('k', 's');
  p.http = async () => json; // stub the single HTTP call
  return p;
}

describe('liveScoreLeagues catalog', () => {
  it('is ordered by priority and has unique ids', () => {
    const ids = MAJOR_LEAGUES.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    const priorities = MAJOR_LEAGUES.map((l) => l.priority);
    assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b), 'sorted by priority');
  });

  it('resolves verified major-league ids', () => {
    assert.equal(getLeague('2').shortName, 'EPL');
    assert.equal(getLeague(3).name, 'LaLiga'); // accepts number too
    assert.equal(getLeague('4').name, 'Serie A');
    assert.equal(getLeague('362').type, 'international');
    assert.equal(isMajorLeague('244'), true);
    assert.equal(isMajorLeague('99999'), false);
    assert.equal(getLeague('99999'), null);
  });
});

describe('fetchTopScorers', () => {
  it('normalises the leaderboard and derives rank from order', async () => {
    const p = providerReturning({
      success: true,
      data: {
        competition: { id: 2, name: 'Premier League' },
        season: { name: '2025/2026' },
        topscorers: [
          { goals: 27, assists: 8, played: 35, team: { id: 12, name: 'Manchester City', logo: 'city.png' }, player: { id: 2934, name: 'Erling Haaland', photo: 'h.png' } },
          { goals: 20, assists: 5, played: 34, team: { id: 7, name: 'Liverpool', logo: 'lfc.png' }, player: { id: 1, name: 'Mo Salah', photo: 's.png' } },
        ],
      },
    });
    const out = await p.fetchTopScorers('2');
    assert.equal(out.competition.name, 'Premier League');
    assert.equal(out.season.name, '2025/2026');
    assert.equal(out.rows.length, 2);
    assert.deepEqual(out.rows[0], {
      rank: 1, player: 'Erling Haaland', playerId: '2934', photo: 'h.png',
      team: 'Manchester City', teamId: '12', teamLogo: 'city.png', goals: 27, assists: 8, played: 35,
    });
    assert.equal(out.rows[1].rank, 2);
  });

  it('returns null when data is missing', async () => {
    assert.equal(await providerReturning({ success: true }).fetchTopScorers('2'), null);
  });
});

describe('fetchCompetitionGroups', () => {
  it('maps the array of groups', async () => {
    const p = providerReturning({
      success: true,
      data: [
        { id: 4286, name: 'A', stage: 'Group Stage' },
        { id: 4287, name: 'B', stage: 'Group Stage' },
      ],
    });
    const out = await p.fetchCompetitionGroups('362');
    assert.deepEqual(out, [
      { id: '4286', name: 'A', stage: 'Group Stage' },
      { id: '4287', name: 'B', stage: 'Group Stage' },
    ]);
  });

  it('returns [] when the competition has no groups', async () => {
    assert.deepEqual(await providerReturning({ success: true, data: null }).fetchCompetitionGroups('2'), []);
  });
});

describe('fetchGroupTable', () => {
  it('normalises a single group with standings rows', async () => {
    const p = providerReturning({
      success: true,
      data: {
        competition: { id: 362, name: 'FIFA World Cup' },
        season: { name: '2022' },
        stage: { id: 1231, name: 'Group Stage' },
        group: {
          id: 1913,
          name: 'A',
          standings: [
            { rank: 1, points: 7, matches: 3, goal_diff: 4, goals_scored: 5, goals_conceded: 1, lost: 0, drawn: 1, won: 2, team: { id: 1649, name: 'Netherlands', logo: 'ned.png' } },
          ],
        },
      },
    });
    const out = await p.fetchGroupTable('1913');
    assert.equal(out.competition.name, 'FIFA World Cup');
    assert.equal(out.stage.name, 'Group Stage');
    assert.equal(out.group.name, 'A');
    assert.deepEqual(out.group.rows[0], {
      rank: 1, team: 'Netherlands', teamId: '1649', teamLogo: 'ned.png',
      played: 3, won: 2, drawn: 1, lost: 0, gf: 5, ga: 1, gd: 4, points: 7,
    });
  });

  it('returns null without a group', async () => {
    assert.equal(await providerReturning({ success: true, data: {} }).fetchGroupTable('1'), null);
  });
});

describe('fetchRosters', () => {
  it('flattens teams and squads', async () => {
    const p = providerReturning({
      success: true,
      data: {
        competition: { id: 362, name: 'FIFA World Cup' },
        teams: [
          {
            team: { id: 1450, name: 'Mexico', logo: 'mex.png' },
            squad: [
              { player: { id: 696, name: 'Edson Alvarez' }, shirt_number: '4', position: 'MF' },
              { player: { id: 1566, name: 'Israel Reyes' }, shirt_number: '15', position: 'DF' },
            ],
          },
        ],
      },
    });
    const out = await p.fetchRosters('362');
    assert.equal(out.teams.length, 1);
    assert.equal(out.teams[0].team, 'Mexico');
    assert.equal(out.teams[0].teamId, '1450');
    assert.deepEqual(out.teams[0].players[0], { id: '696', name: 'Edson Alvarez', number: '4', position: 'MF' });
  });

  it('handles an empty club-league roster', async () => {
    const out = await providerReturning({ success: true, data: { competition: { id: 2, name: 'Premier League' }, teams: [] } }).fetchRosters('2');
    assert.deepEqual(out.teams, []);
  });
});

describe('fetchSquad', () => {
  it('normalises the flat player array (squads.json shape)', async () => {
    const p = providerReturning({
      success: true,
      data: [
        { id: '696', name: 'Edson Alvarez', shirt_number: '4', position: 'MF' },
        { id: '3773', name: 'Alexis Vega', shirt_number: '10', position: 'FW' },
      ],
    });
    const out = await p.fetchSquad('362', '1450');
    assert.equal(out.competitionId, '362');
    assert.equal(out.teamId, '1450');
    assert.equal(out.players.length, 2);
    assert.deepEqual(out.players[0], { id: '696', name: 'Edson Alvarez', number: '4', position: 'MF' });
  });

  it('returns null for an empty squad', async () => {
    assert.equal(await providerReturning({ success: true, data: [] }).fetchSquad('2', '12'), null);
  });
});

describe('fetchHistory', () => {
  it('parses final scores and kickoff from date+scheduled', async () => {
    const p = providerReturning({
      success: true,
      data: {
        total_pages: 3,
        match: [
          {
            id: 714392,
            date: '2026-05-24',
            scheduled: '15:01',
            time: 'FT',
            status: 'FINISHED',
            home: { id: 15, name: 'Tottenham Hotspur', logo: 't.png' },
            away: { id: 20, name: 'Everton', logo: 'e.png' },
            competition: { id: 2, name: 'Premier League' },
            country: { name: 'England', flag: 'ENG.png' },
            scores: { score: '1 - 0', ht_score: '1 - 0' },
            odds: { pre: { 1: 1.93, X: 3.65, 2: 4.5 } },
          },
        ],
      },
    });
    const out = await p.fetchHistory({ competitionId: '2' });
    assert.equal(out.totalPages, 3);
    assert.equal(out.matches.length, 1);
    const m = out.matches[0];
    assert.equal(m.status, 'finished');
    assert.equal(m.scoreHome, 1);
    assert.equal(m.scoreAway, 0);
    assert.equal(m.kickoff, '2026-05-24T15:01:00');
    assert.equal(m.home, 'Tottenham Hotspur');
    assert.equal(m.sourceId, '714392');
  });

  it('returns empty result when disabled', async () => {
    const p = new LiveScoreApiProvider('', ''); // not enabled
    assert.deepEqual(await p.fetchHistory({ competitionId: '2' }), { matches: [], totalPages: 0 });
  });
});

describe('fetchMatchStatistics', () => {
  it('passes through the stat rows', async () => {
    const p = providerReturning({
      success: true,
      data: [
        { type: 'possesion', label: 'Possession', home: 54, away: 46 },
        { type: 'corners', label: 'Corners', home: 6, away: 5 },
      ],
    });
    const out = await p.fetchMatchStatistics('385735');
    assert.equal(out.stats.length, 2);
    assert.deepEqual(out.stats[0], { type: 'possesion', label: 'Possession', home: 54, away: 46 });
  });

  it('returns empty stats for a match without them', async () => {
    assert.deepEqual((await providerReturning({ success: true, data: null }).fetchMatchStatistics('1')).stats, []);
  });
});

describe('fetchH2H', () => {
  it('normalises teams, form and match lists', async () => {
    const p = providerReturning({
      success: true,
      data: {
        team1: { id: '27', name: 'Real Madrid', stadium: 'Bernabéu', overall_form: ['W', 'W'], h2h_form: ['L', 'L'] },
        team2: { id: '21', name: 'Barcelona', stadium: 'Camp Nou', overall_form: ['L', 'W'], h2h_form: ['W', 'W'] },
        h2h: [{ id: '1', date: '2026-05-23', home_name: 'Real Madrid', away_name: 'Barcelona', score: '4 - 2', ht_score: '2 - 1', status: 'FINISHED' }],
        team1_last_6: [{ id: '2', date: '2026-05-20', home_name: 'Real Madrid', away_name: 'X', score: '1 - 0' }],
        team2_last_6: [],
      },
    });
    const out = await p.fetchH2H('27', '21');
    assert.equal(out.team1.name, 'Real Madrid');
    assert.deepEqual(out.team1.overallForm, ['W', 'W']);
    assert.deepEqual(out.team1.h2hForm, ['L', 'L']);
    assert.equal(out.h2h[0].home, 'Real Madrid');
    assert.equal(out.h2h[0].score, '4 - 2');
    assert.equal(out.team1LastSix.length, 1);
    assert.equal(out.team2LastSix.length, 0);
  });

  it('returns null when both teams are missing', async () => {
    assert.equal(await providerReturning({ success: true, data: {} }).fetchH2H('1', '2'), null);
  });
});

describe('fetchTeams / fetchCompetitions / fetchCountries / fetchFederations / fetchSeasons', () => {
  it('normalises the paginated team directory', async () => {
    const p = providerReturning({
      success: true,
      data: { teams: [{ id: 12, name: 'Manchester City', logo: 'c.png', stadium: 'Etihad', country_id: 19 }], total: 1, pages: 1 },
    });
    const out = await p.fetchTeams({ countryId: '19', page: '1' });
    assert.equal(out.total, 1);
    assert.deepEqual(out.teams[0], { id: '12', name: 'Manchester City', logo: 'c.png', stadium: 'Etihad', countryId: '19' });
  });

  it('normalises competitions with string/bool flag coercion', async () => {
    const p = providerReturning({
      success: true,
      data: { competition: [{ id: '2', name: ' Premier League ', tier: '1', is_cup: '0', is_league: '1', active: '1', has_groups: '1', countries: [{ id: '19', name: 'England', flag: 'ENG.png' }], season: { id: '56', name: '2025/2026' } }] },
    });
    const [c] = await p.fetchCompetitions({ countryId: '19' });
    assert.equal(c.name, 'Premier League'); // trimmed
    assert.equal(c.tier, 1);
    assert.equal(c.isCup, false);
    assert.equal(c.isLeague, true);
    assert.equal(c.active, true);
    assert.equal(c.hasGroups, true);
    assert.equal(c.country.name, 'England');
    assert.equal(c.season.name, '2025/2026');
  });

  it('normalises countries, federations and seasons', async () => {
    assert.deepEqual(
      await providerReturning({ success: true, data: { country: [{ id: '19', name: 'England', flag: 'ENG.png', fifa_code: 'ENG', uefa_code: 'ENG' }] } }).fetchCountries({}),
      [{ id: '19', name: 'England', flag: 'ENG.png', fifaCode: 'ENG', uefaCode: 'ENG' }],
    );
    assert.deepEqual(
      await providerReturning({ success: true, data: { federation: [{ id: '2', name: 'UEFA' }] } }).fetchFederations(),
      [{ id: '2', name: 'UEFA' }],
    );
    assert.deepEqual(
      await providerReturning({ success: true, data: { seasons: [{ id: 56, name: '2025/2026', start: '2025-07-01', end: '2026-06-30' }] } }).fetchSeasons(),
      [{ id: '56', name: '2025/2026', start: '2025-07-01', end: '2026-06-30' }],
    );
  });

  it('returns empty collections when the provider is disabled', async () => {
    const p = new LiveScoreApiProvider('', '');
    assert.deepEqual(await p.fetchCompetitions({}), []);
    assert.deepEqual(await p.fetchCountries({}), []);
    assert.deepEqual(await p.fetchFederations(), []);
    assert.deepEqual(await p.fetchSeasons(), []);
    assert.deepEqual(await p.fetchTeams({}), { teams: [], page: 1, pages: 0, total: 0 });
  });
});
