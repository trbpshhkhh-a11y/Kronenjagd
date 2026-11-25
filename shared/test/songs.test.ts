import { describe, it, expect } from 'vitest';
import {
  SONGS, songToene, songDauer, songMatch, GAMES, BRETT_GAME_IDS,
  createGameState, addPlayer, addBot, startGame, tick, playerAction, startMinigame, viewForHost, viewForPlayer, seededRng, GameState, Rng, GameError,
} from '../src';

function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 250) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}

describe('Rückwärts-Songs: Lieder', () => {
  it('mindestens 20 bekannte Lieder, alle Melodien lesbar, 4 bis 13 Sekunden lang', () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(20);
    for (const s of SONGS) {
      const t = songToene(s);
      expect(t.length, s.titel).toBeGreaterThan(8);
      for (const n of t) expect(n.hz === 0 || (n.hz > 150 && n.hz < 1000), s.titel).toBe(true);
      const d = songDauer(s);
      expect(d, s.titel).toBeGreaterThanOrEqual(4);
      expect(d, s.titel).toBeLessThanOrEqual(13);
    }
    expect(new Set(SONGS.map((s) => s.noten)).size).toBe(SONGS.length);
  });
  it('richtige Titel, Tippfehler und Teiltitel zählen, falsche nicht', () => {
    const by = (t: string) => SONGS.find((s) => s.titel.startsWith(t))!;
    expect(songMatch('Jingle Bells', by('Jingle'))).toBe(true);
    expect(songMatch('jingel bells', by('Jingle'))).toBe(true);
    expect(songMatch('Tannenbaum', by('O Tannenbaum'))).toBe(true);
    expect(songMatch('oh tannenbaum!', by('O Tannenbaum'))).toBe(true);
    expect(songMatch('Stille Nacht', by('Stille Nacht'))).toBe(true);
    expect(songMatch('Freude schöner Götterfunken', by('Ode'))).toBe(true);
    expect(songMatch('Alle Vögel sind schon da', by('Morgen kommt'))).toBe(true);
    expect(songMatch('Zum Geburtstag viel Glück', by('Happy'))).toBe(true);
    expect(songMatch('Halle des Bergkönigs', by('In der Halle'))).toBe(true);
    expect(songMatch('Ich glaube es ist Jingle Bells', by('Jingle'))).toBe(true);
    expect(songMatch('Haenschen klein', by('Hänschen'))).toBe(true);
    // falsch
    expect(songMatch('Stille Nacht', by('O Tannenbaum'))).toBe(false);
    expect(songMatch('Jingle', by('Jingle'))).toBe(false);
    expect(songMatch('Morgen', by('Morgen kommt'))).toBe(false);
    expect(songMatch('', by('Jingle'))).toBe(false);
    // kein Lied wird mit dem Titel eines anderen verwechselt
    for (const a of SONGS) for (const b of SONGS) if (a !== b) for (const t of [a.titel, ...a.aliase]) expect(songMatch(t, b), `${t} ≠ ${b.titel}`).toBe(false);
  });
  it('gibt es in beiden Modi', () => {
    expect(GAMES.find((g) => g.id === 'songs')!.teamMode).toBe('einzel');
    expect(BRETT_GAME_IDS).toContain('songs');
  });
});

describe('Rückwärts-Songs: Spiel (Nur App)', () => {
  it('5 Lieder, Titel einloggen, ein Punkt pro richtige Antwort, Titel bleibt bis zur Auflösung geheim', () => {
    const s = createGameState('SO', 0, { screenMode: false });
    addPlayer(s, 'Anna', 'a', 't1', 0);
    addPlayer(s, 'Ben', 'b', 't2', 0);
    addPlayer(s, 'Cleo', 'c', 't3', 0);
    addBot(s, 'schwer');
    const rng = seededRng(4);
    const t = { now: 0 };
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'songs', null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    expect(s.mini!.stage).toBe('bereit');
    for (const id of ['a', 'b', 'c']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
    advance(s, rng, t, 500);
    const st = s.mini!.inner as any;
    expect(st.game).toBe('songs');
    expect(st.stage).toBe('countdown');
    // während des Countdowns kann man nichts einloggen
    expect(() => playerAction(s, 'a', { t: 'mini', a: { k: 'songTipp', text: 'x' } }, { rng, now: t.now })).toThrow(GameError);
    advance(s, rng, t, 3500);
    expect(st.stage).toBe('hoeren');
    const lied = SONGS[st.ids[0]];
    // Titel steht nirgends in den Ansichten
    const views = JSON.stringify([viewForHost(s, t.now), ...['a', 'b', 'c'].map((id) => viewForPlayer(s, id, t.now))]);
    expect(views).not.toContain(lied.titel);
    expect((viewForHost(s, t.now).mini!.inner as any).melodie.noten).toBe(lied.noten);
    const tipp = (id: string, text: string) => playerAction(s, id, { t: 'mini', a: { k: 'songTipp', text } }, { rng, now: t.now });
    tipp('a', lied.aliase[0] ?? lied.titel);
    tipp('b', 'Ganz bestimmt was anderes');
    expect(() => tipp('a', 'nochmal')).toThrow(GameError); // nur einmal einloggen
    expect(st.stage).toBe('hoeren');
    tipp('c', lied.titel.toLowerCase());
    // der Bot loggt auch ein -> alle fertig -> Auflösung
    advance(s, rng, t, 26000);
    expect(st.stage).toBe('aufloesung');
    const reveal = viewForPlayer(s, 'a', t.now)!.mini!.inner as any;
    expect(reveal.titel).toBe(lied.titel);
    expect(reveal.meins).toMatchObject({ ok: true });
    expect(st.scores.a).toBe(1);
    expect(st.scores.b ?? 0).toBe(0);
    expect(st.scores.c).toBe(1);
    // restliche Lieder ohne Antworten der Menschen
    for (let k = 0; k < 2000 && s.mini?.stage !== 'ergebnis'; k++) advance(s, rng, t, 250, 250);
    expect(s.mini!.stage).toBe('ergebnis');
    expect(st.ids).toHaveLength(5);
    expect(new Set(st.ids).size).toBe(5);
    const rows = s.mini!.result!.rows;
    expect(rows.find((r) => r.label === 'Anna')!.bonus).toBe(1);
    expect(rows.find((r) => r.label === 'Ben')!.bonus).toBe(0);
    expect(rows.find((r) => r.label === 'Anna')!.anzeige).toBe('1 von 5');
  });
});
