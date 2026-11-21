/**
 * Spiel-Engine für Modus 2 ("Nur App"). Der Server ist maßgeblich und ruft
 * diese Funktionen auf. Alle Funktionen arbeiten deterministisch auf dem
 * übergebenen Zustand mit injiziertem Zufall (ctx.rng) und Zeit (ctx.now),
 * damit jeder Zustand der Zustandsmaschine testbar ist.
 */
import { GAME_IDS, GameId, gameById, isPlayable } from '../games';
import { newDeck, drawIndex } from '../deck';
import { newPools } from '../pools';
import { randInt, shuffle, pick, uniqueFields, Rng } from '../rng';
import { makeTeamsHumansFirst } from '../teams';
import { BOARD, Board, fieldType, fieldsOfType, moveOptions, autoPath, allowedNext } from '../board';
import {
  KRONE_AUCH_BEIM_VORBEIGEHEN, GELB_SPIELERTAUSCH, GROSSE_KRONE_CHANCE, SCHRITT_MS, GETRENNT_UEBERSPRINGEN_MS,
  MAX_SPIELER, MIN_SPIELER, SPIELER_FARBEN, DEFAULT_TIMER, TimerSettings, BotLevel, BOT_LEVELS, BOT_NAMEN,
} from './constants';
import { CARDS, CardId, CARD_TEXT, Crown, Ctx, GameError, GameState, Player, Settings } from './types';
import { MCtx, MiniAction, miniAction, miniDone, miniInit, miniResult, miniTick } from './minigames';
import { botPlan } from './bots';
import { viewForPlayer } from './views';

export type PlayerAction =
  | { t: 'roll' }
  | { t: 'direction'; key: string }
  | { t: 'drawCard' }
  | { t: 'tauschWahl'; target: string }
  | { t: 'spielWahl'; game: GameId }
  | { t: 'ready' }
  | { t: 'mini'; a: MiniAction };

export type HostAction = { t: 'weiter' } | { t: 'beenden' } | { t: 'neueRunde' };

export const defaultSettings = (): Settings => ({ kronenZumSieg: 5, aktiveSpiele: [...GAME_IDS], timer: { ...DEFAULT_TIMER } });

export function createGameState(code: string, now: number, opts: { screenMode?: boolean } = {}): GameState {
  const screenMode = opts.screenMode ?? true;
  return {
    code,
    version: 1,
    settings: defaultSettings(),
    players: [],
    order: [],
    turn: 0,
    crowns: [],
    crownSeq: 0,
    phase: { k: 'lobby' },
    mini: null,
    cardDeck: newDeck(CARDS.length),
    gameDeck: newDeck(GAME_IDS.length),
    pools: newPools(),
    toast: null,
    started: false,
    lastActivity: now,
    hostConnected: screenMode,
    screenMode,
    leaderId: null,
    turnNo: 0,
    trail: [],
  };
}

export const touch = (s: GameState) => {
  s.version++;
};

function toast(s: GameState, text: string, kind: 'krone' | 'info' | 'feld' = 'info') {
  s.toast = { seq: (s.toast?.seq ?? 0) + 1, text, kind };
}

export const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id);
/** Anzeigename mit Bot-Symbol */
export const label = (p: Player) => (p.bot ? '🤖 ' + p.name : p.name);
export const humans = (s: GameState) => s.players.filter((p) => !p.bot);
export const currentPlayer = (s: GameState): Player | undefined => playerById(s, s.order[s.turn]);

/* ------------------------------------------------------------------ */
/* Lobby                                                               */
/* ------------------------------------------------------------------ */

export function validateName(name: unknown): string {
  if (typeof name !== 'string') throw new GameError('Bitte einen Namen eingeben.');
  const n = name.replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 14) throw new GameError('Der Name muss 2 bis 14 Zeichen lang sein.');
  return n;
}

function nameTaken(s: GameState, name: string, exceptId?: string) {
  return s.players.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
}

export function addPlayer(s: GameState, rawName: unknown, id: string, token: string, now: number): Player {
  if (s.started) throw new GameError('Das Spiel hat schon begonnen. Neue Spieler können nicht mehr beitreten.');
  if (s.players.length >= MAX_SPIELER) throw new GameError(`Die Lobby ist voll (maximal ${MAX_SPIELER} Spieler).`);
  const name = validateName(rawName);
  if (nameTaken(s, name)) throw new GameError('Dieser Name ist schon vergeben.');
  const used = new Set(s.players.map((p) => p.color));
  const color = SPIELER_FARBEN.find((c) => !used.has(c)) ?? SPIELER_FARBEN[0];
  const p: Player = { id, name, color, token, connected: true, disconnectedAt: null, kronen: 0, bonus: 0, pos: 0, start: 0, bot: null, botAt: null, botSig: null };
  s.players.push(p);
  if (!s.leaderId) s.leaderId = p.id;
  s.lastActivity = now;
  touch(s);
  return p;
}

/* ------------------------------ Bots ------------------------------ */

function validLevel(level: unknown): BotLevel {
  if (!BOT_LEVELS.includes(level as BotLevel)) throw new GameError('Ungültige Schwierigkeit');
  return level as BotLevel;
}

export function addBot(s: GameState, level: unknown = 'mittel', now = 0): Player {
  if (s.started) throw new GameError('Bots können nur vor dem Start hinzugefügt werden.');
  if (s.players.length >= MAX_SPIELER) throw new GameError(`Die Lobby ist voll (maximal ${MAX_SPIELER} Spieler).`);
  const lvl = validLevel(level);
  const idx = BOT_NAMEN.findIndex((n) => !nameTaken(s, n));
  if (idx < 0) throw new GameError('Keine Bot-Namen mehr frei.');
  const used = new Set(s.players.map((p) => p.color));
  const color = SPIELER_FARBEN.find((c) => !used.has(c)) ?? SPIELER_FARBEN[0];
  const id = 'bot' + idx;
  const p: Player = { id, name: BOT_NAMEN[idx], color, token: `bot:${id}:${Math.random().toString(36).slice(2)}`, connected: true, disconnectedAt: null, kronen: 0, bonus: 0, pos: 0, start: 0, bot: lvl, botAt: null, botSig: null };
  s.players.push(p);
  s.lastActivity = now;
  touch(s);
  return p;
}

export function setBotLevel(s: GameState, id: string, level: unknown) {
  const p = playerById(s, id);
  if (!p?.bot) throw new GameError('Das ist kein Bot.');
  p.bot = validLevel(level);
  touch(s);
}

/* -------------------------- Lobby-Leitung ------------------------- */

/** Darf dieser Spieler die Lobby leiten? (Hauptscreen-Lobbys leitet der Hauptscreen, solange er verbunden ist) */
export function canLead(s: GameState, pid: string | null): boolean {
  return !!pid && pid === s.leaderId && (!s.screenMode || !s.hostConnected);
}

/** Leitung an den nächsten verbundenen Menschen geben, wenn der Leiter weg ist. true = geändert */
export function maintainLeader(s: GameState, now: number): boolean {
  const cur = s.leaderId ? playerById(s, s.leaderId) : undefined;
  const ok = cur && !cur.bot && (cur.connected || (cur.disconnectedAt !== null && now - cur.disconnectedAt < GETRENNT_UEBERSPRINGEN_MS));
  if (ok) return false;
  const next = s.players.find((p) => !p.bot && p.connected && p.id !== s.leaderId);
  if (!next) {
    if (s.leaderId && !cur) {
      s.leaderId = null;
      return true;
    }
    return false;
  }
  s.leaderId = next.id;
  if (s.started && !s.screenMode) toast(s, `${next.name} leitet jetzt die Lobby.`, 'info');
  return true;
}

export function renamePlayer(s: GameState, id: string, rawName: unknown) {
  if (s.started) throw new GameError('Nach dem Start kann der Name nicht mehr geändert werden.');
  const p = playerById(s, id);
  if (!p) throw new GameError('Unbekannter Spieler');
  const name = validateName(rawName);
  if (nameTaken(s, name, id)) throw new GameError('Dieser Name ist schon vergeben.');
  p.name = name;
  touch(s);
}

export function removePlayer(s: GameState, id: string, now = 0) {
  if (s.started) throw new GameError('Spieler können nur vor dem Start entfernt werden.');
  s.players = s.players.filter((p) => p.id !== id);
  if (s.leaderId === id) {
    s.leaderId = null;
    maintainLeader(s, now);
  }
  touch(s);
}

export function setConnected(s: GameState, id: string, connected: boolean, now: number) {
  const p = playerById(s, id);
  if (!p || p.bot) return;
  if (p.connected === connected) return;
  p.connected = connected;
  p.disconnectedAt = connected ? null : now;
  touch(s);
}

export function updateSettings(s: GameState, patch: Partial<Settings>) {
  if (s.started) throw new GameError('Einstellungen nur vor dem Start änderbar.');
  if (patch.kronenZumSieg !== undefined) {
    const k = Number(patch.kronenZumSieg);
    if (!Number.isInteger(k) || k < 3 || k > 15) throw new GameError('Kronen zum Sieg: 3 bis 15');
    s.settings.kronenZumSieg = k;
  }
  if (patch.aktiveSpiele !== undefined) {
    if (!Array.isArray(patch.aktiveSpiele)) throw new GameError('Ungültige Spielauswahl');
    const list = GAME_IDS.filter((g) => patch.aktiveSpiele!.includes(g));
    if (list.length === 0) throw new GameError('Mindestens ein Spiel muss aktiv sein.');
    s.settings.aktiveSpiele = list;
  }
  if (patch.timer !== undefined) {
    for (const [k, v] of Object.entries(patch.timer)) {
      if (!(k in DEFAULT_TIMER)) continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 5 || n > 600) throw new GameError('Timer: 5 bis 600 Sekunden');
      s.settings.timer[k as keyof TimerSettings] = n;
    }
  }
  touch(s);
}

/* ------------------------------------------------------------------ */
/* Kronen                                                              */
/* ------------------------------------------------------------------ */

export const crownValue = (rng: Rng): 1 | 2 => (rng() < GROSSE_KRONE_CHANCE ? 2 : 1);

/**
 * Alle Felder, auf die eine Krone jetzt ausgelost werden darf:
 * normale Felder, auf denen gerade kein Spieler steht und keine andere Krone liegt
 * (dazu optional weitere ausgeschlossene Felder, z. B. das alte Kronenfeld).
 */
export function freeCrownFields(s: GameState, exclude: number[] = [], board: Board = BOARD): number[] {
  const ex = new Set([...exclude, ...s.crowns.map((c) => c.field), ...s.players.map((p) => p.pos).filter((f) => f > 0)]);
  return fieldsOfType(['normal'], board).filter((f) => !ex.has(f));
}

/** Freies normales Feld für eine Krone (zufällig aus der Liste der freien Felder, kein Neu-Würfeln). */
export function crownField(s: GameState, rng: Rng, exclude: number[], board: Board = BOARD): number {
  const free = freeCrownFields(s, exclude, board);
  if (free.length) return pick(rng, free);
  // Notfall (praktisch unmöglich): nur besetzte Felder und Kronenfelder meiden
  const fallback = freeCrownFields(s, [], board);
  if (fallback.length) return pick(rng, fallback);
  return pick(rng, fieldsOfType(['normal'], board));
}

/** Krone neu platzieren: neues normales Feld (nicht das alte, nicht das der anderen Krone), neuer Wert. */
export function respawnCrown(s: GameState, crownId: number, rng: Rng, extraExclude: number[] = []) {
  const c = s.crowns.find((x) => x.id === crownId);
  if (!c) return;
  const old = c.field;
  c.field = -1;
  c.field = crownField(s, rng, [old, ...extraExclude]);
  c.value = crownValue(rng);
  c.id = ++s.crownSeq;
}

function placeInitialCrowns(s: GameState, rng: Rng) {
  s.crowns = [];
  const starts = s.players.map((p) => p.start);
  for (let i = 0; i < 2; i++) {
    const field = crownField(s, rng, starts);
    s.crowns.push({ id: ++s.crownSeq, field, value: crownValue(rng) });
  }
}

export function relocateAllCrowns(s: GameState, rng: Rng) {
  const olds = s.crowns.map((c) => c.field);
  s.crowns.forEach((c) => (c.field = -1));
  for (const c of s.crowns) {
    c.field = crownField(s, rng, olds);
    c.value = crownValue(rng);
    c.id = ++s.crownSeq;
  }
}

/** Gibt true zurück, wenn der Spieler damit gewonnen hat. */
function giveCrownPoints(s: GameState, p: Player, points: number, text: string): boolean {
  p.kronen += points;
  toast(s, text, 'krone');
  if (p.kronen >= s.settings.kronenZumSieg) {
    s.phase = { k: 'sieg', winner: p.id };
    s.mini = null;
    return true;
  }
  return false;
}

/** Kronen auf dem Feld einsammeln. true = Sieg */
function collectAt(s: GameState, p: Player, field: number, rng: Rng, avoid: number[] = []): boolean {
  for (const c of s.crowns.slice()) {
    if (c.field !== field) continue;
    const pts = c.value;
    respawnCrown(s, c.id, rng, avoid);
    if (giveCrownPoints(s, p, pts, pts === 2 ? `${label(p)} schnappt sich die GROSSE Krone! +2` : `${label(p)} schnappt sich eine Krone! +1`)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Spielstart                                                          */
/* ------------------------------------------------------------------ */

export const INTRO_MS_PRO_SPIELER = 1400;
export const INTRO_REIHENFOLGE_MS = 4000;

export function startGame(s: GameState, ctx: Ctx) {
  if (s.players.length < MIN_SPIELER) throw new GameError(`Mindestens ${MIN_SPIELER} Spieler nötig.`);
  if (s.players.length > MAX_SPIELER) throw new GameError(`Maximal ${MAX_SPIELER} Spieler.`);
  if (humans(s).length < 1) throw new GameError('Mindestens ein Mensch muss mitspielen.');
  s.started = true;
  const forbidden = fieldsOfType(['minispiel', 'ereignis']);
  const starts = uniqueFields(ctx.rng, s.players.length, BOARD.data.fields.length, forbidden);
  s.players.forEach((p, i) => {
    p.start = starts[i];
    p.pos = starts[i];
    p.kronen = 0;
    p.bonus = 0;
    p.botAt = null;
    p.botSig = null;
  });
  s.turnNo = 0;
  s.order = shuffle(ctx.rng, s.players.map((p) => p.id));
  s.turn = 0;
  s.cardDeck = newDeck(CARDS.length);
  s.gameDeck = newDeck(GAME_IDS.length);
  s.mini = null;
  placeInitialCrowns(s, ctx.rng);
  s.phase = { k: 'intro', until: ctx.now + s.players.length * INTRO_MS_PRO_SPIELER + INTRO_REIHENFOLGE_MS };
  s.toast = null;
  s.lastActivity = ctx.now;
  touch(s);
}

/* ------------------------------------------------------------------ */
/* Zugablauf                                                           */
/* ------------------------------------------------------------------ */

function beginTurn(s: GameState) {
  s.turnNo++;
  s.phase = { k: 'wuerfeln' };
  s.mini = null;
  s.trail = [];
}

export function endTurn(s: GameState) {
  if (s.phase.k === 'sieg') return;
  s.turn = (s.turn + 1) % s.order.length;
  beginTurn(s);
}

/** Vorheriges Feld der aktuellen Bewegung (für die Richtung) */
const prevField = (s: GameState): number | null => (s.trail.length >= 2 ? s.trail[s.trail.length - 2] : null);

/** Richtungswahl für die verbleibenden Schritte anbieten (an jeder Weiche neu) */
export function offerDirections(s: GameState, remaining: number, now: number) {
  const p = currentPlayer(s)!;
  if (s.trail.length === 0) s.trail = [p.pos];
  const options = moveOptions(p.pos, prevField(s), remaining);
  s.phase = { k: 'richtung', remaining, options, until: now + s.settings.timer.richtung * 1000 };
}

function startMove(s: GameState, path: number[], remainingAfter: number, effects: boolean, grund: 'zug' | 'plus2' | 'minus2', now: number) {
  if (path.length === 0) {
    s.phase = { k: 'bewegen', path, idx: 0, remainingAfter: 0, effects, nextAt: now, grund };
    return;
  }
  s.phase = { k: 'bewegen', path, idx: 0, remainingAfter, effects, nextAt: now + SCHRITT_MS, grund };
}

/** 2 Felder zurück: entlang des gerade gegangenen Weges, danach geradeaus weiter */
function backPath(s: GameState, steps: number): number[] {
  const back = s.trail.slice(0, -1).reverse().slice(0, steps);
  if (back.length < steps) {
    const cur = back.length ? back[back.length - 1] : s.trail[s.trail.length - 1];
    const prev = back.length >= 2 ? back[back.length - 2] : back.length === 1 ? s.trail[s.trail.length - 1] : null;
    back.push(...autoPath(cur, prev, steps - back.length));
  }
  return back;
}

function onLanded(s: GameState, p: Player, effects: boolean, ctx: Ctx) {
  if (!effects) return endTurn(s);
  const type = fieldType(p.pos);
  switch (type) {
    case 'plus2':
      toast(s, `+2! ${label(p)} geht 2 Felder weiter.`, 'feld');
      return startMove(s, autoPath(p.pos, prevField(s), 2), 0, false, 'plus2', ctx.now + 500);
    case 'minus2':
      toast(s, `−2! ${label(p)} muss 2 Felder zurück.`, 'feld');
      return startMove(s, backPath(s, 2), 0, false, 'minus2', ctx.now + 500);
    case 'wiederholung':
      if (GELB_SPIELERTAUSCH) {
        toast(s, `Gelbes Feld! ${label(p)} darf mit einem Mitspieler tauschen.`, 'feld');
        s.phase = { k: 'karte', card: 'tausch', stage: 'wahl', until: ctx.now + 30000, feld: true };
        return;
      }
      return endTurn(s);
    case 'ereignis':
      toast(s, `${label(p)} zieht eine Ereigniskarte!`, 'feld');
      s.phase = { k: 'karteZiehen', until: ctx.now + 30000 };
      return;
    case 'minispiel':
      toast(s, 'Minispiel!', 'feld');
      return startMinigame(s, null, null, ctx);
    default:
      return endTurn(s);
  }
}

/* ------------------------------------------------------------------ */
/* Ereigniskarten                                                      */
/* ------------------------------------------------------------------ */

function drawCard(s: GameState, ctx: Ctx) {
  const idx = drawIndex(s.cardDeck, ctx.rng) ?? 0;
  const card = CARDS[idx];
  const p = currentPlayer(s)!;
  switch (card) {
    case 'tausch':
    case 'spielWahl':
      s.phase = { k: 'karte', card, stage: 'wahl', until: ctx.now + 30000 };
      break;
    case 'sprung': {
      const ziel = randInt(ctx.rng, 1, BOARD.data.fields.length - 1);
      const target = ziel >= p.pos ? ziel + 1 : ziel; // nie das aktuelle Feld
      s.phase = { k: 'karte', card, stage: 'zeigen', until: ctx.now + 3500, ziel: target };
      break;
    }
    default:
      s.phase = { k: 'karte', card, stage: 'zeigen', until: ctx.now + 3500 };
  }
}

function resolveCardShown(s: GameState, ctx: Ctx) {
  if (s.phase.k !== 'karte') return;
  const p = currentPlayer(s)!;
  const ph = s.phase;
  if (ph.card === 'sprung' && ph.ziel) {
    p.pos = ph.ziel;
    toast(s, `${label(p)} springt auf Feld ${ph.ziel}!`, 'feld');
    if (collectAt(s, p, p.pos, ctx.rng)) return;
  } else if (ph.card === 'kronenNeu') {
    relocateAllCrowns(s, ctx.rng);
    toast(s, 'Die Kronen wurden neu platziert!', 'feld');
  } else if (ph.card === 'krone') {
    if (giveCrownPoints(s, p, 1, `${label(p)} bekommt einen Kronenpunkt!`)) return;
  }
  s.phase = { ...ph, stage: 'fertig', until: ctx.now + 2500 };
}

/* ------------------------------------------------------------------ */
/* Minispiele                                                          */
/* ------------------------------------------------------------------ */

/**
 * Wie viele Menschen braucht ein Spiel mindestens? Bots können nicht zeichnen und nicht erklären,
 * deshalb braucht jedes Team bei Montagsmaler, Stirnraten und Begriffe erklären einen Menschen.
 */
export function requiredHumans(game: GameId, total: number): number {
  if (game === 'stirnraten' || game === 'montagsmaler') return 2;
  if (game === 'begriffe') return Math.max(1, Math.floor(total / 2));
  return 1;
}

export function playableGames(s: GameState): GameId[] {
  const n = s.players.length;
  const h = humans(s).length;
  return s.settings.aktiveSpiele.filter((g) => isPlayable(g, n) && h >= requiredHumans(g, n));
}

export function startMinigame(s: GameState, forced: GameId | null, chosenBy: string | null, ctx: Ctx) {
  let game: GameId | null = forced;
  if (!game) {
    const allowed = new Set(playableGames(s));
    const idx = drawIndex(s.gameDeck, ctx.rng, (i) => allowed.has(GAME_IDS[i]));
    game = idx === null ? null : GAME_IDS[idx];
  }
  if (!game) {
    toast(s, 'Kein Minispiel verfügbar.', 'info');
    return endTurn(s);
  }
  s.phase = { k: 'minispiel' };
  s.mini = { game, stage: 'auslosung', until: ctx.now + (forced ? 2500 : 4000), teams: [], ready: [], chosenBy, inner: null, result: null };
}

function mctx(s: GameState, ctx: Ctx): MCtx {
  return { ...ctx, s, teams: s.mini?.teams ?? [], noScreen: !s.hostConnected };
}

function miniStep(s: GameState, ctx: Ctx): boolean {
  const m = s.mini;
  if (!m) return false;
  switch (m.stage) {
    case 'auslosung':
      if (ctx.now < (m.until ?? 0)) return false;
      m.teams = makeTeamsHumansFirst(ctx.rng, s.players.map((p) => p.id), gameById(m.game).teamMode, (id) => !playerById(s, id)?.bot);
      m.stage = 'teams';
      m.until = ctx.now + (gameById(m.game).teamMode === 'einzel' ? 2000 : 4500);
      return true;
    case 'teams':
      if (ctx.now < (m.until ?? 0)) return false;
      m.stage = 'bereit';
      m.ready = s.players.filter((p) => p.bot).map((p) => p.id); // Bots sind immer bereit
      m.until = ctx.now + 60000;
      return true;
    case 'bereit': {
      const connected = s.players.filter((p) => p.connected).map((p) => p.id);
      if (ctx.now >= (m.until ?? 0) || (connected.length > 0 && connected.every((id) => m.ready.includes(id)))) {
        beginMiniPlay(s, ctx);
        return true;
      }
      return false;
    }
    case 'spiel': {
      if (!m.inner) return false;
      const changed = miniTick(m.inner, mctx(s, ctx));
      if (miniDone(m.inner)) {
        finishMini(s, ctx);
        return true;
      }
      return changed;
    }
    case 'ergebnis':
      if (ctx.now < (m.until ?? 0)) return false;
      s.mini = null;
      endTurn(s);
      return true;
  }
}

function beginMiniPlay(s: GameState, ctx: Ctx) {
  const m = s.mini!;
  m.stage = 'spiel';
  m.until = null;
  m.inner = miniInit(m.game, mctx(s, ctx));
}

function finishMini(s: GameState, ctx: Ctx) {
  const m = s.mini!;
  const res = miniResult(m.inner!, mctx(s, ctx));
  for (const [id, b] of Object.entries(res.bonus)) {
    const p = playerById(s, id);
    if (p) p.bonus += b;
  }
  m.result = res;
  m.stage = 'ergebnis';
  m.until = ctx.now + 15000;
}

/* ------------------------------------------------------------------ */
/* Aktionen                                                            */
/* ------------------------------------------------------------------ */

function requireTurn(s: GameState, pid: string) {
  if (s.order[s.turn] !== pid) throw new GameError('Du bist gerade nicht an der Reihe.');
}

export function rollDice(rng: Rng): number {
  return randInt(rng, 1, 6);
}

export function playerAction(s: GameState, pid: string, a: PlayerAction, ctx: Ctx) {
  const p = playerById(s, pid);
  if (!p) throw new GameError('Unbekannter Spieler');
  if (!s.started) throw new GameError('Das Spiel hat noch nicht begonnen.');
  if (a?.t === 'mini' && (a.a?.k === 'skill' || a.a?.k === 'hinweis') && !p.bot) throw new GameError('Ungültige Aktion');
  if (!p.bot) s.lastActivity = ctx.now;
  const ph = s.phase;
  switch (a?.t) {
    case 'roll': {
      if (ph.k !== 'wuerfeln') throw new GameError('Jetzt wird nicht gewürfelt.');
      requireTurn(s, pid);
      const wurf = rollDice(ctx.rng); // Zufall nur auf dem Server
      const bonus = p.bonus;
      p.bonus = 0;
      s.phase = { k: 'gewuerfelt', wurf, bonus, total: wurf + bonus, until: ctx.now + 2600 };
      break;
    }
    case 'direction': {
      if (ph.k !== 'richtung') throw new GameError('Jetzt wird keine Richtung gewählt.');
      requireTurn(s, pid);
      const opt = ph.options.find((o) => o.key === a.key);
      if (!opt) throw new GameError('Ungültige Richtung');
      startMove(s, opt.path, ph.remaining - opt.path.length, true, 'zug', ctx.now);
      break;
    }
    case 'drawCard':
      if (ph.k !== 'karteZiehen') throw new GameError('Jetzt wird keine Karte gezogen.');
      requireTurn(s, pid);
      drawCard(s, ctx);
      break;
    case 'tauschWahl': {
      if (ph.k !== 'karte' || ph.card !== 'tausch' || ph.stage !== 'wahl') throw new GameError('Jetzt nicht möglich.');
      requireTurn(s, pid);
      const other = playerById(s, a.target);
      if (!other || other.id === pid) throw new GameError('Bitte einen Mitspieler wählen.');
      const tmp = p.pos;
      p.pos = other.pos;
      other.pos = tmp;
      toast(s, `${label(p)} tauscht mit ${label(other)}!`, 'feld');
      s.phase = { ...ph, stage: 'fertig', until: ctx.now + 2500, info: label(other) };
      break;
    }
    case 'spielWahl': {
      if (ph.k !== 'karte' || ph.card !== 'spielWahl' || ph.stage !== 'wahl') throw new GameError('Jetzt nicht möglich.');
      requireTurn(s, pid);
      if (!playableGames(s).includes(a.game)) throw new GameError('Dieses Spiel ist nicht verfügbar.');
      startMinigame(s, a.game, pid, ctx);
      break;
    }
    case 'ready':
      if (s.mini?.stage !== 'bereit') return;
      if (!s.mini.ready.includes(pid)) s.mini.ready.push(pid);
      miniStep(s, ctx);
      break;
    case 'mini': {
      const m = s.mini;
      if (!m || m.stage !== 'spiel' || !m.inner) throw new GameError('Gerade läuft kein Minispiel.');
      miniAction(m.inner, pid, a.a, mctx(s, ctx));
      if (a.a.k === 'strich') return; // Striche werden separat verteilt (kein voller Versand)
      if (!miniDone(m.inner)) miniTick(m.inner, mctx(s, ctx));
      if (miniDone(m.inner)) finishMini(s, ctx);
      break;
    }
    default:
      throw new GameError('Unbekannte Aktion');
  }
  touch(s);
}

export function hostAction(s: GameState, a: HostAction, ctx: Ctx) {
  s.lastActivity = ctx.now;
  switch (a?.t) {
    case 'weiter': {
      const m = s.mini;
      if (m?.stage === 'bereit') beginMiniPlay(s, ctx);
      else if (m?.stage === 'ergebnis') m.until = ctx.now;
      else if (m && (m.stage === 'auslosung' || m.stage === 'teams')) m.until = ctx.now;
      else if (s.phase.k === 'intro') s.phase.until = ctx.now;
      else return;
      tick(s, ctx);
      break;
    }
    case 'beenden': {
      // Game of 7 manuell beenden
      const m = s.mini;
      if (m?.stage === 'spiel' && m.inner?.game === 'game7') {
        m.inner.finished = true;
        finishMini(s, ctx);
      } else return;
      break;
    }
    case 'neueRunde': {
      if (s.phase.k !== 'sieg') throw new GameError('Das Spiel läuft noch.');
      startGame(s, ctx);
      return;
    }
    default:
      throw new GameError('Unbekannte Aktion');
  }
  touch(s);
}

/** Zeitgesteuerte Übergänge. Gibt true zurück, wenn sich etwas geändert hat. */
export function tick(s: GameState, ctx: Ctx): boolean {
  let changed = maintainLeader(s, ctx.now);
  if (!s.started) {
    if (changed) touch(s);
    return changed;
  }
  // Mehrere Übergänge pro Tick zulassen (z. B. nach langer Pause), aber begrenzt
  for (let guard = 0; guard < 50; guard++) {
    const step = tickOnce(s, ctx);
    if (!step) break;
    changed = true;
  }
  if (botTick(s, ctx)) changed = true;
  if (changed) touch(s);
  return changed;
}

/**
 * Bots: Jeder Bot entscheidet nur anhand seiner eigenen Spieleransicht (viewForPlayer).
 * Er plant eine Aktion mit natürlicher Verzögerung und führt sie dann aus.
 */
export function botTick(s: GameState, ctx: Ctx): boolean {
  let changed = false;
  for (const p of s.players) {
    if (!p.bot) continue;
    const v = viewForPlayer(s, p.id, ctx.now);
    const plan = v ? botPlan(v, p.bot) : null;
    if (!plan) {
      p.botSig = null;
      p.botAt = null;
      continue;
    }
    if (plan.sig !== p.botSig) {
      p.botSig = plan.sig;
      p.botAt = ctx.now + randInt(ctx.rng, plan.delay[0], Math.max(plan.delay[0], plan.delay[1]));
      continue;
    }
    if (p.botAt === null || ctx.now < p.botAt) continue;
    p.botAt = null;
    if (plan.repeat) p.botSig = null;
    const a = plan.act(ctx.rng);
    if (!a) continue;
    try {
      playerAction(s, p.id, a, ctx);
      changed = true;
    } catch {
      /* Situation hat sich geändert – nächste Runde neu planen */
    }
  }
  return changed;
}

function tickOnce(s: GameState, ctx: Ctx): boolean {
  const ph = s.phase;
  const p = currentPlayer(s);
  switch (ph.k) {
    case 'intro':
      if (ctx.now < ph.until) return false;
      beginTurn(s);
      return true;
    case 'wuerfeln': {
      if (!p || p.connected || p.disconnectedAt === null) return false;
      if (ctx.now - p.disconnectedAt < GETRENNT_UEBERSPRINGEN_MS) return false;
      if (!s.players.some((x) => x.connected)) return false;
      toast(s, `${label(p)} ist nicht verbunden – Zug wird übersprungen.`, 'info');
      endTurn(s);
      return true;
    }
    case 'gewuerfelt':
      if (ctx.now < ph.until) return false;
      s.trail = [p!.pos];
      offerDirections(s, ph.total, ctx.now);
      return true;
    case 'richtung': {
      if (ctx.now < ph.until) return false;
      const opt = ph.options[0];
      toast(s, `Zeit abgelaufen – es geht ${opt.label}.`, 'info');
      startMove(s, opt.path, ph.remaining - opt.path.length, true, 'zug', ctx.now);
      return true;
    }
    case 'bewegen': {
      if (ctx.now < ph.nextAt) return false;
      if (ph.idx < ph.path.length) {
        p!.pos = ph.path[ph.idx];
        s.trail.push(p!.pos);
        ph.idx++;
        const last = ph.idx === ph.path.length && ph.remainingAfter === 0;
        if (KRONE_AUCH_BEIM_VORBEIGEHEN || last) {
          if (collectAt(s, p!, p!.pos, ctx.rng, ph.path.slice(ph.idx))) return true;
        }
        ph.nextAt += SCHRITT_MS;
        if (ph.nextAt < ctx.now - 5000) ph.nextAt = ctx.now; // nach langer Pause nicht ewig nachholen
        return true;
      }
      if (ph.remainingAfter > 0) {
        // Weiche erreicht: Spieler entscheidet über die restlichen Felder neu
        offerDirections(s, ph.remainingAfter, ctx.now);
        return true;
      }
      onLanded(s, p!, ph.effects, ctx);
      return true;
    }
    case 'karteZiehen':
      if (ctx.now < ph.until) return false;
      drawCard(s, ctx);
      return true;
    case 'karte':
      if (ctx.now < ph.until) return false;
      if (ph.stage === 'zeigen') resolveCardShown(s, ctx);
      else if (ph.stage === 'wahl') {
        if (ph.card === 'spielWahl') {
          toast(s, 'Zeit abgelaufen – das Spiel wird ausgelost.', 'info');
          startMinigame(s, null, null, ctx);
        } else {
          toast(s, 'Zeit abgelaufen – kein Tausch.', 'info');
          s.phase = { ...ph, stage: 'fertig', until: ctx.now + 1500 };
        }
      } else endTurn(s);
      return true;
    case 'minispiel':
      return miniStep(s, ctx);
    default:
      return false;
  }
}

export { CARD_TEXT };
export type { CardId, Crown };
