/**
 * Ambient app-wide motion ported from zentrixbet.com, recoloured to Oddsify
 * tokens. All mount once in AppShell so they ride along the user app only
 * (never /login or /admin).
 *
 *  - OddSupportBubble    → floating help bubble, gentle bounce (supportSlowBounce).
 *  - OddWithdrawNotices  → periodic center-top social-proof notices that drop
 *                          in, hold, then drop out (withdrawalDropTiny).
 *  - OddVerifiedBadge    → trust seal pinned to the right edge, confirming
 *                          payouts are verified; timestamp ticks live.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function OddSupportBubble() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="odd-support-bubble"
      onClick={() => navigate('/help')}
      aria-label="Help & support"
      title="Help & support"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  );
}

/* Synthetic social-proof feed — names + amounts only, no real data. */
const WN_NAMES = ['Kwame A.', 'Ama O.', 'Yaw B.', 'Akua M.', 'Kojo S.', 'Adwoa P.', 'Kofi N.', 'Esi T.', 'Abena K.'];
function makeNotice() {
  const name = WN_NAMES[Math.floor(Math.random() * WN_NAMES.length)];
  const amt = Math.random() * 9000 + 200;
  const amount = amt.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { name, amount, key: `${name}-${Math.random()}` };
}

export function OddWithdrawNotices() {
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    let next;
    let hide;
    const tick = () => {
      if (!alive) return;
      setNote(makeNotice());
      // withdrawalDropTiny runs 2s "both"; clear just after so it can re-fire.
      hide = setTimeout(() => {
        if (alive) setNote(null);
      }, 2100);
      // Stagger the next notice 7–11s later.
      next = setTimeout(tick, 7000 + Math.random() * 4000);
    };
    next = setTimeout(tick, 4000); // first after a short settle
    return () => {
      alive = false;
      clearTimeout(next);
      clearTimeout(hide);
    };
  }, []);

  if (!note) return null;
  return (
    <div className="odd-withdraw-note" key={note.key} role="status" aria-live="polite">
      <span className="odd-wn-dot" />
      <span>
        <b>{note.name}</b> withdrew <b>GHS {note.amount}</b>
      </span>
    </div>
  );
}

/* Trust seal — "✅ Verified Sports Payouts / Paid winners / Updated ...".
   Timestamp re-stamps itself every 30s so it always reads as fresh/live. */
function formatUpdated(d) {
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${d.getDate()}, ${time}`;
}

export function OddVerifiedBadge() {
  const [stamp, setStamp] = useState(() => formatUpdated(new Date()));

  useEffect(() => {
    const id = setInterval(() => setStamp(formatUpdated(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="odd-verified-badge" role="status" aria-label="Verified sports payouts — paid winners">
      <span className="odd-verified-check" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f2417" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="odd-verified-copy">
        <b>Verified Sports Payouts</b>
        <span className="odd-verified-sub">Paid winners</span>
        <span className="odd-verified-time">Updated {stamp}</span>
      </span>
    </div>
  );
}
