import { Rng, shuffle } from './rng';

/**
 * Ein serialisierbarer "Stapel" (Shuffle-Bag): Ziehen ohne Wiederholung,
 * erst wenn alles einmal dran war, wird neu gemischt.
 * Gespeichert werden nur Indizes, damit der Zustand in localStorage / JSON passt.
 */
export interface DeckState {
  size: number;
  remaining: number[];
}

export function newDeck(size: number): DeckState {
  return { size, remaining: [] };
}

/** Zieht einen Index. allowed filtert (z. B. nur aktive Spiele); nicht erlaubte bleiben im Stapel. */
export function drawIndex(deck: DeckState, rng: Rng, allowed?: (i: number) => boolean): number | null {
  const ok = allowed ?? (() => true);
  let pos = deck.remaining.findIndex(ok);
  if (pos < 0) {
    const all = shuffle(rng, Array.from({ length: deck.size }, (_, i) => i));
    // Rest (nicht erlaubte) behalten, neu gemischt anhängen
    const rest = deck.remaining.slice();
    deck.remaining = [...all.filter((i) => !rest.includes(i)), ...rest];
    deck.remaining = shuffle(rng, deck.remaining);
    pos = deck.remaining.findIndex(ok);
    if (pos < 0) return null;
  }
  const [idx] = deck.remaining.splice(pos, 1);
  return idx;
}

export function drawMany(deck: DeckState, rng: Rng, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const used = new Set(out);
    const i = drawIndex(deck, rng, (x) => !used.has(x));
    if (i === null) break;
    out.push(i);
  }
  return out;
}
