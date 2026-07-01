/**
 * Wallet — port of the Claude Design OddTxScreen.
 * Headline transaction count, filter pills, transaction rows with type icon,
 * status chip, and signed amount. Wired to /api/wallet/transactions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTransactions } from '../api/betApi.js';
import { useAccount } from '../providers/AccountProvider.jsx';
import { onLive } from '../api/socketClient.js';
import { fmtCedi, useTokens, OddPageHeader, OddStatusChip, OddIcon } from '../components/odd/primitives.jsx';

/**
 * Per-kind metadata. `dir` (+1 in / −1 out) drives the displayed sign because
 * the server stores some outflows as positive amounts (notably `withdraw`),
 * so we can't trust `amount > 0`. `cat` powers the filter pills.
 */
const KIND_META = {
  deposit: { label: 'Deposit', cat: 'dep', dir: +1, icon: 'deposit' },
  withdraw: { label: 'Withdrawal', cat: 'wdl', dir: -1, icon: 'upload' },
  withdrawal: { label: 'Withdrawal', cat: 'wdl', dir: -1, icon: 'upload' },
  bet_placed: { label: 'Stake', cat: 'stk', dir: -1, icon: 'ticket' },
  jackpot_entry: { label: 'Jackpot entry', cat: 'stk', dir: -1, icon: 'ticket' },
  bet_won: { label: 'Payout', cat: 'pay', dir: +1, icon: 'trophy' },
  cash_out: { label: 'Cash-out', cat: 'pay', dir: +1, icon: 'refresh' },
  cash_out_partial: { label: 'Cash-out', cat: 'pay', dir: +1, icon: 'refresh' },
  bet_void_refund: { label: 'Refund', cat: 'pay', dir: +1, icon: 'refresh' },
  bet_cancel_refund: { label: 'Refund', cat: 'pay', dir: +1, icon: 'refresh' },
};

/** Map a raw server/cache tx onto the shape the row + filters need. */
function normalizeTx(t) {
  const rawKind = t.kind || t.type || '';
  const meta = KIND_META[rawKind];
  const magnitude = Math.abs(Number(t.amount || 0));
  // Known kinds use their metadata direction; unknown kinds fall back to the
  // stored sign so future tx types still render with a sensible +/−.
  const dir = meta ? meta.dir : Number(t.amount || 0) < 0 ? -1 : +1;
  return {
    id: t.id || `${rawKind}-${t.at || t.createdAt || ''}`,
    label: meta?.label || rawKind || 'Transaction',
    cat: meta?.cat || 'other',
    icon: meta?.icon || (dir > 0 ? 'deposit' : 'upload'),
    isIn: dir > 0,
    magnitude,
    status: t.status || 'completed',
    date: t.at || t.completedAt || t.createdAt || t.date || '',
  };
}

const FILTERS = [
  { id: 'all', label: 'All', cats: null },
  { id: 'dep', label: 'Deposits', cats: ['dep'] },
  { id: 'wdl', label: 'Withdrawals', cats: ['wdl'] },
  { id: 'stk', label: 'Stakes', cats: ['stk'] },
  { id: 'pay', label: 'Payouts', cats: ['pay'] },
];

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function WalletPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { account } = useAccount();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState('all');

  const loadTxs = useCallback(async () => {
    if (!account) return;
    try {
      const d = await fetchTransactions();
      setTxs(d?.transactions || d?.items || []);
    } catch {
      setTxs([]);
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    setLoading(true);
    loadTxs().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadTxs]);

  // Refresh transactions on wallet updates
  useEffect(() => {
    if (!account) return;
    const off = onLive('wallet:update', () => {
      loadTxs();
    });
    return () => off?.();
  }, [account, loadTxs]);

  const normalized = useMemo(() => txs.map(normalizeTx), [txs]);
  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filterId) || FILTERS[0];
    return f.cats ? normalized.filter((t) => f.cats.includes(t.cat)) : normalized;
  }, [normalized, filterId]);

  if (!account) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Wallet" subtitle="Sign in to view transactions" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <OddIcon name="wallet" size={32} color={T.inkDim} />
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>
            Sign in to see your transactions
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/wallet')}
            style={{
              marginTop: 16,
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

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="Transactions" subtitle="Your account activity" />

      <div style={{ padding: '0 16px 12px' }}>
        <button
          type="button"
          onClick={() => navigate('/deposit')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: T.greenBright, color: T.goldDark,
            fontWeight: 800, fontSize: 14, border: 0, cursor: 'pointer',
          }}
        >
          Deposit Funds
        </button>
      </div>

      <div style={{ padding: '16px 16px 4px' }}>
        <div style={{ fontSize: 12, color: T.inkSoft }}>Total transactions</div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -0.6,
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {txs.length}
        </div>
      </div>

      <div
        className="odd-pane"
        style={{
          padding: '6px 16px 0',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
        }}
      >
        {FILTERS.map((f) => {
          const active = f.id === filterId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterId(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: active ? T.greenBright : T.surface,
                color: active ? T.goldDark : T.ink,
                border: active ? 0 : `1px solid ${T.line}`,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="odd-cardgrid" style={{ padding: '14px 16px', gap: 8 }}>
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 68,
                borderRadius: 14,
                background: T.surface,
                border: `1px solid ${T.line}`,
                opacity: 0.6 + (i % 3) * 0.15,
              }}
            />
          ))
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: T.surface,
              borderRadius: 14,
              border: `1px solid ${T.line}`,
              color: T.inkSoft,
              fontSize: 13,
            }}
          >
            No transactions to show.
          </div>
        ) : (
          filtered.map((t) => <TxRow key={t.id} tx={t} />)
        )}
      </div>
    </div>
  );
}

function TxRow({ tx }) {
  const T = useTokens();
  const { isIn, label: labelRaw, icon: iconName, status, date, magnitude } = tx;

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 14,
        border: `1px solid ${T.line}`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: isIn ? T.greenSoft : T.surfaceAlt,
          color: isIn ? T.greenBright : T.inkSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <OddIcon name={iconName} size={18} color={isIn ? T.greenBright : T.inkSoft} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{labelRaw}</span>
          <OddStatusChip kind={status} label={String(status).toUpperCase()} />
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
          {typeof date === 'string' && date.includes('T') ? fmtDateTime(date) : date}
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isIn ? T.greenBright : T.danger,
        }}
      >
        {isIn ? '+' : '−'} GHS {fmtCedi(magnitude)}
      </div>
    </div>
  );
}
