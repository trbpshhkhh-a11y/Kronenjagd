import { describe, it, expect } from 'vitest';
import {
  moveOptions, allowedNext, neighbors, BOARD, seededRng, crownValue, respawnCrown, playerAction, tick, currentPlayer,
  createGameState, addPlayer, renamePlayer, startGame, GameError, viewForHost, viewForPlayer, fieldType, fieldsOfType,
  hostAction, CARDS, newDeck, GameState, Rng, endTurn, startMinigame, setConnected, GETRENNT_UEBERSPRINGEN_MS, SCHRITT_MS,
  relocateAllCrowns, freeCrownFields, drawCrownField, drawStartFields,
} from '../src';
import { setup, advance } from './helpers';

describe('Bewegung auf dem Streckennetz', () => {
  it('Nachbarn folgen dem Bild, nicht den Nummern (1 → 68, nicht 76)', () => {
    expect(neighbors(1)).toEqual([2, 68]);
    expect(neighbors(76)).not.toContain(1);
    expect(neighbors(42)).not.toContain(43);
    expect(neighbors(67)).not.toContain(68);
    expect(neighbors(53)).not.toContain(54);
    expect(moveOptions(1, null, 1).map((o) => o.target).sort((a, b) => a - b)).toEqual([2, 68]);
  });
  it('Verbindungen sind symmetrisch und das Netz ist zusammenhängend', () => {
    for (const f of BOARD.data.fields) for (const n of neighbors(f.id)) expect(neighbors(n)).toContain(f.id);
    const seen = new Set([1]);
    const stack = [1];
    while (stack.length) for (const n of neighbors(stack.pop()!)) if (!seen.has(n)) (seen.add(n), stack.push(n));
    expect(seen.size).toBe(76);
  });
  it('Abzweigung bei Feld 2: von 68 kommend nach 3 oder 43', () => {
    expect(allowedNext(2, 1).sort((a, b) => a - b)).toEqual([3, 43]);
    const o = moveOptions(68, null, 6);
    const up = o.find((x) => x.first === 1)!;
    expect(up.path).toEqual([1, 2]);
    expect(up.final).toBe(false);
  });
  it('Einmündung 76: erst auf Feld 9 entscheiden, nicht auf Feld 10', () => {
    expect(neighbors(76)).toEqual([9, 75]);
    expect(neighbors(10)).toEqual([9, 11]);
    expect(neighbors(9)).toEqual([8, 10, 76]);
    expect(allowedNext(10, 11)).toEqual([9]);
    expect(allowedNext(9, 10).sort((a, b) => a - b)).toEqual([8, 76]);
    expect(allowedNext(9, 76).sort((a, b) => a - b)).toEqual([8, 10]);
    expect(allowedNext(76, 75)).toEqual([9]);
    // von 11 aus: keine Entscheidung auf 10, Weiche erst auf 9
    const o = moveOptions(11, 12, 5);
    expect(o).toHaveLength(1);
    expect(o[0].path).toEqual([10, 9]);
    expect(o[0].final).toBe(false);
  });
  it('alle Einmündungen haben genau ein Weichenfeld', () => {
    const pairs: [number, number, number][] = [
      [42, 20, 19],
      [53, 26, 25],
      [67, 32, 31],
      [54, 46, 45],
      [76, 9, 10],
    ];
    for (const [branch, sw, other] of pairs) {
      expect(neighbors(branch)).toContain(sw);
      expect(neighbors(branch)).not.toContain(other);
      expect(neighbors(sw)).toHaveLength(3);
      expect(neighbors(other)).toHaveLength(2);
    }
    const switches = BOARD.data.fields.filter((f) => neighbors(f.id).length > 2).map((f) => f.id);
    expect(switches).toEqual([2, 9, 20, 26, 32, 46]);
  });
  it('Richtungen werden nach dem Bild benannt', () => {
    expect(moveOptions(68, null, 1).find((o) => o.first === 1)!.label).toMatch(/oben/);
    expect(moveOptions(2, 1, 1).find((o) => o.first === 3)!.label).toMatch(/rechts/);
  });
});

function forcePos(s: GameState, pid: string, pos: number) {
  s.players.find((p) => p.id === pid)!.pos = pos;
}
function choose(s: GameState, pid: string, first: number, rng: Rng, t: { now: number }) {
  playerAction(s, pid, { t: 'direction', key: 'n' + first }, { rng, now: t.now });
}
function toTurnPhase(s: GameState, rng: Rng, t: { now: number }) {
  advance(s, rng, t, 30000);
  expect(s.phase.k).toBe('wuerfeln');
}
/** Würfelt mit vorgegebenem Ergebnis (manipuliertes rng nur für den Wurf) */
function rollWith(s: GameState, t: { now: number }, value: number) {
  const p = currentPlayer(s)!;
  const fakeRng = () => (value - 1) / 6 + 0.01;
  playerAction(s, p.id, { t: 'roll' }, { rng: fakeRng, now: t.now });
}

describe('Spielstart', () => {
  it('Startfelder eindeutig und nie auf Minispiel- oder Ereignisfeldern, Kronen auf normalen Feldern', () => {
    for (let seed = 1; seed < 100; seed++) {
      const { s } = setup(10, seed);
      const starts = s.players.map((p) => p.start);
      expect(new Set(starts).size).toBe(10);
      starts.forEach((f) => expect(['minispiel', 'ereignis']).not.toContain(fieldType(f)));
      expect(s.crowns).toHaveLength(2);
      expect(s.crowns[0].field).not.toBe(s.crowns[1].field);
      s.crowns.forEach((c) => {
        expect(fieldType(c.field)).toBe('normal');
        expect(starts).not.toContain(c.field);
      });
      expect(new Set(s.order).size).toBe(10);
    }
  });
  it('Mindestens 2 Spieler', () => {
    const s = createGameState('X', 0);
    addPlayer(s, 'Anna', 'a', 't', 0);
    expect(() => startGame(s, { rng: seededRng(1), now: 0 })).toThrow(GameError);
  });
});

describe('Lobby-Regeln', () => {
  it('Namen müssen eindeutig sein (ohne Groß-/Kleinschreibung) und 2–14 Zeichen haben', () => {
    const s = createGameState('X', 0);
    addPlayer(s, 'Marie', 'a', 't1', 0);
    expect(() => addPlayer(s, 'marie', 'b', 't2', 0)).toThrow(/vergeben/);
    expect(() => addPlayer(s, 'M', 'b', 't2', 0)).toThrow(/2 bis 14/);
    expect(() => addPlayer(s, 'M'.repeat(15), 'b', 't2', 0)).toThrow(/2 bis 14/);
    addPlayer(s, 'Paul', 'b', 't2', 0);
    expect(() => renamePlayer(s, 'b', 'MARIE')).toThrow(/vergeben/);
    renamePlayer(s, 'b', 'Paula');
    expect(s.players[1].name).toBe('Paula');
  });
  it('nach dem Start kann niemand mehr beitreten', () => {
    const { s } = setup(3);
    expect(() => addPlayer(s, 'Neu', 'x', 'tx', 0)).toThrow(/begonnen/);
  });
  it('maximal 10 Spieler', () => {
    const s = createGameState('X', 0);
    for (let i = 0; i < 10; i++) addPlayer(s, 'Sp' + i, 'p' + i, 't' + i, 0);
    expect(() => addPlayer(s, 'Sp11', 'q', 'tq', 0)).toThrow(/voll/);
  });
});

describe('Kronen', () => {
  it('Anteil großer Kronen nahe 30 %', () => {
    const rng = seededRng(42);
    let big = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (crownValue(rng) === 2) big++;
    expect(big / N).toBeGreaterThan(0.28);
    expect(big / N).toBeLessThan(0.32);
  });
  it('Neuplatzieren: nie dasselbe Feld, nie zwei Kronen auf einem Feld, nur normale Felder', () => {
    const { s, rng } = setup(4);
    for (let i = 0; i < 3000; i++) {
      const c = s.crowns[i % 2];
      const old = c.field;
      respawnCrown(s, c.id, rng);
      expect(c.field).not.toBe(old);
      expect(s.crowns[0].field).not.toBe(s.crowns[1].field);
      expect(fieldType(c.field)).toBe('normal');
    }
  });
  it('Krone beim Landen einsammeln, danach neu platziert', () => {
    const { s, rng, t } = setup(2, 7);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    // Spieler 2 Felder vor eine Krone stellen (Startfeld davor ist normal)
    const crown = s.crowns[0];
    crown.value = 1;
    crown.field = 15;
    s.crowns[1].field = 70;
    forcePos(s, p.id, 13);
    const field = crown.field;
    rollWith(s, t, 2);
    advance(s, rng, t, 3000);
    expect(s.phase.k).toBe('richtung');
    choose(s, p.id, 14, rng, t);
    advance(s, rng, t, SCHRITT_MS * 3);
    expect(p.pos).toBe(field);
    expect(p.kronen).toBe(1);
    expect(s.crowns.map((c) => c.field)).not.toContain(field);
  });
  it('Krone beim Vorbeiziehen einsammeln (große Krone zählt 2)', () => {
    const { s, rng, t } = setup(2, 8);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    const crown = s.crowns[0];
    crown.value = 2;
    crown.field = 15;
    s.crowns[1].field = 70;
    forcePos(s, p.id, 14);
    rollWith(s, t, 4);
    advance(s, rng, t, 3000);
    choose(s, p.id, 15, rng, t);
    advance(s, rng, t, SCHRITT_MS * 2);
    expect(p.kronen).toBe(2);
  });
  it('Siegbedingung: große Krone darf über das Ziel schießen', () => {
    const { s, rng, t } = setup(2, 9);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    p.kronen = 4;
    const crown = s.crowns[0];
    crown.value = 2;
    crown.field = 15;
    s.crowns[1].field = 70;
    forcePos(s, p.id, 14);
    rollWith(s, t, 1);
    advance(s, rng, t, 3000);
    choose(s, p.id, 15, rng, t);
    advance(s, rng, t, 2000);
    expect(p.kronen).toBe(6);
    expect(s.phase).toEqual({ k: 'sieg', winner: p.id });
  });
});

describe('Zugablauf', () => {
  it('Nur der Spieler am Zug darf würfeln, Würfel 1–6', () => {
    const { s, rng, t } = setup(3);
    toTurnPhase(s, rng, t);
    const other = s.order[1];
    expect(() => playerAction(s, other, { t: 'roll' }, { rng, now: t.now })).toThrow(/nicht an der Reihe/);
    playerAction(s, s.order[0], { t: 'roll' }, { rng, now: t.now });
    if (s.phase.k !== 'gewuerfelt') throw new Error('phase');
    expect(s.phase.wurf).toBeGreaterThanOrEqual(1);
    expect(s.phase.wurf).toBeLessThanOrEqual(6);
  });
  it('Würfelverteilung gleichmäßig', () => {
    const { s, t } = setup(2);
    const counts = [0, 0, 0, 0, 0, 0];
    const rng = seededRng(77);
    for (let i = 0; i < 6000; i++) {
      s.phase = { k: 'wuerfeln' };
      playerAction(s, s.order[s.turn], { t: 'roll' }, { rng, now: t.now });
      const ph = s.phase as any;
      if (ph.k === 'gewuerfelt') counts[ph.wurf - 1]++;
    }
    counts.forEach((c) => expect(c).toBeGreaterThan(850));
  });
  it('Bonusfelder werden im nächsten Zug addiert und danach gelöscht', () => {
    const { s, rng, t } = setup(2);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    p.bonus = 3;
    rollWith(s, t, 5);
    expect(s.phase).toMatchObject({ k: 'gewuerfelt', wurf: 5, bonus: 3, total: 8 });
    expect(p.bonus).toBe(0);
    advance(s, rng, t, 3000);
    if (s.phase.k !== 'richtung') throw new Error('phase');
    expect(s.phase.remaining).toBe(8);
  });
  it('Richtung: nach Ablauf der Zeit geht es vorwärts', () => {
    const { s, rng, t } = setup(2);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    const start = p.pos;
    rollWith(s, t, 3);
    advance(s, rng, t, 3000 + 30000 + SCHRITT_MS * 5);
    // Ziel ist 3 vorwärts (ggf. durch Feldeffekt verändert -> mindestens bewegt)
    expect(p.pos).not.toBe(start);
  });
  it('An einer Weiche wird über die restlichen Felder neu entschieden (68 → 2 → 3)', () => {
    const { s, rng, t } = setup(2, 3);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [70, 72][i]));
    forcePos(s, p.id, 68);
    rollWith(s, t, 6);
    advance(s, rng, t, 3000);
    if (s.phase.k !== 'richtung') throw new Error('phase');
    expect(s.phase.options.map((o) => o.first).sort((a, b) => a - b)).toEqual([1, 69]);
    choose(s, p.id, 1, rng, t);
    advance(s, rng, t, SCHRITT_MS * 3);
    expect(p.pos).toBe(2);
    if (s.phase.k !== 'richtung') throw new Error('phase ' + (s.phase as { k: string }).k);
    expect(s.phase.remaining).toBe(4);
    expect(s.phase.options.map((o) => o.first).sort((a, b) => a - b)).toEqual([3, 43]);
    choose(s, p.id, 3, rng, t);
    advance(s, rng, t, SCHRITT_MS * 5);
    expect(p.pos).toBe(6);
  });
  it('Zurückgehen ist am Zugbeginn möglich', () => {
    const { s, rng, t } = setup(2, 3);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [70, 72][i]));
    forcePos(s, p.id, 3);
    rollWith(s, t, 2);
    advance(s, rng, t, 3000);
    choose(s, p.id, 2, rng, t);
    advance(s, rng, t, SCHRITT_MS * 2);
    choose(s, p.id, 1, rng, t);
    advance(s, rng, t, SCHRITT_MS * 2);
    expect(p.pos).toBe(1);
  });
  it('+2-Feld: 2 weiter in gleicher Richtung ohne weiteren Effekt', () => {
    const { s, rng, t } = setup(2, 4);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [70, 72][i])); // Kronen aus dem Weg
    forcePos(s, p.id, 2); // 2 + 2 = 4 (plus2) -> 6
    rollWith(s, t, 2);
    advance(s, rng, t, 3000);
    choose(s, p.id, 3, rng, t);
    advance(s, rng, t, 4000);
    expect(p.pos).toBe(6);
    expect(s.order[s.turn]).not.toBe(p.id);
  });
  it('−2-Feld: 2 zurück', () => {
    const { s, rng, t } = setup(2, 4);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [20, 22][i]));
    forcePos(s, p.id, 48); // 48 + 3 = 51 (minus2) -> 49
    rollWith(s, t, 3);
    advance(s, rng, t, 3000);
    choose(s, p.id, 49, rng, t);
    advance(s, rng, t, 4000);
    expect(p.pos).toBe(49);
  });
  it('Gelbes Feld: Position mit einem beliebigen Mitspieler tauschen', () => {
    const { s, rng, t } = setup(3, 4);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [20, 22][i]));
    forcePos(s, p.id, 36); // +3 = 39 (gelb)
    rollWith(s, t, 3);
    advance(s, rng, t, 3000);
    choose(s, p.id, 37, rng, t);
    advance(s, rng, t, 3000);
    expect(p.pos).toBe(39);
    expect(s.phase).toMatchObject({ k: 'karte', card: 'tausch', stage: 'wahl', feld: true });
    const other = s.players.find((x) => x.id !== p.id)!;
    const otherPos = other.pos;
    playerAction(s, p.id, { t: 'tauschWahl', target: other.id }, { rng, now: t.now });
    expect(p.pos).toBe(otherPos);
    expect(other.pos).toBe(39);
    advance(s, rng, t, 3000);
    expect(currentPlayer(s)!.id).not.toBe(p.id);
  });
  it('Minispielfeld startet ein Minispiel, danach ist der nächste Spieler dran', () => {
    const { s, rng, t } = setup(4, 4);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [20, 22][i]));
    forcePos(s, p.id, 8); // 8 → 9 (Weiche) → 10 (minispiel)
    rollWith(s, t, 2);
    advance(s, rng, t, 3000);
    choose(s, p.id, 9, rng, t);
    advance(s, rng, t, SCHRITT_MS * 2);
    choose(s, p.id, 10, rng, t);
    advance(s, rng, t, 2000);
    expect(s.phase.k).toBe('minispiel');
    expect(s.mini?.stage).toBe('auslosung');
  });
  it('getrennter Spieler wird nach 60 Sekunden übersprungen', () => {
    const { s, rng, t } = setup(3);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    setConnected(s, p.id, false, t.now);
    advance(s, rng, t, GETRENNT_UEBERSPRINGEN_MS - 1000);
    expect(currentPlayer(s)!.id).toBe(p.id);
    advance(s, rng, t, 2000);
    expect(currentPlayer(s)!.id).not.toBe(p.id);
  });
});

describe('Ereigniskarten', () => {
  function toCard(seed = 5) {
    const { s, rng, t } = setup(4, seed);
    toTurnPhase(s, rng, t);
    const p = currentPlayer(s)!;
    s.crowns.forEach((c, i) => (c.field = [20, 22][i]));
    forcePos(s, p.id, 5); // +2 = 7 (ereignis)
    rollWith(s, t, 2);
    advance(s, rng, t, 3000);
    choose(s, p.id, 6, rng, t);
    advance(s, rng, t, 2000);
    expect(s.phase.k).toBe('karteZiehen');
    return { s, rng, t, p };
  }
  it('Stapel enthält jede Karte gleich oft (pro Durchlauf jede genau einmal)', () => {
    const { s, rng, t, p } = toCard();
    const seen: string[] = [];
    for (let i = 0; i < 15; i++) {
      s.phase = { k: 'karteZiehen', until: t.now + 1000 };
      s.turn = s.order.indexOf(p.id);
      playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
      const ph = s.phase as any;
      if (ph.k === 'karte') seen.push(ph.card);
    }
    for (let r = 0; r < 3; r++) expect(new Set(seen.slice(r * 5, r * 5 + 5)).size).toBe(5);
    expect(CARDS).toHaveLength(5);
  });
  function forceCard(s: GameState, card: string) {
    const idx = CARDS.indexOf(card as never);
    s.cardDeck = { size: 5, remaining: [idx] };
  }
  it('Spielertausch tauscht Positionen ohne Kronen einzusammeln', () => {
    const { s, rng, t, p } = toCard();
    forceCard(s, 'tausch');
    playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
    const other = s.players.find((x) => x.id !== p.id)!;
    s.crowns[0].field = other.pos;
    const [a, b] = [p.pos, other.pos];
    playerAction(s, p.id, { t: 'tauschWahl', target: other.id }, { rng, now: t.now });
    expect([p.pos, other.pos]).toEqual([b, a]);
    expect(p.kronen).toBe(0);
    advance(s, rng, t, 3000);
    expect(currentPlayer(s)!.id).not.toBe(p.id);
  });
  it('Feldersprung: nie aktuelles Feld, Krone am Ziel wird eingesammelt', () => {
    const { s, rng, t, p } = toCard();
    forceCard(s, 'sprung');
    playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
    if (s.phase.k !== 'karte') throw new Error();
    const ziel = s.phase.ziel!;
    expect(ziel).not.toBe(p.pos);
    s.crowns[0].field = ziel;
    s.crowns[0].value = 1;
    advance(s, rng, t, 4000);
    expect(p.pos).toBe(ziel);
    expect(p.kronen).toBe(1);
  });
  it('Kronen neu platzieren', () => {
    const { s, rng, t, p } = toCard();
    forceCard(s, 'kronenNeu');
    const before = s.crowns.map((c) => c.field);
    playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
    advance(s, rng, t, 4000);
    const after = s.crowns.map((c) => c.field);
    after.forEach((f) => expect(before).not.toContain(f));
    expect(after[0]).not.toBe(after[1]);
  });
  it('1x Krone gibt einen Punkt, Kronen auf dem Brett bleiben', () => {
    const { s, rng, t, p } = toCard();
    forceCard(s, 'krone');
    const before = JSON.stringify(s.crowns);
    playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
    advance(s, rng, t, 4000);
    expect(p.kronen).toBe(1);
    expect(JSON.stringify(s.crowns)).toBe(before);
  });
  it('Spiel aussuchen startet das gewählte Spiel, Stapel bleibt unberührt', () => {
    const { s, rng, t, p } = toCard();
    forceCard(s, 'spielWahl');
    const deckBefore = JSON.stringify(s.gameDeck);
    playerAction(s, p.id, { t: 'drawCard' }, { rng, now: t.now });
    playerAction(s, p.id, { t: 'spielWahl', game: 'schaetzen' }, { rng, now: t.now });
    expect(s.mini?.game).toBe('schaetzen');
    expect(s.mini?.chosenBy).toBe(p.id);
    expect(JSON.stringify(s.gameDeck)).toBe(deckBefore);
  });
});

describe('Minispiele & Ansichten', () => {
  function startMini(game: any, n = 4, seed = 11) {
    const { s, rng, t } = setup(n, seed);
    toTurnPhase(s, rng, t);
    startMinigame(s, game, null, { rng, now: t.now });
    advance(s, rng, t, 8000);
    expect(s.mini?.stage).toBe('bereit');
    for (const p of s.players) playerAction(s, p.id, { t: 'ready' }, { rng, now: t.now });
    expect(s.mini?.stage).toBe('spiel');
    return { s, rng, t };
  }
  const json = (o: unknown) => JSON.stringify(o);

  it('Tokens tauchen in keiner Ansicht auf', () => {
    const { s, t } = startMini('wissen');
    const all = [viewForHost(s, t.now), ...s.players.map((p) => viewForPlayer(s, p.id, t.now))];
    for (const v of all) for (const p of s.players) expect(json(v)).not.toContain(p.token);
  });

  it('Zahlen erraten: geheime Zahl nicht beim Host und nicht bei den Ratern', () => {
    const { s, t, rng } = startMini('zahlen', 4);
    const inner = s.mini!.inner as any;
    const host = viewForHost(s, t.now);
    expect(host.mini!.inner.zahl).toBeNull();
    for (const r of inner.raters) expect(viewForPlayer(s, r, t.now)!.mini!.inner.zahl).toBeNull();
    const kenner = s.players.filter((p) => !inner.raters.includes(p.id));
    for (const k of kenner) expect(viewForPlayer(s, k.id, t.now)!.mini!.inner.zahl).toBe(inner.secret);
    // Tipps abgeben -> aufgedeckt, Bonus = 5 - Abstand
    for (const r of inner.raters) playerAction(s, r, { t: 'mini', a: { k: 'zahlTipp', value: inner.secret } }, { rng, now: t.now });
    expect(inner.stage).toBe('aufgedeckt');
    expect(viewForHost(s, t.now).mini!.inner.zahl).toBe(inner.secret);
    advance(s, rng, t, 10000);
    expect(s.mini!.stage).toBe('ergebnis');
    s.players.forEach((p) => expect(p.bonus).toBe(5));
  });

  it('Begriffe (Montagsmaler, Stirnraten, Begriffe erklären) nur bei Berechtigten', () => {
    for (const game of ['montagsmaler', 'stirnraten', 'begriffe']) {
      const { s, t, rng } = startMini(game, 4, 21);
      advance(s, rng, t, 5500); // Start-Countdown
      const inner = s.mini!.inner as any;
      const term: string = game === 'montagsmaler' ? inner.terms[inner.termIdx] : inner.term;
      expect(term).toBeTruthy();
      const hostJson = json(viewForHost(s, t.now));
      expect(hostJson).not.toContain(`"${term}"`);
      const allowed = new Set<string>();
      if (game === 'montagsmaler') allowed.add(inner.drawer);
      if (game === 'begriffe') allowed.add(inner.seq[inner.idx].explainer);
      if (game === 'stirnraten') s.mini!.teams[inner.round].members.filter((m: string) => m !== inner.rater).forEach((m: string) => allowed.add(m));
      for (const p of s.players) {
        const v = json(viewForPlayer(s, p.id, t.now));
        if (allowed.has(p.id)) expect(v).toContain(`"${term}"`);
        else expect(v).not.toContain(`"${term}"`);
      }
      if (game === 'montagsmaler') {
        // Montagsmaler-Begriffsliste darf nie mitgeschickt werden
        for (const tm of inner.terms) expect(hostJson).not.toContain(`"${tm}"`);
      }
    }
  });

  it('Lösungen vor dem Aufdecken nicht sichtbar (Kopfrechnen, Schätzmeister, Wissen, Gegenstände)', () => {
    {
      const { s, t } = startMini('kopfrechnen');
      const sol = (s.mini!.inner as any).tasks[0].solution;
      expect(viewForHost(s, t.now).mini!.inner.loesung).toBeNull();
      for (const p of s.players) expect(viewForPlayer(s, p.id, t.now)!.mini!.inner.loesung).toBeNull();
      expect(json(viewForHost(s, t.now))).not.toContain('"solution"');
      expect(sol).toBeGreaterThan(0);
    }
    {
      const { s, t } = startMini('schaetzen');
      expect(viewForHost(s, t.now).mini!.inner.loesung).toBeNull();
      expect(json(viewForHost(s, t.now))).not.toContain('"wert"');
    }
    {
      const { s, t } = startMini('wissen');
      expect(viewForHost(s, t.now).mini!.inner.richtig).toBeNull();
      expect(json(viewForHost(s, t.now))).not.toContain('"antwort"');
      for (const p of s.players) expect(json(viewForPlayer(s, p.id, t.now))).not.toContain('"antwort"');
    }
    {
      const { s, t, rng } = startMini('gegenstaende');
      advance(s, rng, t, 4000);
      expect((s.mini!.inner as any).stage).toBe('zeigen');
      for (const p of s.players) expect(viewForPlayer(s, p.id, t.now)!.mini!.inner.items).toBeNull();
      advance(s, rng, t, 10500);
      expect((s.mini!.inner as any).stage).toBe('abfrage');
      expect(viewForHost(s, t.now).mini!.inner.items).toBeNull();
    }
  });

  it('Kopfrechnen: der Erste mit richtigem Ergebnis bekommt den Punkt, falsch sperrt', () => {
    const { s, t, rng } = startMini('kopfrechnen', 3);
    const inner = s.mini!.inner as any;
    const [a, b, c] = s.players;
    playerAction(s, a.id, { t: 'mini', a: { k: 'antwort', value: -1 } }, { rng, now: t.now });
    expect(() => playerAction(s, a.id, { t: 'mini', a: { k: 'antwort', value: inner.tasks[0].solution } }, { rng, now: t.now })).toThrow(/raus/);
    playerAction(s, b.id, { t: 'mini', a: { k: 'antwort', value: inner.tasks[0].solution } }, { rng, now: t.now });
    playerAction(s, c.id, { t: 'mini', a: { k: 'antwort', value: inner.tasks[0].solution } }, { rng, now: t.now });
    expect(inner.scores).toEqual({ [b.id]: 1 });
  });

  it('Buzzer (Stadt Land Fluss): Reihenfolge nach Server-Eingang, danach gesperrt', () => {
    const { s, t, rng } = startMini('slf', 4);
    const inner = s.mini!.inner as any;
    const [a, b] = s.players;
    playerAction(s, b.id, { t: 'mini', a: { k: 'buzz' } }, { rng, now: t.now });
    playerAction(s, a.id, { t: 'mini', a: { k: 'buzz' } }, { rng, now: t.now });
    expect(inner.stopBy).toBe(b.id);
    expect(inner.stage).toBe('nachspiel');
    // alle sehen denselben Buzzer-Zustand
    for (const p of s.players) expect(viewForPlayer(s, p.id, t.now)!.mini!.inner.stopBy).toBe(b.name);
    expect(viewForHost(s, t.now).mini!.inner.stopBy).toBe(b.name);
  });

  it('Stadt Land Fluss: falscher Buchstabe, doppelte Antworten und Mehrheits-Ablehnung zählen nicht', () => {
    const { s, t, rng } = startMini('slf', 3);
    const inner = s.mini!.inner as any;
    inner.letter = 'B';
    const [a, b, c] = s.players;
    const act = (pid: string, ans: string[]) => playerAction(s, pid, { t: 'mini', a: { k: 'slfAntworten', answers: ans } }, { rng, now: t.now });
    act(a.id, ['Berlin', 'Belgien', 'Bach', 'Bär', 'Bäcker']);
    act(b.id, ['berlin ', 'Brasilien', 'Xanten', '', 'Bauer']);
    act(c.id, ['Bonn', 'Bulgarien', 'Blau', 'Biber', 'Bunt']);
    advance(s, rng, t, 91000);
    expect(inner.stage).toBe('pruefung');
    // c's "Blau" (Fluss) und "Bunt" (Beruf) werden von a und b abgelehnt
    for (const voter of [a, b]) {
      playerAction(s, voter.id, { t: 'mini', a: { k: 'flag', owner: c.id, cat: 4 } }, { rng, now: t.now });
    }
    playerAction(s, a.id, { t: 'mini', a: { k: 'flag', owner: c.id, cat: 2 } }, { rng, now: t.now }); // nur 1 von 2 -> keine Mehrheit
    for (const p of s.players) playerAction(s, p.id, { t: 'mini', a: { k: 'fertig' } }, { rng, now: t.now });
    expect(s.mini!.stage).toBe('ergebnis');
    expect(a.bonus).toBe(4); // Berlin doppelt
    expect(b.bonus).toBe(2); // Brasilien, Bauer
    expect(c.bonus).toBe(4); // Bonn, Bulgarien, Blau, Biber (Bunt abgelehnt)
  });

  it('Allgemeinwissen: Übereinstimmung sperrt, sonst zählt die erste Wahl', () => {
    const { s, t, rng } = startMini('wissen', 4);
    const inner = s.mini!.inner as any;
    const teams = s.mini!.teams;
    const correct = inner.qs[0].options.indexOf(inner.qs[0].antwort);
    const wrong = (correct + 1) % 4;
    const [a1, a2] = teams[0].members;
    const [b1, b2] = teams[1].members;
    playerAction(s, a1, { t: 'mini', a: { k: 'waehlen', opt: correct } }, { rng, now: t.now });
    playerAction(s, a2, { t: 'mini', a: { k: 'waehlen', opt: correct } }, { rng, now: t.now });
    expect(inner.locked[0]).toBe(true);
    playerAction(s, b1, { t: 'mini', a: { k: 'waehlen', opt: wrong } }, { rng, now: t.now });
    t.now += 1000;
    playerAction(s, b2, { t: 'mini', a: { k: 'waehlen', opt: correct } }, { rng, now: t.now });
    expect(inner.locked[1]).toBe(false);
    advance(s, rng, t, 21000);
    expect(inner.teamAnswer).toEqual([correct, wrong]);
    expect(inner.scores).toEqual([1, 0]);
  });

  it('Game of 7: Ablauf, Einloggen und Wertung', () => {
    const { s, t, rng } = startMini('game7', 4);
    const inner = s.mini!.inner as any;
    const [A, B] = s.mini!.teams;
    const act = (pid: string, v: string) => playerAction(s, pid, { t: 'mini', a: { k: 'g7', v: v as any } }, { rng, now: t.now });
    expect(() => act(B.members[0], 'geschafft')).toThrow(/nicht dran/);
    act(A.members[0], 'geschafft'); // A: 1
    act(B.members[0], 'geschafft'); // B: 1
    expect(inner.target).toBe(2);
    act(A.members[1], 'geschafft'); // A: 2
    act(B.members[0], 'fehl'); // B: 0
    act(A.members[0], 'einloggen'); // A sichert 2
    expect(inner.current).toBe(1);
    act(B.members[0], 'geschafft'); // B: 3
    act(B.members[0], 'einloggen');
    expect(s.mini!.stage).toBe('ergebnis');
    A.members.forEach((m) => expect(s.players.find((p) => p.id === m)!.bonus).toBe(2));
    B.members.forEach((m) => expect(s.players.find((p) => p.id === m)!.bonus).toBe(3));
  });

  it('Montagsmaler: Tipp mit einem Tippfehler zählt', () => {
    const { s, t, rng } = startMini('montagsmaler', 4);
    advance(s, rng, t, 5500);
    const inner = s.mini!.inner as any;
    const guesser = s.mini!.teams[inner.round].members.find((m: string) => m !== inner.drawer)!;
    const term: string = inner.terms[0];
    const typo = term.slice(0, -1);
    playerAction(s, guesser, { t: 'mini', a: { k: 'tipp', text: typo } }, { rng, now: t.now });
    expect(inner.correct[inner.round]).toBe(1);
    expect(inner.termIdx).toBe(1);
  });

  it('Nach dem Minispiel ist der nächste Spieler dran, Bonus zählt im nächsten Zug', () => {
    const { s, t, rng } = startMini('zahlen', 4);
    const before = s.turn;
    const inner = s.mini!.inner as any;
    for (const r of inner.raters) playerAction(s, r, { t: 'mini', a: { k: 'zahlTipp', value: inner.secret } }, { rng, now: t.now });
    advance(s, rng, t, 10000);
    hostAction(s, { t: 'weiter' }, { rng, now: t.now });
    expect(s.phase.k).toBe('wuerfeln');
    expect(s.turn).toBe((before + 1) % 4);
    const p = currentPlayer(s)!;
    expect(p.bonus).toBe(5);
    rollWith(s, t, 1);
    expect(s.phase).toMatchObject({ total: 6 });
  });

  it('jedes Spiel läuft komplett durch (ohne Eingaben, nur Timer)', () => {
    for (const game of ['game7', 'kopfrechnen', 'stirnraten', 'gegenstaende', 'slf', 'schaetzen', 'montagsmaler', 'zahlen', 'wissen', 'begriffe', 'flunker', 'huehner', 'flitzer']) {
      const { s, t, rng } = startMini(game, 5, 3);
      if (game === 'game7') hostAction(s, { t: 'beenden' }, { rng, now: t.now });
      advance(s, rng, t, 15 * 60 * 1000, 500);
      expect(s.phase.k).toBe('wuerfeln');
      expect(s.mini).toBeNull();
    }
  });
});

describe('Neue Runde', () => {
  it('setzt Kronen zurück und behält die Spieler', () => {
    const { s, rng, t } = setup(3);
    s.players[0].kronen = 5;
    s.phase = { k: 'sieg', winner: s.players[0].id };
    hostAction(s, { t: 'neueRunde' }, { rng, now: t.now });
    expect(s.players).toHaveLength(3);
    expect(s.players.every((p) => p.kronen === 0)).toBe(true);
    expect(s.phase.k).toBe('intro');
  });
});

describe('Kronen-Regel: nie auf besetzte Felder', () => {
  it('Startkronen nie auf Startfeldern, nach Einsammeln nie auf besetzten Feldern', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { s, rng } = setup(10, seed);
      const occ = s.players.map((p) => p.pos);
      s.crowns.forEach((c) => expect(occ).not.toContain(c.field));
      for (let i = 0; i < 200; i++) {
        // Spieler zufällig auf normale Felder stellen, dann eine Krone neu auslosen
        s.players.forEach((p) => (p.pos = 1 + Math.floor(rng() * 76)));
        const c = s.crowns[i % 2];
        respawnCrown(s, c.id, rng);
        const occupied = new Set(s.players.map((p) => p.pos));
        expect(occupied.has(c.field)).toBe(false);
        expect(s.crowns[0].field).not.toBe(s.crowns[1].field);
        expect(fieldType(c.field)).toBe('normal');
      }
    }
  });
  it('„Kronen neu platzieren“ meidet besetzte Felder', () => {
    const { s, rng } = setup(10, 3);
    for (let i = 0; i < 300; i++) {
      s.players.forEach((p) => (p.pos = 1 + Math.floor(rng() * 76)));
      relocateAllCrowns(s, rng);
      const occupied = new Set(s.players.map((p) => p.pos));
      s.crowns.forEach((c) => expect(occupied.has(c.field)).toBe(false));
      expect(s.crowns[0].field).not.toBe(s.crowns[1].field);
    }
  });
  it('freie Felder = normale Felder ohne Spieler und ohne andere Krone', () => {
    const { s } = setup(3, 2);
    const free = freeCrownFields(s);
    for (const p of s.players) expect(free).not.toContain(p.pos);
    for (const c of s.crowns) expect(free).not.toContain(c.field);
    free.forEach((f) => expect(fieldType(f)).toBe('normal'));
  });
  it('Modus 1: erste Krone nie auf einem Startfeld', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = seededRng(seed);
      const starts = drawStartFields(rng, 10);
      expect(starts).not.toContain(drawCrownField(rng, null, starts));
    }
  });
});
