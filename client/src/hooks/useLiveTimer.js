import { useEffect, useState, useRef } from 'react';

const SECOND_HALF_INJURY_CAP_MIN = 15; // sanity cap: freeze around 90+X, never run away

export function useLiveTimer(match) {
  const [display, setDisplay] = useState('');
  const baseMinRef = useRef(0);
  const baseExtraRef = useRef(0);
  const startRef = useRef(0);
  const isFixedRef = useRef(false);
  const injuryAppliedRef = useRef(false);
  const injuryLenRef = useRef(0);
  const matchIdRef = useRef(null);

  useEffect(() => {
    if (!match?.isLive || match?.finished) {
      setDisplay('');
      matchIdRef.current = null;
      return;
    }

    const raw = (match.minute || '').replace("'", '').trim();

    if (!raw || raw === 'NS') {
      setDisplay('');
      return;
    }
    if (raw === 'HT') {
      setDisplay("45'");
      return;
    }
    if (raw === 'FT') {
      setDisplay('FT');
      return;
    }

    let newBaseMin = 0;
    let newBaseExtra = 0;
    if (raw.includes('+')) {
      const p = raw.split('+');
      newBaseMin = parseInt(p[0]) || 0;
      newBaseExtra = parseInt(p[1]) || 0;
    } else {
      newBaseMin = parseInt(raw) || 0;
    }

    const isNewMatch = matchIdRef.current !== match.id;
    matchIdRef.current = match.id;

    if (isNewMatch) {
      baseMinRef.current = newBaseMin;
      baseExtraRef.current = newBaseExtra;
      isFixedRef.current = match.fixed === true;
      injuryAppliedRef.current = false;
      injuryLenRef.current = 0;
      startRef.current = Date.now();
    } else {
      // Reconcile instead of hard-resetting: the server pushes on its own
      // polling cadence, which can arrive "behind" a clock we've already
      // ticked forward locally. Only accept the incoming minute as the new
      // baseline when it implies the same or later point in the match — a
      // push that implies going backward is stale and gets ignored, so the
      // on-screen clock never visibly jumps backward.
      const elapsedSec = Math.floor((Date.now() - startRef.current) / 1000);
      const predictedTotalSec = baseMinRef.current * 60 + baseExtraRef.current * 60 + elapsedSec;
      const incomingTotalSec = newBaseMin * 60 + newBaseExtra * 60;
      if (incomingTotalSec >= predictedTotalSec) {
        baseMinRef.current = newBaseMin;
        baseExtraRef.current = newBaseExtra;
        startRef.current = Date.now();
      }
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);

      // "45+X" injury-time notation — keep showing 45+X:YY format
      if (baseExtraRef.current > 0) {
        const totalExtraSec = baseExtraRef.current * 60 + elapsed;
        const extraMin = Math.floor(totalExtraSec / 60);
        const extraSec = totalExtraSec % 60;
        if (extraMin >= 15) {
          setDisplay('FT');
          return;
        }
        setDisplay(`45+${extraMin}:${String(extraSec).padStart(2, '0')}`);
        return;
      }

      const totalSec = baseMinRef.current * 60 + elapsed;
      let min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;

      if (isFixedRef.current && !injuryAppliedRef.current && min >= 45) {
        injuryAppliedRef.current = true;
        injuryLenRef.current = 2 + Math.floor(Math.random() * 4);
      }

      if (injuryAppliedRef.current && min >= 45 && min < 90) {
        const offset = totalSec - 45 * 60;
        const injMin = Math.floor(offset / 60);
        const injSec = offset % 60;
        if (injMin < injuryLenRef.current) {
          setDisplay(`45+${injMin}:${String(injSec).padStart(2, '0')}`);
          return;
        }
        setDisplay(`${min}:${String(sec).padStart(2, '0')}`);
        return;
      }

      // Sanity cap: freeze the clock around 90 minutes instead of counting
      // forever. Show 90+X for stoppage time, then settle on FT.
      if (min >= 90) {
        const offset = totalSec - 90 * 60;
        const extraMin = Math.floor(offset / 60);
        const extraSec = offset % 60;
        if (extraMin >= SECOND_HALF_INJURY_CAP_MIN) {
          setDisplay('FT');
          return;
        }
        setDisplay(`90+${extraMin}:${String(extraSec).padStart(2, '0')}`);
        return;
      }

      setDisplay(`${min}:${String(sec).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match?.id, match?.isLive, match?.minute, match?.fixed, match?.finished]);

  return display;
}
