import { useEffect, useRef, useState } from 'react';
import { vibrate } from './Joystick';

export type Pfeil = 'vor' | 'zurueck' | 'links' | 'rechts';

const DREHUNG: Record<Pfeil, number> = { vor: 0, rechts: 90, zurueck: 180, links: -90 };
const LABEL: Record<Pfeil, string> = { vor: 'nach vorne', zurueck: 'zurück', links: 'nach links', rechts: 'nach rechts' };

/**
 * Pfeiltasten (vor, links, rechts, zurück) für den Daumen.
 * onDown beim Drücken, onUp beim Loslassen – mehrere Finger gleichzeitig sind erlaubt.
 */
export function ArrowPad({ onDown, onUp }: { onDown: (p: Pfeil) => void; onUp: (p: Pfeil) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<Pfeil[]>([]);
  const pointers = useRef(new Map<number, Pfeil>());
  const cb = useRef({ onDown, onUp });
  cb.current = { onDown, onUp };

  // kein Scrollen, Zoomen oder Markieren auf den Tasten
  useEffect(() => {
    const el = box.current!;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, []);

  const release = (id: number) => {
    const p = pointers.current.get(id);
    if (!p) return;
    pointers.current.delete(id);
    setPressed([...pointers.current.values()]);
    cb.current.onUp(p);
  };

  const key = (p: Pfeil) => (
    <button
      key={p}
      type="button"
      className={`ap-key ap-${p} ${pressed.includes(p) ? 'down' : ''}`}
      aria-label={LABEL[p]}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, p);
        setPressed([...pointers.current.values()]);
        vibrate(8);
        cb.current.onDown(p);
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 40 40" aria-hidden style={{ transform: `rotate(${DREHUNG[p]}deg)` }}>
        <path d="M20 7 L34 25 L25 25 L25 33 L15 33 L15 25 L6 25 Z" fill="currentColor" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div ref={box} className="ap">
      {key('vor')}
      {key('links')}
      {key('rechts')}
      {key('zurueck')}
    </div>
  );
}
