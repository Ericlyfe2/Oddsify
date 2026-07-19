/**
 * Integration test for the new admin "delete all transactions" endpoint —
 * DELETE /api/admin/users/:id/transactions. Verifies it wipes the target
 * user's transaction ledger without touching their balance, leaves other
 * users' ledgers untouched, is gated to finance_admin+, and 404s for an
 * unknown user.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/middleware/error.js';
import { signAdminAccessToken } from '../src/services/token.js';

const stamp = Date.now();
const TARGET_USER_ID = `tx-delete-target-${stamp}@test.local`;
const OTHER_USER_ID = `tx-delete-other-${stamp}@test.local`;
const FINANCE_ADMIN_ID = `tx-delete-finance-admin-${stamp}@test.local`;
const MODERATOR_ADMIN_ID = `tx-delete-moderator-${stamp}@test.local`;

async function createTestApp() {
  const app = express();
  app.use(express.json());

  const { createUser, getUserById, updateUser } = await import('../src/db/users.js');
  const { createStore } = await import('../src/db/store.js');
  const { default: adminUsersRouter } = await import('../src/routes/admin/users.js');

  for (const id of [TARGET_USER_ID, OTHER_USER_ID]) {
    if (!getUserById(id)) {
      createUser({ id, email: id, displayName: 'Tx Delete Test Player', passwordHash: 'x', balance: 1000, role: 'user' });
    }
    updateUser(id, { balance: 1000, blocked: false });
  }
  if (!getUserById(FINANCE_ADMIN_ID)) {
    createUser({ id: FINANCE_ADMIN_ID, email: FINANCE_ADMIN_ID, displayName: 'Finance Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(FINANCE_ADMIN_ID, { role: 'admin', adminRole: 'finance_admin', suspended: false });

  if (!getUserById(MODERATOR_ADMIN_ID)) {
    createUser({ id: MODERATOR_ADMIN_ID, email: MODERATOR_ADMIN_ID, displayName: 'Moderator Admin', passwordHash: 'x', role: 'admin' });
  }
  updateUser(MODERATOR_ADMIN_ID, { role: 'admin', adminRole: 'moderator', suspended: false });

  // Seed transaction history directly in the same store the route reads,
  // mirroring the shape pushTx() writes elsewhere in the app.
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

describe('Admin: delete all transactions', () => {
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

  it('a moderator (not finance_admin) is rejected', async () => {
    const res = await fetchApi(
      `/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`,
      { method: 'DELETE' },
      moderatorToken,
    );
    assert.equal(res.status, 403);
  });

  it('404s for an unknown user id', async () => {
    const res = await fetchApi(`/api/admin/users/no-such-user-${stamp}/transactions`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });

  it('the target user has transactions before deletion', async () => {
    const res = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`, {}, financeToken);
    const body = await res.json();
    assert.equal(body.transactions.length, 2);
  });

  it('finance_admin deletes all of the target user\'s transactions', async () => {
    const res = await fetchApi(
      `/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`,
      { method: 'DELETE' },
      financeToken,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.deletedCount, 2);
  });

  it('the target user now has zero transactions', async () => {
    const res = await fetchApi(`/api/admin/users/${encodeURIComponent(TARGET_USER_ID)}/transactions`, {}, financeToken);
    const body = await res.json();
    assert.deepEqual(body.transactions, []);
  });

  it('does not affect balance', async () => {
    const { getUserById } = await import('../src/db/users.js');
    const user = getUserById(TARGET_USER_ID);
    assert.equal(user.balance, 1000);
  });

  it('does not touch a different user\'s transaction ledger', async () => {
    const res = await fetchApi(`/api/admin/users/${encodeURIComponent(OTHER_USER_ID)}/transactions`, {}, financeToken);
    const body = await res.json();
    assert.equal(body.transactions.length, 1);
  });
});
