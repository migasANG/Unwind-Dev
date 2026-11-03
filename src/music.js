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
      pent: [50,53,55,57,60,62,65,67,69,72,74] }
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
  return { VICTORIES: VICTORIES, timeUp: timeUp, tick: tick, victory: victory, THEMES: THEMES, hz: hz, note: note, scheduleBar: scheduleBar };
});
