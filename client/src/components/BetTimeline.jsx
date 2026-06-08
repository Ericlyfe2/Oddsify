import { useTokens } from './odd/tokens.jsx';

function fmt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
}

function fmtFull(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
}

export default function BetTimeline({ bet, T: theme }) {
  const T = theme || useTokens();

  const legs = bet.legs || bet.selections || [];
  const allFinished = legs.length > 0 && legs.every((l) => l.status === 'won' || l.status === 'lost' || l.won === true || l.won === false);
  const hasLiveLeg = legs.some((l) => l.isLive || l.status === 'live');
  const isSettled = bet.status !== 'open';
  const isCashedOut = bet.status === 'cashed_out';

  const events = [
    {
      key: 'created',
      label: 'Bet Created',
      time: fmtFull(bet.placedAt || bet.createdAt),
      done: true,
      icon: 'edit',
    },
    {
      key: 'confirmed',
      label: 'Bet Confirmed',
      time: fmtFull(bet.confirmedAt || bet.placedAt || bet.createdAt),
      done: !!(bet.placedAt || bet.confirmedAt),
      icon: 'check',
    },
    {
      key: 'started',
      label: 'Match Started',
      time: hasLiveLeg ? 'Live' : null,
      done: hasLiveLeg || allFinished || isSettled,
      icon: 'play',
      active: hasLiveLeg,
    },
    {
      key: 'finished',
      label: 'Match Ended',
      time: allFinished || isSettled ? 'Completed' : null,
      done: allFinished || isSettled,
      icon: 'square',
    },
    {
      key: 'cashout_offered',
      label: 'Cashout Offered',
      time: bet.lastCashOutOffer?.ts ? fmt(bet.lastCashOutOffer.ts) : null,
      done: !!(bet.lastCashOutOffer?.amount > 0 || bet.cashoutOffer > 0 || isCashedOut),
      icon: 'dollar',
    },
    {
      key: 'cashout_accepted',
      label: isCashedOut ? 'Cashout Accepted' : 'Cashout Available',
      time: isCashedOut ? fmtFull(bet.cashOutAt) : null,
      done: isCashedOut || bet.cashOut != null,
      icon: 'credit',
      highlight: isCashedOut,
    },
    {
      key: 'settled',
      label: 'Bet Settled',
      time: isSettled ? fmtFull(bet.settledAt || bet.cashOutAt) : null,
      done: isSettled,
      icon: 'flag',
      highlight: isSettled && (bet.status === 'won' || bet.status === 'cashed_out'),
    },
  ];

  return (
    <div style={{
      padding: '16px 8px',
      borderRadius: 12,
      background: T.surfaceAlt,
      border: `1px solid ${T.line}`,
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((evt, i) => {
          const isLast = i === events.length - 1;
          return (
            <div key={evt.key} style={{ display: 'flex', gap: 12, alignItems: 'stretch', minHeight: 44 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: evt.highlight
                    ? (bet.status === 'won' || bet.status === 'cashed_out' ? '#16a34a' : '#2563eb')
                    : evt.done
                      ? T.greenBright
                      : evt.active
                        ? '#2563eb'
                        : T.line,
                  color: evt.done || evt.highlight || evt.active ? '#fff' : T.inkDim,
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                  transition: 'all 300ms',
                  animation: evt.active ? 'pulse 2s infinite' : 'none',
                }}>
                  <TimelineIcon name={evt.icon} />
                </div>
                {!isLast && (
                  <div style={{
                    flex: 1,
                    width: 2,
                    background: evt.done ? T.greenBright : T.line,
                    opacity: evt.done ? 1 : 0.3,
                    marginTop: 2,
                    transition: 'background 300ms',
                  }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                <div style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: evt.done || evt.highlight ? T.ink : T.inkDim,
                  transition: 'color 300ms',
                }}>
                  {evt.label}
                </div>
                {evt.time && (
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 1 }}>
                    {evt.time}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineIcon({ name }) {
  const paths = {
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    check: 'M20 6L9 17l-5-5',
    play: 'M5 3l14 9-14 9V3z',
    square: 'M6 6h12v12H6z',
    dollar: 'M12 1v22m-6-6h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2z',
    credit: 'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H3V6h18v12zM7 8h10v2H7V8zm0 4h6v2H7v-2z',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  };

  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.check} />
    </svg>
  );
}
