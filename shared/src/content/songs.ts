/**
 * Lieder für „Rückwärts-Songs“: nur Melodien, die jeder kennt und die frei sind
 * (Weihnachtslieder, Kinderlieder, Klassik, Volkslieder). Die App spielt sie selbst
 * als Melodie ab – es werden keine Aufnahmen verwendet.
 *
 * Noten: „NAME[:Schläge]“, z. B. „G4:1.5“ (ohne Angabe 1 Schlag), „R“ = Pause, „#“/„b“ für Vorzeichen.
 */
export interface Song {
  titel: string;
  /** weitere richtige Antworten (Teil-/Originaltitel, andere Sprache) */
  aliase: string[];
  bpm: number;
  noten: string;
}

export const SONGS: Song[] = [
  {
    titel: 'Stille Nacht, heilige Nacht',
    aliase: ['Stille Nacht', 'Silent Night'],
    bpm: 112,
    noten: 'G4:1.5 A4:.5 G4 E4:3 G4:1.5 A4:.5 G4 E4:3 D5:2 D5 B4:3 C5:2 C5 G4:3',
  },
  {
    titel: 'O Tannenbaum',
    aliase: ['Oh Tannenbaum', 'O Christmas Tree'],
    bpm: 96,
    noten: 'D4 G4:.75 G4:.25 G4:1.5 A4:.5 B4:.75 B4:.25 B4:1.5 B4:.5 A4:.5 B4:.5 C5 F#4 A4 G4:2',
  },
  {
    titel: 'Jingle Bells',
    aliase: ['Jingle Bell'],
    bpm: 150,
    noten: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 E4 D4 D4 E4 D4:2 G4:2',
  },
  {
    titel: 'We Wish You a Merry Christmas',
    aliase: ['We wish you a merry Christmas and a happy new year'],
    bpm: 150,
    noten: 'D4 G4 G4:.5 A4:.5 G4:.5 F#4:.5 E4 E4 E4 A4 A4:.5 B4:.5 A4:.5 G4:.5 F#4 D4 D4 B4 B4:.5 C5:.5 B4:.5 A4:.5 G4 E4 D4:.5 D4:.5 E4 A4 F#4 G4:2',
  },
  {
    titel: 'Morgen kommt der Weihnachtsmann',
    aliase: ['Alle Vögel sind schon da', 'Twinkle Twinkle Little Star', 'Twinkle Twinkle', 'Ah vous dirai-je maman', 'Morgen kommt der Weihnachtsmann kommt mit seinen Gaben'],
    bpm: 120,
    noten: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2',
  },
  {
    titel: 'Alle meine Entchen',
    aliase: ['Alle meine Entchen schwimmen auf dem See'],
    bpm: 132,
    noten: 'C4 D4 E4 F4 G4:2 G4:2 A4 A4 A4 A4 G4:4 A4 A4 A4 A4 G4:4',
  },
  {
    titel: 'Hänschen klein',
    aliase: ['Hänschen klein ging allein'],
    bpm: 150,
    noten: 'G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2 G4 E4 E4:2 F4 D4 D4:2 C4 E4 G4 G4 C4:4',
  },
  {
    titel: 'Bruder Jakob',
    aliase: ['Frère Jacques', 'Are you sleeping', 'Bruder Jakob schläfst du noch'],
    bpm: 150,
    noten: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2',
  },
  {
    titel: 'Fuchs, du hast die Gans gestohlen',
    aliase: ['Fuchs du hast die Gans gestohln'],
    bpm: 132,
    noten: 'C4 D4 E4 F4 G4 G4 G4 G4 A4 F4 C5 A4 G4:4 A4 F4 C5 A4 G4:4',
  },
  {
    titel: 'Happy Birthday',
    aliase: ['Happy Birthday to you', 'Zum Geburtstag viel Glück', 'Geburtstagslied'],
    bpm: 112,
    noten: 'G4:.75 G4:.25 A4 G4 C5 B4:2 G4:.75 G4:.25 A4 G4 D5 C5:2 G4:.75 G4:.25 G5 E5 C5 B4 A4 F5:.75 F5:.25 E5 C5 D5 C5:2',
  },
  {
    titel: 'Ode an die Freude',
    aliase: ['Freude schöner Götterfunken', 'Europahymne', 'Ode to Joy', 'Neunte Sinfonie'],
    bpm: 150,
    noten: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2',
  },
  {
    titel: 'Für Elise',
    aliase: ['Fuer Elise', 'Beethoven Für Elise'],
    bpm: 84,
    noten: 'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 G#4:.5 B4:.5 C5:1.5 E4:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5',
  },
  {
    titel: 'Eine kleine Nachtmusik',
    aliase: ['Kleine Nachtmusik'],
    bpm: 126,
    noten: 'G4 R:.5 D4:.5 G4 R:.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5:2 C5 R:.5 A4:.5 C5 R:.5 A4:.5 C5:.5 A4:.5 F#4:.5 A4:.5 D4:2',
  },
  {
    titel: 'Tetris-Melodie',
    aliase: ['Tetris', 'Tetris Theme', 'Korobeiniki', 'Tetris Lied'],
    bpm: 150,
    noten: 'E5 B4:.5 C5:.5 D5 C5:.5 B4:.5 A4 A4:.5 C5:.5 E5 D5:.5 C5:.5 B4:1.5 C5:.5 D5 E5 C5 A4 A4:2',
  },
  {
    titel: 'In der Halle des Bergkönigs',
    aliase: ['Halle des Bergkönigs', 'Peer Gynt', 'Hall of the Mountain King'],
    bpm: 132,
    noten: 'B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4 F4:.5 C#4:.5 F4 E4:.5 C4:.5 E4 B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:.5 B4:.5 A4:.5 F#4:.5 D4:.5 F#4:.5 A4:2',
  },
  {
    titel: 'When the Saints Go Marching In',
    aliase: ['When the Saints', 'Oh when the Saints', 'Oh when the saints go marching in'],
    bpm: 150,
    noten: 'C4 E4 F4 G4:4 C4 E4 F4 G4:4 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4',
  },
  {
    titel: 'Old MacDonald Had a Farm',
    aliase: ['Old MacDonald', 'Old McDonald', 'Old McDonald had a farm', 'Old MacDonald hat ne Farm'],
    bpm: 150,
    noten: 'G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:3 D4 G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:3',
  },
  {
    titel: 'Guten Abend, gut’ Nacht',
    aliase: ['Guten Abend gute Nacht', 'Brahms Wiegenlied', 'Wiegenlied', 'Guten Abend gut Nacht mit Rosen bedacht'],
    bpm: 110,
    noten: 'E4:.5 E4:.5 G4:2 E4:.5 E4:.5 G4:2 E4:.5 G4:.5 C5 B4:1.5 A4:.5 A4 G4:2 D4:.5 E4:.5 F4 D4 D4:.5 E4:.5 F4:2',
  },
  {
    titel: 'Treulich geführt (Hochzeitsmarsch)',
    aliase: ['Treulich geführt', 'Hochzeitsmarsch', 'Here comes the bride', 'Brautchor', 'Hochzeitslied'],
    bpm: 80,
    noten: 'C4 F4:.75 F4:.25 F4:2 C4 G4:.75 E4:.25 F4:2 C4 F4:.75 Bb4:.25 Bb4 A4:.75 G4:.25 F4:.75 E4:.25 F4:.75 G4:.25 F4:2',
  },
  {
    titel: 'La Cucaracha',
    aliase: ['Cucaracha'],
    bpm: 150,
    noten: 'C4:.5 C4:.5 C4:.5 F4 A4 R:1.5 C4:.5 C4:.5 C4:.5 F4 A4 R:1.5 F4 F4:.5 E4:.5 E4:.5 D4:.5 D4:.5 C4:2',
  },
];

export interface Ton {
  /** Frequenz in Hz (0 = Pause) */
  hz: number;
  /** Dauer in Sekunden */
  sek: number;
}

const STUFE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Notenzeile in Töne umwandeln (Frequenz + Dauer) */
export function songToene(song: Pick<Song, 'bpm' | 'noten'>): Ton[] {
  const schlag = 60 / song.bpm;
  return song.noten
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [name, dauer] = tok.split(':');
      const sek = (dauer ? Number(dauer) : 1) * schlag;
      if (name === 'R') return { hz: 0, sek };
      const m = /^([A-G])(#|b)?(\d)$/.exec(name);
      if (!m) throw new Error('Unbekannte Note ' + tok);
      const halbton = STUFE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
      return { hz: 440 * Math.pow(2, (halbton - 69) / 12), sek };
    });
}

/** Länge des Ausschnitts in Sekunden */
export const songDauer = (song: Pick<Song, 'bpm' | 'noten'>) => songToene(song).reduce((s, t) => s + t.sek, 0);
