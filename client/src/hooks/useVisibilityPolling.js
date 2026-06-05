/**
 * Poll an async fetcher on a fixed interval — but only while the
 * Page Visibility API reports the document is visible. Pauses on
 * hide; immediate re-fetch + resume on show.
 *
 * Returns { data, error, loading } in the React-hook idiom.
 */
import { useEffect, useRef, useState } from 'react';

export function useVisibilityPolling(fetcher, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNow() {
      try {
        const v = await fetcher();
        if (!cancelled) {
          setData(v);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function start() {
      if (timerRef.current) return;
      fetchNow();
      timerRef.current = setInterval(fetchNow, intervalMs);
    }

    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function onVis() {
      if (document.visibilityState === 'visible') {
        fetchNow();
        start();
      } else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
