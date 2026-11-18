import type { FieldType } from '@kronen/shared';

export function CrownSvg({ size, className, big }: { size?: number | string; className?: string; big?: boolean }) {
  return (
    <svg viewBox="0 0 100 80" width={size} className={className} aria-label={big ? 'Große Krone' : 'Krone'}>
      <defs>
        <linearGradient id={big ? 'cgb' : 'cg'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={big ? '#fff3b0' : '#ffe58a'} />
          <stop offset="0.5" stopColor={big ? '#ffc93c' : '#f2b134'} />
          <stop offset="1" stopColor="#b97a12" />
        </linearGradient>
      </defs>
      <path d="M8 62 L4 18 L28 40 L50 8 L72 40 L96 18 L92 62 Z" fill={`url(#${big ? 'cgb' : 'cg'})`} stroke="#7a4e08" strokeWidth="4" strokeLinejoin="round" />
      <rect x="8" y="58" width="84" height="16" rx="4" fill="#e09a1f" stroke="#7a4e08" strokeWidth="4" />
      <circle cx="50" cy="44" r="7" fill="#c62828" stroke="#7a1010" strokeWidth="2" />
      <circle cx="28" cy="50" r="5" fill="#2e7d32" stroke="#174d1a" strokeWidth="2" />
      <circle cx="72" cy="50" r="5" fill="#1e5bb8" stroke="#0e2f63" strokeWidth="2" />
      <circle cx="4" cy="18" r="5" fill="#fff6e3" stroke="#7a4e08" strokeWidth="2.5" />
      <circle cx="50" cy="8" r="5" fill="#fff6e3" stroke="#7a4e08" strokeWidth="2.5" />
      <circle cx="96" cy="18" r="5" fill="#fff6e3" stroke="#7a4e08" strokeWidth="2.5" />
      <path d="M20 66 h60" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ControllerSvg({ size = '1em' }: { size?: string | number }) {
  return (
    <svg viewBox="0 0 64 40" width={size} aria-label="Minispiel">
      <path d="M14 4 h36 a12 12 0 0 1 12 12 l-2 14 a8 8 0 0 1 -14 3 l-4 -5 h-20 l-4 5 a8 8 0 0 1 -14 -3 l-2 -14 a12 12 0 0 1 12 -12z" fill="#fff6e3" stroke="#3a1d55" strokeWidth="3" />
      <path d="M17 13 v10 M12 18 h10" stroke="#3a1d55" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="15" r="3" fill="#c62828" />
      <circle cx="50" cy="21" r="3" fill="#2e7d32" />
    </svg>
  );
}

export function CircleArrowsSvg({ size = '1em' }: { size?: string | number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} aria-label="Nochmal würfeln">
      <g fill="none" stroke="#2b1a10" strokeWidth="5" strokeLinecap="round">
        <path d="M38 18 A15 15 0 0 0 11 15" />
        <path d="M10 30 A15 15 0 0 0 37 33" />
      </g>
      <path d="M6 9 L12 19 L17 9 Z" fill="#2b1a10" />
      <path d="M42 39 L36 29 L31 39 Z" fill="#2b1a10" />
    </svg>
  );
}

/** Symbol eines Sonderfeldes (nur Anzeige) */
export function FieldIcon({ type, size = '1.4em' }: { type: FieldType; size?: string }) {
  const s = { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: size, lineHeight: 1 } as const;
  switch (type) {
    case 'plus2':
      return <span style={{ ...s, color: '#a5e89a' }}>+2</span>;
    case 'minus2':
      return <span style={{ ...s, color: '#ff9b9b' }}>−2</span>;
    case 'ereignis':
      return <span style={{ ...s, color: '#9cc4ff' }}>?!</span>;
    case 'wiederholung':
      return (
        <span style={{ background: '#f4c430', borderRadius: 8, display: 'inline-flex', padding: 2 }}>
          <CircleArrowsSvg size={size} />
        </span>
      );
    case 'minispiel':
      return (
        <span style={{ background: '#7b3fb5', borderRadius: 8, display: 'inline-flex', padding: 3 }}>
          <ControllerSvg size={size} />
        </span>
      );
    default:
      return null;
  }
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  normal: 'Normales Feld',
  plus2: 'Grünes Feld (+2)',
  minus2: 'Rotes Feld (−2)',
  ereignis: 'Ereignisfeld (?!)',
  wiederholung: 'Gelbes Feld (Kreispfeile)',
  minispiel: 'Minispielfeld',
};

/** Spielfigur als eigenes SVG: Kreisfigur mit Namensanfang */
export function TokenSvg({ color, letter }: { color: string; letter: string }) {
  const light = color.toLowerCase() === '#f5f5f5' || color.toLowerCase() === '#fdd835';
  return (
    <svg viewBox="0 0 60 70" width="100%" height="100%">
      <ellipse cx="30" cy="64" rx="20" ry="5" fill="rgba(0,0,0,0.35)" />
      <path d="M12 60 Q30 40 48 60 Z" fill={color} stroke="#1a0f08" strokeWidth="3" />
      <circle cx="30" cy="28" r="22" fill={color} stroke="#1a0f08" strokeWidth="3.5" />
      <circle cx="23" cy="20" r="6" fill="rgba(255,255,255,0.45)" />
      <text x="30" y="37" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="26" fill={light ? '#1a0f08' : '#fff'} stroke={light ? 'none' : 'rgba(0,0,0,0.4)'} strokeWidth="1">
        {letter}
      </text>
    </svg>
  );
}
