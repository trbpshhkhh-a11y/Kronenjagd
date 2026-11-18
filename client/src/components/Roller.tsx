import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Slot-Machine-Effekt: zeigt schnell wechselnde Werte, wird langsamer und
 * bleibt auf `final` stehen. onDone wird danach aufgerufen.
 */
export function SlotRoller<T>({
  options, final, render, duration = 2200, onDone, className = '', style,
}: {
  options: T[];
  final: T;
  render: (v: T) => ReactNode;
  duration?: number;
  onDone?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [cur, setCur] = useState<T>(options[0] ?? final);
  const [done, setDone] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || options.length < 2) {
      setCur(final);
      setDone(true);
      doneRef.current?.();
      return;
    }
    let t = 0;
    let delay = 50;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      t += delay;
      if (t >= duration) {
        setCur(final);
        setDone(true);
        doneRef.current?.();
        return;
      }
      i = (i + 1 + Math.floor(Math.random() * 2)) % options.length;
      setCur(options[i]);
      delay = 50 + Math.pow(t / duration, 2.2) * 320;
      timer = setTimeout(step, delay);
    };
    timer = setTimeout(step, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final]);
  return (
    <div className={`slot ${done ? 'done' : ''} ${className}`} style={style}>
      <div className="slot-text">{render(cur)}</div>
    </div>
  );
}

export const FIELD_NUMBERS = Array.from({ length: 76 }, (_, i) => i + 1);
