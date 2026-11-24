export type GameId =
  | 'game7'
  | 'kopfrechnen'
  | 'stirnraten'
  | 'gegenstaende'
  | 'slf'
  | 'schaetzen'
  | 'montagsmaler'
  | 'zahlen'
  | 'wissen'
  | 'begriffe'
  | 'flunker'
  | 'huehner'
  | 'flitzer';

/** einzel = jeder für sich, zweier = Zweier-Teams (ggf. ein Dreierteam), zweiTeams = 2 Teams */
export type TeamMode = 'einzel' | 'zweier' | 'zweiTeams';

export interface GameRules {
  utensilien: string;
  teams: string;
  ablauf: string[];
  gewinn: string;
}

export interface GameDef {
  id: GameId;
  nr: number;
  name: string;
  teamMode: TeamMode;
  /** Mindestanzahl Spieler, damit das Spiel sinnvoll ist */
  minPlayers: number;
  rules: GameRules;
  /** Abweichungen in Modus 2 (Nur App) */
  app: string[];
  /** Nur im Online-Modus (braucht die Handys), nicht in Modus 1 */
  nurOnline?: boolean;
}

export const GAMES: GameDef[] = [
  {
    id: 'game7', nr: 1, name: 'Game of 7', teamMode: 'zweier', minPlayers: 2,
    rules: {
      utensilien: '1 Tischtennisball, Tisch',
      teams: 'Zweier-Teams (werden automatisch ausgelost, bei ungerader Zahl ein Dreierteam)',
      ablauf: [
        'Jedes Team versucht, den Ball exakt so oft auf dem Tisch aufprallen zu lassen: erst exakt 1-mal, dann exakt 2-mal … bis 7-mal.',
        'Zu wenige oder zu viele Aufpraller setzen das Team auf 0 zurück.',
        'Es wird immer die gleiche Anzahl geworfen: Team A mit 1 Aufpraller, Team B mit 1, Team C mit 1, danach A mit 2, B mit 2 usw.',
        'Vor jeder Runde entscheidet jedes Team, ob es weitermacht oder die bisher erreichte Anzahl „einloggt“ (sichert).',
        'Das Spiel endet, wenn alle Teams eingeloggt haben oder ein Team die 7 geschafft hat.',
      ],
      gewinn: 'Beide Spieler eines Teams dürfen in der nächsten Runde die Anzahl der geschafften (eingeloggten) Aufpraller zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Das Team, das dran ist, tippt auf seinen Handys „Geschafft“, „Fehlversuch“ oder „Einloggen“. Der Tischtennisball bleibt echt.'],
  },
  {
    id: 'kopfrechnen', nr: 2, name: 'Kopfrechnen', teamMode: 'einzel', minPlayers: 2,
    rules: {
      utensilien: '10 Blätter, 10 Stifte',
      teams: 'Jeder für sich',
      ablauf: [
        'Es werden 5 Matheaufgaben gestellt, eine nach der anderen.',
        'Wer als Erstes das richtige Ergebnis nennt, bekommt einen Punkt.',
        'Wer falsch antwortet, ist für diese Aufgabe raus.',
      ],
      gewinn: 'Jeder Mitspieler darf die Anzahl seiner richtigen Aufgaben zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Die Aufgabe steht auf dem Hauptscreen. Jeder tippt sein Ergebnis ins Handy. Der Erste mit dem richtigen Ergebnis bekommt den Punkt, eine falsche Eingabe sperrt für diese Aufgabe.'],
  },
  {
    id: 'stirnraten', nr: 3, name: 'Stirnraten', teamMode: 'zweiTeams', minPlayers: 4,
    rules: {
      utensilien: 'Handy mit einer Stirnraten-App',
      teams: '2 Teams (werden automatisch ausgelost)',
      ablauf: [
        'Klassisches Stirnraten: Ein Spieler hält das Handy an die Stirn und errät die Begriffe, die sein Team ihm erklärt.',
        'Jedes Team spielt eine Runde.',
      ],
      gewinn: 'Die Mitspieler dürfen die Anzahl der richtigen Antworten ihres Teams zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Der Rater sieht nur „Du rätst“. Seine Teampartner sehen den Begriff auf ihren Handys, erklären ihn und tippen „Richtig“ oder „Überspringen“. 60 Sekunden je Team.'],
  },
  {
    id: 'gegenstaende', nr: 4, name: 'Gegenstände merken', teamMode: 'einzel', minPlayers: 2,
    rules: {
      utensilien: 'Bild auf dem Hauptscreen, 10 Zettel, 10 Stifte',
      teams: 'Jeder für sich',
      ablauf: [
        'Die App zeigt 10 Sekunden lang ein Bild mit 10 nummerierten Kacheln. In jeder Kachel steckt ein Gegenstand.',
        'Merkt euch so viele wie möglich!',
        'Danach fragt die App die Nummern in zufälliger Reihenfolge ab („Was war auf Feld 7?“). Schreibt die Gegenstände zu den Nummern auf.',
        'Am Ende zeigt die App die Auflösung.',
      ],
      gewinn: 'Jeder Mitspieler darf die Anzahl seiner richtigen Antworten zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Jedes Handy fragt die Nummern ab. Ihr wählt den Gegenstand aus einem Raster mit 12 Emojis (10 echte, 2 Ablenker). 8 Sekunden pro Nummer.'],
  },
  {
    id: 'slf', nr: 5, name: 'Stadt Land Fluss', teamMode: 'einzel', minPlayers: 2,
    rules: {
      utensilien: '10 Blätter, 10 Stifte',
      teams: 'Jeder für sich',
      ablauf: [
        'Die App lost einen Buchstaben und 5 Kategorien aus.',
        'Alle schreiben zu jeder Kategorie einen Begriff mit diesem Anfangsbuchstaben auf.',
        'Wer als Erstes fertig ist, ruft „Stopp!“ – oder der Timer läuft ab.',
        'Jede gültige Antwort gibt einen Punkt, Antworten, die mehrere Spieler gleich haben, geben keinen.',
      ],
      gewinn: 'Jeder Mitspieler darf die Anzahl seiner Punkte zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Antworten werden ins Handy getippt. Wer fertig ist, drückt den Buzzer „Stopp“, danach haben alle noch 10 Sekunden. Danach könnt ihr Antworten anderer als ungültig markieren – bei Mehrheit zählt sie nicht.'],
  },
  {
    id: 'schaetzen', nr: 6, name: 'Schätzmeister', teamMode: 'einzel', minPlayers: 2,
    rules: {
      utensilien: '10 Blätter, 10 Stifte',
      teams: 'Jeder für sich',
      ablauf: [
        '5 Schätzfragen nacheinander. Jeder schreibt seine Schätzung auf.',
        'Danach zeigt die App die richtige Antwort.',
        'Wer am nächsten dran liegt, bekommt einen Punkt (bei Gleichstand alle Gleichplatzierten).',
      ],
      gewinn: 'Jeder Mitspieler darf die Anzahl seiner Punkte zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Jeder tippt seine Schätzung ins Handy, die App wertet automatisch.'],
  },
  {
    id: 'montagsmaler', nr: 7, name: 'Montagsmaler', teamMode: 'zweiTeams', minPlayers: 4,
    rules: {
      utensilien: '2 Blätter, 2 Stifte',
      teams: '2 Teams (werden automatisch ausgelost)',
      ablauf: [
        'Ein Spieler pro Team ist Zeichner und sieht mehrere Begriffe in seiner Geheimansicht.',
        'Er zeichnet sie nacheinander, sein Team rät.',
        '30 Sekunden pro Team, danach ist das andere Team dran.',
        'Pro richtig erratenem Begriff gibt es einen Punkt.',
      ],
      gewinn: 'Die Mitspieler dürfen die Anzahl der erratenen Begriffe ihres Teams zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Der Zeichner zeichnet auf seinem Handy, die Striche erscheinen live auf dem Hauptscreen. Das Team rät laut oder tippt Tipps ins Handy (1 Tippfehler erlaubt).'],
  },
  {
    id: 'zahlen', nr: 8, name: 'Zahlen erraten', teamMode: 'zweier', minPlayers: 2,
    rules: {
      utensilien: '5 Blätter, 5 Stifte',
      teams: 'Zweier-Teams (werden automatisch ausgelost). In jedem Team gibt es einen Rater und einen Kenner (Rollen werden ausgelost).',
      ablauf: [
        'Die App lost eine geheime Zahl von 1 bis 10 aus. Alle Kenner sehen dieselbe Zahl in ihrer Geheimansicht.',
        'Die Rater nennen abwechselnd eine Kategorie (z. B. „Tiere“). Die Kenner nennen jeweils einen Begriff aus dieser Kategorie, der zur Größe der Zahl passt (1 = ganz klein/wenig, 10 = riesig/sehr viel).',
        'Danach schreibt jeder Rater seine geschätzte Zahl auf.',
        'Dann deckt die App die richtige Zahl auf.',
      ],
      gewinn: 'Beide Spieler des Teams dürfen 5 minus Abstand zur richtigen Zahl zusätzlich vorgehen (nicht unter 0).',
    },
    app: ['Die Kenner sehen die Zahl auf ihrem Handy, die Rater tippen am Ende ihren Tipp ein.'],
  },
  {
    id: 'wissen', nr: 9, name: 'Allgemeinwissenfragen', teamMode: 'zweier', minPlayers: 2,
    rules: {
      utensilien: 'Zettel und Stift',
      teams: 'Zweier-Teams (werden automatisch ausgelost)',
      ablauf: [
        '5 Fragen, alle Teams bekommen dieselben.',
        'Jedes Team einigt sich auf eine Antwort und notiert sie.',
        'Nach jeder Frage werden die Antworten aufgedeckt und mit der Lösung verglichen.',
        'Pro richtig beantworteter Frage gibt es einen Punkt.',
      ],
      gewinn: 'Die Mitspieler dürfen die Anzahl der richtig beantworteten Fragen ihres Teams zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Zu jeder Frage gibt es 4 Antworten. Wählen alle Teampartner dieselbe, ist sie gesperrt. Sonst zählt nach 20 Sekunden die Wahl dessen, der zuerst gewählt hat.'],
  },
  {
    id: 'begriffe', nr: 10, name: 'Begriffe erklären', teamMode: 'zweier', minPlayers: 2,
    rules: {
      utensilien: 'keine',
      teams: 'Zweier-Teams (werden automatisch ausgelost)',
      ablauf: [
        'Die Teams sind abwechselnd dran. Ein Spieler bekommt mehrere Begriffe in seiner Geheimansicht und erklärt sie seinem Teampartner – 30 Sekunden lang.',
        'Die Begriffe dürfen weder direkt genannt noch durch Wortbestandteile oder ähnliche Wörter verraten werden.',
        'Pro richtig erratenem Begriff gibt es einen Punkt.',
        'Danach ist das nächste Team dran. Jedes Team spielt 2 Durchgänge, die Spieler wechseln sich beim Erklären ab.',
      ],
      gewinn: 'Die Mitspieler dürfen die Anzahl der erratenen Begriffe ihres Teams zusätzlich zur Augenzahl vorgehen.',
    },
    app: ['Der Erklärer sieht die Begriffe auf seinem Handy und tippt „Erraten“ oder „Überspringen“. Der Partner rät laut.'],
  },
  {
    id: 'flunker', nr: 11, name: 'Flunker-Quiz', teamMode: 'einzel', minPlayers: 2, nurOnline: true,
    rules: {
      utensilien: 'nur eure Handys',
      teams: 'Jeder gegen jeden',
      ablauf: [
        'Alle bekommen eine verrückte Frage, deren Antwort kaum jemand kennt.',
        'Jeder denkt sich eine glaubwürdige falsche Antwort aus – eine Finte – und tippt sie ins Handy.',
        'Dann werden alle Finten mit der echten Antwort gemischt. Jeder tippt, welche die echte ist.',
        'Für jeden, der auf deine Finte hereinfällt, bekommst du einen Punkt – und einen, wenn du die echte Antwort findest. Es gibt 3 Runden.',
      ],
      gewinn: 'Bonusfelder nach Platz: 1. Platz 5, 2. Platz 4, 3. Platz 3, 4. Platz 2, 5. Platz 1.',
    },
    app: ['Finte bis 40 Zeichen. Ist sie zu nah an der Wahrheit, musst du dir etwas anderes ausdenken. Für deine eigene Finte kannst du nicht stimmen.'],
  },
  {
    id: 'huehner', nr: 12, name: 'Hühnerhüpfer', teamMode: 'einzel', minPlayers: 2, nurOnline: true,
    rules: {
      utensilien: 'nur eure Handys',
      teams: 'Jeder gegen jeden',
      ablauf: [
        'Dein Huhn hüpft Feld für Feld nach vorne – über Straßen, Flüsse und Gleise.',
        'Hüpfe mit den Pfeiltasten nach vorne, links, rechts oder zurück (oder tippe auf die Welt, um nach vorne zu hüpfen).',
        'Pass auf Autos und Züge auf und hüpf nur auf Baumstämme oder Seerosen – Wasser ist tabu!',
        'Wer rausfliegt, wartet 2 Sekunden und startet auf der letzten Wiese neu. Nach 30 Sekunden zählt die weiteste Reihe.',
      ],
      gewinn: 'Bonusfelder nach Platz: 1. Platz 5, 2. Platz 4, 3. Platz 3, 4. Platz 2, 5. Platz 1.',
    },
    app: ['Alle hüpfen durch dieselbe Welt, die anderen Hühner siehst du halb durchsichtig. Bei Gleichstand gewinnt, wer die Reihe zuerst erreicht hat.'],
  },
  {
    id: 'flitzer', nr: 13, name: 'Turbo-Flitzer', teamMode: 'einzel', minPlayers: 2, nurOnline: true,
    rules: {
      utensilien: 'nur eure Handys (im Querformat)',
      teams: 'Jeder gegen jeden',
      ablauf: [
        'Jeder fährt ein kleines Auto in seiner Farbe – die ganze Strecke ist auf deinem Handy zu sehen.',
        'Zeig mit dem Joystick, wohin dein Auto fahren soll. Je weiter du drückst, desto schneller fährt es.',
        'Lässt du los, rollt das Auto aus. Links und rechts ist eine Bande – wer dagegen fährt, wird langsamer.',
        'Nach der Startampel geht’s los: Wer zuerst 3 Runden geschafft hat, gewinnt. Danach haben alle anderen noch 15 Sekunden.',
      ],
      gewinn: 'Bonusfelder nach Platz: 1. Platz 5, 2. Platz 4, 3. Platz 3, 4. Platz 2, 5. Platz 1.',
    },
    app: ['Wer nicht ins Ziel kommt, wird nach geschafften Runden gewertet.'],
  },
];

export const GAME_IDS = GAMES.map((g) => g.id);
/** Spiele für Modus 1 (mit Spielbrett) – ohne die reinen Online-Spiele */
export const BRETT_GAME_IDS = GAMES.filter((g) => !g.nurOnline).map((g) => g.id);

export function gameById(id: GameId): GameDef {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error('Unbekanntes Spiel ' + id);
  return g;
}

export function isPlayable(id: GameId, playerCount: number): boolean {
  return playerCount >= gameById(id).minPlayers;
}
