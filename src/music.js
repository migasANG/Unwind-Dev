// Unwind music. Each theme has its own instruments, rhythm and register. Every sound is a separate note with a defined end.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindMusic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // One struck note built from partials: [frequency ratio, level, decay scale].
  function voice(ctx, dest, freq, t, vol, dur, attack, partials) {
    var out = ctx.createGain(), oscs = [];
    out.gain.value = 1; out.connect(dest);
    partials.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain(), d = Math.max(0.06, dur * (p[2] === undefined ? 1 : p[2]));
      o.type = 'sine'; o.frequency.value = freq * p[0];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * p[1], t + attack);
      g.gain.exponentialRampToValueAtTime(0.00008, t + d);
      g.gain.linearRampToValueAtTime(0, t + d + 0.03);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d + 0.05);
      oscs.push(o);
    });
    oscs[0].onended = function () { setTimeout(function () { try { out.disconnect(); } catch (e) {} }, 200); };
  }
  var FELT = [[1, 1], [2, 0.1, 0.7]];
  var WOOD = [[1, 1], [3.93, 0.32, 0.16], [9.2, 0.06, 0.06]];
  var BOX = [[1, 0.7], [4, 0.42, 0.4], [6.8, 0.14, 0.18]];
  var PIZZ = [[1, 1], [2, 0.35, 0.45]];
  var BELL = [[1, 1], [2.76, 0.34, 0.45], [5.4, 0.13, 0.22]];

  function note(ctx, dest, freq, t, vol, dur, attack) { voice(ctx, dest, freq, t, vol, dur, attack || 0.015, FELT); }

  // A soft swelling tone, filtered so that it stays round and free of hiss.
  function swell(ctx, dest, freq, t, vol, dur, attack, cutoff) {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff || 700; f.Q.value = 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.55));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = function () { g.disconnect(); f.disconnect(); };
  }
  // An electric-piano tone with a slow shimmer.
  function vibe(ctx, dest, freq, t, vol, dur) {
    var trem = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    trem.gain.value = 0.72; depth.gain.value = 0.28; lfo.frequency.value = 3.4;
    lfo.connect(depth); depth.connect(trem.gain); trem.connect(dest);
    lfo.start(t); lfo.stop(t + dur + 0.1);
    voice(ctx, trem, freq, t, vol, dur, 0.02, [[1, 1], [3, 0.1, 0.3]]);
    lfo.onended = function () { trem.disconnect(); depth.disconnect(); };
  }

  var THEMES = [
    { id: 'first-light', name: 'First Light', mood: 'Rolling felt piano', bpm: 66, beats: 4, style: 'piano',
      chords: [[48,55,64,67],[45,52,60,64],[41,48,57,64],[43,50,59,62],[48,55,64,72],[40,52,59,67],[41,48,60,69],[43,50,59,65]],
      melody: [[[0,76],[2,79]],[[1,76],[2.5,72]],[[0,72],[1.5,74],[3,76]],[[2,74]],[[0,79],[1.5,81],[3,79]],[[1,76],[2.5,74]],[[0,72],[2,76]],[[1,74],[3,71]]],
      pent: [60,62,64,67,69,72,74,76,79,81,84] },
    { id: 'still-water', name: 'Still Water', mood: 'Playful wooden kalimba', bpm: 92, beats: 4, style: 'kalimba',
      chords: [[45,64,69,72],[43,62,67,71],[40,59,64,67],[45,60,64,69],[41,60,65,69],[43,62,67,74],[45,64,72,76],[40,59,67,71]],
      melody: [[[2.5,81]],[[1.5,79],[3.5,83]],[[0.5,79]],[[2,76],[3.5,81]],[[2.5,84]],[[1.5,83],[3.5,79]],[[0.5,84],[2.5,81]],[[2,79]]],
      pent: [57,60,62,64,67,69,72,74,76,79,81] },
    { id: 'lantern-hour', name: 'Lantern Hour', mood: 'Music box waltz', bpm: 112, beats: 3, style: 'waltz',
      chords: [[41,57,60,65],[36,55,60,64],[38,57,62,65],[34,53,58,62],[41,57,60,69],[43,55,62,67],[34,53,62,65],[36,55,58,64]],
      melody: [[[0,89],[1,93],[2,96]],[[0,94],[1.5,91],[2,88]],[[0,86],[1,89],[2,93]],[[0,91],[1.5,86],[2,82]],[[0,93],[1,96],[2,98]],[[0,94],[1.5,91],[2,86]],[[0,89],[1,86],[2,82]],[[0,84],[2,88]]],
      pent: [53,57,60,62,65,67,69,72,74,77,79] },
    { id: 'night-swim', name: 'Night Swim', mood: 'Slow, dreamy electric piano', bpm: 46, beats: 4, style: 'dream',
      chords: [[38,57,60,65],[43,58,62,65],[36,55,58,64],[41,57,60,64],[34,53,57,62],[43,53,59,62],[36,52,55,62],[33,55,60,64]],
      melody: [[[1,69]],[[2,70],[3,67]],[[1.5,64]],[[0.5,65],[3,69]],[[1,62]],[[2,65],[3,62]],[[1,64]],[[0,61],[2.5,57]]],
      pent: [50,53,55,57,60,62,65,67,69,72,74] },
    { id: 'snowfall', name: 'Snowfall', mood: 'Winter: a tiptoeing celesta dance', bpm: 76, beats: 4, style: 'snow',
      chords: [[40,47,55,59],[40,47,55,59],[45,52,57,60],[47,54,59,63],[40,47,55,59],[36,48,55,60],[33,45,57,60],[35,47,54,59]],
      melody: [[[0,71],[0.5,71],[1,67],[1.5,71],[2,64],[3,66],[3.5,67]],[[0,69],[0.5,67],[1,66],[1.5,63],[2,64]],[[0,72],[0.5,72],[1,69],[1.5,72],[2,64],[3,67],[3.5,69]],[[0,71],[0.5,69],[1,67],[1.5,66],[2,63],[3,66]],[[0,71],[0.5,71],[1,67],[1.5,71],[2,76],[3,74],[3.5,72]],[[0,71],[0.5,72],[1,74],[1.5,72],[2,67],[3,64]],[[0,69],[0.5,72],[1,76],[1.5,72],[2,69],[3,66],[3.5,67]],[[0,66],[0.5,63],[1,59],[2,64]]],
      pent: [52,55,57,59,62,64,67,69,71,74,76] },
    { id: 'meadow', name: 'Meadow', mood: 'Spring: easy guitar and a happy flute', bpm: 84, beats: 4, style: 'meadow',
      chords: [[43,59,62,67],[40,59,64,67],[36,55,60,64],[38,57,62,66],[43,59,62,67],[47,59,62,66],[36,55,60,64],[38,54,60,62]],
      melody: [[[0,71],[2,74],[3,76]],[[0,74],[2,71]],[[0,72],[1,76],[2,79]],[[0,78],[2,74]],[[0,79],[2,76],[3,74]],[[0,71],[1.5,74]],[[0,76],[1,74],[2,72],[3,71]],[[0,69],[2,74]]],
      pent: [55,57,59,62,64,67,69,71,74,76,79] },
    { id: 'sandbar', name: 'Sandbar', mood: 'Summer: lazy bossa guitar', bpm: 92, beats: 4, style: 'bossa',
      chords: [[38,57,62,66],[38,57,61,66],[40,59,62,67],[45,55,61,66],[38,57,62,66],[35,54,62,66],[40,55,62,67],[45,55,61,64]],
      melody: [[[1.5,74],[3,78]],[[0.5,76],[2,73]],[[1,71],[2.5,74]],[[0,73],[1.5,69]],[[1.5,78],[3,81]],[[0.5,78],[2,74]],[[1,76],[2.5,79]],[[0,76],[2,73]]],
      pent: [50,52,54,57,59,62,64,66,69,71,74] },
    { id: 'amber-leaves', name: 'Amber Leaves', mood: 'Autumn: warm cello and a slow waltz', bpm: 74, beats: 3, style: 'amber',
      chords: [[33,52,57,60],[29,53,57,60],[36,52,55,60],[28,52,56,59],[33,52,60,64],[38,53,57,62],[35,50,56,59],[28,52,56,62]],
      melody: [[[0,64],[1,69],[2,72]],[[0,69],[2,65]],[[0,67],[1,72],[2,76]],[[0,71],[2,68]],[[0,69],[1,72],[2,76]],[[0,74],[2,69]],[[0,68],[1,71],[2,74]],[[0,71],[1,68],[2,64]]],
      pent: [45,48,50,52,55,57,60,62,64,67,69] }
  ];

  var bars = {
    piano: function (ctx, dest, th, chord, melody, t, beat, len) {
      voice(ctx, dest, hz(chord[0]), t, 0.11, len * 1.2, 0.05, FELT);
      for (var b = 0, i = 0; b < th.beats; b += 0.5, i++) {
        var tone = chord[[1, 2, 3, 2, 1, 2, 3, 1][i]];
        voice(ctx, dest, hz(tone + 12), t + b * beat, 0.042, beat * 2.2, 0.012, FELT);
      }
      if (melody) melody.forEach(function (n) { voice(ctx, dest, hz(n[1]), t + n[0] * beat, 0.09, beat * 3, 0.012, FELT); });
    },
    kalimba: function (ctx, dest, th, chord, melody, t, beat) {
      // A bouncing off-beat pattern with very short, woody notes and no held harmony.
      [[0, 1], [0.75, 2], [1.5, 3], [2, 2], [2.75, 3], [3.5, 1]].forEach(function (p) {
        voice(ctx, dest, hz(chord[p[1]]), t + p[0] * beat, 0.1, 0.62, 0.003, WOOD);
      });
      voice(ctx, dest, hz(chord[0]), t, 0.13, 0.75, 0.005, PIZZ);
      voice(ctx, dest, hz(chord[0] + 7), t + 2.5 * beat, 0.07, 0.55, 0.005, PIZZ);
      if (melody) melody.forEach(function (n) { voice(ctx, dest, hz(n[1]), t + n[0] * beat, 0.11, 0.8, 0.003, WOOD); });
    },
    waltz: function (ctx, dest, th, chord, melody, t, beat) {
      // Oom-pah-pah under a high, glassy music box.
      voice(ctx, dest, hz(chord[0]), t, 0.15, 0.7, 0.006, PIZZ);
      [1, 2].forEach(function (b) {
        voice(ctx, dest, hz(chord[1]), t + b * beat, 0.05, 0.42, 0.006, PIZZ);
        voice(ctx, dest, hz(chord[2]), t + b * beat, 0.05, 0.42, 0.006, PIZZ);
        voice(ctx, dest, hz(chord[3]), t + b * beat, 0.05, 0.42, 0.006, PIZZ);
      });
      if (melody) melody.forEach(function (n) { voice(ctx, dest, hz(n[1]), t + n[0] * beat, 0.065, 1.5, 0.002, BOX); });
    },
    dream: function (ctx, dest, th, chord, melody, t, beat, len) {
      // Low, held and spacious: a swelling bed, a deep bass and a few shimmering notes.
      swell(ctx, dest, hz(chord[0]), t, 0.085, len * 1.1, 1.2, 420);
      chord.slice(1).forEach(function (m) { swell(ctx, dest, hz(m), t + 0.1, 0.038, len * 1.15, 1.8, 900); });
      vibe(ctx, dest, hz(chord[2] + 12), t + 0.5 * beat, 0.04, beat * 3);
      if (melody) melody.forEach(function (n) { vibe(ctx, dest, hz(n[1]), t + n[0] * beat, 0.11, beat * 3.4); });
    }
  };
  Object.assign(bars, {
    snow: function (ctx, dest, th, chord, melody, t, beat) {
      // Plucked strings march softly underneath, with a low, staccato celesta on top.
      voice(ctx, dest, hz(chord[0]), t, 0.1, 0.5, 0.004, PIZZ);
      voice(ctx, dest, hz(chord[1]), t + 2 * beat, 0.075, 0.45, 0.004, PIZZ);
      [1, 3].forEach(function (b) {
        voice(ctx, dest, hz(chord[2]), t + b * beat, 0.035, 0.28, 0.004, PIZZ);
        voice(ctx, dest, hz(chord[3]), t + b * beat, 0.035, 0.28, 0.004, PIZZ);
      });
      if (melody) melody.forEach(function (n) { voice(ctx, dest, hz(n[1]), t + n[0] * beat, 0.07, 0.75, 0.002, CELESTA); });
    },
    meadow: function (ctx, dest, th, chord, melody, t, beat, len) {
      // An unhurried fingerpicked pattern with a warm, low flute singing over it.
      voice(ctx, dest, hz(chord[0]), t, 0.1, 1.6, 0.008, GUITAR);
      [[0.5, 1], [1, 2], [1.5, 3], [2.5, 1], [3, 2], [3.5, 3]].forEach(function (p) {
        voice(ctx, dest, hz(chord[p[1]]), t + p[0] * beat, 0.042, 1.15, 0.006, GUITAR);
      });
      voice(ctx, dest, hz(chord[0] + 7), t + 2 * beat, 0.065, 1.2, 0.008, GUITAR);
      if (melody) melody.forEach(function (n, i) {
        var next = melody[i + 1] ? melody[i + 1][0] : th.beats;
        swell(ctx, dest, hz(n[1]), t + n[0] * beat, 0.058, (next - n[0]) * beat * 0.96, 0.09, 1500);
      });
    },
    bossa: function (ctx, dest, th, chord, melody, t, beat, len) {
      // A full band: warm chords underneath, walking bass, rhythm guitar, soft shaker clicks and answering vibes.
      chord.slice(1).forEach(function (m) { swell(ctx, dest, hz(m), t, 0.03, len * 1.04, 0.4, 1100); });
      voice(ctx, dest, hz(chord[0]), t, 0.13, 0.95, 0.006, PIZZ);
      voice(ctx, dest, hz(chord[0] + 7), t + 1.5 * beat, 0.08, 0.5, 0.006, PIZZ);
      voice(ctx, dest, hz(chord[0] + 12), t + 2 * beat, 0.1, 0.8, 0.006, PIZZ);
      voice(ctx, dest, hz(chord[0] + 7), t + 3.5 * beat, 0.08, 0.45, 0.006, PIZZ);
      [0.5, 1.5, 2.5, 3, 3.5].forEach(function (b) {
        [1, 2, 3].forEach(function (i) { voice(ctx, dest, hz(chord[i]), t + b * beat + i * 0.012, 0.038, 0.6, 0.004, GUITAR); });
      });
      for (var c = 0; c < th.beats * 2; c++) voice(ctx, dest, 2100, t + c * 0.5 * beat, c % 2 ? 0.016 : 0.009, 0.05, 0.001, [[1, 1]]);
      vibe(ctx, dest, hz(chord[3] + 12), t + 1 * beat, 0.026, beat * 1.5);
      vibe(ctx, dest, hz(chord[2] + 12), t + 2.5 * beat, 0.026, beat * 1.5);
      if (melody) melody.forEach(function (n) { voice(ctx, dest, hz(n[1]), t + n[0] * beat, 0.085, 1.25, 0.006, GUITAR); });
    },
    amber: function (ctx, dest, th, chord, melody, t, beat, len) {
      swell(ctx, dest, hz(chord[0] + 12), t, 0.075, len * 1.02, 0.5, 620);
      [1, 2].forEach(function (b) { [1, 2, 3].forEach(function (i) { voice(ctx, dest, hz(chord[i]), t + b * beat, 0.028, 0.75, 0.01, FELT); }); });
      if (melody) melody.forEach(function (n, i) {
        var next = melody[i + 1] ? melody[i + 1][0] : th.beats;
        swell(ctx, dest, hz(n[1]), t + n[0] * beat, 0.075, (next - n[0]) * beat, 0.09, 1300);
      });
    }
  });
  // Soft season sounds. These are plain tones with no noise in them.
  function glide(ctx, dest, from, to, t, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    o.onended = function () { g.disconnect(); };
  }
  function windSound(ctx, dest, t) { glide(ctx, dest, 220, 520, t, 0.75, 0.06); glide(ctx, dest, 330, 260, t + 0.25, 0.8, 0.05); }
  function freezeSound(ctx, dest, t) { [88, 91, 96].forEach(function (m, i) { voice(ctx, dest, hz(m), t + i * 0.06, 0.07, 0.9, 0.002, BELL); }); }
  function crackSound(ctx, dest, t) { [84, 79].forEach(function (m, i) { voice(ctx, dest, hz(m), t + i * 0.05, 0.1, 0.45, 0.002, WOOD); }); }
  // A short burst of shaped noise: the rush of flame. It has a defined end, so nothing lingers.
  function flameBurst(ctx, dest, t, dur, vol, fromHz, toHz) {
    var len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = last * 0.82 + (Math.random() * 2 - 1) * 0.18; d[i] = last; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(fromHz, t); f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.28); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.02);
    s.onended = function () { g.disconnect(); f.disconnect(); };
  }
  function crackles(ctx, dest, t, span, count, vol) {
    for (var i = 0; i < count; i++) voice(ctx, dest, 1400 + Math.random() * 1800, t + Math.random() * span, vol * (0.5 + Math.random() * 0.5), 0.05, 0.001, [[1, 1]]);
  }
  // Tiles catching fire: a rising whoosh, a warm low swell and crackling embers.
  function igniteSound(ctx, dest, t) {
    flameBurst(ctx, dest, t, 0.75, 0.55, 500, 1500);
    glide(ctx, dest, 70, 165, t, 0.65, 0.16);
    crackles(ctx, dest, t + 0.12, 0.85, 9, 0.07);
  }
  // An arrow hitting fire: a quick flare and a sizzle.
  function fireSound(ctx, dest, t) {
    flameBurst(ctx, dest, t, 0.42, 0.45, 1300, 500);
    glide(ctx, dest, 220, 95, t, 0.4, 0.1);
    crackles(ctx, dest, t + 0.05, 0.5, 5, 0.06);
  }
  // A bee carrying off a flower: a soft wing flutter under a bright little rising chime.
  function springSound(ctx, dest, t) {
    var o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(235, t); o.frequency.linearRampToValueAtTime(330, t + 0.55);
    lfo.frequency.value = 42; depth.gain.value = 16; lfo.connect(depth); depth.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.07); g.gain.linearRampToValueAtTime(0, t + 0.6);
    o.connect(g); g.connect(dest); o.start(t); lfo.start(t); o.stop(t + 0.62); lfo.stop(t + 0.62);
    o.onended = function () { g.disconnect(); depth.disconnect(); };
    [79, 83, 88].forEach(function (m, i) { voice(ctx, dest, hz(m), t + 0.08 + i * 0.09, 0.085, 0.75, 0.003, BELL); });
  }
  function buzzSound(ctx, dest, t) { glide(ctx, dest, 300, 420, t, 0.22, 0.03); }
  // Schedules one bar and returns its length in seconds.
  function scheduleBar(ctx, dest, themeIndex, bar, t) {
    var th = THEMES[themeIndex], beat = 60 / th.bpm, len = th.beats * beat;
    var chord = th.chords[bar % th.chords.length], cycle = Math.floor(bar / th.chords.length);
    // The melody rests every third time round, so the theme has room to breathe.
    var melody = cycle % 3 !== 2 ? th.melody[bar % th.melody.length] : null;
    bars[th.style](ctx, dest, th, chord, melody, t, beat, len);
    return len;
  }
  // Three quiet little victory pieces, each with its own melody and instrument. Returns the length in seconds.
  var GUITAR = [[1, 1], [2, 0.28, 0.5], [3, 0.09, 0.25]];
  var CELESTA = [[1, 1], [4, 0.1, 0.25]];
  var VICTORIES = [
    { name: 'Hearth', beat: 0.36, voice: GUITAR, vol: 0.085, ring: 2.2, // fingerpicked guitar
      notes: [[0,55],[0.5,62],[1,67],[1.5,71],[2,74],[3,71],[4,48],[4.5,60],[5,64],[5.5,67],[6,72],[7,71],[8,55],[8.5,62],[9,67],[10,79]] },
    { name: 'Blanket', beat: 0.5, voice: FELT, vol: 0.095, ring: 2.4, // a slow piano lullaby in three
      notes: [[0,53],[0,69],[1,60],[2,65],[3,72],[4,60],[5,65],[6,48],[6,67],[7,60],[8,53],[8,65]] },
    { name: 'Cocoa', beat: 0.42, voice: CELESTA, vol: 0.075, ring: 2.2, swell: [48, 55, 64], // soft celesta over warm low notes
      notes: [[0,76],[1,79],[2,84],[4,83],[5,79],[6,76],[8,74],[9,77],[10,72]] }
  ];
  function victory(ctx, dest, piece, perfect, t) {
    var v = VICTORIES[piece % VICTORIES.length], last = 0;
    v.notes.forEach(function (n) {
      voice(ctx, dest, hz(n[1]), t + n[0] * v.beat, v.vol, v.ring, 0.012, v.voice);
      last = Math.max(last, n[0] * v.beat);
    });
    if (v.swell) v.swell.forEach(function (m) { swell(ctx, dest, hz(m), t, 0.035, last + 2, 1.2, 600); });
    // A perfect clear adds one small extra note at the end.
    if (perfect) voice(ctx, dest, hz(v.notes[v.notes.length - 1][1] + 12), t + last + v.beat, v.vol * 0.7, v.ring, 0.012, v.voice);
    return last + v.ring + (perfect ? v.beat : 0);
  }
  // The sound of the clock running out: a falling bell ending on a low one.
  function timeUp(ctx, dest, t) {
    [[76, 0], [72, 0.24], [67, 0.48], [60, 0.76], [48, 0.76]].forEach(function (n) {
      voice(ctx, dest, hz(n[0]), t + n[1], n[0] < 55 ? 0.32 : 0.28, n[1] > 0.7 ? 2.4 : 0.9, 0.004, BELL);
    });
    return 3.2;
  }
  function tick(ctx, dest, urgent, t) {
    voice(ctx, dest, urgent ? 1046.5 : 784, t, urgent ? 0.26 : 0.17, 0.26, 0.002, WOOD);
    if (urgent) voice(ctx, dest, 1046.5, t + 0.13, 0.17, 0.2, 0.002, WOOD);
  }
  return { igniteSound: igniteSound, springSound: springSound, windSound: windSound, freezeSound: freezeSound, crackSound: crackSound, fireSound: fireSound, buzzSound: buzzSound, VICTORIES: VICTORIES, timeUp: timeUp, tick: tick, victory: victory, THEMES: THEMES, hz: hz, note: note, scheduleBar: scheduleBar };
});
