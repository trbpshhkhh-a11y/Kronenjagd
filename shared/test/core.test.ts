import { describe, it, expect } from 'vitest';
import {
  seededRng, uniqueFields, makeTeams, computeBonus, zahlenBonus, closestIds, mathRound, drawCrownField, drawStartFields,
  newDeck, drawIndex, drawNextGame, GAME_IDS, SCHAETZFRAGEN, WISSEN, BEGRIFFE, KATEGORIEN, GEGENSTAENDE, newPools,
  drawBegriffe, fuzzyEquals, startsWithLetter, normalize, BOARD, GAMES, BRETT_GAME_IDS,
} from '../src';

describe('Auslosungen', () => {
  it('Startfelder sind eindeutig und im Bereich 1..76', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seededRng(seed);
      const f = drawStartFields(rng, 10);
      expect(new Set(f).size).toBe(10);
      f.forEach((x) => expect(x >= 1 && x <= 76).toBe(true));
    }
  });
  it('alle 76 Felder können vergeben werden', () => {
    const f = uniqueFields(seededRng(3), 76, 76);
    expect(new Set(f).size).toBe(76);
  });
  it('Krone wird nie auf dasselbe Feld gelost', () => {
    const rng = seededRng(5);
    let prev: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const f = drawCrownField(rng, prev);
      expect(f).not.toBe(prev);
      prev = f;
    }
  });
  it('Spielestapel: alle 10 Spiele kommen, bevor einer doppelt kommt', () => {
    const rng = seededRng(9);
    const deck = newDeck(BRETT_GAME_IDS.length);
    for (let round = 0; round < 5; round++) {
      const seen = new Set<string>();
      for (let i = 0; i < 10; i++) seen.add(drawNextGame(deck, rng, 6)!);
      expect(seen.size).toBe(10);
    }
  });
  it('Spiele mit 2 Teams werden bei 3 Spielern nicht gezogen', () => {
    const rng = seededRng(2);
    const deck = newDeck(BRETT_GAME_IDS.length);
    for (let i = 0; i < 50; i++) {
      const g = drawNextGame(deck, rng, 3)!;
      expect(['stirnraten', 'montagsmaler']).not.toContain(g);
    }
  });
  it('drawIndex mit Filter lässt Unerlaubte im Stapel', () => {
    const deck = newDeck(3);
    const rng = seededRng(1);
    const got = [drawIndex(deck, rng, (i) => i !== 1), drawIndex(deck, rng, (i) => i !== 1)];
    expect(got.sort()).toEqual([0, 2]);
    expect(deck.remaining).toEqual([1]);
  });
});

describe('Teams', () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => 'p' + i);
  it('Zweier-Teams bei ungerader Zahl: genau ein Dreierteam', () => {
    for (const n of [3, 5, 7, 9]) {
      const t = makeTeams(seededRng(n), players(n), 'zweier');
      expect(t.filter((x) => x.members.length === 3)).toHaveLength(1);
      expect(t.filter((x) => x.members.length === 2)).toHaveLength((n - 3) / 2);
      expect(t.flatMap((x) => x.members).sort()).toEqual(players(n).sort());
    }
  });
  it('Zweier-Teams bei gerader Zahl', () => {
    const t = makeTeams(seededRng(1), players(6), 'zweier');
    expect(t.every((x) => x.members.length === 2)).toBe(true);
    expect(t).toHaveLength(3);
  });
  it('Zwei Teams möglichst gleich groß', () => {
    const t = makeTeams(seededRng(1), players(7), 'zweiTeams');
    expect(t).toHaveLength(2);
    expect(Math.abs(t[0].members.length - t[1].members.length)).toBeLessThanOrEqual(1);
  });
  it('Jeder für sich', () => {
    expect(makeTeams(seededRng(1), players(5), 'einzel')).toHaveLength(5);
  });
});

describe('Bonusfelder', () => {
  it('Teamwertung: beide Mitglieder bekommen die Teampunkte', () => {
    const b = computeBonus({ kind: 'team', teams: [{ members: ['a', 'b'] }, { members: ['c', 'd', 'e'] }], scores: [4, 2] });
    expect(b).toEqual({ a: 4, b: 4, c: 2, d: 2, e: 2 });
  });
  it('Einzelwertung, nie negativ', () => {
    expect(computeBonus({ kind: 'einzel', scores: { a: 3, b: -1 } })).toEqual({ a: 3, b: 0 });
  });
  it('Zahlen erraten: 5 minus Abstand, nicht unter 0', () => {
    expect(zahlenBonus(7, 7)).toBe(5);
    expect(zahlenBonus(7, 5)).toBe(3);
    expect(zahlenBonus(1, 10)).toBe(0);
    expect(zahlenBonus(4, 9)).toBe(0);
    expect(zahlenBonus(4, null)).toBe(0);
    const b = computeBonus({ kind: 'zahlen', teams: [{ members: ['a', 'b'] }, { members: ['c', 'd'] }], secret: 6, tips: [8, 6] });
    expect(b).toEqual({ a: 3, b: 3, c: 5, d: 5 });
  });
  it('Schätzmeister: nächster gewinnt, Gleichstand alle', () => {
    expect(closestIds({ a: 100, b: 120, c: 80 }, 99)).toEqual(['a']);
    expect(closestIds({ a: 90, b: 110, c: 50 }, 100).sort()).toEqual(['a', 'b']);
  });
});

describe('Kopfrechnen', () => {
  it('5 Aufgaben, je Typ eine, ganzzahlige Lösungen', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = mathRound(seededRng(seed));
      expect(new Set(r.map((x) => x.type)).size).toBe(5);
      for (const t of r) {
        expect(Number.isInteger(t.solution)).toBe(true);
        expect(t.solution).toBeGreaterThan(0);
        // Text nachrechnen
        const expr = t.text.replace(/×/g, '*').replace(/−/g, '-').replace(/(\d+) % von (\d+)/, '($1*$2/100)');
        // eslint-disable-next-line no-new-func
        expect(Function(`return ${expr}`)()).toBe(t.solution);
      }
    }
  });
});

describe('Inhalte-Pools', () => {
  it('Mindestgrößen', () => {
    expect(SCHAETZFRAGEN.length).toBeGreaterThanOrEqual(60);
    expect(WISSEN.length).toBeGreaterThanOrEqual(80);
    expect(new Set(BEGRIFFE).size).toBeGreaterThanOrEqual(150);
    expect(KATEGORIEN.length).toBeGreaterThanOrEqual(40);
    expect(GEGENSTAENDE.length).toBeGreaterThanOrEqual(60);
  });
  it('keine Duplikate', () => {
    expect(new Set(BEGRIFFE).size).toBe(BEGRIFFE.length);
    expect(new Set(GEGENSTAENDE.map((g) => g.emoji)).size).toBe(GEGENSTAENDE.length);
    expect(new Set(WISSEN.map((g) => g.frage)).size).toBe(WISSEN.length);
    expect(new Set(SCHAETZFRAGEN.map((g) => g.frage)).size).toBe(SCHAETZFRAGEN.length);
  });
  it('Wissensfragen haben 3 verschiedene falsche Antworten', () => {
    for (const q of WISSEN) {
      expect(new Set([q.antwort, ...q.falsch]).size).toBe(4);
    }
  });
  it('Schätzfragen haben eindeutige Zahlen', () => {
    for (const q of SCHAETZFRAGEN) expect(Number.isFinite(q.wert)).toBe(true);
  });
  it('keine Wiederholung innerhalb einer Sitzung, bis der Pool leer ist', () => {
    const p = newPools();
    const rng = seededRng(4);
    const seen = new Set<string>();
    for (let i = 0; i < Math.floor(BEGRIFFE.length / 8); i++) drawBegriffe(p, rng, 8).forEach((b) => {
      expect(seen.has(b)).toBe(false);
      seen.add(b);
    });
  });
});

describe('Text', () => {
  it('normalisieren und tolerant vergleichen', () => {
    expect(normalize(' Käse Brot ')).toBe('kaesebrot');
    expect(fuzzyEquals('Tanenbaum', 'Tannenbaum')).toBe(true);
    expect(fuzzyEquals('tannenbaum', 'Tannenbaum')).toBe(true);
    expect(fuzzyEquals('Baum', 'Tannenbaum')).toBe(false);
    expect(startsWithLetter('Österreich', 'O')).toBe(true);
    expect(startsWithLetter('Berlin', 'A')).toBe(false);
  });
});

describe('Spielbrett', () => {
  it('76 Felder mit den richtigen Sonderfeldern', () => {
    expect(BOARD.data.fields).toHaveLength(76);
    const ofType = (t: string) => BOARD.data.fields.filter((f) => f.type === t).map((f) => f.id);
    expect(ofType('plus2')).toEqual([4, 21, 30, 38]);
    expect(ofType('minus2')).toEqual([51, 64, 74]);
    expect(ofType('ereignis')).toEqual([7, 14, 41, 45, 59]);
    expect(ofType('wiederholung')).toEqual([39, 55]);
    expect(ofType('minispiel')).toEqual([10, 17, 23, 35, 52, 57, 66, 69]);
    expect(BOARD.data.fields.filter((f) => f.markieren).map((f) => f.id)).toEqual([17, 23]);
    for (const f of BOARD.data.fields) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.x).toBeLessThan(100);
      expect(f.y).toBeGreaterThan(0);
      expect(f.y).toBeLessThan(100);
    }
  });
  it('genau 10 Spiele für Modus 1', () => {
    expect(BRETT_GAME_IDS).toHaveLength(10);
    expect(GAMES.filter((g) => !g.nurOnline)).toHaveLength(10);
  });
});
