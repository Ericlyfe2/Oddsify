import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { placeBet, bookBet, fetchBetByCode } from '../api/betApi.js';
import { useAccount, useToast } from './AccountProvider.jsx';

const SlipCtx = React.createContext(null);

const EMPTY = {
  picks: {},
  open: false,
  count: 0,
  totalOdds: 1,
  lastBet: null,
  lastBooking: null,
  bookingCodeLookup: null,
  lookupLoading: false,
  recentCodes: [],
  submitting: false,
  cashoutOffers: {},
  successBet: null,
  togglePick: () => {},
  removePick: () => {},
  clearSlip: () => {},
  clearLastBet: () => {},
  clearLastBooking: () => {},
  openSlip: () => {},
  closeSlip: () => {},
  placeBet: async () => null,
  bookBet: async () => null,
  lookupBookingCode: async () => null,
  loadFromCode: async () => null,
  loadFromSlip: () => false,
  rememberCode: () => {},
  forgetCode: () => {},
  clearLookup: () => {},
  showSuccessModal: () => {},
  clearSuccessModal: () => {},
  updateCashoutOffer: () => {},
};

export const useSlip = () => useContext(SlipCtx) || EMPTY;

const RECENT_CODES_KEY = 'bv_recent_codes';
const RECENT_CODES_MAX = 12;

function loadRecentCodes() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.code === 'string').slice(0, RECENT_CODES_MAX);
  } catch {
    return [];
  }
}

function persistRecentCodes(entries) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(entries.slice(0, RECENT_CODES_MAX)));
  } catch {}
}

export default function SlipProvider({ children }) {
  const { refresh } = useAccount();
  const { toast } = useToast();
  const [picks, setPicks] = useState({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastBet, setLastBet] = useState(null);
  const [lastBooking, setLastBooking] = useState(null);
  const [bookingCodeLookup, setBookingCodeLookup] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [recentCodes, setRecentCodes] = useState(loadRecentCodes);
  const [successBet, setSuccessBet] = useState(null);
  const [cashoutOffers, setCashoutOffers] = useState({});

  const submitRef = useRef(false);

  const updateCashoutOffer = useCallback((betId, offer) => {
    setCashoutOffers((prev) => ({ ...prev, [betId]: offer }));
  }, []);

  const showSuccessModal = useCallback((bet) => {
    setSuccessBet(bet);
  }, []);

  const clearSuccessModal = useCallback(() => {
    setSuccessBet(null);
  }, []);

  const rememberCode = useCallback((code, meta = {}) => {
    if (!code) return;
    const upper = String(code).toUpperCase();
    setRecentCodes((prev) => {
      const next = [{ code: upper, lastSeenAt: Date.now(), ...meta }, ...prev.filter((e) => e.code !== upper)].slice(
        0,
        RECENT_CODES_MAX,
      );
      persistRecentCodes(next);
      return next;
    });
  }, []);

  const forgetCode = useCallback((code) => {
    if (!code) return;
    const upper = String(code).toUpperCase();
    setRecentCodes((prev) => {
      const next = prev.filter((e) => e.code !== upper);
      persistRecentCodes(next);
      return next;
    });
  }, []);

  const togglePick = useCallback((match, key, val) => {
    setPicks((cur) => {
      const id = match.id;
      const existing = cur[id];
      if (existing && existing.key === key) {
        const next = { ...cur };
        delete next[id];
        return next;
      }
      return { ...cur, [id]: { match, key, val, market: match.market || '1X2' } };
    });
    setOpen((prev) => prev || true);
  }, []);

  const removePick = useCallback((id) => {
    setPicks((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
  }, []);

  const clearSlip = useCallback(() => {
    setPicks({});
    setLastBet(null);
    setOpen(false);
  }, []);

  const clearLastBet = useCallback(() => {
    setLastBet(null);
  }, []);

  const clearLastBooking = useCallback(() => {
    setLastBooking(null);
  }, []);

  const openSlip = useCallback(() => setOpen(true), []);
  const closeSlip = useCallback(() => setOpen(false), []);

  const submit = useCallback(
    async ({ stake, acceptOddsChanges = true } = {}) => {
      const entries = Object.values(picks);
      if (!entries.length) return null;

      if (submitRef.current) {
        toast('Bet is already being placed. Please wait.', 'warn');
        return null;
      }

      const amt = Number(stake) || 0;
      if (amt <= 0) {
        toast('Enter a stake before placing the bet.', 'warn');
        return null;
      }

      submitRef.current = true;
      setSubmitting(true);
      setBusy(true);

      try {
        const payload = {
          mode: entries.length === 1 ? 'single' : 'multiple',
          stake: amt,
          acceptOddsChanges,
          selections: entries.map((e) => ({
            matchId: e.match.id,
            market: e.market || '1X2',
            outcome: e.key,
            odds: e.val,
          })),
        };
        const result = await placeBet(payload);
        setLastBet(result.bet);
        setSuccessBet(result.bet);
        setPicks({});
        try {
          const updated = await refresh();
          if (updated?.balance != null) setSuccessBet((prev) => ({ ...prev, balance: updated.balance }));
        } catch {}
        return result;
      } catch (err) {
        toast(err?.body?.error || err?.message || 'Bet failed.', 'error', { ttl: 6000 });
        return null;
      } finally {
        setSubmitting(false);
        setBusy(false);
        submitRef.current = false;
      }
    },
    [picks, toast, refresh],
  );

  const book = useCallback(async () => {
    const entries = Object.values(picks);
    if (!entries.length) {
      toast('Add at least one selection before booking.', 'warn');
      return null;
    }
    if (submitRef.current) {
      toast('A booking is already in progress.', 'warn');
      return null;
    }
    submitRef.current = true;
    setBusy(true);
    try {
      const payload = {
        selections: entries.map((e) => ({
          matchId: e.match.id,
          market: e.market || '1X2',
          outcome: e.key,
          odds: e.val,
        })),
      };
      const result = await bookBet(payload);
      setLastBooking(result);
      rememberCode(result.bookingCode, { kind: 'booked', legs: entries.length });
      toast(`Booking code: ${result.bookingCode}`, 'success', { ttl: 8000 });
      return result;
    } catch (err) {
      toast(err?.body?.error || err?.message || 'Booking failed.', 'error', { ttl: 6000 });
      return null;
    } finally {
      setBusy(false);
      submitRef.current = false;
    }
  }, [picks, toast]);

  const clearLookup = useCallback(() => {
    setBookingCodeLookup(null);
  }, []);

  const BOOKING_CODE_RE = /^[A-NP-Z]{2}[1-9]{5}$/;

  const lookupBookingCode = useCallback(
    async (rawCode) => {
      const code = String(rawCode || '')
        .trim()
        .toUpperCase();
      if (!code) {
        toast('Enter a booking code first.', 'warn');
        return;
      }
      if (!BOOKING_CODE_RE.test(code)) {
        toast('Booking code format is two letters followed by five digits (e.g. AF36513).', 'warn', { ttl: 6000 });
        return;
      }
      setLookupLoading(true);
      setBookingCodeLookup(null);
      try {
        const data = await fetchBetByCode(code);
        const slip = data.bet;
        setBookingCodeLookup(slip);
        rememberCode(code, {
          kind: slip?.status === 'booked' ? 'booked' : 'placed',
          legs: slip?.legs?.length || 0,
          totalOdds: slip?.totalOdds,
        });
        toast(`Booking code loaded successfully.`, 'success');
        return slip;
      } catch (err) {
        let message;
        if (err?.status === 404) message = 'Booking code not found.';
        else if (err?.status === 410) message = 'This booking code has expired.';
        else if (err?.status === 409) message = 'This booking code has already been redeemed.';
        else message = err?.body?.error || err?.message || `No slip exists for code ${code}.`;
        toast(message, 'error', { ttl: 6000 });
        setBookingCodeLookup(null);
        return null;
      } finally {
        setLookupLoading(false);
      }
    },
    [toast, rememberCode],
  );

  const loadFromSlip = useCallback(
    (slip) => {
      if (!slip?.legs?.length) {
        toast('That slip has no selections to rebook.', 'warn');
        return false;
      }
      const next = {};
      for (const leg of slip.legs) {
        if (!leg.matchId) continue;
        next[leg.matchId] = {
          match: {
            id: leg.matchId,
            home: leg.home,
            away: leg.away,
            market: leg.market || '1X2',
          },
          key: leg.outcome,
          val: Number(leg.odds) || 1,
          market: leg.market || '1X2',
        };
      }
      setPicks(next);
      setLastBet(null);
      setLastBooking(null);
      setOpen(true);
      const count = Object.keys(next).length;
      toast(`Loaded ${count} selection${count === 1 ? '' : 's'} into your slip.`, 'success');
      return true;
    },
    [toast],
  );

  const loadFromCode = useCallback(
    async (rawCode) => {
      const slip = await lookupBookingCode(rawCode);
      if (slip) loadFromSlip(slip);
      return slip;
    },
    [lookupBookingCode, loadFromSlip],
  );

  const value = useMemo(() => {
    const entries = Object.values(picks);
    const totalOdds = entries.reduce((acc, e) => acc * Number(e.val || 1), 1);
    return {
      picks,
      open,
      busy,
      submitting,
      cashoutOffers,
      lastBet,
      lastBooking,
      bookingCodeLookup,
      lookupLoading,
      recentCodes,
      successBet,
      count: entries.length,
      totalOdds,
      togglePick,
      removePick,
      clearSlip,
      clearLastBet,
      clearLastBooking,
      openSlip,
      closeSlip,
      placeBet: submit,
      bookBet: book,
      lookupBookingCode,
      loadFromCode,
      loadFromSlip,
      rememberCode,
      forgetCode,
      clearLookup,
      showSuccessModal,
      clearSuccessModal,
      updateCashoutOffer,
    };
  }, [
    picks,
    open,
    busy,
    submitting,
    cashoutOffers,
    lastBet,
    lastBooking,
    bookingCodeLookup,
    lookupLoading,
    recentCodes,
    successBet,
    togglePick,
    removePick,
    clearSlip,
    clearLastBet,
    clearLastBooking,
    openSlip,
    closeSlip,
    submit,
    book,
    lookupBookingCode,
    loadFromCode,
    loadFromSlip,
    rememberCode,
    forgetCode,
    clearLookup,
    showSuccessModal,
    clearSuccessModal,
    updateCashoutOffer,
  ]);

  return <SlipCtx.Provider value={value}>{children}</SlipCtx.Provider>;
}
