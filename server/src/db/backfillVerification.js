/**
 * One-time backfill: reset every non-admin account to "unverified".
 *
 * Verification is fully manual — an admin alone decides who is verified.
 * This migration brings already-registered players in line with that rule
 * by clearing the deposit-verification flag and forcing kycStatus back to
 * 'unverified'. It also lazily mints a referral code for any legacy user
 * that never had one.
 *
 * Runs exactly once: a guard key in the `migrations` store stops it from
 * re-running on later boots, so admin verifications made after this point
 * are never silently reverted on restart. Admin accounts are skipped so the
 * operator is never locked out of their own verified state.
 */
import { createStore } from './store.js';
import { allUsers, updateUser } from './users.js';
import { ensureReferralCode } from '../services/referrals.js';
import { log } from '../utils/logger.js';

const MIGRATION_KEY = 'verification-reset-2026-06';

const isAdmin = (u) => u.role === 'admin' || !!u.adminRole;

export function backfillVerification() {
  const migrations = createStore('migrations', {});
  if (migrations.get(MIGRATION_KEY)) return 0;

  let reset = 0;
  for (const u of allUsers()) {
    ensureReferralCode(u.id);
    if (isAdmin(u)) continue;
    updateUser(u.id, {
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      kycStatus: 'unverified',
    });
    reset += 1;
  }

  migrations.set(MIGRATION_KEY, { at: new Date().toISOString(), reset });
  log.info(`Verification backfill complete — ${reset} non-admin account(s) reset to unverified.`);
  return reset;
}
