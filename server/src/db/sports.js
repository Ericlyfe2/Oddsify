/**
 * Sports store — canonical sport definitions.
 *
 * A Sport is the top-level category (e.g. Football, Basketball, Tennis).
 * Leagues, Teams, and MarketTemplates reference a sport by its id.
 *
 * Each sport has a unique `key` (slug) used in API queries.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const store = createStore('sports_catalog', {});

export function listSports() {
  return Object.values(store.all() || {}).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getSport(id) {
  return store.get(id) || null;
}

export function findSportByKey(key) {
  const norm = String(key || '').toLowerCase().trim();
  return listSports().find((s) => s.key === norm) || null;
}

export function createSport(input) {
  const id = `sport-${crypto.randomBytes(4).toString('hex')}`;
  const key = String(input.key || input.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!key) throw new Error('Sport key/name required');
  if (findSportByKey(key)) throw new Error(`Sport "${key}" already exists`);

  const rec = {
    id,
    key,
    name: String(input.name || key),
    icon: input.icon || '',
    active: input.active !== false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}

export function updateSport(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return next;
}

export function archiveSport(id) {
  return updateSport(id, { active: false });
}

export function restoreSport(id) {
  return updateSport(id, { active: true });
}
