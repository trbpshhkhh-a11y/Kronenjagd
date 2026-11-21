/**
 * Welt für „Hühnerhüpfer“: endlose Reihen nach vorne, deterministisch aus einem Startwert (Seed).
 * Verkehr, Baumstämme und Züge hängen nur von Seed + gemeinsamer Spielzeit ab, damit auf allen
 * Handys exakt dieselben Fahrzeuge an derselben Stelle sind.
 */
import { seededRng, Rng } from '../../rng';

export const H_COLS = 9;
export const H_DAUER_MS = 30000;
export const H_COUNTDOWN_MS = 4000;
export const H_ZURUECK_MAX = 3;
export const H_STRAFE_MS = 2000;
export const H_HUEPF_MS = 120;
export const H_TAKT_MS = 170;
/** Bereich, in dem sich Fahrzeuge bewegen (über den Rand hinaus) */
const RAND = 4;
const LOOP = H_COLS + 2 * RAND;

export type RowType = 'gras' | 'strasse' | 'fluss' | 'gleis';
export type Deko = 'baum' | 'busch' | 'fels';
export type MoverKind = 'auto' | 'lkw' | 'stamm';

export interface Mover {
  x0: number;
  len: number;
  /** Farbe (Index) für bunte Autos */
  color: number;
}

export interface WorldRow {
  type: RowType;
  /** Gras: Hindernisse je Spalte (null = frei) */
  deko?: (Deko | null)[];
  /** Straße/Fluss: Bewegung */
  dir?: 1 | -1;
  speed?: number;
  kind?: MoverKind;
  movers?: Mover[];
  /** Fluss mit Seerosen (statisch) statt Stämmen */
  pads?: number[];
  /** Gleis */
  period?: number;
  phase?: number;
  trainLen?: number;
  trainSpeed?: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export class HuehnerWelt {
  private rows: WorldRow[] = [];
  private rng: Rng;
  private lane = 4;
  private queue: WorldRow[] = [];

  constructor(public seed: number) {
    this.rng = seededRng(seed);
  }

  row(r: number): WorldRow {
    if (r < 0) return { type: 'gras', deko: Array(H_COLS).fill('baum') };
    while (this.rows.length <= r) this.rows.push(this.next(this.rows.length));
    return this.rows[r];
  }

  private next(r: number): WorldRow {
    if (r < 4) return { type: 'gras', deko: this.grasDeko(r === 0 ? 0 : 0.12) };
    if (!this.queue.length) this.segment(r);
    return this.queue.shift()!;
  }

  /** Nächsten Abschnitt planen: etwas Gras, dann ein Hindernis-Abschnitt */
  private segment(r: number) {
    const rng = this.rng;
    const d = Math.min(1, r / 110);
    const grass = 1 + Math.floor(rng() * (d > 0.5 ? 2 : 3));
    // die freie Spalte wandert zwischen den Abschnitten etwas
    this.lane = Math.max(1, Math.min(H_COLS - 2, this.lane + Math.floor(rng() * 3) - 1));
    for (let i = 0; i < grass; i++) this.queue.push({ type: 'gras', deko: this.grasDeko(0.22 + d * 0.1) });
    const x = rng();
    if (x < 0.45) {
      const n = 1 + Math.floor(rng() * (2 + d * 2.5));
      let dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < Math.min(4, n); i++) {
        this.queue.push(this.strasse(d, dir));
        if (rng() < 0.7) dir = dir === 1 ? -1 : 1;
      }
    } else if (x < 0.78) {
      const n = 1 + Math.floor(rng() * 3);
      let dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        this.queue.push(rng() < 0.25 ? this.seerosen() : this.fluss(d, dir));
        dir = dir === 1 ? -1 : 1;
      }
    } else {
      const n = 1 + (rng() < 0.3 ? 1 : 0);
      for (let i = 0; i < n; i++) this.queue.push(this.gleis(d));
    }
  }

  private grasDeko(dichte: number): (Deko | null)[] {
    const rng = this.rng;
    return Array.from({ length: H_COLS }, (_, c) => {
      if (c === this.lane || rng() >= dichte) return null;
      const k = rng();
      return k < 0.55 ? 'baum' : k < 0.8 ? 'busch' : 'fels';
    });
  }

  private strasse(d: number, dir: 1 | -1): WorldRow {
    const rng = this.rng;
    const lkw = rng() < 0.25;
    const len = lkw ? 2 + Math.floor(rng() * 2) : 1;
    const n = Math.max(1, Math.min(4, 1 + Math.floor(rng() * (1.6 + d * 2)) - (lkw ? 1 : 0)));
    const slot = LOOP / n;
    const movers = Array.from({ length: n }, (_, i) => ({ x0: i * slot + rng() * Math.max(0, slot - len - 1.5), len, color: Math.floor(rng() * 6) }));
    return { type: 'strasse', dir, speed: (lkw ? 1.4 : 1.8) + rng() * 1.6 + d * 2.6, kind: lkw ? 'lkw' : 'auto', movers };
  }

  private fluss(d: number, dir: 1 | -1): WorldRow {
    const rng = this.rng;
    const n = 3 + Math.floor(rng() * 2);
    const slot = LOOP / n;
    const movers = Array.from({ length: n }, (_, i) => {
      const len = Math.max(2, Math.min(4, 2 + Math.floor(rng() * 3) - (d > 0.6 ? 1 : 0)));
      return { x0: i * slot + rng() * Math.max(0, slot - len - 1), len, color: 0 };
    });
    return { type: 'fluss', dir, speed: 0.9 + rng() * 0.9 + d * 0.9, kind: 'stamm', movers };
  }

  private seerosen(): WorldRow {
    const rng = this.rng;
    const pads = new Set<number>([this.lane]);
    const n = 2 + Math.floor(rng() * 3);
    while (pads.size < n) pads.add(Math.floor(rng() * H_COLS));
    return { type: 'fluss', pads: [...pads].sort((a, b) => a - b) };
  }

  private gleis(d: number): WorldRow {
    const rng = this.rng;
    const period = 4.5 + rng() * 3.5 - d * 1.2;
    return { type: 'gleis', dir: rng() < 0.5 ? 1 : -1, period, phase: rng() * period, trainLen: 12, trainSpeed: 30 };
  }
}

/** Position (linke Kante, in Spalten) eines Fahrzeugs/Stamms zur Spielzeit t (Sekunden) */
export function moverX(row: WorldRow, m: Mover, t: number): number {
  return mod(m.x0 + (row.dir ?? 1) * (row.speed ?? 0) * t, LOOP) - RAND;
}

/** Zug: linke Kante oder null (nicht im Bild), dazu Warnung (ca. 1 s vorher) */
export function train(row: WorldRow, t: number): { x: number | null; warn: boolean } {
  const period = row.period ?? 6;
  const tau = mod(t + (row.phase ?? 0), period);
  const len = row.trainLen ?? 12;
  const travel = (H_COLS + len + 2) / (row.trainSpeed ?? 30);
  const warn = tau > period - 1.1 || tau < travel;
  if (tau > travel) return { x: null, warn };
  const dist = tau * (row.trainSpeed ?? 30);
  const x = row.dir === -1 ? H_COLS + 1 - dist : -len - 1 + dist;
  return { x, warn };
}

/** Überlappt die Huhn-Breite (Mitte col + 0.5, Breite 0.6) das Intervall [x, x+len]? */
const hits = (col: number, x: number, len: number) => col + 0.8 > x && col + 0.2 < x + len;

/** Ist das Huhn an dieser Stelle zur Zeit t raus? (Straße, Gleis, Wasser) */
export function gefahr(row: WorldRow, col: number, t: number): 'auto' | 'zug' | 'wasser' | null {
  if (row.type === 'strasse') {
    for (const m of row.movers ?? []) if (hits(col, moverX(row, m, t), m.len)) return 'auto';
    return null;
  }
  if (row.type === 'gleis') {
    const tr = train(row, t);
    return tr.x !== null && hits(col, tr.x, row.trainLen ?? 12) ? 'zug' : null;
  }
  if (row.type === 'fluss') return traeger(row, col, t) ? null : 'wasser';
  return null;
}

/** Steht das Huhn auf einem Stamm (oder einer Seerose)? Liefert die Geschwindigkeit, mit der es mitgetragen wird. */
export function traeger(row: WorldRow, col: number, t: number): { speed: number } | null {
  if (row.type !== 'fluss') return null;
  const center = col + 0.5;
  if (row.pads) return row.pads.some((p) => Math.abs(p + 0.5 - center) < 0.45) ? { speed: 0 } : null;
  for (const m of row.movers ?? []) {
    const x = moverX(row, m, t);
    if (center > x + 0.05 && center < x + m.len - 0.05) return { speed: (row.dir ?? 1) * (row.speed ?? 0) };
  }
  return null;
}

/** Kann das Huhn auf dieses Feld hüpfen? (Gras-Hindernisse, Ränder) */
export function begehbar(row: WorldRow, col: number): boolean {
  if (col < 0 || col > H_COLS - 1) return false;
  if (row.type === 'gras') return !row.deko?.[Math.round(col)];
  return true;
}
