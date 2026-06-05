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
