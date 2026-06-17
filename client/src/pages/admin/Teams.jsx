import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListTeams as adminListTeams, mgmtGetTeam as adminGetTeam, mgmtCreateTeam as adminCreateTeam, mgmtPatchTeam as adminPatchTeam, mgmtArchiveTeam as adminArchiveTeam, mgmtListSports as adminListSports } from '../../api/adminApi.js';

function TeamForm({ initial, sports, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', shortName: '', logo: '', country: '', sportId: sports[0]?.id || '', active: true });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Name <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Short Name <input value={form.shortName} onChange={(e) => set('shortName', e.target.value)} /></label>
        <label>Country <input value={form.country} onChange={(e) => set('country', e.target.value)} /></label>
        <label>Logo URL <input value={form.logo} onChange={(e) => set('logo', e.target.value)} /></label>
        <label>Sport
          <select value={form.sportId} onChange={(e) => set('sportId', e.target.value)} required>
            <option value="">Select sport…</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Active <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /></label>
      </div>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">{initial ? 'Update' : 'Create'}</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function TeamsPage() {
  const { hasRole, showToast } = useAdmin();
  const [teams, setTeams] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ sportId: '', search: '' });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit = hasRole('odds_manager', 'super_admin');

  const load = () => {
    setLoading(true);
    Promise.all([
      adminListTeams(filter),
      adminListSports().catch(() => ({ sports: [] })),
    ]).then(([td, sd]) => {
      setTeams(td.teams);
      setSports(sd.sports || []);
    }).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const handleSave = async (data) => {
    try {
      if (editId) { await adminPatchTeam(editId, data); showToast('Team updated', 'success'); }
      else { await adminCreateTeam(data); showToast('Team created', 'success'); }
      setShowForm(false); setEditId(null); load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleArchive = async (id) => {
    try { await adminArchiveTeam(id); showToast('Team archived', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  if (loading) return <Spinner label="Loading teams..." />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Teams</h1>
        {canEdit && <button onClick={() => { setEditId(null); setShowForm(true); }} className="adm-btn">+ New Team</button>}
      </header>

      <div className="adm-filter-bar">
        <select value={filter.sportId} onChange={(e) => setFilter((f) => ({ ...f, sportId: e.target.value }))}>
          <option value="">All sports</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="Search teams…" value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} />
      </div>

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditId(null); }}>
          <TeamForm initial={editId ? teams.find((t) => t.id === editId) : null} sports={sports} onSave={handleSave} onCancel={() => { setShowForm(false); setEditId(null); }} />
        </Modal>
      )}

      {!teams.length ? <Empty message="No teams found" /> : (
        <Card title={`${teams.length} Teams`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Short</th><th>Sport</th><th>Country</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.logo && <img src={t.logo} alt="" className="adm-icon-sm" />} {t.name}</td>
                    <td><code>{t.shortName}</code></td>
                    <td>{sportName(t.sportId)}</td>
                    <td>{t.country}</td>
                    <td><Badge type={t.active ? 'success' : 'muted'}>{t.active ? 'Active' : 'Archived'}</Badge></td>
                    <td>
                      {canEdit && <>
                        <button onClick={() => { setEditId(t.id); setShowForm(true); }} className="adm-btn-sm">Edit</button>
                        {t.active && <button onClick={() => handleArchive(t.id)} className="adm-btn-sm">Archive</button>}
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
