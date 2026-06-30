import { createStore } from './store.js';

const store = createStore('payment_gateways', {});

const DEFAULT_GATEWAYS = {
  paystack: {
    enabled: true,
    isDefault: true,
    updatedAt: new Date().toISOString(),
    maintenanceNote: '',
  },
  paybill: {
    enabled: true,
    isDefault: false,
    updatedAt: new Date().toISOString(),
    maintenanceNote: '',
  },
};

export function getPaymentGateways() {
  const current = store.get('config') || {};
  return { ...DEFAULT_GATEWAYS, ...current };
}

export function getEnabledGateways() {
  const gateways = getPaymentGateways();
  return Object.fromEntries(
    Object.entries(gateways).filter(([, cfg]) => cfg.enabled),
  );
}

export function updatePaymentGateway(key, patch) {
  const current = store.get('config') || {};
  const merged = {
    ...current,
    [key]: {
      ...(current[key] || DEFAULT_GATEWAYS[key] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
  if (patch.isDefault) {
    for (const k of Object.keys(merged)) {
      if (k !== key) merged[k] = { ...merged[k], isDefault: false };
    }
  }
  store.set('config', merged);
  return merged;
}
