import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  setTokens,
  clearTokens,
  getAccess,
  fetchMe,
  logout as apiLogout,
  deposit as apiDeposit,
  fetchUnacknowledgedWins,
  acknowledgeBet,
} from '../api/betApi.js';
import { onLive, refreshAuth, disconnectSocket } from '../api/socketClient.js';
import WinCelebrationOverlay from '../components/WinCelebrationOverlay.jsx';
import DepositResultModal from '../components/DepositResultModal.jsx';
import TxHeader from '../components/TxHeader.jsx';
import PaybillInstructions from '../components/PaybillInstructions.jsx';
import { appendTxCache } from '../lib/txCache.js';
import { requestNotificationPermission, notify as osNotify } from '../lib/browserNotify.js';

export const AccountCtx = React.createContext(null);
export const ToastCtx = React.createContext(null);

const EMPTY_ACCOUNT = {
  account: null,
  loading: false,
  signIn: () => {},
  signOut: () => {},
  adjustBalance: () => {},
  setAccount: () => {},
  openDeposit: () => {},
  openWithdraw: () => {},
  refresh: () => {},
  showWin: () => {},
  showReferralReward: () => {},
  notifications: [],
  unreadCount: 0,
  clearNotifications: () => {},
  markNotificationRead: () => {},
};
const EMPTY_TOAST = { toast: () => {} };

export const useAccount = () => React.useContext(AccountCtx) || EMPTY_ACCOUNT;
export const useToast = () => React.useContext(ToastCtx) || EMPTY_TOAST;

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Display-format a Ghana phone with the middle digits masked. Examples:
//   "+233551234567" → "+233 55****567"
//   "0551234567"    → "055****567"
// Anything that doesn't match a known phone shape (emails, blanks, unknown
// formats) is returned unchanged — callers should fall back to a separate
// placeholder rather than letting this helper invent masking.
function maskPhone(s) {
  const str = String(s || '').replace(/\s/g, '');
  if (!str) return '';
  if (/^\+233\d{9}$/.test(str)) {
    return `+233 ${str.slice(4, 6)}****${str.slice(-3)}`;
  }
  if (/^0\d{9}$/.test(str)) {
    return `${str.slice(0, 3)}****${str.slice(-3)}`;
  }
  return str;
}

export default function AppProviders({ children }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(!!getAccess());

  const [toasts, setToasts] = useState([]);

  const depositDlg = useRef(null);
  const MIN_DEPOSIT = 300;
  const MAX_DEPOSIT = 50000;
  const [depositAmt, setDepositAmt] = useState(String(MIN_DEPOSIT));
  const [depositMethod, setDepositMethod] = useState('paystack'); // 'paystack' | 'paybill'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wins, setWins] = useState([]);
  const [referralReward, setReferralReward] = useState(null);
  // Queue of deposit decisions still to show. Approve/reject events push into
  // it; the modal pops the head when dismissed. A queue (not a single value)
  // means a burst of admin decisions never silently overwrites an unread
  // popup the user hasn't acknowledged yet.
  const [depositResults, setDepositResults] = useState([]);
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sp_notifications') : null;
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Functional updaters so concurrent socket pushes never lose entries to a
  // stale closure (live + poll + websocket can all arrive within one tick).
  const updateNotifications = useCallback((updater) => {
    setNotifications((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('sp_notifications', JSON.stringify(next.slice(0, 200)));
      } catch {}
      return next;
    });
  }, []);

  const addNotification = useCallback(
    (n) => {
      updateNotifications((prev) => {
        const entry = { ...n, read: false, receivedAt: new Date().toISOString() };
        // De-dupe by id so a poll arriving after a socket push doesn't double-list.
        if (n.id && prev.some((x) => x.id === n.id)) return prev;
        return [entry, ...prev].slice(0, 200);
      });
    },
    [updateNotifications],
  );

  const clearNotifications = useCallback(() => {
    updateNotifications([]);
  }, [updateNotifications]);

  const markNotificationRead = useCallback(
    (id) => {
      updateNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    [updateNotifications],
  );

  const dismissToast = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (msg, kind = 'info', opts = {}) => {
      if (!msg) return null;
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ttl = typeof opts.ttl === 'number' ? opts.ttl : 3500;
      setToasts((cur) => [...cur.slice(-3), { id, message: msg, kind }]);
      if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
      return id;
    },
    [dismissToast],
  );

  const refresh = useCallback(async () => {
    if (!getAccess()) {
      setAccount(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await fetchMe();
      setAccount(data.account);
      return data.account;
    } catch (err) {
      // Only sign the user out when the server actually rejects the token.
      // Network glitches / 5xx leave the existing account state in place so
      // the next tick (or the visibilitychange rehydrate below) can retry.
      if (err?.status === 401 || err?.status === 403) {
        clearTokens();
        setAccount(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-hydrate when the tab returns from being hidden (laptop wake, mobile
  // app switch). The access token may have expired silently while we were
  // backgrounded; this fetch will trigger the refresh dance in betApi.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && getAccess()) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Poll for freshly-settled wins the user hasn't seen.
  // (Realtime socket also pushes bet:won — poll is the safety net.)
  //
  // IMPORTANT: depend on `account?.id` (user identity), NOT on the whole
  // `account` object. Every deposit approval / balance update produces a new
  // account reference; if we depended on `account` we'd tear down and
  // re-handshake the socket on every wallet change, racing the very modal
  // we just queued. Identity-only deps mean the socket stays connected for
  // the entire session.
  const accountId = account?.id;
  useEffect(() => {
    if (!accountId) {
      setWins([]);
      disconnectSocket();
      return;
    }
    let alive = true;

    refreshAuth(); // re-handshake the socket with the now-current access token

    const tick = async () => {
      try {
        const { bets } = await fetchUnacknowledgedWins();
        if (!alive || !Array.isArray(bets) || !bets.length) return;
        // Merge instead of replace so a concurrent cash-out modal entry
        // isn't clobbered by a polled win batch.
        setWins((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          const merged = [...prev];
          for (const b of bets) if (!seen.has(b.id)) merged.push(b);
          return merged;
        });
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 60_000);

    // Live updates pushed by the server.
    const offWallet = onLive('wallet:update', ({ balance }) => {
      if (typeof balance === 'number') {
        setAccount((prev) => (prev ? { ...prev, balance } : prev));
      }
    });
    const offPending = onLive('wallet:pending', ({ transaction, amount }) => {
      toast(`Deposit of GHS ${formatAmt(amount)} is pending admin approval.`, 'info', { ttl: 5000 });
      if (accountId && transaction) appendTxCache(accountId, transaction);
    });
    const offApproved = onLive('deposit:approved', ({ transaction, account: updatedAccount }) => {
      if (updatedAccount) setAccount(updatedAccount);
      const txId = transaction?.id;
      const amt = transaction?.amount;
      const title = 'Deposit approved';
      const body = `GHS ${formatAmt(amt)} has been credited to your wallet.`;
      toast(`Deposit approved! GHS ${formatAmt(amt)} credited.`, 'success');
      // Persistent inbox entry — survives reload, de-duped by tx id.
      addNotification({
        id: `deposit-approved-${txId || Date.now()}`,
        title,
        body,
        severity: 'info',
        kind: 'deposit_approved',
      });
      // OS-level push — fires even when the tab is hidden / app is in the
      // background. No-ops when permission isn't granted.
      osNotify({
        title,
        body,
        tag: `deposit-${txId || 'approved'}`,
      });
      // In-app centered modal — guaranteed visible, no permission required.
      setDepositResults((prev) => {
        if (txId && prev.some((r) => r.txId === txId)) return prev;
        return [...prev, { kind: 'approved', amount: amt, txId, at: Date.now() }];
      });
    });
    const offRejected = onLive('deposit:rejected', ({ transaction, reason }) => {
      const txId = transaction?.id;
      const amt = transaction?.amount;
      const title = 'Deposit rejected';
      const body = `Your GHS ${formatAmt(amt)} deposit was rejected${reason ? ': ' + reason : '.'}`;
      toast(`Deposit of GHS ${formatAmt(amt)} rejected${reason ? ': ' + reason : ''}.`, 'warn');
      addNotification({
        id: `deposit-rejected-${txId || Date.now()}`,
        title,
        body,
        severity: 'critical',
        kind: 'deposit_rejected',
      });
      osNotify({
        title,
        body,
        tag: `deposit-${txId || 'rejected'}`,
      });
      setDepositResults((prev) => {
        if (txId && prev.some((r) => r.txId === txId)) return prev;
        return [...prev, { kind: 'rejected', amount: amt, reason, txId, at: Date.now() }];
      });
    });
    const offWin = onLive('bet:won', async () => {
      try {
        await tick();
      } catch {}
    });
    const offNotif = onLive('notification:new', (payload) => {
      if (payload?.title) {
        addNotification(payload);
        toast(
          `${payload.title}${payload.body ? ': ' + payload.body : ''}`,
          payload.severity === 'critical' ? 'warn' : 'info',
          { ttl: 6000 },
        );
      }
    });
    const offSettled = onLive('bet:settled', async () => {
      try {
        await tick();
      } catch {}
    });

    const offCashout = onLive('wallet:update', ({ balance, reason }) => {
      if (reason === 'cash_out' && typeof balance === 'number') {
        setAccount((prev) => (prev ? { ...prev, balance } : prev));
        toast(`Cash-out processed! Balance: GHS ${formatAmt(balance)}`, 'success', { ttl: 5000 });
      }
    });

    const offReferralReward = onLive('referral:rewarded', (payload) => {
      if (payload?.amount) {
        setAccount((prev) => (prev ? { ...prev, balance: payload.balance ?? prev.balance } : prev));
        setReferralReward(payload);
      }
    });

    return () => {
      alive = false;
      clearInterval(id);
      offWallet?.();
      offPending?.();
      offApproved?.();
      offRejected?.();
      offNotif?.();
      offWin?.();
      offSettled?.();
      offCashout?.();
      offReferralReward?.();
    };
  }, [accountId]);

  const dismissWins = useCallback(async () => {
    const toAck = [...wins];
    setWins([]);
    for (const b of toAck) {
      try {
        await acknowledgeBet(b.id);
      } catch {
        /* swallow */
      }
    }
    // Refresh balance in case settlement credited the wallet between calls.
    try {
      await refresh();
    } catch {
      /* ignore */
    }
  }, [wins, refresh]);

  /** Persist tokens + load account from a successful auth response. */
  const signIn = useCallback(
    (authResponse) => {
      if (authResponse?.accessToken) setTokens(authResponse.accessToken, authResponse.refreshToken);
      if (authResponse?.account) setAccount(authResponse.account);
      if (authResponse?.account)
        toast(`Signed in as ${authResponse.account.displayName || authResponse.account.email}`);
      // Sign-in is a user gesture, so this is a good moment to ask for browser
      // notification permission. Fire-and-forget — the helper no-ops on refusal
      // or unsupported platforms, and never re-prompts once decided.
      requestNotificationPermission().catch(() => {});
    },
    [toast],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore network */
    }
    clearTokens();
    setAccount(null);
    toast('Logged out.');
    navigate('/', { replace: true });
  }, [toast, navigate]);

  const adjustBalance = useCallback(
    (delta, label) => {
      setAccount((prev) => (prev ? { ...prev, balance: Number((prev.balance + delta).toFixed(2)) } : prev));
      if (label) toast(label);
    },
    [toast],
  );

  const openDeposit = useCallback(() => {
    if (!account) {
      toast('Sign in to deposit.');
      navigate('/login');
      return;
    }
    setErr('');
    setDepositAmt(String(MIN_DEPOSIT));
    setDepositMethod('paystack');
    depositDlg.current?.showModal();
  }, [account, toast, navigate]);

  const openWithdraw = useCallback(() => {
    if (!account) {
      toast('Sign in to withdraw.');
      navigate('/login');
      return;
    }
    navigate('/withdraw');
  }, [account, toast, navigate]);

  const submitDeposit = async (e) => {
    e.preventDefault();
    setErr('');
    const amt = parseFloat(String(depositAmt).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount.');
      return;
    }
    if (amt < MIN_DEPOSIT) {
      setErr(`Minimum deposit is GHS ${MIN_DEPOSIT}.`);
      return;
    }
    // Submitting a deposit is the moment the user most wants notified about
    // its outcome — request browser permission here so the approve/reject
    // socket event can surface even when the tab is backgrounded.
    requestNotificationPermission().catch(() => {});
    try {
      setBusy(true);
      const data = await apiDeposit(amt, depositMethod);
      if (data?.transaction) {
        if (account?.id) appendTxCache(account.id, data.transaction);
      }
      depositDlg.current?.close();
      const labels = { paystack: 'Paystack', paybill: 'Paybill' };
      toast(
        `Deposit of GHS ${formatAmt(amt)} via ${labels[depositMethod] || depositMethod} submitted for admin approval.`,
        'info',
      );
    } catch (e) {
      setErr(e.message || 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  // Public callback so cash-outs (and any other "instant payout" flow) can
  // trigger the trophy modal without re-implementing the timer/animation.
  const showWin = useCallback((bet) => {
    if (!bet) return;
    setWins((prev) => {
      const id = bet.id || `synthetic-${Date.now()}`;
      if (prev.some((b) => b.id === id)) return prev;
      return [...prev, { ...bet, id }];
    });
  }, []);

  const showReferralReward = useCallback((payload) => {
    if (payload?.amount) setReferralReward(payload);
  }, []);

  const accountValue = useMemo(
    () => ({
      account,
      loading,
      signIn,
      signOut,
      adjustBalance,
      setAccount,
      openDeposit,
      openWithdraw,
      refresh,
      showWin,
      showReferralReward,
      notifications,
      unreadCount,
      clearNotifications,
      markNotificationRead,
    }),
    [
      account,
      loading,
      signIn,
      signOut,
      adjustBalance,
      setAccount,
      openDeposit,
      openWithdraw,
      refresh,
      showWin,
      showReferralReward,
      notifications,
      unreadCount,
      clearNotifications,
      markNotificationRead,
    ],
  );

  const balance = account?.balance ?? 0;

  return (
    <AccountCtx.Provider value={accountValue}>
      <ToastCtx.Provider value={{ toast }}>
        {children}

        <WinCelebrationOverlay wins={wins} onClose={dismissWins} onViewSlip={() => navigate('/my-bets')} />

        {referralReward && (
          <ReferralCelebration
            amount={referralReward.amount}
            name={referralReward.referredName}
            onClose={() => setReferralReward(null)}
          />
        )}

        <DepositResultModal
          result={depositResults[0] || null}
          onClose={() => setDepositResults((prev) => prev.slice(1))}
        />

        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`toast toast-${t.kind}`}
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
            >
              <span className="toast-icon" aria-hidden="true">
                {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : t.kind === 'warn' ? '⚠' : 'ℹ'}
              </span>
              <span className="toast-body">{t.message}</span>
            </button>
          ))}
        </div>

        <dialog ref={depositDlg} className="deposit-dlg">
          {(() => {
            const amtNum = parseFloat(String(depositAmt).replace(/,/g, '')) || 0;
            const canSubmit = amtNum >= MIN_DEPOSIT && amtNum <= MAX_DEPOSIT && !busy;
            const accountIdentifier = account?.phone || account?.email || '';
            const maskedIdentifier = maskPhone(accountIdentifier);
            const identifierLabel = account?.phone ? 'Account phone' : 'Account';
            const closeDlg = () => {
              try {
                depositDlg.current?.close();
              } catch {
                /* ignore */
              }
            };
            const selectMethod = (m) => {
              setErr('');
              setDepositMethod(m);
            };

            return (
              <>
                <TxHeader
                  asDialog
                  title="Deposit"
                  onBack={closeDlg}
                  onForward={() => {
                    closeDlg();
                    navigate(1);
                  }}
                  onHelp={() => {
                    closeDlg();
                    navigate('/help');
                  }}
                  onHome={() => {
                    closeDlg();
                    navigate('/');
                  }}
                />

                <div className="deposit-body">
                  <div className="dep-section-label">Choose payment method</div>

                  <div className="dep-method-grid" role="radiogroup" aria-label="Payment method">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={depositMethod === 'paystack'}
                      className="dep-tile"
                      onClick={() => selectMethod('paystack')}
                    >
                      <div className="dep-tile-icon" style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="2" y="6" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <div className="dep-tile-title">Paystack</div>
                      <div className="dep-tile-sub">Card, bank &amp; mobile money</div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={depositMethod === 'paybill'}
                      className="dep-tile"
                      onClick={() => selectMethod('paybill')}
                    >
                      <div className="dep-tile-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 21h18" />
                          <path d="M5 21V10l7-4 7 4v11" />
                          <path d="M9 21v-6h6v6" />
                        </svg>
                      </div>
                      <div className="dep-tile-title">Paybill</div>
                      <div className="dep-tile-sub">Mobile money</div>
                    </button>
                  </div>

                  <div className="dep-account-row">
                    <div className="dep-account-icon" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                    </div>
                    <div className="dep-account-text">{maskedIdentifier}</div>
                    <div className="dep-account-label">{identifierLabel}</div>
                  </div>

                  <div className="dep-balance-row">
                    Balance (GHS) <span className="dep-balance-amt">¢ {formatAmt(balance)}</span>
                  </div>

                  {depositMethod === 'paystack' ? (
                    <form onSubmit={submitDeposit}>
                      <div className="dep-amount-card">
                        <div className="dep-amount-head">
                          <label htmlFor="dep-amt">Amount (GHS)</label>
                          <span className="dep-amount-hint">min. {MIN_DEPOSIT}.00</span>
                        </div>
                        <input
                          id="dep-amt"
                          type="number"
                          min={MIN_DEPOSIT}
                          max={MAX_DEPOSIT}
                          step="1"
                          inputMode="decimal"
                          value={depositAmt}
                          onChange={(e) => setDepositAmt(e.target.value)}
                          placeholder={`min. ${MIN_DEPOSIT}`}
                          autoFocus
                        />
                      </div>

                      <div className="dep-preset-grid">
                        {[300, 500, 2000, 5000, 10000].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="dep-preset"
                            onClick={() => setDepositAmt(String(n))}
                            aria-label={`Set amount to GHS ${n}`}
                          >
                            {n.toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>

                      {err && <div className="dep-err">{err}</div>}

                      <button type="submit" disabled={!canSubmit} className="dep-submit">
                        {busy ? 'Processing…' : 'Top Up Now'}
                      </button>

                      <ol className="dep-rules">
                        <li>Maximum per transaction is GHS {MAX_DEPOSIT.toLocaleString('en-US')}.00</li>
                        <li>Minimum per transaction is GHS {MIN_DEPOSIT}.00</li>
                        <li>Deposit is free, no transaction fees.</li>
                        <li>Your balance can only be withdrawn to the mobile number that&rsquo;s registered with.</li>
                      </ol>
                    </form>
                  ) : (
                    <div className="dep-paybill-body">
                      <div className="dep-amount-card">
                        <div className="dep-amount-head">
                          <label htmlFor="dep-amt-pb">Amount (GHS)</label>
                          <span className="dep-amount-hint">min. {MIN_DEPOSIT}.00</span>
                        </div>
                        <input
                          id="dep-amt-pb"
                          type="number"
                          min={MIN_DEPOSIT}
                          max={MAX_DEPOSIT}
                          step="1"
                          inputMode="decimal"
                          value={depositAmt}
                          onChange={(e) => setDepositAmt(e.target.value)}
                          placeholder={`min. ${MIN_DEPOSIT}`}
                        />
                      </div>

                      <div className="dep-preset-grid">
                        {[300, 500, 2000, 5000, 10000].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="dep-preset"
                            onClick={() => setDepositAmt(String(n))}
                            aria-label={`Set amount to GHS ${n}`}
                          >
                            {n.toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>

                      <PaybillInstructions
                        paybillId="222000"
                        accountRef={account?.phone || account?.email || ''}
                        context="deposit"
                      />
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </dialog>
      </ToastCtx.Provider>
    </AccountCtx.Provider>
  );
}

/* ─── Referral reward celebration overlay ───────────────── */

function ReferralCelebration({ amount, name, onClose }) {
  const [show, setShow] = useState(true);
  const dismiss = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };
  if (!show) return null;
  return (
    <div
      className="rfp-celebrate"
      onClick={dismiss}
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(10,8,2,.78)', backdropFilter: 'blur(6px)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
        }}
        aria-hidden
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute', top: -16,
              left: `${Math.random() * 100}%`,
              width: 8, height: 12, borderRadius: 2,
              background: ['#f7c948','#e8b94a','#fff3b8','#d4a72c','#f3e9cf'][i % 5],
              animation: `rfpFall 2.6s linear ${Math.random() * 1.4}s both`,
            }}
          />
        ))}
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: 'min(340px, 100%)', textAlign: 'center',
          background: 'linear-gradient(180deg, #161513 0%, #0a0a0a 100%)',
          borderRadius: 20, padding: '26px 22px',
          boxShadow: '0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(232,185,74,.25) inset',
          animation: 'rfpPop .45s cubic-bezier(.18,.88,.36,1.2) both',
        }}
      >
        <svg viewBox="0 0 120 120" style={{ width: 84, height: 84, margin: '0 auto' }}>
          <circle
            cx="60" cy="60" r="52"
            fill="none" stroke="#f7c948" strokeWidth="4" strokeLinecap="round"
            strokeDasharray="340" transform="rotate(-90)" transformOrigin="center"
            style={{ animation: 'rfpRing .7s ease-out .1s both' }}
          />
          <path
            d="M38 62l14 14 30-32"
            fill="none" stroke="#f7c948" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="120" strokeDashoffset="120"
            style={{ animation: 'rfpCheck .5s ease-out .5s both' }}
          />
        </svg>
        <h2 style={{ margin: '12px 0 6px', fontSize: 24, fontWeight: 900, color: '#f3e9cf' }}>
          Congratulations!
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'rgba(243,233,207,.7)' }}>
          You earned <strong style={{ color: '#f7c948' }}>GHS {Number(amount || 0).toFixed(2)}</strong>
          {name ? ` from ${name}` : ''}. It&rsquo;s already in your wallet.
        </p>
        <button
          type="button"
          onClick={dismiss}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
            background: 'linear-gradient(135deg, #f7c948 0%, #d4a72c 100%)',
            color: '#1a1300',
            boxShadow: '0 8px 20px rgba(232,185,74,.3)',
          }}
        >
          Awesome!
        </button>
      </div>
      <style>{`
@keyframes rfpFall {
  0% { transform: translate(0,-20px) rotate(0); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translate(var(--tx,20px),110vh) rotate(720deg); opacity: 0; }
}
@keyframes rfpPop {
  0% { transform: scale(.85) translateY(16px); opacity: 0; }
  60% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes rfpRing {
  0% { stroke-dashoffset: 340; }
  100% { stroke-dashoffset: 0; }
}
@keyframes rfpCheck {
  0% { stroke-dashoffset: 120; }
  100% { stroke-dashoffset: 0; }
}
      `}</style>
    </div>
  );
}
