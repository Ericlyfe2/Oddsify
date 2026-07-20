/**
 * Regression tests for the phantom-bet detection + reversal tooling
 * (services/phantomBets.js, routes/admin/maintenance.js). Covers the
 * "audit log for phantom settled bets and refund them" follow-up to the
 * settlement kickoff-parsing bug fixed in settlement.js.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/middleware/error.js';
import { signAdminAccessToken } from '../src/services/token.js';

const stamp = Date.now();
const FUTURE_DATE = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const PHANTOM_FIXTURE_ID = `football|phantom-team-a-${stamp}|vs|phantom-team-b-${stamp}|${FUTURE_DATE}`;

const WON_USER_ID = `phantom-won-user-${stamp}@test.local`;
const LOST_USER_ID = `phantom-lost-user-${stamp}@test.local`;
const SPENT_USER_ID = `phantom-spent-user-${stamp}@test.local`;
const GENUINE_USER_ID = `phantom-genuine-user-${stamp}@test.local`;
const FINANCE_ADMIN_ID = `phantom-finance-admin-${stamp}@test.local`;
const MODERATOR_ADMIN_ID = `phantom-moderator-admin-${stamp}@test.local`;

const PHANTOM_WON_BET_ID = `pbet-won-${stamp}`;
const PHANTOM_LOST_BET_ID = `pbet-lost-${stamp}`;
const PHANTOM_SPENT_BET_ID = `pbet-spent-${stamp}`;
const GENUINE_BET_ID = `pbet-genuine-${stamp}`;

async function createTestApp() {
  const app = express();
  app.use(express.json());

  const { createUser, getUserById, updateUser } = await import('../src/db/users.js');
  const { createStore } = await import('../src/db/store.js');
  const { addCustomFixture } = await import('../src/db/sportsAdmin.js');
  const { default: adminMaintenanceRouter } = await import('../src/routes/admin/maintenance.js');

  for (const [id, balance] of [
    [WON_USER_ID, 1000],
    [LOST_USER_ID, 1000],
    [SPENT_USER_ID, 5], // spent nearly all of a phantom win already
    [GENUINE_USER_ID, 1000],
  ]) {
    if (!getUserById(id)) {
      createUser({ id, email: id, displayName: 'Phantom Test Player', passwordHash: 'x', balance, role: 'user' });
    }
    updateUser(id, { balance, blocked: false });
  }
  if (!getUserById(FINANCE_ADMIN_ID)) {
    createUser({ id: FINANCE_ADMIN_ID, email: FINANCE_ADMIN_ID, displayName: 'Finance Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(FINANCE_ADMIN_ID, { role: 'admin', adminRole: 'finance_admin', suspended: false });
  if (!getUserById(MODERATOR_ADMIN_ID)) {
    createUser({ id: MODERATOR_ADMIN_ID, email: MODERATOR_ADMIN_ID, displayName: 'Moderator Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(MODERATOR_ADMIN_ID, { role: 'admin', adminRole: 'moderator', suspended: false });

  // A fixture that kicks off 5 days from now — any bet "settled" before
  // that instant is provably phantom.
  addCustomFixture({
    id: PHANTOM_FIXTURE_ID,
    sport: 'football',
    home: `Phantom Team A ${stamp}`,
    away: `Phantom Team B ${stamp}`,
    kickoff: '18:00',
    day: 'whatever-stale-label',
    kickoffIso: `${FUTURE_DATE}T18:00:00.000Z`,
    markets: {},
  });

  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const leg = { matchId: PHANTOM_FIXTURE_ID, market: '1X2', outcome: '1' };
  const legResolved = { matchId: PHANTOM_FIXTURE_ID, market: '1X2', outcome: '1', won: true, scoreHome: 2, scoreAway: 1 };

  const betsStore = createStore('bets', {});
  betsStore.set(PHANTOM_WON_BET_ID, {
    id: PHANTOM_WON_BET_ID,
    userId: WON_USER_ID,
    status: 'won',
    stake: 10,
    potentialWin: 25,
    settledAt: yesterday,
    settledBy: 'auto',
    settledReturn: 25,
    settledProfit: 15,
    legs: [leg],
    legsResolved: [legResolved],
    placedAt: yesterday,
  });
  betsStore.set(PHANTOM_LOST_BET_ID, {
    id: PHANTOM_LOST_BET_ID,
    userId: LOST_USER_ID,
    status: 'lost',
    stake: 10,
    potentialWin: 25,
    settledAt: yesterday,
    settledBy: 'auto',
    settledReturn: 0,
    settledProfit: -10,
    legs: [leg],
    legsResolved: [{ ...legResolved, won: false }],
    placedAt: yesterday,
  });
  betsStore.set(PHANTOM_SPENT_BET_ID, {
    id: PHANTOM_SPENT_BET_ID,
    userId: SPENT_USER_ID,
    status: 'won',
    stake: 10,
    potentialWin: 100,
    settledAt: yesterday,
    settledBy: 'auto',
    settledReturn: 100,
    settledProfit: 90,
    legs: [leg],
    legsResolved: [legResolved],
    placedAt: yesterday,
  });
  betsStore.set(GENUINE_BET_ID, {
    id: GENUINE_BET_ID,
    userId: GENUINE_USER_ID,
    status: 'won',
    stake: 10,
    potentialWin: 25,
    // Settled well AFTER the fixture's real kickoff — a legitimate result.
    settledAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    settledBy: 'auto',
    settledReturn: 25,
    settledProfit: 15,
    legs: [leg],
    legsResolved: [legResolved],
    placedAt: yesterday,
  });

  app.use('/api/admin/maintenance', adminMaintenanceRouter);
  app.use(errorHandler);
  return app;
}

describe('Admin: phantom-settled bet detection + reversal', () => {
  let app;
  let server;
  let base;
  let financeToken;
  let moderatorToken;

  before(async () => {
    app = await createTestApp();
    const { getUserById } = await import('../src/db/users.js');
    financeToken = signAdminAccessToken(getUserById(FINANCE_ADMIN_ID));
    moderatorToken = signAdminAccessToken(getUserById(MODERATOR_ADMIN_ID));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        base = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((r) => setTimeout(r, 100));
    server?.close();
  });

  function fetchApi(path, opts = {}, token = financeToken) {
    return fetch(`${base}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
  }

  it('a moderator (not finance_admin) is rejected on the list endpoint', async () => {
    const res = await fetchApi('/api/admin/maintenance/phantom-bets', {}, moderatorToken);
    assert.equal(res.status, 403);
  });

  it('lists the phantom-settled bets and excludes the genuinely-settled one', async () => {
    const res = await fetchApi('/api/admin/maintenance/phantom-bets');
    assert.equal(res.status, 200);
    const body = await res.json();
    const ids = body.bets.map((b) => b.id);
    assert.ok(ids.includes(PHANTOM_WON_BET_ID));
    assert.ok(ids.includes(PHANTOM_LOST_BET_ID));
    assert.ok(ids.includes(PHANTOM_SPENT_BET_ID));
    assert.ok(!ids.includes(GENUINE_BET_ID), 'a bet settled after real kickoff must not be flagged');
  });

  it('reopening a phantom won bet claws back the exact credit paid', async () => {
    const res = await fetchApi(`/api/admin/maintenance/phantom-bets/${PHANTOM_WON_BET_ID}/reopen`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.clawback, 25);
    assert.equal(body.shortfall, 0);
    assert.equal(body.balanceAfter, 975); // 1000 - 25

    const { getUserById } = await import('../src/db/users.js');
    assert.equal(getUserById(WON_USER_ID).balance, 975);

    const { createStore } = await import('../src/db/store.js');
    const betsStore = createStore('bets', {});
    const bet = betsStore.get(PHANTOM_WON_BET_ID);
    assert.equal(bet.status, 'open');
    assert.equal(bet.settledAt, undefined);
    assert.equal(bet.legsResolved, undefined);
  });

  it('reopening a phantom lost bet claws back nothing (no money moved on a loss)', async () => {
    const res = await fetchApi(`/api/admin/maintenance/phantom-bets/${PHANTOM_LOST_BET_ID}/reopen`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.clawback, 0);
    const { getUserById } = await import('../src/db/users.js');
    assert.equal(getUserById(LOST_USER_ID).balance, 1000);
  });

  it('reopening a second time 404s/409s since the bet is no longer phantom-settled', async () => {
    const res = await fetchApi(`/api/admin/maintenance/phantom-bets/${PHANTOM_WON_BET_ID}/reopen`, { method: 'POST' });
    assert.equal(res.status, 409);
  });

  it('floors the clawback at the user balance and reports the shortfall instead of going negative', async () => {
    const res = await fetchApi(`/api/admin/maintenance/phantom-bets/${PHANTOM_SPENT_BET_ID}/reopen`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.creditPaid, 100);
    assert.equal(body.clawback, 5); // only had 5 left
    assert.equal(body.shortfall, 95);
    assert.equal(body.balanceAfter, 0);

    const { getUserById } = await import('../src/db/users.js');
    assert.equal(getUserById(SPENT_USER_ID).balance, 0);
  });

  it('404s for an unknown bet id', async () => {
    const res = await fetchApi(`/api/admin/maintenance/phantom-bets/no-such-bet-${stamp}/reopen`, { method: 'POST' });
    assert.equal(res.status, 404);
  });
});
