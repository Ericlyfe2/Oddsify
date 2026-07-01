import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

/* ── Inline version of the payment gateway store (mirrors db/paymentGateways.js) ── */

const store = {};

const DEFAULT_GATEWAYS = {
  paystack: { enabled: true, isDefault: true, updatedAt: new Date().toISOString(), maintenanceNote: '' },
  paybill: { enabled: true, isDefault: false, updatedAt: new Date().toISOString(), maintenanceNote: '' },
};

function reset() {
  for (const k of Object.keys(store)) delete store[k];
  store.config = JSON.parse(JSON.stringify(DEFAULT_GATEWAYS));
}

function getPaymentGateways() {
  const current = store.config || {};
  return { ...DEFAULT_GATEWAYS, ...current };
}

function getEnabledGateways() {
  const gateways = getPaymentGateways();
  return Object.fromEntries(Object.entries(gateways).filter(([, cfg]) => cfg.enabled));
}

function updatePaymentGateway(key, patch) {
  const current = store.config || {};
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
  store.config = merged;
  return merged;
}

before(() => reset());
after(() => reset());

describe('Payment gateway logic', () => {

  describe('getPaymentGateways', () => {

    it('should return default gateways when no config stored', () => {
      delete store.config;
      const g = getPaymentGateways();
      assert.equal(g.paystack.enabled, true);
      assert.equal(g.paybill.enabled, true);
      assert.equal(g.paystack.isDefault, true);
      assert.equal(g.paybill.isDefault, false);
    });

    it('should return both paystack and paybill gateways', () => {
      reset();
      const g = getPaymentGateways();
      assert.ok(g.paystack);
      assert.ok(g.paybill);
    });

  });

  describe('getEnabledGateways', () => {

    it('should return both gateways when both are enabled', () => {
      reset();
      const g = getEnabledGateways();
      assert.ok(g.paystack);
      assert.ok(g.paybill);
      assert.equal(Object.keys(g).length, 2);
    });

    it('should return only paystack when paybill is disabled', () => {
      reset();
      updatePaymentGateway('paybill', { enabled: false });
      const g = getEnabledGateways();
      assert.ok(g.paystack);
      assert.equal(g.paybill, undefined);
      assert.equal(Object.keys(g).length, 1);
    });

    it('should return only paybill when paystack is disabled', () => {
      reset();
      updatePaymentGateway('paystack', { enabled: false });
      const g = getEnabledGateways();
      assert.ok(g.paybill);
      assert.equal(g.paystack, undefined);
      assert.equal(Object.keys(g).length, 1);
    });

    it('should return empty object when both gateways are disabled', () => {
      reset();
      updatePaymentGateway('paystack', { enabled: false });
      updatePaymentGateway('paybill', { enabled: false });
      const g = getEnabledGateways();
      assert.equal(Object.keys(g).length, 0);
    });

  });

  describe('updatePaymentGateway', () => {

    it('should enable a disabled gateway', () => {
      reset();
      updatePaymentGateway('paystack', { enabled: false });
      assert.equal(getPaymentGateways().paystack.enabled, false);
      updatePaymentGateway('paystack', { enabled: true });
      assert.equal(getPaymentGateways().paystack.enabled, true);
    });

    it('should disable an enabled gateway', () => {
      reset();
      assert.equal(getPaymentGateways().paystack.enabled, true);
      updatePaymentGateway('paystack', { enabled: false });
      assert.equal(getPaymentGateways().paystack.enabled, false);
    });

    it('should set a gateway as default and unset others', () => {
      reset();
      updatePaymentGateway('paybill', { isDefault: true });
      const g = getPaymentGateways();
      assert.equal(g.paybill.isDefault, true);
      assert.equal(g.paystack.isDefault, false);
    });

    it('should update the updatedAt timestamp on change', () => {
      reset();
      const before = getPaymentGateways().paystack.updatedAt;
      updatePaymentGateway('paystack', { enabled: false });
      const after = getPaymentGateways().paystack.updatedAt;
      assert.notEqual(before, after);
    });

    it('should store maintenance note', () => {
      reset();
      updatePaymentGateway('paystack', { maintenanceNote: 'Temporarily down for maintenance' });
      assert.equal(getPaymentGateways().paystack.maintenanceNote, 'Temporarily down for maintenance');
    });

    it('should preserve other gateway settings when updating one gateway', () => {
      reset();
      updatePaymentGateway('paystack', { enabled: false });
      const g = getPaymentGateways();
      assert.equal(g.paystack.enabled, false);
      assert.equal(g.paybill.enabled, true);
    });

  });

  describe('Gateway enable/disable toggle', () => {

    it('should toggle paystack from enabled to disabled and back', () => {
      reset();
      assert.equal(getPaymentGateways().paystack.enabled, true);
      updatePaymentGateway('paystack', { enabled: false });
      assert.equal(getPaymentGateways().paystack.enabled, false);
      updatePaymentGateway('paystack', { enabled: true });
      assert.equal(getPaymentGateways().paystack.enabled, true);
    });

    it('should toggle paybill from enabled to disabled and back', () => {
      reset();
      assert.equal(getPaymentGateways().paybill.enabled, true);
      updatePaymentGateway('paybill', { enabled: false });
      assert.equal(getPaymentGateways().paybill.enabled, false);
      updatePaymentGateway('paybill', { enabled: true });
      assert.equal(getPaymentGateways().paybill.enabled, true);
    });

  });

});
