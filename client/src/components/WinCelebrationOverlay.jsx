import { useEffect, useMemo, useRef, useState } from 'react';
import { toBookingCode } from './BetSuccessOverlay.jsx';
import { useAccount } from '../providers/AccountProvider.jsx';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paidAtLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dt = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const tm = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dt}, ${tm}`;
}

export default function WinCelebrationOverlay({ wins = [], onClose, onViewSlip }) {
  const { account } = useAccount();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [animBalance, setAnimBalance] = useState(null);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (!wins.length) return;
    requestAnimationFrame(() => setVisible(true));
    return () => clearTimeout(exitTimerRef.current);
  }, [wins.length]);

  useEffect(() => {
    if (!wins.length || !account) return;
    const payout = wins.reduce((s, b) => s + Number(b?.cashOut ?? b?.potentialWin ?? 0), 0);
    const start = account.balance - payout;
    const end = account.balance;
    let current = start;
    const step = (end - start) / 30;
    let frame = 0;
    const animate = () => {
      frame++;
      current = Math.min(current + step, end);
      setAnimBalance(current);
      if (frame < 30) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [wins.length, account]);

  const payoutOf = (b) => Number(b?.cashOut ?? b?.potentialWin ?? 0);
  const totalPayout = useMemo(() => wins.reduce((s, b) => s + payoutOf(b), 0), [wins]);

  const handleClose = () => {
    setExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onClose?.();
    }, 300);
  };

  if (!wins.length) return null;

  const focus = wins[Math.min(index, wins.length - 1)];
  const single = wins.length === 1;
  const isCashOut = !!focus.cashOut || focus.status === 'cashed_out';
  const showPayout = single ? payoutOf(focus) : totalPayout;
  const stake = Number(focus.stake || 0);
  const profit = showPayout - stake;
  const legs = focus.legs?.length || 1;
  const modeLbl =
    focus.mode === 'single'
      ? 'Single'
      : focus.mode === 'multiple'
        ? 'Multiple'
        : focus.mode === 'system'
          ? 'System'
          : focus.mode || 'Bet';
  const slipCode = focus.bookingCode || toBookingCode(focus.id);
  const paidAt = paidAtLabel(focus.settledAt || focus.placedAt);
  const badgeLabel = isCashOut ? 'CASH-OUT CONFIRMED' : 'WIN CONFIRMED';
  const subCopy = isCashOut
    ? 'Your cash-out has been credited to your wallet.'
    : 'Your winning bet has been paid successfully.';

  return (
    <div
      className={`wco-overlay ${visible ? 'wco-visible' : ''} ${exiting ? 'wco-exiting' : ''}`}
      onClick={handleClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="wco-title"
    >
      <div className="wco-bg" />

      <div className="wco-fireworks" aria-hidden>
        {Array.from({ length: 3 }).map((_, burst) => (
          <div
            key={burst}
            className="wco-burst"
            style={{ '--d': `${burst * 1.2}s`, '--x': `${30 + burst * 20}%`, '--y': `${25 + burst * 15}%` }}
          >
            {Array.from({ length: 8 }).map((_, p) => (
              <span
                key={p}
                className="wco-burst-particle"
                style={{
                  '--a': `${p * 45}deg`,
                  '--c': ['#ffd76d', '#ffb800', '#ff9f1c', '#ffe28a', '#ffcc33', '#f7c948', '#d4a857', '#fff3b8'][p],
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="wco-confetti-layer" aria-hidden>
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="wco-confetti-piece"
            style={{
              '--x': `${Math.random() * 100}%`,
              '--d': `${Math.random() * 1.8}s`,
              '--r': `${Math.random() * 360}deg`,
              '--c': [
                '#ffd76d',
                '#ffb800',
                '#ffd54f',
                '#d4a857',
                '#ffcc33',
                '#ff9f1c',
                '#f7c948',
                '#ffe28a',
                '#ff5b78',
                '#ffb347',
              ][i % 10],
              '--w': `${5 + Math.random() * 7}px`,
              '--h': `${8 + Math.random() * 12}px`,
              '--tx': `${-50 + Math.random() * 100}px`,
            }}
          />
        ))}
      </div>

      <div className="wco-coin-layer" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="wco-coin"
            style={{
              '--x': `${10 + Math.random() * 80}%`,
              '--d': `${Math.random() * 3}s`,
              '--dr': `${2 + Math.random() * 2}s`,
              '--s': `${16 + Math.random() * 12}px`,
              '--delay': `${Math.random() * 2}s`,
            }}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <circle cx="12" cy="12" r="10" fill="#ffd76d" stroke="#f3a01a" strokeWidth="1.5" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fill="#a86200"
                fontSize="12"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                ¢
              </text>
            </svg>
          </span>
        ))}
      </div>

      <div className="wco-particle-layer" aria-hidden>
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="wco-particle"
            style={{
              '--x': `${20 + Math.random() * 60}%`,
              '--d': `${Math.random() * 2.5}s`,
              '--s': `${3 + Math.random() * 5}px`,
              '--c': ['#ffd76d', '#ffc44d', '#fff3b8', '#f3a01a', '#ff9f1c'][i % 5],
            }}
          />
        ))}
      </div>

      <div className="wco-sparkle-layer" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="wco-sparkle"
            style={{
              '--y': `${5 + Math.random() * 90}%`,
              '--x': `${5 + Math.random() * 90}%`,
              '--d': `${Math.random() * 3}s`,
              '--s': `${2 + Math.random() * 4}px`,
            }}
          />
        ))}
      </div>

      <div className="wco-card" onClick={(e) => e.stopPropagation()}>
        <header className="wco-head">
          <span className="wco-badge">{badgeLabel}</span>
          <button type="button" className="wco-x" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="wco-emblem" aria-hidden>
          <GiantTrophy />
        </div>

        <div className="wco-glow" aria-hidden />

        <h2 id="wco-title" className="wco-title">
          CONGRATULATIONS!
        </h2>
        <p className="wco-sub">{isCashOut ? 'Cash-out confirmed & credited!' : 'YOU WON!'}</p>

        <div className="wco-amount">
          <span className="wco-cur">GHS</span>
          <span className="wco-amt">{fmt(showPayout)}</span>
        </div>

        {!single && wins.length > 1 && (
          <div className="wco-meta">{wins.length} winning tickets &middot; combined payout</div>
        )}

        <div className="wco-profit-row">
          <span className="wco-profit-label">Profit</span>
          <span className="wco-profit-val" style={{ color: profit >= 0 ? '#4ade80' : '#ff5b78' }}>
            {profit >= 0 ? '+' : ''}GHS {fmt(Math.abs(profit))}
          </span>
        </div>

        {animBalance !== null && (
          <div className="wco-balance-row">
            <span className="wco-balance-label">Wallet Balance</span>
            <span className="wco-balance-val">GHS {fmt(animBalance)}</span>
          </div>
        )}

        <div className="wco-grid">
          <div className="wco-stat">
            <span className="wco-lbl">Original Stake</span>
            <span className="wco-val">GHS {fmt(stake)}</span>
          </div>
          <div className="wco-stat">
            <span className="wco-lbl">Booking Code</span>
            <span className="wco-val wco-val-mono">{slipCode}</span>
          </div>
          <div className="wco-stat">
            <span className="wco-lbl">Bet ID</span>
            <span className="wco-val wco-val-id">{focus.id?.slice(-8) || '—'}</span>
          </div>
          <div className="wco-stat">
            <span className="wco-lbl">Settled At</span>
            <span className="wco-val">{paidAt || '—'}</span>
          </div>
        </div>

        {wins.length > 1 && (
          <div className="wco-pager">
            {wins.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show winning ticket ${i + 1}`}
                className={`wco-dot${i === index ? ' active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}

        <div className="wco-actions">
          <button
            type="button"
            className="wco-btn wco-btn-primary"
            onClick={() => {
              onViewSlip?.(focus);
              handleClose();
            }}
          >
            View Slip
          </button>
          <button type="button" className="wco-btn wco-btn-ghost" onClick={handleClose}>
            Awesome
          </button>
        </div>
      </div>

      <style>{WCO_CSS}</style>
    </div>
  );
}

function GiantTrophy() {
  return (
    <div className="wco-trophy-disc">
      <svg viewBox="0 0 120 120" width="80" height="80" aria-hidden>
        <defs>
          <linearGradient id="wtCupBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3b8" />
            <stop offset=".45" stopColor="#f3a01a" />
            <stop offset=".8" stopColor="#d48700" />
            <stop offset="1" stopColor="#a86200" />
          </linearGradient>
          <linearGradient id="wtCupBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#994d00" />
            <stop offset="1" stopColor="#4d2600" />
          </linearGradient>
          <linearGradient id="wtCupShine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.4)" />
            <stop offset=".3" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id="wtGlow" cx="50%" cy="30%" r="55%">
            <stop offset="0%" stopColor="#ffd76d" stopOpacity=".35" />
            <stop offset="100%" stopColor="#ffd76d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill="url(#wtGlow)" opacity="0.7">
          <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <path d="M26 22 H94 V60 C94 78 80 88 60 88 C40 88 26 78 26 60 Z" fill="url(#wtCupBody)">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.03;1"
            dur="1.8s"
            repeatCount="indefinite"
            additive="sum"
          />
        </path>
        <ellipse cx="60" cy="22" rx="34" ry="7" fill="#ffe28a" />
        <rect x="28" y="20" width="64" height="6" rx="2" fill="url(#wtCupShine)" />
        <path
          d="M26 34 Q12 34 13 44 Q14 54 28 54"
          fill="none"
          stroke="#cc7a00"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M94 34 Q108 34 107 44 Q106 54 92 54"
          fill="none"
          stroke="#cc7a00"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path d="M52 88 H68 V96 H52 Z" fill="url(#wtCupBase)" />
        <path d="M40 96 H80 V100 H40 Z" fill="url(#wtCupBase)" />
        <circle cx="60" cy="48" r="12" fill="#fff3b8" opacity=".65" />
        <path d="M60 38 l2.8 5.6 6.2 1 -4.5 4.2 1 6.2 -5.5 -3 -5.5 3 1 -6.2 -4.5 -4.2 6.2 -1 z" fill="#a86200" />
        <path d="M46 24 Q46 18 60 16 Q74 18 74 24" fill="none" stroke="#ffe28a" strokeWidth="2" opacity=".6" />
      </svg>
    </div>
  );
}

const WCO_CSS = `
@keyframes wcoFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes wcoFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes wcoCardIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes wcoCardOut { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.85) translateY(20px); opacity: 0; } }
@keyframes wcoBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes wcoGlow { 0%, 100% { opacity: .4; transform: translate(-50%,-50%) scale(1); } 50% { opacity: .9; transform: translate(-50%,-50%) scale(1.25); } }
@keyframes wcoFall { 0% { transform: translate(0, -20px) rotate(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(var(--tx,20px), 110vh) rotate(720deg); opacity: 0; } }
@keyframes wcoRise { 0% { transform: translateY(0) scale(1); opacity: .9; } 100% { transform: translateY(-140px) scale(0); opacity: 0; } }
@keyframes wcoSparkleAnim { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 30% { opacity: 1; transform: scale(1.3) rotate(180deg); } 60% { opacity: .5; transform: scale(.8) rotate(360deg); } 100% { opacity: 0; transform: scale(.3) rotate(540deg); } }
@keyframes wcoCoinFall { 0% { transform: translateY(-60px) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(calc(100vh + 60px)) rotate(1080deg); opacity: .3; } }
@keyframes wcoBurst { 0% { transform: scale(0); opacity: 0; } 10% { opacity: 1; } 40% { transform: scale(1); opacity: 1; } 100% { opacity: 0; } }
@keyframes wcoBurstParticle { 0% { transform: rotate(var(--a)) translateY(0); opacity: 1; } 100% { transform: rotate(var(--a)) translateY(120px); opacity: 0; } }
@keyframes wcoTitleIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wcoSubIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wcoDetailsIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wcoActionsIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wcoProfitIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
@keyframes wcoBalanceIn { from { opacity: 0; } to { opacity: 1; } }

.wco-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity .3s ease;
  padding: 16px;
  overflow: hidden;
}
.wco-overlay.wco-visible { opacity: 1; pointer-events: auto; }
.wco-overlay.wco-exiting { opacity: 0; }

.wco-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 40%, rgba(40, 20, 0, 0.92), rgba(0, 0, 0, 0.95));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.wco-fireworks { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.wco-burst { position: absolute; left: var(--x); top: var(--y); animation: wcoBurst 2.5s ease-out var(--d) both; }
.wco-burst-particle { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--c); animation: wcoBurstParticle 1.2s ease-out both; }

.wco-confetti-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
.wco-confetti-piece { position: absolute; top: -16px; left: var(--x); width: var(--w); height: var(--h); border-radius: 2px; background: var(--c); animation: wcoFall linear var(--d) both; animation-duration: 3s; transform: rotate(var(--r)); }

.wco-coin-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.wco-coin { position: absolute; top: -40px; left: var(--x); width: var(--s); height: var(--s); animation: wcoCoinFall var(--dr) linear var(--delay) both; }

.wco-particle-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.wco-particle { position: absolute; bottom: 40%; left: var(--x); width: var(--s); height: var(--s); border-radius: 50%; background: var(--c); animation: wcoRise 1.8s ease-out var(--d) both; }

.wco-sparkle-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.wco-sparkle { position: absolute; top: var(--y); left: var(--x); width: var(--s); height: var(--s); animation: wcoSparkleAnim 2.2s ease-in-out var(--d) infinite; }
.wco-sparkle::after { content: ''; display: block; width: 100%; height: 100%; background: #ffd76d; clip-path: polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%); }

.wco-card {
  position: relative; z-index: 2;
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(600px 240px at 80% -10%, rgba(255,200,80,.14), transparent 60%),
    linear-gradient(180deg, #1a0f00 0%, #0d0800 100%);
  border-radius: 24px;
  padding: 28px 24px 24px;
  box-shadow: 0 32px 96px rgba(0,0,0,.7), 0 0 0 1px rgba(255,200,80,.15) inset;
  font-family: 'Inter','Segoe UI',system-ui,sans-serif;
  text-align: center;
  animation: wcoCardIn .5s cubic-bezier(.18,.88,.36,1.2) both;
  color: #fff;
  scrollbar-width: thin;
}
.wco-exiting .wco-card { animation: wcoCardOut .3s ease both; }

.wco-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.wco-badge {
  font-size: 10px; letter-spacing: .18em; font-weight: 800;
  color: #ffd76d;
  background: rgba(255,200,80,.1);
  border: 1px solid rgba(255,200,80,.35);
  padding: 5px 10px; border-radius: 999px;
}
.wco-x {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.14);
  background: transparent;
  color: rgba(255,255,255,.65);
  font-size: 20px; line-height: 1;
  cursor: pointer;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s;
}
.wco-x:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }

.wco-emblem { display: flex; justify-content: center; margin: 6px 0 2px; animation: wcoBounce 2.8s ease-in-out infinite; position: relative; z-index: 3; }
.wco-glow {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 160px; height: 160px;
  background: radial-gradient(circle, rgba(255,200,80,.2) 0%, transparent 70%);
  pointer-events: none;
  animation: wcoGlow 2.2s ease-in-out infinite;
}
.wco-trophy-disc {
  width: 96px; height: 96px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffd76d 0%, #f3a01a 60%, #b06700 100%);
  display: grid; place-items: center;
  box-shadow: 0 16px 48px rgba(255,180,50,.4), 0 0 0 4px rgba(255,200,80,.2), 0 0 80px rgba(255,180,50,.15);
}

.wco-title {
  margin: 10px 0 2px;
  font-size: 28px; font-weight: 900;
  letter-spacing: -.01em;
  animation: wcoTitleIn .4s ease .3s both;
}
.wco-sub {
  margin: 0 0 10px;
  font-size: 15px;
  color: rgba(255,255,255,.8);
  font-weight: 600;
  animation: wcoSubIn .4s ease .4s both;
}

.wco-amount {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  font-variant-numeric: tabular-nums;
  margin: 6px 0 2px;
  animation: wcoTitleIn .4s ease .5s both;
}
.wco-amount .wco-cur { font-size: 16px; font-weight: 700; color: rgba(255,200,80,.65); letter-spacing: .08em; }
.wco-amount .wco-amt {
  font-size: 46px; font-weight: 900;
  letter-spacing: -.025em;
  color: #ffd76d;
  text-shadow: 0 6px 28px rgba(255,180,50,.35);
}
.wco-meta {
  font-size: 12px;
  color: rgba(255,255,255,.55);
  margin-bottom: 8px;
}
.wco-profit-row {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 8px 14px;
  margin: 4px auto 10px;
  width: fit-content;
  background: rgba(255,255,255,.04);
  border-radius: 999px;
  animation: wcoProfitIn .4s ease .6s both;
}
.wco-profit-label { font-size: 12px; color: rgba(255,255,255,.55); }
.wco-profit-val { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }

.wco-balance-row {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 6px 12px;
  margin: 0 auto 8px;
  width: fit-content;
  background: rgba(74,222,128,.08);
  border: 1px solid rgba(74,222,128,.2);
  border-radius: 999px;
  animation: wcoBalanceIn .5s ease .8s both;
}
.wco-balance-label { font-size: 11px; color: rgba(74,222,128,.7); font-weight: 600; }
.wco-balance-val { font-size: 14px; font-weight: 800; color: #4ade80; font-variant-numeric: tabular-nums; }

.wco-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
  animation: wcoDetailsIn .4s ease .7s both;
}
.wco-stat {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 3px;
  text-align: left;
}
.wco-stat .wco-lbl { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.42); }
.wco-stat .wco-val { font-size: 14px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.wco-stat .wco-val-mono { font-family: 'JetBrains Mono','Roboto Mono',monospace; letter-spacing: .06em; color: #ffd76d; font-size: 13px; }
.wco-stat .wco-val-id { font-family: 'JetBrains Mono','Roboto Mono',monospace; color: rgba(255,255,255,.6); font-size: 12px; }

.wco-pager { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
.wco-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.25); border: none; padding: 0; cursor: pointer; transition: background .15s, transform .15s; }
.wco-dot.active { background: #ffd76d; transform: scale(1.4); }

.wco-actions {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px;
  animation: wcoActionsIn .4s ease .9s both;
}
.wco-btn {
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  font-weight: 800; font-size: 13.5px;
  letter-spacing: .02em;
  cursor: pointer;
  transition: transform .12s, box-shadow .15s, background .15s;
  font-family: inherit;
}
.wco-btn:active { transform: scale(.97); }
.wco-btn-ghost { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.14); }
.wco-btn-ghost:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.25); }
.wco-btn-primary {
  background: linear-gradient(135deg, #ffd76d 0%, #f3a01a 100%);
  color: #2a1700;
  box-shadow: 0 12px 28px rgba(246,162,0,.35);
}
.wco-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 16px 36px rgba(246,162,0,.55); }

@media (max-width: 380px) {
  .wco-card { padding: 22px 16px 18px; }
  .wco-title { font-size: 24px; }
  .wco-amount .wco-amt { font-size: 36px; }
  .wco-trophy-disc { width: 76px; height: 76px; }
  .wco-trophy-disc svg { width: 64px; height: 64px; }
  .wco-grid { gap: 6px; }
  .wco-stat { padding: 8px 10px; }
  .wco-stat .wco-val { font-size: 13px; }
}
@media (min-width: 768px) {
  .wco-card { width: min(500px, 90vw); padding: 36px 32px 28px; }
  .wco-title { font-size: 34px; }
  .wco-amount .wco-amt { font-size: 52px; }
  .wco-trophy-disc { width: 110px; height: 110px; }
  .wco-trophy-disc svg { width: 90px; height: 90px; }
}
`;
