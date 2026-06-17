import { useEffect, useState } from 'react';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Modal, Empty, Spinner } from '../../components/admin/primitives.jsx';
import { mgmtListMatches as adminListMatches, mgmtListMatchMarkets as adminListMatchMarkets, mgmtCreateMatchMarket as adminCreateMatchMarket, mgmtPatchMatchMarket as adminPatchMatchMarket, mgmtPatchSelection as adminPatchSelection, mgmtListSports as adminListSports } from '../../api/adminApi.js';

export default function MarketsPage() {
  const { hasRole, showToast } = useAdmin();
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [templateKey, setTemplateKey] = useState('');

  const canEdit = hasRole('odds_manager', 'super_admin');

  useEffect(() => {
    Promise.all([
      adminListMatches({ status: ['scheduled', 'live', 'draft'] }).catch(() => ({ matches: [] })),
      adminListSports().catch(() => ({ sports: [] })),
    ]).then(([md, sd]) => {
      setMatches(md.matches || []);
      setSports(sd.sports || []);
    }).catch((e) => showToast(e.message, 'error'))
    .finally(() => setLoading(false));
  }, []);

  const loadMarkets = (matchId) => {
    setMarketsLoading(true);
    adminListMatchMarkets(matchId).then((d) => {
      setMarkets(d.markets || []);
      setSelectedMatch(matchId);
    }).catch((e) => showToast(e.message, 'error'))
    .finally(() => setMarketsLoading(false));
  };

  const handleAddMarket = async () => {
    if (!templateKey) return;
    try {
      await adminCreateMatchMarket(selectedMatch, { templateKey });
      showToast('Market added', 'success');
      setShowAddMarket(false);
      setTemplateKey('');
      loadMarkets(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleMarketStatus = async (marketId, status) => {
    try {
      const body = status === 'open' ? { status: 'open' } : { status: status === 'disabled' ? 'disabled' : 'suspended' };
      await adminPatchMatchMarket(selectedMatch, marketId, body);
      showToast(`Market ${body.status}`, 'success');
      loadMarkets(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handlePriceUpdate = async (marketId, selId, price) => {
    try {
      await adminPatchSelection(selectedMatch, marketId, selId, { price });
      showToast('Price updated', 'success');
      loadMarkets(selectedMatch);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const matchLabel = (m) => `${m.homeTeamName || m.homeTeamId} vs ${m.awayTeamName || m.awayTeamId}`;
  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  if (loading) return <Spinner label="Loading…" />;

  return (
    <>
      <header className="adm-page-head">
        <h1>Market Management</h1>
      </header>

      <div className="adm-filter-bar">
        <select onChange={(e) => e.target.value && loadMarkets(e.target.value)} defaultValue="">
          <option value="" disabled>Select match…</option>
          <optgroup label="Scheduled / Live">
            {matches.filter((m) => ['draft', 'scheduled', 'live'].includes(m.status)).map((m) => (
              <option key={m.id} value={m.id}>{matchLabel(m)} — {sportName(m.sportId)}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {marketsLoading && <Spinner label="Loading markets…" />}

      {selectedMatch && !marketsLoading && markets.length === 0 && (
        <Empty message="No markets for this match. Add one below." />
      )}

      {markets.map((mkt) => (
        <Card key={mkt.id} title={`${mkt.name} — ${mkt.status}`} subtitle={`${mkt.key} | Margin: ${(mkt.marginPct * 100).toFixed(1)}%`}>
          {canEdit && (
            <div style={{ marginBottom: 8 }}>
              {mkt.status !== 'open' && <button onClick={() => handleMarketStatus(mkt.id, 'open')} className="adm-btn-sm">Enable</button>}
              {mkt.status === 'open' && <button onClick={() => handleMarketStatus(mkt.id, 'suspended')} className="adm-btn-sm">Suspend</button>}
              {mkt.status !== 'disabled' && <button onClick={() => handleMarketStatus(mkt.id, 'disabled')} className="adm-btn-sm adm-btn-danger">Disable</button>}
            </div>
          )}
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Outcome</th><th>Label</th><th>Price</th><th>Active</th>{canEdit && <th>Update Price</th>}</tr></thead>
              <tbody>
                {(mkt.selections || []).map((s) => (
                  <tr key={s.id}>
                    <td><code>{s.outcomeKey}</code></td>
                    <td>{s.label}</td>
                    <td><strong>{s.price?.toFixed(2)}</strong></td>
                    <td><Badge type={s.active ? 'success' : 'danger'}>{s.active ? 'Active' : 'Suspended'}</Badge></td>
                    {canEdit && (
                      <td>
                        <input
                          type="number" step="0.01" min="1.01"
                          defaultValue={s.price}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val > 0 && val !== s.price) handlePriceUpdate(mkt.id, s.id, val);
                          }}
                          style={{ width: 80 }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {selectedMatch && canEdit && (
        <div style={{ marginTop: 16 }}>
          {showAddMarket ? (
            <Card title="Add Market">
              <div className="adm-form-row">
                <input placeholder="Template key (e.g. OU25, BTTS, DC)" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} />
                <button onClick={handleAddMarket} className="adm-btn-sm">Add</button>
                <button onClick={() => { setShowAddMarket(false); setTemplateKey(''); }} className="adm-btn-sm adm-btn-secondary">Cancel</button>
              </div>
            </Card>
          ) : (
            <button onClick={() => setShowAddMarket(true)} className="adm-btn">+ Add Market</button>
          )}
        </div>
      )}
    </>
  );
}
