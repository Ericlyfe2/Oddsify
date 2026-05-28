/**
 * QuickBetStrip — horizontal scroll of the next 6 non-live football kickoffs.
 * Each card shows team names + kickoff badge + three 1X2 odds buttons
 * that add the selection to the bet slip via the existing togglePick callback.
 *
 * Pure-presentational: consumes matches + picks + onPick props from Home,
 * no fetch of its own.
 *
 * IMPORTANT — Shape notes (confirmed from live API + normalize.js):
 *   - `matches` is already normalised by flattenLeagues(), so odds live at
 *     match.odds = { '1': 1.42, 'X': 4.2, '2': 7.5 } (flat numbers).
 *   - match.home / match.away are plain strings, not objects.
 *   - match.time holds the kickoff string (e.g. "17:30").  match.day is "Today".
 *   - `picks` is an object keyed by match.id: picks[id] = { match, key, val }.
 *   - onPick (= togglePick) signature: (match, outcomeKey, oddsValue) => void.
 */
import { T } from './tokens.js';

function relativeKickoff(timeStr, day) {
  // timeStr is "HH:MM", day is "Today" | "Tomorrow" | undefined
  if (!timeStr) return '';
  if (day === 'Today') {
    const [hh, mm] = timeStr.split(':').map(Number);
    const now = new Date();
    const then = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    const ms = then.getTime() - Date.now();
    if (ms < 0)               return 'Started';
    if (ms < 60_000)          return 'in <1m';
    if (ms < 60 * 60_000)     return `in ${Math.floor(ms / 60_000)}m`;
    const h = Math.floor(ms / (60 * 60_000));
    return `Today ${timeStr}`;
  }
  return `${day || ''} ${timeStr}`.trim();
}

/** Read the flat odds map already normalised by normalize.js. */
function get1X2(match) {
  const o = match.odds;
  if (!o || o['1'] == null || o['2'] == null) return null;
  return { '1': Number(o['1']), 'X': Number(o['X'] ?? 0), '2': Number(o['2']) };
}

function OddsBtn({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, height: 52,
        background: active ? T.greenSoft : T.surfaceAlt,
        border: active ? `2px solid ${T.greenBright}` : `1px solid ${T.line}`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, cursor: 'pointer', padding: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      aria-label={`${label} at odds ${value}`}
    >
      <span style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 700, color: active ? T.greenBright : T.ink,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value > 0 ? Number(value).toFixed(2) : '—'}
      </span>
    </button>
  );
}

function MatchCard({ match, picks, onPick }) {
  const odds = get1X2(match);
  if (!odds) return null;

  // picks is keyed by match.id; picks[id].key is the selected outcome ('1'|'X'|'2')
  const pickedKey = picks?.[match.id]?.key;
  const isActive = (out) => pickedKey === out;

  const click = (out) => onPick?.(match, out, odds[out]);

  return (
    <article
      style={{
        flex: '0 0 280px', width: 280, height: 144, scrollSnapAlign: 'start',
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
        padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
      aria-label={`${match.home} vs ${match.away}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {match.home} <span style={{ opacity: 0.5 }}>vs</span> {match.away}
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft }}>
          {relativeKickoff(match.time, match.day)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <OddsBtn label="1" value={odds['1']} active={isActive('1')} onClick={() => click('1')} />
        <OddsBtn label="X" value={odds['X']} active={isActive('X')} onClick={() => click('X')} />
        <OddsBtn label="2" value={odds['2']} active={isActive('2')} onClick={() => click('2')} />
      </div>
    </article>
  );
}

function Skeletons() {
  return (
    <div className="odd-pane" style={{ display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          flex: '0 0 280px', width: 280, height: 144, borderRadius: 12,
          background: T.surface, border: `1px solid ${T.line}`, opacity: 0.5 + i * 0.15,
        }} />
      ))}
    </div>
  );
}

export default function QuickBetStrip({ matches, loading, picks, onPick }) {
  if (loading) return <Skeletons />;
  const quick = (matches || []).filter((m) => !m.isLive).slice(0, 6);
  const valid = quick.filter((m) => get1X2(m));
  if (valid.length === 0) return null;
  return (
    <div
      className="odd-pane"
      role="region"
      aria-label="Quick bet — next kickoffs"
      style={{
        display: 'flex', gap: 10, padding: '6px 16px 12px', overflowX: 'auto',
        scrollSnapType: 'x mandatory',
      }}
    >
      {valid.map((m) => (
        <MatchCard key={m.id} match={m} picks={picks} onPick={onPick} />
      ))}
    </div>
  );
}
