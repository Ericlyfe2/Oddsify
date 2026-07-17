/**
 * Manual live-clock broadcaster for admin-controlled fixtures (db/sportsAdmin.js
 * overrides — this is the fixture store the admin Sports page and the
 * player-facing storefront actually read from). The admin starts/pauses/
 * resumes the clock via the /admin/sports/fixtures/:id/live/* endpoints;
 * this service is the periodic ticker that re-derives each running
 * fixture's minute server-side and re-broadcasts it, and enforces the
 * 90+15 sanity cap by auto-flipping to full-time and locking cash-out
 * instead of letting the clock run forever.
 */
import {
  listRunningClockFixtureIds,
  adminLookupFixture,
  computeMinuteDisplay,
  isPastStoppageCap,
  goToFulltime,
  patchOverride,
} from '../db/sportsAdmin.js';
import { emitScoreUpdate, emitAdmin } from './realtime.js';
import * as cashOutEngine from './cashOutEngine.js';
import { log } from '../utils/logger.js';

const TICK_MS = 15_000;
let timer = null;

function broadcast(id, view, extra = {}) {
  const fixture = { ...view.match, sport: view.sport?.id, leagueId: view.league?.id };
  emitAdmin('sports:fixture:updated', { fixture });
  emitScoreUpdate({
    fixtureId: id,
    sport: view.sport?.id,
    scoreHome: fixture.scoreHome ?? 0,
    scoreAway: fixture.scoreAway ?? 0,
    minute: fixture.minute ?? null,
    ...extra,
  });
}

function tick() {
  for (const id of listRunningClockFixtureIds()) {
    const view = adminLookupFixture(id);
    if (!view) continue;
    const override = view.match;
    if (isPastStoppageCap(override)) {
      goToFulltime(id);
      broadcast(id, adminLookupFixture(id), { eventKind: 'full_time' });
      cashOutEngine.lockFixture(id, 'match_ended');
      continue;
    }
    // Re-derive and persist the display minute so a plain refetch (no
    // socket) also sees the current value, then broadcast it.
    const minute = computeMinuteDisplay(override);
    patchOverride(id, { minute });
    broadcast(id, adminLookupFixture(id));
  }
}

export function startSportsLiveClock() {
  if (timer) return;
  timer = setInterval(() => {
    try {
      tick();
    } catch (e) {
      log.warn(`Sports live clock tick failed: ${e.message}`);
    }
  }, TICK_MS);
  log.info(`Sports live clock started, broadcasting every ${TICK_MS / 1000}s.`);
}

export function stopSportsLiveClock() {
  if (timer) clearInterval(timer);
  timer = null;
}
