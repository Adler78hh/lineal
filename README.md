# Lineal

Tablet-App (PWA) für die Klassen 1–4: Kinder zeichnen geometrische Figuren mit
einem virtuellen Lineal nach. Bedienung mit Finger oder Maus, Oberfläche auf Deutsch.

## Stand

- Meilenstein 1: Aufgaben laden, Rahmen, Rasterpunkte (ein-/ausblendbar) und
  Zielfigur anzeigen, zwischen Aufgaben blättern.
- Meilenstein 2: Lineal (Knopf blendet es ein/aus)
  - Verschieben mit einem Finger oder der Maus.
  - Drehen mit zwei Fingern (der zweite Finger darf auch neben dem Lineal liegen), mit den runden Griffen auf dem Lineal oder mit dem Mausrad.
  - Magnet: Liegt ein Rasterpunkt näher als 12 px an der Zeichenkante, läuft die Kante genau durch ihn; liegt danach ein zweiter Punkt in der Nähe, dreht sich das Lineal um den ersten, bis es durch beide läuft.
  - Eingerastete Punkte sind orange umkreist. Wegziehen um mehr als 12 px löst das Lineal wieder.

- Meilenstein 3: Drehpunkt-Logik
  - Ein Punkt eingerastet: Er ist der Drehpunkt. Ziehen am Lineal (oder an einem Griff, mit zwei Fingern, mit dem Mausrad) dreht um ihn; kommt dabei ein zweiter Punkt an die Kante, rastet das Lineal dort ein.
  - Zwei Punkte eingerastet: Das Lineal ist fixiert (orangener Rand).
  - Lösen:
    - Das Lineal deutlich wegziehen (48 px). Beim Fixieren reicht jede Richtung; beim Drehpunkt muss man vom Punkt weg ziehen, denn quer dazu dreht das Lineal.
    - Oder einen orangen Punkt antippen. Bei zwei Punkten bleibt dann der andere als Drehpunkt.
    - Ein gelöster Punkt zieht erst wieder an, wenn die Kante ihn einmal verlassen hat.
  - Stecknadel: Langes Drücken (0,6 s) auf einen orangen Punkt. Der Ring füllt sich, dann steckt die Nadel. Der Punkt bleibt Drehpunkt, egal wie stark man zieht, bis man ihn erneut antippt.

- Meilenstein 4: Zeichnen per Wisch
  - Ein Wisch entlang der Zeichenkante (bis 40 px daneben, 8 px auf dem Lineal) zeichnet eine Linie.
  - Der Wisch wird auf die Kante projiziert. Seine Enden rasten auf den nächsten Halt der Kante: Rasterpunkt, Rahmenrand oder Schnitt mit einer gezeichneten Linie.
  - Für Magnet und Linienenden zählt die ganze Gerade der Kante innerhalb des Rahmens, auch über die Enden des Lineals hinaus.
  - Linien werden intern an allen Raster- und Schnittpunkten in Teilstrecken zerlegt; doppelt Gezeichnetes zählt einmal.
  - Die Zeichnung wird je Aufgabe gemerkt.

- Meilenstein 5: Schnittpunkte
  - Antippen einer Stelle, an der sich zwei gezeichnete Linien kreuzen oder treffen (auch T- oder L-förmig), zeigt dort ein grünes „+“.
  - Antippen des „+“ macht den Schnittpunkt zu einem neuen magnetischen Rasterpunkt (grün statt blau); Antippen woanders schließt das „+“.
  - Neue Punkte wirken wie die alten: Magnet, Linienenden, Zerlegung in Teilstrecken. Sie werden je Aufgabe gemerkt.

- Meilenstein 6: Radierer und Rückgängig
  - Radierer: Antippen löscht genau die Teilstrecke zwischen den zwei nächsten Raster- oder Schnittpunkten (die nächstgelegene); Wischen löscht alle überstrichenen.
    - Wo nichts mehr hält (z. B. eine Kreuzung, deren zweite Linie schon weg ist), geht das Löschen gerade weiter.
    - Das Lineal ruht währenddessen (blass). Der Knopf „Lineal“ schaltet zurück zum Lineal.
  - Zurück (auch Strg+Z): macht Linie, Schnittpunkt oder einen ganzen Radier-Wisch rückgängig. Der Verlauf gilt je Aufgabe, solange die App offen ist.

- Meilenstein 7: Prüfen
  - Vergleicht die gezeichneten Teilstrecken mit `targetLines` (Toleranz 0,001). Wie die Linien gezeichnet wurden, ist egal: in Teilen, rückwärts, doppelt.
  - Linien auf dem Rahmen zählen nicht als Fehler.
  - Rückmeldung: Fehlende Stücke erscheinen dezent gestrichelt, überzählige bekommen ein rotes Band. Ein Kasten sagt es in Worten (unter der Vorlage bzw. im Hochformat unten auf der Zeichenfläche).
  - Bei „alles richtig“ gibt es einen Stern und den Knopf „Nächste Aufgabe“. Jede Änderung an der Zeichnung, Antippen des Kastens oder eine andere Aufgabe blendet die Rückmeldung aus.

- Meilenstein 8: PWA und GitHub Pages
  - Installierbar („Zum Home-Bildschirm“), eigenes Icon, läuft im Vollbild.
  - Offline: Beim ersten Besuch speichert der Service Worker die ganze App (die Dateiliste erzeugt `vite.config.ts` beim Bauen). Seiten kommen zuerst aus dem Netz (für Updates), sonst aus dem Speicher.
  - Ältere iPads: Build für Safari 14, Hinweis statt weißer Seite, wenn die App nicht startet.

## Startseite und Blöcke

Die Startseite zeigt die fünf Blöcke des Buchs mit ihren Seiten. Jede Aufgabe ist ein kleines Bild
ihrer Figur, gelöste Aufgaben haben einen Stern. Das Haus oben links führt zurück.

Die Blöcke stehen in `tasks/blocks.json` (Titel und Seitenbereich). Zu welcher Seite eine Aufgabe
gehört, ergibt sich aus ihrer `id`: `s05-03` ist die 3. Aufgabe auf Seite 5.

| Block | Seiten |
| --- | --- |
| Einstieg ins geometrische Zeichnen | 5–20 |
| Sterne | 21–36 |
| Muster in Quadraten | 37–50 |
| Hüllkurven | 51–64 |
| 3-D-Bilder | 65–78 |

## Aufgaben

Jede Datei in `tasks/` (außer `blocks.json`) ist eine Aufgabe; sie werden nach `id` sortiert.
Koordinaten 0–12, Ursprung unten links.

```json
{
  "id": "s05-03",
  "title": "3 Streifen mit Diagonale",
  "frame": { "type": "rect", "w": 12, "h": 12 },
  "gridPoints": [[0,0],[12,0],[12,12],[0,12],[0,4],[12,4],[0,8],[12,8]],
  "targetLines": [[[0,4],[12,4]], [[0,8],[12,8]], [[0,12],[12,0]]]
}
```

Optional ist `note`: ein Hinweis für die Lehrkraft, z. B. dass ein Endpunkt erst
als Schnittpunkt entsteht und zum Rasterpunkt gemacht werden muss (s05-10).

Rahmen-Typen:

- `{ "type": "rect", "w": 12, "h": 12 }`
- `{ "type": "circle", "n": 8 }`: Kreis mit n gleich verteilten Rasterpunkten
- `{ "type": "polygon", "n": 6 }`: regelmäßiges n-Eck, die Ecken sind Rasterpunkte

Kreis und n-Eck haben optional `cx`, `cy` (Standard 6, 6), `r` (Standard 6) und
`rotation` in Grad (Standard 90: erster Punkt oben).

## Veröffentlichen

Bei jedem Push auf `main` testet und baut GitHub Actions die App und veröffentlicht sie
auf GitHub Pages unter `https://adler78hh.github.io/lineal/`. Dafür muss einmalig unter
*Settings → Pages → Source* „GitHub Actions“ ausgewählt sein.

## Entwicklung

```sh
npm install
npm run dev      # Entwicklungsserver
npm test         # Geometrie-Tests
npm run build    # statische Seite in dist/
```

## Aufbau

- `src/geometry/`: reine Mathematik ohne DOM, mit Tests
  - Punkte, Aufgaben einlesen, Bildschirm-Abbildung, Schnittpunkte
  - `segments.ts`: Teilstrecken; `frame.ts`: Rahmen; `draw.ts`: vom Wisch zur Linie; `crossings.ts`: Kreuzungen der Zeichnung; `erase.ts`: Radierer; `check.ts`: Prüfen
  - `ruler.ts`: Lage des Lineals und Einrasten
  - `gesture.ts`: Bewegung aus Finger-Gesten
- `src/state/`: Aufgabenliste, App-Zustand, `rulerModel.ts` (Drehpunkt-Logik ohne DOM, mit Tests)
- `src/ui/`: Oberfläche, Zeichnen als SVG; `board.ts` verteilt die Eingaben auf Lineal und Stift
