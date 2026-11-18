import { useEffect, useRef } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Dezent fallender Schnee (Canvas, wenige Flocken, läuft flüssig auch auf älteren Geräten) */
export function Snow({ count = 45, edgeOnly = false }: { count?: number; edgeOnly?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced()) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const xFor = () => {
      if (!edgeOnly) return Math.random() * w;
      const band = w * 0.12;
      return Math.random() < 0.5 ? Math.random() * band : w - Math.random() * band;
    };
    const flakes = Array.from({ length: count }, () => ({ x: xFor(), y: Math.random() * h, r: 1 + Math.random() * 2.6, s: 0.3 + Math.random() * 0.8, d: Math.random() * Math.PI * 2 }));
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(50, t - last) / 16.7;
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const f of flakes) {
        f.y += f.s * dt;
        f.d += 0.01 * dt;
        f.x += Math.sin(f.d) * 0.3 * dt;
        if (f.y > h + 5) {
          f.y = -5;
          f.x = xFor();
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [count, edgeOnly]);
  return <canvas ref={ref} className="snow-canvas" style={{ width: '100%', height: '100%' }} aria-hidden />;
}

/** Lichterkette am oberen Rand */
export function Lights({ n = 18 }: { n?: number }) {
  return (
    <div className="lights" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="bulb" />
      ))}
    </div>
  );
}

/** Konfetti / Glitzer-Explosion */
export function Confetti({ duration = 4000, gold = false }: { duration?: number; gold?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced()) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const w = (c.width = c.clientWidth);
    const h = (c.height = c.clientHeight);
    const colors = gold ? ['#ffd970', '#f2b134', '#fff6e3', '#ffe9a8'] : ['#c62828', '#2e7d32', '#f2b134', '#1e5bb8', '#fff6e3', '#7b3fb5'];
    const parts = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -6 - Math.random() * 14,
      s: 5 + Math.random() * 7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const life = (t - start) / duration;
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (life < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [duration, gold]);
  return <canvas ref={ref} className="confetti-canvas" style={{ width: '100%', height: '100%' }} aria-hidden />;
}
