/**
 * Die Barrikade: ein länglicher Felsbrocken mit Stacheln obendrauf (wie das 3D-Druckteil).
 * BarrikadeOben = Draufsicht für das Brett (wird quer zur Strecke gedreht),
 * BarrikadeSeite = Seitenansicht für die Ereigniskarte.
 */
const FELS = '#7a6e64';
const FELS_HELL = '#a3978b';
const FELS_DUNKEL = '#4a413a';

/** Draufsicht: Felsbalken, Stacheln als silberne Spitzen nach beiden Seiten */
export function BarrikadeOben({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const xs = [14, 29, 43, 57, 71, 86];
  return (
    <svg viewBox="0 0 100 44" className={className} style={style} aria-hidden>
      {xs.map((x) => (
        <g key={x}>
          <path d={`M${x - 6} 13 L${x} 0.5 L${x + 6} 13 Z`} fill="#eef2f4" stroke="#2a2e33" strokeWidth="1.8" strokeLinejoin="round" />
          <path d={`M${x - 6} 31 L${x} 43.5 L${x + 6} 31 Z`} fill="#c3c9ce" stroke="#2a2e33" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
      ))}
      <path d="M5 15 Q2 22 5 29 Q11 35 24 34 L40 35 Q50 36 62 34 L78 35 Q93 35 96 28 Q98 22 95 15 Q90 9 76 10 L58 9 Q48 8 36 10 L22 9 Q9 9 5 15 Z" fill={FELS} stroke="#2b2420" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M11 15 Q20 12 34 13 L56 12 Q72 12 89 14" fill="none" stroke={FELS_HELL} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 19 l4 6 l-2 4 M64 17 l-3 7 l3 3 M47 25 l5 2" fill="none" stroke={FELS_DUNKEL} strokeWidth="1.6" strokeLinecap="round" />
      {xs.map((x) => (
        <circle key={x} cx={x} cy="22" r="3.8" fill="#e3e7ea" stroke="#2a2e33" strokeWidth="1.4" />
      ))}
    </svg>
  );
}

/** Seitenansicht: Felsbrocken mit Stacheln nach oben */
export function BarrikadeSeite({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const spikes: [number, number][] = [[18, 9], [33, 4], [50, 2], [67, 5], [82, 10]];
  return (
    <svg viewBox="0 0 100 64" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id="bk-stachel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c9d0d6" />
          <stop offset="1" stopColor="#7b848c" />
        </linearGradient>
        <linearGradient id="bk-fels" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FELS_HELL} />
          <stop offset="0.55" stopColor={FELS} />
          <stop offset="1" stopColor={FELS_DUNKEL} />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="46" ry="3.5" fill="rgba(0,0,0,0.25)" />
      {spikes.map(([x, top]) => (
        <path key={x} d={`M${x - 6} 38 L${x} ${top} L${x + 6} 38 Z`} fill="url(#bk-stachel)" stroke="#3a3f44" strokeWidth="1.6" strokeLinejoin="round" />
      ))}
      <path d="M5 50 Q3 40 10 35 Q18 31 30 33 Q40 30 52 32 Q64 29 76 33 Q90 32 95 39 Q98 47 94 54 Q88 59 70 58 L30 59 Q10 59 5 50 Z" fill="url(#bk-fels)" stroke={FELS_DUNKEL} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12 39 Q24 35 38 37 M56 36 Q70 34 86 38" fill="none" stroke="#c4b9ad" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28 44 l5 6 l-2 5 M66 42 l-4 7 l4 4 M48 48 l5 2" fill="none" stroke={FELS_DUNKEL} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
