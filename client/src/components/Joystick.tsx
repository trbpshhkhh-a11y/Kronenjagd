import { useEffect, useRef, useState } from 'react';

export interface StickValue {
  /** Winkel in Radiant: 0 = rechts, π/2 = oben (mathematisch, Bildschirm-Oben = +y) */
  angle: number;
  /** Auslenkung 0–1 (nach Abzug der Totzone) */
  mag: number;
  /** Rohwerte -1..1 (x nach rechts, y nach oben) */
  x: number;
  y: number;
}

export const STICK_REST: StickValue = { angle: 0, mag: 0, x: 0, y: 0 };
export const TOTZONE = 0.15;

/** Kurzes Vibrieren, wo das Gerät es unterstützt */
export function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nicht unterstützt */
  }
}

/**
 * Virtueller Joystick (Basis-Kreis + Knopf) für den Daumen.
 * Folgt nur dem Finger, der ihn berührt hat (multi-touch-sicher), und liefert
 * Winkel + Auslenkung mit Totzone. Kein Scrollen/Zoomen/Markieren auf der Fläche.
 */
export function Joystick({ onChange, size = 170, label, style, className = '' }: {
  onChange: (v: StickValue) => void;
  size?: number;
  label?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const cb = useRef(onChange);
  cb.current = onChange;

  const update = (clientX: number, clientY: number) => {
    const r = base.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = r.width / 2;
    let dx = (clientX - cx) / radius;
    let dy = (cy - clientY) / radius; // nach oben positiv
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const l = Math.min(1, len);
    setKnob({ x: dx, y: dy, active: true });
    const mag = l <= TOTZONE ? 0 : (l - TOTZONE) / (1 - TOTZONE);
    cb.current({ angle: Math.atan2(dy, dx), mag, x: dx, y: dy });
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0, active: false });
    cb.current(STICK_REST);
  };

  // Fenster-weit: kein Zurück-Wischen / Scrollen, solange der Joystick gehalten wird
  useEffect(() => {
    const el = base.current!;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, []);

  return (
    <div
      ref={base}
      className={`joystick ${knob.active ? 'active' : ''} ${className}`}
      style={{ width: size, height: size, ...style }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        vibrate(8);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointer.current) return;
        update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => e.pointerId === pointer.current && release()}
      onPointerCancel={(e) => e.pointerId === pointer.current && release()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="joystick-ring" />
      <div className="joystick-knob" style={{ transform: `translate(calc(-50% + ${knob.x * size * 0.32}px), calc(-50% + ${-knob.y * size * 0.32}px))` }} />
      {label && <span className="joystick-label">{label}</span>}
    </div>
  );
}

/** Seite für ein Echtzeit-Spiel sperren: kein Scrollen, Zoomen, Markieren, Zurück-Wischen */
export function useGameLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior, touch: document.body.style.touchAction, select: document.body.style.userSelect };
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', block);
    document.addEventListener('dblclick', block);
    return () => {
      html.style.overflow = prev.overflow;
      html.style.overscrollBehavior = prev.overscroll;
      document.body.style.touchAction = prev.touch;
      document.body.style.userSelect = prev.select;
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('dblclick', block);
    };
  }, [active]);
}
