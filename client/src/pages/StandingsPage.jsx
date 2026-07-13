/**
 * Standings — league/cup tables from live-score-api via /api/bet/standings.
 *
 * Two modes:
 *   - No ?competition → competition picker built from the leagues currently
 *     in the live matches feed that carry a numeric competitionId.
 *   - ?competition=N (&name=X) → the table(s) for that competition. Multi-group
 *     tournaments render one table per group; single leagues render one.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchStandings, fetchMatches } from '../api/betApi.js';
import { useTokens, OddPageHeader, OddIcon } from '../components/odd/primitives.jsx';
import { TeamLogo } from '../components/odd/teamBranding.jsx';

export default function StandingsPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const competition = params.get('competition');
  const nameHint = params.get('name') || '';

  if (competition) {
    return <StandingsTableView competition={competition} nameHint={nameHint} T={T} onBack={() => navigate('/standings')} />;
  }
  return <CompetitionPicker T={T} onPick={(l) => navigate(`/standings?competition=${l.competitionId}&name=${encodeURIComponent(l.name)}`)} />;
}

/* ─── Competition picker ─── */
function CompetitionPicker({ T, onPick }) {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMatches('football')
      .then((d) => {
        if (!alive) return;
        // Unique leagues that have a numeric competition id (dedupe by id).
        const seen = new Map();
        for (const l of d.leagues || []) {
          if (l.competitionId && !seen.has(l.competitionId)) seen.set(l.competitionId, l);
        }
        setLeagues([...seen.values()]);
      })
      .catch(() => setLeagues([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="Standings" subtitle="League & cup tables" />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 56, borderRadius: 12, background: T.surface, border: `1px solid ${T.line}`, opacity: 0.5 + i * 0.1 }} />
          ))
        ) : leagues.length === 0 ? (
          <EmptyCard T={T} text="No competitions with tables available right now." />
        ) : (
          leagues.map((l) => (
            <button
              key={l.competitionId}
              type="button"
              onClick={() => onPick(l)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 14px',
                borderRadius: 12,
                background: T.surface,
                border: `1px solid ${T.line}`,
                cursor: 'pointer',
                color: T.ink,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    ...styleFromCrest(l.crest),
                  }}
                >
                  {l.crest?.label || l.name.slice(0, 3).toUpperCase()}
                </span>
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{l.name}</span>
                  {l.countryMeta ? <span style={{ display: 'block', fontSize: 11, color: T.inkSoft }}>{l.countryMeta}</span> : null}
                </span>
              </span>
              <OddIcon name="chevR" size={16} color={T.inkSoft} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Table view for a single competition ─── */
function StandingsTableView({ competition, nameHint, T, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    fetchStandings(competition)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e?.status === 404 ? 'No table is available for this competition yet.' : 'Failed to load standings.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [competition]);

  const title = data?.competition?.name || nameHint || 'Standings';
  const subtitle = data?.season?.name ? `Season ${data.season.name}` : 'League table';

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader
        title={title}
        subtitle={subtitle}
        right={
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 999,
              background: T.surface,
              border: `1px solid ${T.line}`,
              color: T.ink,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <OddIcon name="chevL" size={14} color={T.ink} /> All tables
          </button>
        }
      />
      <div style={{ padding: '12px 12px' }}>
        {loading ? (
          <div style={{ height: 320, borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, opacity: 0.6 }} />
        ) : err ? (
          <EmptyCard T={T} text={err} />
        ) : (
          (data?.groups || []).map((g, gi) => <GroupTable key={g.id || gi} group={g} T={T} />)
        )}
      </div>
    </div>
  );
}

function GroupTable({ group, T }) {
  const cell = { padding: '8px 4px', fontSize: 12, textAlign: 'center', color: T.ink, fontVariantNumeric: 'tabular-nums' };
  const head = { ...cell, color: T.inkSoft, fontWeight: 700, fontSize: 10, letterSpacing: 0.4 };

  return (
    <div style={{ marginBottom: 18 }}>
      {group.name ? (
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, padding: '2px 6px 10px' }}>{group.name}</div>
      ) : null}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={{ ...head, textAlign: 'center', width: 28 }}>#</th>
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
              {group.rows.map((r) => (
                <tr key={r.rank + r.team} style={{ borderBottom: `1px solid ${T.line}` }}>
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
      </div>
    </div>
  );
}

function EmptyCard({ T, text }) {
  return (
    <div
      style={{
        padding: '20px 16px',
        borderRadius: 12,
        background: T.surface,
        border: `1px solid ${T.line}`,
        color: T.inkSoft,
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

function styleFromCrest(crest) {
  if (!crest?.style) return { background: 'rgba(255,255,255,0.06)', color: '#fff' };
  const out = {};
  for (const decl of crest.style.split(';')) {
    const [k, v] = decl.split(':');
    if (!k || !v) continue;
    const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = v.trim();
  }
  return out;
}
