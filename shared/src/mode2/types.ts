import type { GameId } from '../games';
import type { DeckState } from '../deck';
import type { PoolState } from '../pools';
import type { MoveOption } from '../board';
import type { Team } from '../teams';
import type { TimerSettings, BotLevel } from './constants';
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
  /** null = Mensch, sonst Schwierigkeit des Bots */
  bot: BotLevel | null;
  /** Bot-Planung (nur Server-intern, wird nicht verschickt) */
  botAt: number | null;
  botSig: string | null;
}

export interface Crown {
  id: number;
  field: number;
  value: 1 | 2;
}

export type CardId = 'tausch' | 'sprung' | 'kronenNeu' | 'krone' | 'spielWahl' | 'zweiVor';
export const CARDS: CardId[] = ['tausch', 'sprung', 'kronenNeu', 'krone', 'spielWahl', 'zweiVor'];
export const CARD_TEXT: Record<CardId, { titel: string; text: string }> = {
  tausch: { titel: 'Spielertausch', text: 'Tausche die Position mit einem Mitspieler deiner Wahl.' },
  sprung: { titel: 'Feldersprung', text: 'Springe auf Feld' },
  kronenNeu: { titel: 'Kronen neu platzieren', text: 'Beide Kronen werden neu ausgelost.' },
  krone: { titel: '1x Krone', text: 'Du bekommst sofort einen Kronenpunkt!' },
  spielWahl: { titel: 'Spiel aussuchen', text: 'Du darfst ein Minispiel aussuchen. Es wird sofort gespielt.' },
  zweiVor: { titel: '2 Felder vor', text: 'Du darfst 2 Felder weiter nach vorne gehen.' },
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
  /** Platz (bei den Online-Spielen mit Platz-Wertung) */
  platz?: number;
  /** Anzeige statt „x Punkte“, z. B. „Reihe 23“ */
  anzeige?: string;
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
  | { k: 'richtung'; remaining: number; options: MoveOption[]; until: number }
  | { k: 'bewegen'; path: number[]; idx: number; remainingAfter: number; effects: boolean; nextAt: number; grund: 'zug' | 'plus2' | 'minus2' | 'bonus' }
  /** Bonusrunde: dieser Spieler darf gleich seine Bonusfelder gehen */
  | { k: 'bonusStart'; id: string; schritte: number; until: number }
  | { k: 'karteZiehen'; until: number }
  | { k: 'karte'; card: CardId; stage: 'zeigen' | 'wahl' | 'fertig'; until: number; ziel?: number; info?: string; /** true = gelbes Feld statt Ereigniskarte */ feld?: boolean }
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
  /** Ist gerade ein Hauptscreen verbunden? */
  hostConnected: boolean;
  /** true = Lobby wurde von einem Hauptscreen erstellt (der dann die Lobby leitet) */
  screenMode: boolean;
  /** Spieler, der die Lobby leitet (wenn kein Hauptscreen leitet) */
  leaderId: string | null;
  /** Zähler der Züge (für eindeutige Bot-Entscheidungen) */
  turnNo: number;
  /** Felder, die im aktuellen Zug betreten wurden (inkl. Start) */
  trail: number[];
  /**
   * Bonusrunde nach einem Minispiel: alle gehen nacheinander ihre Bonusfelder
   * (ab dem Spieler, der dran war). Sonderfelder ruhen in dieser Zeit.
   */
  bonusRunde: BonusRunde | null;
}

export interface BonusRunde {
  /** Zug-Index des Spielers, der vor dem Minispiel dran war */
  origin: number;
  /** wer noch Bonusfelder gehen darf (in dieser Reihenfolge) */
  queue: string[];
  /** wer gerade geht */
  mover: string | null;
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
