/**
 * Flunker-Quiz (Spielprinzip „Finto“): Alle schreiben eine falsche, glaubwürdige Antwort (Finte),
 * dann wird aus allen Finten + echter Antwort die echte gesucht. 3 Runden.
 * Punkte: +1 für jeden, der auf deine Finte hereinfällt, +1 wenn du die echte Antwort wählst.
 */
import type { Impl, MCtx, MiniAction } from './minigames';
import type { MiniResult } from './types';
import { GameError } from './types';
import type { FlunkerFrage } from '../content';
import { drawFlunker } from '../pools';
import { shuffle, pick } from '../rng';
import { normalize } from '../text';
import { groupRanking, rankBonus } from '../bonus';

export const FLUNKER_RUNDEN = 3;
export const FLUNKER_COUNTDOWN_MS = 3500;
export const FLUNKER_AUFDECKEN_MS = 2600;
export const FLUNKER_ECHT_MS = 4000;
export const FLUNKER_ZWISCHENSTAND_MS = 6000;
export const FINTE_MAX = 40;
export const ZU_NAH = 'Das ist verdächtig nah an der Wahrheit – denk dir was anderes aus!';

export interface FlunkerOption {
  text: string;
  real: boolean;
  authors: string[];
}

export interface FlunkerState {
  game: 'flunker';
  qs: FlunkerFrage[];
  round: number;
  stage: 'countdown' | 'schreiben' | 'abstimmen' | 'aufloesung' | 'zwischenstand';
  until: number;
  startAt: number;
  finten: Record<string, string>;
  options: FlunkerOption[];
  votes: Record<string, number>;
  scores: Record<string, number>;
  gain: Record<string, number>;
  revealStart: number;
  /** Reihenfolge beim Aufdecken: erst alle Finten, zum Schluss die echte Antwort */
  revealOrder: number[];
}

/* ------------------------- Textvergleich ---------------------------- */

const ZAHLWOERTER: Record<string, string> = {
  null: '0', eins: '1', ein: '1', eine: '1', zwei: '2', drei: '3', vier: '4', fuenf: '5', sechs: '6', sieben: '7', acht: '8', neun: '9', zehn: '10',
  elf: '11', zwoelf: '12', dreizehn: '13', vierzehn: '14', fuenfzehn: '15', sechzehn: '16', siebzehn: '17', achtzehn: '18', neunzehn: '19', zwanzig: '20',
};

/** Vergleichsschlüssel: ohne Groß/Klein, Leerzeichen, Satzzeichen; Zahlwörter als Ziffern */
export function fintenKey(text: string): string {
  const n = normalize(text);
  return ZAHLWOERTER[n] ?? n;
}

/** Editierdistanz mit Vertauschung benachbarter Buchstaben (ein Tippfehler = 1) */
export function tippDistanz(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** Ist die Finte (fast) identisch mit der echten Antwort? Kleine Tippfehler werden toleriert. */
export function zuNahAnDerWahrheit(finte: string, antwort: string): boolean {
  const a = fintenKey(finte);
  const b = fintenKey(antwort);
  if (!a) return false;
  if (a === b) return true;
  const tol = b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0;
  if (tippDistanz(a, b) <= tol) return true;
  // „Olympus Mons Vulkan“ enthält die Antwort
  if (b.length >= 3 && a.includes(b)) return true;
  return false;
}

/** Einheitliche Schreibweise, damit die echte Antwort nicht an der Form auffällt */
export function formatAntwort(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[.!?,;:]+$/g, '').trim();
  return t ? t[0].toLocaleUpperCase('de') + t.slice(1) : t;
}

/* ----------------------------- Wertung ------------------------------ */

/** Punkte einer Runde aus Optionen und Stimmen */
export function flunkerRundenPunkte(options: FlunkerOption[], votes: Record<string, number>): Record<string, number> {
  const gain: Record<string, number> = {};
  for (const [voter, idx] of Object.entries(votes)) {
    const o = options[idx];
    if (!o) continue;
    if (o.real) gain[voter] = (gain[voter] ?? 0) + 1;
    else for (const a of o.authors) if (a !== voter) gain[a] = (gain[a] ?? 0) + 1;
  }
  return gain;
}

/** Optionen bauen: gleiche Finten zusammenfassen, echte Antwort dazu, mischen */
export function flunkerOptionen(finten: Record<string, string>, antwort: string, rng: () => number): FlunkerOption[] {
  const byKey = new Map<string, FlunkerOption>();
  for (const [pid, text] of Object.entries(finten)) {
    const key = fintenKey(text);
    if (!key) continue;
    const ex = byKey.get(key);
    if (ex) ex.authors.push(pid);
    else byKey.set(key, { text: formatAntwort(text), real: false, authors: [pid] });
  }
  return shuffle(rng, [...byKey.values(), { text: formatAntwort(antwort), real: true, authors: [] }]);
}

/* ------------------------------ Spiel ------------------------------- */

const ids = (c: MCtx) => c.teams.flatMap((t) => t.members);
const playerOf = (c: MCtx, id: string) => c.s.players.find((p) => p.id === id);
const nameOf = (c: MCtx, id: string) => {
  const p = playerOf(c, id);
  return p ? (p.bot ? '🤖 ' + p.name : p.name) : '?';
};
const connected = (c: MCtx) => ids(c).filter((id) => playerOf(c, id)?.connected);
const humans = (c: MCtx) => connected(c).filter((id) => !playerOf(c, id)?.bot);
const sec = (c: MCtx, k: 'flunker' | 'flunkerAbstimmen') => c.s.settings.timer[k] * 1000;

function startSchreiben(st: FlunkerState, c: MCtx) {
  st.stage = 'schreiben';
  st.until = c.now + sec(c, 'flunker');
  st.finten = {};
  st.options = [];
  st.votes = {};
  st.gain = {};
  st.revealOrder = [];
}

function startAbstimmen(st: FlunkerState, c: MCtx) {
  st.options = flunkerOptionen(st.finten, st.qs[st.round].antwort, c.rng);
  st.votes = {};
  st.stage = 'abstimmen';
  st.until = c.now + sec(c, 'flunkerAbstimmen');
}

function startAufloesung(st: FlunkerState, c: MCtx) {
  st.gain = flunkerRundenPunkte(st.options, st.votes);
  for (const [id, g] of Object.entries(st.gain)) st.scores[id] = (st.scores[id] ?? 0) + g;
  const fakes = st.options.map((o, i) => (o.real ? -1 : i)).filter((i) => i >= 0);
  st.revealOrder = [...fakes, st.options.findIndex((o) => o.real)];
  st.stage = 'aufloesung';
  st.revealStart = c.now;
  st.until = c.now + fakes.length * FLUNKER_AUFDECKEN_MS + FLUNKER_ECHT_MS;
}

export const flunkerImpl: Impl<FlunkerState> = {
  init(c) {
    const startAt = c.now + FLUNKER_COUNTDOWN_MS;
    return {
      game: 'flunker',
      qs: drawFlunker(c.s.pools, c.rng, FLUNKER_RUNDEN),
      round: 0,
      stage: 'countdown',
      until: startAt,
      startAt,
      finten: {},
      options: [],
      votes: {},
      scores: {},
      gain: {},
      revealStart: 0,
      revealOrder: [],
    };
  },
  action(st, pid, a: MiniAction, c) {
    if (a.k === 'finte') {
      if (st.stage !== 'schreiben') return;
      if (playerOf(c, pid)?.bot) throw new GameError('Bots schreiben keine Finten.');
      const text = String(a.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text) throw new GameError('Bitte schreib eine Antwort.');
      if (text.length > FINTE_MAX) throw new GameError(`Höchstens ${FINTE_MAX} Zeichen.`);
      if (zuNahAnDerWahrheit(text, st.qs[st.round].antwort)) throw new GameError(ZU_NAH);
      st.finten[pid] = text;
      return;
    }
    if (a.k === 'stimme') {
      if (st.stage !== 'abstimmen') return;
      const o = st.options[a.opt];
      if (!o || !Number.isInteger(a.opt)) throw new GameError('Ungültige Antwort');
      if (o.authors.includes(pid)) throw new GameError('Für deine eigene Finte kannst du nicht stimmen.');
      st.votes[pid] = a.opt;
      return;
    }
    throw new GameError('Ungültige Aktion');
  },
  skill(st, pid, success, c) {
    // Bots: stimmen ab, mit Trefferquote je Schwierigkeit
    if (st.stage !== 'abstimmen' || st.votes[pid] !== undefined) return;
    const real = st.options.findIndex((o) => o.real);
    const wrong = st.options.map((o, i) => (!o.real && !o.authors.includes(pid) ? i : -1)).filter((i) => i >= 0);
    st.votes[pid] = success || wrong.length === 0 ? real : pick(c.rng, wrong);
  },
  tick(st, c) {
    switch (st.stage) {
      case 'countdown':
        if (c.now < st.startAt) return false;
        startSchreiben(st, c);
        return true;
      case 'schreiben': {
        const h = humans(c);
        if (c.now >= st.until || (h.length > 0 && h.every((id) => st.finten[id] !== undefined))) {
          startAbstimmen(st, c);
          return true;
        }
        return false;
      }
      case 'abstimmen': {
        const all = connected(c);
        if (c.now >= st.until || (all.length > 0 && all.every((id) => st.votes[id] !== undefined))) {
          startAufloesung(st, c);
          return true;
        }
        return false;
      }
      case 'aufloesung':
        if (c.now < st.until) return false;
        st.stage = 'zwischenstand';
        st.until = c.now + FLUNKER_ZWISCHENSTAND_MS;
        return true;
      case 'zwischenstand':
        if (c.now < st.until) return false;
        st.round++;
        if (st.round < st.qs.length) startSchreiben(st, c);
        return true;
    }
  },
  done: (st) => st.round >= st.qs.length,
  result(st, c): MiniResult {
    const list = ids(c);
    const groups = groupRanking(list, (a, b) => (st.scores[b] ?? 0) - (st.scores[a] ?? 0), (x) => x);
    const rb = rankBonus(groups);
    const bonus: Record<string, number> = {};
    const rows = groups.flat().map((id) => {
      bonus[id] = rb[id].bonus;
      return { label: nameOf(c, id), members: [nameOf(c, id)], punkte: st.scores[id] ?? 0, bonus: rb[id].bonus, platz: rb[id].place };
    });
    return { bonus, rows };
  },
  host(st, c) {
    const q = st.qs[Math.min(st.round, st.qs.length - 1)];
    const reveal = st.stage === 'aufloesung' || st.stage === 'zwischenstand';
    const list = ids(c);
    return {
      game: 'flunker',
      stage: st.stage,
      until: st.until,
      startAt: st.startAt,
      round: Math.min(st.round, st.qs.length - 1) + 1,
      rounds: st.qs.length,
      frage: st.stage === 'countdown' ? null : q.frage,
      hinweis: st.stage === 'countdown' ? null : q.hinweis,
      schreiber: list.filter((id) => !playerOf(c, id)?.bot).map((id) => ({ name: nameOf(c, id), fertig: st.finten[id] !== undefined })),
      abgestimmt: list.filter((id) => st.votes[id] !== undefined).map((id) => nameOf(c, id)),
      // Während der Abstimmung nur die Texte – welche echt ist, verrät erst die Auflösung
      options: st.stage === 'abstimmen' ? st.options.map((o) => ({ text: o.text })) : null,
      reveal: reveal
        ? {
            start: st.revealStart,
            step: FLUNKER_AUFDECKEN_MS,
            order: st.revealOrder,
            options: st.options.map((o, i) => ({
              text: o.text,
              real: o.real,
              authors: o.authors.map((id) => nameOf(c, id)),
              voters: Object.entries(st.votes).filter(([, v]) => v === i).map(([id]) => nameOf(c, id)),
            })),
          }
        : null,
      scores: list
        .map((id) => ({ name: nameOf(c, id), punkte: st.scores[id] ?? 0, plus: reveal ? st.gain[id] ?? 0 : 0 }))
        .sort((a, b) => b.punkte - a.punkte),
    };
  },
  player(st, pid, c) {
    return {
      ...(flunkerImpl.host(st, c) as object),
      meineFinte: st.finten[pid] ?? null,
      // eigene Finte(n) in der Abstimmung markieren
      eigene: st.stage === 'abstimmen' ? st.options.map((o, i) => (o.authors.includes(pid) ? i : -1)).filter((i) => i >= 0) : [],
      meineStimme: st.votes[pid] ?? null,
      meinPlus: st.gain[pid] ?? 0,
    };
  },
};

export type { FlunkerFrage };
