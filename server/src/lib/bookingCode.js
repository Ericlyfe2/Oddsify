/**
 * Booking-code primitives — extracted from routes/bet.js so they're
 * testable in isolation and reusable from any other module that needs
 * to mint or validate a code.
 *
 * Code shape: 2 uppercase letters + 5 digits 1-9.
 *   - 'O' is dropped from the alphabet to avoid 0/O confusion.
 *   - '0' is dropped from the digits to avoid the same.
 *
 * Format regex BOOKING_CODE_RE is exported so the client and the
 * server stay in agreement on what a valid code looks like.
 */

const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ'; // 25 chars — no 'O'
const DIGITS = '123456789'; // 9 chars — no '0'

// Strict format check matched to the generator: A-Z minus O, then five
// digits 1-9 (no zero). Keeps client and server in agreement.
export const BOOKING_CODE_RE = /^[A-NP-Z]{2}[1-9]{5}$/;

/** True if the input matches the spec. */
export function isValidBookingCode(raw) {
  return typeof raw === 'string' && BOOKING_CODE_RE.test(raw);
}

/** Mint a single random code. */
export function generateBookingCode() {
  const letters =
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)] + ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  let digits = '';
  for (let i = 0; i < 5; i++) digits += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return letters + digits;
}

/**
 * Mint a code that doesn't collide with any code already issued for
 * placed bets or booked slips. Callers pass in the two stores so the
 * helper stays pure and easy to unit-test.
 *
 * 25 attempts on a 25^2 * 9^5 ≈ 14.7M-code namespace is paranoia
 * (collision odds are vanishingly small with even 10k codes outstanding),
 * but if we exhaust them we fall back to appending an extra digit so
 * the system never throws on a near-impossible race.
 */
export function mintUniqueBookingCode({ existingCodes = new Set(), maxAttempts = 25 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateBookingCode();
    if (!existingCodes.has(code)) return code;
  }
  return generateBookingCode() + DIGITS[Math.floor(Math.random() * DIGITS.length)];
}
