import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostView, PlayerView } from '@kronen/shared';
import { TRACKS, TrackDef, F_HALF, F_RUNDEN, F_GATES, F_NACH_SIEG_MS, Car, stepCar, nearest, seededRng } from '@kronen/shared';
import { serverNow } from '../../lib/clock';
import { subscribeRt } from '../rtBus';
import { Joystick, StickValue, useGameLock } from '../../components/Joystick';
import { useServerTime } from './Countdown';
import { RotateHint, useViewport } from '../common';

type Send = (m: any) => void;
const act = (send: Send, a: any) => send({ t: 'act', a: { t: 'mini', a } });

/** [x, y, Winkel, Tempo, Kontrollpunkte, im Ziel] */
type SnapCar = [number, number, number, number, number, number];
interface Snap {
  t: number;
  c: SnapCar[];
}
interface CarInfo {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  runde: number;
  gates: number;
  platz: number;
  zeit: number | null;
}

/* ------------------------------------------------------------------ */
/* Schnappschüsse (vom Server, ca. 20× pro Sekunde) + Interpolation    */
/* ------------------------------------------------------------------ */

function useSnapshots(inner: any) {
  const buf = useRef<Snap[]>([]);
  // voller Stand aus der Ansicht als Rückfall (z. B. vor dem ersten Echtzeit-Paket)
  const s0: Snap | undefined = inner.snap;
  if (s0 && (!buf.current.length || s0.t > buf.current[buf.current.length - 1].t + 400)) buf.current = [s0];
  useEffect(
    () =>
      subscribeRt((d: any) => {
        if (d?.g !== 'f') return;
        const b = buf.current;
        if (b.length && d.t <= b[b.length - 1].t) return;
        b.push({ t: d.t, c: d.c });
        if (b.length > 30) b.splice(0, b.length - 30);
      }),
    [],
  );
  return buf;
}

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Autos zum Zeitpunkt t (Serverzeit) – zwischen zwei Paketen weich überblendet */
function sample(buf: Snap[], t: number): SnapCar[] | null {
  if (!buf.length) return null;
  let i = buf.length - 1;
  while (i > 0 && buf[i].t > t) i--;
  const a = buf[i];
  const b = buf[i + 1];
  if (!b) {
    // über das letzte Paket hinaus kurz weiterrechnen
    const dt = Math.min(0.15, Math.max(0, (t - a.t) / 1000));
    return a.c.map((k) => [k[0] + Math.cos(k[2]) * k[3] * dt, k[1] + Math.sin(k[2]) * k[3] * dt, k[2], k[3], k[4], k[5]] as SnapCar);
  }
  const f = Math.max(0, Math.min(1, (t - a.t) / Math.max(1, b.t - a.t)));
  return a.c.map((k, j) => {
    const m = b.c[j] ?? k;
    return [k[0] + (m[0] - k[0]) * f, k[1] + (m[1] - k[1]) * f, lerpAngle(k[2], m[2], f), m[3], m[4], m[5]] as SnapCar;
  });
}

/** Live-Platzierung aus den Schnappschüssen */
function livePlaces(tr: TrackDef, cars: SnapCar[], info: CarInfo[]): number[] {
  const n = tr.pts.length;
  const score = cars.map((k, i) => {
    if (k[5]) return 1e6 - (info[i]?.zeit ?? 0) / 1e3;
    const gates = k[4];
    const gi = gates % F_GATES;
    const to = tr.gates[gi];
    const from = tr.gates[(gi - 1 + F_GATES) % F_GATES];
    const seg = (to - from + n) % n || n;
    const here = nearest(tr, k[0], k[1]).i;
    return gates + (gates === 0 ? 0 : Math.max(0, Math.min(0.999, ((here - from + n) % n) / seg)));
  });
  return score.map((s) => score.filter((o) => o > s).length + 1);
}

/* ------------------------------------------------------------------ */
/* Strecke zeichnen                                                    */
/* ------------------------------------------------------------------ */

interface View {
  x0: number;
  y0: number;
  w: number;
  h: number;
}
function viewBox(tr: TrackDef): View {
  const xs = tr.pts.map((p) => p.x), ys = tr.pts.map((p) => p.y);
  const m = F_HALF + 22;
  const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
  return { x0, y0, w: Math.max(...xs) + m - x0, h: Math.max(...ys) + m - y0 };
}

/** Deko neben der Strecke (immer gleich je Strecke) */
function decor(tr: TrackDef, vb: View) {
  const rng = seededRng(tr.id * 97 + 13);
  const items: { k: 'baum' | 'geschenk' | 'stange'; x: number; y: number; s: number; c: number }[] = [];
  for (let tries = 0; items.length < 26 && tries < 1500; tries++) {
    const x = vb.x0 + rng() * vb.w, y = vb.y0 + rng() * vb.h;
    if (nearest(tr, x, y).d < F_HALF + 38) continue;
    if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 70)) continue;
    const r = rng();
    items.push({ k: r < 0.55 ? 'baum' : r < 0.82 ? 'geschenk' : 'stange', x, y, s: 0.8 + rng() * 0.5, c: Math.floor(rng() * 4) });
  }
  return items;
}

function path(ctx: CanvasRenderingContext2D, tr: TrackDef) {
  ctx.beginPath();
  tr.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

const GESCHENK = ['#e53935', '#1e88e5', '#8e24aa', '#43a047'];

function drawTrack(ctx: CanvasRenderingContext2D, tr: TrackDef, vb: View, items: ReturnType<typeof decor>) {
  // Schnee
  const g = ctx.createLinearGradient(0, vb.y0, 0, vb.y0 + vb.h);
  g.addColorStop(0, '#f4f8fc');
  g.addColorStop(1, '#dde9f4');
  ctx.fillStyle = g;
  ctx.fillRect(vb.x0 - 400, vb.y0 - 400, vb.w + 800, vb.h + 800);
  const rng = seededRng(tr.id + 5);
  ctx.fillStyle = 'rgba(150,180,210,0.35)';
  for (let i = 0; i < 160; i++) {
    ctx.beginPath();
    ctx.arc(vb.x0 + rng() * vb.w, vb.y0 + rng() * vb.h, 2 + rng() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Schatten + rot-weiße Randsteine
  path(ctx, tr);
  ctx.strokeStyle = 'rgba(40,60,90,0.18)';
  ctx.lineWidth = 2 * F_HALF + 30;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * F_HALF + 16;
  ctx.stroke();
  ctx.setLineDash([22, 22]);
  ctx.strokeStyle = '#e53935';
  ctx.stroke();
  ctx.setLineDash([]);
  // Asphalt
  ctx.strokeStyle = '#4b5059';
  ctx.lineWidth = 2 * F_HALF;
  ctx.stroke();
  // Mittellinie
  ctx.setLineDash([26, 30]);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([]);
  // Start/Ziel: Schachbrett quer zur Strecke
  const p = tr.pts[0];
  const a = tr.dir[0];
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a);
  const sq = 12;
  for (let i = -F_HALF; i < F_HALF; i += sq)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (Math.round(i / sq) + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(-sq + j * sq, i, sq, sq);
    }
  ctx.restore();
  // Deko
  for (const o of items) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s, o.s);
    if (o.k === 'baum') {
      ctx.fillStyle = 'rgba(40,60,90,0.18)';
      ctx.beginPath();
      ctx.ellipse(6, 30, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d4c2f';
      ctx.fillRect(-5, 18, 10, 14);
      for (const [y, w] of [[-4, 30], [-20, 24], [-34, 17]]) {
        ctx.fillStyle = '#2e8b3e';
        ctx.beginPath();
        ctx.moveTo(0, y - 18);
        ctx.lineTo(w, y + 22);
        ctx.lineTo(-w, y + 22);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 4 : 9;
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        ctx.lineTo(Math.cos(ang) * r, -54 + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else if (o.k === 'geschenk') {
      ctx.fillStyle = 'rgba(40,60,90,0.18)';
      ctx.fillRect(-14, 10, 34, 10);
      ctx.fillStyle = GESCHENK[o.c];
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(-4, -16, 8, 32);
      ctx.fillRect(-16, -4, 32, 8);
    } else {
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.lineTo(0, -10);
      ctx.arc(-10, -10, 10, 0, Math.PI, true);
      ctx.stroke();
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = '#e53935';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, opts: { me?: boolean; done?: boolean; label?: string; pulse?: number }) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.me) {
    ctx.strokeStyle = `rgba(255,213,79,${0.55 + 0.45 * (opts.pulse ?? 0)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + 4 * (opts.pulse ?? 0), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (opts.label) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    const w = ctx.measureText(opts.label).width + 18;
    ctx.fillStyle = color;
    ctx.globalAlpha = opts.done ? 0.6 : 0.92;
    ctx.beginPath();
    ctx.roundRect?.(-w / 2, -58, w, 28, 14);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, 0, -44);
  }
  ctx.rotate(a);
  if (opts.done) ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-18, -9, 40, 25);
  ctx.fillStyle = '#1d1d1d';
  for (const [wx, wy] of [[-13, -14], [8, -14], [-13, 9], [8, 9]]) ctx.fillRect(wx, wy, 10, 5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect?.(-20, -11, 40, 22, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#bfe4fa';
  ctx.fillRect(2, -8, 8, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-15, -2, 14, 4);
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(17, -9, 3, 5);
  ctx.fillRect(17, 4, 3, 5);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Renn-Leinwand (Handy + Hauptscreen)                                 */
/* ------------------------------------------------------------------ */

function RaceCanvas({ inner, meId, labels, steuer, onPlaces }: {
  inner: any;
  meId?: string;
  labels?: boolean;
  /** eigener Joystick (für die Vorhersage des eigenen Autos) */
  steuer?: React.MutableRefObject<{ a: number; m: number }>;
  onPlaces?: (places: number[], cars: SnapCar[]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tr = TRACKS[inner.track];
  const vb = useMemo(() => viewBox(tr), [tr]);
  const items = useMemo(() => decor(tr, vb), [tr, vb]);
  const buf = useSnapshots(inner);
  const innerRef = useRef(inner);
  innerRef.current = inner;
  const placesCb = useRef(onPlaces);
  placesCb.current = onPlaces;
  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let bg: HTMLCanvasElement | null = null;
    let scale = 1, ox = 0, oy = 0, raf = 0, lastPlaces = 0;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      scale = Math.min(cv.width / vb.w, cv.height / vb.h);
      ox = (cv.width - vb.w * scale) / 2 - vb.x0 * scale;
      oy = (cv.height - vb.h * scale) / 2 - vb.y0 * scale;
      // Strecke einmal vorzeichnen
      bg = document.createElement('canvas');
      bg.width = cv.width;
      bg.height = cv.height;
      const b = bg.getContext('2d')!;
      b.setTransform(scale, 0, 0, scale, ox, oy);
      drawTrack(b, tr, vb, items);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const own: Car = { id: '', x: 0, y: 0, a: 0, v: 0, gates: 0, finishAt: null, off: false };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = serverNow();
      const cars = sample(buf.current, now - 90);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (bg) ctx.drawImage(bg, 0, 0);
      if (!cars) return;
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      const inn = innerRef.current;
      const info: CarInfo[] = inn.cars;
      const pulse = (Math.sin(now / 160) + 1) / 2;
      // eigenes Auto: vom neuesten Paket aus mit dem eigenen Joystick vorausrechnen (fühlt sich direkter an)
      const meIdx = meId ? info.findIndex((c) => c.id === meId) : -1;
      const latest = buf.current[buf.current.length - 1];
      if (meIdx >= 0 && latest && steuer && inn.stage === 'rennen' && !latest.c[meIdx][5]) {
        const k = latest.c[meIdx];
        Object.assign(own, { x: k[0], y: k[1], a: k[2], v: k[3] });
        let rest = Math.min(0.2, Math.max(0, (now - latest.t) / 1000));
        while (rest > 0) {
          const dt = Math.min(1 / 60, rest);
          stepCar(tr, own, steuer.current, dt);
          rest -= dt;
        }
        cars[meIdx] = [own.x, own.y, own.a, own.v, k[4], k[5]];
      }
      const order = cars.map((_, i) => i).sort((a, b) => (a === meIdx ? 1 : b === meIdx ? -1 : 0));
      for (const i of order) {
        const k = cars[i];
        const c = info[i];
        if (!c) continue;
        drawCar(ctx, k[0], k[1], k[2], c.color, { me: i === meIdx, done: !!k[5], label: labels ? c.name : undefined, pulse });
      }
      if (placesCb.current && now - lastPlaces > 250) {
        lastPlaces = now;
        placesCb.current(livePlaces(tr, cars, info), cars);
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, vb, items]);
  return <canvas ref={canvas} className="fz-canvas" />;
}

/* ------------------------------------------------------------------ */
/* Startampel                                                          */
/* ------------------------------------------------------------------ */

function StartLights({ startAt, big }: { startAt: number; big?: boolean }) {
  const now = useServerTime(50);
  const left = startAt - now;
  if (left > 3600 || left < -1200) return null;
  const go = left <= 0;
  const on = go ? 3 : Math.min(3, Math.floor((3600 - left) / 1000) + 1);
  return (
    <div className={`fz-lights ${big ? 'big' : ''}`}>
      <div className="fz-lamps">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`fz-lamp ${go ? 'green' : i < on ? 'red' : ''}`} />
        ))}
      </div>
      {go && <div className="fz-go">LOS!</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Handy                                                               */
/* ------------------------------------------------------------------ */

const SIDE_KEY = 'kj_stick_side';

export function FlitzerPhone({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  useGameLock(true);
  const { w, h } = useViewport();
  const meId = v.me.id;
  const steuer = useRef({ a: 0, m: 0 });
  const sent = useRef({ a: 0, m: 0, at: 0 });
  const [side, setSide] = useState<'links' | 'rechts'>(() => {
    try {
      return localStorage.getItem(SIDE_KEY) === 'rechts' ? 'rechts' : 'links';
    } catch {
      return 'links';
    }
  });
  const [live, setLive] = useState<{ platz: number; runde: number; fertig: boolean }>({ platz: 0, runde: 1, fertig: false });
  const sendRef = useRef(send);
  sendRef.current = send;
  // Joystick ca. 20× pro Sekunde schicken (nur bei Änderung), Loslassen sofort
  const flush = (force = false) => {
    const s = steuer.current;
    const o = sent.current;
    const now = performance.now();
    const changed = Math.abs(s.m - o.m) > 0.03 || (s.m > 0 && Math.abs(Math.atan2(Math.sin(s.a - o.a), Math.cos(s.a - o.a))) > 0.04);
    if (!changed && !(force && s.m !== o.m)) return;
    if (!force && now - o.at < 50) return;
    sent.current = { a: s.a, m: s.m, at: now };
    act(sendRef.current, { k: 'lenk', a: Math.round(s.a * 1000) / 1000, m: Math.round(s.m * 100) / 100 });
  };
  useEffect(() => {
    const id = setInterval(() => flush(), 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onStick = (s: StickValue) => {
    steuer.current = { a: s.angle, m: s.mag };
    if (s.mag === 0) flush(true);
    else flush();
  };
  const now = useServerTime(250);
  const me: CarInfo | undefined = inner.cars.find((c: CarInfo) => c.id === meId);
  const n = inner.cars.length;
  const restNachSieg = inner.firstFinish ? Math.max(0, Math.ceil((inner.firstFinish + F_NACH_SIEG_MS - now) / 1000)) : null;
  const portrait = h > w;
  const stick = Math.round(Math.max(110, Math.min(160, Math.min(w, h) * 0.36)));
  const fertig = live.fertig || me?.zeit != null;
  return (
    <div className="fz-phone">
      <RaceCanvas
        inner={inner}
        meId={meId}
        steuer={steuer}
        onPlaces={(places, cars) => {
          const i = inner.cars.findIndex((c: CarInfo) => c.id === meId);
          if (i < 0) return;
          const g = cars[i][4];
          const next = { platz: places[i], runde: Math.min(F_RUNDEN, Math.max(1, Math.floor((g - 1) / F_GATES) + 1)), fertig: !!cars[i][5] };
          setLive((o) => (o.platz === next.platz && o.runde === next.runde && o.fertig === next.fertig ? o : next));
        }}
      />
      <div className={`fz-hud ${side === 'rechts' ? 'left' : ''}`}>
        <span className="fz-chip" style={{ background: me?.color }}>{me?.name ?? 'Du'}</span>
        <span className="fz-stat">Platz <b>{live.platz || me?.platz || '–'}</b>/{n}</span>
        <span className="fz-stat">Runde <b>{live.runde}</b>/{F_RUNDEN}</span>
        {restNachSieg !== null && inner.stage === 'rennen' && !fertig && <span className="fz-stat warn">noch {restNachSieg}s</span>}
      </div>
      <div className={`fz-stick ${side}`}>
        <Joystick onChange={onStick} size={stick} />
      </div>
      <button
        className={`fz-swap ${side}`}
        onClick={() => {
          const s = side === 'links' ? 'rechts' : 'links';
          setSide(s);
          try {
            localStorage.setItem(SIDE_KEY, s);
          } catch {
            /* egal */
          }
        }}
      >
        ⇄
      </button>
      <StartLights startAt={inner.startAt} />
      {fertig && inner.stage === 'rennen' && <div className="fz-banner">Im Ziel! Platz {me?.platz || live.platz}</div>}
      {inner.stage === 'ende' && (
        <div className="fz-overlay">
          <div className="card center" style={{ padding: '14px 24px' }}>
            <h2>Rennen vorbei!</h2>
            <p>Dein Platz: <b>{me?.platz}</b> von {n}</p>
          </div>
        </div>
      )}
      {portrait && <div className="fz-rotate"><RotateHint text="Das Rennen fährst du im Querformat – dann füllt die Strecke den ganzen Bildschirm." /></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hauptscreen                                                         */
/* ------------------------------------------------------------------ */

export function FlitzerHost({ v, inner, portrait }: { v: HostView; inner: any; portrait?: boolean }) {
  const [places, setPlaces] = useState<number[] | null>(null);
  const [gates, setGates] = useState<number[]>([]);
  const now = useServerTime(250);
  const cars: CarInfo[] = inner.cars;
  const rows = cars
    .map((c, i) => ({ ...c, live: places?.[i] ?? c.platz, runde: gates[i] !== undefined ? Math.min(F_RUNDEN, Math.max(1, Math.floor((gates[i] - 1) / F_GATES) + 1)) : c.runde }))
    .sort((a, b) => a.live - b.live);
  const restNachSieg = inner.firstFinish ? Math.max(0, Math.ceil((inner.firstFinish + F_NACH_SIEG_MS - now) / 1000)) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 440px', gap: 24, flex: 1, minHeight: 0 }}>
      <div style={{ position: 'relative', minHeight: portrait ? 500 : 0, borderRadius: 24, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
        <RaceCanvas
          inner={inner}
          labels
          onPlaces={(p, c) => {
            setPlaces((o) => (o && o.join() === p.join() ? o : p));
            setGates((o) => (o.join() === c.map((k) => k[4]).join() ? o : c.map((k) => k[4])));
          }}
        />
        <StartLights startAt={inner.startAt} big />
        <div className="fz-trackname">{TRACKS[inner.track].name}</div>
      </div>
      <div className="panel stack" style={{ gap: 10, fontSize: 26, overflow: 'hidden' }}>
        <h3 style={{ fontSize: 34 }}>{inner.stage === 'ende' ? 'Zieleinlauf' : inner.stage === 'countdown' ? 'Startaufstellung' : 'Rennen'}</h3>
        {restNachSieg !== null && inner.stage === 'rennen' && <p className="head" style={{ color: '#ff8a80' }}>Noch {restNachSieg} s für alle anderen!</p>}
        {rows.map((r) => (
          <div key={r.id} className="list-item" style={{ padding: '6px 12px' }}>
            <b style={{ width: 40 }}>{r.live}.</b>
            <span className="fz-dot" style={{ background: r.color }} />
            <span className="grow" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            <span className="head gold">{r.zeit != null ? `${(r.zeit / 1000).toFixed(1).replace('.', ',')} s` : `R ${r.runde}/${F_RUNDEN}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
