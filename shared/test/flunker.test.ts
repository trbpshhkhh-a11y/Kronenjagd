import { describe, it, expect } from 'vitest';
import {
  flunkerRundenPunkte, flunkerOptionen, zuNahAnDerWahrheit, formatAntwort, fintenKey, FLUNKER_FRAGEN, ZU_NAH,
  createGameState, addPlayer, addBot, startGame, tick, playerAction, startMinigame, viewForHost, viewForPlayer, seededRng,
  GAMES, BRETT_GAME_IDS, rankBonus, groupRanking, GameState, Rng,
} from '../src';

function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 250) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}

describe('Flunker-Quiz: Punkte', () => {
  it('+1 je Mitspieler auf deiner Finte, +1 für die echte Antwort', () => {
    const options = [
      { text: 'Löwe', real: false, authors: ['a'] },
      { text: 'Einhorn', real: true, authors: [] },
      { text: 'Hirsch', real: false, authors: ['b'] },
    ];
    const g = flunkerRundenPunkte(options, { a: 1, b: 0, c: 0, d: 2 });
    expect(g).toEqual({ a: 1 + 2, b: 1 }); // a: echte Antwort + 2 Reingefallene (b, c); b: d ist reingefallen
  });
  it('doppelte Finten erscheinen einmal, beide Autoren bekommen die Punkte', () => {
    const opts = flunkerOptionen({ a: 'Löwe ', b: 'löwe.', c: 'Hirsch' }, 'Einhorn', seededRng(1));
    expect(opts).toHaveLength(3);
    const loewe = opts.findIndex((o) => fintenKey(o.text) === fintenKey('Löwe'));
    expect(opts[loewe].authors.sort()).toEqual(['a', 'b']);
    expect(opts[loewe].text).toBe('Löwe');
    const g = flunkerRundenPunkte(opts, { c: loewe });
    expect(g).toEqual({ a: 1, b: 1 });
  });
  it('einheitliche Schreibweise', () => {
    expect(formatAntwort('  einhorn. ')).toBe('Einhorn');
    expect(formatAntwort('väterchen   frost!')).toBe('Väterchen frost');
  });
  it('zu nah an der Wahrheit wird erkannt (auch Tippfehler und Zahlwörter)', () => {
    expect(zuNahAnDerWahrheit('einhorn', 'Einhorn')).toBe(true);
    expect(zuNahAnDerWahrheit('Einhron', 'Einhorn')).toBe(true);
    expect(zuNahAnDerWahrheit('3', 'Drei')).toBe(true);
    expect(zuNahAnDerWahrheit('Olympus Mons Vulkan', 'Olympus Mons')).toBe(true);
    expect(zuNahAnDerWahrheit('Löwe', 'Einhorn')).toBe(false);
    expect(zuNahAnDerWahrheit('Vier', 'Drei')).toBe(false);
  });
  it('Platz-Bonus 5/4/3/2/1, Gleichstand = gleicher Platz', () => {
    const groups = groupRanking(['a', 'b', 'c', 'd', 'e', 'f', 'g'], (x, y) => ({ a: 5, b: 5, c: 3, d: 2, e: 2, f: 1, g: 0 } as any)[y] - ({ a: 5, b: 5, c: 3, d: 2, e: 2, f: 1, g: 0 } as any)[x], (x) => x);
    const r = rankBonus(groups);
    expect([r.a, r.b, r.c, r.d, r.e, r.f, r.g].map((x) => [x.place, x.bonus])).toEqual([[1, 5], [1, 5], [3, 3], [4, 2], [4, 2], [6, 0], [7, 0]]);
  });
  it('mindestens 80 Fragen, keine doppelten, kurze Antworten mit Hinweis', () => {
    expect(FLUNKER_FRAGEN.length).toBeGreaterThanOrEqual(80);
    expect(new Set(FLUNKER_FRAGEN.map((f) => f.frage)).size).toBe(FLUNKER_FRAGEN.length);
    for (const f of FLUNKER_FRAGEN) {
      expect(f.antwort.split(' ').length).toBeLessThanOrEqual(4);
      expect(f.hinweis.length).toBeGreaterThan(2);
    }
  });
  it('nur online: nicht in Modus 1', () => {
    expect(GAMES.find((g) => g.id === 'flunker')!.nurOnline).toBe(true);
    expect(BRETT_GAME_IDS).not.toContain('flunker');
    expect(BRETT_GAME_IDS).toHaveLength(10);
  });
});

describe('Flunker-Quiz: Ablauf', () => {
  function start(humans: number, bots: number, seed = 1) {
    const s = createGameState('FL', 0, { screenMode: false });
    for (let i = 0; i < humans; i++) addPlayer(s, 'Mensch' + (i + 1), 'h' + (i + 1), 't' + i, 0);
    for (let i = 0; i < bots; i++) addBot(s, 'mittel');
    const rng = seededRng(seed);
    const t = { now: 0 };
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'flunker', null, { rng, now: t.now });
    advance(s, rng, t, 4500);
    expect(s.mini!.stage).toBe('bereit'); // keine Team-Auslosung
    for (const p of s.players) if (!p.bot) playerAction(s, p.id, { t: 'ready' }, { rng, now: t.now });
    expect(s.mini!.stage).toBe('spiel');
    advance(s, rng, t, 4000);
    return { s, rng, t, inner: () => s.mini!.inner as any };
  }
  it('Finte zu nah wird abgelehnt, eigene Finte nicht wählbar, echte Antwort bleibt bis zur Auflösung geheim', () => {
    const { s, rng, t, inner } = start(3, 0);
    expect(inner().stage).toBe('schreiben');
    const antwort = inner().qs[0].antwort;
    expect(() => playerAction(s, 'h1', { t: 'mini', a: { k: 'finte', text: antwort.toLowerCase() } }, { rng, now: t.now })).toThrow(ZU_NAH);
    playerAction(s, 'h1', { t: 'mini', a: { k: 'finte', text: 'Quatschantwort Eins' } }, { rng, now: t.now });
    playerAction(s, 'h2', { t: 'mini', a: { k: 'finte', text: 'quatschantwort eins.' } }, { rng, now: t.now });
    playerAction(s, 'h3', { t: 'mini', a: { k: 'finte', text: 'Ganz was anderes' } }, { rng, now: t.now });
    expect(inner().stage).toBe('abstimmen');
    expect(inner().options).toHaveLength(3); // doppelte Finte nur einmal
    const host = JSON.stringify(viewForHost(s, t.now));
    const pl = JSON.stringify(viewForPlayer(s, 'h1', t.now));
    expect(host).not.toContain('"real"');
    expect(pl).not.toContain('"real"');
    expect(host).not.toContain('"antwort"');
    const mine = inner().options.findIndex((o: any) => o.authors.includes('h1'));
    expect(viewForPlayer(s, 'h1', t.now)!.mini!.inner.eigene).toEqual([mine]);
    expect(() => playerAction(s, 'h1', { t: 'mini', a: { k: 'stimme', opt: mine } }, { rng, now: t.now })).toThrow(/eigene Finte/);
    const real = inner().options.findIndex((o: any) => o.real);
    const fake3 = inner().options.findIndex((o: any) => o.authors.includes('h3'));
    playerAction(s, 'h1', { t: 'mini', a: { k: 'stimme', opt: real } }, { rng, now: t.now });
    playerAction(s, 'h2', { t: 'mini', a: { k: 'stimme', opt: fake3 } }, { rng, now: t.now });
    playerAction(s, 'h3', { t: 'mini', a: { k: 'stimme', opt: mine } }, { rng, now: t.now });
    expect(inner().stage).toBe('aufloesung');
    expect(inner().scores).toEqual({ h1: 2, h2: 1, h3: 1 });
    expect(JSON.stringify(viewForHost(s, t.now))).toContain('"real":true');
  });
  it('läuft mit Bots über 3 Runden bis zur Rangliste, Belohnung nach Platz', () => {
    const { s, rng, t } = start(1, 3, 4);
    advance(s, rng, t, 10 * 60 * 1000, 500);
    expect(s.mini).toBeNull();
    // Mensch hat nie geschrieben/abgestimmt: Bots können nur über die echte Antwort punkten
    const bonusSum = s.players.reduce((a, p) => a + p.bonus, 0);
    expect(bonusSum).toBeGreaterThan(0);
    s.players.forEach((p) => expect([0, 1, 2, 3, 4, 5]).toContain(p.bonus));
  });
});
