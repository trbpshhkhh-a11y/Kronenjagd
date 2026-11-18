/** Normalisierung für Vergleiche (Groß-/Kleinschreibung, Umlaute, Leerzeichen ignorieren) */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Beginnt die Antwort mit dem Buchstaben? (Umlaut Ä zählt für A usw.) */
export function startsWithLetter(answer: string, letter: string): boolean {
  const a = answer.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return a.length > 1 && a[0] === letter.toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/** Toleranter Vergleich für Montagsmaler: Abstand höchstens 1 Tippfehler */
export function fuzzyEquals(guess: string, target: string): boolean {
  const g = normalize(guess), t = normalize(target);
  if (!g) return false;
  return levenshtein(g, t) <= 1;
}

/** Zahl hübsch auf Deutsch formatieren */
export function formatNumber(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}
