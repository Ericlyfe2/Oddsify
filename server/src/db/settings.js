import { createStore } from './store.js';

const store = createStore('settings', {});

const DEFAULTS = {
  maintenance: false,
  maintenanceMessage: 'Platform is undergoing scheduled maintenance. Please check back shortly.',
  signupsOpen: true,
  defaultOddsSource: 'auto',
  minDeposit: 300,
  minWithdraw: 550,
  maxSingleStake: 1000000,
  maxMultipleStake: 500000,
  maxSystemStake: 250000,
  bonusRate: 0.08,
  referralBonus: 10,
  referralMinDeposit: 100,
  referralWelcomeBonus: 0,
  referralMaxPerDay: 20,
  contactEmail: 'support@betnexa.gh',
  featureJackpot: true,
  featureCasino: true,
  featureVirtuals: true,
  featurePromotions: true,
  featureLiveBetting: true,
};

export function getSettings() {
  const current = store.get('platform') || {};
  return { ...DEFAULTS, ...current };
}

export function updateSettings(patch) {
  const current = store.get('platform') || {};
  const merged = { ...current, ...patch };
  store.set('platform', merged);
  // Apply defaults before returning — same as getSettings() — so the PUT
  // response reflects every feature's real state, not just the keys that
  // happen to be persisted. Without this, saving one toggle made every
  // never-explicitly-set feature flash "OFF" in the admin UI until the next
  // reload re-fetched via getSettings().
  return { ...DEFAULTS, ...merged };
}
