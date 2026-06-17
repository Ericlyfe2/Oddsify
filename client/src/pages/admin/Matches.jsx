import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListMatches as adminListMatches, mgmtGetMatch as adminGetMatch, mgmtCreateMatch as adminCreateMatch, mgmtPatchMatch as adminPatchMatch, mgmtMatchStatus as adminMatchStatus, mgmtCancelMatch as adminCancelMatch, mgmtArchiveMatch as adminArchiveMatch, mgmtListSports as adminListSports, mgmtListLeagues as adminListLeagues, mgmtListTeams as adminListTeams } from '../../api/adminApi.js';

const STATUS_MAP = { draft: 'muted', scheduled: 'info', live: 'success', suspended: 'warning', cancelled: 'danger', settled: 'primary', archived: 'muted' };

function MatchForm({ onSave, onCancel }) {
  const [sports, setSports] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ leagueId: '', homeTeamId: '', awayTeamId: '', startTime: '', sportId: '', round: '', venue: '' });

  useEffect(() => {
    adminListSports().then((d) => setSports(d.sports || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.sportId) {
      adminListLeagues({ sportId: form.sportId }).then((d) => setLeagues(d.leagues || [])).catch(() => {});
      adminListTeams({ sportId: form.sportId }).then((d) => setTeams(d.teams || [])).catch(() => {});
    }
  }, [form.sportId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Sport
          <select value={form.sportId} onChange={(e) => set('sportId', e.target.value)} required>
            <option value="">Select sport…</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>League
          <select value={form.leagueId} onChange={(e) => set('leagueId', e.target.value)} required disabled={!form.sportId}>
            <option value="">Select league…</option>
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label>Home Team
          <select value={form.homeTeamId} onChange={(e) => set('homeTeamId', e.target.value)} required disabled={!form.sportId}>
            <option value="">Select home team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>Away Team
          <select value={form.awayTeamId} onChange={(e) => set('awayTeamId', e.target.value)} required disabled={!form.sportId}>
            <option value="">Select away team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>Start Time <input type="datetime-local" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required /></label>
        <label>Round <input value={form.round} onChange={(e) => set('round', e.target.value)} /></label>
        <label>Venue <input value={form.venue} onChange={(e) => set('venue', e.target.value)} /></label>
      </div>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">Create Match</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function MatchesPage() {
  const { hasRole, showToast } = useAdmin();
  const [matches, setMatches] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ sportId: '', status: '', dateFrom: '' });
  const [showForm, setShowForm] = useState(false);
  const [transitioning, setTransitioning] = useState(null);

  const canEdit = hasRole('odds_manager', 'super_admin');

  const load = () => {
    setLoading(true);
    adminListMatches(filter).then((d) => setMatches(d.matches || [])).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
    if (!sports.length) adminListSports().then((d) => setSports(d.sports || [])).catch(() => {});
  };

  useEffect(load, [filter]);

  const handleCreate = async (data) => {
    try {
      const startTime = data.startTime ? new Date(data.startTime).toISOString() : '';
      await adminCreateMatch({ ...data, startTime });
      showToast('Match created with auto-attached markets', 'success');
      setShowForm(false);
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleStatus = async (id, status) => {
    setTransitioning(id);
    try {
      await adminMatchStatus(id, status);
      showToast(`Match status → ${status}`, 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setTransitioning(null); }
  };

  const handleCancel = async (id) => {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    try { await adminCancelMatch(id, reason); showToast('Match cancelled', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleArchive = async (id) => {
    if (!confirm('Archive this match?')) return;
    try { await adminArchiveMatch(id); showToast('Match archived', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  const nextStatuses = (status) => {
    const map = { draft: ['scheduled'], scheduled: ['live', 'cancelled'], live: ['suspended', 'settled'], suspended: ['live', 'settled'], settled: ['archived'], cancelled: ['archived'] };
    return map[status] || [];
  };

  if (loading && !matches.length) return <Spinner label="Loading matches..." />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Matches</h1>
        {canEdit && <button onClick={() => setShowForm(true)} className="adm-btn">+ New Match</button>}
      </header>

      <div className="adm-filter-bar">
        <select value={filter.sportId} onChange={(e) => setFilter((f) => ({ ...f, sportId: e.target.value }))}>
          <option value="">All sports</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All status</option>
          {Object.keys(STATUS_MAP).map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={filter.dateFrom} onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))} />
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <MatchForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {!matches.length ? <Empty message="No matches found" /> : (
        <Card title={`${matches.length} Matches`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Teams</th><th>Sport</th><th>Start</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.homeTeamName || m.homeTeamId}</strong> vs <strong>{m.awayTeamName || m.awayTeamId}</strong></td>
                    <td>{sportName(m.sportId)}</td>
                    <td>{new Date(m.startsAt).toLocaleString()}</td>
                    <td><Badge type={STATUS_MAP[m.status]}>{m.status}</Badge></td>
                    <td>
                      {canEdit && nextStatuses(m.status).map((ns) => (
                        <button key={ns} onClick={() => handleStatus(m.id, ns)} className="adm-btn-sm" disabled={transitioning === m.id}>
                          {ns === 'cancelled' ? 'Cancel' : ns}
                        </button>
                      ))}
                      {m.status === 'cancelled' && <button onClick={() => handleArchive(m.id)} className="adm-btn-sm">Archive</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
