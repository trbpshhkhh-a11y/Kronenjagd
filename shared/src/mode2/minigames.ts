/**
 * Minispiele für Modus 2. Jedes Spiel ist ein Satz reiner Funktionen auf einem
 * serialisierbaren Zustand. Der Server ruft sie auf; Ansichten je Rolle werden
 * hier erzeugt, damit geheime Inhalte nie an falsche Geräte gehen.
 */
import type { GameId } from '../games';
import type { Team } from '../teams';
import type { GameState, Ctx, MiniResult } from './types';
import { GameError } from './types';
import { shuffle, pick, randInt } from '../rng';
import { mathRound, MathTask } from '../math';
import {
  drawSchaetzfragen, drawWissen, drawKategorien, drawGegenstaende, drawBegriff, distractors, wissenOptions, SLF_BUCHSTABEN,
} from '../pools';
import type { Gegenstand, Schaetzfrage } from '../content';
import { BEGRIFFE, ZAHLEN_HINWEISE } from '../content';
import { closestIds, zahlenBonus } from '../bonus';
import { normalize, startsWithLetter, fuzzyEquals } from '../text';

export interface MCtx extends Ctx {
  s: GameState;
  teams: Team<string>[];
  /** true = kein Hauptscreen verbunden: die Handys zeigen auch das, was sonst nur der Hauptscreen zeigt */
  noScreen?: boolean;
}

const sec = (c: MCtx, key: keyof GameState['settings']['timer']) => c.s.settings.timer[key] * 1000;
const allIds = (c: MCtx) => c.teams.flatMap((t) => t.members);
const connectedIds = (c: MCtx) => allIds(c).filter((id) => c.s.players.find((p) => p.id === id)?.connected);
const teamOf = (c: MCtx, pid: string) => c.teams.findIndex((t) => t.members.includes(pid));
const playerOf = (c: MCtx, pid: string) => c.s.players.find((p) => p.id === pid);
const nameOf = (c: MCtx, pid: string) => {
  const p = playerOf(c, pid);
  return p ? (p.bot ? '🤖 ' + p.name : p.name) : '?';
};
const isBot = (c: MCtx, pid: string) => !!playerOf(c, pid)?.bot;
const humansIn = (c: MCtx, members: string[]) => members.filter((m) => !isBot(c, m));
/** Zufallszahl mit Standardnormalverteilung (Box-Muller) */
function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export interface BotInfo {
  seq: number;
  name: string;
  text: string;
  ok: boolean;
}
function setBotInfo(st: { botInfo: BotInfo | null }, name: string, text: string, ok: boolean) {
  st.botInfo = { seq: (st.botInfo?.seq ?? 0) + 1, name, text, ok };
}
const teamLabel = (c: MCtx, i: number) =>
  c.teams[i].members.length === 1 ? nameOf(c, c.teams[i].members[0]) : c.teams[i].name;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const remaining = (until: number | null, now: number) => (until === null ? null : Math.max(0, until - now));

/* ------------------------------------------------------------------ */
/* Zustände                                                            */
/* ------------------------------------------------------------------ */

export interface G7State {
  game: 'game7';
  teams: { stage: number; locked: boolean }[];
  target: number;
  current: number;
  finished: boolean;
}

export interface KopfState {
  game: 'kopfrechnen';
  tasks: MathTask[];
  idx: number;
  stage: 'frage' | 'loesung';
  until: number;
  locked: string[];
  winner: string | null;
  scores: Record<string, number>;
}

export interface StirnState {
  game: 'stirnraten';
  round: number;
  stage: 'start' | 'laeuft' | 'pause';
  until: number;
  rater: string;
  term: string;
  correct: number[];
  botInfo: BotInfo | null;
}

export interface GegenState {
  game: 'gegenstaende';
  items: Gegenstand[];
  order: number[];
  options: Gegenstand[];
  stage: 'start' | 'zeigen' | 'abfrage' | 'aufloesung';
  until: number;
  q: number;
  answers: Record<string, Record<number, string>>;
}

export interface SlfState {
  game: 'slf';
  letter: string;
  cats: string[];
  stage: 'schreiben' | 'nachspiel' | 'pruefung';
  until: number;
  stopBy: string | null;
  answers: Record<string, string[]>;
  /** key `${owner}|${catIndex}` -> Spieler, die die Antwort als ungültig markiert haben */
  flags: Record<string, string[]>;
  doneVoting: string[];
}

export interface SchaetzState {
  game: 'schaetzen';
  qs: Schaetzfrage[];
  idx: number;
  stage: 'frage' | 'loesung';
  until: number;
  answers: Record<string, number>;
  winners: string[];
  scores: Record<string, number>;
}

export interface Stroke {
  id: number;
  color: string;
  w: number;
  /** flache Liste x,y in 0..1000 */
  pts: number[];
}

export interface MalState {
  game: 'montagsmaler';
  round: number;
  stage: 'start' | 'laeuft' | 'pause';
  until: number;
  drawer: string;
  terms: string[];
  termIdx: number;
  correct: number[];
  strokes: Stroke[];
  guesses: { name: string; text: string; ok: boolean }[];
  lastSolved: string | null;
}

export interface ZahlenState {
  game: 'zahlen';
  raters: string[];
  secret: number;
  stage: 'raten' | 'aufgedeckt';
  until: number;
  tips: Record<string, number>;
  /** Hinweise von Bot-Kennern (öffentlich, wie laut gesagt) */
  hints: { team: number; name: string; kategorie: string; begriff: string }[];
}

export interface WissenState {
  game: 'wissen';
  qs: { frage: string; antwort: string; options: string[] }[];
  idx: number;
  stage: 'frage' | 'loesung';
  until: number;
  choices: Record<string, { opt: number; at: number }>;
  teamAnswer: (number | null)[];
  locked: boolean[];
  scores: number[];
}

export interface BegriffeState {
  game: 'begriffe';
  seq: { team: number; explainer: string }[];
  idx: number;
  stage: 'start' | 'laeuft' | 'pause';
  until: number;
  term: string;
  correct: number[];
  botInfo: BotInfo | null;
}

export type MiniInner = G7State | KopfState | StirnState | GegenState | SlfState | SchaetzState | MalState | ZahlenState | WissenState | BegriffeState;

/** Aktionen der Spieler in Minispielen */
export type MiniAction =
  | { k: 'g7'; v: 'geschafft' | 'fehl' | 'einloggen' }
  | { k: 'antwort'; value: number }
  | { k: 'richtig' }
  | { k: 'weiter' }
  | { k: 'erraten' }
  | { k: 'gegenstand'; nr: number; emoji: string }
  | { k: 'slfAntworten'; answers: string[] }
  | { k: 'buzz' }
  | { k: 'flag'; owner: string; cat: number }
  | { k: 'fertig' }
  | { k: 'schaetzung'; value: number }
  | { k: 'tipp'; text: string }
  | { k: 'strich'; id: number; pts: number[]; color?: string; w?: number }
  | { k: 'loeschen' }
  | { k: 'zahlTipp'; value: number }
  | { k: 'waehlen'; opt: number }
  /** nur Bots: simulierte Fähigkeit (Erfolg ausgewürfelt), wird im Minispiel aufgelöst */
  | { k: 'skill'; success: boolean }
  /** nur Bots als Kenner bei Zahlen erraten */
  | { k: 'hinweis'; kategorie: string; begriff: string };

interface Impl<S extends MiniInner> {
  init(c: MCtx): S;
  action(st: S, pid: string, a: MiniAction, c: MCtx): void;
  tick(st: S, c: MCtx): boolean;
  done(st: S): boolean;
  result(st: S, c: MCtx): MiniResult;
  host(st: S, c: MCtx): unknown;
  player(st: S, pid: string, c: MCtx): unknown;
  /** Bot-Fähigkeit auflösen (Bot "weiß" etwas mit Wahrscheinlichkeit) */
  skill?(st: S, pid: string, success: boolean, c: MCtx): void;
}

function teamResult(c: MCtx, scores: number[]): MiniResult {
  const bonus: Record<string, number> = {};
  const rows = c.teams.map((t, i) => {
    const p = Math.max(0, scores[i] ?? 0);
    t.members.forEach((m) => (bonus[m] = p));
    return { label: teamLabel(c, i), members: t.members.map((m) => nameOf(c, m)), punkte: p, bonus: p };
  });
  return { bonus, rows: rows.sort((a, b) => b.punkte - a.punkte) };
}

function soloResult(c: MCtx, scores: Record<string, number>): MiniResult {
  const bonus: Record<string, number> = {};
  const rows = allIds(c).map((id) => {
    const p = Math.max(0, scores[id] ?? 0);
    bonus[id] = p;
    return { label: nameOf(c, id), members: [nameOf(c, id)], punkte: p, bonus: p };
  });
  return { bonus, rows: rows.sort((a, b) => b.punkte - a.punkte) };
}

/* ------------------------------------------------------------------ */
/* 1. Game of 7                                                        */
/* ------------------------------------------------------------------ */
const game7: Impl<G7State> = {
  init: (c) => ({ game: 'game7', teams: c.teams.map(() => ({ stage: 0, locked: false })), target: 1, current: 0, finished: false }),
  action(st, pid, a, c) {
    if (a.k !== 'g7') throw new GameError('Ungültige Aktion');
    if (st.finished) return;
    if (teamOf(c, pid) !== st.current) throw new GameError('Dein Team ist gerade nicht dran.');
    const t = st.teams[st.current];
    if (a.v === 'geschafft') {
      t.stage = st.target;
      if (t.stage >= 7) {
        t.locked = true;
        st.finished = true;
        return;
      }
    } else if (a.v === 'fehl') t.stage = 0;
    else if (a.v === 'einloggen') t.locked = true;
    else throw new GameError('Ungültige Aktion');
    g7Advance(st);
  },
  tick: () => false,
  done: (st) => st.finished,
  result: (st, c) => teamResult(c, st.teams.map((t) => t.stage)),
  host: (st, c) => ({
    game: 'game7',
    teams: st.teams.map((t, i) => ({ label: teamLabel(c, i), members: c.teams[i].members.map((m) => nameOf(c, m)), ...t })),
    current: st.current,
    target: st.target,
    finished: st.finished,
  }),
  player(st, pid, c) {
    return { ...(game7.host(st, c) as object), canAct: !st.finished && teamOf(c, pid) === st.current, myTeam: teamOf(c, pid) };
  },
};

export function g7Advance(st: G7State): void {
  const n = st.teams.length;
  if (st.teams.every((t) => t.locked)) {
    st.finished = true;
    return;
  }
  for (let step = 1; step <= n; step++) {
    const idx = st.current + step;
    if (idx >= n) {
      // neue Runde mit höherer Aufprallzahl
      st.target++;
      if (st.target > 7) {
        st.finished = true;
        return;
      }
      const first = st.teams.findIndex((t) => !t.locked);
      st.current = first;
      return;
    }
    if (!st.teams[idx].locked) {
      st.current = idx;
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Kopfrechnen                                                      */
/* ------------------------------------------------------------------ */
const kopf: Impl<KopfState> = {
  init: (c) => ({ game: 'kopfrechnen', tasks: mathRound(c.rng), idx: 0, stage: 'frage', until: c.now + sec(c, 'kopfrechnen'), locked: [], winner: null, scores: {} }),
  action(st, pid, a, c) {
    if (a.k !== 'antwort' || !isNum(a.value)) throw new GameError('Bitte eine Zahl eingeben.');
    if (st.stage !== 'frage') return;
    if (st.locked.includes(pid)) throw new GameError('Du bist für diese Aufgabe raus.');
    if (a.value === st.tasks[st.idx].solution) {
      st.winner = pid;
      st.scores[pid] = (st.scores[pid] ?? 0) + 1;
      st.stage = 'loesung';
      st.until = c.now + 4500;
    } else st.locked.push(pid);
  },
  tick(st, c) {
    if (st.stage === 'frage') {
      const everyoneOut = connectedIds(c).every((id) => st.locked.includes(id));
      if (c.now >= st.until || everyoneOut) {
        st.stage = 'loesung';
        st.until = c.now + 4500;
        return true;
      }
      return false;
    }
    if (c.now >= st.until && st.idx < st.tasks.length) {
      st.idx++;
      if (st.idx < st.tasks.length) {
        st.stage = 'frage';
        st.locked = [];
        st.winner = null;
        st.until = c.now + sec(c, 'kopfrechnen');
      }
      return true;
    }
    return false;
  },
  done: (st) => st.idx >= st.tasks.length,
  result: (st, c) => soloResult(c, st.scores),
  host: (st, c) => ({
    game: 'kopfrechnen',
    nr: st.idx + 1,
    text: st.tasks[Math.min(st.idx, st.tasks.length - 1)].text,
    stage: st.stage,
    rest: st.stage === 'frage' ? remaining(st.until, c.now) : null,
    until: st.until,
    loesung: st.stage === 'loesung' ? st.tasks[Math.min(st.idx, st.tasks.length - 1)].solution : null,
    winner: st.winner ? nameOf(c, st.winner) : null,
    raus: st.locked.map((id) => nameOf(c, id)),
    imRennen: allIds(c).filter((id) => !st.locked.includes(id)).map((id) => nameOf(c, id)),
    scores: allIds(c).map((id) => ({ name: nameOf(c, id), punkte: st.scores[id] ?? 0 })),
  }),
  player: (st, pid, c) => ({ ...(kopf.host(st, c) as object), gesperrt: st.locked.includes(pid), ichGewonnen: st.winner === pid }),
};

/* ------------------------------------------------------------------ */
/* 3. Stirnraten                                                       */
/* ------------------------------------------------------------------ */
function stirnStartRound(st: StirnState, c: MCtx) {
  st.stage = 'start';
  st.until = c.now + 5000;
  // Bots können nicht erklären: Es muss mindestens ein Mensch als Erklärer übrig bleiben.
  const members = c.teams[st.round].members;
  const humans = humansIn(c, members);
  const candidates = members.filter((m) => humans.filter((h) => h !== m).length >= 1);
  st.rater = pick(c.rng, candidates.length ? candidates : members);
  st.term = drawBegriff(c.s.pools, c.rng);
  st.botInfo = null;
}
const stirn: Impl<StirnState> = {
  init(c) {
    const st: StirnState = { game: 'stirnraten', round: 0, stage: 'start', until: 0, rater: '', term: '', correct: c.teams.map(() => 0), botInfo: null };
    stirnStartRound(st, c);
    return st;
  },
  action(st, pid, a, c) {
    if (st.stage !== 'laeuft') return;
    const t = teamOf(c, pid);
    if (t !== st.round || pid === st.rater) throw new GameError('Nur die Teampartner des Raters können das.');
    if (a.k === 'richtig') st.correct[st.round]++;
    else if (a.k !== 'weiter') throw new GameError('Ungültige Aktion');
    st.term = drawBegriff(c.s.pools, c.rng);
  },
  tick(st, c) {
    if (c.now < st.until) return false;
    if (st.stage === 'start') {
      st.stage = 'laeuft';
      st.until = c.now + sec(c, 'stirnraten');
    } else if (st.stage === 'laeuft') {
      st.stage = 'pause';
      st.until = c.now + 4000;
    } else {
      st.round++;
      if (st.round < c.teams.length) stirnStartRound(st, c);
    }
    return true;
  },
  done: (st) => st.round >= st.correct.length,
  result: (st, c) => teamResult(c, st.correct),
  host: (st, c) => ({
    game: 'stirnraten',
    stage: st.stage,
    until: st.until,
    team: teamLabel(c, Math.min(st.round, c.teams.length - 1)),
    teamIdx: st.round,
    rater: nameOf(c, st.rater),
    correct: st.correct.map((n, i) => ({ label: teamLabel(c, i), n })),
    botInfo: st.botInfo,
  }),
  skill(st, pid, success, c) {
    if (st.stage !== 'laeuft' || pid !== st.rater) return;
    if (success) {
      setBotInfo(st, nameOf(c, pid), `hat „${st.term}“ erraten!`, true);
      st.correct[st.round]++;
      st.term = drawBegriff(c.s.pools, c.rng);
    } else setBotInfo(st, nameOf(c, pid), 'rät daneben …', false);
  },
  player(st, pid, c) {
    const base = stirn.host(st, c) as object;
    const role = pid === st.rater ? 'rater' : teamOf(c, pid) === st.round ? 'erklaerer' : 'zuschauer';
    return { ...base, role, term: role === 'erklaerer' && st.stage === 'laeuft' ? st.term : null };
  },
};

/* ------------------------------------------------------------------ */
/* 4. Gegenstände merken                                               */
/* ------------------------------------------------------------------ */
const gegen: Impl<GegenState> = {
  init(c) {
    const items = drawGegenstaende(c.s.pools, c.rng, 10);
    return {
      game: 'gegenstaende',
      items,
      order: shuffle(c.rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      options: shuffle(c.rng, [...items, ...distractors(c.rng, items, 2)]),
      stage: 'start',
      until: c.now + 3500,
      q: 0,
      answers: {},
    };
  },
  action(st, pid, a) {
    if (a.k !== 'gegenstand' || !isNum(a.nr) || typeof a.emoji !== 'string') throw new GameError('Ungültige Aktion');
    if (st.stage !== 'abfrage' || a.nr !== st.order[st.q]) return;
    if (!st.options.some((o) => o.emoji === a.emoji)) throw new GameError('Ungültiger Gegenstand');
    (st.answers[pid] ??= {})[a.nr] = a.emoji;
  },
  tick(st, c) {
    if (st.stage === 'abfrage') {
      const nr = st.order[st.q];
      const allAnswered = connectedIds(c).every((id) => st.answers[id]?.[nr] !== undefined);
      if (c.now >= st.until || allAnswered) {
        st.q++;
        if (st.q >= st.order.length) {
          st.stage = 'aufloesung';
          st.until = c.now + 15000;
        } else st.until = c.now + sec(c, 'gegenstaende');
        return true;
      }
      return false;
    }
    if (c.now < st.until) return false;
    if (st.stage === 'start') {
      st.stage = 'zeigen';
      st.until = c.now + 10000;
    } else if (st.stage === 'zeigen') {
      st.stage = 'abfrage';
      st.until = c.now + sec(c, 'gegenstaende');
    } else if (st.stage === 'aufloesung') {
      st.q = -1; // fertig
    }
    return true;
  },
  done: (st) => st.q === -1,
  result(st, c) {
    const scores: Record<string, number> = {};
    for (const id of allIds(c)) scores[id] = st.items.filter((it, i) => st.answers[id]?.[i + 1] === it.emoji).length;
    return soloResult(c, scores);
  },
  host(st, c) {
    const show = st.stage === 'zeigen' || st.stage === 'aufloesung';
    const nr = st.stage === 'abfrage' ? st.order[st.q] : null;
    return {
      game: 'gegenstaende',
      stage: st.stage,
      until: st.until,
      items: show ? st.items : null,
      nr,
      frageNr: st.q + 1,
      beantwortet: nr === null ? [] : allIds(c).filter((id) => st.answers[id]?.[nr] !== undefined).map((id) => nameOf(c, id)),
      scores: st.stage === 'aufloesung' ? gegen.result(st, c).rows : null,
    };
  },
  player(st, pid, c) {
    const h = gegen.host(st, c) as { nr: number | null };
    return {
      ...(h as object),
      items: st.stage === 'aufloesung' || (c.noScreen && st.stage === 'zeigen') ? st.items : null,
      options: st.stage === 'abfrage' ? st.options : null,
      meineWahl: h.nr !== null ? st.answers[pid]?.[h.nr] ?? null : null,
      meineAntworten: st.stage === 'aufloesung' ? st.answers[pid] ?? {} : null,
    };
  },
  skill(st, pid, success, c) {
    if (st.stage !== 'abfrage') return;
    const nr = st.order[st.q];
    const right = st.items[nr - 1].emoji;
    const wrong = st.options.filter((o) => o.emoji !== right);
    (st.answers[pid] ??= {})[nr] = success ? right : pick(c.rng, wrong).emoji;
  },
};

/* ------------------------------------------------------------------ */
/* 5. Stadt Land Fluss                                                 */
/* ------------------------------------------------------------------ */
type SlfStatus = 'ok' | 'leer' | 'buchstabe' | 'doppelt' | 'abgelehnt';
export function slfEvaluate(st: SlfState, players: string[]): Record<string, SlfStatus[]> {
  const out: Record<string, SlfStatus[]> = {};
  for (const id of players) {
    out[id] = st.cats.map((_, ci) => {
      const ans = (st.answers[id]?.[ci] ?? '').trim();
      if (!ans) return 'leer';
      if (!startsWithLetter(ans, st.letter)) return 'buchstabe';
      const n = normalize(ans);
      const dup = players.some((o) => o !== id && normalize(st.answers[o]?.[ci] ?? '') === n);
      if (dup) return 'doppelt';
      const flags = (st.flags[`${id}|${ci}`] ?? []).length;
      const voters = players.length - 1;
      if (voters > 0 && flags * 2 > voters) return 'abgelehnt';
      return 'ok';
    });
  }
  return out;
}
const slf: Impl<SlfState> = {
  init: (c) => ({
    game: 'slf',
    letter: pick(c.rng, SLF_BUCHSTABEN),
    cats: drawKategorien(c.s.pools, c.rng, 5),
    stage: 'schreiben',
    until: c.now + sec(c, 'slf'),
    stopBy: null,
    answers: {},
    flags: {},
    doneVoting: [],
  }),
  action(st, pid, a, c) {
    if (a.k === 'slfAntworten') {
      if (st.stage === 'pruefung') return;
      if (!Array.isArray(a.answers) || a.answers.length !== 5) throw new GameError('Ungültige Antworten');
      st.answers[pid] = a.answers.map((x) => String(x ?? '').slice(0, 40));
    } else if (a.k === 'buzz') {
      // Buzzer "Stopp": der erste beim Server gewinnt, danach gesperrt
      if (st.stage !== 'schreiben' || st.stopBy) return;
      st.stopBy = pid;
      st.stage = 'nachspiel';
      st.until = c.now + 10000;
    } else if (a.k === 'flag') {
      if (st.stage !== 'pruefung') return;
      if (a.owner === pid) throw new GameError('Eigene Antworten kannst du nicht markieren.');
      if (!allIds(c).includes(a.owner) || !isNum(a.cat) || a.cat < 0 || a.cat > 4) throw new GameError('Ungültig');
      const key = `${a.owner}|${a.cat}`;
      const list = (st.flags[key] ??= []);
      const i = list.indexOf(pid);
      if (i >= 0) list.splice(i, 1);
      else list.push(pid);
    } else if (a.k === 'fertig') {
      if (st.stage === 'pruefung' && !st.doneVoting.includes(pid)) st.doneVoting.push(pid);
    } else throw new GameError('Ungültige Aktion');
  },
  tick(st, c) {
    if (st.stage === 'pruefung') {
      if (connectedIds(c).every((id) => st.doneVoting.includes(id)) || c.now >= st.until) {
        st.until = -1;
        return true;
      }
      return false;
    }
    if (c.now >= st.until) {
      st.stage = 'pruefung';
      st.until = c.now + 90000;
      return true;
    }
    return false;
  },
  done: (st) => st.stage === 'pruefung' && st.until === -1,
  result(st, c) {
    const ev = slfEvaluate(st, allIds(c));
    const scores: Record<string, number> = {};
    for (const id of allIds(c)) scores[id] = ev[id].filter((x) => x === 'ok').length;
    return soloResult(c, scores);
  },
  host(st, c) {
    const ids = allIds(c);
    const ev = st.stage === 'pruefung' ? slfEvaluate(st, ids) : null;
    return {
      game: 'slf',
      letter: st.letter,
      cats: st.cats,
      stage: st.stage,
      until: st.until,
      stopBy: st.stopBy ? nameOf(c, st.stopBy) : null,
      abgegeben: ids.filter((id) => (st.answers[id] ?? []).some((x) => x.trim())).map((id) => nameOf(c, id)),
      fertig: st.doneVoting.map((id) => nameOf(c, id)),
      tabelle: ev
        ? ids.map((id) => ({
            id,
            name: nameOf(c, id),
            antworten: st.cats.map((_, ci) => ({ text: st.answers[id]?.[ci] ?? '', status: ev[id][ci], flags: (st.flags[`${id}|${ci}`] ?? []).length })),
          }))
        : null,
    };
  },
  player(st, pid, c) {
    const h = slf.host(st, c) as object;
    const meineFlags = Object.entries(st.flags).filter(([, v]) => v.includes(pid)).map(([k]) => k);
    return { ...h, meineAntworten: st.answers[pid] ?? ['', '', '', '', ''], meineFlags, ichFertig: st.doneVoting.includes(pid), ich: pid };
  },
};

/* ------------------------------------------------------------------ */
/* 6. Schätzmeister                                                    */
/* ------------------------------------------------------------------ */
const schaetz: Impl<SchaetzState> = {
  init: (c) => ({ game: 'schaetzen', qs: drawSchaetzfragen(c.s.pools, c.rng, 5), idx: 0, stage: 'frage', until: c.now + sec(c, 'schaetzen'), answers: {}, winners: [], scores: {} }),
  action(st, pid, a) {
    if (a.k !== 'schaetzung' || !isNum(a.value) || Math.abs(a.value) > 1e12) throw new GameError('Bitte eine Zahl eingeben.');
    if (st.stage !== 'frage') return;
    st.answers[pid] = a.value;
  },
  tick(st, c) {
    if (st.stage === 'frage') {
      const all = connectedIds(c).every((id) => st.answers[id] !== undefined);
      if (c.now >= st.until || all) {
        st.stage = 'loesung';
        st.winners = closestIds(st.answers, st.qs[st.idx].wert);
        for (const w of st.winners) st.scores[w] = (st.scores[w] ?? 0) + 1;
        st.until = c.now + 9000;
        return true;
      }
      return false;
    }
    if (c.now >= st.until && st.idx < st.qs.length) {
      st.idx++;
      if (st.idx < st.qs.length) {
        st.stage = 'frage';
        st.answers = {};
        st.winners = [];
        st.until = c.now + sec(c, 'schaetzen');
      }
      return true;
    }
    return false;
  },
  done: (st) => st.idx >= st.qs.length,
  result: (st, c) => soloResult(c, st.scores),
  host(st, c) {
    const q = st.qs[Math.min(st.idx, st.qs.length - 1)];
    const reveal = st.stage === 'loesung';
    return {
      game: 'schaetzen',
      nr: st.idx + 1,
      frage: q.frage,
      einheit: q.einheit,
      stage: st.stage,
      until: st.until,
      loesung: reveal ? q.wert : null,
      geschaetzt: allIds(c).filter((id) => st.answers[id] !== undefined).map((id) => nameOf(c, id)),
      alle: reveal ? allIds(c).map((id) => ({ name: nameOf(c, id), wert: st.answers[id] ?? null, sieger: st.winners.includes(id) })) : null,
      scores: allIds(c).map((id) => ({ name: nameOf(c, id), punkte: st.scores[id] ?? 0 })),
    };
  },
  player: (st, pid, c) => ({ ...(schaetz.host(st, c) as object), meine: st.answers[pid] ?? null }),
  skill(st, pid, success, c) {
    if (st.stage !== 'frage' || st.answers[pid] !== undefined) return;
    const lvl = playerOf(c, pid)?.bot ?? 'mittel';
    const sigma = success ? { leicht: 0.15, mittel: 0.1, schwer: 0.05 }[lvl] : { leicht: 0.6, mittel: 0.45, schwer: 0.3 }[lvl];
    const wert = st.qs[st.idx].wert;
    let est = wert * (1 + gauss(c.rng) * sigma);
    if (wert > 0) est = Math.max(0, est);
    // sinnvoll runden: ganze Zahlen bleiben ganz, große Zahlen auf 2–3 Stellen
    const mag = Math.abs(est) >= 1000 ? Math.pow(10, Math.floor(Math.log10(Math.abs(est))) - 2) : Number.isInteger(wert) ? 1 : 0.1;
    st.answers[pid] = Math.round(est / mag) * mag;
    st.answers[pid] = Math.round(st.answers[pid] * 1000) / 1000;
  },
};

/* ------------------------------------------------------------------ */
/* 7. Montagsmaler                                                     */
/* ------------------------------------------------------------------ */
function malStartRound(st: MalState, c: MCtx) {
  st.stage = 'start';
  st.until = c.now + 5000;
  // Bots können nicht zeichnen: Zeichner ist immer ein Mensch (falls es einen gibt)
  const humans = humansIn(c, c.teams[st.round].members);
  st.drawer = pick(c.rng, humans.length ? humans : c.teams[st.round].members);
  st.terms = Array.from({ length: 8 }, () => drawBegriff(c.s.pools, c.rng));
  st.termIdx = 0;
  st.strokes = [];
  st.guesses = [];
  st.lastSolved = null;
}
function malNext(st: MalState, solved: boolean, c: MCtx) {
  if (solved) {
    st.correct[st.round]++;
    st.lastSolved = st.terms[st.termIdx];
  }
  st.termIdx++;
  st.strokes = [];
  if (st.termIdx >= st.terms.length) {
    st.stage = 'pause';
    st.until = c.now + 4000;
  }
}
const mal: Impl<MalState> = {
  init(c) {
    const st: MalState = { game: 'montagsmaler', round: 0, stage: 'start', until: 0, drawer: '', terms: [], termIdx: 0, correct: c.teams.map(() => 0), strokes: [], guesses: [], lastSolved: null };
    malStartRound(st, c);
    return st;
  },
  action(st, pid, a, c) {
    if (st.stage !== 'laeuft') return;
    const isDrawer = pid === st.drawer;
    if (a.k === 'strich') {
      if (!isDrawer) throw new GameError('Nur der Zeichner zeichnet.');
      if (!Array.isArray(a.pts) || a.pts.length > 400 || !a.pts.every((n) => isNum(n) && n >= 0 && n <= 1000)) throw new GameError('Ungültiger Strich');
      if (st.strokes.reduce((s, x) => s + x.pts.length, 0) > 40000) return;
      let stroke = st.strokes.find((x) => x.id === a.id);
      if (!stroke) {
        const color = typeof a.color === 'string' && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#222222';
        const w = isNum(a.w) ? Math.min(40, Math.max(2, a.w)) : 8;
        stroke = { id: a.id, color, w, pts: [] };
        st.strokes.push(stroke);
      }
      stroke.pts.push(...a.pts.map((n) => Math.round(n)));
    } else if (a.k === 'loeschen') {
      if (isDrawer) st.strokes = [];
    } else if (a.k === 'erraten' || a.k === 'weiter') {
      if (!isDrawer) throw new GameError('Nur der Zeichner kann das.');
      malNext(st, a.k === 'erraten', c);
    } else if (a.k === 'tipp') {
      if (isDrawer || teamOf(c, pid) !== st.round) throw new GameError('Nur die Teampartner raten.');
      const text = String(a.text ?? '').slice(0, 40).trim();
      if (!text) return;
      const ok = fuzzyEquals(text, st.terms[st.termIdx]);
      st.guesses.push({ name: nameOf(c, pid), text: ok ? st.terms[st.termIdx] : text, ok });
      if (st.guesses.length > 12) st.guesses.shift();
      if (ok) malNext(st, true, c);
    } else throw new GameError('Ungültige Aktion');
  },
  tick(st, c) {
    if (c.now < st.until) return false;
    if (st.stage === 'start') {
      st.stage = 'laeuft';
      st.until = c.now + sec(c, 'montagsmaler');
    } else if (st.stage === 'laeuft') {
      st.stage = 'pause';
      st.until = c.now + 4000;
    } else {
      st.round++;
      if (st.round < c.teams.length) malStartRound(st, c);
    }
    return true;
  },
  done: (st) => st.round >= st.correct.length,
  result: (st, c) => teamResult(c, st.correct),
  host: (st, c) => ({
    game: 'montagsmaler',
    stage: st.stage,
    until: st.until,
    teamIdx: st.round,
    team: teamLabel(c, Math.min(st.round, c.teams.length - 1)),
    drawer: nameOf(c, st.drawer),
    strokes: st.strokes,
    guesses: st.guesses,
    lastSolved: st.lastSolved,
    correct: st.correct.map((n, i) => ({ label: teamLabel(c, i), n })),
  }),
  player(st, pid, c) {
    const role = pid === st.drawer ? 'zeichner' : teamOf(c, pid) === st.round ? 'rater' : 'zuschauer';
    const h = mal.host(st, c) as Record<string, unknown>;
    return {
      ...h,
      strokes: c.noScreen ? h.strokes : undefined,
      role,
      term: role === 'zeichner' && st.stage === 'laeuft' ? st.terms[st.termIdx] ?? null : null,
      begriffNr: st.termIdx + 1,
    };
  },
  skill(st, pid, success, c) {
    if (st.stage !== 'laeuft' || pid === st.drawer || teamOf(c, pid) !== st.round) return;
    const term = st.terms[st.termIdx];
    if (success) {
      st.guesses.push({ name: nameOf(c, pid), text: term, ok: true });
      malNext(st, true, c);
    } else {
      const wrong = pick(c.rng, BEGRIFFE.filter((b) => b !== term));
      st.guesses.push({ name: nameOf(c, pid), text: wrong, ok: false });
    }
    if (st.guesses.length > 12) st.guesses.shift();
  },
};

/* ------------------------------------------------------------------ */
/* 8. Zahlen erraten                                                   */
/* ------------------------------------------------------------------ */
const zahlen: Impl<ZahlenState> = {
  init: (c) => ({
    game: 'zahlen',
    // Kenner möglichst Menschen: Hat ein Team Bots, rät ein Bot.
    raters: c.teams.map((t) => {
      const bots = t.members.filter((m) => isBot(c, m));
      return pick(c.rng, bots.length && bots.length < t.members.length ? bots : t.members);
    }),
    secret: randInt(c.rng, 1, 10),
    stage: 'raten',
    until: c.now + sec(c, 'zahlen'),
    tips: {},
    hints: [],
  }),
  action(st, pid, a, c) {
    if (a.k === 'hinweis') {
      if (st.stage !== 'raten') return;
      const t = teamOf(c, pid);
      if (t < 0 || st.raters.includes(pid) || !isBot(c, pid)) throw new GameError('Nur Bot-Kenner geben Hinweise.');
      const kat = ZAHLEN_HINWEISE.find((k) => k.kategorie === a.kategorie);
      if (!kat || !kat.begriffe.includes(a.begriff)) throw new GameError('Ungültiger Hinweis');
      if (st.hints.filter((h) => h.team === t).length >= 3) return;
      st.hints.push({ team: t, name: nameOf(c, pid), kategorie: kat.kategorie, begriff: a.begriff });
      return;
    }
    if (a.k !== 'zahlTipp' || !isNum(a.value) || !Number.isInteger(a.value) || a.value < 1 || a.value > 10) throw new GameError('Bitte eine Zahl von 1 bis 10 wählen.');
    if (st.stage !== 'raten') return;
    if (!st.raters.includes(pid)) throw new GameError('Nur die Rater geben einen Tipp ab.');
    st.tips[pid] = a.value;
  },
  tick(st, c) {
    if (st.stage === 'raten') {
      if (c.now >= st.until || st.raters.every((r) => st.tips[r] !== undefined)) {
        st.stage = 'aufgedeckt';
        st.until = c.now + 9000;
        return true;
      }
      return false;
    }
    if (c.now >= st.until && st.until !== -1) {
      st.until = -1;
      return true;
    }
    return false;
  },
  done: (st) => st.stage === 'aufgedeckt' && st.until === -1,
  result: (st, c) => teamResult(c, st.raters.map((r) => zahlenBonus(st.secret, st.tips[r]))),
  host(st, c) {
    const reveal = st.stage === 'aufgedeckt';
    return {
      game: 'zahlen',
      stage: st.stage,
      until: st.until,
      teams: c.teams.map((t, i) => ({
        label: teamLabel(c, i),
        rater: nameOf(c, st.raters[i]),
        kenner: t.members.filter((m) => m !== st.raters[i]).map((m) => nameOf(c, m)),
        hatGetippt: st.tips[st.raters[i]] !== undefined,
        tipp: reveal ? st.tips[st.raters[i]] ?? null : null,
        bonus: reveal ? zahlenBonus(st.secret, st.tips[st.raters[i]]) : null,
        raterId: st.raters[i],
        kennerIds: t.members.filter((m) => m !== st.raters[i]),
      })),
      hints: st.hints,
      zahl: reveal ? st.secret : null,
    };
  },
  skill(st, pid, success, c) {
    if (st.stage !== 'raten' || !st.raters.includes(pid) || st.tips[pid] !== undefined) return;
    const sign = c.rng() < 0.5 ? -1 : 1;
    const dev = success ? (c.rng() < 0.5 ? 0 : 1) : randInt(c.rng, 2, 4);
    let tip = st.secret + sign * dev;
    if (tip < 1 || tip > 10) tip = st.secret - sign * dev;
    st.tips[pid] = Math.min(10, Math.max(1, tip));
  },
  player(st, pid, c) {
    const role = st.raters.includes(pid) ? 'rater' : 'kenner';
    const h = zahlen.host(st, c) as object;
    return { ...h, role, zahl: role === 'kenner' || st.stage === 'aufgedeckt' ? st.secret : null, meinTipp: st.tips[pid] ?? null };
  },
};

/* ------------------------------------------------------------------ */
/* 9. Allgemeinwissen                                                  */
/* ------------------------------------------------------------------ */
function wissenFinish(st: WissenState, c: MCtx) {
  c.teams.forEach((t, i) => {
    if (st.locked[i]) return;
    const chosen = t.members.filter((m) => st.choices[m]).sort((a, b) => st.choices[a].at - st.choices[b].at);
    st.teamAnswer[i] = chosen.length ? st.choices[chosen[0]].opt : null;
    st.locked[i] = true;
  });
  const q = st.qs[st.idx];
  const correct = q.options.indexOf(q.antwort);
  st.teamAnswer.forEach((ans, i) => {
    if (ans === correct) st.scores[i]++;
  });
  st.stage = 'loesung';
  st.until = c.now + 7000;
}
const wissen: Impl<WissenState> = {
  init(c) {
    const qs = drawWissen(c.s.pools, c.rng, 5).map((q) => ({ frage: q.frage, antwort: q.antwort, options: wissenOptions(c.rng, q) }));
    return { game: 'wissen', qs, idx: 0, stage: 'frage', until: c.now + sec(c, 'wissen'), choices: {}, teamAnswer: c.teams.map(() => null), locked: c.teams.map(() => false), scores: c.teams.map(() => 0) };
  },
  action(st, pid, a, c) {
    if (a.k !== 'waehlen' || !isNum(a.opt) || a.opt < 0 || a.opt > 3) throw new GameError('Ungültige Antwort');
    if (st.stage !== 'frage') return;
    const t = teamOf(c, pid);
    if (t < 0 || st.locked[t]) return;
    const prev = st.choices[pid];
    st.choices[pid] = { opt: a.opt, at: prev && prev.opt === a.opt ? prev.at : c.now };
    const members = c.teams[t].members;
    if (members.every((m) => st.choices[m]?.opt === a.opt)) {
      st.locked[t] = true;
      st.teamAnswer[t] = a.opt;
    }
  },
  tick(st, c) {
    if (st.stage === 'frage') {
      if (c.now >= st.until || st.locked.every(Boolean)) {
        wissenFinish(st, c);
        return true;
      }
      return false;
    }
    if (c.now >= st.until && st.idx < st.qs.length) {
      st.idx++;
      if (st.idx < st.qs.length) {
        st.stage = 'frage';
        st.choices = {};
        st.teamAnswer = c.teams.map(() => null);
        st.locked = c.teams.map(() => false);
        st.until = c.now + sec(c, 'wissen');
      }
      return true;
    }
    return false;
  },
  done: (st) => st.idx >= st.qs.length,
  result: (st, c) => teamResult(c, st.scores),
  host(st, c) {
    const q = st.qs[Math.min(st.idx, st.qs.length - 1)];
    const reveal = st.stage === 'loesung';
    return {
      game: 'wissen',
      nr: st.idx + 1,
      frage: q.frage,
      options: q.options,
      stage: st.stage,
      until: st.until,
      richtig: reveal ? q.options.indexOf(q.antwort) : null,
      teams: c.teams.map((t, i) => ({ label: teamLabel(c, i), gesperrt: st.locked[i], teamWahl: reveal ? st.teamAnswer[i] : null, punkte: st.scores[i] })),
    };
  },
  player(st, pid, c) {
    const t = teamOf(c, pid);
    const partner = c.teams[t]?.members.filter((m) => m !== pid) ?? [];
    return {
      ...(wissen.host(st, c) as object),
      meineWahl: st.choices[pid]?.opt ?? null,
      partnerWahl: partner.map((m) => ({ name: nameOf(c, m), opt: st.choices[m]?.opt ?? null })),
      teamGesperrt: st.locked[t] ?? false,
      teamAntwort: st.locked[t] ? st.teamAnswer[t] : null,
      myTeam: t,
    };
  },
  skill(st, pid, success, c) {
    if (st.stage !== 'frage') return;
    const q = st.qs[st.idx];
    const right = q.options.indexOf(q.antwort);
    const opt = success ? right : pick(c.rng, [0, 1, 2, 3].filter((i) => i !== right));
    wissen.action(st, pid, { k: 'waehlen', opt }, c);
  },
};

/* ------------------------------------------------------------------ */
/* 10. Begriffe erklären                                               */
/* ------------------------------------------------------------------ */
export const BEGRIFFE_DURCHGAENGE = 2;
const begriffe: Impl<BegriffeState> = {
  init(c) {
    const seq: { team: number; explainer: string }[] = [];
    // Bots können nicht erklären: Erklärer sind (abwechselnd) die Menschen im Team
    for (let r = 0; r < BEGRIFFE_DURCHGAENGE; r++)
      c.teams.forEach((t, i) => {
        const humans = humansIn(c, t.members);
        const list = humans.length ? humans : t.members;
        seq.push({ team: i, explainer: list[r % list.length] });
      });
    return { game: 'begriffe', seq, idx: 0, stage: 'start', until: c.now + 5000, term: drawBegriff(c.s.pools, c.rng), correct: c.teams.map(() => 0), botInfo: null };
  },
  action(st, pid, a, c) {
    if (st.stage !== 'laeuft') return;
    if (pid !== st.seq[st.idx].explainer) throw new GameError('Nur der Erklärer kann das.');
    if (a.k === 'erraten') st.correct[st.seq[st.idx].team]++;
    else if (a.k !== 'weiter') throw new GameError('Ungültige Aktion');
    st.term = drawBegriff(c.s.pools, c.rng);
  },
  tick(st, c) {
    if (c.now < st.until) return false;
    if (st.stage === 'start') {
      st.stage = 'laeuft';
      st.until = c.now + sec(c, 'begriffe');
    } else if (st.stage === 'laeuft') {
      st.stage = 'pause';
      st.until = c.now + 3500;
    } else {
      st.idx++;
      if (st.idx < st.seq.length) {
        st.stage = 'start';
        st.until = c.now + 5000;
        st.term = drawBegriff(c.s.pools, c.rng);
        st.botInfo = null;
      }
    }
    return true;
  },
  done: (st) => st.idx >= st.seq.length,
  result: (st, c) => teamResult(c, st.correct),
  host(st, c) {
    const cur = st.seq[Math.min(st.idx, st.seq.length - 1)];
    return {
      game: 'begriffe',
      stage: st.stage,
      until: st.until,
      durchgang: Math.min(st.idx, st.seq.length - 1) + 1,
      durchgaenge: st.seq.length,
      team: teamLabel(c, cur.team),
      teamIdx: cur.team,
      erklaerer: nameOf(c, cur.explainer),
      correct: st.correct.map((n, i) => ({ label: teamLabel(c, i), n })),
      botInfo: st.botInfo,
    };
  },
  skill(st, pid, success, c) {
    const cur = st.seq[st.idx];
    if (!cur || st.stage !== 'laeuft' || pid === cur.explainer || teamOf(c, pid) !== cur.team) return;
    if (success) {
      setBotInfo(st, nameOf(c, pid), `hat „${st.term}“ erraten!`, true);
      st.correct[cur.team]++;
      st.term = drawBegriff(c.s.pools, c.rng);
    } else setBotInfo(st, nameOf(c, pid), 'rät daneben …', false);
  },
  player(st, pid, c) {
    const cur = st.seq[Math.min(st.idx, st.seq.length - 1)];
    const role = pid === cur.explainer ? 'erklaerer' : teamOf(c, pid) === cur.team ? 'rater' : 'zuschauer';
    return { ...(begriffe.host(st, c) as object), role, term: role === 'erklaerer' && st.stage === 'laeuft' ? st.term : null };
  },
};

/* ------------------------------------------------------------------ */

const IMPLS: Record<GameId, Impl<any>> = {
  game7, kopfrechnen: kopf, stirnraten: stirn, gegenstaende: gegen, slf, schaetzen: schaetz, montagsmaler: mal, zahlen, wissen, begriffe,
};

export const miniInit = (game: GameId, c: MCtx): MiniInner => IMPLS[game].init(c);
export const miniAction = (st: MiniInner, pid: string, a: MiniAction, c: MCtx) => {
  if (a.k === 'skill') {
    const f = IMPLS[st.game].skill;
    if (!f) throw new GameError('Ungültige Aktion');
    return f(st, pid, a.success === true, c);
  }
  return IMPLS[st.game].action(st, pid, a, c);
};
export const miniTick = (st: MiniInner, c: MCtx): boolean => IMPLS[st.game].tick(st, c);
export const miniDone = (st: MiniInner): boolean => IMPLS[st.game].done(st);
export const miniResult = (st: MiniInner, c: MCtx): MiniResult => IMPLS[st.game].result(st, c);
export const miniHostView = (st: MiniInner, c: MCtx): any => IMPLS[st.game].host(st, c);
export const miniPlayerView = (st: MiniInner, pid: string, c: MCtx): any => IMPLS[st.game].player(st, pid, c);
