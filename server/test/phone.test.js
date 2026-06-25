import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePhone, isValidPhone, validatePhone, parseIdentifier } from '../src/lib/phone.js';

describe('sanitizePhone', () => {
  test('strips spaces', () => {
    assert.equal(sanitizePhone('+233 596 651 140'), '+233596651140');
  });
  test('strips dashes', () => {
    assert.equal(sanitizePhone('+233-596-651-140'), '+233596651140');
  });
  test('strips brackets', () => {
    assert.equal(sanitizePhone('+233(596)651140'), '+233596651140');
  });
  test('preserves valid E.164', () => {
    assert.equal(sanitizePhone('+233596651140'), '+233596651140');
  });
  test('handles null/undefined', () => {
    assert.equal(sanitizePhone(null), '');
    assert.equal(sanitizePhone(undefined), '');
  });
});

describe('isValidPhone', () => {
  test('valid E.164 returns true', () => {
    assert.equal(isValidPhone('+233596651140'), true);
    assert.equal(isValidPhone('+12025550123'), true);
    assert.equal(isValidPhone('+447911123456'), true);
    assert.equal(isValidPhone('+2348012345678'), true);
  });
  test('missing + returns false', () => {
    assert.equal(isValidPhone('233596651140'), false);
  });
  test('spaces returns true (auto-sanitized)', () => {
    assert.equal(isValidPhone('+233 596 651 140'), true);
  });
  test('too short returns false', () => {
    assert.equal(isValidPhone('+1234567'), false);
  });
  test('too long returns false', () => {
    assert.equal(isValidPhone('+1234567890123456'), false);
  });
  test('empty returns false', () => {
    assert.equal(isValidPhone(''), false);
  });
});

describe('validatePhone', () => {
  test('returns null for valid phone', () => {
    assert.equal(validatePhone('+233596651140'), null);
    assert.equal(validatePhone('+12025550123'), null);
    assert.equal(validatePhone('+447911123456'), null);
    assert.equal(validatePhone('+2348012345678'), null);
  });

  test('accepts number without + prefix', () => {
    assert.equal(validatePhone('233596651140'), null);
  });

  test('accepts local format starting with 0', () => {
    assert.equal(validatePhone('0596651140'), null);
  });

  test('auto-strips spaces', () => {
    assert.equal(validatePhone('+233 596 651 140'), null);
  });

  test('auto-strips dashes', () => {
    assert.equal(validatePhone('+233-596-651-140'), null);
  });

  test('auto-strips brackets', () => {
    assert.equal(validatePhone('+233(596)651140'), null);
  });

  test('detects letters', () => {
    const r = validatePhone('+233abc651140');
    assert.notEqual(r, null);
    assert.equal(r.code, 'has_letters');
  });

  test('accepts number with no prefix (adds country code)', () => {
    assert.equal(validatePhone('596651140'), null);
  });

  test('detects too short', () => {
    const r = validatePhone('+1234567');
    assert.notEqual(r, null);
    assert.equal(r.code, 'too_short');
  });

  test('detects too long', () => {
    const r = validatePhone('+1234567890123456');
    assert.notEqual(r, null);
    assert.equal(r.code, 'too_long');
  });

  test('empty returns error unless allowEmpty', () => {
    assert.notEqual(validatePhone(''), null);
    assert.equal(validatePhone('', { allowEmpty: true }), null);
  });

  test('empty after trimming returns error', () => {
    assert.notEqual(validatePhone('  '), null);
  });
});

describe('parseIdentifier', () => {
  test('parses valid email', () => {
    const r = parseIdentifier('Test@Example.com');
    assert.equal(r.kind, 'email');
    assert.equal(r.value, 'test@example.com');
  });

  test('parses valid phone', () => {
    const r = parseIdentifier('+233596651140');
    assert.equal(r.kind, 'phone');
    assert.equal(r.value, '+233596651140');
  });

  test('sanitizes phone during parse', () => {
    const r = parseIdentifier('+233 596 651 140');
    assert.equal(r.kind, 'phone');
    assert.equal(r.value, '+233596651140');
  });

  test('rejects empty', () => {
    const r = parseIdentifier('');
    assert.notEqual(r, null);
    assert.equal(r.error.code, 'empty');
  });

  test('rejects invalid phone (no digits)', () => {
    const r = parseIdentifier('notanemail');
    assert.notEqual(r.error, undefined);
    assert.equal(r.error.code, 'invalid_phone');
  });

  test('rejects bad email format', () => {
    const r = parseIdentifier('user@');
    assert.notEqual(r.error, undefined);
    assert.equal(r.error.code, 'invalid_email');
  });

  test('rejects phone with letters', () => {
    const r = parseIdentifier('+233abc');
    assert.notEqual(r.error, undefined);
    assert.equal(r.error.code, 'invalid_phone');
  });
});
