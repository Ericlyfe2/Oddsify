import { useTokens } from './tokens.jsx';

const YEAR = new Date().getFullYear();

const PAYMENTS = [
  { name: 'Payaza', bg: '#0052CC' },
  { name: 'Paystack', bg: '#00C3F7' },
  { name: 'Paybill', bg: '#FF6600' },
  { name: 'Mobile Money', bg: '#FFCC00', color: '#000' },
  { name: 'Bitcoin', bg: '#F7931A' },
];

export default function OddFooter() {
  const T = useTokens();
  const s = {
    wrap: {
      background: '#0B1F3A',
      color: '#fff',
      padding: '28px 20px 100px',
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 1.6,
    },
    badge: {
      display: 'inline-block',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 999,
      padding: '4px 14px',
      fontSize: 11,
      fontWeight: 600,
      marginBottom: 16,
    },
    heading: { fontSize: 18, fontWeight: 800, color: '#fff', margin: '12px 0 4px' },
    sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
    sectionLabel: {
      fontSize: 10, fontWeight: 700, letterSpacing: 1,
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10,
    },
    pills: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
    pill: {
      padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      color: '#fff', border: 0, cursor: 'default',
    },
    links: {
      display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap',
      marginBottom: 20, fontSize: 12, fontWeight: 600,
    },
    link: { color: 'rgba(255,255,255,0.7)', textDecoration: 'none' },
    linkActive: { color: '#E8B94A' },
    legal: { fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 340, margin: '0 auto', lineHeight: 1.55 },
  };

  return (
    <footer style={s.wrap}>
      <div style={s.badge}>18+</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        &copy; {YEAR} Oddsify. All rights reserved.
      </div>

      <div style={{ color: '#E8B94A', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Oddsify</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
        Official Sports Betting Partner
      </div>

      <div style={s.heading}>The world's fastest-growing betting platform</div>
      <div style={s.sub}>&nbsp;</div>

      <div style={s.sectionLabel}>Available Payment Methods</div>
      <div style={s.pills}>
        {PAYMENTS.map((p) => (
          <span key={p.name} style={{ ...s.pill, background: p.bg, color: p.color || '#fff' }}>{p.name}</span>
        ))}
      </div>

      <div style={s.links}>
        <span style={s.linkActive}>Oddsify GH</span>
        <span style={s.link}>Oddsify NG</span>
      </div>

      <div style={{ ...s.links, marginBottom: 16 }}>
        <a href="/terms" style={s.link}>Terms &amp; Conditions</a>
        <a href="/about" style={s.link}>About Us</a>
      </div>

      <p style={s.legal}>
        Oddsify is a registered company in Ghana, Nigeria, and Other Countries.
        <br /><br />
        <strong>Age 18 and above only.</strong> Bet smart, enjoy the thrill,
        and keep it within your limits. Oddsify is licensed by the Gaming Commission of Ghana.
      </p>
    </footer>
  );
}
