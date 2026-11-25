import React from 'react';
import ReactDOM from 'react-dom/client';
// Schriften: Fraunces (Überschriften, Knöpfe – warme Serifenschrift mit optischer Größe) + Plus Jakarta Sans (Text)
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './styles.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { lockViewport } from './lib/noZoom';
import { unlockAudio } from './lib/melody';

registerSW({ immediate: true });
lockViewport();
// Ton freischalten, sobald irgendwo getippt wird (Browser erlauben Ton erst nach einer Berührung)
document.addEventListener('pointerdown', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
