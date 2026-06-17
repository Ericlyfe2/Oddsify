/**
 * Leagues store — canonical league records with deduplication.
 *
 * A League belongs to a Sport and a Country. UNIQUE constraint at the
 * application layer: (sportId, country, normalizedName).
 */
import crypto from 'crypto';
import { createStore } from './store.js';
import { normalize, dedupeHash } from '../utils/dudupe.js';

const store = createStore('leagues_catalog', {});

export function listLeagues(opts = {}) {
  let all = Object.values(store.all() || {});
  if (opts.sportId) all = all.filter((l) => l.sportId === opts.sportId);
  if (opts.status) all = all.filter((l) => l.status === opts.status);
  if (opts.search) {
    const q = String(opts.search).toLowerCase();
    all = all.filter((l) => l.name.toLowerCase().includes(q));
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export function getLeague(id) {
  return store.get(id) || null;
}

export function findLeague(name, sportId, country) {
  const norm = normalize(name);
  return listLeagues({ sportId }).find(
    (l) => normalize(l.name) === norm && (l.country || '') === (country || ''),
  );
}

export function checkDuplicate(name, sportId, country) {
  const existing = findLeague(name, sportId, country || '');
  if (existing) {
    return {
      error: 'DUPLICATE_LEAGUE',
      message: 'This league already exists.',
      existingId: existing.id,
    };
  }
  return null;
}

export function createLeague(input) {
  const dup = checkDuplicate(input.name, input.sportId, input.country);
  if (dup) throw Object.assign(new Error(dup.message), { status: 409, body: dup });

  const id = `league-${crypto.randomBytes(4).toString('hex')}`;
  const normalizedName = normalize(input.name);
  const slug = normalizedName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const rec = {
    id,
    name: String(input.name).trim(),
    slug,
    normalizedName,
    sportId: input.sportId,
    country: input.country || '',
    logo: input.logo || '',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}

export function updateLeague(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;
  // If name changed, re-check duplicates (exclude self)
  if (patch.name && normalize(patch.name) !== cur.normalizedName) {
    const dup = checkDuplicate(patch.name, patch.sportId || cur.sportId, patch.country || cur.country);
    if (dup && dup.existingId !== id) throw Object.assign(new Error(dup.message), { status: 409, body: dup });
  }
  const next = {
    ...cur,
    ...patch,
    normalizedName: patch.name ? normalize(patch.name) : cur.normalizedName,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, next);
  return next;
}

export function archiveLeague(id) {
  return updateLeague(id, { status: 'archived' });
}

export function restoreLeague(id) {
  return updateLeague(id, { status: 'active' });
}
