/**
 * Account — comprehensive player profile hub for Oddsify.
 *
 * Sections (top → bottom):
 *  - Balance hero with toggleable visibility, verification chip,
 *    in-review banner (Stage 2).
 *  - Quick action grid (Deposit / Withdraw / Bet History / Promos).
 *  - Stats strip (open bets · win rate · staked).
 *  - Personal information editor (display name + phone).
 *  - Security panel (change password, 2FA placeholder).
 *  - Verification status (admin-controlled, fully manual).
 *  - Responsible gambling (daily / weekly / monthly deposit limits, self-
 *    exclusion).
 *  - Refer & earn (share code).
 *  - Communication preferences (email / SMS / push toggles).
 *  - Shortcut menu (Bet history, Wallet, Promos, Notifications, Help).
 *  - Sign out.
 *
 * Wires to existing endpoints (PATCH /api/profile, POST /api/auth/change-
 * password). Sections that don't yet have a backend (push prefs, KYC doc
 * upload, referrals) render as "coming soon" rows so the surface is
 * intentionally incomplete rather than fake.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { fetchTransactions, fetchBetHistory, updateProfile, changePassword } from '../api/betApi.js';
import { fmtCedi, useTokens, OddPageHeader, OddIcon } from '../components/odd/primitives.jsx';
import { validatePhone, autoFormatPhoneInput, E164_PLACEHOLDER } from '../lib/phone.js';

const buildQuickActions = (T, handlers) => [
  { id: 'dep', icon: 'deposit', label: 'Deposit', tint: T.greenBright, onClick: handlers.deposit },
  { id: 'with', icon: 'upload', label: 'Withdraw', tint: T.gold, onClick: handlers.withdraw },
  { id: 'bets', icon: 'ticket', label: 'Bet history', tint: '#3a6dff', onClick: handlers.bets },
  { id: 'promos', icon: 'trophy', label: 'Promos', tint: T.accentHot, onClick: handlers.promos },
];

const SHORTCUTS = (counts) => [
  { icon: 'ticket', label: 'My bets', detail: counts.openBets ? `${counts.openBets} open` : null, to: '/my-bets' },
  { icon: 'wallet', label: 'Transactions', detail: counts.tx ? String(counts.tx) : null, to: '/wallet' },
  { icon: 'trophy', label: 'Rewards & promos', to: '/promos' },
  { icon: 'info', label: 'Help center', to: '/help' },
];

/* ─── small shared sub-components ──────────────────────── */

function Section({ title, subtitle, children, action }) {
  const T = useTokens();
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: T.inkSoft }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ children, onClick, danger }) {
  const T = useTokens();
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        color: danger ? T.danger : T.ink,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', autoComplete, helper, error }) {
  const T = useTokens();
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}` }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, letterSpacing: 0.4 }}>{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        style={{
          width: '100%',
          marginTop: 4,
          background: 'transparent',
          color: T.ink,
          fontSize: 14,
          fontWeight: 600,
          border: 0,
          outline: 'none',
        }}
      />
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
      {!error && helper && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{helper}</div>}
    </div>
  );
}

function Toggle({ label, on, onChange, helper, disabled }) {
  const T = useTokens();
  return (
    <div
      style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</div>
        {helper && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{helper}</div>}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={on}
        onClick={() => onChange(!on)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          border: 0,
          padding: 2,
          background: on ? T.greenBright : T.surfaceAlt,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'background 160ms',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 18,
            height: 18,
            borderRadius: 999,
            background: '#fff',
            transform: on ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform 160ms',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */

export default function ProfilePage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { account, signOut, openDeposit, openWithdraw, unreadCount, refresh } = useAccount();
  const { toast } = useToast();

  const [counts, setCounts] = useState({ openBets: 0, tx: 0 });
  const [balanceVisible, setBalanceVisible] = useState(true);

  // personal info editor state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // change password state
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // communication prefs (UI-only for now — wired-up state from account when available)
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(true);
  const [pushPref, setPushPref] = useState(false);

  useEffect(() => {
    if (!account) return;
    setDisplayName(account.displayName || '');
    setPhone(account.phone || '');
    if (account.commsPrefs) {
      setEmailPref(account.commsPrefs.email !== false);
      setSmsPref(account.commsPrefs.sms !== false);
      setPushPref(account.commsPrefs.push === true);
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    Promise.all([fetchBetHistory().catch(() => null), fetchTransactions().catch(() => null)]).then(([bets, txs]) => {
      if (!alive) return;
      const items = bets?.bets || bets?.history || [];
      setCounts({
        openBets: items.filter((b) => b.status === 'open').length,
        tx: (txs?.transactions || txs?.items || []).length,
      });
    });
    return () => {
      alive = false;
    };
  }, [account]);

  /* ----- signed-out state ----- */
  if (!account) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Account" subtitle="Sign in to access your account" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <OddIcon name="user" size={32} color={T.inkDim} />
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>Sign in to Oddsify</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6 }}>
            Track balance, deposits, bets and verification in one place.
          </div>
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '12px 24px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  const handlers = {
    deposit: () => openDeposit(),
    withdraw: () => openWithdraw(),
    bets: () => navigate('/my-bets'),
    promos: () => navigate('/promos'),
  };

  const balance = Number(account.balance || 0);
  const bonus = Number(account.bonus || 0);
  const firstName = (account.displayName || account.email || '').split(/[ @]/)[0];
  const totalStaked = Number(account.totalStaked || 0);
  // Stage 2 is the "in review" state — show the awaiting-verification banner
  // while the account sits there and an admin hasn't verified it yet.
  const inReview = Number(account.stage ?? 0) === 2 && !account.verified;

  /* ----- handlers ----- */

  const phoneError = phone ? validatePhone(phone, { allowEmpty: true })?.message : null;
  const profileDirty =
    displayName.trim() !== (account.displayName || '').trim() || phone.trim() !== (account.phone || '').trim();

  async function saveProfile() {
    if (savingProfile) return;
    if (phone && phoneError) {
      toast(phoneError, 'warn');
      return;
    }
    if (!displayName.trim()) {
      toast('Display name cannot be empty.', 'warn');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ displayName: displayName.trim(), phone: phone.trim() });
      await refresh();
      toast('Profile updated.', 'success');
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Could not save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPasswordChange() {
    if (savingPw) return;
    if (!currentPw) return toast('Enter your current password.', 'warn');
    if (newPw.length < 8) return toast('New password must be at least 8 characters.', 'warn');
    if (newPw !== confirmPw) return toast("New passwords don't match.", 'warn');
    setSavingPw(true);
    try {
      await changePassword({ currentPassword: currentPw, newPassword: newPw });
      toast('Password updated. Other sessions were signed out.', 'success');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwOpen(false);
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Could not change password.', 'error');
    } finally {
      setSavingPw(false);
    }
  }

  async function saveCommsPrefs(next) {
    try {
      await updateProfile({ commsPrefs: next });
      await refresh();
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Could not save preference.', 'error');
    }
  }

  /* ----- render ----- */

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 140 }}>
      <OddPageHeader
        title="Account"
        subtitle={`Hello, ${firstName}`}
        right={
          <button
            type="button"
            onClick={() => navigate('/profile#notifications')}
            aria-label="Notifications"
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--text) 10%, transparent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <OddIcon name="bell" size={18} color="var(--text)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: T.danger,
                }}
              />
            )}
          </button>
        }
      />

      {/* Awaiting-verification banner — shown while the account is in review (Stage 2) */}
      {inReview && (
        <div style={{ padding: '0 16px', marginTop: -8 }}>
          <div
            style={{
              background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <OddIcon name="info" size={18} color="var(--warn)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Verification in review</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                Your account is awaiting approval. You'll be notified once it's verified.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance hero */}
      <div style={{ padding: '0 16px', marginTop: inReview ? 12 : 6, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            background: T.surface,
            borderRadius: 18,
            padding: 16,
            border: `1px solid ${T.line}`,
            boxShadow: '0 12px 32px -16px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600, letterSpacing: 0.4 }}>MAIN BALANCE</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: -0.5,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
              >
                GHS <span>{balanceVisible ? fmtCedi(balance) : '••••'}</span>
              </div>
              {bonus > 0 && balanceVisible && (
                <div style={{ fontSize: 11, color: T.greenBright, fontWeight: 600, marginTop: 2 }}>
                  Bonus GHS {fmtCedi(bonus)}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    background: account.verified ? 'rgba(24,240,161,0.15)' : 'rgba(255,181,71,0.15)',
                    color: account.verified ? '#18f0a1' : '#ffb547',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: account.verified ? '#18f0a1' : '#ffb547',
                    }}
                  />
                  {account.verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
              onClick={() => setBalanceVisible((v) => !v)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: T.surfaceAlt,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                color: T.ink,
                cursor: 'pointer',
              }}
            >
              <OddIcon name="eye" size={18} color={T.ink} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
            {buildQuickActions(T, handlers).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  alignItems: 'center',
                  padding: '10px 4px',
                  borderRadius: 12,
                  background: T.surfaceAlt,
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: `${a.tint}1f`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <OddIcon name={a.icon} size={16} color={a.tint} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.ink }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ padding: '16px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Open bets', value: String(counts.openBets) },
          { label: 'Deposited', value: `GHS ${fmtCedi(Number(account.totalDeposited || 0))}` },
          { label: 'Staked', value: `GHS ${fmtCedi(totalStaked)}` },
        ].map((s) => (
          <div
            key={s.label}
            style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}
          >
            <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4 }}>
              {s.label.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Personal information */}
      <Section
        title="Personal information"
        subtitle="What we show on receipts and notifications"
        action={
          profileDirty ? (
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.goldDark,
                background: T.greenBright,
                border: 0,
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                opacity: savingProfile ? 0.7 : 1,
              }}
            >
              {savingProfile ? 'Saving…' : 'Save'}
            </button>
          ) : null
        }
      >
        <Field
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          placeholder="How you'll appear on slips"
          autoComplete="name"
        />
        <Field
          label="Email / sign-in"
          value={account.email}
          onChange={() => {}}
          helper="Sign-in identifier. Contact support to change."
        />
        <Field
          label="Phone number"
          value={phone}
          onChange={(v) => setPhone(v.includes('@') ? v : autoFormatPhoneInput(v))}
          placeholder={E164_PLACEHOLDER}
          autoComplete="tel"
          helper={!phone ? 'Used for MoMo withdrawals — must be in international format.' : null}
          error={phoneError}
        />
        <Row>
          <OddIcon name="info" size={16} color={T.inkSoft} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Country</span>
          <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>{account.country || '—'}</span>
        </Row>
      </Section>

      {/* Security */}
      <Section title="Security" subtitle="Protect your account">
        {pwOpen ? (
          <>
            <Field
              label="Current password"
              value={currentPw}
              onChange={setCurrentPw}
              type="password"
              autoComplete="current-password"
            />
            <Field
              label="New password"
              value={newPw}
              onChange={setNewPw}
              type="password"
              autoComplete="new-password"
              helper="At least 8 chars, with a digit and mixed case."
            />
            <Field
              label="Confirm new password"
              value={confirmPw}
              onChange={setConfirmPw}
              type="password"
              autoComplete="new-password"
              error={confirmPw && confirmPw !== newPw ? 'Does not match the new password.' : null}
            />
            <div style={{ display: 'flex', gap: 8, padding: '12px 14px' }}>
              <button
                type="button"
                onClick={submitPasswordChange}
                disabled={savingPw}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.greenBright,
                  color: T.goldDark,
                  fontWeight: 700,
                  fontSize: 13,
                  border: 0,
                  cursor: 'pointer',
                  opacity: savingPw ? 0.7 : 1,
                }}
              >
                {savingPw ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPwOpen(false);
                  setCurrentPw('');
                  setNewPw('');
                  setConfirmPw('');
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'transparent',
                  color: T.inkSoft,
                  border: `1px solid ${T.line}`,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <Row onClick={() => setPwOpen(true)}>
            <OddIcon name="lock" size={16} color={T.greenBright} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Change password</span>
            <OddIcon name="chevR" size={14} color={T.inkDim} />
          </Row>
        )}
        <Row>
          <OddIcon name="lock" size={16} color={T.inkSoft} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Two-factor authentication</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>Adds an extra layer on sign-in.</div>
          </div>
          <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>
            {account.twoFactorEnabled ? 'ON' : 'Coming soon'}
          </span>
        </Row>
        <Row>
          <OddIcon name="bolt" size={16} color={T.inkSoft} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Active sessions</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>Signed in here · 30-day access window.</div>
          </div>
        </Row>
      </Section>

      {/* Responsible gaming */}
      <Section title="Responsible gaming" subtitle="Stay in control">
        <ResponsibleGamingRow
          label="Daily deposit limit"
          field="dailyDepositLimit"
          value={account?.responsibleGaming?.dailyDepositLimit}
          refresh={refresh}
          toast={toast}
        />
        <ResponsibleGamingRow
          label="Weekly deposit limit"
          field="weeklyDepositLimit"
          value={account?.responsibleGaming?.weeklyDepositLimit}
          refresh={refresh}
          toast={toast}
        />
        <ResponsibleGamingRow
          label="Monthly deposit limit"
          field="monthlyDepositLimit"
          value={account?.responsibleGaming?.monthlyDepositLimit}
          refresh={refresh}
          toast={toast}
        />
        <Row onClick={() => navigate('/info#responsible')}>
          <OddIcon name="info" size={16} color={T.inkSoft} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Self-exclude</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
              Temporarily lock your account. Contact support to start.
            </div>
          </div>
          <OddIcon name="chevR" size={14} color={T.inkDim} />
        </Row>
      </Section>

      {/* Refer & earn */}
      <Section title="Refer & earn" subtitle="Invite friends, earn GHS 10 each">
        <Row>
          <OddIcon name="trophy" size={16} color={T.greenBright} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Your referral code</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: T.greenBright,
                letterSpacing: 3,
                fontFamily: '"JetBrains Mono", monospace',
                marginTop: 2,
              }}
            >
              {account.referralCode || (account.id || '').slice(0, 6).toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const code = account.referralCode || (account.id || '').slice(0, 6).toUpperCase();
              try {
                navigator.clipboard?.writeText(code);
                toast(`Copied ${code}.`, 'success');
              } catch {
                /* ignore */
              }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 12,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </Row>
        <Row>
          <OddIcon name="link" size={16} color={T.greenBright} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Your referral link</div>
            <div
              style={{
                fontSize: 11,
                color: T.inkSoft,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
              title={`https://oddsify.com/register?ref=${account.referralCode || (account.id || '').slice(0, 6).toUpperCase()}`}
            >
              oddsify.com/register?ref={account.referralCode || (account.id || '').slice(0, 6).toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const link = `https://oddsify.com/register?ref=${account.referralCode || (account.id || '').slice(0, 6).toUpperCase()}`;
              try {
                navigator.clipboard?.writeText(link);
                toast('Link copied.', 'success');
              } catch {
                /* ignore */
              }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'transparent',
              color: T.greenBright,
              border: `1px solid ${T.greenBright}44`,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </Row>
        <Row onClick={() => navigate('/refer')}>
          <OddIcon name="chevR" size={16} color={T.greenBright} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Refer & Earn dashboard</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
              Track referrals, earnings, and share your link.
            </div>
          </div>
          <OddIcon name="chevR" size={14} color={T.inkDim} />
        </Row>
      </Section>

      {/* Communication preferences */}
      <Section title="Communication preferences" subtitle="Choose how we reach you">
        <Toggle
          label="Email notifications"
          on={emailPref}
          onChange={(v) => {
            setEmailPref(v);
            saveCommsPrefs({ email: v, sms: smsPref, push: pushPref });
          }}
          helper="Receipts, security alerts, big wins."
        />
        <Toggle
          label="SMS notifications"
          on={smsPref}
          onChange={(v) => {
            setSmsPref(v);
            saveCommsPrefs({ email: emailPref, sms: v, push: pushPref });
          }}
          helper="MoMo deposit & withdrawal updates."
        />
        <Toggle
          label="Push notifications"
          on={pushPref}
          onChange={(v) => {
            setPushPref(v);
            saveCommsPrefs({ email: emailPref, sms: smsPref, push: v });
          }}
          helper="Live odds movement & bet settled alerts."
        />
      </Section>

      {/* Shortcuts */}
      <Section title="Shortcuts">
        {SHORTCUTS(counts).map((m, i, arr) => (
          <button
            key={m.label}
            type="button"
            onClick={() => navigate(m.to)}
            style={{
              width: '100%',
              padding: '14px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : 'none',
              color: T.ink,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: T.surfaceAlt,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OddIcon name={m.icon} size={16} color={T.greenBright} />
            </div>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600 }}>{m.label}</span>
            {m.detail && <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{m.detail}</span>}
            <OddIcon name="chevR" size={14} color={T.inkDim} />
          </button>
        ))}
      </Section>

      {/* Sign out + footer */}
      <div style={{ padding: '24px 16px 8px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={signOut}
          style={{
            padding: '10px 18px',
            borderRadius: 999,
            background: 'transparent',
            color: T.danger,
            border: `1px solid ${T.danger}33`,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
      <div style={{ padding: '0 16px 16px', textAlign: 'center', fontSize: 10.5, color: T.inkDim }}>
        Member since{' '}
        {account.createdAt
          ? new Date(account.createdAt).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
          : '—'}{' '}
        · Account ID:{' '}
        <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{(account.id || '').slice(0, 8)}</span>
      </div>
    </div>
  );
}

/* ─── responsible gaming inline editor row ─────────────── */

function ResponsibleGamingRow({ label, field, value, refresh, toast }) {
  const T = useTokens();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [busy, setBusy] = useState(false);

  const display = useMemo(() => (value > 0 ? `GHS ${fmtCedi(Number(value))}` : 'Not set'), [value]);

  async function save() {
    const n = Number(String(draft).replace(/[, ]/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      toast('Enter a valid amount (0 to disable).', 'warn');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ responsibleGaming: { [field]: n } });
      await refresh();
      toast(`${label} updated.`, 'success');
      setOpen(false);
    } catch (e) {
      toast(e?.body?.error || e?.message || 'Could not save limit.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Row onClick={() => setOpen(true)}>
        <OddIcon name="lock" size={16} color={T.inkSoft} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>{display}</span>
        <OddIcon name="chevR" size={14} color={T.inkDim} />
      </Row>
    );
  }
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4 }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="GHS 0 to disable"
          inputMode="decimal"
          style={{
            flex: 1,
            background: T.surfaceAlt,
            color: T.ink,
            fontSize: 14,
            fontWeight: 600,
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: '8px 10px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: T.greenBright,
            color: T.goldDark,
            fontWeight: 700,
            fontSize: 12,
            border: 0,
            cursor: 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft(String(value ?? ''));
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'transparent',
            color: T.inkSoft,
            border: `1px solid ${T.line}`,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
