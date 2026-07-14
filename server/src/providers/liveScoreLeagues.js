/**
 * Curated "major leagues" catalog for live-score-api.com.
 *
 * A hand-maintained, ordered list of the competitions we feature first in the
 * UI. Competition IDs are verified against the live `competitions/list.json`
 * endpoint — NOT copied from the Postman docs, which contradict themselves
 * (they list LaLiga as both id 3 and id 4, etc.). The live API is the source
 * of truth; re-verify with a `competitions/list.json` dump if these ever drift.
 *
 * `hasGroups` marks tournaments with a group stage (World Cup, UCL, Europa) so
 * consumers know to fetch `competitions/groups.json` + `groups/table.json`
 * instead of a single league table.
 *
 *   type:   'league'        — domestic round-robin league (single table)
 *           'cup'           — continental club competition (group stage + KO)
 *           'international'  — national-team tournament
 */

/** @typedef {{ id:string, name:string, shortName:string, country:string,
 *              type:'league'|'cup'|'international', hasGroups:boolean,
 *              priority:number }} MajorLeague */

/** @type {MajorLeague[]} */
export const MAJOR_LEAGUES = [
  { id: '2', name: 'Premier League', shortName: 'EPL', country: 'England', type: 'league', hasGroups: false, priority: 1 },
  { id: '3', name: 'LaLiga', shortName: 'LaLiga', country: 'Spain', type: 'league', hasGroups: false, priority: 2 },
  { id: '4', name: 'Serie A', shortName: 'Serie A', country: 'Italy', type: 'league', hasGroups: false, priority: 3 },
  { id: '1', name: 'Bundesliga', shortName: 'Bundesliga', country: 'Germany', type: 'league', hasGroups: false, priority: 4 },
  { id: '5', name: 'Ligue 1', shortName: 'Ligue 1', country: 'France', type: 'league', hasGroups: false, priority: 5 },
  { id: '196', name: 'Eredivisie', shortName: 'Eredivisie', country: 'Netherlands', type: 'league', hasGroups: false, priority: 6 },
  { id: '8', name: 'Primeira Liga', shortName: 'Primeira', country: 'Portugal', type: 'league', hasGroups: false, priority: 7 },
  { id: '77', name: 'Championship', shortName: 'Championship', country: 'England', type: 'league', hasGroups: false, priority: 8 },
  { id: '244', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe', type: 'cup', hasGroups: true, priority: 9 },
  { id: '245', name: 'UEFA Europa League', shortName: 'UEL', country: 'Europe', type: 'cup', hasGroups: true, priority: 10 },
  { id: '362', name: 'FIFA World Cup', shortName: 'World Cup', country: 'World', type: 'international', hasGroups: true, priority: 11 },
  { id: '372', name: 'FIFA Club World Cup', shortName: 'Club WC', country: 'World', type: 'international', hasGroups: true, priority: 12 },
];

const _byId = new Map(MAJOR_LEAGUES.map((l) => [l.id, l]));

/** The full catalog, ordered by `priority` ascending. */
export function getMajorLeagues() {
  return MAJOR_LEAGUES;
}

/** Look up a single curated league by its competition id (string or number). */
export function getLeague(id) {
  return _byId.get(String(id)) || null;
}

/** True when `id` is one of the curated major competitions. */
export function isMajorLeague(id) {
  return _byId.has(String(id));
}
