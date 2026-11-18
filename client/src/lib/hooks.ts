import { useEffect, useRef, useState } from 'react';

/** Aktuelle Zeit, die regelmäßig neu rendert */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Countdown-Timer (lokal, Modus 1) */
export function useCountdown(seconds: number) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const now = useNow(200);
  const left = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : pausedLeft ?? seconds;
  return {
    left,
    running: endAt !== null && left > 0,
    finished: endAt !== null && left === 0,
    start: () => {
      setEndAt(Date.now() + (pausedLeft ?? seconds) * 1000);
      setPausedLeft(null);
    },
    pause: () => {
      if (endAt) setPausedLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setEndAt(null);
    },
    reset: () => {
      setEndAt(null);
      setPausedLeft(null);
    },
  };
}

/** Bildschirm wach halten (Wake Lock), soweit möglich */
export function useWakeLock(active = true) {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as any;
    if (!nav.wakeLock) return;
    let cancelled = false;
    const req = async () => {
      try {
        ref.current = await nav.wakeLock.request('screen');
      } catch {
        /* nicht erlaubt */
      }
    };
    req();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) req();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      ref.current?.release?.().catch(() => {});
    };
  }, [active]);
}

/** Server-Zeitversatz berechnen und Restzeit liefern */
export function useServerClock(serverNow: number | undefined) {
  const offset = useRef(0);
  useEffect(() => {
    if (serverNow) offset.current = serverNow - Date.now();
  }, [serverNow]);
  const now = useNow(200);
  return now + offset.current;
}

export function useLatest<T>(value: T) {
  const r = useRef(value);
  r.current = value;
  return r;
}
