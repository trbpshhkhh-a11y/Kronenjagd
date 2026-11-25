import React from 'react';
import ReactDOM from 'react-dom/client';
// Schriften: Fraunces (Überschriften, Knöpfe – warme Serifenschrift mit optischer Größe) + Plus Jakarta Sans (Text)
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './styles.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { lockViewport } from './lib/noZoom';

registerSW({ immediate: true });
lockViewport();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
