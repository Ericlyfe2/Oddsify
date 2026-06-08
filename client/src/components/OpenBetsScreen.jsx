import { useState, useEffect } from 'react';
import {
  Clock,
  RotateCcw,
  Play,
  Share2,
  Pencil,
  ChevronUp,
  LayoutGrid,
  Wallet,
  Crosshair,
  ChevronRight,
} from 'lucide-react';

const bet = {
  type: 'Multiple',
  selections: [
    { pick: 'Home', odds: 1.19, market: '1X2', match: 'Ecuador vs Guatemala', datetime: '07/06 20:00' },
    { pick: 'Home', odds: 1.2, market: '1X2', match: 'Colombia vs Jordan', datetime: '07/06 23:00' },
  ],
  stake: 0.1,
  potentialWin: 0.14,
  cashoutAmount: 0.1,
  currency: 'GHS',
  balance: 0.01,
};

const S = {
  tabBar: { height: 48, background: '#0B1F3A' },
  tabActive: {
    background: '#FFFFFF',
    color: '#0B1F3A',
    fontWeight: 600,
    fontSize: 15,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    border: 0,
    outline: 'none',
  },
  tabInactive: {
    background: '#0B1F3A',
    color: '#FFFFFF',
    fontWeight: 500,
    fontSize: 15,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    border: 0,
    outline: 'none',
  },
  balancePill: {
    background: '#1FAA4A',
    padding: '4px 10px',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 600,
  },
  chipActive: { background: '#0B1F3A', color: '#FFFFFF' },
  chipInactive: { background: '#F2F4F7', color: '#3A4A5C' },
  card: { background: '#FFFFFF', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', padding: '14px 16px' },
  cashoutBtn: {
    background: '#1FAA4A',
    borderRadius: 8,
    border: 0,
    outline: 'none',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  divider: { borderTop: '1px solid #E5E7EB' },
  green: '#1FAA4A',
  navy: '#0B1F3A',
  muted: '#6B7280',
  lightMuted: '#9CA3AF',
  bodyText: '#3A4A5C',
  pageBg: '#F2F4F7',
};

function SkeletonPulse() {
  return (
    <div className="space-y-3" style={{ padding: '14px 16px' }}>
      <div className="flex justify-between items-center">
        <div style={{ width: 80, height: 18, background: '#E5E7EB', borderRadius: 4 }} />
        <div style={{ width: 120, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
      </div>
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start"
          style={{ gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid #E5E7EB' : 'none' }}
        >
          <div style={{ width: 18, height: 18, background: '#E5E7EB', borderRadius: 999, flexShrink: 0 }} />
          <div className="flex-1 space-y-2">
            <div style={{ width: '60%', height: 14, background: '#E5E7EB', borderRadius: 4 }} />
            <div style={{ width: '80%', height: 14, background: '#E5E7EB', borderRadius: 4 }} />
            <div style={{ width: '40%', height: 12, background: '#E5E7EB', borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ width: '100%', height: 14, background: '#E5E7EB', borderRadius: 4 }} />
      <div className="flex justify-between">
        <div style={{ width: 60, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
        <div style={{ width: 50, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
      </div>
      <div className="flex justify-between">
        <div style={{ width: 60, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
        <div style={{ width: 50, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function CashoutButton({ currency, amount }) {
  return (
    <button
      type="button"
      className="group relative w-full flex items-center justify-center cursor-pointer overflow-hidden select-none"
      style={S.cashoutBtn}
      aria-label={`Cashout ${currency} ${amount.toFixed(2)}`}
    >
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        Cashout {currency} {amount.toFixed(2)}
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

export default function OpenBetsScreen() {
  const [activeTab, setActiveTab] = useState('open');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showDetails, setShowDetails] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const tabProps = (tab) => ({
    type: 'button',
    onClick: () => setActiveTab(tab),
    className: 'flex-1 flex items-center justify-center cursor-pointer',
    style: activeTab === tab ? S.tabActive : S.tabInactive,
  });

  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: '#0B1F3A' }}>
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 414,
          minHeight: '100vh',
          background: S.pageBg,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* ── Top tab bar ── */}
        <div className="relative flex" style={S.tabBar}>
          <button {...tabProps('open')}>Open Bets (1)</button>
          <button {...tabProps('history')}>Bet History</button>
          <div
            className="absolute flex items-center gap-1 cursor-default"
            style={{ top: 8, right: 12, ...S.balancePill }}
          >
            <Wallet size={12} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {bet.currency} {bet.balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ── Filter chip row ── */}
        <div className="flex items-center justify-between" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'cashout', label: 'Cashout Available' },
              { key: 'live', label: 'Live Games' },
            ].map(({ key, label }) => {
              const active = activeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className="cursor-pointer select-none"
                  style={{
                    ...(active ? S.chipActive : S.chipInactive),
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 16,
                    border: 0,
                    outline: 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="cursor-pointer"
            style={{ background: 'none', border: 0, padding: 0, outline: 'none' }}
            aria-label="Toggle view"
          >
            <LayoutGrid size={20} color="#6B7280" />
          </button>
        </div>

        {/* ── Page content ── */}
        <div style={{ padding: '12px 12px 0' }}>
          {loading ? (
            <div style={{ background: '#FFFFFF', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              <SkeletonPulse />
            </div>
          ) : (
            <>
              {/* ── Bet card ── */}
              <div style={S.card}>
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 700, fontSize: 15, color: S.navy }}>{bet.type}</span>
                  <div className="flex items-center" style={{ gap: 14 }}>
                    {[
                      { icon: RotateCcw, label: 'Rebet', aria: 'Rebet' },
                      { icon: Play, label: 'SIM', aria: 'SIM', fill: true },
                      { icon: Share2, aria: 'Share' },
                      { icon: Pencil, label: 'Edit Bet', aria: 'Edit Bet' },
                    ].map(({ icon: Icon, label, aria, fill }) => (
                      <button
                        key={aria}
                        type="button"
                        className="flex items-center gap-1 cursor-pointer"
                        style={{ background: 'none', border: 0, padding: 0, outline: 'none' }}
                        aria-label={aria}
                      >
                        <Icon size={14} color={S.green} {...(fill ? { fill: S.green } : {})} />
                        {label && <span style={{ color: S.green, fontSize: 12, fontWeight: 500 }}>{label}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selection rows */}
                {bet.selections.map((sel, i) => (
                  <div
                    key={i}
                    className="flex"
                    style={{
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: i < bet.selections.length - 1 ? '1px solid #E5E7EB' : 'none',
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <Clock size={18} color={S.muted} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <Crosshair size={14} color={S.navy} />
                        <span
                          style={{ fontWeight: 700, fontSize: 14, color: S.navy, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {sel.pick} @ {sel.odds.toFixed(2)}
                        </span>
                        <span style={{ fontWeight: 400, fontSize: 12, color: S.lightMuted }}>{sel.market}</span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            color: S.navy,
                            fontSize: 14,
                            fontWeight: 500,
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {sel.match}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, color: S.lightMuted, fontSize: 12, fontWeight: 400 }}>
                        {sel.datetime}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Hide / Show Match Details */}
                <div style={S.divider}>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center justify-end w-full cursor-pointer select-none"
                    style={{
                      gap: 4,
                      padding: '10px 0',
                      background: 'none',
                      border: 0,
                      outline: 'none',
                      color: S.green,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {showDetails ? 'Hide Match Details' : 'Show Match Details'}
                    <ChevronUp
                      size={14}
                      color={S.green}
                      style={{
                        transition: 'transform 200ms',
                        transform: showDetails ? 'rotate(0deg)' : 'rotate(180deg)',
                      }}
                    />
                  </button>
                </div>

                {/* Stake / Pot. Win */}
                <div>
                  {[
                    { label: 'Stake', value: bet.stake },
                    { label: 'Pot. Win', value: bet.potentialWin },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between" style={{ padding: '4px 0' }}>
                      <span style={{ color: S.bodyText, fontSize: 13, fontWeight: 500 }}>{label}</span>
                      <span
                        style={{ color: S.navy, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cashout button ── */}
              <div style={{ marginTop: 12 }}>
                <CashoutButton currency={bet.currency} amount={bet.cashoutAmount} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
