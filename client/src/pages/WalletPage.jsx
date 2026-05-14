import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { fetchTransactions } from '../api/betApi.js';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' });
}

const txLabel = {
  deposit:       'Deposit',
  withdraw:      'Withdrawal',
  withdrawal:    'Withdrawal',
  bet_placed:    'Bet placed',
  bet_won:       'Bet won',
  bet_lost:      'Bet lost',
  cash_out:      'Cash-out',
  jackpot_entry: 'Jackpot entry',
};

export default function WalletPage() {
  const navigate = useNavigate();
  const { account, openDeposit, openWithdraw } = useAccount();
  const { toast } = useToast();
  const [txs, setTxs]   = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) { navigate('/login?next=/wallet'); return; }
    let alive = true;
    (async () => {
      try {
        setBusy(true);
        const data = await fetchTransactions();
        if (alive) setTxs(data.transactions || []);
      } catch (e) {
        if (alive) toast(e.message || 'Could not load transactions.', 'error');
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [account, navigate, toast]);

  if (!account) return null;

  const balance        = account.balance ?? 0;
  const totalDeposited = Number(account.totalDeposited || 0);
  const withdrawCap    = Math.floor(totalDeposited / 0.10);

  return (
    <main className="wallet-page">
      <div className="wallet-shell">
        <header className="wallet-hero fade-up">
          <div className="wallet-hero-grain" aria-hidden />
          <div className="wallet-hero-inner">
            <div className="wallet-hero-label">Available balance</div>
            <div className="wallet-hero-amt">
              <span className="cur">GHS</span>
              <span className="amt">{fmt(balance)}</span>
            </div>
            <div className="wallet-hero-meta">
              <span>Lifetime deposits <strong>GHS {fmt(totalDeposited)}</strong></span>
              <span className="dot" />
              <span>Withdraw cap <strong>GHS {fmt(withdrawCap)}</strong></span>
            </div>
            <div className="wallet-hero-actions">
              <button type="button" className="btn btn-primary wallet-cta" onClick={openDeposit}>
                + Deposit
              </button>
              <button type="button" className="btn btn-ghost wallet-cta" onClick={openWithdraw}>
                Withdraw
              </button>
            </div>
          </div>
        </header>

        <section className="wallet-cards fade-up" style={{ animationDelay: '0.05s' }}>
          <article className="wallet-card">
            <header className="wallet-card-head">
              <h3>Deposit conditions</h3>
              <span className="wallet-pill wallet-pill-good">Instant</span>
            </header>
            <ul className="wallet-list">
              <li><span>Minimum deposit</span><strong>GHS 300</strong></li>
              <li><span>Methods</span><strong>MoMo · Vodafone · AirtelTigo · Card</strong></li>
              <li><span>Processing</span><strong>Instant</strong></li>
              <li><span>Fees</span><strong>0%</strong></li>
              <li><span>Currency</span><strong>GHS only</strong></li>
            </ul>
          </article>

          <article className="wallet-card">
            <header className="wallet-card-head">
              <h3>Withdrawal conditions</h3>
              <span className="wallet-pill wallet-pill-warn">Verified accounts</span>
            </header>
            <ul className="wallet-list">
              <li><span>Minimum withdrawal</span><strong>GHS 10,000</strong></li>
              <li><span>Deposit-to-withdraw ratio</span><strong>10% lifetime deposits required</strong></li>
              <li><span>Processing</span><strong>Within 24 hours</strong></li>
              <li><span>Fees</span><strong>0%</strong></li>
              <li><span>Methods</span><strong>MoMo to phone on file</strong></li>
              <li><span>Identity check</span><strong>Required above GHS 50,000</strong></li>
            </ul>
            <p className="wallet-note">
              Example: to withdraw <strong>GHS 10,000</strong> you must have deposited at least <strong>GHS 1,000</strong> in your lifetime.
            </p>
          </article>
        </section>

        <section className="wallet-history fade-up" style={{ animationDelay: '0.1s' }}>
          <header className="wallet-history-head">
            <h3>Recent transactions</h3>
            <span className="wallet-history-count">{txs.length} entries</span>
          </header>

          {busy && !txs.length ? (
            <p className="wallet-empty">Loading…</p>
          ) : !txs.length ? (
            <p className="wallet-empty">No transactions yet — make your first deposit to get started.</p>
          ) : (
            <ul className="wallet-tx-list">
              {txs.slice(0, 20).map((t) => {
                const isCredit = (t.amount ?? 0) > 0;
                return (
                  <li key={t.id} className="wallet-tx">
                    <div className={`wallet-tx-icon ${isCredit ? 'credit' : 'debit'}`} aria-hidden>
                      {isCredit ? '↓' : '↑'}
                    </div>
                    <div className="wallet-tx-body">
                      <div className="wallet-tx-title">{txLabel[t.kind] || t.kind}</div>
                      <div className="wallet-tx-meta">{relTime(t.at || t.createdAt)} · {t.status || 'completed'}</div>
                    </div>
                    <div className={`wallet-tx-amt ${isCredit ? 'credit' : 'debit'}`}>
                      {isCredit ? '+' : ''}{fmt(t.amount)} <em>GHS</em>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <style>{WALLET_CSS}</style>
    </main>
  );
}

const WALLET_CSS = `
.wallet-page {
  padding: 28px 0 60px;
  min-height: calc(100vh - 200px);
}
.wallet-shell {
  max-width: 980px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex; flex-direction: column; gap: 20px;
}
.wallet-hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 28px;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
  border: 1px solid rgba(197, 255, 61, .18);
  box-shadow: 0 16px 50px rgba(0, 0, 0, .35);
}
.wallet-hero-grain {
  position: absolute; inset: -10%;
  background: radial-gradient(600px 300px at 80% -10%, rgba(197, 255, 61, .18), transparent 60%),
              radial-gradient(500px 320px at -10% 110%, rgba(106, 208, 255, .14), transparent 60%);
  pointer-events: none;
}
.wallet-hero-inner { position: relative; z-index: 1; }
.wallet-hero-label {
  font-size: 12px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--text-dim);
  font-weight: 700;
}
.wallet-hero-amt {
  margin: 8px 0 12px;
  display: flex; align-items: baseline; gap: 10px;
  font-variant-numeric: tabular-nums;
}
.wallet-hero-amt .cur { color: var(--text-soft); font-size: 16px; font-weight: 700; }
.wallet-hero-amt .amt {
  font-size: 44px; font-weight: 900; letter-spacing: -.02em;
  background: linear-gradient(120deg, var(--accent), var(--accent-cool));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.wallet-hero-meta {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 13px; color: var(--text-soft);
  margin-bottom: 18px;
}
.wallet-hero-meta .dot {
  display: inline-block; width: 4px; height: 4px; border-radius: 50%;
  background: var(--text-dim);
}
.wallet-hero-actions {
  display: flex; gap: 10px; flex-wrap: wrap;
}
.wallet-cta { min-width: 140px; padding: 12px 18px; font-weight: 700; }

.wallet-cards {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.wallet-card {
  background: var(--surface);
  border: 1px solid var(--surface-2);
  border-radius: 18px;
  padding: 20px;
  transition: border-color .2s ease, transform .2s ease;
}
.wallet-card:hover { border-color: rgba(197, 255, 61, .25); transform: translateY(-2px); }
.wallet-card-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.wallet-card-head h3 { margin: 0; font-size: 16px; font-weight: 800; }
.wallet-pill {
  font-size: 10px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 999px;
}
.wallet-pill-good { background: rgba(197, 255, 61, .12); color: var(--accent); }
.wallet-pill-warn { background: rgba(255, 181, 71, .12); color: var(--accent-warm); }

.wallet-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.wallet-list li {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--surface-2);
  font-size: 13px;
}
.wallet-list li:last-child { border-bottom: none; }
.wallet-list li span { color: var(--text-soft); }
.wallet-list li strong { color: var(--text); font-weight: 700; text-align: right; }

.wallet-note {
  margin: 10px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-soft);
  background: rgba(106, 208, 255, .06);
  border: 1px solid rgba(106, 208, 255, .14);
  border-radius: 10px;
}
.wallet-note strong { color: var(--accent-cool); font-weight: 700; }

.wallet-history {
  background: var(--surface);
  border: 1px solid var(--surface-2);
  border-radius: 18px;
  padding: 20px;
}
.wallet-history-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.wallet-history-head h3 { margin: 0; font-size: 16px; font-weight: 800; }
.wallet-history-count { font-size: 12px; color: var(--text-dim); }

.wallet-empty { color: var(--text-dim); font-size: 13px; padding: 16px 0; }

.wallet-tx-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.wallet-tx {
  display: grid; grid-template-columns: 36px 1fr auto;
  align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--surface-2);
}
.wallet-tx:last-child { border-bottom: none; }
.wallet-tx-icon {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 14px; font-weight: 800;
}
.wallet-tx-icon.credit { background: rgba(197, 255, 61, .12); color: var(--accent); }
.wallet-tx-icon.debit  { background: rgba(255, 77, 61,  .12); color: var(--accent-hot); }
.wallet-tx-title { font-size: 14px; font-weight: 700; }
.wallet-tx-meta { font-size: 11.5px; color: var(--text-dim); }
.wallet-tx-amt {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}
.wallet-tx-amt em { font-style: normal; font-size: 11px; color: var(--text-dim); margin-left: 2px; }
.wallet-tx-amt.credit { color: var(--accent); }
.wallet-tx-amt.debit  { color: var(--accent-hot); }

.fade-up {
  animation: walletFadeUp .45s ease both;
}
@keyframes walletFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 720px) {
  .wallet-shell { padding: 0 12px; }
  .wallet-hero { padding: 22px 18px; }
  .wallet-hero-amt .amt { font-size: 36px; }
  .wallet-cards { grid-template-columns: 1fr; }
  .wallet-card { padding: 16px; }
  .wallet-history { padding: 16px; }
  .wallet-cta { flex: 1; min-width: 0; }
}
`;
