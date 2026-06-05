/**
 * Ensure a baseline of admin accounts exists on boot.
 *
 * In production the seed runs ONLY when the user store has zero admins.
 * Passwords are generated from env vars or randomly for each account
 * and printed once to the log — change them via the admin UI immediately.
 */
import crypto from 'node:crypto';
import { allUsers, createUser, findByEmail, updateUser } from './users.js';
import { hashPassword } from '../services/password.js';
import { log } from '../utils/logger.js';

const env = process.env;

function generatePassword() {
  return crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '').slice(0, 20) + '!Aa1';
}

const DEFAULTS = [
  {
    email: (env.ADMIN_EMAIL || 'admin@oddsify.gh').toLowerCase(),
    password: env.ADMIN_PASSWORD || generatePassword(),
    displayName: 'Platform Owner',
    adminRole: 'super_admin',
  },
  {
    email: 'finance@oddsify.gh',
    password: env.FINANCE_ADMIN_PASSWORD || generatePassword(),
    displayName: 'Finance Lead',
    adminRole: 'finance_admin',
  },
  {
    email: 'odds@oddsify.gh',
    password: env.ODDS_ADMIN_PASSWORD || generatePassword(),
    displayName: 'Trading Desk',
    adminRole: 'odds_manager',
  },
  {
    email: 'support@oddsify.gh',
    password: env.SUPPORT_ADMIN_PASSWORD || generatePassword(),
    displayName: 'Support Agent',
    adminRole: 'support',
  },
  {
    email: 'mod@oddsify.gh',
    password: env.MOD_ADMIN_PASSWORD || generatePassword(),
    displayName: 'Risk Moderator',
    adminRole: 'moderator',
  },
];

function redact(pw) {
  if (!pw || pw.length < 6) return '****';
  return pw.slice(0, 2) + '****' + pw.slice(-2);
}

export async function seedAdmins() {
  const existing = allUsers().filter((u) => u.role === 'admin');
  if (existing.length > 0) return existing.length;

  let created = 0;
  const seeded = [];
  for (const spec of DEFAULTS) {
    const passwordHash = await hashPassword(spec.password);
    const present = findByEmail(spec.email);
    if (present) {
      updateUser(present.id, {
        role: 'admin',
        adminRole: spec.adminRole,
        emailVerified: true,
        passwordHash,
        displayName: spec.displayName,
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
    seeded.push({ email: spec.email, role: spec.adminRole, password: spec.password });
    created++;
  }

  for (const a of seeded) {
    log.security(
      `Admin account created — email: ${a.email} / role: ${a.role} / password: ${redact(a.password)}  (change immediately)`,
    );
  }
  return created;
}
