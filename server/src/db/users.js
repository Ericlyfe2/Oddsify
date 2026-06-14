import { createStore } from './store.js';

const users = createStore('users', {});

export const getUserById = (id) => (id ? users.get(id.toLowerCase()) : null);

export function findByEmail(email) {
  if (!email) return null;
  return users.get(String(email).toLowerCase().replace(/\s+/g, ''));
}

export function findByGoogleId(googleId) {
  if (!googleId) return null;
  return users.list().find((u) => u.googleId === googleId);
}

export function createUser(record) {
  const id = String(record.email || record.id || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!id) throw new Error('user requires email');
  if (users.get(id)) throw new Error('user already exists');
  const now = new Date().toISOString();
  const user = {
    id,
    email: id,
    displayName: record.displayName || id,
    role: record.role || 'user',
    balance: typeof record.balance === 'number' ? record.balance : 0,
    currency: 'GHS',
    country: record.country || null,
    totalDeposited: 0,
    createdAt: now,
    updatedAt: now,
    emailVerified: !!record.emailVerified,
    suspended: false,
    // Identity/deposit verification is always manual — every account starts
    // unverified and only an admin can flip these via the admin user drawer.
    kycStatus: 'unverified',
    passwordHash: record.passwordHash || null,
    googleId: record.googleId || null,
    picture: record.picture || null,
    twoFactorEnabled: false,
    verified: false,
    verifiedAt: null,
    verifiedBy: null,
    verificationHistory: [],
    activity: [],
  };
  users.set(id, user);
  return user;
}

export function updateUser(id, patch) {
  const key = String(id).toLowerCase();
  const current = users.get(key);
  if (!current) return null;
  return users.update(key, (u) => ({ ...u, ...patch, updatedAt: new Date().toISOString() }));
}

export function logActivity(id, entry) {
  const key = String(id).toLowerCase();
  const u = users.get(key);
  if (!u) return;
  const next = [{ at: new Date().toISOString(), ...entry }, ...(u.activity || [])].slice(0, 50);
  users.update(key, (cur) => ({ ...cur, activity: next, updatedAt: new Date().toISOString() }));
}

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, googleId, activity, ...safe } = u;
  return safe;
}

export function deleteUser(id) {
  if (!id) return null;
  const key = String(id).toLowerCase();
  const u = users.get(key);
  if (!u) return null;
  users.delete(key);
  return u;
}

export const allUsers = () => users.list();
