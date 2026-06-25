const E164_RE = /^\+\d{8,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const E164_PLACEHOLDER = '+233596651140';
export const E164_HINT = 'Enter phone number. Examples: +233596651140 or 0596651140';

const DIAL_TO_COUNTRY = {
  '233': 'GH', '234': 'NG', '254': 'KE', '27': 'ZA',
  '255': 'TZ', '256': 'UG', '225': 'CI', '221': 'SN',
  '237': 'CM', '20': 'EG', '212': 'MA', '213': 'DZ',
  '216': 'TN', '251': 'ET', '250': 'RW', '244': 'AO',
  '260': 'ZM', '263': 'ZW', '229': 'BJ', '226': 'BF',
  '228': 'TG', '227': 'NE', '223': 'ML', '231': 'LR',
  '232': 'SL', '220': 'GM', '258': 'MZ', '264': 'NA',
  '267': 'BW', '265': 'MW', '44': 'GB', '1': 'US',
  '353': 'IE', '49': 'DE', '33': 'FR', '34': 'ES',
  '351': 'PT', '39': 'IT', '31': 'NL', '32': 'BE',
  '41': 'CH', '43': 'AT', '46': 'SE', '47': 'NO',
  '45': 'DK', '358': 'FI', '48': 'PL', '420': 'CZ',
  '30': 'GR', '40': 'RO', '359': 'BG', '36': 'HU',
  '90': 'TR', '380': 'UA', '971': 'AE', '966': 'SA',
  '974': 'QA', '965': 'KW', '973': 'BH', '968': 'OM',
  '962': 'JO', '961': 'LB', '972': 'IL', '91': 'IN',
  '92': 'PK', '880': 'BD', '94': 'LK', '86': 'CN',
  '852': 'HK', '886': 'TW', '81': 'JP', '82': 'KR',
  '65': 'SG', '60': 'MY', '66': 'TH', '84': 'VN',
  '63': 'PH', '62': 'ID', '61': 'AU', '64': 'NZ',
  '55': 'BR', '54': 'AR', '56': 'CL', '57': 'CO',
  '51': 'PE', '52': 'MX', '598': 'UY', '593': 'EC',
  '58': 'VE', '1876': 'JM', '1868': 'TT',
};

const COUNTRY_TO_DIAL = {
  'GH': '+233', 'NG': '+234', 'KE': '+254', 'ZA': '+27',
  'TZ': '+255', 'UG': '+256', 'CI': '+225', 'SN': '+221',
  'CM': '+237', 'EG': '+20', 'MA': '+212', 'DZ': '+213',
  'TN': '+216', 'ET': '+251', 'RW': '+250', 'AO': '+244',
  'ZM': '+260', 'ZW': '+263', 'BJ': '+229', 'BF': '+226',
  'TG': '+228', 'NE': '+227', 'ML': '+223', 'LR': '+231',
  'SL': '+232', 'GM': '+220', 'MZ': '+258', 'NA': '+264',
  'BW': '+267', 'MW': '+265', 'GB': '+44', 'US': '+1',
  'CA': '+1', 'IE': '+353', 'DE': '+49', 'FR': '+33',
  'ES': '+34', 'PT': '+351', 'IT': '+39', 'NL': '+31',
  'BE': '+32', 'CH': '+41', 'AT': '+43', 'SE': '+46',
  'NO': '+47', 'DK': '+45', 'FI': '+358', 'PL': '+48',
  'CZ': '+420', 'GR': '+30', 'RO': '+40', 'BG': '+359',
  'HU': '+36', 'TR': '+90', 'UA': '+380', 'AE': '+971',
  'SA': '+966', 'QA': '+974', 'KW': '+965', 'BH': '+973',
  'OM': '+968', 'JO': '+962', 'LB': '+961', 'IL': '+972',
  'IN': '+91', 'PK': '+92', 'BD': '+880', 'LK': '+94',
  'CN': '+86', 'HK': '+852', 'TW': '+886', 'JP': '+81',
  'KR': '+82', 'SG': '+65', 'MY': '+60', 'TH': '+66',
  'VN': '+84', 'PH': '+63', 'ID': '+62', 'AU': '+61',
  'NZ': '+64', 'BR': '+55', 'AR': '+54', 'CL': '+56',
  'CO': '+57', 'PE': '+51', 'MX': '+52', 'UY': '+598',
  'EC': '+593', 'VE': '+58', 'JM': '+1876', 'TT': '+1868',
};

const COUNTRY_DIAL_ORDER = Object.entries(DIAL_TO_COUNTRY)
  .sort(([a], [b]) => b.length - a.length);

export function cleanPhone(raw) {
  return String(raw ?? '').replace(/[\s\-().+]/g, '');
}

export function sanitizePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/[\s\-()]/g, '');
}

export function isValidPhone(raw) {
  if (!raw) return false;
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
  const sanitized = sanitizePhone(trimmed);
  const normalized = normalizePhone(sanitized, countryCode);
  if (!normalized) {
    return { error: { code: 'invalid_phone', message: 'Enter a valid phone number.' } };
  }
  return { kind: 'phone', value: normalized };
}

export function detectCountryFromPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  for (const [dial, country] of COUNTRY_DIAL_ORDER) {
    if (digits.startsWith(dial)) return country;
  }
  return null;
}

export function isE164(raw) {
  if (!raw) return false;
  return E164_RE.test(String(raw).trim());
}

export function formatPhoneForDisplay(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}
