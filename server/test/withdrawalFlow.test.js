/**
 * Withdrawal flow integration tests — verifies that a withdrawal request
 * holds the user's funds and lands as 'pending' (not instantly completed),
 * and that the admin approve/reject endpoints settle it correctly:
 * approve just marks it completed (funds already held), reject refunds the
 * held amount back to the user's balance.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/middleware/error.js';
import { signAccessToken, signAdminAccessToken } from '../src/services/token.js';

const stamp = Date.now();
const TEST_USER_ID = `withdraw-flow-${stamp}@test.local`;
const TEST_ADMIN_ID = `withdraw-admin-${stamp}@test.local`;

async function createTestApp() {
  const app = express();
  app.use(express.json());

  const { createUser, getUserById, updateUser } = await import('../src/db/users.js');
  const { default: walletRouter } = await import('../src/routes/wallet.js');
  const { default: adminWithdrawalsRouter } = await import('../src/routes/admin/withdrawals.js');
  const { requireAuth } = await import('../src/middleware/auth.js');

  // createUser hardcodes totalDeposited: 0 and stage: null regardless of the
  // input record, so those have to be set via a follow-up updateUser call
  // either way.
  if (!getUserById(TEST_USER_ID)) {
    createUser({
      id: TEST_USER_ID,
      email: TEST_USER_ID,
      displayName: 'Withdraw Test Player',
      passwordHash: 'x',
      balance: 5000,
      role: 'user',
    });
  }
  // Stage 1 (not 2/3/4) keeps the withdrawal minimum at the flat base
  // (GHS 550) instead of the escalated stage-gated minimums.
  updateUser(TEST_USER_ID, { balance: 5000, totalDeposited: 5000, stage: 1, blocked: false });

  if (!getUserById(TEST_ADMIN_ID)) {
    createUser({
      id: TEST_ADMIN_ID,
      email: TEST_ADMIN_ID,
      displayName: 'Finance Admin',
      passwordHash: 'x',
      role: 'admin',
    });
  }
  // createUser's fixed field list drops adminRole entirely — set it after.
  updateUser(TEST_ADMIN_ID, { role: 'admin', adminRole: 'finance_admin', suspended: false });

  app.use('/api', requireAuth, walletRouter);
  app.use('/api/admin/withdrawals', adminWithdrawalsRouter);
  app.use(errorHandler);
  return app;
}

describe('Withdrawal flow integration', () => {
  let app;
  let server;
  let base;
  let userToken;
  let adminToken;

  before(async () => {
    app = await createTestApp();
    const { getUserById } = await import('../src/db/users.js');
    userToken = signAccessToken(getUserById(TEST_USER_ID));
    adminToken = signAdminAccessToken(getUserById(TEST_ADMIN_ID));
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

  function fetchApi(path, opts = {}, token = userToken) {
    const { headers: extraHeaders, ...rest } = opts;
    return fetch(`${base}${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extraHeaders },
    });
  }

  it('submitting a withdrawal holds the balance and creates a pending transaction', async () => {
    const res = await fetchApi('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: 1000, method: 'momo' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.transaction.status, 'pending');
    assert.equal(body.transaction.kind, 'withdraw');
    assert.equal(body.account.balance, 4000); // 5000 - 1000, held immediately
  });

  it('the pending withdrawal shows up in the admin pending list', async () => {
    const res = await fetchApi('/api/admin/withdrawals/pending', {}, adminToken);
    assert.equal(res.status, 200);
    const body = await res.json();
    const mine = body.pending.filter((p) => p.userId === TEST_USER_ID);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].amount, 1000);
    assert.equal(mine[0].user.email, TEST_USER_ID);
  });

  it('rejecting a pending withdrawal refunds the held amount', async () => {
    const listRes = await fetchApi('/api/admin/withdrawals/pending', {}, adminToken);
    const { pending } = await listRes.json();
    const tx = pending.find((p) => p.userId === TEST_USER_ID);
    assert.ok(tx);

    const res = await fetchApi(
      `/api/admin/withdrawals/${tx.id}/reject`,
      { method: 'POST', body: JSON.stringify({ reason: 'test rejection' }) },
      adminToken,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.transaction.status, 'rejected');

    const { getUserById } = await import('../src/db/users.js');
    const user = getUserById(TEST_USER_ID);
    assert.equal(user.balance, 5000); // refunded back to original balance
  });

  it('approving a pending withdrawal marks it completed without touching balance', async () => {
    const before = await fetchApi('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: 750, method: 'momo' }),
    });
    const beforeBody = await before.json();
    assert.equal(beforeBody.account.balance, 4250); // 5000 - 750

    const listRes = await fetchApi('/api/admin/withdrawals/pending', {}, adminToken);
    const { pending } = await listRes.json();
    const tx = pending.find((p) => p.userId === TEST_USER_ID && p.amount === 750);
    assert.ok(tx);

    const res = await fetchApi(`/api/admin/withdrawals/${tx.id}/approve`, { method: 'POST' }, adminToken);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.transaction.status, 'completed');

    const { getUserById } = await import('../src/db/users.js');
    const user = getUserById(TEST_USER_ID);
    assert.equal(user.balance, 4250); // unchanged by approval — already held
  });

  it('rejects approving a withdrawal that is not pending', async () => {
    const listRes = await fetchApi('/api/admin/withdrawals/pending', {}, adminToken);
    const { pending } = await listRes.json();
    // The 750 withdrawal was already approved above, so it's gone from pending.
    const stillThere = pending.find((p) => p.amount === 750);
    assert.equal(stillThere, undefined);
  });

  it('withdrawal below the minimum is rejected before any balance change', async () => {
    const res = await fetchApi('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: 1, method: 'momo' }),
    });
    assert.equal(res.status, 400);
  });

  it('withdrawal exceeding balance is rejected', async () => {
    const res = await fetchApi('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: 999999, method: 'momo' }),
    });
    assert.equal(res.status, 400);
  });
});
