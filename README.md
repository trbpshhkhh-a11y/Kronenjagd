# 👑 Kronen sammeln

Web-App zum Weihnachts-Brettspiel **„Kronen sammeln“** mit zwei Spielmodi:

| Modus | Wofür | Braucht |
|---|---|---|
| **🎲 Mit Spielbrett** | Ihr spielt am echten Brett. Die App ist der Spielleiter: Sie lost Startfelder, Krone, Spiele und Teams aus, zeigt Aufgaben an, erklärt die Regeln und berechnet die Bonusfelder. | nichts: reine statische Seite, offline nutzbar (PWA) |
| **📺📱 Nur App** | Das ganze Spiel läuft in der App. Ein Fernseher oder Monitor (Querformat) zeigt das Brett, jeder Mitspieler steuert mit seinem Handy. | Internet + den kleinen Spielserver aus diesem Repo |

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
2. Die App lost die **Startfelder** und die **Position der Krone** aus (mit Animation).
3. **Übersicht**: Kronen, Startfelder und Bonusfelder aller Spieler sowie die Kronenposition. Buttons „Nächstes Spiel auslosen“, „Krone zuordnen“ und „Bonusfelder verbraucht“.
4. Nach jedem Spiel tragt ihr die Ergebnisse ein. Die App berechnet daraus die **Bonusfelder**, die man in der nächsten Runde zusätzlich zur Augenzahl vorgehen darf.
5. **Geheime Inhalte** (Montagsmaler, Begriffe erklären, Zahlen erraten) erscheinen nie auf dem Hauptscreen. Die App zeigt einen **QR-Code**: Der Zeichner/Erklärer/Kenner scannt ihn mit dem eigenen Handy. Der Inhalt steckt verschlüsselt in der URL, dafür ist kein Server nötig. Alternativ gibt es „Auf diesem Gerät anzeigen“ mit Gedrückthalten.

Der Spielstand liegt im `localStorage`. Versehentliches Neuladen schadet also nicht.

### Modus 2 – Nur App
1. Auf dem Fernseher/Laptop: **Nur App → Neue Lobby erstellen**. Es erscheinen ein 5-stelliger Code und ein QR-Code.
2. Auf jedem Handy: QR-Code scannen oder **Nur App → Beitreten**, Code und Namen eingeben.
3. Der Hauptscreen stellt Kronen zum Sieg, aktive Spiele und Timer ein und startet das Spiel (2 bis 10 Spieler).
4. Wer dran ist, würfelt auf dem Handy und wählt die Richtung so, wie sie auf dem Brett aussieht (z. B. „nach oben“, „nach rechts“). Die Feldnummern sind nur Orientierung. Kommt die Figur an eine **Abzweigung**, entscheidet der Spieler dort neu, wohin die restlichen Felder gehen. Der Brettausschnitt auf dem Handy lässt sich bis zum ganzen Brett herauszoomen („🗺 Ganzes Brett“), damit man sieht, wo die Kronen liegen.
5. Es liegen immer **2 Kronen** auf dem Brett (30 % Chance auf eine **große Krone** mit 2 Punkten). Wer auf einer Krone landet oder über sie hinwegzieht, bekommt sie.
6. Sonderfelder: grün +2, rot −2, gelb = Position mit einem beliebigen Mitspieler tauschen, blau = Ereigniskarte (wird auf dem Handy vom Stapel gezogen und auf dem Fernseher aufgedeckt), lila = Minispiel (alle spielen mit, Belohnung sind Bonusfelder für den nächsten Zug).

Verliert ein Handy die Verbindung (Bildschirm gesperrt, WLAN-Wechsel), verbindet es sich automatisch wieder. Wer länger als 60 Sekunden weg ist und dran wäre, wird übersprungen. Schließt der Hauptscreen versehentlich, bleibt die Lobby 10 Minuten bestehen.

---

## Projektstruktur

```
assets/spielbrett.png        Spielbrett (Bild)
shared/                      Gemeinsame Typen + komplette Spiellogik (reine Funktionen)
  src/content/               Inhalte-Pools (Schätzfragen, Wissen, Begriffe, Kategorien, Gegenstände)
  src/mode2/engine.ts        Zustandsmaschine Modus 2 (Würfeln, Bewegen, Kronen, Karten, Minispiele)
  src/mode2/minigames.ts     Die 10 Minispiele für Modus 2
  src/mode2/views.ts         viewForHost / viewForPlayer: was welches Gerät sehen darf
  src/mode2/constants.ts     Schaltbare Regel-Annahmen (siehe unten)
  src/protocol.ts            Nachrichtenprotokoll Client ↔ Server
  test/                      Automatische Tests
server/                      Node.js-Server (HTTP + WebSocket mit `ws`), maßgeblicher Spielzustand
client/                      React + Vite + TypeScript (beide Modi, PWA)
  src/board/board.json       Feldgeometrie: Mittelpunkt (Prozent), Feldtyp, Nachbarfelder (Streckennetz)
  src/mode1/                 Spielleiter-Modus
  src/mode2/                 Hauptscreen- und Handy-Ansichten
  src/dev/                   Entwickler-Werkzeuge für das Brett
```

### Inhalte erweitern
Die Pools liegen in `shared/src/content/*.ts`, ein Eintrag pro Zeile. Neue Einträge einfach anhängen. Innerhalb einer Sitzung wiederholt sich nichts, bis ein Pool leer ist. Dann wird er neu gemischt. Die Tests prüfen Mindestgrößen und Duplikate.

### Feldkoordinaten / Brett austauschen
- **`/#/dev/board-debug`** zeichnet Nummern, Feldtypen und Verbindungen über das Brettbild (Weichen pink).
- **`/#/dev/feld-editor`**: Felder nacheinander anklicken, Typ und Nachbarn anpassen, `board.json` exportieren und unter `client/src/board/board.json` speichern.

### Schaltbare Regeln (`shared/src/mode2/constants.ts`)
- `KRONE_AUCH_BEIM_VORBEIGEHEN` (Standard `true`)
- `GELB_SPIELERTAUSCH` (Standard `true`)
- `GROSSE_KRONE_CHANCE` (Standard `0.3`)
- `SCHRITT_MS`, `GETRENNT_UEBERSPRINGEN_MS`, Spielerfarben, Standard-Timer

### Datenschutz
Es werden keine personenbezogenen Daten gespeichert. Lobbys existieren nur im Arbeitsspeicher des Servers und werden nach dem Spiel (spätestens nach 4 Stunden Inaktivität) gelöscht. Auf dem Gerät liegen nur der Spielstand (Modus 1) und das Wiederverbindungs-Token (Modus 2) im `localStorage`. Es gibt keine Cookies.

### Entwickler-Testmodus
Mit `KJ_DEBUG=1 npm start` akzeptiert der Server zusätzliche Test-Nachrichten (`debugMini`, `debugPhase`), um gezielt ein Minispiel oder eine Ereigniskarte zu starten. Im normalen Betrieb sind sie abgeschaltet.

---

## Annahmen

Vorgegebene, über Konstanten änderbare Annahmen:
- Kronen werden auch **beim Vorbeiziehen** eingesammelt, nicht nur beim Landen.
- Gelbe Kreispfeil-Felder bedeuten in Modus 2 **„Position mit einem beliebigen Mitspieler tauschen“** (wie die Ereigniskarte Spielertausch, 30 s Zeit, danach kein Tausch).
- +2 und −2 werden in Modus 2 automatisch ausgeführt, die Folgefelder lösen keine Effekte aus (Kronen werden dabei aber eingesammelt). +2 geht in Laufrichtung weiter (an einer Weiche geradeaus), −2 geht den gerade gelaufenen Weg zurück.
- Bei Minispielen spielen **alle** mit, die Belohnung sind **Bonusfelder** für den nächsten Zug (keine Kronen).
- Gezogen wird entlang der Strecke im Bild, nicht nach Feldnummern (siehe Hinweise zum Brett).
- Der Host ist nur Hauptscreen und kein Mitspieler.

Eigene Annahmen (einfachste sinnvolle Lösung):
- **Würfel-Einstellung:** Gespielt wird mit einem normalen Würfel (1 bis 6). In den Lobby-Einstellungen wird das nur angezeigt, nicht verändert.
- **Spiele mit 2 Teams** (Stirnraten, Montagsmaler) werden in beiden Modi erst ab 4 Spielern ausgelost. Spiele mit Zweier-Teams gehen ab 2 Spielern.
- **Bonusfelder** aus mehreren Spielen addieren sich, solange sie nicht verbraucht sind.
- **Game of 7:** Ein Fehlversuch setzt auf 0, das Team wirft in der nächsten Runde aber die aktuelle Aufprallzahl mit. Am Spielende zählt die erreichte Stufe auch bei Teams, die nicht eingeloggt haben. In Modus 2 ist das Spiel standardmäßig aktiv und kann in der Lobby abgeschaltet werden.
- **Zahlen erraten:** Die Kenner nennen Begriffe, deren „Größe“ zur Zahl passt (1 = winzig/wenig, 10 = riesig/sehr viel). In einem Dreierteam gibt es zwei Kenner. In Modus 2 läuft dafür ein Timer von 180 s (einstellbar).
- **Begriffe erklären:** Jedes Team spielt 2 Durchgänge, der Erklärer wechselt. In Modus 1 zeigt die Geheimansicht 12 Begriffe pro Durchgang.
- **Montagsmaler:** 8 Begriffe pro Durchgang. In Modus 2 kann der Zeichner einen Begriff überspringen.
- **Stirnraten (Modus 2):** Nur die Teampartner des Raters sehen den Begriff, das andere Team nicht.
- **Gegenstände merken (Modus 2):** Alle Handys fragen gleichzeitig dieselbe Nummer ab.
- **Stadt Land Fluss (Modus 2):** Eine Antwort ist abgelehnt, wenn mehr als die Hälfte der *anderen* Spieler sie als ungültig markiert. Die Prüfphase dauert höchstens 90 s.
- **Allgemeinwissen (Modus 2):** Ein Dreierteam ist gesperrt, wenn alle drei dieselbe Antwort wählen.
- **Kopfrechnen / Schätzmeister (Modus 2):** 45 s pro Aufgabe bzw. Frage (einstellbar).
- **Ereigniskarten:** Läuft beim Spielertausch die Zeit ab (30 s), wird nicht getauscht. Bei „Spiel aussuchen“ wird dann aus dem Stapel gelost. Der Feldersprung kann auf jedes Feld außer dem aktuellen führen, das Zielfeld hat keinen Effekt.
- **Kronen neu platzieren:** Eine Krone landet nie auf einem Feld, über das der ziehende Spieler im selben Zug noch läuft.
- **Kronen zum Sieg** ist in Modus 1 von 1 bis 30 einstellbar (in Modus 2 wie vorgegeben 3 bis 15).

### Hinweise zum Spielbrett
- Die Feldtypen im Bild stimmen mit der Vorgabe überein: grün +2 (4, 21, 30, 38), rot −2 (51, 64, 74), blau ?! (7, 14, 41, 45, 59), gelb (39, 55), lila (10, 35, 52, 57, 66, 69). Feld 23 ist normal.
- **Die Feldnummern sind nur Orientierung.** Gezogen wird entlang der Strecke, wie sie im Bild verläuft (z. B. von 1 nach links auf 68, nicht auf 76). Die Verbindungen stehen als `neighbors` in `board.json`.
- **Abzweigungen:** Bei 2 (nach 3 oder 43) sowie an den Einmündungen 9/10 ↔ 76, 19/20 ↔ 42, 25/26 ↔ 53, 31/32 ↔ 67 und 45/46 ↔ 54. Kommt eine Figur an eine Abzweigung, wählt der Spieler die Richtung für die restlichen Felder neu. An Einmündungen kann man keine Ecke abschneiden (z. B. nicht 76 → 9 → 10). Am Zugbeginn darf man in jede Richtung losgehen, im Zug nicht umkehren.
- Wer die Verbindungen ändern möchte, kann sie im Feld-Editor über die Nachbarlisten anpassen.
- Die Mittelpunkte der Felder wurden per Bildanalyse bestimmt: Nummern im Bild abgelesen, Overlay geprüft, mit Screenshots der Debug-Ansicht kontrolliert. Eine automatische Texterkennung (OCR) stand nicht zur Verfügung.
