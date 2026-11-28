import boardJson from '../../client/src/board/board.json';

export type FieldType = 'normal' | 'plus2' | 'minus2' | 'ereignis' | 'wiederholung' | 'minispiel';

export interface BoardField {
  id: number;
  /** Mittelpunkt in Prozent der Bildbreite */
  x: number;
  /** Mittelpunkt in Prozent der Bildhöhe */
  y: number;
  type: FieldType;
  /**
   * Nachbarfelder, die im Bild direkt verbunden sind (ungerichtet).
   * Die Feldnummern sind nur Orientierung, gezogen wird entlang dieser Verbindungen.
   */
  neighbors: number[];
}

export interface BoardData {
  image: string;
  width: number;
  height: number;
  fields: BoardField[];
}

export interface Board {
  data: BoardData;
  byId: Map<number, BoardField>;
  adj: Map<number, number[]>;
}

/** Baut den (ungerichteten) Streckengraphen. Verbindungen werden symmetrisch ergänzt. */
export function makeBoard(data: BoardData): Board {
  const byId = new Map<number, BoardField>();
  const adj = new Map<number, Set<number>>();
  for (const f of data.fields) {
    byId.set(f.id, f);
    if (!adj.has(f.id)) adj.set(f.id, new Set());
  }
  for (const f of data.fields)
    for (const n of f.neighbors ?? []) {
      if (!byId.has(n) || n === f.id) continue;
      adj.get(f.id)!.add(n);
      adj.get(n)!.add(f.id);
    }
  return { data, byId, adj: new Map([...adj].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])) };
}

export const BOARD: Board = makeBoard(boardJson as BoardData);
export const FIELD_COUNT = BOARD.data.fields.length;

export function fieldType(id: number, board: Board = BOARD): FieldType {
  return board.byId.get(id)?.type ?? 'normal';
}

export function fieldsOfType(types: FieldType[], board: Board = BOARD): number[] {
  return board.data.fields.filter((f) => types.includes(f.type)).map((f) => f.id);
}

export const neighbors = (id: number, board: Board = BOARD): number[] => board.adj.get(id) ?? [];
export const areNeighbors = (a: number, b: number, board: Board = BOARD) => neighbors(a, board).includes(b);

/**
 * Felder, auf die man von `pos` aus weiterziehen darf, wenn man von `prev` kommt.
 * - nicht zurück auf `prev`
 * - keine "Ecke abschneiden" an Weichen: das nächste Feld darf nicht direkt neben `prev` liegen
 *   (sonst könnte man an einer Einmündung im Dreieck springen).
 * Ohne `prev` (Zugbeginn) sind alle Nachbarn erlaubt.
 */
export function allowedNext(pos: number, prev: number | null, board: Board = BOARD): number[] {
  const ns = neighbors(pos, board);
  if (prev === null) return ns;
  const ok = ns.filter((n) => n !== prev && !areNeighbors(n, prev, board));
  if (ok.length) return ok;
  // nie umkehren – vor einer Barrikade geht es dann eben nicht weiter
  return ns.filter((n) => n !== prev);
}

/** Richtung von einem Feld zum nächsten, so wie sie im Bild aussieht (8 Richtungen). */
export function directionOf(from: number, to: number, board: Board = BOARD): { label: string; arrow: string; angle: number } {
  const a = board.byId.get(from)!, b = board.byId.get(to)!;
  const dx = (b.x - a.x) * board.data.width;
  const dy = (b.y - a.y) * board.data.height;
  const angle = Math.atan2(-dy, dx); // 0 = rechts, pi/2 = oben
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  const dirs = [
    { label: 'nach rechts', arrow: '➡' },
    { label: 'nach rechts oben', arrow: '↗' },
    { label: 'nach oben', arrow: '⬆' },
    { label: 'nach links oben', arrow: '↖' },
    { label: 'nach links', arrow: '⬅' },
    { label: 'nach links unten', arrow: '↙' },
    { label: 'nach unten', arrow: '⬇' },
    { label: 'nach rechts unten', arrow: '↘' },
  ];
  return { ...dirs[sector], angle };
}

/** Das "geradeste" erlaubte Folgefeld (kleinste Richtungsänderung). */
export function straightNext(pos: number, prev: number | null, board: Board = BOARD): number | null {
  const opts = allowedNext(pos, prev, board);
  if (!opts.length) return null;
  if (prev === null || opts.length === 1) return opts[0];
  const inAngle = directionOf(prev, pos, board).angle;
  const diff = (n: number) => {
    let d = Math.abs(directionOf(pos, n, board).angle - inAngle);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };
  return [...opts].sort((a, b) => diff(a) - diff(b))[0];
}

/** n Schritte ohne Entscheidung: an Weichen wird der geradeste Weg genommen. */
export function autoPath(pos: number, prev: number | null, steps: number, board: Board = BOARD): number[] {
  const out: number[] = [];
  let cur = pos, last = prev;
  for (let i = 0; i < steps; i++) {
    const n = straightNext(cur, last, board);
    if (n === null) break;
    out.push(n);
    last = cur;
    cur = n;
  }
  return out;
}

/**
 * Abschnitt eines Zuges: von `pos` über `first` weiter, bis die Schritte verbraucht sind
 * oder eine Weiche erreicht ist (dort entscheidet der Spieler neu).
 */
export function segment(pos: number, prev: number | null, first: number, steps: number, board: Board = BOARD): number[] {
  const out = [first];
  let last = pos, cur = first;
  while (out.length < steps) {
    const opts = allowedNext(cur, last, board);
    if (opts.length !== 1) break; // Weiche (oder Sackgasse): neu entscheiden
    out.push(opts[0]);
    last = cur;
    cur = opts[0];
  }
  return out;
}

export interface MoveOption {
  key: string;
  /** erstes Feld in diese Richtung */
  first: number;
  /** Felder bis zum Ende dieses Abschnitts (Ziel oder nächste Weiche) */
  path: number[];
  target: number;
  /** true = hier endet der Zug, false = an einer Weiche wird neu entschieden */
  final: boolean;
  label: string;
  arrow: string;
}

/** Wahlmöglichkeiten für die nächsten `steps` Felder ab `pos` (von `prev` kommend). */
export function moveOptions(pos: number, prev: number | null, steps: number, board: Board = BOARD): MoveOption[] {
  return allowedNext(pos, prev, board).map((first) => {
    const path = segment(pos, prev, first, steps, board);
    const d = directionOf(pos, first, board);
    return { key: `n${first}`, first, path, target: path[path.length - 1], final: path.length >= steps, label: d.label, arrow: d.arrow };
  });
}

/** Kürzeste Anzahl Schritte von `from` zu einem der Zielfelder (Infinity, wenn keins erreichbar). */
export function distanceToNearest(from: number, targets: number[], board: Board = BOARD): number {
  const goal = new Set(targets);
  if (goal.size === 0) return Infinity;
  if (goal.has(from)) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const f of frontier)
      for (const n of neighbors(f, board)) {
        if (seen.has(n)) continue;
        if (goal.has(n)) return d;
        seen.add(n);
        next.push(n);
      }
    frontier = next;
  }
  return Infinity;
}

/* ------------------------------------------------------------------ */
/* Barrikade: eine gesperrte Verbindung zwischen zwei Nachbarfeldern    */
/* ------------------------------------------------------------------ */

/** Verbindung zwischen zwei Nachbarfeldern (kleineres Feld zuerst) */
export type Kante = [number, number];

export const kante = (a: number, b: number): Kante => (a < b ? [a, b] : [b, a]);
export const gleicheKante = (k: Kante | null | undefined, a: number, b: number) => !!k && ((k[0] === a && k[1] === b) || (k[0] === b && k[1] === a));

/** Alle Verbindungen des Bretts */
export function alleKanten(board: Board = BOARD): Kante[] {
  const out: Kante[] = [];
  for (const [a, ns] of board.adj) for (const b of ns) if (a < b) out.push([a, b]);
  return out;
}

const ohneCache = new Map<string, Board>();
/** Das Brett, bei dem die Verbindung `k` (Barrikade) fehlt. Ohne Barrikade: das Brett selbst. */
export function boardOhne(k: Kante | null | undefined, board: Board = BOARD): Board {
  if (!k || !areNeighbors(k[0], k[1], board)) return board;
  const key = `${k[0]}-${k[1]}`;
  if (board === BOARD && ohneCache.has(key)) return ohneCache.get(key)!;
  const adj = new Map(board.adj);
  adj.set(k[0], adj.get(k[0])!.filter((n) => n !== k[1]));
  adj.set(k[1], adj.get(k[1])!.filter((n) => n !== k[0]));
  const b: Board = { data: board.data, byId: board.byId, adj };
  if (board === BOARD) ohneCache.set(key, b);
  return b;
}

/** Gibt es von `pos` aus (von `prev` kommend) einen Weg mit genau `steps` Schritten? */
export function kannZiehen(pos: number, prev: number | null, steps: number, board: Board = BOARD): boolean {
  if (steps <= 0) return true;
  for (const n of allowedNext(pos, prev, board)) if (kannZiehen(n, pos, steps - 1, board)) return true;
  return false;
}

/** Längster Weg (höchstens `steps` Felder) ab `pos` – für den Fall, dass man vor einer Barrikade stehen bleibt */
export function laengsterWeg(pos: number, prev: number | null, steps: number, board: Board = BOARD): number[] {
  if (steps <= 0) return [];
  let best: number[] = [];
  for (const n of allowedNext(pos, prev, board)) {
    const w = [n, ...laengsterWeg(n, pos, steps - 1, board)];
    if (w.length > best.length) best = w;
    if (best.length >= steps) break;
  }
  return best;
}

/**
 * Wahlmöglichkeiten für einen Zug, die nicht an einer Barrikade enden.
 * Kommt man in keiner Richtung ganz voran, geht es so weit wie möglich – der Zug endet vor der Barrikade.
 */
export function zugOptionen(pos: number, prev: number | null, steps: number, board: Board = BOARD): MoveOption[] {
  const alle = moveOptions(pos, prev, steps, board);
  const vor = (o: MoveOption) => (o.path.length >= 2 ? o.path[o.path.length - 2] : pos);
  const ok = alle.filter((o) => o.final || kannZiehen(o.target, vor(o), steps - o.path.length, board));
  if (ok.length) return ok;
  return alle.map((o) => {
    const path = [...o.path, ...laengsterWeg(o.target, vor(o), steps - o.path.length, board)];
    return { ...o, path, target: path[path.length - 1], final: true };
  });
}

/** Kürzester Weg von `from` zu `to` (ohne Start), null wenn unerreichbar */
export function kuerzesterWeg(from: number, to: number, board: Board = BOARD): number[] | null {
  if (from === to) return [];
  const prev = new Map<number, number>([[from, from]]);
  let frontier = [from];
  while (frontier.length) {
    const next: number[] = [];
    for (const f of frontier)
      for (const n of neighbors(f, board)) {
        if (prev.has(n)) continue;
        prev.set(n, f);
        if (n === to) {
          const out = [to];
          let c = to;
          while (prev.get(c) !== from) out.unshift((c = prev.get(c)!));
          return out;
        }
        next.push(n);
      }
    frontier = next;
  }
  return null;
}
