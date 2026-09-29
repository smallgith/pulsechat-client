import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('SW ✓', reg.scope);
        // check for updates
        reg.onupdatefound = () => {
          const installing = reg.installing;
          installing.onstatechange = () => {
            if (installing.state === 'activated' && navigator.serviceWorker.controller) {
              console.log('New SW active — refresh to update');
            }
          };
        };
      })
      .catch((err) => console.warn('SW ✗', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);