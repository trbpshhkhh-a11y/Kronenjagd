/**
 * Hühnerhüpfer (Spielprinzip „Crossy Road“) – Server-Seite.
 * Jedes Handy berechnet Welt und Zusammenstöße selbst und meldet Hüpfer und „Raus“.
 * Der Server führt Timer und Rangliste und verteilt die Hüpfer an alle (Echtzeit-Nachrichten).
 */
import type { Impl, MCtx, MiniAction } from '../minigames';
import type { MiniResult } from '../types';
import { GameError } from '../types';
import { randInt } from '../../rng';
import { groupRanking, rankBonus } from '../../bonus';
import { H_COLS, H_COUNTDOWN_MS, H_DAUER_MS, H_ZURUECK_MAX } from './world';

export interface Runner {
  row: number;
  col: number;
  best: number;
  bestAt: number;
  /** letzte sichere Gras-Reihe (zum Wiedereinsteigen) */
  safe: number;
  out: boolean;
}

export interface HuehnerState {
  game: 'huehner';
  seed: number;
  stage: 'countdown' | 'laeuft' | 'ende';
  startAt: number;
  endAt: number;
  until: number;
  runners: Record<string, Runner>;
  /** Bots: ausgewürfelte Ziel-Reihe */
  botZiel: Record<string, number>;
  lastSync: number;
  fertig: boolean;
}

const BOT_ZIEL = { leicht: [8, 14], mittel: [13, 21], schwer: [19, 28] } as const;
const ids = (c: MCtx) => c.teams.flatMap((t) => t.members);
const playerOf = (c: MCtx, id: string) => c.s.players.find((p) => p.id === id);
const nameOf = (c: MCtx, id: string) => {
  const p = playerOf(c, id);
  return p ? (p.bot ? '🤖 ' + p.name : p.name) : '?';
};

export const huehnerImpl: Impl<HuehnerState> = {
  init(c) {
    const startAt = c.now + H_COUNTDOWN_MS;
    const runners: Record<string, Runner> = {};
    const botZiel: Record<string, number> = {};
    for (const id of ids(c)) {
      runners[id] = { row: 0, col: Math.floor(H_COLS / 2), best: 0, bestAt: startAt, safe: 0, out: false };
      const lvl = playerOf(c, id)?.bot;
      if (lvl) botZiel[id] = randInt(c.rng, BOT_ZIEL[lvl][0], BOT_ZIEL[lvl][1]);
    }
    return { game: 'huehner', seed: randInt(c.rng, 1, 2 ** 30), stage: 'countdown', startAt, endAt: startAt + H_DAUER_MS, until: startAt, runners, botZiel, lastSync: c.now, fertig: false };
  },
  action(st, pid, a: MiniAction, c) {
    const r = st.runners[pid];
    if (!r) throw new GameError('Du spielst hier nicht mit.');
    if (st.stage !== 'laeuft' || c.now > st.endAt + 800) return;
    if (a.k === 'hop') {
      const row = Math.round(Number(a.row));
      const col = Number(a.col);
      if (!Number.isFinite(row) || !Number.isFinite(col) || col < -1 || col > H_COLS) throw new GameError('Ungültiger Hüpfer');
      if (row < 0) return;
      // Nach dem Rausfliegen geht es auf der letzten sicheren Wiese weiter – sonst nur Hüpfer um 1–2 Reihen
      if (!r.out && (Math.abs(row - r.row) > 2 || row < r.best - H_ZURUECK_MAX)) return; // unplausibel – ignorieren
      if (r.out && row > r.best) return;
      r.row = row;
      r.col = Math.max(0, Math.min(H_COLS - 1, col));
      r.out = false;
      if (a.safe) r.safe = row;
      if (row > r.best) {
        r.best = row;
        r.bestAt = c.now;
      }
      return;
    }
    if (a.k === 'raus') {
      r.out = true;
      return;
    }
    throw new GameError('Ungültige Aktion');
  },
  tick(st, c) {
    if (st.stage === 'countdown') {
      if (c.now < st.startAt) return false;
      st.stage = 'laeuft';
      st.lastSync = c.now;
      return true;
    }
    if (st.stage === 'laeuft') {
      // Bots kommen gleichmäßig voran
      const f = Math.min(1, (c.now - st.startAt) / H_DAUER_MS);
      for (const [id, ziel] of Object.entries(st.botZiel)) {
        const r = st.runners[id];
        const row = Math.floor(ziel * f);
        if (row > r.best) {
          r.best = row;
          r.row = row;
          r.bestAt = c.now;
        }
      }
      if (c.now >= st.endAt) {
        st.stage = 'ende';
        st.until = c.now + 3500;
        return true;
      }
      // etwa einmal pro Sekunde den vollen Stand verschicken (Rangliste, Wiedereinstieg)
      if (c.now - st.lastSync >= 1000) {
        st.lastSync = c.now;
        return true;
      }
      return false;
    }
    if (c.now >= st.until && !st.fertig) {
      st.fertig = true;
      return true;
    }
    return false;
  },
  done: (st) => st.fertig,
  result(st, c): MiniResult {
    const list = ids(c);
    const groups = groupRanking(
      list,
      (a, b) => st.runners[b].best - st.runners[a].best || st.runners[a].bestAt - st.runners[b].bestAt,
      (x) => x,
    );
    const rb = rankBonus(groups);
    const bonus: Record<string, number> = {};
    const rows = groups.flat().map((id) => {
      bonus[id] = rb[id].bonus;
      const best = st.runners[id].best;
      return { label: nameOf(c, id), members: [nameOf(c, id)], punkte: best, bonus: rb[id].bonus, platz: rb[id].place, anzeige: `Reihe ${best}` };
    });
    return { bonus, rows };
  },
  host(st, c) {
    return {
      game: 'huehner',
      stage: st.stage,
      seed: st.seed,
      startAt: st.startAt,
      endAt: st.endAt,
      until: st.until,
      runners: ids(c).map((id) => {
        const p = playerOf(c, id);
        return { id, name: nameOf(c, id), color: p?.color ?? '#999', bot: !!p?.bot, ...st.runners[id] };
      }),
    };
  },
  player(st, pid, c) {
    return { ...(huehnerImpl.host(st, c) as object), me: pid };
  },
};
