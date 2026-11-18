import { useEffect, useRef, useState } from 'react';

const COLORS = ['#222222', '#c62828', '#1e5bb8', '#2e7d32', '#f2b134', '#7b3fb5'];

/** Zeichenfläche (Touch). Striche werden in Stücken an den Server geschickt (Koordinaten 0..1000). */
export function DrawCanvas({ onStroke, onClear }: { onStroke: (s: { id: number; pts: number[]; color: string; w: number }) => void; onClear: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [w, setW] = useState(10);
  const st = useRef({ drawing: false, id: Math.floor(Math.random() * 1e6), buf: [] as number[], last: null as null | [number, number], timer: 0 as any });

  useEffect(() => {
    const c = ref.current!;
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * 2;
      c.height = r.height * 2;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fffdf6';
      ctx.fillRect(0, 0, c.width, c.height);
    };
    resize();
  }, []);

  const flush = () => {
    const s = st.current;
    if (s.buf.length) {
      onStroke({ id: s.id, pts: s.buf, color, w });
      s.buf = [];
    }
  };

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)].map((n) => Math.max(0, Math.min(1000, n))) as [number, number];
  };

  const draw = (a: [number, number], b: [number, number]) => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = (w * c.width) / 1000;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((a[0] / 1000) * c.width, (a[1] / 1000) * c.height);
    ctx.lineTo((b[0] / 1000) * c.width + 0.01, (b[1] / 1000) * c.height);
    ctx.stroke();
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <canvas
        ref={ref}
        className="draw-canvas"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const s = st.current;
          s.drawing = true;
          s.id++;
          const p = pos(e);
          s.last = p;
          s.buf.push(...p);
          draw(p, p);
          s.timer = setInterval(flush, 70);
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!s.drawing || !s.last) return;
          const p = pos(e);
          if (Math.abs(p[0] - s.last[0]) + Math.abs(p[1] - s.last[1]) < 4) return;
          draw(s.last, p);
          s.last = p;
          s.buf.push(...p);
          if (s.buf.length > 300) flush();
        }}
        onPointerUp={() => {
          const s = st.current;
          s.drawing = false;
          clearInterval(s.timer);
          flush();
        }}
        onPointerCancel={() => {
          st.current.drawing = false;
          clearInterval(st.current.timer);
          flush();
        }}
      />
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          {COLORS.map((c) => (
            <button key={c} aria-label="Farbe" onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: color === c ? '4px solid #ffd970' : '2px solid #000' }} />
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className={`btn sm ${w === 10 ? 'gold' : ''}`} onClick={() => setW(10)}>dünn</button>
          <button className={`btn sm ${w === 24 ? 'gold' : ''}`} onClick={() => setW(24)}>dick</button>
          <button className="btn sm red" onClick={() => {
            const c = ref.current!;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = '#fffdf6';
            ctx.fillRect(0, 0, c.width, c.height);
            onClear();
          }}>🗑</button>
        </div>
      </div>
    </div>
  );
}
