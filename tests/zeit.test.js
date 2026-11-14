// Automatische Tests für die Zeitrechnung. Start: node --test tests/
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../morgenlicht-zeit.js');

const MIN = 60000, HOUR = 60 * MIN;
const local = (y, m, d, h = 0, mi = 0) => +new Date(y, m - 1, d, h, mi);
// 13.11.2026 ist ein Freitag
const FRIDAY_22 = local(2026, 11, 13, 22, 0);

test('Zeitzone ist Europe/Berlin', () => {
  assert.equal(new Date(local(2026, 7, 1, 12)).getTimezoneOffset(), -120);
  assert.equal(new Date(local(2026, 1, 1, 12)).getTimezoneOffset(), -60);
});

test('nextWake: abends gestellt klingelt am nächsten Morgen', () => {
  assert.equal(Z.nextWake('07:00', [], FRIDAY_22), local(2026, 11, 14, 7, 0));
});

test('nextWake: frühmorgens gestellt klingelt am selben Tag', () => {
  assert.equal(Z.nextWake('07:00', [], local(2026, 11, 13, 5, 0)), local(2026, 11, 13, 7, 0));
});

test('nextWake: genau zur Weckzeit gestellt klingelt erst morgen', () => {
  assert.equal(Z.nextWake('07:00', [], local(2026, 11, 13, 7, 0)), local(2026, 11, 14, 7, 0));
});

test('nextWake: Mo–Fr am Freitagabend springt auf Montag', () => {
  assert.equal(Z.nextWake('07:00', [1, 2, 3, 4, 5], FRIDAY_22), local(2026, 11, 16, 7, 0));
});

test('nextWake: nur freitags, Freitag nach der Weckzeit → nächster Freitag', () => {
  assert.equal(Z.nextWake('07:00', [5], local(2026, 11, 13, 8, 0)), local(2026, 11, 20, 7, 0));
});

test('nextWake: Umstellung auf Sommerzeit (Nacht nur 8 statt 9 Stunden)', () => {
  const now = local(2026, 3, 28, 22, 0);
  const end = Z.nextWake('07:00', [], now);
  assert.equal(end - now, 8 * HOUR);
  assert.equal(new Date(end).getHours(), 7);
});

test('nextWake: Umstellung auf Winterzeit (Nacht 10 statt 9 Stunden)', () => {
  const now = local(2026, 10, 24, 22, 0);
  const end = Z.nextWake('07:00', [], now);
  assert.equal(end - now, 10 * HOUR);
  assert.equal(new Date(end).getHours(), 7);
});

test('nextWake: 02:30 in der Umstellungsnacht (gibt es nicht) → 03:30', () => {
  const now = local(2026, 3, 28, 22, 0);
  const end = Z.nextWake('02:30', [], now);
  assert.ok(end > now);
  assert.equal(new Date(end).getHours(), 3);
  assert.equal(new Date(end).getMinutes(), 30);
});

test('nextWake: ungültige Zeit wirft einen Fehler', () => {
  assert.throws(() => Z.nextWake('7:00', [], FRIDAY_22), RangeError);
  assert.throws(() => Z.nextWake('24:00', [], FRIDAY_22), RangeError);
});

test('plan: normaler Lichtvorlauf', () => {
  const p = Z.plan({wake: '07:00', days: [], lead: 30, sleep: 0}, FRIDAY_22);
  assert.equal(p.end, local(2026, 11, 14, 7, 0));
  assert.equal(p.start, local(2026, 11, 14, 6, 30));
  assert.equal(p.shortened, false);
  assert.equal(p.sleepEnd, 0);
});

test('plan: zu wenig Zeit → Licht beginnt sofort', () => {
  const now = local(2026, 11, 13, 6, 45);
  const p = Z.plan({wake: '07:00', days: [], lead: 30, sleep: 0}, now);
  assert.equal(p.start, now);
  assert.equal(p.shortened, true);
});

test('plan: Einschlaflicht endet spätestens mit dem Lichtbeginn', () => {
  const now = local(2026, 11, 13, 6, 0);
  const p = Z.plan({wake: '07:00', days: [], lead: 30, sleep: 30}, now);
  assert.equal(p.sleepStart, now);
  assert.equal(p.sleepEnd, local(2026, 11, 13, 6, 30));
});

test('plan: Einschlaflicht unter einer Minute entfällt', () => {
  const now = local(2026, 11, 13, 6, 50);
  const p = Z.plan({wake: '07:00', days: [], lead: 10, sleep: 20}, now);
  assert.equal(p.sleepStart, 0);
  assert.equal(p.sleepEnd, 0);
});

test('fmtIn: Dauer als Text', () => {
  assert.equal(Z.fmtIn(30000), '1 Min.');
  assert.equal(Z.fmtIn(45 * MIN), '45 Min.');
  assert.equal(Z.fmtIn(90 * MIN), '1 Std. 30 Min.');
  assert.equal(Z.fmtIn(120 * MIN), '2 Std.');
  assert.equal(Z.fmtIn(25 * HOUR), '1 Tag 1 Std.');
  assert.equal(Z.fmtIn(49 * HOUR), '2 Tagen 1 Std.');
});

test('daysSummary: Kurzbeschreibung der Wochentage', () => {
  assert.equal(Z.daysSummary([]), 'Einmalig');
  assert.equal(Z.daysSummary([0, 1, 2, 3, 4, 5, 6]), 'Täglich');
  assert.equal(Z.daysSummary([5, 1, 3, 2, 4]), 'Mo–Fr');
  assert.equal(Z.daysSummary([6, 0]), 'Wochenende');
  assert.equal(Z.daysSummary([0, 1, 3]), 'Mo, Mi, So');
});

test('dayWord: heute, morgen, Wochentag – auch über die Zeitumstellung', () => {
  assert.equal(Z.dayWord(local(2026, 11, 13, 23), FRIDAY_22, false), 'heute');
  assert.equal(Z.dayWord(local(2026, 11, 14, 7), FRIDAY_22, true), 'Morgen');
  assert.equal(Z.dayWord(local(2026, 11, 16, 7), FRIDAY_22, false), 'Montag');
  assert.equal(Z.dayWord(local(2026, 3, 29, 7), local(2026, 3, 28, 22), false), 'morgen');
});

test('greeting: Tageszeit', () => {
  assert.equal(Z.greeting(local(2026, 11, 14, 7)), 'Guten Morgen');
  assert.equal(Z.greeting(local(2026, 11, 14, 14)), 'Guten Tag');
  assert.equal(Z.greeting(local(2026, 11, 14, 22)), 'Guten Abend');
});

test('phaseAt: Ablauf einer Nacht mit Schlummern', () => {
  const run = {sleepStart: 0, sleepEnd: 100, start: 200, end: 300, snoozeUntil: 0};
  assert.equal(Z.phaseAt(run, 50), 'sunset');
  assert.equal(Z.phaseAt(run, 150), 'night');
  assert.equal(Z.phaseAt(run, 250), 'sunrise');
  assert.equal(Z.phaseAt(run, 300), 'ring');
  run.snoozeUntil = 400;
  assert.equal(Z.phaseAt(run, 350), 'snooze');
  assert.equal(Z.phaseAt(run, 400), 'ring');
});

test('phaseAt: nur Einschlaflicht', () => {
  const run = {sleepOnly: true, sleepStart: 0, sleepEnd: 100, start: 0, end: 0};
  assert.equal(Z.phaseAt(run, 50), 'sunset');
  assert.equal(Z.phaseAt(run, 100), 'done');
});

test('nextDelay: nachts höchstens bis zur nächsten Minute oder zum Lichtbeginn', () => {
  const now = local(2026, 11, 13, 23, 0) + 15000;
  const run = {start: now + 5000, end: now + HOUR, sleepEnd: 0, snoozeUntil: 0};
  assert.equal(Z.nextDelay(run, 'night', now), 5020);
  const later = {start: now + HOUR, end: now + 2 * HOUR, sleepEnd: 0, snoozeUntil: 0};
  assert.equal(Z.nextDelay(later, 'night', now), 45030);
  assert.equal(Z.nextDelay({...later, preview: true}, 'sunrise', now), 100);
});

test('nextWake: eigene Zeit pro Wochentag', () => {
  // Fr 22:00 gestellt, Samstag (6) soll um 08:30 klingeln, sonst 06:00
  const times = {6: '08:30'};
  assert.equal(Z.nextWake('06:00', [5, 6], FRIDAY_22, times), local(2026, 11, 14, 8, 30));
  // Sonntag (0) hat keine eigene Zeit und nimmt die Standardzeit
  assert.equal(Z.nextWake('06:00', [0], FRIDAY_22, times), local(2026, 11, 15, 6, 0));
});

test('nextWake: ungültige Tageszeit fällt auf die Standardzeit zurück', () => {
  assert.equal(Z.nextWake('06:00', [6], FRIDAY_22, {6: 'xx'}), local(2026, 11, 14, 6, 0));
  assert.equal(Z.nextWake('06:00', [6], FRIDAY_22, {6: ''}), local(2026, 11, 14, 6, 0));
});

test('plan: Lichtbeginn richtet sich nach der Zeit des Wochentags', () => {
  const p = Z.plan({wake: '06:00', days: [6], lead: 30, sleep: 0, times: {6: '08:30'}}, FRIDAY_22);
  assert.equal(p.end, local(2026, 11, 14, 8, 30));
  assert.equal(p.start, local(2026, 11, 14, 8, 0));
});
