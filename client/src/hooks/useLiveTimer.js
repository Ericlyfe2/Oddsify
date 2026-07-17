import { useEffect, useState, useRef } from 'react';

export function useLiveTimer(match) {
  const [display, setDisplay] = useState('');
  const baseMinRef = useRef(0);
  const baseExtraRef = useRef(0);
  const startRef = useRef(0);
  const isFixedRef = useRef(false);
  const injuryAppliedRef = useRef(false);
  const injuryLenRef = useRef(0);

  useEffect(() => {
    if (!match?.isLive || match?.finished) {
      setDisplay('');
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

    let baseMin = 0;
    let baseExtra = 0;
    if (raw.includes('+')) {
      const p = raw.split('+');
      baseMin = parseInt(p[0]) || 0;
      baseExtra = parseInt(p[1]) || 0;
    } else {
      baseMin = parseInt(raw) || 0;
    }

    baseMinRef.current = baseMin;
    baseExtraRef.current = baseExtra;
    isFixedRef.current = match.fixed === true;
    injuryAppliedRef.current = false;
    injuryLenRef.current = 0;
    startRef.current = Date.now();

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

      if (injuryAppliedRef.current && min >= 45) {
        const offset = totalSec - 45 * 60;
        const injMin = Math.floor(offset / 60);
        const injSec = offset % 60;
        if (injMin < injuryLenRef.current) {
          setDisplay(`45+${injMin}:${String(injSec).padStart(2, '0')}`);
          return;
        }
        setDisplay('FT');
        return;
      }

      if (min > 99) {
        setDisplay('FT');
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
