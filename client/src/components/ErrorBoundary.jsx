import { Component } from 'react';

// A lazy chunk 404ing because a newer deploy replaced its hashed filename
// looks like an ordinary crash to React, but it isn't recoverable via
// "Try again" — the module just doesn't exist under the old URL anymore.
// One reload fetches the current index.html (pointing at chunks that do
// exist) and self-heals. Guarded against loop with the same key main.jsx's
// vite:preloadError listener uses, so whichever fires first wins.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|Loading chunk .* failed|ChunkLoadError/i;

function isStaleChunkError(error) {
  return CHUNK_ERROR_RE.test(error?.message || '');
}

function reloadOnceForStaleChunk() {
  const key = 'oddsify:chunk-reload-at';
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
    return true;
  }
  return false;
}

// App-wide error boundary. A crash inside any route blanks the screen by
// default in React. This catches the error, logs it to the console (so it
// still shows up in dev), and offers a recoverable fallback the user can
// either retry from or use to escape back to the home page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('[oddsify] uncaught render error:', error, info?.componentStack);
    }
    if (isStaleChunkError(error)) reloadOnceForStaleChunk();
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  goHome = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || 'Something went wrong rendering this view.';
    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'var(--bg, #0b0b0b)',
          color: 'var(--text, #fff)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            padding: 28,
            background: 'var(--surface, #161616)',
            border: '1px solid var(--surface-2, #2a2a2a)',
            borderRadius: 16,
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--danger)',
              fontSize: 32,
            }}
          >
            !
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Something broke</h1>
          <p style={{ margin: '8px 0 20px', fontSize: 13.5, color: 'var(--text-soft, #aaa)', lineHeight: 1.5 }}>
            {msg}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: '11px 18px',
                borderRadius: 10,
                border: '1px solid var(--surface-2, #2a2a2a)',
                background: 'var(--bg, #0b0b0b)',
                color: 'var(--text, #fff)',
                font: 'inherit',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              style={{
                padding: '11px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent, #ffb800)',
                color: 'var(--bg, #0b0b0b)',
                font: 'inherit',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={this.goHome}
              style={{
                padding: '11px 18px',
                borderRadius: 10,
                border: '1px solid var(--surface-2, #2a2a2a)',
                background: 'transparent',
                color: 'var(--text, #fff)',
                font: 'inherit',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </main>
    );
  }
}
