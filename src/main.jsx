import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { I18nProvider } from './i18n/I18nContext.jsx';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker with auto-update
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
