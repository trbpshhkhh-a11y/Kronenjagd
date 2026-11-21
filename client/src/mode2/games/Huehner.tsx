import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostView, PlayerView } from '@kronen/shared';
import { HuehnerWelt, Huhn, HuhnEvent, Richtung, H_TAKT_MS, H_COLS, H_HUEPF_MS, H_DAUER_MS, traeger, begehbar } from '@kronen/shared';
import { serverNow } from '../../lib/clock';
import { subscribeRt } from '../rtBus';
import { Joystick, StickValue, useGameLock, vibrate } from '../../components/Joystick';
import { Countdown, useServerTime } from './Countdown';
import type { Figur, HuehnerSzene } from './huehner/scene';

type Send = (m: any) => void;
const act = (send: Send, a: any) => send({ t: 'act', a: { t: 'mini', a } });

interface RunnerView {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  row: number;
  col: number;
  best: number;
  bestAt: number;
  safe: number;
  out: boolean;
}

/** Lebendiger Stand aller Hühner: voller Stand ca. 1×/s, dazwischen Echtzeit-Hüpfer */
interface Geist extends RunnerView {
  fromRow: number;
  fromCol: number;
  changedAt: number;
  outAt: number;
  rtAt: number;
}

function useLiveRunners(inner: any, meId: string | null) {
  const map = useRef(new Map<string, Geist>());
  const [, force] = useState(0);
  // voller Stand aus der Ansicht (nur übernehmen, wenn länger keine Echtzeit-Meldung kam)
  const now = performance.now();
  for (const r of inner.runners as RunnerView[]) {
    const g = map.current.get(r.id);
    if (!g) {
      map.current.set(r.id, { ...r, fromRow: r.row, fromCol: r.col, changedAt: -1e9, outAt: r.out ? now - 3000 : -1e9, rtAt: -1e9 });
      continue;
    }
    g.name = r.name;
    g.color = r.color;
    g.best = Math.max(g.best, r.best);
    g.bestAt = r.bestAt;
    if (now - g.rtAt > 1500 && (g.row !== r.row || Math.abs(g.col - r.col) > 0.6 || g.out !== r.out)) {
      g.fromRow = g.row;
      g.fromCol = g.col;
      g.row = r.row;
      g.col = r.col;
      g.changedAt = now;
      if (r.out && !g.out) g.outAt = now;
      g.out = r.out;
    }
  }
  useEffect(
    () =>
      subscribeRt((d: any) => {
        if (d?.g !== 'h' || d.id === meId) return;
        const g = map.current.get(d.id);
        if (!g) return;
        const t = performance.now();
        g.rtAt = t;
        if (d.out) {
          if (!g.out) g.outAt = t;
          g.out = true;
        } else {
          g.fromRow = g.out ? d.row : g.row;
          g.fromCol = g.out ? d.col : g.col;
          g.row = d.row;
          g.col = d.col;
          g.changedAt = t;
          g.out = false;
        }
        g.best = Math.max(g.best, d.best ?? 0);
        force((x) => x + 1);
      }),
    [meId],
  );
  return map;
}

/** Rangliste: weiteste Reihe, bei Gleichstand wer zuerst */
function ranking<T extends { id: string; best: number; bestAt: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.best - a.best || a.bestAt - b.bestAt);
}

/* ------------------------------------------------------------------ */
/* Handy                                                               */
/* ------------------------------------------------------------------ */

export function HuehnerPhone({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  useGameLock(true);
  const meId = v.me.id;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [hud, setHud] = useState({ best: 0, raus: false, platz: 1 });
  const welt = useMemo(() => new HuehnerWelt(inner.seed), [inner.seed]);
  const live = useLiveRunners(inner, meId);
  const innerRef = useRef(inner);
  innerRef.current = inner;
  const sendRef = useRef(send);
  sendRef.current = send;
  const huhn = useMemo(() => {
    // Wiedereinstieg nach Verbindungsabbruch: auf der letzten sicheren Wiese weiter
    const r = (inner.runners as RunnerView[]).find((x) => x.id === meId);
    if (!r || r.best === 0) return new Huhn(welt, { row: 0, col: Math.floor(H_COLS / 2), best: 0, safe: 0 });
    const row = welt.row(r.safe);
    let col = Math.max(0, Math.min(H_COLS - 1, Math.round(r.col)));
    for (let d = 0; d < H_COLS; d++) {
      if (begehbar(row, col + d)) { col += d; break; }
      if (begehbar(row, col - d)) { col -= d; break; }
    }
    return new Huhn(welt, { row: r.safe, col, best: r.best, safe: r.safe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welt]);
  const stick = useRef<{ dir: Richtung | null; next: number }>({ dir: null, next: 0 });

  const running = () => {
    const now = serverNow();
    return now >= innerRef.current.startAt && now < innerRef.current.endAt;
  };
  const handle = (ev: HuhnEvent[]) => {
    for (const e of ev) {
      if (e.k === 'hop') act(sendRef.current, { k: 'hop', row: e.row, col: e.col, safe: e.safe });
      else if (e.k === 'raus') {
        act(sendRef.current, { k: 'raus' });
        vibrate([70, 40, 140]);
      } else if (e.k === 'stoss') vibrate(12);
    }
  };
  const wunsch = (r: Richtung) => {
    if (!running()) return;
    handle(huhn.wunsch(r, serverNow()));
  };

  // Tastatur (zum Testen am Computer)
  useEffect(() => {
    const keys: Record<string, Richtung> = { ArrowUp: 'vor', w: 'vor', ArrowDown: 'zurueck', s: 'zurueck', ArrowLeft: 'links', a: 'links', ArrowRight: 'rechts', d: 'rechts' };
    const on = (e: KeyboardEvent) => {
      const r = keys[e.key];
      if (!r || e.repeat) return;
      e.preventDefault();
      wunsch(r);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huhn]);

  // 3D-Szene + Spielschleife
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let scene: HuehnerSzene | null = null;
    let ro: ResizeObserver | null = null;
    let lastHud = 0;
    let lastPerf = performance.now();
    import('./huehner/scene').then(({ HuehnerSzene }) => {
      if (!alive || !canvas.current) return;
      scene = new HuehnerSzene(canvas.current, welt);
      const resize = () => {
        const r = canvas.current?.getBoundingClientRect();
        if (r && scene) scene.resize(r.width, r.height);
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(canvas.current);
      setLoaded(true);
      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const now = serverNow();
        const perf = performance.now();
        const dt = Math.min(0.1, (perf - lastPerf) / 1000);
        lastPerf = perf;
        const inn = innerRef.current;
        const t = (now - inn.startAt) / 1000;
        if (now >= inn.startAt && now < inn.endAt) {
          const s = stick.current;
          if (s.dir && now >= s.next) {
            handle(huhn.wunsch(s.dir, now));
            s.next = now + H_TAKT_MS;
          }
          handle(huhn.update(now, t));
        }
        // eigenes Huhn
        const pose = huhn.pose(now);
        let squash = 0;
        let sink = 0;
        let alpha = 1;
        let lift = pose.lift;
        if (huhn.raus) {
          const k = now - huhn.raus.at;
          if (huhn.raus.grund === 'wasser') sink = Math.min(1, k / 450);
          else squash = Math.min(1, k / 70);
          if (k > 1400) alpha = Math.max(0, 1 - (k - 1400) / 500);
        } else if (now - huhn.neuAt < 900) alpha = Math.floor((now - huhn.neuAt) / 110) % 2 ? 0.3 : 1;
        if (now - huhn.stossAt < 140) lift = Math.sin(((now - huhn.stossAt) / 140) * Math.PI) * 0.12;
        const me = live.current.get(meId);
        const figs: Figur[] = [];
        // Geister der anderen (ohne Bots)
        for (const g of live.current.values()) {
          if (g.id === meId || g.bot) continue;
          // auf dem Stamm treibt der Geist mit (gleiche Welt, gleiche Zeit)
          if (!g.out && perf - g.changedAt > H_HUEPF_MS) {
            const tr = traeger(welt.row(g.row), g.col, t);
            if (tr && tr.speed) g.col = g.fromCol = g.col + tr.speed * dt;
          }
          const p = Math.min(1, (perf - g.changedAt) / H_HUEPF_MS);
          let ga = 1;
          let gs = 0;
          let gk = 0;
          if (g.out) {
            const k = perf - g.outAt;
            if (welt.row(g.row).type === 'fluss') gk = Math.min(1, k / 450);
            else gs = Math.min(1, k / 70);
            ga = k > 1400 ? Math.max(0, 1 - (k - 1400) / 400) : 1;
          }
          const dr = g.row - g.fromRow;
          const dc = g.col - g.fromCol;
          figs.push({
            id: g.id,
            row: g.fromRow + dr * p,
            col: g.fromCol + dc * p,
            lift: Math.sin(Math.PI * p),
            facing: Math.abs(dc) > Math.abs(dr) ? (dc < 0 ? Math.PI / 2 : -Math.PI / 2) : dr < 0 ? Math.PI : 0,
            squash: gs,
            sink: gk,
            alpha: ga,
            color: g.color,
            name: g.name,
            ghost: true,
          });
        }
        figs.push({ id: meId, row: pose.row, col: pose.col, lift, facing: huhn.facing, squash, sink, alpha, color: me?.color ?? '#e53935', ghost: false });
        scene!.render(t, now, pose.row, figs);
        if (perf - lastHud > 200) {
          lastHud = perf;
          const all = [...live.current.values()].map((g) => (g.id === meId ? { ...g, best: huhn.best } : g));
          const platz = ranking(all).findIndex((g) => g.id === meId) + 1;
          setHud((h) => (h.best === huhn.best && h.raus === !!huhn.raus && h.platz === platz ? h : { best: huhn.best, raus: !!huhn.raus, platz }));
        }
      };
      loop();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      scene?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welt, huhn]);

  const now = useServerTime(200);
  const left = Math.max(0, Math.ceil(Math.min(H_DAUER_MS, inner.endAt - now) / 1000));
  const ende = inner.stage === 'ende' || now >= inner.endAt;
  const onStick = (s: StickValue) => {
    const d: Richtung | null = s.mag <= 0 ? null : Math.abs(s.x) > Math.abs(s.y) ? (s.x > 0 ? 'rechts' : 'links') : s.y > 0 ? 'vor' : 'zurueck';
    const st = stick.current;
    if (d && d !== st.dir) {
      wunsch(d);
      st.next = serverNow() + H_TAKT_MS;
    }
    st.dir = d;
  };
  const n = inner.runners.length;
  return (
    <div className="hh-phone">
      <div className="hh-hud">
        <span className={`hh-time ${left <= 5 && !ende ? 'warn' : ''}`}>{ende ? 'Ende' : `${left}s`}</span>
        <span className="hh-stat">Reihe <b>{hud.best}</b></span>
        <span className="hh-stat">Platz <b>{hud.platz}</b>/{n}</span>
      </div>
      <ProgressStrip runners={[...live.current.values()].map((g) => (g.id === meId ? { ...g, best: hud.best } : g))} meId={meId} />
      <div
        className="hh-world"
        onPointerDown={(e) => {
          e.preventDefault();
          wunsch('vor');
        }}
      >
        <canvas ref={canvas} />
        {!loaded && <div className="hh-overlay"><span className="head">Welt wird gebaut …</span></div>}
        {now < inner.startAt + 900 && <div className="hh-overlay"><Countdown startAt={inner.startAt} size="7rem" /></div>}
        {hud.raus && !ende && <div className="hh-raus">Autsch! Gleich geht’s weiter …</div>}
        {ende && (
          <div className="hh-overlay dim">
            <div className="card center" style={{ padding: '14px 22px' }}>
              <h2>Zeit um!</h2>
              <p>Deine weiteste Reihe: <b>{hud.best}</b></p>
            </div>
          </div>
        )}
      </div>
      <div className="hh-pad">
        <Joystick onChange={onStick} size={Math.min(190, Math.max(120, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.42)))} />
        <span className="small muted">Joystick oder auf die Welt tippen = vorwärts</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fortschritt + Hauptscreen                                           */
/* ------------------------------------------------------------------ */

export function ChickenIcon({ color, size = 34, out }: { color: string; size?: number; out?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ opacity: out ? 0.45 : 1, display: 'block' }} aria-hidden>
      <rect x="9" y="15" width="22" height="18" rx="4" fill="#fff" stroke="#333" strokeWidth="1.5" />
      <rect x="13" y="5" width="15" height="14" rx="3" fill="#fff" stroke="#333" strokeWidth="1.5" />
      <rect x="17" y="1" width="6" height="5" rx="1" fill="#e53935" />
      <rect x="27" y="10" width="6" height="4" rx="1" fill="#ff9800" />
      <rect x="22" y="8" width="2.5" height="3" fill="#222" />
      <rect x="11" y="17" width="20" height="4" rx="1.5" fill={color} />
      <rect x="14" y="33" width="3" height="5" fill="#ff9800" />
      <rect x="23" y="33" width="3" height="5" fill="#ff9800" />
    </svg>
  );
}

function ProgressStrip({ runners, meId, big }: { runners: (RunnerView & { out?: boolean })[]; meId?: string; big?: boolean }) {
  const max = Math.max(25, ...runners.map((r) => r.best + 3));
  const size = big ? 56 : 24;
  return (
    <div className={`hh-strip ${big ? 'big' : ''}`}>
      <div className="hh-strip-line" />
      {runners.map((r, i) => (
        <div
          key={r.id}
          className={`hh-strip-chick ${r.id === meId ? 'me' : ''}`}
          style={{ left: `calc(${(Math.max(r.best, r.row) / max) * 100}% * 0.94)`, top: big ? (i % 3) * 22 : (i % 2) * 6, zIndex: r.id === meId ? 5 : 1 }}
          title={r.name}
        >
          <ChickenIcon color={r.color} size={size} out={r.out} />
          {big && <span className="hh-strip-name" style={{ background: r.color }}>{r.name}</span>}
        </div>
      ))}
    </div>
  );
}

export function HuehnerHost({ v, inner, portrait }: { v: HostView; inner: any; portrait?: boolean }) {
  const live = useLiveRunners(inner, null);
  const now = useServerTime(100);
  const runners = [...live.current.values()];
  const left = Math.max(0, inner.endAt - now);
  const secs = Math.ceil(left / 1000);
  const rank = ranking(runners);
  const pct = inner.stage === 'countdown' ? 1 : left / H_DAUER_MS;
  return (
    <div className="stack" style={{ gap: 26, flex: 1, minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '0.9fr 1.4fr', gap: 36, flex: 1, minHeight: 0, alignItems: 'center' }}>
        <div className="stack" style={{ alignItems: 'center', gap: 12 }}>
          <div className={`hh-bigtime ${secs <= 5 && inner.stage === 'laeuft' ? 'warn' : ''}`} style={{ ['--p' as any]: pct }}>
            <span>{inner.stage === 'countdown' ? 30 : inner.stage === 'ende' ? 0 : secs}</span>
          </div>
          <p className="head center" style={{ fontSize: 34 }}>{inner.stage === 'ende' ? 'Zeit um!' : inner.stage === 'countdown' ? 'Gleich geht’s los …' : 'Hüpft so weit ihr könnt!'}</p>
        </div>
        <div className="panel stack" style={{ gap: 10, fontSize: 32, maxHeight: '100%', overflow: 'hidden' }}>
          {rank.map((r, i) => (
            <div key={r.id} className="list-item" style={{ padding: '6px 14px', transition: 'all .3s' }}>
              <b style={{ width: 44 }}>{i + 1}.</b>
              <ChickenIcon color={r.color} size={42} out={r.out} />
              <span className="grow">{r.name}</span>
              <span className="head gold">Reihe {r.best}</span>
            </div>
          ))}
        </div>
      </div>
      <ProgressStrip runners={runners} big />
      {inner.stage === 'countdown' && (
        <div className="hh-host-cd">
          <Countdown startAt={inner.startAt} size="18rem" />
        </div>
      )}
    </div>
  );
}
