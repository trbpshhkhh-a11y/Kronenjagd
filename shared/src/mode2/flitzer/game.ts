/**
 * Turbo-Flitzer – Server-Seite. Der Server rechnet die Fahrphysik (maßgeblich),
 * die Handys schicken nur ihren Joystick (ca. 20× pro Sekunde) und zeichnen die Autos.
 */
import type { Impl, MCtx, MiniAction } from '../minigames';
import type { MiniResult } from '../types';
import { GameError } from '../types';
import { randInt, shuffle } from '../../rng';
import { groupRanking, rankBonus } from '../../bonus';
import {
  TRACKS, F_COUNTDOWN_MS, F_MAX_MS, F_NACH_SIEG_MS, F_RUNDEN, Car, Steuer, grid, stepCar, collide, bande, checkGates, fortschritt, runde, botSteuer, newCar,
} from './track';

export interface FlitzerState {
  game: 'flitzer';
  track: number;
  stage: 'countdown' | 'rennen' | 'ende';
  startAt: number;
  /** spätestes Ende (2 min, nach dem ersten Zieleinlauf noch 15 s) */
  endAt: number;
  firstFinish: number | null;
  until: number;
  cars: Car[];
  input: Record<string, Steuer>;
  /** Bots: Tempo + seitlicher Versatz */
  bots: Record<string, { tempo: number; versatz: number }>;
  simTime: number;
  lastSync: number;
  fertig: boolean;
}

const STEP = 1 / 60;
const BOT_TEMPO = { leicht: 0.7, mittel: 0.82, schwer: 0.95 } as const;
const ids = (c: MCtx) => c.teams.flatMap((t) => t.members);
const playerOf = (c: MCtx, id: string) => c.s.players.find((p) => p.id === id);
const nameOf = (c: MCtx, id: string) => {
  const p = playerOf(c, id);
  return p ? (p.bot ? '🤖 ' + p.name : p.name) : '?';
};

/** Rennen bis zur Zeit now weiterrechnen (feste Schritte) */
export function flitzerAdvance(st: FlitzerState, c: MCtx, now: number) {
  if (st.stage !== 'rennen') {
    st.simTime = now;
    return;
  }
  const tr = TRACKS[st.track];
  // nicht mehr als 0,25 s nachholen (z. B. nach einem Hänger)
  if (now - st.simTime > 250) st.simTime = now - 250;
  while (st.simTime + STEP * 1000 <= now) {
    st.simTime += STEP * 1000;
    const t = (st.simTime - st.startAt) / 1000;
    const durch = new Set<string>();
    for (const car of st.cars) {
      const bot = st.bots[car.id];
      let s: Steuer = { a: 0, m: 0 };
      if (car.finishAt !== null) s = { a: -car.a, m: 0 };
      else if (bot) s = botSteuer(tr, car, bot.tempo, bot.versatz, t);
      else if (playerOf(c, car.id)?.connected) s = st.input[car.id] ?? s;
      else durch.add(car.id); // getrennt: Auto steht und blockiert niemanden
      stepCar(tr, car, s, STEP);
    }
    collide(st.cars, durch);
    for (const car of st.cars) bande(tr, car); // nach dem Schubsen wieder hinter die Bande
    for (const car of st.cars)
      if (checkGates(tr, car, st.simTime) && st.firstFinish === null) {
        st.firstFinish = st.simTime;
        st.endAt = Math.min(st.endAt, st.simTime + F_NACH_SIEG_MS);
      }
  }
}

/** Kompakter Schnappschuss für die Echtzeit-Nachricht: [x, y, Winkel, Tempo, Kontrollpunkte, im Ziel, Schubs x, Schubs y] */
export function flitzerSnapshot(st: FlitzerState) {
  return {
    g: 'f',
    t: Math.round(st.simTime),
    c: st.cars.map((k) => [
      Math.round(k.x * 10) / 10, Math.round(k.y * 10) / 10, Math.round(k.a * 1000) / 1000, Math.round(k.v), k.gates, k.finishAt === null ? 0 : 1,
      Math.round(k.kx), Math.round(k.ky),
    ]),
  };
}

function ranking(st: FlitzerState) {
  const tr = TRACKS[st.track];
  const p = new Map(st.cars.map((k) => [k.id, fortschritt(tr, k)]));
  return groupRanking(
    st.cars.map((k) => k.id),
    (a, b) => {
      const A = st.cars.find((k) => k.id === a)!, B = st.cars.find((k) => k.id === b)!;
      if (A.finishAt !== null || B.finishAt !== null) return (A.finishAt ?? Infinity) - (B.finishAt ?? Infinity);
      return p.get(b)! - p.get(a)!;
    },
    (x) => x,
  );
}

export const flitzerImpl: Impl<FlitzerState> = {
  init(c) {
    const track = randInt(c.rng, 0, TRACKS.length - 1);
    const order = shuffle(c.rng, ids(c));
    const g = grid(TRACKS[track], order.length);
    const startAt = c.now + F_COUNTDOWN_MS;
    const bots: FlitzerState['bots'] = {};
    order.forEach((id, i) => {
      const lvl = playerOf(c, id)?.bot;
      if (lvl) bots[id] = { tempo: BOT_TEMPO[lvl], versatz: ((i % 3) - 1) * 18 };
    });
    return {
      game: 'flitzer', track, stage: 'countdown', startAt, endAt: startAt + F_MAX_MS, firstFinish: null, until: startAt,
      cars: order.map((id, i) => newCar(id, g[i].x, g[i].y, g[i].a)),
      input: {}, bots, simTime: c.now, lastSync: c.now, fertig: false,
    };
  },
  action(st, pid, a: MiniAction, c) {
    if (!st.cars.some((k) => k.id === pid)) throw new GameError('Du fährst hier nicht mit.');
    if (a.k !== 'lenk') throw new GameError('Ungültige Aktion');
    const ang = Number(a.a), m = Number(a.m);
    if (!Number.isFinite(ang) || !Number.isFinite(m)) throw new GameError('Ungültige Eingabe');
    // erst bis jetzt weiterrechnen, dann die neue Eingabe gelten lassen
    flitzerAdvance(st, c, c.now);
    st.input[pid] = { a: ang, m: Math.max(0, Math.min(1, m)) };
  },
  tick(st, c) {
    if (st.stage === 'countdown') {
      if (c.now < st.startAt) return false;
      st.stage = 'rennen';
      st.simTime = st.startAt;
      st.lastSync = c.now;
      return true;
    }
    if (st.stage === 'rennen') {
      flitzerAdvance(st, c, c.now);
      const alleImZiel = st.cars.every((k) => k.finishAt !== null);
      if (c.now >= st.endAt || alleImZiel) {
        st.stage = 'ende';
        st.until = c.now + 4000;
        return true;
      }
      // etwa einmal pro Sekunde den vollen Stand (Runden, Plätze) verschicken
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
    const groups = ranking(st);
    const rb = rankBonus(groups);
    const bonus: Record<string, number> = {};
    const rows = groups.flat().map((id) => {
      const car = st.cars.find((k) => k.id === id)!;
      bonus[id] = rb[id].bonus;
      const zeit = car.finishAt !== null ? ((car.finishAt - st.startAt) / 1000).toFixed(1).replace('.', ',') + ' s' : `Runde ${runde(car)}/${F_RUNDEN}`;
      return { label: nameOf(c, id), members: [nameOf(c, id)], punkte: car.gates, bonus: rb[id].bonus, platz: rb[id].place, anzeige: zeit };
    });
    return { bonus, rows };
  },
  host(st, c) {
    const places = new Map<string, number>();
    ranking(st).forEach((grp, i, all) => {
      const place = all.slice(0, i).reduce((n, g) => n + g.length, 0) + 1;
      for (const id of grp) places.set(id, place);
    });
    return {
      game: 'flitzer',
      track: st.track,
      stage: st.stage,
      startAt: st.startAt,
      endAt: st.endAt,
      firstFinish: st.firstFinish,
      snap: flitzerSnapshot(st),
      cars: st.cars.map((k) => {
        const p = playerOf(c, k.id);
        return {
          id: k.id, name: nameOf(c, k.id), color: p?.color ?? '#999', bot: !!p?.bot, runde: runde(k), gates: k.gates,
          platz: places.get(k.id) ?? 0, zeit: k.finishAt !== null ? k.finishAt - st.startAt : null,
        };
      }),
    };
  },
  player(st, pid, c) {
    return { ...(flitzerImpl.host(st, c) as object), me: pid };
  },
};
