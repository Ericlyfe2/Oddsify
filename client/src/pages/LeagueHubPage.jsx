/**
 * League Hub — the curated "major leagues" surface, backed by live-score-api.
 *
 * Two modes (like StandingsPage):
 *   - /leagues            → hub: the 12 curated competitions grouped by type.
 *   - /leagues/:id        → one competition, with tabs that map 1:1 onto the
 *                           reachable endpoints:
 *       leagues       → Table (standings) · Scorers · Results
 *       tournaments   → Groups (competition-groups + group-standings) ·
 *                       Scorers · Results · Squads (rosters)
 *
 * Design deliberately mirrors StandingsPage (same tokens, TeamLogo, table
 * chrome) so the hub feels native rather than bolted on.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchMajorLeagues,
  fetchStandings,
  fetchTopScorers,
  fetchHistory,
  fetchCompetitionGroups,
  fetchGroupStandings,
  fetchRosters,
} from '../api/betApi.js';
import { useTokens, OddPageHeader, OddIcon, OddSegmented } from '../components/odd/primitives.jsx';
import { TeamLogo } from '../components/odd/teamBranding.jsx';

const TYPE_SECTIONS = [
  { key: 'league', title: 'Top Leagues' },
  { key: 'cup', title: 'Continental Cups' },
  { key: 'international', title: 'International' },
];

export default function LeagueHubPage() {
  const { id } = useParams();
  const T = useTokens();
  const navigate = useNavigate();
  if (id) return <LeagueDetail id={id} T={T} onBack={() => navigate('/leagues')} onOpen={(l) => navigate(`/leagues/${l.id}`)} />;
  return <LeagueHub T={T} onPick={(l) => navigate(`/leagues/${l.id}`)} />;
}

/* ─── Hub landing ─── */
function LeagueHub({ T, onPick }) {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMajorLeagues()
      .then((d) => alive && setLeagues(d.leagues || []))
      .catch(() => alive && setLeagues([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="Leagues" subtitle="Tables, scorers & results" />
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} style={{ height: 120, borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, opacity: 0.5 + i * 0.15 }} />
          ))
        ) : leagues.length === 0 ? (
          <EmptyCard T={T} text="Leagues are unavailable right now." />
        ) : (
          TYPE_SECTIONS.map((sec) => {
            const items = leagues.filter((l) => l.type === sec.key);
            if (!items.length) return null;
            return (
              <div key={sec.key}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: T.inkSoft, padding: '0 4px 8px', textTransform: 'uppercase' }}>
                  {sec.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((l) => (
                    <LeagueRow key={l.id} league={l} T={T} onPick={onPick} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LeagueRow({ league, T, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(league)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '14px',
        borderRadius: 12,
        background: T.surface,
        border: `1px solid ${T.line}`,
        cursor: 'pointer',
        color: T.ink,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.06)',
            color: T.ink,
          }}
        >
          {league.shortName?.slice(0, 4) || league.name.slice(0, 3).toUpperCase()}
        </span>
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{league.name}</span>
          <span style={{ display: 'block', fontSize: 11, color: T.inkSoft }}>{league.country}</span>
        </span>
      </span>
      <OddIcon name="chevR" size={16} color={T.inkSoft} />
    </button>
  );
}

/* ─── League detail with tabs ─── */
function LeagueDetail({ id, T, onBack }) {
  const [league, setLeague] = useState(null);
  const [tab, setTab] = useState('');

  useEffect(() => {
    let alive = true;
    fetchMajorLeagues()
      .then((d) => alive && setLeague((d.leagues || []).find((l) => String(l.id) === String(id)) || { id, name: 'Competition', hasGroups: false, type: 'league' }))
      .catch(() => alive && setLeague({ id, name: 'Competition', hasGroups: false, type: 'league' }));
    return () => {
      alive = false;
    };
  }, [id]);

  const tabs = useMemo(() => {
    if (!league) return [];
    const t = league.hasGroups
      ? [{ value: 'groups', label: 'Groups' }]
      : [{ value: 'table', label: 'Table' }];
    t.push({ value: 'scorers', label: 'Scorers' });
    t.push({ value: 'results', label: 'Results' });
    if (league.type === 'international') t.push({ value: 'squads', label: 'Squads' });
    return t;
  }, [league]);

  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.value === tab)) setTab(tabs[0].value);
  }, [tabs, tab]);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader
        title={league?.name || 'Competition'}
        subtitle={league?.country || 'League'}
        right={
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999,
              background: T.surface, border: `1px solid ${T.line}`, color: T.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <OddIcon name="chevL" size={14} color={T.ink} /> Leagues
          </button>
        }
      />
      <div style={{ padding: '4px 12px 0' }}>
        {tabs.length ? <OddSegmented options={tabs} value={tab} onChange={setTab} full /> : null}
      </div>
      <div style={{ padding: '12px' }}>
        {!league ? (
          <div style={{ height: 280, borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, opacity: 0.6 }} />
        ) : tab === 'table' ? (
          <StandingsTab competition={id} T={T} />
        ) : tab === 'groups' ? (
          <GroupsTab competition={id} T={T} />
        ) : tab === 'scorers' ? (
          <ScorersTab competition={id} T={T} />
        ) : tab === 'results' ? (
          <ResultsTab competition={id} T={T} />
        ) : tab === 'squads' ? (
          <SquadsTab competition={id} T={T} />
        ) : null}
      </div>
    </div>
  );
}

/* ─── Tab: single-league table ─── */
function StandingsTab({ competition, T }) {
  const { data, loading, err } = useAsync(() => fetchStandings(competition), [competition], 'No table for this competition yet.');
  if (loading) return <TablesSkeleton T={T} />;
  if (err) return <EmptyCard T={T} text={err} />;
  return (data?.groups || []).map((g, gi) => <GroupTable key={g.id || gi} group={g} T={T} />);
}

/* ─── Tab: tournament groups (list → drill to a group table) ─── */
function GroupsTab({ competition, T }) {
  const { data: groups, loading, err } = useAsync(() => fetchCompetitionGroups(competition).then((d) => d.groups || []), [competition], 'No groups for this competition.');
  const [openId, setOpenId] = useState(null);

  if (loading) return <TablesSkeleton T={T} />;
  if (err) return <EmptyCard T={T} text={err} />;
  if (!groups?.length) return <EmptyCard T={T} text="No groups published for this competition yet." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((g) => (
        <div key={g.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setOpenId(openId === g.id ? null : g.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 14px', background: 'transparent', border: 'none', color: T.ink, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {g.name ? `Group ${g.name}` : g.stage || 'Group'}
              {g.stage && g.name ? <span style={{ color: T.inkSoft, fontWeight: 500 }}> · {g.stage}</span> : null}
            </span>
            <OddIcon name={openId === g.id ? 'chevD' : 'chevR'} size={16} color={T.inkSoft} />
          </button>
          {openId === g.id ? <GroupDrill group={g.id} T={T} /> : null}
        </div>
      ))}
    </div>
  );
}

function GroupDrill({ group, T }) {
  const { data, loading, err } = useAsync(() => fetchGroupStandings(group), [group], 'No standings for this group yet.');
  if (loading) return <div style={{ height: 140, opacity: 0.5, background: T.bg }} />;
  if (err || !data?.group?.rows?.length) return <div style={{ padding: '0 12px 12px' }}><EmptyCard T={T} text={err || 'No standings yet.'} /></div>;
  return (
    <div style={{ borderTop: `1px solid ${T.line}` }}>
      <StandingsTable rows={data.group.rows} T={T} />
    </div>
  );
}

/* ─── Tab: top scorers ─── */
function ScorersTab({ competition, T }) {
  const { data, loading, err } = useAsync(() => fetchTopScorers(competition), [competition], 'No scorers available for this competition yet.');
  if (loading) return <TablesSkeleton T={T} />;
  if (err) return <EmptyCard T={T} text={err} />;
  const rows = data?.rows || [];
  if (!rows.length) return <EmptyCard T={T} text="No scorers published yet." />;

  const cell = { padding: '9px 4px', fontSize: 12, textAlign: 'center', color: T.ink, fontVariantNumeric: 'tabular-nums' };
  const head = { ...cell, color: T.inkSoft, fontWeight: 700, fontSize: 10, letterSpacing: 0.4 };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 340 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.line}` }}>
              <th style={{ ...head, width: 26 }}>#</th>
              <th style={{ ...head, textAlign: 'left', paddingLeft: 8 }}>PLAYER</th>
              <th style={head}>P</th>
              <th style={head}>A</th>
              <th style={{ ...head, color: T.ink, fontWeight: 800 }}>G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.rank}-${r.playerId || r.player}`} style={{ borderBottom: `1px solid ${T.line}` }}>
                <td style={{ ...cell, fontWeight: 700 }}>{r.rank}</td>
                <td style={{ ...cell, textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                    <TeamLogo name={r.team} logoUrl={r.teamLogo} size={18} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.player}</span>
                      <span style={{ display: 'block', fontSize: 10, color: T.inkSoft, whiteSpace: 'nowrap' }}>{r.team}</span>
                    </span>
                  </span>
                </td>
                <td style={cell}>{r.played ?? '–'}</td>
                <td style={cell}>{r.assists ?? '–'}</td>
                <td style={{ ...cell, fontWeight: 800, color: T.greenBright }}>{r.goals ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Tab: results (finished matches) ─── */
function ResultsTab({ competition, T }) {
  const { data, loading, err } = useAsync(() => fetchHistory({ competition }), [competition], 'No recent results for this competition.');
  if (loading) return <TablesSkeleton T={T} />;
  if (err) return <EmptyCard T={T} text={err} />;
  const matches = (data?.matches || []).filter((m) => m.status === 'finished');
  if (!matches.length) return <EmptyCard T={T} text="No finished matches to show yet." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {matches.slice(0, 40).map((m) => (
        <div
          key={m.sourceId || m.key}
          style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
            padding: '11px 12px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.home}</span>
            <TeamLogo name={m.home} logoUrl={m.homeLogo} size={20} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums', padding: '2px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
            {m.scoreHome ?? '-'} : {m.scoreAway ?? '-'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <TeamLogo name={m.away} logoUrl={m.awayLogo} size={20} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.away}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Tab: squads (rosters for national-team tournaments) ─── */
function SquadsTab({ competition, T }) {
  const { data, loading, err } = useAsync(() => fetchRosters(competition), [competition], 'No squads available for this competition.');
  const [openId, setOpenId] = useState(null);
  if (loading) return <TablesSkeleton T={T} />;
  if (err) return <EmptyCard T={T} text={err} />;
  const teams = data?.teams || [];
  if (!teams.length) return <EmptyCard T={T} text="No squads published for this competition yet." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {teams.map((t) => (
        <div key={t.teamId || t.team} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setOpenId(openId === t.teamId ? null : t.teamId)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', color: T.ink, cursor: 'pointer' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TeamLogo name={t.team} logoUrl={t.teamLogo} size={22} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.team}</span>
              <span style={{ fontSize: 11, color: T.inkSoft }}>{t.players?.length || 0}</span>
            </span>
            <OddIcon name={openId === t.teamId ? 'chevD' : 'chevR'} size={16} color={T.inkSoft} />
          </button>
          {openId === t.teamId ? (
            <div style={{ borderTop: `1px solid ${T.line}`, padding: '4px 0' }}>
              {(t.players || []).map((p) => (
                <div key={p.id || p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px' }}>
                  <span style={{ minWidth: 22, fontSize: 12, fontWeight: 800, color: T.inkSoft, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{p.number || '–'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, letterSpacing: 0.4 }}>{p.position}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ─── Shared bits ─── */

/** Standings <table> body (rank/team/P/W/D/L/GD/PTS). Mirrors StandingsPage. */
function StandingsTable({ rows, T }) {
  const cell = { padding: '8px 4px', fontSize: 12, textAlign: 'center', color: T.ink, fontVariantNumeric: 'tabular-nums' };
  const head = { ...cell, color: T.inkSoft, fontWeight: 700, fontSize: 10, letterSpacing: 0.4 };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.line}` }}>
            <th style={{ ...head, width: 28 }}>#</th>
            <th style={{ ...head, textAlign: 'left', paddingLeft: 8 }}>TEAM</th>
            <th style={head}>P</th>
            <th style={head}>W</th>
            <th style={head}>D</th>
            <th style={head}>L</th>
            <th style={head}>GD</th>
            <th style={{ ...head, color: T.ink, fontWeight: 800 }}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.team}`} style={{ borderBottom: `1px solid ${T.line}` }}>
              <td style={{ ...cell, fontWeight: 700 }}>{r.rank}</td>
              <td style={{ ...cell, textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                  <TeamLogo name={r.team} logoUrl={r.teamLogo} size={20} />
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.team}</span>
                </span>
              </td>
              <td style={cell}>{r.played}</td>
              <td style={cell}>{r.won}</td>
              <td style={cell}>{r.drawn}</td>
              <td style={cell}>{r.lost}</td>
              <td style={cell}>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td style={{ ...cell, fontWeight: 800, color: T.greenBright }}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupTable({ group, T }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {group.name ? <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, padding: '2px 6px 10px' }}>{group.name}</div> : null}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <StandingsTable rows={group.rows} T={T} />
      </div>
    </div>
  );
}

function TablesSkeleton({ T }) {
  return <div style={{ height: 300, borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, opacity: 0.6 }} />;
}

function EmptyCard({ T, text }) {
  return (
    <div style={{ padding: '20px 16px', borderRadius: 12, background: T.surface, border: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 13, textAlign: 'center' }}>
      {text}
    </div>
  );
}

/** Tiny data-fetching hook: runs `fn` on dep change, exposes {data,loading,err}. */
function useAsync(fn, deps, notFoundMsg) {
  const [state, setState] = useState({ data: null, loading: true, err: '' });
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, err: '' });
    Promise.resolve(fn())
      .then((d) => alive && setState({ data: d, loading: false, err: '' }))
      .catch((e) => alive && setState({ data: null, loading: false, err: e?.status === 404 ? notFoundMsg : 'Failed to load. Please try again.' }))
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
