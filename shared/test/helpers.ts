import { createGameState, addPlayer, startGame, tick, GameState, seededRng, Rng } from '../src';

export function setup(n = 4, seed = 1): { s: GameState; rng: Rng; t: { now: number } } {
  const rng = seededRng(seed);
  const s = createGameState('ABCDE', 0);
  for (let i = 0; i < n; i++) addPlayer(s, 'Spieler' + (i + 1), 'p' + (i + 1), 'tok' + (i + 1), 0);
  const t = { now: 0 };
  startGame(s, { rng, now: t.now });
  return { s, rng, t };
}

/** Zeit vorspulen und ticken */
export function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 100) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}
