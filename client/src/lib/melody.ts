/**
 * Melodien selbst erzeugen und (rückwärts) abspielen – ohne Aufnahmen, ohne Internet.
 * Klang: weiches Glockenspiel/Klavier. Rückwärts schwellen die Töne an und brechen ab –
 * der typische „Rückwärts-Klang“.
 */
import { songToene } from '@kronen/shared';
import { serverNow } from './clock';

export interface Melodie {
  bpm: number;
  noten: string;
}

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (ctx && ctx.state !== 'closed') return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  // iPhone/iPad (ab iOS 17): Ton auch bei eingeschaltetem Lautlos-Schalter abspielen
  try {
    const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (as) as.type = 'playback';
  } catch {
    /* nicht unterstützt */
  }
  ctx = new C();
  ctx.onstatechange = () => listeners.forEach((f) => f());
  return ctx;
}

/**
 * Ältere iPhones: Web-Ton bleibt bei Lautlos-Schalter stumm. Ein leiser, endlos laufender
 * <audio>-Ton (gestartet bei einer Berührung) schaltet auf „Medien“ um – dann hört man alles.
 */
let stillerTon: HTMLAudioElement | null = null;
function stillerTonAn() {
  if (stillerTon || typeof Audio === 'undefined') return;
  try {
    const sr = 8000, n = sr / 2;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    el.loop = true;
    el.setAttribute('playsinline', '');
    el.play().then(() => (stillerTon = el)).catch(() => {});
  } catch {
    /* egal */
  }
}

/** Ton freischalten (Browser erlauben Ton erst nach einer Berührung) */
export function unlockAudio() {
  const c = audio();
  if (!c) return;
  if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) stillerTonAn();
  if (c.state === 'running') return;
  c.resume().catch(() => {});
  try {
    // iOS: ein stiller Ton innerhalb der Berührung schaltet frei
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* egal */
  }
}

/** Nach Bildschirmsperre / App-Wechsel den Ton wieder aufnehmen */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

export const audioBereit = () => !!ctx && ctx.state === 'running';
export function onAudioState(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

const cache = new Map<string, { vor: AudioBuffer; rueck: AudioBuffer }>();
const TEILTOENE = [1, 0.45, 0.28, 0.16, 0.09];

/** Melodie einmal berechnen (vorwärts und rückwärts) */
function puffer(m: Melodie): { vor: AudioBuffer; rueck: AudioBuffer } | null {
  const c = audio();
  if (!c) return null;
  const key = m.bpm + '|' + m.noten;
  const hit = cache.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const toene = songToene(m);
  const nachklang = 0.45;
  const gesamt = toene.reduce((s, t) => s + t.sek, 0) + nachklang + 0.1;
  const data = new Float32Array(Math.ceil(gesamt * sr));
  let start = 0;
  for (const t of toene) {
    if (t.hz > 0) {
      const len = t.sek + nachklang;
      const n = Math.floor(len * sr);
      const s0 = Math.floor(start * sr);
      for (let i = 0; i < n && s0 + i < data.length; i++) {
        const x = i / sr;
        const attack = Math.min(1, x / 0.006);
        const release = x > len - 0.06 ? Math.max(0, (len - x) / 0.06) : 1;
        let v = 0;
        for (let k = 0; k < TEILTOENE.length; k++) {
          v += TEILTOENE[k] * Math.exp(-x * (2.4 + k * 1.4)) * Math.sin(2 * Math.PI * t.hz * (k + 1) * x);
        }
        data[s0 + i] += v * attack * release;
      }
    }
    start += t.sek;
  }
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.8 / peak : 1;
  const vor = c.createBuffer(1, data.length, sr);
  const rueck = c.createBuffer(1, data.length, sr);
  const a = vor.getChannelData(0);
  const b = rueck.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    a[i] = data[i] * g;
    b[data.length - 1 - i] = data[i] * g;
  }
  const res = { vor, rueck };
  cache.set(key, res);
  return res;
}

/** Vorab berechnen (z. B. während des Countdowns), damit beim Start nichts ruckelt */
export function vorbereiten(m: Melodie) {
  puffer(m);
}

/** Länge in Sekunden */
export function melodieDauer(m: Melodie) {
  return songToene(m).reduce((s, t) => s + t.sek, 0) + 0.55;
}

/**
 * Melodie zu einer Serverzeit abspielen (alle Geräte gleichzeitig). Liegt der Zeitpunkt
 * schon zurück, wird mittendrin eingestiegen. Liefert eine Stopp-Funktion.
 */
export function abspielen(m: Melodie, opts: { rueckwaerts: boolean; at?: number; lautstaerke?: number }): () => void {
  const p = puffer(m);
  if (!p) return () => {};
  return pufferAbspielen(opts.rueckwaerts ? p.rueck : p.vor, opts);
}

/** gemeinsamer Ton-Kontext (auch für eigene Lieder) */
export const audioContext = () => audio();

/** Einen fertigen Ton-Puffer zu einer Serverzeit abspielen (liegt sie zurück: mittendrin einsteigen) */
export function pufferAbspielen(buf: AudioBuffer, opts: { at?: number; lautstaerke?: number }): () => void {
  const c = audio();
  if (!c) return () => {};
  // pausierter Ton (z. B. nach Bildschirmsperre): wieder aufnehmen
  if (c.state !== 'running') c.resume().catch(() => {});
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = opts.lautstaerke ?? 0.9;
  src.connect(gain).connect(c.destination);
  const delay = opts.at === undefined ? 0 : (opts.at - serverNow()) / 1000;
  try {
    if (delay >= 0) src.start(c.currentTime + delay);
    else if (-delay < buf.duration - 0.2) src.start(c.currentTime, -delay);
    else return () => {};
  } catch {
    return () => {};
  }
  return () => {
    try {
      src.stop();
    } catch {
      /* schon zu Ende */
    }
  };
}
