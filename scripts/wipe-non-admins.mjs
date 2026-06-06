#!/usr/bin/env node
/**
 * One-off cleanup: delete every non-admin user from Neon, plus all of
 * their bets, transactions, refresh tokens, and booked betting slips.
 * The super_admin account (admin@oddsify.gh) and every other `role:admin`
 * row is preserved.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
 *     node scripts/wipe-non-admins.mjs
 *
 * Add --dry-run to count what WOULD be deleted without actually deleting.
 */
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set.');
  console.error('Pull it from Render → oddsify-api → Environment, then re-run.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

async function main() {
  const banner = DRY_RUN ? '=== DRY RUN — nothing will be deleted ===' : '=== WIPE — destructive ===';
  console.log(banner);

  const userRows = await pool.query(
    `SELECT key, data FROM kv_store WHERE store_name = 'users'`,
  );
  const admins = userRows.rows.filter((r) => r.data?.role === 'admin');
  const nonAdmins = userRows.rows.filter((r) => r.data?.role !== 'admin');
  const nonAdminKeys = new Set(nonAdmins.map((r) => r.key));

  console.log(`Users:      ${userRows.rowCount} total · ${admins.length} admin (kept) · ${nonAdmins.length} non-admin (target)`);

  // Cross-reference bets, transactions, refresh tokens that belong to those users.
  const betRows = await pool.query(`SELECT key, data FROM kv_store WHERE store_name = 'bets'`);
  const txRows = await pool.query(`SELECT key, data FROM kv_store WHERE store_name = 'transactions'`);
  const refreshRows = await pool.query(
    `SELECT key, data FROM kv_store WHERE store_name = 'refresh_tokens'`,
  );
  const bookedRows = await pool.query(
    `SELECT key, data FROM kv_store WHERE store_name = 'booked_slips'`,
  );

  const betKeys = betRows.rows.filter((r) => nonAdminKeys.has(r.data?.userId)).map((r) => r.key);
  const txKeys = txRows.rows.filter((r) => nonAdminKeys.has(r.key) || nonAdminKeys.has(r.data?.userId)).map((r) => r.key);
  const refreshKeys = refreshRows.rows
    .filter((r) => nonAdminKeys.has(r.data?.accountId))
    .map((r) => r.key);
  // Booked slips don't tie to a user once created, but they're disposable.
  const bookedKeys = bookedRows.rows.map((r) => r.key);

  console.log(`Bets:       ${betRows.rowCount} total · ${betKeys.length} owned by deleted users (target)`);
  console.log(`Tx rows:    ${txRows.rowCount} total · ${txKeys.length} owned by deleted users (target)`);
  console.log(`Refresh:    ${refreshRows.rowCount} total · ${refreshKeys.length} owned by deleted users (target)`);
  console.log(`Booked:     ${bookedRows.rowCount} total · ${bookedKeys.length} (all dropped — codes are disposable)`);

  if (DRY_RUN) {
    console.log('--- dry run complete, nothing changed ---');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = { users: 0, bets: 0, transactions: 0, refresh: 0, booked: 0 };

    if (nonAdminKeys.size) {
      const r = await client.query(
        `DELETE FROM kv_store WHERE store_name = 'users' AND key = ANY($1::text[])`,
        [[...nonAdminKeys]],
      );
      deleted.users = r.rowCount;
    }
    if (betKeys.length) {
      const r = await client.query(
        `DELETE FROM kv_store WHERE store_name = 'bets' AND key = ANY($1::text[])`,
        [betKeys],
      );
      deleted.bets = r.rowCount;
    }
    if (txKeys.length) {
      const r = await client.query(
        `DELETE FROM kv_store WHERE store_name = 'transactions' AND key = ANY($1::text[])`,
        [txKeys],
      );
      deleted.transactions = r.rowCount;
    }
    if (refreshKeys.length) {
      const r = await client.query(
        `DELETE FROM kv_store WHERE store_name = 'refresh_tokens' AND key = ANY($1::text[])`,
        [refreshKeys],
      );
      deleted.refresh = r.rowCount;
    }
    if (bookedKeys.length) {
      const r = await client.query(
        `DELETE FROM kv_store WHERE store_name = 'booked_slips' AND key = ANY($1::text[])`,
        [bookedKeys],
      );
      deleted.booked = r.rowCount;
    }
    await client.query('COMMIT');

    console.log('--- wipe complete ---');
    console.log(`Deleted: ${deleted.users} users, ${deleted.bets} bets, ${deleted.transactions} tx rows, ${deleted.refresh} refresh tokens, ${deleted.booked} booked slips`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
