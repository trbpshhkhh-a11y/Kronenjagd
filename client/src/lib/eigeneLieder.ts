/**
 * Eigene Lieder: Musikdateien bleiben auf diesem Gerät (IndexedDB) und werden nur hier abgespielt.
 * Zum Server geht nur die Titelliste (zum Prüfen der Antworten).
 */
import { audioContext } from './melody';

export interface LiedMeta {
  id: string;
  titel: string;
  kuenstler: string;
  /** Start des Ausschnitts (Sekunden) */
  start: number;
  /** Länge des Ausschnitts (Sekunden) */
  laenge: number;
  /** Gesamtlänge der Datei (Sekunden) */
  gesamt: number;
  dateiname: string;
}

interface LiedEintrag extends LiedMeta {
  blob: Blob;
}

const DB = 'kj_eigene_lieder';
const STORE = 'lieder';
export const AUSSCHNITT_STANDARD = 12;

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

const meta = ({ blob: _b, ...m }: LiedEintrag): LiedMeta => m;

export async function liederLaden(): Promise<LiedMeta[]> {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) as LiedEintrag[];
    return all.map(meta).sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
  } catch {
    return [];
  }
}

export async function liedSpeichern(m: LiedMeta) {
  const alt = (await tx('readonly', (s) => s.get(m.id))) as LiedEintrag | undefined;
  if (!alt) return;
  await tx('readwrite', (s) => s.put({ ...alt, ...m }));
  vergessen(m.id);
}

export async function liedLoeschen(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  vergessen(id);
}

/** Titel/Künstler aus ID3-Angaben (MP3) oder dem Dateinamen („Künstler - Titel.mp3“) */
async function liedAngaben(file: File): Promise<{ titel: string; kuenstler: string }> {
  const id3 = await id3Lesen(file).catch(() => null);
  if (id3?.titel) return { titel: id3.titel, kuenstler: id3.kuenstler ?? '' };
  const name = file.name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/_/g, ' ').replace(/^\d{1,3}[\s.\-_]+/, '').trim();
  const teile = name.split(/\s[-–]\s/);
  if (teile.length >= 2) return { kuenstler: teile[0].trim(), titel: teile.slice(1).join(' - ').trim() };
  return { titel: name, kuenstler: '' };
}

/** Musikdateien hinzufügen. Liefert die neuen Lieder (fehlerhafte Dateien werden übersprungen). */
export async function liederHinzufuegen(files: File[], onFortschritt?: (fertig: number, gesamt: number) => void): Promise<{ neu: LiedMeta[]; fehler: string[] }> {
  const neu: LiedMeta[] = [];
  const fehler: string[] = [];
  let i = 0;
  for (const file of files) {
    onFortschritt?.(i++, files.length);
    try {
      const buf = await dekodieren(file);
      const { titel, kuenstler } = await liedAngaben(file);
      const gesamt = buf.duration;
      const laenge = Math.min(AUSSCHNITT_STANDARD, Math.max(4, gesamt - 1));
      // Standard: ab etwa einem Drittel (oft Refrain), bei kurzen Dateien vom Anfang
      const start = Math.max(0, Math.min(gesamt - laenge, Math.round(gesamt * 0.33)));
      const m: LiedMeta = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), titel: titel.slice(0, 80) || 'Unbekannt', kuenstler: kuenstler.slice(0, 60), start, laenge, gesamt, dateiname: file.name };
      await tx('readwrite', (s) => s.put({ ...m, blob: file } as LiedEintrag));
      voll.set(m.id, buf);
      neu.push(m);
    } catch {
      fehler.push(file.name);
    }
  }
  onFortschritt?.(files.length, files.length);
  return { neu, fehler };
}

/* --------------------------- Dekodieren & Ausschnitt --------------------------- */

/** nur wenige ganze Lieder im Speicher halten (dekodiert sind sie groß) */
const voll = new Map<string, AudioBuffer>();
const ausschnitte = new Map<string, { key: string; vor: AudioBuffer; rueck: AudioBuffer }>();

function vergessen(id: string) {
  voll.delete(id);
  ausschnitte.delete(id);
}

async function dekodieren(blob: Blob): Promise<AudioBuffer> {
  const c = audioContext();
  if (!c) throw new Error('Kein Ton verfügbar');
  const data = await blob.arrayBuffer();
  return await new Promise<AudioBuffer>((res, rej) => {
    // ältere Safari-Versionen kennen nur die Callback-Form
    const p = c.decodeAudioData(data, res, rej);
    if (p && typeof (p as Promise<AudioBuffer>).then === 'function') (p as Promise<AudioBuffer>).then(res, rej);
  });
}

async function volleDatei(id: string): Promise<AudioBuffer> {
  const hit = voll.get(id);
  if (hit) return hit;
  const e = (await tx('readonly', (s) => s.get(id))) as LiedEintrag | undefined;
  if (!e) throw new Error('Lied nicht auf diesem Gerät');
  const buf = await dekodieren(e.blob);
  voll.set(id, buf);
  // höchstens 3 ganze Lieder behalten
  while (voll.size > 3) voll.delete(voll.keys().next().value as string);
  return buf;
}

/** Ausschnitt (vorwärts und rückwärts) – mit kurzem Ein-/Ausblenden gegen Knacken */
export async function ausschnitt(id: string, start?: number, laenge?: number): Promise<{ vor: AudioBuffer; rueck: AudioBuffer; meta: LiedMeta }> {
  const e = (await tx('readonly', (s) => s.get(id))) as LiedEintrag | undefined;
  if (!e) throw new Error('Lied nicht auf diesem Gerät');
  const st = start ?? e.start;
  const ln = laenge ?? e.laenge;
  const key = `${st}|${ln}`;
  const hit = ausschnitte.get(id);
  if (hit && hit.key === key) return { vor: hit.vor, rueck: hit.rueck, meta: meta(e) };
  const c = audioContext()!;
  const src = await volleDatei(id);
  const sr = src.sampleRate;
  const s0 = Math.max(0, Math.floor(st * sr));
  const n = Math.max(1, Math.min(src.length - s0, Math.floor(ln * sr)));
  const vor = c.createBuffer(src.numberOfChannels, n, sr);
  const rueck = c.createBuffer(src.numberOfChannels, n, sr);
  const fade = Math.floor(sr * 0.04);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch).subarray(s0, s0 + n);
    const v = vor.getChannelData(ch);
    const r = rueck.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const g = Math.min(1, i / fade, (n - 1 - i) / fade);
      v[i] = a[i] * g;
      r[n - 1 - i] = a[i] * g;
    }
  }
  ausschnitte.set(id, { key, vor, rueck });
  return { vor, rueck, meta: meta(e) };
}

/** Für die Lobby: nur Titel + Länge (das geht an den Server) */
export const fuerServer = (l: LiedMeta[]) => l.map((m) => ({ id: m.id, titel: m.titel, kuenstler: m.kuenstler, dauer: m.laenge }));

/* --------------------------- ID3 (MP3-Liedangaben) --------------------------- */

async function id3Lesen(file: File): Promise<{ titel?: string; kuenstler?: string } | null> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null; // "ID3"
  const version = head[3];
  const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  const data = new Uint8Array(await file.slice(10, 10 + Math.min(size, 512 * 1024)).arrayBuffer());
  const out: { titel?: string; kuenstler?: string } = {};
  let p = 0;
  while (p + 10 <= data.length) {
    const id = String.fromCharCode(data[p], data[p + 1], data[p + 2], data[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const len = version === 4
      ? ((data[p + 4] & 0x7f) << 21) | ((data[p + 5] & 0x7f) << 14) | ((data[p + 6] & 0x7f) << 7) | (data[p + 7] & 0x7f)
      : (data[p + 4] << 24) | (data[p + 5] << 16) | (data[p + 6] << 8) | data[p + 7];
    if (len <= 0 || p + 10 + len > data.length) break;
    if (id === 'TIT2' || id === 'TPE1') {
      const txt = id3Text(data.subarray(p + 10, p + 10 + len));
      if (id === 'TIT2') out.titel = txt;
      else out.kuenstler = txt;
    }
    p += 10 + len;
  }
  return out;
}

function id3Text(b: Uint8Array): string {
  const enc = b[0];
  const body = b.subarray(1);
  let s: string;
  if (enc === 1 || enc === 2) {
    const le = enc === 1 && body[0] === 0xff && body[1] === 0xfe;
    const start = enc === 1 && ((body[0] === 0xff && body[1] === 0xfe) || (body[0] === 0xfe && body[1] === 0xff)) ? 2 : 0;
    s = new TextDecoder(le || (enc === 1 && start === 0) ? 'utf-16le' : 'utf-16be').decode(body.subarray(start));
  } else if (enc === 3) s = new TextDecoder('utf-8').decode(body);
  else s = new TextDecoder('iso-8859-1').decode(body);
  return s.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
}
