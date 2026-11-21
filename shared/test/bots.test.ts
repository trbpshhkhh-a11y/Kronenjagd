import { describe, it, expect } from 'vitest';
import {
  createGameState, addPlayer, addBot, setBotLevel, removePlayer, startGame, tick, playerAction, hostAction, currentPlayer,
  viewForPlayer, viewForHost, playableGames, startMinigame, canLead, maintainLeader, setConnected, botPlan, solveTask,
  seededRng, GameState, Rng, GETRENNT_UEBERSPRINGEN_MS, makeTeamsHumansFirst, GameError, BOT_NAMEN,
} from '../src';

function lobby(humans: number, bots: number, opts: { screenMode?: boolean; seed?: number } = {}) {
  const s = createGameState('BOTS1', 0, { screenMode: opts.screenMode ?? false });
  for (let i = 0; i < humans; i++) addPlayer(s, 'Mensch' + (i + 1), 'h' + (i + 1), 'tok' + (i + 1), 0);
  for (let i = 0; i < bots; i++) addBot(s, 'mittel', 0);
  return { s, rng: seededRng(opts.seed ?? 1), t: { now: 0 } };
}

function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 100) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}

describe('Bots in der Lobby', () => {
  it('Bots hinzufügen, eindeutige Namen, Schwierigkeit ändern, entfernen', () => {
    const { s } = lobby(1, 0);
    const a = addBot(s, 'leicht');
    const b = addBot(s);
    expect(a.name).toBe(BOT_NAMEN[0]);
    expect(b.name).toBe(BOT_NAMEN[1]);
    expect(a.bot).toBe('leicht');
    expect(b.bot).toBe('mittel');
    expect(new Set(s.players.map((p) => p.color)).size).toBe(3);
    setBotLevel(s, a.id, 'schwer');
    expect(a.bot).toBe('schwer');
    expect(() => setBotLevel(s, 'h1', 'schwer')).toThrow(/kein Bot/);
    expect(() => addBot(s, 'unmöglich')).toThrow(/Schwierigkeit/);
    removePlayer(s, a.id);
    expect(s.players.map((p) => p.id)).toEqual(['h1', b.id]);
    const c = addBot(s);
    expect(c.name).toBe(BOT_NAMEN[0]); // frei gewordener Name wird wieder genutzt
  });
  it('höchstens 10 Spieler insgesamt, mindestens 1 Mensch zum Starten', () => {
    const { s, rng } = lobby(1, 9);
    expect(() => addBot(s)).toThrow(/voll/);
    expect(() => addPlayer(s, 'Noch einer', 'x', 'tx', 0)).toThrow(/voll/);
    const only = createGameState('X', 0);
    addBot(only);
    addBot(only);
    expect(() => startGame(only, { rng, now: 0 })).toThrow(/Mensch/);
    startGame(s, { rng, now: 0 });
    expect(s.started).toBe(true);
  });
  it('Bots haben kein Wiederverbindungs-Token in den Ansichten und sind immer verbunden', () => {
    const { s, rng } = lobby(1, 2);
    startGame(s, { rng, now: 0 });
    const views = [viewForHost(s, 0), viewForPlayer(s, 'h1', 0)];
    for (const v of views) for (const p of s.players) expect(JSON.stringify(v)).not.toContain(p.token);
    const bot = s.players.find((p) => p.bot)!;
    setConnected(s, bot.id, false, 0);
    expect(bot.connected).toBe(true);
  });
});

describe('Bots im Spiel', () => {
  it('Bots handeln nur, wenn sie dran sind', () => {
    const { s, rng, t } = lobby(1, 2, { seed: 3 });
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    // Mensch ist dran -> Bots würfeln nicht für ihn
    s.phase = { k: 'wuerfeln' };
    s.turn = s.order.indexOf('h1');
    advance(s, rng, t, 15000);
    expect(s.phase.k).toBe('wuerfeln');
    expect(currentPlayer(s)!.id).toBe('h1');
    // Bot ist dran -> würfelt nach kurzer Verzögerung von selbst
    s.turn = s.order.findIndex((id) => id !== 'h1');
    advance(s, rng, t, 3500);
    expect(s.phase.k).not.toBe('wuerfeln');
  });
  it('Menschen dürfen keine Bot-Fähigkeit („skill“) oder Hinweise senden', () => {
    const { s, rng, t } = lobby(2, 2);
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'schaetzen', null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    playerAction(s, 'h1', { t: 'ready' }, { rng, now: t.now });
    playerAction(s, 'h2', { t: 'ready' }, { rng, now: t.now });
    expect(() => playerAction(s, 'h1', { t: 'mini', a: { k: 'skill', success: true } }, { rng, now: t.now })).toThrow(GameError);
    expect(() => playerAction(s, 'h1', { t: 'mini', a: { k: 'hinweis', kategorie: 'Tiere', begriff: 'Maus' } }, { rng, now: t.now })).toThrow(GameError);
  });
  it('Bots entscheiden nur aus ihrer Spieleransicht: geheime Zahl ist für Bot-Rater unsichtbar, trotzdem tippt er', () => {
    const { s, rng, t } = lobby(2, 2, { seed: 5 });
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'zahlen', null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    for (const id of ['h1', 'h2']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
    const inner = s.mini!.inner as any;
    const botRaters = inner.raters.filter((r: string) => r.startsWith('bot'));
    expect(botRaters.length).toBeGreaterThan(0);
    for (const r of botRaters) expect(viewForPlayer(s, r, t.now)!.mini!.inner.zahl).toBeNull();
    // Menschen sind Kenner, wo möglich
    for (const r of inner.raters) expect(s.players.find((p) => p.id === r)!.bot).not.toBeNull();
    advance(s, rng, t, 120000, 250);
    for (const r of botRaters) expect(inner.tips[r]).toBeGreaterThanOrEqual(1);
  });
  it('Bots werden nie Zeichner oder Erklärer', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const game of ['montagsmaler', 'begriffe', 'stirnraten'] as const) {
        const { s, rng, t } = lobby(2, 2, { seed });
        startGame(s, { rng, now: 0 });
        advance(s, rng, t, 20000, 500);
        startMinigame(s, game, null, { rng, now: t.now });
        advance(s, rng, t, 8000, 500);
        for (const id of ['h1', 'h2']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
        const inner = s.mini!.inner as any;
        const isHuman = (id: string) => id.startsWith('h');
        if (game === 'montagsmaler') expect(isHuman(inner.drawer)).toBe(true);
        if (game === 'begriffe') inner.seq.forEach((x: any) => expect(isHuman(x.explainer)).toBe(true));
        if (game === 'stirnraten') {
          const team = s.mini!.teams[0].members;
          expect(team.filter((m) => m !== inner.rater).some(isHuman)).toBe(true);
        }
        s.mini!.teams.forEach((tm) => expect(tm.members.some(isHuman)).toBe(true));
      }
    }
  });
  it('Spiele ohne menschlichen Zeichner/Erklärer werden nicht ausgelost', () => {
    const one = lobby(1, 3).s;
    expect(playableGames(one)).not.toContain('montagsmaler');
    expect(playableGames(one)).not.toContain('stirnraten');
    expect(playableGames(one)).not.toContain('begriffe');
    expect(playableGames(one)).toContain('schaetzen');
    const two = lobby(2, 2).s;
    expect(playableGames(two)).toEqual(expect.arrayContaining(['montagsmaler', 'stirnraten', 'begriffe']));
    const twoOfSix = lobby(2, 4).s; // 3 Zweier-Teams -> 3 Menschen nötig
    expect(playableGames(twoOfSix)).not.toContain('begriffe');
  });
  it('Teams: Menschen werden zuerst verteilt', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t = makeTeamsHumansFirst(seededRng(seed), ['h1', 'h2', 'b1', 'b2', 'b3'], 'zweiTeams', (id) => id.startsWith('h'));
      expect(t.every((tm) => tm.members.some((m) => m.startsWith('h')))).toBe(true);
      expect(t.flatMap((x) => x.members).sort()).toEqual(['b1', 'b2', 'b3', 'h1', 'h2']);
    }
  });
  it('Bot rechnet Kopfrechenaufgaben aus dem angezeigten Text', () => {
    expect(solveTask('12 + 34 + 7 + 76 − 19')).toBe(110);
    expect(solveTask('13 × 15')).toBe(195);
    expect(solveTask('70 % von 80')).toBe(56);
    expect(solveTask('7 × 9 × 5')).toBe(315);
  });
  it('Ein Spiel mit 1 Mensch + 3 Bots läuft vollständig bis zum Sieg (fester Seed)', () => {
    const { s, rng, t } = lobby(1, 3, { seed: 11 });
    s.settings.kronenZumSieg = 3;
    startGame(s, { rng, now: 0 });
    // Den Menschen steuert im Test derselbe Entscheider (wie ein Bot), damit das Spiel ohne Eingaben läuft.
    let sig: string | null = null;
    let at = 0;
    const games = new Set<string>();
    for (let step = 0; step < 4 * 60 * 60 * 4 && s.phase.k !== 'sieg'; step++) {
      t.now += 250;
      tick(s, { rng, now: t.now });
      if (s.mini) games.add(s.mini.game);
      const v = viewForPlayer(s, 'h1', t.now)!;
      const plan = botPlan(v, 'schwer', { actForHumans: true });
      if (!plan) {
        sig = null;
        continue;
      }
      if (plan.sig !== sig) {
        sig = plan.sig;
        at = t.now + plan.delay[0];
        continue;
      }
      if (t.now >= at) {
        const a = plan.act(rng);
        if (plan.repeat) sig = null;
        else at = Infinity;
        if (a) try { playerAction(s, 'h1', a, { rng, now: t.now }); } catch { /* egal */ }
      }
    }
    expect(s.phase.k).toBe('sieg');
    const winner = s.players.find((p) => s.phase.k === 'sieg' && p.id === s.phase.winner)!;
    expect(winner.kronen).toBeGreaterThanOrEqual(3);
    expect(games.size).toBeGreaterThan(0);
  });
  it('jedes Minispiel läuft mit Bots und ohne Hauptscreen durch', () => {
    for (const game of ['game7', 'kopfrechnen', 'stirnraten', 'gegenstaende', 'slf', 'schaetzen', 'montagsmaler', 'zahlen', 'wissen', 'begriffe', 'flunker', 'huehner'] as const) {
      const { s, rng, t } = lobby(2, 3, { seed: 7 });
      startGame(s, { rng, now: 0 });
      advance(s, rng, t, 20000, 500);
      if (!playableGames(s).includes(game)) continue;
      startMinigame(s, game, null, { rng, now: t.now });
      advance(s, rng, t, 8000, 500);
      for (const id of ['h1', 'h2']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
      if (game === 'game7') hostAction(s, { t: 'beenden' }, { rng, now: t.now });
      advance(s, rng, t, 15 * 60 * 1000, 500);
      expect(s.mini, game).toBeNull();
    }
  });
});

describe('Ohne Hauptscreen', () => {
  it('der Ersteller leitet die Lobby, nur er darf leiten', () => {
    const { s } = lobby(2, 0);
    expect(s.hostConnected).toBe(false);
    expect(s.leaderId).toBe('h1');
    expect(canLead(s, 'h1')).toBe(true);
    expect(canLead(s, 'h2')).toBe(false);
    expect(viewForPlayer(s, 'h1', 0)!.iAmLeader).toBe(true);
    expect(viewForPlayer(s, 'h2', 0)!.iAmLeader).toBe(false);
  });
  it('Leitung wechselt, wenn der Leiter geht oder länger als 60 s getrennt ist', () => {
    const { s, rng, t } = lobby(3, 1);
    removePlayer(s, 'h1');
    expect(s.leaderId).toBe('h2');
    startGame(s, { rng, now: 0 });
    setConnected(s, 'h2', false, t.now);
    advance(s, rng, t, GETRENNT_UEBERSPRINGEN_MS - 1000, 500);
    expect(s.leaderId).toBe('h2');
    advance(s, rng, t, 2000, 500);
    expect(s.leaderId).toBe('h3');
    expect(maintainLeader(s, t.now)).toBe(false);
  });
  it('mit Hauptscreen leitet der Hauptscreen; fällt er weg, übernimmt ein Spieler', () => {
    const s = createGameState('X', 0, { screenMode: true });
    addPlayer(s, 'Anna', 'a', 't', 0);
    expect(canLead(s, 'a')).toBe(false);
    s.hostConnected = false;
    expect(canLead(s, 'a')).toBe(true);
  });
  it('Handys bekommen öffentliche Inhalte des Hauptscreens, aber keine fremden Geheimnisse', () => {
    const { s, rng, t } = lobby(4, 0, { seed: 2 });
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'gegenstaende', null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    for (const p of s.players) playerAction(s, p.id, { t: 'ready' }, { rng, now: t.now });
    advance(s, rng, t, 4000);
    expect((s.mini!.inner as any).stage).toBe('zeigen');
    expect(viewForPlayer(s, 'h2', t.now)!.mini!.inner.items).toHaveLength(10);
    s.hostConnected = true; // mit Hauptscreen schauen alle auf den Fernseher
    expect(viewForPlayer(s, 'h2', t.now)!.mini!.inner.items).toBeNull();
    s.hostConnected = false;

    startMinigame(s, 'montagsmaler', null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    for (const p of s.players) playerAction(s, p.id, { t: 'ready' }, { rng, now: t.now });
    advance(s, rng, t, 5500);
    const inner = s.mini!.inner as any;
    playerAction(s, inner.drawer, { t: 'mini', a: { k: 'strich', id: 1, pts: [10, 10, 50, 50] } }, { rng, now: t.now });
    const term = inner.terms[inner.termIdx];
    for (const p of s.players) {
      const v = viewForPlayer(s, p.id, t.now)!;
      expect(v.mini!.inner.strokes).toHaveLength(1);
      const json = JSON.stringify(v);
      if (p.id === inner.drawer) expect(json).toContain(`"${term}"`);
      else expect(json).not.toContain(`"${term}"`);
    }
  });
});
