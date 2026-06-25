import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import OddIcon from '../odd/Icon.jsx';
import { Copy, Link, MessageCircle, Send, Globe, MoreHorizontal, ExternalLink } from 'lucide-react';

export default function BookingCodeShareModal({
  isOpen,
  onClose,
  bookingCode,
  generatedAt,
  loadCodeLink,
  shareUrl,
  externalWebsite,
}) {
  const [toast, setToast] = useState(null);
  const [imgSaving, setImgSaving] = useState(false);
  const cardRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bookingCode);
      showToast('Copied to clipboard!');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = bookingCode;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied to clipboard!');
      } catch {
        showToast('Could not copy');
      }
    }
  }, [bookingCode, showToast]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard!');
    } catch {
      showToast('Could not copy link');
    }
  }, [shareUrl, showToast]);

  const saveImage = useCallback(async () => {
    if (!cardRef.current || imgSaving) return;
    setImgSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, pixelRatio: 2 });
      saveAs(dataUrl, `oddsify-${bookingCode}.png`);
    } catch {
      showToast('Could not save image');
    }
    setImgSaving(false);
  }, [bookingCode, imgSaving, showToast]);

  const shareText = useCallback((action) => {
    const text = `I just booked a bet on Oddsify! 🎯\n\nBooking Code: ${bookingCode}\n\nLoad it here: ${shareUrl}`;
    switch (action) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        break;
    }
  }, [bookingCode, shareUrl]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const shareButtons = [
    {
      key: 'save',
      label: 'Save Image',
      icon: <OddIcon name="download" size={20} color="#fff" />,
      bg: '#2a2a2e',
      hoverBg: '#3a3a3e',
      action: saveImage,
    },
    {
      key: 'copyLink',
      label: 'Copy Link',
      icon: <Link size={20} color="#fff" />,
      bg: '#2a2a2e',
      hoverBg: '#3a3a3e',
      action: copyLink,
    },
    {
      key: 'twitter',
      label: 'X',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      bg: '#2a2a2e',
      hoverBg: '#3a3a3e',
      action: () => shareText('twitter'),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      icon: <Send size={20} color="#fff" />,
      bg: '#24A1DE',
      hoverBg: '#1d8bc2',
      action: () => shareText('telegram'),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle size={20} color="#fff" />,
      bg: '#25D366',
      hoverBg: '#20bd5a',
      action: () => shareText('whatsapp'),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          {/* main card */}
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, duration: 0.5 }}
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 20,
              background: `linear-gradient(180deg, #1a1a1e 0%, #121214 100%)`,
              border: '1px solid rgba(232,185,74,0.12)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,185,74,0.06) inset',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ─── TOP HEADER ─── */}
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* left: ring + timestamp */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      border: '3px solid rgba(232,185,74,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8b94a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(243,233,207,0.35)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(generatedAt)}
                  </span>
                </div>

                {/* right: code + copy */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(243,233,207,0.4)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Booking Code
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: 28,
                      fontWeight: 900,
                      fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                      color: '#f3e9cf',
                      letterSpacing: '0.1em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {bookingCode}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      aria-label="Copy booking code"
                      style={{
                        background: 'rgba(232,185,74,0.12)',
                        border: 0,
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#e8b94a',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(232,185,74,0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(232,185,74,0.12)'}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (loadCodeLink) window.open(loadCodeLink, '_blank', 'noopener');
                    }}
                    style={{
                      marginTop: 4,
                      background: 'transparent',
                      border: 0,
                      color: '#e8b94a',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Load Code
                    <ExternalLink size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* ─── DIVIDER ─── */}
            <div style={{ height: 1, background: 'rgba(232,185,74,0.08)', margin: '0 24px' }} />

            {/* ─── SHARE ROW ─── */}
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                {shareButtons.map((btn) => (
                  <motion.button
                    key={btn.key}
                    type="button"
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={btn.action}
                    disabled={imgSaving && btn.key === 'save'}
                    aria-label={btn.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      background: 'transparent',
                      border: 0,
                      cursor: btn.key === 'save' && imgSaving ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: btn.key === 'save' && imgSaving ? 'rgba(232,185,74,0.2)' : btn.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                      }}
                    >
                      {btn.icon}
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'rgba(243,233,207,0.5)',
                      whiteSpace: 'nowrap',
                    }}>
                      {btn.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ─── BOTTOM STICKY NAV BAR ─── */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3, ease: 'easeOut' }}
              style={{
                width: '100%',
                background: '#e8b94a',
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
              }}
            >
              {/* back button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(26,19,0,0.2)',
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#1a1300',
                }}
              >
                <OddIcon name="chevL" size={22} color="#1a1300" strokeWidth={2.5} />
              </button>

              {/* center pill - external website */}
              <button
                type="button"
                onClick={() => {
                  if (externalWebsite) window.open(externalWebsite, '_blank', 'noopener');
                }}
                style={{
                  background: 'rgba(26,19,0,0.2)',
                  border: 0,
                  borderRadius: 999,
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: '#1a1300',
                }}
              >
                <Globe size={16} color="#1a1300" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{externalWebsite || 'oddsify.com'}</span>
                <ExternalLink size={14} color="#1a1300" strokeWidth={2.5} />
              </button>

              {/* menu button */}
              <button
                type="button"
                aria-label="More options"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(26,19,0,0.2)',
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#1a1300',
                }}
              >
                <MoreHorizontal size={22} color="#1a1300" strokeWidth={2.5} />
              </button>
            </motion.div>
          </motion.div>

          {/* ─── TOAST ─── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'fixed',
                  top: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: '#1a1a1e',
                  color: '#e8b94a',
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(232,185,74,0.2)',
                  zIndex: 10001,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
