/**
 * Promotions store. CRUD-able from the admin UI; the storefront's
 * /api/bet/promos endpoint reads here first and falls back to the static
 * PROMOTIONS list if the store is empty.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const store = createStore('promotions', {});

export function listPromotions() {
  return Object.values(store.all() || {}).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt < b.createdAt ? 1 : -1),
  );
}
export function listActivePromotions() {
  return listPromotions().filter((p) => p.active);
}
export function getPromotion(id) {
  return store.get(id) || null;
}
export function createPromotion(input) {
  const id = `pr-${crypto.randomBytes(4).toString('hex')}`;
  const rec = {
    id,
    title: input.title,
    body: input.body || '',
    badge: input.badge || 'OFFER',
    cta: input.cta || 'Opt in',
    accent: input.accent || '#7c5cff',
    image: input.image || '',
    eligibility: input.eligibility || 'all',
    minDeposit: input.minDeposit ?? 0,
    bonusRate: input.bonusRate ?? 0,
    capPerUser: input.capPerUser ?? null,
    active: input.active ?? true,
    order: input.order ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}
export function updatePromotion(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return next;
}
export function deletePromotion(id) {
  if (!store.get(id)) return false;
  store.delete(id);
  return true;
}
export function seedPromotionsIfEmpty(defaults) {
  if (Object.keys(store.all() || {}).length > 0) return 0;
  let n = 0;
  for (const d of defaults || []) {
    createPromotion(d);
    n++;
  }
  return n;
}
