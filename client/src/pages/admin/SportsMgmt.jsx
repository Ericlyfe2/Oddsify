import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListSports as adminListSports, mgmtGetSport as adminGetSport, mgmtCreateSport as adminCreateSport, mgmtPatchSport as adminPatchSport, mgmtArchiveSport as adminArchiveSport, mgmtRestoreSport as adminRestoreSport } from '../../api/adminApi.js';

function SportForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', key: '', icon: '', sortOrder: 0, active: true });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Name <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Key <input value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="my-sport" required={!initial} /></label>
        <label>Icon (URL) <input value={form.icon} onChange={(e) => set('icon', e.target.value)} /></label>
        <label>Sort Order <input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', +e.target.value)} /></label>
        <label>Active <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /></label>
      </div>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">{initial ? 'Update' : 'Create'}</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function SportsMgmtPage() {
  const { hasRole, showToast } = useAdmin();
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit = hasRole('odds_manager', 'super_admin');

  const load = () => {
    setLoading(true);
    adminListSports().then((d) => setSports(d.sports)).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async (data) => {
    try {
      if (editId) { await adminPatchSport(editId, data); showToast('Sport updated', 'success'); }
      else { await adminCreateSport(data); showToast('Sport created', 'success'); }
      setShowForm(false); setEditId(null); load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const toggleActive = async (sport) => {
    try {
      if (sport.active) await adminArchiveSport(sport.id);
      else await adminRestoreSport(sport.id);
      showToast(`Sport ${sport.active ? 'archived' : 'restored'}`, 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  if (loading) return <Spinner label="Loading sports..." />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Sports Management</h1>
        {canEdit && <button onClick={() => { setEditId(null); setShowForm(true); }} className="adm-btn">+ New Sport</button>}
      </header>

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditId(null); }}>
          <SportForm initial={editId ? sports.find((s) => s.id === editId) : null} onSave={handleSave} onCancel={() => { setShowForm(false); setEditId(null); }} />
        </Modal>
      )}

      {!sports.length ? <Empty message="No sports configured" /> : (
        <Card title={`${sports.length} Sports`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Key</th><th>Name</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {sports.map((s) => (
                  <tr key={s.id}>
                    <td><code>{s.key}</code></td>
                    <td>{s.icon && <img src={s.icon} alt="" className="adm-icon-sm" />} {s.name}</td>
                    <td>{s.sortOrder}</td>
                    <td><Badge type={s.active ? 'success' : 'muted'}>{s.active ? 'Active' : 'Archived'}</Badge></td>
                    <td>
                      {canEdit && <>
                        <button onClick={() => { setEditId(s.id); setShowForm(true); }} className="adm-btn-sm">Edit</button>
                        <button onClick={() => toggleActive(s)} className="adm-btn-sm">{s.active ? 'Archive' : 'Restore'}</button>
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
