/**
 * Regression tests for the settlement engine's kickoff parsing and the
 * phantom-result repair sweep.
 *
 * Bug being covered: provider fixtures beyond tomorrow carry day labels like
 * "Tue 21 Jul", which the old parser didn't recognize — it silently assumed
 * "today", so a match kicking off in 2 days was auto-locked at HH:MM today
 * and got a simulated final score 110 minutes later ("FINISHED 1-1" on a
 * match that hadn't been played).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const { scheduledKickoffTs, settleNow } = await import('../src/services/settlement.js');
const { addCustomFixture, setResult, getResult, setSuspension, patchOverride, readSportsAdmin } = await import(
  '../src/db/sportsAdmin.js'
);

const DAY = 86_400_000;
const stamp = Date.now();

function futureDateStr(daysAhead) {
  const d = new Date(Date.now() + daysAhead * DAY);
  return d.toISOString().slice(0, 10);
}

describe('scheduledKickoffTs', () => {
  it('prefers an ISO kickoff field over labels', () => {
    const iso = new Date(Date.now() + 3 * DAY).toISOString();
    const ts = scheduledKickoffTs({ kickoffIso: iso, kickoff: '16:00', day: 'Today' });
    assert.equal(ts, new Date(iso).getTime());
  });

  it('falls back to the YYYY-MM-DD date embedded in provider fixture ids', () => {
    const date = futureDateStr(2);
    const ts = scheduledKickoffTs({ id: `football|home|vs|away|${date}`, kickoff: '16:00', day: 'whatever' });
    const expected = new Date(`${date}T00:00:00`).getTime() + 16 * 3600_000;
    assert.equal(ts, expected);
    assert.ok(ts > Date.now(), 'a fixture 2 days out must resolve to a future timestamp');
  });

  it('still handles Today / Tomorrow / In N days labels', () => {
    const now = Date.now();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const base = midnight.getTime() + 16 * 3600_000;
    assert.equal(scheduledKickoffTs({ kickoff: '16:00', day: 'Today' }, now), base);
    assert.equal(scheduledKickoffTs({ kickoff: '16:00', day: 'Tomorrow' }, now), base + DAY);
    assert.equal(scheduledKickoffTs({ kickoff: '16:00', day: 'In 3 days' }, now), base + 3 * DAY);
  });

  it('parses weekday-date labels like "Tue 21 Jul" instead of assuming today', () => {
    const target = new Date(Date.now() + 5 * DAY);
    const label = target.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    const ts = scheduledKickoffTs({ kickoff: '16:00', day: label });
    assert.ok(Number.isFinite(ts) && ts > 0, `label "${label}" must parse`);
    // Must land on the right calendar day, not today
    assert.equal(new Date(ts).getDate(), target.getDate());
  });

  it('returns 0 (unknown) for an unparseable label rather than guessing today', () => {
    assert.equal(scheduledKickoffTs({ kickoff: '16:00', day: 'random junk label' }), 0);
  });
});

describe('phantom-result repair sweep', () => {
  const PHANTOM_ID = `football|phantom-home-${stamp}|vs|phantom-away-${stamp}|${futureDateStr(2)}`;
  const REAL_PAST_ID = `football|past-home-${stamp}|vs|past-away-${stamp}|2020-01-01`;

  it('clears a simulated result + suspension + kickoff lock on a future fixture', () => {
    addCustomFixture({
      id: PHANTOM_ID,
      sport: 'football',
      home: `Phantom Home ${stamp}`,
      away: `Phantom Away ${stamp}`,
      kickoff: '16:00',
      day: 'whatever-stale-label',
      markets: {},
    });
    setResult(PHANTOM_ID, 1, 1, 'simulated');
    setSuspension(PHANTOM_ID, { all: true });
    patchOverride(PHANTOM_ID, { kickoffLocked: true, kickoffLockedAt: new Date().toISOString() });

    assert.ok(getResult(PHANTOM_ID), 'phantom result seeded');
    settleNow();

    assert.equal(getResult(PHANTOM_ID), null, 'simulated result on a future fixture must be cleared');
    const { suspensions, overrides } = readSportsAdmin();
    assert.equal(suspensions[PHANTOM_ID], undefined, 'suspension must be lifted');
    assert.equal(overrides[PHANTOM_ID]?.kickoffLocked, false, 'kickoff lock must be released');
  });

  it('leaves simulated results on genuinely past fixtures alone', () => {
    addCustomFixture({
      id: REAL_PAST_ID,
      sport: 'football',
      home: `Past Home ${stamp}`,
      away: `Past Away ${stamp}`,
      kickoff: '16:00',
      day: 'Today',
      markets: {},
    });
    setResult(REAL_PAST_ID, 2, 0, 'simulated');

    settleNow();

    const res = getResult(REAL_PAST_ID);
    assert.ok(res, 'result on a past fixture must survive the repair sweep');
    assert.equal(res.scoreHome, 2);
  });

  after(() => {
    // Best-effort cleanup so re-runs stay deterministic.
    const store = readSportsAdmin();
    for (const id of [PHANTOM_ID, REAL_PAST_ID]) {
      delete store.custom[id];
    }
  });
});
