/**
 * What a signed-out visitor sees on an /admin URL.
 *
 * Normally that is a redirect to the storefront /login, which knows how to
 * sign admins in. During maintenance that page is blank (it renders inside
 * MaintenanceGate), so the admin sign-in is shown in place instead and the URL
 * the visitor asked for stays put — signing in lands them on it.
 */
import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useMaintenanceStatus from '../../hooks/useMaintenanceStatus.js';

const AdminLogin = lazy(() => import('./AdminLogin.jsx'));

export default function AdminSignedOut({ landing }) {
  const { pathname } = useLocation();
  const maintenance = useMaintenanceStatus();
  const target = landing || pathname;

  if (maintenance === null) return <div className="page-loading" />;
  if (!maintenance) return <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />;
  return <AdminLogin landing={target} />;
}
