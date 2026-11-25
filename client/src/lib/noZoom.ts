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
}
