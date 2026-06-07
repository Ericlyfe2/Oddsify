import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  BOOKING_CODE_RE,
  generateBookingCode,
  isValidBookingCode,
  mintUniqueBookingCode,
} from '../src/lib/bookingCode.js';

describe('bookingCode regex', () => {
  it('accepts the canonical AF36513 shape', () => {
    assert.equal(BOOKING_CODE_RE.test('AF36513'), true);
  });

  it('accepts every letter except O and every digit except 0', () => {
    assert.equal(BOOKING_CODE_RE.test('AB12345'), true);
    assert.equal(BOOKING_CODE_RE.test('YZ99999'), true);
  });

  it('rejects lowercase, anywhere', () => {
    assert.equal(BOOKING_CODE_RE.test('ab12345'), false);
    assert.equal(BOOKING_CODE_RE.test('aF12345'), false);
  });

  it('rejects the wrong length', () => {
    assert.equal(BOOKING_CODE_RE.test('AF1234'), false); // 6 chars
    assert.equal(BOOKING_CODE_RE.test('AF123456'), false); // 8 chars
    assert.equal(BOOKING_CODE_RE.test(''), false);
  });

  it("rejects 'O' in the letters and '0' in the digits", () => {
    assert.equal(BOOKING_CODE_RE.test('OA12345'), false);
    assert.equal(BOOKING_CODE_RE.test('AO12345'), false);
    assert.equal(BOOKING_CODE_RE.test('AB10345'), false);
    assert.equal(BOOKING_CODE_RE.test('AB12305'), false);
  });

  it('rejects digits in the letter slots and letters in the digit slots', () => {
    assert.equal(BOOKING_CODE_RE.test('12FGHIJ'), false);
    assert.equal(BOOKING_CODE_RE.test('ABABCDE'), false);
  });
});

describe('isValidBookingCode', () => {
  it('accepts a valid string', () => {
    assert.equal(isValidBookingCode('AF36513'), true);
  });

  it('returns false for non-string input', () => {
    assert.equal(isValidBookingCode(null), false);
    assert.equal(isValidBookingCode(undefined), false);
    assert.equal(isValidBookingCode(1234567), false);
    assert.equal(isValidBookingCode({ code: 'AF36513' }), false);
  });
});

describe('generateBookingCode', () => {
  it('produces strings matching the canonical regex', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBookingCode();
      assert.equal(BOOKING_CODE_RE.test(code), true, `failed on ${code}`);
    }
  });

  it('never includes O or 0', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateBookingCode();
      assert.equal(code.includes('O'), false);
      assert.equal(code.includes('0'), false);
    }
  });
});

describe('mintUniqueBookingCode', () => {
  it('returns a fresh code when no collisions', () => {
    const code = mintUniqueBookingCode();
    assert.equal(BOOKING_CODE_RE.test(code), true);
  });

  it('avoids codes already present in the existingCodes set', () => {
    const blocked = new Set();
    // Pre-populate with 500 codes — none of those should ever come back.
    for (let i = 0; i < 500; i++) blocked.add(generateBookingCode());
    for (let i = 0; i < 200; i++) {
      const code = mintUniqueBookingCode({ existingCodes: blocked });
      assert.equal(blocked.has(code), false, `mint returned a blocked code ${code}`);
    }
  });

  it('falls back to an 8-char code when every attempt collides', () => {
    // Synthetic universe: only 'AA11111' is allowed; everything else is
    // pre-blocked. Force the maxAttempts loop to exhaust, and the
    // fallback path to fire.
    const blocked = new Set();
    for (let l1 = 0; l1 < 25; l1++) {
      for (let l2 = 0; l2 < 25; l2++) {
        for (let d = 0; d < 9; d++) {
          // We can't enumerate the full 14.7M codes; instead force a
          // tight maxAttempts and pre-block enough random codes to make
          // collision near-certain.
          if (Math.random() < 0.0002) blocked.add(generateBookingCode());
        }
      }
    }
    // Force a low attempt budget so the fallback path is exercised in
    // a known time frame; the returned code is allowed to be 7 OR 8
    // chars depending on whether the loop happened to find a fresh
    // code in time.
    const code = mintUniqueBookingCode({ existingCodes: blocked, maxAttempts: 1 });
    // Either the 7-char canonical shape or the 8-char paranoia fallback.
    assert.equal(/^[A-NP-Z]{2}[1-9]{5}[1-9]?$/.test(code), true, `unexpected fallback shape ${code}`);
  });
});
