import { ReactNode, useEffect, useRef, useState } from 'react';
import { BOARD, FieldType } from '@kronen/shared';
import { FieldIcon } from './icons';

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 1200 } : undefined} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ text, onYes, onNo, yes = 'Ja', no = 'Abbrechen' }: { text: string; onYes: () => void; onNo: () => void; yes?: string; no?: string }) {
  return (
    <Modal onClose={onNo}>
      <div className="card stack center">
        <h2>{text}</h2>
        <div className="row center">
          <button className="btn red big" onClick={onYes}>{yes}</button>
          <button className="btn big" onClick={onNo}>{no}</button>
        </div>
      </div>
    </Modal>
  );
}

/** Feldnummer in der Optik der Brettfelder (+ Symbol des Sonderfeldes, nur Anzeige) */
export function FieldBadge({ n, size = '', showIcon = true }: { n: number; size?: '' | 'lg' | 'xl'; showIcon?: boolean }) {
  const type: FieldType = BOARD.byId.get(n)?.type ?? 'normal';
  return (
    <span className="field-with-icon">
      <span className={`field ${size} ${type}`}>{n}</span>
      {showIcon && type !== 'normal' && <FieldIcon type={type} size={size === 'xl' ? '3.2em' : size === 'lg' ? '2.2em' : '1.3em'} />}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <span className="stepper">
      <button className="btn sm" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="weniger">−</button>
      <span className="val">{value}</span>
      <button className="btn sm" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="mehr">+</button>
    </span>
  );
}

export function Dot({ color, letter }: { color: string; letter?: string }) {
  return <span className="dot" style={{ background: color }}>{letter}</span>;
}

/** Würfel mit Augen */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Die({ value, rolling, size = '3em' }: { value: number; rolling?: boolean; size?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!rolling) return setShown(value);
    const id = setInterval(() => setShown(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(id);
  }, [rolling, value]);
  return (
    <div className={`die ${rolling ? 'rolling' : ''}`} style={{ fontSize: size }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[shown]?.includes(i) ? 'pip' : ''} />
      ))}
    </div>
  );
}

/** Timer als Ring */
export function TimerRing({ left, total, size = 160 }: { left: number; total: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const warn = left <= 5;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,0,0,0.35)" strokeWidth="12" fill="rgba(0,0,0,0.25)" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={warn ? '#ff6b6b' : '#f2b134'} strokeWidth="12" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
      </svg>
      <span className={`ring-label ${warn ? 'timer warn' : ''}`} style={{ fontSize: size * 0.36 }}>{left}</span>
    </div>
  );
}

/** "Zum Aufdecken gedrückt halten" */
export function HoldReveal({ children, label = 'Zum Aufdecken gedrückt halten' }: { children: ReactNode; label?: string }) {
  const [down, setDown] = useState(false);
  return (
    <div
      className="hold card center secret-box"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setDown(true);
      }}
      onPointerUp={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: 'pointer', background: down ? undefined : 'linear-gradient(180deg,#3b2112,#2a170c)', color: down ? undefined : 'var(--cream)' }}
    >
      {down ? children : <span className="head" style={{ fontSize: '1.3em' }}>🤫 {label}</span>}
    </div>
  );
}

/** Ein Element, das kurz pulsiert, wenn sich value ändert */
export function usePulse(value: unknown) {
  const [p, setP] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setP(true);
    const t = setTimeout(() => setP(false), 500);
    return () => clearTimeout(t);
  }, [value]);
  return p;
}
