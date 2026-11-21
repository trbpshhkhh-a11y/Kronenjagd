/** Hilfsfunktionen für Modus 1 (Spielleiter mit physischem Brett). */
import { Rng, randomField, uniqueFields } from './rng';
import { GAME_IDS, GameId, isPlayable } from './games';
import { DeckState, drawIndex } from './deck';
import { teamBonus, individualBonus, zahlenBonus } from './bonus';

export type GameResult =
  | { kind: 'team'; teams: { members: string[] }[]; scores: number[] }
  | { kind: 'einzel'; scores: Record<string, number> }
  | { kind: 'zahlen'; teams: { members: string[] }[]; secret: number; tips: (number | null)[] };

/** Bonusfelder je Spieler aus einem Spielergebnis */
export function computeBonus(r: GameResult): Record<string, number> {
  if (r.kind === 'team') return teamBonus(r.teams, r.scores);
  if (r.kind === 'einzel') return individualBonus(r.scores);
  return teamBonus(r.teams, r.teams.map((_, i) => zahlenBonus(r.secret, r.tips[i])));
}

/** Startfelder: eindeutig, 1..76 */
export const drawStartFields = (rng: Rng, n: number) => uniqueFields(rng, n, 76);

/**
 * Neue Kronenposition: nicht dasselbe Feld wie zuvor und nicht auf ein besetztes Feld.
 * In Modus 1 kennt die App nur die Startfelder (zu Spielbeginn), nicht die späteren Figurpositionen.
 */
export const drawCrownField = (rng: Rng, previous: number | null, occupied: number[] = []) =>
  randomField(rng, 76, [...(previous ? [previous] : []), ...occupied]);

/** Nächstes Spiel vom Stapel (erst wenn alle dran waren, wird neu gemischt) */
export function drawNextGame(deck: DeckState, rng: Rng, playerCount: number): GameId | null {
  const i = drawIndex(deck, rng, (x) => isPlayable(GAME_IDS[x], playerCount));
  return i === null ? null : GAME_IDS[i];
}
