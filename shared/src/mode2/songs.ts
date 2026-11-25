/**
 * Rückwärts-Songs: Eine bekannte Melodie wird rückwärts abgespielt, jeder loggt den Liedtitel ein.
 * Wer richtig liegt, bekommt einen Punkt (= ein Bonusfeld). 5 Lieder.
 */
import type { Impl, MCtx, MiniAction } from './minigames';
import type { MiniResult } from './types';
import { GameError } from './types';
import { SONGS, Song, songDauer } from '../content/songs';
import { drawSongs } from '../pools';
import { normalize, levenshtein } from '../text';
import { pick } from '../rng';

export const SONGS_RUNDEN = 5;
/** 3-2-1 vor jedem Lied */
export const SONGS_COUNTDOWN_MS = 3500;
/** Pause zwischen zwei Wiederholungen des Ausschnitts */
export const SONGS_PAUSE_MS = 2500;
export const SONG_TIPP_MAX = 60;

/** Ist der eingeloggte Titel richtig? Tippfehler und Teiltitel werden großzügig akzeptiert. */
export function songMatch(antwort: string, song: Song): boolean {
  const a = normalize(antwort).replace(/^(der|die|das|the)(?=[a-z])/, '');
  if (a.length < 3) return false;
  for (const alias of [song.titel, ...song.aliase]) {
    const t = normalize(alias);
    const tol = t.length >= 14 ? 3 : t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
    if (levenshtein(a, t) <= tol) return true;
    // ganzer Titel in der Antwort enthalten („Ich glaube Jingle Bells“)
    if (t.length >= 6 && a.includes(t)) return true;
    // ausreichend großer Teil des Titels („Tannenbaum“, „Halle des Bergkönigs“)
    if (a.length >= 8 && a.length >= t.length * 0.5 && t.includes(a)) return true;
  }
  return false;
}

export interface SongsState {
  game: 'songs';
  /** Lieder dieser Runde (Index in SONGS) */
  ids: number[];
  idx: number;
  stage: 'countdown' | 'hoeren' | 'aufloesung';
  /** Start des rückwärts gespielten Ausschnitts (Serverzeit) */
  startAt: number;
  until: number;
  answers: Record<string, { text: string; ok: boolean; at: number }>;
  scores: Record<string, number>;
}

const ids = (c: MCtx) => c.teams.flatMap((t) => t.members);
const playerOf = (c: MCtx, id: string) => c.s.players.find((p) => p.id === id);
const nameOf = (c: MCtx, id: string) => {
  const p = playerOf(c, id);
  return p ? (p.bot ? '🤖 ' + p.name : p.name) : '?';
};
const sec = (c: MCtx) => (c.s.settings.timer.songs ?? 40) * 1000;
const song = (st: SongsState) => SONGS[st.ids[Math.min(st.idx, st.ids.length - 1)]];

function neuesLied(st: SongsState, c: MCtx) {
  st.stage = 'countdown';
  st.startAt = c.now + SONGS_COUNTDOWN_MS;
  st.until = st.startAt;
  st.answers = {};
}

function aufloesen(st: SongsState, c: MCtx) {
  for (const [id, a] of Object.entries(st.answers)) if (a.ok) st.scores[id] = (st.scores[id] ?? 0) + 1;
  st.stage = 'aufloesung';
  // Lied einmal vorwärts zum Mitsummen, danach kurz die Ergebnisse
  st.until = c.now + Math.max(8000, songDauer(song(st)) * 1000 + 3500);
}

export const songsImpl: Impl<SongsState> = {
  init(c) {
    const picked = drawSongs(c.s.pools, c.rng, SONGS_RUNDEN);
    const st: SongsState = { game: 'songs', ids: picked, idx: 0, stage: 'countdown', startAt: 0, until: 0, answers: {}, scores: {} };
    neuesLied(st, c);
    return st;
  },
  action(st, pid, a: MiniAction, c) {
    if (!ids(c).includes(pid)) throw new GameError('Du spielst hier nicht mit.');
    if (a.k !== 'songTipp') throw new GameError('Ungültige Aktion');
    if (st.stage !== 'hoeren') throw new GameError('Gerade kann man keinen Titel einloggen.');
    if (st.answers[pid]) throw new GameError('Du hast schon eingeloggt.');
    const text = String(a.text ?? '').trim().slice(0, SONG_TIPP_MAX);
    if (!text) throw new GameError('Bitte einen Liedtitel eingeben.');
    st.answers[pid] = { text, ok: songMatch(text, song(st)), at: c.now };
  },
  tick(st, c) {
    if (st.stage === 'countdown') {
      if (c.now < st.startAt) return false;
      st.stage = 'hoeren';
      st.until = st.startAt + sec(c);
      return true;
    }
    if (st.stage === 'hoeren') {
      // vorbei, wenn die Zeit um ist oder alle Verbundenen eingeloggt haben
      const offen = ids(c).filter((id) => playerOf(c, id)?.connected && !st.answers[id]);
      if (c.now >= st.until || offen.length === 0) {
        aufloesen(st, c);
        return true;
      }
      return false;
    }
    if (c.now >= st.until && st.idx < st.ids.length) {
      st.idx++;
      if (st.idx < st.ids.length) neuesLied(st, c);
      return true;
    }
    return false;
  },
  done: (st) => st.idx >= st.ids.length,
  result(st, c): MiniResult {
    const bonus: Record<string, number> = {};
    const rows = ids(c).map((id) => {
      const p = st.scores[id] ?? 0;
      bonus[id] = p;
      return { label: nameOf(c, id), members: [nameOf(c, id)], punkte: p, bonus: p, anzeige: `${p} von ${st.ids.length}` };
    });
    return { bonus, rows: rows.sort((x, y) => y.punkte - x.punkte) };
  },
  host(st, c) {
    const s = song(st);
    const reveal = st.stage === 'aufloesung';
    return {
      game: 'songs',
      nr: Math.min(st.idx, st.ids.length - 1) + 1,
      runden: st.ids.length,
      stage: st.stage,
      startAt: st.startAt,
      until: st.until,
      // nur die Melodie – der Titel bleibt bis zur Auflösung geheim
      melodie: { bpm: s.bpm, noten: s.noten },
      titel: reveal ? s.titel : null,
      eingeloggt: ids(c).filter((id) => st.answers[id]).map((id) => nameOf(c, id)),
      alle: reveal ? ids(c).map((id) => ({ name: nameOf(c, id), text: st.answers[id]?.text ?? null, ok: !!st.answers[id]?.ok })) : null,
      scores: ids(c).map((id) => ({ name: nameOf(c, id), punkte: st.scores[id] ?? 0 })).sort((x, y) => y.punkte - x.punkte),
    };
  },
  player(st, pid, c) {
    const mine = st.answers[pid];
    return {
      ...(songsImpl.host(st, c) as object),
      meins: mine ? { text: mine.text, ok: st.stage === 'aufloesung' ? mine.ok : null } : null,
    };
  },
  skill(st, pid, success, c) {
    if (st.stage !== 'hoeren' || st.answers[pid]) return;
    const s = song(st);
    const text = success ? s.titel : pick(c.rng, SONGS.filter((x) => x !== s)).titel;
    st.answers[pid] = { text, ok: songMatch(text, s), at: c.now };
  },
};
