const E164_RE = /^\+\d{8,15}$/;

export const E164_PLACEHOLDER = '0596651140';
export const E164_HINT = 'Enter phone number. Examples: +233596651140 or 0596651140';
const PHONE_PLACEHOLDER = '+233596651140 or you@email.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRY_TO_DIAL = {
  GH: '+233', NG: '+234', KE: '+254', ZA: '+27',
  TZ: '+255', UG: '+256', CI: '+225', SN: '+221',
  CM: '+237', EG: '+20', MA: '+212', DZ: '+213',
  TN: '+216', ET: '+251', RW: '+250', AO: '+244',
  ZM: '+260', ZW: '+263', BJ: '+229', BF: '+226',
  TG: '+228', NE: '+227', ML: '+223', LR: '+231',
  SL: '+232', GM: '+220', MZ: '+258', NA: '+264',
  BW: '+267', MW: '+265', GB: '+44', US: '+1',
  CA: '+1', IE: '+353', DE: '+49', FR: '+33',
  ES: '+34', PT: '+351', IT: '+39', NL: '+31',
  BE: '+32', CH: '+41', AT: '+43', SE: '+46',
  NO: '+47', DK: '+45', FI: '+358', PL: '+48',
  CZ: '+420', GR: '+30', RO: '+40', BG: '+359',
  HU: '+36', TR: '+90', UA: '+380', AE: '+971',
  SA: '+966', QA: '+974', KW: '+965', BH: '+973',
  OM: '+968', JO: '+962', LB: '+961', IL: '+972',
  IN: '+91', PK: '+92', BD: '+880', LK: '+94',
  CN: '+86', HK: '+852', TW: '+886', JP: '+81',
  KR: '+82', SG: '+65', MY: '+60', TH: '+66',
  VN: '+84', PH: '+63', ID: '+62', AU: '+61',
  NZ: '+64', BR: '+55', AR: '+54', CL: '+56',
  CO: '+57', PE: '+51', MX: '+52', UY: '+598',
  EC: '+593', VE: '+58', JM: '+1876', TT: '+1868',
};

const DIAL_TO_COUNTRY = Object.fromEntries(
  Object.entries(COUNTRY_TO_DIAL).map(([c, d]) => [d.replace('+', ''), c])
);

const COUNTRY_DIAL_ORDER = Object.entries(DIAL_TO_COUNTRY)
  .sort(([a], [b]) => b.length - a.length);

export function cleanPhone(raw) {
  return String(raw ?? '').replace(/[\s\-().+]/g, '');
}

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
  const cleaned = cleanPhone(trimmed);
  if (!cleaned) {
    return { code: 'empty', message: 'Phone number is required.' };
  }
  if (/[a-zA-Z]/.test(cleaned.replace('+', ''))) {
    return { code: 'has_letters', message: 'Phone number can only contain numbers.' };
  }
  if (cleaned.length < 8) {
    return { code: 'too_short', message: 'Phone number is too short.' };
  }
  if (cleaned.length > 15) {
    return { code: 'too_long', message: 'Phone number is too long.' };
  }
  return null;
}

export function normalizePhone(raw, countryCode = 'GH') {
  if (!raw) return null;
  const trimmed = sanitizePhone(String(raw));
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 8) return null;
  if (digitsOnly.length > 15) return null;

  const dial = COUNTRY_TO_DIAL[countryCode] || '+233';
  const dialDigits = dial.replace('+', '');

  if (trimmed.startsWith('+')) {
    const candidate = '+' + digitsOnly;
    if (E164_RE.test(candidate)) return candidate;
    return null;
  }

  if (digitsOnly.startsWith(dialDigits)) {
    const candidate = '+' + digitsOnly;
    if (E164_RE.test(candidate)) return candidate;
  }

  if (digitsOnly.startsWith('0')) {
    const candidate = dial + digitsOnly.slice(1);
    if (E164_RE.test(candidate)) return candidate;
  }

  const candidateWithDial = dial + digitsOnly;
  if (E164_RE.test(candidateWithDial)) return candidateWithDial;

  for (const [dialCode] of COUNTRY_DIAL_ORDER) {
    if (digitsOnly.startsWith(dialCode)) {
      const candidate = '+' + digitsOnly;
      if (E164_RE.test(candidate)) return candidate;
      break;
    }
  }

  return null;
}

export function parseIdentifier(raw, countryCode = 'GH') {
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
  const normalized = normalizePhone(trimmed, countryCode);
  if (!normalized) {
    return { error: { code: 'invalid_phone', message: 'Enter a valid phone number.' } };
  }
  return { kind: 'phone', value: normalized };
}

export function autoFormatPhoneInput(raw) {
  const cleaned = String(raw ?? '').replace(/[\s\-()]/g, '');
  return cleaned;
}

export function formatAndValidateIdentifier(raw, countryCode = 'GH') {
  const trimmed = String(raw ?? '').trim();
  const isEmail = trimmed.includes('@');
  const value = isEmail ? trimmed : autoFormatPhoneInput(trimmed);
  const result = parseIdentifier(value, countryCode);
  return { value, error: result.error ?? null };
}
