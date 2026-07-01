import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPaymentGateways, deposit as apiDeposit } from '../api/betApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { appendTxCache } from '../lib/txCache.js';
import { useTokens, fmtCedi } from '../components/odd/tokens.jsx';
import { OddPageHeader } from '../components/odd/primitives.jsx';
import PaybillInstructions from '../components/PaybillInstructions.jsx';

const MIN_DEPOSIT = 300;
const MAX_DEPOSIT = 50000;

const GATEWAY_META = {
  paystack: {
    label: 'Paystack',
    description: 'Card, bank & mobile money',
    icon: 'card',
    color: '#0ba95b',
  },
  paybill: {
    label: 'Paybill',
    description: 'Mobile money',
    icon: 'building',
    color: '#22c55e',
  },
};

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskPhone(s) {
  const str = String(s || '').replace(/\s/g, '');
  if (!str) return '';
  if (/^\+233\d{9}$/.test(str)) return `+233 ${str.slice(4, 6)}****${str.slice(-3)}`;
  if (/^0\d{9}$/.test(str)) return `${str.slice(0, 3)}****${str.slice(-3)}`;
  return str;
}

export default function DepositPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { account } = useAccount();
  const { toast } = useToast();

  const [gateways, setGateways] = useState(null);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState(String(MIN_DEPOSIT));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [depositResults, setDepositResults] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchPaymentGateways()
      .then((res) => {
        if (!alive) return;
        setGateways(res.gateways);
        const keys = Object.keys(res.gateways);
        if (keys.length > 0) setSelectedMethod(keys[0]);
      })
      .catch(() => {
        if (alive) setGateways({});
      })
      .finally(() => {
        if (alive) setLoadingGateways(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!account) return;
    const offApproved = onLive('deposit:approved', ({ transaction, account: updatedAccount }) => {
      const amt = transaction?.amount;
      toast(`Deposit approved! GHS ${formatAmt(amt)} credited.`, 'success');
      setDepositResults((prev) => [...prev, { kind: 'approved', amount: amt, txId: transaction?.id, at: Date.now() }]);
    });
    const offRejected = onLive('deposit:rejected', ({ transaction, reason }) => {
      const amt = transaction?.amount;
      toast(`Deposit rejected${reason ? ': ' + reason : ''}.`, 'warn');
      setDepositResults((prev) => [
        ...prev,
        { kind: 'rejected', amount: amt, reason, txId: transaction?.id, at: Date.now() },
      ]);
    });
    return () => {
      offApproved?.();
      offRejected?.();
    };
  }, [account, toast]);

  const gatewayKeys = gateways ? Object.keys(gateways) : [];
  const numEnabled = gatewayKeys.length;

  const submitDeposit = async (e) => {
    e.preventDefault();
    setErr('');
    const amt = parseFloat(String(amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount.');
      return;
    }
    if (amt < MIN_DEPOSIT) {
      setErr(`Minimum deposit is GHS ${MIN_DEPOSIT}.`);
      return;
    }
    if (amt > MAX_DEPOSIT) {
      setErr(`Maximum per transaction is GHS ${MAX_DEPOSIT.toLocaleString('en-US')}.`);
      return;
    }
    if (!selectedMethod) {
      setErr('Select a payment method.');
      return;
    }
    try {
      setBusy(true);
      const data = await apiDeposit(amt, selectedMethod);
      if (data?.transaction && account?.id) appendTxCache(account.id, data.transaction);
      toast(
        `Deposit of GHS ${formatAmt(amt)} via ${GATEWAY_META[selectedMethod]?.label || selectedMethod} submitted.`,
        'info',
      );
      setAmount(String(MIN_DEPOSIT));
    } catch (e) {
      setErr(e.message || 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!account) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Deposit" subtitle="Sign in to deposit funds" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: T.surfaceAlt,
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>Sign in to deposit</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 16 }}>
            Add funds to your wallet to start betting.
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/deposit')}
            style={{
              padding: '12px 24px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loadingGateways) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Deposit" subtitle="Loading payment options…" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `3px solid ${T.line}`,
              borderTopColor: T.greenBright,
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
      </div>
    );
  }

  if (numEnabled === 0) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Deposit" subtitle="Funding options" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'rgba(239,68,68,0.1)',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>
            Deposits temporarily unavailable
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, maxWidth: 300, margin: '0 auto' }}>
            We are currently reviewing our payment options. Please check back shortly or contact support for assistance.
          </div>
        </div>
      </div>
    );
  }

  const accountIdentifier = account?.phone || account?.email || '';
  const maskedIdentifier = maskPhone(accountIdentifier);
  const identifierLabel = account?.phone ? 'Account phone' : 'Account';
  const selectedMeta = GATEWAY_META[selectedMethod];
  const amtNum = parseFloat(String(amount).replace(/,/g, '')) || 0;
  const canSubmit = amtNum >= MIN_DEPOSIT && amtNum <= MAX_DEPOSIT && !busy && selectedMethod;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="Deposit" subtitle="Add funds to your wallet" />

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 12,
            background: T.surface,
            border: `1px solid ${T.line}`,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>Wallet Balance</div>
            <div
              style={{ fontSize: 20, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}
            >
              GHS {fmtCedi(account?.balance || 0)}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.inkDim }}>
            {accountIdentifier ? `${identifierLabel}: ${maskedIdentifier}` : ''}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.inkSoft,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Payment method
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(numEnabled, 2)}, 1fr)`, gap: 10 }}>
            {gatewayKeys.map((key) => {
              const cfg = gateways[key];
              const meta = GATEWAY_META[key] || { label: key, description: '', icon: 'card', color: T.greenBright };
              const active = selectedMethod === key;
              const note = cfg.maintenanceNote || '';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setErr('');
                    setSelectedMethod(key);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 12px',
                    borderRadius: 12,
                    background: active ? 'rgba(34,197,94,0.1)' : T.surface,
                    border: active ? `2px solid ${T.greenBright}` : `1px solid ${T.line}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: active ? T.greenBright : T.surfaceAlt,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: active ? T.goldDark : meta.color,
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      {key === 'paystack' ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="2" y="6" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 21h18" />
                          <path d="M5 21V10l7-4 7 4v11" />
                          <path d="M9 21v-6h6v6" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: T.inkSoft }}>{meta.description}</div>
                    </div>
                  </div>
                  {cfg.isDefault && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(34,197,94,0.15)',
                        color: '#22c55e',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Default
                    </span>
                  )}
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: T.greenBright,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === 'paystack' ? (
          <form onSubmit={submitDeposit}>
            <div style={{ padding: '16px', borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="dep-amount" style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                  Amount (GHS)
                </label>
                <span style={{ fontSize: 11, color: T.inkDim }}>min. {MIN_DEPOSIT}.00</span>
              </div>
              <input
                id="dep-amount"
                type="number"
                min={MIN_DEPOSIT}
                max={MAX_DEPOSIT}
                step="1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`min. ${MIN_DEPOSIT}`}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: `1px solid ${T.line}`,
                  background: T.surfaceAlt,
                  color: T.ink,
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[300, 500, 2000, 5000, 10000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmount(String(n))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: T.surfaceAlt,
                      border: `1px solid ${T.line}`,
                      color: T.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: '1 0 auto',
                    }}
                  >
                    {n.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </div>

            {err && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 12,
                  color: '#ef4444',
                }}
              >
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '16px 0',
                borderRadius: 12,
                background: canSubmit ? T.greenBright : T.surfaceAlt,
                color: canSubmit ? T.goldDark : T.inkDim,
                fontWeight: 800,
                fontSize: 15,
                border: 0,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
              }}
            >
              {busy ? 'Processing…' : 'Deposit Now'}
            </button>

            <ol
              style={{
                marginTop: 14,
                paddingLeft: 18,
                fontSize: 11,
                color: T.inkDim,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <li>Maximum per transaction is GHS {MAX_DEPOSIT.toLocaleString('en-US')}.00</li>
              <li>Minimum per transaction is GHS {MIN_DEPOSIT}.00</li>
              <li>Deposit is free, no transaction fees.</li>
            </ol>
          </form>
        ) : selectedMethod === 'paybill' ? (
          <div>
            <div style={{ padding: '16px', borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="dep-amount-pb" style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                  Amount (GHS)
                </label>
                <span style={{ fontSize: 11, color: T.inkDim }}>min. {MIN_DEPOSIT}.00</span>
              </div>
              <input
                id="dep-amount-pb"
                type="number"
                min={MIN_DEPOSIT}
                max={MAX_DEPOSIT}
                step="1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`min. ${MIN_DEPOSIT}`}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: `1px solid ${T.line}`,
                  background: T.surfaceAlt,
                  color: T.ink,
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[300, 500, 2000, 5000, 10000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmount(String(n))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: T.surfaceAlt,
                      border: `1px solid ${T.line}`,
                      color: T.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: '1 0 auto',
                    }}
                  >
                    {n.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </div>

            {err && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 12,
                  color: '#ef4444',
                }}
              >
                {err}
              </div>
            )}

            <PaybillInstructions
              paybillId="222000"
              accountRef={account?.phone || account?.email || ''}
              context="deposit"
            />
          </div>
        ) : null}

        {depositResults.length > 0 && depositResults[0].kind === 'approved' && (
          <div
            style={{
              padding: '16px',
              borderRadius: 12,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>Deposit Approved!</div>
            <div style={{ fontSize: 13, color: T.ink }}>
              GHS {formatAmt(depositResults[0].amount)} has been credited to your wallet.
            </div>
            <button
              type="button"
              onClick={() => setDepositResults([])}
              style={{
                marginTop: 8,
                padding: '6px 14px',
                borderRadius: 8,
                background: T.greenBright,
                color: T.goldDark,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {depositResults.length > 0 && depositResults[0].kind === 'rejected' && (
          <div
            style={{
              padding: '16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Deposit Rejected</div>
            <div style={{ fontSize: 13, color: T.ink }}>
              GHS {formatAmt(depositResults[0].amount)}{' '}
              {depositResults[0].reason ? `: ${depositResults[0].reason}` : ''}
            </div>
            <button
              type="button"
              onClick={() => setDepositResults([])}
              style={{
                marginTop: 8,
                padding: '6px 14px',
                borderRadius: 8,
                background: T.greenBright,
                color: T.goldDark,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
