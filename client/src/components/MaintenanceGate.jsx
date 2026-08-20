/**
 * Blocks the storefront while the platform is in maintenance mode.
 *
 * The server is the real enforcement — every player-facing endpoint answers
 * 503 (see server/src/middleware/maintenance.js). This exists so visitors get
 * an explanation instead of a page full of failed requests.
 *
 * Admin routes never mount this, so the operator can still work while the
 * storefront is closed.
 */
import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../api/apiBase.js';

export default function MaintenanceGate({ children }) {
  const [state, setState] = useState({ checked: false, down: false, message: '' });

  useEffect(() => {
    let alive = true;
    fetch(`${API_ORIGIN}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive) return;
        setState({
          checked: true,
          down: !!s?.maintenance,
          message: s?.maintenanceMessage || '',
        });
      })
      // A failed check must not lock anyone out of a healthy site.
      .catch(() => alive && setState({ checked: true, down: false, message: '' }));
    return () => {
      alive = false;
    };
  }, []);

  // Render nothing until the answer is known, so the app never flashes into
  // view and then blanks out.
  if (!state.checked) return null;
  if (!state.down) return children;

  return (
    <div className="maint-screen" role="status" aria-live="polite">
      <div className="maint-card">
        <div className="maint-mark">Oddsify</div>
        <h1>Back shortly</h1>
        <p>{state.message || 'Platform is undergoing scheduled maintenance. Please check back shortly.'}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}
