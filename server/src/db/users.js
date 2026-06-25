import { createStore } from './store.js';
import { normalizePhone, isE164, detectCountryFromPhone } from '../lib/phone.js';
import { log } from '../utils/logger.js';

const users = createStore('users', {});

export const getUserById = (id) => (id ? users.get(id.toLowerCase()) : null);

export function findByEmail(email) {
  if (!email) return null;
  return users.get(String(email).toLowerCase().replace(/\s+/g, ''));
}

export function findUserByPhone(phone) {
  if (!phone) return null;
  const normalized = normalizePhone(phone) || phone;
  const key = normalized.toLowerCase().replace(/\s+/g, '');
  const exact = users.get(key);
  if (exact) return exact;
  const all = users.list();
  for (const u of all) {
    const uNorm = normalizePhone(u.email) || u.email;
    if (uNorm.toLowerCase() === normalized.toLowerCase()) return u;
  }
  return null;
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
    kycStatus: 'unverified',
    stage: null,
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

export function migratePhoneNumbers() {
  const migrated = [];
  const all = users.list();
  const normalizedMap = new Map();

  for (const u of all) {
    if (u.email.includes('@')) continue;
    if (isE164(u.email)) continue;

    const detected = detectCountryFromPhone(u.email);
    const country = detected || u.country || 'GH';
    const normalized = normalizePhone(u.email, country);
    if (!normalized || normalized === u.email) continue;

    const existing = normalizedMap.get(normalized);
    if (existing) {
      log.warn(`duplicate phone normalization: "${u.email}" -> "${normalized}" conflicts with "${existing.email}"`);
      continue;
    }

    const newId = normalized.toLowerCase();
    if (users.get(newId)) {
      log.warn(`cannot migrate "${u.email}": normalized key "${newId}" already taken`);
      continue;
    }

    const updated = users.update(u.id, (cur) => ({ ...cur, email: normalized, id: newId }));
    if (updated) {
      users.delete(u.id);
      users.set(newId, updated);
      normalizedMap.set(normalized, updated);
      migrated.push({ from: u.id, to: newId, email: normalized });
    }
  }
  return migrated;
}

export function normalizeUserEmail(rawEmail, country = 'GH') {
  if (!rawEmail) return rawEmail;
  if (rawEmail.includes('@')) return rawEmail.toLowerCase();
  const normalized = normalizePhone(rawEmail, country);
  return normalized || rawEmail;
}
