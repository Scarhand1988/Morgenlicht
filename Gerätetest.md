# Morgenlicht – Gerätetest

Ziel: herausfinden, ob der Browser-Wecker auf echten Handys eine ganze Nacht zuverlässig weckt. Mindestens ein Android-Handy (Chrome) und ein iPhone (Safari) testen, je einmal im Browser-Tab und einmal als installierte App.

## Vorbereitung

1. Den Ordner `outputs` über **https** erreichbar machen (zum Beispiel GitHub Pages oder Netlify). Als lokal geöffnete Datei funktionieren Installation, Offline-Betrieb und teils die Display-Sperre nicht.
2. Seite auf dem Handy öffnen → **Weitere Einstellungen → Gerät prüfen** → **Ergebnis kopieren** und unten einfügen.
3. Handy ans Ladekabel, Lautlos aus, Medienlautstärke mittel, Displayhelligkeit hoch.

## Kurztest (15 Minuten)

| # | Schritt | Erwartung | Android | iPhone |
|---|---|---|---|---|
| 1 | „Sonnenaufgang testen“ | Licht wird in 15 s hell, danach Ton, „Guten …“-Bildschirm | | |
| 2 | „Ton anhören“ bei allen Tönen | Beginnt leise, kein Knacken beim Wiederholen | | |
| 3 | Eigene Audiodatei wählen, anhören | Ähnlich laut wie die eingebauten Töne | | |
| 4 | Weckzeit über die Drehräder auf jetzt + 12 Min. stellen, Lichtvorlauf 10 Min. | Bestätigung zeigt „Licht ab …“ und Schlafdauer | | |
| 5 | Im Dialog „Helligkeit testen“ | 5 s helles Warmgelb, Tippen schließt | | |
| 6 | Wecker stellen, Handy liegen lassen | Dunkle Nachtanzeige, Hinweis „Display bleibt an · lädt“ | | |
| 7 | Nach 2 Min. Licht | Sonnenaufgang beginnt, Display geht nicht aus | | |
| 8 | Weckzeit | Ton beginnt leise, Vibration (nur Android) | | |
| 9 | Kurz auf „Aufstehen“ tippen | Nichts passiert (muss gehalten werden) | | |
| 10 | „Schlummern“, warten | Klingelt nach der Schlummerzeit erneut | | |
| 11 | „Aufstehen“ gedrückt halten | Wecker endet, Statusmeldung erscheint | | |

## Nachttest

| # | Schritt | Erwartung | Android | iPhone |
|---|---|---|---|---|
| 12 | Abends mit Einschlaflicht 20 Min. stellen | Rotes Licht dimmt, Naturton wird leiser | | |
| 13 | Nacht durchlaufen lassen | Morgens Sonnenaufgang und Ton zur Weckzeit | | |
| 14 | Akkustand abends / morgens | Notieren | | |
| 15 | Mit Energiesparmodus wiederholen | Weckt trotzdem? | | |
| 16 | Seite nachts neu laden (Test) | Hinweis „Wecker noch gestellt“, Fortsetzen funktioniert | | |
| 17 | 25 Min. klingeln lassen, nicht reagieren | Schlummert nach 20 Min. automatisch | | |

## Ergebnis „Gerät prüfen“

```
Android:

iPhone:
```

## Beobachtungen

- 
