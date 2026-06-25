import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  login,
  register,
  fetchAuthConfig,
  googleSignIn,
  recordReferralClick,
  validateReferralCode,
} from '../api/betApi.js';
import { setAdminTokens } from '../api/adminApi.js';
import { useAccount, useToast } from '../providers/AccountProvider.jsx';
import { COUNTRIES, countryByCode } from '../data/countries.js';
import { parseIdentifier, autoFormatPhoneInput, E164_PLACEHOLDER } from '../lib/phone.js';
import { getDeviceId } from '../lib/device.js';

function EyeIcon({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.58 19.58 0 0 1 4.22-5.36" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function safePath(raw, fallback = '/') {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { account, signIn, signOut } = useAccount();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const next = safePath(params.get('next'), '/');
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [country, setCountry] = useState('GH');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [authConfig, setAuthConfig] = useState({ googleEnabled: false, googleClientId: null });
  const [refInfo, setRefInfo] = useState(null);
  const [refCodeInput, setRefCodeInput] = useState('');
  const [refState, setRefState] = useState('idle');
  const [countryOpen, setCountryOpen] = useState(false);

  const selectedCountry = countryByCode(country);
  const dialCode = selectedCountry?.dial || '+233';

  useEffect(() => {
    const fromUrl = (params.get('ref') || '').trim().toUpperCase();
    if (fromUrl) {
      try { localStorage.setItem('oddsify_ref', fromUrl); } catch {}
      recordReferralClick(fromUrl).catch(() => {});
    }
    const code = fromUrl || (() => {
      try { return localStorage.getItem('oddsify_ref') || ''; } catch { return ''; }
    })();
    if (!code) return;
    validateReferralCode(code)
      .then((r) => {
        if (r?.valid) {
          setRefInfo({ code, referrerName: r.referrerName });
          setRefCodeInput(code);
          setRefState('valid');
        } else localStorage.removeItem('oddsify_ref');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const code = refCodeInput.trim().toUpperCase();
    if (!code) {
      setRefState('idle');
      if (refInfo) {
        setRefInfo(null);
        try { localStorage.removeItem('oddsify_ref'); } catch {}
      }
      return undefined;
    }
    if (refInfo?.code === code) { setRefState('valid'); return undefined; }
    setRefState('checking');
    const t = setTimeout(() => {
      validateReferralCode(code)
        .then((r) => {
          if (r?.valid) {
            setRefInfo({ code, referrerName: r.referrerName });
            setRefState('valid');
            try { localStorage.setItem('oddsify_ref', code); } catch {}
          } else {
            setRefInfo(null);
            setRefState('invalid');
            try { localStorage.removeItem('oddsify_ref'); } catch {}
          }
        })
        .catch(() => setRefState('idle'));
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCodeInput]);

  useEffect(() => {
    if (params.get('logout') === '1') signOut();
    const token = params.get('token');
    if (token) {
      signIn({ accessToken: token });
      navigate(safePath(params.get('redirect'), next), { replace: true });
      return;
    }
    if (account) navigate(next, { replace: true });
    fetchAuthConfig().then(setAuthConfig).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authConfig.googleEnabled) return;
    const id = 'gsi-script';
    if (document.getElementById(id)) { renderGoogle(); return; }
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = renderGoogle;
    document.head.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authConfig]);

  function renderGoogle() {
    const g = window.google;
    if (!g?.accounts?.id) return;
    g.accounts.id.initialize({
      client_id: authConfig.googleClientId,
      callback: async ({ credential }) => {
        try {
          setBusy(true);
          let refCode = refInfo?.code || null;
          if (!refCode) {
            try { refCode = localStorage.getItem('oddsify_ref') || null; } catch {}
          }
          const data = await googleSignIn(credential, country, {
            ...(refCode ? { referralCode: refCode } : {}),
            ...(getDeviceId() ? { deviceId: getDeviceId() } : {}),
          });
          try { localStorage.removeItem('oddsify_ref'); } catch {}
          signIn(data);
          navigate('/', { replace: true });
        } catch (e) {
          setErr(e.message || 'Google sign-in failed.');
        } finally {
          setBusy(false);
        }
      },
    });
    const target = document.getElementById('google-btn-mount');
    if (target) {
      target.innerHTML = '';
      g.accounts.id.renderButton(target, { theme: 'filled_black', size: 'large', shape: 'rectangular', width: 200 });
    }
  }

  const parsedId = useMemo(() => parseIdentifier(identifier), [identifier]);
  const isEmail = parsedId.kind === 'email';
  const isPhone = parsedId.kind === 'phone';
  const idValid = isEmail || isPhone;

  const pwStrength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^\w]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const reset = () => setErr('');

  const parsedPhone = useMemo(() => parseIdentifier(phone), [phone]);
  const regIsEmail = parsedPhone.kind === 'email';
  const regIsPhone = parsedPhone.kind === 'phone';
  const regIdValid = regIsEmail || regIsPhone;

  const validate = () => {
    if (mode === 'register') {
      if (!firstName.trim()) return 'Enter your first name.';
      if (!lastName.trim()) return 'Enter your last name.';
      if (!phone.trim()) return 'Enter your phone or email.';
      if (!regIdValid) return parsedPhone.error?.message || 'Enter a valid email or phone.';
      if (!password) return 'Enter your password.';
      if (!country) return 'Select your country.';
      if (password.length < 8) return 'Password must be at least 8 characters.';
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) return 'Password must mix upper- and lower-case letters.';
      if (!/\d/.test(password)) return 'Password must include a digit.';
      if (password !== confirm) return "Passwords don't match.";
      if (!agree) return 'Accept the terms to create an account.';
      if (refCodeInput.trim() && refState === 'invalid') return 'That referral code isn\'t valid — correct it or clear the field.';
      return null;
    }
    if (!identifier.trim()) return 'Enter your phone or email.';
    if (!idValid) return parsedId.error?.message || 'Enter a valid email or phone.';
    if (!password) return 'Enter your password.';
    if (!country) return 'Select your country.';
    return null;
  };

  function routeAfterLogin(data) {
    if (data.kind === 'admin') {
      setAdminTokens(data.accessToken, data.refreshToken);
      const target = next && next.startsWith('/admin') ? next : '/admin';
      toast(`Signed in as ${data.admin?.displayName || data.admin?.email} — opening admin panel.`);
      navigate(target, { replace: true });
      return;
    }
    signIn(data);
    navigate(next.startsWith('/admin') ? '/' : next, { replace: true });
  }

  const submit = async (e) => {
    e.preventDefault();
    reset();
    const v = validate();
    if (v) { setErr(v); return; }
    try {
      setBusy(true);
      if (mode === 'register') {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        const idValue = parsedPhone.value;
        const data = await register({
          email: idValue,
          password,
          displayName: fullName || idValue,
          country,
          ...(refInfo?.code ? { referralCode: refInfo.code } : {}),
          ...(getDeviceId() ? { deviceId: getDeviceId() } : {}),
        });
        try { localStorage.removeItem('oddsify_ref'); } catch {}
        const storedId = data.account?.email || idValue;
        toast(`Account created. Sign in next time with ${storedId} — write it down.`, 'success', { ttl: 12000 });
        routeAfterLogin(data);
      } else {
        const data = await login({ email: identifier.trim(), password, country });
        routeAfterLogin(data);
      }
    } catch (e) {
      setErr(e.message || (mode === 'signin' ? 'Sign in failed.' : 'Sign up failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp">
      <div className="lp-glow" />

      <div className="lp-brand">
        <span className="lp-brand-text">ODDSIFY</span>
      </div>

      <h1 className="lp-title">
        {mode === 'signin' ? 'Log In to Oddsify' : 'Sign Up for Oddsify'}
      </h1>

      <form className="lp-form" onSubmit={submit} noValidate>
        {/* Country selector */}
        <div className="lp-country-wrap">
          <button
            type="button"
            className="lp-country-btn"
            onClick={() => setCountryOpen((v) => !v)}
          >
            <span className="lp-country-flag">{selectedCountry?.flag || '🏳️'}</span>
            <span className="lp-country-name">
              {selectedCountry ? `${selectedCountry.name} (${dialCode})` : 'Select country'}
            </span>
            <svg className="lp-country-caret" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {countryOpen && (
            <div className="lp-country-drop">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`lp-country-opt${c.code === country ? ' active' : ''}`}
                  onClick={() => { setCountry(c.code); setCountryOpen(false); }}
                >
                  <span className="lp-country-flag">{c.flag}</span>
                  <span>{c.name} ({c.dial})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'register' && (
          <>
            <div className="lp-row-2">
              <div className="lp-field">
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="lp-field">
                <input
                  type="text"
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Phone field with dial code */}
        <div className="lp-field lp-phone-field">
          <span className="lp-dial-badge">{dialCode}</span>
          <input
            type="text"
            inputMode="tel"
            autoComplete={mode === 'signin' ? 'username' : 'tel'}
            placeholder="Phone Number"
            value={mode === 'signin' ? identifier : phone}
            onChange={(e) => {
              const raw = e.target.value;
              const formatted = raw.includes('@') ? raw : autoFormatPhoneInput(raw);
              mode === 'signin' ? setIdentifier(formatted) : setPhone(formatted);
            }}
            autoFocus
          />
        </div>
        {mode === 'signin' && identifier && parsedId.error && (
          <p className="lp-err-hint">{parsedId.error.message}</p>
        )}
        {mode === 'register' && phone && parsedPhone.error && (
          <p className="lp-err-hint">{parsedPhone.error.message}</p>
        )}

        {/* Password */}
        <div className="lp-field">
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="lp-eye"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPw} />
          </button>
        </div>

        {mode === 'register' && (
          <>
            <div className="lp-pw-strength">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`lp-pw-bar${pwStrength >= i ? ' filled' : ''}`}
                  data-level={pwStrength} />
              ))}
              <span className="lp-pw-label">
                {['', 'Weak', 'Okay', 'Strong', 'Excellent'][pwStrength] || ''}
              </span>
            </div>

            <div className="lp-field">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <div className="lp-field">
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Referral code (optional)"
                value={refCodeInput}
                onChange={(e) => setRefCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}
              />
              {refState === 'checking' && <span className="lp-ref-status">…</span>}
              {refState === 'valid' && <span className="lp-ref-status valid">✓</span>}
            </div>
            {refState === 'valid' && refInfo && (
              <p className="lp-ref-msg">
                🎁 Invited by <strong>{refInfo.referrerName}</strong>
              </p>
            )}
            {refState === 'invalid' && <p className="lp-err-hint">This referral code isn&rsquo;t valid.</p>}
          </>
        )}

        {mode === 'register' && (
          <label className="lp-check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I am 18+ and accept the{' '}
              <Link className="lp-link" to="/info#terms" target="_blank" rel="noopener noreferrer">Terms</Link>
              {' '}and{' '}
              <Link className="lp-link" to="/info#responsible-gaming" target="_blank" rel="noopener noreferrer">Responsible Gaming Policy</Link>
            </span>
          </label>
        )}

        {err && <div className="lp-error" aria-live="polite">{err}</div>}

        <button type="submit" className="lp-submit" disabled={busy}>
          {busy
            ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
            : (mode === 'signin' ? 'Login' : 'Sign Up')}
        </button>

        {/* Toggle mode */}
        <button
          type="button"
          className="lp-toggle"
          onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); reset(); }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>

        {/* Google sign in */}
        {authConfig.googleEnabled && (
          <>
            <div className="lp-divider"><span>or</span></div>
            <div id="google-btn-mount" style={{ display: 'flex', justifyContent: 'center' }} />
          </>
        )}

        <p className="lp-terms">
          By {mode === 'signin' ? 'logging in' : 'signing up'}, you agree to our{' '}
          <Link className="lp-link" to="/info#terms">Terms &amp; Conditions</Link> and
          confirm that you are at least 18 yrs old.
        </p>
      </form>
    </div>
  );
}
