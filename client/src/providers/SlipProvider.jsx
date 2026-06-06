/**
 * SlipProvider — global bet slip state for the Oddsify design port.
 *
 * Replaces the per-page slip that lived inside the old Home.jsx. Any screen
 * that renders <OddsTile>s talks to this provider (togglePick / removePick /
 * clearSlip), and the global <OddBetSlip /> sheet mounted in AppShell reads
 * the same state.
 *
 * Submission goes through the real /api/bet/place endpoint via betApi. On
 * success we credit a toast through the existing AccountProvider context
 * (so the toast stack and balance refresh live in exactly one place) and
 * clear the slip.
 */
import React, { useCallback, useContext, useMemo, useState } from 'react';
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
  togglePick: () => {},
  removePick: () => {},
  clearSlip: () => {},
  clearLastBet: () => {},
  clearLastBooking: () => {},
  openSlip: () => {},
  closeSlip: () => {},
  placeBet: async () => null,
  bookBet: async () => null,
  lookupBookingCode: async () => {},
  clearLookup: () => {},
};

export const useSlip = () => useContext(SlipCtx) || EMPTY;

export default function SlipProvider({ children }) {
  const { refresh } = useAccount();
  const { toast } = useToast();
  const [picks, setPicks] = useState({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastBet, setLastBet] = useState(null);
  const [lastBooking, setLastBooking] = useState(null);
  const [bookingCodeLookup, setBookingCodeLookup] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const togglePick = useCallback((match, key, val) => {
    setPicks((cur) => {
      const id = match.id;
      const existing = cur[id];
      // Toggle off if same key already selected.
      if (existing && existing.key === key) {
        const next = { ...cur };
        delete next[id];
        return next;
      }
      // Replace existing pick or add new.
      return { ...cur, [id]: { match, key, val, market: match.market || '1X2' } };
    });
    setOpen((prev) => prev || true); // open the sheet on first selection
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
      const amt = Number(stake) || 0;
      if (amt <= 0) {
        toast('Enter a stake before placing the bet.', 'warn');
        return null;
      }
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
        setPicks({});
        toast(`Bet placed: ${entries.length} selection${entries.length > 1 ? 's' : ''}.`, 'success');
        try {
          await refresh();
        } catch {
          /* ignore */
        }
        return result;
      } catch (err) {
        toast(err?.body?.error || err?.message || 'Bet failed.', 'error', { ttl: 6000 });
        return null;
      } finally {
        setBusy(false);
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
      toast(`Booking code: ${result.bookingCode}`, 'success', { ttl: 8000 });
      return result;
    } catch (err) {
      toast(err?.body?.error || err?.message || 'Booking failed.', 'error', { ttl: 6000 });
      return null;
    } finally {
      setBusy(false);
    }
  }, [picks, toast]);

  const clearLookup = useCallback(() => {
    setBookingCodeLookup(null);
  }, []);

  const lookupBookingCode = useCallback(
    async (code) => {
      if (!code || code.trim().length < 2) {
        toast('Enter a valid booking code.', 'warn');
        return;
      }
      setLookupLoading(true);
      setBookingCodeLookup(null);
      try {
        const data = await fetchBetByCode(code.trim().toUpperCase());
        setBookingCodeLookup(data.bet);
      } catch (err) {
        toast(err?.body?.error || err?.message || 'Booking code not found.', 'error');
        setBookingCodeLookup(null);
      } finally {
        setLookupLoading(false);
      }
    },
    [toast],
  );

  const value = useMemo(() => {
    const entries = Object.values(picks);
    const totalOdds = entries.reduce((acc, e) => acc * Number(e.val || 1), 1);
    return {
      picks,
      open,
      busy,
      lastBet,
      lastBooking,
      bookingCodeLookup,
      lookupLoading,
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
      clearLookup,
    };
  }, [
    picks,
    open,
    busy,
    lastBet,
    lastBooking,
    bookingCodeLookup,
    lookupLoading,
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
    clearLookup,
  ]);

  return <SlipCtx.Provider value={value}>{children}</SlipCtx.Provider>;
}
