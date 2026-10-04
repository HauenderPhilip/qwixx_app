# Qwixx Block

Digitaler Wertungsblock für das Würfelspiel **Qwixx**. Gewürfelt wird ganz normal mit echten
Würfeln, angekreuzt wird in der App. Läuft auf **Android und iOS** (Expo / React Native).

## Spielblöcke

| Block | Beschreibung |
| --- | --- |
| Klassisch | Rot & Gelb 2→12, Grün & Blau 12→2 |
| Gemischte Zahlen | Jede Reihe einfarbig, Zahlen durcheinander (Qwixx Mixx) |
| Gemischte Farben | Zahlen geordnet, Farben wechseln innerhalb der Reihe (Qwixx Mixx) |

## Funktionen

- Ankreuzen nur von links nach rechts; übersprungene Felder werden ausgegraut.
- Das letzte Feld ist erst ab 5 Kreuzen in der Reihe frei. Wird es angekreuzt, ist die Reihe
  abgeschlossen und das Schloss zählt als Extra-Kreuz in der Farbe des Schlosses.
- Schließt ein Mitspieler eine Reihe ab: aufs Schloss tippen – die Reihe wird gesperrt.
- Fehlwürfe (je −5), automatische Wertung pro Farbe (1, 3, 6, 10 … 78) und Gesamtsumme.
- Bei „Gemischte Farben“ zählen Kreuze nach der Farbe des Feldes.
- Spielende-Hinweis bei zwei geschlossenen Reihen oder vier Fehlwürfen.
- Rückgängig, Spielstand wird automatisch gespeichert, Bildschirm bleibt an.

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
- `src/components/` – Oberfläche
- `npm run typecheck` – TypeScript-Prüfung
