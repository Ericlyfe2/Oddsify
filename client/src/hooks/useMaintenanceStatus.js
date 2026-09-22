import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../api/apiBase.js';

/**
 * Whether the platform is in maintenance mode: null while checking, then a
 * boolean. An unreachable API reads as "not in maintenance" — the same
 * fail-open rule as MaintenanceGate, so a failed check never hides a healthy site.
 */
export default function useMaintenanceStatus() {
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_ORIGIN}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setMaintenance(!!s?.maintenance))
      .catch(() => alive && setMaintenance(false));
    return () => {
      alive = false;
    };
  }, []);

  return maintenance;
}
