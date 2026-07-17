/**
 * Manual live-clock broadcaster — for admin-created fixtures that don't come
 * from an odds provider. The admin controls kickoff/pause/half-time/score via
 * the management-matches "live" endpoints; this service is the single ticker
 * that periodically re-derives each running match's minute (server-side, so
 * admin and player views can never disagree) and re-broadcasts it, and
 * enforces the 90+15 sanity cap by auto-flipping to full-time and locking
 * cash-out instead of letting the clock run forever.
 */
import * as Matches from '../db/matches.js';
import * as Sports from '../db/sports.js';
import { emitScoreUpdate } from './realtime.js';
import * as cashOutEngine from './cashOutEngine.js';
import { log } from '../utils/logger.js';

const TICK_MS = 15_000;
let timer = null;

function sportKeyFor(match) {
  return Sports.getSport(match.sportId)?.key || match.sportId;
}

export function broadcastMatch(match, extra = {}) {
  emitScoreUpdate({
    fixtureId: match.id,
    sport: sportKeyFor(match),
    scoreHome: match.homeScore ?? 0,
    scoreAway: match.awayScore ?? 0,
    minute: Matches.computeMinuteDisplay(match),
    ...extra,
  });
}

function tick() {
  for (const m of Matches.listRunningClockMatches()) {
    if (Matches.isPastStoppageCap(m)) {
      const updated = Matches.goToFulltime(m.id);
      broadcastMatch(updated, { eventKind: 'full_time' });
      cashOutEngine.lockFixture(updated.id, 'match_ended');
      continue;
    }
    broadcastMatch(m);
  }
}

export function startManualLiveClock() {
  if (timer) return;
  timer = setInterval(() => {
    try {
      tick();
    } catch (e) {
      log.warn(`Manual live clock tick failed: ${e.message}`);
    }
  }, TICK_MS);
  log.info(`Manual live clock started, broadcasting every ${TICK_MS / 1000}s.`);
}

export function stopManualLiveClock() {
  if (timer) clearInterval(timer);
  timer = null;
}
