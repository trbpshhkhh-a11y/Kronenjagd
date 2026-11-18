import type { GameId } from '../games';
import type { DeckState } from '../deck';
import type { PoolState } from '../pools';
import type { MoveOption, Direction } from '../board';
import type { Team } from '../teams';
import type { TimerSettings } from './constants';
import type { MiniInner } from './minigames';

export interface Settings {
  kronenZumSieg: number;
  aktiveSpiele: GameId[];
  timer: TimerSettings;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  token: string;
  connected: boolean;
  disconnectedAt: number | null;
  kronen: number;
  bonus: number;
  pos: number;
  start: number;
}

export interface Crown {
  id: number;
  field: number;
  value: 1 | 2;
}

export type CardId = 'tausch' | 'sprung' | 'kronenNeu' | 'krone' | 'spielWahl';
export const CARDS: CardId[] = ['tausch', 'sprung', 'kronenNeu', 'krone', 'spielWahl'];
export const CARD_TEXT: Record<CardId, { titel: string; text: string }> = {
  tausch: { titel: 'Spielertausch', text: 'Tausche die Position mit einem Mitspieler deiner Wahl.' },
  sprung: { titel: 'Feldersprung', text: 'Springe auf Feld' },
  kronenNeu: { titel: 'Kronen neu platzieren', text: 'Beide Kronen werden neu ausgelost.' },
  krone: { titel: '1x Krone', text: 'Du bekommst sofort einen Kronenpunkt!' },
  spielWahl: { titel: 'Spiel aussuchen', text: 'Du darfst ein Minispiel aussuchen. Es wird sofort gespielt.' },
};

export interface MiniWrapper {
  game: GameId;
  stage: 'auslosung' | 'teams' | 'bereit' | 'spiel' | 'ergebnis';
  until: number | null;
  teams: Team<string>[];
  ready: string[];
  chosenBy: string | null;
  inner: MiniInner | null;
  result: MiniResult | null;
}

export interface MiniResultRow {
  label: string;
  members: string[];
  punkte: number;
  bonus: number;
}
export interface MiniResult {
  bonus: Record<string, number>;
  rows: MiniResultRow[];
}

export type Phase =
  | { k: 'lobby' }
  | { k: 'intro'; until: number }
  | { k: 'wuerfeln' }
  | { k: 'gewuerfelt'; wurf: number; bonus: number; total: number; until: number }
  | { k: 'richtung'; total: number; options: MoveOption[]; until: number }
  | { k: 'bewegen'; path: number[]; idx: number; dir: Direction; effects: boolean; nextAt: number; grund: 'zug' | 'plus2' | 'minus2' }
  | { k: 'karteZiehen'; until: number }
  | { k: 'karte'; card: CardId; stage: 'zeigen' | 'wahl' | 'fertig'; until: number; ziel?: number; info?: string }
  | { k: 'minispiel' }
  | { k: 'sieg'; winner: string };

export interface Toast {
  seq: number;
  text: string;
  kind: 'krone' | 'info' | 'feld';
}

export interface GameState {
  code: string;
  version: number;
  settings: Settings;
  players: Player[];
  order: string[];
  turn: number;
  crowns: Crown[];
  crownSeq: number;
  phase: Phase;
  mini: MiniWrapper | null;
  cardDeck: DeckState;
  gameDeck: DeckState;
  pools: PoolState;
  toast: Toast | null;
  started: boolean;
  lastActivity: number;
  hostConnected: boolean;
}

export interface Ctx {
  rng: import('../rng').Rng;
  now: number;
}

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}
