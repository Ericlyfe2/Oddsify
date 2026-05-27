/**
 * AppShell — stripped down to host the Claude Design Oddsify.html port.
 *
 * The shell only owns:
 *  - <Outlet /> for the active route (each page renders its own header).
 *  - The global bet-slip FAB + slide-up sheet (from components/odd/BetSlip).
 *  - The bottom nav (Home / AZ Menu / Bet History / Wallet / Account).
 *
 * Pre-existing desktop chrome (ticker + horizontal nav + footer + wallet
 * dialog) has been retired — the design is mobile-first and the deposit
 * dialog is now mounted globally by AccountProvider, so guests/auths reach
 * the same flows from the new Account screen's quick-action grid.
 *
 * Re-exports are kept (useAccount / useToast) so existing imports that read
 * from "../layout/AppShell.jsx" don't break while pages migrate.
 */
import { Outlet } from 'react-router-dom';
import SlipProvider from '../providers/SlipProvider.jsx';
import OddBottomNav from '../components/odd/BottomNav.jsx';
import { OddBetSlipFAB, OddBetSlip } from '../components/odd/BetSlip.jsx';
import { OddSupportBubble, OddWithdrawNotices } from '../components/odd/Ambient.jsx';
export { useAccount, useToast } from '../providers/AccountProvider.jsx';

export default function AppShell() {
  return (
    <SlipProvider>
      <div className="odd-shell" style={{
        background: 'var(--bg)',
        minHeight: '100vh',
      }}>
        <Outlet />
      </div>
      <OddBetSlipFAB />
      <OddBetSlip />
      <OddBottomNav />
      <OddSupportBubble />
      <OddWithdrawNotices />
    </SlipProvider>
  );
}
