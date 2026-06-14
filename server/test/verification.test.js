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
import { createUser, getUserById, deleteUser } from '../src/db/users.js';
import { createStore } from '../src/db/store.js';
import { ensureReferralCode, REFERRAL_CODE_RE } from '../src/services/referrals.js';

const stamp = Date.now();
const PLAYER = `verif-player-${stamp}@test.local`;

const codesStore = createStore('referralCodes', {});

after(() => {
  const u = getUserById(PLAYER);
  if (u?.referralCode) codesStore.delete(u.referralCode);
  deleteUser(PLAYER);
});

describe('new account verification defaults', () => {
  test('createUser starts unverified', () => {
    const u = createUser({ email: PLAYER, displayName: 'Ama Player', emailVerified: true });
    assert.equal(u.verified, false, 'verified should default to false');
    assert.equal(u.kycStatus, 'unverified', 'kycStatus should default to unverified');
    assert.equal(u.verifiedAt, null);
    assert.equal(u.verifiedBy, null);
  });

  test('ensureReferralCode mints a real, valid, stable code', () => {
    const code = ensureReferralCode(PLAYER);
    assert.match(code, REFERRAL_CODE_RE, 'code should match the referral pattern');
    assert.equal(ensureReferralCode(PLAYER), code, 'second call returns the same code');
    assert.equal(getUserById(PLAYER).referralCode, code, 'code is persisted on the user');
  });
});
