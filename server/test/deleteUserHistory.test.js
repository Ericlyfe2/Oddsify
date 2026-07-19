/**
 * Integration test for the admin "clear all history" endpoint —
 * DELETE /api/admin/users/:id/history. Verifies it hard-deletes every bet
 * row AND wipes the transaction ledger for the target user, leaves other
 * users untouched, is gated to super_admin only (finance_admin included),
 * and 404s for an unknown user.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/middleware/error.js';
import { signAdminAccessToken } from '../src/services/token.js';

const stamp = Date.now();
const TARGET_USER_ID = `hist-delete-target-${stamp}@test.local`;
const OTHER_USER_ID = `hist-delete-other-${stamp}@test.local`;
const SUPER_ADMIN_ID = `hist-delete-super-admin-${stamp}@test.local`;
const FINANCE_ADMIN_ID = `hist-delete-finance-admin-${stamp}@test.local`;

async function createTestApp() {
  const app = express();
  app.use(express.json());

  const { createUser, getUserById, updateUser } = await import('../src/db/users.js');
  const { createStore } = await import('../src/db/store.js');
  const { default: adminUsersRouter } = await import('../src/routes/admin/users.js');

  for (const id of [TARGET_USER_ID, OTHER_USER_ID]) {
    if (!getUserById(id)) {
      createUser({ id, email: id, displayName: 'Hist Delete Test Player', passwordHash: 'x', balance: 1000, role: 'user' });
    }
    updateUser(id, { balance: 1000, blocked: false });
  }
  if (!getUserById(SUPER_ADMIN_ID)) {
    createUser({ id: SUPER_ADMIN_ID, email: SUPER_ADMIN_ID, displayName: 'Super Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(SUPER_ADMIN_ID, { role: 'admin', adminRole: 'super_admin', suspended: false });

  if (!getUserById(FINANCE_ADMIN_ID)) {
    createUser({ id: FINANCE_ADMIN_ID, email: FINANCE_ADMIN_ID, displayName: 'Finance Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(FINANCE_ADMIN_ID, { role: 'admin', adminRole: 'finance_admin', suspended: false });

  // Seed bets + transactions directly in the same stores the route reads.
  const betsStore = createStore('bets', {});
  betsStore.set(`bet-a-${stamp}`, {
    id: `bet-a-${stamp}`,
    userId: TARGET_USER_ID,
    status: 'open',
    stake: 50,
    potentialWin: 120,
    placedAt: new Date().toISOString(),
  });
  betsStore.set(`bet-b-${stamp}`, {
    id: `bet-b-${stamp}`,
    userId: TARGET_USER_ID,
    status: 'won',
    stake: 20,
    potentialWin: 40,
    placedAt: new Date().toISOString(),
  });
  betsStore.set(`bet-c-${stamp}`, {
    id: `bet-c-${stamp}`,
    userId: OTHER_USER_ID,
    status: 'open',
    stake: 10,
    potentialWin: 15,
    placedAt: new Date().toISOString(),
  });

  const txStore = createStore('transactions', {});
  txStore.set(TARGET_USER_ID, [
    { id: `tx-a-${stamp}`, kind: 'deposit', amount: 500, status: 'completed', at: new Date().toISOString() },
    { id: `tx-b-${stamp}`, kind: 'bet_placed', amount: -300, status: 'completed', at: new Date().toISOString() },
  ]);
  txStore.set(OTHER_USER_ID, [
    { id: `tx-c-${stamp}`, kind: 'deposit', amount: 200, status: 'completed', at: new Date().toISOString() },
  ]);

  app.use('/api/admin/users', adminUsersRouter);
  app.use(errorHandler);
  return app;
}

describe('Admin: clear all history (bets + transactions)', () => {
  let app;
  let server;
  let base;
  let superToken;
  let financeToken;

  before(async () => {
    app = await createTestApp();
    const { getUserById } = await import('../src/db/users.js');
    superToken = signAdminAccessToken(getUserById(SUPER_ADMIN_ID));
    financeToken = signAdminAccessToken(getUserById(FINANCE_ADMIN_ID));
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

  function fetchApi(path, opts = {}, token = superToken) {
    return fetch(`${base}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
  }

  it('a finance_admin (not super_admin) is rejected', async () => {
    const res = await fetchApi(
      `/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/history`,
      { method: 'DELETE' },
      financeToken,
    );
    assert.equal(res.status, 403);
  });

  it('404s for an unknown user id', async () => {
    const res = await fetchApi(`/api/admin/users/no-such-user-${stamp}/history`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });

  it('the target user has bets and transactions before deletion', async () => {
    const betsRes = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/bets`, {}, superToken);
    const betsBody = await betsRes.json();
    assert.equal(betsBody.bets.length, 2);

    const txRes = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`, {}, superToken);
    const txBody = await txRes.json();
    assert.equal(txBody.transactions.length, 2);
  });

  it('super_admin clears all of the target user\'s bets and transactions', async () => {
    const res = await fetchApi(
      `/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/history`,
      { method: 'DELETE' },
      superToken,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.deletedBets, 2);
    assert.equal(body.deletedTx, 2);
  });

  it('the target user now has zero bets and zero transactions', async () => {
    const betsRes = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/bets`, {}, superToken);
    const betsBody = await betsRes.json();
    assert.deepEqual(betsBody.bets, []);

    const txRes = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`, {}, superToken);
    const txBody = await txRes.json();
    assert.deepEqual(txBody.transactions, []);
  });

  it('does not affect balance', async () => {
    const { getUserById } = await import('../src/db/users.js');
    const user = getUserById(TARGET_USER_ID);
    assert.equal(user.balance, 1000);
  });

  it('does not touch a different user\'s bets or transaction ledger', async () => {
    const betsRes = await fetchApi(`/api/admin/users/${encodeURIComponent(OTHER_USER_ID)}/bets`, {}, superToken);
    const betsBody = await betsRes.json();
    assert.equal(betsBody.bets.length, 1);

    const txRes = await fetchApi(`/api/admin/users/${encodeURIComponent(OTHER_USER_ID)}/transactions`, {}, superToken);
    const txBody = await txRes.json();
    assert.equal(txBody.transactions.length, 1);
  });
});
