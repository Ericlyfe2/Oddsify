import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Restore scroll position on browser back/forward, and scroll to top on a
// forward push (PUSH). Hash links are left alone so #anchor targets work.
// Stores positions in sessionStorage keyed by history entry idx, so an
// in-tab refresh keeps positions intact while a new tab starts fresh.
const STORAGE_KEY = 'bv_scroll_positions';

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function writeStore(map) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {/* ignore */}
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType(); // POP, PUSH, REPLACE
  const lastKey = useRef(null);

  // Persist scroll before route swaps so we have something to restore later.
  useEffect(() => {
    return () => {
      const key = lastKey.current;
      if (!key) return;
      const store = readStore();
      store[key] = { x: window.scrollX, y: window.scrollY, t: Date.now() };
      writeStore(store);
    };
  }, []);

  useEffect(() => {
    lastKey.current = location.key;

    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    if (navType === 'POP') {
      const store = readStore();
      const saved = store[location.key];
      if (saved) {
        // Defer until layout settles so contents have rendered.
        requestAnimationFrame(() => window.scrollTo(saved.x || 0, saved.y || 0));
        return;
      }
    }

    // PUSH / REPLACE — fresh page, start at the top.
    window.scrollTo(0, 0);
  }, [location.key, location.hash, navType]);

  // Save scroll whenever the user navigates away (beforeunload covers tab close).
  useEffect(() => {
    const save = () => {
      const key = lastKey.current;
      if (!key) return;
      const store = readStore();
      store[key] = { x: window.scrollX, y: window.scrollY, t: Date.now() };
      writeStore(store);
    };
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // Save on every route change too, so by the time we POP back the previous
  // entry has a saved position.
  useEffect(() => {
    const key = location.key;
    return () => {
      const store = readStore();
      store[key] = { x: window.scrollX, y: window.scrollY, t: Date.now() };
      writeStore(store);
    };
  }, [location.key]);

  return null;
}
