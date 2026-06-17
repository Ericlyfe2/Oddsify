import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner, showToast } from '../../components/admin/primitives.jsx';
import { adminCatalog, adminGetTemplate, adminCreateTemplate, adminPatchTemplate, adminDeleteTemplate } from '../../api/adminApi.js';

const SPORTS = { football: '⚽ Football', basketball: '🏀 Basketball', tennis: '🎾 Tennis' };
const SPEC_TYPES = ['fixed', 'correct_score_grid', 'combo'];

function TemplateForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { key: '', name: '', sportId: ['football'], autoAttach: true, sortOrder: 1, defaultEnabled: true, selectionSpec: { type: 'fixed', outcomes: [{ key: '', label: '' }] } });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSpec = (k, v) => setForm((f) => ({ ...f, selectionSpec: { ...f.selectionSpec, [k]: v } }));

  const handleOutcomeChange = (i, k, v) => {
    const outcomes = [...(form.selectionSpec.outcomes || [])];
    outcomes[i] = { ...outcomes[i], [k]: v };
    setSpec('outcomes', outcomes);
  };

  const addOutcome = () => setSpec('outcomes', [...(form.selectionSpec.outcomes || []), { key: '', label: '' }]);
  const removeOutcome = (i) => setSpec('outcomes', form.selectionSpec.outcomes.filter((_, idx) => idx !== i));

  const onSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form className="adm-form" onSubmit={onSubmit}>
      <div className="adm-form-grid">
        <label>Key <input value={form.key} onChange={(e) => set('key', e.target.value)} required disabled={initial} /></label>
        <label>Name <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Sort Order <input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', +e.target.value)} /></label>
        <label>Auto-Attach <input type="checkbox" checked={form.autoAttach} onChange={(e) => set('autoAttach', e.target.checked)} /></label>
        <label>Default Enabled <input type="checkbox" checked={form.defaultEnabled} onChange={(e) => set('defaultEnabled', e.target.checked)} /></label>
        <label>Sport
          <select multiple value={form.sportId} onChange={(e) => set('sportId', Array.from(e.target.selectedOptions, (o) => o.value))}>
            {Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <fieldset><legend>Selection Spec</legend>
        <label>Type
          <select value={form.selectionSpec.type} onChange={(e) => setSpec('type', e.target.value)}>
            {SPEC_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {form.selectionSpec.type === 'correct_score_grid' && (
          <div className="adm-form-grid">
            <label>Max Home <input type="number" value={form.selectionSpec.maxHome || 6} onChange={(e) => setSpec('maxHome', +e.target.value)} /></label>
            <label>Max Away <input type="number" value={form.selectionSpec.maxAway || 6} onChange={(e) => setSpec('maxAway', +e.target.value)} /></label>
            <label>Include Other <input type="checkbox" checked={form.selectionSpec.includeOther !== false} onChange={(e) => setSpec('includeOther', e.target.checked)} /></label>
          </div>
        )}
        {form.selectionSpec.type === 'fixed' && (
          <div><h4>Outcomes</h4>
            {form.selectionSpec.outcomes?.map((o, i) => (
              <div key={i} className="adm-form-row">
                <input placeholder="Key" value={o.key} onChange={(e) => handleOutcomeChange(i, 'key', e.target.value)} />
                <input placeholder="Label" value={o.label} onChange={(e) => handleOutcomeChange(i, 'label', e.target.value)} />
                <button type="button" onClick={() => removeOutcome(i)} className="adm-btn-sm adm-btn-danger">✕</button>
              </div>
            ))}
            <button type="button" onClick={addOutcome} className="adm-btn-sm">+ Outcome</button>
          </div>
        )}
      </fieldset>
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn">{initial ? 'Update' : 'Create'} Template</button>
        <button type="button" onClick={onCancel} className="adm-btn adm-btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export default function CatalogPage() {
  const { hasRole, showToast } = useAdmin();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit = hasRole('odds_manager', 'super_admin');

  const load = () => {
    setLoading(true);
    adminCatalog().then((d) => setTemplates(d.templates)).catch((e) => showToast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async (data) => {
    try {
      if (editId) {
        await adminPatchTemplate(editId, data);
        showToast('Template updated', 'success');
      } else {
        await adminCreateTemplate(data);
        showToast('Template created', 'success');
      }
      setShowForm(false);
      setEditId(null);
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try { await adminDeleteTemplate(id); showToast('Template deleted', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const openEdit = (id) => {
    adminGetTemplate(id).then((d) => { setEditId(id); setShowForm(true); }).catch((e) => showToast(e.message, 'error'));
  };

  const sportsLabel = (ids) => ids.map((id) => SPORTS[id] || id).join(', ');

  if (loading) return <Spinner label="Loading templates..." />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Market Catalog</h1>
        {canEdit && <button onClick={() => { setEditId(null); setShowForm(true); }} className="adm-btn">+ New Template</button>}
      </header>

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditId(null); }}>
          <TemplateForm initial={editId ? templates.find((t) => t.id === editId) : null} onSave={handleSave} onCancel={() => { setShowForm(false); setEditId(null); }} />
        </Modal>
      )}

      {!templates.length ? <Empty message="No templates yet" /> : (
        <Card title={`${templates.length} Templates`}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Key</th><th>Name</th><th>Sport</th><th>Type</th><th>Auto</th><th>Order</th><th>Actions</th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td><code>{t.key}</code></td>
                    <td>{t.name}</td>
                    <td>{sportsLabel(t.sportId)}</td>
                    <td><Badge>{t.selectionSpec?.type}</Badge></td>
                    <td>{t.autoAttach ? '✓' : '—'}</td>
                    <td>{t.sortOrder}</td>
                    <td>
                      {canEdit && <><button onClick={() => openEdit(t.id)} className="adm-btn-sm">Edit</button> <button onClick={() => handleDelete(t.id)} className="adm-btn-sm adm-btn-danger">Delete</button></>}
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
