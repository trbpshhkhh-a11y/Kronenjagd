import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
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
