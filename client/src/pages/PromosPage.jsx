import { useEffect, useState } from 'react';
import { fetchPromotions } from '../api/betApi.js';
import { useToast, useAccount } from '../layout/AppShell.jsx';

export default function PromosPage() {
  const { toast } = useToast();
  const { account } = useAccount();
  const [promos, setPromos] = useState([]);
  const [claimed, setClaimed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bv_claimed') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    fetchPromotions().then((d) => setPromos(d.promotions || [])).catch(() => {});
  }, []);

  const claim = (p) => {
    if (!account) { toast('Sign in to claim promotions.'); return; }
    if (claimed.includes(p.id)) { toast('Already claimed.'); return; }
    const next = [...claimed, p.id];
    setClaimed(next);
    localStorage.setItem('bv_claimed', JSON.stringify(next));
    toast(`${p.title} activated — see your account for details.`);
  };

  return (
    <main className="page-wrap">
      <div className="page-head">
        <p className="eyebrow">PROMOTIONS</p>
        <h1>Boosts, bonuses, cashback.</h1>
        <p className="lede">Live offers for new and existing customers — claim once and they apply automatically.</p>
      </div>

      <div className="promos-grid">
        {promos.map((p) => {
          const isClaimed = claimed.includes(p.id);
          return (
            <article key={p.id} className="promo-card">
              <div className="promo-tag-2">{p.tag}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <div className="promo-meta">Expires: {p.expires}</div>
              <button
                type="button"
                className={`btn ${isClaimed ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => claim(p)}
                disabled={isClaimed}
              >{isClaimed ? '✓ Claimed' : p.cta}</button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
