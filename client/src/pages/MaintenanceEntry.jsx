/**
 * /maintance (and the correctly spelled /maintenance) — the operator's way in
 * while the storefront is closed.
 *
 * The storefront /login page renders inside MaintenanceGate, so during
 * maintenance it is blank and an admin has no visible way to sign in. This
 * route sits outside the gate:
 *   - maintenance on, already signed in as admin → /admin/settings
 *   - maintenance on, signed out                 → admin sign-in, then /admin/settings
 *   - maintenance off (or status unreachable)    → the normal storefront
 */
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import useMaintenanceStatus from '../hooks/useMaintenanceStatus.js';
import { AdminProvider, useAdmin } from '../providers/AdminProvider.jsx';

const AdminLogin = lazy(() => import('./admin/AdminLogin.jsx'));

const SETTINGS_PATH = '/admin/settings';
const BLANK = <div className="page-loading" />;

function Entry() {
  const { admin, loading } = useAdmin();
  if (loading) return BLANK;
  if (admin) return <Navigate to={SETTINGS_PATH} replace />;
  return <AdminLogin landing={SETTINGS_PATH} />;
}

export default function MaintenanceEntry() {
  const maintenance = useMaintenanceStatus();

  if (maintenance === null) return BLANK;
  if (!maintenance) return <Navigate to="/" replace />;

  return (
    <AdminProvider>
      <Suspense fallback={BLANK}>
        <Entry />
      </Suspense>
    </AdminProvider>
  );
}
