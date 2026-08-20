/**
 * Blocks the storefront while the platform is in maintenance mode.
 *
 * The server is the real enforcement — every player-facing endpoint answers
 * 503 (see server/src/middleware/maintenance.js). This exists so visitors get
 * a blank page instead of a screen full of failed requests.
 *
 * Admin routes never mount this, so the operator can still work while the
 * storefront is closed.
 */
import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../api/apiBase.js';

export default function MaintenanceGate({ children }) {
  const [state, setState] = useState({ checked: false, down: false });

  useEffect(() => {
    let alive = true;
    fetch(`${API_ORIGIN}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setState({ checked: true, down: !!s?.maintenance }))
      // A failed check must not lock anyone out of a healthy site.
      .catch(() => alive && setState({ checked: true, down: false }));
    return () => {
      alive = false;
    };
  }, []);

  // Render nothing until the answer is known, so the app never flashes into
  // view and then blanks out. During maintenance the page stays blank.
  if (!state.checked || state.down) return null;
  return children;
}
