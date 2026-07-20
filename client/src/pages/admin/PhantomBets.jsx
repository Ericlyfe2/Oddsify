/**
 * Phantom-settled bets — one-off repair tool for the settlement kickoff-
 * parsing bug (see server/src/services/settlement.js). A bet is "phantom"
 * when it was auto-settled before its own fixture's real kickoff, which is
 * only possible if the score that settled it was fake. Reopening a bet
 * restores it to 'open' and claws back any credit that was wrongly paid
 * out (won/void); a bet phantom-settled as 'lost' needed no wallet change
 * since a loss never touched the balance.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, Badge, Modal, Spinner, Empty, moneyFmt, ago, useToast } from '../../components/admin/primitives.jsx';
import { adminPhantomBets, adminReopenPhantomBet, adminReopenAllPhantomBets } from '../../api/adminApi.js';
import { IconCheck } from '../../components/admin/Icons.jsx';

export default function PhantomBetsPage() {
  const { toast: toastState, show } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [reopeningAll, setReopeningAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminPhantomBets();
      setData(r);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Failed to load phantom-settled bets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reopenOne = async (id) => {
    setBusyId(id);
    try {
      const r = await adminReopenPhantomBet(id);
      show(
        r.clawback > 0
          ? `Bet reopened — clawed back ${moneyFmt(r.clawback)}${r.shortfall > 0 ? ` (shortfall ${moneyFmt(r.shortfall)})` : ''}.`
          : 'Bet reopened.',
        'success',
      );
      load();
    } catch (e) {
      show(e.message || 'Reopen failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reopenAll = async () => {
    setReopeningAll(true);
    try {
      const r = await adminReopenAllPhantomBets();
      show(`Reopened ${r.count} phantom-settled bet(s).`, 'success');
      setConfirmAll(false);
      load();
    } catch (e) {
      show(e.message || 'Bulk reopen failed', 'error');
    } finally {
      setReopeningAll(false);
    }
  };

  const bets = data?.bets || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Phantom-Settled Bets</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)', maxWidth: 640 }}>
            Bets auto-settled before their fixture's real kickoff — the result that settled them couldn't have been
            real. Reopening restores the bet to open and claws back any credit that was wrongly paid out.
          </p>
        </div>
        <Badge tone={bets.length > 0 ? 'warn' : 'success'} dot={bets.length > 0}>
          {bets.length} flagged
        </Badge>
      </div>

      {err && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#ef4444',
          }}
        >
          {err}
        </div>
      )}

      {bets.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="adm-btn primary" onClick={() => setConfirmAll(true)}>
            Reopen all {bets.length}
          </button>
        </div>
      )}

      <Card flush>
        {loading ? (
          <Spinner label="Scanning bets…" />
        ) : bets.length === 0 ? (
          <Empty title="No phantom-settled bets" subtitle="Nothing to reopen right now." />
        ) : (
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Fixture</th>
                  <th>Status</th>
                  <th>Stake / Credit</th>
                  <th>Settled</th>
                  <th>Real kickoff</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.user?.displayName || b.user?.email || b.userId}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{b.user?.email || ''}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {b.fixture.home} vs {b.fixture.away}
                    </td>
                    <td>
                      <Badge tone={b.status === 'won' ? 'success' : b.status === 'lost' ? 'danger' : 'default'}>
                        {b.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {moneyFmt(b.stake)} / {moneyFmt(b.creditPaid)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>{ago(b.settledAt)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      {new Date(b.fixture.scheduledKickoff).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => reopenOne(b.id)}
                        disabled={busyId === b.id}
                        className="adm-btn adm-btn-sm"
                        style={{ background: '#22c55e', color: '#fff', border: 'none' }}
                      >
                        <IconCheck /> {busyId === b.id ? 'Reopening…' : 'Reopen'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Reopen all phantom-settled bets"
        description={`This reopens all ${bets.length} bet(s) above and claws back any credit that was wrongly paid out. Cannot be undone.`}
        footer={
          <>
            <button type="button" className="adm-btn ghost" onClick={() => setConfirmAll(false)}>
              Cancel
            </button>
            <button type="button" className="adm-btn primary" onClick={reopenAll} disabled={reopeningAll}>
              {reopeningAll ? 'Working…' : 'Reopen all'}
            </button>
          </>
        }
      />

      {toastState.open && (
        <div className={`adm-toast ${toastState.kind}`} role="status" aria-live="polite">
          <span>{toastState.message}</span>
        </div>
      )}
    </div>
  );
}
