/* Morgenlicht – Bedienung und Weckablauf */
'use strict';
const Z = window.MorgenlichtZeit;
const K = window.MorgenlichtKlang;
const $ = id => document.getElementById(id);

const settingsEl = $('settings');
const wake = $('wake');
const clockBtn = $('clockBtn');
const duration = $('duration');
const stage = $('stage');
const status = $('status');
const listen = $('listen');
const volumeEl = $('volume');
const snoozeSel = $('snooze');
const vibrateEl = $('vibrate');
const brightnessEl = $('brightness');
const lightOnEl = $('lightOn');
const clockOnEl = $('clockOn');
const brightnessOnEl = $('brightnessOn');
const sceneSel = $('scene');
const sleepSel = $('sleep');
const sleepSoundEl = $('sleepSound');
const customFile = $('customFile');
const confirmDlg = $('confirm');
const timeDlg = $('timeDlg');
const flashDlg = $('flashDlg');
const diagDlg = $('diagDlg');
const soundButtons = [...document.querySelectorAll('[data-sound]')];
const dayButtons = [...document.querySelectorAll('[data-day]')];
const fmtTime = new Intl.DateTimeFormat('de-DE', {hour:'2-digit', minute:'2-digit'});
const fmtDate = new Intl.DateTimeFormat('de-DE', {weekday:'long', day:'numeric', month:'long'});
const canVibrate = typeof navigator.vibrate === 'function';
const canWakeLock = 'wakeLock' in navigator;
const SET_KEY = 'morgenlicht';
const RUN_KEY = 'morgenlicht-run';
const SOUNDS = ['sea', 'forest', 'rain', 'brook', 'river', 'nightingale', 'frogs', 'storm', 'custom'];
/** Ersatz, falls eine Aufnahme nicht geladen werden kann (z. B. als lokale Datei geöffnet) */
const SYNTH_FALLBACK = {brook:'rain', river:'sea', nightingale:'forest', frogs:'forest', storm:'rain'};
const AUTO_SNOOZE_MS = 20 * 60000;   // nach 20 Min. Klingeln ohne Reaktion automatisch schlummern
const AUTO_SNOOZE_MAX = 3;           // danach endet der Wecker
const SLEEP_ONLY_DEFAULT = 20;
const END_COLOR = [255, 245, 196];

let selected = 'sea';
let days = [];
let context, buffers;
let customInfo = null, customBuffer = null;
let playback = null, sampleTimer, vibTimer;
let currentRun = null, tickTimer, controlsTimer, flashTimer;
let screenLock = null, screenFallback = null, battery = null;
let starting = false;
let savedRun = null;
let installEvent = null;
let diagText = '';

/* ---------- Einstellungen ---------- */
const hasOption = (select, value) => [...select.options].some(option => option.value === value);
try {
  const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
  if (Z.parseTime(s.wake)) wake.value = s.wake;
  if ([10, 15, 20, 25, 30].includes(Number(s.duration))) duration.value = String(s.duration);
  if (SOUNDS.includes(s.selected)) selected = s.selected;
  if (Array.isArray(s.days)) days = [...new Set(s.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (Number(s.volume) >= 10 && Number(s.volume) <= 100) volumeEl.value = String(s.volume);
  if (hasOption(snoozeSel, s.snooze)) snoozeSel.value = s.snooze;
  if (hasOption(sleepSel, s.sleep)) sleepSel.value = s.sleep;
  if (hasOption(sceneSel, s.scene)) sceneSel.value = s.scene;
  if (Number(s.brightness) >= 10 && Number(s.brightness) <= 100) brightnessEl.value = String(s.brightness);
  if (typeof s.lightOn === 'boolean') lightOnEl.checked = s.lightOn;
  if (typeof s.brightnessOn === 'boolean') brightnessOnEl.checked = s.brightnessOn;
  if (typeof s.clockOn === 'boolean') clockOnEl.checked = s.clockOn;
  if (typeof s.vibrate === 'boolean') vibrateEl.checked = s.vibrate;
  if (typeof s.sleepSound === 'boolean') sleepSoundEl.checked = s.sleepSound;
} catch {}

function save() {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify({
      wake:wake.value, duration:duration.value, selected, days, volume:Number(volumeEl.value), brightness:Number(brightnessEl.value), lightOn:lightOnEl.checked, clockOn:clockOnEl.checked, brightnessOn:brightnessOnEl.checked,
      snooze:snoozeSel.value, sleep:sleepSel.value, scene:sceneSel.value,
      vibrate:vibrateEl.checked, sleepSound:sleepSoundEl.checked
    }));
  } catch {}
}
const brightness = () => brightnessOnEl.checked ? Number(brightnessEl.value) / 100 : 1;
const dim = rgb => rgb.map(channel => Math.round(channel * brightness()));
const volume = () => Number(volumeEl.value) / 100;
const setText = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; };
const settingsNow = () => ({wake:wake.value, days, lead:lightOnEl.checked ? Number(duration.value) : 0, sleep:Number(sleepSel.value)});
const sleepOnlyMinutes = () => Number(sleepSel.value) || SLEEP_ONLY_DEFAULT;

function setFill(range) {
  const share = (range.value - range.min) / (range.max - range.min) * 100;
  range.style.setProperty('--fill', share + '%');
}
/** Uhrzeit in der Nachtansicht ein- oder ausblenden */
function applyClock() { $('nightTime').hidden = !clockOnEl.checked; }
applyClock();
function updateOverview() {
  const now = Date.now();
  const p = Z.plan(settingsNow(), now);
  setText('clockText', wake.value);
  clockBtn.setAttribute('aria-label', 'Weckzeit ' + wake.value + ', ändern');
  $('leadRow').hidden = !lightOnEl.checked;
  $('lightOffHint').hidden = lightOnEl.checked;
  duration.hidden = !lightOnEl.checked;
  $('brightnessBox').hidden = !brightnessOnEl.checked;
  setText('lightStart', !lightOnEl.checked ? 'Ohne Licht' : p.shortened ? 'Licht startet sofort' : 'Licht ab ' + fmtTime.format(p.start));
  setText('lightRing', 'klingelt ' + Z.dayWord(p.end, now, false) + ' in ' + Z.fmtIn(p.end - now));
  setText('leadHint', p.shortened ? 'Start sofort (zu wenig Zeit)' : 'Start ' + fmtTime.format(p.start));
  setText('daysSummary', Z.daysSummary(days));
  setText('volumeOut', volumeEl.value + ' %');
  setText('brightnessOut', brightnessEl.value + ' %');
  setText('durationOut', duration.value + ' Min.');
  setText('sleepOnly', 'Nur Einschlaflicht · ' + sleepOnlyMinutes() + ' Min.');
  [duration, volumeEl, brightnessEl].forEach(setFill);
}
function updateSelection() {
  soundButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sound === selected)));
  dayButtons.forEach(button => button.setAttribute('aria-pressed', String(days.includes(Number(button.dataset.day)))));
  $('customRow').hidden = !(selected === 'custom' && customInfo);
  if (customInfo) setText('customName', 'Eigener Ton: ' + customInfo.name);
}

/* ---------- Drehräder für die Weckzeit ---------- */
const ROW = 52;
function makeWheel(el, count, pageStep, unit) {
  const items = [];
  const pad = () => { const p = document.createElement('div'); p.className = 'wheel-pad'; p.setAttribute('aria-hidden', 'true'); return p; };
  el.append(pad());
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'wheel-item';
    item.dataset.i = i;
    item.textContent = Z.pad2(i);
    item.setAttribute('aria-hidden', 'true');
    items.push(item);
    el.append(item);
  }
  el.append(pad());
  let value = 0;
  const mark = () => {
    items.forEach((item, i) => item.classList.toggle('on', i === value));
    el.setAttribute('aria-valuenow', String(value));
    el.setAttribute('aria-valuetext', Z.pad2(value) + ' ' + unit);
  };
  const scrollToValue = smooth => el.scrollTo({top:value * ROW, behavior:smooth ? 'smooth' : 'auto'});
  el.addEventListener('scroll', () => {
    const v = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ROW)));
    if (v !== value) { value = v; mark(); }
  });
  el.addEventListener('click', event => {
    const item = event.target.closest('.wheel-item');
    if (item) { value = Number(item.dataset.i); mark(); scrollToValue(true); }
  });
  el.addEventListener('keydown', event => {
    const steps = {ArrowUp:1, ArrowDown:-1, PageUp:pageStep, PageDown:-pageStep};
    if (event.key in steps) value = (value + steps[event.key] + count) % count;
    else if (event.key === 'Home') value = 0;
    else if (event.key === 'End') value = count - 1;
    else return;
    event.preventDefault();
    mark();
    scrollToValue(false);
  });
  return {
    get value() { return value; },
    set(v) { value = v; mark(); scrollToValue(false); }
  };
}
const hourWheel = makeWheel($('wheelH'), 24, 6, 'Uhr');
const minuteWheel = makeWheel($('wheelM'), 60, 5, 'Minuten');
function openTimePicker() {
  const [h, m] = Z.parseTime(wake.value);
  timeDlg.showModal();
  hourWheel.set(h);
  minuteWheel.set(m);
  $('wheelH').focus({preventScroll:true});
}
function applyTime() {
  wake.value = Z.pad2(hourWheel.value) + ':' + Z.pad2(minuteWheel.value);
  timeDlg.close();
  save();
  updateOverview();
  clockBtn.focus();
}

/* ---------- Gespeicherter eigener Ton (IndexedDB) ---------- */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('morgenlicht', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function dbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('files').objectStore('files').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function dbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Audio ---------- */
function ensureContext() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) throw new Error('audio');
  if (!context) {
    context = new AudioEngine();
    context.onstatechange = () => {
      if (currentRun?.ringing && context.state !== 'running') void ensureAudioRunning().then(updateAudioHint);
      updateAudioHint();
    };
  }
  if (!buffers) {
    buffers = K.makeBuffers(context);
    recordingsReady = loadRecordings();
  }
  return context;
}
/** Naturaufnahmen aus dem Ordner sounds laden; fehlen sie (z. B. als lokale Datei geöffnet), bleiben die erzeugten Klänge */
const RECORDINGS = {
  sea:'sounds/meer.wav', rain:'sounds/regen.wav', forest:'sounds/wald.wav',
  brook:'sounds/bach.wav', river:'sounds/fluss.wav', nightingale:'sounds/nachtigall.wav',
  frogs:'sounds/froesche.wav', storm:'sounds/gewitter.wav'
};
let recordingsReady = Promise.resolve();
function loadRecordings() {
  return Promise.all(Object.entries(RECORDINGS).map(async ([kind, url]) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      buffers.recorded[kind] = await decode(await response.arrayBuffer());
    } catch {}
  }));
}
/** Höchstens 3 Sekunden auf die Aufnahmen warten, sonst mit erzeugtem Klang weitermachen */
const waitForRecordings = () => Promise.race([recordingsReady, new Promise(resolve => setTimeout(resolve, 3000))]);
async function unlockAudio() {
  ensureContext();
  await context.resume();
  if (context.state !== 'running') throw new Error('audio');
}
async function ensureAudioRunning() {
  if (!context) return false;
  if (context.state === 'running') return true;
  try { await context.resume(); } catch {}
  return context.state === 'running';
}
function decode(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const result = context.decodeAudioData(arrayBuffer, resolve, reject);
    if (result?.then) result.then(resolve, reject);
  });
}
async function loadCustom() {
  if (customBuffer) return;
  if (!customInfo) throw new Error('custom');
  try { customBuffer = K.prepareCustom(context, await decode(await customInfo.blob.arrayBuffer())); }
  catch { throw new Error('custom'); }
}

function startPlayback(mode, opts = {}) {
  stopSound();
  const ac = context, now = ac.currentTime, v = volume();
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.connect(ac.destination);
  let kind = selected === 'custom' && !customBuffer ? 'sea' : selected;
  if (SYNTH_FALLBACK[kind] && !buffers.recorded[kind]) kind = SYNTH_FALLBACK[kind];
  const pb = {mode, master, voice:K.buildVoice(ac, kind, master, buffers, customBuffer), timers:[]};
  if (mode === 'sample') {
    // Hörprobe: leise beginnen, in 4 Sekunden auf die eingestellte Lautstärke
    master.gain.linearRampToValueAtTime(v * 0.25, now + 0.5);
    master.gain.linearRampToValueAtTime(v, now + 4);
  } else if (mode === 'sleep') {
    master.gain.linearRampToValueAtTime(v * 0.3, now + 4);
    master.gain.linearRampToValueAtTime(0.0001, now + Math.max(6, opts.seconds));
  } else if (opts.preview) {
    master.gain.linearRampToValueAtTime(v * 0.6, now + 2);
  } else {
    if (opts.repeat) {
      master.gain.linearRampToValueAtTime(v * 0.5, now + 10);
      master.gain.linearRampToValueAtTime(v, now + 60);
    } else {
      master.gain.linearRampToValueAtTime(v * 0.35, now + 45);
      master.gain.linearRampToValueAtTime(v, now + 180);
    }
    pb.timers.push(setTimeout(() => {
      K.chime(ac, master, ac.currentTime + 0.05);
      pb.timers.push(setInterval(() => K.chime(ac, master, ac.currentTime + 0.05), 6000));
    }, opts.repeat ? 60000 : 180000));
  }
  playback = pb;
  return pb;
}
function stopSound() {
  clearTimeout(sampleTimer);
  listen.textContent = 'Ton anhören';
  if (!playback) return;
  playback.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
  playback.voice.stop();
  try { playback.master.disconnect(); } catch {}
  playback = null;
}
function startVibration() {
  if (!canVibrate) return;
  const buzz = () => navigator.vibrate([700, 500, 700]);
  buzz();
  clearInterval(vibTimer);
  vibTimer = setInterval(buzz, 3500);
}
function stopVibration() {
  clearInterval(vibTimer);
  vibTimer = null;
  if (canVibrate) navigator.vibrate(0);
}
function updateAudioHint() {
  const run = currentRun;
  $('audioHint').hidden = !(run && run.ringing && context && context.state !== 'running');
}

/* ---------- Licht ---------- */
const lightColors = [
  [0, [0, 0, 0]],
  [0.24, [34, 1, 0]],
  [0.5, [138, 23, 2]],
  [0.76, [239, 109, 18]],
  [1, END_COLOR]
];
function colorAt(progress) {
  progress = Math.min(1, Math.max(0, progress));
  const endIndex = lightColors.findIndex(([at], index) => index > 0 && progress <= at);
  const [start, dark] = lightColors[endIndex - 1];
  const [end, bright] = lightColors[endIndex];
  const fraction = (progress - start) / (end - start);
  return dim(dark.map((channel, index) => Math.round(channel + (bright[index] - channel) * fraction)));
}
function paint(progress) {
  stage.style.background = 'rgb(' + colorAt(progress).join(',') + ')';
}
/** Sonnenaufgang mit sichtbarer Sonne: Himmel als Verlauf, Sonne steigt von unten auf */
function paintScene(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const sky = colorAt(p).join(','), top = colorAt(Math.max(0, p - 0.35)).join(',');
  const sun = colorAt(Math.min(1, p + 0.3)).join(',');
  const y = 118 - p * 70, r = 16 + p * 26;
  stage.style.background =
    'radial-gradient(circle at 50% ' + y + '%, rgb(' + sun + ') 0 ' + r * 0.6 + 'vmin, rgba(' + sun + ',.55) ' + r * 0.68 + 'vmin, rgba(' + sun + ',0) ' + r * 1.7 + 'vmin),' +
    'linear-gradient(rgb(' + top + '), rgb(' + sky + '))';
}

/* ---------- Ablauf ---------- */
function phaseLabel(phase, run) {
  if (phase === 'sunset') return 'Einschlaflicht';
  if (phase === 'night') return 'Wecker aktiv · Licht ab ' + fmtTime.format(run.start);
  if (phase === 'sunrise') return 'Sonnenaufgang';
  if (phase === 'snooze') return 'Schlummern bis ' + fmtTime.format(run.snoozeUntil);
  return 'Zeit aufzuwachen';
}
function enterPhase(run, phase, now) {
  const previous = run.phase;
  run.phase = phase;
  stage.dataset.phase = phase;
  if (previous === 'sunset' && playback?.mode === 'sleep') stopSound();
  if (phase === 'sunset' && run.sleepSound && !run.sleepSoundStarted && context) {
    run.sleepSoundStarted = true;
    startPlayback('sleep', {seconds:(run.sleepEnd - now) / 1000});
  }
  if (phase === 'ring' && !run.ringing) startRing(run, now);
  setText('phase', phaseLabel(phase, run));
  if (phase === 'ring') $('snoozeBtn').focus();
}
function startRing(run, now) {
  run.ringing = true;
  run.ringSince = now;
  stage.classList.remove('show-controls');
  startPlayback('alarm', {preview:run.preview, repeat:run.ringCount > 0});
  void ensureAudioRunning().then(updateAudioHint);
  if (run.vibrate) startVibration();
}
function snooze() {
  const run = currentRun;
  if (!run || !run.ringing) return;
  run.ringing = false;
  run.ringCount++;
  run.snoozeUntil = Date.now() + run.snoozeMs;
  stopSound();
  stopVibration();
  updateAudioHint();
  if (!run.preview) saveRun();
  $('awakeBtn').focus();
  render();
}
function updateGuard() {
  const run = currentRun;
  if (!run) return;
  const ok = [], warn = [];
  if (screenLock && !screenLock.released) ok.push('Display bleibt an');
  else if (screenFallback) warn.push('Display nur im Ersatzmodus wach');
  else if (!canWakeLock) warn.push('Display-Sperre nicht unterstützt – Bildschirm kann ausgehen');
  else warn.push('Display bleibt nicht sicher an');
  if (battery) battery.charging ? ok.push('lädt') : warn.push('nicht am Ladekabel');
  if (run.wasHidden) warn.push('Seite war im Hintergrund');
  setText('guard', [...warn.map(w => '⚠ ' + w), ...ok].join(' · '));
  $('guard').classList.toggle('warn', warn.length > 0);
}
function updateTexts(run, phase, now) {
  const time = fmtTime.format(now);
  if (phase === 'night') {
    setText('nightTime', time);
    setText('nightInfo', 'Wecker ' + Z.dayWord(run.end, now, false) + ' um ' + fmtTime.format(run.end) + ' · Licht ab ' + fmtTime.format(run.start));
    updateGuard();
    const minute = Math.floor(now / 60000);
    if (run.shiftMinute !== minute) {
      run.shiftMinute = minute;
      // Schrift wandert leicht, damit sich nichts ins Display einbrennt
      $('night').style.transform = 'translate(' + Math.round(Math.random() * 40 - 20) + 'px,' + Math.round(Math.random() * 80 - 40) + 'px)';
      if (!run.preview) {
        void keepScreenOn();
        if (context?.state === 'suspended') context.resume().catch(() => {});
      }
    }
  }
  if (phase === 'ring' || phase === 'snooze') {
    setText('greeting', Z.greeting(now));
    setText('ringTime', time);
    setText('ringDate', fmtDate.format(now));
    $('snoozeBtn').hidden = phase === 'snooze';
    $('snoozeInfo').hidden = phase !== 'snooze';
    if (phase === 'snooze') setText('snoozeInfo', run.preview ? 'Klingelt gleich wieder' : 'Klingelt wieder um ' + fmtTime.format(run.snoozeUntil));
    setText('snoozeBtn', run.preview ? 'Schlummern · 5 Sek.' : 'Schlummern · ' + run.snoozeMs / 60000 + ' Min.');
  }
}
function render() {
  clearTimeout(tickTimer);
  const run = currentRun;
  if (!run) return;
  const now = Date.now();
  const phase = Z.phaseAt(run, now);
  if (phase === 'done') { finish('sleepdone'); return; }
  if (phase !== run.phase) enterPhase(run, phase, now);
  if (!currentRun) return;
  if (phase === 'sunset') paint(0.5 * (1 - (now - run.sleepStart) / (run.sleepEnd - run.sleepStart)));
  else if (phase === 'night') paint(0);
  else if (phase === 'sunrise') {
    const progress = (now - run.start) / (run.end - run.start);
    run.scene === 'sun' ? paintScene(progress) : paint(progress);
  } else paint(1);
  updateTexts(run, phase, now);
  if (run.preview && now >= (run.ringSince || Infinity) + 20000) { finish('preview'); return; }
  if (phase === 'ring' && run.ringing && !run.preview && now - run.ringSince >= AUTO_SNOOZE_MS) {
    if (run.autoSnoozes >= AUTO_SNOOZE_MAX) { finish('timeout'); return; }
    run.autoSnoozes++;
    snooze();
    return;
  }
  tickTimer = setTimeout(render, Z.nextDelay(run, phase, now));
}

/* ---------- Display wach halten ---------- */
async function keepScreenOn() {
  const run = currentRun;
  if (!run || document.hidden || screenLock && !screenLock.released) return;
  if (!canWakeLock) { void startScreenFallback(); return; }
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (currentRun !== run) { await lock.release(); return; }
    screenLock = lock;
    lock.addEventListener('release', () => { if (currentRun) updateGuard(); });
    stopScreenFallback();
  } catch {
    screenLock = null;
    void startScreenFallback();
  }
  updateGuard();
}
function recordClip(stream, ms) {
  return new Promise(resolve => {
    try {
      const recorder = new MediaRecorder(stream);
      const parts = [];
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      recorder.onstop = () => resolve(parts.length ? new Blob(parts, {type:recorder.mimeType || 'video/webm'}) : null);
      recorder.start();
      setTimeout(() => recorder.stop(), ms);
    } catch { resolve(null); }
  });
}
/** Ersatz für Browser ohne Display-Sperre: ein fast unsichtbares, stummes Video in Endlosschleife */
async function startScreenFallback() {
  const run = currentRun;
  if (screenFallback || !run || run.fallbackTried) return;
  run.fallbackTried = true;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  if (!canvas.captureStream) { updateGuard(); return; }
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(5);
  let n = 0;
  const draw = setInterval(() => { ctx.fillStyle = n++ % 2 ? '#000' : '#030303'; ctx.fillRect(0, 0, 16, 16); }, 200);
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.className = 'keep-awake';
  const clip = window.MediaRecorder ? await recordClip(stream, 1500) : null;
  if (clip) {
    clearInterval(draw);
    stream.getTracks().forEach(track => track.stop());
    video.src = URL.createObjectURL(clip);
  } else {
    video.srcObject = stream;
  }
  document.body.append(video);
  try {
    await video.play();
    if (currentRun !== run) throw new Error('beendet');
    screenFallback = {video, draw, stream};
  } catch {
    clearInterval(draw);
    stream.getTracks().forEach(track => track.stop());
    if (video.src) URL.revokeObjectURL(video.src);
    video.remove();
  }
  updateGuard();
}
function stopScreenFallback() {
  if (!screenFallback) return;
  const {video, draw, stream} = screenFallback;
  screenFallback = null;
  clearInterval(draw);
  stream.getTracks().forEach(track => track.stop());
  video.pause();
  if (video.src) URL.revokeObjectURL(video.src);
  video.remove();
}

/* ---------- Gespeicherter Lauf ---------- */
function saveRun() {
  const r = currentRun;
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({start:r.start, end:r.end, sleepStart:r.sleepStart, sleepEnd:r.sleepEnd, snoozeUntil:r.snoozeUntil, ringCount:r.ringCount, autoSnoozes:r.autoSnoozes}));
  } catch {}
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch {} }
function loadSavedRun() {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    if (r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end + 3600000 > Date.now()) {
      return {start:r.start, end:r.end, sleepStart:Number(r.sleepStart) || 0, sleepEnd:Number(r.sleepEnd) || 0,
        snoozeUntil:Number(r.snoozeUntil) || 0, ringCount:Number(r.ringCount) || 0, autoSnoozes:Number(r.autoSnoozes) || 0};
    }
  } catch {}
  clearRun();
  return null;
}

/* ---------- Start und Ende ---------- */
function exitFullscreen() {
  if (document.fullscreenElement === stage) void document.exitFullscreen().catch(() => {});
}
function closeStage() {
  stage.hidden = true;
  stage.classList.remove('show-controls');
  delete stage.dataset.phase;
  delete stage.dataset.preview;
  settingsEl.inert = false;
  exitFullscreen();
}
function finish(reason) {
  const run = currentRun;
  if (!run) return;
  currentRun = null;
  clearTimeout(tickTimer);
  clearTimeout(controlsTimer);
  stopSound();
  stopVibration();
  if (screenLock) void screenLock.release().catch(() => {});
  screenLock = null;
  stopScreenFallback();
  closeStage();
  updateAudioHint();
  if (!run.preview && !run.sleepOnly) clearRun();
  const now = Date.now();
  if (run.preview) status.textContent = 'Test beendet.';
  else if (run.sleepOnly) status.textContent = reason === 'sleepdone' ? 'Einschlaflicht beendet. Gute Nacht!' : 'Einschlaflicht ausgeschaltet.';
  else if (reason === 'timeout') status.textContent = 'Der Wecker hat ' + (AUTO_SNOOZE_MAX + 1) + '-mal ohne Reaktion geklingelt und wurde beendet.';
  else if (reason === 'off') status.textContent = 'Wecker ausgeschaltet.';
  else if (reason === 'awake') {
    let text = Z.greeting(now) + '! Wecker beendet.';
    if (days.length) {
      const next = Z.nextWake(wake.value, days, now);
      text += ' Nächster Termin: ' + Z.dayWord(next, now, false) + ' um ' + fmtTime.format(next) + ' – stell den Wecker abends wieder.';
    }
    status.textContent = text;
  }
  updateOverview();
  run.trigger?.focus();
}
async function start(opts, trigger) {
  if (starting || currentRun || !Z.parseTime(wake.value)) return;
  starting = true;
  stopSound();
  const simple = !!(opts.preview || opts.sleepOnly);
  stage.classList.remove('show-controls');
  stage.style.transition = 'none';
  paint(opts.sleepOnly ? 0.5 : 0);
  stage.dataset.phase = opts.sleepOnly ? 'sunset' : 'night';
  if (simple) stage.dataset.preview = ''; else delete stage.dataset.preview;
  stage.hidden = false;
  settingsEl.inert = true;
  const fullscreen = stage.requestFullscreen?.({navigationUI:'hide'}).catch(() => {});
  try {
    await unlockAudio();
    if (selected === 'custom') await loadCustom();
    await waitForRecordings();
  } catch (error) {
    starting = false;
    closeStage();
    void fullscreen?.then(() => { if (!currentRun) exitFullscreen(); });
    status.textContent = error.message === 'custom'
      ? 'Der eigene Ton ließ sich nicht laden. Wähle die Datei erneut oder einen anderen Ton.'
      : 'Ton konnte nicht gestartet werden. Prüfe die Audiofreigabe im Browser.';
    trigger?.focus();
    return;
  }
  starting = false;
  status.textContent = '';
  const now = Date.now();
  const times = opts.preview ? {start:now, end:now + 15000, sleepStart:0, sleepEnd:0}
    : opts.sleepOnly ? {start:0, end:0, sleepStart:now, sleepEnd:now + sleepOnlyMinutes() * 60000}
    : opts.saved ? opts.saved
    : Z.plan(settingsNow(), now);
  currentRun = {
    start:times.start, end:times.end, sleepStart:times.sleepStart || 0, sleepEnd:times.sleepEnd || 0,
    snoozeUntil:times.snoozeUntil || 0, ringCount:times.ringCount || 0, autoSnoozes:times.autoSnoozes || 0,
    preview:!!opts.preview, sleepOnly:!!opts.sleepOnly, trigger, ringing:false, phase:null, wasHidden:false,
    vibrate:vibrateEl.checked && canVibrate, sleepSound:sleepSoundEl.checked, scene:sceneSel.value,
    snoozeMs:opts.preview ? 5000 : Number(snoozeSel.value) * 60000
  };
  $('resume').hidden = true;
  setText('stopLabel', opts.preview ? 'Test beenden' : opts.sleepOnly ? 'Licht ausschalten' : 'Wecker ausschalten');
  if (!simple) saveRun();
  render();
  stage.style.transition = opts.preview ? 'none' : 'background-color 1s linear';
  stage.focus({preventScroll:true});
  void keepScreenOn();
}

/* ---------- Bestätigung vor dem Scharfschalten ---------- */
function fillChecklist() {
  const items = [];
  const charge = 'Ladekabel anschließen – das Display bleibt die ganze Nacht an.';
  items.push(battery ? (battery.charging ? ['ok', 'Ladekabel ist angeschlossen.'] : ['warn', charge]) : ['', charge]);
  items.push(canWakeLock
    ? ['ok', 'Dieser Browser kann das Display wach halten.']
    : ['warn', 'Dieser Browser kann das Display nicht sicher wach halten. Stell die automatische Bildschirmsperre in den Handy-Einstellungen ab.']);
  items.push(['', 'Displayhelligkeit hochstellen. Die App kann sie nicht selbst regeln – das Licht wird nur so hell wie dein Display.']);
  items.push(['', 'Lautlos aus und Medienlautstärke prüfen. Der Weckton läuft über die Medienlautstärke.']);
  items.push(['', 'Seite geöffnet lassen: Handy nicht sperren und nicht in eine andere App wechseln.']);
  fillList($('checklist'), items);
}
function fillList(list, items) {
  list.replaceChildren(...items.map(([cls, text]) => {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    return li;
  }));
}
function openConfirm() {
  if (currentRun || starting || !Z.parseTime(wake.value)) return;
  const now = Date.now(), p = Z.plan(settingsNow(), now);
  setText('confirmWhen', Z.dayWord(p.end, now, true) + ', ' + fmtTime.format(p.end));
  setText('confirmIn', 'Licht ab ' + fmtTime.format(p.start) + ' · ' + Z.daysSummary(days));
  const sleepLine = $('confirmSleep');
  sleepLine.replaceChildren('Schlafdauer bis zum Wecken: ', Object.assign(document.createElement('strong'), {textContent:Z.fmtIn(p.end - now)}));
  const notes = [];
  if (p.shortened) notes.push('Bis zur Weckzeit ist weniger Zeit als der Lichtvorlauf – das Licht beginnt sofort und wird entsprechend schneller hell.');
  if (p.sleepEnd) notes.push('Zuerst ' + Math.round((p.sleepEnd - p.sleepStart) / 60000) + ' Min. Einschlaflicht' + (sleepSoundEl.checked ? ' mit leisem Naturton' : '') + ', danach die dunkle Nachtanzeige.');
  if (days.length) notes.push('Im Browser musst du den Wecker trotz Wiederholung jeden Abend neu stellen.');
  $('confirmNote').hidden = !notes.length;
  setText('confirmNote', notes.join(' '));
  fillChecklist();
  confirmDlg.showModal();
  $('confirmGo').focus();
}
function showFlash() {
  flashDlg.style.background = 'rgb(' + dim(END_COLOR).join(',') + ')';
  flashDlg.showModal();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => flashDlg.close(), 5000);
}

/* ---------- Gerät prüfen ---------- */
async function runDiagnostics() {
  const rows = [];
  const add = (cls, label, detail) => rows.push([cls, label + ': ' + detail]);
  fillList($('diagList'), [['', 'Prüfung läuft …']]);
  setText('diagNote', '');
  diagDlg.showModal();
  add(window.isSecureContext ? 'ok' : 'warn', 'Sichere Verbindung (https)', window.isSecureContext ? 'ja' : 'nein – Installation, Offline-Betrieb und Display-Sperre brauchen https');
  if (!canWakeLock) {
    add('warn', 'Display wach halten', 'nicht unterstützt – der Ersatzmodus (stummes Video) wird versucht');
  } else {
    try { const lock = await navigator.wakeLock.request('screen'); await lock.release(); add('ok', 'Display wach halten', 'funktioniert'); }
    catch (error) { add('warn', 'Display wach halten', 'vom Browser abgelehnt (' + (error.name || 'Fehler') + ')'); }
  }
  try { await unlockAudio(); add('ok', 'Ton', 'freigegeben'); }
  catch { add('warn', 'Ton', 'blockiert – Audiofreigabe im Browser prüfen'); }
  if (buffers) {
    await waitForRecordings();
    const loaded = Object.keys(buffers.recorded).length;
    const total = Object.keys(RECORDINGS).length;
    add(loaded === total ? 'ok' : '', 'Naturaufnahmen', loaded === total ? 'alle ' + total + ' geladen' : loaded + ' von ' + total + ' geladen – fehlende werden durch erzeugte Klänge ersetzt');
  }
  if (canVibrate) { navigator.vibrate(200); add('ok', 'Vibration', 'unterstützt (kurzer Test lief gerade)'); }
  else add('', 'Vibration', 'nicht unterstützt (auf iPhones normal)');
  add(battery ? (battery.charging ? 'ok' : 'warn') : '', 'Ladezustand', battery ? (battery.charging ? 'lädt' : 'lädt nicht') : 'nicht abfragbar – Ladekabel selbst prüfen');
  add(stage.requestFullscreen ? 'ok' : '', 'Vollbild', stage.requestFullscreen ? 'unterstützt' : 'nicht unterstützt – als App installieren');
  let stored = false;
  try { localStorage.setItem('morgenlicht-probe', '1'); stored = localStorage.getItem('morgenlicht-probe') === '1'; localStorage.removeItem('morgenlicht-probe'); } catch {}
  add(stored ? 'ok' : 'warn', 'Einstellungen speichern', stored ? 'funktioniert' : 'nicht möglich (privates Fenster?) – Wecker übersteht kein Neuladen');
  let fileStore = false;
  try { await dbSet('probe', 1); fileStore = (await dbGet('probe')) === 1; } catch {}
  add(fileStore ? 'ok' : 'warn', 'Eigenen Ton speichern', fileStore ? 'funktioniert' : 'nicht möglich – eigener Ton gilt nur bis zum Neuladen');
  const controlled = !!navigator.serviceWorker?.controller;
  add(controlled ? 'ok' : '', 'Offline-Betrieb', controlled ? 'aktiv' : 'nicht aktiv (nur über https verfügbar)');
  add(standalone ? 'ok' : '', 'Als App geöffnet', standalone ? 'ja' : 'nein – im Browser-Tab');
  fillList($('diagList'), rows);
  diagText = 'Morgenlicht – Gerätecheck ' + new Date(Date.now()).toLocaleString('de-DE') + '\n' +
    'Browser: ' + navigator.userAgent + '\n' + rows.map(([cls, text]) => (cls === 'ok' ? '✓ ' : cls === 'warn' ? '! ' : '○ ') + text).join('\n');
  setText('diagNote', 'Das Ergebnis bleibt auf deinem Gerät. „Ergebnis kopieren“ legt es für den Testplan in die Zwischenablage.');
}

/* ---------- Druck-und-Halten-Knöpfe ---------- */
function holdToConfirm(button, ms, action, needsHold) {
  let timer;
  const cancel = () => { clearTimeout(timer); button.classList.remove('holding'); };
  button.style.setProperty('--hold', ms + 'ms');
  button.addEventListener('pointerdown', event => {
    if (!needsHold() || event.button !== 0) return;
    button.classList.add('holding');
    timer = setTimeout(() => { cancel(); action(); }, ms);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => button.addEventListener(type, cancel));
  // Tastatur (detail 0) löst direkt aus, Fingertipp braucht Halten
  button.addEventListener('click', event => { if (!needsHold() || event.detail === 0) action(); });
  button.addEventListener('contextmenu', event => event.preventDefault());
}
function toggleControls(force) {
  const on = force ?? !stage.classList.contains('show-controls');
  stage.classList.toggle('show-controls', on);
  clearTimeout(controlsTimer);
  if (on) controlsTimer = setTimeout(() => stage.classList.remove('show-controls'), 8000);
}
const isAlarmRun = () => !!currentRun && !currentRun.preview && !currentRun.sleepOnly;

/* ---------- Ereignisse ---------- */
clockBtn.addEventListener('click', openTimePicker);
$('timeOk').addEventListener('click', applyTime);
$('timeCancel').addEventListener('click', () => { timeDlg.close(); clockBtn.focus(); });
timeDlg.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.classList.contains('wheel')) { event.preventDefault(); applyTime(); } });
duration.addEventListener('input', updateOverview);
duration.addEventListener('change', () => { save(); updateOverview(); });
sleepSel.addEventListener('change', () => { save(); updateOverview(); });
[snoozeSel, vibrateEl, sleepSoundEl, sceneSel, brightnessEl].forEach(el => el.addEventListener('change', save));
brightnessEl.addEventListener('input', () => { updateOverview(); save(); });
[lightOnEl, brightnessOnEl].forEach(el => el.addEventListener('change', () => { save(); updateOverview(); }));
clockOnEl.addEventListener('change', () => { save(); applyClock(); });
volumeEl.addEventListener('input', () => {
  updateOverview();
  save();
  if (playback?.mode === 'sample') {
    playback.master.gain.cancelScheduledValues(context.currentTime);
    playback.master.gain.setTargetAtTime(volume(), context.currentTime, 0.05);
  }
});
dayButtons.forEach(button => button.addEventListener('click', () => {
  const day = Number(button.dataset.day);
  days = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
  updateSelection(); save(); updateOverview();
}));
soundButtons.forEach(button => button.addEventListener('click', () => {
  const sound = button.dataset.sound;
  if (sound === 'custom' && !customInfo) { customFile.click(); return; }
  stopSound();
  selected = sound;
  updateSelection();
  save();
}));
$('customChange').addEventListener('click', () => customFile.click());
customFile.addEventListener('change', async () => {
  const file = customFile.files[0];
  customFile.value = '';
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { status.textContent = 'Die Datei ist größer als 20 MB. Bitte eine kürzere Aufnahme wählen.'; return; }
  try {
    ensureContext();
    customBuffer = K.prepareCustom(context, await decode(await file.arrayBuffer()));
  } catch {
    status.textContent = 'Diese Datei lässt sich nicht als Ton abspielen.';
    return;
  }
  customInfo = {name:file.name, blob:file};
  stopSound();
  selected = 'custom';
  updateSelection();
  save();
  try { await dbSet('custom', customInfo); status.textContent = 'Eigener Ton übernommen und an die Lautstärke angeglichen.'; }
  catch { status.textContent = 'Eigener Ton übernommen, aber nur bis zum Neuladen der Seite.'; }
});
listen.addEventListener('click', async () => {
  if (playback) { stopSound(); return; }
  try {
    await unlockAudio();
    if (selected === 'custom') await loadCustom();
    await waitForRecordings();
    if (starting || currentRun || playback) return;
    status.textContent = '';
    startPlayback('sample');
    listen.textContent = 'Hörprobe stoppen';
    sampleTimer = setTimeout(stopSound, 15000);
  } catch (error) {
    status.textContent = error.message === 'custom' ? 'Der eigene Ton ließ sich nicht laden.' : 'Ton konnte nicht gestartet werden.';
  }
});
$('arm').addEventListener('click', openConfirm);
$('confirmCancel').addEventListener('click', () => confirmDlg.close());
$('confirmGo').addEventListener('click', () => { confirmDlg.close(); start({}, $('arm')); });
$('flashBtn').addEventListener('click', showFlash);
flashDlg.addEventListener('click', () => flashDlg.close());
flashDlg.addEventListener('close', () => { clearTimeout(flashTimer); if (confirmDlg.open) $('flashBtn').focus(); });
$('preview').addEventListener('click', event => start({preview:true}, event.currentTarget));
$('sleepOnly').addEventListener('click', event => start({sleepOnly:true}, event.currentTarget));
$('diagBtn').addEventListener('click', () => void runDiagnostics());
$('diagClose').addEventListener('click', () => diagDlg.close());
$('diagCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(diagText); setText('diagNote', 'Ergebnis kopiert.'); }
  catch { setText('diagNote', 'Kopieren nicht möglich – bitte den Text oben abschreiben oder ein Bildschirmfoto machen.'); }
});
$('snoozeBtn').addEventListener('click', snooze);
holdToConfirm($('awakeBtn'), 1200, () => finish('awake'), isAlarmRun);
holdToConfirm($('stop'), 1500, () => finish(currentRun?.preview ? 'preview' : 'off'), isAlarmRun);
$('resumeGo').addEventListener('click', () => { if (savedRun) start({saved:savedRun}, $('arm')); });
$('resumeDrop').addEventListener('click', () => { clearRun(); savedRun = null; $('resume').hidden = true; $('arm').focus(); });
stage.addEventListener('pointerdown', () => {
  if (context && context.state !== 'running') void ensureAudioRunning().then(updateAudioHint);
});
stage.addEventListener('click', event => {
  if (event.target.closest('button') || !currentRun || currentRun.phase === 'ring' || currentRun.phase === 'snooze') return;
  toggleControls();
});
document.addEventListener('visibilitychange', () => {
  if (!currentRun) { updateOverview(); return; }
  if (document.hidden) { if (isAlarmRun()) currentRun.wasHidden = true; return; }
  render();
  void keepScreenOn();
  void ensureAudioRunning().then(updateAudioHint);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !currentRun) return;
  if (isAlarmRun()) toggleControls(true); else finish('off');
});
window.addEventListener('beforeunload', event => {
  if (isAlarmRun()) { event.preventDefault(); event.returnValue = ''; }
});

/* ---------- Start ---------- */
$('vibrateRow').hidden = !canVibrate;
updateSelection();
updateOverview();
setInterval(() => { if (!currentRun) updateOverview(); }, 30000);

savedRun = loadSavedRun();
if (savedRun) {
  const now = Date.now();
  const when = Z.dayWord(savedRun.end, now, false) + ' um ' + fmtTime.format(savedRun.end);
  setText('resumeText', savedRun.end > now
    ? 'Dein Wecker für ' + when + ' ist noch gestellt. Nach dem Neuladen braucht er einen Tipp, damit Ton und Display wieder laufen.'
    : 'Dein Wecker um ' + fmtTime.format(savedRun.end) + ' hätte schon geklingelt, während die Seite geschlossen war.');
  setText('resumeGo', savedRun.end > now ? 'Fortsetzen' : 'Jetzt klingeln lassen');
  $('resume').hidden = false;
}

if ('indexedDB' in window) {
  dbGet('custom').then(record => {
    if (record?.blob && record.name) customInfo = record;
    else if (selected === 'custom') { selected = 'sea'; save(); }
    updateSelection();
  }).catch(() => { if (selected === 'custom') { selected = 'sea'; updateSelection(); } });
} else if (selected === 'custom') { selected = 'sea'; updateSelection(); }

navigator.getBattery?.().then(b => {
  battery = b;
  b.addEventListener('chargingchange', () => {
    if (currentRun) updateGuard();
    if (confirmDlg.open) fillChecklist();
  });
}).catch(() => {});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
  $('install').hidden = false;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch {}
  installEvent = null;
  $('installBtn').hidden = true;
});
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) { $('install').hidden = false; $('iosHint').hidden = false; }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('morgenlicht-sw.js').catch(() => {});
}
