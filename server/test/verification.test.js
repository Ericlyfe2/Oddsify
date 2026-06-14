/**
 * Verification defaults — the "verification is fully manual" guarantee at
 * the account level: every new account starts unverified, and each user
 * gets a real, stable referral code.
 *
 * The boot-time backfill (db/backfillVerification.js) is intentionally not
 * exercised here: it sweeps the entire users store, which in the file-backed
 * test environment is the shared dev data set.
 */
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createUser, getUserById, updateUser, deleteUser } from '../src/db/users.js';
import { createStore } from '../src/db/store.js';
import { ensureReferralCode, REFERRAL_CODE_RE } from '../src/services/referrals.js';
import { STAGE_PROMOTE_THRESHOLD } from '../src/routes/wallet.js';

const stamp = Date.now();
const PLAYER = `verif-player-${stamp}@test.local`;
const TRIGGER_PLAYER = `verif-trigger-${stamp}@test.local`;
const SMALL_PLAYER = `verif-small-${stamp}@test.local`;

const codesStore = createStore('referralCodes', {});

after(() => {
  for (const id of [PLAYER, TRIGGER_PLAYER, SMALL_PLAYER]) {
    const u = getUserById(id);
    if (u?.referralCode) codesStore.delete(u.referralCode);
    deleteUser(id);
  }
});

// Mirrors the auto-trigger in routes/admin/deposits.js so the contract is
// pinned without spinning the full Express app + admin auth in tests.
function simulateApprovedDeposit(userId, amount) {
  const user = getUserById(userId);
  const patch = {
    balance: Number((user.balance + amount).toFixed(2)),
    totalDeposited: Number((Number(user.totalDeposited || 0) + amount).toFixed(2)),
  };
  const prevStage = user.stage == null ? null : Number(user.stage);
  if (prevStage == null && amount >= STAGE_PROMOTE_THRESHOLD) {
    patch.stage = 0;
    patch.stageUpdatedAt = new Date().toISOString();
    patch.stageUpdatedBy = 'system:deposit_trigger';
  }
  return updateUser(userId, patch);
}

describe('new account verification defaults', () => {
  test('createUser starts unverified and stage-neutral', () => {
    const u = createUser({ email: PLAYER, displayName: 'Ama Player', emailVerified: true });
    assert.equal(u.verified, false, 'verified should default to false');
    assert.equal(u.kycStatus, 'unverified', 'kycStatus should default to unverified');
    assert.equal(u.verifiedAt, null);
    assert.equal(u.verifiedBy, null);
    assert.equal(u.stage, null, 'fresh users must be stage-neutral (stage === null)');
  });

  test('ensureReferralCode mints a real, valid, stable code', () => {
    const code = ensureReferralCode(PLAYER);
    assert.match(code, REFERRAL_CODE_RE, 'code should match the referral pattern');
    assert.equal(ensureReferralCode(PLAYER), code, 'second call returns the same code');
    assert.equal(getUserById(PLAYER).referralCode, code, 'code is persisted on the user');
  });
});

describe('stage auto-trigger from approved deposits', () => {
  test('deposit ≥ GHS 1,000 auto-moves a neutral user to Stage 0 (In review)', () => {
    const u = createUser({ email: TRIGGER_PLAYER, displayName: 'Auto Trigger', emailVerified: true });
    assert.equal(u.stage, null, 'pre-condition: neutral on creation');
    const after_ = simulateApprovedDeposit(TRIGGER_PLAYER, STAGE_PROMOTE_THRESHOLD);
    assert.equal(after_.stage, 0, 'crossing the threshold lands the user at Stage 0');
    assert.equal(after_.stageUpdatedBy, 'system:deposit_trigger', 'attribution marks the transition as automatic');
    assert.ok(after_.stageUpdatedAt, 'timestamp recorded');
  });

  test('deposit below threshold leaves the user stage-neutral', () => {
    const u = createUser({ email: SMALL_PLAYER, displayName: 'Small Deposit', emailVerified: true });
    assert.equal(u.stage, null);
    const after_ = simulateApprovedDeposit(SMALL_PLAYER, STAGE_PROMOTE_THRESHOLD - 1);
    assert.equal(after_.stage, null, 'sub-threshold deposits never promote');
  });

  test('once at Stage 0, further deposits do not auto-advance', () => {
    const before = getUserById(TRIGGER_PLAYER);
    assert.equal(before.stage, 0);
    const after_ = simulateApprovedDeposit(TRIGGER_PLAYER, STAGE_PROMOTE_THRESHOLD * 5);
    assert.equal(after_.stage, 0, 'Stage 0 → 1 must be a manual admin promotion');
  });

  test('admin can demote a Stage 0 user back to Neutral', () => {
    // Mirrors the patch the admin route writes when stage === null.
    const reset = updateUser(TRIGGER_PLAYER, {
      stage: null,
      stageUpdatedAt: new Date().toISOString(),
      stageUpdatedBy: 'admin@test',
    });
    assert.equal(reset.stage, null, 'admin demotion lands the user back at Neutral');
    assert.equal(reset.stageUpdatedBy, 'admin@test', 'attribution is recorded');
  });
});
