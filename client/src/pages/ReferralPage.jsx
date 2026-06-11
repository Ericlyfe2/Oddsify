/**
 * Refer & Earn dashboard — black & gold design system.
 * Code + link sharing, live stats, referral history, and a celebration
 * overlay when a reward lands in real time (socket `referral:rewarded`).
 */
import { useEffect, useState, useCallback } from 'react';
import { fetchReferralInfo } from '../api/betApi.js';
import { onLive } from '../api/socketClient.js';
import { useToast } from '../providers/AccountProvider.jsx';
import PageBack from '../components/PageBack.jsx';

const GOLD = '#f7c948';
const CREAM = '#f3e9cf';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SHARE_TARGETS = (link, msg) => [
  { label: 'WhatsApp', icon: '🟢', href: `https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}` },
  { label: 'Telegram', icon: '✈️', href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}` },
  { label: 'Facebook', icon: '📘', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  { label: 'X', icon: '𝕏', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${msg} ${link}`)}` },
  { label: 'Email', icon: '✉️', href: `mailto:?subject=${encodeURIComponent('Join me on Oddsify')}&body=${encodeURIComponent(`${msg}\n\n${link}`)}` },
];

const STATUS_STYLE = {
  pending: { label: 'Pending', color: '#f0a040', bg: 'rgba(240,160,64,.12)' },
  qualified: { label: 'Qualified', color: GOLD, bg: 'rgba(232,185,74,.12)' },
  rewarded: { label: 'Rewarded', color: GOLD, bg: 'rgba(232,185,74,.18)' },
  rejected: { label: 'Rejected', color: '#ff5b78', bg: 'rgba(255,91,120,.12)' },
  reversed: { label: 'Reversed', color: '#ff5b78', bg: 'rgba(255,91,120,.12)' },
};

export default function ReferralPage() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [celebrate, setCelebrate] = useState(null); // { amount, referredName }

  const load = useCallback(() => {
    fetchReferralInfo()
      .then((d) => {
        setData(d);
        setErr('');
      })
      .catch((e) => setErr(e.message || 'Failed to load referral info.'));
  }, []);

  useEffect(() => {
    load();
    const offUpdate = onLive('referral:update', load);
    const offReward = onLive('referral:rewarded', (payload) => {
      load();
      setCelebrate({ amount: payload?.amount || 0, referredName: payload?.referredName || 'your referral' });
    });
    return () => {
      offUpdate?.();
      offReward?.();
    };
  }, [load]);

  const copy = (text, what) => {
    try {
      navigator.clipboard?.writeText(text);
      toast(`${what} copied.`, 'success');
    } catch {
      toast('Copy failed — long-press to copy manually.', 'warn');
    }
  };

  const shareMsg = 'Join Oddsify using my referral link and start winning today!';
  const link = data?.link || '';

  const stats = data?.stats || {};
  const statCards = [
    ['Total referrals', stats.total ?? '—'],
    ['Pending', stats.pending ?? '—'],
    ['Qualified', stats.qualified ?? '—'],
    ['Link clicks', stats.clicks ?? '—'],
    ['Total earned', `GHS ${fmt(stats.totalEarned)}`],
    ['Conversion', `${stats.conversionRate ?? 0}%`],
  ];

  return (
    <div className="rfp-page">
      <div style={{ padding: '12px 0 0' }}>
        <PageBack fallback="/profile" />
      </div>

      <header className="rfp-head">
        <span className="rfp-badge">REFER &amp; EARN</span>
        <h1 className="rfp-title">Invite friends, earn gold.</h1>
        <p className="rfp-sub">
          Get <strong>GHS {fmt(data?.rewardPerReferral ?? 10)}</strong> for every friend who signs up with your code and
          makes a first deposit of GHS {fmt(data?.minDeposit ?? 100)}+.
        </p>
      </header>

      {err && <div className="rfp-err">{err}</div>}

      {/* Code + link card */}
      <section className="rfp-card rfp-hero">
        <div className="rfp-lbl">Your referral code</div>
        <div className="rfp-code-row">
          <span className="rfp-code">{data?.code || '······'}</span>
          <button type="button" className="rfp-btn rfp-btn-gold" onClick={() => copy(data?.code || '', 'Code')}>
            Copy code
          </button>
        </div>
        <div className="rfp-lbl" style={{ marginTop: 14 }}>
          Your referral link
        </div>
        <div className="rfp-link-row">
          <span className="rfp-link" title={link}>
            {link || '—'}
          </span>
          <button type="button" className="rfp-btn rfp-btn-ghost" onClick={() => copy(link, 'Link')}>
            Copy
          </button>
        </div>

        <div className="rfp-share">
          {SHARE_TARGETS(link, shareMsg).map((t) => (
            <a key={t.label} className="rfp-share-btn" href={t.href} target="_blank" rel="noreferrer">
              <span aria-hidden>{t.icon}</span> {t.label}
            </a>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="rfp-stats">
        {statCards.map(([lbl, val], i) => (
          <div key={lbl} className="rfp-stat" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
            <span className="rfp-stat-lbl">{lbl}</span>
            <span className="rfp-stat-val">{val}</span>
          </div>
        ))}
      </section>

      {/* History */}
      <section className="rfp-card">
        <div className="rfp-lbl" style={{ marginBottom: 10 }}>
          Referral history
        </div>
        {!data ? (
          <div className="rfp-empty">Loading…</div>
        ) : data.history.length === 0 ? (
          <div className="rfp-empty">
            No referrals yet. Share your link — your first GHS {fmt(data.rewardPerReferral)} is waiting.
          </div>
        ) : (
          <div className="rfp-history">
            {data.history.map((h) => {
              const st = STATUS_STYLE[h.status] || STATUS_STYLE.pending;
              return (
                <div key={h.id} className="rfp-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rfp-row-name">{h.name}</div>
                    <div className="rfp-row-meta">
                      {new Date(h.registeredAt).toLocaleDateString('en-GH')} · {h.verified ? 'Verified' : 'Unverified'}{' '}
                      · {h.deposited ? 'Deposited' : 'No deposit yet'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="rfp-status" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                    {h.rewardAmount != null && <div className="rfp-row-amt">+GHS {fmt(h.rewardAmount)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Celebration overlay */}
      {celebrate && (
        <div className="rfp-celebrate" onClick={() => setCelebrate(null)} role="alertdialog" aria-modal="true">
          <div className="rfp-confetti" aria-hidden>
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                style={{
                  '--x': `${Math.random() * 100}%`,
                  '--d': `${Math.random() * 1.4}s`,
                  '--c': ['#f7c948', '#e8b94a', '#fff3b8', '#d4a72c', '#f3e9cf'][i % 5],
                  '--tx': `${-40 + Math.random() * 80}px`,
                }}
              />
            ))}
          </div>
          <div className="rfp-celebrate-card" onClick={(e) => e.stopPropagation()}>
            <div className="rfp-check" aria-hidden>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" />
                <path d="M38 62l14 14 30-32" />
              </svg>
            </div>
            <h2>Congratulations!</h2>
            <p>
              You earned <strong>GHS {fmt(celebrate.amount)}</strong> from {celebrate.referredName}. It's already in
              your wallet.
            </p>
            <button type="button" className="rfp-btn rfp-btn-gold" onClick={() => setCelebrate(null)}>
              Keep earning
            </button>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
@keyframes rfpUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rfpShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes rfpFall { 0% { transform: translate(0,-20px) rotate(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(var(--tx,20px),110vh) rotate(720deg); opacity: 0; } }
@keyframes rfpPop { 0% { transform: scale(.85) translateY(16px); opacity: 0; } 60% { transform: scale(1.02); opacity: 1; } 100% { transform: scale(1); } }
@keyframes rfpRing { 0% { stroke-dashoffset: 340; } 100% { stroke-dashoffset: 0; } }
@keyframes rfpCheck { 0% { stroke-dashoffset: 120; } 100% { stroke-dashoffset: 0; } }
@keyframes rfpGlow { 0%,100% { box-shadow: 0 0 0 1px rgba(232,185,74,.2) inset, 0 0 20px rgba(232,185,74,.04); } 50% { box-shadow: 0 0 0 1px rgba(247,201,72,.4) inset, 0 0 36px rgba(232,185,74,.1); } }

.rfp-page { max-width: 480px; margin: 0 auto; padding: 0 16px 90px; color: ${CREAM}; font-family: inherit; }
.rfp-head { text-align: left; margin: 14px 0 16px; animation: rfpUp .4s ease both; }
.rfp-badge { font-size: 10px; letter-spacing: .18em; font-weight: 800; color: ${GOLD}; background: rgba(232,185,74,.1); border: 1px solid rgba(232,185,74,.35); padding: 5px 10px; border-radius: 999px; }
.rfp-title { margin: 12px 0 6px; font-size: 26px; font-weight: 900; background: linear-gradient(110deg, #e8b94a 25%, #fff7d6 50%, #e8b94a 75%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: rfpShimmer 3s linear 1s infinite; }
.rfp-sub { margin: 0; font-size: 13px; color: rgba(243,233,207,.7); }
.rfp-sub strong { color: ${GOLD}; }

.rfp-err { background: rgba(255,91,120,.1); border: 1px solid rgba(255,91,120,.3); color: #ff5b78; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 12px; }

.rfp-card { background: radial-gradient(360px 140px at 80% -10%, rgba(232,185,74,.1), transparent 60%), linear-gradient(180deg, #161513 0%, #0f0e0c 100%); border-radius: 18px; padding: 16px; margin-bottom: 14px; box-shadow: 0 0 0 1px rgba(232,185,74,.15) inset; animation: rfpUp .4s ease .1s both; }
.rfp-hero { animation: rfpUp .4s ease .1s both, rfpGlow 3s ease-in-out 1s infinite; }
.rfp-lbl { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: rgba(243,233,207,.45); font-weight: 700; }

.rfp-code-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.rfp-code { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: .14em; color: ${GOLD}; }
.rfp-link-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.rfp-link { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: rgba(243,233,207,.75); }

.rfp-btn { padding: 10px 14px; border-radius: 10px; border: none; font-weight: 800; font-size: 12.5px; cursor: pointer; font-family: inherit; transition: transform .12s, background .15s; }
.rfp-btn:active { transform: scale(.97); }
.rfp-btn-gold { background: linear-gradient(135deg, #f7c948 0%, #d4a72c 100%); color: #1a1300; box-shadow: 0 8px 20px rgba(232,185,74,.3); }
.rfp-btn-ghost { background: rgba(232,185,74,.06); color: ${CREAM}; border: 1px solid rgba(232,185,74,.2); }

.rfp-share { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.rfp-share-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; background: rgba(232,185,74,.06); border: 1px solid rgba(232,185,74,.2); color: ${CREAM}; font-size: 12px; font-weight: 700; text-decoration: none; transition: background .15s, border-color .15s; }
.rfp-share-btn:hover { background: rgba(232,185,74,.14); border-color: rgba(232,185,74,.4); }

.rfp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.rfp-stat { background: rgba(232,185,74,.05); border: 1px solid rgba(232,185,74,.1); border-radius: 12px; padding: 12px 10px; display: flex; flex-direction: column; gap: 4px; animation: rfpUp .4s ease both; }
.rfp-stat-lbl { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: rgba(243,233,207,.45); }
.rfp-stat-val { font-size: 16px; font-weight: 800; color: ${GOLD}; font-variant-numeric: tabular-nums; }

.rfp-history { display: flex; flex-direction: column; gap: 8px; }
.rfp-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(232,185,74,.04); border: 1px solid rgba(232,185,74,.08); }
.rfp-row-name { font-size: 13.5px; font-weight: 700; }
.rfp-row-meta { font-size: 11px; color: rgba(243,233,207,.5); margin-top: 2px; }
.rfp-status { font-size: 10px; font-weight: 800; letter-spacing: .08em; padding: 4px 9px; border-radius: 999px; }
.rfp-row-amt { font-size: 12.5px; font-weight: 800; color: ${GOLD}; margin-top: 4px; font-variant-numeric: tabular-nums; }
.rfp-empty { font-size: 13px; color: rgba(243,233,207,.55); padding: 14px 0; text-align: center; }

.rfp-celebrate { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(10,8,2,.78); backdrop-filter: blur(6px); overflow: hidden; }
.rfp-confetti { position: absolute; inset: 0; pointer-events: none; }
.rfp-confetti span { position: absolute; top: -16px; left: var(--x); width: 8px; height: 12px; border-radius: 2px; background: var(--c); animation: rfpFall 2.6s linear var(--d) both; }
.rfp-celebrate-card { position: relative; width: min(340px, 100%); text-align: center; background: linear-gradient(180deg, #161513 0%, #0a0a0a 100%); border-radius: 20px; padding: 26px 22px; box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(232,185,74,.25) inset; animation: rfpPop .45s cubic-bezier(.18,.88,.36,1.2) both; }
.rfp-celebrate-card h2 { margin: 12px 0 6px; font-size: 24px; font-weight: 900; color: ${CREAM}; }
.rfp-celebrate-card p { margin: 0 0 18px; font-size: 13.5px; color: rgba(243,233,207,.7); }
.rfp-celebrate-card p strong { color: ${GOLD}; }
.rfp-check { width: 84px; height: 84px; margin: 0 auto; }
.rfp-check svg { width: 100%; height: 100%; }
.rfp-check circle { fill: none; stroke: ${GOLD}; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 340; transform: rotate(-90deg); transform-origin: center; animation: rfpRing .7s ease-out .1s both; }
.rfp-check path { fill: none; stroke: ${GOLD}; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 120; stroke-dashoffset: 120; animation: rfpCheck .5s ease-out .5s both; }

@media (min-width: 768px) { .rfp-page { max-width: 560px; } .rfp-title { font-size: 30px; } }
`;
