/**
 * Wallet action chooser — reached by tapping the balance pill in the top
 * header. Shows the current balance and lets the user pick Deposit or
 * Withdraw before landing on either flow.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccount } from '../providers/AccountProvider.jsx';
import { fmtCedi, useTokens, OddPageHeader, OddIcon } from '../components/odd/primitives.jsx';

function ActionCard({ icon, label, hint, accent, onClick, delay }) {
  const T = useTokens();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '18px 16px',
        borderRadius: 16,
        background: T.surface,
        border: `1px solid ${T.line}`,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: accent,
        }}
      >
        <OddIcon name={icon} size={22} color={T.goldDark} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{hint}</div>
      </div>
      <OddIcon name="chevR" size={18} color={T.inkDim} />
    </motion.button>
  );
}

export default function WalletActionPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { account, openDeposit, openWithdraw } = useAccount();

  if (!account) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
        <OddPageHeader title="Wallet" subtitle="Sign in to manage your funds" />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <OddIcon name="wallet" size={32} color={T.inkDim} />
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginTop: 12 }}>
            Sign in to deposit or withdraw
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?next=/wallet/select')}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              borderRadius: 999,
              background: T.greenBright,
              color: T.goldDark,
              fontWeight: 700,
              fontSize: 13,
              border: 0,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
      <OddPageHeader title="Wallet" subtitle="What would you like to do?" />

      <div style={{ padding: '0 16px 20px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '18px 18px 16px',
            borderRadius: 16,
            background: T.greenBright,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: T.goldDark, opacity: 0.8 }}>Available Balance</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: T.goldDark,
              letterSpacing: -0.6,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            GHS {fmtCedi(account.balance)}
          </div>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionCard
            icon="deposit"
            label="Deposit"
            hint="Top up your balance with MoMo, card, or bank transfer"
            accent={T.greenBright}
            onClick={() => openDeposit()}
            delay={0.05}
          />
          <ActionCard
            icon="upload"
            label="Withdraw"
            hint="Send your balance to your registered mobile money number"
            accent={T.greenBright}
            onClick={() => openWithdraw()}
            delay={0.1}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate('/wallet')}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '12px 0',
            borderRadius: 10,
            background: 'transparent',
            border: 'none',
            color: T.inkSoft,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View transaction history →
        </button>
      </div>
    </div>
  );
}
