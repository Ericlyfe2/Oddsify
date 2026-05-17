import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  setTokens, clearTokens, getAccess,
  fetchMe, logout as apiLogout,
  deposit as apiDeposit, withdraw as apiWithdraw,
  fetchUnacknowledgedWins, acknowledgeBet,
} from '../api/betApi.js';
import { onLive, refreshAuth, disconnectSocket } from '../api/socketClient.js';
import WinTrophyModal from '../components/WinTrophyModal.jsx';

export const AccountCtx = React.createContext(null);
export const ToastCtx   = React.createContext(null);

const EMPTY_ACCOUNT = {
  account: null, loading: false,
  signIn: () => {}, signOut: () => {}, adjustBalance: () => {},
  setAccount: () => {}, openDeposit: () => {}, openWithdraw: () => {},
  refresh: () => {},
};
const EMPTY_TOAST = { toast: () => {} };

export const useAccount = () => React.useContext(AccountCtx) || EMPTY_ACCOUNT;
export const useToast   = () => React.useContext(ToastCtx)   || EMPTY_TOAST;

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AppProviders({ children }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(!!getAccess());

  const [toasts, setToasts] = useState([]);

  const depositDlg  = useRef(null);
  const withdrawDlg = useRef(null);
  const MIN_DEPOSIT  = 300;
  const MIN_WITHDRAW = 550;
  const WITHDRAW_DEPOSIT_RATIO = 0.10;
  const [depositAmt,  setDepositAmt]   = useState(String(MIN_DEPOSIT));
  const [withdrawAmt, setWithdrawAmt]  = useState(String(MIN_WITHDRAW));
  const [depositMethod, setDepositMethod] = useState('momo');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const [wins, setWins] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((msg, kind = 'info', opts = {}) => {
    if (!msg) return null;
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ttl = typeof opts.ttl === 'number' ? opts.ttl : 3500;
    setToasts((cur) => [...cur.slice(-3), { id, message: msg, kind }]);
    if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
    return id;
  }, [dismissToast]);

  const refresh = useCallback(async () => {
    if (!getAccess()) { setAccount(null); setLoading(false); return null; }
    try {
      const data = await fetchMe();
      setAccount(data.account);
      return data.account;
    } catch {
      clearTokens();
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll for freshly-settled wins the user hasn't seen.
  // (Realtime socket also pushes bet:won — poll is the safety net.)
  useEffect(() => {
    if (!account) { setWins([]); disconnectSocket(); return; }
    let alive = true;

    refreshAuth(); // re-handshake the socket with the now-current access token

    const tick = async () => {
      try {
        const { bets } = await fetchUnacknowledgedWins();
        if (alive && Array.isArray(bets) && bets.length) setWins(bets);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 60_000);

    // Live updates pushed by the server.
    const offWallet = onLive('wallet:update', ({ balance }) => {
      if (typeof balance === 'number') {
        setAccount((prev) => prev ? { ...prev, balance } : prev);
      }
    });
    const offWin = onLive('bet:won', async () => { try { await tick(); } catch {} });
    const offSettled = onLive('bet:settled', async () => { try { await tick(); } catch {} });

    return () => {
      alive = false;
      clearInterval(id);
      offWallet?.(); offWin?.(); offSettled?.();
    };
  }, [account]);

  const dismissWins = useCallback(async () => {
    const toAck = [...wins];
    setWins([]);
    for (const b of toAck) {
      try { await acknowledgeBet(b.id); } catch { /* swallow */ }
    }
    // Refresh balance in case settlement credited the wallet between calls.
    try { await refresh(); } catch { /* ignore */ }
  }, [wins, refresh]);

  /** Persist tokens + load account from a successful auth response. */
  const signIn = useCallback((authResponse) => {
    if (authResponse?.accessToken) setTokens(authResponse.accessToken, authResponse.refreshToken);
    if (authResponse?.account) setAccount(authResponse.account);
    if (authResponse?.account) toast(`Signed in as ${authResponse.account.displayName || authResponse.account.email}`);
  }, [toast]);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore network */ }
    clearTokens();
    setAccount(null);
    toast('Signed out.');
    navigate('/', { replace: true });
  }, [toast, navigate]);

  const adjustBalance = useCallback((delta, label) => {
    setAccount((prev) => prev ? { ...prev, balance: Number((prev.balance + delta).toFixed(2)) } : prev);
    if (label) toast(label);
  }, [toast]);

  const openDeposit = useCallback(() => {
    if (!account) { toast('Sign in to deposit.'); navigate('/login'); return; }
    setErr(''); setDepositAmt(String(MIN_DEPOSIT)); setDepositMethod('momo');
    depositDlg.current?.showModal();
  }, [account, toast, navigate]);

  const openWithdraw = useCallback(() => {
    if (!account) { toast('Sign in to withdraw.'); navigate('/login'); return; }
    navigate('/withdraw');
  }, [account, toast, navigate]);

  const submitDeposit = async (e) => {
    e.preventDefault();
    setErr('');
    const amt = parseFloat(String(depositAmt).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid amount.'); return; }
    if (amt < MIN_DEPOSIT) { setErr(`Minimum deposit is GHS ${MIN_DEPOSIT}.`); return; }
    try {
      setBusy(true);
      const data = await apiDeposit(amt, depositMethod);
      setAccount(data.account);
      depositDlg.current?.close();
      const labels = { momo: 'MoMo', vodafone: 'Vodafone Cash', airteltigo: 'AirtelTigo Money', card: 'Card' };
      toast(`Deposited GHS ${formatAmt(amt)} via ${labels[depositMethod] || depositMethod}.`);
    } catch (e) {
      setErr(e.message || 'Deposit failed.');
    } finally { setBusy(false); }
  };

  const submitWithdraw = async (e) => {
    e.preventDefault();
    setErr('');
    const amt = parseFloat(String(withdrawAmt).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid amount.'); return; }
    if (amt < MIN_WITHDRAW) { setErr(`Minimum withdrawal is GHS ${MIN_WITHDRAW.toLocaleString('en-US')}.`); return; }
    const totalDeposited = Number(account?.totalDeposited || 0);
    const required = Number((amt * WITHDRAW_DEPOSIT_RATIO).toFixed(2));
    if (totalDeposited < required) {
      setErr(`Deposit at least GHS ${required.toLocaleString('en-US')} before withdrawing GHS ${amt.toLocaleString('en-US')}. You've deposited GHS ${totalDeposited.toLocaleString('en-US')}.`);
      return;
    }
    if (amt > (account?.balance ?? 0)) { setErr('Insufficient balance.'); return; }
    try {
      setBusy(true);
      const data = await apiWithdraw(amt, 'momo');
      setAccount(data.account);
      withdrawDlg.current?.close();
      toast(`Withdrew GHS ${formatAmt(amt)} to your wallet.`);
    } catch (e) {
      setErr(e.message || 'Withdrawal failed.');
    } finally { setBusy(false); }
  };

  const accountValue = useMemo(() => ({
    account, loading,
    signIn, signOut, adjustBalance, setAccount,
    openDeposit, openWithdraw, refresh,
  }), [account, loading, signIn, signOut, adjustBalance, openDeposit, openWithdraw, refresh]);

  const balance = account?.balance ?? 0;

  return (
    <AccountCtx.Provider value={accountValue}>
      <ToastCtx.Provider value={{ toast }}>
        {children}

        <WinTrophyModal
          wins={wins}
          onClose={dismissWins}
          onViewSlip={() => navigate('/my-bets')}
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
                {t.kind === 'success' ? '✓' :
                 t.kind === 'error'   ? '!' :
                 t.kind === 'warn'    ? '⚠' : 'ℹ'}
              </span>
              <span className="toast-body">{t.message}</span>
            </button>
          ))}
        </div>

        <dialog ref={depositDlg} className="bv-dialog">
          <h3>Deposit funds</h3>
          <form onSubmit={submitDeposit}>
            <label className="dlg-label">Method</label>
            <div className="pay-methods">
              {[['momo', 'MTN MoMo'], ['vodafone', 'Vodafone Cash'], ['airteltigo', 'AirtelTigo'], ['card', 'Card']].map(([k, label]) => (
                <button key={k} type="button" className={`pay-method${depositMethod === k ? ' active' : ''}`} onClick={() => setDepositMethod(k)}>{label}</button>
              ))}
            </div>
            <label className="dlg-label" htmlFor="dep-amt">Amount (GHS) <small style={{ color: 'var(--text-dim)', marginLeft: 6 }}>min {MIN_DEPOSIT}</small></label>
            <input id="dep-amt" type="number" min={MIN_DEPOSIT} step="1" inputMode="decimal" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} autoFocus />
            <div className="quick-stakes" style={{ marginTop: 8 }}>
              {[300, 500, 1000, 2000].map((n) => (
                <button key={n} type="button" className="quick-stake" onClick={() => setDepositAmt(String(n))}>GHS {n}</button>
              ))}
            </div>
            {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
            <div className="bv-dialog-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={() => depositDlg.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary"
                      disabled={busy || !(parseFloat(String(depositAmt).replace(/,/g, '')) >= MIN_DEPOSIT)}>
                {busy ? 'Processing…' : 'Deposit'}
              </button>
            </div>
          </form>
        </dialog>

        <dialog ref={withdrawDlg} className="bv-dialog">
          <h3>Withdraw funds</h3>
          <form onSubmit={submitWithdraw}>
            {(() => {
              const amtNum = parseFloat(String(withdrawAmt).replace(/,/g, '')) || 0;
              const totalDeposited = Number(account?.totalDeposited || 0);
              const required = Number((amtNum * WITHDRAW_DEPOSIT_RATIO).toFixed(2));
              const belowMin = amtNum > 0 && amtNum < MIN_WITHDRAW;
              const failsRatio = amtNum >= MIN_WITHDRAW && totalDeposited < required;
              const overBalance = amtNum > balance;
              const invalid = !amtNum || belowMin || failsRatio || overBalance;
              return (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>
                    Available: <strong>GHS {formatAmt(balance)}</strong>
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Total deposited so far: <strong>GHS {formatAmt(totalDeposited)}</strong> · You can withdraw up to <strong>GHS {formatAmt(Math.floor(totalDeposited / WITHDRAW_DEPOSIT_RATIO))}</strong> based on your deposit history.
                  </p>
                  <label className="dlg-label" htmlFor="wd-amt">
                    Amount (GHS) <small style={{ color: 'var(--text-dim)', marginLeft: 6 }}>min {MIN_WITHDRAW.toLocaleString('en-US')}</small>
                  </label>
                  <input id="wd-amt" type="number" min={MIN_WITHDRAW} step="1" inputMode="decimal"
                         value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} autoFocus />
                  <div className="quick-stakes" style={{ marginTop: 8 }}>
                    {[10_000, 25_000, 50_000].map((n) => (
                      <button key={n} type="button" className="quick-stake" onClick={() => setWithdrawAmt(String(n))}>GHS {n.toLocaleString('en-US')}</button>
                    ))}
                    <button type="button" className="quick-stake" onClick={() => setWithdrawAmt(String(Math.max(MIN_WITHDRAW, Math.floor(balance))))}>MAX</button>
                  </div>
                  <p style={{ fontSize: 12, color: failsRatio ? 'var(--danger, #ff5d5d)' : 'var(--text-dim)', marginTop: 10 }}>
                    To withdraw GHS {amtNum ? amtNum.toLocaleString('en-US') : '—'}, you need at least <strong>GHS {required ? required.toLocaleString('en-US') : '—'}</strong> in lifetime deposits (10%).
                  </p>
                  {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
                  <div className="bv-dialog-actions" style={{ marginTop: 14 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => withdrawDlg.current?.close()}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || invalid}>{busy ? 'Processing…' : 'Withdraw'}</button>
                  </div>
                </>
              );
            })()}
          </form>
        </dialog>
      </ToastCtx.Provider>
    </AccountCtx.Provider>
  );
}
