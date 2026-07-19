/**
 * Funds — a focused page for crediting or debiting a user's wallet directly,
 * without going through the full Users management drawer. Search a user by
 * phone, email, name, or id, then apply a manual balance adjustment.
 *
 * Backend: PATCH /api/admin/users/:id/wallet (finance_admin role), the same
 * endpoint the "Adjust wallet" action in Users.jsx already uses.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Badge, Empty, moneyFmt, useToast } from '../../components/admin/primitives.jsx';
import { adminListUsers, adminUserWallet, adminUserTx } from '../../api/adminApi.js';
import { IconCash, IconSearch } from '../../components/admin/Icons.jsx';

export default function FundsPage() {
  const { toast: toastState, show } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [direction, setDirection] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await adminListUsers({ q: q.trim(), limit: 10 });
      setResults(r?.users || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  const selectUser = async (u) => {
    setSelected(u);
    setResults([]);
    setQuery('');
    setAmount('');
    setReason('');
    setDirection('credit');
    try {
      const r = await adminUserTx(u.id);
      setRecentTx((r?.transactions || r?.items || []).slice(0, 5));
    } catch {
      setRecentTx([]);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      show('Enter a valid amount.', 'error');
      return;
    }
    if (!reason || reason.trim().length < 2) {
      show('A reason is required — it goes in the audit log.', 'error');
      return;
    }
    const delta = direction === 'credit' ? n : -n;
    setBusy(true);
    try {
      const { user: updated } = await adminUserWallet(selected.id, delta, reason.trim());
      setSelected(updated);
      show(`${direction === 'credit' ? 'Credited' : 'Debited'} GHS ${moneyFmt(Math.abs(delta))}.`, 'success');
      setAmount('');
      setReason('');
      const r = await adminUserTx(selected.id).catch(() => null);
      if (r) setRecentTx((r.transactions || r.items || []).slice(0, 5));
    } catch (e2) {
      show(e2.message || 'Adjustment failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Funds</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
            Add or remove money from a user's account directly. Every adjustment is logged in the audit trail.
          </p>
        </div>
        <Badge tone="default">
          <IconCash size={14} /> Finance
        </Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        <Card title="Find a user" subtitle="Search by phone, email, name, or user id">
          <div className="adm-field" style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  display: 'flex',
                }}
              >
                <IconSearch size={15} />
              </span>
              <input
                className="adm-input"
                style={{ paddingLeft: 32 }}
                placeholder="e.g. 0244612481 or a name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {searching && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Searching…</div>}

          {!searching && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectUser(u)}
                  className="adm-btn"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.displayName || u.email || u.id}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{u.phone || u.email}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{moneyFmt(u.balance, u.currency)}</div>
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <Empty title="No users match" subtitle="Try a different phone, email, or name." />
          )}

          {!selected && query.trim().length < 2 && (
            <Empty title="Search for a user" subtitle="Type at least 2 characters to find an account." />
          )}
        </Card>

        {selected && (
          <Card
            title={selected.displayName || selected.email || selected.id}
            subtitle={selected.phone || selected.email}
            action={
              <button type="button" className="adm-btn ghost" onClick={() => setSelected(null)}>
                Change user
              </button>
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0 16px',
                borderBottom: '1px solid var(--line)',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Current balance</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{moneyFmt(selected.balance, selected.currency)}</span>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  ['credit', 'Add funds'],
                  ['debit', 'Remove funds'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`adm-btn ${direction === k ? 'primary' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setDirection(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="adm-field">
                <label>Amount ({selected.currency || 'GHS'})</label>
                <input
                  className="adm-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="adm-field">
                <label>Reason (required, recorded in audit log)</label>
                <input
                  className="adm-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. goodwill credit, correction for support ticket #123"
                  minLength={2}
                  required
                />
              </div>

              <button type="submit" className="adm-btn primary" disabled={busy}>
                {busy
                  ? 'Applying…'
                  : `${direction === 'credit' ? 'Credit' : 'Debit'} ${amount ? moneyFmt(amount) : ''}`.trim()}
              </button>
            </form>

            {recentTx.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
                  Recent activity
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentTx.map((t) => (
                    <div
                      key={t.id}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>{t.kind || t.type}</span>
                      <span style={{ fontWeight: 600 }}>{moneyFmt(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {toastState.open && (
        <div className={`adm-toast ${toastState.kind}`} role="status" aria-live="polite">
          <span>{toastState.message}</span>
        </div>
      )}
    </div>
  );
}
