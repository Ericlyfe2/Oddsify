/**
 * Bottom navigation — port of the Claude Design Oddsify.html OddBottomNav.
 * Five tabs (Home / AZ Menu / Bet History / Wallet / Account) routed through
 * react-router NavLink. Active tab gets a gold top dash + tinted icon/label.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { T, useTokens } from './tokens.jsx';
import OddIcon from './Icon.jsx';
import { useAccount } from '../../providers/AccountProvider.jsx';

const ITEMS = [
  { id: 'home', label: 'Home', icon: 'home', to: '/' },
  { id: 'sports', label: 'AZ Menu', icon: 'menu', to: '/sports' },
  { id: 'bets', label: 'Bet History', icon: 'ticket', to: '/my-bets' },
  { id: 'tx', label: 'Wallet', icon: 'wallet', to: '/wallet' },
  { id: 'me', label: 'Account', icon: 'user', to: '/profile' },
];

function isActive(pathname, to) {
  if (to === '/') return pathname === '/';
  return pathname.startsWith(to);
}

export default function OddBottomNav() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { account } = useAccount();
  const T = useTokens();

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        background: `linear-gradient(to top, ${T.bg}ee 70%, ${T.bg}00)`,
        pointerEvents: 'none',
        zIndex: 70,
      }}
    >
      <div
        style={{
          margin: '0 12px',
          padding: '8px 6px',
          background: T.surface,
          borderRadius: 22,
          border: `1px solid ${T.greenSoft}`,
          display: 'grid',
          gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
          boxShadow: `0 18px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px ${T.line}`,
          pointerEvents: 'auto',
          maxWidth: 560,
          marginLeft: 'auto',
          marginRight: 'auto',
          position: 'relative',
        }}
      >
        {ITEMS.map((item) => {
          const active = isActive(loc.pathname, item.to);
          const isAccount = item.id === 'me';
          // Route guests away from /profile so they hit the login flow,
          // matching the original bottom-nav's behaviour.
          const dest = isAccount && !account ? '/login?next=/profile' : item.to;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(dest)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '6px 4px',
                position: 'relative',
                color: active ? T.greenBright : T.inkDim,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
              }}
            >
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    borderRadius: 999,
                    background: T.greenBright,
                  }}
                />
              )}
              <OddIcon name={item.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.2 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
