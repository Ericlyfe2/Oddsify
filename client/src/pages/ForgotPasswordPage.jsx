import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../providers/AccountProvider.jsx';
import { parseIdentifier, autoFormatPhoneInput } from '../lib/phone.js';
import { fetchAuthConfig } from '../api/betApi.js';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => setErr('');

  const submit = async (e) => {
    e.preventDefault();
    reset();
    const trimmed = identifier.trim();
    if (!trimmed) { setErr('Enter your phone or email.'); return; }
    try {
      setBusy(true);
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Request failed.'); return; }
      setSent(true);
      toast('If an account exists, a reset code has been sent.', 'success');
    } catch (e) {
      setErr(e.message || 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="lp">
        <div className="lp-glow" />
        <div className="lp-brand">
          <span className="lp-brand-text">ODDSIFY</span>
        </div>
        <h1 className="lp-title">Check Your Phone or Email</h1>
        <div className="lp-form">
          <p style={{ textAlign: 'center', color: '#aaa', marginBottom: 16 }}>
            If an account exists for that phone or email, a reset code has been sent.
          </p>
          <Link to={`/reset-password?email=${encodeURIComponent(identifier)}`} className="lp-submit" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
            Enter Reset Code
          </Link>
          <Link to="/login" className="lp-toggle" style={{ textAlign: 'center', display: 'block', marginTop: 12 }}>
            Back to Login
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
      <h1 className="lp-title">Reset Your Password</h1>
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
            autoFocus
          />
        </div>
        <p className="lp-hint">Enter the phone number or email you registered with.</p>
        {err && <div className="lp-error" aria-live="polite">{err}</div>}
        <button type="submit" className="lp-submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send Reset Code'}
        </button>
        <Link to="/login" className="lp-toggle" style={{ textAlign: 'center', display: 'block', marginTop: 12 }}>
          Back to Login
        </Link>
      </form>
    </div>
  );
}
