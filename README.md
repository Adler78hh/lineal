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
  - Antippen einer Stelle, an der sich zwei gezeichnete Linien kreuzen oder treffen (auch T- oder L-förmig) oder eine gezeichnete Linie den Rahmen (Kreis oder Seite), eine vorgegebene Strecke oder einen vorgegebenen Kreis kreuzt oder berührt, zeigt dort ein grünes „+“ (z. B. 34-1: die fehlenden Marken oben und unten am Kreis).
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
  - Rückmeldung: Richtige Stücke bekommen ein grünes Band, überzählige ein rotes. Ein Kasten sagt in Worten, wie viele Linien der Vorlage ganz richtig sind und wie viele noch fehlen (unter der Vorlage bzw. im Hochformat unten auf der Zeichenfläche).
  - Die Lupe mit „Tipp“ im Kasten zeigt, was fehlt: fehlende Stücke gestrichelt, fehlende Flächen grau und – pink – die Kreuzungen, die man als Punkte anlegen muss (`helpPoints`: Linienenden außerhalb des Rasters und Punkte auf dem Weg dorthin, z. B. S1, S2 in 34-1). Noch einmal tippen blendet den Tipp aus.
  - Bei „alles richtig“ gibt es einen Stern und den Knopf „Nächste Aufgabe“. Jede Änderung an der Zeichnung, Antippen des Kastens oder eine andere Aufgabe blendet die Rückmeldung aus.

- Ausmalen
  - „Ausmalen“ gibt es bei jeder Aufgabe. Darunter erscheint eine Farbleiste: zehn kräftige Farben nach dem Regenbogen, mit Schwarz vorn (Schwarz, Kakao, Mohnrot, Kürbis, Senf, Tannengrün, Petrol, Nachtblau, Pflaume, Beere), zehn blasse, jede unter ihrer kräftigen (Hellgrau, Sand, Lachs, Aprikose, Vanille, Lind, Mint, Eisblau, Flieder, Rosa) und das Regenbogenfeld; die letzten drei eigenen Farben werden gemerkt (`src/ui/colors.ts`).
  - Das Regenbogenfeld öffnet das eigene Farbfenster „Farbe wählen“ (`src/ui/colorPicker.ts`, statt der Farbauswahl des Geräts): „Raster“ mit 12 × 10 Feldern wie bei Apple (oben Grau von Weiß bis Schwarz, darunter der Regenbogen von hell nach dunkel) oder „Spektrum“ zum Antippen und Darüberziehen. Die Farbe gilt sofort; „fertig“ oder Tippen daneben schließt das Fenster, erst dann kommt die Farbe zu den eigenen. Die Ansicht wird gemerkt. Das Fenster sitzt unter dem Knopf und passt immer ganz auf den Bildschirm, die Felder sind 14–52 px groß.
  - Antippen einer Fläche malt sie in der gewählten Farbe aus, mit derselben Farbe noch einmal wird sie wieder weiß.
  - Gespeichert wird die Form der Fläche beim Ausmalen: Radiert man danach eine Linie weg, behält jede Farbfläche ihre Form, nichts verschmilzt.
  - Auf der Startseite zeigt die Kachel das eigene Bild des Kindes (Linien und Farben), sobald es eines gibt.

- Ansicht
  - „Dünn“ in der Leiste schaltet alle Linien von Vorlage und Zeichenfläche auf etwa halbe Stärke und zurück (Rasterpunkte bleiben gleich groß). Gut für Figuren mit vielen Linien.
  - Die Lupe oben rechts in der Vorlage macht sie so groß wie die Zeichenfläche (quer nebeneinander, hochkant übereinander) und wieder klein.
  - Beides wird gemerkt.

- Meilenstein 8: PWA und GitHub Pages
  - Installierbar („Zum Home-Bildschirm“), eigenes Icon, läuft im Vollbild.
  - Offline: Beim ersten Besuch speichert der Service Worker die ganze App (die Dateiliste erzeugt `vite.config.ts` beim Bauen). Seiten kommen zuerst aus dem Netz (für Updates), sonst aus dem Speicher.
  - Ältere iPads: Build für Safari 14, Hinweis statt weißer Seite, wenn die App nicht startet.

## Startseite, Kapitel und Unterkapitel

Die Startseite zeigt die fünf Kapitel des Buchs mit ihren Unterkapiteln, nach Inhalt gruppiert
(22 statt der 74 Buchseiten). Kapitel und Unterkapitel lassen sich auf- und zuklappen (das Gerät
merkt sich, was offen ist). Jede Aufgabe ist ein kleines Bild ihrer Figur – oder des eigenen
Bildes des Kindes –, gelöste Aufgaben haben einen Stern. Das Haus oben links führt zurück.

Innerhalb eines Unterkapitels bleibt die Reihenfolge des Buchs; die Pfeile „vorige/nächste
Aufgabe“ folgen dieser Reihenfolge über alle Unterkapitel. Die Kopfzeile zeigt z. B.
„2.4 · Aufgabe 5 von 8“ und „Doppelpfeil · S. 34“ (die Buchseite).

Das Druckersymbol eines Unterkapitels lädt ein Arbeitsblatt als PDF herunter (`Lineal-2-4.pdf`):
je Aufgabe links die Vorlage (mit Buchseite), rechts das leere Raster zum Zeichnen mit einem
echten Lineal, drei Aufgaben pro A4-Blatt, oben Platz für den Namen. Das PDF entsteht im Gerät
(`src/print/`), ohne Server und ohne Bibliothek.

Die Gliederung steht in `tasks/blocks.json`: Kapitel mit ihren Unterkapiteln (Nummer, Name,
Liste der Aufgaben-`id`s in der gezeigten Reihenfolge). Unter `hidden` stehen Wiederholungen
des Buchs, die die App nicht zeigt (42-1 wie 37-1, 45-1 bis 45-4 wie Seite 39). Zu welcher
Buchseite eine Aufgabe gehört, ergibt sich aus ihrer `id`: `s05-03` ist die 3. Aufgabe auf Seite 5.

| Kapitel | Unterkapitel | Aufgaben |
| --- | --- | --- |
| 1 Einstieg ins geometrische Zeichnen | 1.1 Erste Übungen | 18 |
| 1  | 1.2 Felder, Kreuze und Rauten | 18 |
| 1  | 1.3 Erste Ausmalbilder | 21 |
| 1  | 1.4 Strahlen und Knicklinien | 7 |
| 1  | 1.5 Sehnen im Kreis | 13 |
| 1  | 1.6 Fadenbilder und Fächer | 13 |
| 2 Sterne | 2.1 Sechs- und Achtsterne im Kreis | 16 |
| 2  | 2.2 Fünf-, Neun- und Zehnsterne | 7 |
| 2  | 2.3 Sterne im Quadrat | 15 |
| 2  | 2.4 Windräder, Pfeile und Windrosen | 8 |
| 3 Muster in Quadraten | 3.1 Felder und Kreuze | 10 |
| 3  | 3.2 Rauten | 11 |
| 3  | 3.3 Sterne und Strahlen | 10 |
| 3  | 3.4 Gitter, Flechtmuster und Windräder | 9 |
| 3  | 3.5 Pyramiden, Rahmen und Streifen | 9 |
| 4 Hüllkurven | 4.1 Fadenwinkel und Bögen | 8 |
| 4  | 4.2 Sterne aus Fadenwinkeln | 5 |
| 4  | 4.3 Kreise in Vielecken | 8 |
| 4  | 4.4 Fächer und Sehnenbilder | 10 |
| 5 3-D-Bilder | 5.1 Würfel, Kästen und Schachteln | 14 |
| 5  | 5.2 Rahmen und unmögliche Figuren | 9 |
| 5  | 5.3 Sterne, Rauten und Flechtmuster | 12 |

## Aufgaben

Jede Datei in `tasks/` (außer `blocks.json`) ist eine Aufgabe; gezeigt werden sie in der Reihenfolge von `blocks.json`.
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

Weitere Felder, alle optional:

| Feld | Bedeutung |
| --- | --- |
| `note` | Hinweis für die Lehrkraft, z. B. dass ein Endpunkt erst als Schnittpunkt entsteht (s05-10) |
| `gridStyle` | `"dots"` (Standard) oder `"ticks"`: Rasterpunkte auf Rahmen oder vorgegebenen Strecken erscheinen als Markierungsstriche |
| `givenLines` | Strecken, die schon da sind wie der Rahmen (z. B. eine Strecke mit 20 Teilen, s12-01) |
| `givenCircles` | Kreise, die schon da sind (`cx`, `cy`, `r`); anders als ein Kreisrahmen begrenzen sie nichts |
| `helpLines` | Hilfslinien, die das Buch zum Zeichnen und Wiederwegradieren vorschlägt; sie werden nicht angezeigt, aber getestet |
| `helpPoints` | Kreuzungen auf dem Weg, die „Tipp“ pink zeigt; Linienenden außerhalb des Rasters kommen von selbst dazu. Der Import nimmt die `hilfspunkte` der Sammlung oder sucht einen Konstruktionsweg |
| `labels` | Namen und Nummern an Punkten (`{ "at": [x, y], "text": "A" }`), auf der Zeichenfläche und im Arbeitsblatt; aus `beschriftungen`, `nummern` und benannten Punkten der Sammlung |
| `areas` | Flächen zum Ausmalen (in der Vorlage schwarz), als Vielecke. Prüfen vergleicht dann auch die Flächen: jede Farbe zählt als ausgemalt, bunte Felder außerhalb der Flächen gelten als zu viel. |

Rahmen-Typen:

- `{ "type": "rect", "w": 12, "h": 12 }`: Rechteck, auch hochkant (z. B. 8 × 12)
- `{ "type": "circle", "n": 8 }`: Kreis mit n gleich verteilten Rasterpunkten; mit `"visible": false` wird der Kreis nicht gezeichnet (nur seine Markierungen, s14-01)
- `{ "type": "polygon", "n": 6 }`: regelmäßiges n-Eck, die Ecken sind Rasterpunkte
- `{ "type": "polygon", "vertices": [[6,12],[0,6],…] }`: beliebiges Vieleck (z. B. Achteck mit Fasen, s69-03)
- `{ "type": "open", "w": 12, "h": 12 }`: kein Rahmen

Kreis und n-Eck haben optional `cx`, `cy` (Standard 6, 6), `r` (Standard 6) und
`rotation` in Grad (Standard 90: erster Punkt oben).

Ein Test prüft für jede Aufgabe, dass sich alle Ziellinien mit dem Lineal zeichnen lassen:
von Rasterpunkten aus, über Schnittpunkte von Linien zwischen zwei Rasterpunkten und über
Schnittpunkte von Ziel-, Hilfs- und vorgegebenen Linien, zuletzt als Schnittpunkt zweier
verlängerter Linien durch solche Punkte. Für Aufgaben mit Flächen prüft ein
weiterer Test, dass die Flächen genau zu den Feldern der Zeichnung passen.

### Aufgaben aus einer Figurensammlung übernehmen

Die Seiten 6–78 stammen aus einer Figurensammlung im Format `figuren_*.json` (Ursprung oben
links, y nach unten, beliebige Größe). Das Skript rechnet sie um:

```sh
node scripts/import-figuren.mjs figuren_alle.json --pages 6-78   # Seite 5 bleibt, wie sie ist
node scripts/import-figuren.mjs figuren_alle.json --out /tmp/x   # zum Vergleichen
```

Es dreht die y-Achse um, skaliert die längere Seite auf 12, ersetzt gerundete Kreis- und
Schnittpunkte durch exakte Werte und schreibt `tasks/sPP-NN.json` (z. B. `6-1` → `s06-01`).

Auch das Träger-Format der Hüllkurven (Seiten 51–64, `"raster": { "art": "traeger" }`)
versteht das Skript: Strecken mit Teilung werden vorgegebene Strecken mit Markierungen,
Punktreihen und benannte Punkte werden Rasterpunkte, Kreise werden vorgegebene Kreise
(`givenCircles`, kein Rahmen). Die Linienenden kommen aus den `verbindungen`, also genau
auf die Teilungspunkte. Ein Hinweis `unsicher` wird an `note` angehängt.

Weitere Raster-Arten: `polygon` und `polygon_mit_markierungen` (das Vieleck ist der Rahmen),
`kreis_mit_marken` (Kreisrahmen, die `ticks` sind die Marken), `punkte_frei` (Punkte auf einem
nicht gezeichneten Kreis), `figur_vorgegeben` (die `linien` des Rasters sind vorgegeben).
Linienenden, die im Foto gemessen und daher ungenau sind, rasten auf den nächsten Schnittpunkt
von Linien zwischen Rasterpunkten ein (bis 0,03), notfalls über einen zweiten
Konstruktionsschritt. Bleibt ein Ende trotzdem unerreichbar, bekommt der Rahmen Marken, wo die
verlängerte Linie ihn trifft (das Skript meldet das).

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
npm run single   # die ganze App in einer Datei: dist-single/lineal.html (zum Einbinden oder Weitergeben)
```

## Aufbau

- `src/geometry/`: reine Mathematik ohne DOM, mit Tests
  - Punkte, Aufgaben einlesen, Bildschirm-Abbildung, Schnittpunkte
  - `segments.ts`: Teilstrecken; `frame.ts`: Rahmen; `draw.ts`: vom Wisch zur Linie; `crossings.ts`: Kreuzungen der Zeichnung; `erase.ts`: Radierer; `faces.ts`: Flächen zum Ausmalen; `check.ts`: Prüfen
  - `ruler.ts`: Lage des Lineals und Einrasten
  - `gesture.ts`: Bewegung aus Finger-Gesten
- `src/state/`: Aufgabenliste, App-Zustand, `rulerModel.ts` (Drehpunkt-Logik ohne DOM, mit Tests)
- `src/print/`: PDF-Arbeitsblätter (`pdf.ts`: kleiner PDF-Schreiber, `worksheet.ts`: Aufbau)
- `src/ui/`: Oberfläche, Zeichnen als SVG; `board.ts` verteilt die Eingaben auf Lineal und Stift
