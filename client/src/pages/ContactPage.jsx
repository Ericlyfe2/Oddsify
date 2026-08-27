import { useState, useEffect, useCallback } from 'react';
import { useToast, useAccount } from '../providers/AccountProvider.jsx';
import { submitTicket, fetchMyTickets, replyToTicket } from '../api/betApi.js';
import { onLive } from '../api/socketClient.js';
import PageBack from '../components/PageBack.jsx';

function ago(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Phone-registered accounts store their phone number in `account.email`
// (see server resolveIdentifier) — only forward it to the ticket API when
// it actually looks like an email, otherwise the server's email validation
// rejects the request with a 400.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const { toast } = useToast();
  const { account } = useAccount();
  const [name, setName] = useState('BETNEXA');
  const [msg, setMsg] = useState('');
  const [topic, setTopic] = useState('Wallet');
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyBusy, setReplyBusy] = useState(null);

  const loadTickets = useCallback(async () => {
    if (!account) return;
    setLoadingTickets(true);
    try {
      const { tickets: list } = await fetchMyTickets();
      setTickets(list || []);
    } catch {
      /* ignore — inbox is best-effort */
    } finally {
      setLoadingTickets(false);
    }
  }, [account]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Live-refresh the thread the moment an admin replies, instead of making
  // the user leave the page and come back to see it.
  useEffect(() => {
    if (!account) return undefined;
    const off = onLive('support:reply', () => loadTickets());
    return () => off?.();
  }, [account, loadTickets]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !msg.trim()) return;
    setBusy(true);
    try {
      const email = EMAIL_RE.test(account?.email || '') ? account.email : '';
      await submitTicket({ name: name.trim(), email, topic, body: msg.trim() });
      toast(`Thanks, ${name}. A support agent will reply within 30 minutes.`);
      setMsg('');
      loadTickets();
    } catch (err) {
      toast(err.message || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (ticketId) => {
    const body = (replyDrafts[ticketId] || '').trim();
    if (!body) return;
    setReplyBusy(ticketId);
    try {
      await replyToTicket(ticketId, body);
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      loadTickets();
    } catch (err) {
      toast(err.message || 'Could not send reply.');
    } finally {
      setReplyBusy(null);
    }
  };

  return (
    <main className="page-wrap" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
      <PageBack />
      <header className="page-head" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, letterSpacing: '-0.02em' }}>Contact us</h1>
        <p style={{ color: 'var(--text-soft)', marginTop: 6 }}>
          We reply to most messages within 30 minutes. Or email{' '}
          <a href="mailto:support@betnexa.gh" style={{ color: 'var(--accent)' }}>
            support@betnexa.gh
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

      {account && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Your messages</h2>
          {loadingTickets && tickets.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
          ) : tickets.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              No messages yet. Anything you send above will show up here, along with replies from support.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-lg)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{t.topic}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color:
                          t.status === 'closed'
                            ? 'var(--text-dim)'
                            : t.status === 'pending'
                              ? 'var(--accent-warm)'
                              : 'var(--accent)',
                      }}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{t.body}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ago(t.createdAt)}</div>

                    {(t.replies || []).map((r, i) => (
                      <div
                        key={i}
                        style={{
                          marginLeft: r.role === 'admin' ? 0 : 20,
                          background:
                            r.role === 'admin'
                              ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
                              : 'var(--bg-soft)',
                          border: '1px solid var(--line)',
                          borderRadius: 10,
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                          {r.role === 'admin' ? 'Support' : 'You'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>{r.body}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{ago(r.at)}</div>
                      </div>
                    ))}
                  </div>

                  {t.status !== 'closed' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <input
                        value={replyDrafts[t.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sendReply(t.id);
                        }}
                        placeholder="Reply…"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={replyBusy === t.id || !(replyDrafts[t.id] || '').trim()}
                        onClick={() => sendReply(t.id)}
                      >
                        {replyBusy === t.id ? '…' : 'Send'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
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