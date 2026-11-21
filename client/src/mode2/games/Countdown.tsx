import { useEffect, useState } from 'react';
import { serverNow } from '../../lib/clock';

/** Aktuelle Serverzeit, ca. 10× pro Sekunde (für Countdown/Animationen) */
export function useServerTime(interval = 100) {
  const [t, setT] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setT(serverNow()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return t;
}

/**
 * 3-2-1-Countdown auf einen gemeinsamen Startzeitpunkt (Serverzeit).
 * Alle Geräte zeigen dank Uhr-Abgleich gleichzeitig dieselbe Zahl.
 */
export function Countdown({ startAt, size = '9rem', go = 'Los!' }: { startAt: number; size?: string; go?: string }) {
  const now = useServerTime(50);
  const left = startAt - now;
  if (left < -800) return null;
  const n = Math.ceil(left / 1000);
  const text = left > 0 ? String(Math.min(3, n)) : go;
  return (
    <div className="countdown" style={{ fontSize: size }} key={text}>
      {text}
    </div>
  );
}
