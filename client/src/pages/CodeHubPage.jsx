/**
 * Booking Code Hub — central screen for everything code-related.
 *
 * Sections:
 *   - Big "Load code" input (validates the 7-char format before sending)
 *   - Loaded-slip preview after a successful lookup (legs / odds / share)
 *   - Recent codes list (localStorage-backed, deduped, capped at 12)
 *   - Share menu (Copy / WhatsApp / Telegram / X / link)
 *
 * Reachable via /codehub (header CTA) or via /code/:code (deep link that
 * auto-fills the input and triggers the lookup immediately).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSlip } from '../providers/SlipProvider.jsx';
import { useToast } from '../providers/AccountProvider.jsx';
import { fmtCedi, useTokens, OddPageHeader, OddIcon } from '../components/odd/primitives.jsx';
import { humanizePick } from '../lib/marketNames.js';

const BOOKING_CODE_RE = /^[A-NP-Z]{2}[1-9]{5}$/;

function shareUrl(code) {
  if (typeof window === 'undefined') return `/code/${code}`;
  return `${window.location.origin}/code/${code}`;
}

function relTimeShort(ts) {
  if (!ts) return '';
  const ms = Date.now() - ts;
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function CodeHubPage() {
  const T = useTokens();
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = useParams();
  const { recentCodes, bookingCodeLookup, lookupLoading, lookupBookingCode, loadFromCode, forgetCode, clearLookup } =
    useSlip();

  const [code, setCode] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const autoLookedUpRef = useRef(null);

  // Deep link: /code/:code → seed the input + run the lookup once.
  useEffect(() => {
    const param = (params.code || '').toUpperCase();
    if (!param || autoLookedUpRef.current === param) return;
    autoLookedUpRef.current = param;
    setCode(param);
    if (BOOKING_CODE_RE.test(param)) {
      lookupBookingCode(param);
    } else {
      toast('Invalid booking-code format.', 'warn');
    }
  }, [params.code, lookupBookingCode, toast]);

  const formatValid = useMemo(() => BOOKING_CODE_RE.test(code), [code]);

  function handleSubmit(e) {
    e?.preventDefault();
    if (!code) return toast('Enter a booking code.', 'warn');
    if (!formatValid) return toast('Format is two letters followed by five digits (e.g. AF36513).', 'warn');
    lookupBookingCode(code);
  }

  async function handleRebook() {
    if (!code) return toast('Enter a booking code.', 'warn');
    const slip = await loadFromCode(code);
    if (slip) navigate('/');
  }

  function copyCode(c) {
    try {
      navigator.clipboard?.writeText(c);
      toast(`Copied ${c}.`, 'success');
    } catch {
      toast('Copy failed — long-press to copy manually.', 'warn');
    }
  }

  function shareTo(target, c) {
    const url = shareUrl(c);
    const text = `Check out this booking code ${c} on Oddsify`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);
    let href = '';
    switch (target) {
      case 'whatsapp':
        href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
        break;
      case 'telegram':
        href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'twitter':
        href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({ title: 'Oddsify booking code', text, url }).catch(() => {});
          return;
        }
        copyCode(url);
        return;
      default:
        return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 140 }}>
      <OddPageHeader title="Booking Code Hub" subtitle="Load, share, and rebook any code." />

      {/* Code input */}
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px 0' }}>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.line}`,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <label style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, letterSpacing: 0.4 }}>BOOKING CODE</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={code}
              onChange={(e) => {
                const cleaned = e.target.value
                  .toUpperCase()
                  .replace(/[^A-NP-Z1-9]/g, '')
                  .slice(0, 7);
                setCode(cleaned);
              }}
              placeholder="e.g. AF36513"
              autoFocus
              spellCheck={false}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              aria-label="Booking code"
              style={{
                flex: 1,
                background: T.surfaceAlt,
                color: T.ink,
                border: `1px solid ${formatValid ? T.greenBright : T.line}`,
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 4,
                textAlign: 'center',
                fontFamily: '"JetBrains Mono", monospace',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>
            7 characters. Two letters then five digits — no 0, no O. The format is checked instantly so a typo never
            costs you a round-trip.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={lookupLoading || !code}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 12,
                background: T.greenBright,
                color: T.goldDark,
                fontWeight: 700,
                fontSize: 14,
                border: 0,
                cursor: lookupLoading ? 'wait' : 'pointer',
                opacity: lookupLoading || !code ? 0.7 : 1,
              }}
            >
              {lookupLoading ? 'Loading…' : 'Load code'}
            </button>
            <button
              type="button"
              onClick={handleRebook}
              disabled={lookupLoading || !code}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                background: 'transparent',
                color: T.ink,
                border: `1px solid ${T.lineStrong}`,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                opacity: lookupLoading || !code ? 0.7 : 1,
              }}
            >
              Rebook
            </button>
          </div>
        </div>
      </form>

      {/* Loaded slip preview */}
      {bookingCodeLookup && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Loaded slip</div>
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: T.greenBright,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {bookingCodeLookup.bookingCode}
                </span>
                <button
                  type="button"
                  onClick={clearLookup}
                  aria-label="Close preview"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: T.inkDim,
                    cursor: 'pointer',
                  }}
                >
                  <OddIcon name="x" size={16} />
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>
                {bookingCodeLookup.legs?.length || 0} leg
                {(bookingCodeLookup.legs?.length || 0) === 1 ? '' : 's'} ·{' '}
                {bookingCodeLookup.mode === 'system' ? bookingCodeLookup.systemLabel : bookingCodeLookup.mode} ·{' '}
                <span style={{ color: T.greenBright, fontWeight: 700 }}>
                  {Number(bookingCodeLookup.totalOdds || 0).toFixed(2)}x
                </span>
                {bookingCodeLookup.stake ? <> · stake GHS {fmtCedi(bookingCodeLookup.stake)}</> : null}
              </div>
            </div>
            {(bookingCodeLookup.legs || []).slice(0, 6).map((leg, i, arr) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  borderBottom: i < arr.length - 1 ? `1px dashed ${T.line}` : 'none',
                  fontSize: 12.5,
                }}
              >
                <div style={{ color: T.ink, fontWeight: 700 }}>
                  {leg.home} <span style={{ color: T.inkDim, fontWeight: 500 }}>vs</span> {leg.away}
                </div>
                <div style={{ color: T.inkSoft, marginTop: 2 }}>
                  {leg.marketName || leg.market} ·{' '}
                  <span style={{ color: T.greenBright, fontWeight: 700 }}>{humanizePick(leg.outcome, leg.home, leg.away)}</span> ·{' '}
                  {Number(leg.odds).toFixed(2)}x
                </div>
              </div>
            ))}
            {(bookingCodeLookup.legs?.length || 0) > 6 && (
              <div style={{ padding: '8px 14px', fontSize: 11, color: T.inkSoft }}>
                + {bookingCodeLookup.legs.length - 6} more selection{bookingCodeLookup.legs.length - 6 === 1 ? '' : 's'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${T.line}` }}>
              <button
                type="button"
                onClick={() => copyCode(bookingCodeLookup.bookingCode)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.surfaceAlt,
                  color: T.ink,
                  border: 0,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.surfaceAlt,
                  color: T.ink,
                  border: 0,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Share
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await loadFromCode(bookingCodeLookup.bookingCode);
                  if (ok) navigate('/');
                }}
                style={{
                  flex: 1.2,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.greenBright,
                  color: T.goldDark,
                  border: 0,
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Rebook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent codes */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Recent codes</div>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.line}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {recentCodes.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: T.inkSoft }}>
              Codes you book, share, or load will show up here so you can rebook them in one tap.
            </div>
          ) : (
            recentCodes.map((entry, i, arr) => (
              <div
                key={entry.code}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      color: T.ink,
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {entry.code}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>
                    {entry.kind === 'booked' ? 'Booked' : 'Loaded'} · {relTimeShort(entry.lastSeenAt)}
                    {entry.legs ? ` · ${entry.legs} leg${entry.legs === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(entry.code)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: T.surfaceAlt,
                    color: T.ink,
                    fontWeight: 700,
                    fontSize: 11,
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setCode(entry.code);
                    const slip = await loadFromCode(entry.code);
                    if (slip) navigate('/');
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: T.greenBright,
                    color: T.goldDark,
                    fontWeight: 700,
                    fontSize: 11,
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  Rebook
                </button>
                <button
                  type="button"
                  onClick={() => forgetCode(entry.code)}
                  aria-label="Remove from recent"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'transparent',
                    color: T.inkDim,
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  <OddIcon name="x" size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Share sheet */}
      {shareOpen && bookingCodeLookup && (
        <>
          <div
            onClick={() => setShareOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--scrim, rgba(0,0,0,0.45))',
              zIndex: 92,
            }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Share booking code"
            style={{
              position: 'fixed',
              left: 8,
              right: 8,
              bottom: 16,
              maxWidth: 560,
              margin: '0 auto',
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 18,
              padding: 16,
              zIndex: 93,
              boxShadow: '0 24px 60px -16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Share {bookingCodeLookup.bookingCode}</div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 0, color: T.inkDim, cursor: 'pointer' }}
              >
                <OddIcon name="x" size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
                { id: 'telegram', label: 'Telegram', color: '#229ED9' },
                { id: 'twitter', label: 'X', color: T.ink },
                { id: 'facebook', label: 'Facebook', color: '#1877F2' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => shareTo(opt.id, bookingCodeLookup.bookingCode)}
                  style={{
                    padding: '10px 0',
                    borderRadius: 12,
                    background: T.surfaceAlt,
                    color: opt.color,
                    border: 0,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => copyCode(shareUrl(bookingCodeLookup.bookingCode))}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.surfaceAlt,
                  color: T.ink,
                  border: 0,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={() => shareTo('native', bookingCodeLookup.bookingCode)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: T.greenBright,
                  color: T.goldDark,
                  border: 0,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                More…
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
