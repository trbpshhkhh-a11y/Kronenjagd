import { useEffect, useState } from 'react';

/**
 * Server für Modus 2. Standard: gleicher Host wie die Seite.
 * Für eine statische Seite (z. B. GitHub Pages) kann beim Bauen VITE_SERVER_URL gesetzt werden.
 */
const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');

export function httpBase(): string {
  return configured ?? '';
}

export function wsUrl(): string {
  if (configured) return configured.replace(/^http/, 'ws') + '/ws';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

let cache: Promise<boolean> | null = null;

export function checkServer(): Promise<boolean> {
  if (!cache) {
    cache = (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const r = await fetch(httpBase() + '/api/health', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) return false;
        const j = await r.json();
        return j?.ok === true;
      } catch {
        return false;
      }
    })();
    cache.then((ok) => {
      if (!ok) setTimeout(() => (cache = null), 5000);
    });
  }
  return cache;
}

export function useServerAvailable(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    checkServer().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}
