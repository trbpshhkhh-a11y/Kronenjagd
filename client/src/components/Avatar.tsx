/**
 * Selbst gestaltete Spielfiguren: Porträt (rund) und Spielfigur fürs Brett.
 * Alles als SVG – gestochen scharf in jeder Größe.
 */
import { useId } from 'react';
import type { Avatar } from '@kronen/shared';

export const HAUT = ['#fde3cf', '#f6c7a1', '#e2a678', '#c98c5c', '#9b623e', '#6c4228'];
export const HAAR = ['#2b1d14', '#5b3a22', '#8e3b1e', '#d9a44c', '#f0d98e', '#9a9a9a', '#eeeeee', '#e45d9c'];

const INK = '#2b1a10';
const LINE = 'rgba(43,26,16,0.55)';

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f)));
  return `#${((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1)}`;
}

/* ------------------------------ Haare ------------------------------ */

function HaarHinten({ a, hc }: { a: Avatar; hc: string }) {
  const s = { fill: hc, stroke: LINE, strokeWidth: 1.4 };
  switch (a.frisur) {
    case 2: // lang
      return <path {...s} d="M27,50 C25,29 38,22 50,22 C62,22 75,29 73,50 L76,84 C69,90 61,88 58,83 L42,83 C39,88 31,90 24,84 Z" />;
    case 3: // Zöpfe
      return (
        <g>
          <circle {...s} cx="22" cy="60" r="9" />
          <circle {...s} cx="78" cy="60" r="9" />
          <circle cx="27" cy="54" r="2.6" fill="#e53935" />
          <circle cx="73" cy="54" r="2.6" fill="#e53935" />
        </g>
      );
    case 4: // Locken: Volumen
      return (
        <g {...s}>
          <circle cx="26" cy="54" r="8" />
          <circle cx="74" cy="54" r="8" />
          <circle cx="27" cy="44" r="8" />
          <circle cx="73" cy="44" r="8" />
        </g>
      );
    case 5: // Dutt
      return <circle {...s} cx="50" cy="22" r="9" />;
    default:
      return null;
  }
}

function HaarVorne({ a, hc }: { a: Avatar; hc: string }) {
  const s = { fill: hc, stroke: LINE, strokeWidth: 1.4, strokeLinejoin: 'round' as const };
  const glanz = <path d="M38,30 C42,27 47,26 52,26" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  switch (a.frisur) {
    case 0:
      return (
        <g>
          <path {...s} d="M28.5,52 C27,31 39,24 50,24 C62,24 73,31 71.5,52 C69,43 64,38 57,37 C50,40 39,40 33,38 C30,42 29,47 28.5,52 Z" />
          {glanz}
        </g>
      );
    case 1:
      return (
        <g>
          <path {...s} d="M28,52 C26,39 29,31 34,30 L32,21 L40,27 L42,18 L48,26 L53,17 L56,26 L63,19 L63,28 L70,24 L68,33 C73,38 73,46 72,52 C69,44 64,39 56,39 C48,42 38,41 32,40 C30,44 29,48 28,52 Z" />
          {glanz}
        </g>
      );
    case 2:
      return (
        <g>
          <path {...s} d="M28.5,52 C28,33 38,25 50,25 C62,25 72,33 71.5,52 C68,41 61,35 52,35 C44,35 34,40 28.5,52 Z" />
          {glanz}
        </g>
      );
    case 3:
      return (
        <g>
          <path {...s} d="M28.5,52 C27,32 39,25 50,25 C61,25 73,32 71.5,52 C69,41 62,35 52,35 L50,38 L48,35 C38,35 31,41 28.5,52 Z" />
          {glanz}
        </g>
      );
    case 4:
      return (
        <g {...s}>
          {[[31, 44], [31, 36], [36, 29], [43, 25], [50, 23], [57, 25], [64, 29], [69, 36], [69, 44]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6.8" />
          ))}
        </g>
      );
    case 5:
      return (
        <g>
          <path {...s} d="M28.5,50 C28,32 39,26 50,26 C61,26 72,32 71.5,50 C68,40 60,35 50,35 C40,35 32,40 28.5,50 Z" />
          {glanz}
        </g>
      );
    case 6: // Glatze: Glanzpunkt
      return <ellipse cx="42" cy="33" rx="6" ry="3" fill="rgba(255,255,255,0.35)" />;
    case 7:
      return (
        <g>
          <path {...s} d="M28.5,52 C27,30 40,23 52,23 C64,23 74,31 71.5,50 C66,38 58,33 46,33 C41,37 36,42 33,47 C31,48 29.5,50 28.5,52 Z" />
          {glanz}
        </g>
      );
    default:
      return null;
  }
}

/* ------------------------------ Gesicht ------------------------------ */

function Augen({ a, brauen }: { a: Avatar; brauen: string }) {
  const dot = (x: number) => (
    <g key={x}>
      <ellipse cx={x} cy="52" rx="2.6" ry="3.2" fill={INK} />
      <circle cx={x + 0.9} cy="50.8" r="0.9" fill="#fff" />
    </g>
  );
  const arc = (x: number) => <path key={x} d={`M${x - 3.5},53 Q${x},48.5 ${x + 3.5},53`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />;
  let eyes;
  switch (a.augen) {
    case 1:
      eyes = [42, 58].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="52" rx="4.6" ry="5.2" fill="#fff" stroke={INK} strokeWidth="0.9" />
          <circle cx={x} cy="53" r="2.7" fill={INK} />
          <circle cx={x + 1} cy="51.6" r="1" fill="#fff" />
        </g>
      ));
      break;
    case 2:
      eyes = [arc(42), arc(58)];
      break;
    case 3:
      eyes = [dot(42), arc(58)];
      break;
    case 4:
      eyes = [42, 58].map((x) => (
        <g key={x}>
          <path d={`M${x - 3.6},51.5 Q${x},55 ${x + 3.6},51.5`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M${x - 3},53 l-1.4,1.4 M${x + 3},53 l1.4,1.4`} stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
        </g>
      ));
      break;
    default:
      eyes = [dot(42), dot(58)];
  }
  return (
    <g>
      <path d="M38.5,46.2 Q42,44 45.5,46" stroke={brauen} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M54.5,46 Q58,44 61.5,46.2" stroke={brauen} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {eyes}
    </g>
  );
}

function Mund({ a }: { a: Avatar }) {
  switch (a.mund) {
    case 1:
      return (
        <g>
          <path d="M43,62 Q50,62.5 57,62 Q56,70.5 50,70.5 Q44,70.5 43,62 Z" fill="#7a1f1f" />
          <path d="M44.2,62.4 Q50,63 55.8,62.4 L55.3,64.4 Q50,65 44.7,64.4 Z" fill="#fff" />
        </g>
      );
    case 2:
      return (
        <g>
          <path d="M47,65 Q50,72 53,65 Z" fill="#f06292" stroke="#c2185b" strokeWidth="0.6" />
          <path d="M44,63.5 Q50,68 56,63.5" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 3:
      return <ellipse cx="50" cy="65.5" rx="2.8" ry="3.4" fill="#7a1f1f" />;
    case 4:
      return <path d="M45,64.5 Q51,66.5 56.5,61.5" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />;
    default:
      return <path d="M44,63 Q50,68.5 56,63" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
}

function Extra({ a }: { a: Avatar }) {
  switch (a.extra) {
    case 1:
      return (
        <g fill="rgba(255,255,255,0.18)" stroke="#3b2a1a" strokeWidth="1.8">
          <circle cx="42" cy="52" r="6.4" />
          <circle cx="58" cy="52" r="6.4" />
          <path d="M48.4,51.5 Q50,50 51.6,51.5 M35.6,51 L30,49.5 M64.4,51 L70,49.5" fill="none" />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x="34.5" y="47.5" width="14" height="9" rx="3.5" fill="#1d1d1d" />
          <rect x="51.5" y="47.5" width="14" height="9" rx="3.5" fill="#1d1d1d" />
          <path d="M48.5,50.5 L51.5,50.5 M34.5,50 L30,49 M65.5,50 L70,49" stroke="#1d1d1d" strokeWidth="1.8" />
          <path d="M37,49.5 L41,49.5 M54,49.5 L58,49.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 3:
      return (
        <g fill="#f4f4f4" stroke="rgba(0,0,0,0.18)" strokeWidth="1">
          <path d="M29.5,56 C29,74 39,87 50,87 C61,87 71,74 70.5,56 C67,63 61,66 56,64.5 C53,67 47,67 44,64.5 C39,66 33,63 29.5,56 Z" />
          <path d="M39.5,62.5 C43.5,58.5 48,60 50,62 C52,60 56.5,58.5 60.5,62.5 C56.5,66.5 52.5,64.5 50,63.5 C47.5,64.5 43.5,66.5 39.5,62.5 Z" />
        </g>
      );
    case 4:
      return (
        <g>
          <circle cx="50" cy="58" r="4.6" fill="#e53935" stroke="#9a1b18" strokeWidth="0.8" />
          <circle cx="48.6" cy="56.6" r="1.4" fill="rgba(255,255,255,0.7)" />
        </g>
      );
    case 5:
      return (
        <g>
          <circle cx="36.5" cy="61" r="4.2" fill="#ff8a8a" opacity="0.55" />
          <circle cx="63.5" cy="61" r="4.2" fill="#ff8a8a" opacity="0.55" />
          {[[34, 58.5], [37.5, 59.5], [35.5, 61.5], [62.5, 58.5], [66, 59.5], [64, 61.5]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.7" fill="#8d5a3b" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

/* ------------------------------ Kopfbedeckung ------------------------------ */

function Kopf({ a }: { a: Avatar }) {
  switch (a.kopf) {
    case 1: // Weihnachtsmütze
      return (
        <g stroke={LINE} strokeWidth="1.3">
          <path d="M27,36 C28,20 40,11 55,10 C67,9 77,17 82,30 L72,33 C67,26 61,24 55,25 C44,26 34,30 27,36 Z" fill="#d62828" />
          <path d="M40,18 C46,14 53,13 58,13" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <rect x="24" y="32" width="52" height="9.5" rx="4.75" fill="#fbfbfb" />
          <circle cx="82.5" cy="31" r="5.8" fill="#fbfbfb" />
        </g>
      );
    case 2: // Krone
      return (
        <g stroke="#7a4e08" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M32,34 L30,15 L40,24 L50,11 L60,24 L70,15 L68,34 Z" fill="#f6c23e" />
          <rect x="31" y="30" width="38" height="7" rx="2" fill="#e09a1f" />
          <circle cx="50" cy="25" r="2.6" fill="#c62828" stroke="none" />
          <circle cx="40" cy="28" r="1.8" fill="#2e7d32" stroke="none" />
          <circle cx="60" cy="28" r="1.8" fill="#1e5bb8" stroke="none" />
        </g>
      );
    case 3: // Rentiergeweih
      return (
        <g stroke="#6d4325" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <path d="M29,40 Q50,22 71,40" stroke="#4e2f1a" strokeWidth="3" />
          <path d="M35,32 L29,17 M30.5,21 L23,16 M29,17 L30,8 M32.5,26 L38,19" />
          <path d="M65,32 L71,17 M69.5,21 L77,16 M71,17 L70,8 M67.5,26 L62,19" />
        </g>
      );
    case 4: // Elfenmütze
      return (
        <g stroke={LINE} strokeWidth="1.3">
          <path d="M28,37 C33,21 49,9 72,3 C65,15 63,26 72,37 Z" fill="#2e9d48" />
          <path d="M26,33 L74,33 L74,40 L26,40 Z" fill="#d62828" />
          <path d="M26,40 L30,44 L34,40 L38,44 L42,40 L46,44 L50,40 L54,44 L58,40 L62,44 L66,40 L70,44 L74,40" fill="#d62828" />
          <circle cx="72" cy="4" r="3.4" fill="#f6c23e" />
        </g>
      );
    case 5: // Pudelmütze
      return (
        <g stroke={LINE} strokeWidth="1.3">
          <path d="M27,40 C27,22 38,16 50,16 C62,16 73,22 73,40 Z" fill="#2a8c8c" />
          <path d="M29,28 L71,28" stroke="#fff" strokeWidth="3" />
          <path d="M28,33.5 L72,33.5" stroke="#fff" strokeWidth="2" />
          <rect x="25" y="35" width="50" height="8" rx="4" fill="#1f6b6b" />
          <circle cx="50" cy="14" r="6.5" fill="#fbfbfb" />
        </g>
      );
    case 6: // Ohrenschützer
      return (
        <g>
          <path d="M27,52 C27,24 73,24 73,52" stroke="#c62828" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="27.5" cy="54" r="7.5" fill="#fbfbfb" stroke="#f48fb1" strokeWidth="2" />
          <circle cx="72.5" cy="54" r="7.5" fill="#fbfbfb" stroke="#f48fb1" strokeWidth="2" />
        </g>
      );
    case 7: // Schleife
      return (
        <g stroke="#9a1b18" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M64,30 L51,21 L53,38 Z" fill="#e53935" />
          <path d="M64,30 L77,21 L75,38 Z" fill="#e53935" />
          <circle cx="64" cy="30" r="3.6" fill="#c62828" />
        </g>
      );
    default:
      return null;
  }
}

/** Kopf mit Haaren, Gesicht und Kopfbedeckung (Koordinaten 0–100, Kopfmitte bei 50/52) */
function KopfTeile({ a }: { a: Avatar }) {
  const skin = HAUT[a.haut] ?? HAUT[1];
  const hc = HAAR[a.haar] ?? HAAR[1];
  const brauen = a.frisur === 6 ? shade(skin, -0.45) : shade(hc, -0.15);
  const bartUnterMund = a.extra === 3;
  return (
    <g>
      <HaarHinten a={a} hc={hc} />
      <circle cx="29.5" cy="54" r="4.6" fill={skin} stroke={LINE} strokeWidth="1.2" />
      <circle cx="70.5" cy="54" r="4.6" fill={skin} stroke={LINE} strokeWidth="1.2" />
      <ellipse cx="50" cy="52" rx="21" ry="23" fill={skin} stroke={LINE} strokeWidth="1.4" />
      <ellipse cx="50" cy="58.5" rx="2" ry="1.5" fill={shade(skin, -0.2)} />
      {a.extra !== 5 && (
        <g opacity="0.22">
          <circle cx="37" cy="61" r="3.6" fill="#ff7a7a" />
          <circle cx="63" cy="61" r="3.6" fill="#ff7a7a" />
        </g>
      )}
      <Augen a={a} brauen={brauen} />
      {!bartUnterMund && <Mund a={a} />}
      <Extra a={a} />
      <HaarVorne a={a} hc={hc} />
      <Kopf a={a} />
    </g>
  );
}

/** Rundes Porträt (Lobby, Kronentafel, Statuszeile) */
export function AvatarFace({ a, color, size = '100%', title }: { a: Avatar; color: string; size?: number | string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? 'Spielfigur'} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`bg${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor={shade(color, 0.35)} />
          <stop offset="1" stopColor={shade(color, -0.15)} />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#bg${id})`} stroke="#fff6e3" strokeWidth="3" />
      <g clipPath={`url(#c${id})`}>
        <g transform="translate(6 9) scale(0.88)">
          <path d="M14,104 C16,88 30,80 50,80 C70,80 84,88 86,104 Z" fill={shade(color, -0.3)} stroke={LINE} strokeWidth="1.4" />
          <path d="M40,80 L50,90 L60,80" fill="none" stroke="#fff6e3" strokeWidth="3" strokeLinejoin="round" />
          <rect x="44" y="70" width="12" height="12" rx="4" fill={shade(HAUT[a.haut] ?? HAUT[1], -0.08)} />
          <KopfTeile a={a} />
        </g>
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
    </svg>
  );
}

/**
 * Spielfigur fürs Brett: kleine Person im Weihnachtspulli (Spielerfarbe) auf einem runden Sockel,
 * mit dem Avatar-Kopf. Mit `laeuft` schwingen Arme und Beine (Laufanimation per CSS).
 */
export function Figur({ a, color, title, laeuft }: { a: Avatar; color: string; title?: string; laeuft?: boolean }) {
  const id = useId().replace(/:/g, '');
  const skin = HAUT[a.haut] ?? HAUT[1];
  const pulli = color;
  const pulliDunkel = shade(color, -0.35);
  const hell = shade(color, 0.55);
  const muster = color.toLowerCase() === '#f5f5f5' || color.toLowerCase() === '#fdd835' ? '#c62828' : '#fff6e3';
  return (
    <svg viewBox="0 0 64 100" width="100%" height="100%" role="img" aria-label={title ?? 'Spielfigur'} className={`fig ${laeuft ? 'laeuft' : ''}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`p${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={pulliDunkel} />
          <stop offset="0.38" stopColor={hell} />
          <stop offset="0.62" stopColor={pulli} />
          <stop offset="1" stopColor={shade(color, -0.5)} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f6d27a" />
          <stop offset="1" stopColor="#b8862a" />
        </linearGradient>
      </defs>
      {/* Schatten + Sockel (wie bei einer echten Spielfigur) */}
      <ellipse cx="32" cy="95.5" rx="19" ry="3.4" fill="rgba(0,0,0,0.38)" />
      <ellipse cx="32" cy="91.5" rx="17.5" ry="5.2" fill={`url(#s${id})`} stroke={INK} strokeWidth="1.2" />
      <ellipse cx="32" cy="89.6" rx="17.5" ry="4.6" fill={pulliDunkel} stroke={INK} strokeWidth="1.2" />
      <ellipse cx="29" cy="88.6" rx="9" ry="1.6" fill="rgba(255,255,255,0.25)" />
      <g className="fig-koerper">
        {/* Beine */}
        <g className="fig-bein fig-bein-l" style={{ transformOrigin: '28.5px 71px' }}>
          <rect x="25.6" y="70" width="6" height="17" rx="2.6" fill="#2f3542" stroke={INK} strokeWidth="1" />
          <ellipse cx="27.6" cy="87.4" rx="4.6" ry="2.4" fill="#4a2c17" stroke={INK} strokeWidth="1" />
        </g>
        <g className="fig-bein fig-bein-r" style={{ transformOrigin: '35.5px 71px' }}>
          <rect x="32.4" y="70" width="6" height="17" rx="2.6" fill="#2f3542" stroke={INK} strokeWidth="1" />
          <ellipse cx="36.4" cy="87.4" rx="4.6" ry="2.4" fill="#4a2c17" stroke={INK} strokeWidth="1" />
        </g>
        <g className="fig-oben">
          {/* Arme */}
          <g className="fig-arm fig-arm-l" style={{ transformOrigin: '21.5px 52px' }}>
            <path d="M21.5,51 C17.5,56 16.5,62 17.2,68" stroke={INK} strokeWidth="6.6" fill="none" strokeLinecap="round" />
            <path d="M21.5,51 C17.5,56 16.5,62 17.2,68" stroke={pulli} strokeWidth="4.6" fill="none" strokeLinecap="round" />
            <circle cx="17.3" cy="69.6" r="2.7" fill={skin} stroke={INK} strokeWidth="0.9" />
          </g>
          <g className="fig-arm fig-arm-r" style={{ transformOrigin: '42.5px 52px' }}>
            <path d="M42.5,51 C46.5,56 47.5,62 46.8,68" stroke={INK} strokeWidth="6.6" fill="none" strokeLinecap="round" />
            <path d="M42.5,51 C46.5,56 47.5,62 46.8,68" stroke={pulli} strokeWidth="4.6" fill="none" strokeLinecap="round" />
            <circle cx="46.7" cy="69.6" r="2.7" fill={skin} stroke={INK} strokeWidth="0.9" />
          </g>
          {/* Weihnachtspulli */}
          <path d="M20.5,73 C19.5,60 22,49.5 32,48.5 C42,49.5 44.5,60 43.5,73 C38,75.5 26,75.5 20.5,73 Z" fill={`url(#p${id})`} stroke={INK} strokeWidth="1.3" />
          <path d="M22.5,60 L25.5,57 L28.5,60 L31.5,57 L34.5,60 L37.5,57 L40.5,60" stroke={muster} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          {[24.5, 29, 33.5, 38].map((x) => <circle key={x} cx={x + 1} cy="65" r="0.95" fill={muster} />)}
          <path d="M21.6,69.8 C27,71.6 37,71.6 42.4,69.8" stroke={pulliDunkel} strokeWidth="1.6" fill="none" />
          <ellipse cx="32" cy="49.6" rx="6.4" ry="2.2" fill={pulliDunkel} />
          {/* Kopf */}
          <g transform="translate(1 2.5) scale(0.62)">
            <KopfTeile a={a} />
          </g>
        </g>
      </g>
    </svg>
  );
}
