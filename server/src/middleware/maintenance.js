/**
 * Maintenance gate.
 *
 * While settings.maintenance is on, every player-facing API call answers 503
 * so the storefront cannot function. The flag is read per-request, so toggling
 * it in the admin UI takes effect immediately — no redeploy, no restart.
 *
 * Deliberately still open during maintenance:
 *   - /api/health          so the platform health check keeps passing and the
 *                          container is not killed and restarted as unhealthy.
 *   - /api/settings/public so the client can learn *why* it is blocked and
 *                          render the maintenance message.
 *   - /api/admin/*         so the operator can keep working, and above all can
 *                          turn maintenance back off again.
 *   - /api/auth/login,
 *     /api/auth/refresh    lockout insurance. Admin sign-in lives under
 *                          /api/admin/auth, but the router redirects
 *                          /admin/login to the storefront login page, so
 *                          leaving these open guarantees no route to being
 *                          locked out of your own site. A player who signs in
 *                          still gets 503 from everything else.
 */
import { getSettings } from '../db/settings.js';

const ALWAYS_OPEN = new Set([
  '/api/health',
  '/api/settings/public',
  '/api/auth/login',
  '/api/auth/refresh',
]);

export function maintenanceGate(req, res, next) {
  const settings = getSettings();
  if (!settings?.maintenance) return next();

  if (ALWAYS_OPEN.has(req.path)) return next();
  if (req.path.startsWith('/api/admin')) return next();

  // 503 + Retry-After is the correct semantic: transient, do not de-index.
  res.set('Retry-After', '3600');
  return res.status(503).json({
    error: 'maintenance',
    message: settings.maintenanceMessage || 'Platform is undergoing scheduled maintenance.',
  });
}
