/**
 * Admin · Referrals — full program oversight: KPI stats, top referrers,
 * searchable/filterable referral list, approve / reject / reverse actions.
 */
import { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Spinner, Empty, moneyFmt, ago, useToast } from '../../components/admin/primitives.jsx';
import {
  adminListReferrals,
  adminReferralStats,
  adminApproveReferral,
  adminRejectReferral,
  adminReverseReferral,
} from '../../api/adminApi.js';
import { onAdmin } from '../../api/adminSocket.js';

const STATUSES = ['', 'pending', 'flagged', 'qualified', 'rewarded', 'rejected', 'reversed'];
const TONE = {
  pending: 'warn',
  flagged: 'error',
  qualified: 'info',
  rewarded: 'success',
  rejected: 'neutral',
  reversed: 'neutral',
};

export default function ReferralsPage() {
  const { toast: toastState, show } = useToast();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([adminReferralStats(), adminListReferrals({ status, search })]);
      setStats(s);
      setRows(l.referrals || []);
    } catch (e) {
      show(e.message || 'Failed to load referrals', 'error');
    }
  }, [status, search, show]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const offs = ['referral:registered', 'referral:rewarded', 'referral:needs_review'].map((ev) =>
      onAdmin(ev, () => load()),
    );
    return () => offs.forEach((off) => off?.());
  }, [load]);

  const act = async (fn, id, label, needsReason = false) => {
    const reason = needsReason ? window.prompt(`Reason for ${label}? (optional)`) ?? undefined : undefined;
    setBusyId(id);
    try {
      await fn(id, reason);
      show(`Referral ${label}d`, 'success');
      load();
    } catch (e) {
      show(e.message || `${label} failed`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const kpis = stats
    ? [
        ['Total', stats.total],
        ['Today', stats.daily],
        ['This week', stats.weekly],
        ['This month', stats.monthly],
        ['Rewarded', stats.rewarded],
        ['Flagged', stats.flagged],
        ['Conversion', `${stats.conversionRate}%`],
        ['Paid out (GHS)', moneyFmt(stats.totalPaid)],
      ]
    : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Referrals</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
            Refer &amp; Earn program — payouts, fraud review, and analytics.
          </p>
        </div>
        {stats && (
          <Badge tone={stats.flagged > 0 ? 'warn' : 'success'} dot={stats.flagged > 0}>
            {stats.flagged} flagged
          </Badge>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map(([lbl, val]) => (
          <div key={lbl} className="adm-stat">
            <div className="lbl">{lbl}</div>
            <div className="val">{val}</div>
          </div>
        ))}
      </div>

      {stats?.topReferrers?.length > 0 && (
        <Card style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>TOP REFERRERS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.topReferrers.map((t, i) => (
              <span
                key={t.referrerId}
                style={{
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(232,185,74,.08)',
                  border: '1px solid rgba(232,185,74,.25)',
                }}
              >
                #{i + 1} {t.name} — {t.rewarded}/{t.total} · GHS {moneyFmt(t.earned)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="adm-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}
            </option>
          ))}
        </select>
        <input
          className="adm-input"
          placeholder="Search user, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      <Card flush>
        {!rows ? (
          <Spinner label="Loading referrals…" />
        ) : rows.length === 0 ? (
          <Empty title="No referrals" subtitle="Nothing matches the current filter." />
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Referred user</th>
                <th>Referrer</th>
                <th>Code</th>
                <th>Registered</th>
                <th>Deposit</th>
                <th>Status</th>
                <th>Reward</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.referredName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.referredId}</div>
                    {r.fraudReasons?.length > 0 && (
                      <div style={{ fontSize: 10.5, color: '#ef4444' }}>⚠ {r.fraudReasons.join(', ')}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{r.referrer?.displayName || r.referrerId}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.code}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{ago(r.registeredAt)}</td>
                  <td style={{ fontSize: 12.5 }}>{r.depositAmount != null ? `GHS ${moneyFmt(r.depositAmount)}` : '—'}</td>
                  <td>
                    <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge>
                  </td>
                  <td style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {r.rewardAmount != null ? `GHS ${moneyFmt(r.rewardAmount)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(r.status === 'flagged' || r.status === 'pending') && (
                        <>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm"
                            disabled={busyId === r.referredId}
                            onClick={() => act(adminApproveReferral, r.referredId, 'approve')}
                            style={{ background: '#22c55e', color: '#fff', border: 'none' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm"
                            disabled={busyId === r.referredId}
                            onClick={() => act(adminRejectReferral, r.referredId, 'reject', true)}
                            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'rewarded' && (
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm"
                          disabled={busyId === r.referredId}
                          onClick={() => act(adminReverseReferral, r.referredId, 'reverse', true)}
                          style={{ background: '#f59e0b', color: '#1a1300', border: 'none' }}
                        >
                          Reverse
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {toastState.open && (
        <div className={`adm-toast ${toastState.kind}`} role="status" aria-live="polite">
          <span>{toastState.message}</span>
        </div>
      )}
    </div>
  );
}
