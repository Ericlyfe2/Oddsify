/**
 * Matches store — canonical fixture records with deduplication and lifecycle.
 *
 * State machine:
 *   draft → scheduled → live → settled → archived
 *   scheduled/live → suspended → (scheduled|live)
 *   scheduled/live → cancelled
 *   any → archived
 *
 * Deduplication uses a `dedupeHash` computed from (leagueId, homeTeamId,
 * awayTeamId, startMinuteUTC). Near-duplicate detection flags fixtures with
 * the same teams ±90 minutes as a soft warning.
 */
import crypto from 'crypto';
import { createStore } from './store.js';
import { normalize, dedupeHash } from '../utils/dudupe.js';

const store = createStore('matches_catalog', {});

const VALID_TRANSITIONS = {
  draft: ['scheduled', 'archived'],
  scheduled: ['live', 'suspended', 'cancelled', 'archived'],
  live: ['suspended', 'settled', 'archived'],
  suspended: ['scheduled', 'live', 'cancelled', 'archived'],
  cancelled: ['archived'],
  settled: ['archived'],
  archived: [],
};

export function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertTransition(from, to) {
  if (!isValidTransition(from, to)) {
    throw Object.assign(new Error(`Cannot transition match from "${from}" to "${to}"`), { status: 400 });
  }
}

export function listMatches(opts = {}) {
  let all = Object.values(store.all() || {});
  if (opts.sportId) all = all.filter((m) => m.sportId === opts.sportId);
  if (opts.leagueId) all = all.filter((m) => m.leagueId === opts.leagueId);
  if (opts.status) all = all.filter((m) => m.status === opts.status);
  if (opts.includeArchived) all = all.filter((m) => m.status !== 'archived');
  if (opts.search) {
    const q = String(opts.search).toLowerCase();
    all = all.filter((m) => {
      const home = (m.homeTeamName || '').toLowerCase();
      const away = (m.awayTeamName || '').toLowerCase();
      return home.includes(q) || away.includes(q) || m.id.includes(q);
    });
  }
  return all.sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0));
}

export function getMatch(id) {
  return store.get(id) || null;
}

export function findDuplicate(leagueId, homeTeamId, awayTeamId, startsAt) {
  const start = new Date(startsAt);
  const startMinute = new Date(start).setSeconds(0, 0);
  const hash = dedupeHash(leagueId, homeTeamId, awayTeamId, new Date(startMinute).toISOString());

  const all = Object.values(store.all() || {});
  const exact = all.find((m) => m.dedupeHash === hash);
  if (exact) {
    return { type: 'exact', record: exact, message: 'This match already exists.' };
  }

  const startTime = start.getTime();
  const near = all.find((m) => {
    if (m.leagueId !== leagueId) return false;
    if (m.homeTeamId !== homeTeamId && m.awayTeamId !== awayTeamId) return false;
    const mt = new Date(m.startsAt).getTime();
    return Math.abs(mt - startTime) <= 90 * 60 * 1000;
  });

  if (near) {
    return { type: 'near', record: near, message: 'A match with these teams exists within 90 minutes of this time.' };
  }
  return null;
}

export function createMatch(input) {
  const leagueId = input.leagueId;
  const startsAt = input.startsAt;

  const dup = findDuplicate(leagueId, input.homeTeamId, input.awayTeamId, startsAt);
  if (dup) {
    const err = new Error(dup.message);
    err.status = dup.type === 'exact' ? 409 : 409;
    err.body = { error: 'DUPLICATE_MATCH', message: dup.message, existingId: dup.record.id, type: dup.type };
    throw err;
  }

  const id = `match-${crypto.randomBytes(4).toString('hex')}`;
  const startDate = new Date(startsAt);
  const startMinute = new Date(startDate).setSeconds(0, 0);
  const hash = dedupeHash(leagueId, input.homeTeamId, input.awayTeamId, new Date(startMinute).toISOString());

  const rec = {
    id,
    sportId: input.sportId,
    leagueId,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeTeamName: String(input.homeTeamName || '').trim(),
    awayTeamName: String(input.awayTeamName || '').trim(),
    startsAt: startDate.toISOString(),
    venue: input.venue || '',
    country: input.country || '',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    // Manual live-clock state (admin-driven fixtures only — provider-sourced
    // fixtures get their minute/score from the odds aggregator instead).
    clockStatus: 'not_started', // not_started | running | paused | ht | ft
    minuteBase: 0, // minutes banked before the current running segment
    minuteStartedAt: null, // ISO ts the clock was last (re)started, or null when not running
    dedupeHash: hash,
    externalRef: input.externalRef || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}

export function updateMatch(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;

  // Status transition guard
  if (patch.status && patch.status !== cur.status) {
    assertTransition(cur.status, patch.status);
  }

  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return next;
}

export function transitionMatch(id, newStatus) {
  return updateMatch(id, { status: newStatus });
}

export function cancelMatch(id, reason = '') {
  const cur = store.get(id);
  if (!cur) return null;
  assertTransition(cur.status, 'cancelled');
  return updateMatch(id, { status: 'cancelled', cancelledReason: reason });
}

export function archiveMatch(id) {
  const cur = store.get(id);
  if (!cur) return null;
  assertTransition(cur.status, 'archived');
  return updateMatch(id, { status: 'archived' });
}

/* ── Manual live clock (admin-driven fixtures) ──────────────
 * A single server-side source of truth for minute/score so the admin panel
 * and the player-facing site never drift: minuteBase banks the minutes
 * accumulated before the current running segment, minuteStartedAt marks when
 * the current segment began. Elapsed time is always derived, never stored,
 * so there's nothing to fall out of sync between reads.
 */
const STOPPAGE_CAP_MIN = 15; // sanity cap — freezes ~90+15 instead of running forever

/** Minutes elapsed right now, including any running segment. Not display-formatted. */
export function currentElapsedMinutes(m) {
  let total = m.minuteBase || 0;
  if (m.clockStatus === 'running' && m.minuteStartedAt) {
    total += Math.floor((Date.now() - new Date(m.minuteStartedAt).getTime()) / 60000);
  }
  return total;
}

/** Display string for the current minute: '23', '45+2', 'HT', 'FT', or null pre-kickoff. */
export function computeMinuteDisplay(m) {
  if (!m || m.clockStatus === 'not_started') return null;
  if (m.clockStatus === 'ht') return 'HT';
  if (m.clockStatus === 'ft') return 'FT';

  const total = currentElapsedMinutes(m);
  if (total >= 90) {
    const extra = Math.min(total - 90, STOPPAGE_CAP_MIN);
    if (total - 90 >= STOPPAGE_CAP_MIN) return 'FT';
    return extra > 0 ? `90+${extra}` : '90';
  }
  return String(total);
}

/** Whether this running match has hit the sanity cap and should auto-flip to FT. */
export function isPastStoppageCap(m) {
  return m.clockStatus === 'running' && currentElapsedMinutes(m) - 90 >= STOPPAGE_CAP_MIN;
}

export function startClock(id) {
  const cur = store.get(id);
  if (!cur) return null;
  const patch = { clockStatus: 'running', minuteBase: 0, minuteStartedAt: new Date().toISOString() };
  if (cur.status === 'scheduled') assertTransition(cur.status, 'live');
  return updateMatch(id, cur.status === 'scheduled' ? { ...patch, status: 'live' } : patch);
}

export function pauseClock(id) {
  const cur = store.get(id);
  if (!cur) return null;
  const minuteBase = currentElapsedMinutes(cur);
  return updateMatch(id, { clockStatus: 'paused', minuteBase, minuteStartedAt: null });
}

export function resumeClock(id) {
  const cur = store.get(id);
  if (!cur) return null;
  return updateMatch(id, { clockStatus: 'running', minuteStartedAt: new Date().toISOString() });
}

export function goToHalftime(id) {
  const cur = store.get(id);
  if (!cur) return null;
  return updateMatch(id, { clockStatus: 'ht', minuteBase: 45, minuteStartedAt: null });
}

export function startSecondHalf(id) {
  const cur = store.get(id);
  if (!cur) return null;
  return updateMatch(id, { clockStatus: 'running', minuteBase: 45, minuteStartedAt: new Date().toISOString() });
}

export function goToFulltime(id) {
  const cur = store.get(id);
  if (!cur) return null;
  return updateMatch(id, { clockStatus: 'ft', minuteBase: 90, minuteStartedAt: null });
}

export function setLiveScore(id, homeScore, awayScore) {
  const cur = store.get(id);
  if (!cur) return null;
  return updateMatch(id, { homeScore: Number(homeScore), awayScore: Number(awayScore) });
}

/** Every match currently ticking — polled by the manual live-clock broadcaster. */
export function listRunningClockMatches() {
  return Object.values(store.all() || {}).filter((m) => m.clockStatus === 'running');
}
