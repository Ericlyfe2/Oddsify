import { useEffect, useState } from 'react';
import { fetchJackpot, enterJackpot } from '../api/betApi.js';
import { useToast, useAccount } from '../layout/AppShell.jsx';

function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JackpotPage() {
  const { toast } = useToast();
  const { account, adjustBalance } = useAccount();
  const [jackpot, setJackpot] = useState(null);
  const [picks, setPicks] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJackpot().then((d) => setJackpot(d.jackpot)).catch(() => {});
  }, []);

  if (!jackpot) return <main className="page-wrap"><p style={{ color: 'var(--text-dim)' }}>Loading jackpot…</p></main>;

  const completed = jackpot.legs.filter((l) => picks[l.id]).length;
  const allPicked = completed === jackpot.legs.length;

  const autoFill = () => {
    const next = {};
    for (const leg of jackpot.legs) {
      next[leg.id] = leg.outcomes[Math.floor(Math.random() * leg.outcomes.length)];
    }
    setPicks(next);
    toast('Auto-pick complete — review or submit.');
  };

  const submit = async () => {
    if (!allPicked) { toast(`Pick all ${jackpot.legs.length} legs to enter.`); return; }
    if (!account) { toast('Sign in to enter the jackpot.'); return; }
    if (account.balance < jackpot.entryFee) { toast('Top up — entry fee is GHS ' + jackpot.entryFee); return; }
    try {
      setSubmitting(true);
      const res = await enterJackpot(picks);
      adjustBalance(-jackpot.entryFee, `Jackpot entry confirmed · ${res.entry.id.slice(-6)}`);
      setPicks({});
    } catch (e) {
      toast(e.message || 'Could not enter jackpot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-wrap">
      <div className="page-head">
        <p className="eyebrow">JACKPOT</p>
        <h1>{jackpot.name}</h1>
        <div className="jackpot-pool">
          <div className="pool-amount">GHS {formatAmt(jackpot.pool)}</div>
          <div className="pool-meta">Draws in {jackpot.drawsIn} · entry GHS {jackpot.entryFee}</div>
        </div>
      </div>

      <div className="page-toolbar">
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          {completed}/{jackpot.legs.length} legs picked
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setPicks({})}>Clear</button>
          <button type="button" className="btn btn-ghost" onClick={autoFill}>Auto-pick</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Entering…' : `Enter · GHS ${jackpot.entryFee}`}
          </button>
        </div>
      </div>

      <div className="jackpot-list">
        {jackpot.legs.map((leg, i) => (
          <div key={leg.id} className={`jackpot-leg${picks[leg.id] ? ' picked' : ''}`}>
            <div className="leg-num">{(i + 1).toString().padStart(2, '0')}</div>
            <div className="leg-fix">{leg.fixture}</div>
            <div className="leg-pick">
              {leg.outcomes.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`odd-btn${picks[leg.id] === o ? ' selected' : ''}`}
                  onClick={() => setPicks((p) => ({ ...p, [leg.id]: p[leg.id] === o ? null : o }))}
                  style={{ minWidth: 50 }}
                >
                  <span className="ol">{o}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
