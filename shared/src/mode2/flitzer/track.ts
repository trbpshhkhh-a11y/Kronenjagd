/**
 * Turbo-Flitzer: Rennstrecken (Draufsicht), Fahrphysik und Rundenzählung.
 * Alles rein rechnerisch – der Server rechnet das Rennen, die Handys zeichnen nur.
 */

export const F_W = 1600;
export const F_H = 820;
/** halbe Streckenbreite */
export const F_HALF = 62;
export const F_RUNDEN = 3;
export const F_CAR_R = 17;
export const F_VMAX = 330;
export const F_COUNTDOWN_MS = 4000;
export const F_MAX_MS = 120_000;
export const F_NACH_SIEG_MS = 15_000;
/** Anzahl Kontrollpunkte je Runde (Punkt 0 = Start/Ziel) */
export const F_GATES = 8;

export type Pt = { x: number; y: number };

export interface TrackDef {
  id: number;
  name: string;
  /** Mittellinie (geschlossen, gleichmäßige Abstände), Index 0 = Start/Ziel */
  pts: Pt[];
  /** Fahrtrichtung je Punkt (Radiant, y nach unten) */
  dir: number[];
  len: number;
  gates: number[];
}

/* ----------------------------- Geometrie ----------------------------- */

/** Geschlossener Catmull-Rom-Spline durch die Kontrollpunkte */
function spline(ctrl: Pt[], perSeg = 40): Pt[] {
  const out: Pt[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

/** Vieleck mit abgerundeten Ecken (Radius r) */
function rounded(poly: Pt[], r: number): Pt[] {
  const out: Pt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
    const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    const p = { x: b.x + (ux / lu) * r, y: b.y + (uy / lu) * r };
    const q = { x: b.x + (vx / lv) * r, y: b.y + (vy / lv) * r };
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      // quadratische Bézierkurve p → b → q
      out.push({ x: (1 - t) ** 2 * p.x + 2 * (1 - t) * t * b.x + t * t * q.x, y: (1 - t) ** 2 * p.y + 2 * (1 - t) * t * b.y + t * t * q.y });
    }
  }
  return out;
}

/** Gleichmäßig neu abtasten (Abstand step), beginnend beim Punkt, der start am nächsten liegt */
function resample(raw: Pt[], step: number, start: Pt): Pt[] {
  const n = raw.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.hypot(raw[(i + 1) % n].x - raw[i].x, raw[(i + 1) % n].y - raw[i].y);
  const count = Math.round(total / step);
  const d = total / count;
  const out: Pt[] = [];
  let seg = 0, segPos = 0;
  for (let k = 0; k < count; k++) {
    let want = k * d - segPos;
    for (;;) {
      const a = raw[seg % n], b = raw[(seg + 1) % n];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (want <= l || seg > 4 * n) {
        const t = l ? want / l : 0;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        break;
      }
      want -= l;
      segPos += l;
      seg++;
    }
  }
  let best = 0;
  out.forEach((p, i) => {
    if (Math.hypot(p.x - start.x, p.y - start.y) < Math.hypot(out[best].x - start.x, out[best].y - start.y)) best = i;
  });
  return [...out.slice(best), ...out.slice(0, best)];
}

function makeTrack(id: number, name: string, raw: Pt[], start: Pt, reverse = false): TrackDef {
  let pts = resample(reverse ? [...raw].reverse() : raw, 8, start);
  const n = pts.length;
  const dir = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  pts = pts.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
  let len = 0;
  for (let i = 0; i < n; i++) len += Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].y - pts[i].y);
  const gates = Array.from({ length: F_GATES }, (_, k) => Math.floor((k * n) / F_GATES));
  return { id, name, pts, dir, len, gates };
}

export const TRACKS: TrackDef[] = [
  // 1) Oval – lange Geraden, zwei weite Kurven
  makeTrack(0, 'Eisbahn-Oval', rounded([{ x: 170, y: 140 }, { x: 1430, y: 140 }, { x: 1430, y: 680 }, { x: 170, y: 680 }], 270), { x: 800, y: 680 }, true),
  // 2) S-Kurven – oben und unten Schlangenlinien
  makeTrack(
    1,
    'Lebkuchen-Schlängel',
    spline([
      { x: 190, y: 560 }, { x: 200, y: 250 }, { x: 380, y: 140 }, { x: 560, y: 300 }, { x: 760, y: 160 }, { x: 960, y: 300 },
      { x: 1160, y: 160 }, { x: 1390, y: 230 }, { x: 1430, y: 520 }, { x: 1250, y: 690 }, { x: 800, y: 690 }, { x: 420, y: 700 },
    ]),
    { x: 800, y: 690 },
    true,
  ),
  // 3) L-Kurs – rechtwinklige Kurven
  makeTrack(
    2,
    'Zuckerstangen-L',
    rounded([{ x: 170, y: 130 }, { x: 700, y: 130 }, { x: 700, y: 400 }, { x: 1430, y: 400 }, { x: 1430, y: 690 }, { x: 170, y: 690 }], 120),
    { x: 800, y: 690 },
    true,
  ),
];

/** Nächster Punkt der Mittellinie (Index + Abstand) */
export function nearest(tr: TrackDef, x: number, y: number): { i: number; d: number } {
  let bi = 0, bd = Infinity;
  const p = tr.pts;
  for (let i = 0; i < p.length; i++) {
    const dx = p[i].x - x, dy = p[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(bd) };
}

export const onTrack = (tr: TrackDef, x: number, y: number) => nearest(tr, x, y).d <= F_HALF;

/* ------------------------------ Fahren ------------------------------ */

export interface Car {
  id: string;
  x: number;
  y: number;
  /** Fahrtrichtung (Radiant, y nach unten) */
  a: number;
  v: number;
  /** durchfahrene Kontrollpunkte (erster = Startlinie) */
  gates: number;
  /** Zeit (ms) beim Zieleinlauf */
  finishAt: number | null;
  off: boolean;
}

export interface Steuer {
  /** Joystick-Winkel (mathematisch: 0 = rechts, π/2 = oben) */
  a: number;
  /** Auslenkung 0–1 */
  m: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Startaufstellung: zu zweit nebeneinander hinter der Startlinie */
export function grid(tr: TrackDef, n: number): { x: number; y: number; a: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const row = Math.floor(k / 2);
    const i = (tr.pts.length - 4 - row * 7) % tr.pts.length;
    const p = tr.pts[i];
    const a = tr.dir[i];
    const side = k % 2 ? 1 : -1;
    return { x: p.x - Math.sin(a) * side * 26, y: p.y + Math.cos(a) * side * 26, a };
  });
}

/** Ein Auto einen Zeitschritt bewegen (Lenken, Gas, Ausrollen, Gras bremst) */
export function stepCar(tr: TrackDef, c: Car, s: Steuer, dt: number) {
  const n = nearest(tr, c.x, c.y);
  c.off = n.d > F_HALF;
  let target = 0;
  if (s.m > 0) {
    // absolute Lenkung: Bildschirm-oben = Joystick-oben
    const want = -s.a;
    const diff = wrap(want - c.a);
    const turn = (3.2 + 2.2 * Math.min(1, Math.abs(c.v) / F_VMAX)) * dt;
    c.a = wrap(c.a + Math.max(-turn, Math.min(turn, diff)));
    // in scharfen Kurven automatisch etwas langsamer
    target = s.m * F_VMAX * (0.55 + 0.45 * Math.max(0, Math.cos(diff)));
  }
  if (c.off) target = Math.min(target, F_VMAX * 0.4);
  if (c.v < target) c.v = Math.min(target, c.v + 340 * dt);
  else c.v = Math.max(target, c.v - (s.m > 0 ? 420 : c.off ? 380 : 170) * dt);
  c.x += Math.cos(c.a) * c.v * dt;
  c.y += Math.sin(c.a) * c.v * dt;
  c.x = Math.max(F_CAR_R, Math.min(F_W - F_CAR_R, c.x));
  c.y = Math.max(F_CAR_R, Math.min(F_H - F_CAR_R, c.y));
}

/** Kreis-Zusammenstöße: auseinanderschieben, etwas Tempo verlieren. Autos im Ziel und „durchlässige“ (getrennte Spieler) zählen nicht. */
export function collide(cars: Car[], durch?: Set<string>) {
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.finishAt !== null || b.finishAt !== null) continue;
      if (durch && (durch.has(a.id) || durch.has(b.id))) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 2 * F_CAR_R || d === 0) continue;
      const push = (2 * F_CAR_R - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.v *= 0.9;
      b.v *= 0.9;
    }
}

/** Kontrollpunkte in der richtigen Reihenfolge abhaken; liefert true beim Zieleinlauf */
export function checkGates(tr: TrackDef, c: Car, now: number): boolean {
  if (c.finishAt !== null) return false;
  const gi = tr.gates[c.gates % F_GATES];
  const next = tr.pts[gi];
  // zählt nur in Fahrtrichtung (rückwärts durchfahren gilt nicht)
  if (Math.hypot(next.x - c.x, next.y - c.y) <= F_HALF + 28 && Math.cos(c.a - tr.dir[gi]) > 0) {
    c.gates++;
    if (c.gates >= F_RUNDEN * F_GATES + 1) {
      c.finishAt = now;
      return true;
    }
  }
  return false;
}

/** Runde (1–3), in der das Auto gerade fährt */
export const runde = (c: Car) => Math.min(F_RUNDEN, Math.max(1, Math.floor((c.gates - 1) / F_GATES) + 1));

/** Fortschritt fürs Ranking (Kontrollpunkte + Anteil bis zum nächsten) */
export function fortschritt(tr: TrackDef, c: Car): number {
  if (c.finishAt !== null) return 1e6 - c.finishAt / 1e7;
  const n = tr.pts.length;
  const gi = c.gates % F_GATES;
  const to = tr.gates[gi];
  const from = tr.gates[(gi - 1 + F_GATES) % F_GATES];
  const seg = (to - from + n) % n || n;
  const here = nearest(tr, c.x, c.y).i;
  const done = Math.max(0, Math.min(1, ((here - from + n) % n) / seg));
  return c.gates + (c.gates === 0 ? 0 : done);
}

/** Einfacher Bot-Fahrer: fährt einem Punkt ein Stück voraus auf der Mittellinie hinterher */
export function botSteuer(tr: TrackDef, c: Car, tempo: number, versatz: number, t: number): Steuer {
  const n = tr.pts.length;
  const i = nearest(tr, c.x, c.y).i;
  const ahead = (i + 14) % n;
  const p = tr.pts[ahead];
  const a = tr.dir[ahead];
  const tx = p.x - Math.sin(a) * versatz, ty = p.y + Math.cos(a) * versatz;
  const kurve = Math.abs(wrap(tr.dir[(i + 28) % n] - tr.dir[i]));
  const m = Math.max(0.35, tempo * (kurve > 0.9 ? 0.72 : kurve > 0.5 ? 0.86 : 1) * (0.94 + 0.06 * Math.sin(t * 1.7 + versatz)));
  return { a: -Math.atan2(ty - c.y, tx - c.x), m };
}
