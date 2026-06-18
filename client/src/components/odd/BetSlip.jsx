/**
 * Global bet slip — floating FAB + slide-up sheet ported from the Claude
 * Design Oddsify.html prototype (screens-other.jsx OddBetSlipFAB + OddBetSlip).
 *
 * Consumes both providers:
 *  - SlipProvider     → picks, open/close, totalOdds, placeBet()
 *  - AccountProvider  → balance (shown in the sheet header & MAX stake chip)
 *
 * The sheet is `position: fixed` so it overlays whatever page is mounted.
 * On small screens it slides up from the bottom-nav line; on larger viewports
 * it caps at 88% height and centers in a max-w-md column.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTokens, fmtCedi } from './tokens.jsx';
import OddIcon from './Icon.jsx';
import { TeamLogo } from './teamBranding.jsx';
import { useSlip } from '../../providers/SlipProvider.jsx';
import { useAccount } from '../../providers/AccountProvider.jsx';
import BetSuccessOverlay from '../BetSuccessOverlay.jsx';

export function OddBetSlipFAB() {
  const T = useTokens();
  const { count, open, openSlip } = useSlip();
  if (!count || open) return null;
  return (
    <button
      onClick={openSlip}
      type="button"
      aria-label={`Open bet slip — ${count} selection${count > 1 ? 's' : ''}`}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 96,
        zIndex: 80,
        width: 56,
        height: 56,
        borderRadius: 999,
        background: T.greenBright,
        color: T.goldDark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 24px -8px rgba(232, 185, 74, 0.6), 0 6px 12px rgba(0,0,0,0.25)',
        border: `2px solid ${T.goldDark}`,
        cursor: 'pointer',
      }}
    >
      <OddIcon name="ticket" size={20} color={T.goldDark} strokeWidth={2.2} />
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, marginTop: -2 }}>SLIP</span>
      <span
        style={{
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 22,
          height: 22,
          borderRadius: 999,
          background: T.goldDark,
          color: T.greenBright,
          fontSize: 11,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${T.bg}`,
        }}
      >
        {count}
      </span>
    </button>
  );
}

export function OddBetSlip() {
  const T = useTokens();
  const navigate = useNavigate();
  const {
    picks,
    open,
    count,
    totalOdds,
    busy,
    lastBet,
    successBet,
    clearSuccessModal,
    lastBooking,
    bookingCodeLookup,
    lookupLoading,
    removePick,
    clearSlip,
    closeSlip,
    openSlip,
    placeBet,
    bookBet,
    clearLastBet,
    clearLastBooking,
    lookupBookingCode,
    clearLookup,
    loadFromCode,
    loadFromSlip,
  } = useSlip();
  const { account } = useAccount();
  const balance = account?.balance ?? 0;
  const entries = Object.values(picks);
  const [stake, setStake] = useState(1000);
  const [acceptChanges, setAcceptChanges] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const potentialWin = useMemo(() => (Number(stake) || 0) * totalOdds, [stake, totalOdds]);

  const copyCode = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  // Always render the slip — even with zero picks and no last-placed bet —
  // so the "Load booking code" input is permanently reachable. When fully
  // empty the slip collapses to a thin peek bar showing "Load by code →".
  const emptyState = !count && !lastBet;

  return (
    <>
      {/* scrim — only covers the page, not the bottom nav */}
      {open && (
        <div
          onClick={closeSlip}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 88,
            transition: 'opacity 200ms',
          }}
          aria-hidden="true"
        />
      )}

      {/* Empty state FAB. The full Booking Code Hub lives at /codehub —
          tapping the FAB takes the user there instead of opening the
          slip, because that's where they can also browse recent codes
          and share. The in-slip booking-code lookup still exists for
          the in-flow "load and place from same screen" case. */}
      {emptyState && !open && (
        <button
          type="button"
          onClick={() => navigate('/codehub')}
          aria-label="Open Booking Code Hub"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 88,
            zIndex: 91,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 999,
            background: T.greenBright,
            color: T.goldDark,
            fontWeight: 700,
            fontSize: 13,
            border: 0,
            cursor: 'pointer',
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            whiteSpace: 'nowrap',
          }}
        >
          <OddIcon name="ticket" size={16} color={T.goldDark} />
          Load code
        </button>
      )}

      <div
        role="dialog"
        aria-label="Bet slip"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: T.surface,
          color: T.ink,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          zIndex: 91,
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          // In the empty state we drive interaction through the floating
          // "Load code" FAB above instead of a peek bar, so the sheet stays
          // fully translated off-screen until the user opens it.
          transform:
            open || lastBet ? 'translateY(0)' : emptyState ? 'translateY(100%)' : 'translateY(calc(100% - 56px))',
          boxShadow: '0 -16px 40px -10px rgba(0,0,0,0.25)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          pointerEvents: emptyState && !open ? 'none' : 'auto',
        }}
      >
        {/* condensed bar / drag handle */}
        <button
          onClick={() => {
            if (lastBet) {
              clearLastBet();
              closeSlip();
            } else {
              open ? closeSlip() : openSlip();
            }
          }}
          type="button"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            width: '100%',
            background: 'transparent',
            border: 0,
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineStrong, alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>
                {lastBet ? '✅ Bet Placed' : emptyState ? 'Load booking code' : 'Betslip'}
              </span>
              {!lastBet && count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: T.greenSoft,
                    color: T.greenBright,
                  }}
                >
                  {count}
                </span>
              )}
              {!lastBet && emptyState && (
                <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>or pick odds</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!lastBet && (
              <>
                <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>Balance</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                  GHS {fmtCedi(balance)}
                </span>
              </>
            )}
            <OddIcon name={open ? 'chevD' : 'chevU'} size={16} color={T.inkSoft} />
          </div>
        </button>

        {/* ─── Bet placed confirmation (inline fallback) ─── */}
        {lastBet ? (
          <>
            <div className="odd-pane" style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: 'rgba(232,185,74,0.16)',
                    margin: '0 auto 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <OddIcon name="check" size={28} color={T.greenBright} strokeWidth={3} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: T.ink }}>Bet Placed!</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                  Your slip has been submitted successfully.
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.line}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, letterSpacing: 0.6, marginBottom: 4 }}>
                    BOOKING CODE
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: T.greenBright,
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: 1.2,
                    }}
                  >
                    {lastBet.bookingCode || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(lastBet.bookingCode || '')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: T.greenBright,
                    color: T.goldDark,
                    fontWeight: 700,
                    fontSize: 11,
                    border: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <OddIcon name="check" size={12} color={T.goldDark} />
                  Copy
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <div
                  style={{ padding: '12px', borderRadius: 12, background: T.surfaceAlt, border: `1px solid ${T.line}` }}
                >
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, marginBottom: 4 }}>STAKE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>GHS {fmtCedi(lastBet.stake)}</div>
                </div>
                <div
                  style={{ padding: '12px', borderRadius: 12, background: T.surfaceAlt, border: `1px solid ${T.line}` }}
                >
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, marginBottom: 4 }}>RETURN</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.greenBright }}>
                    GHS {fmtCedi(lastBet.potentialWin)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${T.line}`, background: T.surface, padding: '12px 16px 16px' }}>
              <button
                type="button"
                onClick={() => {
                  clearLastBet();
                  closeSlip();
                }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  background: T.greenBright,
                  color: T.goldDark,
                  fontWeight: 800,
                  fontSize: 13,
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </>
        ) : open ? (
          <>
            {/* action bar */}
            <div
              style={{
                padding: '0 16px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: T.surfaceAlt,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 0,
                  color: T.ink,
                  cursor: 'pointer',
                }}
              >
                Standard mode <OddIcon name="chevD" size={12} />
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={clearSlip}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${T.line}`,
                    fontSize: 11,
                    color: T.inkSoft,
                    fontWeight: 600,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <OddIcon name="trash" size={12} /> Remove all
                </button>
              </div>
            </div>

            {/* booking code lookup */}
            <div
              style={{
                margin: '0 16px 8px',
                padding: '10px 12px',
                borderRadius: 12,
                background: T.surfaceAlt,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <input
                value={codeInput}
                onChange={(e) => {
                  // Allow only A-Z and 1-9 (no zero, no letter O — same
                  // alphabet generateBookingCode() uses server-side).
                  const cleaned = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z1-9]/g, '')
                    .slice(0, 7);
                  setCodeInput(cleaned);
                }}
                placeholder="e.g. AF36513"
                maxLength={7}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookupBookingCode(codeInput);
                }}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Booking code"
                style={{
                  flex: 1,
                  background: T.surface,
                  color: T.ink,
                  border: `1px solid ${codeInput.length === 7 ? T.greenBright : T.line}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: 1,
                }}
              />
              <button
                type="button"
                onClick={() => lookupBookingCode(codeInput)}
                disabled={lookupLoading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: T.greenBright,
                  color: T.goldDark,
                  fontWeight: 700,
                  fontSize: 11,
                  border: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: lookupLoading ? 0.7 : 1,
                }}
              >
                {lookupLoading ? '…' : 'Look up'}
              </button>
            </div>

            {/* booking code lookup result */}
            {bookingCodeLookup && (
              <div
                style={{
                  margin: '0 16px 8px',
                  padding: '12px',
                  borderRadius: 12,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.line}`,
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>
                    BOOKING CODE{' '}
                    <span style={{ color: T.greenBright, letterSpacing: 1 }}>{bookingCodeLookup.bookingCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearLookup}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: T.inkDim,
                      cursor: 'pointer',
                    }}
                  >
                    <OddIcon name="x" size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {bookingCodeLookup.legs?.length || 1} selection{(bookingCodeLookup.legs?.length || 1) > 1 ? 's' : ''}
                  {' · '}
                  {bookingCodeLookup.mode || 'single'}
                  {' · '}Stake GHS {fmtCedi(bookingCodeLookup.stake)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 4 }}>
                  Status:{' '}
                  <span style={{ color: bookingCodeLookup.status === 'won' ? T.greenBright : T.inkSoft }}>
                    {bookingCodeLookup.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      loadFromCode(codeInput);
                      clearLookup();
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      background: T.greenBright,
                      color: T.goldDark,
                      border: 0,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Load to slip
                  </button>
                  <button
                    type="button"
                    onClick={clearLookup}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      color: T.ink,
                      border: `1px solid ${T.line}`,
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* accept odds changes */}
            <div
              style={{
                margin: '0 16px 8px',
                padding: '10px 12px',
                borderRadius: 12,
                background: T.surfaceAlt,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Accept odds changes</span>
              <button
                type="button"
                onClick={() => setAcceptChanges((a) => !a)}
                aria-label="Toggle accept odds changes"
                aria-pressed={acceptChanges}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  position: 'relative',
                  background: acceptChanges ? T.greenBright : T.lineStrong,
                  transition: 'background 150ms',
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: acceptChanges ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: 'var(--surface)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 150ms',
                  }}
                />
              </button>
            </div>

            {/* picks list */}
            <div className="odd-pane" style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
              {entries.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 999,
                      background: T.surfaceAlt,
                      margin: '0 auto 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <OddIcon name="ticket" size={26} color={T.inkDim} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Your slip is empty</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Tap any odds to add selections.</div>
                </div>
              ) : (
                entries.map((e) => (
                  <div
                    key={e.match.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: `1px solid ${T.line}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => removePick(e.match.id)}
                        aria-label={`Remove ${e.match.home} vs ${e.match.away}`}
                        style={{
                          marginTop: 2,
                          color: T.inkDim,
                          background: 'transparent',
                          border: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <OddIcon name="x" size={14} color={T.inkDim} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: e.match.isLive ? T.danger : T.ink,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {e.match.isLive ? `${e.match.scoreH ?? 0}-${e.match.scoreA ?? 0} ` : ''}
                            {Number(e.val).toFixed(2)}
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: 11,
                              fontWeight: 600,
                              color: T.inkSoft,
                            }}
                          >
                            Single
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>
                          {e.label || (e.key === '1' ? e.match.home : e.key === '2' ? e.match.away : 'Draw')}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: T.inkDim,
                            letterSpacing: -0.1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <TeamLogo name={e.match.home} size={14} />
                          {e.match.home}
                          <span style={{ opacity: 0.4 }}>vs</span>
                          <TeamLogo name={e.match.away} size={14} />
                          {e.match.away}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* stake + totals + place */}
            {entries.length > 0 && (
              <div style={{ borderTop: `1px solid ${T.line}`, background: T.surface }}>
                <div
                  style={{
                    padding: '14px 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.inkSoft,
                        letterSpacing: 0.6,
                      }}
                    >
                      {entries.length === 1 ? 'SINGLES' : 'MULTIPLE'} · {entries.length}X
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: T.ink,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {totalOdds.toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: T.surfaceAlt,
                      borderRadius: 12,
                      padding: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.max(10, s - 100))}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: T.surface,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 0,
                        color: T.ink,
                        cursor: 'pointer',
                      }}
                      aria-label="Decrease stake"
                    >
                      <OddIcon name="minus" size={14} />
                    </button>
                    <input
                      value={stake}
                      onChange={(e) => setStake(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                      aria-label="Stake amount"
                      style={{
                        width: 80,
                        textAlign: 'center',
                        background: 'transparent',
                        border: 0,
                        fontSize: 15,
                        fontWeight: 700,
                        color: T.ink,
                        outline: 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setStake((s) => s + 100)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: T.surface,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 0,
                        color: T.ink,
                        cursor: 'pointer',
                      }}
                      aria-label="Increase stake"
                    >
                      <OddIcon name="plus" size={14} />
                    </button>
                  </div>
                </div>

                {/* quick stake chips */}
                <div style={{ display: 'flex', gap: 6, padding: '8px 16px 4px' }}>
                  {[50, 100, 500, 1000, 'MAX'].map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStake(v === 'MAX' ? Math.floor(balance) : v)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 8,
                        background: T.surfaceAlt,
                        color: T.ink,
                        fontSize: 11,
                        fontWeight: 700,
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {v === 'MAX' ? 'MAX' : `+${v}`}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    padding: '8px 16px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: T.inkSoft, fontWeight: 600 }}>To Return</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: T.ink,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    GHS {fmtCedi(potentialWin)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '12px 16px 16px' }}>
                  <button
                    type="button"
                    disabled={busy || !entries.length}
                    onClick={() => bookBet()}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'transparent',
                      color: T.ink,
                      border: `1px solid ${T.lineStrong}`,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {busy ? 'Booking…' : 'Book Bet'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => placeBet({ stake, acceptOddsChanges: acceptChanges })}
                    style={{
                      flex: 1,
                      padding: '14px 0',
                      borderRadius: 14,
                      background: T.greenBright,
                      color: T.goldDark,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      fontWeight: 800,
                      border: 0,
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{busy ? 'Placing…' : 'Place Bet'}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      GHS {fmtCedi(potentialWin)}
                    </span>
                  </button>
                </div>
                {lastBooking && (
                  <div
                    style={{
                      margin: '0 16px 16px',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: T.surfaceAlt,
                      border: `1px dashed ${T.lineStrong}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, letterSpacing: 0.6 }}>
                        BOOKING CODE
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: 1.2,
                          fontVariantNumeric: 'tabular-nums',
                          color: T.ink,
                        }}
                      >
                        {lastBooking.bookingCode}
                      </div>
                      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                        Share or save this code — anyone can load the same selections via My Bets → "Load by code".
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard?.writeText(lastBooking.bookingCode);
                        } catch {
                          /* ignore */
                        }
                        clearLastBooking();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: T.greenBright,
                        color: T.goldDark,
                        fontSize: 12,
                        fontWeight: 700,
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
      {/* Fullscreen success celebration overlay */}
      <BetSuccessOverlay
        bet={successBet}
        onClose={clearSuccessModal}
        onViewBet={() => {
          clearSuccessModal();
          navigate('/my-bets');
        }}
        onGoHistory={() => {
          clearSuccessModal();
          navigate('/my-bets?tab=hist');
        }}
        onCopy={(code) => copyCode(code)}
        onShare={() => {}}
        onRebook={() => {
          clearSuccessModal();
          loadFromSlip(lastBet);
        }}
        onReturn={() => {
          clearSuccessModal();
          navigate('/');
        }}
      />
    </>
  );
}
