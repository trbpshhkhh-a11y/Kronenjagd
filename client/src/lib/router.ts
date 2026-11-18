import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q] = h.split('?');
  return { path: path || '/', query: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string) {
  location.hash = '#' + path;
}

/** Absolute URL zu einer Hash-Route (für QR-Codes) */
export function absoluteUrl(hashPath: string): string {
  return location.origin + location.pathname + '#' + hashPath;
}
