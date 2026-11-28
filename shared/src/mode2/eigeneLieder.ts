/** Eigene Lieder (Titelliste) prüfen und passende Alternativ-Antworten ableiten. */
import type { EigenesLied } from './types';

export const EIGENE_MAX = 200;
export const EIGEN_DAUER = { min: 4, max: 30 };

/** Alternativtitel: ohne Klammerzusätze („(Radio Edit)“, „feat. …“), ohne Teil nach „ - “ */
export function titelAliase(titel: string): string[] {
  const out = new Set<string>();
  const ohneKlammer = titel.replace(/\s*[([{][^)\]}]*[)\]}]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const ohneFeat = ohneKlammer.replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, '').trim();
  const vorStrich = ohneFeat.split(/\s[-–—]\s/)[0].trim();
  for (const t of [ohneKlammer, ohneFeat, vorStrich]) if (t && t.toLowerCase() !== titel.toLowerCase() && t.length >= 2) out.add(t);
  return [...out];
}

export function sanitizeEigeneLieder(raw: unknown): EigenesLied[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EigenesLied[] = [];
  for (const r of raw.slice(0, EIGENE_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = String(o.id ?? '').slice(0, 40);
    if (!/^[a-z0-9-]{4,40}$/i.test(id) || seen.has(id)) continue;
    const titel = String(o.titel ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (titel.length < 2) continue;
    const kuenstler = String(o.kuenstler ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const d = Number(o.dauer);
    const dauer = Number.isFinite(d) ? Math.max(EIGEN_DAUER.min, Math.min(EIGEN_DAUER.max, d)) : 12;
    seen.add(id);
    out.push({ id, titel, kuenstler, aliase: titelAliase(titel), dauer: Math.round(dauer * 10) / 10 });
  }
  return out;
}
