import { useEffect, useRef } from 'react';
import type { Stroke } from '@kronen/shared';

/** Live-Striche vom Server (Montagsmaler). Die Verbindung speist sie hier ein. */
export const strokeBus = new Set<(s: Stroke) => void>();
export const emitStroke = (s: Stroke) => strokeBus.forEach((f) => f(s));

/**
 * Zeichnung anzeigen: voller Stand aus der Ansicht + Live-Striche dazwischen.
 * Wird auf dem Hauptscreen und – ohne Hauptscreen – auf den Handys genutzt.
 */
export function LiveDrawing({ strokes, resetKey, style }: { strokes: Stroke[]; resetKey?: unknown; style?: React.CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const local = useRef<Map<number, Stroke>>(new Map());
  const redraw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of local.current.values()) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = (s.w * c.width) / 1000;
      ctx.beginPath();
      for (let i = 0; i < s.pts.length; i += 2) {
        const x = (s.pts[i] / 1000) * c.width;
        const y = (s.pts[i + 1] / 1000) * c.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (s.pts.length === 2) ctx.lineTo((s.pts[0] / 1000) * c.width + 0.1, (s.pts[1] / 1000) * c.height);
      ctx.stroke();
    }
  };
  // voller Zustand (z. B. nach Wiederverbinden, Löschen oder neuem Begriff)
  const sig = JSON.stringify(strokes.map((s) => [s.id, s.pts.length]));
  useEffect(() => {
    local.current = new Map(strokes.map((s) => [s.id, { ...s, pts: [...s.pts] }]));
    redraw();
  }, [sig, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (s: Stroke) => {
      const ex = local.current.get(s.id);
      if (ex) ex.pts.push(...s.pts);
      else local.current.set(s.id, { ...s, pts: [...s.pts] });
      redraw();
    };
    strokeBus.add(on);
    return () => void strokeBus.delete(on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} width={1200} height={900} style={{ background: '#fffdf6', borderRadius: 14, border: '4px solid var(--wood-900)', width: '100%', aspectRatio: '4 / 3', display: 'block', ...style }} />;
}
