/* Morgenlicht – Klangerzeugung und Aufbereitung eigener Töne.
   Die reinen Rechenfunktionen (analyse, crossfadeLoop, normalizeGain) laufen auch in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MorgenlichtKlang = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Effektivwert und Spitzenwert über alle Kanäle */
  function analyse(channels) {
    let sum = 0, peak = 0, count = 0;
    for (const data of channels) {
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        sum += v * v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      count += data.length;
    }
    return {rms: count ? Math.sqrt(sum / count) : 0, peak};
  }

  /** Verstärkung auf Ziel-Effektivwert (ca. −20 dBFS), ohne die Spitze über maxPeak zu heben */
  function normalizeGain(stats, targetRms = 0.1, maxPeak = 0.9) {
    if (!stats.rms || !stats.peak) return 1;
    return Math.min(targetRms / stats.rms, maxPeak / stats.peak);
  }

  /** Ende weich in den Anfang überblenden, damit die Schleife ohne Sprung weiterläuft */
  function crossfadeLoop(data, fade) {
    const n = data.length;
    if (fade < 1 || n < fade * 3) return Float32Array.from(data);
    const out = new Float32Array(n - fade);
    out.set(data.subarray(0, n - fade));
    for (let i = 0; i < fade; i++) {
      const t = (i + 0.5) / fade;
      out[i] = data[i] * Math.sin(t * Math.PI / 2) + data[n - fade + i] * Math.cos(t * Math.PI / 2);
    }
    return out;
  }

  /** Eigene Aufnahme: Schleifenübergang glätten und Lautstärke an die eingebauten Töne angleichen */
  function prepareCustom(ac, buffer) {
    const fade = Math.min(Math.round(buffer.sampleRate * 0.5), Math.floor(buffer.length / 4));
    const channels = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(crossfadeLoop(buffer.getChannelData(c), fade));
    const gain = normalizeGain(analyse(channels));
    channels.forEach(data => { for (let i = 0; i < data.length; i++) data[i] *= gain; });
    const result = ac.createBuffer(channels.length, channels[0].length, buffer.sampleRate);
    channels.forEach((data, c) => result.getChannelData(c).set(data));
    return result;
  }

  function makeBuffers(ac) {
    const rate = ac.sampleRate, length = rate * 6;
    const white = ac.createBuffer(1, length, rate);
    const brown = ac.createBuffer(1, length, rate);
    const w = white.getChannelData(0), b = brown.getChannelData(0);
    let last = 0, sum = 0;
    for (let i = 0; i < length; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }
    const drift = b[length - 1] - b[0];
    for (let i = 0; i < length; i++) { b[i] -= drift * i / (length - 1); sum += b[i]; }
    const mean = sum / length;
    for (let i = 0; i < length; i++) b[i] -= mean;
    return {white, brown, recorded: {}};
  }

  function buildVoice(ac, kind, out, bufs, custom) {
    const sources = [];
    let alive = true;
    const gain = value => { const g = ac.createGain(); g.gain.value = value; return g; };
    const filter = (type, frequency, q = 0.7) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f; };
    const loop = (buffer, randomStart = true) => {
      const s = ac.createBufferSource(); s.buffer = buffer; s.loop = true;
      s.start(0, randomStart ? Math.random() * buffer.duration : 0); sources.push(s); return s;
    };
    const lfo = (rate, depth, param) => {
      const o = ac.createOscillator(); o.frequency.value = rate;
      o.connect(gain(depth)).connect(param); o.start(); sources.push(o);
    };
    const panner = value => {
      if (!ac.createStereoPanner) return out;
      const p = ac.createStereoPanner(); p.pan.value = value; p.connect(out); return p;
    };
    const tone = (t, length, freqs, level, dest, vibrato) => {
      const o = ac.createOscillator(), env = gain(0);
      o.frequency.setValueAtTime(freqs[0], t);
      freqs.slice(1).forEach((f, i) => o.frequency.exponentialRampToValueAtTime(f, t + length * (i + 1) / (freqs.length - 1)));
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(level, t + Math.min(0.02, length * 0.25));
      env.gain.setValueAtTime(level, t + length * 0.6);
      env.gain.linearRampToValueAtTime(0, t + length);
      if (vibrato) {
        const v = ac.createOscillator(); v.frequency.value = 6 + Math.random() * 3;
        v.connect(gain(freqs[0] * 0.012)).connect(o.frequency); v.start(t); v.stop(t + length);
      }
      o.connect(env).connect(dest); o.start(t); o.stop(t + length + 0.02);
    };

    const recorded = bufs.recorded && bufs.recorded[kind];
    if (kind === 'custom' && custom) {
      loop(custom, false).connect(gain(0.9)).connect(out);
    } else if (recorded) {
      const source = loop(recorded);
      if (kind === 'nightingale') {
        // Vogelgesang hat hohe Spitzen bei leisem Mittel: Spitzen dämpfen, dann anheben
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -38; comp.knee.value = 6; comp.ratio.value = 8;
        comp.attack.value = 0.002; comp.release.value = 0.15;
        source.connect(comp).connect(gain(1.5)).connect(out);
      } else {
        source.connect(gain(0.9)).connect(out);
      }
      if (kind === 'forest') {
        // leiser Wind unter der kurzen Vogelaufnahme, damit die Wiederholung weniger auffällt
        const wl = filter('lowpass', 450), wind = gain(0.16);
        loop(bufs.brown).connect(wl).connect(wind).connect(out);
        lfo(0.041, 0.1, wind.gain);
      }
    } else if (kind === 'sea') {
      const lp = filter('lowpass', 520, 0.6), body = gain(0.34);
      loop(bufs.brown).connect(lp).connect(body).connect(out);
      lfo(0.083, 0.21, body.gain); lfo(0.131, 0.08, body.gain); lfo(0.083, 280, lp.frequency);
      const foam = gain(0.035);
      loop(bufs.white).connect(filter('bandpass', 2400, 0.6)).connect(foam).connect(out);
      lfo(0.083, 0.03, foam.gain);
    } else if (kind === 'rain') {
      const hiss = gain(0.09);
      loop(bufs.white).connect(filter('highpass', 800)).connect(filter('lowpass', 7000)).connect(hiss).connect(out);
      lfo(0.05, 0.025, hiss.gain);
      loop(bufs.brown).connect(filter('lowpass', 350)).connect(gain(0.35)).connect(out);
      let next = ac.currentTime + 0.05;
      const drop = t => {
        const s = ac.createBufferSource(); s.buffer = bufs.white;
        const env = gain(0), amp = 0.03 + Math.random() ** 3 * 0.35;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(amp, t + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0005, t + 0.02 + Math.random() * 0.06);
        s.connect(filter('bandpass', 1500 + Math.random() * 5000, 3 + Math.random() * 8)).connect(env).connect(panner(Math.random() * 1.6 - 0.8));
        s.start(t, Math.random() * 5, 0.1);
      };
      const drops = () => {
        if (!alive) return;
        next = Math.max(next, ac.currentTime + 0.01);
        const until = ac.currentTime + 0.3;
        while (next < until) { drop(next); next += 0.012 + Math.random() * 0.07; }
        setTimeout(drops, 150);
      };
      drops();
    } else if (kind === 'forest') {
      const wl = filter('lowpass', 450), wind = gain(0.32);
      loop(bufs.brown).connect(wl).connect(wind).connect(out);
      lfo(0.041, 0.2, wind.gain); lfo(0.067, 150, wl.frequency);
      const leaves = gain(0.012);
      loop(bufs.white).connect(filter('bandpass', 3200, 0.5)).connect(leaves).connect(out);
      lfo(0.041, 0.01, leaves.gain);
      const bird = t => {
        const dest = panner(Math.random() * 1.4 - 0.7), level = 0.025 + Math.random() * 0.05, type = Math.random();
        if (type < 0.45) {
          const notes = 3 + Math.floor(Math.random() * 4), base = 2300 + Math.random() * 1600, dir = Math.random() < 0.5 ? -1 : 1;
          let at = t;
          for (let i = 0; i < notes; i++) {
            const f = base * (1 + dir * i * 0.05);
            tone(at, 0.07, [f * 0.9, f * 1.35, f * 0.95], level, dest);
            at += 0.11 + Math.random() * 0.05;
          }
        } else if (type < 0.75) {
          const o = ac.createOscillator(), env = gain(0), length = 0.5 + Math.random() * 0.4;
          o.frequency.value = 3000 + Math.random() * 1200;
          const mod = ac.createOscillator(); mod.frequency.value = 22 + Math.random() * 12;
          mod.connect(gain(350)).connect(o.frequency);
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(level * 0.8, t + 0.05);
          env.gain.linearRampToValueAtTime(0, t + length);
          o.connect(env).connect(dest);
          o.start(t); mod.start(t); o.stop(t + length + 0.02); mod.stop(t + length + 0.02);
        } else {
          const f = 1800 + Math.random() * 900;
          tone(t, 0.32, [f, f * 1.04], level, dest, true);
          tone(t + 0.42, 0.45, [f * 0.82, f * 0.78], level, dest, true);
        }
      };
      const birds = () => {
        if (!alive) return;
        bird(ac.currentTime + 0.05);
        setTimeout(birds, 1200 + Math.random() * 3300);
      };
      birds();
    }
    return {stop() { alive = false; sources.forEach(s => { try { s.stop(); } catch {} }); }};
  }

  /** Glockenton, der nach einigen Minuten Klingeln dazukommt */
  function chime(ac, out, t) {
    [784, 988, 1175].forEach((f, i) => {
      const at = t + i * 0.32;
      [[1, 0.22, 2.4], [2.76, 0.07, 1.2], [5.4, 0.03, 0.6]].forEach(([mult, amp, decay]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f * mult;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(amp, at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        o.connect(g).connect(out); o.start(at); o.stop(at + decay + 0.05);
      });
    });
  }

  return {analyse, normalizeGain, crossfadeLoop, prepareCustom, makeBuffers, buildVoice, chime};
}));
