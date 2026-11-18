/** Bonusfelder-Berechnung aus Spielergebnissen (gemeinsam für beide Modi). */

/** Teamwertung: jedes Mitglied bekommt die Punkte seines Teams. */
export function teamBonus(teams: { members: string[] }[], scores: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  teams.forEach((t, i) => t.members.forEach((m) => (out[m] = Math.max(0, Math.floor(scores[i] ?? 0)))));
  return out;
}

/** Einzelwertung */
export function individualBonus(scores: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) out[k] = Math.max(0, Math.floor(v || 0));
  return out;
}

/** Zahlen erraten: 5 minus Abstand, nicht unter 0 */
export function zahlenBonus(secret: number, tip: number | null | undefined): number {
  if (tip === null || tip === undefined || Number.isNaN(tip)) return 0;
  return Math.max(0, 5 - Math.abs(secret - tip));
}

/** Schätzmeister: Index(e) der nächsten Schätzungen (Gleichstand: alle). */
export function closestIds(answers: Record<string, number | null | undefined>, solution: number): string[] {
  let best = Infinity;
  let ids: string[] = [];
  for (const [id, v] of Object.entries(answers)) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    const d = Math.abs(v - solution);
    if (d < best - 1e-9) {
      best = d;
      ids = [id];
    } else if (Math.abs(d - best) <= 1e-9) ids.push(id);
  }
  return ids;
}

/** Bonusfelder addieren (nicht verbrauchter Bonus bleibt erhalten). */
export function addBonus(current: Record<string, number>, add: Record<string, number>): Record<string, number> {
  const out = { ...current };
  for (const [k, v] of Object.entries(add)) out[k] = (out[k] ?? 0) + v;
  return out;
}
