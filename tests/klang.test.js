// Automatische Tests für die Aufbereitung eigener Töne. Start: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../morgenlicht-klang.js');

test('analyse: Effektiv- und Spitzenwert', () => {
  const stats = K.analyse([new Float32Array([0.5, -0.5, 0.5, -0.5])]);
  assert.ok(Math.abs(stats.rms - 0.5) < 1e-6);
  assert.ok(Math.abs(stats.peak - 0.5) < 1e-6);
});

test('normalizeGain: leise Datei wird angehoben, Spitzen begrenzen', () => {
  assert.ok(Math.abs(K.normalizeGain({rms: 0.01, peak: 0.05}) - 10) < 1e-9);
  assert.ok(Math.abs(K.normalizeGain({rms: 0.01, peak: 0.5}) - 1.8) < 1e-9);
  assert.equal(K.normalizeGain({rms: 0, peak: 0}), 1);
});

test('crossfadeLoop: Schleife läuft ohne Sprung weiter', () => {
  const n = 10000, fade = 500;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.sin(2 * Math.PI * i / 1000.3) * 0.8;
  // Ohne Überblendung springt das Signal am Schleifenende deutlich
  assert.ok(Math.abs(data[n - 1] - data[0]) > 0.02);
  const out = K.crossfadeLoop(data, fade);
  assert.equal(out.length, n - fade);
  assert.ok(Math.abs(out[out.length - 1] - out[0]) < 0.02, 'Übergang Ende → Anfang');
  assert.equal(out[out.length - 1], data[n - fade - 1]);
});

test('crossfadeLoop: sehr kurze Aufnahmen bleiben unverändert', () => {
  const data = new Float32Array([0.1, 0.2, 0.3]);
  assert.deepEqual([...K.crossfadeLoop(data, 2)], [...data]);
});
