/* Morgenlicht – Zeitrechnung.
   Kommt ohne Bildschirm aus und läuft deshalb auch in Node (für die automatischen Tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MorgenlichtZeit = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MINUTE = 60000;
  const DAY = 86400000;
  const TEXT = {
    de: {today: 'heute', tomorrow: 'morgen', Today: 'Heute', Tomorrow: 'Morgen', day: ' Tag', days: ' Tagen', hour: ' Std.', min: ' Min.',
      once: 'Einmalig', daily: 'Täglich', workdays: 'Mo–Fr', weekend: 'Wochenende', short: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
      morning: 'Guten Morgen', noon: 'Guten Tag', evening: 'Guten Abend', locale: 'de-DE'},
    en: {today: 'today', tomorrow: 'tomorrow', Today: 'Today', Tomorrow: 'Tomorrow', day: ' day', days: ' days', hour: ' h', min: ' min',
      once: 'Once', daily: 'Daily', workdays: 'Mon–Fri', weekend: 'Weekend', short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      morning: 'Good morning', noon: 'Good afternoon', evening: 'Good evening', locale: 'en-GB'}
  };
  let tx = TEXT.de;
  let fmtWeekday = new Intl.DateTimeFormat(tx.locale, {weekday: 'long'});
  /** Sprache der Texte umschalten: 'de' (Standard) oder 'en' */
  function setLanguage(lang) {
    tx = TEXT[lang] || TEXT.de;
    fmtWeekday = new Intl.DateTimeFormat(tx.locale, {weekday: 'long'});
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /** "07:30" -> [7, 30], sonst null */
  function parseTime(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value));
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  /** Nächster Weckzeitpunkt nach `now` (ms), nur an den gewählten Wochentagen (0 = Sonntag). */
  function nextWake(value, activeDays, now, times) {
    if (!parseTime(value)) throw new RangeError('Ungültige Weckzeit: ' + value);
    for (let offset = 0; offset <= 7; offset++) {
      const target = new Date(now);
      target.setDate(target.getDate() + offset);
      // Eigene Zeit für diesen Wochentag, sonst die Standard-Weckzeit
      const [hour, minute] = parseTime(times && times[target.getDay()]) || parseTime(value);
      target.setHours(hour, minute, 0, 0);
      if (+target > now && (!activeDays.length || activeDays.includes(target.getDay()))) return +target;
    }
    return now + DAY;
  }

  /** Lichtbeginn, Weckzeit und Einschlaflicht für eine Nacht. Minutenangaben in `settings`. */
  function plan(settings, now) {
    const end = nextWake(settings.wake, settings.days, now, settings.times);
    let start = end - settings.lead * MINUTE;
    const shortened = start < now;
    if (shortened) start = now;
    let sleepStart = 0, sleepEnd = 0;
    if (settings.sleep) {
      sleepStart = now;
      sleepEnd = Math.min(now + settings.sleep * MINUTE, start);
      if (sleepEnd - sleepStart < MINUTE) sleepStart = sleepEnd = 0;
    }
    return {start, end, shortened, sleepStart, sleepEnd};
  }

  /** Kalendertage zwischen zwei Zeitpunkten (robust bei Zeitumstellung). */
  function dayOffset(ms, now) {
    const a = new Date(now); a.setHours(12, 0, 0, 0);
    const b = new Date(ms); b.setHours(12, 0, 0, 0);
    return Math.round((b - a) / DAY);
  }

  function dayWord(ms, now, capital) {
    const diff = dayOffset(ms, now);
    if (diff === 0) return capital ? tx.Today : tx.today;
    if (diff === 1) return capital ? tx.Tomorrow : tx.tomorrow;
    return fmtWeekday.format(ms);
  }

  /** Dauer als Text, aufgerundet auf volle Minuten. */
  function fmtIn(ms) {
    const total = Math.max(1, Math.ceil(ms / MINUTE));
    const d = Math.floor(total / 1440), h = Math.floor(total % 1440 / 60), m = total % 60;
    if (d) return d + (d === 1 ? tx.day : tx.days) + (h ? ' ' + h + tx.hour : '');
    if (h) return h + tx.hour + (m ? ' ' + m + tx.min : '');
    return m + tx.min;
  }

  function daysSummary(days) {
    if (!days.length) return tx.once;
    if (days.length === 7) return tx.daily;
    const key = [...days].sort().join();
    if (key === '1,2,3,4,5') return tx.workdays;
    if (key === '0,6') return tx.weekend;
    const short = tx.short;
    return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => short[d]).join(', ');
  }

  function greeting(now) {
    const hour = new Date(now).getHours();
    if (hour >= 4 && hour < 11) return tx.morning;
    if (hour >= 11 && hour < 18) return tx.noon;
    return tx.evening;
  }

  /** Abschnitt eines Laufs: sunset, night, sunrise, snooze, ring – bei „Nur Einschlaflicht“ sunset und done. */
  function phaseAt(run, now) {
    if (run.sleepOnly) return now < run.sleepEnd ? 'sunset' : 'done';
    if (run.sleepEnd && now < run.sleepEnd) return 'sunset';
    if (now < run.start) return 'night';
    if (now < run.end) return 'sunrise';
    if (run.snoozeUntil && now < run.snoozeUntil) return 'snooze';
    return 'ring';
  }

  /** Wartezeit bis zur nächsten Aktualisierung: nachts minütlich, sonst sekündlich, Test zehnmal pro Sekunde. */
  function nextDelay(run, phase, now) {
    const base = run.preview ? 100 : phase === 'night' ? MINUTE - now % MINUTE + 30 : 1000;
    const boundaries = [run.sleepEnd, run.start, run.end, run.snoozeUntil].filter(t => t > now);
    const nextBoundary = boundaries.length ? Math.min(...boundaries) - now + 20 : base;
    return Math.max(50, Math.min(base, nextBoundary));
  }

  return {setLanguage, MINUTE, pad2, parseTime, nextWake, plan, dayOffset, dayWord, fmtIn, daysSummary, greeting, phaseAt, nextDelay};
}));
