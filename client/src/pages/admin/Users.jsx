/**
 * Users management.
 *  - Filterable / searchable / sortable table
 *  - Drawer with profile, KYC, wallet, tags, notes, bets, login history
 *  - Privileged actions:
 *      moderator+ : suspend/unsuspend, verify email, KYC, tags, notes
 *      finance+   : wallet adjust
 *      super only : password reset
 *  - CSV export
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import {
  adminListUsers, adminGetUser, adminUserBets, adminUserTx, adminUserLogins,
  adminUserStatus, adminUserKyc, adminUserWallet, adminUserTags, adminUserNotes,
  adminUserReset, adminImpersonate,
} from '../../api/adminApi.js';
import { Card, Badge, Drawer, Modal, Empty, SkeletonRow, moneyFmt, numFmt, ago, dateShort } from '../../components/admin/primitives.jsx';
import {
  IconSearch, IconDownload, IconRefresh, IconBan, IconCheck, IconKey, IconUsers, IconActivity, IconCash,
} from '../../components/admin/Icons.jsx';

const KYC_TONES = { verified: 'success', pending: 'warn', rejected: 'danger', unverified: 'default' };

export default function UsersPage() {
  const { hasRole, showToast } = useAdmin();
  const [filters, setFilters] = useState({ q: '', status: 'all', kyc: '', sort: 'createdAt', dir: 'desc' });
  const [page, setPage]   = useState({ offset: 0, limit: 50 });
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [drawerTab, setDrawerTab] = useState('profile');
  const debounceRef = useRef(0);

  async function load() {
    setLoading(true);
    try {
      const res = await adminListUsers({
        q: filters.q, status: filters.status, kyc: filters.kyc,
        sort: filters.sort, dir: filters.dir,
        offset: page.offset, limit: page.limit,
      });
      setData(res);
    } catch (e) {
      showToast(e.message || 'Failed to load users', 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 200);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.status, filters.kyc, filters.sort, filters.dir, page.offset, page.limit]);

  function openUser(u) {
    setSelected(u);
    setDrawerTab('profile');
  }

  function exportCsv() {
    if (!data?.users?.length) return;
    const headers = ['id', 'email', 'displayName', 'balance', 'kycStatus', 'suspended', 'createdAt'];
    const rows = data.users.map((u) => headers.map((h) => JSON.stringify(u[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="adm-page-head">
        <div>
          <h1>Users</h1>
          <p>Search, audit, and manage every player on the platform. Actions are recorded in the audit log.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn" onClick={load}><IconRefresh size={14} /> Refresh</button>
          <button className="adm-btn" onClick={exportCsv}><IconDownload size={14} /> Export CSV</button>
          <button className="adm-btn primary"><IconUsers size={14} /> Invite admin</button>
        </div>
      </header>

      <div className="adm-stat-grid">
        <StatTile label="Total users" value={numFmt(data?.total)} />
        <StatTile label="Active" value={numFmt(data?.users?.filter((u) => !u.suspended && u.emailVerified).length)} />
        <StatTile label="Suspended" value={numFmt(data?.users?.filter((u) => u.suspended).length)} />
        <StatTile label="KYC pending" value={numFmt(data?.users?.filter((u) => u.kycStatus === 'pending').length)} />
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-toolbar">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 280 }}>
            <IconSearch size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-mute)' }} />
            <input style={{ paddingLeft: 34 }} placeholder="Search email, name or id…"
                   value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="unverified">Unverified</option>
          </select>
          <select value={filters.kyc} onChange={(e) => setFilters((f) => ({ ...f, kyc: e.target.value }))}>
            <option value="">Any KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={`${filters.sort}:${filters.dir}`} onChange={(e) => {
            const [sort, dir] = e.target.value.split(':');
            setFilters((f) => ({ ...f, sort, dir }));
          }}>
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="balance:desc">Highest balance</option>
            <option value="balance:asc">Lowest balance</option>
            <option value="email:asc">Email A–Z</option>
          </select>
          <div className="grow" />
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>
            {data ? `${data.users.length} of ${data.total}` : '—'}
          </div>
        </div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>KYC</th>
                <th className="num">Balance</th>
                <th className="num">Bets</th>
                <th className="num">Deposits</th>
                <th>Tags</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {!loading && data?.users?.length === 0 && (
                <tr><td colSpan={8}><Empty title="No users match" subtitle="Try adjusting your filters." /></td></tr>
              )}
              {!loading && data?.users?.map((u) => (
                <tr key={u.id} onClick={() => openUser(u)} className={selected?.id === u.id ? 'selected' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        display: 'grid', placeItems: 'center',
                        background: 'var(--grad-brand)', color: '#fff',
                        fontWeight: 700, fontSize: 13,
                      }}>{(u.displayName || u.email).charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.displayName || u.email}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {u.suspended
                      ? <Badge tone="danger">Suspended</Badge>
                      : u.emailVerified
                        ? <Badge tone="success" dot>Active</Badge>
                        : <Badge tone="warn">Unverified</Badge>}
                  </td>
                  <td><Badge tone={KYC_TONES[u.kycStatus] || 'default'}>{u.kycStatus || 'unverified'}</Badge></td>
                  <td className="num"><strong>{moneyFmt(u.balance, u.currency)}</strong></td>
                  <td className="num">{u.stats?.bets ?? 0}</td>
                  <td className="num">{moneyFmt(u.stats?.depositTotal)}</td>
                  <td>{(u.tags || []).slice(0, 2).map((t) => <span key={t} style={{ marginRight: 4 }}><Badge tone="brand">{t}</Badge></span>)}</td>
                  <td title={dateShort(u.createdAt)}>{ago(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserDrawer
        open={!!selected}
        user={selected}
        tab={drawerTab}
        setTab={setDrawerTab}
        onClose={() => setSelected(null)}
        onUpdate={(updated) => {
          setSelected(updated);
          setData((d) => d ? { ...d, users: d.users.map((u) => u.id === updated.id ? updated : u) } : d);
        }}
        hasRole={hasRole}
        showToast={showToast}
      />
    </>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="adm-stat" style={{ '--accentGrad': 'linear-gradient(135deg,#7c5cff,#22d3ee)' }}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}

/* ------------------- Drawer ------------------- */

function UserDrawer({ open, user, tab, setTab, onClose, onUpdate, hasRole, showToast }) {
  const [detail, setDetail]   = useState(null);
  const [bets, setBets]       = useState([]);
  const [tx, setTx]           = useState([]);
  const [logins, setLogins]   = useState([]);
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setDetail(null); setBets([]); setTx([]); setLogins([]);
    (async () => {
      try {
        const [d, b, t, l] = await Promise.all([
          adminGetUser(user.id),
          adminUserBets(user.id),
          adminUserTx(user.id),
          adminUserLogins(user.id),
        ]);
        setDetail(d.user);
        setBets(b.bets || []);
        setTx(t.transactions || []);
        setLogins(l.events || []);
      } catch (e) {
        showToast(e.message || 'Failed to load user.', 'error');
      }
    })();
  }, [open, user?.id, showToast]);

  async function doStatus(action) {
    try {
      const { user: updated } = await adminUserStatus(user.id, action);
      setDetail(updated);
      onUpdate(updated);
      showToast(`User ${action}d.`);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function doKyc(status) {
    try {
      const { user: updated } = await adminUserKyc(user.id, status);
      setDetail(updated); onUpdate(updated);
      showToast(`KYC set to ${status}.`);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function saveTags(tags) {
    try {
      const { user: updated } = await adminUserTags(user.id, tags);
      setDetail(updated); onUpdate(updated);
      showToast('Tags saved.');
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function saveNotes(notes) {
    try {
      const { user: updated } = await adminUserNotes(user.id, notes);
      setDetail(updated); onUpdate(updated);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function adjustWallet(delta, reason) {
    try {
      const { user: updated } = await adminUserWallet(user.id, delta, reason);
      setDetail(updated); onUpdate(updated);
      showToast(`Wallet adjusted by ${moneyFmt(delta)}.`);
      setWalletOpen(false);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function resetPassword() {
    if (!confirm('Reset this user\'s password? Their sessions will be revoked.')) return;
    try {
      const r = await adminUserReset(user.id);
      prompt('Temporary password (share securely with the user):', r.tempPassword);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function impersonateUser() {
    try {
      const r = await adminImpersonate(user.id);
      const loginUrl = `${window.location.origin}/login?token=${r.token}&redirect=/`;
      window.open(loginUrl, '_blank');
      showToast('User login link opened in new tab.');
    } catch (e) { showToast(e.message, 'error'); }
  }

  if (!open || !user) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={detail?.displayName || user.displayName || user.email}
      footer={hasRole('moderator') ? (
        <>
          {user.suspended
            ? <button className="adm-btn success" onClick={() => doStatus('unsuspend')}><IconCheck size={14} /> Unsuspend</button>
            : <button className="adm-btn warn"    onClick={() => doStatus('suspend')}><IconBan size={14} /> Suspend</button>}
          {(detail?.emailVerified ?? user.emailVerified)
            ? <button className="adm-btn ghost" onClick={() => doStatus('unverify')}><IconBan size={14} /> Revoke verification</button>
            : <button className="adm-btn success" onClick={() => doStatus('verify')}><IconCheck size={14} /> Verify user</button>}
          {hasRole('finance_admin') && (
            <button className="adm-btn" onClick={() => setWalletOpen(true)}><IconCash size={14} /> Adjust wallet</button>
          )}
          <button className="adm-btn ghost" onClick={resetPassword}><IconKey size={14} /> Reset password</button>
          {hasRole() && (
            <button className="adm-btn" onClick={impersonateUser}><IconUsers size={14} /> Login as user</button>
          )}
        </>
      ) : null}
    >
      <div className="adm-drawer-tabs" style={{ marginLeft: -22, marginRight: -22, padding: '0 22px' }}>
        {['profile', 'bets', 'transactions', 'activity'].map((t) => (
          <button key={t} className={`adm-drawer-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'profile' ? 'Profile' : t === 'bets' ? `Bets (${bets.length})` : t === 'transactions' ? `Tx (${tx.length})` : `Activity (${logins.length})`}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <ProfileTab
          user={detail || user}
          hasRole={hasRole}
          onKyc={doKyc}
          onTags={saveTags}
          onNotes={saveNotes}
        />
      )}

      {tab === 'bets' && (
        bets.length === 0 ? <Empty title="No bets" /> : (
          <table className="adm-table">
            <thead><tr><th>ID</th><th>Status</th><th>Mode</th><th className="num">Stake</th><th className="num">Win</th><th>Placed</th></tr></thead>
            <tbody>
              {bets.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{b.id.slice(0, 16)}…</td>
                  <td><span className={`bet-status ${b.status}`}>{b.status}</span></td>
                  <td>{b.mode}</td>
                  <td className="num">{moneyFmt(b.stake)}</td>
                  <td className="num">{moneyFmt(b.potentialWin)}</td>
                  <td>{ago(b.placedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'transactions' && (
        tx.length === 0 ? <Empty title="No transactions" /> : (
          <table className="adm-table">
            <thead><tr><th>Kind</th><th>Method</th><th className="num">Amount</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id}>
                  <td>{t.kind?.replace(/_/g, ' ')}</td>
                  <td>{t.method || '—'}</td>
                  <td className="num"><strong style={{ color: t.amount > 0 ? 'var(--accent)' : 'var(--danger)' }}>{moneyFmt(t.amount)}</strong></td>
                  <td><Badge tone={t.status === 'completed' ? 'success' : t.status === 'pending' ? 'warn' : 'default'}>{t.status}</Badge></td>
                  <td>{ago(t.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'activity' && (
        logins.length === 0 ? <Empty title="No login events" /> : (
          <div className="adm-list-feed">
            {logins.map((e, i) => (
              <div key={i} className="row">
                <span className={`dot ${e.kind?.includes('failed') ? 'danger' : ''}`} />
                <div>
                  <div style={{ fontWeight: 600 }}>{e.kind?.replace(/_/g, ' ')}</div>
                  <div className="meta">{e.ip} {e.userAgent ? `· ${e.userAgent.slice(0, 40)}…` : ''}</div>
                </div>
                <div className="meta">{ago(e.at)}</div>
              </div>
            ))}
          </div>
        )
      )}

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} user={detail || user} onSubmit={adjustWallet} />
    </Drawer>
  );
}

function ProfileTab({ user, hasRole, onKyc, onTags, onNotes }) {
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState(user.notes || '');
  return (
    <>
      <Card flush>
        <div style={{ padding: 16 }}>
          <dl className="adm-kv">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>User ID</dt><dd style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{user.id}</dd>
            <dt>Balance</dt><dd><strong>{moneyFmt(user.balance, user.currency)}</strong></dd>
            <dt>Joined</dt><dd>{dateShort(user.createdAt)}</dd>
            <dt>Last update</dt><dd>{dateShort(user.updatedAt)}</dd>
            <dt>2FA</dt><dd>{user.twoFactorEnabled ? <Badge tone="success">Enabled</Badge> : <Badge>Off</Badge>}</dd>
          </dl>
        </div>
      </Card>

      <Card title="Lifetime stats">
        <div className="adm-grid c3" style={{ gap: 12 }}>
          <Mini label="Stake"   v={moneyFmt(user.stats?.stakeTotal)} />
          <Mini label="Payouts" v={moneyFmt(user.stats?.payoutTotal)} />
          <Mini label="Bets"    v={numFmt(user.stats?.bets)} />
          <Mini label="Won"     v={numFmt(user.stats?.betsWon)} />
          <Mini label="Lost"    v={numFmt(user.stats?.betsLost)} />
          <Mini label="Deposits" v={moneyFmt(user.stats?.depositTotal)} />
        </div>
      </Card>

      <Card title="KYC" subtitle="Identity verification status">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['unverified', 'pending', 'verified', 'rejected'].map((s) => (
            <button key={s}
              className={`adm-btn ${user.kycStatus === s ? 'primary' : ''}`}
              disabled={!hasRole('moderator', 'support')}
              onClick={() => onKyc(s)}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Tags" subtitle="Use for cohorts, watchlists, promo eligibility">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(user.tags || []).map((t) => (
            <span key={t} onClick={() => hasRole('moderator', 'support') && onTags((user.tags || []).filter((x) => x !== t))}
                  style={{ cursor: hasRole('moderator', 'support') ? 'pointer' : 'default' }}>
              <Badge tone="brand">{t} ×</Badge>
            </span>
          ))}
        </div>
        {hasRole('moderator', 'support') && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="adm-input" placeholder="Add tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && tagInput.trim()) {
                       onTags([...(user.tags || []), tagInput.trim()]); setTagInput('');
                     }
                   }} />
            <button className="adm-btn" onClick={() => { if (tagInput.trim()) { onTags([...(user.tags || []), tagInput.trim()]); setTagInput(''); } }}>Add</button>
          </div>
        )}
      </Card>

      <Card title="Internal notes" subtitle="Visible to admins only">
        <textarea className="adm-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                  disabled={!hasRole('moderator', 'support')} placeholder="VIP since 2024, prefers MoMo. Watch for late-night patterns." />
        {hasRole('moderator', 'support') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="adm-btn primary" onClick={() => onNotes(notes)}>Save notes</button>
          </div>
        )}
      </Card>
    </>
  );
}

function Mini({ label, v }) {
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: 'var(--surface-soft)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.12em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

function WalletModal({ open, onClose, user, onSubmit }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState('credit');
  useEffect(() => { if (open) { setDelta(''); setReason(''); setDirection('credit'); } }, [open]);

  function submit(e) {
    e.preventDefault();
    const n = parseFloat(delta);
    if (!Number.isFinite(n) || n <= 0) return;
    onSubmit(direction === 'credit' ? n : -n, reason || 'Manual adjustment');
  }
  return (
    <Modal open={open} onClose={onClose}
           title="Adjust wallet"
           description={`Current balance: ${moneyFmt(user?.balance, user?.currency)}`}
           footer={null}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['credit', 'Credit'], ['debit', 'Debit']].map(([k, label]) => (
            <button key={k} type="button" className={`adm-btn ${direction === k ? 'primary' : ''}`} onClick={() => setDirection(k)}>{label}</button>
          ))}
        </div>
        <div className="adm-field">
          <label>Amount (GHS)</label>
          <input className="adm-input" type="number" min="0.01" step="0.01" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus required />
        </div>
        <div className="adm-field">
          <label>Reason (required, recorded in audit log)</label>
          <input className="adm-input" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={2} />
        </div>
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn primary">Apply adjustment</button>
        </div>
      </form>
    </Modal>
  );
}
