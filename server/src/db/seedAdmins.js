/**
 * Ensure exactly one super-admin account exists on every boot.
 *
 * Defaults to admin@oddsify.gh / Admin@12345 — the operator can override
 * either via ADMIN_EMAIL / ADMIN_PASSWORD env vars on Render. The seed
 * re-applies the password hash on every boot so a forgotten or stale
 * password in storage can't lock the operator out. Any password change
 * made through the admin UI is intentionally reverted on the next deploy.
 *
 * Also clears any persistent brute-force lockout for this admin so a
 * restart immediately unblocks a rate-limited operator.
 */
import { allUsers, createUser, findByEmail, updateUser } from './users.js';
import { hashPassword } from '../services/password.js';
import { createStore } from './store.js';
import { log } from '../utils/logger.js';

const env = process.env;

const SUPER_ADMIN = {
  email: (env.ADMIN_EMAIL || 'admin@oddsify.gh').toLowerCase(),
  password: env.ADMIN_PASSWORD || 'Admin@12345',
  displayName: 'Platform Owner',
  adminRole: 'super_admin',
};

function redact(pw) {
  if (!pw || pw.length < 6) return '****';
  return pw.slice(0, 2) + '****' + pw.slice(-2);
}

export async function seedAdmins() {
  const bruteStore = createStore('admin_brute', {});
  const passwordHash = await hashPassword(SUPER_ADMIN.password);
  const present = findByEmail(SUPER_ADMIN.email);

  if (present) {
    updateUser(present.id, {
      role: 'admin',
      adminRole: present.adminRole || SUPER_ADMIN.adminRole,
      emailVerified: true,
      suspended: false,
      passwordHash,
      displayName: present.displayName || SUPER_ADMIN.displayName,
    });
  } else {
    createUser({
      email: SUPER_ADMIN.email,
      displayName: SUPER_ADMIN.displayName,
      passwordHash,
      emailVerified: true,
      role: 'admin',
      balance: 0,
    });
    updateUser(SUPER_ADMIN.email, {
      adminRole: SUPER_ADMIN.adminRole,
      kycStatus: 'verified',
      twoFactorEnabled: false,
    });
  }

  bruteStore.delete(SUPER_ADMIN.email);
  log.security(
    `Super admin ensured — email: ${SUPER_ADMIN.email} / password: ${redact(SUPER_ADMIN.password)}`,
  );
  return 1;
}

// Kept for backwards compatibility with anything that imported the helper.
export function adminCount() {
  return allUsers().filter((u) => u.role === 'admin').length;
}
