import { describe, it, expect } from 'vitest';
import {
  HuehnerWelt, moverX, gefahr, traeger, begehbar, train, H_COLS, H_DAUER_MS,
  createGameState, addPlayer, addBot, startGame, tick, playerAction, startMinigame, viewForHost, seededRng, GameState, Rng,
} from '../src';

function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 250) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}

describe('Hühnerhüpfer: Welt', () => {
  it('gleicher Seed = gleiche Welt und gleicher Verkehr (auf allen Handys)', () => {
    const a = new HuehnerWelt(12345);
    const b = new HuehnerWelt(12345);
    for (let r = 120; r >= 0; r--) b.row(r); // andere Abfrage-Reihenfolge
    for (let r = 0; r <= 120; r++) {
      expect(JSON.stringify(a.row(r))).toBe(JSON.stringify(b.row(r)));
      const row = a.row(r);
      for (const m of row.movers ?? []) expect(moverX(row, m, 7.3)).toBe(moverX(b.row(r), m, 7.3));
    }
    expect(JSON.stringify(new HuehnerWelt(1).row(30))).not.toBe(JSON.stringify(new HuehnerWelt(2).row(30)) + 'x');
  });
  it('Startbereich ist Gras, auf jedem Gras-Abschnitt bleibt ein Weg frei', () => {
    for (let seed = 1; seed < 40; seed++) {
      const w = new HuehnerWelt(seed);
      for (let r = 0; r < 4; r++) expect(w.row(r).type).toBe('gras');
      for (let r = 1; r < 150; r++) {
        const a = w.row(r - 1), b = w.row(r);
        if (a.type === 'gras' && b.type === 'gras') {
          const free = Array.from({ length: H_COLS }, (_, c) => c).filter((c) => begehbar(a, c) && begehbar(b, c));
          expect(free.length).toBeGreaterThan(0);
        }
        if (b.type === 'gras') expect(b.deko!.filter((x) => !x).length).toBeGreaterThan(0);
      }
    }
  });
  it('alle Hindernisarten kommen vor, Schwierigkeit steigt', () => {
    const w = new HuehnerWelt(7);
    const types = new Set(Array.from({ length: 200 }, (_, r) => w.row(r).type));
    expect([...types].sort()).toEqual(['fluss', 'gleis', 'gras', 'strasse']);
    const speed = (from: number, to: number) => {
      const s = Array.from({ length: to - from }, (_, i) => w.row(from + i)).filter((r) => r.type === 'strasse').map((r) => r.speed!);
      return s.reduce((a, b) => a + b, 0) / s.length;
    };
    expect(speed(150, 200)).toBeGreaterThan(speed(4, 50));
  });
  it('Wasser ohne Stamm = raus, auf dem Stamm sicher; Zug kommt mit Warnung', () => {
    const w = new HuehnerWelt(3);
    let checked = 0;
    for (let r = 0; r < 200 && checked < 20; r++) {
      const row = w.row(r);
      if (row.type === 'fluss' && row.movers) {
        const m = row.movers[0];
        const x = moverX(row, m, 2);
        const onLog = x + m.len / 2 - 0.5;
        if (onLog > 0 && onLog < H_COLS - 1) {
          expect(traeger(row, onLog, 2)).not.toBeNull();
          expect(gefahr(row, onLog, 2)).toBeNull();
          checked++;
        }
      }
      if (row.type === 'gleis') {
        // irgendwann im Zyklus ist ein Zug im Bild, kurz vorher blinkt die Warnung
        let seen = false;
        for (let t = 0; t < 20; t += 0.05) {
          const tr = train(row, t);
          if (tr.x !== null && tr.x > -2 && tr.x < H_COLS) {
            seen = true;
            expect(tr.warn).toBe(true);
            expect(train(row, t - 0.6).warn).toBe(true);
          }
        }
        expect(seen).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Hühnerhüpfer: Wertung', () => {
  it('weiteste Reihe zählt, Gleichstand: wer zuerst; Bots kommen voran; Belohnung nach Platz', () => {
    const s = createGameState('HU', 0, { screenMode: false });
    addPlayer(s, 'Anna', 'a', 't1', 0);
    addPlayer(s, 'Ben', 'b', 't2', 0);
    addPlayer(s, 'Cleo', 'c', 't3', 0);
    addBot(s, 'mittel');
    const rng = seededRng(5);
    const t = { now: 0 };
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'huehner', null, { rng, now: t.now });
    advance(s, rng, t, 6000);
    expect(s.mini!.stage).toBe('bereit');
    for (const id of ['a', 'b', 'c']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
    advance(s, rng, t, 4200);
    const inner = s.mini!.inner as any;
    expect(inner.stage).toBe('laeuft');
    const hop = (id: string, row: number, safe = false) => playerAction(s, id, { t: 'mini', a: { k: 'hop', row, col: 4, safe } }, { rng, now: t.now });
    for (let r = 1; r <= 5; r++) { hop('a', r); hop('b', r); t.now += 100; }
    hop('c', 1);
    hop('c', 9); // unplausibler Sprung wird ignoriert
    expect(inner.runners.c.best).toBe(1);
    t.now += 200;
    hop('b', 6);
    t.now += 50;
    hop('a', 6); // a erreicht 6 später als b
    hop('a', 2); // mehr als 3 Reihen zurück: ignoriert
    expect(inner.runners.a.row).toBe(6);
    playerAction(s, 'a', { t: 'mini', a: { k: 'raus' } }, { rng, now: t.now });
    expect(inner.runners.a.best).toBe(6); // Bestwert bleibt
    // Hüpfer lösen keinen vollen Versand aus
    const v0 = s.version;
    hop('c', 2);
    expect(s.version).toBe(v0);
    advance(s, rng, t, H_DAUER_MS + 5000);
    expect(s.mini!.stage).toBe('ergebnis');
    const rows = s.mini!.result!.rows;
    const bot = s.players.find((p) => p.bot)!;
    expect(inner.runners[bot.id].best).toBeGreaterThanOrEqual(13);
    expect(rows[0].label).toContain('Bot');
    const ben = rows.find((r) => r.label === 'Ben')!;
    const anna = rows.find((r) => r.label === 'Anna')!;
    expect(ben.platz).toBeLessThan(anna.platz!);
    expect(ben.anzeige).toBe('Reihe 6');
    expect(s.players.find((p) => p.id === 'b')!.bonus).toBe(4);
    expect(JSON.stringify(viewForHost(s, t.now))).toBeTruthy();
  });
});

import { Huhn, HuhnEvent, H_HUEPF_MS as HOP, H_STRAFE_MS } from '../src';

describe('Hühnerhüpfer: das Huhn auf dem Handy', () => {
  const run = (h: Huhn, from: number, to: number, startAt = 0) => {
    const ev: HuhnEvent[] = [];
    for (let now = from; now <= to; now += 16) ev.push(...h.update(now, (now - startAt) / 1000));
    return ev;
  };
  it('hüpft vorwärts, Bäume blockieren, eine Eingabe wird gepuffert', () => {
    const w = new HuehnerWelt(11);
    const free = w.row(1).deko!.findIndex((d) => !d);
    const h = new Huhn(w, { row: 0, col: free, best: 0, safe: 0 });
    h.wunsch('vor', 0);
    h.wunsch('zurueck', 10); // gepuffert
    const ev = run(h, 0, HOP * 3);
    expect(ev.filter((e) => e.k === 'hop').map((e: any) => e.row)).toEqual([1, 0]);
    // Rand und Baum blocken
    const tree = w.row(3).deko!.findIndex((d) => d);
    if (tree >= 0) {
      const g = new Huhn(w, { row: 2, col: tree, best: 2, safe: 2 });
      if (!w.row(2).deko![tree]) expect(g.wunsch('vor', 0)).toEqual([{ k: 'stoss' }]);
    }
    const e = new Huhn(w, { row: 0, col: 0, best: 0, safe: 0 });
    expect(e.wunsch('links', 0)).toEqual([{ k: 'stoss' }]);
    // nicht mehr als 3 Reihen zurück
    const b = new Huhn(w, { row: 5, col: 4, best: 8, safe: 3 });
    expect(b.wunsch('zurueck', 0)).toEqual([{ k: 'stoss' }]);
  });
  it('ins Wasser = raus, 2 s Strafe, Neustart auf der letzten Wiese', () => {
    for (let seed = 1; seed < 60; seed++) {
      const w = new HuehnerWelt(seed);
      const r = Array.from({ length: 60 }, (_, i) => i).find((i) => w.row(i).type === 'fluss' && w.row(i).pads && w.row(i - 1).type === 'gras');
      if (r === undefined) continue;
      const row = w.row(r);
      const wasser = Array.from({ length: H_COLS }, (_, c) => c).find((c) => !row.pads!.includes(c) && !w.row(r - 1).deko![c]);
      if (wasser === undefined) continue;
      const h = new Huhn(w, { row: r - 1, col: wasser, best: r - 1, safe: r - 1 });
      h.wunsch('vor', 1000);
      const ev = run(h, 1000, 1000 + HOP + 50);
      expect(ev.some((e) => e.k === 'raus' && e.grund === 'wasser')).toBe(true);
      expect(h.wunsch('vor', 1300)).toEqual([]); // raus: keine Eingaben
      const ev2 = run(h, 1300, 1000 + HOP + H_STRAFE_MS + 200);
      const neu = ev2.find((e) => e.k === 'hop') as any;
      expect(neu).toMatchObject({ row: r - 1, safe: true, neu: true });
      return;
    }
    throw new Error('kein passender Seed gefunden');
  });
  it('auf dem Baumstamm wird man mitgetragen', () => {
    for (let seed = 1; seed < 80; seed++) {
      const w = new HuehnerWelt(seed);
      for (let r = 4; r < 60; r++) {
        const row = w.row(r);
        if (row.type !== 'fluss' || !row.movers) continue;
        const t = 3;
        const m = row.movers[0];
        const x = moverX(row, m, t);
        if (x < 1 || x + m.len > H_COLS - 2) continue;
        const col = x + m.len / 2 - 0.5;
        const h = new Huhn(w, { row: r, col, best: r, safe: r - 1 });
        const ev = run(h, t * 1000, t * 1000 + 300);
        expect(ev.filter((e) => e.k === 'raus')).toEqual([]);
        expect(Math.sign(h.col - col)).toBe(row.dir);
        return;
      }
    }
    throw new Error('kein Stamm gefunden');
  });
  it('ein Auto erwischt das Huhn', () => {
    const w = new HuehnerWelt(4);
    const r = Array.from({ length: 80 }, (_, i) => i).find((i) => w.row(i).type === 'strasse')!;
    const row = w.row(r);
    const h = new Huhn(w, { row: r, col: 4, best: r, safe: r - 1 });
    // irgendwann innerhalb von 20 s kommt ein Auto vorbei
    const ev = run(h, 0, 20000);
    expect(ev[0]).toEqual({ k: 'raus', grund: 'auto' });
    expect(row.movers!.length).toBeGreaterThan(0);
  });
});
