/**
 * Ensure the baseline admin accounts exist on every boot.
 *
 * Defaults match the demo credentials shown on the admin login screen
 * (client/src/pages/admin/AdminLogin.jsx) so an operator can sign in
 * with documented creds without having to set ADMIN_*_PASSWORD env vars.
 *
 * To override any account, set the matching ADMIN_*_PASSWORD env var
 * (or ADMIN_EMAIL for the super admin address). The seed re-applies the
 * resulting password hash on every boot so a forgotten or stale
 * password in storage can't lock operators out — operator-driven
 * password changes done through the UI are intentionally reverted on
 * the next deploy.
 *
 * Also clears any persistent brute-force lockouts for the default
 * admin emails so a restart immediately unblocks rate-limited operators.
 */
import { allUsers, createUser, findByEmail, updateUser } from './users.js';
import { hashPassword } from '../services/password.js';
import { createStore } from './store.js';
import { log } from '../utils/logger.js';

const env = process.env;

const DEFAULTS = [
  {
    email: (env.ADMIN_EMAIL || 'admin@oddsify.gh').toLowerCase(),
    password: env.ADMIN_PASSWORD || 'Admin@12345',
    displayName: 'Platform Owner',
    adminRole: 'super_admin',
  },
  {
    email: 'finance@oddsify.gh',
    password: env.FINANCE_ADMIN_PASSWORD || 'Finance@12345',
    displayName: 'Finance Lead',
    adminRole: 'finance_admin',
  },
  {
    email: 'odds@oddsify.gh',
    password: env.ODDS_ADMIN_PASSWORD || 'Odds@12345',
    displayName: 'Trading Desk',
    adminRole: 'odds_manager',
  },
  {
    email: 'support@oddsify.gh',
    password: env.SUPPORT_ADMIN_PASSWORD || 'Support@12345',
    displayName: 'Support Agent',
    adminRole: 'support',
  },
  {
    email: 'mod@oddsify.gh',
    password: env.MOD_ADMIN_PASSWORD || 'Moderator@12345',
    displayName: 'Risk Moderator',
    adminRole: 'moderator',
  },
];

function redact(pw) {
  if (!pw || pw.length < 6) return '****';
  return pw.slice(0, 2) + '****' + pw.slice(-2);
}

export async function seedAdmins() {
  const bruteStore = createStore('admin_brute', {});
  let upserted = 0;

  for (const spec of DEFAULTS) {
    const passwordHash = await hashPassword(spec.password);
    const present = findByEmail(spec.email);

    if (present) {
      updateUser(present.id, {
        role: 'admin',
        adminRole: present.adminRole || spec.adminRole,
        emailVerified: true,
        suspended: false,
        passwordHash,
        displayName: present.displayName || spec.displayName,
      });
    } else {
      createUser({
        email: spec.email,
        displayName: spec.displayName,
        passwordHash,
        emailVerified: true,
        role: 'admin',
        balance: 0,
      });
      updateUser(spec.email, {
        adminRole: spec.adminRole,
        kycStatus: 'verified',
        twoFactorEnabled: false,
      });
    }

    // Clear any persistent brute-force lockout for this admin so a
    // server restart immediately unblocks a rate-limited operator.
    bruteStore.delete(spec.email);

    log.security(
      `Admin ensured — email: ${spec.email} / role: ${spec.adminRole} / password: ${redact(spec.password)}`,
    );
    upserted++;
  }

  return upserted;
}

// Kept for backwards compatibility with anything that imported the helper.
export function adminCount() {
  return allUsers().filter((u) => u.role === 'admin').length;
}
