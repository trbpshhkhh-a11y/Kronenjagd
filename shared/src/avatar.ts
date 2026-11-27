/**
 * Eigene Spielfigur (Avatar): jede Eigenschaft ist eine Nummer aus einer festen Auswahl.
 * So lässt sich der Avatar sicher prüfen und klein verschicken.
 */
import { Rng, seededRng } from './rng';

export interface Avatar {
  haut: number;
  frisur: number;
  haar: number;
  augen: number;
  mund: number;
  kopf: number;
  extra: number;
}

export type AvatarTeil = keyof Avatar;

export const AVATAR_TEILE: AvatarTeil[] = ['kopf', 'frisur', 'haar', 'haut', 'augen', 'mund', 'extra'];

export const AVATAR_LABELS: Record<AvatarTeil, { titel: string; namen: string[] }> = {
  haut: { titel: 'Haut', namen: ['Hell', 'Hell-warm', 'Mittel', 'Oliv', 'Braun', 'Dunkel'] },
  frisur: { titel: 'Frisur', namen: ['Kurz', 'Strubbelig', 'Lang', 'Zöpfe', 'Locken', 'Dutt', 'Glatze', 'Seitenscheitel'] },
  haar: { titel: 'Haarfarbe', namen: ['Schwarz', 'Braun', 'Rotbraun', 'Blond', 'Hellblond', 'Grau', 'Weiß', 'Pink'] },
  augen: { titel: 'Augen', namen: ['Punkte', 'Groß', 'Fröhlich', 'Zwinkern', 'Verträumt'] },
  mund: { titel: 'Mund', namen: ['Lächeln', 'Grinsen', 'Zunge', 'Staunen', 'Verschmitzt'] },
  kopf: { titel: 'Kopf', namen: ['Nichts', 'Weihnachtsmütze', 'Krone', 'Rentiergeweih', 'Elfenmütze', 'Pudelmütze', 'Ohrenschützer', 'Schleife'] },
  extra: { titel: 'Extra', namen: ['Nichts', 'Brille', 'Sonnenbrille', 'Rauschebart', 'Rote Nase', 'Rosige Wangen'] },
};

export const avatarAnzahl = (t: AvatarTeil) => AVATAR_LABELS[t].namen.length;

/** Prüft einen Avatar vom Gerät; ungültige Werte werden abgelehnt */
export function sanitizeAvatar(a: unknown): Avatar | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  const out = {} as Avatar;
  for (const t of AVATAR_TEILE) {
    const v = o[t];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= avatarAnzahl(t)) return null;
    out[t] = v;
  }
  return out;
}

/** Zufälliger, gut aussehender Avatar */
export function randomAvatar(rng: Rng): Avatar {
  const r = (n: number) => Math.floor(rng() * n);
  const frisur = r(avatarAnzahl('frisur'));
  return {
    haut: r(avatarAnzahl('haut')),
    frisur,
    // Pink und Grau/Weiß etwas seltener
    haar: rng() < 0.8 ? r(5) : 5 + r(3),
    augen: r(avatarAnzahl('augen')),
    mund: r(avatarAnzahl('mund')),
    kopf: rng() < 0.75 ? 1 + r(avatarAnzahl('kopf') - 1) : 0,
    extra: rng() < 0.55 ? 0 : 1 + r(avatarAnzahl('extra') - 1),
  };
}

/** Fester Zufalls-Avatar aus einer Kennung (z. B. für neue Spieler und Bots) */
export function avatarFromId(id: string): Avatar {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return randomAvatar(seededRng(h >>> 0));
}
