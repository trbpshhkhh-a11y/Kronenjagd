/**
 * Bots für Modus 2. Ein Bot entscheidet AUSSCHLIESSLICH anhand seiner eigenen
 * Spieleransicht (viewForPlayer) – also mit genau den Informationen, die ein
 * Mensch in seiner Rolle auch hätte. Wo ein Bot etwas "wissen" müsste
 * (z. B. die richtige Antwort einer Wissensfrage), wird nur ausgewürfelt, OB er
 * es weiß; die Engine löst das dann im Minispiel auf (Aktion `skill`).
 */
import type { PlayerView, PublicPlayer } from './views';
import type { PlayerAction } from './engine';
import type { GameId } from '../games';
import type { Rng } from '../rng';
import { pick, randInt } from '../rng';
import { BOT_ERFOLG, BOT_GAME7_EINLOGGEN, BOT_VERZOEGERUNG, BotLevel } from './constants';
import { distanceToNearest, fieldType } from '../board';
import { ZAHLEN_HINWEISE } from '../content/zahlenHinweise';
import { SLF_ANTWORTEN } from '../content/slfAntworten';
import { startsWithLetter } from '../text';

export interface BotPlan {
  /** Kennung der Situation: ändert sie sich, plant der Bot neu */
  sig: string;
  /** Verzögerung in ms (min, max) */
  delay: [number, number];
  /** nach der Aktion erneut planen (z. B. weiter raten) */
  repeat?: boolean;
  act: (rng: Rng) => PlayerAction | null;
}

export interface BotOptions {
  /** Für Tests: auch in Teams mit Menschen handeln (Game of 7) */
  actForHumans?: boolean;
}

const D = BOT_VERZOEGERUNG;
const mini = (a: any): PlayerAction => ({ t: 'mini', a });
const skill = (level: BotLevel) => (rng: Rng): PlayerAction => mini({ k: 'skill', success: rng() < BOT_ERFOLG[level] });

/** Je schwerer, desto schneller (Raten, Rechnen) */
function speed(level: BotLevel, base: [number, number]): [number, number] {
  const f = level === 'leicht' ? 1.3 : level === 'schwer' ? 0.65 : 1;
  return [Math.round(base[0] * f), Math.round(base[1] * f)];
}

/** Verzögerung so begrenzen, dass sie vor Ablauf des Timers liegt */
function before(delay: [number, number], until: number | null | undefined, now: number, reserve = 1500): [number, number] {
  if (!until || until < 0) return delay;
  const max = Math.max(300, until - now - reserve);
  return [Math.min(delay[0], max), Math.min(delay[1], max)];
}

const playerOf = (v: PlayerView, id: string): PublicPlayer | undefined => v.players.find((p) => p.id === id);
const isBotId = (v: PlayerView, id: string) => !!playerOf(v, id)?.bot;

/* ------------------------------------------------------------------ */

export function botPlan(v: PlayerView, level: BotLevel, opts: BotOptions = {}): BotPlan | null {
  const ph = v.phase;
  if (ph.k === 'minispiel') return v.mini ? miniPlan(v, level, opts) : null;
  if (v.turnPlayerId !== v.me.id) return null;
  const t = v.turnNo;
  switch (ph.k) {
    case 'wuerfeln':
      return { sig: `roll-${t}`, delay: D, act: () => ({ t: 'roll' }) };
    case 'richtung':
      return {
        sig: `dir-${t}-${ph.remaining}-${v.me.pos}`,
        delay: [1200, 2800],
        act: (rng) => ({ t: 'direction', key: chooseDirection(v, level, rng) }),
      };
    case 'karteZiehen':
      return { sig: `card-${t}`, delay: D, act: () => ({ t: 'drawCard' }) };
    case 'karte':
      if (ph.stage !== 'wahl') return null;
      if (ph.card === 'tausch') return { sig: `tausch-${t}`, delay: [1500, 3200], act: (rng) => ({ t: 'tauschWahl', target: chooseSwap(v, level, rng) }) };
      if (ph.card === 'spielWahl') return { sig: `spiel-${t}`, delay: [1500, 3200], act: (rng) => ({ t: 'spielWahl', game: chooseGame(v, rng) }) };
      return null;
    default:
      return null;
  }
}

/* --------------------------- Brett ---------------------------------- */

export function chooseDirection(v: PlayerView, level: BotLevel, rng: Rng): string {
  if (v.phase.k !== 'richtung') return '';
  const opts = v.phase.options;
  if (opts.length === 1 || level === 'leicht') return pick(rng, opts).key;
  const crowns = v.crowns;
  if (level === 'mittel') {
    const withCrown = opts.filter((o) => crowns.some((c) => o.path.includes(c.field)));
    return pick(rng, withCrown.length ? withCrown : opts).key;
  }
  // schwer: Ziele bewerten
  const score = (o: (typeof opts)[number]) => {
    let s = 0;
    for (const c of crowns) if (o.path.includes(c.field)) s += c.value * 10 + (o.target === c.field ? 2 : 0);
    if (o.final) {
      const ty = fieldType(o.target);
      s += { normal: 0, plus2: 2, minus2: -4, ereignis: 3, wiederholung: 2, minispiel: 2 }[ty];
    }
    const rest = crowns.filter((c) => !o.path.includes(c.field)).map((c) => c.field);
    const d = distanceToNearest(o.target, rest);
    if (Number.isFinite(d)) s -= d * 0.4;
    return s + rng() * 0.1;
  };
  return [...opts].sort((a, b) => score(b) - score(a))[0].key;
}

export function chooseSwap(v: PlayerView, level: BotLevel, rng: Rng): string {
  const others = v.players.filter((p) => p.id !== v.me.id);
  if (level === 'leicht') return pick(rng, others).id;
  const crownFields = v.crowns.map((c) => c.field);
  const dist = (p: PublicPlayer) => distanceToNearest(p.pos, crownFields) + rng() * 0.01;
  return [...others].sort((a, b) => dist(a) - dist(b))[0].id;
}

/** Spiele, die Bots gut spielen können */
export const BOT_FREUNDLICH: GameId[] = ['schaetzen', 'wissen', 'kopfrechnen', 'gegenstaende', 'slf', 'zahlen'];

export function chooseGame(v: PlayerView, rng: Rng): GameId {
  const good = v.playableGames.filter((g) => BOT_FREUNDLICH.includes(g));
  return pick(rng, good.length ? good : v.playableGames);
}

/* ------------------------- Minispiele ------------------------------- */

/** Rechenaufgabe aus dem angezeigten Text ausrechnen (wie ein Mensch im Kopf) */
export function solveTask(text: string): number | null {
  const t = text.replace(/−/g, '-').replace(/×/g, '*').replace(/\s+/g, ' ').trim();
  const pct = t.match(/^(\d+) % von (\d+)$/);
  if (pct) return (Number(pct[1]) * Number(pct[2])) / 100;
  if (!/^[\d+\-* ]+$/.test(t)) return null;
  // Punkt vor Strich, nur + - *
  const terms = t.split(/(?=[+-])/).map((x) => x.replace(/\s/g, ''));
  let sum = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const prod = term.replace(/^[+-]/, '').split('*').reduce((p, x) => p * Number(x), 1);
    if (!Number.isFinite(prod)) return null;
    sum += sign * prod;
  }
  return sum;
}

function teamIndexOf(v: PlayerView): number {
  return v.mini ? v.mini.teams.findIndex((t) => t.members.includes(v.me.id)) : -1;
}

function miniPlan(v: PlayerView, level: BotLevel, opts: BotOptions): BotPlan | null {
  const m = v.mini!;
  if (m.stage !== 'spiel' || !m.inner) return null;
  const inner = m.inner;
  const now = v.serverNow;
  const myTeam = teamIndexOf(v);
  switch (inner.game as GameId) {
    case 'game7': {
      if (!inner.canAct) return null;
      const members = m.teams[myTeam]?.members ?? [];
      // Gehört ein Mensch zum Team, wirft er den echten Ball und tippt selbst.
      if (!opts.actForHumans && !members.every((id) => isBotId(v, id))) return null;
      const cur = inner.teams[inner.current];
      return {
        sig: `g7-${inner.target}-${inner.current}-${cur.stage}-${cur.locked}`,
        delay: [1500, 3200],
        act: (rng) => {
          if (cur.stage >= BOT_GAME7_EINLOGGEN[level]) return mini({ k: 'g7', v: 'einloggen' });
          return mini({ k: 'g7', v: rng() < BOT_ERFOLG[level] ? 'geschafft' : 'fehl' });
        },
      };
    }
    case 'kopfrechnen': {
      if (inner.stage !== 'frage' || inner.gesperrt || inner.winner) return null;
      return {
        sig: `kopf-${inner.nr}`,
        delay: before(speed(level, [6000, 15000]), inner.until, now),
        act: (rng) => {
          const sol = solveTask(inner.text);
          if (sol === null) return null;
          if (rng() < BOT_ERFOLG[level]) return mini({ k: 'antwort', value: sol });
          const off = randInt(rng, 1, 10) * (rng() < 0.5 ? -1 : 1);
          return mini({ k: 'antwort', value: sol + off });
        },
      };
    }
    case 'stirnraten':
      if (inner.role !== 'rater' || inner.stage !== 'laeuft') return null;
      return { sig: `stirn-${inner.teamIdx}`, delay: before(speed(level, [7000, 14000]), inner.until, now, 500), repeat: true, act: skill(level) };
    case 'montagsmaler':
      if (inner.role !== 'rater' || inner.stage !== 'laeuft') return null;
      return { sig: `mal-${inner.teamIdx}-${inner.begriffNr}`, delay: before(speed(level, [6000, 13000]), inner.until, now, 500), repeat: true, act: skill(level) };
    case 'begriffe':
      if (inner.role !== 'rater' || inner.stage !== 'laeuft') return null;
      return { sig: `beg-${inner.durchgang}`, delay: before(speed(level, [5000, 11000]), inner.until, now, 500), repeat: true, act: skill(level) };
    case 'gegenstaende':
      if (inner.stage !== 'abfrage' || inner.meineWahl) return null;
      return { sig: `gegen-${inner.frageNr}`, delay: before([1200, 4500], inner.until, now, 800), act: skill(level) };
    case 'schaetzen':
      if (inner.stage !== 'frage' || inner.meine !== null) return null;
      return { sig: `sch-${inner.nr}`, delay: before([4000, 14000], inner.until, now), act: skill(level) };
    case 'wissen': {
      if (inner.stage !== 'frage' || inner.teamGesperrt) return null;
      const partner = (inner.partnerWahl as { opt: number | null }[]).find((p) => p.opt !== null);
      if (inner.meineWahl === null) {
        return {
          sig: `w-${inner.nr}`,
          delay: before(partner ? [1500, 4000] : [3000, 9000], inner.until, now),
          act: (rng) => {
            const p = (inner.partnerWahl as { opt: number | null }[]).find((x) => x.opt !== null);
            if (p && level !== 'leicht' && rng() < 0.75) return mini({ k: 'waehlen', opt: p.opt });
            return skill(level)(rng);
          },
        };
      }
      if (partner && partner.opt !== inner.meineWahl && level !== 'leicht') {
        return {
          sig: `wa-${inner.nr}-${partner.opt}`,
          delay: before([1500, 3500], inner.until, now),
          act: (rng) => (rng() < 0.6 ? mini({ k: 'waehlen', opt: partner.opt }) : null),
        };
      }
      return null;
    }
    case 'slf': {
      if (inner.stage === 'pruefung') {
        if (inner.ichFertig) return null;
        return { sig: 'slf-fertig', delay: [1500, 4000], act: () => mini({ k: 'fertig' }) };
      }
      const empty = (inner.meineAntworten as string[]).every((a) => !a.trim());
      if (!empty) return null;
      const late = inner.stage === 'nachspiel';
      return {
        sig: late ? 'slf-spaet' : 'slf-schreiben',
        delay: late ? [800, 3000] : before([15000, 40000], inner.until, now, 5000),
        act: (rng) => {
          const answers = (inner.cats as string[]).map((cat) => {
            if (rng() >= Math.min(0.95, BOT_ERFOLG[level] + 0.25)) return '';
            const words = (SLF_ANTWORTEN[cat] ?? []).filter((w) => startsWithLetter(w, inner.letter));
            return words.length ? pick(rng, words) : '';
          });
          return mini({ k: 'slfAntworten', answers });
        },
      };
    }
    case 'zahlen': {
      if (inner.stage !== 'raten') return null;
      const team = inner.teams[myTeam] as { raterId: string; kennerIds: string[] };
      if (!team) return null;
      const kennerAllBots = team.kennerIds.length > 0 && team.kennerIds.every((id: string) => isBotId(v, id));
      const myHints = (inner.hints as { team: number; kategorie: string; begriff: string }[]).filter((h) => h.team === myTeam);
      if (inner.role === 'kenner') {
        // Kenner-Bot gibt nur Hinweise, wenn kein Mensch im Team Kenner ist
        if (!kennerAllBots || myHints.length >= 3 || team.kennerIds[0] !== v.me.id) return null;
        return {
          sig: `hint-${myHints.length}`,
          delay: before(myHints.length === 0 ? [5000, 9000] : [14000, 22000], inner.until, now, 20000),
          act: (rng) => {
            const kat = ZAHLEN_HINWEISE[(myTeam + myHints.length) % ZAHLEN_HINWEISE.length];
            const dev = level === 'schwer' ? 0 : rng() < (level === 'leicht' ? 0.5 : 0.25) ? (rng() < 0.5 ? -1 : 1) : 0;
            const idx = Math.min(9, Math.max(0, (inner.zahl as number) - 1 + dev));
            return mini({ k: 'hinweis', kategorie: kat.kategorie, begriff: kat.begriffe[idx] });
          },
        };
      }
      if (inner.meinTipp !== null) return null;
      if (kennerAllBots) {
        if (myHints.length < 2) return null;
        return {
          sig: 'ztipp',
          delay: before([2500, 5000], inner.until, now),
          act: (rng) => {
            // aus den gehörten Hinweisen schätzen
            const idx = myHints.map((h) => ZAHLEN_HINWEISE.find((k) => k.kategorie === h.kategorie)?.begriffe.indexOf(h.begriff) ?? 4);
            let est = Math.round(idx.reduce((a, b) => a + b, 0) / idx.length) + 1;
            if (level === 'leicht') est += randInt(rng, -2, 2);
            else if (level === 'mittel' && rng() < 0.4) est += rng() < 0.5 ? -1 : 1;
            return mini({ k: 'zahlTipp', value: Math.min(10, Math.max(1, est)) });
          },
        };
      }
      // Mensch ist Kenner: Der Bot "hört zu" – Treffsicherheit wird ausgewürfelt
      return { sig: 'ztipp-mensch', delay: before([35000, 70000], inner.until, now, 8000), act: skill(level) };
    }
    default:
      return null;
  }
}
