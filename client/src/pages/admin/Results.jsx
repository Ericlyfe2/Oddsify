import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListMatches as adminListMatches, mgmtGetResult as adminGetResult, mgmtEnterResult as adminEnterResult, mgmtConfirmResult as adminConfirmResult, mgmtOverrideResult as adminOverrideResult, mgmtResultHistory as adminResultHistory, mgmtListSports as adminListSports } from '../../api/adminApi.js';

function ResultForm({ matchId, onSave, onCancel }) {
  const [form, setForm] = useState({ homeScore: 0, awayScore: 0, htHomeScore: '', htAwayScore: '', reason: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e) => { e.preventDefault(); onSave({ ...form, htHomeScore: form.htHomeScore !== '' ? +form.htHomeScore : undefined, htAwayScore: form.htAwayScore !== '' ? +form.htAwayScore : undefined }); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Home Score <input type="number" min="0" value={form.homeScore} onChange={(e) => set('homeScore', +e.target.value)} required /></label>
        <label>Away Score <input type="number" min="0" value={form.awayScore} onChange={(e) => set('awayScore', +e.target.value)} required /></label>
        <label>HT Home Score <input type="number" min="0" value={form.htHomeScore} onChange={(e) => set('htHomeScore', e.target.value)} /></label>
        <label>HT Away Score <input type="number" min="0" value={form.htAwayScore} onChange={(e) => set('htAwayScore', e.target.value)} /></label>
        <label style={{ gridColumn: '1 / -1' }}>Reason <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} required /></label>
      </div>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">Enter Result</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function ResultsPage() {
  const { hasRole, showToast } = useAdmin();
  const [matches, setMatches] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResult, setLoadingResult] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  const canEdit = hasRole('odds_manager', 'super_admin');

  useEffect(() => {
    Promise.all([
      adminListMatches().catch(() => ({ matches: [] })),
      adminListSports().catch(() => ({ sports: [] })),
    ]).then(([md, sd]) => {
      setMatches(md.matches || []);
      setSports(sd.sports || []);
    }).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  const loadResult = (matchId) => {
    setLoadingResult(true);
    setSelectedMatch(matchId);
    Promise.all([
      adminGetResult(matchId).then((d) => setResult(d.result)).catch(() => setResult(null)),
      adminResultHistory(matchId).then((d) => setHistory(d.history || [])).catch(() => setHistory([])),
    ]).catch((e) => showToast(e.message, 'error')).finally(() => setLoadingResult(false));
  };

  const handleEnter = async (data) => {
    try {
      await adminEnterResult(selectedMatch, data);
      showToast('Result entered (provisional)', 'success');
      setShowEnter(false);
      loadResult(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleConfirm = async () => {
    if (!confirm('Confirm this result? This will trigger settlement.')) return;
    try {
      await adminConfirmResult(selectedMatch);
      showToast('Result confirmed — settlement triggered', 'success');
      loadResult(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleOverride = async (data) => {
    try {
      await adminOverrideResult(selectedMatch, data);
      showToast('Result overridden (back to provisional)', 'success');
      setShowOverride(false);
      loadResult(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const matchLabel = (m) => `${m.homeTeamName || m.homeTeamId} vs ${m.awayTeamName || m.awayTeamId}`;
  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  if (loading) return <Spinner label="Loading…" />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Result Entry</h1>
      </header>

      <div className="adm-filter-bar">
        <select onChange={(e) => e.target.value && loadResult(e.target.value)} defaultValue="">
          <option value="" disabled>Select match…</option>
          <optgroup label="Live / Recently Settled">
            {matches.filter((m) => ['live', 'suspended', 'settled'].includes(m.status)).map((m) => (
              <option key={m.id} value={m.id}>{matchLabel(m)} — {sportName(m.sportId)}</option>
            ))}
          </optgroup>
          <optgroup label="Scheduled">
            {matches.filter((m) => ['scheduled', 'draft'].includes(m.status)).map((m) => (
              <option key={m.id} value={m.id}>{matchLabel(m)}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {loadingResult && <Spinner label="Loading result…" />}

      {selectedMatch && !loadingResult && !result && (
        <>
          <Empty message="No result entered yet." />
          {canEdit && <button onClick={() => setShowEnter(true)} className="adm-btn">Enter Result</button>}
        </>
      )}

      {selectedMatch && !loadingResult && result && (
        <Card title={`Result: ${result.homeScore} — ${result.awayScore}`} subtitle={`Status: ${result.status}`}>
          <div className="adm-form-grid">
            <div><strong>Home:</strong> {result.homeScore}</div>
            <div><strong>Away:</strong> {result.awayScore}</div>
            {result.htHomeScore != null && <div><strong>HT Home:</strong> {result.htHomeScore}</div>}
            {result.htAwayScore != null && <div><strong>HT Away:</strong> {result.htAwayScore}</div>}
            <div><strong>Status:</strong> <Badge type={result.status === 'confirmed' ? 'success' : 'warning'}>{result.status}</Badge></div>
            <div><strong>Entered by:</strong> {result.enteredBy}</div>
            {result.confirmedAt && <div><strong>Confirmed:</strong> {new Date(result.confirmedAt).toLocaleString()}</div>}
            <div style={{ gridColumn: '1 / -1' }}><strong>Reason:</strong> {result.reason || '—'}</div>
          </div>

          {canEdit && (
            <div style={{ marginTop: 12 }}>
              {result.status === 'provisional' && (
                <button onClick={handleConfirm} className="adm-btn" style={{ marginRight: 8 }}>Confirm Result</button>
              )}
              <button onClick={() => setShowOverride(true)} className="adm-btn adm-btn-secondary">Override</button>
            </div>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <Card title={`Revision History (${history.length})`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Date</th><th>Prev Score</th><th>New Score</th><th>Changed By</th><th>Reason</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.changedAt).toLocaleString()}</td>
                    <td>{h.previousResult?.homeScore}—{h.previousResult?.awayScore}</td>
                    <td>{h.newResult?.homeScore}—{h.newResult?.awayScore}</td>
                    <td>{h.changedBy || '—'}</td>
                    <td>{h.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showEnter && (
        <Modal onClose={() => setShowEnter(false)}>
          <ResultForm matchId={selectedMatch} onSave={handleEnter} onCancel={() => setShowEnter(false)} />
        </Modal>
      )}

      {showOverride && (
        <Modal onClose={() => setShowOverride(false)}>
          <ResultForm matchId={selectedMatch} onSave={handleOverride} onCancel={() => setShowOverride(false)} />
        </Modal>
      )}
    </>
  );
}
