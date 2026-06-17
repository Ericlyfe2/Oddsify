import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  adminFixtures,
  adminFixture,
  adminCreateFixture,
  adminPatchFixture,
  adminDeleteFixture,
  adminPatchOdds,
  adminResetOdds,
  adminSuspend,
  adminClearSuspend,
  adminRecordResult,
  adminTriggerSettle,
  adminLeagues,
  adminCreateLeague,
  adminAddMarket,
  adminRemoveMarket,
  adminBulkFixtures,
} from '../../api/adminApi.js';
import { useAdmin } from '../../providers/AdminProvider.jsx';
import {
  Card,
  Badge,
  Drawer,
  Modal,
  Empty,
  SkeletonRow,
  Spinner,
  moneyFmt,
  numFmt,
  ago,
} from '../../components/admin/primitives.jsx';
import {
  IconSearch,
  IconRefresh,
  IconLive,
  IconBan,
  IconCheck,
  IconSettle,
  IconBook,
  IconAlert,
  IconClose,
} from '../../components/admin/Icons.jsx';

const SPORTS = ['football', 'basketball', 'tennis'];
const MARKET_PRESETS = {
  '1X2': { name: 'Match Result', selections: [
    { key: '1', label: 'Home', odds: '2.10' },
    { key: 'X', label: 'Draw', odds: '3.40' },
    { key: '2', label: 'Away', odds: '3.10' },
  ]},
  DC: { name: 'Double Chance', selections: [
    { key: '1X', label: 'Home or Draw', odds: '1.25' },
    { key: 'X2', label: 'Draw or Away', odds: '1.35' },
    { key: '12', label: 'Home or Away', odds: '1.20' },
  ]},
  DNB: { name: 'Draw No Bet', selections: [
    { key: '1', label: 'Home', odds: '1.80' },
    { key: '2', label: 'Away', odds: '1.80' },
  ]},
  BTTS: { name: 'Both Teams To Score', selections: [
    { key: 'Yes', label: 'Yes', odds: '1.78' },
    { key: 'No', label: 'No', odds: '1.98' },
  ]},
  OU05: { name: 'Over/Under 0.5', selections: [
    { key: 'Over', label: 'Over 0.5', odds: '1.15' },
    { key: 'Under', label: 'Under 0.5', odds: '5.50' },
  ]},
  OU15: { name: 'Over/Under 1.5', selections: [
    { key: 'Over', label: 'Over 1.5', odds: '1.55' },
    { key: 'Under', label: 'Under 1.5', odds: '2.40' },
  ]},
  OU25: { name: 'Over/Under 2.5', selections: [
    { key: 'Over', label: 'Over 2.5', odds: '1.95' },
    { key: 'Under', label: 'Under 2.5', odds: '1.85' },
  ]},
  OU35: { name: 'Over/Under 3.5', selections: [
    { key: 'Over', label: 'Over 3.5', odds: '2.50' },
    { key: 'Under', label: 'Under 3.5', odds: '1.50' },
  ]},
  OU45: { name: 'Over/Under 4.5', selections: [
    { key: 'Over', label: 'Over 4.5', odds: '4.00' },
    { key: 'Under', label: 'Under 4.5', odds: '1.22' },
  ]},
  AH: { name: 'Asian Handicap', selections: [
    { key: 'Home', label: 'Home', odds: '1.85' },
    { key: 'Away', label: 'Away', odds: '1.85' },
  ]},
  EH: { name: 'European Handicap', selections: [
    { key: '1', label: 'Home', odds: '2.50' },
    { key: 'X', label: 'Draw', odds: '3.40' },
    { key: '2', label: 'Away', odds: '2.50' },
  ]},
  '1H1X2': { name: 'Half Time Result', selections: [
    { key: '1', label: 'Home', odds: '2.50' },
    { key: 'X', label: 'Draw', odds: '2.00' },
    { key: '2', label: 'Away', odds: '3.00' },
  ]},
  HTFT: { name: 'Half Time / Full Time', selections: [
    { key: '1/1', label: 'Home/Home', odds: '3.50' },
    { key: '1/X', label: 'Home/Draw', odds: '15.00' },
    { key: '1/2', label: 'Home/Away', odds: '30.00' },
    { key: 'X/1', label: 'Draw/Home', odds: '4.50' },
    { key: 'X/X', label: 'Draw/Draw', odds: '6.00' },
    { key: 'X/2', label: 'Draw/Away', odds: '8.00' },
    { key: '2/1', label: 'Away/Home', odds: '25.00' },
    { key: '2/X', label: 'Away/Draw', odds: '12.00' },
    { key: '2/2', label: 'Away/Away', odds: '4.50' },
  ]},
  CS: { name: 'Correct Score', selections: [
    { key: '0-0', label: '0-0', odds: '6.00' },
    { key: '1-0', label: '1-0', odds: '7.00' },
    { key: '2-0', label: '2-0', odds: '9.00' },
    { key: '3-0', label: '3-0', odds: '14.00' },
    { key: '4-0', label: '4-0', odds: '25.00' },
    { key: '5-0', label: '5-0', odds: '40.00' },
    { key: '6-0', label: '6-0', odds: '60.00' },
    { key: '0-1', label: '0-1', odds: '7.50' },
    { key: '0-2', label: '0-2', odds: '10.00' },
    { key: '0-3', label: '0-3', odds: '18.00' },
    { key: '0-4', label: '0-4', odds: '30.00' },
    { key: '0-5', label: '0-5', odds: '50.00' },
    { key: '0-6', label: '0-6', odds: '70.00' },
    { key: '1-1', label: '1-1', odds: '6.50' },
    { key: '2-2', label: '2-2', odds: '12.00' },
    { key: '3-3', label: '3-3', odds: '30.00' },
    { key: '4-4', label: '4-4', odds: '60.00' },
    { key: '5-5', label: '5-5', odds: '100.00' },
    { key: 'OTHER_HOME', label: 'Any Other Home Win', odds: '10.00' },
    { key: 'OTHER_AWAY', label: 'Any Other Away Win', odds: '10.00' },
    { key: 'OTHER_DRAW', label: 'Any Other Draw', odds: '15.00' },
  ]},
  CORNERS: { name: 'Corners', selections: [
    { key: 'Over', label: 'Over 9.5', odds: '1.90' },
    { key: 'Under', label: 'Under 9.5', odds: '1.90' },
  ]},
  CARDS: { name: 'Cards', selections: [
    { key: 'Over', label: 'Over 4.5', odds: '1.90' },
    { key: 'Under', label: 'Under 4.5', odds: '1.90' },
  ]},
  TG: { name: 'Team Goals', selections: [
    { key: 'HomeOver', label: 'Home Over 1.5', odds: '2.20' },
    { key: 'HomeUnder', label: 'Home Under 1.5', odds: '1.65' },
    { key: 'AwayOver', label: 'Away Over 1.5', odds: '2.50' },
    { key: 'AwayUnder', label: 'Away Under 1.5', odds: '1.50' },
  ]},
};

export default function SportsAdmin() {
  const { hasRole, showToast, socket, socketReady } = useAdmin();
  const [filters, setFilters] = useState({ q: '', sport: '', leagueId: '', status: '' });
  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [selectedFixtures, setSelectedFixtures] = useState(new Set());
  const [bulkScoreOpen, setBulkScoreOpen] = useState(false);
  const [bulkScoreHome, setBulkScoreHome] = useState('');
  const [bulkScoreAway, setBulkScoreAway] = useState('');

  const toggleFixture = useCallback((id) => {
    setSelectedFixtures((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const doBulkFixtures = useCallback(async (action, payload) => {
    try {
      const res = await adminBulkFixtures({ action, fixtureIds: [...selectedFixtures], payload });
      showToast(
        `Bulk ${action}: ${res.results.filter((r) => r.status !== 'error').length} ok, ${res.results.filter((r) => r.status === 'error').length} failed.`,
      );
      setSelectedFixtures(new Set());
      setBulkScoreOpen(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [selectedFixtures, showToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fx, lg] = await Promise.all([adminFixtures(filters), adminLeagues()]);
      setData(fx);
      setLeagues(lg.leagues || []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    load();
  }, [filters.q, filters.sport, filters.leagueId, filters.status]);

  useEffect(() => {
    if (!socket || !socketReady) return;
    const events = [
      'sports:fixture:created',
      'sports:fixture:updated',
      'sports:fixture:deleted',
      'sports:odds:updated',
      'sports:odds:reset',
      'sports:suspend',
      'sports:suspend:cleared',
      'sports:result',
      'sports:settled',
      'sports:market:added',
      'sports:market:removed',
      'sports:bulk',
    ];
    const handler = () => { load(); };
    events.forEach((ev) => socket.on(ev, handler));
    return () => { events.forEach((ev) => socket.off(ev, handler)); };
  }, [socket, socketReady, load]);

  const filteredLeagues = useMemo(
    () => leagues.filter((l) => !filters.sport || l.sport === filters.sport),
    [leagues, filters.sport],
  );

  const settleEverything = useCallback(async () => {
    try {
      await adminTriggerSettle('all');
      showToast('Settlement sweep triggered.');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [showToast, load]);

  return (
    <>
      <header className="adm-page-head">
        <div>
          <h1>Sports & odds</h1>
          <p>Fixtures, markets, real-time odds intervention, and manual results. All actions audited.</p>
        </div>
        <div className="adm-page-actions">
          {selectedFixtures.size > 0 && (
            <div className="adm-bulk-bar" role="group" aria-label={`${selectedFixtures.size} fixtures selected`}>
              <span className="adm-bulk-count">{selectedFixtures.size} selected</span>
              {hasRole('odds_manager') && (
                <>
                  <button className="adm-btn adm-btn-sm" onClick={() => doBulkFixtures('suspend')} aria-label="Suspend selected">Suspend</button>
                  <button className="adm-btn adm-btn-sm" onClick={() => doBulkFixtures('unsuspend')} aria-label="Unsuspend selected">Unsuspend</button>
                  <button className="adm-btn adm-btn-sm" onClick={() => doBulkFixtures('mark-live')} aria-label="Mark selected as live">Mark live</button>
                  <button className="adm-btn adm-btn-sm" onClick={() => doBulkFixtures('mark-upcoming')} aria-label="Mark selected as upcoming">Mark upcoming</button>
                  <button className="adm-btn adm-btn-sm" onClick={() => setBulkScoreOpen(true)} aria-label="Set result for selected">Set result</button>
                </>
              )}
              <button className="adm-btn adm-btn-sm" onClick={() => setSelectedFixtures(new Set())} aria-label="Clear selection">Clear</button>
            </div>
          )}
          <button className="adm-btn" onClick={load} aria-label="Refresh fixtures">
            <IconRefresh size={14} /> Refresh
          </button>
          {hasRole('odds_manager') && (
            <button className="adm-btn" onClick={() => setLeagueOpen(true)} aria-label="Create new league">
              <IconBook size={14} /> New league
            </button>
          )}
          {hasRole('odds_manager') && (
            <button className="adm-btn primary" onClick={() => setCreateOpen(true)} aria-label="Create new fixture">
              <IconCheck size={14} /> New fixture
            </button>
          )}
          {hasRole('odds_manager') && (
            <button className="adm-btn warn" onClick={settleEverything} aria-label="Settle all open bets">
              <IconSettle size={14} /> Settle now
            </button>
          )}
        </div>
      </header>

      <div className="adm-stat-grid" role="region" aria-label="Fixture statistics">
        <StatTile label="Total fixtures" value={numFmt(data?.total)} />
        <StatTile label="Live now" value={numFmt(data?.fixtures?.filter((f) => f.isLive).length)} />
        <StatTile label="Finished" value={numFmt(data?.fixtures?.filter((f) => f.finished).length)} />
        <StatTile label="Suspended" value={numFmt(data?.fixtures?.filter((f) => f.suspended).length)} />
      </div>

      <div className="adm-table-wrap" role="region" aria-label="Fixtures table">
        <div className="adm-table-toolbar">
          <div className="adm-search-field" role="search">
            <IconSearch size={14} />
            <input
              placeholder="Search fixtures…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              aria-label="Search fixtures"
            />
          </div>
          <select
            value={filters.sport}
            onChange={(e) => setFilters((f) => ({ ...f, sport: e.target.value, leagueId: '' }))}
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
          </select>
          <select value={filters.leagueId} onChange={(e) => setFilters((f) => ({ ...f, leagueId: e.target.value }))} aria-label="Filter by league">
            <option value="">All leagues</option>
            {filteredLeagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="finished">Finished</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="grow" />
          <div className="adm-fixture-count">{data?.total ?? '—'} fixtures</div>
        </div>

        <div className="adm-table-scroll" tabIndex={0} role="group" aria-label="Fixtures list">
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: 32 }} aria-label="Select">
                  <span className="sr-only">Select</span>
                </th>
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
              {!loading && (!data?.fixtures || data.fixtures.length === 0) && (
                <tr>
                  <td colSpan={9}>
                    <Empty title="No fixtures match" subtitle="Adjust filters or create a new fixture." />
                  </td>
                </tr>
              )}
              {!loading && data?.fixtures?.map((m) => {
                const main = m.markets?.['1X2'] || m.markets?.['ML'];
                const home = main?.selections?.find((s) => s.key === '1');
                const draw = main?.selections?.find((s) => s.key === 'X');
                const away = main?.selections?.find((s) => s.key === '2');
                const status = m.finished ? 'finished' : m.isLive ? 'live' : m.suspended ? 'suspended' : 'upcoming';
                return (
                  <tr key={m.id} onClick={() => setSelected(m)} className={selected?.id === m.id ? 'selected' : ''} role="row" aria-selected={selected?.id === m.id}>
                    <td style={{ width: 32 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedFixtures.has(m.id)}
                        onChange={() => toggleFixture(m.id)}
                        aria-label={`Select ${m.home} vs ${m.away}`}
                      />
                    </td>
                    <td>
                      <div className="adm-fixture-name">{m.home} — {m.away}</div>
                      <div className="adm-fixture-meta">{m.sport} · {m.id}</div>
                    </td>
                    <td>{m.leagueName || m.leagueId}</td>
                    <td>
                      {status === 'live' && <Badge tone="danger" dot>Live {m.minute || ''}</Badge>}
                      {status === 'upcoming' && <Badge tone="info">Upcoming</Badge>}
                      {status === 'finished' && <Badge tone="success">Finished {m.scoreHome}-{m.scoreAway}</Badge>}
                      {status === 'suspended' && <Badge tone="warn">Suspended</Badge>}
                    </td>
                    <td className="adm-fixture-time">{m.day} {m.kickoff || ''}</td>
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

      <BulkScoreModal
        open={bulkScoreOpen}
        count={selectedFixtures.size}
        onClose={() => setBulkScoreOpen(false)}
        home={bulkScoreHome}
        away={bulkScoreAway}
        onHomeChange={setBulkScoreHome}
        onAwayChange={setBulkScoreAway}
        onSubmit={() => doBulkFixtures('set-result', {
          scoreHome: Number(bulkScoreHome) || 0,
          scoreAway: Number(bulkScoreAway) || 0,
        })}
      />

      <CreateFixtureModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        leagues={leagues}
        onCreated={() => {
          setCreateOpen(false);
          load();
          showToast('Fixture created.');
        }}
        showToast={showToast}
      />

      <CreateLeagueModal
        open={leagueOpen}
        onClose={() => setLeagueOpen(false)}
        onCreated={() => {
          setLeagueOpen(false);
          load();
          showToast('League created.');
        }}
        showToast={showToast}
      />
    </>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="adm-stat" style={{ '--accentGrad': 'linear-gradient(135deg,#7c5cff,#22d3ee)' }}>
      <div className="lbl">{label}</div>
      <div className="val">{value ?? '—'}</div>
    </div>
  );
}

function BulkScoreModal({ open, count, onClose, home, away, onHomeChange, onAwayChange, onSubmit }) {
  if (!open) return null;
  return (
    <Modal
      open
      title={`Set result for ${count} fixtures`}
      onClose={onClose}
      footer={
        <div className="adm-modal-footer-inner">
          <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn primary" onClick={onSubmit}>Apply</button>
        </div>
      }
    >
      <div className="adm-field">
        <label htmlFor="bulk-home">Home score</label>
        <input id="bulk-home" className="adm-input" type="number" min="0" value={home} onChange={(e) => onHomeChange(e.target.value)} />
      </div>
      <div className="adm-field">
        <label htmlFor="bulk-away">Away score</label>
        <input id="bulk-away" className="adm-input" type="number" min="0" value={away} onChange={(e) => onAwayChange(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ================================================================
   FIXTURE DRAWER
   ================================================================ */

function FixtureDrawer({ open, fixtureId, onClose, hasRole, showToast, onChange }) {
  const [fx, setFx] = useState(null);
  const [resultModal, setResultModal] = useState(false);
  const [addMarketOpen, setAddMarketOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!fixtureId) return;
    try {
      const r = await adminFixture(fixtureId);
      setFx(r.fixture);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [fixtureId, showToast]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  if (!open) return null;

  const setLive = async (isLive) => {
    try {
      const r = await adminPatchFixture(fx.id, { isLive });
      setFx(r.fixture);
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const changeOdds = async (market, key, odds) => {
    try {
      await adminPatchOdds(fx.id, { market, key, odds: Number(odds) });
      await reload();
      onChange?.();
      showToast('Odds updated.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const resetOdds = async () => {
    try {
      await adminResetOdds(fx.id);
      await reload();
      onChange?.();
      showToast('Odds reset.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const toggleSuspendAll = async () => {
    try {
      if (fx.suspended) await adminClearSuspend(fx.id);
      else await adminSuspend(fx.id, { all: true });
      await reload();
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const suspendMarket = async (mk) => {
    try {
      await adminSuspend(fx.id, { market: mk });
      await reload();
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const suspendSelection = async (mk, key) => {
    try {
      await adminSuspend(fx.id, { selection: `${mk}:${key}` });
      await reload();
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const deleteFx = async () => {
    if (!confirm('Delete this fixture? Only admin-created fixtures can be removed.')) return;
    try {
      await adminDeleteFixture(fx.id);
      showToast('Fixture deleted.');
      onClose();
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const recordResult = async (h, a) => {
    try {
      const r = await adminRecordResult(fx.id, { scoreHome: Number(h), scoreAway: Number(a), autoSettle: true });
      setResultModal(false);
      showToast(`Result recorded. Settled ${r.settled?.settledWins || 0}w / ${r.settled?.settledLoss || 0}l.`);
      await reload();
      onChange?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const removeMarket = async (mk) => {
    if (!confirm(`Remove market "${mk}"?`)) return;
    try {
      await adminRemoveMarket(fx.id, mk);
      await reload();
      onChange?.();
      showToast(`Market "${mk}" removed.`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fx ? `${fx.home} — ${fx.away}` : 'Loading…'}
      width={720}
      footer={
        fx && hasRole('odds_manager') ? (
          <div className="adm-drawer-footer-actions">
            {fx.adminCreated && (
              <button className="adm-btn ghost danger" onClick={deleteFx} aria-label="Delete fixture">Delete</button>
            )}
            <button className="adm-btn warn" onClick={toggleSuspendAll} aria-label={fx.suspended ? 'Unsuspend all' : 'Suspend all'}>
              <IconBan size={14} /> {fx.suspended ? 'Unsuspend' : 'Suspend all'}
            </button>
            <button className="adm-btn primary" onClick={() => setResultModal(true)} aria-label="Record result and settle">
              <IconSettle size={14} /> Record result & settle
            </button>
          </div>
        ) : null
      }
    >
      {!fx ? (
        <div className="adm-skel" style={{ height: 200 }} role="status" aria-label="Loading fixture details" />
      ) : (
        <>
          <Card>
            <dl className="adm-kv">
              <dt>Fixture id</dt>
              <dd style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{fx.id}</dd>
              <dt>Sport · League</dt>
              <dd>{fx.sport} · {fx.leagueName || fx.leagueId}</dd>
              <dt>Kick-off</dt>
              <dd>{fx.day} {fx.kickoff}</dd>
              <dt>Status</dt>
              <dd>
                {fx.finished ? (
                  <Badge tone="success">Finished {fx.scoreHome}-{fx.scoreAway}</Badge>
                ) : fx.isLive ? (
                  <Badge tone="danger" dot>Live {fx.minute || ''}</Badge>
                ) : (
                  <Badge tone="info">Upcoming</Badge>
                )}
              </dd>
              {fx.suspended && (
                <>
                  <dt>Suspended</dt>
                  <dd><Badge tone="warn">All markets suspended</Badge></dd>
                </>
              )}
            </dl>
            {hasRole('odds_manager') && !fx.finished && (
              <div className="adm-drawer-actions-row">
                <button className="adm-btn sm" onClick={() => setLive(!fx.isLive)} aria-label={fx.isLive ? 'Mark not live' : 'Mark live'}>
                  <IconLive size={12} /> {fx.isLive ? 'Mark not live' : 'Mark live'}
                </button>
                <button className="adm-btn sm" onClick={resetOdds} aria-label="Reset odds to default">
                  <IconRefresh size={12} /> Reset odds
                </button>
              </div>
            )}
          </Card>

          {Object.entries(fx.markets || {}).map(([mk, market]) => (
            <Card
              key={mk}
              title={market.name || mk}
              action={
                hasRole('odds_manager') && !fx.finished ? (
                  <div className="adm-market-actions">
                    <button className="adm-btn sm warn" onClick={() => suspendMarket(mk)} aria-label={`Suspend ${market.name}`}>
                      <IconBan size={12} /> Suspend
                    </button>
                    <button className="adm-btn sm ghost" onClick={() => removeMarket(mk)} aria-label={`Remove ${market.name}`}>
                      <IconClose size={10} />
                    </button>
                  </div>
                ) : null
              }
              pill={market.suspended ? <Badge tone="warn">Suspended</Badge> : null}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Selection</th>
                    <th className="num">Odds</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(market.selections || []).map((sel) => (
                    <SelectionRow
                      key={sel.key}
                      mk={mk}
                      sel={sel}
                      disabled={!hasRole('odds_manager') || fx.finished}
                      onChange={(odds) => changeOdds(mk, sel.key, odds)}
                      onSuspend={() => suspendSelection(mk, sel.key)}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          ))}

          {hasRole('odds_manager') && !fx.finished && (
            <div className="adm-add-market-wrap">
              <button className="adm-btn" onClick={() => setAddMarketOpen(true)} aria-label="Add market">+ Add market</button>
            </div>
          )}
        </>
      )}

      <ResultModal open={resultModal} onClose={() => setResultModal(false)} fx={fx} onSubmit={recordResult} />
      <AddMarketModal
        open={addMarketOpen}
        onClose={() => setAddMarketOpen(false)}
        fx={fx}
        onSubmit={async (data) => {
          try {
            await adminAddMarket(fx.id, data);
            setAddMarketOpen(false);
            await reload();
            onChange?.();
            showToast(`Market "${data.marketKey}" added.`);
          } catch (e) {
            showToast(e.message, 'error');
          }
        }}
      />
    </Drawer>
  );
}

function SelectionRow({ mk, sel, disabled, onChange, onSuspend }) {
  const [val, setVal] = useState(String(sel.odds));
  const [error, setError] = useState('');

  useEffect(() => { setVal(String(sel.odds)); }, [sel.odds]);

  const handleBlur = () => {
    const num = Number(val);
    if (num < 1.01 || num > 1000 || isNaN(num)) {
      setError('Odds must be between 1.01 and 1000');
      return;
    }
    setError('');
    if (num !== sel.odds && num > 1) onChange(val);
  };

  return (
    <tr>
      <td>
        <strong>{sel.label || sel.key}</strong>
        {sel.suspended && <> <Badge tone="warn">Locked</Badge></>}
      </td>
      <td className="num">
        <div className="adm-odds-cell">
          <input
            className={`adm-input ${error ? 'err' : ''}`}
            type="number"
            step="0.01"
            min="1.01"
            max="1000"
            value={val}
            onChange={(e) => { setVal(e.target.value); setError(''); }}
            onBlur={handleBlur}
            disabled={disabled}
            aria-label={`Odds for ${sel.label || sel.key}`}
            aria-invalid={!!error}
          />
          {error && <span className="adm-field-error">{error}</span>}
        </div>
      </td>
      <td>
        <button className="adm-btn sm warn" onClick={onSuspend} disabled={disabled || sel.suspended} aria-label={sel.suspended ? 'Already locked' : `Lock ${sel.label || sel.key}`}>
          <IconBan size={12} /> {sel.suspended ? 'Locked' : 'Lock'}
        </button>
      </td>
    </tr>
  );
}

function ResultModal({ open, onClose, fx, onSubmit }) {
  const [h, setH] = useState('0');
  const [a, setA] = useState('0');
  useEffect(() => {
    if (open) {
      setH(String(fx?.scoreHome ?? 0));
      setA(String(fx?.scoreAway ?? 0));
    }
  }, [open, fx]);
  if (!fx) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record final result"
      description="This will lock the fixture and run settlement on every open bet that touches it."
    >
      <div className="adm-result-inputs" role="group" aria-label="Final score">
        <ScoreSide label={fx.home} value={h} onChange={setH} />
        <div className="adm-result-divider">—</div>
        <ScoreSide label={fx.away} value={a} onChange={setA} />
      </div>
      <div className="adm-modal-actions">
        <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
        <button className="adm-btn primary" onClick={() => onSubmit(h, a)}>Record & settle</button>
      </div>
    </Modal>
  );
}

function ScoreSide({ label, value, onChange }) {
  return (
    <div className="adm-score-side">
      <div className="adm-score-label">{label}</div>
      <input
        className="adm-input"
        type="number"
        min="0"
        max="199"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} score`}
      />
    </div>
  );
}

/* ================================================================
   ADD MARKET MODAL
   ================================================================ */

function AddMarketModal({ open, onClose, fx, onSubmit }) {
  const [marketKey, setMarketKey] = useState('');
  const [name, setName] = useState('');
  const [selections, setSelections] = useState([
    { key: '', label: '', odds: '2.00' },
    { key: '', label: '', odds: '2.00' },
  ]);

  useEffect(() => {
    if (open) {
      setMarketKey('');
      setName('');
      setSelections([
        { key: '', label: '', odds: '2.00' },
        { key: '', label: '', odds: '2.00' },
      ]);
    }
  }, [open]);

  const addSel = () => setSelections((s) => [...s, { key: '', label: '', odds: '2.00' }]);
  const rmSel = (i) => setSelections((s) => s.filter((_, idx) => idx !== i));
  const updSel = (i, field, val) =>
    setSelections((s) => s.map((sel, idx) => (idx === i ? { ...sel, [field]: val } : sel)));

  const marketOpts = Object.entries(MARKET_PRESETS).map(([key, val]) => ({
    key, name: val.name
  }));

  const pickPreset = (mk) => {
    setMarketKey(mk);
    const p = MARKET_PRESETS[mk];
    if (p) {
      setName(p.name);
      setSelections(p.selections);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!marketKey || !name) return;
    const parsed = selections.map((s) => ({ key: s.key, label: s.label || s.key, odds: Number(s.odds) }));
    if (parsed.some((s) => !s.key || !Number.isFinite(s.odds) || s.odds < 1.01)) return;
    onSubmit({ marketKey, name, selections: parsed });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add market"
      description={`Add a new market to ${fx ? `${fx.home} — ${fx.away}` : 'this fixture'}.`}
    >
      <form onSubmit={submit} className="adm-add-market-form">
        <div className="adm-field">
          <label htmlFor="market-preset">Market preset</label>
          <select id="market-preset" className="adm-select" value="" onChange={(e) => e.target.value && pickPreset(e.target.value)}>
            <option value="">— pick a preset —</option>
            {marketOpts.map((o) => (
              <option key={o.key} value={o.key}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="adm-market-key-grid">
          <div className="adm-field">
            <label htmlFor="market-key">Market key</label>
            <input id="market-key" className="adm-input" value={marketKey} onChange={(e) => setMarketKey(e.target.value)} required placeholder="e.g. OU25" />
          </div>
          <div className="adm-field">
            <label htmlFor="market-name">Display name</label>
            <input id="market-name" className="adm-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Over/Under 2.5" />
          </div>
        </div>
        <div className="adm-section-label">Selections</div>
        {selections.map((sel, i) => (
          <div key={i} className="adm-selection-row">
            <input className="adm-input" placeholder="Key" value={sel.key} onChange={(e) => updSel(i, 'key', e.target.value)} required aria-label={`Selection ${i + 1} key`} />
            <input className="adm-input" placeholder="Label" value={sel.label} onChange={(e) => updSel(i, 'label', e.target.value)} aria-label={`Selection ${i + 1} label`} />
            <input className="adm-input" type="number" step="0.01" min="1.01" placeholder="Odds" value={sel.odds} onChange={(e) => updSel(i, 'odds', e.target.value)} required aria-label={`Selection ${i + 1} odds`} />
            <button type="button" className="adm-btn sm ghost" onClick={() => rmSel(i)} disabled={selections.length <= 2} aria-label={`Remove selection ${i + 1}`}>
              <IconClose size={12} />
            </button>
          </div>
        ))}
        <button type="button" className="adm-btn sm" onClick={addSel}>+ Add selection</button>
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn primary">Add market</button>
        </div>
      </form>
    </Modal>
  );
}

/* ================================================================
   CREATE FIXTURE MODAL — COMPLETELY REBUILT
   ================================================================ */

const INITIAL_FORM = {
  sport: 'football',
  leagueId: '',
  home: '',
  away: '',
  matchDate: '',
  kickoff: '',
  venue: '',
  visibility: 'public',
  status: 'upcoming',
  featured: false,
  homeOdds: '2.10',
  drawOdds: '3.40',
  awayOdds: '3.10',
  ouOver: '1.95',
  ouUnder: '1.85',
  bttsYes: '1.78',
  bttsNo: '1.98',
  dc1X: '1.25',
  dcX2: '1.35',
  dc12: '1.20',
  dnbHome: '1.80',
  dnbAway: '1.80',
  ahHome: '1.85',
  ahAway: '1.85',
  csEnabled: false,
  csScores: [],
  '1hHome': '2.50',
  '1hDraw': '2.00',
  '1hAway': '3.00',
};

function CreateFixtureModal({ open, onClose, leagues, onCreated, showToast }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const eligible = leagues.filter((l) => l.sport === form.sport);

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCSCore = (score) => {
    setForm((f) => ({
      ...f,
      csScores: f.csScores.includes(score)
        ? f.csScores.filter((s) => s !== score)
        : [...f.csScores, score],
    }));
  };

  const toggleCSAll = (enable) => {
    if (enable) {
      setForm((f) => ({
        ...f,
        csEnabled: true,
        csScores: [
          '0-0', '1-0', '2-0', '3-0', '4-0', '5-0', '6-0',
          '0-1', '0-2', '0-3', '0-4', '0-5', '0-6',
          '1-1', '2-2', '3-3', '4-4', '5-5',
          'OTHER_HOME', 'OTHER_AWAY', 'OTHER_DRAW',
        ],
      }));
    } else {
      setForm((f) => ({ ...f, csEnabled: false, csScores: [] }));
    }
  };

  const validate = () => {
    const errs = {};

    if (!form.leagueId) errs.leagueId = 'Please select a league.';
    if (!form.home.trim()) errs.home = 'Home team is required.';
    if (!form.away.trim()) errs.away = 'Away team is required.';

    if (form.home.trim().toLowerCase() === form.away.trim().toLowerCase() && form.home.trim()) {
      errs.away = 'Home and Away teams cannot be identical.';
    }

    if (/[<>{}|\\^~`]/.test(form.home)) errs.home = 'Contains invalid characters.';
    if (/[<>{}|\\^~`]/.test(form.away)) errs.away = 'Contains invalid characters.';

    const homeOdds = Number(form.homeOdds);
    const awayOdds = Number(form.awayOdds);
    const drawOdds = Number(form.drawOdds);

    if (isNaN(homeOdds) || homeOdds < 1.01 || homeOdds > 1000) errs.homeOdds = `Must be between 1.01 and 1000.`;
    if (isNaN(awayOdds) || awayOdds < 1.01 || awayOdds > 1000) errs.awayOdds = `Must be between 1.01 and 1000.`;
    if (form.sport === 'football' && (isNaN(drawOdds) || drawOdds < 1.01 || drawOdds > 1000)) {
      errs.drawOdds = `Must be between 1.01 and 1000.`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      formRef.current?.querySelector('[class*="err"]')?.focus();
      return;
    }

    setSaving(true);
    try {
      const extraMarkets = [];

      extraMarkets.push(
        { market: 'OU25', type: 'overunder', over: Number(form.ouOver), under: Number(form.ouUnder) },
        { market: 'BTTS', type: 'yesno', yes: Number(form.bttsYes), no: Number(form.bttsNo) },
        { market: 'DC', type: 'dc', '1X': Number(form.dc1X), X2: Number(form.dcX2), 12: Number(form.dc12) },
        { market: 'DNB', type: 'dnb', homeOdds: Number(form.dnbHome), awayOdds: Number(form.dnbAway) },
        { market: 'AH', type: 'ah', homeOdds: Number(form.ahHome), awayOdds: Number(form.ahAway) },
      );

      if (form.csEnabled && form.csScores.length >= 2) {
        extraMarkets.push({ market: 'CS', type: 'cs', scores: form.csScores });
      }

      await adminCreateFixture({
        sport: form.sport,
        leagueId: form.leagueId,
        home: form.home.trim(),
        away: form.away.trim(),
        matchDate: form.matchDate || undefined,
        kickoff: form.kickoff || undefined,
        venue: form.venue || undefined,
        isLive: form.status === 'live',
        status: form.status,
        visibility: form.visibility,
        featured: form.featured,
        odds: {
          home: Number(form.homeOdds),
          draw: form.sport === 'football' ? Number(form.drawOdds) : undefined,
          away: Number(form.awayOdds),
        },
        extraMarkets,
        correctScores: form.csEnabled ? form.csScores : undefined,
      });
      onCreated();
    } catch (e) {
      setErrors({ submit: e.body?.error || e.message });
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="adm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create new fixture">
      <div className="adm-fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="adm-fx-modal-header">
          <div>
            <h2>New Fixture</h2>
            <p className="adm-fx-modal-subtitle">Create a new sporting event</p>
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <form ref={formRef} onSubmit={submit} className="adm-fx-modal-body" noValidate>
          {errors.submit && (
            <div className="adm-fx-error-banner" role="alert">
              <IconAlert size={14} /> {errors.submit}
            </div>
          )}

          <section className="adm-fx-section">
            <h3 className="adm-fx-section-title">Fixture Information</h3>
            <div className="adm-fx-grid">
              <div className="adm-field">
                <label htmlFor="fx-sport">Sport</label>
                <select
                  id="fx-sport"
                  className="adm-select"
                  value={form.sport}
                  onChange={(e) => set('sport', e.target.value)}
                >
                  {SPORTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="adm-field">
                <label htmlFor="fx-league">League</label>
                <select
                  id="fx-league"
                  className={`adm-select ${errors.leagueId ? 'err' : ''}`}
                  value={form.leagueId}
                  onChange={(e) => set('leagueId', e.target.value)}
                >
                  <option value="">— Select League —</option>
                  {eligible.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {errors.leagueId && <span className="adm-field-error" role="alert">{errors.leagueId}</span>}
              </div>
              <div className="adm-field">
                <label htmlFor="fx-date">Match Date</label>
                <input id="fx-date" className="adm-input" type="date" value={form.matchDate} onChange={(e) => set('matchDate', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-time">Kickoff Time</label>
                <input id="fx-time" className="adm-input" type="time" value={form.kickoff} onChange={(e) => set('kickoff', e.target.value)} />
              </div>
              <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="fx-venue">Venue</label>
                <input id="fx-venue" className="adm-input" placeholder="Stadium name" value={form.venue} onChange={(e) => set('venue', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="adm-fx-section">
            <h3 className="adm-fx-section-title">Teams</h3>
            <div className="adm-fx-grid">
              <div className="adm-field">
                <label htmlFor="fx-home">Home Team</label>
                <input
                  id="fx-home"
                  className={`adm-input ${errors.home ? 'err' : ''}`}
                  placeholder="e.g. Manchester United"
                  value={form.home}
                  onChange={(e) => set('home', e.target.value)}
                  required
                />
                {errors.home && <span className="adm-field-error" role="alert">{errors.home}</span>}
              </div>
              <div className="adm-field">
                <label htmlFor="fx-away">Away Team</label>
                <input
                  id="fx-away"
                  className={`adm-input ${errors.away ? 'err' : ''}`}
                  placeholder="e.g. Chelsea"
                  value={form.away}
                  onChange={(e) => set('away', e.target.value)}
                  required
                />
                {errors.away && <span className="adm-field-error" role="alert">{errors.away}</span>}
              </div>
            </div>
          </section>

          <section className="adm-fx-section">
            <h3 className="adm-fx-section-title">Main Market Odds</h3>
            <div className="adm-fx-grid">
              <div className="adm-field">
                <label htmlFor="fx-home-odds">Home Win</label>
                <input
                  id="fx-home-odds"
                  className={`adm-input ${errors.homeOdds ? 'err' : ''}`}
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={form.homeOdds}
                  onChange={(e) => set('homeOdds', e.target.value)}
                />
                {errors.homeOdds && <span className="adm-field-error" role="alert">{errors.homeOdds}</span>}
              </div>
              {form.sport === 'football' && (
                <div className="adm-field">
                  <label htmlFor="fx-draw-odds">Draw</label>
                  <input
                    id="fx-draw-odds"
                    className={`adm-input ${errors.drawOdds ? 'err' : ''}`}
                    type="number"
                    step="0.01"
                    min="1.01"
                    value={form.drawOdds}
                    onChange={(e) => set('drawOdds', e.target.value)}
                  />
                  {errors.drawOdds && <span className="adm-field-error" role="alert">{errors.drawOdds}</span>}
                </div>
              )}
              <div className="adm-field">
                <label htmlFor="fx-away-odds">Away Win</label>
                <input
                  id="fx-away-odds"
                  className={`adm-input ${errors.awayOdds ? 'err' : ''}`}
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={form.awayOdds}
                  onChange={(e) => set('awayOdds', e.target.value)}
                />
                {errors.awayOdds && <span className="adm-field-error" role="alert">{errors.awayOdds}</span>}
              </div>
            </div>
          </section>

          <section className="adm-fx-section">
            <h3 className="adm-fx-section-title">Additional Markets</h3>
            <div className="adm-fx-grid">
              <div className="adm-field">
                <label htmlFor="fx-ou-over">Over 2.5</label>
                <input id="fx-ou-over" className="adm-input" type="number" step="0.01" min="1.01" value={form.ouOver} onChange={(e) => set('ouOver', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-ou-under">Under 2.5</label>
                <input id="fx-ou-under" className="adm-input" type="number" step="0.01" min="1.01" value={form.ouUnder} onChange={(e) => set('ouUnder', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-btts-yes">BTTS Yes</label>
                <input id="fx-btts-yes" className="adm-input" type="number" step="0.01" min="1.01" value={form.bttsYes} onChange={(e) => set('bttsYes', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-btts-no">BTTS No</label>
                <input id="fx-btts-no" className="adm-input" type="number" step="0.01" min="1.01" value={form.bttsNo} onChange={(e) => set('bttsNo', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-dc-1x">DC 1X (Home/Draw)</label>
                <input id="fx-dc-1x" className="adm-input" type="number" step="0.01" min="1.01" value={form.dc1X} onChange={(e) => set('dc1X', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-dc-x2">DC X2 (Draw/Away)</label>
                <input id="fx-dc-x2" className="adm-input" type="number" step="0.01" min="1.01" value={form.dcX2} onChange={(e) => set('dcX2', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-dc-12">DC 12 (Home/Away)</label>
                <input id="fx-dc-12" className="adm-input" type="number" step="0.01" min="1.01" value={form.dc12} onChange={(e) => set('dc12', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-dnb-home">DNB Home</label>
                <input id="fx-dnb-home" className="adm-input" type="number" step="0.01" min="1.01" value={form.dnbHome} onChange={(e) => set('dnbHome', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-dnb-away">DNB Away</label>
                <input id="fx-dnb-away" className="adm-input" type="number" step="0.01" min="1.01" value={form.dnbAway} onChange={(e) => set('dnbAway', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-ah-home">Asian Handicap Home</label>
                <input id="fx-ah-home" className="adm-input" type="number" step="0.01" min="1.01" value={form.ahHome} onChange={(e) => set('ahHome', e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="fx-ah-away">Asian Handicap Away</label>
                <input id="fx-ah-away" className="adm-input" type="number" step="0.01" min="1.01" value={form.ahAway} onChange={(e) => set('ahAway', e.target.value)} />
              </div>
            </div>

            <div className="adm-fx-section-inner">
              <div className="adm-fx-section-title-sm">Correct Score</div>
              <label className="adm-toggle-row">
                <input type="checkbox" checked={form.csEnabled} onChange={(e) => toggleCSAll(e.target.checked)} />
                <span>Enable Correct Score market</span>
              </label>
              {form.csEnabled && (
                <div className="adm-cs-grid">
                  <div className="adm-cs-group">
                    <div className="adm-cs-group-label">Home Wins</div>
                    {['1-0','2-0','3-0','4-0','5-0','6-0'].map((s) => (
                      <label key={s} className={`adm-cs-chip ${form.csScores.includes(s) ? 'active' : ''}`}>
                        <input type="checkbox" checked={form.csScores.includes(s)} onChange={() => toggleCSCore(s)} />
                        {s}
                      </label>
                    ))}
                    <label className={`adm-cs-chip ${form.csScores.includes('OTHER_HOME') ? 'active' : ''}`}>
                      <input type="checkbox" checked={form.csScores.includes('OTHER_HOME')} onChange={() => toggleCSCore('OTHER_HOME')} />
                      Any Other Home Win
                    </label>
                  </div>
                  <div className="adm-cs-group">
                    <div className="adm-cs-group-label">Draw</div>
                    {['0-0','1-1','2-2','3-3','4-4','5-5'].map((s) => (
                      <label key={s} className={`adm-cs-chip ${form.csScores.includes(s) ? 'active' : ''}`}>
                        <input type="checkbox" checked={form.csScores.includes(s)} onChange={() => toggleCSCore(s)} />
                        {s}
                      </label>
                    ))}
                    <label className={`adm-cs-chip ${form.csScores.includes('OTHER_DRAW') ? 'active' : ''}`}>
                      <input type="checkbox" checked={form.csScores.includes('OTHER_DRAW')} onChange={() => toggleCSCore('OTHER_DRAW')} />
                      Any Other Draw
                    </label>
                  </div>
                  <div className="adm-cs-group">
                    <div className="adm-cs-group-label">Away Wins</div>
                    {['0-1','0-2','0-3','0-4','0-5','0-6'].map((s) => (
                      <label key={s} className={`adm-cs-chip ${form.csScores.includes(s) ? 'active' : ''}`}>
                        <input type="checkbox" checked={form.csScores.includes(s)} onChange={() => toggleCSCore(s)} />
                        {s}
                      </label>
                    ))}
                    <label className={`adm-cs-chip ${form.csScores.includes('OTHER_AWAY') ? 'active' : ''}`}>
                      <input type="checkbox" checked={form.csScores.includes('OTHER_AWAY')} onChange={() => toggleCSCore('OTHER_AWAY')} />
                      Any Other Away Win
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="adm-fx-section">
            <h3 className="adm-fx-section-title">Advanced Settings</h3>
            <div className="adm-fx-grid">
              <div className="adm-field">
                <label htmlFor="fx-visibility">Visibility</label>
                <select id="fx-visibility" className="adm-select" value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                  <option value="prematch">Pre-match only</option>
                </select>
              </div>
              <div className="adm-field">
                <label htmlFor="fx-status">Status</label>
                <select id="fx-status" className="adm-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
                <label className="adm-toggle-row">
                  <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                  <span>Featured Match</span>
                </label>
              </div>
            </div>
          </section>
        </form>

        <div className="adm-fx-modal-footer">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={submit} disabled={saving} aria-label="Save fixture">
            {saving ? <Spinner label="Saving..." /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   CREATE LEAGUE MODAL
   ================================================================ */

function CreateLeagueModal({ open, onClose, onCreated, showToast }) {
  const [form, setForm] = useState({ name: '', sport: 'football', region: '', countryMeta: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: '', sport: 'football', region: '', countryMeta: '' });
      setError('');
      setSaving(false);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('League name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminCreateLeague(form);
      onCreated();
    } catch (e) {
      setError(e.body?.error || e.message);
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New league" description="Add a custom competition.">
      <form onSubmit={submit}>
        {error && <div className="adm-fx-error-banner" role="alert"><IconAlert size={14} /> {error}</div>}
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="lg-name">League Name</label>
          <input id="lg-name" className="adm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Premier League" />
        </div>
        <div className="adm-fx-grid" style={{ marginTop: 12 }}>
          <div className="adm-field">
            <label htmlFor="lg-sport">Sport</label>
            <select id="lg-sport" className="adm-select" value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}>
              {SPORTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="adm-field">
            <label htmlFor="lg-region">Region</label>
            <input id="lg-region" className="adm-input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="europe / africa / americas" />
          </div>
        </div>
        <div className="adm-field" style={{ marginTop: 12 }}>
          <label htmlFor="lg-meta">Meta line</label>
          <input id="lg-meta" className="adm-input" value={form.countryMeta} onChange={(e) => setForm((f) => ({ ...f, countryMeta: e.target.value }))} placeholder="GHA · MATCHWEEK 18" />
        </div>
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="adm-btn primary" disabled={saving}>
            {saving ? <Spinner label="Creating..." /> : 'Create league'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
