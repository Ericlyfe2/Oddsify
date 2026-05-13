/**
 * Sports & odds admin.
 *  - Fixtures table with sport / league / status filters
 *  - Create fixture modal
 *  - Drawer to: edit kickoff / live / scores, override per-selection odds,
 *    suspend whole match / market / selection, record final score + auto-settle.
 *  - Quick "Settle now" runs the global engine on demand.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  adminFixtures, adminFixture, adminCreateFixture, adminPatchFixture, adminDeleteFixture,
  adminPatchOdds, adminResetOdds, adminSuspend, adminClearSuspend,
  adminRecordResult, adminTriggerSettle, adminLeagues, adminCreateLeague,
} from '../../api/adminApi.js';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import { Card, Badge, Drawer, Modal, Empty, SkeletonRow, moneyFmt, numFmt, ago } from '../../components/admin/primitives.jsx';
import {
  IconSearch, IconRefresh, IconLive, IconBan, IconCheck, IconSettle, IconBook, IconAlert,
} from '../../components/admin/Icons.jsx';

export default function SportsAdmin() {
  const { hasRole, showToast } = useAdmin();
  const [filters, setFilters] = useState({ q: '', sport: '', leagueId: '', status: '' });
  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [fx, lg] = await Promise.all([adminFixtures(filters), adminLeagues()]);
      setData(fx); setLeagues(lg.leagues || []);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters.q, filters.sport, filters.leagueId, filters.status]); // eslint-disable-line

  const filteredLeagues = useMemo(() =>
    leagues.filter((l) => !filters.sport || l.sport === filters.sport),
    [leagues, filters.sport]
  );

  async function settleEverything() {
    try {
      // call /sports/fixtures/dummy/settle just to trigger; backend ignores id
      await adminTriggerSettle('all');
      showToast('Settlement sweep triggered.');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <>
      <header className="adm-page-head">
        <div>
          <h1>Sports & odds</h1>
          <p>Fixtures, markets, real-time odds intervention, and manual results. All actions audited.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn" onClick={load}><IconRefresh size={14} /> Refresh</button>
          {hasRole('odds_manager') && <button className="adm-btn" onClick={() => setLeagueOpen(true)}><IconBook size={14} /> New league</button>}
          {hasRole('odds_manager') && <button className="adm-btn primary" onClick={() => setCreateOpen(true)}><IconCheck size={14} /> New fixture</button>}
          {hasRole('odds_manager') && <button className="adm-btn warn" onClick={settleEverything}><IconSettle size={14} /> Settle now</button>}
        </div>
      </header>

      <div className="adm-stat-grid">
        <StatTile label="Total fixtures" value={numFmt(data?.total)} />
        <StatTile label="Live now" value={numFmt(data?.fixtures?.filter((f) => f.isLive).length)} />
        <StatTile label="Finished" value={numFmt(data?.fixtures?.filter((f) => f.finished).length)} />
        <StatTile label="Suspended" value={numFmt(data?.fixtures?.filter((f) => f.suspended).length)} />
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-toolbar">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 240 }}>
            <IconSearch size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-mute)' }} />
            <input style={{ paddingLeft: 34 }} placeholder="Search fixtures…"
                   value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <select value={filters.sport} onChange={(e) => setFilters((f) => ({ ...f, sport: e.target.value, leagueId: '' }))}>
            <option value="">All sports</option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
          </select>
          <select value={filters.leagueId} onChange={(e) => setFilters((f) => ({ ...f, leagueId: e.target.value }))}>
            <option value="">All leagues</option>
            {filteredLeagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Any status</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="finished">Finished</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="grow" />
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{data?.total ?? '—'} fixtures</div>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Fixture</th>
                <th>League</th>
                <th>Status</th>
                <th>Kick-off</th>
                <th className="num">Home</th>
                <th className="num">Draw</th>
                <th className="num">Away</th>
                <th>Markets</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {!loading && data?.fixtures?.length === 0 && (
                <tr><td colSpan={8}><Empty title="No fixtures match" subtitle="Adjust filters or create a new fixture." /></td></tr>
              )}
              {!loading && data?.fixtures?.map((m) => {
                const main = m.markets?.['1X2'] || m.markets?.['ML'];
                const home = main?.selections?.find((s) => s.key === '1');
                const draw = main?.selections?.find((s) => s.key === 'X');
                const away = main?.selections?.find((s) => s.key === '2');
                const status = m.finished ? 'finished' : m.isLive ? 'live' : m.suspended ? 'suspended' : 'upcoming';
                return (
                  <tr key={m.id} onClick={() => setSelected(m)} className={selected?.id === m.id ? 'selected' : ''}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.home} — {m.away}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{m.sport} · {m.id}</div>
                    </td>
                    <td>{m.leagueName || m.leagueId}</td>
                    <td>
                      {status === 'live' && <Badge tone="danger" dot>Live {m.minute || ''}</Badge>}
                      {status === 'upcoming' && <Badge tone="info">Upcoming</Badge>}
                      {status === 'finished' && <Badge tone="success">Finished {m.scoreHome}-{m.scoreAway}</Badge>}
                      {status === 'suspended' && <Badge tone="warn">Suspended</Badge>}
                    </td>
                    <td>{m.day} {m.kickoff || ''}</td>
                    <td className="num">{home ? home.odds.toFixed(2) : '—'}</td>
                    <td className="num">{draw ? draw.odds.toFixed(2) : '—'}</td>
                    <td className="num">{away ? away.odds.toFixed(2) : '—'}</td>
                    <td>{m.moreMarkets || Object.keys(m.markets || {}).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FixtureDrawer
        open={!!selected}
        fixtureId={selected?.id}
        onClose={() => setSelected(null)}
        hasRole={hasRole}
        showToast={showToast}
        onChange={load}
      />

      <CreateFixtureModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        leagues={leagues}
        onCreated={() => { setCreateOpen(false); load(); showToast('Fixture created.'); }}
        showToast={showToast}
      />

      <CreateLeagueModal
        open={leagueOpen}
        onClose={() => setLeagueOpen(false)}
        onCreated={() => { setLeagueOpen(false); load(); showToast('League created.'); }}
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

/* ----------- drawer ----------- */

function FixtureDrawer({ open, fixtureId, onClose, hasRole, showToast, onChange }) {
  const [fx, setFx] = useState(null);
  const [resultModal, setResultModal] = useState(false);

  async function reload() {
    if (!fixtureId) return;
    try { const r = await adminFixture(fixtureId); setFx(r.fixture); } catch (e) { showToast(e.message, 'error'); }
  }
  useEffect(() => { if (open) reload(); /* eslint-disable-next-line */ }, [open, fixtureId]);

  if (!open) return null;

  async function setLive(isLive) {
    try { const r = await adminPatchFixture(fx.id, { isLive }); setFx(r.fixture); onChange?.(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function changeOdds(market, key, odds) {
    try { await adminPatchOdds(fx.id, { market, key, odds: Number(odds) }); await reload(); onChange?.(); showToast('Odds updated.'); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function resetOdds() {
    try { await adminResetOdds(fx.id); await reload(); onChange?.(); showToast('Odds reset.'); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function toggleSuspendAll() {
    try {
      if (fx.suspended) await adminClearSuspend(fx.id);
      else              await adminSuspend(fx.id, { all: true });
      await reload(); onChange?.();
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function suspendMarket(mk) {
    try { await adminSuspend(fx.id, { market: mk }); await reload(); onChange?.(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function suspendSelection(mk, key) {
    try { await adminSuspend(fx.id, { selection: `${mk}:${key}` }); await reload(); onChange?.(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function deleteFx() {
    if (!confirm('Delete this fixture? Only admin-created fixtures can be removed.')) return;
    try { await adminDeleteFixture(fx.id); showToast('Fixture deleted.'); onClose(); onChange?.(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function recordResult(h, a) {
    try {
      const r = await adminRecordResult(fx.id, { scoreHome: Number(h), scoreAway: Number(a), autoSettle: true });
      setResultModal(false);
      showToast(`Result recorded. Settled ${r.settled?.settledWins || 0}w / ${r.settled?.settledLoss || 0}l.`);
      await reload(); onChange?.();
    } catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fx ? `${fx.home} — ${fx.away}` : 'Loading…'}
      width={720}
      footer={fx && hasRole('odds_manager') ? (
        <>
          {fx.adminCreated && <button className="adm-btn ghost" onClick={deleteFx}>Delete</button>}
          <button className="adm-btn warn" onClick={toggleSuspendAll}><IconBan size={14} /> {fx.suspended ? 'Unsuspend' : 'Suspend all'}</button>
          <button className="adm-btn primary" onClick={() => setResultModal(true)}><IconSettle size={14} /> Record result & settle</button>
        </>
      ) : null}
    >
      {!fx ? <div className="adm-skel" style={{ height: 200 }} /> : (
        <>
          <Card>
            <dl className="adm-kv">
              <dt>Fixture id</dt><dd style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{fx.id}</dd>
              <dt>Sport · League</dt><dd>{fx.sport} · {fx.leagueName || fx.leagueId}</dd>
              <dt>Kick-off</dt><dd>{fx.day} {fx.kickoff}</dd>
              <dt>Status</dt><dd>
                {fx.finished ? <Badge tone="success">Finished {fx.scoreHome}-{fx.scoreAway}</Badge>
                  : fx.isLive ? <Badge tone="danger" dot>Live {fx.minute || ''}</Badge>
                  : <Badge tone="info">Upcoming</Badge>}
              </dd>
              {fx.suspended && <><dt>Suspended</dt><dd><Badge tone="warn">All markets suspended</Badge></dd></>}
            </dl>
            {hasRole('odds_manager') && !fx.finished && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="adm-btn sm" onClick={() => setLive(!fx.isLive)}>
                  <IconLive size={12} /> {fx.isLive ? 'Mark not live' : 'Mark live'}
                </button>
                <button className="adm-btn sm" onClick={resetOdds}><IconRefresh size={12} /> Reset odds</button>
              </div>
            )}
          </Card>

          {Object.entries(fx.markets || {}).map(([mk, market]) => (
            <Card key={mk} title={market.name || mk}
                  action={hasRole('odds_manager') && !fx.finished && (
                    <button className="adm-btn sm warn" onClick={() => suspendMarket(mk)}><IconBan size={12} /> Suspend</button>
                  )}
                  pill={market.suspended ? <Badge tone="warn">Suspended</Badge> : null}>
              <table className="adm-table">
                <thead><tr><th>Selection</th><th className="num">Odds</th><th></th></tr></thead>
                <tbody>
                  {(market.selections || []).map((sel) => (
                    <SelectionRow key={sel.key} mk={mk} sel={sel} disabled={!hasRole('odds_manager') || fx.finished}
                                  onChange={(odds) => changeOdds(mk, sel.key, odds)}
                                  onSuspend={() => suspendSelection(mk, sel.key)} />
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </>
      )}

      <ResultModal open={resultModal} onClose={() => setResultModal(false)} fx={fx} onSubmit={recordResult} />
    </Drawer>
  );
}

function SelectionRow({ mk, sel, disabled, onChange, onSuspend }) {
  const [val, setVal] = useState(String(sel.odds));
  useEffect(() => { setVal(String(sel.odds)); }, [sel.odds]);
  return (
    <tr>
      <td>
        <strong>{sel.label || sel.key}</strong>
        {sel.suspended && <> <Badge tone="warn">Locked</Badge></>}
      </td>
      <td className="num">
        <input
          className="adm-input"
          style={{ height: 32, width: 90, textAlign: 'right' }}
          type="number" step="0.01" min="1.01" max="999"
          value={val} onChange={(e) => setVal(e.target.value)}
          onBlur={() => Number(val) !== sel.odds && Number(val) > 1 && onChange(val)}
          disabled={disabled}
        />
      </td>
      <td>
        <button className="adm-btn sm warn" onClick={onSuspend} disabled={disabled || sel.suspended}>
          <IconBan size={12} /> {sel.suspended ? 'Locked' : 'Lock'}
        </button>
      </td>
    </tr>
  );
}

function ResultModal({ open, onClose, fx, onSubmit }) {
  const [h, setH] = useState('0');
  const [a, setA] = useState('0');
  useEffect(() => { if (open) { setH(String(fx?.scoreHome ?? 0)); setA(String(fx?.scoreAway ?? 0)); } }, [open, fx]);
  if (!fx) return null;
  return (
    <Modal open={open} onClose={onClose}
           title="Record final result"
           description={`This will lock the fixture and run settlement on every open bet that touches it.`}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-around', marginTop: 8 }}>
        <Side label={fx.home} value={h} onChange={setH} />
        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-dim)' }}>—</div>
        <Side label={fx.away} value={a} onChange={setA} />
      </div>
      <div className="adm-modal-actions">
        <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
        <button className="adm-btn primary" onClick={() => onSubmit(h, a)}>Record & settle</button>
      </div>
    </Modal>
  );
}
function Side({ label, value, onChange }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <input className="adm-input" style={{ width: 80, textAlign: 'center', height: 44, fontSize: 22, fontWeight: 700 }}
             type="number" min="0" max="199" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ----------- create modals ----------- */

function CreateFixtureModal({ open, onClose, leagues, onCreated, showToast }) {
  const [form, setForm] = useState({ sport: 'football', leagueId: '', home: '', away: '', kickoff: '', day: 'Today', isLive: false, homeOdds: '2.10', drawOdds: '3.40', awayOdds: '3.10' });
  const eligible = leagues.filter((l) => l.sport === form.sport);
  useEffect(() => { if (open) setForm((f) => ({ ...f, leagueId: '' })); }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (!form.leagueId) return showToast('Pick a league.', 'error');
    if (!form.home || !form.away) return showToast('Both teams required.', 'error');
    try {
      await adminCreateFixture({
        sport: form.sport,
        leagueId: form.leagueId,
        home: form.home, away: form.away,
        kickoff: form.kickoff || undefined,
        day: form.day || undefined,
        isLive: !!form.isLive,
        odds: {
          home: Number(form.homeOdds),
          draw: form.sport === 'football' ? Number(form.drawOdds) : undefined,
          away: Number(form.awayOdds),
        },
      });
      onCreated();
    } catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <Modal open={open} onClose={onClose} title="New fixture" description="Create a custom fixture (e.g. friendlies, special events).">
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="adm-field"><label>Sport</label>
          <select className="adm-select" value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value, leagueId: '' }))}>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
          </select>
        </div>
        <div className="adm-field"><label>League</label>
          <select className="adm-select" value={form.leagueId} onChange={(e) => setForm((f) => ({ ...f, leagueId: e.target.value }))}>
            <option value="">— select —</option>
            {eligible.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="adm-field"><label>Home team</label><input className="adm-input" value={form.home} onChange={(e) => setForm((f) => ({ ...f, home: e.target.value }))} required /></div>
        <div className="adm-field"><label>Away team</label><input className="adm-input" value={form.away} onChange={(e) => setForm((f) => ({ ...f, away: e.target.value }))} required /></div>
        <div className="adm-field"><label>Day</label>
          <select className="adm-select" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}>
            <option>Today</option><option>Tomorrow</option><option>In 2 days</option><option>In 3 days</option>
          </select>
        </div>
        <div className="adm-field"><label>Kick-off (HH:MM)</label><input className="adm-input" placeholder="20:00" value={form.kickoff} onChange={(e) => setForm((f) => ({ ...f, kickoff: e.target.value }))} /></div>
        <div className="adm-field"><label>Home odds</label><input className="adm-input" type="number" step="0.01" min="1.01" value={form.homeOdds} onChange={(e) => setForm((f) => ({ ...f, homeOdds: e.target.value }))} /></div>
        {form.sport === 'football' && (
          <div className="adm-field"><label>Draw odds</label><input className="adm-input" type="number" step="0.01" min="1.01" value={form.drawOdds} onChange={(e) => setForm((f) => ({ ...f, drawOdds: e.target.value }))} /></div>
        )}
        <div className="adm-field"><label>Away odds</label><input className="adm-input" type="number" step="0.01" min="1.01" value={form.awayOdds} onChange={(e) => setForm((f) => ({ ...f, awayOdds: e.target.value }))} /></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
          <label><input type="checkbox" checked={form.isLive} onChange={(e) => setForm((f) => ({ ...f, isLive: e.target.checked }))} /> Mark as live now</label>
        </div>
        <div className="adm-modal-actions" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn primary">Create fixture</button>
        </div>
      </form>
    </Modal>
  );
}

function CreateLeagueModal({ open, onClose, onCreated, showToast }) {
  const [form, setForm] = useState({ name: '', sport: 'football', region: '', countryMeta: '' });
  useEffect(() => { if (open) setForm({ name: '', sport: 'football', region: '', countryMeta: '' }); }, [open]);
  async function submit(e) {
    e.preventDefault();
    try { await adminCreateLeague(form); onCreated(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New league" description="Add a custom competition.">
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label>Name</label><input className="adm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
        <div className="adm-field"><label>Sport</label>
          <select className="adm-select" value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
          </select>
        </div>
        <div className="adm-field"><label>Region</label><input className="adm-input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="europe / africa / americas" /></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label>Meta line</label><input className="adm-input" value={form.countryMeta} onChange={(e) => setForm((f) => ({ ...f, countryMeta: e.target.value }))} placeholder="GHA · MATCHWEEK 18" /></div>
        <div className="adm-modal-actions" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn primary">Create league</button>
        </div>
      </form>
    </Modal>
  );
}
