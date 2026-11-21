/** Schaltbare Regel-Annahmen für Modus 2 (siehe README, Abschnitt Annahmen) */

/** Kronen werden auch beim Vorbeiziehen eingesammelt, nicht nur beim Landen. */
export const KRONE_AUCH_BEIM_VORBEIGEHEN = true;
/** Gelbe Kreispfeil-Felder: Position mit einem beliebigen Mitspieler tauschen. */
export const GELB_SPIELERTAUSCH = true;
/** Wahrscheinlichkeit, dass eine Krone eine große Krone (2 Punkte) ist. */
export const GROSSE_KRONE_CHANCE = 0.3;
/** Dauer eines Schritts der Figur in ms (Animation auf dem Hauptscreen). */
export const SCHRITT_MS = 380;
/** Spieler, die länger getrennt sind und dran sind, werden übersprungen. */
export const GETRENNT_UEBERSPRINGEN_MS = 60_000;
export const MAX_SPIELER = 10;
export const MIN_SPIELER = 2;

export const SPIELER_FARBEN = [
  '#e53935', // rot
  '#1e88e5', // blau
  '#43a047', // grün
  '#fdd835', // gelb
  '#8e24aa', // lila
  '#fb8c00', // orange
  '#00acc1', // türkis
  '#ec407a', // pink
  '#6d4c41', // braun
  '#f5f5f5', // weiß
];

export interface TimerSettings {
  richtung: number;
  kopfrechnen: number;
  stirnraten: number;
  gegenstaende: number;
  slf: number;
  schaetzen: number;
  montagsmaler: number;
  zahlen: number;
  wissen: number;
  begriffe: number;
}

export const DEFAULT_TIMER: TimerSettings = {
  richtung: 30,
  kopfrechnen: 45,
  stirnraten: 60,
  gegenstaende: 8,
  slf: 90,
  schaetzen: 45,
  montagsmaler: 30,
  zahlen: 180,
  wissen: 20,
  begriffe: 30,
};

export const TIMER_LABELS: Record<keyof TimerSettings, string> = {
  richtung: 'Richtung wählen',
  kopfrechnen: 'Kopfrechnen je Aufgabe',
  stirnraten: 'Stirnraten je Team',
  gegenstaende: 'Gegenstände je Nummer',
  slf: 'Stadt Land Fluss',
  schaetzen: 'Schätzmeister je Frage',
  montagsmaler: 'Montagsmaler je Team',
  zahlen: 'Zahlen erraten',
  wissen: 'Allgemeinwissen je Frage',
  begriffe: 'Begriffe erklären je Durchgang',
};

/* ---------------------------- Bots ---------------------------- */

export type BotLevel = 'leicht' | 'mittel' | 'schwer';
export const BOT_LEVELS: BotLevel[] = ['leicht', 'mittel', 'schwer'];
export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };
/** Erfolgswahrscheinlichkeit der Bots in Minispielen je Schwierigkeit */
export const BOT_ERFOLG: Record<BotLevel, number> = { leicht: 0.35, mittel: 0.55, schwer: 0.75 };
/** Ab dieser Stufe loggen Bots bei Game of 7 ein */
export const BOT_GAME7_EINLOGGEN: Record<BotLevel, number> = { leicht: 2, mittel: 3, schwer: 4 };
/** Grundverzögerung der Bots in ms (natürlich wirkend) */
export const BOT_VERZOEGERUNG: [number, number] = [1000, 3000];
export const BOT_NAMEN = ['Bot Rudi', 'Bot Flocke', 'Bot Zimt', 'Bot Keks', 'Bot Frosti', 'Bot Nuss', 'Bot Lametta', 'Bot Mandel', 'Bot Sternchen', 'Bot Glöckchen'];
