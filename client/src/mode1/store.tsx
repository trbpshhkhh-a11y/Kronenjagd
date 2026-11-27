import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { DeckState, GameId, BRETT_GAME_IDS, newDeck, PoolState, fixPools, Team } from '@kronen/shared';
import { load, save, remove } from '../lib/storage';

export interface M1Player {
  id: string;
  name: string;
  kronen: number;
  start: number | null;
  bonus: number;
}

export type M1Phase = 'setup' | 'startDraw' | 'crownDraw' | 'overview' | 'gameDraw' | 'teams' | 'playing' | 'result' | 'winner';

export interface M1Game {
  id: GameId;
  teams: Team<string>[];
  data: any;
}

export interface M1State {
  v: 1;
  phase: M1Phase;
  players: M1Player[];
  crown: number | null;
  kronenZiel: number | null;
  slfTimer: number | null;
  gameDeck: DeckState;
  pools: PoolState;
  game: M1Game | null;
  lastBonus: Record<string, number> | null;
  winner: string | null;
  /** Rückwärts-Songs: Lieder aus der App, eigene Lieder (auf diesem Gerät) oder gemischt */
  songQuelle?: 'app' | 'eigene' | 'beide';
}

const KEY = 'kj_mode1_v1';

export const freshState = (players: M1Player[] = []): M1State => ({
  v: 1,
  phase: 'setup',
  players,
  crown: null,
  kronenZiel: 5,
  slfTimer: 90,
  gameDeck: newDeck(BRETT_GAME_IDS.length),
  pools: fixPools(undefined),
  game: null,
  lastBonus: null,
  winner: null,
});

function initial(): M1State {
  const s = load<M1State | null>(KEY, null);
  if (!s || s.v !== 1) return freshState();
  s.pools = fixPools(s.pools);
  if (!s.gameDeck || s.gameDeck.size !== BRETT_GAME_IDS.length) s.gameDeck = newDeck(BRETT_GAME_IDS.length);
  return s;
}

interface Ctx {
  s: M1State;
  update: (fn: (s: M1State) => void) => void;
  reset: (keepPlayers: boolean) => void;
}
const C = createContext<Ctx | null>(null);

export function Mode1Provider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<M1State>(initial);
  useEffect(() => save(KEY, s), [s]);
  const update = useCallback((fn: (s: M1State) => void) => {
    setS((prev) => {
      const next: M1State = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);
  const reset = useCallback((keepPlayers: boolean) => {
    setS((prev) => (keepPlayers ? freshState(prev.players.map((p) => ({ ...p, kronen: 0, start: null, bonus: 0 }))) : freshState()));
  }, []);
  return <C.Provider value={{ s, update, reset }}>{children}</C.Provider>;
}

export function useM1() {
  const c = useContext(C);
  if (!c) throw new Error('Mode1Provider fehlt');
  return c;
}

export function hasSavedMode1(): boolean {
  const s = load<M1State | null>(KEY, null);
  return !!s && s.phase !== 'setup';
}

export function clearMode1() {
  remove(KEY);
}

export const nameOf = (s: M1State, id: string) => s.players.find((p) => p.id === id)?.name ?? '?';
