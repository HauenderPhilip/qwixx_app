# Kreuzblock

Digitaler Wertungsblock zum Ankreuzen für Würfelspiele nach dem Qwixx-Prinzip. Gewürfelt wird
ganz normal mit echten Würfeln, angekreuzt wird in der App. Läuft auf **Android und iOS** (Expo / React Native).

## Spielblöcke

| Block | Beschreibung |
| --- | --- |
| Klassisch | Rot & Gelb 2→12, Grün & Blau 12→2 |
| Gemischte Zahlen | Jede Reihe einfarbig, Zahlen durcheinander |
| Gemischte Farben | Zahlen geordnet, Farben wechseln innerhalb der Reihe |
| Gespiegelt | Rot & Gelb 12→2, Grün & Blau 2→12 |
| Zickzack | Rot & Gelb 2, 12, 3, 11 … 7 – Grün & Blau 7, 6, 8, 5 … 12 |
| Zufallsblock | Zahlen, Farben oder beides zufällig gemischt; teilbar per Code (z. B. `M-4821`) |

Beim Zufallsblock ergibt derselbe Code auf jedem Gerät denselben Block. Jede Reihe enthält alle
Zahlen 2–12, jede Farbe kommt insgesamt 11-mal vor und jede Reihe endet mit einer anderen Farbe.

## Funktionen

- Ankreuzen nur von links nach rechts; übersprungene Felder werden ausgegraut.
- Das letzte Feld ist erst ab 5 Kreuzen in der Reihe frei. Wird es angekreuzt, ist die Reihe
  abgeschlossen und das Schloss zählt als Extra-Kreuz in dieser Reihe.
- Schließt ein Mitspieler eine Reihe ab, darf man im selben Wurf noch in dieser Reihe ankreuzen
  und sie ebenfalls abschließen. Danach aufs Schloss tippen – die Reihe wird gesperrt.
- Fehlwürfe (je −5), automatische Wertung pro Reihe (1, 3, 6, 10 … 78) und Gesamtsumme.
- Auch bei gemischten Farben wird pro Reihe gewertet, nicht nach Feldfarbe.
- Spielende-Hinweis bei zwei geschlossenen Reihen oder vier Fehlwürfen.
- Rückgängig, Spielstand wird automatisch gespeichert, Bildschirm bleibt an.

## Online gegeneinander spielen

Jeder spielt auf seinem eigenen Handy:

1. Einer tippt auf **Online spielen**, gibt seinen Namen ein und erstellt einen Raum. Er bekommt
   einen Raumcode aus 4 Buchstaben.
2. Die anderen öffnen die App bzw. Webseite, tippen auf **Online spielen**, geben ihren Namen und
   den Code ein und treten bei.
3. Rechts steht die Rangliste mit den Punkten aller. Schließt jemand eine Reihe ab, wird ihr
   Schloss bei allen anderen hervorgehoben: Sie kreuzen den Wurf noch zu Ende an (auch das letzte
   Feld, um selbst abzuschließen) und tippen dann aufs Schloss. Das Spiel endet für alle, wenn
   zwei Reihen zu sind oder jemand vier Fehlwürfe hat.
4. **Neue Runde** startet für alle eine neue Runde mit dem gewählten Block.

Die Verbindung läuft über den öffentlichen MQTT-Server `broker.emqx.io` (ohne Anmeldung). Namen
und Punkte kann jeder sehen, der den Raumcode kennt. Im claude.ai-Link funktioniert das
Online-Spiel nicht, weil dort keine fremden Server erreichbar sind.

**Web-Version:** https://hauenderphilip.github.io/qwixx_app/ – wird bei jedem Push über
GitHub Actions gebaut (`.github/workflows/pages.yml`). Einmalig im Repo unter
*Settings → Pages → Source* „GitHub Actions“ auswählen.

## Vollbild

- **App (Android/iOS):** startet im Querformat ohne Status- und Navigationsleiste.
- **Webseite:** Browser erlauben Vollbild erst nach einer Berührung. Am Handy wechselt die Seite
  deshalb beim ersten Antippen in den Vollbildmodus und dreht ins Querformat (Android/Chrome).
- **Zum Startbildschirm hinzufügen** (Android: Menü ⋮ → „Zum Startbildschirm hinzufügen“,
  iPhone: Teilen → „Zum Home-Bildschirm“): Dann startet die Seite wie eine App, ganz ohne
  Browserleiste. Auf dem iPhone ist das der einzige Weg zum Vollbild.

## Ausprobieren

```bash
npm install
npx expo start
```

Dann den QR-Code mit der App **Expo Go** (Android / iOS) scannen. Im Browser geht es mit `w`.

## Installierbare App bauen

Mit [EAS Build](https://docs.expo.dev/build/introduction/) (kein Xcode/Android Studio nötig):

```bash
npx eas-cli@latest build --platform android   # APK/AAB
npx eas-cli@latest build --platform ios       # benötigt Apple-Developer-Account
```

## Entwicklung

- `src/variants.ts` – Aufbau der Spielblöcke
- `src/game.ts` – Regeln und Wertung (reine Funktionen)
- `src/online.ts` – Online-Räume: Themen, Nachrichten, Regeln über alle Spieler
- `src/useOnlineRoom.ts` – Verbindung und Mitspieler als React-Hook
- `src/net/mqtt.ts` – kleiner MQTT-Client über WebSocket (ohne Abhängigkeiten)
- `src/components/` – Oberfläche
- `npm run typecheck` / `npm run lint` – Prüfungen

## Hinweis

Inoffizielle Spielhilfe zum Mitschreiben, nicht kommerziell. Kein offizielles Produkt und keine
Verbindung zum Nürnberger-Spielkarten-Verlag (NSV). „Qwixx“ ist eine Marke ihres Inhabers.
Zum Spielen braucht ihr das Originalspiel.
