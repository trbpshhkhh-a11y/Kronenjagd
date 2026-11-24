import { describe, it, expect } from 'vitest';
import {
  TRACKS, F_HALF, F_BANDE, F_GATES, F_RUNDEN, F_MAX_MS, F_VMAX, F_WAND, F_CAR_R, Car, grid, stepCar, checkGates, botSteuer, onTrack, runde, fortschritt, nearest,
  nearestExact, collide, bande, newCar,
  createGameState, addPlayer, addBot, startGame, tick, playerAction, startMinigame, setConnected, seededRng, GameState, Rng,
} from '../src';

const neu = (id: string, p: { x: number; y: number; a: number }): Car => newCar(id, p.x, p.y, p.a);

function fahren(tr: (typeof TRACKS)[number], car: Car, steuer: (t: number) => { a: number; m: number }, maxS: number) {
  const dt = 1 / 60;
  for (let k = 0; k < maxS * 60; k++) {
    stepCar(tr, car, steuer(k * dt), dt);
    if (checkGates(tr, car, k * dt * 1000)) return k * dt;
  }
  return null;
}

describe('Turbo-Flitzer: Strecken', () => {
  it('drei Strecken, geschlossen, ohne zu enge Stellen, Startaufstellung auf der Strecke', () => {
    expect(TRACKS.map((t) => t.name)).toEqual(['Eisbahn-Oval', 'Lebkuchen-Schlängel', 'Zuckerstangen-L']);
    for (const tr of TRACKS) {
      const n = tr.pts.length;
      expect(tr.gates).toHaveLength(F_GATES);
      // geschlossen: Abstand letzter → erster Punkt wie alle anderen
      const p0 = tr.pts[0], pl = tr.pts[n - 1];
      expect(Math.hypot(p0.x - pl.x, p0.y - pl.y)).toBeLessThan(10);
      // Streckenteile, die entlang der Strecke weit auseinander liegen, kommen sich nicht zu nah
      for (let i = 0; i < n; i += 3)
        for (let j = i + 1; j < n; j += 3) {
          const along = Math.min(j - i, n - (j - i));
          if (along < 45) continue;
          expect(Math.hypot(tr.pts[i].x - tr.pts[j].x, tr.pts[i].y - tr.pts[j].y), `${tr.name} ${i}/${j}`).toBeGreaterThan(2 * F_HALF + 10);
        }
      // Kurven sind überall weiter als die Bande breit ist (sonst gäbe es innen Knicke)
      let minR = Infinity;
      for (let i = 0; i < n; i++) {
        const a = tr.pts[(i - 3 + n) % n], b = tr.pts[i], c = tr.pts[(i + 3) % n];
        const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
        if (area2 < 1e-6) continue;
        minR = Math.min(minR, (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) * Math.hypot(a.x - c.x, a.y - c.y)) / (2 * area2));
      }
      expect(minR, tr.name).toBeGreaterThan(F_BANDE + 24);
      const g = grid(tr, 10);
      for (const p of g) expect(onTrack(tr, p.x, p.y)).toBe(true);
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) expect(Math.hypot(g[i].x - g[j].x, g[i].y - g[j].y)).toBeGreaterThan(30);
    }
  });
});

describe('Turbo-Flitzer: Fahren und Runden zählen', () => {
  it('Bot-Fahrer schafft 3 Runden auf jeder Strecke in unter 2 Minuten', () => {
    for (const tr of TRACKS) {
      const car = neu('b', grid(tr, 1)[0]);
      const zeit = fahren(tr, car, (t) => botSteuer(tr, car, 0.8, 0, t), 120);
      expect(zeit, tr.name).not.toBeNull();
      expect(zeit!).toBeGreaterThan(20);
      expect(car.gates).toBe(F_RUNDEN * F_GATES + 1);
      expect(runde(car)).toBe(3);
    }
  });
  it('Runden zählen nur mit allen Kontrollpunkten in der richtigen Reihenfolge', () => {
    const tr = TRACKS[0];
    const car = neu('x', grid(tr, 1)[0]);
    // Start überqueren
    checkGates(tr, { ...car, x: tr.pts[0].x, y: tr.pts[0].y } as Car, 0);
    const c = { ...car, x: tr.pts[0].x, y: tr.pts[0].y };
    checkGates(tr, c, 0);
    expect(c.gates).toBe(1);
    // Kontrollpunkt 3 anfahren, ohne 1 und 2: zählt nicht
    const g3 = tr.pts[tr.gates[3]];
    c.x = g3.x; c.y = g3.y; c.a = tr.dir[tr.gates[3]];
    checkGates(tr, c, 0);
    expect(c.gates).toBe(1);
    // der Reihe nach: zählt
    for (let k = 1; k < F_GATES; k++) {
      const g = tr.pts[tr.gates[k]];
      c.x = g.x; c.y = g.y; c.a = tr.dir[tr.gates[k]];
      checkGates(tr, c, 0);
    }
    expect(c.gates).toBe(F_GATES);
    expect(runde(c)).toBe(1);
    c.x = tr.pts[0].x; c.y = tr.pts[0].y; c.a = tr.dir[0];
    checkGates(tr, c, 0);
    expect(runde(c)).toBe(2);
    expect(fortschritt(tr, c)).toBeGreaterThan(F_GATES);
  });
  it('rückwärts fahren zählt keine Runden', () => {
    const tr = TRACKS[1];
    const car = neu('r', grid(tr, 1)[0]);
    car.a += Math.PI;
    const back = fahren(tr, car, (t) => {
      const i = nearest(tr, car.x, car.y).i;
      const p = tr.pts[(i - 14 + tr.pts.length) % tr.pts.length];
      return { a: -Math.atan2(p.y - car.y, p.x - car.x), m: 0.8 };
    }, 40);
    expect(back).toBeNull();
    expect(car.gates).toBeLessThanOrEqual(1);
  });
});

describe('Turbo-Flitzer: Bande und Zusammenstöße', () => {
  it('über die Bande kommt niemand – egal wohin der Joystick zeigt', () => {
    for (const tr of TRACKS) {
      for (let dirK = 0; dirK < 8; dirK++) {
        const g = grid(tr, 1)[0];
        const car = neu('w', g);
        for (let k = 0; k < 6 * 60; k++) {
          stepCar(tr, car, { a: (dirK * Math.PI) / 4 + k * 0.004, m: 1 }, 1 / 60);
          expect(nearestExact(tr, car.x, car.y).d, tr.name).toBeLessThanOrEqual(F_WAND + 0.01);
        }
        expect(onTrack(tr, car.x, car.y)).toBe(true);
      }
    }
  });
  it('frontal gegen die Bande bremst stark, schräg daran entlang gleitet das Auto weiter', () => {
    const tr = TRACKS[0];
    // untere Gerade: Fahrtrichtung nach rechts, Bande unten (y größer)
    const p = tr.pts[0];
    const frontal = neu('f', { x: p.x, y: p.y, a: Math.PI / 2 });
    frontal.v = 300;
    for (let k = 0; k < 30; k++) stepCar(tr, frontal, { a: -Math.PI / 2, m: 1 }, 1 / 60);
    expect(frontal.v).toBeLessThan(60);
    const schraeg = neu('s', { x: p.x, y: p.y, a: 0.35 });
    schraeg.v = 300;
    for (let k = 0; k < 60; k++) stepCar(tr, schraeg, { a: -0.35, m: 1 }, 1 / 60);
    expect(schraeg.v).toBeGreaterThan(200);
    expect(schraeg.x).toBeGreaterThan(p.x + 150);
    expect(nearestExact(tr, schraeg.x, schraeg.y).d).toBeLessThanOrEqual(F_WAND + 0.01);
  });
  it('Zusammenstöße: kein Überlappen, weicher Schubs, keine Zitterbewegung', () => {
    const tr = TRACKS[0];
    const p = tr.pts[0];
    const a = neu('a', { x: p.x - 60, y: p.y, a: 0 });
    const b = neu('b', { x: p.x + 20, y: p.y, a: 0 });
    a.v = 300;
    const pos: number[] = [];
    for (let k = 0; k < 90; k++) {
      stepCar(tr, a, { a: 0, m: 1 }, 1 / 60);
      stepCar(tr, b, { a: 0, m: 0 }, 1 / 60);
      collide([a, b]);
      bande(tr, a);
      bande(tr, b);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * F_CAR_R - 0.01);
      pos.push(b.x);
    }
    // b wurde angeschoben und bewegt sich gleichmäßig vorwärts (nie ruckartig zurück)
    expect(b.x).toBeGreaterThan(p.x + 60);
    for (let k = 1; k < pos.length; k++) expect(pos[k]).toBeGreaterThanOrEqual(pos[k - 1] - 0.5);
    // Seitlich nebeneinander, beide lenken zueinander: Abstand bleibt, keine Sprünge
    const c = neu('c', { x: p.x, y: p.y - 20, a: 0 });
    const d = neu('d', { x: p.x, y: p.y + 20, a: 0 });
    c.v = d.v = 250;
    let maxJump = 0;
    let last = [c.x, c.y];
    for (let k = 0; k < 120; k++) {
      stepCar(tr, c, { a: -0.4, m: 0.9 }, 1 / 60);
      stepCar(tr, d, { a: 0.4, m: 0.9 }, 1 / 60);
      collide([c, d]);
      bande(tr, c);
      bande(tr, d);
      maxJump = Math.max(maxJump, Math.hypot(c.x - last[0], c.y - last[1]));
      last = [c.x, c.y];
      expect(Math.hypot(c.x - d.x, c.y - d.y)).toBeGreaterThanOrEqual(2 * F_CAR_R - 1);
    }
    expect(maxJump).toBeLessThan(F_VMAX / 60 + 4);
  });
});

function advance(s: GameState, rng: Rng, t: { now: number }, ms: number, step = 100) {
  const end = t.now + ms;
  while (t.now < end) {
    t.now += step;
    tick(s, { rng, now: t.now });
  }
}

describe('Turbo-Flitzer: ganzes Rennen', () => {
  it('3 Menschen + Bot: Zieleinlauf, 15 s Nachlauf, Platz-Belohnung; getrennt = steht', () => {
    const s = createGameState('FZ', 0, { screenMode: false });
    addPlayer(s, 'Anna', 'a', 't1', 0);
    addPlayer(s, 'Ben', 'b', 't2', 0);
    addPlayer(s, 'Cleo', 'c', 't3', 0);
    addBot(s, 'schwer');
    const rng = seededRng(9);
    const t = { now: 0 };
    startGame(s, { rng, now: 0 });
    advance(s, rng, t, 20000);
    startMinigame(s, 'flitzer', null, { rng, now: t.now });
    advance(s, rng, t, 6000);
    for (const id of ['a', 'b', 'c']) playerAction(s, id, { t: 'ready' }, { rng, now: t.now });
    advance(s, rng, t, 4100);
    const st = s.mini!.inner as any;
    expect(st.game).toBe('flitzer');
    expect(st.stage).toBe('rennen');
    const tr = TRACKS[st.track];
    setConnected(s, 'c', false, t.now); // Cleo ist weg: ihr Auto bleibt stehen
    const cleo0 = { ...st.cars.find((k: Car) => k.id === 'c') };
    const v0 = s.version;
    let sent = 0;
    while (s.mini?.stage === 'spiel' && t.now < 200000) {
      // Menschen lenken wie ein guter Fahrer (Anna etwas schneller als Ben), ca. 20× pro Sekunde
      for (const [id, tempo] of [['a', 1], ['b', 0.85]] as const) {
        const car = st.cars.find((k: Car) => k.id === id);
        const steuer = botSteuer(tr, car, tempo, 0, t.now / 1000);
        playerAction(s, id, { t: 'mini', a: { k: 'lenk', a: steuer.a, m: steuer.m } }, { rng, now: t.now });
        sent++;
      }
      if (sent === 2) expect(s.version).toBe(v0); // Lenken löst keinen vollen Versand aus
      advance(s, rng, t, 50, 50);
    }
    expect(s.mini?.stage).toBe('ergebnis');
    const cleo = st.cars.find((k: Car) => k.id === 'c');
    expect(Math.hypot(cleo.x - cleo0.x, cleo.y - cleo0.y)).toBeLessThan(40);
    const anna = st.cars.find((k: Car) => k.id === 'a');
    expect(anna.finishAt).not.toBeNull();
    expect(st.firstFinish).not.toBeNull();
    expect(st.endAt).toBeLessThanOrEqual(st.firstFinish + 15000);
    expect(st.endAt).toBeLessThanOrEqual(st.startAt + F_MAX_MS);
    const rows = s.mini!.result!.rows;
    expect(rows.map((r) => r.platz)).toEqual([1, 2, 3, 4]);
    expect(rows[rows.length - 1].label).toBe('Cleo');
    expect(rows[0].anzeige).toMatch(/^\d+,\d s$/);
    expect(rows[3].anzeige).toMatch(/^Runde/);
    const first = s.players.find((p) => p.id === st.cars.find((k: Car) => k.finishAt === st.firstFinish).id)!;
    expect(first.bonus).toBe(5);
    expect(s.players.find((p) => p.id === 'c')!.bonus).toBe(2);
  });
});
