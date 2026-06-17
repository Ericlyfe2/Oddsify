import { useMemo, useState, useCallback, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdmin } from '../providers/AdminProvider.jsx';
import { Toast } from '../components/admin/primitives.jsx';
import {
  IconDashboard,
  IconUsers,
  IconReceipt,
  IconChart,
  IconShield,
  IconCash,
  IconBell,
  IconLifebuoy,
  IconCog,
  IconSearch,
  IconSun,
  IconMoon,
  IconMenu,
  IconLogout,
  IconBook,
  IconSparkles,
  IconActivity,
} from '../components/admin/Icons.jsx';

const NAV_SECTIONS = [
  {
    id: 'sports',
    label: 'Sports Management',
    roles: ['odds_manager', 'super_admin'],
    items: [
      { to: '/admin/sports', label: 'Sports & odds', icon: <IconBook /> },
      { to: '/admin/management/sports', label: 'Sports', icon: <IconBook /> },
      { to: '/admin/management/teams', label: 'Teams', icon: <IconBook /> },
      { to: '/admin/management/leagues', label: 'Leagues', icon: <IconBook /> },
      { to: '/admin/management/matches', label: 'Matches', icon: <IconBook /> },
      { to: '/admin/management/markets', label: 'Markets', icon: <IconBook /> },
      { to: '/admin/management/results', label: 'Results', icon: <IconBook /> },
    ],
  },
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <IconDashboard />, exact: true },
      { to: '/admin/analytics', label: 'Analytics', icon: <IconChart /> },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/admin/users', label: 'Users', icon: <IconUsers /> },
      { to: '/admin/stages', label: 'Player stages', icon: <IconActivity /> },
      { to: '/admin/bets', label: 'Bets', icon: <IconReceipt /> },
      { to: '/admin/promotions', label: 'Promotions', icon: <IconSparkles /> },
      { to: '/admin/referrals', label: 'Referrals', icon: <IconSparkles /> },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    roles: ['finance_admin', 'super_admin'],
    items: [
      { to: '/admin/finance', label: 'Finance', icon: <IconCash /> },
      { to: '/admin/deposits', label: 'Deposits', icon: <IconCash /> },
    ],
  },
  {
    id: 'trust',
    label: 'Trust & safety',
    items: [
      { to: '/admin/fraud', label: 'Fraud & AI', icon: <IconActivity />, roles: ['moderator'] },
      { to: '/admin/audit', label: 'Audit logs', icon: <IconShield /> },
      { to: '/admin/notifications', label: 'Notifications', icon: <IconBell /> },
      { to: '/admin/support', label: 'Support', icon: <IconLifebuoy />, roles: ['support'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/admin/health', label: 'Health', icon: <IconActivity /> },
      { to: '/admin/settings', label: 'Settings', icon: <IconCog /> },
    ],
  },
];

function crumbsFor(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((p, i) => ({
    label: p === 'admin' ? 'Admin' : p.charAt(0).toUpperCase() + p.slice(1),
    href: '/' + parts.slice(0, i + 1).join('/'),
  }));
}

export default function AdminShell() {
  const { admin, theme, toggleTheme, collapsed, setCollapsed, mobileOpen, setMobileOpen, signOut, toast, hasRole } =
    useAdmin();
  const loc = useLocation();
  const crumbs = useMemo(() => crumbsFor(loc.pathname), [loc.pathname]);
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('adm_nav_collapsed') || '{}');
    } catch { return {}; }
  });

  const toggleSection = useCallback((id) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { sessionStorage.setItem('adm_nav_collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.adm-search input')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSections = useMemo(() =>
    NAV_SECTIONS.filter((sec) => {
      if (sec.roles && !sec.roles.some((r) => hasRole(r))) return false;
      const visible = sec.items.filter((it) => !it.roles || it.roles.some((r) => hasRole(r)));
      return visible.length > 0;
    }),
  [hasRole]);

  const isActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname.startsWith(to);
  };

  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <div className={`adm-app ${collapsed ? 'collapsed' : ''}`} data-admin-root data-theme={theme}>
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="adm-mobile-overlay" onClick={closeMobile} aria-hidden="true" />
      )}

      <aside className={`adm-side ${mobileOpen ? 'open' : ''}`} role="navigation" aria-label="Admin navigation">
        <div className="adm-brand">
          <div className="mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="11" cy="11" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <div className="text">
            <div className="name">Oddsify</div>
            <div className="sub">Admin OS</div>
          </div>
        </div>

        <nav className="adm-nav" aria-label="Sidebar">
          {filteredSections.map((sec) => {
            const visibleItems = sec.items.filter((it) => !it.roles || it.roles.some((r) => hasRole(r)));
            if (visibleItems.length === 0) return null;
            const isOpen = !collapsedSections[sec.id];

            return (
              <div key={sec.id} className="adm-nav-group">
                <button
                  className="adm-nav-section-toggle"
                  onClick={() => toggleSection(sec.id)}
                  aria-expanded={isOpen}
                  aria-label={`${sec.label} section`}
                >
                  <span className="adm-nav-section-label">{sec.label}</span>
                  <span className={`adm-nav-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">▾</span>
                </button>
                {isOpen && visibleItems.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.exact}
                    className={({ isActive: active }) => active ? 'active' : ''}
                    onClick={closeMobile}
                    aria-current={isActive(it.to, it.exact) ? 'page' : undefined}
                  >
                    <span className="icn" aria-hidden="true">{it.icon}</span>
                    <span className="lbl">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="adm-side-foot">
          <div className="avatar" aria-hidden="true">
            {(admin?.displayName || admin?.email || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="who">
            <div className="n">{admin?.displayName || admin?.email}</div>
            <div className="r">{ADMIN_ROLE_LABEL[admin?.adminRole] || admin?.adminRole}</div>
          </div>
          <button title="Logout" onClick={signOut} aria-label="Logout">
            <IconLogout />
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button
            className="toggle"
            onClick={() => {
              if (window.innerWidth <= 980) setMobileOpen((m) => !m);
              else setCollapsed((c) => !c);
            }}
            aria-label="Toggle navigation"
          >
            <IconMenu />
          </button>

          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.href}>
                {i > 0 && <span className="sep" aria-hidden="true"> · </span>}
                {i === crumbs.length - 1 ? <strong aria-current="page">{c.label}</strong> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>

          <div className="adm-search" role="search">
            <span className="icn" aria-hidden="true">
              <IconSearch size={16} />
            </span>
            <input placeholder="Search users, bets, matches…" aria-label="Global search" />
            <kbd aria-hidden="true">⌘K</kbd>
          </div>

          <div className="adm-top-actions">
            <button className="adm-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button className="adm-icon-btn" aria-label="Notifications">
              <IconBell />
              <span className="dot" aria-hidden="true" />
            </button>
            <button
              className="adm-icon-btn"
              aria-label="Account settings"
              style={{ background: 'var(--grad-brand)', color: '#fff', borderColor: 'transparent' }}
            >
              {(admin?.displayName || admin?.email || 'A').charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <main className="adm-page" role="main">
          <Outlet />
        </main>
      </div>

      <Toast {...toast} />
    </div>
  );
}

const ADMIN_ROLE_LABEL = {
  super_admin: 'Super admin',
  finance_admin: 'Finance lead',
  odds_manager: 'Trading desk',
  support: 'Support',
  moderator: 'Risk & moderation',
};
