# Morgenlicht

Lichtwecker im Browser: Das Display wird vor der Weckzeit langsam von Dunkelrot zu warmem Licht, danach weckt ein Naturton. Prototyp für eine spätere Android-App.

**Öffnen:** `Morgenlicht.html` (über GitHub Pages oder einen anderen https-Server).

## Auf dem Handy installieren

- **Android (Chrome):** Seite öffnen → Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Seite öffnen → Teilen → „Zum Home-Bildschirm“.

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
