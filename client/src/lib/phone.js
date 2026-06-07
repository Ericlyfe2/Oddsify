/**
 * E.164 phone number validation. Mirror of server/src/lib/phone.js — the
 * two files MUST stay in sync. The server is authoritative (it rejects
 * non-E.164 even if the client is bypassed), but the client uses the
 * same rules so the UX errors match exactly what the API would return.
 *
 * Validation order (priority: first match wins):
 *   1. empty
 *   2. spaces
 *   3. dashes
 *   4. special characters (brackets, symbols)
 *   5. missing '+'
 *   6. letters after '+'
 *   7. other non-digit chars after '+'
 *   8. too short (less than 8 digits)
 *   9. too long (more than 15 digits)
 */
const E164_RE = /^\+\d{8,15}$/;

export const E164_PLACEHOLDER = '+233596651140';
export const E164_HINT = 'Enter your phone number in international format. Example: +233596651140';
const PHONE_PLACEHOLDER = '+233596651140 or you@email.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizePhone(raw) {
  return String(raw ?? '').replace(/[\s\-()]/g, '');
}

export function isValidPhone(raw) {
  return E164_RE.test(sanitizePhone(raw));
}

export function validatePhone(raw, { allowEmpty = false } = {}) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return allowEmpty ? null : { code: 'empty', message: 'Phone number is required.' };
  }
  if (/\s/.test(trimmed)) {
    return { code: 'has_spaces', message: 'Spaces are not allowed. Use format: +233596651140' };
  }
  if (/-/.test(trimmed)) {
    return { code: 'has_dashes', message: 'Dashes are not allowed. Use format: +233596651140' };
  }
  if (/[()]/.test(trimmed)) {
    return {
      code: 'has_special',
      message: "Special characters are not allowed. Use only '+' followed by numbers.",
    };
  }
  if (!trimmed.startsWith('+')) {
    return {
      code: 'missing_plus',
      message: "Phone number must start with a '+' sign. Example: +233596651140",
    };
  }
  const body = trimmed.slice(1);
  if (/[a-zA-Z]/.test(body)) {
    return {
      code: 'has_letters',
      message: "Phone number can only contain numbers after the '+' sign.",
    };
  }
  if (/[^\d]/.test(body)) {
    return {
      code: 'has_special',
      message: "Special characters are not allowed. Use only '+' followed by numbers.",
    };
  }
  if (body.length < 8) {
    return {
      code: 'too_short',
      message: 'Phone number is too short. Please enter a valid international phone number.',
    };
  }
  if (body.length > 15) {
    return {
      code: 'too_long',
      message: 'Phone number is too long. Please enter a valid international phone number.',
    };
  }
  return null;
}

export function parseIdentifier(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { error: { code: 'empty', message: 'Enter your phone or email.' } };
  }
  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    if (!EMAIL_RE.test(lower)) {
      return { error: { code: 'invalid_email', message: 'Enter a valid email address.' } };
    }
    return { kind: 'email', value: lower };
  }
  // Sanitize before validation so common paste artifacts (spaces, dashes,
  // brackets) are handled silently — validatePhone then catches what's left.
  const sanitized = sanitizePhone(trimmed);
  const phoneErr = validatePhone(sanitized);
  if (phoneErr) return { error: phoneErr };
  return { kind: 'phone', value: sanitized };
}

/**
 * onChange helper for phone-only inputs: returns the value the input should display.
 * Strips spaces/dashes/parens on every keystroke so the user sees a clean
 * field, and clamps the body to 15 digits + leading '+' so an over-long
 * paste can't end up in state at all.
 */
export function autoFormatPhoneInput(raw) {
  let v = String(raw ?? '').replace(/[\s\-()]/g, '');
  if (v.startsWith('+')) {
    v = '+' + v.slice(1).replace(/\+/g, '');
  } else {
    v = v.replace(/\+/g, '');
  }
  if (v.startsWith('+') && v.length > 16) v = v.slice(0, 16);
  if (!v.startsWith('+') && v.length > 15) v = v.slice(0, 15);
  return v;
}

/**
 * onChange helper for dual-purpose "phone or email" inputs.
 * Applies phone auto-format only when value doesn't look like an email.
 * Returns { value, error } where error is null or the validation result.
 */
export function formatAndValidateIdentifier(raw) {
  const trimmed = String(raw ?? '').trim();
  const isEmail = trimmed.includes('@');
  const value = isEmail ? trimmed : autoFormatPhoneInput(trimmed);
  const result = parseIdentifier(value);
  return { value, error: result.error ?? null };
}
