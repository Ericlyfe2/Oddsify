import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAccount } from '../providers/AccountProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
export { useAccount, useToast } from '../providers/AccountProvider.jsx';

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      className="btn btn-ghost theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const { account, signOut, openDeposit, openWithdraw } = useAccount();

  const navCls = ({ isActive }) => (isActive ? 'active' : undefined);
  const balance = account?.balance ?? 0;
  const authed = !!account;

  return (
    <>
      <div className="ticker">
        <div className="ticker-track">
          <span><b>LIVE</b> Arsenal 2-1 Chelsea · 73&apos;</span>
          <span><b>BOOSTED</b> Real Madrid to win &amp; BTTS · <em>3.45</em></span>
          <span><b>LIVE</b> Kotoko 1-0 Hearts · 56&apos;</span>
          <span><b>Xenbet</b> sharper odds, instant payouts</span>
          <span><b>LIVE</b> Arsenal 2-1 Chelsea · 73&apos;</span>
          <span><b>BOOSTED</b> Real Madrid to win &amp; BTTS · <em>3.45</em></span>
          <span><b>LIVE</b> Kotoko 1-0 Hearts · 56&apos;</span>
          <span><b>Xenbet</b> sharper odds, instant payouts</span>
        </div>
      </div>

      <header>
        <div className="header-inner">
          <NavLink to="/" className="logo" end>
            <div className="logo-mark"><span>X</span></div>
            <div className="logo-text">Xen<em>bet</em></div>
          </NavLink>
          <nav id="main-nav">
            <NavLink to="/" end className={navCls}>Sports</NavLink>
            <NavLink to="/live"     className={navCls}><span className="live-dot" />Live</NavLink>
            <NavLink to="/casino"   className={navCls}>Casino</NavLink>
            <NavLink to="/virtuals" className={navCls}>Virtuals</NavLink>
            <NavLink to="/jackpot"  className={navCls}>Jackpot</NavLink>
            <NavLink to="/promos"   className={navCls}>Promotions</NavLink>
            <NavLink to="/my-bets"  className={navCls}>My Bets</NavLink>
            <NavLink to="/wallet"   className={navCls}>Wallet</NavLink>
          </nav>
          <div className="header-right">
            <button
              type="button"
              className="balance"
              title={authed ? `${account.displayName} — open wallet` : 'Not signed in'}
              onClick={() => authed ? navigate('/wallet') : navigate('/login?next=/wallet')}
              style={{ cursor: 'pointer', background: 'transparent', border: 'none', font: 'inherit' }}
            >
              <span style={{ color: 'var(--text-dim)' }}>GHS</span>
              <span className="balance-amt">{formatAmt(balance)}</span>
            </button>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={openDeposit}>Deposit</button>
            {authed && <button type="button" className="btn btn-ghost" onClick={openWithdraw}>Withdraw</button>}
            {authed && <button type="button" className="btn btn-ghost" onClick={() => navigate('/profile')} title="Account">
              {(account.displayName || account.email).charAt(0).toUpperCase()}
            </button>}
            {!authed
              ? <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>Sign in</button>
              : <button type="button" className="btn btn-primary" onClick={signOut}>Sign out</button>}
          </div>
        </div>
      </header>

      <Outlet />

      <footer>
        <div className="foot-inner">
          <div className="foot-brand">
            <div className="logo">
              <div className="logo-mark"><span>X</span></div>
              <div className="logo-text">Xen<em>bet</em></div>
            </div>
            <p>Premium sports betting for Ghana — licensed, regulated, and built for the way you actually watch the game. Sharper odds, instant payouts.</p>
          </div>
          <div className="foot-col">
            <h6>Sports</h6>
            <ul>
              <li><NavLink to="/?sport=football">Football</NavLink></li>
              <li><NavLink to="/?sport=basketball">Basketball</NavLink></li>
              <li><NavLink to="/?sport=tennis">Tennis</NavLink></li>
              <li><NavLink to="/live">Live</NavLink></li>
              <li><NavLink to="/">All sports</NavLink></li>
            </ul>
          </div>
          <div className="foot-col">
            <h6>Play</h6>
            <ul>
              <li><NavLink to="/live">Live betting</NavLink></li>
              <li><NavLink to="/jackpot">Mega-13 jackpot</NavLink></li>
              <li><NavLink to="/virtuals">Virtuals</NavLink></li>
              <li><NavLink to="/casino">Casino</NavLink></li>
              <li><NavLink to="/promos">Promotions</NavLink></li>
            </ul>
          </div>
          <div className="foot-col">
            <h6>Help</h6>
            <ul>
              <li><a onClick={openDeposit}>Deposits</a></li>
              <li><a onClick={authed ? openWithdraw : () => navigate('/login?next=/profile')}>Withdrawals</a></li>
              <li><NavLink to="/my-bets">Cash-out</NavLink></li>
              <li><NavLink to="/help">Contact us</NavLink></li>
              <li><NavLink to="/help">Help centre</NavLink></li>
            </ul>
          </div>
          <div className="foot-col">
            <h6>Legal</h6>
            <ul>
              <li><NavLink to="/info#terms">Terms &amp; conditions</NavLink></li>
              <li><NavLink to="/info#privacy">Privacy policy</NavLink></li>
              <li><NavLink to="/info#responsible-gaming">Responsible gaming</NavLink></li>
              <li><NavLink to="/info#self-exclusion">Self-exclusion</NavLink></li>
              <li><NavLink to="/info#licence">Licence info</NavLink></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <div>© {new Date().getFullYear()} Xenbet GH · Licensed by the Gaming Commission of Ghana</div>
          <div className="respo">18+ · BET RESPONSIBLY</div>
        </div>
      </footer>
    </>
  );
}
