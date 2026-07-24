import { useState } from 'react';
import { useToast, useAccount } from '../providers/AccountProvider.jsx';
import { submitTicket } from '../api/betApi.js';
import PageBack from '../components/PageBack.jsx';

export default function ContactPage() {
  const { toast } = useToast();
  const { account } = useAccount();
  const [name, setName] = useState('ODDSIFY');
  const [msg, setMsg] = useState('');
  const [topic, setTopic] = useState('Wallet');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !msg.trim()) return;
    setBusy(true);
    try {
      await submitTicket({ name: name.trim(), email: account?.email || '', topic, body: msg.trim() });
      toast(`Thanks, ${name}. A support agent will reply within 30 minutes.`);
      setMsg('');
    } catch (err) {
      toast(err.message || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-wrap" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
      <PageBack />
      <header className="page-head" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, letterSpacing: '-0.02em' }}>Contact us</h1>
        <p style={{ color: 'var(--text-soft)', marginTop: 6 }}>
          We reply to most messages within 30 minutes. Or email{' '}
          <a href="mailto:support@oddsify.gh" style={{ color: 'var(--accent)' }}>
            support@oddsify.gh
          </a>
          .
        </p>
      </header>

      <section
        style={{
          padding: 28,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
                placeholder="Kwame A."
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Topic</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} style={inputStyle}>
                <option>Wallet</option>
                <option>Bet settlement</option>
                <option>Account / KYC</option>
                <option>Bonus / promo</option>
                <option>Other</option>
              </select>
            </label>
          </div>
          <label style={fieldStyle}>
            <span style={labelStyle}>Message</span>
            <textarea
              rows={5}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              required
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Describe the issue. Include bet IDs or transaction references where possible."
            />
          </label>
          <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={busy}>
            {busy ? 'Sending…' : 'Send to support'}
          </button>
        </form>
      </section>
    </main>
  );
}

const fieldStyle = { display: 'grid', gap: 6 };
const labelStyle = {
  fontSize: 12,
  color: 'var(--text-soft)',
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
};
const inputStyle = {
  background: 'var(--bg-soft)',
  color: 'var(--text)',
  border: '1px solid var(--line-strong)',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
  outline: 'none',
};