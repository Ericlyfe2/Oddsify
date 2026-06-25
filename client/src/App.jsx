import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppProviders from './providers/AccountProvider.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AppShell from './layout/AppShell.jsx';
import Home from './pages/Home.jsx';
import SportsPage from './pages/SportsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import WalletPage from './pages/WalletPage.jsx';
import BetHistoryPage from './pages/BetHistoryPage.jsx';
import BetDetailPage from './pages/BetDetailPage.jsx';
import OpenBetsScreen from './components/OpenBetsScreen.jsx';
import CodeHubPage from './pages/CodeHubPage.jsx';

import { AdminProvider, AdminGuard } from './providers/AdminProvider.jsx';
import AdminShell from './layout/AdminShell.jsx';
import {
  LiveBettingPage,
  AuditLogsPage,
  SettingsPage,
  FinancePage,
  NotificationsPage,
  SupportPage,
  FraudPage,
} from './pages/admin/Stubs.jsx';

// Lazy-loaded page chunks — split by routing segment to keep the main bundle lean.
const WithdrawPage = lazy(() => import('./pages/WithdrawPage.jsx'));
const CasinoPage = lazy(() => import('./pages/CasinoPage.jsx'));
const DicePage = lazy(() => import('./pages/games/DicePage.jsx'));
const Spin2WinPage = lazy(() => import('./pages/games/Spin2WinPage.jsx'));
const RedBlackPage = lazy(() => import('./pages/games/RedBlackPage.jsx'));
const VirtualsPage = lazy(() => import('./pages/VirtualsPage.jsx'));
const JackpotPage = lazy(() => import('./pages/JackpotPage.jsx'));
const PromosPage = lazy(() => import('./pages/PromosPage.jsx'));
const InfoPage = lazy(() => import('./pages/InfoPage.jsx'));
const HelpPage = lazy(() => import('./pages/HelpPage.jsx'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminSignup = lazy(() => import('./pages/admin/AdminSignup.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminStages = lazy(() => import('./pages/admin/Stages.jsx'));
const AdminBets = lazy(() => import('./pages/admin/Bets.jsx'));
const AdminSports = lazy(() => import('./pages/admin/Sports.jsx'));
const AdminPromotions = lazy(() => import('./pages/admin/Promotions.jsx'));
const AdminStats = lazy(() => import('./pages/admin/Stats.jsx'));
const AdminProviders = lazy(() => import('./pages/admin/Providers.jsx'));
const AdminHealth = lazy(() => import('./pages/admin/Health.jsx'));
const AdminDeposits = lazy(() => import('./pages/admin/Deposits.jsx'));
const AdminReferrals = lazy(() => import('./pages/admin/Referrals.jsx'));
const AdminCatalog = lazy(() => import('./pages/admin/Catalog.jsx'));
const AdminSportsMgmt = lazy(() => import('./pages/admin/SportsMgmt.jsx'));
const AdminTeams = lazy(() => import('./pages/admin/Teams.jsx'));
const AdminLeagues = lazy(() => import('./pages/admin/Leagues.jsx'));
const AdminMatches = lazy(() => import('./pages/admin/Matches.jsx'));
const AdminMarkets = lazy(() => import('./pages/admin/Markets.jsx'));
const AdminResults = lazy(() => import('./pages/admin/Results.jsx'));
const ReferralPage = lazy(() => import('./pages/ReferralPage.jsx'));

const PAGE_FALLBACK = <div className="page-loading" />;

function AdminApp() {
  return (
    <AdminProvider>
      <Suspense fallback={PAGE_FALLBACK}>
        <Routes>
          <Route path="login" element={<Navigate to="/login?next=/admin" replace />} />
          <Route path="signup" element={<AdminSignup />} />
          <Route
            element={
              <AdminGuard>
                <AdminShell />
              </AdminGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="stages" element={<AdminStages />} />
            <Route path="bets" element={<AdminBets />} />
            <Route path="live" element={<LiveBettingPage />} />
            <Route path="sports" element={<AdminSports />} />
            <Route path="promotions" element={<AdminPromotions />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="deposits" element={<AdminDeposits />} />
            <Route path="referrals" element={<AdminReferrals />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="analytics" element={<AdminStats />} />
            <Route path="fraud" element={<FraudPage />} />
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="providers" element={<AdminProviders />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="management/sports" element={<AdminSportsMgmt />} />
            <Route path="management/teams" element={<AdminTeams />} />
            <Route path="management/leagues" element={<AdminLeagues />} />
            <Route path="management/matches" element={<AdminMatches />} />
            <Route path="management/markets" element={<AdminMarkets />} />
            <Route path="management/results" element={<AdminResults />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminProvider>
  );
}

/** /register?ref=CODE → /login?mode=register&ref=CODE (referral links). */
function RegisterRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('mode', 'register');
  return <Navigate to={`/login?${params.toString()}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollRestoration />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route
          path="/*"
          element={
            <AppProviders>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterRedirect />} />
                <Route path="/signup" element={<RegisterRedirect />} />
                <Route path="/verify" element={<Navigate to="/login" replace />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/sports" element={<SportsPage />} />
                  <Route path="/live" element={<SportsPage />} />
                  <Route path="/my-bets" element={<BetHistoryPage />} />
                  <Route path="/open-bets" element={<OpenBetsScreen />} />
                  <Route path="/bets/:id" element={<BetDetailPage />} />
                  <Route path="/codehub" element={<CodeHubPage />} />
                  <Route path="/code/:code" element={<CodeHubPage />} />
                  <Route path="/booking-code/:code" element={<CodeHubPage />} />
                  <Route
                    path="/casino"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <CasinoPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/casino/dice"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <DicePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/casino/spin2win"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <Spin2WinPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/casino/red-black"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <RedBlackPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/virtuals"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <VirtualsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/jackpot"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <JackpotPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/promos"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <PromosPage />
                      </Suspense>
                    }
                  />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route
                    path="/refer"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <ReferralPage />
                      </Suspense>
                    }
                  />
                  <Route path="/wallet" element={<WalletPage />} />
                  <Route
                    path="/withdraw"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <WithdrawPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/info"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <InfoPage />
                      </Suspense>
                    }
                  />
                  <Route path="/terms" element={<Navigate to="/info#terms" replace />} />
                  <Route path="/privacy" element={<Navigate to="/info#privacy" replace />} />
                  <Route path="/responsible-gaming" element={<Navigate to="/info#responsible-gaming" replace />} />
                  <Route path="/licence" element={<Navigate to="/info#licence" replace />} />
                  <Route
                    path="/help"
                    element={
                      <Suspense fallback={PAGE_FALLBACK}>
                        <HelpPage />
                      </Suspense>
                    }
                  />
                  <Route path="/contact" element={<Navigate to="/help" replace />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </AppProviders>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}
