/**
 * Ansichten je Rolle. NUR diese Objekte werden an die Geräte verschickt.
 * Tokens und geheime Inhalte (Begriffe, geheime Zahl, Lösungen vor dem Aufdecken)
 * werden hier herausgefiltert.
 */
import type { GameState, Phase, Settings, Crown, Toast, MiniResult } from './types';
import type { GameId } from '../games';
import type { Team } from '../teams';
import { miniHostView, miniPlayerView, MCtx } from './minigames';
import { playableGames, canLead } from './engine';
import type { BotLevel } from './constants';

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  kronen: number;
  bonus: number;
  pos: number;
  start: number;
  bot: BotLevel | null;
}

export interface MiniView {
  game: GameId;
  stage: 'auslosung' | 'teams' | 'bereit' | 'spiel' | 'ergebnis';
  until: number | null;
  teams: Team<string>[];
  ready: string[];
  chosenBy: string | null;
  result: MiniResult | null;
  /** spielabhängige Ansicht */
  inner: any;
}

export interface BaseView {
  code: string;
  version: number;
  serverNow: number;
  started: boolean;
  settings: Settings;
  players: PublicPlayer[];
  order: string[];
  turnPlayerId: string | null;
  crowns: Crown[];
  phase: Phase;
  mini: MiniView | null;
  toast: Toast | null;
  playableGames: GameId[];
  /** Ist gerade ein Hauptscreen verbunden? (sonst zeigen die Handys alles) */
  hostConnected: boolean;
  /** Lobby wurde von einem Hauptscreen erstellt */
  screenMode: boolean;
  leaderId: string | null;
  turnNo: number;
  /** Bonusrunde nach einem Minispiel (Sonderfelder ruhen), sonst null */
  bonusRunde: { mover: string | null; queue: string[] } | null;
}

export interface HostView extends BaseView {
  role: 'host';
}

export interface PlayerView extends BaseView {
  role: 'player';
  me: PublicPlayer;
  /** Darf dieser Spieler die Lobby leiten (Einstellungen, Bots, Start …)? */
  iAmLeader: boolean;
}

const pub = (s: GameState): PublicPlayer[] =>
  s.players.map(({ id, name, color, connected, kronen, bonus, pos, start, bot }) => ({ id, name, color, connected, kronen, bonus, pos, start, bot }));

function base(s: GameState, now: number): BaseView {
  return {
    code: s.code,
    version: s.version,
    serverNow: now,
    started: s.started,
    settings: s.settings,
    players: pub(s),
    order: s.order,
    turnPlayerId: s.started ? s.order[s.turn] ?? null : null,
    crowns: s.crowns.filter((c) => c.field > 0),
    phase: s.phase,
    mini: null,
    toast: s.toast,
    playableGames: playableGames(s),
    hostConnected: s.hostConnected,
    screenMode: s.screenMode,
    leaderId: s.leaderId,
    turnNo: s.turnNo,
    bonusRunde: s.bonusRunde ? { mover: s.bonusRunde.mover, queue: [...s.bonusRunde.queue] } : null,
  };
}

function miniBase(s: GameState) {
  const m = s.mini!;
  return { game: m.game, stage: m.stage, until: m.until, teams: m.teams, ready: m.ready, chosenBy: m.chosenBy, result: m.result };
}

export function viewForHost(s: GameState, now: number): HostView {
  const v: HostView = { ...base(s, now), role: 'host' };
  if (s.mini) {
    const c: MCtx = { s, teams: s.mini.teams, rng: () => 0, now };
    v.mini = { ...miniBase(s), inner: s.mini.inner ? miniHostView(s.mini.inner, c) : null };
  }
  return v;
}

export function viewForPlayer(s: GameState, playerId: string, now: number): PlayerView | null {
  const all = pub(s);
  const me = all.find((p) => p.id === playerId);
  if (!me) return null;
  const v: PlayerView = { ...base(s, now), role: 'player', me, iAmLeader: canLead(s, playerId) };
  if (s.mini) {
    const c: MCtx = { s, teams: s.mini.teams, rng: () => 0, now, noScreen: !s.hostConnected };
    v.mini = { ...miniBase(s), inner: s.mini.inner ? miniPlayerView(s.mini.inner, playerId, c) : null };
  }
  return v;
}
