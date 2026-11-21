/**
 * Uhr-Abgleich mit dem Server (über Ping mit Zeitstempeln).
 * offset = Serverzeit − Gerätezeit. Es zählt die Messung mit der kürzesten Laufzeit
 * der letzten Proben, weil sie am genauesten ist.
 */
let offset = 0;
let synced = false;
const samples: { rtt: number; off: number }[] = [];

export function onPong(clientSent: number, serverTime: number) {
  const now = Date.now();
  const rtt = now - clientSent;
  if (rtt < 0 || rtt > 10000) return;
  samples.push({ rtt, off: serverTime - (clientSent + rtt / 2) });
  if (samples.length > 8) samples.shift();
  const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  offset = best.off;
  synced = true;
}

/** Geschätzte Serverzeit in ms */
export const serverNow = () => Date.now() + offset;
export const isSynced = () => synced;
/** Grobe Korrektur aus einem Zustand (falls noch kein Ping zurück ist) */
export function hintServerTime(serverTime: number) {
  if (!synced) offset = serverTime - Date.now();
}
