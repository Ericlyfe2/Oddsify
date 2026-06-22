import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

export function toBookingCode(id = '') {
  const s = String(id)
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
  if (!s) return 'XX00000';
  const letters = (s.match(/[A-Z]/g) || ['X', 'X']).slice(0, 2).join('').padEnd(2, 'X');
  const digits = (s.match(/[0-9]/g) || ['0']).slice(-5).join('').padStart(5, '0');
  return letters + digits;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SHARE_PLATFORMS = {
  whatsapp: { color: '#25D366', hover: '#20bd5a' },
  telegram: { color: '#229ED9', hover: '#1d8bc2' },
  twitter: { color: '#1DA1F2', hover: '#1a91da' },
  copy: { color: 'var(--accent)', hover: 'rgba(232,185,74,0.2)' },
};

const CONFETTI_COLORS = ['#f7c948', '#e8b94a', '#d4a72c', '#fff3b8', '#ffb800', '#f3e9cf', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function ConfettiPiece({ index }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const x = `${Math.random() * 100}%`;
  const tx = `${-60 + Math.random() * 120}px`;
  const w = `${5 + Math.random() * 6}px`;
  const h = `${8 + Math.random() * 10}px`;
  const delay = Math.random() * 1.5;
  const dur = 2 + Math.random() * 1.5;
  const rot = Math.random() * 720;

  return (
    <motion.span
      style={{
        position: 'absolute', top: -16, left: x,
        width: w, height: h, borderRadius: 2,
        background: color,
      }}
      initial={{ x: 0, y: -20, rotate: 0, opacity: 0 }}
      animate={{ x: tx, y: '110vh', rotate: rot, opacity: [0, 1, 1, 0] }}
      transition={{ duration: dur, delay, ease: 'easeIn', repeat: Infinity, repeatDelay: 1 }}
    />
  );
}

function ParticleBurst() {
  const particles = Array.from({ length: 36 }).map((_, i) => {
    const angle = (i / 36) * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 60 + Math.random() * 120;
    const x = Math.cos(rad) * dist;
    const y = Math.sin(rad) * dist;
    const size = 3 + Math.random() * 5;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return { x, y, size, color, delay: 1.5 + Math.random() * 0.3 };
  });

  return (
    <>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: p.size, height: p.size, borderRadius: '50%',
            background: p.color,
            marginTop: -p.size / 2, marginLeft: -p.size / 2,
            pointerEvents: 'none',
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </>
  );
}

function LightRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 2, height: '120%',
              background: 'linear-gradient(to top, transparent 0%, rgba(232,185,74,0.12) 50%, transparent 100%)',
              transformOrigin: 'bottom center',
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 2.5, delay: 0.3 + i * 0.08, repeat: Infinity, repeatDelay: 1 }}
          />
        );
      })}
    </div>
  );
}

function SparkleStar({ delay, x, y }) {
  return (
    <motion.span
      style={{
        position: 'absolute', top: y, left: x,
        width: 8, height: 8, pointerEvents: 'none',
      }}
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      animate={{
        scale: [0, 1.4, 0.6, 0],
        opacity: [0, 1, 0.4, 0],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 2, delay, ease: 'easeInOut', repeat: Infinity }}
    >
      <svg viewBox="0 0 24 24" fill="#f7c948" width="8" height="8">
        <path d="M12 0l3.09 6.26L22 7.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 12.14 2 7.27l6.91-1.01L12 0z" />
      </svg>
    </motion.span>
  );
}

function Sparkles() {
  const stars = Array.from({ length: 20 }).map((_, i) => ({
    x: `${5 + Math.random() * 90}%`,
    y: `${5 + Math.random() * 90}%`,
    delay: Math.random() * 3,
  }));
  return (
    <>
      {stars.map((s, i) => (
        <SparkleStar key={i} x={s.x} y={s.y} delay={s.delay} />
      ))}
    </>
  );
}

function CheckmarkAnimation() {
  const [phase, setPhase] = useState('initial');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('expand'), 200);
    const t2 = setTimeout(() => setPhase('draw'), 600);
    const t3 = setTimeout(() => setPhase('complete'), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const scale = phase === 'initial' ? 0 : phase === 'expand' ? 1.15 : phase === 'draw' ? 1 : 1;
  const ringOpacity = phase === 'expand' ? 1 : phase === 'draw' || phase === 'complete' ? 1 : 0;
  const ringScale = phase === 'initial' ? 0.5 : phase === 'expand' ? 1 : 1;
  const checkProgress = phase === 'draw' || phase === 'complete' ? 1 : 0;
  const glowOpacity = phase === 'complete' ? 1 : 0.4;

  return (
    <motion.div
      style={{
        width: 110, height: 110, margin: '0 auto 8px',
        position: 'relative',
      }}
      initial={{ scale: 0 }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
    >
      <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 2 }}>
        <motion.circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="#f7c948"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0, scale: 0.5 }}
          animate={{ pathLength: 1, opacity: ringOpacity, scale: ringScale }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          style={{ transformOrigin: 'center', rotate: '-90deg' }}
        />
        <motion.path
          d="M38 62l14 14 30-32"
          fill="none"
          stroke="#f7c948"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: checkProgress, opacity: checkProgress }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.6 }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(247,201,72,0.6))' }}
        />
      </svg>

      <motion.div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 160, height: 160,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,185,74,0.15) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 1,
        }}
        animate={{ opacity: [glowOpacity, glowOpacity + 0.3, glowOpacity], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
      />

      <motion.div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 130, height: 130,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '2px solid rgba(247,201,72,0.2)',
          pointerEvents: 'none', zIndex: 0,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.5], opacity: [0.6, 0] }}
        transition={{ duration: 1.8, ease: 'easeOut', delay: 1, repeat: Infinity, repeatDelay: 0.5 }}
      />
    </motion.div>
  );
}

function TicketImage({ bet, code, ts, formatShareDate }) {
  const ref = useRef(null);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!ref.current || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: '#0a0a0a', pixelRatio: 2 });
      saveAs(dataUrl, `StakePoint-${code}.png`);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [code, saving]);

  const shareImage = useCallback(async () => {
    if (!ref.current || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: '#0a0a0a', pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `StakePoint-${code}.png`, { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ title: `StakePoint Ticket ${code}`, files: [file] }).catch(() => {});
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [code, saving]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        style={{
          width: 340, padding: 20, borderRadius: 16,
          background: 'linear-gradient(180deg, #161513 0%, #0a0a0a 100%)',
          border: '1px solid rgba(232,185,74,0.3)',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          color: '#f3e9cf', fontSize: 12,
          position: 'absolute', left: -9999, top: 0,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(243,233,207,0.5)', marginBottom: 2 }}>STAKEPOINT</div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', color: '#f7c948' }}>BOOKING CODE</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", color: '#f7c948', margin: '6px 0' }}>{code}</div>
        </div>
        <div style={{ borderTop: '1px solid rgba(232,185,74,0.15)', paddingTop: 10 }}>
          {(bet.legs || []).map((leg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span style={{ color: 'rgba(243,233,207,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {leg.home || '?'} vs {leg.away || '?'}
              </span>
              <span style={{ color: '#f7c948', fontWeight: 600, marginLeft: 8 }}>{leg.outcome} @ {Number(leg.odds).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(232,185,74,0.15)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <div>
            <div style={{ color: 'rgba(243,233,207,0.5)', fontSize: 9 }}>STAKE</div>
            <div style={{ fontWeight: 700 }}>GHS {fmt(bet.stake)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(243,233,207,0.5)', fontSize: 9 }}>POT. WIN</div>
            <div style={{ fontWeight: 700, color: '#f7c948' }}>GHS {fmt(bet.potentialWin)}</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(232,185,74,0.15)', marginTop: 8, paddingTop: 8, textAlign: 'center', fontSize: 9, color: 'rgba(243,233,207,0.4)' }}>
          {formatShareDate(bet.placedAt)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <motion.button
          type="button"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 10,
            border: '1px solid rgba(232,185,74,0.2)',
            background: 'rgba(232,185,74,0.06)',
            color: '#f3e9cf', fontWeight: 600, fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, fontFamily: 'inherit',
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {saving ? 'Saving…' : 'Save Image'}
        </motion.button>
        <motion.button
          type="button"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 10,
            border: '1px solid rgba(232,185,74,0.2)',
            background: 'rgba(232,185,74,0.06)',
            color: '#f3e9cf', fontWeight: 600, fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, fontFamily: 'inherit',
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={shareImage}
          disabled={saving}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Image
        </motion.button>
      </div>
    </div>
  );
}

function ShareButton({ platform, url, code, bet, onCopy, onShare }) {
  const shareUrl = url;
  const text = `I just placed a bet on StakePoint! 🎯\n\nBooking Code: ${code}\nStake: GHS ${fmt(bet?.stake)}\nPotential Win: GHS ${fmt(bet?.potentialWin)}\n\nCheck it out: ${shareUrl}`;

  const handleClick = () => {
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        onShare?.('whatsapp');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        onShare?.('telegram');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        onShare?.('twitter');
        break;
      case 'copy': {
        const full = `${shareUrl}\n\n${text}`;
        navigator.clipboard.writeText(full).then(() => onCopy?.('link')).catch(() => {});
        break;
      }
      default:
        break;
    }
  };

  return (
    <motion.button
      type="button"
      style={{
        flex: 1, padding: '10px 8px', borderRadius: 12,
        border: '1px solid rgba(232,185,74,0.15)',
        background: 'rgba(232,185,74,0.04)',
        color: '#f3e9cf', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4,
        fontFamily: 'inherit', minWidth: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      whileHover={{ scale: 1.05, background: 'rgba(232,185,74,0.1)', borderColor: 'rgba(232,185,74,0.3)' }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
    >
      {platform === 'whatsapp' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )}
      {platform === 'telegram' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.127.087.774.162 1.226.066.398.192 1.162.208 1.256.06.34.211 1.442.215 1.525.004.057.002.14-.014.201a.546.546 0 01-.22.318c-.12.08-.278.122-.402.124-.013 0-.029.002-.045.002-.2 0-.467-.066-.618-.106-.212-.057-.456-.144-.69-.22-.354-.115-.726-.236-1.047-.306-.19-.041-.36-.058-.523-.012-.117.033-.26.113-.355.24-.124.166-.145.33-.155.444-.008.1-.013.195-.03.224a.378.378 0 01-.11.12c-.11.07-.27.116-.42.157-.244.067-.558.153-.79.275-.153.08-.355.217-.547.383-.12.105-.23.226-.307.367-.08.147-.11.28-.113.377-.003.067-.004.124.006.178.026.13.127.24.237.27.088.025.194.044.319.065.188.03.394.065.576.13.136.048.285.118.434.2.27.148.549.38.755.66.156.211.275.496.254.78-.016.206-.092.485-.265.66a.694.694 0 01-.302.172c-.18.049-.388.066-.61.066-.297-.002-.577-.047-.8-.09-.222-.043-.48-.117-.74-.2-.254-.08-.536-.19-.788-.348a3.73 3.73 0 01-.16-.107l-.074-.05c-.454-.307-.82-.577-1.084-.9a11.08 11.08 0 01-.26-.341l-.005-.007c-.19-.26-.574-.748-.874-1.082a7.282 7.282 0 00-.758-.806l-.028-.026a1.908 1.908 0 00-.315-.237 2.708 2.708 0 00-.455-.25c-.202-.09-.367-.127-.476-.133-.108-.006-.19.014-.272.03-.11.023-.24.068-.36.118-.24.102-.446.23-.578.355-.09.085-.152.18-.194.299-.034.097-.04.196-.032.286.01.107.035.18.054.226.172.445.444.88.725 1.284.116.166.254.334.4.5.113.128.222.241.322.348.164.174.526.539.81.812l.036.035c.436.421.88.797 1.03.926l.006.006c.254.217.508.392.772.534.232.124.496.224.782.238.1.005.204-.003.306-.03.003 0 .006-.003.01-.004.032-.008.065-.012.1-.02.19-.052.349-.151.46-.27.064-.07.108-.148.136-.224l.005-.014c.048-.13.064-.276.075-.415.014-.196.018-.415.03-.64l.001-.007c.014-.256.034-.502.11-.692.05-.126.117-.24.198-.35.09-.12.25-.291.443-.44.09-.07.187-.135.289-.196.064-.038.183-.095.306-.148.057-.024.115-.049.172-.073l.002-.001c.137-.057.29-.12.424-.2.146-.089.229-.199.285-.32.054-.115.075-.24.07-.378-.008-.211-.095-.444-.172-.622a2.769 2.769 0 00-.079-.175c-.026-.055-.045-.092-.065-.124-.095-.148-.204-.274-.324-.388-.226-.215-.474-.382-.685-.53-.145-.101-.32-.2-.498-.286-.232-.112-.48-.195-.688-.287-.134-.06-.336-.124-.492-.196-.12-.056-.304-.153-.436-.283-.108-.108-.192-.243-.238-.412-.044-.17-.017-.346.017-.502.038-.172.104-.33.184-.478.06-.11.158-.256.29-.39.146-.148.293-.266.44-.37.2-.142.404-.256.612-.351.234-.107.474-.19.71-.26.345-.101.695-.172 1.037-.235.382-.07.758-.119 1.117-.163.332-.04.653-.077.924-.147.143-.036.278-.08.396-.148.106-.06.245-.172.321-.322.071-.14.104-.294.094-.452-.013-.217-.11-.404-.224-.53-.085-.095-.196-.157-.324-.198a1.399 1.399 0 00-.117-.03c-.056-.012-.112-.018-.165-.022z" />
        </svg>
      )}
      {platform === 'twitter' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DA1F2">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )}
      {platform === 'copy' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(243,233,207,0.7)' }}>
        {platform === 'whatsapp' && 'WhatsApp'}
        {platform === 'telegram' && 'Telegram'}
        {platform === 'twitter' && 'X / Twitter'}
        {platform === 'copy' && 'Copy Link'}
      </span>
    </motion.button>
  );
}

export default function BetSuccessOverlay({
  bet,
  onClose,
  onViewBet,
  onGoHistory,
  onCopy,
  onShare,
  onRebook,
  onReturn,
  onLoadCode,
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [toast, setToast] = useState(null);
  const closeTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const [showTicketActions, setShowTicketActions] = useState(false);

  useEffect(() => {
    if (!bet) return;
    requestAnimationFrame(() => setVisible(true));
    closeTimerRef.current = setTimeout(() => setCanClose(true), 3000);
    const t2 = setTimeout(() => setShowTicketActions(true), 2800);
    return () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(t2);
    };
  }, [bet]);

  const handleClose = useCallback(() => {
    if (!canClose) return;
    setExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setToast(null);
      onClose?.();
    }, 300);
  }, [canClose, onClose]);

  const handleCopyCode = useCallback((code) => {
    navigator.clipboard.writeText(code).then(() => {
      setToast('Booking code copied successfully');
      setTimeout(() => setToast(null), 2000);
      onCopy?.(code);
    }).catch(() => {});
  }, [onCopy]);

  if (!bet) return null;

  const code = bet.bookingCode || toBookingCode(bet.id);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/code/${code}` : `/code/${code}`;
  const formatShareDate = (iso) => formatDate(iso);
  const selectionsCount = bet.legs?.length || 1;
  const selectionsLabel = selectionsCount === 1 ? '1 Selection' : `${selectionsCount} Selections`;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
  };

  const codeCardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.85 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { type: 'spring', stiffness: 180, damping: 16, delay: 2.2 },
    },
  };

  const titleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 1.3, duration: 0.4 } },
  };

  const subVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { delay: 1.5, duration: 0.4 } },
  };

  const detailVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 1.8 },
    },
  };

  const detailItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const actionVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { delay: 2.8, duration: 0.4 } },
  };

  return (
    <AnimatePresence>
      {visible && !exiting ? (
        <motion.div
          className="bso-overlay"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bso-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 40%, rgba(26, 19, 0, 0.95), rgba(0, 0, 0, 0.98))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }} />

          <Sparkles />
          <LightRays />

          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
            {Array.from({ length: 48 }).map((_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>

          <ParticleBurst />

          <motion.div
            className="bso-card"
            variants={codeCardVariants}
            initial="hidden"
            animate="visible"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', zIndex: 2,
              width: 'min(460px, 100%)', maxHeight: '100%',
              overflowY: 'auto', borderRadius: 24, padding: '32px 24px 24px',
              background: 'radial-gradient(500px 200px at 80% -10%, rgba(232,185,74,0.1), transparent 60%), linear-gradient(180deg, #161513 0%, #0a0a0a 100%)',
              boxShadow: '0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(232,185,74,0.2) inset, 0 0 48px rgba(232,185,74,0.05)',
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              textAlign: 'center', color: '#f3e9cf',
              scrollbarWidth: 'thin',
            }}
          >
            <CheckmarkAnimation />

            <motion.h2
              id="bso-title"
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.015em' }}
            >
              Bet Placed Successfully!
            </motion.h2>

            <motion.p
              variants={subVariants}
              initial="hidden"
              animate="visible"
              style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(243,233,207,0.6)' }}
            >
              Your bet has been confirmed on the blockchain
            </motion.p>

            <motion.div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}
              variants={titleVariants}
              initial="hidden"
              animate="visible"
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(247,201,72,0.6)', letterSpacing: '0.08em' }}>STAKE</span>
              <span style={{
                fontSize: 42, fontWeight: 900, letterSpacing: '-0.025em',
                background: 'linear-gradient(110deg, #e8b94a 25%, #fff7d6 50%, #e8b94a 75%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 6px 28px rgba(232,185,74,0.35))',
              }}>
                GHS {fmt(bet.stake)}
              </span>
            </motion.div>

            <motion.div
              variants={subVariants}
              initial="hidden"
              animate="visible"
              style={{ fontSize: 12, color: 'rgba(243,233,207,0.5)', marginBottom: 4 }}
            >
              {bet.totalOdds ? `${bet.totalOdds.toFixed(2)}x` : ''} odds &middot; {bet.mode || 'single'} &middot; {selectionsLabel}
            </motion.div>

            {/* Booking Code Card */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 2.4 }}
              style={{
                margin: '12px 0 16px', padding: '16px 20px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(232,185,74,0.08) 0%, rgba(232,185,74,0.02) 100%)',
                border: '1px solid rgba(232,185,74,0.2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at 50% 0%, rgba(232,185,74,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(243,233,207,0.4)', marginBottom: 6, textTransform: 'uppercase' }}>
                Booking Code
              </div>
              <div style={{
                fontSize: 28, fontWeight: 900,
                letterSpacing: '0.14em',
                fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                color: '#f7c948',
                textShadow: '0 0 30px rgba(247,201,72,0.2)',
                marginBottom: 12,
              }}>
                {code}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #f7c948 0%, #d4a72c 100%)',
                    color: '#1a1300', fontWeight: 700, fontSize: 12,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                  onClick={() => handleCopyCode(code)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Code
                </motion.button>
                {onLoadCode && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(232,185,74,0.3)',
                      background: 'rgba(232,185,74,0.08)',
                      color: '#f7c948', fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6, fontFamily: 'inherit',
                    }}
                    onClick={() => { onLoadCode?.(bet); handleClose(); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Load Code
                  </motion.button>
                )}
              </div>

              {/* Glow effect */}
              <motion.div
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '120%', height: '120%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(232,185,74,0.04) 0%, transparent 60%)',
                  pointerEvents: 'none',
                }}
                animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
              />
            </motion.div>

            {/* Bet Details Grid */}
            <motion.div
              variants={detailVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 8, marginBottom: 16,
              }}
            >
              <motion.div variants={detailItemVariants} style={{
                background: 'rgba(232,185,74,0.04)', border: '1px solid rgba(232,185,74,0.1)',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,233,207,0.45)' }}>Ticket ID</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'rgba(243,233,207,0.7)',
                  fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums',
                }}>
                  {bet.id?.slice(-8) || '—'}
                </span>
              </motion.div>
              <motion.div variants={detailItemVariants} style={{
                background: 'rgba(232,185,74,0.04)', border: '1px solid rgba(232,185,74,0.1)',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,233,207,0.45)' }}>Status</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f7c948' }}>Open ✓</span>
              </motion.div>
              <motion.div variants={detailItemVariants} style={{
                background: 'rgba(232,185,74,0.04)', border: '1px solid rgba(232,185,74,0.1)',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,233,207,0.45)' }}>Total Odds</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f3e9cf', fontVariantNumeric: 'tabular-nums' }}>
                  {bet.totalOdds?.toFixed(2) || '—'}x
                </span>
              </motion.div>
              <motion.div variants={detailItemVariants} style={{
                background: 'rgba(232,185,74,0.04)', border: '1px solid rgba(232,185,74,0.1)',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,233,207,0.45)' }}>Pot. Winnings</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f7c948', fontVariantNumeric: 'tabular-nums' }}>
                  GHS {fmt(bet.potentialWin)}
                </span>
              </motion.div>
              <motion.div variants={detailItemVariants} style={{
                background: 'rgba(232,185,74,0.04)', border: '1px solid rgba(232,185,74,0.1)',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
                textAlign: 'left', gridColumn: '1 / -1',
              }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,233,207,0.45)' }}>Placed At</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(243,233,207,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatShareDate(bet.placedAt)}
                </span>
              </motion.div>
            </motion.div>

            {/* Share Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: showTicketActions ? 1 : 0, y: showTicketActions ? 0 : 16 }}
              transition={{ duration: 0.4 }}
              style={{ marginBottom: 16 }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(243,233,207,0.4)', marginBottom: 8, textTransform: 'uppercase' }}>
                Share this ticket
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <ShareButton platform="whatsapp" url={shareUrl} code={code} bet={bet} onCopy={handleCopyCode} onShare={onShare} />
                <ShareButton platform="telegram" url={shareUrl} code={code} bet={bet} onCopy={handleCopyCode} onShare={onShare} />
                <ShareButton platform="twitter" url={shareUrl} code={code} bet={bet} onCopy={handleCopyCode} onShare={onShare} />
                <ShareButton platform="copy" url={shareUrl} code={code} bet={bet} onCopy={handleCopyCode} onShare={onShare} />
              </div>
            </motion.div>

            {/* Save Image */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: showTicketActions ? 1 : 0, y: showTicketActions ? 0 : 16 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{ marginBottom: 16 }}
            >
              <TicketImage bet={bet} code={code} ts={bet.placedAt} formatShareDate={formatShareDate} />
            </motion.div>

            {/* Primary Actions */}
            <motion.div
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '12px 16px', borderRadius: 12, border: 'none',
                  fontWeight: 700, fontSize: 13, letterSpacing: '0.02em',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, #f7c948 0%, #d4a72c 100%)',
                  color: '#1a1300',
                  gridColumn: '1 / -1',
                  boxShadow: '0 10px 24px rgba(232,185,74,0.3)',
                }}
                onClick={() => { onViewBet?.(); handleClose(); }}
              >
                View My Bet
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '10px 12px', borderRadius: 12,
                  border: '1px solid rgba(232,185,74,0.2)',
                  background: 'rgba(232,185,74,0.06)',
                  color: '#f3e9cf', fontWeight: 600, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onClick={() => { onGoHistory?.(); handleClose(); }}
              >
                Bet History
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '10px 12px', borderRadius: 12,
                  border: '1px solid rgba(232,185,74,0.2)',
                  background: 'rgba(232,185,74,0.06)',
                  color: '#f3e9cf', fontWeight: 600, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onClick={() => { onReturn?.(); handleClose(); }}
              >
                Back to Sports
              </motion.button>
            </motion.div>

            {!canClose && (
              <motion.div
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, #f7c948, #b8860b)',
                  transformOrigin: 'left',
                  borderRadius: '0 0 24px 24px',
                }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            )}
          </motion.div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'fixed', bottom: 80, left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '12px 24px', borderRadius: 12,
                  background: '#1a1a1a', color: '#f7c948',
                  fontWeight: 600, fontSize: 13,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(232,185,74,0.2)',
                  zIndex: 10001, fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
