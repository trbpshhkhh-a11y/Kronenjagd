/**
 * App-Gefühl auf Handy, Tablet und Laptop: kein Zoomen und kein Ziehen der ganzen Seite.
 * (Das Viewport-Meta-Tag „user-scalable=no“ wird von iOS ignoriert – deshalb zusätzlich hier.)
 */
export function lockViewport() {
  const block = (e: Event) => e.preventDefault();
  const opts = { passive: false } as AddEventListenerOptions;
  // iOS Safari: Zwei-Finger-Zoom
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, block, opts);
  // Zwei Finger auf dem Bildschirm (Android und iOS)
  document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), opts);
  // Laptop: Strg + Mausrad, Touchpad-Zoom und Strg/Cmd + Plus/Minus/0
  window.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), opts);
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  ausrichtungBeobachten();
}

/** Aktuelle Größe des sichtbaren Bereichs (berücksichtigt Browserleisten) */
export function sichtbar(): { w: number; h: number } {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return { w: w || window.innerWidth, h: h || window.innerHeight };
}

const listeners = new Set<() => void>();
/** Bei jeder Größen-/Ausrichtungsänderung benachrichtigen – auch verzögert, weil Handys die neue Größe oft erst später melden */
export function onViewport(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/**
 * Nach dem Drehen melden manche Handys (v. a. iPhone) die neue Größe verspätet oder lassen die Seite
 * um ein paar Pixel verschoben stehen – dann landet ein Tippen „einen Tick daneben“.
 * Deshalb: Größe mehrfach neu messen, als CSS-Variable setzen und alle Scroll-Versätze zurücksetzen.
 */
function ausrichtungBeobachten() {
  const setzen = () => {
    const { h } = sichtbar();
    document.documentElement.style.setProperty('--app-h', `${h}px`);
    listeners.forEach((f) => f());
  };
  const zuruecksetzen = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // Spiel- und Minispiel-Ansichten passen nach dem Drehen auf den Bildschirm: Versatz entfernen
    document.querySelectorAll<HTMLElement>('.game-screen, .mini-screen, #root').forEach((el) => {
      if (el.scrollHeight <= el.clientHeight + 2) el.scrollTop = 0;
    });
  };
  let timers: number[] = [];
  const gedreht = () => {
    timers.forEach(clearTimeout);
    // Fokus aus Eingabefeldern nehmen (Tastatur verschiebt sonst den sichtbaren Bereich)
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
    timers = [0, 120, 350, 700, 1200].map((ms) => window.setTimeout(() => (setzen(), zuruecksetzen()), ms));
  };
  let lastW = window.innerWidth, lastH = window.innerHeight;
  const groesse = () => {
    setzen();
    // Ausrichtung gewechselt (Breite und Höhe vertauscht)?
    const quer = window.innerWidth > window.innerHeight;
    if (quer !== lastW > lastH) gedreht();
    lastW = window.innerWidth;
    lastH = window.innerHeight;
  };
  window.addEventListener('orientationchange', gedreht);
  (screen.orientation as ScreenOrientation | undefined)?.addEventListener?.('change', gedreht);
  window.addEventListener('resize', groesse);
  window.visualViewport?.addEventListener('resize', groesse);
  setzen();
}
