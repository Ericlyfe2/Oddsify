/**
 * Stable per-browser device identifier, used by the referral fraud checks
 * (shared_device heuristic). Random — carries no personal data.
 */
const KEY = 'oddsify_device';

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        (crypto?.randomUUID && crypto.randomUUID()) ||
        `dv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
