/**
 * Admin invite tokens.
 *
 * A super admin issues an invite for { email, adminRole }. The raw token is
 * returned to the issuer once (so they can copy the share URL); only the
 * SHA-256 hash lives in the store so leaked snapshots can't be replayed.
 *
 * Lifecycle: pending -> used | revoked | expired.
 * TTL defaults to 7 days, configurable per-invite.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const store = createStore('admin_invites', {});

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLES = ['super_admin', 'finance_admin', 'odds_manager', 'support', 'moderator'];

export const ADMIN_INVITE_ROLES = ROLES;

function hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safe(invite) {
  if (!invite) return null;
  const { tokenHash, ...rest } = invite;
  const now = Date.now();
  let status = 'pending';
  if (invite.usedAt) status = 'used';
  else if (invite.revokedAt) status = 'revoked';
  else if (new Date(invite.expiresAt).getTime() < now) status = 'expired';
  return { ...rest, status };
}

export function listAdminInvites() {
  return Object.values(store.all() || {})
    .map(safe)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createAdminInvite({ email, adminRole, createdBy, displayName, ttlMs = DEFAULT_TTL_MS }) {
  if (!email) throw new Error('email required');
  if (!ROLES.includes(adminRole)) throw new Error('invalid adminRole');

  const id = `inv-${crypto.randomBytes(4).toString('hex')}`;
  const tokenRandom = crypto.randomBytes(24).toString('base64url');
  const token = `${id}.${tokenRandom}`;

  const now = new Date();
  const rec = {
    id,
    email: String(email).trim().toLowerCase(),
    adminRole,
    displayName: displayName || '',
    createdBy: createdBy || null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    usedAt: null,
    usedBy: null,
    revokedAt: null,
    revokedBy: null,
    tokenHash: hash(token),
  };
  store.set(id, rec);
  return { invite: safe(rec), token };
}

export function getAdminInviteById(id) {
  return safe(store.get(id));
}

export function findInviteByToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [id] = token.split('.');
  const rec = store.get(id);
  if (!rec) return null;
  if (rec.tokenHash !== hash(token)) return null;
  if (rec.usedAt || rec.revokedAt) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  return rec;
}

export function consumeInvite(token, userId) {
  const rec = findInviteByToken(token);
  if (!rec) return null;
  const next = { ...rec, usedAt: new Date().toISOString(), usedBy: userId };
  store.set(rec.id, next);
  return safe(next);
}

export function revokeAdminInvite(id, byAdminId) {
  const rec = store.get(id);
  if (!rec || rec.usedAt || rec.revokedAt) return null;
  const next = { ...rec, revokedAt: new Date().toISOString(), revokedBy: byAdminId };
  store.set(id, next);
  return safe(next);
}
