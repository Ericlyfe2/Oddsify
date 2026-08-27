import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './providers/ThemeProvider.jsx';
import { TokensProvider } from './components/odd/tokens.jsx';
import './styles/app.css';
import './styles/login.css';
import './styles/admin.css';
import './styles/games.css';

// Vite fires this when a lazy-loaded chunk 404s because the deployed build
// moved on since this tab loaded index.html (new hashed filenames replaced
// the old ones). A single reload fetches the current index.html, which
// points at the chunks that actually exist — self-heals instead of leaving
// the user on a crashed page. Guarded so a genuinely offline/broken load
// doesn't reload forever.
window.addEventListener('vite:preloadError', () => {
  const key = 'betnexa:chunk-reload-at';
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <TokensProvider>
          <App />
        </TokensProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
