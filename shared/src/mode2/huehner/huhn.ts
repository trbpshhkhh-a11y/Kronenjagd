/**
 * Das eigene Huhn auf dem Handy: Hüpfen, Mitgetragen-Werden und Zusammenstöße.
 * Rein rechnerisch (kein Bildschirm) – so lässt es sich testen und auf jedem Handy gleich ausführen.
 */
import { HuehnerWelt, begehbar, gefahr, traeger, H_COLS, H_HUEPF_MS, H_STRAFE_MS, H_ZURUECK_MAX } from './world';

export type Richtung = 'vor' | 'zurueck' | 'links' | 'rechts';
export type RausGrund = 'auto' | 'zug' | 'wasser';

export type HuhnEvent =
  | { k: 'hop'; row: number; col: number; safe: boolean; neu?: boolean }
  | { k: 'raus'; grund: RausGrund }
  | { k: 'stoss' };

interface Sprung {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  start: number;
}

const BLICK: Record<Richtung, number> = { vor: 0, zurueck: Math.PI, links: Math.PI / 2, rechts: -Math.PI / 2 };

export class Huhn {
  row: number;
  col: number;
  best: number;
  safe: number;
  facing = 0;
  sprung: Sprung | null = null;
  puffer: Richtung | null = null;
  raus: { grund: RausGrund; at: number } | null = null;
  /** Zeitpunkt des letzten Wiedereinstiegs (fürs Blinken) */
  neuAt = -1e9;
  /** Zeitpunkt des letzten „geht nicht“ (Baum, Rand) */
  stossAt = -1e9;
  private last: number | null = null;

  constructor(public welt: HuehnerWelt, start: { row: number; col: number; best: number; safe: number }) {
    this.row = start.row;
    this.col = start.col;
    this.best = start.best;
    this.safe = start.safe;
  }

  /** Hüpfwunsch (Joystick/Tippen). Während eines Sprungs wird genau eine Eingabe gemerkt. */
  wunsch(r: Richtung, now: number): HuhnEvent[] {
    if (this.raus) return [];
    if (this.sprung) {
      this.puffer = r;
      return [];
    }
    return this.springe(r, now);
  }

  private springe(r: Richtung, now: number): HuhnEvent[] {
    this.facing = BLICK[r];
    const dr = r === 'vor' ? 1 : r === 'zurueck' ? -1 : 0;
    const dc = r === 'links' ? -1 : r === 'rechts' ? 1 : 0;
    const toRow = this.row + dr;
    const ziel = this.welt.row(toRow);
    let toCol = this.col + dc;
    // Auf festem Boden (und Seerosen) immer genau auf ein Feld
    if (ziel.type !== 'fluss' || ziel.pads) toCol = Math.round(toCol);
    const zuWeitZurueck = toRow < 0 || toRow < this.best - H_ZURUECK_MAX;
    if (zuWeitZurueck || toCol < -0.01 || toCol > H_COLS - 0.99 || !begehbar(ziel, toCol)) {
      this.stossAt = now;
      return [{ k: 'stoss' }];
    }
    this.sprung = { fromRow: this.row, fromCol: this.col, toRow, toCol, start: now };
    return [];
  }

  /** Zeit voranschreiten lassen. now = Serverzeit (ms), t = Spielzeit (s) */
  update(now: number, t: number): HuhnEvent[] {
    const dt = this.last === null ? 0 : Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    const ev: HuhnEvent[] = [];
    if (this.raus) {
      if (now - this.raus.at >= H_STRAFE_MS) {
        // Wiedereinstieg auf der letzten sicheren Wiese, auf dem nächsten freien Feld
        this.raus = null;
        this.sprung = null;
        this.puffer = null;
        this.row = this.safe;
        const r = this.welt.row(this.row);
        const c0 = Math.max(0, Math.min(H_COLS - 1, Math.round(this.col)));
        let c = c0;
        for (let d = 0; d < H_COLS; d++) {
          if (begehbar(r, c0 + d)) { c = c0 + d; break; }
          if (begehbar(r, c0 - d)) { c = c0 - d; break; }
        }
        this.col = c;
        this.facing = 0;
        this.neuAt = now;
        ev.push({ k: 'hop', row: this.row, col: this.col, safe: true, neu: true });
      }
      return ev;
    }
    const sp = this.sprung;
    if (sp) {
      const p = (now - sp.start) / H_HUEPF_MS;
      if (p < 1) {
        // Mitten im Sprung kann einen ein Auto oder Zug erwischen
        const inRow = p < 0.5 ? sp.fromRow : sp.toRow;
        const col = sp.fromCol + (sp.toCol - sp.fromCol) * p;
        const g = gefahr(this.welt.row(inRow), col, t);
        if (g === 'auto' || g === 'zug') return this.rausmit(g, now, inRow, col);
        return ev;
      }
      this.sprung = null;
      this.row = sp.toRow;
      this.col = sp.toCol;
      if (this.row > this.best) this.best = this.row;
      const grass = this.welt.row(this.row).type === 'gras';
      if (grass) this.safe = this.row;
      ev.push({ k: 'hop', row: this.row, col: Math.round(this.col * 100) / 100, safe: grass });
    }
    const row = this.welt.row(this.row);
    // Auf einem Stamm wird man mitgetragen – bis zum Rand
    const tr = traeger(row, this.col, t);
    if (tr && tr.speed) {
      this.col += tr.speed * dt;
      if (this.col < -0.45 || this.col > H_COLS - 0.55) return [...ev, ...this.rausmit('wasser', now, this.row, this.col)];
    }
    const g = gefahr(row, this.col, t);
    if (g) return [...ev, ...this.rausmit(g, now, this.row, this.col)];
    if (!this.sprung && this.puffer) {
      const r = this.puffer;
      this.puffer = null;
      ev.push(...this.springe(r, now));
    }
    return ev;
  }

  private rausmit(grund: RausGrund, now: number, row: number, col: number): HuhnEvent[] {
    this.sprung = null;
    this.puffer = null;
    this.row = row;
    this.col = col;
    this.raus = { grund, at: now };
    return [{ k: 'raus', grund }];
  }

  /** Darstellung: Position (Reihe/Spalte als Kommazahl), Sprunghöhe 0–1 */
  pose(now: number): { row: number; col: number; lift: number } {
    const sp = this.sprung;
    if (!sp) return { row: this.row, col: this.col, lift: 0 };
    const p = Math.min(1, (now - sp.start) / H_HUEPF_MS);
    return { row: sp.fromRow + (sp.toRow - sp.fromRow) * p, col: sp.fromCol + (sp.toCol - sp.fromCol) * p, lift: Math.sin(Math.PI * p) };
  }
}
