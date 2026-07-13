# LiveScore API — Major-Leagues Layer + Remaining Reachable Endpoints

**Date:** 2026-07-13
**Status:** Approved (design)
**Scope choice:** Provider methods + public Express routes, organized around a static
curated "major leagues" catalog. **No client UI** in this iteration.

## Goal

The `liveScoreApi` provider already exposes live scores, fixtures, 1X2 odds,
standings (`competitions/table.json`), match events, and lineups. This work adds a
curated catalog of the major competitions and wires up every **remaining
livescore-api.com endpoint that this account's plan can actually reach**, exposing
each as a cached public GET route under `/api/bet`.

## Plan-reachability (verified against the live API, 2026-07-13)

Writing code for unreachable endpoints would be dead code, so they are excluded.

**Reachable → wire these:** `competitions/topscorers`, `competitions/groups`,
`groups/table`, `competitions/rosters`, `competitions/squads`, `matches/history`,
`statistics/matches`, `teams/head2head`, `teams/list`, `competitions/list`,
`countries/list`, `federations/list`, `seasons/list`.

**NOT reachable → excluded:**
- `competitions/topdisciplinary`, `teams/last-matches` — "Invalid controller
  specified" (do not exist on this API version).
- `matches/commentary`, `standings/live`, `fantasy/fantasy` — HTTP 402, not in the
  plan tier.

## Component 1 — Static curated catalog

New module `server/src/providers/liveScoreLeagues.js`. IDs hand-verified against the
live `competitions/list.json` (the Postman docs contradict themselves on IDs — e.g.
they list LaLiga as both 3 and 4 — so the API is the source of truth).

| Priority | Competition | ID | type | hasGroups |
|---|---|---|---|---|
| 1 | Premier League | 2 | league | no |
| 2 | LaLiga | 3 | league | no |
| 3 | Serie A | 4 | league | no |
| 4 | Bundesliga | 1 | league | no |
| 5 | Ligue 1 | 5 | league | no |
| 6 | Eredivisie | 196 | league | no |
| 7 | Primeira Liga | 8 | league | no |
| 8 | Championship | 77 | league | no |
| 9 | UEFA Champions League | 244 | cup | yes |
| 10 | UEFA Europa League | 245 | cup | yes |
| 11 | FIFA World Cup | 362 | international | yes |
| 12 | FIFA Club World Cup | 372 | international | yes |

Each entry: `{ id, name, shortName, country, type, hasGroups, priority }`.
Exports: `MAJOR_LEAGUES` (ordered array), `getMajorLeagues()`, `getLeague(id)`,
`isMajorLeague(id)`.

## Component 2 — Provider methods (`liveScoreApi.js`)

Each method is **exactly one HTTP call** (the base class paces calls; firing two
requests inside one method trips its own pacing gate). Each has a dedicated
normaliser. Shapes below are confirmed from live responses.

- `fetchTopScorers(competitionId)` → `competitions/topscorers.json`
  Response `data.topscorers[]`: `{ goals, assists, played, team{id,name,logo},
  player{id,name,photo} }`. Normalise to `{ competition, season, rows:[{ rank,
  player, playerId, photo, team, teamId, teamLogo, goals, assists, played }] }`
  (rank = array index + 1).
- `fetchCompetitionGroups(competitionId)` → `competitions/groups.json`
  Response `data` is an **array** of `{ id, name, stage }`. Normalise to
  `[{ id, name, stage }]`.
- `fetchGroupTable(groupId)` → `groups/table.json`
  Response `data = { competition, season, stage, group{ id, name, standings[] } }`.
  Reuse the existing standings-row shape → `{ competition, season, stage, group:{
  id, name, rows:[…] } }`.
- `fetchRosters(competitionId)` → `competitions/rosters.json`
  Response `data = { competition, teams:[{ team{id,name,logo}, squad:[{ player{
  id,name }, shirt_number, position }] }] }`. Normalise to `{ competition,
  teams:[{ team, teamId, teamLogo, players:[{ id, name, number, position }] }] }`.
  (Empty `teams` for league competitions; populated for national-team tournaments.)
- `fetchSquad(competitionId, teamId)` → `competitions/squads.json`
  Same player shape as rosters, single team.
- `fetchHistory({ competitionId, teamId, from, to, round })` → `matches/history.json`
  Response `data = { match:[…], total_pages }`. Each match is the same nested shape
  as live matches and carries `scores.score`, `time:"FT"`, `status:"FINISHED"` —
  reuse the existing `normalise(m, id, kind)` (extended so `history` parses scores
  like `live`). Return `{ matches:[…], totalPages }`.
- `fetchMatchStatistics(matchId)` → `statistics/matches.json`
  Response `data` is an **array** of `{ type, label, home, away }`. Pass through as
  `{ stats:[{ type, label, home, away }] }`.
- `fetchH2H(team1Id, team2Id)` → `teams/head2head.json`
  Response `data = { team1, team2, team1_last_6[], team2_last_6[], h2h[], fixture,
  videos }`. Teams carry `overall_form[]` + `h2h_form[]`; match rows carry
  `{ id, date, home_name, away_name, score, ht_score, status }`. Normalise to
  `{ team1, team2, h2h:[…tidyMatch], team1LastSix:[…], team2LastSix:[…] }`.
- `fetchTeams({ countryId, federationId, page })` → `teams/list.json`
  Response `data = { teams[], total, pages, next_page, prev_page }`. Normalise to
  `{ teams:[{ id, name, logo, stadium, countryId }], page, pages, total }`.
- `fetchCompetitions({ countryId, federationId })` → `competitions/list.json`
  Normalise each to `{ id, name, tier, isCup, isLeague, active, hasGroups, country,
  season }`.
- `fetchCountries({ federationId })` → `countries/list.json` → `[{ id, name, flag,
  fifaCode, uefaCode }]`.
- `fetchFederations()` → `federations/list.json` → `[{ id, name }]`.
- `fetchSeasons()` → `seasons/list.json` → `[{ id, name, start, end }]`.

## Component 3 — Public GET routes (`server/src/routes/bet.js`)

Follow the existing `/standings` pattern: validate params → check cache → verify
`getProvider('liveScoreApi')` is enabled and has the method → call it → cache →
respond `{ updatedAt, cached, ...payload }`. All public (no auth), same as
`/standings` and `/match-detail`.

| Route | Provider method | Cache TTL |
|---|---|---|
| `GET /leagues/major` | (catalog module) | static |
| `GET /top-scorers?competition=` | fetchTopScorers | 600 s |
| `GET /competition-groups?competition=` | fetchCompetitionGroups | 3600 s |
| `GET /group-standings?group=` | fetchGroupTable | 600 s |
| `GET /rosters?competition=` | fetchRosters | 3600 s |
| `GET /squad?competition=&team=` | fetchSquad | 3600 s |
| `GET /history?competition=&team=&from=&to=&round=` | fetchHistory | 300 s |
| `GET /match-stats?matchId=` | fetchMatchStatistics | 30 s |
| `GET /h2h?team1=&team2=` | fetchH2H | 3600 s |
| `GET /teams?country=&federation=&page=` | fetchTeams | 86400 s |
| `GET /competitions?country=&federation=` | fetchCompetitions | 86400 s |
| `GET /countries?federation=` | fetchCountries | 86400 s |
| `GET /federations` | fetchFederations | 86400 s |
| `GET /seasons` | fetchSeasons | 86400 s |

Validation: numeric-id params validated with `/^\d+$/`; `history` date params
validated as `YYYY-MM-DD`; unknown/missing required params → `badRequest`. Provider
disabled or empty upstream → `notFound` (mirrors `/standings`). At least one of the
history/list filters is optional — the endpoints accept no-filter calls too.

## Component 4 — Tests

A `node --test` file under `server/src/services/__tests__/` (or `server/test/`)
that stubs `provider.http` with the captured sample payloads and asserts each
normaliser produces the documented shape (rank numbering, score parsing, empty-team
rosters, array-typed groups/stats). Plus a manual `curl` of each new live route once
during verification.

## Out of scope

- topdisciplinary, last-matches, commentary, live standings, fantasy (unreachable).
- Any client/React UI (deferred to a later iteration per the agreed scope).
- Changes to the existing `/standings` and `/match-detail` routes (left as-is).
