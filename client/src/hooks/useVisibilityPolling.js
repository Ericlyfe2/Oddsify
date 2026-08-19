/**
 * Page Visibility-aware polling.
 *
 * `useVisibilityInterval` drives a caller-owned loader on a fixed interval,
 * but only while the document is visible — it pauses on hide, and re-fetches
 * immediately on show. Background tabs stop generating requests entirely,
 * which is what keeps a dashboard left open overnight from burning egress.
 *
 * The loader is handed an `isLive()` predicate; check it before setState so a
 * request that resolves after teardown can't write into dead state.
 *
 * `useVisibilityPolling` wraps it in the React-hook idiom for the common case
 * where the caller only wants { data, error, loading }.
 */
import { useEffect, useRef, useState } from 'react';

export function useVisibilityInterval(fn, intervalMs, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const isLive = () => !cancelled;

    function run() {
      if (!cancelled) fnRef.current(isLive);
    }

    function start() {
      if (timer) return;
      run();
      timer = setInterval(run, intervalMs);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVis() {
      if (document.visibilityState === 'visible') start();
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}

export function useVisibilityPolling(fetcher, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useVisibilityInterval(
    async (isLive) => {
      try {
        const v = await fetcher();
        if (isLive()) {
          setData(v);
          setError(null);
        }
      } catch (e) {
        if (isLive()) setError(e);
      } finally {
        if (isLive()) setLoading(false);
      }
    },
    intervalMs,
    deps,
  );

  return { data, error, loading };
}
