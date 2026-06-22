/**
 * One-time backfill: set emailVerified=true for every account.
 *
 * Early registration code (pre-rebrand StakePoint) did not pass
 * `emailVerified: true` to `createUser()`, which defaults to false
 * via `!!record.emailVerified`.  The `requireAuth` middleware rejects
 * unverified emails with a 403, blocking deposits and other protected
 * routes on legacy accounts.
 *
 * This migration sets the flag to true for all users (admin + regular)
 * since this app never implemented email verification — the flag
 * existing purely for future use.  It runs exactly once: a guard key
 * in the `migrations` store prevents replay on subsequent boots.
 */
import { createStore } from './store.js';
import { allUsers, updateUser } from './users.js';
import { log } from '../utils/logger.js';

const migrations = createStore('migrations', {});

const MIGRATION_KEY = 'email-verified-backfill-2026-06';

export function backfillEmailVerified() {
  if (migrations.get(MIGRATION_KEY)) return 0;

  let fixed = 0;
  for (const u of allUsers()) {
    if (u.emailVerified) continue;
    updateUser(u.id, { emailVerified: true });
    fixed += 1;
  }

  migrations.set(MIGRATION_KEY, { at: new Date().toISOString(), fixed });
  log.info(`Email-verified backfill complete — ${fixed} account(s) updated to emailVerified=true.`);
  return fixed;
}
