/** Austauschbarer Zufallsgenerator: liefert Zahlen in [0, 1). */
export type Rng = () => number;

/** Echter Zufall über crypto.getRandomValues (Browser und Node 18+). */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

/** Deterministischer Generator (mulberry32) für Tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ganze Zahl in [min, max] (inklusive). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: leere Liste');
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates-Shuffle (liefert neue Liste). */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** n verschiedene Elemente aus arr ziehen. */
export function pickUnique<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  if (n > arr.length) throw new Error('pickUnique: zu wenige Elemente');
  return shuffle(rng, arr).slice(0, n);
}

/** Zufälliges Feld 1..max, optional unter Ausschluss bestimmter Felder. */
export function randomField(rng: Rng, max = 76, exclude: Iterable<number> = []): number {
  const ex = new Set(exclude);
  const options: number[] = [];
  for (let i = 1; i <= max; i++) if (!ex.has(i)) options.push(i);
  return pick(rng, options);
}

/** Eindeutige Startfelder für n Spieler. */
export function uniqueFields(rng: Rng, n: number, max = 76, exclude: Iterable<number> = []): number[] {
  const ex = new Set(exclude);
  const options: number[] = [];
  for (let i = 1; i <= max; i++) if (!ex.has(i)) options.push(i);
  return pickUnique(rng, options, n);
}
