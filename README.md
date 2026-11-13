# Morgenlicht

Lichtwecker im Browser: Das Display wird vor der Weckzeit langsam von Dunkelrot zu warmem Licht, danach weckt ein Naturton. Prototyp für eine spätere Android-App.

**Öffnen:** `Morgenlicht.html` (über GitHub Pages oder einen anderen https-Server).

## Auf dem Handy installieren

- **Android (Chrome):** Seite öffnen → Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Seite öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android als APK:** [Morgenlicht.apk herunterladen](https://github.com/Scarhand1988/Morgenlicht/releases/latest/download/Morgenlicht.apk) → Datei öffnen → beim ersten Mal „Installation aus dieser Quelle erlauben“. Die App enthält alle Dateien und läuft offline; solange sie geöffnet ist, bleibt das Display an. Gebaut wird sie bei jeder Änderung automatisch über `.github/workflows/android-apk.yml` aus dem Ordner `android/` (App-Hülle in Java). Signiert wird mit `android/morgenlicht.keystore`, damit Updates sich über die alte Version installieren lassen. Der Schlüssel liegt öffentlich im Repo; für eine eigene Veröffentlichung kann er über die Umgebungsvariablen `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` und `KEY_PASSWORD` ersetzt werden.

Danach unter „Weitere Einstellungen → Gerät prüfen“ testen, was das Gerät unterstützt. Der Testplan steht in `Gerätetest.md`.

## Wichtig

Der Browser-Wecker funktioniert nur, solange die Seite geöffnet und das Handy entsperrt bleibt (Ladekabel anschließen).

## Aufbau

| Datei | Inhalt |
|---|---|
| `Morgenlicht.html`, `morgenlicht.css`, `morgenlicht.js` | Seite, Gestaltung, Bedienung |
| `morgenlicht-zeit.js`, `morgenlicht-klang.js` | Zeitrechnung und Klang (auch in Node testbar) |
| `morgenlicht-sw.js`, `morgenlicht.webmanifest`, Icons | Installation und Offline-Betrieb |
| `sounds/` | Naturaufnahmen, Herkunft in `sounds/QUELLEN.md` |
| `tests/` | Automatische Tests: `npm test` |
