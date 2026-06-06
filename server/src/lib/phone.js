/**
 * E.164 phone number validation.
 *
 * E.164 spec: a leading '+' followed by 8 to 15 digits. No spaces, dashes,
 * brackets, or letters. The strictness is intentional — the spec docs in
 * docs/phone-validation.md (mirrored on the client side) require both ends
 * to reject anything non-E.164 so the same number can never end up stored
 * in two formats.
 *
 * Use `sanitizePhone` only to strip whitespace/dashes/parens (common from
 * paste). For everything else, validatePhone surfaces a specific error
 * code so the server response can echo the exact UX message.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip whitespace, dashes, and brackets. Keeps the leading '+'. */
export function sanitizePhone(raw) {
  return String(raw ?? '').replace(/[\s\-()]/g, '');
}

/** True if the input — after sanitization — is a valid E.164 number. */
export function isValidPhone(raw) {
  return E164_RE.test(sanitizePhone(raw));
}

/**
 * Returns null if valid, otherwise { code, message } describing the first
 * failure detected. Codes match the exact UX messages in the spec.
 */
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

/**
 * Dual-purpose validator for "phone or email" fields. Returns:
 *   { kind: 'email', value }  for valid emails
 *   { kind: 'phone', value }  for valid E.164 phones (sanitized)
 *   { error: { code, message } } otherwise
 */
export function parseIdentifier(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { error: { code: 'empty', message: 'Enter your phone or email.' } };
  }
  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    if (!EMAIL_RE.test(lower)) {
      return {
        error: { code: 'invalid_email', message: 'Enter a valid email address.' },
      };
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
