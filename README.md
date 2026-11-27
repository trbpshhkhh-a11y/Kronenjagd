# 👑 Kronen sammeln

Web-App zum Weihnachts-Brettspiel **„Kronen sammeln“** mit zwei Spielmodi:

| Modus | Wofür | Braucht |
|---|---|---|
| **🎲 Mit Spielbrett** | Ihr spielt am echten Brett. Die App ist der Spielleiter: Sie lost Startfelder, Krone, Spiele und Teams aus, zeigt Aufgaben an, erklärt die Regeln und berechnet die Bonusfelder. | nichts: reine statische Seite, offline nutzbar (PWA) |
| **📺📱 Nur App** | Das ganze Spiel läuft in der App. Jeder steuert mit seinem Handy. Optional zeigt ein Fernseher, Tablet oder Monitor das Brett als Hauptscreen. Fehlen Mitspieler, spielen Bots mit – man kann auch allein gegen Bots spielen. | Internet + den kleinen Spielserver aus diesem Repo |

Die Oberfläche ist komplett auf Deutsch, im Look des Spielbretts (Holz, Weihnachtsrot, Tannengrün, Gold), mit großer Schrift für Fernseher und großen Touch-Flächen.

---

## Schnellstart (lokal)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18 (empfohlen: 20).

```bash
npm install          # einmalig
npm run build        # Client + Server bauen
npm start            # startet alles auf http://localhost:8787
```

Öffne dann **http://localhost:8787** im Browser.

**Mit Handys im selben WLAN testen:** Finde die IP-Adresse deines Rechners heraus (z. B. `192.168.178.20`) und öffne auf dem Handy `http://192.168.178.20:8787`.
Wichtig: Die QR-Codes enthalten die Adresse, unter der der Hauptscreen geöffnet wurde. Öffne den Hauptscreen deshalb über die IP-Adresse, nicht über `localhost`, sonst können die Handys den QR-Code nicht öffnen.

### Entwicklung

```bash
npm run dev:server   # Terminal 1: Spielserver (Port 8787, lädt bei Änderungen neu)
npm run dev          # Terminal 2: Vite-Entwicklungsserver (http://localhost:5173)
npm test             # automatische Tests (Vitest)
npm run typecheck    # TypeScript prüfen
```

Für Modus 1 reicht `npm run dev` allein.

---

## Kostenlos online stellen

### Variante A: Alles (Modus 1 + 2) auf Render, empfohlen

Render hat einen kostenlosen Tarif, der WebSockets unterstützt. Ein einziger Dienst liefert die App aus und betreibt den Spielserver.

1. Lege bei [github.com](https://github.com) ein Repository an und lade dieses Projekt hoch (oder benutze dieses Repository).
2. Erstelle ein kostenloses Konto auf [render.com](https://render.com) und verbinde es mit GitHub.
3. Klicke auf **New → Blueprint** und wähle das Repository. Render findet die Datei `render.yaml` und richtet alles automatisch ein.
   *Alternativ manuell:* **New → Web Service** → Repository wählen → Runtime **Node**, Build Command `npm ci --include=dev && npm run build`, Start Command `npm start`, Plan **Free**.
4. Warte, bis der Build fertig ist (einige Minuten). Du bekommst eine Adresse wie `https://kronen-sammeln.onrender.com`.
5. Öffne die Adresse auf Fernseher/Laptop und Handys. Auf dem Handy über „Zum Home-Bildschirm“ als App installieren.

Hinweis: Kostenlose Render-Dienste schlafen nach etwa 15 Minuten ohne Besucher ein. Der erste Aufruf danach dauert dann bis zu einer Minute. Öffne die Seite also kurz vor dem Spielen einmal.

*Andere Anbieter:* Auf **Railway** oder **Fly.io** funktioniert es genauso: Build-Befehl `npm ci --include=dev && npm run build`, Start-Befehl `npm start`. Der Server liest den Port aus der Umgebungsvariable `PORT`.

### Variante B: Nur Modus 1 als statische Seite (GitHub Pages oder Netlify)

Modus 1 braucht keinen Server. Auf einer statischen Seite ist „Nur App“ automatisch ausgegraut, mit Hinweis.

**GitHub Pages:** Der Workflow `.github/workflows/pages.yml` ist schon dabei.
1. Im Repository auf GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Auf den Branch `main` pushen (oder den Workflow unter **Actions** manuell starten).
3. Die Seite erscheint unter `https://<dein-name>.github.io/<repo>/`.

Optional kannst du unter **Settings → Secrets and variables → Actions → Variables** eine Variable `SERVER_URL` anlegen (z. B. die Render-Adresse aus Variante A). Dann funktioniert auf der Pages-Seite auch „Nur App“ über diesen Server.

**Netlify:** `npm install && npm run build:static` ausführen und den Ordner `client/dist` auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen.

---

## So wird gespielt

### Modus 1 – Mit Spielbrett
1. Mitspieler eintragen (mindestens 2), optional „Kronen zum Sieg“ (Standard 5, abschaltbar) und Timer für Stadt Land Fluss einstellen.
2. Die App lost die **Startfelder** und die **Position der Krone** aus (mit Animation). Die erste Krone landet nie auf einem Startfeld. Wo die Figuren später stehen, weiß die App in Modus 1 nicht – beim Weiterlosen achtet ihr selbst darauf.
3. **Übersicht**: Kronen, Startfelder und Bonusfelder aller Spieler sowie die Kronenposition. Buttons „Nächstes Spiel auslosen“ und „Krone zuordnen“.
4. Nach jedem Spiel tragt ihr die Ergebnisse ein. Die App berechnet daraus die **Bonusfelder**. Die werden sofort in der **Bonusrunde** gegangen: zuerst, wer vor dem Minispiel dran war, dann der Reihe nach. Alle Sonderfelder ruhen dabei. Danach ist ganz normal der Nächste dran.
5. **Geheime Inhalte** (Montagsmaler, Begriffe erklären, Zahlen erraten) erscheinen nie auf dem Hauptscreen. Die App zeigt einen **QR-Code**: Der Zeichner/Erklärer/Kenner scannt ihn mit dem eigenen Handy. Der Inhalt steckt verschlüsselt in der URL, dafür ist kein Server nötig. Alternativ gibt es „Auf diesem Gerät anzeigen“ mit Gedrückthalten.

Der Spielstand liegt im `localStorage`. Versehentliches Neuladen schadet also nicht.

### Modus 2 – Nur App
**Lobby erstellen** (Nur App → Neue Lobby erstellen) – zwei Möglichkeiten:
- **Ich spiele mit:** Namen eingeben, fertig. Es gibt keinen Hauptscreen, jeder sieht alles auf seinem Handy. Du leitest die Lobby (Einstellungen, Bots, Start). Verlässt du die Lobby oder bist länger als 60 Sekunden weg, übernimmt automatisch der nächste verbundene Mitspieler.
- **Dieses Gerät ist der Hauptscreen:** Fernseher, Tablet oder Laptop zeigt das Brett für alle und spielt selbst nicht mit. Am schönsten im Querformat, das Hochformat geht aber auch.

Ein Hauptscreen kann sich auch **nachträglich dazuschalten**, sogar während des Spiels: Auf dem Gerät „Nur App → Beitreten“, Code eingeben und „Als Hauptscreen beitreten“ tippen. Fällt er wieder weg, läuft das Spiel auf den Handys weiter.

**Mitspieler:** QR-Code scannen oder „Nur App → Beitreten“, Code und Namen eingeben. Insgesamt 2 bis 10 Spieler, mindestens 1 Mensch.

**Eigene Spielfigur:** In der Lobby das eigene Feld (oder „✎ Figur“) antippen und die Figur gestalten: Kopfbedeckung (Weihnachtsmütze, Krone, Rentiergeweih, Elfenmütze …), Frisur, Haarfarbe, Hautton, Augen, Mund und ein Extra (Brille, Rauschebart, rote Nase …). Die Figur erscheint als Spielfigur auf dem Brett und als Porträt in Lobby, Kronentafel und Statuszeile. Das Gerät merkt sich die Figur für die nächste Lobby. Bots bekommen eine zufällige Figur.

**Bots:** Die Lobby-Leitung tippt „+ Bot“ in der Spielerleiste. Ein Antippen der Schwierigkeit schaltet zwischen leicht, mittel und schwer um. Die Einstellungen (Kronen zum Sieg, Spiele, Timer) öffnen sich über den Button „Einstellungen“. Bots spielen ganz normal mit: Sie würfeln, wählen Richtungen (schwere Bots steuern gezielt Kronen an), ziehen Karten und spielen Minispiele. Sie handeln mit kurzer Verzögerung, damit man zusehen kann. Bots schummeln nicht: Sie sehen nur, was ein Mensch in ihrer Rolle auch sieht. Wie oft sie richtig liegen, hängt von der Schwierigkeit ab. Bots können nicht zeichnen und nicht erklären. Bei Montagsmaler, Stirnraten und Begriffe erklären sind sie deshalb nur Rater, und diese Spiele kommen nur, wenn genug Menschen dabei sind.

**Spielablauf:**
1. Sobald das Spiel läuft, wird im **Querformat** gespielt: Das ganze Brett füllt den Bildschirm, Kronentafel, Status und der Würfeln-Button liegen am Rand. (Hochkant erscheint ein Hinweis zum Drehen, auf Android gibt es einen Button „Vollbild & Querformat“.)
2. Wer dran ist, würfelt und **tippt die Richtung direkt auf dem Brett an**: Die möglichen Wege leuchten in verschiedenen Farben, angetippt werden kann jedes leuchtende Feld. Die Feldnummern sind nur Orientierung, gezogen wird entlang der Strecke im Bild. Kommt die Figur an eine **Abzweigung**, entscheidet der Spieler dort neu, wohin die restlichen Felder gehen.
3. Es liegen immer **2 Kronen** auf dem Brett (30 % Chance auf eine **große Krone** mit 2 Punkten). Wer auf einer Krone landet oder über sie hinwegzieht, bekommt sie. Kronen werden **nie auf ein Feld gelost, auf dem gerade ein Spieler steht** (oder eine andere Krone liegt).
4. Sonderfelder: grün +2, rot −2, gelb = Position mit einem beliebigen Mitspieler tauschen, blau = Ereigniskarte (wird vom Stapel gezogen und aufgedeckt), lila = Minispiel (alle spielen mit, Belohnung sind Bonusfelder). Das Minispiel wird mit einem Spielautomaten (einarmiger Bandit) ausgelost. Minispiele laufen auf dem Handy ebenfalls im Querformat, zweispaltig.
5. Ohne Hauptscreen zeigt jedes Handy zusätzlich die Kronentafel, den Würfel, die Ereigniskarte und in den Minispielen alles, was sonst der Fernseher zeigt (Aufgaben, Bild bei „Gegenstände merken“, Zeichnung beim Montagsmaler live, Ranglisten). Geheime Inhalte bleiben geheim.

**Rückwärts-Songs (beide Modi):** Die App spielt ein bekanntes Lied rückwärts ab, jeder loggt den Titel ein (mit Spielbrett: aufschreiben). Richtig = ein Punkt, 5 Lieder. Kleine Tippfehler und Teiltitel zählen („Tannenbaum“). Die Melodien erzeugt die App selbst (Weihnachtslieder, Kinderlieder, Klassik, Volkslieder in `shared/src/content/songs.ts`) – es werden keine Aufnahmen verwendet, weil Aufnahmen bekannter Pop-Songs urheberrechtlich geschützt sind. In Modus 2 spielt der Hauptscreen das Lied in Dauerschleife; ohne Hauptscreen spielen alle Handys gleichzeitig. Browser erlauben Ton erst nach einer Berührung – notfalls erscheint „Ton einschalten“.

**Eigene Lieder (Rückwärts-Songs):** In den Einstellungen (Nur App: Lobby → Einstellungen; Mit Spielbrett: Übersicht → Einstellungen) unter „Rückwärts-Songs“ → „Eigene Lieder verwalten“ Musikdateien auswählen, die euch gehören (MP3, M4A, WAV …). Die Dateien bleiben **auf diesem Gerät** (im Browser-Speicher) und werden nur dort abgespielt; zum Server geht nur die Titelliste, damit die Antworten geprüft werden können. Titel und Künstler liest die App aus den Liedangaben (ID3) oder dem Dateinamen („Künstler - Titel.mp3“), beides lässt sich ändern. Für jedes Lied läuft ein 12-Sekunden-Ausschnitt rückwärts; den Start wählt man mit dem Schieberegler und kann vorab probehören. Quelle wählbar: „Lieder aus der App“, „Eigene Lieder“ oder „Gemischt“ (bei weniger als 5 eigenen Liedern kommen die übrigen aus der App). In Modus 2 spielt das Gerät der Lobby-Leitung (Hauptscreen oder Leitungs-Handy) die eigenen Lieder ab, die anderen sehen „Das Lied läuft auf dem Hauptscreen / bei …“. Zusätze wie „(Radio Edit)“ oder „feat. …“ muss niemand mittippen. Die App liefert selbst keine geschützten Aufnahmen mit.

**Online-Minispiele (nur Modus 2):** Drei Minispiele gibt es nur in der App, weil jedes Handy mitspielt. Alle spielen jeder gegen jeden, die Belohnung sind Bonusfelder nach Platz (1. Platz 5, 2. Platz 4, 3. Platz 3, 4. Platz 2, 5. Platz 1, bei Gleichstand teilen sich alle den Platz). Sie erscheinen ganz normal in der Auslosung und bei „Spiel aussuchen“ und lassen sich in den Einstellungen abschalten. Alle Geräte starten mit einem gemeinsamen 3-2-1-Countdown (die Uhren werden per Ping abgeglichen).
- **Flunker-Quiz** (Hochformat): Zu einer kniffligen Frage denkt sich jeder eine glaubwürdige falsche Antwort aus (60 s). Dann werden echte Antwort und Finten gemischt, und jeder tippt auf die Antwort, die er für echt hält (30 s, die eigene Finte ist gesperrt). +1 Punkt für jeden, den man reinlegt, +1 Punkt für die echte Antwort. 3 Runden. Finten, die zu nah an der Wahrheit sind, werden abgelehnt, gleiche Finten zusammengelegt (beide Autoren bekommen die Punkte). Braucht mindestens 2 Menschen, Bots schreiben keine Finten, stimmen aber ab.
- **Hühnerhüpfer** (Hochformat): 30 Sekunden lang hüpft jeder sein Huhn so weit wie möglich über Straßen, Flüsse und Gleise (3D-Klötzchenwelt, Pfeiltasten vor/links/rechts/zurück oder Tippen auf die Welt; gedrückt halten = weiterhüpfen). Alle hüpfen durch dieselbe Welt, die anderen Hühner sieht man halb durchsichtig mit Namen. Wer rausfliegt, wartet 2 Sekunden und startet auf der letzten Wiese neu. Es zählt die weiteste Reihe, bei Gleichstand wer sie zuerst erreicht hat. Der Hauptscreen zeigt Timer, Rangliste und eine Fortschrittsleiste.
- **Turbo-Flitzer** (Querformat): Autorennen von oben auf einer von 3 Strecken (Oval, S-Kurven, L-Kurs), die den ganzen Bildschirm füllt; der Joystick liegt in der Ecke (mit ⇄ auf die andere Seite). Der Joystick zeigt, wohin das Auto fahren soll, die Auslenkung ist das Gas, Loslassen = ausrollen. Links und rechts begrenzt eine Bande die Strecke: Wer schräg dagegen fährt, gleitet an ihr entlang, frontal kostet es viel Tempo. Startampel, 3 Runden mit Kontrollpunkten, nach dem ersten Zieleinlauf noch 15 Sekunden, höchstens 2 Minuten. Der Server rechnet das Rennen, die Handys schicken nur den Joystick.

Verliert ein Handy die Verbindung (Bildschirm gesperrt, WLAN-Wechsel), verbindet es sich automatisch wieder. Wer länger als 60 Sekunden weg ist und dran wäre, wird übersprungen. Die Lobby bleibt bestehen, solange ein Mensch oder Hauptscreen verbunden ist, und danach noch 10 Minuten.

---

## Projektstruktur

```
assets/spielbrett.png        Spielbrett (Bild)
shared/                      Gemeinsame Typen + komplette Spiellogik (reine Funktionen)
  src/content/               Inhalte-Pools (Schätzfragen, Wissen, Begriffe, Kategorien, Gegenstände)
  src/mode2/engine.ts        Zustandsmaschine Modus 2 (Würfeln, Bewegen, Kronen, Karten, Minispiele)
  src/mode2/minigames.ts     Die Minispiele für Modus 2
  src/mode2/flunker.ts       Flunker-Quiz (Online-Minispiel)
  src/mode2/songs.ts         Rückwärts-Songs (Ablauf, Titel-Prüfung)
  src/content/songs.ts       Lieder als Notenzeilen
  src/mode2/huehner/         Hühnerhüpfer: Welt aus Startwert, Huhn-Steuerung, Server-Teil
  src/mode2/flitzer/         Turbo-Flitzer: Strecken, Fahrphysik, Rundenzählung, Server-Teil
  src/mode2/bots.ts          Bot-Entscheidungen (nur aus der eigenen Spieleransicht)
  src/mode2/views.ts         viewForHost / viewForPlayer: was welches Gerät sehen darf
  src/mode2/constants.ts     Schaltbare Regel-Annahmen (siehe unten)
  src/protocol.ts            Nachrichtenprotokoll Client ↔ Server
  test/                      Automatische Tests
server/                      Node.js-Server (HTTP + WebSocket mit `ws`), maßgeblicher Spielzustand
client/                      React + Vite + TypeScript (beide Modi, PWA)
  src/board/board.json       Feldgeometrie: Mittelpunkt (Prozent), Feldtyp, Nachbarfelder (Streckennetz)
  src/mode1/                 Spielleiter-Modus
  src/mode2/                 Hauptscreen- und Handy-Ansichten
  src/mode2/games/           Online-Minispiele (Hühnerhüpfer mit Three.js, wird erst beim Spielen geladen)
  src/components/Joystick.tsx  Joystick für Echtzeit-Spiele
  src/dev/                   Entwickler-Werkzeuge für das Brett
```

### Inhalte erweitern
Die Pools liegen in `shared/src/content/*.ts`, ein Eintrag pro Zeile. Für Bots gibt es zusätzlich `slfAntworten.ts` (Antworten für Stadt Land Fluss je Kategorie) und `zahlenHinweise.ts` (Hinweisbegriffe von klein bis groß für „Zahlen erraten“). Neue Einträge einfach anhängen. Innerhalb einer Sitzung wiederholt sich nichts, bis ein Pool leer ist. Dann wird er neu gemischt. Die Tests prüfen Mindestgrößen und Duplikate.

### Feldkoordinaten / Brett austauschen
- **`/#/dev/avatare`** zeigt viele Zufallsfiguren (zum Prüfen der Avatar-Zeichnungen).
- **`/#/dev/board-debug`** zeichnet Nummern, Feldtypen und Verbindungen über das Brettbild (Weichen pink).
- **`/#/dev/feld-editor`**: Felder nacheinander anklicken, Typ und Nachbarn anpassen, `board.json` exportieren und unter `client/src/board/board.json` speichern.

### Schaltbare Regeln (`shared/src/mode2/constants.ts`)
- `KRONE_AUCH_BEIM_VORBEIGEHEN` (Standard `true`)
- `GELB_SPIELERTAUSCH` (Standard `true`)
- `GROSSE_KRONE_CHANCE` (Standard `0.3`)
- `SCHRITT_MS`, `GETRENNT_UEBERSPRINGEN_MS`, Spielerfarben, Standard-Timer
- Bots: `BOT_ERFOLG` (Trefferquote je Schwierigkeit: 35 / 55 / 75 %), `BOT_GAME7_EINLOGGEN`, `BOT_VERZOEGERUNG`, `BOT_NAMEN`

### Datenschutz
Es werden keine personenbezogenen Daten gespeichert. Lobbys existieren nur im Arbeitsspeicher des Servers und werden nach dem Spiel (spätestens nach 4 Stunden Inaktivität) gelöscht. Auf dem Gerät liegen nur der Spielstand (Modus 1) und das Wiederverbindungs-Token (Modus 2) im `localStorage`. Es gibt keine Cookies.

### Entwickler-Testmodus
Mit `KJ_DEBUG=1 npm start` akzeptiert der Server zusätzliche Test-Nachrichten (`debugMini`, `debugPhase`, `debugBonus`), um gezielt ein Minispiel oder eine Ereigniskarte zu starten. Im normalen Betrieb sind sie abgeschaltet.

---

## Annahmen

Vorgegebene, über Konstanten änderbare Annahmen:
- Kronen werden auch **beim Vorbeiziehen** eingesammelt, nicht nur beim Landen.
- Gelbe Kreispfeil-Felder bedeuten in Modus 2 **„Position mit einem beliebigen Mitspieler tauschen“** (wie die Ereigniskarte Spielertausch, 30 s Zeit, danach kein Tausch).
- +2 und −2 werden in Modus 2 automatisch ausgeführt, die Folgefelder lösen keine Effekte aus (Kronen werden dabei aber eingesammelt). +2 geht in Laufrichtung weiter (an einer Weiche geradeaus), −2 geht den gerade gelaufenen Weg zurück.
- Bei Minispielen spielen **alle** mit, die Belohnung sind **Bonusfelder** (keine Kronen). Sie werden direkt nach dem Spiel in der **Bonusrunde** gegangen: zuerst der Spieler, der vor dem Minispiel dran war, dann in Zugreihenfolge; jeder wählt die Richtung selbst. In dieser Zeit ruhen alle Sonderfelder (+2, −2, Tausch, Ereignis, Minispiel) und werden auf dem Brett als normale Felder gezeigt. Kronen werden aber eingesammelt. Danach ist der Spieler nach dem dran, der vor dem Minispiel dran war.
- Gezogen wird entlang der Strecke im Bild, nicht nach Feldnummern (siehe Hinweise zum Brett).
- Ein Hauptscreen ist optional. Ist einer da, spielt er nicht mit.

Eigene Annahmen (einfachste sinnvolle Lösung):
- **Würfel-Einstellung:** Gespielt wird mit einem normalen Würfel (1 bis 6). In den Lobby-Einstellungen wird das nur angezeigt, nicht verändert.
- **Spiele mit 2 Teams** (Stirnraten, Montagsmaler) werden in beiden Modi erst ab 4 Spielern ausgelost. Spiele mit Zweier-Teams gehen ab 2 Spielern.
- **Game of 7:** Ein Fehlversuch setzt auf 0, das Team wirft in der nächsten Runde aber die aktuelle Aufprallzahl mit. Am Spielende zählt die erreichte Stufe auch bei Teams, die nicht eingeloggt haben. In Modus 2 ist das Spiel standardmäßig aktiv und kann in der Lobby abgeschaltet werden.
- **Zahlen erraten:** Die Kenner nennen Begriffe, deren „Größe“ zur Zahl passt (1 = winzig/wenig, 10 = riesig/sehr viel). In einem Dreierteam gibt es zwei Kenner. In Modus 2 läuft dafür ein Timer von 180 s (einstellbar).
- **Begriffe erklären:** Jedes Team spielt 2 Durchgänge, der Erklärer wechselt. In Modus 1 zeigt die Geheimansicht 12 Begriffe pro Durchgang.
- **Montagsmaler:** 8 Begriffe pro Durchgang. In Modus 2 kann der Zeichner einen Begriff überspringen.
- **Stirnraten (Modus 2):** Nur die Teampartner des Raters sehen den Begriff, das andere Team nicht.
- **Gegenstände merken (Modus 2):** Alle Handys fragen gleichzeitig dieselbe Nummer ab.
- **Stadt Land Fluss (Modus 2):** Eine Antwort ist abgelehnt, wenn mehr als die Hälfte der *anderen* Spieler sie als ungültig markiert. Die Prüfphase dauert höchstens 90 s.
- **Allgemeinwissen:** Jeder spielt für sich. In Modus 2 wird die erste angetippte Antwort sofort eingeloggt (kein Umentscheiden); aufgelöst wird, sobald alle geantwortet haben oder die Zeit um ist. Jede richtige Antwort bringt ein Bonusfeld.
- **Kopfrechnen / Schätzmeister (Modus 2):** 45 s pro Aufgabe bzw. Frage (einstellbar).
- **Ereigniskarten:** Läuft beim Spielertausch die Zeit ab (30 s), wird nicht getauscht. Bei „Spiel aussuchen“ wird dann aus dem Stapel gelost. Der Feldersprung kann auf jedes Feld außer dem aktuellen führen, das Zielfeld hat keinen Effekt. Die Karte **„2 Felder vor“** funktioniert wie das grüne +2-Feld: 2 Felder in Laufrichtung (an einer Weiche geradeaus), Kronen unterwegs zählen, das Zielfeld hat keinen Effekt.
- **Kronen neu platzieren:** Eine Krone landet nie auf einem Feld, über das der ziehende Spieler im selben Zug noch läuft.
- **Kronen zum Sieg** ist in Modus 1 von 1 bis 30 einstellbar (in Modus 2 wie vorgegeben 3 bis 15).

Annahmen zu Bots und zum Spielen ohne Hauptscreen:
- **Lobby-Leitung:** Ohne Hauptscreen leitet der Ersteller. Bei einer Hauptscreen-Lobby leitet der Hauptscreen, solange er verbunden ist; fällt er weg, übernimmt der erste verbundene Mitspieler. Die Leitung darf auch „Weiter“, „Überspringen“ und „Neue Runde“ tippen.
- **Bot-Fähigkeiten** werden ausgewürfelt (Trefferquote je Schwierigkeit). Kopfrechenaufgaben rechnen Bots aus dem angezeigten Text aus; bei Schätzfragen schätzen sie mit zufälliger Abweichung (schwer = näher dran).
- **Mehr Menschen nötig:** Stirnraten und Montagsmaler brauchen 2 Menschen (einen pro Team), Begriffe erklären einen Menschen pro Zweier-Team. Teams werden so gebildet, dass die Menschen zuerst auf die Teams verteilt werden.
- **Zahlen erraten:** Hat ein Team Menschen und Bots, rät ein Bot und der Mensch ist Kenner. Besteht ein Team nur aus Bots, nennt der Bot-Kenner bis zu drei Hinweisbegriffe aus `zahlenHinweise.ts`, die alle sehen (wie laut gesagt). Ist ein Mensch Kenner und ein Bot Rater, wird die Treffsicherheit des Bots ausgewürfelt.
- **Game of 7:** Ein Team nur aus Bots wirft virtuell. Gehört ein Mensch zum Team, wirft er den echten Ball und tippt selbst.
- **Allgemeinwissen:** Bots antworten nach kurzer Bedenkzeit, wie oft richtig, hängt von der Schwierigkeit ab.
- **Stadt Land Fluss:** Bots füllen ihre Antworten aus `slfAntworten.ts`, drücken nie „Stopp“, markieren in der Prüfphase nichts und sind sofort fertig. Für „Marke“, „Film oder Serie“ und „Sänger/in oder Band“ haben Bots keine Antworten und lassen das Feld leer.
- **Spiel aussuchen** (Ereigniskarte): Bots wählen ein Spiel, das Bots gut spielen können.
- **Lobby aufräumen:** Eine Lobby wird gelöscht, wenn 10 Minuten lang weder ein Mensch noch ein Hauptscreen verbunden ist (oder nach 4 Stunden ohne Aktivität). Bots halten eine Lobby nicht am Leben.
- **Hoch- und Querformat:** Die Lobby funktioniert in beiden Ausrichtungen und passt ohne Scrollen auf den Bildschirm. Sobald das Spiel läuft, wird auf allen Geräten im Querformat gespielt. Hochkant erscheint ein Hinweis zum Drehen, das Brett bleibt verkleinert sichtbar. Das PWA-Manifest legt die Ausrichtung nicht fest, damit Lobby und Modus 1 frei bleiben.
- **Richtung antippen:** Tippflächen sind mindestens 44 px groß. Überlappen sie sich, zählt das Feld, das dem Finger am nächsten ist.

Annahmen zu den Online-Minispielen:
- **Belohnung nach Platz** statt Team-Wertung: 5 / 4 / 3 / 2 / 1 Bonusfelder, ab Platz 6 nichts. Bei Gleichstand teilen sich alle denselben Platz, der nächste Platz wird übersprungen.
- **Keine Teamauslosung:** Die Teamanzeige wird bei diesen Spielen übersprungen.
- **Bots:** Im Flunker-Quiz stimmen Bots ab (Trefferquote je Schwierigkeit), schreiben aber keine Finten. Im Hühnerhüpfer bekommen Bots ein ausgewürfeltes Ergebnis (leicht 8–14, mittel 13–21, schwer 19–28 Reihen) und erscheinen nur in Rangliste und Fortschrittsleiste. Im Turbo-Flitzer fahren Bots als einfache KI-Fahrer den Kontrollpunkten nach.
- **Hühnerhüpfer:** Zusammenstöße prüft jedes Handy selbst (alle haben dieselbe Welt und dieselbe Zeit), der Server prüft nur, ob Hüpfer plausibel sind. Zurück geht es höchstens 3 Reihen hinter die beste Reihe.
- **Turbo-Flitzer:** Der Server ist maßgeblich (rechnet 60 Schritte pro Sekunde, verschickt ca. 20 Schnappschüsse pro Sekunde). Das eigene Auto fährt auf dem Handy sofort mit dem Joystick und wird sanft an den Serverstand angeglichen (kein Ruckeln); die anderen Autos werden weich vorausgerechnet. Zusammenstöße geben einen weichen Schubs statt hart abzubremsen. Autos von getrennten Spielern bleiben stehen und blockieren niemanden; wer im Ziel ist, fährt durch die anderen hindurch. Nicht ins Ziel Gekommene werden nach Fortschritt (Kontrollpunkte) gewertet.
- **Flunker-Quiz:** Die eigene Finte bringt keinen Punkt, wenn man sie selbst wählen würde (deshalb gesperrt). Eine Finte gilt als „zu nah an der Wahrheit“, wenn sie bis auf ein bis zwei Tippfehler gleich ist oder die echte Antwort enthält.

### Hinweise zum Spielbrett
- Feldtypen: grün +2 (4, 21, 30, 38), rot −2 (51, 64, 74), blau ?! (7, 14, 41, 45, 59), gelb (39, 55), lila Minispiel (10, 17, 23, 35, 52, 57, 66, 69). Die Felder **17 und 23** wurden im Brettbild nachträglich zu lila Minispielfeldern umgemalt (gleicher Look wie Feld 35 und 66).
- **Die Feldnummern sind nur Orientierung.** Gezogen wird entlang der Strecke, wie sie im Bild verläuft (z. B. von 1 nach links auf 68, nicht auf 76). Die Verbindungen stehen als `neighbors` in `board.json`.
- **Abzweigungen:** Feld 2 (nach 3 oder 43) und die Einmündungen 76 → 9, 42 → 20, 53 → 26, 67 → 32 und 54 → 46. Jede Einmündung hat genau ein Weichenfeld: Wer z. B. von 11 kommt, geht über 10 ohne Entscheidung auf 9 und wählt dort zwischen 8 und 76. Das Weichenfeld ist jeweils das Feld, das im Bild am nächsten an der einmündenden Strecke liegt. Am Zugbeginn darf man in jede Richtung losgehen, im Zug nicht umkehren.
- Wer die Verbindungen ändern möchte, kann sie im Feld-Editor über die Nachbarlisten anpassen.
- Die Mittelpunkte der Felder wurden per Bildanalyse bestimmt: Nummern im Bild abgelesen, Overlay geprüft, mit Screenshots der Debug-Ansicht kontrolliert. Eine automatische Texterkennung (OCR) stand nicht zur Verfügung.
