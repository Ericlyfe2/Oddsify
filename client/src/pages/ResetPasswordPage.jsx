import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../providers/AccountProvider.jsx';
import { autoFormatPhoneInput } from '../lib/phone.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => setErr('');

  const submit = async (e) => {
    e.preventDefault();
    reset();
    if (!identifier.trim()) { setErr('Enter your phone or email.'); return; }
    if (!code.trim()) { setErr('Enter the reset code.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    try {
      setBusy(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim(), code: code.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Reset failed.'); return; }
      setDone(true);
      toast('Password reset successfully. Sign in with your new password.', 'success');
    } catch (e) {
      setErr(e.message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="lp">
        <div className="lp-glow" />
        <div className="lp-brand">
          <span className="lp-brand-text">ODDSIFY</span>
        </div>
        <h1 className="lp-title">Password Reset</h1>
        <div className="lp-form">
          <p style={{ textAlign: 'center', color: '#aaa', marginBottom: 16 }}>
            Your password has been reset successfully.
          </p>
          <Link to="/login" className="lp-submit" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lp">
      <div className="lp-glow" />
      <div className="lp-brand">
        <span className="lp-brand-text">ODDSIFY</span>
      </div>
      <h1 className="lp-title">Enter Reset Code</h1>
      <form className="lp-form" onSubmit={submit} noValidate>
        <div className="lp-field">
          <input
            type="text"
            inputMode="tel"
            autoComplete="username"
            placeholder="Phone number or email"
            value={identifier}
            onChange={(e) => {
              const raw = e.target.value;
              setIdentifier(raw.includes('@') ? raw : autoFormatPhoneInput(raw));
            }}
          />
        </div>
        <div className="lp-field">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit reset code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />
        </div>
        <div className="lp-field">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="lp-field">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {err && <div className="lp-error" aria-live="polite">{err}</div>}
        <button type="submit" className="lp-submit" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset Password'}
        </button>
        <Link to="/login" className="lp-toggle" style={{ textAlign: 'center', display: 'block', marginTop: 12 }}>
          Back to Login
        </Link>
      </form>
    </div>
  );
}
