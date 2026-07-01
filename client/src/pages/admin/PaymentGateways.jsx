import { useEffect, useState } from 'react';
import { Card, Badge, Spinner } from '../../components/admin/primitives.jsx';
import { adminGetPaymentGateways, adminUpdatePaymentGateway } from '../../api/adminApi.js';
import { useAdmin } from '../../providers/AdminProvider.jsx';

const GATEWAY_META = {
  paystack: {
    label: 'Paystack',
    description: 'Card, bank & mobile money payments',
    docs: 'https://paystack.com/docs',
  },
  paybill: {
    label: 'Paybill',
    description: 'Mobile money via shortcode 222000',
    docs: null,
  },
};

export default function PaymentGatewaysPage() {
  const { hasRole, showToast } = useAdmin();
  const isSuper = hasRole();
  const toast = showToast || (() => {});
  const [gateways, setGateways] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    adminGetPaymentGateways()
      .then((res) => setGateways(res.gateways))
      .catch(() => {});
  }, []);

  if (!gateways) return <Spinner label="Loading payment gateways…" />;

  const toggle = async (key) => {
    setBusy(key);
    try {
      const res = await adminUpdatePaymentGateway(key, { enabled: !gateways[key]?.enabled });
      setGateways(res.gateways);
      toast(`${GATEWAY_META[key]?.label || key} ${gateways[key]?.enabled ? 'disabled' : 'enabled'}.`, 'success');
    } catch (e) {
      toast(e.message || 'Failed to update.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const setDefault = async (key) => {
    if (gateways[key]?.isDefault) return;
    setBusy(key);
    try {
      const res = await adminUpdatePaymentGateway(key, { isDefault: true });
      setGateways(res.gateways);
      toast(`${GATEWAY_META[key]?.label || key} set as default.`, 'success');
    } catch (e) {
      toast(e.message || 'Failed to update.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const updateNote = async (key, maintenanceNote) => {
    setBusy(key);
    try {
      const res = await adminUpdatePaymentGateway(key, { maintenanceNote });
      setGateways(res.gateways);
      toast('Maintenance note updated.', 'success');
    } catch (e) {
      toast(e.message || 'Failed to update.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <header className="adm-page-head">
        <div>
          <h1>Payment Gateways</h1>
          <p>Manage payment providers available to users. Changes take effect immediately.</p>
        </div>
        <Badge tone={isSuper ? 'success' : 'warn'}>{isSuper ? 'Super admin' : 'Read-only'}</Badge>
      </header>

      <div className="adm-grid c2">
        {Object.entries(GATEWAY_META).map(([key, meta]) => {
          const cfg = gateways[key] || {};
          const enabled = !!cfg.enabled;
          const isDefault = !!cfg.isDefault;
          const updatedAt = cfg.updatedAt || null;
          const note = cfg.maintenanceNote || '';

          return (
            <Card key={key} title={meta.label} subtitle={meta.description}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: enabled ? '#22c55e' : '#ef4444',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  {isSuper && (
                    <button
                      type="button"
                      className={`adm-toggle ${enabled ? 'on' : 'off'}`}
                      onClick={() => toggle(key)}
                      disabled={busy === key}
                      style={{ opacity: busy === key ? 0.6 : 1 }}
                    >
                      {busy === key ? '…' : enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>

                {updatedAt && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    Last updated:{' '}
                    {new Date(updatedAt).toLocaleString('en-GH', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isDefault ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)',
                    border: isDefault ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Default gateway</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {isDefault ? 'This is the default payment method' : 'Set as the primary payment method'}
                    </div>
                  </div>
                  {isSuper ? (
                    <button
                      type="button"
                      onClick={() => setDefault(key)}
                      disabled={isDefault || busy === key}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 6,
                        background: isDefault ? 'rgba(34,197,94,0.15)' : 'var(--surface)',
                        color: isDefault ? '#22c55e' : 'var(--text)',
                        border: isDefault ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: isDefault ? 'default' : 'pointer',
                      }}
                    >
                      {isDefault ? '✓ Default' : 'Set Default'}
                    </button>
                  ) : (
                    <Badge tone={isDefault ? 'success' : 'default'}>{isDefault ? 'Default' : '—'}</Badge>
                  )}
                </div>

                {isSuper && (
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-dim)',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Maintenance notice (shown to users when gateway is disabled)
                    </label>
                    <textarea
                      className="adm-textarea"
                      defaultValue={note}
                      rows={2}
                      placeholder="e.g. Paystack is temporarily unavailable. Please use Paybill."
                      onBlur={(e) => {
                        if (e.target.value !== note) updateNote(key, e.target.value);
                      }}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                )}

                {!enabled && note && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: 11,
                      color: '#ef4444',
                    }}
                  >
                    {note}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <style>{STYLES}</style>
    </>
  );
}

const STYLES = `
.adm-toggle {
  flex-shrink: 0; padding: 6px 16px; border-radius: 20px;
  border: none; font-size: 11px; font-weight: 800; letter-spacing: .08em;
  cursor: pointer; transition: all .15s ease; text-transform: uppercase;
}
.adm-toggle.on { background: rgba(34, 197, 94, .15); color: #22c55e; }
.adm-toggle.off { background: rgba(239, 68, 68, .12); color: #ef4444; }
.adm-toggle:hover { opacity: .75; }
.adm-textarea {
  width: 100%; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text); font-size: 13px; resize: vertical;
  font-family: inherit;
}
`;
