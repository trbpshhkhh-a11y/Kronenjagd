import { Rng, shuffle, pickUnique } from './rng';
import { DeckState, newDeck, drawIndex, drawMany } from './deck';
import { SCHAETZFRAGEN, WISSEN, BEGRIFFE, KATEGORIEN, GEGENSTAENDE, Schaetzfrage, WissenFrage, Gegenstand } from './content';

/** Sitzungs-Stapel aller Inhalte: Ziehen ohne Wiederholung, leer -> neu mischen. */
export interface PoolState {
  schaetzen: DeckState;
  wissen: DeckState;
  begriffe: DeckState;
  kategorien: DeckState;
  gegenstaende: DeckState;
}

export function newPools(): PoolState {
  return {
    schaetzen: newDeck(SCHAETZFRAGEN.length),
    wissen: newDeck(WISSEN.length),
    begriffe: newDeck(BEGRIFFE.length),
    kategorien: newDeck(KATEGORIEN.length),
    gegenstaende: newDeck(GEGENSTAENDE.length),
  };
}

/** Falls sich die Poolgröße (z. B. durch Erweiterung) geändert hat, Stapel zurücksetzen. */
export function fixPools(p: PoolState | undefined): PoolState {
  const fresh = newPools();
  if (!p) return fresh;
  for (const k of Object.keys(fresh) as (keyof PoolState)[]) if (!p[k] || p[k].size !== fresh[k].size) p[k] = fresh[k];
  return p;
}

export const drawSchaetzfragen = (p: PoolState, rng: Rng, n: number): Schaetzfrage[] => drawMany(p.schaetzen, rng, n).map((i) => SCHAETZFRAGEN[i]);
export const drawWissen = (p: PoolState, rng: Rng, n: number): WissenFrage[] => drawMany(p.wissen, rng, n).map((i) => WISSEN[i]);
export const drawKategorien = (p: PoolState, rng: Rng, n: number): string[] => drawMany(p.kategorien, rng, n).map((i) => KATEGORIEN[i]);
export const drawGegenstaende = (p: PoolState, rng: Rng, n: number): Gegenstand[] => drawMany(p.gegenstaende, rng, n).map((i) => GEGENSTAENDE[i]);
export function drawBegriffe(p: PoolState, rng: Rng, n: number): string[] {
  return drawMany(p.begriffe, rng, n).map((i) => BEGRIFFE[i]);
}
export function drawBegriff(p: PoolState, rng: Rng): string {
  const i = drawIndex(p.begriffe, rng);
  return BEGRIFFE[i ?? 0];
}

/** Ablenker für Gegenstände merken: Gegenstände, die nicht in der Auswahl sind */
export function distractors(rng: Rng, exclude: Gegenstand[], n: number): Gegenstand[] {
  const ex = new Set(exclude.map((g) => g.emoji));
  return pickUnique(rng, GEGENSTAENDE.filter((g) => !ex.has(g.emoji)), n);
}

/** Antwortoptionen (4, gemischt) für eine Wissensfrage */
export function wissenOptions(rng: Rng, q: WissenFrage): string[] {
  return shuffle(rng, [q.antwort, ...q.falsch]);
}

/** Buchstaben für Stadt Land Fluss (ohne schwierige wie Q, X, Y, C, J, Ä, Ö, Ü) */
export const SLF_BUCHSTABEN = 'ABDEFGHIKLMNOPRSTUVWZ'.split('');
