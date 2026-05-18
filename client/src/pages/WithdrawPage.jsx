import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { fetchTransactions, withdraw } from '../api/betApi.js';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTxDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${hrs}:${mins}`;
}

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { account, refresh, setAccount, openDeposit } = useAccount();
  const { toast } = useToast();
  const [txs, setTxs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('momo'); // 'momo' | 'vodafone' | 'airteltigo'
  const [phone, setPhone] = useState('+233 59****435');
  const [err, setErr] = useState('');
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showDepositReqModal, setShowDepositReqModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  const MIN_WITHDRAW = 550;
  const MAX_WITHDRAW = 1000000;
  const WITHDRAW_DEPOSIT_RATIO = 0.10;

  useEffect(() => {
    if (!account) {
      navigate('/login?next=/withdraw');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const data = await fetchTransactions();
        if (alive) {
          const withdrawals = (data.transactions || []).filter(t => t.kind === 'withdraw' || t.kind === 'withdrawal');
          setTxs(withdrawals);
        }
      } catch (e) {
        console.error('Failed to load transactions', e);
      }
    })();
    return () => { alive = false; };
  }, [account, navigate]);

  if (!account) return null;

  const balance = account.balance ?? 0;
  const totalDeposited = Number(account.totalDeposited || 0);
  const amtNum = parseFloat(String(amount).replace(/,/g, '')) || 0;
  const required = Number((amtNum * WITHDRAW_DEPOSIT_RATIO).toFixed(2));
  const failsRatio = amtNum >= MIN_WITHDRAW && totalDeposited < required;

  // Verification state (check kycStatus or simulate)
  const isVerified = account.kycStatus === 'verified';

  // Validation checks
  const isAmountValid = amtNum >= MIN_WITHDRAW && amtNum <= MAX_WITHDRAW && amtNum <= balance && !failsRatio;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAmountValid) return;
    
    // Intercept withdrawal and trigger deposit requirement popup
    setShowDepositReqModal(true);
  };

  const executeMockWithdrawal = async () => {
    setShowDepositReqModal(false);
    setErr('');
    try {
      setBusy(true);
      const data = await withdraw(amtNum, method);
      setAccount(data.account);
      toast(`Withdrew ₵${fmt(amtNum)} successfully!`, 'success');
      setAmount('');
      
      // Reload transactions
      const txData = await fetchTransactions();
      const withdrawals = (txData.transactions || []).filter(t => t.kind === 'withdraw' || t.kind === 'withdrawal');
      setTxs(withdrawals);
    } catch (e) {
      setErr(e.message || 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  const methodLabels = {
    momo: 'MTN Mobile Money',
    vodafone: 'Telecel Cash',
    airteltigo: 'AT Money'
  };

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (newPhone.trim()) {
      setPhone(newPhone.trim());
      setNewPhone('');
      setShowPhoneModal(false);
      toast('Withdrawal account switched successfully.', 'success');
    }
  };

  const triggerGoToDeposit = () => {
    setShowDepositReqModal(false);
    openDeposit(); // Trigger the default deposit modal
  };

  return (
    <main className="w-page-wrapper">
      <div className="w-mobile-container">
        
        {/* Mock Mobile Header */}
        <header className="w-mock-header">
          <button type="button" className="w-header-icon" onClick={() => navigate(-1)} aria-label="Go Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="w-header-title">Withdraw</h1>
          <div className="w-header-right-actions">
            <button type="button" className="w-header-icon" onClick={() => navigate('/help')} aria-label="Help">
              <span className="w-icon-text">?</span>
            </button>
            <button type="button" className="w-header-icon" onClick={() => navigate('/')} aria-label="Home">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="w-content-scroll">

          {/* Account Verification Status Section */}
          <div className={`w-verification-card fade-up ${isVerified ? 'verified-bg' : 'unverified-bg'}`}>
            <div className="w-verification-header">
              <span className="w-verification-label">Account Verification Status</span>
              <span className={`w-verification-badge ${isVerified ? 'verified-badge' : 'unverified-badge'}`}>
                {isVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="w-verification-desc">
              {isVerified 
                ? 'Your account is verified. You are eligible for instant automatic withdrawals.' 
                : 'A one-time verification deposit of GHS 1,000.00 is required to authorize and secure your Mobile Money wallet for withdrawals.'}
            </p>
          </div>
          
          {/* Available Balance Card */}
          <div className="w-balance-card fade-up" style={{ animationDelay: '0.05s' }}>
            <div className="w-balance-label">Available Balance</div>
            <div className="w-balance-value">₵ {fmt(balance)}</div>
            <div className="w-balance-currency">Currency: GHS</div>
          </div>

          {/* Account/Phone Selection Card */}
          <div className="w-selection-card fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="w-sel-left">
              <div className="w-sel-icon-circle phone-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>
              <div className="w-sel-details">
                <div className="w-sel-title">{phone}</div>
                <div className="w-sel-subtitle">Account: {phone}</div>
              </div>
            </div>
            <button type="button" className="w-switch-btn" onClick={() => setShowPhoneModal(true)}>
              Switch <span className="chevron">&gt;</span>
            </button>
          </div>

          {/* Network Selection Card */}
          <div className="w-selection-card fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="w-sel-left">
              <div className="w-sel-icon-circle wallet-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="12" y1="10" x2="12" y2="10" />
                </svg>
              </div>
              <div className="w-sel-details">
                <div className="w-sel-title">{methodLabels[method]}</div>
              </div>
            </div>
            <button type="button" className="w-switch-btn" onClick={() => setShowMethodModal(true)}>
              Switch <span className="chevron">&gt;</span>
            </button>
          </div>

          {/* Amount Card & Form */}
          <form onSubmit={handleSubmit} className="w-form fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="w-amount-card">
              <div className="w-amount-card-header">
                <label className="w-amount-label" htmlFor="wd-amount-input">Amount (GHS)</label>
                <span className="w-amount-min">min. ₵ {MIN_WITHDRAW}</span>
              </div>
              <input
                id="wd-amount-input"
                type="number"
                pattern="[0-9]*"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`min. ${MIN_WITHDRAW}`}
                className="w-amount-input"
                disabled={busy}
              />
            </div>

            {failsRatio && (
              <div className="w-error-box">
                To withdraw ₵{amtNum.toLocaleString('en-US')}, you need at least <strong>₵{required.toLocaleString('en-US')}</strong> in lifetime deposits (10%). Current: ₵{totalDeposited.toLocaleString('en-US')}.
              </div>
            )}

            {err && <div className="w-error-box">{err}</div>}

            <button
              type="submit"
              className={`w-submit-btn ${isAmountValid ? 'active' : ''}`}
              disabled={busy || !isAmountValid}
            >
              {busy ? 'Processing...' : 'Withdraw'}
            </button>
          </form>

          {/* Rules list */}
          <div className="w-rules-card fade-up" style={{ animationDelay: '0.25s' }}>
            <ol className="w-rules-list">
              <li>Minimum withdrawal <strong>₵ {MIN_WITHDRAW}</strong></li>
              <li>Processing within <strong>24 hours</strong></li>
              <li>Method: <strong>MoMo to phone on file</strong></li>
            </ol>
          </div>

          {/* Recent Transactions Section */}
          <div className="w-recent-section fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="w-recent-header">
              <h2 className="w-recent-title">Recent Transactions</h2>
              <button type="button" className="w-see-more-btn" onClick={() => navigate('/wallet')}>
                See more
              </button>
            </div>

            <div className="w-tx-list">
              {txs.length === 0 ? (
                /* Demo item that exactly matches mock if actual data is empty */
                <div className="w-tx-row">
                  <div className="w-tx-left">
                    <div className="w-tx-icon-box">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                      </svg>
                    </div>
                    <div className="w-tx-meta">
                      <div className="w-tx-title">Withdrawal</div>
                      <div className="w-tx-sub">{phone}</div>
                    </div>
                  </div>
                  <div className="w-tx-right">
                    <div className="w-tx-amt">₵200,000</div>
                    <div className="w-tx-badge approved">Approved</div>
                    <div className="w-tx-date">10 May 15:23</div>
                  </div>
                </div>
              ) : (
                txs.slice(0, 5).map((t) => (
                  <div key={t.id} className="w-tx-row">
                    <div className="w-tx-left">
                      <div className="w-tx-icon-box">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <polyline points="19 12 12 19 5 12" />
                        </svg>
                      </div>
                      <div className="w-tx-meta">
                        <div className="w-tx-title">Withdrawal</div>
                        <div className="w-tx-sub">{t.method ? methodLabels[t.method] : phone}</div>
                      </div>
                    </div>
                    <div className="w-tx-right">
                      <div className="w-tx-amt">₵{fmt(t.amount)}</div>
                      <div className={`w-tx-badge ${t.status || 'completed'}`}>
                        {t.status === 'completed' ? 'Approved' : t.status || 'Approved'}
                      </div>
                      <div className="w-tx-date">{formatTxDate(t.at || t.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>

        {/* Modal: Deposit Requirement Popup (Matches user's exact mockup) */}
        {showDepositReqModal && (
          <div className="w-drawer-overlay pop-fade-in" onClick={() => setShowDepositReqModal(false)}>
            <div className="w-deposit-req-modal" onClick={(e) => e.stopPropagation()}>
              <div className="w-req-modal-header">
                <h3>Deposit requirement</h3>
                <button type="button" className="w-req-close-btn" onClick={() => setShowDepositReqModal(false)} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="w-req-modal-body">
                <p className="w-req-main-text">
                  You need to deposit GHS 1,000.00 to your account to verify your account.
                </p>
                <div className="w-req-bullet-item">
                  <span className="bullet-dot">•</span>
                  <span className="bullet-text">Required amount: <strong>GHS 1,000.00</strong></span>
                </div>
              </div>
              <div className="w-req-modal-actions">
                <button type="button" className="w-req-primary-btn" onClick={triggerGoToDeposit}>
                  Go to Deposit
                </button>
                <button type="button" className="w-req-secondary-btn" onClick={() => setShowDepositReqModal(false)}>
                  Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Drawer: Select Network */}
        {showMethodModal && (
          <div className="w-drawer-overlay" onClick={() => setShowMethodModal(false)}>
            <div className="w-drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="w-drawer-header">
                <h3>Select Mobile Money Network</h3>
                <button type="button" className="w-drawer-close" onClick={() => setShowMethodModal(false)}>✕</button>
              </div>
              <div className="w-drawer-options">
                {[
                  { id: 'momo', label: 'MTN Mobile Money', color: '#ffcc00' },
                  { id: 'vodafone', label: 'Telecel Cash', color: '#e60000' },
                  { id: 'airteltigo', label: 'AT Money', color: '#0055ff' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`w-drawer-option-btn ${method === opt.id ? 'selected' : ''}`}
                    onClick={() => {
                      setMethod(opt.id);
                      setShowMethodModal(false);
                    }}
                  >
                    <span className="w-network-dot" style={{ backgroundColor: opt.color }}></span>
                    <span className="w-option-label">{opt.label}</span>
                    {method === opt.id && <span className="w-checkmark">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Drawer: Switch Account Phone */}
        {showPhoneModal && (
          <div className="w-drawer-overlay" onClick={() => setShowPhoneModal(false)}>
            <div className="w-drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="w-drawer-header">
                <h3>Switch Withdrawal Phone</h3>
                <button type="button" className="w-drawer-close" onClick={() => setShowPhoneModal(false)}>✕</button>
              </div>
              <form onSubmit={handlePhoneSubmit} className="w-drawer-form">
                <p className="w-drawer-desc">Enter the Mobile Money account number to receive withdrawals.</p>
                <input
                  type="text"
                  placeholder="+233 XX XXX XXXX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-drawer-input"
                  autoFocus
                  required
                />
                <button type="submit" className="w-drawer-submit-btn">Save Account</button>
              </form>
            </div>
          </div>
        )}

      </div>

      <style>{WITHDRAW_CSS}</style>
    </main>
  );
}

const WITHDRAW_CSS = `
.w-page-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 120px);
  padding: 20px 0 60px;
  background-color: var(--bg);
}

.w-mobile-container {
  width: 100%;
  max-width: 480px;
  background-color: #f6f8f6;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  border: 1px solid rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  height: 840px;
  position: relative;
  font-family: 'Bricolage Grotesque', sans-serif;
  color: #0f1413;
}

html[data-theme="dark"] .w-mobile-container {
  box-shadow: 0 10px 45px rgba(0,0,0,0.5);
  border-color: rgba(255,255,255,0.05);
}

/* Mock Mobile Header */
.w-mock-header {
  background-color: #1ec851;
  color: #ffffff;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(30,200,81,0.2);
}

.w-header-title {
  font-size: 19px;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
}

.w-header-icon {
  background: none;
  border: none;
  color: #ffffff;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.w-header-icon:hover {
  background-color: rgba(255,255,255,0.15);
}

.w-header-right-actions {
  display: flex;
  gap: 4px;
}

.w-icon-text {
  font-size: 17px;
  font-weight: 800;
}

/* Content Area */
.w-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
}

.w-content-scroll::-webkit-scrollbar {
  width: 5px;
}
.w-content-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.1);
  border-radius: 99px;
}

/* Verification Card */
.w-verification-card {
  border-radius: 14px;
  padding: 16px;
  border: 1px solid rgba(0,0,0,0.03);
}

.w-verification-card.unverified-bg {
  background-color: rgba(255, 181, 71, 0.08);
  border-color: rgba(255, 181, 71, 0.15);
}

.w-verification-card.verified-bg {
  background-color: rgba(30, 200, 81, 0.08);
  border-color: rgba(30, 200, 81, 0.15);
}

.w-verification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.w-verification-label {
  font-size: 13px;
  font-weight: 700;
  color: #0f1413;
}

.w-verification-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.w-verification-badge.unverified-badge {
  background-color: rgba(255, 181, 71, 0.15);
  color: #c87f00;
}

.w-verification-badge.verified-badge {
  background-color: rgba(30, 200, 81, 0.15);
  color: #1cb549;
}

.w-verification-desc {
  font-size: 11.5px;
  color: #606a64;
  line-height: 1.4;
  margin: 0;
}

/* Balance Card */
.w-balance-card {
  background-color: #ffffff;
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  border: 1px solid rgba(0,0,0,0.03);
}

.w-balance-label {
  font-size: 13px;
  color: #606a64;
  font-weight: 600;
  margin-bottom: 6px;
}

.w-balance-value {
  font-size: 28px;
  font-weight: 900;
  color: #0f1413;
  letter-spacing: -0.02em;
}

.w-balance-currency {
  font-size: 11px;
  color: #8c9690;
  margin-top: 4px;
  font-weight: 500;
}

/* Selection Cards */
.w-selection-card {
  background-color: #ffffff;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  border: 1px solid rgba(0,0,0,0.03);
  transition: transform 0.2s, border-color 0.2s;
}

.w-selection-card:hover {
  transform: translateY(-1px);
  border-color: rgba(30,200,81,0.2);
}

.w-sel-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.w-sel-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phone-circle {
  background-color: rgba(30,200,81,0.1);
  color: #1ec851;
}

.wallet-circle {
  background-color: rgba(30,200,81,0.1);
  color: #1ec851;
}

.w-sel-details {
  display: flex;
  flex-direction: column;
}

.w-sel-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f1413;
}

.w-sel-subtitle {
  font-size: 12px;
  color: #8c9690;
  margin-top: 2px;
}

.w-switch-btn {
  font-size: 12px;
  font-weight: 700;
  color: #1ec851;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.w-switch-btn:hover {
  background-color: rgba(30,200,81,0.06);
}

.w-switch-btn .chevron {
  font-size: 10px;
}

/* Amount Input Box */
.w-amount-card {
  background-color: #ffffff;
  border-radius: 14px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  border: 1px solid rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.w-amount-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.w-amount-label {
  font-size: 13px;
  font-weight: 700;
  color: #0f1413;
}

.w-amount-min {
  font-size: 12px;
  color: #8c9690;
}

.w-amount-input {
  font-size: 24px;
  font-weight: 800;
  border: none;
  outline: none;
  width: 100%;
  color: #0f1413;
  font-family: inherit;
  padding: 4px 0;
}

.w-amount-input::placeholder {
  color: #c0c8c4;
  font-weight: 500;
}

/* Errors */
.w-error-box {
  background-color: rgba(255, 77, 61, 0.08);
  border: 1px solid rgba(255, 77, 61, 0.2);
  color: #d63a2c;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.4;
}

/* Submit Button */
.w-submit-btn {
  width: 100%;
  background-color: #ccd2cd;
  color: #7f8682;
  font-size: 16px;
  font-weight: 700;
  border: none;
  height: 50px;
  border-radius: 25px;
  cursor: not-allowed;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-submit-btn.active {
  background-color: #1ec851;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(30,200,81,0.3);
}

.w-submit-btn.active:hover {
  background-color: #1cb549;
  transform: translateY(-1px);
}

.w-submit-btn.active:active {
  transform: translateY(0);
}

/* Rules list */
.w-rules-card {
  padding: 8px 12px;
}

.w-rules-list {
  padding-left: 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11.5px;
  color: #606a64;
  line-height: 1.4;
}

.w-rules-list li strong {
  color: #0f1413;
  font-weight: 700;
}

/* Recent Transactions */
.w-recent-section {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 18px 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
  border: 1px solid rgba(0,0,0,0.03);
  margin-top: 10px;
}

.w-recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.w-recent-title {
  font-size: 15px;
  font-weight: 800;
  margin: 0;
  color: #0f1413;
}

.w-see-more-btn {
  font-size: 12px;
  font-weight: 700;
  color: #1ec851;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.w-see-more-btn:hover {
  background-color: rgba(30,200,81,0.06);
}

.w-tx-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.w-tx-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f2f0;
}

.w-tx-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.w-tx-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.w-tx-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.04);
  color: #7f8682;
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-tx-meta {
  display: flex;
  flex-direction: column;
}

.w-tx-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f1413;
}

.w-tx-sub {
  font-size: 11px;
  color: #8c9690;
  margin-top: 1px;
}

.w-tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.w-tx-amt {
  font-size: 14px;
  font-weight: 800;
  color: #0f1413;
}

.w-tx-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.w-tx-badge.approved,
.w-tx-badge.completed {
  background-color: rgba(30,200,81,0.1);
  color: #1cb549;
}

.w-tx-badge.pending,
.w-tx-badge.processing {
  background-color: rgba(255, 181, 71, 0.1);
  color: #c87f00;
}

.w-tx-date {
  font-size: 10px;
  color: #8c9690;
  margin-top: 2px;
}

/* Drawers & Sheets Overlay */
.w-drawer-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.25s ease;
}

.w-drawer-overlay.pop-fade-in {
  align-items: center;
  justify-content: center;
}

.w-drawer-sheet {
  width: 100%;
  background-color: #ffffff;
  border-radius: 18px 18px 0 0;
  padding: 20px;
  box-shadow: 0 -5px 25px rgba(0,0,0,0.15);
  animation: slideUp 0.25s cubic-bezier(0.1, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.w-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.w-drawer-header h3 {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.w-drawer-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #8c9690;
  cursor: pointer;
  padding: 4px;
}

.w-drawer-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.w-drawer-option-btn {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background-color: #f6f8f6;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.w-drawer-option-btn:hover {
  background-color: #f0f2f0;
}

.w-drawer-option-btn.selected {
  background-color: rgba(30,200,81,0.06);
  border-color: rgba(30,200,81,0.2);
}

.w-network-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 12px;
}

.w-option-label {
  font-size: 14px;
  font-weight: 700;
  color: #0f1413;
  flex: 1;
  text-align: left;
}

.w-checkmark {
  color: #1ec851;
  font-weight: 800;
  font-size: 14px;
}

/* Deposit Requirement Popup (mockup replica) */
.w-deposit-req-modal {
  width: 90%;
  max-width: 380px;
  background-color: #ffffff;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.w-req-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.w-req-modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #0f1413;
}

.w-req-close-btn {
  background-color: #f0f2f0;
  border: none;
  color: #606a64;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 800;
  font-size: 12px;
  transition: background-color 0.2s;
}

.w-req-close-btn:hover {
  background-color: #e2e4e2;
}

.w-req-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.w-req-main-text {
  font-size: 14px;
  color: #606a64;
  line-height: 1.5;
  margin: 0;
}

.w-req-bullet-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #0f1413;
}

.w-req-bullet-item .bullet-dot {
  font-size: 16px;
  color: #606a64;
}

.w-req-bullet-item .bullet-text strong {
  font-weight: 700;
}

.w-req-modal-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.w-req-primary-btn {
  background-color: #3563e9;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  border: none;
  height: 46px;
  border-radius: 23px;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-req-primary-btn:hover {
  background-color: #2b52cc;
}

.w-req-primary-btn:active {
  transform: scale(0.98);
}

.w-req-secondary-btn {
  background-color: #f0f2f0;
  color: #0f1413;
  font-size: 14px;
  font-weight: 700;
  border: none;
  height: 44px;
  border-radius: 22px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-req-secondary-btn:hover {
  background-color: #e2e4e2;
}

/* Phone Drawer Form */
.w-drawer-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.w-drawer-desc {
  font-size: 12.5px;
  color: #606a64;
  line-height: 1.4;
  margin: 0 0 4px 0;
}

.w-drawer-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #ccd2cd;
  font-size: 15px;
  font-weight: 700;
  background-color: #f6f8f6;
  outline: none;
  font-family: inherit;
}

.w-drawer-input:focus {
  border-color: #1ec851;
  background-color: #ffffff;
}

.w-drawer-submit-btn {
  background-color: #1ec851;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  border: none;
  height: 44px;
  border-radius: 22px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.w-drawer-submit-btn:hover {
  background-color: #1cb549;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

.fade-up {
  animation: wFadeUp .45s ease both;
}

@keyframes wFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
