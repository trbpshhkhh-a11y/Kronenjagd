import boardJson from '../../client/src/board/board.json';

export type FieldType = 'normal' | 'plus2' | 'minus2' | 'ereignis' | 'wiederholung' | 'minispiel';

export interface BoardField {
  id: number;
  /** Mittelpunkt in Prozent der Bildbreite */
  x: number;
  /** Mittelpunkt in Prozent der Bildhöhe */
  y: number;
  type: FieldType;
  /** Nachfolger in Vorwärtsrichtung (mehrere = Abzweigung) */
  next: number[];
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
  next: Map<number, number[]>;
  prev: Map<number, number[]>;
}

export function makeBoard(data: BoardData): Board {
  const byId = new Map<number, BoardField>();
  const next = new Map<number, number[]>();
  const prev = new Map<number, number[]>();
  for (const f of data.fields) {
    byId.set(f.id, f);
    next.set(f.id, f.next.slice());
    if (!prev.has(f.id)) prev.set(f.id, []);
  }
  for (const f of data.fields) for (const n of f.next) {
    if (!prev.has(n)) prev.set(n, []);
    prev.get(n)!.push(f.id);
  }
  return { data, byId, next, prev };
}

export const BOARD: Board = makeBoard(boardJson as BoardData);
export const FIELD_COUNT = BOARD.data.fields.length;

export function fieldType(id: number, board: Board = BOARD): FieldType {
  return board.byId.get(id)?.type ?? 'normal';
}

export function fieldsOfType(types: FieldType[], board: Board = BOARD): number[] {
  return board.data.fields.filter((f) => types.includes(f.type)).map((f) => f.id);
}

export type Direction = 'vor' | 'zurueck';

/**
 * Alle möglichen Wege mit genau `steps` Schritten in eine Richtung.
 * Jeder Weg enthält die besuchten Felder ohne das Startfeld (letztes = Ziel).
 * Bei einem Ring gibt es genau einen Weg pro Richtung, bei Abzweigungen mehrere.
 */
export function paths(start: number, steps: number, dir: Direction, board: Board = BOARD): number[][] {
  if (steps <= 0) return [[]];
  const adj = dir === 'vor' ? board.next : board.prev;
  const out: number[][] = [];
  const walk = (pos: number, acc: number[]) => {
    if (acc.length === steps) {
      out.push(acc.slice());
      return;
    }
    const ns = adj.get(pos) ?? [];
    for (const n of ns) {
      acc.push(n);
      walk(n, acc);
      acc.pop();
    }
  };
  walk(start, []);
  return out.length > 32 ? out.slice(0, 32) : out;
}

export interface MoveOption {
  key: string;
  dir: Direction;
  path: number[];
  target: number;
  label: string;
}

/** Wahlmöglichkeiten für einen Zug (vorwärts / rückwärts, ggf. mit Ästen). */
export function moveOptions(start: number, steps: number, board: Board = BOARD): MoveOption[] {
  const res: MoveOption[] = [];
  for (const dir of ['vor', 'zurueck'] as Direction[]) {
    const ps = paths(start, steps, dir, board);
    ps.forEach((p, i) => {
      if (p.length === 0) return;
      res.push({
        key: `${dir}-${i}`,
        dir,
        path: p,
        target: p[p.length - 1],
        label: (dir === 'vor' ? 'Vorwärts' : 'Rückwärts') + (ps.length > 1 ? ` (Weg ${i + 1})` : ''),
      });
    });
  }
  return res;
}

/** Ein Weg mit n Schritten in eine Richtung (erster Ast). */
export function simplePath(start: number, steps: number, dir: Direction, board: Board = BOARD): number[] {
  return paths(start, steps, dir, board)[0] ?? [];
}

export function opposite(dir: Direction): Direction {
  return dir === 'vor' ? 'zurueck' : 'vor';
}
