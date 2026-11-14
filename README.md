# Sunrise Clock (Morgenlicht)

A light alarm clock: before the alarm time your screen slowly turns from dark red to warm light, then a nature sound wakes you gently. Works as a web app and as an Android app. The interface is available in **English and German** (follows your phone language, or choose under *More settings → Language*).

Sunrise Clock ist ein Lichtwecker: Vor der Weckzeit wird das Display langsam von Dunkelrot zu warmem Licht, danach weckt ein Naturton. Die Oberfläche gibt es auf **Deutsch und Englisch** (folgt der Handysprache oder unter *Weitere Einstellungen → Sprache*).

## Install / Installieren

- **Android (APK):** [Download SunriseClock.apk](https://github.com/Scarhand1988/Morgenlicht/releases/latest/download/SunriseClock.apk), open the file and allow installation from this source the first time. / Datei öffnen und beim ersten Mal die Installation aus dieser Quelle erlauben.
- **Android (Chrome):** open the page → menu ⋮ → “Install app”.
- **iPhone (Safari):** open the page → Share → “Add to Home Screen”.
- **Web:** open `Morgenlicht.html` (via GitHub Pages or any https server).

## Features / Funktionen

- Sunrise light before the alarm (10–30 min), adjustable brightness, optional sun view / Sonnenaufgang-Licht mit einstellbarer Helligkeit
- 8 nature sounds or your own file, quiet nature sound already during the sunrise (optional) / 8 Naturtöne oder eigene Datei
- Different alarm time per weekday / eigene Weckzeit je Wochentag
- Snooze, sleep light with nature sound, night view with optional clock / Schlummern, Einschlaflicht, Nachtansicht
- **Android app:** a real system alarm. It starts light and sound even when the phone is locked, repeats automatically and survives a restart. It warns about missing permissions. Optional morning overview of today's calendar appointments (read on the device only).
  / **Android-App:** echter Systemalarm, startet bei gesperrtem Handy, wiederholt sich automatisch, übersteht einen Neustart, meldet fehlende Freigaben, optional Terminüberblick am Morgen (nur auf dem Gerät gelesen).

In the browser the alarm only works while the page is open and the phone stays unlocked (plug in the charger). / Im Browser funktioniert der Wecker nur, solange die Seite offen und das Handy entsperrt bleibt.

## Build / Aufbau

| File | Content |
|---|---|
| `Morgenlicht.html`, `morgenlicht.css`, `morgenlicht.js` | page, design, controls |
| `morgenlicht-i18n.js` | languages (German texts in code, English translations) |
| `morgenlicht-zeit.js`, `morgenlicht-klang.js` | time logic and sound (testable in Node) |
| `morgenlicht-sw.js`, `morgenlicht.webmanifest`, icons | installation and offline use |
| `sounds/` | nature recordings, sources in `sounds/QUELLEN.md` |
| `android/` | Android app shell in Java (system alarm, calendar bridge) |
| `tests/` | automatic tests: `npm test` |

The APK is built on every change by `.github/workflows/android-apk.yml` and published under *Releases*.

## Android: signing key / Signaturschlüssel

If the repository secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` exist, the workflow signs the APK with them. Without them it uses the public key in `android/morgenlicht.keystore`. Switching from one key to the other requires uninstalling the app once.
