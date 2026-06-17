import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListLeagues as adminListLeagues, mgmtGetLeague as adminGetLeague, mgmtCreateLeague as adminCreateLeague, mgmtPatchLeague as adminPatchLeague, mgmtArchiveLeague as adminArchiveLeague, mgmtRestoreLeague as adminRestoreLeague, mgmtListSports as adminListSports } from '../../api/adminApi.js';

function LeagueForm({ initial, sports, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', sportId: sports[0]?.id || '', country: '', logo: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Name <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Country <input value={form.country} onChange={(e) => set('country', e.target.value)} /></label>
        <label>Sport
          <select value={form.sportId} onChange={(e) => set('sportId', e.target.value)} required>
            <option value="">Select sport…</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Logo URL <input value={form.logo} onChange={(e) => set('logo', e.target.value)} /></label>
      </div>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">{initial ? 'Update' : 'Create'}</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function LeaguesPage() {
  const { hasRole, showToast } = useAdmin();
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ sportId: '', search: '', status: '' });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit = hasRole('odds_manager', 'super_admin');

  const load = () => {
    setLoading(true);
    Promise.all([
      adminListLeagues(filter),
      adminListSports().catch(() => ({ sports: [] })),
    ]).then(([ld, sd]) => {
      setLeagues(ld.leagues);
      setSports(sd.sports || []);
    }).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const handleSave = async (data) => {
    try {
      if (editId) { await adminPatchLeague(editId, data); showToast('League updated', 'success'); }
      else { await adminCreateLeague(data); showToast('League created', 'success'); }
      setShowForm(false); setEditId(null); load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const toggleStatus = async (league) => {
    try {
      if (league.status === 'active') await adminArchiveLeague(league.id);
      else await adminRestoreLeague(league.id);
      showToast(`League ${league.status === 'active' ? 'archived' : 'restored'}`, 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  if (loading) return <Spinner label="Loading leagues..." />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Leagues</h1>
        {canEdit && <button onClick={() => { setEditId(null); setShowForm(true); }} className="adm-btn">+ New League</button>}
      </header>

      <div className="adm-filter-bar">
        <select value={filter.sportId} onChange={(e) => setFilter((f) => ({ ...f, sportId: e.target.value }))}>
          <option value="">All sports</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <input placeholder="Search leagues…" value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} />
      </div>

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditId(null); }}>
          <LeagueForm initial={editId ? leagues.find((l) => l.id === editId) : null} sports={sports} onSave={handleSave} onCancel={() => { setShowForm(false); setEditId(null); }} />
        </Modal>
      )}

      {!leagues.length ? <Empty message="No leagues found" /> : (
        <Card title={`${leagues.length} Leagues`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Sport</th><th>Country</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {leagues.map((l) => (
                  <tr key={l.id}>
                    <td>{l.logo && <img src={l.logo} alt="" className="adm-icon-sm" />} {l.name}</td>
                    <td>{sportName(l.sportId)}</td>
                    <td>{l.country || '—'}</td>
                    <td><Badge type={l.status === 'active' ? 'success' : 'muted'}>{l.status}</Badge></td>
                    <td>
                      {canEdit && <>
                        <button onClick={() => { setEditId(l.id); setShowForm(true); }} className="adm-btn-sm">Edit</button>
                        <button onClick={() => toggleStatus(l)} className="adm-btn-sm">{l.status === 'active' ? 'Archive' : 'Restore'}</button>
                      </>}
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
