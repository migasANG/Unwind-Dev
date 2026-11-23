(function () {
  'use strict';
  var E = window.UnwindEngine, M = window.UnwindMusic, SETS = window.UNWIND_LEVELS;
  Object.keys(SETS).forEach(function (k) { SETS[k].forEach(E.prepare); });
  var SET_INFO = {
    calm: { label: 'Calm', prefix: 'L', title: 'Level ' },
    hard: { label: 'Hard', prefix: 'H', title: 'Hard ' },
    timed: { label: 'Timed', prefix: 'T', title: 'Timed ', offset: 48 },
    winter: { label: 'Winter', prefix: 'W', title: 'Winter ', offset: 60, season: true },
    spring: { label: 'Spring', prefix: 'S', title: 'Spring ', offset: 67, season: true },
    summer: { label: 'Summer', prefix: 'U', title: 'Summer ', offset: 74, season: true },
    autumn: { label: 'Autumn', prefix: 'A', title: 'Autumn ', offset: 81, season: true }
  };
  SET_INFO.hard.offset = 36; SET_INFO.calm.offset = 0;
  var SEASON_ORDER = ['winter', 'spring', 'summer', 'autumn'];
  var SET_FLOW = ['calm', 'hard', 'timed', 'winter', 'spring', 'summer', 'autumn'];
  var HEART = '<path d="M12 20.500s-7.800-4.700-9.300-9.700C1.600 7.200 3.800 4.200 7 4.200c2 0 3.700 1 5 3 1.300-2 3-3 5-3 3.200 0 5.400 3 4.300 6.600-1.500 5-9.300 9.700-9.300 9.700Z"/>';
  function heartSvg(cls) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + HEART + '</svg>'; }
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One day on the lake. Sun height (percent of screen) moves with progress.
  var CHAPTERS = [
    { name: 'Dawn', a: '#f6d9cf', b: '#c9c6e6', ink: '#3d2f5b', twin: '#b83563', compass: '#0f6a79', sun: '#ffeccf', card: '#fff6f0', hint: '#e85d04', music: 0, mirror: '#1f6fd6', twins: ['#b83563', '#0a7d55', '#8f5200', '#5a3fc0', '#4d7c0f', '#0369a1', '#9d174d'] },
    { name: 'Morning', a: '#c3e6e4', b: '#e5f2d8', ink: '#123f4a', twin: '#c23c3c', compass: '#6a3fb0', sun: '#fff9dc', card: '#f6fcf8', hint: '#e85d04', music: 1, mirror: '#1f6fd6', twins: ['#c23c3c', '#a8127a', '#7d5200', '#2f6f1f', '#4d7c0f', '#0369a1', '#9d174d'] },
    { name: 'Noon', a: '#a9d8ef', b: '#e8f6ee', ink: '#10385a', twin: '#c0392b', compass: '#7a3aa8', sun: '#fffdf0', card: '#f4fbff', hint: '#e85d04', music: 8, mirror: '#1f6fd6', twins: ['#c0392b', '#a8127a', '#7d5200', '#2f6f1f', '#4d7c0f', '#0369a1', '#9d174d'] },
    { name: 'Dusk', a: '#4f4580', b: '#b4688a', ink: '#fff1e0', twin: '#ffcb77', compass: '#94ece6', sun: '#ffab76', card: '#3f3768', hint: '#ffe14d', music: 2, mirror: '#8fd0ff', twins: ['#ffcb77', '#ff9ecb', '#a8f08a', '#a9d4ff', '#c4b5fd', '#f0abfc', '#fde047'] },
    { name: 'Night', a: '#111737', b: '#27335f', ink: '#e7ecff', twin: '#ffa6b8', compass: '#8ee8c6', sun: '#dfe6ff', card: '#1b2348', hint: '#ffe14d', music: 3, mirror: '#7cc4ff', twins: ['#ffa6b8', '#ffd479', '#a8f08a', '#a9d4ff', '#c4b5fd', '#f0abfc', '#fde047'] }
  ];
  var SEASONS = {
    winter: { name: 'Winter', a: '#bfdcf0', b: '#eef6fb', ink: '#12365a', twin: '#b83563', compass: '#5a3fc0', sun: '#ffffff', card: '#f6fbff', hint: '#e85d04', music: 4, mirror: '#1f6fd6', twins: ['#b83563', '#0a7d55', '#8f5200', '#5a3fc0', '#4d7c0f', '#0369a1', '#9d174d'] },
    spring: { name: 'Spring', a: '#bfe6f5', b: '#a8d982', ink: '#143c24', twin: '#b83563', compass: '#6a3fb0', sun: '#fff7c9', card: '#f7fcef', hint: '#e85d04', music: 5, mirror: '#1f6fd6', twins: ['#b83563', '#a8127a', '#7d5200', '#5a3fc0', '#4d7c0f', '#0369a1', '#9d174d'] },
    summer: { name: 'Summer', a: '#8fd8f2', b: '#f7e3ac', ink: '#0d3555', twin: '#b83563', compass: '#5a3fc0', sun: '#fff0a8', card: '#fffaf0', hint: '#c2410c', music: 6, mirror: '#1f6fd6', twins: ['#b83563', '#0a7d55', '#7d5200', '#5a3fc0', '#4d7c0f', '#0369a1', '#9d174d'] },
    autumn: { name: 'Autumn', a: '#e8b070', b: '#b5763c', ink: '#311705', twin: '#a01f4b', compass: '#2f4f8f', sun: '#ffd892', card: '#fff4e3', hint: '#0f6a79', music: 7, mirror: '#1f4fa6', twins: ['#a01f4b', '#14603f', '#2f4f8f', '#6a2fa0', '#4d7c0f', '#0369a1', '#9d174d'] }
  };
  function chapterFor(i, total) { return CHAPTERS[Math.min(4, Math.floor(i / total * 5))]; }

  // Storage can throw in private windows, so every access is guarded.
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  var progress = load('unwind.progress2', { last: { set: 'calm', index: 0 }, done: {}, perfect: {}, best: {}, endlessBy: {}, endlessOpts: { hard: false, timed: false }, daily: null });
  var audioPrefs = load('unwind.audio', { music: true, sound: true, theme: 'auto' });
  // Every session starts on Follow the level, while music and sound on/off are remembered.
  audioPrefs.theme = 'auto';
  var events = load('unwind.events', []);

  // Every analytics event goes through here. Connect a real service in this one function.
  function track(name, props) {
    var e = Object.assign({ e: name, t: Date.now(), level: current ? current.id : null }, props || {});
    events.push(e);
    if (events.length > 2000) events = events.slice(-2000);
    save('unwind.events', events);
  }

  /* ---------- Sound: everything is a short note. There is no drone, and silence is true silence. ---------- */
  var colors = CHAPTERS[0], audioUnlocked = false;
  var ac = null, sfxBus = null, musicBus = null, duckBus = null, sectionBus = null, jingleBus = null, analyser = null, musicBar = 0, nextBarAt = 0, playingTheme = -1;
  var ARROW_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  // Volume bars: each is 0 to 1, on top of the game's own balance between music and sounds.
  function musicLevel() { return audioPrefs.music ? 0.8 * (audioPrefs.musicVol === undefined ? 1 : audioPrefs.musicVol) : 0; }
  function soundLevel() { return audioPrefs.sound ? 0.7 * (audioPrefs.soundVol === undefined ? 1 : audioPrefs.soundVol) : 0; }
  function audio() {
    if (!audioPrefs.music && !audioPrefs.sound) return null;
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      sfxBus = ac.createGain(); musicBus = ac.createGain(); duckBus = ac.createGain();
      sfxBus.gain.value = soundLevel(); musicBus.gain.value = musicLevel(); duckBus.gain.value = 1;
      var delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
      delay.delayTime.value = 0.34; fb.gain.value = 0.38; wet.gain.value = 0.3;
      duckBus.connect(musicBus); sfxBus.connect(ac.destination); musicBus.connect(ac.destination);
      sfxBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
      analyser = ac.createAnalyser(); analyser.fftSize = 2048; musicBus.connect(analyser);
      setInterval(musicTick, 200);
    }
    if (ac.state !== 'running' && !document.hidden) ac.resume();
    if (!audioUnlocked) {
      // Phones only allow sound once a real tap has started some. A silent blip inside that tap satisfies them.
      audioUnlocked = true;
      try { var blip = ac.createBufferSource(); blip.buffer = ac.createBuffer(1, 1, 22050); blip.connect(ac.destination); blip.start(0); } catch (e) {}
    }
    return ac;
  }
  function wantedTheme() {
    if (audioPrefs.theme !== 'auto') {
      var i = M.THEMES.map(function (t) { return t.id; }).indexOf(audioPrefs.theme);
      if (i >= 0) return i;
    }
    return colors.music;
  }
  /* ---------- Open Water's default background: each song plays once, then the scene fades to the next ---------- */
  var CYCLE = ['0', '1', '2', '3', '4', 'winter', 'spring', 'summer', 'autumn'], CYCLE_GAP = 2000;
  var bgCycle = { i: 0, gapUntil: 0, endAt: 0 };
  function cycleOn() { return !!current && current.mode === 'endless' && backgroundChoice() === 'default'; }
  function shownBackground() { var b = backgroundChoice(); return b === 'default' ? CYCLE[bgCycle.i] : b; }
  function cycleSeconds() { return M.patternSeconds(colors.music); }
  function startCycleSection() {
    bgCycle.endAt = performance.now() + cycleSeconds() * 1000;
    if (ac && audioPrefs.theme === 'auto') {
      if (wantedTheme() === playingTheme) { musicBar = 0; nextBarAt = ac.currentTime + 0.05; }
    }
  }
  function resetCycle() { bgCycle.i = 0; bgCycle.gapUntil = 0; playingTheme = -1; bgCycle.endAt = performance.now() + M.patternSeconds(CHAPTERS[0].music) * 1000; }
  function cycleTick() {
    if (!cycleOn()) return;
    var now = performance.now();
    if (bgCycle.gapUntil) {
      if (now >= bgCycle.gapUntil) { bgCycle.gapUntil = 0; startCycleSection(); musicTick(); }
      return;
    }
    var songDriven = ac && ac.state === 'running' && audioPrefs.music && audioPrefs.theme === 'auto' && playingTheme === wantedTheme();
    // The scene gets ready just before the song's last bar is over, so the fade fills the whole gap.
    var finished = songDriven ? musicBar >= M.patternBars(playingTheme) && ac.currentTime >= nextBarAt - 0.25 : now >= bgCycle.endAt;
    if (!finished) return;
    bgCycle.i = (bgCycle.i + 1) % CYCLE.length;
    bgCycle.gapUntil = now + CYCLE_GAP + (songDriven ? 250 : 0);
    nextFade = CYCLE_GAP - 100;
    applyBackgroundNow();
    track('background_cycle', { to: CYCLE[bgCycle.i] });
  }
  setInterval(cycleTick, 150);
  function seasonSound(fn) { if (!audioPrefs.sound) return; var c = audio(); if (c) M[fn](c, sfxBus, c.currentTime + 0.01); }
  function musicTick() {
    if (!ac || ac.state !== 'running' || !audioPrefs.music) return;
    var want = wantedTheme(), cycling = cycleOn() && audioPrefs.theme === 'auto';
    // Open Water's rotation: silent during the gap, and nothing plays past the end of the song.
    if (cycling && (bgCycle.gapUntil || (want === playingTheme && musicBar >= M.patternBars(playingTheme)))) return;
    if (want !== playingTheme) {
      // Fade the old theme out at once, including notes already queued, and start the new one straight away.
      if (sectionBus) {
        var old = sectionBus;
        old.gain.cancelScheduledValues(ac.currentTime);
        old.gain.setTargetAtTime(0, ac.currentTime, 0.18);
        setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 1500);
      }
      sectionBus = ac.createGain(); sectionBus.gain.value = M.THEMES[want].trim || 1; sectionBus.connect(duckBus);
      playingTheme = want; musicBar = 0; nextBarAt = ac.currentTime + 0.25;
    }
    if (ac.currentTime + 0.6 < nextBarAt) return;
    var at = Math.max(nextBarAt, ac.currentTime + 0.1);
    nextBarAt = at + M.scheduleBar(ac, sectionBus, playingTheme, musicBar++, at);
  }
  // The arrow sound: a sine with a little triangle an octave up, through a soft echo.
  function pluck(freq, when, vol, decay) {
    if (!audioPrefs.sound) return;
    var c = audio(); if (!c) return;
    var t = c.currentTime + (when || 0), d = decay || 1.3, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    g2.gain.value = 0.12;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(sfxBus);
    o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    o.onended = function () { g.disconnect(); g2.disconnect(); };
  }
  function noteFor(step) {
    var seq = tuneBase + step * 3 + (step % 2 ? 2 : 0);
    return 196 * Math.pow(2, ARROW_SCALE[seq % ARROW_SCALE.length] / 12);
  }
  function thud() { pluck(82.4, 0, 0.22, 0.34); }
  // Lowers the music by 90% while the victory piece or a tune plays, then brings it back.
  var duckTimer = null;
  function setDuck(level) {
    if (!ac || !duckBus) return;
    clearTimeout(duckTimer);
    var now = ac.currentTime, g = duckBus.gain;
    g.cancelScheduledValues(now);
    if (level === 1) { g.setTargetAtTime(1, now, 0.35); return; }
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(level, now + 0.25);
  }
  function duck(on) { setDuck(on ? 0.1 : 1); }
  function duckFor(seconds, level) {
    setDuck(level === undefined ? 0.1 : level);
    duckTimer = setTimeout(function () { setDuck(1); }, seconds * 1000);
  }
  function stopJingle() {
    if (!jingleBus || !ac) return;
    var j = jingleBus; jingleBus = null;
    j.gain.setTargetAtTime(0, ac.currentTime, 0.12);
    setTimeout(function () { try { j.disconnect(); } catch (e) {} }, 900);
  }
  var lastVictory = -1;
  function victoryMusic(perfect) {
    if (!audioPrefs.music && !audioPrefs.sound) return;
    var c = audio(); if (!c) return;
    stopJingle();
    jingleBus = c.createGain(); jingleBus.gain.value = 0.9; jingleBus.connect(c.destination);
    // A random cozy piece, never the same one twice in a row.
    var piece = lastVictory;
    while (piece === lastVictory) piece = Math.floor(Math.random() * M.VICTORIES.length);
    lastVictory = piece;
    // The background music goes fully silent for the victory piece, then returns when it ends.
    duckFor(M.victory(c, jingleBus, piece, perfect, c.currentTime + 0.05), 0);
  }
  function playTune() {
    stopJingle();
    if (!tune.length) return;
    audio();
    tune.forEach(function (f, i) { pluck(f, i * 0.27, 0.2, 1.5); });
    duckFor((tune.length - 1) * 0.27 + 1.6, 0);
  }
  function timeUpSound() {
    if (!audioPrefs.sound) return;
    var c = audio(); if (!c) return;
    duckFor(M.timeUp(c, sfxBus, c.currentTime + 0.02));
    buzz(180);
  }
  function tickSound(urgent) {
    if (!audioPrefs.sound) return;
    var c = audio(); if (c) M.tick(c, sfxBus, urgent, c.currentTime + 0.01);
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  // Phones can suspend sound (a call, or switching apps). Any later touch brings it back.
  ['touchend', 'click', 'keydown'].forEach(function (name) {
    document.addEventListener(name, function () { if (ac && ac.state !== 'running' && !document.hidden) ac.resume(); }, { passive: true, capture: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  /* ---------- Level state ---------- */
  var current = null, state = null, hintsLeft = 1, hintArrow = -1, stuckShown = false, blockerGlow = {};
  var flights = [], bounces = {}, ripples = [], angles = {}, introStart = 0, collisions = 0, ended = false;
  var lastHintAmt = 0, wakes = [], HINT_IN = 500, HINT_HOLD = 3000, HINT_OUT = 800, cards = [], embers = [], bee = null, beesLeaving = [], ambience = [], windAt = 0, hintStart = 0, tune = [], tuneBase = 0, hintsUsed = 0, rewinds = 0, activeMs = 0, lastFrame = 0, timeLeft = null, lastSecond = -1, nudges = {};

  function openLevel(set, index) {
    var list = SETS[set], info = SET_INFO[set], lvl = list[index];
    progress.last = { set: set, index: index }; save('unwind.progress2', progress);
    begin({ id: info.prefix + (index + 1), set: set, index: index, mode: 'levels', level: lvl, title: info.title + (index + 1 + (info.offset || 0)),
      chapter: info.season ? SEASONS[set] : chapterFor(index, list.length), sunY: 72 - Math.sin(Math.min(index / (list.length - 1), 1) * Math.PI) * 58 });
  }
  function timeChapter() { var h = new Date().getHours(); return h < 6 ? 4 : h < 10 ? 0 : h < 14 ? 1 : h < 18 ? 2 : h < 21 ? 3 : 4; }
  // Open water keeps the usual sky unless the player picks another background.
  var BACKGROUNDS = [['default', 'Default'], ['0', 'Dawn'], ['1', 'Morning'], ['2', 'Noon'], ['3', 'Dusk'], ['4', 'Night'], ['winter', 'Winter'], ['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn']];
  function backgroundChoice() { return endlessOpts().background || 'default'; }
  function backgroundPalette() {
    var b = shownBackground();
    return SEASONS[b] || CHAPTERS[+b];
  }
  function setBackground(b) {
    var o = endlessOpts(); o.background = b; progress.endlessOpts = o; save('unwind.progress2', progress);
    track('background', { background: b });
  }
  // The next background is built out of sight first. Only once it is fully drawn does it fade in over the old one.
  var bgRequest = 0;
  function applyBackgroundNow() {
    if (!current || current.mode !== 'endless') return;
    var ask = ++bgRequest, choice = shownBackground(), next = SEASONS[choice] ? choice : null, old = $('seasonBg');
    if ((old.getAttribute('data-season') || null) === next && !old.hidden === !!next) { commitBackground(ask, null, next); return; }
    var fresh = document.createElement('div');
    fresh.className = 'scenebg pending';
    old.parentNode.insertBefore(fresh, old.nextSibling);
    if (next) { fresh.setAttribute('data-season', next); bakeScene(fresh, next); }
    // Give the browser time to finish painting the new scene, so it never fades in half drawn.
    requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(function () { requestAnimationFrame(function () {
      // A newer choice replaced this one while it was getting ready.
      if (ask !== bgRequest || !current || current.mode !== 'endless') { fresh.remove(); return; }
      commitBackground(ask, fresh, next);
    }); }, next ? 90 : 0); }); });
  }
  // A gentle crossfade: the scene, sky, sun, board and menus all drift to the new colours together.
  var BG_FADE = 1400, nextFade = 1400;
  function commitBackground(ask, fresh, next) {
    BG_FADE = nextFade; nextFade = 1400;
    document.documentElement.style.setProperty('--bgfade', (BG_FADE / 1000) + 's');
    var old = $('seasonBg'), sun = $('sun'), board = $('board'), sunWasOn = !sun.hidden;
    document.body.classList.add('bgswap');
    // A copy of the board as it looks now fades out while the real one draws in the new colours.
    if (!reduced) {
      var copy = document.createElement('canvas');
      copy.className = 'boardfade'; copy.width = board.width; copy.height = board.height;
      copy.getContext('2d').drawImage(board, 0, 0);
      board.parentNode.insertBefore(copy, board.nextSibling);
      requestAnimationFrame(function () { copy.style.opacity = '0'; });
      setTimeout(function () { copy.remove(); }, BG_FADE + 60);
    }
    if (fresh) {
      old.removeAttribute('id');
      fresh.id = 'seasonBg';
      if (!next) { fresh.hidden = true; old.classList.add('leaving'); }
      requestAnimationFrame(function () { fresh.classList.remove('pending'); });
      setTimeout(function () { old.remove(); }, BG_FADE + 60);
    }
    current.chapter = backgroundPalette();
    applyChapter(current.chapter, 34);
    applySeason(next);
    // The sun stays until the new scene has covered it.
    if (next && sunWasOn && !reduced) {
      sun.hidden = false;
      setTimeout(function () { if (ask === bgRequest) sun.hidden = true; }, BG_FADE + 60);
    }
    ambience = [];
    refresh(); layout();
    lastDrawn = 0;
    musicTick();
    setTimeout(function () { if (ask === bgRequest) document.body.classList.remove('bgswap'); }, BG_FADE + 60);
  }
  function effectChoice() {
    var o = endlessOpts();
    if (o.seasonChoice && !o.effectList) { o.effectList = SEASON_ORDER.indexOf(o.seasonChoice) >= 0 ? [o.seasonChoice] : []; o.effectRandom = o.seasonChoice === 'random'; delete o.seasonChoice; }
    return { list: o.effectList || [], random: !!o.effectRandom };
  }
  var BG_AUTO_NOTE = 'The backgrounds will change with the music: when a song ends, the next scene fades in.';
  function bgNote(plain) { return backgroundChoice() === 'default' ? BG_AUTO_NOTE : plain; }
  function backgroundButtons(cls) {
    return '<div class="sizes bgs ' + (cls || '') + '" role="group" aria-label="Background">' + BACKGROUNDS.map(function (x) { return '<button data-bg="' + x[0] + '" aria-pressed="' + (backgroundChoice() === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function wireBackgrounds(s, onPick) {
    s.querySelectorAll('[data-bg]').forEach(function (b) {
      b.onclick = function () {
        setBackground(b.getAttribute('data-bg'));
        s.querySelectorAll('[data-bg]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        s.querySelectorAll('[data-bgnote]').forEach(function (n) { n.textContent = bgNote(n.getAttribute('data-bgnote')); });
        if (onPick) onPick();
      };
    });
  }
  function backgroundSheet() {
    var s = sheet('<div class="row"><h2>Background</h2><button class="close" id="x" aria-label="Close">×</button></div><p class="note" data-bgnote="Change it any time. Your board stays as it is.">' + bgNote('Change it any time. Your board stays as it is.') + '</p>' + backgroundButtons('inlevel'));
    s.querySelector('#x').onclick = closeSheet;
    wireBackgrounds(s, function () { if (backgroundChoice() === 'default') { bgCycle.gapUntil = 0; startCycleSection(); } applyBackgroundNow(); refresh(); });
  }
  function endlessOpts() { return progress.endlessOpts || { hard: false, timed: false }; }
  function endlessPlan() {
    var o = Object.assign({}, endlessOpts()), scale = o.scale || 1, picked = effectChoice();
    // Random uses a random number of effects (1 to 4) for each board.
    if (picked.random) {
      var pool = SEASON_ORDER.slice().sort(function () { return Math.random() - 0.5; });
      o.effects = pool.slice(0, 1 + Math.floor(Math.random() * 4));
    } else o.effects = picked.list.slice();
    o.effects = SEASON_ORDER.filter(function (k) { return o.effects.indexOf(k) >= 0; });
    var key = ((o.hard ? 'h' : '') + (o.timed ? 't' : '') || 'free') + (scale > 1 ? scale + 'x' : '') + (o.effects.length ? '-' + o.effects.join('') : '');
    progress.endlessBy = progress.endlessBy || {};
    var n = progress.endlessBy[key] || 0, seed = 500000 + n * 101 + (o.hard ? 70001 : 0) + (o.timed ? 3001 : 0) + scale * 1009 + o.effects.join('').length * 977;
    return { o: o, scale: scale, key: key, n: n, seed: seed };
  }
  function startEndless(plan, lvl) {
    // Arriving in Open Water starts the rotation at Dawn. Moving to the next board keeps it going.
    if (!current || current.mode !== 'endless') resetCycle();
    var o = plan.o, scale = plan.scale;
    lvl.lives = o.hard ? 2 : null;
    E.prepare(lvl);
    // Big boards get extra time, since the player also has to move around them.
    if (o.timed) lvl.timeLimit = Math.round(E.timeLimitFor(lvl.solution.length) * (scale > 1 ? 1.3 : 1));
    var tags = (o.effects.length === 1 ? ' · ' + SET_INFO[o.effects[0]].label : o.effects.length ? ' · ' + o.effects.length + ' effects' : '') + (scale > 1 ? ' · ' + scale + 'x' : '') + (o.hard ? ' · Harder' : '') + (o.timed ? ' · Timed' : '');
    begin({ id: 'open-' + plan.key + '-' + (plan.n + 1), endlessKey: plan.key, mode: 'endless', level: lvl, title: 'Open Water ' + (plan.n + 1) + tags, chapter: backgroundPalette(), sunY: 34, background: true });
  }
  // A tangled, well-filled board plays better than one with many arrows free at the start.
  function boardQuality(lvl) {
    return lvl.density * 100 - 30 * E.legalMoves(lvl, E.newState(lvl)).length / Math.max(1, lvl.arrows.length);
  }
  // Big maps build on a loading screen: try several boards, keep the best, and only reveal it once it is ready to draw.
  function openEndless(ready) {
    var plan = endlessPlan();
    if (ready === true || plan.scale < 5) { if (plan.scale >= 3 && ready !== true) withLoading(function () { startEndless(plan, E.endlessBoard(plan.n, plan.o, plan.seed)); }, 'Loading board…'); else startEndless(plan, E.endlessBoard(plan.n, plan.o, plan.seed)); return; }
    var tries = plan.scale >= 25 ? 4 : plan.scale >= 10 ? 3 : 2, done = 0, best = null, bestScore = -Infinity, started = performance.now(), STEPS = tries + 2;
    var s = sheet('<h2>Growing the map</h2><p id="loadLine">Planting arrows</p><div class="lantern-bar"><i id="loadBar" style="width:6%;transition:width .25s ease"></i></div>');
    var mark = function (text, stepsDone) {
      var line = s.querySelector('#loadLine'), bar = s.querySelector('#loadBar');
      if (line) line.textContent = text;
      if (bar) bar.style.width = Math.round(stepsDone / STEPS * 100) + '%';
    };
    var step = function () {
      var lvl = E.endlessBoard(plan.n, plan.o, plan.seed + done * 911), q = boardQuality(lvl);
      if (q > bestScore) { bestScore = q; best = lvl; }
      done++;
      mark(done < tries ? 'Choosing the best layout' : 'Painting the board', done);
      if (done < tries) { setTimeout(step, 20); return; }
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fonts.then(function () {
        fireSprites();
        setTimeout(function () {
          holdTutorials = true;
          startEndless(plan, best);
          holdTutorials = false;
          // Keep the screen up while the first frames draw, then start the map's intro from a clean slate.
          var c = current, cover = sheet('<h2>Growing the map</h2><p>Almost ready</p><div class="lantern-bar"><i style="width:100%"></i></div>');
          requestAnimationFrame(function () { requestAnimationFrame(function () {
            if (current !== c) return;
            if ($('sheetHost').firstChild === cover) closeSheet();
            maybeTutorials();
            introStart = performance.now(); prepareIntro(c.level);
            if (c.level.flowers && c.level.flowers.length) sendBee(state.launches, performance.now() + 900);
          }); });
        }, Math.max(30, 900 - (performance.now() - started)));
      });
    };
    setTimeout(step, 60);
  }
  /* ---------- Co-op test: four boards, cross-board twins and snipers, all on one device ---------- */
  var COOP_NAMES = ['Ana', 'Bruno', 'Carla', 'Duarte'];
  var coop = null, FX_KEYS = ['flights', 'bounces', 'nudges', 'blockerGlow', 'angles', 'unoFlip', 'wakes', 'ripples', 'embers', 'praises'];
  function stashFx() { return { flights: flights, bounces: bounces, nudges: nudges, blockerGlow: blockerGlow, angles: angles, unoFlip: unoFlip, wakes: wakes, ripples: ripples, embers: embers, praises: praises }; }
  function restoreFx(f) { flights = f.flights; bounces = f.bounces; nudges = f.nudges; blockerGlow = f.blockerGlow; angles = f.angles; unoFlip = f.unoFlip; wakes = f.wakes; ripples = f.ripples; embers = f.embers; praises = f.praises; }
  // The big test room has three times the area per board, so each side grows by about the square root of 3.
  var COOP_BIG = { w: 12, h: 16, minLen: 2, maxLen: 8, depth: 9, twins: 2, mirrors: 3, big: true };
  // Board size multiplies the area, so each side grows by its square root.
  function coopSpec(k) {
    if (k === 3) return Object.assign({}, COOP_BIG);
    var r = Math.sqrt(k);
    return { w: Math.round(7 * r), h: Math.round(9 * r), minLen: 2, maxLen: 6 + Math.round((r - 1) * 2.5), depth: 7 + Math.round((r - 1) * 3), twins: Math.max(1, Math.round(k / 1.5)), mirrors: 2 + Math.round(k / 2), big: k >= 3 };
  }
  function openCoop(seed, big, spec) {
    seed = seed || 1 + Math.floor(Math.random() * 1e6);
    withLoading(function () { openCoopRoom(function () { return E.coopRoom(seed, spec || (big ? COOP_BIG : undefined)); }, spec && spec.names); if (spec && spec.after) spec.after(); });
  }
  // make() builds a fresh room, so Restart and Play again can rebuild it from the start.
  function openCoopRoom(make, names) {
    var room = make();
    room.names = names || room.names || COOP_NAMES;
    coopZoomK = 1; coopFocus = -1;
    coop = { room: room, make: make, n: room.boards.length, idx: 0, lives: room.lives || 12, burners: [], effects: [], boards: room.boards.map(function (l) { return { level: l, state: null, fx: null, queue: [] }; }) };
    coop.boards.forEach(function (B, i) {
      if (i === 0) return;
      E.resetBoard(B.level);
      B.state = E.newState(B.level); B.state.safe = !room.tutorial;
    });
    begin({ id: 'coop-0', mode: 'coop', coop: true, level: room.boards[0], title: coopWhere(0), chapter: CHAPTERS[timeChapter()], sunY: 34 });
    state.safe = !room.tutorial;
    coop.boards[0].state = state;
    coopSyncLives();
    setCaption(room.tutorial ? room.boards[0].caption : coop.n === 2 ? 'Co-op test: clear both boards. Use the arrow at the edge to switch boards.' : 'Co-op test: clear all four boards. Use the arrows at the edges to switch boards.');
    layout(); refresh();
    track('coop_open', { seed: room.seed, n: coop.n, tutorial: room.tutorial || '' });
  }
  function coopName(b) { return (coop && coop.room.names || COOP_NAMES)[b] || COOP_NAMES[b]; }
  function coopWhere(i) { return (coop.room.title || 'Co-op test') + ' · Board ' + (i + 1) + ' of ' + coop.n + ' · ' + coopName(i); }
  function coopBoardCaption(i) {
    var B = coop.boards[i];
    if (B.queue.length) return 'A sniper is coming in!';
    if (B.state && E.isWon(B.state)) return 'Board ' + (i + 1) + ' is cleared.';
    return coop.room.tutorial ? B.level.caption : 'Board ' + (i + 1) + ' of ' + coop.n;
  }
  /* Co-op tutorials: two hand-made boards each, where the new arrow is the only way to win. */
  function coopArrow(id, cells, extra) {
    var n = cells.length, h = cells[n - 1], p = cells[n - 2], dir = h[1] < p[1] ? 0 : h[0] > p[0] ? 1 : h[1] > p[1] ? 2 : 3;
    return Object.assign({ id: id, kind: 'plain', dir: dir, cells: cells }, extra || {});
  }
  function coopBoard(arrows, caption) {
    return E.prepare({ w: 5, h: 5, lives: 6, hints: 0, timeLimit: null, season: null, flowers: null, mirrors: [], caption: caption, arrows: arrows.map(function (a, i) { return coopArrow(i, a[0], a[1]); }) });
  }
  var COOP_TUTORIALS = {
    sniper: function () {
      return {
        tutorial: 'sniper', title: 'Sniper arrows', seed: 0, lives: 6, groups: [],
        boards: [
          coopBoard([[[[2, 2], [3, 2], [4, 2]], { sniper: true }], [[[0, 0], [1, 0]]], [[[1, 4], [1, 3]]]],
            'The red arrow with a sight is a sniper. When it leaves, it flies on to the next board and destroys the first arrow it hits.'),
          coopBoard([[[[0, 2], [1, 2]]], [[[4, 2], [3, 2]]], [[[2, 4], [2, 3]]], [[[4, 0], [4, 1]]]],
            'The two middle arrows block each other. Only Ana\'s sniper arrow can break them free.')
        ]
      };
    },
    twins: function () {
      return {
        tutorial: 'twins', title: 'Twin-shared arrows', seed: 0, lives: 6, groups: [{ id: 0, members: [[0, 0], [1, 0]] }],
        boards: [
          coopBoard([[[[2, 4], [2, 3]], { coopGroup: 0 }], [[[1, 1], [2, 1], [3, 1]]], [[[0, 3], [1, 3]]], [[[4, 4], [3, 4]]]],
            'The X+ arrow has a twin on Bruno\'s board. They leave together, so both paths must be clear.'),
          coopBoard([[[[2, 0], [2, 1]], { coopGroup: 0 }], [[[0, 3], [1, 3], [2, 3], [3, 3]]], [[[4, 1], [3, 1]]]],
            'Clear the way for X+ here too. Hold an X+ arrow to see its twin.')
        ]
      };
    }
  };
  function openCoopTutorial(key) { openCoopRoom(COOP_TUTORIALS[key], ['Ana', 'Bruno']); }
  function coopRestart() { var make = coop.make, names = coop.room.names, you = coop.you; withLoading(function () { openCoopRoom(make, names); if (you) { coop.you = you; coopSwitch(you); } }); }
  // Building boards can take a moment, so a loading card shows first. Its spinner runs on the compositor, so it keeps turning.
  var loadingSync = false;
  function withLoading(fn, text) {
    if (loadingSync) { fn(); return; }
    var el = $('loading');
    el.querySelector('p').textContent = text || 'Loading boards…';
    el.hidden = false; el.classList.remove('out');
    requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(function () {
      try { fn(); } finally { el.classList.add('out'); setTimeout(function () { if (el.classList.contains('out')) el.hidden = true; }, 320); }
    }, 30); }); });
  }
  function coopSyncLives() {
    if (!coop) return;
    coop.lives = state.lives;
    coop.boards.forEach(function (B) { if (B.state) B.state.lives = coop.lives; });
  }
  function coopAllWon() { return !!coop && coop.boards.every(function (B) { return B.state && E.isWon(B.state); }); }
  function coopMember(b, id) { var B = coop.boards[b]; return { b: b, B: B, a: B.level.arrows[id], st: B.state, l: B.level }; }
  // Before a tap: a sniper on its way may hold the board, and a cross-board twin needs its partners ready and clear.
  function coopAllow(id) {
    var now = performance.now(), B = coop.boards[coop.idx], q = B.queue[0], l = current.level, a = l.arrows[id];
    if (q && !q.pass) {
      if (q.extra > 0 && id !== q.targetId) q.extra--;
      else { nudges[id] = now + 360; pluck(220, 0, 0.07, 0.3); setCaption('Wait: a sniper is coming in.'); return false; }
    }
    if (a.coopGroup === undefined || !E.isReady(state, a)) return true;
    var others = coop.room.groups[a.coopGroup].members.filter(function (m) { return m[0] !== coop.idx; }).map(function (m) { return coopMember(m[0], m[1]); }).filter(function (m) { return !m.st.removed[m.a.id]; });
    var sleepy = others.filter(function (m) { return !E.isReady(m.st, m.a); })[0];
    if (sleepy) { nudges[id] = now + 360; pluck(220, 0, 0.07, 0.3); setCaption('Its twin on board ' + (sleepy.b + 1) + ' is not ready yet.'); return false; }
    var blocked = others.filter(function (m) { return !E.check(m.l, m.st, m.a).clear; })[0];
    if (blocked && E.check(l, state, a).clear) {
      // Its twin on another board is blocked: it bounces back and costs a shared life.
      if (state.lives !== null) state.lives--;
      coopSyncLives(); collisions++;
      bounces[id] = { start: now, reach: 0.18, pts: trackOf(a, E.check(l, state, a)) };
      thud(); buzz(26);
      setCaption('Its twin on board ' + (blocked.b + 1) + ' is blocked.');
      refresh();
      if (state.lives === 0) finish(false, 'lives');
      return false;
    }
    return true;
  }
  // After a launch: twins on the other boards leave too, and a sniper heads for the next board once it has left this one.
  function coopAfterLaunch(id, res, now) {
    var l = current.level, a = l.arrows[id], from = coop.idx;
    if (a.coopGroup !== undefined) {
      coop.room.groups[a.coopGroup].members.forEach(function (m) {
        if (m[0] === from) return;
        var o = coopMember(m[0], m[1]);
        if (o.st.removed[o.a.id]) return;
        o.st.lives = coop.lives;
        E.tap(o.l, o.st, o.a.id);
      });
    }
    res.results.forEach(function (r, k) {
      var m = l.arrows[r.id];
      if (!m.sniper) return;
      var c = r.check, corner = c.path && c.path.length ? c.path[c.path.length - 1] : E.headOf(m), to = E.coopNeighbour(from, c.endDir, coop.n);
      var fl = flights[flights.length - res.results.length + k];
      var q = Math.min(1, (fl.rayCells + fl.len + 0.4) / fl.travel), t = (-0.28 + Math.sqrt(0.0784 + 2.88 * q)) / 1.44;
      setTimeout(function () {
        if (!coop) return;
        coopEffect('exit', from, fl.edge, c.endDir, performance.now());
        pluck(987.8, 0, 0.1, 0.35); pluck(740, 0.05, 0.09, 0.35); pluck(493.9, 0.1, 0.08, 0.4);
        coopShotLeft(from, to, c.endDir, corner);
      }, Math.max(0, t * fl.duration));
    });
    coopNav();
  }
  // What a sniper meets first on a board, entering from outside along its row or column.
  function coopWalk(L, S, entry, dir) {
    var x = entry[0], y = entry[1], d = dir, pts = [[x - E.DX[d] * 2.5, y - E.DY[d] * 2.5]], guard = 0;
    while (guard++ < 400) {
      x += E.DX[d]; y += E.DY[d];
      if (x < 0 || y < 0 || x >= L.w || y >= L.h) { pts.push([x + E.DX[d] * 2, y + E.DY[d] * 2]); return { kind: 'none', pts: pts }; }
      var k = y * L.w + x;
      if (L.mirrorAt[k]) { d = E.TURN[L.mirrorAt[k]][d]; pts.push([x, y]); continue; }
      if (S.burning[k] > S.launches) { pts.push([x, y]); return { kind: 'fire', k: k, pts: pts }; }
      if (L.flowerAt && L.flowerAt[k] >= S.launches && !(S.picked && S.picked[k])) { pts.push([x, y]); return { kind: 'flower', k: k, pts: pts }; }
      var o = L.grid[k];
      if (o !== -1 && !S.removed[o] && !E.isGhost(S, L.arrows[o])) { pts.push([x, y]); return { kind: 'arrow', id: o, pts: pts }; }
    }
    return { kind: 'none', pts: pts };
  }
  function coopEntry(L, dir, corner) {
    return dir === 1 ? [-1, corner[1]] : dir === 3 ? [L.w, corner[1]] : dir === 2 ? [corner[0], -1] : [corner[0], L.h];
  }
  // The sniper has left the shooter's board: the target is worked out now, and the warning goes up.
  function coopShotLeft(from, to, dir, corner) {
    if (!coop || ended || to < 0) return;
    var B = coop.boards[to], entry = coopEntry(B.level, dir, corner), hit = coopWalk(B.level, B.state, entry, dir);
    if (hit.kind === 'none' && to !== coop.idx) return;
    var item = { from: from, dir: dir, entry: entry, extra: 1, targetId: hit.kind === 'arrow' ? hit.id : -1, pass: hit.kind === 'none', flying: null, waiting: false };
    B.queue.push(item);
    if (!item.pass) { pluck(659.3, 0, 0.12, 0.5); pluck(523.3, 0.14, 0.12, 0.6); buzz(18); }
    if (to === coop.idx) coopMaybeStart(to);
    else {
      setCaption('Something is happening on board ' + (to + 1) + '.');
      $('caption').setAttribute('data-goto', to); $('caption').classList.add('goto');
    }
    coopNav();
  }
  function coopMaybeStart(b) {
    var B = coop.boards[b], q = B.queue[0];
    if (!q || q.flying || q.waiting || b !== coop.idx) return;
    q.waiting = true;
    setTimeout(function () {
      q.waiting = false;
      if (!coop || ended || coop.idx !== b || B.queue[0] !== q) return;
      var hit = coopWalk(B.level, B.state, q.entry, q.dir), dist = 0;
      for (var i = 1; i < hit.pts.length; i++) dist += Math.abs(hit.pts[i][0] - hit.pts[i - 1][0]) + Math.abs(hit.pts[i][1] - hit.pts[i - 1][1]);
      if (hit.kind !== 'none') dist -= 0.55;
      var nowF = performance.now();
      q.flying = { start: nowF + 380, hit: hit, dist: dist, duration: Math.min(1200, 260 + dist * 65) };
      coopEffect('enter', b, px(q.entry), q.dir, nowF);
      pluck(329.6, 0, 0.09, 0.4); pluck(493.9, 0.08, 0.09, 0.4); pluck(659.3, 0.16, 0.1, 0.5);
    }, q.pass ? 60 : 2000);
    q.waitStart = performance.now();
  }
  function coopResolve(B, q, now) {
    var L = B.level, S = B.state, hit = q.flying.hit, b = coop.boards.indexOf(B);
    B.queue.shift();
    if (hit.kind === 'arrow' && S.removed[hit.id]) hit = coopWalk(L, S, q.entry, q.dir);
    if (hit.kind === 'arrow') {
      var a = L.arrows[hit.id], ids = [a.id];
      if (a.kind === 'twin') ids.push(a.twin);
      ids.forEach(function (id) {
        var m = L.arrows[id];
        S.removed[id] = true; delete S.frozen[id];
        addRipple(px(m.cells[m.cells.length >> 1]), '#b3122e', 2.6);
      });
      pluck(196, 0, 0.16, 0.5); pluck(392, 0.04, 0.1, 0.6); buzz(22);
    } else if (hit.kind === 'flower') {
      S.picked = Object.assign({}, S.picked); S.picked[hit.k] = true;
      addRipple(px([hit.k % L.w, Math.floor(hit.k / L.w)]), '#f06ca8', 2.2); pluck(784, 0, 0.1, 0.6);
    } else if (hit.kind === 'fire') {
      // It flies into the flames and burns, like any arrow that hits fire.
      var pts = hit.pts, end = pts[pts.length - 1], prev = pts[pts.length - 2], dx = Math.sign(end[0] - prev[0]), dy = Math.sign(end[1] - prev[1]);
      var fake = { id: -100 - now, cells: [[end[0] - dx * 1.5, end[1] - dy * 1.5], [end[0] - dx * 0.55, end[1] - dy * 0.55]] };
      igniteArrow(fake, now, px(end));
      coop.burners.push({ b: b, a: fake });
      seasonSound('fireSound');
    }
    // A hit is not a move: only the golden arrow check runs, in case the board can no longer be cleared.
    if (S.safe && E.isStuck(L, S)) E.ensurePlay(L, S);
    refresh();
    if (coopAllWon()) { finish(true); return; }
    if (!B.queue.length && b === coop.idx) setCaption(coopBoardCaption(b));
    coopMaybeStart(b); coopNav();
  }
  function drawCoop(now, w) {
    var B = coop.boards[coop.idx], q = B.queue[0];
    // Danger symbols where snipers will come in.
    B.queue.forEach(function (item, i) {
      if (item.pass || (item.flying && i === 0)) return;
      var p = px(item.entry), pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 120), r = cs * 0.42 * pulse;
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 1;
      ctx.fillStyle = '#d4161f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, cs * 0.05); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.72); ctx.lineTo(-r * 0.95, r * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(r * 1.05) + 'px Figtree,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, r * 0.18);
      if (i === 0 && item.waiting && item.waitStart) { var cd = Math.min(1, (now - item.waitStart) / 2000); ctx.strokeStyle = '#d4161f'; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.beginPath(); ctx.arc(0, r * 0.1, r * 1.45, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
    // A sniper flying in.
    if (q && q.flying) {
      var f = q.flying, t = Math.max(0, Math.min(1, (now - f.start) / f.duration)), travel = f.dist * t, len = 1.2;
      var col = arrowColor({ sniper: true });
      if (now >= f.start) {
        // A fading streak behind it.
        for (var tr = 1; tr <= 5; tr++) { setStroke('#ff8a65', w * (1 - tr * 0.15), 0.32 - tr * 0.05); strokeWindow(f.hit.pts, Math.max(0, travel - len - tr * 0.45), Math.max(0, travel - len - (tr - 1) * 0.45)); }
        sniperGlow(f.hit.pts, Math.max(0, travel - len), travel, w, now);
        setStroke(col, w, 1);
        var res = strokeWindow(f.hit.pts, Math.max(0, travel - len), travel);
        chevron(res.end, res.tan, cs * 0.24);
        sniperSparks(f.hit.pts, Math.max(0, travel - len), travel, res, now);
      }
      if (t >= 1 && f.hit.kind !== 'none') coopEffect('impact', coop.idx, px(f.hit.pts[f.hit.pts.length - 1]), q.dir, now);
      if (t >= 1) coopResolve(B, q, now);
    }
    drawCoopEffects(now);
    // Snipers burning in fire.
    coop.burners = coop.burners.filter(function (x) {
      var bu = x.a.burn;
      if (!bu || now > bu.until + 400) return false;
      if (x.b !== coop.idx) return true;
      var bt = (now - bu.start) / bu.dur;
      setStroke(bt < 0.72 ? '#e8321a' : mixColor('#e8321a', '#3a2a28', (bt - 0.72) / 0.28), w, Math.max(0, 1 - Math.max(0, bt - 0.8) * 5));
      var res2 = strokeWindow(x.a.cells, 0, 0.95);
      chevron(res2.end, res2.tan, cs * 0.24);
      drawArrowFlames(x.a, now);
      return true;
    });
    ctx.globalAlpha = 1;
  }
  // Holding a cross-board twin shows its partners' boards one after another, and letting go comes back.
  var coopHold = null, coopFocus = -1;
  function coopHoldStart(id, pid) {
    coopHoldEnd(false);
    var from = coop.idx, partners = coop.room.groups[current.level.arrows[id].coopGroup].members.filter(function (m) { return m[0] !== from; });
    coopHold = { id: id, from: from, partners: partners, peeking: false, step: 0 };
    coopHold.timer = setTimeout(function peek() {
      if (!coopHold || !partners.length) return;
      var m = partners[coopHold.step % partners.length];
      coopHold.peeking = true; coopHold.step++;
      coopSwitch(m[0], m[1]);
      if (partners.length > 1) coopHold.timer = setTimeout(peek, 5000);
    }, 420);
  }
  function coopHoldEnd(released) {
    if (!coopHold) return;
    var h = coopHold; coopHold = null;
    clearTimeout(h.timer);
    if (h.peeking) { if (coop) coopSwitch(h.from); }
    else if (released) onTap(h.id);
  }
  function coopEffect(kind, b, p, dir, now) { coop.effects.push({ kind: kind, b: b, p: p, dir: dir, start: now }); }
  function drawCoopEffects(now) {
    coop.effects = coop.effects.filter(function (f) {
      var dur = f.kind === 'impact' ? 600 : 650, t = (now - f.start) / dur;
      if (t >= 1) return false;
      if (f.b !== coop.idx || t < 0) return true;
      var ang = Math.atan2(E.DY[f.dir], E.DX[f.dir]), e2 = 1 - Math.pow(1 - t, 3);
      ctx.save(); ctx.lineCap = 'round';
      if (f.kind === 'exit') {
        // Leaving: a flash and a burst of streaks thrown forward.
        ctx.globalAlpha = (1 - t) * 0.9; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (0.25 + e2 * 0.5), 0, 7); ctx.fill();
        ctx.strokeStyle = '#d4161f'; ctx.lineWidth = Math.max(2, cs * 0.08);
        ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (0.3 + e2 * 1.5), 0, 7); ctx.stroke();
        for (var i = 0; i < 11; i++) {
          var a2 = ang + (i - 5) * 0.18, r0 = cs * (0.3 + e2 * 0.8), r1 = r0 + cs * (0.5 + (i % 3) * 0.25) * (1 - t);
          ctx.strokeStyle = i % 2 ? '#ff8a65' : '#d4161f'; ctx.lineWidth = Math.max(1.5, cs * 0.05);
          ctx.beginPath(); ctx.moveTo(f.p.x + Math.cos(a2) * r0, f.p.y + Math.sin(a2) * r0); ctx.lineTo(f.p.x + Math.cos(a2) * r1, f.p.y + Math.sin(a2) * r1); ctx.stroke();
        }
      } else if (f.kind === 'enter') {
        // Arriving: a ring closing in on the point it comes through, with sparks pulled inwards.
        ctx.globalAlpha = Math.sin(t * Math.PI); ctx.strokeStyle = '#d4161f'; ctx.lineWidth = Math.max(2, cs * 0.09);
        ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (1.5 - e2 * 1.2), 0, 7); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, cs * 0.04);
        ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (1.1 - e2 * 0.9), now / 120, now / 120 + 4); ctx.stroke();
        for (var j = 0; j < 8; j++) {
          var a3 = j * Math.PI / 4 + now / 300, rr = cs * (1.4 - e2 * 1.2);
          ctx.fillStyle = j % 2 ? '#ffd23f' : '#ff8a65';
          ctx.beginPath(); ctx.arc(f.p.x + Math.cos(a3) * rr, f.p.y + Math.sin(a3) * rr, cs * 0.06, 0, 7); ctx.fill();
        }
      } else {
        // Impact: a flash and shards.
        ctx.globalAlpha = 1 - t; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (0.2 + e2 * 0.7), 0, 7); ctx.fill();
        for (var k = 0; k < 10; k++) {
          var a4 = k * 0.63 + 0.3, d4 = cs * (0.2 + e2 * 1.3);
          ctx.fillStyle = k % 2 ? '#d4161f' : colors.ink;
          ctx.save(); ctx.translate(f.p.x + Math.cos(a4) * d4, f.p.y + Math.sin(a4) * d4); ctx.rotate(a4 + t * 6);
          ctx.fillRect(-cs * 0.06, -cs * 0.03, cs * 0.12, cs * 0.06); ctx.restore();
        }
      }
      ctx.restore();
      return true;
    });
    ctx.globalAlpha = 1;
  }
  // The board steps back a little while a sniper is on its way, so there is room for it to come in.
  var coopZoomK = 1;
  function coopZoomTick() {
    if (!coop || cam) return;
    var q = coop.boards[coop.idx].queue[0], want = q && !q.pass && (q.waiting || q.flying) ? 0.82 : 1;
    if (Math.abs(coopZoomK - want) < 0.002) { if (coopZoomK !== want) { coopZoomK = want; coopNav(); } return; }
    coopZoomK += (want - coopZoomK) * (reduced ? 1 : 0.12);
    var l = current.level;
    cs = fitCs * coopZoomK; ox = (vw - cs * l.w) / 2; oy = viewTop + (viewBottom - viewTop - cs * l.h) / 2;
    if (Math.abs(coopZoomK - want) < 0.002) coopNav();
  }
  // Moves the view to another board, with a short slide.
  function coopSwitch(i, focusId) {
    if (!coop || i === coop.idx || i < 0 || i >= coop.n) return;
    var from = coop.idx, dx = (i & 1) - (from & 1), dy = (i >> 1) - (from >> 1);
    if (!reduced) {
      var copy = document.createElement('canvas');
      copy.className = 'boardfade'; copy.width = canvas.width; copy.height = canvas.height;
      copy.getContext('2d').drawImage(canvas, 0, 0);
      copy.style.transition = 'transform .32s ease, opacity .32s ease';
      canvas.parentNode.insertBefore(copy, canvas.nextSibling);
      requestAnimationFrame(function () { copy.style.transform = 'translate(' + (-dx * 35) + '%,' + (-dy * 35) + '%)'; copy.style.opacity = '0'; });
      setTimeout(function () { copy.remove(); }, 380);
      canvas.style.transition = 'none'; canvas.style.transform = 'translate(' + (dx * 35) + '%,' + (dy * 35) + '%)'; canvas.style.opacity = '0';
      requestAnimationFrame(function () { requestAnimationFrame(function () { canvas.style.transition = 'transform .32s ease, opacity .32s ease'; canvas.style.transform = ''; canvas.style.opacity = ''; }); });
    }
    coop.boards[from].fx = stashFx(); coop.boards[from].state = state;
    coop.idx = i;
    var B = coop.boards[i];
    current.level = B.level; current.id = 'coop-' + i; state = B.state;
    if (B.fx) restoreFx(B.fx);
    else {
      flights = []; bounces = {}; nudges = {}; blockerGlow = {}; wakes = []; ripples = []; embers = []; praises = []; unoFlip = {}; angles = {};
      B.level.arrows.forEach(function (a) { angles[a.id] = E.dirOf(a, state) * 90; });
    }
    hintArrow = -1; coopFocus = -1; boardLayer = null; cam = null; introStart = performance.now() - 10000; coopZoomK = 1;
    prepareIntro(B.level);
    layout(); refresh();
    $('where').textContent = coopWhere(i);
    capMode = '';
    setCaption(coopBoardCaption(i));
    if (focusId !== undefined) { coopFocus = focusId; setCaption('Holding: this is its twin on ' + coopName(i) + "'s board."); }
    coopMaybeStart(i);
    pluck(523.3, 0, 0.06, 0.4);
  }
  // Buttons at the edges and corners of the board, each pointing to a neighbouring board.
  function coopNav() {
    var el = $('coopNav');
    if (!current || !current.coop || !coop || ended) { el.hidden = true; return; }
    el.hidden = false;
    var b = coop.idx, W = cs * current.level.w, H = cs * current.level.h, html = '';
    var GLYPH = { '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑', '1,1': '↘', '-1,1': '↙', '1,-1': '↗', '-1,-1': '↖' };
    [b ^ 1, b ^ 2, b ^ 3].filter(function (t) { return t < coop.n; }).forEach(function (t) {
      var dx = (t & 1) - (b & 1), dy = (t >> 1) - (b >> 1);
      var x = dx > 0 ? ox + W + 24 : dx < 0 ? ox - 24 : ox + W / 2, y = dy > 0 ? oy + H + 24 : dy < 0 ? oy - 24 : oy + H / 2;
      var alert = coop.boards[t].queue.some(function (q) { return !q.pass; }), done = !!coop.boards[t].state && E.isWon(coop.boards[t].state);
      html += '<button class="cnav' + (alert ? ' alert' : '') + (done ? ' done' : '') + '" data-board="' + t + '" style="left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px" aria-label="Go to board ' + (t + 1) + '"><b>' + GLYPH[dx + ',' + dy] + '</b><span>' + (t + 1) + '</span></button>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-board]').forEach(function (btn) { btn.onclick = function () { audio(); coopSwitch(+btn.getAttribute('data-board')); }; });
  }
  /* Pausing in a room: when half or more of the players pause, the game and clock stop for everyone until all are back.
     The host can end it when only one player is still paused. The other players are simulated here. */
  var coopPaused = null;
  function coopPause() {
    if (!coop || ended || coopPaused) return;
    var you = coop.you || 0, others = []; for (var i = 0; i < coop.n; i++) if (i !== you) others.push(i);
    coopPaused = { set: [you], you: you, frozen: false, timers: [] };
    coopPauseSheet();
    // Simulated: another player pauses too, and comes back on their own later.
    var other = others[Math.floor(Math.random() * others.length)];
    coopPaused.timers.push(setTimeout(function () { if (!coopPaused) return; coopPaused.set.push(other); coopPauseSheet(); }, 1400));
    coopPaused.timers.push(setTimeout(function () { if (!coopPaused) return; coopPaused.set = coopPaused.set.filter(function (x) { return x !== other; }); coopPauseSheet(); }, 16000));
  }
  function coopPauseSheet() {
    var P = coopPaused;
    if (!P) return;
    if (P.set.length * 2 >= coop.n) P.frozen = true;
    if (!P.set.length) { P.timers.forEach(clearTimeout); coopPaused = null; closeSheet(); setCaption('Everyone is back. Game on!'); return; }
    var youPaused = P.set.indexOf(P.you) >= 0;
    if (!P.frozen && !youPaused) { P.timers.forEach(clearTimeout); coopPaused = null; closeSheet(); return; }
    var names = P.set.map(function (b) { return b === P.you ? 'You' : coopName(b); });
    var html = '<div class="row"><h2>' + (P.frozen ? 'Game paused' : 'You paused') + '</h2></div>';
    html += P.frozen ? '<p>' + (P.set.length === 1 ? 'This player has paused the game:' : 'These people have paused the game:') + '</p>' : '<p>Only you are paused, so the game keeps going for the others. It stops for everyone when half or more of the players pause.</p>';
    html += '<ul class="lplayers">' + Array.apply(null, Array(coop.n)).map(function (_, b) { var on = P.set.indexOf(b) >= 0; return '<li><span class="dot" style="background:' + colors.twins[b % colors.twins.length] + '">' + coopName(b).charAt(0) + '</span><span class="nm">' + coopName(b) + (b === P.you ? ' <em>(you)</em>' : '') + '</span><span class="st ' + (on ? '' : 'on') + '">' + (on ? 'Paused' : 'Playing') + '</span></li>'; }).join('') + '</ul>';
    if (P.frozen) html += '<p class="note">The game and the clock are stopped for everyone until all players are back.</p>';
    if (youPaused) html += '<button class="primary" id="pResume">Resume</button>';
    else if (P.set.length === 1) html += '<p class="note">Only ' + names[0] + ' is still paused. As the host, you can carry on without them.</p><button class="primary" id="pOverride">Resume for everyone</button>';
    else html += '<p class="lwait">Waiting for ' + names.join(' and ') + '…</p>';
    html += '<p class="note" style="text-align:center">Preview: the other players are simulated.</p>';
    var host = $('sheetHost').firstChild, card = host && host.querySelector('.card.pausecard');
    if (card) card.innerHTML = html; else { sheet(html, 'pausecard'); card = $('sheetHost').querySelector('.card'); }
    var r = card.querySelector('#pResume'), o = card.querySelector('#pOverride');
    if (r) r.onclick = function () { P.set = P.set.filter(function (x) { return x !== P.you; }); coopPauseSheet(); };
    if (o) o.onclick = function () { P.set = []; coopPauseSheet(); };
  }
  /* ---------- Co-op room preview: what the host sees before a game. Players other than you are simulated. ---------- */
  var LOBBY_ADJ = ['Sleepy', 'Brave', 'Quiet', 'Lucky', 'Gentle', 'Swift', 'Misty', 'Sunny', 'Cozy', 'Clever', 'Mellow', 'Bright'];
  var LOBBY_ANIMAL = ['Otter', 'Heron', 'Fox', 'Badger', 'Owl', 'Crab', 'Lynx', 'Robin', 'Turtle', 'Hare', 'Squirrel', 'Bee'];
  var lobby = null;
  function lobbyName() {
    var taken = lobby ? lobby.players.map(function (p) { return p.name; }) : [], n;
    do { n = LOBBY_ADJ[Math.floor(Math.random() * LOBBY_ADJ.length)] + ' ' + LOBBY_ANIMAL[Math.floor(Math.random() * LOBBY_ANIMAL.length)]; } while (taken.indexOf(n) >= 0);
    return n;
  }
  function lobbyCode() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = ''; for (var i = 0; i < 6; i++) o += A.charAt(Math.floor(Math.random() * A.length)); return o.slice(0, 3) + '-' + o.slice(3); }
  function lobbyLater(fn, ms) { var t = setTimeout(function () { if (lobby && $('lobbyCard')) fn(); }, ms); lobby.timers.push(t); }
  function lobbyJoin(delay) {
    lobbyLater(function () {
      if (lobby.players.length >= lobby.settings.players) return;
      var p = { name: lobbyName(), ready: false };
      lobby.players.push(p); pluck(659.3, 0, 0.06, 0.3); lobbySheet(true);
      lobbyLater(function () { if (lobby.players.indexOf(p) >= 0) { p.ready = true; pluck(784, 0, 0.05, 0.3); lobbySheet(true); } }, 1800 + Math.random() * 3200);
    }, delay);
  }
  function lobbyFill() { for (var i = lobby.players.length, k = 0; i < lobby.settings.players; i++, k++) lobbyJoin(900 + k * 900 + Math.random() * 500); }
  // Seats: which player plays which board. New players take the free boards; the host can swap them.
  function lobbySeats() {
    var L = lobby;
    L.seats = L.seats.filter(function (p) { return L.players.indexOf(p) >= 0; });
    L.players.forEach(function (p) { if (L.seats.indexOf(p) < 0) L.seats.push(p); });
    L.seats.length = Math.min(L.seats.length, L.settings.players);
  }
  function lobbyClose() { if (lobby) lobby.timers.forEach(clearTimeout); lobby = null; closeSheet(); }
  function lobbySheet(inPlace) {
    if (!lobby) {
      var mine = load('unwind.onlineName', '') || '';
      lobby = { code: lobbyCode(), view: 'host', timers: [], askName: !mine, settings: { players: 4, hard: false, size: 1, snipers: true, twins: true, timed: false }, pick: -1, seats: [], players: [{ name: mine || lobbyName(), you: true, host: true, ready: false }] };
      sheet('<div id="lobbyCard"></div>', 'tall lobby');
      lobbyFill();
    }
    var L = lobby, S = L.settings, host = L.view === 'host', me = L.players[0], card = $('sheetHost').querySelector('.card');
    if (!card) return;
    lobbySeats();
    var perLife = S.hard ? 2 : 3, lives = perLife * S.players, all = L.players.length === S.players && L.players.every(function (p) { return p.ready; });
    var waitingFor = S.players - L.players.length, notReady = L.players.filter(function (p) { return !p.ready; }).length;
    var seg = function (key, opts) { return '<div class="sizes lseg" role="group">' + opts.map(function (o) { return '<button data-set="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (String(S[key]) === String(o[0])) + '"' + (host ? '' : ' disabled') + '>' + o[1] + '</button>'; }).join('') + '</div>'; };
    var sw = function (key, label, small) { return '<div class="setting"><span>' + label + '<small>' + small + '</small></span><button class="switch" role="switch" data-sw="' + key + '" aria-checked="' + !!S[key] + '"' + (host ? '' : ' disabled') + '></button></div>'; };
    var html = '<div class="row"><h2>Co-op room</h2><button class="close" id="x" aria-label="Leave room">' + '&times;' + '</button></div>';
    html += '<div class="lview" role="group" aria-label="Preview as"><span>Preview as</span><div class="sizes lseg"><button data-view="host" aria-pressed="' + host + '">Host</button><button data-view="guest" aria-pressed="' + !host + '">Player</button></div></div>';
    html += '<div class="lcode"><small>Room code</small><b id="lCode">' + L.code + '</b><button id="lCopy">Copy</button><p>' + (host ? 'Share this code with your friends so they can join.' : 'You joined with this code.') + '</p></div>';
    html += '<div class="chapter">Your online name</div><div class="lname"><input id="lName" maxlength="16" value="' + me.name.replace(/"/g, '&quot;') + '" aria-label="Your online name"><button id="lNameRnd" aria-label="Random name" title="Random name">&#x21bb;</button></div><p class="note">' + (L.askName ? 'First online room: pick the name your friends will see. You can change it in Settings later.' : 'You can change it until the game starts.') + '</p>';
    html += '<div class="chapter">Players ' + L.players.length + ' / ' + S.players + '</div><ul class="lplayers">';
    for (var i = 0; i < S.players; i++) {
      var p = L.players[i];
      if (!p) { html += '<li class="empty"><span class="dot"></span><span class="nm">Waiting for a player…</span></li>'; continue; }
      var isHost = host ? p.host : i === 1, you = host ? p.you : i === 0;
      html += '<li><span class="dot" style="background:' + colors.twins[i % colors.twins.length] + '">' + p.name.charAt(0) + '</span><span class="nm">' + p.name + (you ? ' <em>(you)</em>' : '') + (isHost ? ' <i class="crown" title="Host">♛ Host</i>' : '') + '</span><span class="bd">Board ' + (lobby.seats.indexOf(p) + 1) + '</span><span class="st ' + (p.ready ? 'on' : '') + '">' + (p.ready ? 'Ready' : 'Not ready') + '</span>' + (host && !p.you ? '<button class="kick" data-kick="' + i + '" aria-label="Remove ' + p.name + '">&times;</button>' : '') + '</li>';
    }
    html += '</ul>';
    html += '<div class="chapter">Boards</div><div class="lboards n' + S.players + '">' + Array.apply(null, Array(S.players)).map(function (_, i) { var p = L.seats[i]; return '<button data-seat="' + i + '" class="' + (L.pick === i ? 'pick' : '') + '"' + (host ? '' : ' disabled') + '><b>' + (i + 1) + '</b><span>' + (p ? p.name : '—') + '</span></button>'; }).join('') + '</div><p class="note">' + (S.players === 2 ? 'Side by side.' : 'Two rows of two.') + (host ? ' Tap two boards, or drag one onto another, to swap their players.' : ' The host chooses who plays each board.') + '</p>';
    html += '<div class="chapter">Room settings' + (host ? '' : ' · set by the host') + '</div>';
    html += '<div class="setting"><span>Players<small>Rooms are for 2 or 4 players</small></span></div>' + seg('players', [[2, '2 players'], [4, '4 players']]);
    html += '<div class="setting"><span>Difficulty<small>' + (S.hard ? '2 lives, no hints, and arrows with several effects at once' : '3 lives per player') + '</small></span></div>' + seg('hard', [[false, 'Normal'], [true, 'Hard']]);
    html += '<div class="setting"><span>Board size<small>The same for every player. Bigger boards can be zoomed.</small></span></div>' + seg('size', [[1, '1x'], [2, '2x'], [3, '3x'], [5, '5x']]);
    html += sw('snipers', 'Sniper arrows', 'Optional bonus shots onto other boards');
    html += sw('twins', 'Twin-shared arrows', 'Arrows that leave together across boards');
    html += sw('timed', 'Timed', 'Shared timer between all players');
    html += '<div class="lsum"><span>Shared lives<b>' + lives + '</b></span><span>Shared timer<b>' + (S.timed ? 'Yes' : 'No') + '</b></span><span>Win<b>All boards cleared</b></span></div>';
    html += '<button class="lready' + (me.ready ? ' on' : '') + '" id="lReady">' + (me.ready ? 'Ready ✓ (tap to cancel)' : 'I\'m ready') + '</button>';
    if (host) html += '<button class="primary" id="lStart"' + (all ? '' : ' disabled') + '>' + (all ? 'Start game' : waitingFor > 0 ? 'Waiting for ' + waitingFor + (waitingFor === 1 ? ' player to join' : ' players to join') : 'Waiting for ' + notReady + (notReady === 1 ? ' player to be ready' : ' players to be ready')) + '</button>';
    else html += '<p class="lwait">' + (all ? 'Everyone is ready. Waiting for the host to start…' : 'The game starts when everyone is ready and the host starts it.') + '</p>';
    html += '<button class="lleave" id="lLeave">Leave room</button><p class="note" style="text-align:center">Preview only: the other players are simulated.</p>';
    var top = card.scrollTop;
    card.innerHTML = '<div id="lobbyCard"></div>' + html; card.scrollTop = top;
    card.querySelector('#x').onclick = lobbyClose; card.querySelector('#lLeave').onclick = lobbyClose;
    card.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { L.view = b.getAttribute('data-view'); lobbySheet(true); }; });
    card.querySelector('#lCopy').onclick = function () {
      var btn = this;
      try { navigator.clipboard.writeText(L.code).then(function () { btn.textContent = 'Copied'; }, function () { btn.textContent = 'Select it'; }); } catch (e) { btn.textContent = 'Select it'; }
    };
    var nameIn = card.querySelector('#lName');
    nameIn.oninput = function () { var v = nameIn.value.replace(/\s+/g, ' ').trimStart(); me.name = v || me.name; if (v.trim()) save('unwind.onlineName', v.trim()); };
    nameIn.onchange = function () { if (!nameIn.value.trim()) nameIn.value = me.name; L.askName = false; lobbySheet(true); };
    card.querySelector('#lNameRnd').onclick = function () { me.name = lobbyName(); save('unwind.onlineName', me.name); L.askName = false; lobbySheet(true); };
    card.querySelectorAll('[data-set]').forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute('data-set'), v = b.getAttribute('data-v');
      S[k] = k === 'players' || k === 'size' ? +v : v === 'true';
      if (k === 'players') { while (L.players.length > S.players) L.players.pop(); lobbyFill(); }
      // Changing a setting asks everyone to confirm again.
      L.players.forEach(function (p) { if (!p.you && p.ready) { p.ready = false; lobbyLater(function () { if (L.players.indexOf(p) >= 0) { p.ready = true; lobbySheet(true); } }, 1200 + Math.random() * 2000); } });
      me.ready = false;
      lobbySheet(true);
    }; });
    card.querySelectorAll('[data-sw]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-sw'); S[k] = !S[k]; me.ready = false; lobbySheet(true); }; });
    // Dragging a board onto another swaps their players too.
    if (host) card.querySelectorAll('[data-seat]').forEach(function (b) {
      b.onpointerdown = function (ev) {
        var from = +b.getAttribute('data-seat'), r0 = b.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, ghost = null;
        var move = function (e) {
          if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
          if (!ghost) { ghost = b.cloneNode(true); ghost.className = 'seatghost'; ghost.style.width = r0.width + 'px'; ghost.style.height = r0.height + 'px'; document.body.appendChild(ghost); b.classList.add('dragging'); L.dragging = true; }
          ghost.style.left = (e.clientX - r0.width / 2) + 'px'; ghost.style.top = (e.clientY - r0.height / 2) + 'px';
          card.querySelectorAll('[data-seat]').forEach(function (o) { var q = o.getBoundingClientRect(); o.classList.toggle('over', o !== b && e.clientX > q.left && e.clientX < q.right && e.clientY > q.top && e.clientY < q.bottom); });
        };
        var up = function (e) {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
          if (!ghost) return;
          ghost.remove(); b.classList.remove('dragging');
          var over = card.querySelector('[data-seat].over');
          setTimeout(function () { L.dragging = false; }, 0);
          if (over) { var to = +over.getAttribute('data-seat'), t = L.seats[from]; L.seats[from] = L.seats[to]; L.seats[to] = t; L.seats = L.seats.filter(function (x) { return x; }); pluck(587.3, 0, 0.06, 0.3); }
          L.pick = -1; lobbySheet(true);
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      };
    });
    card.querySelectorAll('[data-seat]').forEach(function (b) { b.onclick = function () {
      if (L.dragging) return;
      var i = +b.getAttribute('data-seat');
      if (L.pick < 0) { L.pick = i; lobbySheet(true); return; }
      if (L.pick !== i) { var t = L.seats[L.pick]; L.seats[L.pick] = L.seats[i]; L.seats[i] = t; L.seats = L.seats.filter(function (x) { return x; }); pluck(587.3, 0, 0.06, 0.3); }
      L.pick = -1; lobbySheet(true);
    }; });
    card.querySelectorAll('[data-kick]').forEach(function (b) { b.onclick = function () { L.players.splice(+b.getAttribute('data-kick'), 1); lobbySheet(true); lobbyJoin(2500); }; });
    card.querySelector('#lReady').onclick = function () { me.ready = !me.ready; pluck(me.ready ? 784 : 392, 0, 0.06, 0.3); lobbySheet(true); };
    var st = card.querySelector('#lStart');
    if (st) st.onclick = function () {
      if (!all) return;
      var names = L.seats.map(function (p) { return p.name; }), you = L.seats.indexOf(me);
      var spec = Object.assign(coopSpec(S.size), { n: S.players, lives: lives, noSnipers: !S.snipers, noTwins: !S.twins, names: names, combos: S.hard ? 2 : 0 });
      lobby.timers.forEach(clearTimeout); lobby = null;
      spec.after = function () { coop.you = you; if (you > 0) coopSwitch(you); };
      openCoop(0, false, spec);
    };
  }
  function todayKey() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function openDaily() {
    var k = todayKey();
    var lvl = E.generate({ w: 7, h: 9, minLen: 2, maxLen: 6, depth: 7, twins: 1, compass: 1, trap: [0.05, 0.45] }, k, 40);
    E.prepare(lvl);
    begin({ id: 'daily-' + k, mode: 'daily', level: lvl, title: "Today's puzzle", chapter: CHAPTERS[timeChapter()], sunY: 34 });
  }
  function begin(c) {
    if (!c.coop) coop = null;
    current = c; cam = null; boardLayer = null;
    duck(false); stopJingle();
    tuneBase = c.mode === 'levels' ? c.index : 3;
    closeSheet();
    // Open water rolls fresh, unpredictable events for every game, including restarts.
    if (c.mode === 'endless') c.level.seed = Math.floor(Math.random() * 1e9);
    E.resetBoard(c.level);
    state = E.newState(c.level);
    state.safe = true;
    if (c.setup) c.setup(state);
    bee = null; beesLeaving = []; ambience = []; windAt = 0; embers = []; cards = [];
    c.level.arrows.forEach(function (a) { delete a.burn; delete a.burnUntil; delete a.rot; });
    hintsLeft = c.level.hints === undefined ? 1 : c.level.hints; hintArrow = -1; stuckShown = false; ended = false; collisions = 0;
    hintsUsed = 0; rewinds = 0; activeMs = 0; lastFrame = 0; tune = []; nudges = {}; unoFlip = {}; praises = []; capMode = '';
    wakes = []; flights = []; bounces = {}; ripples = []; blockerGlow = {}; angles = {};
    numberPairs(c.level);
    var pairNo = 0;
    c.level.arrows.forEach(function (a) {
      delete a.vis; angles[a.id] = E.dirOf(a, state) * 90;
      if (a.kind === 'twin' && a.twin > a.id) { a.pair = pairNo; c.level.arrows[a.twin].pair = pairNo; pairNo++; }
    });
    introStart = performance.now();
    prepareIntro(c.level);
    timeLeft = c.level.timeLimit ? c.level.timeLimit * 1000 : null; lastSecond = -1;
    $('timer').hidden = timeLeft === null; $('timebar').hidden = timeLeft === null;
    $('timer').classList.remove('low');
    applyChapter(c.chapter, c.sunY);
    applySeason(c.background ? (SEASONS[shownBackground()] ? shownBackground() : null) : c.level.season);
    $('where').textContent = c.mode === 'endless' || c.level.season ? c.title : c.title + ' · ' + c.chapter.name;
    if (c.level.flowers && c.level.flowers.length) sendBee(0, performance.now() + 900);
    var rec = progress.records && progress.records[bestKey(c)];
    if (rec) $('where').textContent += ' · Best ' + recordText(rec);
    setCaption(baseCaption());
    if (c.index === 0 && c.mode === 'levels' && c.set === 'calm') { hintArrow = E.legalMoves(c.level, state)[0]; hintStart = performance.now() + 700; }
    if (timeLeft !== null) drawTimer();
    maybeTutorials();
    refresh(); layout();
    track('level_start', { mode: c.mode, set: c.set });
  }
  var HARD_FIRST = 'Hard boards: two lives, no hints, and arrows with several effects at once.';
  function baseCaption() {
    if (current.level.caption) return current.level.caption;
    if (current.level.big) { var left = state.removed.filter(function (x) { return !x; }).length; return left + (left === 1 ? ' arrow left' : ' arrows left'); }
    if (current.mode === 'endless') return current.level.lives === null && !current.level.timeLimit && !E.effectsOf(current.level).length ? 'No lives to lose out here.' : '';
    if (current.set === 'hard' && current.index === 0) return HARD_FIRST;
    if (current.set === 'timed' && current.index === 0) return 'Clear the board before the time runs out.';
    return '';
  }
  // Big boards bloom outwards from the centre, so the whole map grows in together.
  var introEnd = 0;
  function prepareIntro(l) {
    var mx = (l.w - 1) / 2, my = (l.h - 1) / 2, far = Math.hypot(mx, my) || 1, spread = l.big ? 1400 : 0;
    var delay = function (c) { return Math.hypot(c[0] - mx, c[1] - my) / far * spread; };
    l.arrows.forEach(function (a, i) {
      a.introDelay = l.big ? delay(a.cells[a.cells.length >> 1]) : Math.min(i, 26) * 45;
    });
    (l.mirrors || []).forEach(function (m, i) { m.introDelay = l.big ? delay([m.x, m.y]) : 200; });
    introEnd = introStart + (l.big ? spread + INTRO_BIG : 26 * 45 + INTRO_SMALL);
  }
  var INTRO_BIG = 800, INTRO_SMALL = 520;
  function introOf(item, now) {
    if (reduced) return 1;
    var d = current.level.big ? INTRO_BIG : INTRO_SMALL;
    return Math.min(1, Math.max(0, (now - introStart - item.introDelay) / d));
  }
  // Draws something scaled about its own centre, so badges and icons grow with their arrows.
  function scaled(c, k, draw) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k); ctx.translate(-c.x, -c.y);
    draw();
    ctx.restore();
  }
  function setCaption(text, style) {
    var cap = $('caption'), lvl = current && current.level, watch = !style && !!text && !!lvl && (text === lvl.caption || text === HARD_FIRST) && levelDemos().length > 0;
    cap.removeAttribute('data-goto'); cap.classList.remove('goto');
    cap.textContent = text; cap.classList.toggle('on', !!text); cap.classList.toggle('watchable', watch);
    cap.classList.toggle('icewarn', style === 'ice'); cap.classList.toggle('goldwarn', style === 'gold');
    if (style) for (var i = 0; i < 10; i++) {
      var f = document.createElement('i');
      f.className = 'capfx'; f.textContent = style === 'ice' ? '❄' : '✦'; f.setAttribute('aria-hidden', 'true');
      f.style.left = (4 + i * 10) + '%'; f.style.animationDelay = (-i * 0.53) + 's'; f.style.fontSize = (11 + (i * 7) % 8) + 'px';
      cap.appendChild(f);
    }
  }
  function drawTimer() {
    var secs = Math.ceil(timeLeft / 1000);
    $('timer').textContent = Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2);
    $('timer').classList.toggle('low', secs <= 10);
    $('timebar').style.transform = 'scaleX(' + (timeLeft / (current.level.timeLimit * 1000)) + ')';
    if (secs !== lastSecond) {
      if (secs <= 10 && secs > 0 && lastSecond !== -1) tickSound(secs <= 5);
      lastSecond = secs;
    }
  }
  function applyChapter(ch, sunY) {
    var r = document.documentElement.style;
    r.setProperty('--ink', ch.ink); r.setProperty('--twin', ch.twin); r.setProperty('--compass', ch.compass);
    r.setProperty('--card', ch.card); r.setProperty('--sun', ch.sun); r.setProperty('--sky-a', ch.a); r.setProperty('--sky-b', ch.b);
    r.setProperty('--sun-y', sunY + '%');
    r.setProperty('color-scheme', 'light');
    r.setProperty('--gold-ink', ch === CHAPTERS[3] || ch === CHAPTERS[4] ? '#ffd23f' : '#a86a00');
    // Crossfade two gradient layers, since gradients themselves cannot transition.
    var show = $('sky2').style.opacity === '1' ? $('sky') : $('sky2'), hide = show.id === 'sky' ? $('sky2') : $('sky');
    show.style.background = 'linear-gradient(180deg,' + ch.a + ',' + ch.b + ')';
    show.style.opacity = '1'; hide.style.opacity = show.id === 'sky' ? '0' : '1';
    if (show.id === 'sky') $('sky2').style.opacity = '0';
    colors = ch;
  }

  var shownLives = null, capMode = '';
  function goldAlive() {
    if (!state || !state.freed) return false;
    return Object.keys(state.freed).some(function (id) { return !state.removed[id]; });
  }
  function refresh() {
    var max = current.level.lives, lives = state.lives, hearts = $('hearts');
    if (lives !== null && max > 5) {
      // Large shared pools show one heart and a count, so the header stays tidy.
      hearts.innerHTML = heartSvg(lives ? '' : 'gone') + '<b class="lifecount">' + lives + '</b>';
      $('livesLabel').textContent = lives === 1 ? '1 life left' : lives + ' lives left';
      $('lives').setAttribute('aria-label', lives + ' of ' + max + ' lives left');
    } else if (lives !== null) {
      var html = '';
      for (var i = 0; i < max; i++) {
        var cls = i >= lives ? (shownLives !== null && i === lives && shownLives > lives ? 'gone lost' : 'gone') : '';
        html += heartSvg(cls);
      }
      hearts.innerHTML = html;
      $('livesLabel').textContent = lives === 1 ? '1 life left' : lives + ' lives left';
      $('lives').setAttribute('aria-label', lives + ' of ' + max + ' lives left');
    } else {
      hearts.innerHTML = ''; $('livesLabel').textContent = current.level.timeLimit ? 'No lives' : 'Free play';
      $('lives').setAttribute('aria-label', 'Free play, no lives to lose');
    }
    shownLives = lives;
    drawBadge();
    $('bNextTheme').hidden = !cycleOn();
    $('bRewind').disabled = current.coop ? ended : !state.history.length || ended;
    var wantPause = !!current.coop;
    if ($('bRewind').getAttribute('data-pause') !== String(wantPause)) {
      $('bRewind').setAttribute('data-pause', wantPause);
      $('bRewind').innerHTML = wantPause ? '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>Pause' : '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg>Rewind';
    }
    $('bHint').disabled = hintsLeft <= 0 || ended;
    $('hintLabel').textContent = 'Hint ' + hintsLeft;
    var stuck = E.isStuck(current.level, state);
    $('bRewind').classList.toggle('call', stuck);
    if (stuck && !stuckShown) {
      stuckShown = true;
      setCaption(current.coop ? (coop && coop.room.tutorial ? current.level.caption : 'Nothing can move here yet. Check the other boards.') : current.level.arrows.some(function (x) { return !state.removed[x.id] && E.isRedCarded(state, x); }) ? 'Red cards are blocking the board. Rewind and play them in time.' : 'Nothing can move. Rewind one step.');
      track('stuck', { launches: state.launches });
    }
    // No launch right now, but cracking ice leads to one: say so, since it looks like a dead end.
    var iceOnly = !stuck && !ended && !E.isWon(state) && E.legalMoves(current.level, state).length === 0;
    var want = iceOnly ? 'ice' : goldAlive() && !ended ? 'gold' : '';
    if (want !== capMode) {
      if (want === 'ice') setCaption('Hit a frozen arrow with another arrow to open the way. It costs nothing.', 'ice');
      else if (want === 'gold') setCaption('A golden arrow! It can fly through anything.', 'gold');
      else if (!stuck) setCaption(baseCaption());
      capMode = want;
    }
    if (!want) {
      if (!stuck && stuckShown) { stuckShown = false; setCaption(baseCaption()); }
      if (!stuck && current.level.big) setCaption(baseCaption());
    }
    $('mute').innerHTML = (audioPrefs.music || audioPrefs.sound)
      ? '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/><path d="m3 3 18 18"/></svg>';
  }

  /* ---------- Board geometry ---------- */
  var canvas = $('board'), ctx = canvas.getContext('2d'), vw = 0, vh = 0, cs = 40, ox = 0, oy = 0;
  var cam = null, fitCs = 40, viewTop = 0, viewBottom = 0, MIN_TAP = 38, MAX_ZOOM = 64;
  function l0season() { return current && (E.effectsOf(current.level).length || current.mode === 'endless'); }
  function layout() {
    // Big boards draw at a lower resolution, which keeps them smooth on phones.
    var bigBoard = current && current.level.big, area = current ? current.level.w * current.level.h : 0;
    var dpr = Math.min(window.devicePixelRatio || 1, area > 700 ? 1.5 : bigBoard ? 2 : 3);
    vw = window.innerWidth; vh = window.innerHeight;
    boardDpr = dpr;
    // Setting a canvas size wipes it, so it is only touched when the size really changes.
    var cw = Math.round(vw * dpr), ch = Math.round(vh * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!current) return;
    viewTop = document.querySelector('header.ui').getBoundingClientRect().bottom + 10;
    $('bgButton').hidden = !(current && current.mode === 'endless');
    if (l0season()) { $('seasonBadge').style.top = viewTop + 'px'; $('bgButton').style.top = viewTop + 'px'; viewTop += E.effectsOf(current.level).length > 3 && vw < 340 ? 76 : 44; }
    viewBottom = document.querySelector('nav.ui').getBoundingClientRect().top - 54;
    var l = current.level, sideW = vw - 32 - (current.coop ? 92 : 0), padY = current.coop ? 84 : 0;
    fitCs = Math.min(sideW / l.w, (viewBottom - viewTop - padY) / l.h, 68);
    // Boards too big to tap at full view open zoomed in, and can be moved around.
    if (!cam && l.big && fitCs < MIN_TAP) {
      // Start on the whole map, then glide in to a size that is easy to tap.
      cam = { cs: reduced ? MIN_TAP : fitCs, cx: l.w / 2, cy: l.h / 2, anim: null, zoom: reduced ? null : { from: fitCs, to: MIN_TAP } };
    }
    document.body.classList.toggle('bigmap', !!cam);
    $('zoomctl').hidden = !cam;
    canvas.style.touchAction = cam ? 'none' : 'manipulation';
    if (cam) applyCam();
    else {
      cs = fitCs;
      if (current.coop) cs = fitCs * coopZoomK;
      ox = (vw - cs * l.w) / 2; oy = viewTop + (viewBottom - viewTop - cs * l.h) / 2;
    }
    coopNav();
  }
  function applyCam() {
    var l = current.level;
    cam.cs = Math.max(fitCs, Math.min(MAX_ZOOM, cam.cs));
    cs = cam.cs;
    var viewH = viewBottom - viewTop, halfW = vw / 2 / cs, halfH = viewH / 2 / cs;
    // While the mini-map is showing, extra room lets the bottom rows slide clear of it.
    var slack = cam.cs > fitCs * 1.04 ? (miniRect().h + 12) / cs : 0;
    var minX = Math.min(l.w / 2, halfW - 1), maxX = Math.max(l.w / 2, l.w - halfW + 1), minY = Math.min(l.h / 2, halfH - 1), maxY = Math.max(l.h / 2, l.h - halfH + 1) + slack;
    cam.limits = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    // While dragging, the map can be pulled a little past its edge, with growing resistance. It glides back on release.
    if (cam.free || cam.settling) {
      var soft = function (v, lo, hi, room) {
        if (!cam.free) return v;
        if (v > hi) return hi + room * (1 - 1 / (1 + (v - hi) / room));
        if (v < lo) return lo - room * (1 - 1 / (1 + (lo - v) / room));
        return v;
      };
      cam.cx = soft(cam.cx, minX, maxX, halfW * 0.7); cam.cy = soft(cam.cy, minY, maxY, halfH * 0.5);
    } else {
      cam.cx = Math.max(minX, Math.min(maxX, cam.cx));
      cam.cy = Math.max(minY, Math.min(maxY, cam.cy));
    }
    ox = vw / 2 - cam.cx * cs; oy = viewTop + viewH / 2 - cam.cy * cs;
  }
  // Arrows that animate are always drawn live. The rest can sit in the cached board.
  var boardLayer = null, layerBuilding = false, boardDpr = 2, unoFlip = {};
  function staticArrow(a, now) {
    if (state.removed[a.id] || a.kind === 'compass' || a.isKey || a.phase || a.ghostPhase !== undefined || a.uno !== undefined || a.red || (state.freed && state.freed[a.id]) || a.rot || state.frozen[a.id] !== undefined || (a.wait && state.launches < a.wait) || introOf(a, now) < 1) return false;
    if (a.key !== undefined && !state.removed[a.key]) return false;
    if (bounces[a.id] || (nudges[a.id] && now < nudges[a.id]) || (blockerGlow[a.id] && now < blockerGlow[a.id]) || (a.burnUntil && now < a.burnUntil)) return false;
    if (hintArrow === a.id || (hintArrow >= 0 && a.kind === 'twin' && a.twin === hintArrow)) return false;
    return true;
  }
  function zoomAt(x, y, factor) {
    if (!cam) return;
    var gx = (x - ox) / cs, gy = (y - oy) / cs;
    cam.anim = null; cam.zoom = null; cam.lastZoom = performance.now(); cam.cs *= factor; applyCam();
    cam.cx += gx - (x - ox) / cs; cam.cy += gy - (y - oy) / cs; applyCam();
  }
  // Glides the view to an arrow if it is out of sight.
  function focusArrow(id) {
    if (!cam) return;
    cam.zoom = null;
    var h = E.tipOf(current.level.arrows[id], state), p = px(h), m = cs;
    if (p.x < m || p.x > vw - m || p.y < viewTop + m || p.y > viewBottom - m) cam.anim = { cx: h[0] + 0.5, cy: h[1] + 0.5 };
  }
  function px(c) { return { x: ox + (c[0] + 0.5) * cs, y: oy + (c[1] + 0.5) * cs }; }
  function screenCells() { return Math.ceil(Math.max(vw, vh) / cs) + 4 + (current && current.level.big ? current.level.w + current.level.h : 0); }

  // Builds a path through the arrow's cells, around any mirrors, then on past the screen edge.
  function trackOf(a, c) {
    var pts = a.kind === 'compass' ? [a.cells[0].slice()] : a.cells.map(function (x) { return x.slice(); });
    if (c.fromTail) pts.reverse();
    (c.path || []).forEach(function (m) { pts.push(m.slice()); });
    var last = pts[pts.length - 1], far = screenCells() + a.cells.length;
    pts.push([last[0] + E.DX[c.endDir] * far, last[1] + E.DY[c.endDir] * far]);
    return pts;
  }
  function lengthOf(a) { return a.kind === 'compass' ? 0.62 : a.cells.length - 1; }

  // Draws the part of a polyline between two distances (in cells) and returns the end tangent.
  function strokeWindow(pts, from, to) {
    var dist = 0, started = false, end = null, tan = [0, -1];
    ctx.beginPath();
    for (var i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      var seg = Math.abs(bx - ax) + Math.abs(by - ay);
      if (!seg) continue;
      var s0 = Math.max(from, dist), s1 = Math.min(to, dist + seg);
      if (s1 >= s0 && s1 >= dist && s0 <= dist + seg) {
        var ux = (bx - ax) / seg, uy = (by - ay) / seg;
        var p0 = px([ax + ux * (s0 - dist) - 0.5 + 0.5, ay + uy * (s0 - dist)]), p1 = px([ax + ux * (s1 - dist), ay + uy * (s1 - dist)]);
        if (!started) { ctx.moveTo(p0.x, p0.y); started = true; } else ctx.lineTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        end = p1; tan = [ux, uy];
      }
      dist += seg;
    }
    ctx.stroke();
    return { end: end, tan: tan };
  }
  function chevron(p, tan, size) {
    if (!p) return;
    var a = Math.atan2(tan[1], tan[0]), s = size;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(a - 0.72) * s, p.y - Math.sin(a - 0.72) * s);
    ctx.lineTo(p.x + Math.cos(a) * s * 0.22, p.y + Math.sin(a) * s * 0.22);
    ctx.lineTo(p.x - Math.cos(a + 0.72) * s, p.y - Math.sin(a + 0.72) * s);
    ctx.stroke();
  }
  function ready(a) { return E.isReady(state, a); }
  // An arrow with several effects shows the most important one: frozen, then phase, twins, reverse.
  function arrowColor(a) {
    var dark = colors === CHAPTERS[3] || colors === CHAPTERS[4];
    if (a.sniper && !(state && state.frozen && state.frozen[a.id] !== undefined)) return dark ? '#ff6b6b' : '#b3122e';
    if (a.coopGroup !== undefined) return colors.twins[colors.twins.length - 1 - a.coopGroup % colors.twins.length];
    if (state && state.frozen && state.frozen[a.id] !== undefined) return dark ? '#8fd3ff' : '#2f8fd0';
    if (a.phase) return dark ? '#d7b4ff' : '#7a3fd0';
    if (a.kind === 'twin') return colors.twins[(a.pair || 0) % colors.twins.length];
    if (a.uno !== undefined) return dark ? '#ffc069' : '#c85a00';
    return a.kind === 'compass' ? colors.compass : colors.ink;
  }
  function setStroke(color, width, alpha) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }

  /* ---------- Frame loop ---------- */
  var lastDrawn = 0;
  // While a golden arrow is on the board: a soft, steady shimmer of sound, little chimes and a ring of light.
  var goldHum = null, nextChime = 0, nextBeacon = 0, GOLD_NOTES = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
  function setGoldHum(on) {
    if (on && !goldHum && audioPrefs.sound) {
      var c = audio(); if (!c) return;
      var g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain(), oscs = [523.25, 526.4, 784.9].map(function (hz) { var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(g); o.start(); return o; });
      g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(0.022, c.currentTime + 0.5);
      lfo.frequency.value = 3.2; depth.gain.value = 0.008; lfo.connect(depth); depth.connect(g.gain); lfo.start();
      g.connect(sfxBus);
      goldHum = { g: g, parts: oscs.concat([lfo]) };
    } else if (goldHum && (!on || !audioPrefs.sound)) {
      var h = goldHum, cc = audio(); goldHum = null;
      h.g.gain.cancelScheduledValues(cc.currentTime); h.g.gain.setTargetAtTime(0, cc.currentTime, 0.12);
      h.parts.forEach(function (o) { o.stop(cc.currentTime + 0.6); });
      setTimeout(function () { h.g.disconnect(); }, 800);
    }
  }
  function goldTick(now) {
    var live = goldAlive() && !ended && !$('sheetHost').firstChild;
    setGoldHum(live);
    if (!live) return;
    if (now > nextChime) { pluck(GOLD_NOTES[Math.floor(Math.random() * GOLD_NOTES.length)], 0, 0.045, 1.1); nextChime = now + 520 + Math.random() * 420; }
    if (now > nextBeacon) {
      nextBeacon = now + 1300;
      Object.keys(state.freed).forEach(function (id) { if (state.removed[id]) return; var m = current.level.arrows[id]; addRipple(px(m.cells[m.cells.length >> 1]), '#e0a100', 4); });
    }
  }
  var flowersInLayer = false;
  function settledCs(c, size) { return !!c && size < 26; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!current) return;
    var dt = lastFrame ? Math.min(100, now - lastFrame) : 0; lastFrame = now;
    var paused = ended || document.hidden || !!$('sheetHost').firstChild;
    if (!paused) {
      activeMs += dt;
      // On big boards the clock starts once the map has finished growing and settling.
      if (timeLeft !== null && !(cam && (now < introEnd || cam.zoom))) {
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; drawTimer(); timeUpSound(); finish(false, 'time'); } else drawTimer();
      }
    }
    if (cam && cam.zoom && now > introEnd + 200) {
      var zt = Math.min(1, (now - introEnd - 200) / 1100);
      cam.cs = cam.zoom.from + (cam.zoom.to - cam.zoom.from) * ease(zt);
      if (zt >= 1) cam.zoom = null;
      applyCam();
    }
    if (cam && cam.anim) {
      cam.cx += (cam.anim.cx - cam.cx) * 0.14; cam.cy += (cam.anim.cy - cam.cy) * 0.14;
      if (Math.abs(cam.anim.cx - cam.cx) + Math.abs(cam.anim.cy - cam.cy) < 0.03) { cam.anim = null; cam.settling = false; }
      applyCam();
    }
    goldTick(now);
    // Behind an open menu the board is covered and blurred, so it can draw less often.
    if ($('sheetHost').firstChild && now - lastDrawn < 66) return;
    lastDrawn = now;
    if (current.coop) coopZoomTick();
    ctx.clearRect(0, 0, vw, vh);
    var l = current.level, w = Math.max(3, cs * 0.17);
    if (activeScene) {
      drawAmbience(now, activeScene);
      // A soft panel keeps the arrows easy to read over the scenery.
      ctx.globalAlpha = 0.5 * (reduced ? 1 : Math.min(1, (now - introStart) / 500)); ctx.fillStyle = colors.card;
      ctx.beginPath(); ctx.roundRect(ox - cs * 0.2, oy - cs * 0.2, cs * (l.w + 0.4), cs * (l.h + 0.4), cs * 0.4); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Big boards only draw what is near the screen.
    var offscreen = function (a) {
      if (!cam || layerBuilding || bounces[a.id] || nudges[a.id]) return false;
      return a.cells.every(function (c) { var p = px(c); return p.x < -cs * 2 || p.x > vw + cs * 2 || p.y < -cs * 2 || p.y > vh + cs * 2; });
    };

    // Arrows at rest, or bouncing. A hinted arrow fades to a new colour and size, holds for 3 seconds, then fades back.
    var hintAmt = 0;
    if (hintArrow >= 0) {
      var ht = now - hintStart;
      if (ht >= HINT_IN + HINT_HOLD + HINT_OUT) hintArrow = -1;
      else if (ht > 0) {
        var smooth = function (x) { return x * x * (3 - 2 * x); };
        if (ht < HINT_IN) hintAmt = smooth(ht / HINT_IN);
        // During the 3 seconds the hint swings between 100% and 50%, three full swings, and ends on 100%.
        else if (ht < HINT_IN + HINT_HOLD) hintAmt = 0.75 + 0.25 * Math.cos((ht - HINT_IN) / 1000 * 2 * Math.PI);
        else hintAmt = smooth(1 - (ht - HINT_IN - HINT_HOLD) / HINT_OUT);
      }
      lastHintAmt = hintAmt;
    }
    var hinted = {};
    if (hintArrow >= 0) { hinted[hintArrow] = 1; if (l.arrows[hintArrow].kind === 'twin') hinted[l.arrows[hintArrow].twin] = 1; }
    var paintArrow = function (a, i) {
      if (state.removed[a.id] || offscreen(a)) return;
      var intro = introOf(a, now);
      if (intro <= 0) return;
      var f = ease(intro), shift = 0, b = bounces[a.id], amt = hinted[a.id] ? hintAmt : coop && coopFocus === a.id ? 0.75 + 0.25 * Math.sin(now / 200) : 0, isReady = ready(a);
      if (b) {
        var bt = (now - b.start) / 440;
        if (bt >= 1) delete bounces[a.id]; else shift = Math.sin(bt * Math.PI) * b.reach;
      }
      var nudge = nudges[a.id] && now < nudges[a.id] ? Math.sin((nudges[a.id] - now) / 40) * cs * 0.05 : 0;
      var glow = blockerGlow[a.id] && now < blockerGlow[a.id] ? 1 + 0.35 * Math.sin((blockerGlow[a.id] - now) / 420 * Math.PI) : 1;
      var isFrozen = state.frozen[a.id] !== undefined, burning = a.burnUntil && now < a.burnUntil;
      var burnT = burning && a.burn ? (now - a.burn.start) / a.burn.dur : 0;
      // The body turns red while it burns, then fades back.
      // Glowing hot at first, then briefly charred, then back to normal.
      var baseColor = burning ? (burnT < 0.1 ? mixColor(arrowColor(a), '#e8321a', burnT / 0.1) : burnT < 0.72 ? '#e8321a' : mixColor('#e8321a', arrowColor(a), (burnT - 0.72) / 0.28)) : isFrozen ? '#3f9fd8' : arrowColor(a);
      var color = amt && hinted[a.id] ? mixColor(baseColor, colors.hint, amt) : baseColor;
      var width = w * glow * (1 + amt * 0.75);
      var head = cs * (0.24 + amt * 0.1);
      var ghostForm = E.isGhost(state, a), carded = E.isRedCarded(state, a);
      var golden = !!(state.freed && state.freed[a.id]);
      if (golden) color = '#e0a100';
      if (carded && !amt) { color = mixColor(arrowColor(a), '#c8202f', 0.55); }
      var alpha = (ghostForm ? 0.3 + amt * 0.7 : isReady || isFrozen ? 1 : 0.62 + amt * 0.38) * f;
      ctx.save(); ctx.translate(nudge, 0);
      if (a.rot) {
        var rt = (now - a.rot.start) / 800;
        if (rt >= 1) delete a.rot;
        else { var piv = px(a.cells[0]); ctx.translate(piv.x, piv.y); ctx.rotate(-a.rot.turn * (1 - ease(Math.max(0, rt)))); ctx.translate(-piv.x, -piv.y); }
      }
      if (a.kind === 'compass') {
        var c = px(a.cells[0]), r = cs * 0.37, target = angles[a.id];
        setStroke(color, Math.max(1.5, cs * (0.05 + amt * 0.03)), (0.6 + amt * 0.4) * f * alpha);
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.stroke();
        var show = a.vis === undefined ? (a.vis = target) : (a.vis += (target - a.vis) * (reduced ? 1 : 0.11));
        var rad = show * Math.PI / 180, ux = Math.sin(rad), uy = -Math.cos(rad), off = shift * cs;
        var hx = c.x + ux * (r * 0.62 + off), hy = c.y + uy * (r * 0.62 + off);
        setStroke(color, width, f * alpha);
        ctx.beginPath(); ctx.moveTo(c.x - ux * r * 0.5 + ux * off, c.y - uy * r * 0.5 + uy * off); ctx.lineTo(hx, hy); ctx.stroke();
        chevron({ x: hx, y: hy }, [ux, uy], cs * (0.2 + amt * 0.06));
        ctx.restore();
        return;
      }
      var len = lengthOf(a), fromTail = E.tipAtTail(state, a), restCells = fromTail ? a.cells.slice().reverse() : a.cells;
      var tipCell = restCells[restCells.length - 1], tipDir = E.dirOf(a, state);
      var pts = b && b.pts ? b.pts : restCells.concat([[tipCell[0] + E.DX[tipDir] * 2, tipCell[1] + E.DY[tipDir] * 2]]);
      if (golden) {
        // A pulsing halo behind the arrow.
        var pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 220);
        setStroke('#ffd23f', width * (2.6 + pulse * 1.8), 0.22 + pulse * 0.2); strokeWindow(pts, shift, shift + len);
        setStroke('#fff3b0', width * 1.6, 0.5); strokeWindow(pts, shift, shift + len);
      }
      if (coop && coopFocus === a.id) {
        // Held from another board: the partner glows in its own colour.
        var fp = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 200);
        setStroke(color, width * (2.8 + fp * 2), 0.18 + fp * 0.18); strokeWindow(pts, shift, shift + len);
        setStroke(color, width * 1.7, 0.35); strokeWindow(pts, shift, shift + len);
      }
      setStroke(color, width, alpha);
      if (!isReady && !isFrozen) ctx.setLineDash([cs * 0.18, cs * 0.3]);
      var res = strokeWindow(pts, shift, shift + len * f);
      ctx.setLineDash([]);
      setStroke(color, width, alpha);
      if (a.uno !== undefined && !shift) {
        // The tip jumps to the other end with a quick pop, and a faint mark shows where it goes next.
        var flipT = unoFlip[a.id] ? Math.min(1, (now - unoFlip[a.id]) / 240) : 1, flipF = ease(flipT);
        var far = restCells[0], farP = px(far), far2 = restCells[1], farPrev = px(far2);
        var gone = Math.hypot(farP.x - farPrev.x, farP.y - farPrev.y) || 1, farTan = [(farP.x - farPrev.x) / gone, (farP.y - farPrev.y) / gone];
        setStroke(color, Math.max(1.5, cs * 0.05), alpha * (0.5 + 0.5 * (1 - flipF)));
        chevron(farP, farTan, head * (0.7 + 0.3 * (1 - flipF)));
        setStroke(color, width, alpha);
        chevron(res.end, res.tan, head * (0.4 + 0.6 * f) * (0.4 + 0.6 * flipF + 0.35 * Math.sin(flipT * Math.PI)));
      } else chevron(res.end, res.tan, head * (0.4 + 0.6 * f));
      var centre = pointAlong(pts, shift + len / 2);
      // Badges and icons pop in once their arrow is mostly drawn.
      var pop = Math.max(0, (intro - 0.45) / 0.55); pop = ease(pop);
      drawTraits(a, pts, shift, len, color, ghostForm, pop, now);
      if (golden) goldSparkles(a, pts, shift, len, now);
      var tailPoint = px(a.cells[0]);
      if (a.isKey) scaled(tailPoint, pop, function () { drawStar(tailPoint, cs * 0.34, now); if (a.pairNo) pairTag(tailPoint, cs * 0.34, a.pairNo); });
      if (a.key !== undefined && !state.removed[a.key]) scaled(tailPoint, pop, function () { drawMoon(tailPoint, cs * 0.34, now); if (a.pairNo) pairTag(tailPoint, cs * 0.34, a.pairNo); });
      if (isFrozen) scaled(centre, pop, function () { drawIce(centre, cs * 0.3); });
      if (burning) drawArrowFlames(a, now);
      ctx.restore();
    };

    // Everything that sits still on the board: dots, flowers and mirrors.
    var paintBase = function (cellsOnly) {
    // Faint resting dots mark the board, and show through as arrows leave.
    ctx.globalAlpha = 0.16 * (reduced ? 1 : Math.min(1, (now - introStart) / 500)); ctx.fillStyle = colors.ink;
    if (cellsOnly) {
      cellsOnly.forEach(function (k) { var dot = px([k % l.w, Math.floor(k / l.w)]); ctx.beginPath(); ctx.arc(dot.x, dot.y, Math.max(1.4, cs * 0.04), 0, 7); ctx.fill(); });
      return;
    }
    var y0 = Math.max(0, Math.floor(-oy / cs) - 1), y1 = Math.min(l.h, Math.ceil((vh - oy) / cs) + 1), x0 = Math.max(0, Math.floor(-ox / cs) - 1), x1 = Math.min(l.w, Math.ceil((vw - ox) / cs) + 1);
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
      var p = px([x, y]); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, cs * 0.04), 0, 7); ctx.fill();
    }

    // Mirrors.
    (l.mirrors || []).forEach(function (m) {
      var c = px([m.x, m.y]), r = cs * 0.36, s = m.t === '/' ? -1 : 1, mf = ease(introOf(m, now));
      if (mf <= 0) return;
      setStroke(colors.mirror, Math.max(3, cs * 0.13), mf);
      ctx.beginPath(); ctx.moveTo(c.x - r, c.y - r * s); ctx.lineTo(c.x + r, c.y + r * s); ctx.stroke();
      setStroke(colors.mirror, Math.max(1, cs * 0.035), 0.55 * mf);
      ctx.beginPath(); ctx.arc(c.x, c.y, cs * 0.46, 0, 7); ctx.stroke();
    });

    };
    // Every map keeps a ready-made picture of everything at rest. Each frame stamps it, and only the
    // tiles that changed get repainted, so a launch costs a small patch and not a whole board.
    var layerOn = false;
    if (!reduced && !window.unwindNoLayer && now > introEnd) {
      // In the whole-map view flowers are tiny, so they rest in the picture. Up close they sway live.
      flowersInLayer = !!l.flowers && l.flowers.length > 30 && settledCs(cam, cs);
      var layerKey = current.id + '|' + colors.name + '|' + flowersInLayer + '|' + (flowersInLayer && state.picked ? Object.keys(state.picked).length : 0);
      var settled = !cam || (!cam.zoom && now - (cam.lastZoom || 0) > 160);
      var padW = (l.w + 4) * cs, padH = (l.h + 4) * cs, res = Math.min(boardDpr, 4096 / Math.max(padW, padH));
      var enterLayer = function (cv) {
        var kept = [ctx, ox, oy, vw, vh];
        ctx = cv.getContext('2d'); ctx.setTransform(res, 0, 0, res, 0, 0);
        ox = 2 * cs; oy = 2 * cs; vw = padW; vh = padH; layerBuilding = true;
        return function () { ctx.globalAlpha = 1; layerBuilding = false; ctx = kept[0]; ox = kept[1]; oy = kept[2]; vw = kept[3]; vh = kept[4]; ctx.globalAlpha = 1; };
      };
      if (!boardLayer || boardLayer.key !== layerKey || (settled && Math.abs(boardLayer.cs - cs) / cs > 0.001)) {
        var cv = boardLayer ? boardLayer.canvas : document.createElement('canvas');
        var cw = Math.ceil(padW * res), ch = Math.ceil(padH * res);
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; } else cv.getContext('2d').clearRect(0, 0, cw, ch);
        var leave = enterLayer(cv);
        var painted = {};
        paintBase();
        if (flowersInLayer) { drawFlowers(now, l); }
        l.arrows.forEach(function (a, i) { if (staticArrow(a, now)) { paintArrow(a, i); painted[a.id] = a.cells; } });
        leave();
        boardLayer = { canvas: cv, key: layerKey, cs: cs, res: res, painted: painted, flowerMark: state.launches };
        window.unwindLayerBuilds = (window.unwindLayerBuilds || 0) + 1;
      } else {
        // Patch only the tiles of arrows that left, returned or started moving.
        var dirty = {}, anyDirty = false, lay = boardLayer, markCells = function (cells) { cells.forEach(function (c) { dirty[c[1] * l.w + c[0]] = 1; }); anyDirty = true; };
        if (flowersInLayer && lay.flowerMark !== state.launches) {
          l.flowers.forEach(function (fl, i) { if (i >= Math.min(lay.flowerMark, state.launches) && i < Math.max(lay.flowerMark, state.launches)) markCells([fl]); });
          lay.flowerMark = state.launches;
        }
        l.arrows.forEach(function (a) {
          var want = staticArrow(a, now), had = lay.painted[a.id];
          if (want === !!had && (!had || had === a.cells)) return;
          if (had) markCells(had);
          if (want) markCells(a.cells);
        });
        if (anyDirty) {
          var saveCs = cs; cs = lay.cs;
          var padRes = lay.res, leavePatch = (function () { var keep = res; res = padRes; var out = enterLayer(lay.canvas); res = keep; return out; })();
          var keys = Object.keys(dirty).map(Number);
          ctx.save(); ctx.beginPath();
          keys.forEach(function (k) {
            var cx = k % l.w, cy = Math.floor(k / l.w), rx = Math.floor((cx + 2) * cs * padRes) / padRes, ry = Math.floor((cy + 2) * cs * padRes) / padRes;
            ctx.rect(rx, ry, Math.ceil(cs * padRes + 1) / padRes, Math.ceil(cs * padRes + 1) / padRes);
          });
          ctx.clip(); ctx.clearRect(0, 0, vw, vh);
          paintBase(keys);
          if (flowersInLayer) l.flowers.forEach(function (fl, i) { if (i >= state.launches && !(state.picked && state.picked[fl[1] * l.w + fl[0]]) && dirty[fl[1] * l.w + fl[0]]) drawFlower(px(fl), cs * 0.47, fl[0] * 7 + fl[1] * 3, now, true); });
          var near = {};
          keys.forEach(function (k) {
            var cx = k % l.w, cy = Math.floor(k / l.w);
            for (var ny = cy - 1; ny <= cy + 1; ny++) for (var nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h) continue;
              var o = l.grid[ny * l.w + nx]; if (o !== -1) near[o] = 1;
            }
          });
          l.arrows.forEach(function (a, i) {
            var want = staticArrow(a, now);
            if (!want) { delete lay.painted[a.id]; return; }
            if (near[a.id] || lay.painted[a.id] !== a.cells) { paintArrow(a, i); lay.painted[a.id] = a.cells; }
          });
          ctx.restore();
          leavePatch(); cs = saveCs;
          window.unwindLayerPatches = (window.unwindLayerPatches || 0) + 1;
        }
      }
      var tw = boardLayer.canvas.width / boardLayer.res * (cs / boardLayer.cs), th = boardLayer.canvas.height / boardLayer.res * (cs / boardLayer.cs);
      ctx.globalAlpha = 1;
      // Landing on whole screen pixels keeps the picture exactly as sharp as drawing it live.
      var exact = boardLayer.cs === cs && boardLayer.res === boardDpr;
      ctx.imageSmoothingEnabled = !exact;
      ctx.drawImage(boardLayer.canvas, Math.round((ox - 2 * cs) * boardDpr) / boardDpr, Math.round((oy - 2 * cs) * boardDpr) / boardDpr, tw, th);
      ctx.imageSmoothingEnabled = true;
      layerOn = true;
    } else paintBase();
    if (l.flowers && !(layerOn && flowersInLayer)) drawFlowers(now, l);
    if (E.hasEffect(l, 'summer')) drawFires(now);

    // A slow golden thread runs from each star to the moon it will wake.
    l.arrows.forEach(function (a) {
      if (a.key === undefined || state.removed[a.id] || state.removed[a.key]) return;
      var moon = px(a.cells[0]), star = px(l.arrows[a.key].cells[0]), near = nudges[a.id] && now < nudges[a.id];
      var threadIn = ease(Math.min(introOf(a, now), introOf(l.arrows[a.key], now)));
      setStroke(SKY_GOLD, Math.max(1.5, cs * (near ? 0.08 : 0.045)), (near ? 1 : 0.75) * threadIn);
      ctx.setLineDash([cs * 0.03, cs * 0.2]);
      ctx.lineDashOffset = reduced ? 0 : -now / 45;
      ctx.beginPath(); ctx.moveTo(star.x, star.y); ctx.lineTo(moon.x, moon.y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    });

    // Links between twins, each pair in its own colour.
    l.arrows.forEach(function (a) {
      if (a.kind !== 'twin' || a.twin < a.id || state.removed[a.id]) return;
      var m1 = pointAlong(a.cells, lengthOf(a) / 2), other = l.arrows[a.twin], m2 = pointAlong(other.cells, lengthOf(other) / 2);
      setStroke(arrowColor(a), Math.max(1.5, cs * 0.05), 0.55 * ease(Math.min(introOf(a, now), introOf(other, now))));
      ctx.setLineDash([cs * 0.06, cs * 0.17]);
      ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Arrows on top. On big maps, those at rest are already part of the cached board.
    l.arrows.forEach(function (a, i) {
      if (layerOn && staticArrow(a, now)) return;
      paintArrow(a, i);
    });

    drawWakes(now);
    if (embers.length) drawEmbers(now);
    if (cards.length) drawRedCards(now);
    if (windAt) drawWind(now);
    if (l.flowers) drawBees(now);

    // Arrows on their way out.
    flights = flights.filter(function (fl) {
      var tNow = (now - fl.start) / fl.duration;
      if (tNow >= 1) return false;
      if (tNow < 0) tNow = 0;
      var travel = fl.travel * (0.28 * tNow + 0.72 * tNow * tNow);
      if (!fl.rippled && travel >= fl.rayCells - 0.2) { fl.rippled = true; addRipple(fl.edge, fl.color); }
      if (fl.sniper) sniperGlow(fl.pts, travel, travel + fl.len, w, now);
      setStroke(fl.color, w, fl.ghosty ? 0.55 + 0.25 * Math.sin(now / 45) : 1);
      var res = strokeWindow(fl.pts, travel, travel + fl.len);
      chevron(res.end, res.tan, cs * 0.24);
      if (fl.sniper) sniperSparks(fl.pts, travel, travel + fl.len, res, now);
      if (fl.gold) { ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 0.8; for (var gi = 0; gi < 9; gi++) { var gp = pointAlong(fl.pts, Math.max(0, travel + fl.len - gi * 0.55)); ctx.globalAlpha = 1 - gi / 9; drawStarShape(gp.x + Math.sin(gi * 2.3 + now / 90) * cs * 0.25, gp.y + Math.cos(gi * 1.7 + now / 110) * cs * 0.25, cs * 0.12, now / 120 + gi); } ctx.restore(); }
      return true;
    });

    ripples = ripples.filter(function (r) {
      var t = (now - r.start) / 1500;
      if (t >= 1) return false;
      if (t < 0) return true;
      for (var k = 0; k < 2; k++) {
        var tt = Math.max(0, t - k * 0.16);
        setStroke(r.color, 1.6, (1 - t) * 0.42);
        ctx.beginPath(); ctx.arc(r.x, r.y, tt * cs * r.size, 0, 7); ctx.stroke();
      }
      return true;
    });
    ctx.globalAlpha = 1;
    if (current.coop) drawCoop(now, w);
    if (praises.length) drawPraises(now);
    if (cam && cs > fitCs * 1.04) drawMinimap(Math.min(1, (cs / fitCs - 1.04) / 0.2));
  }
  // A kind word and a few small stars above each arrow that is played correctly.
  var PRAISE = ['Spectacular!', 'Amazing!', 'Great job!', 'Wonderful!', 'Lovely!', 'Beautiful!', 'Brilliant!', 'Nice one!', 'Well done!', 'Superb!'];
  var praises = [], lastPraise = -1, PRAISE_MS = 1100;
  function addPraise(a, now) {
    var pick = Math.floor(Math.random() * (PRAISE.length - 1));
    if (pick >= lastPraise) pick++;
    lastPraise = pick;
    // A quick run of taps moves the older word along, so words never pile up.
    praises = praises.slice(-1);
    praises.forEach(function (p) { p.start = Math.min(p.start, now - PRAISE_MS * 0.8); });
    var stars = [];
    for (var i = 0; i < 7; i++) {
      var turn = i / 7 * Math.PI * 2 + Math.random() * 0.5;
      stars.push({ dx: Math.cos(turn), dy: Math.sin(turn), reach: 0.75 + Math.random() * 0.4, size: 4.5 + Math.random() * 3.5, delay: Math.random() * 90, spin: Math.random() * 6 });
    }
    praises.push({ word: window.UnwindI18n.t(PRAISE[pick]), cell: a.cells[a.cells.length >> 1], start: now, stars: stars });
    window.unwindPraiseWords = (window.unwindPraiseWords || []).concat(PRAISE[pick]).slice(-40);
  }
  // A small number shared by a moon arrow and its star arrow, so pairs are easy to match.
  function pairTag(c, r, n) {
    var x = c.x + r * 0.72, y = c.y + r * 0.72, tr = Math.max(6.5, r * 0.56);
    ctx.save(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6d6'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = Math.max(1, tr * 0.16);
    ctx.beginPath(); ctx.arc(x, y, tr, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a08'; ctx.font = '700 ' + Math.round(tr * 1.35) + 'px Figtree,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + tr * 0.06);
    ctx.restore();
  }
  function numberPairs(l) {
    var n = 0;
    l.arrows.forEach(function (a) { if (a.key !== undefined) { n++; a.pairNo = n; l.arrows[a.key].pairNo = n; } });
  }
  function drawStarShape(x, y, r, turn) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var q = turn + i * Math.PI / 4, d = i % 2 ? r * 0.38 : r;
      if (i) ctx.lineTo(x + Math.cos(q) * d, y + Math.sin(q) * d); else ctx.moveTo(x + Math.cos(q) * d, y + Math.sin(q) * d);
    }
    ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  function drawPraises(now) {
    var night = colors === CHAPTERS[3] || colors === CHAPTERS[4], ink = night ? '#ffd23f' : '#a86a00', size = Math.round(Math.max(22, Math.min(30, vw * 0.066)));
    ctx.save();
    ctx.font = '600 ' + size + 'px Fredoka,Figtree,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    praises = praises.filter(function (p) {
      var t = (now - p.start) / PRAISE_MS;
      if (t >= 1) return false;
      var inT = Math.min(1, t / 0.16), pop = reduced ? 1 : 1 + 0.5 * Math.pow(1 - inT, 2) - 0.5 * Math.pow(1 - inT, 4) * 2;
      var alpha = Math.min(1, t / 0.1) * (t > 0.65 ? (1 - t) / 0.35 : 1), rise = reduced ? 0 : ease(t) * 26;
      var c = px(p.cell), half = ctx.measureText(p.word).width / 2 + 12;
      var x = Math.max(half, Math.min(vw - half, c.x)), top = viewTop + size, bottom = viewBottom - size;
      var y = Math.max(top, Math.min(bottom, c.y - cs * 0.6 - size * 0.5)) - rise;
      // Stars burst out from the word, then fade.
      ctx.fillStyle = '#ffc21f';
      p.stars.forEach(function (st) {
        var q = Math.max(0, Math.min(1, (now - p.start - st.delay) / (PRAISE_MS * 0.75)));
        if (q <= 0 || q >= 1) return;
        var out = reduced ? 0.8 : 1 - Math.pow(1 - q, 3);
        ctx.globalAlpha = Math.sin(q * Math.PI) * alpha;
        ctx.strokeStyle = colors.card; ctx.lineWidth = 1.5;
        drawStarShape(x + st.dx * (half + 8) * st.reach * out, y + st.dy * (size * 1.05) * st.reach * out, st.size * (1 - q * 0.35), st.spin + q * 2);
      });
      ctx.globalAlpha = alpha;
      ctx.translate(x, y); ctx.scale(pop, pop);
      ctx.strokeStyle = colors.card; ctx.lineWidth = 5; ctx.strokeText(p.word, 0, 0);
      ctx.fillStyle = ink; ctx.fillText(p.word, 0, 0);
      ctx.setTransform(boardDpr, 0, 0, boardDpr, 0, 0);
      return true;
    });
    ctx.restore();
  }
  // A small map of what is left, with a frame showing the current view. Tap it to jump.
  function miniRect() {
    var l = current.level, sc = Math.min(92 / l.w, 112 / l.h), mw = l.w * sc, mh = l.h * sc;
    return { x: 16, y: viewBottom - mh - 2, w: mw, h: mh, sc: sc };
  }
  var miniCache = null;
  function drawMinimap(fade) {
    var l = current.level, r = miniRect();
    ctx.globalAlpha = 0.92 * fade; ctx.fillStyle = colors.card;
    ctx.beginPath(); ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8); ctx.fill();
    // The map only changes when arrows do, so it is drawn once per change and reused.
    var key = [current.id, state.launches, hintArrow, colors.name, Math.round(r.w)].join();
    if (!miniCache || miniCache.key !== key) {
      var cv = miniCache && miniCache.canvas || document.createElement('canvas'), mc = cv.getContext('2d');
      cv.width = Math.ceil(r.w * 2); cv.height = Math.ceil(r.h * 2);
      mc.setTransform(2, 0, 0, 2, 0, 0); mc.lineCap = 'round'; mc.lineWidth = Math.max(1, r.sc * 0.35);
      l.arrows.forEach(function (a) {
        if (state.removed[a.id]) return;
        mc.strokeStyle = hintArrow === a.id ? colors.hint : arrowColor(a);
        mc.beginPath();
        a.cells.forEach(function (c, i) { mc[i ? 'lineTo' : 'moveTo']((c[0] + 0.5) * r.sc, (c[1] + 0.5) * r.sc); });
        if (a.cells.length === 1) mc.lineTo((a.cells[0][0] + 0.6) * r.sc, (a.cells[0][1] + 0.5) * r.sc);
        mc.stroke();
      });
      miniCache = { key: key, canvas: cv };
    }
    ctx.globalAlpha = fade; ctx.drawImage(miniCache.canvas, r.x, r.y, r.w, r.h);
    var vx = Math.max(0, -ox / cs), vy = Math.max(0, (viewTop - oy) / cs), ex = Math.min(l.w, (vw - ox) / cs), ey = Math.min(l.h, (viewBottom - oy) / cs);
    ctx.globalAlpha = fade; ctx.strokeStyle = colors.hint; ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + vx * r.sc, r.y + vy * r.sc, (ex - vx) * r.sc, (ey - vy) * r.sc);
    ctx.globalAlpha = 1;
  }
  var GOLD = '#ffd23f', NIGHT_DISC = '#1d2350', SKY_GOLD = '#f2b100';
  function disc(c, r) {
    ctx.globalAlpha = 1; ctx.fillStyle = NIGHT_DISC; ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill(); ctx.stroke();
  }
  // The star: a small piece of night sky with a twinkling star and a ring that keeps calling out.
  function drawStar(c, r, now) {
    var t = reduced ? 0 : now / 1000, wave = (t % 2.2) / 2.2;
    if (!reduced) {
      ctx.globalAlpha = (1 - wave) * 0.7; ctx.strokeStyle = SKY_GOLD; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, r * (1 + wave * 0.8), 0, 7); ctx.stroke();
    }
    disc(c, r);
    var size = r * 0.72 * (1 + 0.1 * Math.sin(t * 3.2));
    ctx.fillStyle = GOLD; ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5 + 0.14 * Math.sin(t * 0.9), d = i % 2 ? size * 0.44 : size;
      ctx[i ? 'lineTo' : 'moveTo'](c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
    }
    ctx.closePath(); ctx.fill();
  }
  // The moon: a sleeping crescent, gently rocking, with a little z drifting up.
  function drawMoon(c, r, now) {
    var t = reduced ? 0 : now / 1000;
    disc(c, r);
    var m = r * 0.64, tilt = -0.45 + 0.13 * Math.sin(t * 1.3), arcEnd = 73.7 * Math.PI / 180;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(tilt);
    ctx.fillStyle = GOLD; ctx.beginPath();
    ctx.arc(0, 0, m, Math.PI / 4, Math.PI * 1.75);
    ctx.arc(m * 0.5, 0, m * 0.737, -arcEnd, arcEnd, true);
    ctx.closePath(); ctx.fill(); ctx.restore();
    if (!reduced) {
      ctx.fillStyle = NIGHT_DISC; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var k = 0; k < 2; k++) {
        var p = ((t / 2.6) + k * 0.5) % 1, size = Math.round(r * (0.55 + p * 0.35));
        ctx.font = 'italic 700 ' + size + 'px Figtree,system-ui,sans-serif';
        ctx.globalAlpha = Math.sin(p * Math.PI);
        var zx = c.x + r * (0.75 + p * 0.5), zy = c.y - r * (0.75 + p * 1.05);
        ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy);
      }
      ctx.globalAlpha = 1;
    }
  }
  // When a star leaves, a spark flies along the thread and the moon wakes with a burst.
  function drawWakes(now) {
    wakes = wakes.filter(function (w) {
      var t = (now - w.start) / 900;
      if (t >= 1) return false;
      var fly = Math.min(1, t / 0.5), x = w.from.x + (w.to.x - w.from.x) * fly, y = w.from.y + (w.to.y - w.from.y) * fly;
      if (t < 0.5) {
        ctx.globalAlpha = 1; ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(x, y, cs * 0.12, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(x, y, cs * 0.22, 0, 7); ctx.fill();
      } else {
        var q = (t - 0.5) / 0.5;
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(w.to.x, w.to.y, cs * (0.3 + q * 0.75), 0, 7); ctx.stroke();
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4, r1 = cs * (0.3 + q * 0.5), r2 = r1 + cs * 0.14;
          ctx.beginPath(); ctx.moveTo(w.to.x + Math.cos(a) * r1, w.to.y + Math.sin(a) * r1); ctx.lineTo(w.to.x + Math.cos(a) * r2, w.to.y + Math.sin(a) * r2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      return true;
    });
  }
  /* ---------- Season drawing ---------- */
  var ICONS = {
    winter: '<svg viewBox="0 0 24 24" fill="none" stroke="#2f8fd0" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.300 7l17.400 10M20.700 7 3.300 17M12 6 9.500 3.700M12 6l2.500-2.300M12 18l-2.500 2.300M12 18l2.500 2.300"/></svg>',
    summer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffb300"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#ff8a00" stroke-width="2" stroke-linecap="round"/></svg>',
    spring: '<svg viewBox="0 0 24 24"><g fill="#f06ca8"><circle cx="12" cy="6" r="4"/><circle cx="18" cy="11" r="4"/><circle cx="15.500" cy="18" r="4"/><circle cx="8.500" cy="18" r="4"/><circle cx="6" cy="11" r="4"/></g><circle cx="12" cy="13" r="3.200" fill="#ffd23f"/></svg>',
    autumn: '<svg viewBox="0 0 24 24" fill="none" stroke="#a8591a" stroke-width="2" stroke-linecap="round"><path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6"/></svg>'
  };
  var popCount = {}, shownBadge = '', activeScene = null;
  function drawBadge() {
    var fx = current ? E.effectsOf(current.level) : [], b = $('seasonBadge');
    b.hidden = !fx.length;
    if (!fx.length) { shownBadge = ''; return; }
    var names = { winter: '20% chance per launch that arrows freeze', summer: '25% chance per launch that tiles burn', autumn: '50% chance per launch of wind', spring: ' flowers remaining' };
    var keys = SEASON_ORDER.filter(function (k) { return fx.indexOf(k) >= 0; }), label = function (k) { return k === 'winter' ? '20%' : k === 'summer' ? '25%' : k === 'autumn' ? '50%' : flowersLeft() + '/' + current.level.flowers.length; };
    var signature = keys.join();
    if (signature !== shownBadge) {
      b.innerHTML = keys.map(function (k) { return '<span class="chip" data-tip="' + k + '" role="img">' + ICONS[k] + '<span class="val"></span></span>'; }).join('');
      shownBadge = signature;
    }
    // Text updates in place, so a popping symbol keeps animating.
    keys.forEach(function (k) {
      var chip = b.querySelector('[data-tip="' + k + '"]'), text = label(k), val = chip.querySelector('.val');
      if (val.textContent !== text) val.textContent = text;
      chip.setAttribute('aria-label', k === 'spring' ? text + names.spring : names[k]);
    });

  }
  // Hovering a season symbol, or holding it on a phone, explains what it does.
  var TIPS = {
    winter: ['Freeze: 20%', 'After each launch, there is a 20% chance that 1 to 5 arrows freeze. They thaw after 3 to 5 launches, or hit them with another arrow.'],
    spring: ['Flowers remaining', 'Flowers block arrows, and hitting one costs a life. After each launch, a bee carries one away.'],
    summer: ['Fire: 25%', 'After each launch, there is a 25% chance that 1 to 5 tiles burn for 2 to 4 launches. Hitting fire costs a life.'],
    autumn: ['Wind: 50%', 'After each launch, there is a 50% chance of wind. Arrows may then spin around their tails if there is room.']
  };
  var tipTimer = null, tipChip = null;
  function showTip(chip) {
    var d = TIPS[chip.getAttribute('data-tip')], tip = $('tip');
    if (!d) return;
    tipChip = chip;
    tip.innerHTML = '<b>' + d[0] + '</b>' + d[1];
    tip.hidden = false;
    window.UnwindI18n.flush();
    var r = chip.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(12, Math.min(vw - w - 12, r.left)) + 'px';
    tip.style.top = (r.bottom + 6) + 'px';
    track('season_tip', { effect: chip.getAttribute('data-tip') });
  }
  function hideTip() { clearTimeout(tipTimer); $('tip').hidden = true; }
  $('seasonBadge').addEventListener('pointerover', function (ev) {
    var c = ev.target.closest && ev.target.closest('.chip');
    if (c && ev.pointerType === 'mouse') showTip(c);
  });
  $('seasonBadge').addEventListener('pointerout', function (ev) { if (ev.pointerType === 'mouse') hideTip(); });
  // On touch screens, a press shows the explanation and another press hides it.
  $('seasonBadge').addEventListener('pointerup', function (ev) {
    var c = ev.target.closest && ev.target.closest('.chip');
    if (!c || ev.pointerType === 'mouse') return;
    if (!$('tip').hidden && tipChip === c) { hideTip(); return; }
    showTip(c);
  });
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse' || $('tip').hidden) return;
    if (!(ev.target.closest && ev.target.closest('#seasonBadge .chip'))) hideTip();
  });
  $('seasonBadge').addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  // When an event happens, its symbol pops up.
  function popSymbol(effect) {
    var chip = $('seasonBadge').querySelector('[data-tip="' + effect + '"]');
    if (!chip) return;
    chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
    setTimeout(function () { chip.classList.remove('pop'); }, 1000);
    popCount[effect] = (popCount[effect] || 0) + 1;
  }
  function applySeason(season) {
    activeScene = season;
    document.body.classList.toggle('season', !!season);
    $('sun').hidden = !!season;
    var bg = $('seasonBg');
    bg.hidden = !season;
    if (season && bg.getAttribute('data-season') !== season) { bg.setAttribute('data-season', season); bakeScene(bg, season); }
  }
  // A scene is split into stacked pieces, each cropped to what it shows. Moving pieces then glide on their own
  // layer, so the browser never has to repaint the whole picture. It looks identical, in the same stacking order.
  var SCENE_MOVERS = '.drift,.flit,.twinkle,.crab,.wave,.sway,.squirrel';
  function bakeScene(bg, season) {
    bg.innerHTML = seasonScene(season);
    var src = bg.querySelector('svg');
    if (!src || window.unwindNoBake) return;
    bg.classList.add('baking');
    var inv = src.getScreenCTM().inverse(), box = bg.getBoundingClientRect(), scale = Math.abs(src.getScreenCTM().a) || 1;
    var chunks = [], last = null, stars = null;
    Array.prototype.slice.call(src.children).forEach(function (el) {
      var defs = el.tagName.toLowerCase() === 'defs';
      var mover = !defs && el.matches(SCENE_MOVERS) ? el.getAttribute('class') : '';
      var inner = !defs && !mover && el.querySelector(SCENE_MOVERS);
      if (defs) { chunks.unshift({ defs: true, els: [el] }); return; }
      // Stars never overlap, so a run of them shares one layer per twinkle timing.
      if (mover.indexOf('twinkle') === 0) {
        if (!stars) stars = {};
        if (stars[mover]) { stars[mover].els.push(el); return; }
        last = stars[mover] = { cls: mover, inner: false, els: [el] };
        chunks.push(last);
        return;
      }
      stars = null;
      if (last && !inner && !last.inner && last.cls === mover && !mover) { last.els.push(el); return; }
      last = { cls: mover, inner: !!inner, els: [el] };
      chunks.push(last);
    });
    var made = document.createDocumentFragment();
    chunks.forEach(function (c) {
      var root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      root.setAttribute('aria-hidden', 'true');
      if (c.defs) {
        root.setAttribute('style', 'position:absolute;width:0;height:0');
        root.appendChild(c.els[0].cloneNode(true)); made.appendChild(root); return;
      }
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      c.els.forEach(function (el) { var r = el.getBoundingClientRect(); if (!r.width && !r.height) return; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
      if (x0 === Infinity) return;
      x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
      var a = new DOMPoint(x0, y0).matrixTransform(inv), b = new DOMPoint(x1, y1).matrixTransform(inv);
      root.setAttribute('viewBox', [a.x, a.y, b.x - a.x, b.y - a.y].join(' '));
      root.setAttribute('preserveAspectRatio', 'none');
      root.setAttribute('style', 'position:absolute;inset:auto;overflow:visible;left:' + (x0 - box.left) + 'px;top:' + (y0 - box.top) + 'px;width:' + (x1 - x0) + 'px;height:' + (y1 - y0) + 'px;--s:' + scale.toFixed(3));
      if (c.cls) { root.setAttribute('class', 'mover ' + c.cls); root.style.cssText += ';' + (c.els[0].getAttribute('style') || ''); }
      c.els.forEach(function (el) { var copy = el.cloneNode(true); if (c.cls) { copy.removeAttribute('class'); copy.removeAttribute('style'); } root.appendChild(copy); });
      made.appendChild(root);
    });
    bg.innerHTML = '';
    bg.appendChild(made);
    bg.classList.remove('baking');
  }
  var bakeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(bakeTimer);
    bakeTimer = setTimeout(function () { var bg = $('seasonBg'), k = bg.getAttribute('data-season'); if (k && !bg.hidden) bakeScene(bg, k); }, 180);
  });
  function seededRows(n, seed, make) {
    var r = E.rng32(seed), out = '';
    for (var i = 0; i < n; i++) out += make(r, i);
    return out;
  }
  function svgWrap(inner) { return '<svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + inner + '</svg>'; }
  function gradient(id, stops, horizontal) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (horizontal ? 1 : 0) + '" y2="' + (horizontal ? 0 : 1) + '">' + stops.map(function (st) { return '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"/>'; }).join('') + '</linearGradient>';
  }
  function cloud(x, y, k, o) { return '<g class="drift' + (x % 2 ? ' b' : '') + '" opacity="' + (o || 0.9) + '"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')" fill="#fff"><ellipse cx="0" cy="0" rx="46" ry="15"/><circle cx="-16" cy="-10" r="16"/><circle cx="10" cy="-15" r="21"/><circle cx="32" cy="-6" r="13"/></g></g>'; }
  function seasonScene(season) {
    if (season === 'winter') {
      var pine = function (x, y, k) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><rect x="-5" y="-4" width="10" height="20" fill="#4a3528"/><path d="M0-96 20-66H9L30-36H13L38-2H-38L-13-36H-30L-9-66H-20Z" fill="#1f5a50"/><path d="M0-96 20-66H9L30-36H13L38-2H0Z" fill="#17473f"/><path d="M0-96 13-76 3-79-3-73-13-76ZM-22-50-9-54-3-47 7-53 22-50 13-36-3-41-13-36ZM-31-14-14-20-3-12 11-20 31-14 38-2H-38Z" fill="#fff"/></g>'; };
      var man = function (x, y, k, b2) { return '<g class="sway' + (b2 ? ' b' : '') + '"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><ellipse cy="10" rx="32" ry="7" fill="#b9d3e6" opacity=".8"/><circle cy="-16" r="26" fill="url(#wSnow)"/><circle cy="-52" r="19" fill="url(#wSnow)"/><circle cy="-80" r="14" fill="url(#wSnow)"/><circle cx="-5" cy="-83" r="2" fill="#1c2238"/><circle cx="5" cy="-83" r="2" fill="#1c2238"/><path d="M0-79 15-75 0-73Z" fill="#f08020"/><path d="M-6-74Q0-70 6-74" fill="none" stroke="#1c2238" stroke-width="1.500" stroke-dasharray="1.500 2"/><path d="M-14-68Q0-61 14-68V-62Q0-55-14-62Z" fill="#c8323c"/><path d="M6-62h8v20h-8Z" fill="#c8323c"/><path d="M6-48h8M6-44h8" stroke="#fff" stroke-width="1.500"/><rect x="-13" y="-108" width="26" height="17" rx="1" fill="#22243a"/><rect x="-13" y="-96" width="26" height="4" fill="#c8323c"/><rect x="-19" y="-92" width="38" height="4" rx="2" fill="#22243a"/><circle cy="-53" r="2.200" fill="#1c2238"/><circle cy="-43" r="2.200" fill="#1c2238"/><circle cy="-22" r="2.400" fill="#1c2238"/><path d="M-18-54-44-68M-34-63-42-58M-34-63-40-72M18-54 44-70M34-64 42-60M34-64 40-74" fill="none" stroke="#5a3e2a" stroke-width="2.800" stroke-linecap="round"/></g></g>'; };
      var cabin = function (x, y, k) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><rect x="-30" y="-30" width="60" height="30" fill="#6b4630"/><path d="M-30-20H30M-30-10H30" stroke="#4f3222" stroke-width="1.500"/><rect x="-16" y="-23" width="12" height="12" fill="#ffd27a"/><rect x="5" y="-23" width="12" height="12" fill="#ffd27a"/><circle cx="-10" cy="-17" r="17" fill="#ffd27a" opacity=".22"/><circle cx="11" cy="-17" r="17" fill="#ffd27a" opacity=".22"/><path d="M-40-28 0-60 40-28Z" fill="#fff"/><path d="M-40-28 0-60 0-52-34-26Z" fill="#d7e8f3"/><rect x="16" y="-58" width="8" height="18" fill="#5a3e2a"/><rect x="14" y="-61" width="12" height="4" fill="#fff"/></g>'; };
      // A large log cabin, close up, that fills the middle of the screen and gives the board a calm, darker backdrop.
      var bigHome = function (x, y) {
        var logs = '';
        for (var i = 0; i < 9; i++) { var ly = -34 * (i + 1) + 2; logs += '<rect x="-205" y="' + ly + '" width="410" height="32" rx="14" fill="' + (i % 2 ? '#74492d' : '#7d5033') + '"/><circle cx="-205" cy="' + (ly + 16) + '" r="15" fill="#b98a5c"/><circle cx="-205" cy="' + (ly + 16) + '" r="8" fill="#94673f"/><circle cx="205" cy="' + (ly + 16) + '" r="15" fill="#b98a5c"/><circle cx="205" cy="' + (ly + 16) + '" r="8" fill="#94673f"/>'; }
        var win = function (wx) { return '<circle cx="' + wx + '" cy="-188" r="82" fill="#ffd27a" opacity=".2"/><rect x="' + (wx - 42) + '" y="-232" width="84" height="88" rx="6" fill="#4b2d19"/><rect x="' + (wx - 34) + '" y="-224" width="68" height="72" rx="3" fill="#ffd98a"/><path d="M' + wx + '-224V-152M' + (wx - 34) + '-188H' + (wx + 34) + '" stroke="#4b2d19" stroke-width="6"/><path d="M' + (wx - 50) + '-146H' + (wx + 50) + '" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'; };
        return '<g transform="translate(' + x + ' ' + y + ')">' +
          '<rect x="-205" y="-310" width="410" height="310" fill="#5b3820"/>' + logs +
          '<rect x="90" y="-505" width="56" height="130" fill="#6d4a3a"/><path d="M90-470H146M90-435H146M118-505V-470M104-470V-435M132-470V-435" stroke="#553628" stroke-width="3"/><rect x="82" y="-518" width="72" height="20" rx="9" fill="#fff"/>' +
          '<path d="M-270-290 0-484 270-290Z" fill="#4a3a48"/><path d="M-214-310H214M-160-350H160M-104-390H104M-50-430H50" stroke="#3a2c39" stroke-width="5"/>' +
          // Only a little snow, along the ridge and the eaves, so the roof stays dark behind the board.
          '<path d="M-285-280Q-286-300-262-304L-200-348Q-190-322-226-300-200-302-180-296L180-296Q200-302 226-300 190-322 200-348L262-304Q286-300 285-280 285-262 262-266 240-252 218-266 195-252 172-266 150-254 130-266H-130Q-150-254-172-266-195-252-218-266-240-252-262-266-285-262-285-280Z" fill="#fff"/>' +
          '<path d="M-82-426-18-484Q0-496 18-484L82-426Q58-430 44-416 26-434 8-420-10-438-26-418-48-434-82-426Z" fill="#fff"/>' +
          win(-120) + win(120) +
          '<rect x="-44" y="-162" width="88" height="162" rx="8" fill="#3f2513"/><rect x="-36" y="-154" width="72" height="154" rx="5" fill="#8c3b2d"/><path d="M-12-154V0M12-154V0" stroke="#6f2d21" stroke-width="3"/><circle cx="22" cy="-72" r="5" fill="#ffd23f"/><circle cy="-122" r="18" fill="#2c7a52"/><circle cy="-122" r="8" fill="#8c3b2d"/><circle cy="-140" r="4" fill="#c8323c"/>' +
          '<path d="M-205-6Q-120-20-60-8 0 4 60-8 120-20 205-6V6H-205Z" fill="#fff"/></g>';
      };
      var stars = seededRows(36, 11, function (r, i) { return '<circle class="twinkle' + (['', ' b', ' c'][i % 3]) + '" cx="' + Math.round(r() * 1000) + '" cy="' + Math.round(r() * 170) + '" r="' + (0.8 + r() * 1.4).toFixed(1) + '" fill="#fff"/>'; });
      return svgWrap('<defs>' + gradient('wSky', [[0, '#35598f'], [0.45, '#88b3d8'], [1, '#e4f2fa']]) + gradient('wFar', [[0, '#c5d8ea'], [1, '#8fb0cf']]) + gradient('wSnow', [[0, '#ffffff'], [1, '#cfe3f0']]) + gradient('wHill', [[0, '#ffffff'], [1, '#d6e8f4']]) + gradient('wLake', [[0, '#a9d3ea'], [1, '#e0f1f9']]) + '</defs>' +
        '<rect width="1000" height="800" fill="url(#wSky)"/>' + stars +
        '<circle cx="705" cy="118" r="34" fill="#fbfdff" opacity=".9"/><circle cx="705" cy="118" r="60" fill="#fff" opacity=".18"/>' +
        '<path d="M0 260 130 130 230 225 350 95 480 235 610 120 730 230 860 110 1000 245V400H0Z" fill="url(#wFar)"/><path d="M130 130 103 158 123 150 142 168 158 150ZM350 95 318 130 342 120 362 142 382 124ZM610 120 582 150 604 142 624 158 640 146ZM860 110 830 142 852 134 872 150 890 138Z" fill="#fff"/>' +
        '<path d="M0 305Q170 240 360 292T700 270 1000 295V800H0Z" fill="url(#wHill)"/>' +
        [40, 120, 215, 790, 860, 930, 985].map(function (x, i) { return pine(x, 300 - (i % 3) * 8, 0.5 + (i % 3) * 0.08); }).join('') +
        pine(250, 560, 1.5) + pine(760, 560, 1.5) + pine(120, 610, 1.9) + pine(885, 610, 1.9) + bigHome(500, 640) +
        '<path d="M0 668Q250 628 500 650T1000 640V800H0Z" fill="url(#wHill)"/><path d="M455 646Q470 700 400 800H610Q530 700 545 646Z" fill="#c9deec" opacity=".75"/>' +
        pine(30, 730, 1.3) + pine(975, 725, 1.25) +
        man(345, 722, 0.82, false) + man(655, 720, 0.78, true) + man(205, 735, 0.95, true) + man(800, 735, 0.92, false));
    }
    if (season === 'spring') {
      var bloom = function (x, y, k, c) { var o = ''; for (var i = 0; i < 5; i++) { var a = i * 1.257 - 1.57; o += '<circle cx="' + (Math.cos(a) * k).toFixed(1) + '" cy="' + (Math.sin(a) * k).toFixed(1) + '" r="' + (k * 0.72).toFixed(1) + '" fill="' + c + '"/>'; } return '<g transform="translate(' + x + ' ' + y + ')"><path d="M0 ' + k + 'V' + (k * 5) + '" stroke="#2f8a3f" stroke-width="' + Math.max(1, k * 0.35).toFixed(1) + '"/>' + o + '<circle r="' + (k * 0.55).toFixed(1) + '" fill="#ffd23f"/></g>'; };
      // The river's left and right edge at each height, so nothing grows in the water.
      var RIVER = [[344, 532, 563], [368, 527, 587], [392, 529, 646], [416, 539, 682], [440, 553, 704], [464, 563, 716], [488, 564, 723], [512, 552, 726], [536, 525, 725], [560, 493, 718], [584, 465, 707], [608, 443, 693], [632, 428, 679], [656, 420, 665], [680, 414, 653], [704, 413, 647], [728, 414, 643], [752, 417, 646], [776, 421, 651], [800, 430, 660]];
      var inRiver = function (x, y, margin) {
        return RIVER.some(function (row) { return Math.abs(row[0] - y) <= 24 && x > row[1] - margin && x < row[2] + margin; });
      };
      // Flowers grow on the upper fields, small with distance.
      var meadow = seededRows(230, 77, function (r) {
        var y = 362 + Math.pow(r(), 1.3) * 190, x = Math.round(r() * 1000), k = +(1.2 + (y - 362) / 72).toFixed(1), c = ['#f06ca8', '#ffcf33', '#ffffff', '#e8485e', '#b184ea', '#ff9f43'][Math.floor(r() * 6)];
        if (y < 340 + (x > 500 ? (1000 - x) * 0.02 : x * 0.02) || inRiver(x, y + k * 5, 16) || inRiver(x, y, 16)) return '';
        return bloom(x, Math.round(y), k, c);
      });
      var leafy = function (x, y, k, c, c2, b2) { return '<g class="sway' + (b2 ? ' b' : '') + '"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><ellipse cy="3" rx="44" ry="9" fill="#3f8f3a" opacity=".35"/><path d="M-8 0-5-58H5L9 0Z" fill="#6a4426"/><path d="M-3-38-24-60M3-44 24-66" stroke="#6a4426" stroke-width="4" stroke-linecap="round"/><circle cy="-88" r="36" fill="' + c + '"/><circle cx="-30" cy="-68" r="25" fill="' + c + '"/><circle cx="30" cy="-70" r="26" fill="' + c + '"/><circle cx="-10" cy="-98" r="18" fill="' + c2 + '"/><circle cx="20" cy="-78" r="13" fill="' + c2 + '"/><circle cx="-28" cy="-72" r="11" fill="' + c2 + '"/></g></g>'; };
      var blossom = function (x, y, k) { return '<g class="sway"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><path d="M-7 0-4-62H4L8 0Z" fill="#6a4426"/><path d="M-2-40-25-65M2-46 26-72" stroke="#6a4426" stroke-width="4" stroke-linecap="round"/><g fill="#ffb7d5"><circle cy="-88" r="34"/><circle cx="-30" cy="-70" r="24"/><circle cx="30" cy="-74" r="25"/><circle cx="-12" cy="-112" r="20"/><circle cx="16" cy="-108" r="20"/></g><g fill="#ffd9e8"><circle cx="-9" cy="-94" r="14"/><circle cx="17" cy="-82" r="11"/><circle cx="-27" cy="-74" r="10"/></g></g></g>'; };
      var fly = function (x, y, c, d) { return '<g class="flit" style="animation-delay:' + d + 's"><g transform="translate(' + x + ' ' + y + ')"><path d="M0 0C-10-14-20-9-15 0-20 8-8 10 0 0Z" fill="' + c + '"/><path d="M0 0C10-14 20-9 15 0 20 8 8 10 0 0Z" fill="' + c + '"/><path d="M0-6V6" stroke="#2a2008" stroke-width="1.500"/></g></g>'; };
      return svgWrap('<defs>' + gradient('sSky', [[0, '#5eb6ea'], [0.6, '#b9e5f6'], [1, '#effae2']]) + gradient('sFar', [[0, '#6d84ad'], [1, '#a9c4cf']]) + gradient('sMid', [[0, '#7fa88f'], [1, '#9ccc8e']]) + gradient('sField1', [[0, '#b7e68a'], [1, '#90d267']]) + gradient('sField2', [[0, '#8fd465'], [1, '#62b94a']]) + gradient('sRiver', [[0, '#bcecf8'], [0.5, '#6fcbea'], [1, '#3aa7d6']]) + '</defs>' +
        '<rect width="1000" height="800" fill="url(#sSky)"/><circle cx="790" cy="95" r="44" fill="#fff6c2"/><circle cx="790" cy="95" r="78" fill="#fff6c2" opacity=".28"/>' + cloud(180, 80, 1.2) + cloud(520, 54, 0.8, 0.8) + cloud(690, 150, 0.7, 0.8) + cloud(90, 170, 0.6, 0.7) +
        '<path d="M-20 310 110 165 200 250 330 92 460 245 545 170 670 72 800 235 900 160 1020 300V420H-20Z" fill="url(#sFar)"/>' +
        '<path d="M330 92 298 132 322 122 343 146 362 124 376 130ZM670 72 636 116 660 104 684 130 702 108 716 116ZM110 165 88 190 108 182 124 196 136 186ZM900 160 878 184 898 176 916 190 928 182Z" fill="#fff"/>' +
        '<path d="M-20 335 160 230 340 320 520 240 730 325 880 245 1020 330V450H-20Z" fill="url(#sMid)"/>' +
        '<path d="M0 355Q220 300 470 348T1000 320V800H0Z" fill="url(#sField1)"/>' +
        '<g fill="none" stroke="#7fc25a" stroke-width="2.500" opacity=".65"><path d="M0 395Q230 345 450 388"/><path d="M0 425Q230 372 440 420"/><path d="M0 458Q200 410 415 455"/><path d="M640 380Q830 345 1000 362"/><path d="M660 415Q830 382 1000 398"/><path d="M675 452Q830 420 1000 436"/></g>' +
        '<path d="M0 500Q230 450 500 500T1000 470V800H0Z" fill="url(#sField2)"/>' +
        '<path d="M535 344C500 400 590 440 560 505S360 590 430 800H660C590 650 760 590 720 480S590 410 560 344Z" fill="url(#sRiver)"/>' +
        '<path d="M535 344C500 400 590 440 560 505S360 590 430 800" fill="none" stroke="#3f8f3a" stroke-width="5" opacity=".55"/><path d="M560 344C590 410 760 480 720 480" fill="none" stroke="none"/><path d="M660 800C590 650 760 590 720 480S590 410 560 344" fill="none" stroke="#3f8f3a" stroke-width="5" opacity=".55"/>' +
        '<g class="wave"><path d="M552 400Q590 430 585 470M630 520Q570 570 530 620M580 640Q540 700 540 780" fill="none" stroke="#e8fbff" stroke-width="3.500" stroke-linecap="round"/></g><g class="wave b"><path d="M625 470Q660 510 640 550M480 640Q460 700 480 770M660 620Q620 680 620 740" fill="none" stroke="#d3f4fc" stroke-width="2.500" stroke-linecap="round"/></g>' +
        '<g stroke="#8a5e38" stroke-width="4" stroke-linecap="round"><path d="M40 505V470M95 498V463M150 492V457M205 487V452M260 484V449"/><path d="M28 480 275 458M28 492 275 470" stroke-width="2.500"/></g>' +
        meadow + blossom(290, 448, 0.8) + blossom(790, 440, 0.75) +
        // A wood fills the lower banks on both sides of the river.
        leafy(800, 575, 0.95, '#3f9a45', '#5cb85a') + leafy(205, 580, 1, '#4aa650', '#6cc465', true) + blossom(375, 590, 0.95) + blossom(100, 610, 1.15) + leafy(735, 615, 1.05, '#58ad4a', '#7cc768', true) + leafy(895, 630, 1.25, '#3f9a45', '#5cb85a') +
        leafy(300, 640, 1.2, '#3f9a45', '#5cb85a', true) + blossom(725, 672, 1.25) + leafy(385, 680, 1.15, '#58ad4a', '#7cc768') + leafy(30, 690, 1.45, '#4aa650', '#6cc465', true) + blossom(205, 712, 1.45) +
        leafy(815, 725, 1.5, '#4aa650', '#6cc465', true) + leafy(345, 760, 1.4, '#3f9a45', '#5cb85a') + leafy(705, 770, 1.45, '#3f9a45', '#5cb85a') + leafy(940, 780, 1.65, '#58ad4a', '#7cc768') + leafy(90, 785, 1.65, '#3f9a45', '#5cb85a', true) +
        fly(365, 500, '#ff8fb8', 0) + fly(650, 620, '#ffcf33', 1.4) + fly(480, 690, '#b184ea', 2.6) + fly(610, 700, '#ff9f43', 0.8));
    }
    if (season === 'summer') {
      var palm = function (x, y, k, flip) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -k : k) + ' ' + k + ')"><path d="M0 0C-4-80 16-160 58-230L72-226C36-160 24-80 26 0Z" fill="#8a5a32"/><path d="M6-30 28-36M6-62 30-68M12-95 36-100M22-128 45-132M34-160 56-164M46-190 66-194" stroke="#6a4324" stroke-width="3"/><g class="sway"><g transform="translate(66 -232)"><path d="M0 0C-50-46-112-30-142 20-96-5-48-8 0 0Z" fill="#279a58"/><path d="M0 0C-38-70-100-82-138-54-90-52-40-34 0 0Z" fill="#35b56a"/><path d="M0 0C-4-66 40-110 88-108 52-82 22-44 0 0Z" fill="#2aa35e"/><path d="M0 0C42-48 106-44 138 0 92-20 44-20 0 0Z" fill="#35b56a"/><path d="M0 0C42-6 88 18 104 66 70 36 34 16 0 0Z" fill="#279a58"/><path d="M0 0C-34 8-70 42-76 82-50 48-24 22 0 0Z" fill="#1f8a4c"/><circle cx="-7" cy="10" r="9" fill="#6a4324"/><circle cx="9" cy="12" r="9" fill="#7a5230"/></g></g></g>'; };
      var glints = seededRows(46, 23, function (r, i) { var y = 230 + r() * 225; return '<rect class="twinkle' + (['', ' b', ' c'][i % 3]) + '" x="' + Math.round(r() * 1000) + '" y="' + Math.round(y) + '" width="' + Math.round(10 + r() * 26) + '" height="2.500" rx="1.200" fill="#fff" opacity=".8"/>'; });
      var grains = seededRows(120, 29, function (r) { return '<circle cx="' + Math.round(r() * 1000) + '" cy="' + Math.round(490 + r() * 300) + '" r="' + (0.7 + r() * 1.3).toFixed(1) + '" fill="#c79a55" opacity=".55"/>'; });
      var gull = function (x, y, k, d) { return '<g class="flit" style="animation-delay:' + d + 's"><path transform="translate(' + x + ' ' + y + ') scale(' + k + ')" d="M-18 0Q-9-11 0 0Q9-11 18 0" fill="none" stroke="#33506b" stroke-width="2.600" stroke-linecap="round"/></g>'; };
      var umbrella = function (x, y, k, a, b2) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><ellipse cx="4" cy="4" rx="58" ry="10" fill="#b8843f" opacity=".4"/><path d="M0 2V-108" stroke="#f7f1e3" stroke-width="5"/><path d="M-72-90C-58-142 58-142 72-90Z" fill="' + a + '"/><path d="M-44-90C-38-142 -14-136 0-122 14-136 38-142 44-90 30-100 14-100 0-90-14-100-30-100-44-90Z" fill="' + b2 + '"/><circle cy="-124" r="4" fill="#fff"/></g>'; };
      // A lounger seen from the side: seat low on the sand, backrest leaning up and away.
      var chair = function (x, y, k, c, c2, flip) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -k : k) + ' ' + k + ')"><ellipse cx="4" cy="4" rx="66" ry="8" fill="#b8843f" opacity=".4"/><path d="M-52-16-52 2M-8-16-8 2M30-16 30 2" stroke="#8a5a32" stroke-width="5" stroke-linecap="round"/><path d="M-62-22H36L70-74" fill="none" stroke="#8a5a32" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M-60-24H34L66-72" fill="none" stroke="' + c + '" stroke-width="12" stroke-linejoin="round"/><path d="M-40-24H-24M-8-24H8M24-24H34L37-29M49-47 57-59" fill="none" stroke="' + c2 + '" stroke-width="12"/><path d="M58-78Q72-86 78-72 74-62 62-66Z" fill="#fff5dc" stroke="#d9b98a" stroke-width="1.500"/></g>'; };
      // A small flat crab in the same simple style as the rest of the beach. Its legs scuttle and its pincers open and close.
      var crab = function (x, y, k, dur, delay, b2) {
        var c = '#e2674f', c2 = '#b84a3a', side = function (s2, cls) {
          // Three legs, each bending up at a knee and stepping down to a pointed foot, in turn.
          var legs = [[15, -1, 24, -7, 31, 8], [14, 3, 22, -2, 27, 12], [11, 7, 18, 3, 21, 15]].map(function (g, i) {
            return '<g class="crableg' + ((i % 2 === 0) === !cls ? ' b' : '') + '"><path d="M' + g[0] + ' ' + g[1] + 'L' + g[2] + ' ' + g[3] + 'L' + g[4] + ' ' + g[5] + '" fill="none" stroke="' + c2 + '" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></g>';
          }).join('');
          return '<g transform="scale(' + s2 + ' 1)">' + legs +
            '<path d="M13-3 22-9" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/><g class="crabclaw' + cls + '"><path d="M22-9C18-16 22-23 30-23 28-19 28-16 29-15 26-14 24-12 22-9Z" fill="' + c + '"/></g><path d="M22-9C28-8 34-12 33-20 31-17 29-16 27-15 25-13 23-11 22-9Z" fill="' + c + '"/></g>';
        };
        return '<g class="crab" style="animation-duration:' + dur + 's;animation-delay:' + delay + 's;--d:' + dur + 's;--dl:' + delay + 's"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><ellipse cy="15" rx="22" ry="4" fill="#b8843f" opacity=".35"/>' + side(-1, b2 ? ' b' : '') + side(1, b2 ? '' : ' b') +
          '<path d="M-5-9V-16M5-9V-16" stroke="' + c2 + '" stroke-width="2.200"/><circle cx="-5" cy="-17" r="2.800" fill="#2a1a12"/><circle cx="5" cy="-17" r="2.800" fill="#2a1a12"/>' +
          '<ellipse rx="17" ry="12" fill="' + c + '"/><path d="M-16 3C-10 12 10 12 16 3 10 7-10 7-16 3Z" fill="' + c2 + '" opacity=".5"/></g></g>';
      };
      return svgWrap('<defs>' + gradient('uSky', [[0, '#2fa6e0'], [0.55, '#8ddcf2'], [1, '#fff3c6']]) + gradient('uSea', [[0, '#1aa6d0'], [0.45, '#1fc4d3'], [1, '#7ceee0']]) + gradient('uSand', [[0, '#fff0bd'], [1, '#eec27a']]) + gradient('uBall', [[0, '#ff6b6b'], [1, '#d9404e']]) + '</defs>' +
        '<rect width="1000" height="800" fill="url(#uSky)"/><circle cx="745" cy="96" r="52" fill="#fff4a8"/><circle cx="745" cy="96" r="82" fill="#fff4a8" opacity=".35"/><circle cx="745" cy="96" r="120" fill="#fff4a8" opacity=".16"/>' + cloud(170, 84, 1.1) + cloud(470, 60, 0.85) + cloud(620, 165, 0.6, 0.75) + cloud(885, 170, 0.7, 0.8) + gull(320, 120, 0.9, 0) + gull(390, 95, 0.65, 1.3) + gull(585, 118, 0.7, 2.1) +
        '<path d="M120 230Q180 160 250 192 300 150 360 230Z" fill="#4c9a8a"/><path d="M180 230Q210 195 245 212 275 192 300 230Z" fill="#37806f"/>' +
        '<rect y="228" width="1000" height="262" fill="url(#uSea)"/>' + glints +
        '<g transform="translate(690 262)"><g class="drift b"><path d="M-30 0H34L24 13H-20Z" fill="#fff"/><path d="M2-3V-58L34-6Z" fill="#fff"/><path d="M0-3V-46L-23-6Z" fill="#ff7b6b"/></g></g>' +
        '<g class="wave"><path d="M-30 325Q40 306 110 325T250 325T390 325T530 325T670 325T810 325T950 325T1090 325" stroke="#d7fbff" stroke-width="3" fill="none" opacity=".75"/></g><g class="wave b"><path d="M-30 395Q40 374 110 395T250 395T390 395T530 395T670 395T810 395T950 395T1090 395" stroke="#ecffff" stroke-width="4" fill="none" opacity=".8"/></g>' +
        '<path d="M0 498Q170 462 360 490T720 472 1000 486V800H0Z" fill="url(#uSand)"/>' +
        '<g class="wave b"><path d="M-40 496Q160 452 360 482T720 464 1040 478V498Q720 482 360 504 150 470-40 512Z" fill="#fff" opacity=".82"/></g><path d="M0 515Q190 480 360 508T720 490 1000 504" fill="none" stroke="#dcb56e" stroke-width="5" opacity=".5"/>' + grains +
        palm(70, 720, 1.25, false) + palm(210, 650, 0.8, false) + palm(930, 725, 1.3, true) + palm(800, 650, 0.78, true) +
        umbrella(385, 668, 0.82, '#ff6b6b', '#fff') + chair(440, 690, 0.82, '#1fa8c9', '#d6f4fb') + umbrella(640, 650, 0.66, '#ffb020', '#fff7dc') + chair(590, 672, 0.68, '#ff8a65', '#fff0e6', true) +
        '<g transform="translate(305 718)"><circle r="17" fill="url(#uBall)"/><path d="M0-17C12-8 12 8 0 17-12 8-12-8 0-17Z" fill="#fff"/><path d="M-17 0H17" stroke="#ffd23f" stroke-width="3"/></g>' +
        '<path transform="translate(675 722) scale(.85)" d="M0-16 5-5 17-3 8 5 11 17 0 11-11 17-8 5-17-3-5-5Z" fill="#ff8a65" stroke="#d9603f" stroke-linejoin="round" stroke-width="2"/>' + [[440, 708, 0.8, 11, 0, 0], [610, 694, 0.72, 13, -5, 1], [205, 700, 0.85, 12, -3, 1], [815, 708, 0.85, 10, -7, 0]].map(function (q) { return crab(q[0], q[1], q[2], q[3], q[4], q[5]); }).join('') + '');
    }
    var tree = function (x, y, k, c, c2, cls) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><g class="sway' + (cls ? ' b' : '') + '"><path d="M-7 0-4-70 4-70 7 0Z" fill="#5a3418"/><path d="M-3-50-26-74M3-44 24-70" stroke="#5a3418" stroke-width="4" stroke-linecap="round"/><circle cy="-92" r="38" fill="' + c + '"/><circle cx="-28" cy="-74" r="25" fill="' + c2 + '"/><circle cx="28" cy="-76" r="26" fill="' + c + '"/><circle cx="4" cy="-118" r="23" fill="' + c2 + '"/></g></g>'; };
    var cols = [['#d65f1e', '#e8872c'], ['#c0392b', '#d65f1e'], ['#e0a12d', '#eebb47'], ['#a8501a', '#c6702a']];
    var trees = seededRows(11, 41, function (r, i) { var y = i < 6 ? 190 + r() * 30 : 640 + r() * 70, k = i < 6 ? 0.75 + r() * 0.25 : 1 + r() * 0.35, c = cols[Math.floor(r() * 4)]; return tree(Math.round((i < 6 ? i * 76 : (i - 6) * 95) + r() * 26 - 6), Math.round(y), k.toFixed(2), c[0], c[1], i % 2); });
    var squirrel = function (x, y, k, cls, flip) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -k : k) + ' ' + k + ')"><g class="squirrel ' + cls + '"><g class="tailwag"><path d="M-12-4C-34-6-38-34-24-40-14-44-10-34-16-30-22-26-18-16-8-12Z" fill="#a8501a"/></g><ellipse cy="-9" rx="13" ry="10" fill="#b85f22"/><circle cx="11" cy="-20" r="7.500" fill="#b85f22"/><path d="M9-27 11-33 14-27Z" fill="#a8501a"/><circle cx="13.500" cy="-21" r="1.400" fill="#201008"/><ellipse cx="4" cy="-7" rx="5" ry="7" fill="#e8c090"/><path d="M-8 0H-2M4 0H10" stroke="#7a3a14" stroke-width="3" stroke-linecap="round"/></g></g>'; };
    var autumnArt = ('<path d="M0 220Q120 170 250 215T400 195V800H0Z" fill="#c98a45"/><path d="M0 640Q130 590 260 635T400 610V800H0Z" fill="#a8682e"/><path d="M0 720Q140 690 270 725T400 705V800H0Z" fill="#8f5522"/>' + trees +
      squirrel(70, 722, 1.15, 'a', false) + squirrel(315, 716, 1.05, 'b', true) + squirrel(195, 700, 0.9, 'c', false) + squirrel(340, 226, 0.6, 'c', true));
    return svgWrap('<rect width="1000" height="800" fill="#e8b070"/>' + [-100, 300, 700].map(function (x) { return '<g transform="translate(' + x + ' 0)">' + autumnArt + '</g>'; }).join(''));
  }
  // Falling snow and drifting leaves.
  function drawAmbience(now, season) {
    if (reduced || (season !== 'winter' && season !== 'autumn')) return;
    var want = season === 'winter' ? 46 : 18;
    while (ambience.length < want) ambience.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.5 + Math.random(), p: Math.random() * 7, c: ['#d65f1e', '#e0a12d', '#c0392b', '#a8501a'][Math.floor(Math.random() * 4)] });
    var boost = windAt && now - windAt < 1100 ? 5 : 1;
    ambience.forEach(function (o) {
      o.y += o.s * (season === 'winter' ? 0.55 : 0.5);
      o.x += (Math.sin(now / 900 + o.p) * 0.35 + (season === 'autumn' ? 0.28 : 0)) * boost;
      if (o.y > vh + 10) { o.y = -10; o.x = Math.random() * vw; }
      if (o.x > vw + 10) o.x = -10;
      if (season === 'winter') {
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(o.x, o.y, 1.2 + o.s * 1.5, 0, 7); ctx.fill();
      } else {
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(now / 700 + o.p); ctx.fillStyle = o.c; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(0, 0, 3 + o.s * 3, 1.8 + o.s, 0, 0, 7); ctx.fill(); ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
  }
  // Large flowers that fill their tile, so they clearly occupy the board.
  var PETALS = [['#ff7eb6', '#d93d84'], ['#ff6b6b', '#c92f3f'], ['#b58cff', '#7b4fd6'], ['#ffa94d', '#e0701a'], ['#ffffff', '#c7cdf0']];
  // Each flower is painted once for each step of its sway, then stamped, so a whole meadow costs one image per flower.
  var flowerSprites = {}, SWAY_STEPS = 12;
  function flowerSprite(pal, n, size, step, withLeaves) {
    var q = Math.max(8, Math.round(size)), key = [PETALS.indexOf(pal), n, q, step, withLeaves ? 1 : 0, boardDpr].join();
    if (flowerSprites[key]) return flowerSprites[key];
    var pad = q * 1.25, c = document.createElement('canvas'), g, sway = (step / SWAY_STEPS * 2 - 1) * 0.09;
    c.width = c.height = Math.ceil(pad * 2 * boardDpr);
    g = c.getContext('2d'); g.scale(boardDpr, boardDpr); g.translate(pad, pad);
    if (withLeaves) {
      g.fillStyle = 'rgba(120,190,90,.55)'; g.beginPath(); g.roundRect(-q, -q, q * 2, q * 2, q * 0.35); g.fill();
      g.fillStyle = '#3f9a45';
      for (var l = 0; l < 4; l++) { g.save(); g.rotate(l * Math.PI / 2 + Math.PI / 4 + sway * 0.5); g.beginPath(); g.ellipse(0, -q * 0.72, q * 0.23, q * 0.34, 0, 0, 7); g.fill(); g.restore(); }
    }
    g.rotate(sway);
    for (var i = 0; i < n; i++) {
      g.save(); g.rotate(i * Math.PI * 2 / n);
      g.fillStyle = pal[1]; g.beginPath(); g.ellipse(0, -q * 0.5, q * 0.33, q * 0.47, 0, 0, 7); g.fill();
      g.fillStyle = pal[0]; g.beginPath(); g.ellipse(0, -q * 0.52, q * 0.25, q * 0.39, 0, 0, 7); g.fill();
      g.restore();
    }
    g.fillStyle = '#d98a00'; g.beginPath(); g.arc(0, 0, q * 0.27, 0, 7); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, q * 0.21, 0, 7); g.fill();
    g.fillStyle = '#b86f00';
    for (var d = 0; d < 6; d++) { var t = d * Math.PI / 3; g.beginPath(); g.arc(Math.cos(t) * q * 0.12, Math.sin(t) * q * 0.12, q * 0.025, 0, 7); g.fill(); }
    return (flowerSprites[key] = { c: c, half: pad / q });
  }
  function flowersLeft() {
    var l = current.level;
    return (l.flowers || []).filter(function (f, i) { return i >= state.launches && !(state.picked && state.picked[f[1] * l.w + f[0]]); }).length;
  }
  function drawFlower(p, size, seed, now, withLeaves) {
    var phase = reduced ? 0 : Math.sin(now / 760 + seed), step = Math.round((phase + 1) / 2 * SWAY_STEPS);
    var sp = flowerSprite(PETALS[seed % PETALS.length], 5 + seed % 2, size, step, withLeaves), h = sp.half * size;
    ctx.globalAlpha = 1;
    ctx.drawImage(sp.c, p.x - h, p.y - h, h * 2, h * 2);
  }
  function drawFlowers(now, l) {
    l.flowers.forEach(function (f, i) {
      if (i < state.launches || (state.picked && state.picked[f[1] * l.w + f[0]])) return;
      var p = px(f);
      if (p.x < -cs || p.x > vw + cs || p.y < -cs || p.y > vh + cs) return;
      drawFlower(p, cs * 0.47, f[0] * 7 + f[1] * 3, now, true);
    });
  }
  // A simple little bee: a soft oval, two stripes, one dot of an eye and pale wings. No outlines, in keeping with the flat, calm art.
  function drawBeeAt(x, y, k, now, flap, flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -k : k, k); ctx.globalAlpha = 1;
    var lift = reduced ? 0 : flap ? Math.sin(now / 55) * 0.3 : 0;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.save(); ctx.translate(-3, -7); ctx.rotate(-0.4 - lift); ctx.beginPath(); ctx.ellipse(0, -4, 3.6, 5.6, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(2, -7); ctx.rotate(0.3 + lift); ctx.beginPath(); ctx.ellipse(0, -4, 3.6, 5.6, 0, 0, 7); ctx.fill(); ctx.restore();
    // Three simple legs.
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    [[-5, 7, -6.5, 11], [0, 8, 0, 12], [5, 7, 6.5, 11]].forEach(function (f) { ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.lineTo(f[2], f[3]); ctx.stroke(); });
    ctx.fillStyle = '#f7c948';
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, 7); ctx.clip();
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-6.5, -9, 3, 18); ctx.fillRect(-0.5, -9, 3, 18);
    ctx.restore();
    // Two black dots for eyes.
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(5.8, -2, 1.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -2, 1.4, 0, 7); ctx.fill();
    ctx.restore();
  }
  // Bees come in and leave from beyond the edge of the screen.
  function sendBee(index, start) {
    var l = current.level;
    // The bee goes to the next flower still standing.
    while (l.flowers && index < l.flowers.length && state.picked && state.picked[l.flowers[index][1] * l.w + l.flowers[index][0]]) index++;
    if (!l.flowers || index >= l.flowers.length) { bee = null; return; }
    var fromLeft = (index * 7 + l.flowers[index][1]) % 2 === 0;
    bee = { index: index, start: start, from: { x: fromLeft ? -50 : vw + 50, y: 110 + ((index * 83) % Math.max(100, vh - 240)) } };
  }
  function drawBees(now) {
    var k = cs / 34, l = current.level;
    if (bee) {
      var t = (now - bee.start) / 1000;
      if (t > 0) {
        var to = px(l.flowers[bee.index]); to = { x: to.x, y: to.y - cs * 0.3 };
        var e = reduced ? 1 : ease(Math.min(1, t));
        var x = bee.from.x + (to.x - bee.from.x) * e, y = bee.from.y + (to.y - bee.from.y) * e + Math.sin(e * Math.PI * 3) * (1 - e) * cs;
        var settled = t >= 1;
        // Waiting bees drift gently and flap in short bursts.
        var flap = !settled || Math.sin(now / 900 + bee.index) > 0.15;
        if (settled && !reduced) { x += Math.sin(now / 620 + bee.index) * cs * 0.05; y += Math.cos(now / 480 + bee.index) * cs * 0.05; }
        drawBeeAt(x, y, k, now, flap, bee.from.x > to.x);
      }
    }
    beesLeaving = beesLeaving.filter(function (b) {
      var t = (now - b.start) / 1100;
      if (t >= 1) return false;
      var e = reduced ? 1 : t * t, x = b.from.x + (b.to.x - b.from.x) * e, y = b.from.y + (b.to.y - b.from.y) * e - Math.sin(t * Math.PI) * cs * 1.2;
      drawFlower({ x: x, y: y + cs * 0.42 }, cs * 0.3, b.seed, now, false);
      drawBeeAt(x, y, k, now, true, b.to.x < b.from.x);
      return true;
    });
  }
  function drawFlame(x, y, size, now, seed) {
    var f = reduced ? 1 : 1 + Math.sin(now / 90 + seed) * 0.14, g = reduced ? 0 : Math.sin(now / 130 + seed * 2) * size * 0.14;
    ctx.globalAlpha = 1; ctx.fillStyle = '#ff5a12';
    ctx.beginPath(); ctx.moveTo(x - size * 0.55, y + size * 0.5);
    ctx.quadraticCurveTo(x - size * 0.75, y - size * 0.1, x + g, y - size * f);
    ctx.quadraticCurveTo(x + size * 0.75, y - size * 0.1, x + size * 0.55, y + size * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc61a';
    ctx.beginPath(); ctx.moveTo(x - size * 0.28, y + size * 0.5);
    ctx.quadraticCurveTo(x - size * 0.35, y, x + g * 0.6, y - size * 0.45 * f);
    ctx.quadraticCurveTo(x + size * 0.35, y, x + size * 0.28, y + size * 0.5); ctx.closePath(); ctx.fill();
  }
  function drawFires(now) {
    var l = current.level;
    Object.keys(state.burning).forEach(function (key) {
      var k = +key, until = state.burning[k];
      if (until <= state.launches) return;
      var p = px([k % l.w, Math.floor(k / l.w)]);
      ctx.globalAlpha = 0.34; ctx.fillStyle = '#ff5a12';
      ctx.beginPath(); ctx.roundRect(p.x - cs * 0.46, p.y - cs * 0.46, cs * 0.92, cs * 0.92, cs * 0.14); ctx.fill();
      drawFlame(p.x - cs * 0.15, p.y + cs * 0.12, cs * 0.26, now, k);
      drawFlame(p.x + cs * 0.17, p.y + cs * 0.14, cs * 0.22, now, k + 3);
      drawFlame(p.x, p.y + cs * 0.04, cs * 0.34, now, k + 5);
    });
    ctx.globalAlpha = 1;
  }
  // Soft fire puffs, drawn once and reused, so the flames look like real flame rather than cut-out shapes.
  var FIRE_SPRITES = null;
  function fireSprites() {
    if (FIRE_SPRITES) return FIRE_SPRITES;
    FIRE_SPRITES = [['rgba(255,250,200,1)', 'rgba(255,214,90,.75)', 'rgba(255,170,40,0)'], ['rgba(255,190,60,.95)', 'rgba(255,110,20,.6)', 'rgba(240,60,10,0)'], ['rgba(240,70,16,.75)', 'rgba(170,30,8,.35)', 'rgba(90,20,8,0)'], ['rgba(70,60,56,.34)', 'rgba(70,60,56,.16)', 'rgba(70,60,56,0)']].map(function (st) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
      g.addColorStop(0, st[0]); g.addColorStop(0.45, st[1]); g.addColorStop(1, st[2]);
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return c;
    });
    return FIRE_SPRITES;
  }
  // A point on the arrow, measured back from its head, wherever the arrow is right now (even mid-bounce).
  function pointOnArrow(a, along) {
    var bo = bounces[a.id], len = lengthOf(a), pts = bo && bo.pts ? bo.pts : a.cells, shift = 0;
    if (bo) { var bt = (performance.now() - bo.start) / 440; if (bt < 1) shift = Math.sin(bt * Math.PI) * bo.reach; }
    return pointAlong(pts, Math.max(0, shift + len - along));
  }
  function igniteArrow(a, now, impact) {
    var dur = 500 + Math.random() * 1000;
    a.burn = { start: now, until: now + dur, dur: dur, impact: impact, lastSpawn: now };
    a.burnUntil = now + dur;
    // A burst of sparks flung from the point of impact.
    for (var i = 0; i < 22; i++) {
      var ang = Math.random() * Math.PI * 2, sp = cs * (0.9 + Math.random() * 2.2);
      embers.push({ kind: 'spark', x: impact.x, y: impact.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cs * 0.8, born: now, life: 320 + Math.random() * 380, size: cs * (0.025 + Math.random() * 0.03) });
    }
  }
  function spawnFlames(a, now) {
    var b = a.burn, t = (now - b.start) / b.dur, len = a.cells.length - 1;
    // Fire runs from the head to the tail in the first third, then dies down.
    var front = Math.min(1, t / 0.32) * len, strength = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.33);
    var steps = Math.floor((now - b.lastSpawn) / 12);
    if (steps <= 0 || strength <= 0) return;
    b.lastSpawn = now;
    var perStep = Math.ceil((1 + len) * 0.5 * strength);
    for (var s = 0; s < steps * perStep && embers.length < 340; s++) {
      // Flames stay attached to the arrow: each remembers its spot on the body and rises from there.
      embers.push({ kind: 'flame', arrow: a, along: Math.random() * front, x: (Math.random() - 0.5) * cs * 0.16, y: (Math.random() - 0.5) * cs * 0.1, vx: (Math.random() - 0.5) * cs * 0.3, vy: -cs * (1 + Math.random() * 0.9), born: now, life: 260 + Math.random() * 240, size: cs * (0.2 + Math.random() * 0.14) * (0.65 + strength * 0.35), seed: Math.random() * 7 });
    }
    if (Math.random() < 0.55) {
      var q = pointOnArrow(a, Math.random() * front);
      embers.push({ kind: 'spark', x: q.x, y: q.y, vx: (Math.random() - 0.5) * cs * 0.7, vy: -cs * (1.3 + Math.random() * 1.4), born: now, life: 480 + Math.random() * 520, size: cs * (0.018 + Math.random() * 0.024) });
    }
    if (t > 0.45 && Math.random() < 0.38) {
      var w = pointOnArrow(a, Math.random() * len);
      embers.push({ kind: 'smoke', x: w.x, y: w.y, vx: (Math.random() - 0.5) * cs * 0.25, vy: -cs * (0.8 + Math.random() * 0.6), born: now, life: 620 + Math.random() * 480, size: cs * (0.22 + Math.random() * 0.14), seed: Math.random() * 7 });
    }
  }
  function drawArrowFlames(a, now) {
    var b = a.burn;
    if (!b) return;
    var t = Math.min(1, (now - b.start) / b.dur), last = a.cells.length - 1;
    spawnFlames(a, now);
    if (b.impact && t < 0.2) {
      var q = t / 0.2, sp = fireSprites()[0], fs = cs * (0.8 + q * 1.9), ip = pointOnArrow(a, 0);
      b.impact = ip;
      ctx.globalAlpha = (1 - q) * 0.95; ctx.drawImage(sp, ip.x - fs / 2, ip.y - fs / 2, fs, fs);
      ctx.globalAlpha = (1 - q) * 0.75; ctx.strokeStyle = '#ff8a22'; ctx.lineWidth = Math.max(1.5, cs * 0.05);
      ctx.beginPath(); ctx.arc(b.impact.x, b.impact.y, cs * (0.25 + q * 1.1), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawEmbers(now) {
    var sprites = fireSprites(), dt = 1;
    // Smoke first, then flame from old to young, so bright fire sits on top.
    ['smoke', 'flame', 'spark'].forEach(function (kind) {
      embers.forEach(function (e) {
        if (e.kind !== kind) return;
        var t = (now - e.born) / e.life;
        if (t < 0 || t >= 1) return;
        var base = e.arrow && !state.removed[e.arrow.id] ? pointOnArrow(e.arrow, e.along) : { x: 0, y: 0 };
        var x = base.x + e.x + e.vx * t * (e.life / 1000) + (e.seed ? Math.sin(now / 90 + e.seed) * cs * 0.05 * t : 0), y = base.y + e.y + e.vy * t * (e.life / 1000) + (kind === 'spark' ? cs * 1.4 * t * t * (e.life / 1000) : 0);
        if (kind === 'smoke') {
          var ss = e.size * (1 + t * 2.2);
          ctx.globalAlpha = Math.sin(t * Math.PI); ctx.drawImage(sprites[3], x - ss, y - ss, ss * 2, ss * 2);
        } else if (kind === 'flame') {
          var fs = e.size * (1 - t * 0.72) * 1.0, stage = t < 0.28 ? 0 : t < 0.62 ? 1 : 2;
          ctx.globalAlpha = t < 0.08 ? t / 0.08 : 1 - t * t * 0.7;
          ctx.drawImage(sprites[stage], x - fs, y - fs * 1.3, fs * 2, fs * 2.6);
        } else {
          ctx.globalAlpha = 1 - t * t; ctx.fillStyle = t < 0.4 ? '#fff0a8' : t < 0.75 ? '#ffa02a' : '#d9401a';
          ctx.beginPath(); ctx.arc(x, y, e.size * (1 - t * 0.5), 0, 7); ctx.fill();
        }
      });
    });
    embers = embers.filter(function (e) { return now - e.born < e.life; });
    ctx.globalAlpha = 1;
  }
  function drawIce(c, r) {
    ctx.globalAlpha = 1; ctx.fillStyle = '#e4f5ff'; ctx.strokeStyle = '#2f8fd0'; ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#2f8fd0'; ctx.lineWidth = Math.max(1.3, r * 0.13); ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var a = i * Math.PI / 3 + Math.PI / 6, dx = Math.cos(a) * r * 0.68, dy = Math.sin(a) * r * 0.68;
      ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy); ctx.stroke();
    }
  }
  // Streaks of wind blow across the board, whether or not any arrow turns.
  function drawWind(now) {
    var t = (now - windAt) / 1200;
    if (t >= 1 || reduced) { if (t >= 1) windAt = 0; return; }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Each gust has a dark edge under a bright core, so it shows on any background.
    var gusts = 16, boardH = current.level.h * cs;
    for (var i = 0; i < gusts; i++) {
      var y = oy + boardH * ((i * 0.37 + 0.13) % 1) + Math.sin(i * 2.1) * cs * 0.3, offset = (i * 0.17) % 0.5, q = (t - offset * 0.6) * 1.75;
      if (q < 0 || q > 1) continue;
      var x = -160 + (vw + 320) * q, len = 80 + (i % 4) * 40, wave = 9 * Math.sin(now / 90 + i), fade = Math.sin(q * Math.PI);
      var curl = i % 3 === 0 ? 11 + (i % 2) * 5 : 0;
      var trace = function () {
        ctx.beginPath(); ctx.moveTo(x - len, y); ctx.bezierCurveTo(x - len * 0.66, y - wave, x - len * 0.33, y + wave, x, y);
        if (curl) ctx.arc(x, y - curl, curl, Math.PI / 2, -Math.PI, true);
        ctx.stroke();
      };
      ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = '#1e2c40'; ctx.lineWidth = Math.max(4.5, cs * 0.13); trace();
      ctx.globalAlpha = fade * 0.98; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2.5, cs * 0.075); trace();
    }
    ctx.globalAlpha = 1;
  }
  // Applies what a launch set off: frost, fire, wind or the next bee.
  function applySeasonEvents(ev, now) {
    var l = current.level;
    if (ev.freeze.length) {
      ev.freeze.forEach(function (id) { addRipple(px(l.arrows[id].cells[l.arrows[id].cells.length >> 1]), '#3f9fd8', 1.6); });
      seasonSound('freezeSound'); popSymbol('winter'); buzz(12);
    }
    if (ev.burn.length) { seasonSound('igniteSound'); popSymbol('summer'); buzz(16); }
    if (ev.wind) {
      windAt = now; seasonSound('windSound'); popSymbol('autumn');
      ev.rotate.forEach(function (r) { var a = l.arrows[r.id]; a.rot = { start: now, turn: (r.quarters === 3 ? -1 : r.quarters) * Math.PI / 2 }; });
    }
    if (l.flowers && l.flowers.length) {
      takeEarlyFlowers(now);
      var taken = state.beeTaken;
      if (taken) {
        var p = px(taken), right = p.x > vw / 2;
        beesLeaving.push({ from: { x: p.x, y: p.y - cs * 0.28 }, to: { x: right ? vw + 70 : -70, y: 40 + ((state.launches * 61) % 200) }, start: now, seed: taken[0] * 7 + taken[1] * 3 });
      }
      if (taken) { seasonSound('springSound'); popSymbol('spring'); }
      sendBee(state.launches, now + 450);
    }
  }
  // Two opposite arrows in a small disc.
  function goldSparkles(a, pts, shift, len, now) {
    ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 0.8;
    for (var i = 0; i < 7; i++) {
      var q = reduced ? i / 7 : (now / 1500 + i / 7) % 1, p = pointAlong(pts, shift + len * q), turn = now / 300 + i * 2;
      ctx.globalAlpha = Math.sin(q * Math.PI) * 0.6 + 0.4;
      drawStarShape(p.x + Math.sin(now / 260 + i) * cs * 0.36, p.y + Math.cos(now / 310 + i * 2) * cs * 0.36, cs * (0.09 + (i % 3) * 0.035), turn);
    }
    ctx.restore();
  }
  // An arrow's symbols, spaced evenly along it when it carries more than one.
  function drawTraits(a, pts, shift, len, color, ghostForm, pop, now) {
    var items = [], left = state.launches;
    if (a.kind === 'twin') items.push(function (c) { badge(c, cs * 0.29, color, colors.card, String.fromCharCode(65 + (a.pair || 0))); });
    if (a.coopGroup !== undefined) items.push(function (c) { drawCoopTag(c, a, color); });
    if (a.sniper) items.push(function (c) { drawCrosshair(c, cs * 0.27, color); });
    if (a.wait && left < a.wait) items.push(function (c) { badge(c, cs * 0.29, colors.card, colors.ink, String(a.wait - left), color); });
    if (a.ghostPhase !== undefined) items.push(function (c) { drawGhostIcon(c, cs * 0.3, ghostForm, now); });
    if (a.uno !== undefined) items.push(function (c) { drawReverseIcon(c, cs * 0.27, color); });
    if (a.phase) items.push(function (c) { drawPhaseIcon(c, cs * 0.26, color, now); });
    if (a.red && left < a.red) items.push(function (c) { badge(c, cs * 0.29, colors.card, colors.ink, String(a.red - left), a.red - left <= 2 ? '#c8202f' : color); drawMiniCard({ x: c.x + cs * 0.26, y: c.y + cs * 0.24 }, cs * 0.27); });
    if (a.red && left >= a.red && !(state.redLift && state.redLift[a.id])) items.push(function (c) { drawMiniCard(c, cs * 0.5); });
    items.forEach(function (draw, i) {
      var c = pointAlong(pts, shift + len * (i + 1) / (items.length + 1));
      scaled(c, pop, function () { draw(c); });
    });
  }
  // A cross-board twin shows who holds its partners: each player's initial, with a small arrow towards their board.
  // A live sniper: a pulsing red glow under it, crackling sparks along it and a spinning sight at its head.
  function sniperGlow(pts, from, to, w, now) {
    var pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 80);
    setStroke('#ff2338', w * (2.6 + pulse * 1.8), 0.16 + pulse * 0.16); strokeWindow(pts, from, to);
    setStroke('#ffc2c8', w * 1.7, 0.4); strokeWindow(pts, from, to);
  }
  function sniperSparks(pts, from, to, res, now) {
    if (!res || !res.end) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Crackle: a jagged white line that flickers along the body.
    var tick = reduced ? 0 : Math.floor(now / 55);
    for (var k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? '#ff6b78' : '#fff'; ctx.lineWidth = Math.max(1, cs * (k ? 0.05 : 0.03)); ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (var d = from, i = 0; d <= to + 0.001; d += 0.3, i++) {
        var p = pointAlong(pts, d), off = Math.sin((tick + i * 7 + k * 13) * 12.9898) * cs * 0.16;
        var q = pointAlong(pts, Math.min(to, d + 0.05)), dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1;
        var x = p.x - dy / n * off, y = p.y + dx / n * off;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // Sparks falling off the tail.
    for (var j = 0; j < 7; j++) {
      var age = ((now / 400) + j / 7) % 1, sp = pointAlong(pts, Math.max(0, from - age * 1.6));
      ctx.globalAlpha = (1 - age) * 0.9; ctx.fillStyle = age < 0.4 ? '#fff0b0' : '#ff4a4a';
      ctx.beginPath(); ctx.arc(sp.x + Math.sin(j * 2.1 + now / 70) * cs * 0.22 * age, sp.y + Math.cos(j * 1.3 + now / 90) * cs * 0.22 * age, Math.max(1, cs * 0.06 * (1 - age * 0.6)), 0, 7); ctx.fill();
    }
    // A spinning sight around the head.
    var rot = reduced ? 0 : now / 160, r = cs * 0.4;
    ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ff2338'; ctx.lineWidth = Math.max(1.4, cs * 0.05);
    for (var a4 = 0; a4 < 4; a4++) { ctx.beginPath(); ctx.arc(res.end.x, res.end.y, r, rot + a4 * Math.PI / 2 + 0.25, rot + a4 * Math.PI / 2 + 1.3); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // Twin-shared arrows carry a group letter and a plus: the plus says its twins are on other boards.
  function coopLabel(g) { return 'XYZWVU'.charAt(g % 6) + '+'; }
  // Twin-shared arrows look like twins: the same round badge, with the group letter and a plus.
  function drawCoopTag(c, a, color) {
    if (!coop) return;
    var r = cs * 0.29, letter = coopLabel(a.coopGroup).charAt(0);
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = colors.card; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(r * 1.05) + 'px Figtree,system-ui,sans-serif';
    var lw = ctx.measureText(letter).width;
    ctx.font = '700 ' + Math.round(r * 0.8) + 'px Figtree,system-ui,sans-serif';
    var pw = ctx.measureText('+').width, x0 = c.x - (lw + pw) / 2;
    ctx.textAlign = 'left';
    ctx.font = '700 ' + Math.round(r * 1.05) + 'px Figtree,system-ui,sans-serif'; ctx.fillText(letter, x0, c.y + 1);
    ctx.font = '700 ' + Math.round(r * 0.8) + 'px Figtree,system-ui,sans-serif'; ctx.fillText('+', x0 + lw, c.y - r * 0.12);
    ctx.restore();
  }
  function drawCrosshair(c, r, color) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = 1;
    ctx.fillStyle = colors.card; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * 0.15); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(0, -r * 0.6); ctx.moveTo(0, r * 0.6); ctx.lineTo(0, r * 0.95); ctx.moveTo(-r * 0.95, 0); ctx.lineTo(-r * 0.6, 0); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.95, 0); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawReverseIcon(c, r, color) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = 1;
    ctx.fillStyle = colors.card; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    [[-1, -0.3], [1, 0.3]].forEach(function (q) {
      var dir = -q[0], y = q[1] * r;
      ctx.beginPath(); ctx.moveTo(-dir * r * 0.5, y); ctx.lineTo(dir * r * 0.5, y); ctx.moveTo(dir * r * 0.18, y - r * 0.26); ctx.lineTo(dir * r * 0.5, y); ctx.lineTo(dir * r * 0.18, y + r * 0.26); ctx.stroke();
    });
    ctx.restore();
  }
  function drawGhostIcon(c, r, ghostForm, now) {
    var bob = reduced || !ghostForm ? 0 : Math.sin(now / 340) * r * 0.1;
    ctx.save(); ctx.translate(c.x, c.y + bob); ctx.globalAlpha = ghostForm ? 0.7 : 1;
    ctx.fillStyle = ghostForm ? 'rgba(255,255,255,.75)' : '#fff'; ctx.strokeStyle = '#55607a'; ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.8, -r * 0.1); ctx.arc(0, -r * 0.1, r * 0.8, Math.PI, 0); ctx.lineTo(r * 0.8, r * 0.85);
    [0.48, 0.16, -0.16, -0.48].forEach(function (k, i) { ctx.lineTo(r * k, i % 2 ? r * 0.85 : r * 0.55); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a3048'; ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.15, r * 0.13, 0, 7); ctx.arc(r * 0.28, -r * 0.15, r * 0.13, 0, 7); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function drawPhaseIcon(c, r, color, now) {
    ctx.globalAlpha = 1; ctx.fillStyle = colors.card; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, r * 0.13);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill(); ctx.stroke();
    // Two overlapping rings: one thing passing through another.
    var o = reduced ? r * 0.28 : r * (0.22 + 0.1 * Math.sin(now / 380));
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.beginPath(); ctx.arc(c.x - o, c.y, r * 0.42, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x + o, c.y, r * 0.42, 0, 7); ctx.stroke();
  }
  function cardShape(x, y, w, h, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#d4161f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, w * 0.07);
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.12); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawMiniCard(c, h) { ctx.globalAlpha = 1; cardShape(c.x, c.y, h * 0.7, h, 0.14); }
  // The moment of a red card: a big card is thrust up over the arrow, then shrinks onto it.
  function drawRedCards(now) {
    var l = current.level;
    cards = cards.filter(function (card) {
      var t = (now - card.start) / 1250;
      if (t >= 1) return false;
      if (t < 0) return true;
      var a = l.arrows[card.id];
      if (state.removed[a.id]) return false;
      var home = pointAlong(a.cells, lengthOf(a) / 2), big = Math.max(84, cs * 2.2);
      var over = { x: Math.min(vw - big * 0.45, Math.max(big * 0.45, home.x)), y: Math.max(viewTop + big * 0.55, home.y - cs * 0.9) };
      var rise = Math.min(1, t / 0.14), back = 1.7, pop = 1 + (back + 1) * Math.pow(rise - 1, 3) + back * Math.pow(rise - 1, 2);
      var leave = t > 0.72 ? ease((t - 0.72) / 0.28) : 0;
      var size = (big * pop) * (1 - leave) + cs * 0.34 * leave;
      var x = over.x + (home.x - over.x) * leave, y = over.y + (home.y - over.y) * leave;
      var wob = reduced ? 0 : Math.sin(t * 22) * 0.07 * (1 - leave);
      ctx.globalAlpha = (1 - leave) * 0.5 * (t < 0.5 ? 1 : 1 - (t - 0.5) * 2);
      ctx.strokeStyle = '#d4161f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(home.x, home.y, cs * (0.4 + t * 2.1), 0, 7); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12 * (1 - leave);
      cardShape(x, y, size * 0.7, size, 0.14 + wob);
      ctx.shadowBlur = 0;
      return true;
    });
    ctx.globalAlpha = 1;
  }
  function badge(p, r, fill, text, label, edge) {
    if (!p) return;
    ctx.globalAlpha = 1; ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = text;
    ctx.font = '600 ' + Math.round(r * 1.2) + 'px Figtree,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 1);
  }
  function mixColor(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), out = '#';
    [16, 8, 0].forEach(function (sh) {
      var x = (pa >> sh) & 255, y = (pb >> sh) & 255, v = Math.round(x + (y - x) * t);
      out += (v < 16 ? '0' : '') + v.toString(16);
    });
    return out;
  }
  // The point at a given distance along a path of grid points, for centring badges.
  function pointAlong(pts, at) {
    var dist = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var seg = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
      if (seg && at <= dist + seg) {
        var k = (at - dist) / seg;
        return px([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]);
      }
      dist += seg;
    }
    return px(pts[pts.length - 1]);
  }
  function addRipple(p, color, size, delay) {
    ripples.push({ x: p.x, y: p.y, color: color, size: size || 2.4, start: performance.now() + (delay || 0) });
  }

  /* ---------- Input ---------- */
  function arrowAt(cx, cy) {
    var l = current.level, gx = (cx - ox) / cs, gy = (cy - oy) / cs, best = -1, bestD = 0.85;
    // Forgiving hit test: the nearest live arrow cell within most of a cell.
    l.arrows.forEach(function (a) {
      if (state.removed[a.id]) return;
      a.cells.forEach(function (c) {
        var d = Math.hypot(gx - c[0] - 0.5, gy - c[1] - 0.5);
        if (d < bestD) { bestD = d; best = a.id; }
      });
    });
    return best;
  }
  function hintStillGood() {
    if (hintArrow < 0) return;
    if (state.removed[hintArrow] || !E.canLaunch(current.level, state, hintArrow)) { hintArrow = -1; return; }
    var probe = { picked: state.picked, removed: state.removed.slice(), launches: state.launches, lives: null, history: [], frozen: {}, burning: Object.assign({}, state.burning), ghostFlip: state.ghostFlip, arrowsRef: current.level.arrows };
    E.tap(current.level, probe, hintArrow);
    var sol = E.solve(current.level, probe, current.level.big ? 2000 : 30000);
    if (!sol.solved && !sol.exhausted) hintArrow = -1;
  }
  // Flowers a bee took early, because they alone were holding up the board.
  function takeEarlyFlowers(now) {
    var l = current.level, log = state.rescued;
    if (log) {
      log.fire.forEach(function (k) { addRipple(px([k % l.w, Math.floor(k / l.w)]), '#ff8a22', 2); });
      log.ice.forEach(function (id) { var m = l.arrows[id]; addRipple(px(m.cells[m.cells.length >> 1]), '#3f9fd8', 2.4); });
      log.freed.forEach(function (id) { if (state.freed && state.freed[id]) focusArrow(id); });
      state.rescued = null;
    }
    if (bee && l.flowers && l.flowers[bee.index] && state.picked && state.picked[l.flowers[bee.index][1] * l.w + l.flowers[bee.index][0]]) sendBee(state.launches, now + 300);
    (state.pickedNew || []).splice(0).forEach(function (k) {
      var p = px([k % l.w, Math.floor(k / l.w)]), right = p.x > vw / 2;
      beesLeaving.push({ from: { x: p.x, y: p.y - cs * 0.28 }, to: { x: right ? vw + 70 : -70, y: 40 + ((k * 61) % 200) }, start: now, seed: (k % l.w) * 7 + Math.floor(k / l.w) * 3 });
    });
  }
  function onTap(id) {
    if (ended || id < 0) return;
    if (current.coop && !coopAllow(id)) return;
    var l = current.level, res = E.tap(l, state, id), now = performance.now();
    takeEarlyFlowers(now);
    if (res.notReady) {
      // Waiting arrows give a small shake and a soft sound. It costs nothing.
      nudges[id] = now + 360;
      if (l.arrows[id].key !== undefined) blockerGlow[l.arrows[id].key] = now + 500;
      pluck(220, 0, 0.07, 0.3); buzz(6);
      track('not_ready', { arrow: id, frozen: state.frozen[id] !== undefined });
      return;
    }
    if (res.thawed) {
      // Cracking ice: the arrow bounces back, the other arrow is free, and no life is lost.
      res.results.forEach(function (r) {
        var m = l.arrows[r.id];
        bounces[r.id] = { start: now, reach: r.check.clear ? 0.18 : Math.max(0.14, r.check.dist - 0.62), pts: m.kind === 'compass' ? null : trackOf(m, r.check) };
      });
      res.thawed.forEach(function (t) { var a = l.arrows[t]; addRipple(px(a.cells[a.cells.length >> 1]), '#3f9fd8', 2); blockerGlow[t] = now + 420; });
      seasonSound('crackSound'); buzz(14);
      track('thaw', { arrows: res.thawed });
      refresh();
      return;
    }
    if (res.ok) {
      var step = state.launches - 1;
      res.results.forEach(function (r) {
        var m = l.arrows[r.id], c = r.check, pts = trackOf(m, c), len = lengthOf(m);
        var ex = pts[pts.length - 2], edge = (function () {
          var x = ex[0], y = ex[1];
          while (x >= 0 && y >= 0 && x < l.w && y < l.h) { x += E.DX[c.endDir]; y += E.DY[c.endDir]; }
          return px([x, y]);
        })();
        var body = m.kind === 'compass' ? 0 : m.cells.length - 1;
        var travel = body + c.dist + screenCells() + len;
        var sc = reduced ? 0.45 : 1;
        flights.push({ pts: pts, len: len, travel: travel, start: now, duration: sc * Math.min(1500, 480 + travel * 42), ghosty: !!m.phase, sniper: !!m.sniper, color: hintArrow === m.id || (m.kind === 'twin' && hintArrow === m.twin) ? colors.hint : arrowColor(m), edge: edge, rayCells: body + c.dist - 1 });
      });
      addPraise(l.arrows[id], now);
      var f = noteFor(step); tune.push(f); pluck(f, 0, 0.2, 1.5);
      if (res.results.some(function (r) { return state.freed && state.freed[r.id]; })) {
        [1, 1.5, 2, 3].forEach(function (x, i) { pluck(f * x, i * 0.07, 0.11, 1.2); });
        flights.slice(-res.results.length).forEach(function (fl) { fl.color = '#e0a100'; fl.gold = true; });
      }
      buzz(8);
      l.arrows.forEach(function (x) { if (x.kind === 'compass' && !state.removed[x.id]) angles[x.id] += 90; if (x.uno !== undefined) unoFlip[x.id] = now; });
      res.results.forEach(function (r) {
        l.arrows.forEach(function (x) {
          if (x.key !== r.id || state.removed[x.id]) return;
          wakes.push({ from: px(l.arrows[r.id].cells[0]), to: px(x.cells[0]), start: now });
          pluck(880, 0.42, 0.12, 0.9); pluck(1318.5, 0.5, 0.1, 1.1);
        });
      });
      if (!res.won) applySeasonEvents(E.seasonStep(l, state), now);
      if (!res.won) l.arrows.forEach(function (x, i) {
        if (x.red === state.launches && !state.removed[x.id] && E.isRedCarded(state, x)) {
          cards.push({ id: x.id, start: now + 200 + cards.length * 170 });
          if (cards.length === 1 || i % 2 === 0) { seasonSound('redCardSound'); buzz(30); }
          track('red_card', { arrow: x.id });
        }
      });
      if (current.coop) coopAfterLaunch(id, res, now);
      hintStillGood();
      if (res.won && current.coop && !coopAllWon()) setCaption('Board ' + (coop.idx + 1) + ' cleared! Help clear the others.');
      else if (res.won || (current.coop && coopAllWon())) { bee = null; finish(true); }
    } else {
      collisions++;
      res.results.forEach(function (r) {
        var m = l.arrows[r.id], pts = trackOf(m, r.check);
        if (m.kind === 'compass') pts = null;
        if (r.check.clear) { bounces[r.id] = { start: now, reach: 0.18, pts: pts }; return; }
        bounces[r.id] = { start: now, reach: Math.max(0.14, r.check.dist - 0.62), pts: pts };
        blockerGlow[r.check.blocker] = now + 420;
        if (r.check.fire) { var fh = E.tipOf(l.arrows[r.id], state), fd = r.check.endDir; igniteArrow(l.arrows[r.id], now, px([fh[0] + E.DX[fd] * (r.check.dist - 0.5), fh[1] + E.DY[fd] * (r.check.dist - 0.5)])); seasonSound('fireSound'); }
        track('collision', { arrow: r.id, blocker: r.check.blocker, fire: !!r.check.fire, flower: !!r.check.flower });
      });
      thud(); buzz(26);
      if (res.failed) finish(false, 'lives');
    }
    if (current.coop) coopSyncLives();
    refresh();
  }
  // Normal boards react on touch. Big boards wait for release, so a drag moves the view instead of playing an arrow.
  var ptrs = {}, gesture = null;
  function ptrList() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  function jumpFromMinimap(x, y) {
    if (!cam || cs <= fitCs * 1.04) return false;
    var r = miniRect();
    if (x < r.x - 4 || x > r.x + r.w + 4 || y < r.y - 4 || y > r.y + r.h + 4) return false;
    cam.zoom = null; cam.anim = { cx: (x - r.x) / r.sc, cy: (y - r.y) / r.sc };
    return true;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    if (!current || $('sheetHost').firstChild) return;
    audio();
    if (!cam) {
      var hitId = arrowAt(ev.clientX, ev.clientY);
      // A cross-board twin waits a moment: a quick tap plays it, holding it looks at its partners.
      if (current.coop && coop && hitId >= 0 && current.level.arrows[hitId].coopGroup !== undefined && !ended) { coopHoldStart(hitId, ev.pointerId); return; }
      onTap(hitId); return;
    }
    if (jumpFromMinimap(ev.clientX, ev.clientY)) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var list = ptrList();
    cam.anim = null; cam.zoom = null; cam.settling = false; cam.free = true;
    if (list.length === 1) gesture = { x0: ev.clientX, y0: ev.clientY, cx: cam.cx, cy: cam.cy, moved: false, pinch: null };
    else if (gesture && list.length === 2) {
      gesture.moved = true;
      gesture.pinch = { dist: Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y), mx: (list[0].x + list[1].x) / 2, my: (list[0].y + list[1].y) / 2 };
    }
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!cam || !ptrs[ev.pointerId] || !gesture) return;
    ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var list = ptrList();
    if (list.length >= 2 && gesture.pinch) {
      var dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y), mx = (list[0].x + list[1].x) / 2, my = (list[0].y + list[1].y) / 2;
      zoomAt(mx, my, dist / Math.max(1, gesture.pinch.dist));
      cam.cx -= (mx - gesture.pinch.mx) / cs; cam.cy -= (my - gesture.pinch.my) / cs; applyCam();
      gesture.pinch = { dist: dist, mx: mx, my: my };
      return;
    }
    if (list.length !== 1 || gesture.pinch) return;
    var dx = ev.clientX - gesture.x0, dy = ev.clientY - gesture.y0;
    if (!gesture.moved && Math.hypot(dx, dy) > 9) gesture.moved = true;
    if (gesture.moved) { cam.cx = gesture.cx - dx / cs; cam.cy = gesture.cy - dy / cs; applyCam(); }
  });
  function endPointer(ev) {
    if (!ptrs[ev.pointerId]) return;
    delete ptrs[ev.pointerId];
    if (!ptrList().length) {
      if (cam) {
        // Glide back if the map was pulled past its edge.
        cam.free = false;
        var lim = cam.limits, tx = lim ? Math.max(lim.minX, Math.min(lim.maxX, cam.cx)) : cam.cx, ty = lim ? Math.max(lim.minY, Math.min(lim.maxY, cam.cy)) : cam.cy;
        if (lim && (tx !== cam.cx || ty !== cam.cy)) { cam.settling = true; cam.anim = { cx: tx, cy: ty }; }
      }
      if (gesture && !gesture.moved && ev.type === 'pointerup') onTap(arrowAt(ev.clientX, ev.clientY));
      gesture = null;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  ['pointerup', 'pointercancel'].forEach(function (n) { window.addEventListener(n, function () { coopHoldEnd(n === 'pointerup'); }); });
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', function (ev) {
    if (!cam) return;
    ev.preventDefault();
    zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  $('zIn').onclick = function () { zoomAt(vw / 2, (viewTop + viewBottom) / 2, 1.3); };
  $('zOut').onclick = function () { zoomAt(vw / 2, (viewTop + viewBottom) / 2, 1 / 1.3); };
  $('zFit').onclick = function () { if (cam) { cam.anim = null; cam.zoom = null; cam.lastZoom = performance.now(); cam.cs = fitCs; applyCam(); } };

  function finish(won, why) {
    if (ended) return;
    ended = true; refresh();
    var c = current, secs = Math.max(1, Math.round(activeMs / 1000));
    var perfect = won && collisions === 0 && c.level.lives !== null;
    track(won ? 'level_complete' : 'level_fail', { launches: state.launches, collisions: collisions, seconds: secs, mode: c.mode, set: c.set, perfect: perfect, why: why });
    var stats = { secs: secs, perfect: perfect, launches: state.launches, livesLeft: state.lives, hits: collisions, hints: hintsUsed, rewinds: rewinds };
    if (won) {
      // Every map keeps a personal best, but only from a clean run: no collisions and no Rewind.
      // Open water boards never repeat, so there the best belongs to the map type.
      progress.records = progress.records || {};
      var pb = bestKey(c), ms = Math.round(activeMs);
      stats.clean = collisions === 0 && rewinds === 0;
      stats.elapsedMs = ms;
      stats.oldBest = progress.records[pb];
      if (stats.clean && (!stats.oldBest || ms < stats.oldBest)) { progress.records[pb] = ms; stats.newBest = true; track('personal_best', { ms: ms, map: pb }); }
      if (c.mode === 'levels') {
        progress.done[c.id] = true;
        if (perfect) progress.perfect[c.id] = true;
      } else if (c.mode === 'endless') progress.endlessBy[c.endlessKey] = (progress.endlessBy[c.endlessKey] || 0) + 1;
      else progress.daily = todayKey();
      save('unwind.progress2', progress);
      setTimeout(function () {
        victoryMusic(perfect);
        var mid = px([c.level.w / 2 - 0.5, c.level.h / 2 - 0.5]);
        [0, 240, 520].forEach(function (d) { addRipple(mid, colors.ink, 7, d); });
      }, 620);
    }
    setTimeout(function () { if (current === c) (won ? winSheet : failSheet)(c, stats, why); }, won ? 1750 : 620);
  }

  /* ---------- Sheets ---------- */
  // Closing plays the opening in reverse: side menus slide back out, the others fade away.
  function closeSheet() {
    var host = $('sheetHost'), el = host.firstChild;
    if (!el) return;
    host.innerHTML = '';
    if (reduced || !el.classList || !el.classList.contains('sheet')) return;
    el.classList.add('closing');
    // The fading copy keeps no ids, so nothing can find or click it.
    el.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, el.classList.contains('side') ? 340 : 440);
  }
  // Changes inside an open menu swap its contents only, so the menu itself never fades out or moves.
  function sheetInPlace(html) {
    var host = $('sheetHost').firstChild, card = host && host.querySelector('.card');
    if (!card) return sheet(html, 'tall');
    var top = card.scrollTop;
    card.innerHTML = html;
    card.scrollTop = top;
    return host;
  }
  function sheet(html, cardClass) {
    $('sheetHost').innerHTML = '<div class="sheet"><div class="card ' + (cardClass || '') + '">' + html + '</div></div>';
    return $('sheetHost').firstChild;
  }
  // A small lakeside scene in the colours of the current time of day. Perfect clears release a sky of lanterns.
  function sceneSvg(perfect) {
    var ch = colors, night = ch === CHAPTERS[3] || ch === CHAPTERS[4], lanterns = '', flies = '', i;
    var xs = perfect ? [34, 78, 122, 202, 248, 292] : [262];
    xs.forEach(function (x, n) {
      lanterns += '<g class="rise" style="animation-delay:' + (n * 0.75) + 's"><rect x="' + (x - 5) + '" y="108" width="10" height="13" rx="4" fill="#ffc25e"/><rect x="' + (x - 3) + '" y="120" width="6" height="2" fill="#a45b1a"/><circle cx="' + x + '" cy="114" r="10" fill="#ffc25e" opacity=".22"/></g>';
    });
    [[60, 92], [104, 106], [176, 96], [238, 102]].forEach(function (p, n) {
      flies += '<circle class="fly" style="animation-delay:' + (n * 0.7) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="1.800" fill="#ffe28a"/>';
    });
    var stars = night ? '<g fill="#fff" opacity=".8"><circle cx="30" cy="20" r="1"/><circle cx="84" cy="34" r="1.200"/><circle cx="130" cy="14" r="1"/><circle cx="200" cy="26" r="1"/><circle cx="288" cy="18" r="1.300"/><circle cx="256" cy="44" r="1"/></g>' : '';
    return '<svg class="scene" viewBox="0 0 320 150" aria-hidden="true"><defs><linearGradient id="wsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ch.a + '"/><stop offset="1" stop-color="' + ch.b + '"/></linearGradient><clipPath id="wclip"><rect width="320" height="150"/></clipPath></defs><g clip-path="url(#wclip)">' +
      '<rect width="320" height="150" fill="url(#wsky)"/>' + stars +
      '<circle cx="232" cy="52" r="30" fill="' + ch.sun + '" opacity=".85"/>' +
      '<path d="M0 92 C50 62 96 70 140 88 S240 66 320 90 V150 H0Z" fill="#000" opacity=".2"/>' +
      '<path d="M0 104 C70 84 130 92 190 104 S290 92 320 102 V150 H0Z" fill="#000" opacity=".26"/>' +
      '<g><circle class="smoke" cx="104" cy="66" r="4" fill="#fff"/><circle class="smoke b" cx="104" cy="66" r="4" fill="#fff"/><circle class="smoke c" cx="104" cy="66" r="4" fill="#fff"/></g>' +
      '<rect x="100" y="68" width="7" height="16" fill="#3a2a2e"/>' +
      '<path d="M66 88 L90 66 L116 88Z" fill="#3a2a2e"/><rect x="72" y="86" width="38" height="24" fill="#4c363a"/>' +
      '<rect x="80" y="92" width="10" height="10" rx="1" fill="#ffd27a"/><rect x="96" y="94" width="9" height="16" rx="1" fill="#2b1e22"/>' +
      '<circle cx="85" cy="97" r="16" fill="#ffd27a" opacity=".16"/>' +
      '<path d="M0 110 H320 V150 H0Z" fill="' + ch.a + '"/><path d="M0 110 H320 V150 H0Z" fill="#17365c" opacity=".36"/>' +
      '<rect x="77" y="114" width="28" height="3" rx="1.500" fill="#ffd27a" opacity=".45"/><rect x="83" y="121" width="16" height="2.500" rx="1.200" fill="#ffd27a" opacity=".28"/>' +
      '<rect x="210" y="118" width="44" height="2.500" rx="1.200" fill="' + ch.sun + '" opacity=".6"/><rect x="220" y="127" width="24" height="2.500" rx="1.200" fill="' + ch.sun + '" opacity=".4"/>' +
      '<g class="boat" style="transform-origin:170px 122px"><path d="M152 116 H190 L183 126 H159Z" fill="#3a2a2e"/><rect x="170" y="94" width="2" height="23" fill="#3a2a2e"/><path d="M172 95 L188 112 H172Z" fill="#fff7ea"/></g>' +
      flies + lanterns + '</g></svg>';
  }
  function allLevelCount() { return Object.keys(SETS).reduce(function (n, k) { return n + SETS[k].length; }, 0); }
  function bestKey(c) { return c.mode === 'endless' ? 'open-' + c.endlessKey : c.id; }
  function recordText(ms) { var t = Math.round(ms / 100) / 10, m = Math.floor(t / 60), sec = t - m * 60; var txt = m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); return window.UnwindI18n.lang() === 'pt' ? txt.replace('.', ',') : txt; }
  function winSheet(c, st) {
    var hasNext = c.mode === 'levels' && c.index < SETS[c.set].length - 1;
    // The end of a group leads to the next group. Only the very last level leads to open water.
    var nextSet = c.mode === 'levels' && !hasNext ? SET_FLOW[SET_FLOW.indexOf(c.set) + 1] : null;
    var title = st.perfect ? 'Perfect!' : 'All clear';
    var lines = st.perfect ? ['You never lost a life.', 'Not one collision. Lovely.', 'Smooth as still water.']
      : c.level.lives === null ? ['Another calm stretch of water.'] : st.hits === 1 ? ['One small bump on the way.'] : [st.hits + ' bumps on the way, and you got there.'];
    var line = lines[Math.floor(Math.random() * lines.length)];
    var hearts = '';
    if (st.livesLeft !== null && c.level.lives <= 5) {
      for (var i = 0; i < c.level.lives; i++) hearts += heartSvg(i >= st.livesLeft ? 'gone' : '').replace('<svg ', '<svg style="animation-delay:' + (i * 0.12 + 0.2) + 's" ');
      hearts = '<div class="winhearts" role="img" aria-label="' + st.livesLeft + ' of ' + c.level.lives + ' lives left">' + hearts + '</div>';
    }
    var best = progress.records && progress.records[bestKey(c)], kind = c.mode === 'endless' ? ' for this map type' : '';
    var pbNote = st.newBest ? (st.oldBest ? 'Beat your old time of ' + recordText(st.oldBest) : 'Your first clean run' + kind)
      : !st.clean ? (best ? 'Runs with mistakes do not count' : 'Clear it with no mistakes to set one')
      : recordText(st.elapsedMs - best + 0) + ' behind it' + kind;
    var pbRow = '<div class="pb' + (st.newBest ? ' new' : '') + '"><span>' + (st.newBest ? 'New personal best!' : 'Personal best') + '</span><b>' + (best ? recordText(best) : '–') + '</b><small>' + pbNote + '</small></div>';
    var lit = Object.keys(progress.done).length, gold = Object.keys(progress.perfect).length, total = allLevelCount();
    var nextLabel = hasNext ? 'Next level' : nextSet ? 'On to ' + SET_INFO[nextSet].label + ' ' + (1 + (SET_INFO[nextSet].offset || 0)) : c.mode === 'levels' ? 'Onto the Open Waters' : c.mode === 'endless' ? 'Keep drifting' : 'Back to levels';
    var s = sheet(sceneSvg(st.perfect) +
      '<div class="verdict"><h2 class="' + (st.perfect ? 'gold' : '') + '">' + title + '</h2><p>' + line + '</p></div>' + hearts +
      '<div class="stats"><div><b>' + recordText(st.elapsedMs) + '</b><span>Time</span></div><div><b>' + st.launches + '</b><span>Launches</span></div><div><b>' + st.hints + '</b><span>Hints used</span></div></div>' + pbRow +
      '<div class="lanterns">' + lit + ' of ' + total + ' lanterns lit, ' + gold + ' golden<div class="lantern-bar"><i style="width:' + Math.round(lit / total * 100) + '%"></i></div></div>' +
      '<div class="actions"><button class="primary" id="next">' + nextLabel + '</button><button class="secondary" id="replayTune">Play my tune</button><button class="secondary" id="again">Play again</button><button class="secondary" id="winLevels">Levels</button></div>', 'win');
    s.querySelector('#next').onclick = function () {
      if (c.mode === 'levels') {
        if (hasNext) openLevel(c.set, c.index + 1);
        else if (nextSet) openLevel(nextSet, 0);
        else openEndless();
      } else if (c.mode === 'endless') openEndless();
      else levelsSheet('calm');
    };
    s.querySelector('#replayTune').onclick = function () { audio(); playTune(); };
    s.querySelector('#again').onclick = function () { if (c.coop && coop) coopRestart(); else begin(c); };
    s.querySelector('#winLevels').onclick = function () { levelsSheet(c.set || 'calm'); };
    s.querySelector('#next').focus({ preventScroll: true });
  }
  function failSheet(c, st, why) {
    var timeUp = why === 'time';
    var s = sheet('<h2>' + (timeUp ? "Time's up" : 'Out of lives') + '</h2><p>' + (timeUp ? 'The board was nearly there. Take a breath and go again.' : 'Take a moment, then try this board again.') + '</p><button class="primary" id="again">Try again</button><button class="secondary" id="toLevels">Choose another level</button>');
    s.querySelector('#again').onclick = function () { restart(); };
    s.querySelector('#toLevels').onclick = function () { levelsSheet(c.set || 'calm'); };
  }
  var STAR_PATH = '<path d="M12 2.500l2.900 6.100 6.600.900-4.800 4.600 1.200 6.600-5.900-3.200-5.900 3.200 1.200-6.600L2.500 9.500l6.600-.900Z"/>';
  var MOON_PATH = '<path d="M11.500 3.200a9 9 0 1 0 9.300 12.600A7.800 7.800 0 0 1 11.500 3.200Z"/><path d="M18 3l.9 2 2.100.300-1.500 1.500.4 2.100-1.900-1-1.900 1 .4-2.100L15 5.300l2.100-.300Z"/>';
  var STAR_MARK = '<svg class="mk s" viewBox="0 0 24 24" aria-hidden="true">' + STAR_PATH + '</svg>';
  var MOON_MARK = '<svg class="mk m" viewBox="0 0 24 24" aria-hidden="true">' + MOON_PATH + '</svg>';
  var CALM_SECTIONS = [['First steps', 0, 6], ['Twins', 6, 9], ['Compass', 9, 12], ['Sleepers', 12, 15], ['Mirrors', 15, 18], ['Patient', 18, 21], ['Ghost', 21, 24], ['Phase', 24, 27], ['Red card', 27, 30], ['Reverse', 30, 33], ['Everything together', 33, 36]];
  function levelsSheet(tab, inPlace) {
    tab = tab || (current && current.set) || 'calm';
    if (SET_INFO[tab] && SET_INFO[tab].season) tab = 'seasons';
    var html = '<div class="row"><h2>A day on the lake</h2><button class="close" id="x" aria-label="Close">×</button></div>';
    html += '<div class="tabs" role="tablist">' + [['calm', 'Calm'], ['hard', 'Hard'], ['timed', 'Timed'], ['seasons', 'Seasons']].map(function (k) { return '<button role="tab" aria-selected="' + (k[0] === tab) + '" data-tab="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
    var grid = function (set, from, to) {
      var out = '<div class="lv">', info = SET_INFO[set];
      for (var i = from; i < to; i++) {
        var id = info.prefix + (i + 1), shown = i + 1 + (info.offset || 0);
        out += '<button data-set="' + set + '" data-l="' + i + '" class="' + (progress.done[id] ? 'done ' : '') + (progress.perfect[id] ? 'perfect' : '') + '" aria-label="Level ' + shown + (progress.perfect[id] ? ', perfect' : progress.done[id] ? ', cleared' : '') + '">' + shown + (progress.done[id] ? MOON_MARK : '') + (progress.perfect[id] ? STAR_MARK : '') + '</button>';
      }
      return out + '</div>';
    };
    html += '<div class="legend"><span>' + MOON_MARK.replace('class="mk m"', 'fill="#9fd8ff"') + 'Completed</span><span>' + STAR_MARK.replace('class="mk s"', 'fill="#ffc21f"') + 'Perfect, no lives lost</span></div>';
    if (tab === 'calm') CALM_SECTIONS.forEach(function (sec) { html += '<div class="chapter">' + sec[0] + '</div>' + grid('calm', sec[1], sec[2]); });
    else if (tab === 'seasons') {
      var blurbs = { winter: '20% chance per launch that arrows freeze. Hit them to free them.', spring: 'Flowers block the way. Each launch, a bee takes one.', summer: '25% chance per launch that tiles catch fire.', autumn: '50% chance per launch that wind spins arrows.' };
      SEASON_ORDER.forEach(function (k) { html += '<div class="chapter">' + SET_INFO[k].label + '</div><p class="note">' + blurbs[k] + '</p>' + grid(k, 0, SETS[k].length); });
    } else {
      html += '<p class="note">' + (tab === 'hard' ? 'Two lives, no hints, and arrows with several effects at once.' : 'Beat the clock on every board. Three lives.') + '</p>' + grid(tab, 0, SETS[tab].length);
    }
    var bestList = function (set) {
      var info = SET_INFO[set], out = SETS[set].map(function (_, i) { var r = progress.records && progress.records[info.prefix + (i + 1)]; return r ? '<span>' + (i + 1 + (info.offset || 0)) + ' <b>' + recordText(r) + '</b></span>' : ''; }).join('');
      return out ? '<div class="chapter">' + (tab === 'seasons' ? info.label + ' personal bests' : 'Personal bests') + '</div><div class="records">' + out + '</div>' : '';
    };
    (tab === 'seasons' ? SEASON_ORDER : [tab]).forEach(function (k) { html += bestList(k); });
    html += '<div class="modes"><button id="mCoop"><b>Co-op test: 4 boards</b><span>Temporary. You control all four boards.</span></button><button id="mCoopBig"><b>Co-op test: big boards</b><span>Same test, each board three times the size.</span></button><button id="mLobby"><b>Co-op room (preview)</b><span>What the room host would see: players, code and settings.</span></button><button id="mTutSniper"><b>Tutorial: Sniper arrows</b><span>Two boards. You control both.</span></button><button id="mTutTwins"><b>Tutorial: Twin-shared arrows</b><span>Two boards. You control both.</span></button></div>';
    html += '<div class="modes"><button id="mDaily"><b>Today\'s puzzle</b><span>' + (progress.daily === todayKey() ? 'Cleared today. Play it again any time.' : 'One new board each day.') + '</span></button><div class="openbox"><button id="mOpen"><b>Open Water</b><span>' + openLabel() + '</span></button>' +
      '<div class="setting"><span id="lHard">Harder<small>2 lives, no hints, and arrows with several effects at once</small></span><button class="switch" id="oHard" role="switch" aria-labelledby="lHard" aria-checked="' + !!endlessOpts().hard + '"></button></div>' +
      '<div class="setting"><span id="lTimed">Timed<small>Clear each board before the clock runs out</small></span><button class="switch" id="oTimed" role="switch" aria-labelledby="lTimed" aria-checked="' + !!endlessOpts().timed + '"></button></div>' +
      '<div class="setting"><span>Season effects<small>Pick any number. Random uses 1 to 4 for each board.</small></span></div><div class="sizes seasons fx" role="group" aria-label="Season effects">' + [['winter', 'Winter'], ['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['none', 'None'], ['random', 'Random']].map(function (x) { var c = effectChoice(), on = x[0] === 'random' ? c.random : x[0] === 'none' ? !c.random && !c.list.length : !c.random && c.list.indexOf(x[0]) >= 0; return '<button data-effect="' + x[0] + '" aria-pressed="' + on + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="setting"><span>Background<small data-bgnote="You can also change it while playing.">' + bgNote('You can also change it while playing.') + '</small></span></div>' + backgroundButtons() +
      '<div class="setting"><span>Map size<small>Bigger maps can be zoomed and moved around</small></span></div><div class="sizes maps" role="group" aria-label="Map size">' + [1, 3, 5, 10, 25].map(function (x) { return '<button data-scale="' + x + '" aria-pressed="' + ((endlessOpts().scale || 1) === x) + '">' + (x === 1 ? '1x' : x + 'x') + '</button>'; }).join('') + '</div><button class="primary" id="mGo">Play Open Waters</button></div></div>';
    html += '<p class="note" style="margin:0;text-align:center">© 2026 Miguel Lima. All rights reserved.</p>';
    var s = inPlace ? sheetInPlace(html) : sheet(html, 'tall');
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { levelsSheet(b.getAttribute('data-tab'), true); var again = $('sheetHost').querySelector('[data-tab="' + b.getAttribute('data-tab') + '"]'); if (again) again.focus({ preventScroll: true }); }; });
    s.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { openLevel(b.getAttribute('data-set'), +b.getAttribute('data-l')); }; });
    s.querySelector('#mCoop').onclick = function () { openCoop(); };
    s.querySelector('#mCoopBig').onclick = function () { openCoop(0, true); };
    s.querySelector('#mLobby').onclick = function () { lobbySheet(); };
    s.querySelector('#mTutSniper').onclick = function () { openCoopTutorial('sniper'); };
    s.querySelector('#mTutTwins').onclick = function () { openCoopTutorial('twins'); };
    s.querySelector('#mDaily').onclick = openDaily;
    s.querySelector('#mOpen').onclick = function () { openEndless(); };
    s.querySelector('#mGo').onclick = function () {
      // Loading Open Water with the default background: the music follows the backgrounds.
      if (backgroundChoice() === 'default') audioPrefs.theme = 'auto';
      openEndless();
    };
    [['#oHard', 'hard'], ['#oTimed', 'timed']].forEach(function (pair) {
      s.querySelector(pair[0]).onclick = function () {
        var o = endlessOpts(); o[pair[1]] = !o[pair[1]]; progress.endlessOpts = o; save('unwind.progress2', progress);
        this.setAttribute('aria-checked', o[pair[1]]);
        s.querySelector('#mOpen span').textContent = openLabel();
      };
    });
    wireBackgrounds(s);
    s.querySelectorAll('[data-effect]').forEach(function (b) {
      b.onclick = function () {
        var o = endlessOpts(), c = effectChoice(), k = b.getAttribute('data-effect'), list = c.list.slice(), random = c.random;
        if (k === 'none') { list = []; random = false; }
        else if (k === 'random') { random = !random; if (random) list = []; }
        else { random = false; var at = list.indexOf(k); if (at >= 0) list.splice(at, 1); else list.push(k); }
        o.effectList = list; o.effectRandom = random; delete o.seasonChoice; progress.endlessOpts = o; save('unwind.progress2', progress);
        s.querySelectorAll('[data-effect]').forEach(function (x) { var e = x.getAttribute('data-effect'); x.setAttribute('aria-pressed', e === 'random' ? random : e === 'none' ? !random && !list.length : !random && list.indexOf(e) >= 0); });
      };
    });
    s.querySelectorAll('[data-scale]').forEach(function (b) {
      b.onclick = function () {
        var o = endlessOpts(); o.scale = +b.getAttribute('data-scale'); progress.endlessOpts = o; save('unwind.progress2', progress);
        s.querySelectorAll('[data-scale]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        s.querySelector('#mOpen span').textContent = openLabel();
      };
    });
  }
  function openLabel() {
    var o = endlessOpts(), size = (o.scale || 1) > 1 ? o.scale + 'x maps' : 'Endless boards';
    if (o.hard && o.timed) return size + ', harder and timed.';
    if (o.hard) return size + ', harder.';
    if (o.timed) return size + ' against the clock.';
    return (o.scale || 1) > 1 ? size + ' with no lives to lose.' : 'Endless boards with no lives to lose.';
  }
  // A side menu explaining every arrow, drawn in the colours they have on the board.
  /* ---------- Tutorials: a short looping demo of each mechanic, played by the real rules ---------- */
  function mechanicsOf(l) {
    var here = {};
    l.arrows.forEach(function (a) {
      if (a.kind === 'twin') here.twin = 1; if (a.kind === 'compass') here.compass = 1; if (a.ghostPhase !== undefined) here.ghost = 1; if (a.phase) here.phase = 1;
      if (a.uno !== undefined) here.uno = 1; if (a.red) here.red = 1; if (a.key !== undefined) here.sleeper = 1; if (a.wait) here.patient = 1;
    });
    if ((l.mirrors || []).length) here.mirror = 1;
    E.effectsOf(l).forEach(function (k) { here[{ winter: 'ice', summer: 'fire', spring: 'flower', autumn: 'wind' }[k]] = 1; });
    return Object.keys(E.TUTORIALS).filter(function (k) { return here[k]; });
  }
  // The very first level also explains the point of the game.
  function levelDemos() {
    if (current.coop && coop) {
      var mp = [];
      if (coop.boards.some(function (B) { return B.level.arrows.some(function (a) { return a.sniper; }); })) mp.push('sniper');
      if (coop.room.groups.length) mp.push('twinshared');
      return coop.room.tutorial === 'twins' ? mp.filter(function (k) { return k === 'twinshared'; }) : coop.room.tutorial === 'sniper' ? ['sniper'] : mp;
    }
    var combo = (current.set === 'hard' && current.index === 0) || current.level.arrows.some(function (a) { return E.traitCount(a) >= 2 && a.kind !== 'twin'; });
    return (current.set === 'calm' && current.index === 0 ? ['goal'] : []).concat(combo ? ['combo'] : [], mechanicsOf(current.level));
  }
  // Automated test browsers skip these unless asked, so they can play straight through.
  var holdTutorials = false, tutorialsOff = !!navigator.webdriver && location.hash.indexOf('tut') < 0;
  function maybeTutorials() {
    if (tutorialsOff || holdTutorials || !current) return;
    progress.tutorials = progress.tutorials || {};
    var fresh = levelDemos().filter(function (k) { return !progress.tutorials[k]; });
    if (fresh.length) showTutorial(fresh, 0, true);
  }
  function showTutorial(list, at, firstTime, after) {
    var key = list[at], d = tutDef(key), more = list.length > 1 ? '<span class="tutcount">' + (at + 1) + ' of ' + list.length + '</span>' : '';
    var s = sheet('<div class="row"><h2>' + d.title + '</h2>' + more + '</div><div class="tutbox"><canvas id="tutCanvas" role="img" aria-label="Animated example of ' + d.title + '"></canvas></div><p class="tutsay" id="tutSay" aria-live="off">&nbsp;</p><p>' + d.text + '</p><button class="primary" id="tutOk">Understood</button>', 'tutorial');
    var stop = (COOP_DEMOS[key] ? playCoopDemo : playDemo)(s.querySelector('#tutCanvas'), key, s.querySelector('#tutSay'));
    track('tutorial_open', { mechanic: key });
    s.querySelector('#tutOk').focus({ preventScroll: true });
    s.querySelector('#tutOk').onclick = function () {
      stop();
      if (firstTime) { progress.tutorials[key] = 1; save('unwind.progress2', progress); }
      if (at + 1 < list.length) { showTutorial(list, at + 1, firstTime, after); return; }
      closeSheet();
      if (firstTime) { introStart = performance.now(); prepareIntro(current.level); if (current.level.flowers && current.level.flowers.length) sendBee(state.launches, performance.now() + 900); }
      else if (after !== 'play') guideSheet();
    };
  }
  /* Multiplayer demos: two small boards side by side, each played by the real rules, with the cross-board parts added. */
  var COOP_DEMOS = {
    sniper: { title: 'Sniper arrow', text: 'Multiplayer only. When a sniper arrow leaves its board, it flies on to the next board and destroys the first arrow it hits there. The hit does not count as a move.', w: 4, h: 3, gap: 1.3,
      boards: [[[[[1, 1], [2, 1], [3, 1]], { sniper: true }], [[[0, 0], [1, 0]]]], [[[[0, 1], [1, 1]]], [[[3, 1], [2, 1]]]]],
      steps: [{ b: 1, tap: 1, say: 'These two arrows block each other' }, { b: 0, tap: 0, say: 'A sniper flies on to the next board' }, { b: 1, tap: 1, say: 'It destroyed the first arrow it hit' }, { b: 0, tap: 1, say: '' }] },
    twinshared: { title: 'Twin-shared arrows', text: 'Multiplayer only. Same colour, letter and a plus. They leave together with their twins on other boards, so every path must be clear. Hold one to see its twins.', w: 4, h: 4, gap: 1.3,
      boards: [[[[[1, 3], [1, 2]], { coopGroup: 0 }], [[[0, 1], [1, 1], [2, 1]]]], [[[[2, 3], [2, 2]], { coopGroup: 0 }], [[[0, 0], [0, 1]]]]],
      steps: [{ b: 1, tap: 0, say: 'Its twin on the other board is blocked' }, { b: 0, tap: 1, say: 'Clear the way on that board first' }, { b: 1, tap: 0, say: 'Now both leave together' }, { b: 1, tap: 1, say: '' }] }
  };
  function tutDef(key) { return E.TUTORIALS[key] || COOP_DEMOS[key]; }
  function playCoopDemo(canvas, key, sayEl) {
    var d = COOP_DEMOS[key], box = canvas.parentNode.getBoundingClientRect(), W = Math.max(200, box.width), H = Math.min(230, Math.max(170, W * 0.62)), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var g = canvas.getContext('2d'), alive = true, run, size, offX = [], offY;
    var restart = function () {
      run = { at: -1, phaseEnd: 0, pending: false, tapping: false, finished: 0, flights: [], cross: null, impacts: [], boards: d.boards.map(function (arrs) {
        var l = E.prepare({ w: d.w, h: d.h, lives: 99, mirrors: [], flowers: [], arrows: arrs.map(function (a, i) { return coopArrow(i, a[0], a[1]); }) });
        return { level: l, state: E.newState(l), bounces: {} };
      }) };
      size = Math.min(W / (2 * d.w + d.gap + 0.6), (H - 26) / (d.h + 0.6));
      var total = (2 * d.w + d.gap) * size;
      offX = [(W - total) / 2, (W - total) / 2 + (d.w + d.gap) * size]; offY = 22 + (H - 22 - d.h * size) / 2;
    };
    restart();
    var partnerOf = function (b, a) { var o = run.boards[1 - b]; return { B: o, a: o.level.arrows.filter(function (x) { return x.coopGroup === a.coopGroup; })[0] }; };
    var fly = function (b, m, r, now) {
      var pts = trackOf(m, r.check), len = lengthOf(m), travel = m.cells.length - 1 + r.check.dist + 8 + len;
      run.flights.push({ b: b, pts: pts, len: len, travel: travel, start: now, duration: Math.min(1400, 480 + travel * 42), color: arrowColor(m) });
    };
    var act = function (now) {
      var st = d.steps[run.at], B = run.boards[st.b], l = B.level, a = l.arrows[st.tap];
      run.pending = false; run.tapping = false; run.phaseEnd = now + 1350;
      if (a.coopGroup !== undefined) {
        var P = partnerOf(st.b, a), ca = E.check(l, B.state, a), cp = E.check(P.B.level, P.B.state, P.a);
        if (ca.clear && cp.clear) {
          [[st.b, B, a], [1 - st.b, P.B, P.a]].forEach(function (x) { var res = E.tap(x[1].level, x[1].state, x[2].id); res.results.forEach(function (r) { fly(x[0], x[1].level.arrows[r.id], r, now); }); });
        } else [[B, a, ca], [P.B, P.a, cp]].forEach(function (x) { x[0].bounces[x[1].id] = { start: now, reach: x[2].clear ? 0.18 : Math.max(0.14, x[2].dist - 0.62), pts: trackOf(x[1], x[2]) }; });
        return;
      }
      var res = E.tap(l, B.state, a.id);
      if (!res.ok) { res.results.forEach(function (r) { var m = l.arrows[r.id]; B.bounces[r.id] = { start: now, reach: r.check.clear ? 0.18 : Math.max(0.14, r.check.dist - 0.62), pts: trackOf(m, r.check) }; }); return; }
      res.results.forEach(function (r) {
        var m = l.arrows[r.id];
        if (!m.sniper) { fly(st.b, m, r, now); return; }
        // The sniper keeps going: out of this board, across the gap and into the next one.
        var head = E.headOf(m), y = head[1], T = run.boards[1], hit = -1, j;
        for (j = 0; j < d.w; j++) { var o = T.level.grid[y * d.w + j]; if (o !== -1 && !T.state.removed[o]) { hit = o; break; } }
        var endX = hit >= 0 ? d.w + d.gap + j - 0.55 : 2 * d.w + d.gap + 3, len = lengthOf(m);
        run.cross = { pts: m.cells.concat([[endX + 0.001, y]]), len: len, dist: endX - head[0], start: now, duration: 1100, hit: hit, at: [d.w + d.gap + j, y] };
        run.phaseEnd = now + 2000;
      });
    };
    var nextStep = function (now) {
      run.at++;
      if (run.at >= d.steps.length) { run.finished = now + 1300; return; }
      var st = d.steps[run.at];
      if (sayEl) sayEl.textContent = st.say || '\u00a0';
      run.tapping = true; run.pending = true; run.phaseEnd = now + 950;
    };
    var drawArrowAt = function (B, a, now) {
      var color = arrowColor(a), b = B.bounces[a.id], shift = 0;
      if (b) { var bt = (now - b.start) / 440; if (bt >= 1) delete B.bounces[a.id]; else shift = Math.sin(bt * Math.PI) * b.reach; }
      var len = lengthOf(a), tip = E.headOf(a), td = a.dir, pts = b && b.pts ? b.pts : a.cells.concat([[tip[0] + E.DX[td] * 2, tip[1] + E.DY[td] * 2]]);
      var w = Math.max(3, cs * 0.17);
      setStroke(color, w, 1);
      var res = strokeWindow(pts, shift, shift + len);
      chevron(res.end, res.tan, cs * 0.24);
      drawTraits(a, pts, shift, len, color, false, 1, now);
    };
    var draw = function (now) {
      var keep = [ctx, ox, oy, cs, vw, vh, state, current, coop];
      ctx = g; cs = size; vw = W; vh = H; oy = offY; coop = coop || { room: { groups: [] }, demo: true };
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        if (!run.finished && run.at < 0) nextStep(now);
        if (run.finished && now > run.finished) { restart(); cs = size; oy = offY; nextStep(now); }
        if (!run.finished && now > run.phaseEnd) { if (run.pending) act(now); else nextStep(now); }
        var w = Math.max(3, cs * 0.17);
        run.boards.forEach(function (B, bi) {
          ox = offX[bi]; state = B.state; current = { level: B.level };
          ctx.globalAlpha = 1; ctx.fillStyle = mixColor(colors.card, colors.ink, 0.07); ctx.strokeStyle = mixColor(colors.card, colors.ink, 0.25); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.roundRect(ox - cs * 0.15, oy - cs * 0.15, d.w * cs + cs * 0.3, d.h * cs + cs * 0.3, cs * 0.3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.8; ctx.font = '600 12px Figtree,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(bi ? 'Bruno' : 'Ana', ox + d.w * cs / 2, oy - cs * 0.15 - 6);
          ctx.globalAlpha = 0.16;
          for (var y = 0; y < d.h; y++) for (var x = 0; x < d.w; x++) { var dp = px([x, y]); ctx.beginPath(); ctx.arc(dp.x, dp.y, Math.max(1.4, cs * 0.04), 0, 7); ctx.fill(); }
        });
        // A dashed thread between twins on different boards.
        var t0 = run.boards[0].level.arrows.filter(function (a) { return a.coopGroup !== undefined && !run.boards[0].state.removed[a.id]; })[0];
        if (t0) {
          var t1 = partnerOf(0, t0).a;
          ox = offX[0]; var m1 = pointAlong(t0.cells, lengthOf(t0) / 2); ox = offX[1]; var m2 = pointAlong(t1.cells, lengthOf(t1) / 2);
          setStroke(arrowColor(t0), Math.max(1.5, cs * 0.05), 0.5); ctx.setLineDash([cs * 0.08, cs * 0.14]); ctx.lineDashOffset = -now / 60;
          ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
        run.boards.forEach(function (B, bi) {
          ox = offX[bi]; state = B.state; current = { level: B.level };
          B.level.arrows.forEach(function (a) { if (!B.state.removed[a.id]) drawArrowAt(B, a, now); });
        });
        run.flights = run.flights.filter(function (fl) {
          var tn = (now - fl.start) / fl.duration;
          if (tn >= 1) return false;
          ox = offX[fl.b];
          var tr = fl.travel * (0.28 * tn + 0.72 * tn * tn);
          ctx.save(); ctx.beginPath(); ctx.rect(ox - cs * 0.15, oy - cs * 0.15, d.w * cs + cs * 0.3, d.h * cs + cs * 0.3); ctx.clip();
          setStroke(fl.color, w, 1); var rs = strokeWindow(fl.pts, tr, tr + fl.len); chevron(rs.end, rs.tan, cs * 0.24);
          ctx.restore();
          return true;
        });
        if (run.cross) {
          var c = run.cross, ct = Math.min(1, (now - c.start) / c.duration), tr2 = c.dist * (0.3 * ct + 0.7 * ct * ct);
          ox = offX[0]; state = run.boards[0].state;
          sniperGlow(c.pts, tr2, tr2 + c.len, w, now);
          setStroke(arrowColor({ sniper: true }), w, 1);
          var rc = strokeWindow(c.pts, tr2, tr2 + c.len); chevron(rc.end, rc.tan, cs * 0.24);
          sniperSparks(c.pts, tr2, tr2 + c.len, rc, now);
          if (ct >= 1) {
            if (c.hit >= 0) { run.boards[1].state.removed[c.hit] = true; ox = offX[1]; run.impacts.push({ p: px([c.at[0] - d.w - d.gap, c.at[1]]), start: now }); }
            run.cross = null;
          }
        }
        run.impacts = run.impacts.filter(function (f) {
          var t = (now - f.start) / 600;
          if (t >= 1) return false;
          ctx.globalAlpha = 1 - t; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.p.x, f.p.y, cs * (0.2 + t * 0.6), 0, 7); ctx.fill();
          for (var k = 0; k < 8; k++) { var a4 = k * 0.79 + 0.3, d4 = cs * (0.2 + t * 1.1); ctx.fillStyle = k % 2 ? '#d4161f' : colors.ink; ctx.fillRect(f.p.x + Math.cos(a4) * d4 - cs * 0.05, f.p.y + Math.sin(a4) * d4 - cs * 0.03, cs * 0.1, cs * 0.06); }
          return true;
        });
        if (run.tapping && run.pending) {
          var st = d.steps[run.at], B = run.boards[st.b], aim = B.level.arrows[st.tap];
          if (aim && !B.state.removed[aim.id]) {
            ox = offX[st.b];
            var left = Math.max(0, (run.phaseEnd - now) / 950), pc = pointAlong(aim.cells, lengthOf(aim) / 2);
            ctx.globalAlpha = 0.9 * (1 - left * 0.5); ctx.strokeStyle = colors.hint; ctx.lineWidth = Math.max(2.5, cs * 0.08);
            ctx.beginPath(); ctx.arc(pc.x, pc.y, cs * (0.42 + left * 0.5), 0, 7); ctx.stroke();
            ctx.globalAlpha = 0.28 * (1 - left); ctx.fillStyle = colors.hint; ctx.beginPath(); ctx.arc(pc.x, pc.y, cs * 0.42, 0, 7); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } finally {
        ctx = keep[0]; ox = keep[1]; oy = keep[2]; cs = keep[3]; vw = keep[4]; vh = keep[5]; state = keep[6]; current = keep[7]; coop = keep[8];
      }
    };
    var loop = function (now) { if (!alive || !canvas.isConnected) return; draw(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return function () { alive = false; };
  }
  function playDemo(canvas, key, sayEl) {
    var box = canvas.parentNode.getBoundingClientRect(), W = Math.max(200, box.width), H = Math.min(230, Math.max(170, W * 0.68)), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var g = canvas.getContext('2d'), alive = true, run;
    var restart = function () {
      var t = E.tutorialStart(key);
      run = { level: t.level, state: t.state, steps: t.steps, end: t.end, at: -1, phaseEnd: 0, tapping: false, flights: [], bounces: {}, nudges: {}, flips: {}, bees: [], windAt: 0, ripples: [] };
      run.csize = Math.min(W / (run.level.w + 0.6), H / (run.level.h + 0.6));
    };
    restart();
    var nextStep = function (now) {
      run.at++;
      if (run.at >= run.steps.length) { if (run.end && sayEl) sayEl.textContent = run.end; run.finished = now + (run.end ? 1900 : 1100); return; }
      var st = run.steps[run.at];
      if (sayEl) sayEl.textContent = st.say || '\u00a0';
      run.tapping = st.tap !== undefined; run.pending = true;
      run.phaseEnd = now + (run.tapping ? 950 : st.quick ? 120 : 700);
    };
    var act = function (now) {
      var st = run.steps[run.at], l = run.level, sv = run.state;
      run.tapping = false; run.pending = false; run.phaseEnd = now + 1350;
      if (st.spin !== undefined) {
        var a = l.arrows[st.spin];
        E.tutorialSpin(l, st.spin); a.rot = { start: now, turn: Math.PI / 2 }; run.windAt = now;
        run.phaseEnd = now + 1400; return;
      }
      var res = E.tap(l, sv, st.tap);
      if (res.notReady) { run.nudges[st.tap] = now + 500; run.acted = true; return; }
      if (res.ok) {
        res.results.forEach(function (r) {
          var m = l.arrows[r.id], pts = trackOf(m, r.check), len = lengthOf(m), body = m.kind === 'compass' ? 0 : m.cells.length - 1, travel = body + r.check.dist + screenCells() + len;
          run.flights.push({ pts: pts, len: len, travel: travel, start: now, duration: Math.min(1400, 480 + travel * 42), color: arrowColor(m) });
        });
        l.arrows.forEach(function (x) { if (x.uno !== undefined) run.flips[x.id] = now; });
        // The launch and the gust happen together.
        if (st.spinWith !== undefined) { E.tutorialSpin(l, st.spinWith); l.arrows[st.spinWith].rot = { start: now, turn: Math.PI / 2 }; run.windAt = now; run.phaseEnd = now + 1500; }
        var taken = l.flowers && l.flowers[sv.launches - 1];
        if (taken) run.bees.push({ at: taken, start: now });
      } else res.results.forEach(function (r) {
        var m = l.arrows[r.id];
        run.bounces[r.id] = { start: now, reach: r.check.clear ? 0.18 : Math.max(0.14, r.check.dist - 0.62), pts: m.kind === 'compass' ? null : trackOf(m, r.check) };
      });
      run.acted = true;
    };
    var draw = function (now) {
      var keep = [ctx, ox, oy, cs, vw, vh, state, current, windAt];
      ctx = g; cs = run.csize; vw = W; vh = H; ox = (W - run.level.w * cs) / 2; oy = (H - run.level.h * cs) / 2;
      state = run.state; current = { level: run.level }; windAt = run.windAt;
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        if (!run.finished && run.at < 0) nextStep(now);
        if (run.finished && now > run.finished) { restart(); nextStep(now); state = run.state; current = { level: run.level }; }
        var l = run.level, sv = run.state, w = Math.max(3, cs * 0.17);
        if (!run.finished && now > run.phaseEnd) { if (run.pending) act(now); else nextStep(now); }
        ctx.globalAlpha = 0.16; ctx.fillStyle = colors.ink;
        for (var y = 0; y < l.h; y++) for (var x = 0; x < l.w; x++) { var dp = px([x, y]); ctx.beginPath(); ctx.arc(dp.x, dp.y, Math.max(1.4, cs * 0.04), 0, 7); ctx.fill(); }
        (l.flowers || []).forEach(function (f, i) { if (i >= sv.launches) drawFlower(px(f), cs * 0.47, f[0] * 7 + f[1] * 3, now, true); });
        (l.mirrors || []).forEach(function (m) {
          var c = px([m.x, m.y]), r = cs * 0.36, sg = m.t === '/' ? -1 : 1;
          setStroke(colors.mirror, Math.max(3, cs * 0.13), 1); ctx.beginPath(); ctx.moveTo(c.x - r, c.y - r * sg); ctx.lineTo(c.x + r, c.y + r * sg); ctx.stroke();
          setStroke(colors.mirror, Math.max(1, cs * 0.035), 0.55); ctx.beginPath(); ctx.arc(c.x, c.y, cs * 0.46, 0, 7); ctx.stroke();
        });
        if (Object.keys(sv.burning).length) drawFires(now);
        // Golden thread from star to moon.
        l.arrows.forEach(function (a) {
          if (a.key === undefined || sv.removed[a.id] || sv.removed[a.key]) return;
          var moon = px(a.cells[0]), star = px(l.arrows[a.key].cells[0]);
          setStroke(SKY_GOLD, Math.max(1.5, cs * 0.045), 0.75); ctx.setLineDash([cs * 0.03, cs * 0.2]); ctx.lineDashOffset = -now / 45;
          ctx.beginPath(); ctx.moveTo(star.x, star.y); ctx.lineTo(moon.x, moon.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        });
        l.arrows.forEach(function (a) {
          if (a.kind !== 'twin' || a.twin < a.id || sv.removed[a.id]) return;
          var m1 = pointAlong(a.cells, lengthOf(a) / 2), m2 = pointAlong(l.arrows[a.twin].cells, lengthOf(a) / 2);
          setStroke(arrowColor(a), Math.max(1.5, cs * 0.05), 0.55); ctx.setLineDash([cs * 0.08, cs * 0.14]); ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); ctx.setLineDash([]);
        });
        l.arrows.forEach(function (a) {
          if (sv.removed[a.id]) return;
          var color = arrowColor(a), isReady = E.isReady(sv, a), frozen = sv.frozen[a.id] !== undefined, ghostForm = E.isGhost(sv, a), carded = E.isRedCarded(sv, a), b = run.bounces[a.id], shift = 0;
          if (b) { var bt = (now - b.start) / 440; if (bt >= 1) delete run.bounces[a.id]; else shift = Math.sin(bt * Math.PI) * b.reach; }
          if (carded) color = mixColor(color, '#c8202f', 0.55);
          var alpha = ghostForm ? 0.3 : isReady || frozen ? 1 : 0.62, nudge = run.nudges[a.id] && now < run.nudges[a.id] ? Math.sin((run.nudges[a.id] - now) / 40) * cs * 0.05 : 0;
          ctx.save(); ctx.translate(nudge, 0);
          if (a.rot) { var rt = (now - a.rot.start) / 800; if (rt >= 1) delete a.rot; else { var piv = px(a.cells[0]); ctx.translate(piv.x, piv.y); ctx.rotate(-a.rot.turn * (1 - ease(Math.max(0, rt)))); ctx.translate(-piv.x, -piv.y); } }
          if (a.kind === 'compass') {
            var c = px(a.cells[0]), r = cs * 0.37, target = (a.dir + sv.launches) * 90;
            setStroke(color, Math.max(1.5, cs * 0.05), 0.6); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.stroke();
            a.vis = a.vis === undefined ? target : a.vis + (target - a.vis) * 0.11;
            var rad = a.vis * Math.PI / 180, ux = Math.sin(rad), uy = -Math.cos(rad), off = shift * cs, hx = c.x + ux * (r * 0.62 + off), hy = c.y + uy * (r * 0.62 + off);
            setStroke(color, w, 1); ctx.beginPath(); ctx.moveTo(c.x - ux * r * 0.5 + ux * off, c.y - uy * r * 0.5 + uy * off); ctx.lineTo(hx, hy); ctx.stroke();
            chevron({ x: hx, y: hy }, [ux, uy], cs * 0.2); ctx.restore(); return;
          }
          var len = lengthOf(a), fromTail = E.tipAtTail(sv, a), rest = fromTail ? a.cells.slice().reverse() : a.cells, tip = rest[rest.length - 1], td = E.dirOf(a, sv);
          var pts = b && b.pts ? b.pts : rest.concat([[tip[0] + E.DX[td] * 2, tip[1] + E.DY[td] * 2]]);
          setStroke(color, w, alpha);
          if (!isReady && !frozen) ctx.setLineDash([cs * 0.18, cs * 0.3]);
          var res = strokeWindow(pts, shift, shift + len);
          ctx.setLineDash([]); setStroke(color, w, alpha);
          if (a.uno !== undefined && !shift) {
            var ft = run.flips[a.id] ? Math.min(1, (now - run.flips[a.id]) / 240) : 1, ff = ease(ft), far = px(rest[0]), near = px(rest[1]), gone = Math.hypot(far.x - near.x, far.y - near.y) || 1;
            setStroke(color, Math.max(1.5, cs * 0.05), alpha * 0.55); chevron(far, [(far.x - near.x) / gone, (far.y - near.y) / gone], cs * 0.2);
            setStroke(color, w, alpha); chevron(res.end, res.tan, cs * 0.24 * (0.4 + 0.6 * ff + 0.35 * Math.sin(ft * Math.PI)));
          } else chevron(res.end, res.tan, cs * 0.24);
          var centre = pointAlong(pts, shift + len / 2), tail = px(a.cells[0]);
          drawTraits(a, pts, shift, len, color, ghostForm, 1, now);
          if (a.isKey) { drawStar(tail, cs * 0.34, now); pairTag(tail, cs * 0.34, 1); }
          if (a.key !== undefined && !sv.removed[a.key]) { drawMoon(tail, cs * 0.34, now); pairTag(tail, cs * 0.34, 1); }
          if (frozen) drawIce(centre, cs * 0.3);
          ctx.restore();
        });
        run.flights = run.flights.filter(function (fl) {
          var tn = (now - fl.start) / fl.duration;
          if (tn >= 1) return false;
          var tr = fl.travel * (0.28 * tn + 0.72 * tn * tn);
          setStroke(fl.color, w, 1);
          var rs = strokeWindow(fl.pts, tr, tr + fl.len);
          chevron(rs.end, rs.tan, cs * 0.24);
          return true;
        });
        run.bees = run.bees.filter(function (b2) {
          var t2 = (now - b2.start) / 1000;
          if (t2 >= 1) return false;
          var from = px(b2.at), bx = from.x + (W + 40 - from.x) * t2 * t2, by = from.y - cs * 0.3 - t2 * cs;
          drawFlower({ x: bx, y: by + cs * 0.35 }, cs * 0.3, b2.at[0] * 7 + b2.at[1] * 3, now, false);
          drawBeeAt(bx, by, cs / 40, now, true, false);
          return true;
        });
        // The bee waits on the flower it will carry away next.
        var nextFlower = l.flowers && l.flowers[sv.launches];
        if (nextFlower) { var nf = px(nextFlower); drawBeeAt(nf.x + Math.sin(now / 420) * cs * 0.05, nf.y - cs * 0.3 + Math.sin(now / 300) * cs * 0.04, cs / 40, now, true, false); }
        if (run.windAt) { windAt = run.windAt; drawWind(now); run.windAt = windAt; }
        // A soft ring shows which arrow is about to be tapped.
        if (run.tapping) {
          var aim = run.steps[run.at] && l.arrows[run.steps[run.at].tap];
          if (aim) {
            var left = Math.max(0, (run.phaseEnd - now) / 950), pc = pointAlong(aim.cells, lengthOf(aim) / 2);
            ctx.globalAlpha = 0.9 * (1 - left * 0.5); ctx.strokeStyle = colors.hint; ctx.lineWidth = Math.max(2.5, cs * 0.08);
            ctx.beginPath(); ctx.arc(pc.x, pc.y, cs * (0.42 + left * 0.5), 0, 7); ctx.stroke();
            ctx.globalAlpha = 0.28 * (1 - left); ctx.fillStyle = colors.hint; ctx.beginPath(); ctx.arc(pc.x, pc.y, cs * 0.42, 0, 7); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } finally {
        ctx = keep[0]; ox = keep[1]; oy = keep[2]; cs = keep[3]; vw = keep[4]; vh = keep[5]; state = keep[6]; current = keep[7]; windAt = keep[8];
      }
    };
    var loop = function (now) { if (!alive || !canvas.isConnected) return; draw(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return function () { alive = false; };
  }
  // Tapping a level's explanation plays its demo again.
  $('caption').addEventListener('click', function () {
    var go = $('caption').getAttribute('data-goto');
    if (go !== null && current && current.coop) { coopSwitch(+go); return; }
    if (!$('caption').classList.contains('watchable') || ended || !current) return;
    showTutorial(current.set === 'hard' && current.index === 0 ? ['combo'] : levelDemos(), 0, false, 'play');
  });
  function guideSheet() {
    var ink = colors.ink, twin = colors.twins[0], comp = colors.compass, mir = colors.mirror, gold = '#ffd23f', disc = '#1d2350', card = colors.card;
    var head = function (x, y, c) { return '<path d="M' + (x - 7) + ' ' + (y - 7) + ' L' + x + ' ' + y + ' L' + (x - 7) + ' ' + (y + 7) + '" stroke="' + c + '" stroke-width="4.5"/>'; };
    var badge = function (x, y, fill, text, label, edge) { return '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + fill + '"' + (edge ? ' stroke="' + edge + '" stroke-width="2"' : '') + '/><text x="' + x + '" y="' + (y + 4.500) + '" text-anchor="middle" font-size="13" font-weight="600" fill="' + text + '" stroke="none">' + label + '</text>'; };
    var nightDisc = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="11" fill="' + disc + '" stroke="' + gold + '" stroke-width="2"/>'; };
    var line = function (d, c, dash) { return '<path d="' + d + '" stroke="' + c + '" stroke-width="4.500"' + (dash ? ' stroke-dasharray="6 7"' : '') + '/>'; };
    var moon = '<path d="M16 16.500a7 7 0 1 0 5.500 11A6 6 0 0 1 16 16.500Z" fill="' + gold + '"/>';
    var star = '<path d="M14 15.500l2.100 4.500 4.900.600-3.600 3.400.9 4.900-4.300-2.400-4.300 2.400.9-4.900L7 20.600l4.900-.600Z" fill="' + gold + '"/>';
    var items = [
      { key: 'gold', title: 'Golden arrow', text: 'Only appears if arrows truly block each other. It sparkles, hums and can fly through anything, so the board can always be cleared.',
        art: line('M4 23H50', '#e0a100') + head(56, 23, '#e0a100') + '<path d="M18 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM40 26l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#ffd23f"/>' },
      { key: 'plain', title: 'Arrow', text: 'Tap it to send it off the board. If something is in its way, it bounces back and costs a life.',
        art: line('M6 36H26V12H50', ink) + head(55, 12, ink) },
      { key: 'twin', title: 'Twins', text: 'Same colour and letter. They leave together, so both of their paths must be clear.',
        art: line('M4 12H46', twin) + head(52, 12, twin) + badge(24, 12, twin, card, 'A') + line('M4 36H46', twin) + head(52, 36, twin) + badge(24, 36, twin, card, 'A') },
      { key: 'compass', title: 'Compass', text: 'Turns a quarter clockwise each time an arrow leaves. The wrong order can leave you stuck, so use Rewind.',
        art: '<circle cx="31" cy="23" r="19" stroke="' + comp + '" stroke-width="2.500"/>' + line('M21 23H38', comp) + head(44, 23, comp) },
      { key: 'moon', title: 'Moon arrow', text: 'Asleep and dashed. It cannot move until the star arrow with the same number leaves. Tapping it early costs nothing.',
        art: line('M16 23H50', ink, true) + head(56, 23, ink) + nightDisc(14, 23) + moon },
      { key: 'star', title: 'Star arrow', text: 'When it leaves, it wakes the moon arrow with the same number, at the other end of its golden thread.',
        art: line('M16 23H50', ink) + head(56, 23, ink) + nightDisc(14, 23) + star },
      { key: 'mirror', title: 'Mirror', text: 'Not an arrow. It turns any arrow passing through by 90 degrees, so follow the new path.',
        art: '<circle cx="31" cy="23" r="19" stroke="' + mir + '" stroke-width="1.500" opacity=".6"/>' + line('M18 36L44 10', mir) },
      { key: 'patient', title: 'Patient arrow', text: 'Its number shows how many more launches it needs before it can leave. Tapping it early costs nothing.',
        art: line('M4 23H50', ink, true) + head(56, 23, ink) + badge(28, 23, card, ink, '3', ink) },
      { key: 'ghost', title: 'Ghost arrow', text: 'Swaps form after every launch. See-through as a ghost: it cannot be played, and other arrows pass through it. Solid: it plays and blocks like any arrow.',
        art: line('M4 23H50', ink, false) + head(56, 23, ink) + '<path d="M18 33V20a10 10 0 0 1 20 0v13l-3.300-3-3.300 3-3.400-3-3.400 3-3.300-3Z" fill="#fff" stroke="#55607a" stroke-width="1.500"/><circle cx="24" cy="20" r="1.700" fill="#2a3048"/><circle cx="32" cy="20" r="1.700" fill="#2a3048"/>' },
      { key: 'uno', title: 'Reverse arrow', text: 'Orange. Its tip swaps to the other end after every launch, and the faint mark shows where it goes next. Play it when the end it points from has a clear way out.',
        art: line('M4 23H50', '#c85a00') + head(56, 23, '#c85a00') + '<path d="M6 16l-5 7 5 7" fill="none" stroke="#c85a00" stroke-width="1.800" opacity=".6"/><circle cx="28" cy="23" r="10" fill="' + card + '" stroke="#c85a00" stroke-width="1.800"/><path d="M22 20h12m-3-3 3 3-3 3M34 26H22m3-3-3 3 3 3" stroke="#c85a00" stroke-width="1.600" fill="none"/>' },
      { key: 'phase', title: 'Phase arrow', text: 'Purple. Can slip through one occupied tile on its way out, whether an arrow, a flower or fire, but not two in a row.',
        art: line('M4 23H50', '#7a3fd0') + head(56, 23, '#7a3fd0') + '<circle cx="28" cy="23" r="10" fill="' + card + '" stroke="#7a3fd0" stroke-width="1.800"/><circle cx="24.500" cy="23" r="4.500" stroke="#7a3fd0" stroke-width="1.500"/><circle cx="31.500" cy="23" r="4.500" stroke="#7a3fd0" stroke-width="1.500"/>' },
      { key: 'red', title: 'Red card arrow', text: 'Play it before its count reaches zero. If not, it is sent off: it cannot move until only sent-off arrows remain, and it can block the rest. Rewind if that traps you.',
        art: line('M4 23H50', ink) + head(56, 23, ink) + badge(28, 23, card, ink, '3', ink) + '<rect x="31" y="23" width="14" height="20" rx="2" fill="#d4161f" stroke="#fff"/>' },
      { key: 'ice', title: 'Frozen arrow', text: 'Winter. It cannot move, and it blocks others. It thaws by itself after 3 to 5 launches, or hit it with another arrow to free it sooner, at no cost.',
        art: line('M4 23H50', '#3f9fd8') + head(56, 23, '#3f9fd8') + '<circle cx="28" cy="23" r="11" fill="#e4f5ff" stroke="#2f8fd0" stroke-width="2"/><path d="M28 15v16M21 19l14 8M35 19l-14 8" stroke="#2f8fd0" stroke-width="1.800"/>' },
      { key: 'fire', title: 'Burning tile', text: 'Summer. Blocks arrows for 2 to 4 launches. Hitting it costs a life.',
        art: '<rect x="14" y="4" width="36" height="38" rx="6" fill="#ff5a12" opacity=".3"/><path d="M20 38C16 26 32 22 31 8 44 20 46 30 42 38Z" fill="#ff5a12"/><path d="M26 38C24 30 32 28 33 20 39 28 40 33 37 38Z" fill="#ffc61a"/>' },
      { key: 'flower', title: 'Flower and bee', text: 'Spring. Flowers block arrows, and hitting one costs a life. After each launch, the bee carries its flower away.',
        art: '<g fill="#f06ca8"><circle cx="20" cy="15" r="7"/><circle cx="30" cy="23" r="7"/><circle cx="26" cy="34" r="7"/><circle cx="14" cy="34" r="7"/><circle cx="10" cy="23" r="7"/></g><circle cx="20" cy="26" r="6" fill="#ffd23f"/><ellipse cx="46" cy="12" rx="10" ry="7" fill="#ffc61a" stroke="#2a2008"/><path d="M42 5v14M48 5v14" stroke="#2a2008" stroke-width="3"/><ellipse cx="44" cy="3" rx="5" ry="3" fill="#fff" stroke="#667"/>' },
      { key: 'wind', title: 'Wind', text: 'Autumn. Can spin an arrow fully around its tail if there is room. Short arrows spin most often, and more can turn as the board clears.',
        art: '<path d="M4 16h34a7 7 0 1 0-7-7M4 26h44a7 7 0 1 1-7 7M4 36h20" stroke="' + ink + '" stroke-width="4"/>' }
    ];
    var watchKey = { plain: 'goal', moon: 'sleeper', star: 'sleeper', twin: 'twin', compass: 'compass', mirror: 'mirror', patient: 'patient', ghost: 'ghost', phase: 'phase', red: 'red', uno: 'uno', ice: 'ice', fire: 'fire', flower: 'flower', wind: 'wind' };
    var here = {}, arrows = current.level.arrows;
    arrows.forEach(function (a) {
      if (a.kind === 'twin') here.twin = 1; else if (a.kind === 'compass') here.compass = 1; else here.plain = 1;
      if (a.ghostPhase !== undefined) here.ghost = 1; if (a.phase) here.phase = 1; if (a.uno !== undefined) here.uno = 1; if (a.red) here.red = 1; if (a.key !== undefined) here.moon = 1; if (a.isKey) here.star = 1; if (a.wait) here.patient = 1;
    });
    if (goldAlive()) here.gold = 1;
    if ((current.level.mirrors || []).length) here.mirror = 1;
    E.effectsOf(current.level).forEach(function (k) { here[{ winter: 'ice', summer: 'fire', spring: 'flower', autumn: 'wind' }[k]] = 1; });
    var row = function (it) {
      return '<div class="guide-item"><svg viewBox="0 0 62 46" aria-hidden="true">' + it.art + '</svg><div><h3>' + it.title + (here[it.key] ? '<span class="onboard">On this board</span>' : '') + '</h3><p>' + it.text + '</p>' + (watchKey[it.key] ? '<button class="watch" data-watch="' + watchKey[it.key] + '">▶ Watch how it works</button>' : '') + '</div></div>';
    };
    var SEASONAL = { ice: 1, fire: 1, flower: 1, wind: 1 }, seasonHere = items.some(function (it) { return SEASONAL[it.key] && here[it.key]; });
    var html = '<div class="row"><h2>Arrow guide</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      '<details class="mpx" open><summary>Generic arrows</summary>' + items.filter(function (it) { return !SEASONAL[it.key]; }).map(row).join('') + '</details>' +
      '<details class="mpx"' + (seasonHere ? ' open' : '') + '><summary>Seasonal arrows and effects</summary>' + items.filter(function (it) { return SEASONAL[it.key]; }).map(row).join('') + '</details>';
    var sn = '#c8202f', tw = colors.twins[colors.twins.length - 1];
    var mp = [
      { key: 'sniper', title: 'Sniper arrow', text: 'Flies on to the next player\'s board and destroys the first arrow it hits there. The hit does not count as a move.',
        art: line('M4 23H50', sn) + head(56, 23, sn) + '<circle cx="26" cy="23" r="9" fill="' + card + '" stroke="' + sn + '" stroke-width="2.5"/><circle cx="26" cy="23" r="3.5" stroke="' + sn + '" stroke-width="2"/>' },
      { key: 'twinshared', title: 'Twin-shared arrows', text: 'Same colour, letter and a plus. They leave together with their twins on other players\' boards, so every path must be clear. Hold one to see its twins.',
        art: '<rect x="1" y="3" width="27" height="40" rx="5" stroke="' + ink + '" stroke-opacity=".3" stroke-width="1.5"/><rect x="34" y="3" width="27" height="40" rx="5" stroke="' + ink + '" stroke-opacity=".3" stroke-width="1.5"/>' + line('M14 38V14', tw) + '<path d="M8 20L14 13L20 20" stroke="' + tw + '" stroke-width="4"/>' + line('M47 38V14', tw) + '<path d="M41 20L47 13L53 20" stroke="' + tw + '" stroke-width="4"/>' + '<circle cx="14" cy="27" r="8" fill="' + tw + '"/><text x="14" y="30.5" text-anchor="middle" font-size="9" font-weight="700" fill="' + card + '" stroke="none">X+</text><circle cx="47" cy="27" r="8" fill="' + tw + '"/><text x="47" y="30.5" text-anchor="middle" font-size="9" font-weight="700" fill="' + card + '" stroke="none">X+</text>' }
    ];
    var hereMp = {};
    if (current.coop && coop) { coop.boards.forEach(function (B) { B.level.arrows.forEach(function (a) { if (a.sniper && !B.state.removed[a.id]) hereMp.sniper = 1; if (a.coopGroup !== undefined) hereMp.twinshared = 1; }); }); }
    html += '<details class="mpx"' + (current.coop ? ' open' : '') + '><summary>Multiplayer exclusive arrows</summary>' + mp.map(function (it) {
      return '<div class="guide-item"><svg viewBox="0 0 62 46" aria-hidden="true">' + it.art + '</svg><div><h3>' + it.title + (hereMp[it.key] ? '<span class="onboard">On this board</span>' : '') + '</h3><p>' + it.text + '</p><button class="watch" data-watch="' + it.key + '">▶ Watch how it works</button></div></div>';
    }).join('') + '</details>';
    var s = sheet(html);
    s.classList.add('side');
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-watch]').forEach(function (b) { b.onclick = function () { showTutorial([b.getAttribute('data-watch')], 0, false); }; });
    s.onclick = function (ev) { if (ev.target === s) closeSheet(); };
    track('guide_open', {});
  }
  function restart() {
    if (current && current.coop && coop) { coopRestart(); return; }
    track('restart', { launches: state.launches });
    begin(current);
  }
  function languageRow() {
    var cur = window.UnwindI18n.lang();
    return '<div class="setting"><span>Language</span></div><div class="sizes langs" role="group" aria-label="Language"><button class="notr" data-lang="en" aria-pressed="' + (cur === 'en') + '">English</button><button class="notr" data-lang="pt" aria-pressed="' + (cur === 'pt') + '">Português</button></div>';
  }
  function wireLanguage(s) {
    s.querySelectorAll('[data-lang]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        window.UnwindI18n.setLang(b.getAttribute('data-lang'));
        s.querySelectorAll('[data-lang]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        layout();
        track('language', { lang: b.getAttribute('data-lang') });
      };
    });
  }
  function volumeBar(id, label, value) {
    var v = Math.round((value === undefined ? 1 : value) * 100);
    return '<label class="volbar"><span>' + label + '</span><input type="range" id="' + id + '" min="0" max="100" step="5" value="' + v + '" aria-label="' + label + '"></label>';
  }
  var THEME_ORDER = ['first-light', 'still-water', 'high-sun', 'lantern-hour', 'night-swim', 'snowfall', 'meadow', 'sandbar', 'amber-leaves'];
  function settingsSheet() {
    var themeRow = function (id, name, mood) { return '<button class="theme" data-theme-id="' + id + '" aria-pressed="' + (audioPrefs.theme === id) + '"><b>' + name + '</b><span>' + mood + '</span></button>'; };
    var html = '<div class="row"><h2>Settings</h2><button class="close" id="x" aria-label="Close">×</button></div>' + languageRow() +
      '<div class="setting"><span id="lMusic">Music</span><button class="switch" id="sMusic" role="switch" aria-labelledby="lMusic" aria-checked="' + audioPrefs.music + '"></button></div>' + volumeBar('vMusic', 'Music volume', audioPrefs.musicVol) +
      '<div class="setting"><span id="lSound">Sound effects</span><button class="switch" id="sSound" role="switch" aria-labelledby="lSound" aria-checked="' + audioPrefs.sound + '"></button></div>' + volumeBar('vSound', 'Sound volume', audioPrefs.soundVol) +
      '<div class="chapter" style="margin-bottom:-6px">Theme</div><p class="now" id="nowPlaying"></p><div class="modes">' + themeRow('auto', 'Follow the level', 'Matches the time of day or season') + M.THEMES.slice().sort(function (p, q) { return THEME_ORDER.indexOf(p.id) - THEME_ORDER.indexOf(q.id); }).map(function (t) { return themeRow(t.id, t.name, t.mood); }).join('') + '</div>';
    var s = sheet(html);
    wireLanguage(s);
    var showNow = function () { s.querySelector('#nowPlaying').textContent = audioPrefs.music ? 'Now playing: ' + M.THEMES[wantedTheme()].name : 'Music is off'; };
    showNow();
    s.querySelector('#x').onclick = closeSheet;
    s.querySelector('#sMusic').onclick = function () {
      audioPrefs.music = !audioPrefs.music; save('unwind.audio', audioPrefs);
      audio();
      if (musicBus && ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.2); }
      this.setAttribute('aria-checked', audioPrefs.music); refresh(); showNow(); musicTick();
    };
    s.querySelector('#vMusic').oninput = function () {
      audioPrefs.musicVol = this.value / 100; save('unwind.audio', audioPrefs); audio();
      if (musicBus && ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.05); }
    };
    s.querySelector('#vSound').oninput = function () {
      audioPrefs.soundVol = this.value / 100; save('unwind.audio', audioPrefs); audio();
      if (sfxBus && ac) sfxBus.gain.setTargetAtTime(soundLevel(), ac.currentTime, 0.05);
    };
    s.querySelector('#vSound').onchange = function () { pluck(659, 0, 0.2, 0.8); };
    s.querySelector('#sSound').onclick = function () {
      audioPrefs.sound = !audioPrefs.sound; save('unwind.audio', audioPrefs);
      audio();
      if (sfxBus && ac) sfxBus.gain.setTargetAtTime(soundLevel(), ac.currentTime, 0.05);
      this.setAttribute('aria-checked', audioPrefs.sound); refresh();
    };
    s.querySelectorAll('[data-theme-id]').forEach(function (b) {
      b.onclick = function () {
        audioPrefs.theme = b.getAttribute('data-theme-id'); save('unwind.audio', audioPrefs);
        s.querySelectorAll('[data-theme-id]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        // Choosing a theme also turns the music back on.
        if (!audioPrefs.music) {
          audioPrefs.music = true; save('unwind.audio', audioPrefs);
          s.querySelector('#sMusic').setAttribute('aria-checked', true);
          audio();
          if (musicBus && ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.2); }
          refresh();
        }
        audio(); stopJingle(); duck(false); musicTick(); showNow();
      };
    });
  }

  /* ---------- Toolbar ---------- */
  $('bRewind').onclick = function () {
    audio();
    if (current && current.coop && coop) { coopPause(); return; }
    var ids = E.rewind(state, current.level);
    if (!ids) return;
    current.level.arrows.forEach(function (x) { delete x.rot; delete x.burnUntil; delete x.burn; });
    embers = [];
    beesLeaving = [];
    if (current.level.flowers && current.level.flowers.length) { sendBee(state.launches, performance.now() - 2000); }
    current.level.arrows.forEach(function (x) { if (x.kind === 'compass' && !state.removed[x.id] && ids.indexOf(x.id) < 0) angles[x.id] -= 90; });
    ids.forEach(function (id) { var a = current.level.arrows[id]; if (a.kind === 'compass') { angles[id] = E.dirOf(a, state) * 90; a.vis = angles[id]; } });
    tune.pop(); rewinds++; wakes = []; cards = [];
    pluck(146.8, 0, 0.12, 0.7);
    track('rewind', { launches: state.launches });
    hintArrow = -1; refresh();
  };
  // Skips straight to the next background and song in Open Water's rotation.
  $('bNextTheme').onclick = function () {
    audio();
    if (!cycleOn()) return;
    bgCycle.i = (bgCycle.i + 1) % CYCLE.length;
    bgCycle.gapUntil = performance.now() + 160;
    applyBackgroundNow();
    track('next_theme', { to: CYCLE[bgCycle.i] });
  };
  $('bHint').onclick = function () {
    audio();
    var l = current.level, sol = E.solve(l, state, l.big ? 6000 : 80000);
    if (E.effectsOf(l).length && sol.solved && sol.sequence.length && !E.canLaunch(l, state, sol.sequence[0])) {
      // The best arrow is frozen or waiting: point at a move that helps right now.
      var useful = E.iceHits(l, state).concat(E.legalMoves(l, state));
      if (useful.length) sol.sequence = [useful[0]];
    }
    if (sol.solved && sol.sequence.length) {
      hintArrow = sol.sequence[0]; hintStart = performance.now(); hintsLeft--; hintsUsed++;
      track('hint_used', {});
      pluck(M.hz(M.THEMES[wantedTheme()].pent[7]), 0, 0.12, 1);
    } else if (!sol.exhausted) {
      setCaption('This board cannot clear from here. Rewind a step or two.');
    } else {
      var m = E.legalMoves(l, state);
      if (m.length) { hintArrow = m[0]; hintStart = performance.now(); hintsLeft--; hintsUsed++; track('hint_used', { fallback: true }); }
    }
    if (hintArrow >= 0) focusArrow(hintArrow);
    refresh();
    if (!sol.solved && !sol.exhausted) $('bRewind').classList.add('call');
  };
  $('bRestart').onclick = function () { audio(); restart(); };
  $('bgButton').onclick = function () { audio(); backgroundSheet(); };
  $('bGuide').onclick = function () { audio(); guideSheet(); };
  $('bLevels').onclick = function () { audio(); levelsSheet(); };
  $('mute').onclick = function () { audio(); settingsSheet(); };

  /* ---------- Hidden analytics view: add #debug or ?debug=1 to the address ---------- */
  function debugSheet() {
    var rows = {};
    events.forEach(function (e) {
      if (!e.level) return;
      var r = rows[e.level] = rows[e.level] || { start: 0, clear: 0, fail: 0, hit: 0, hint: 0, stuck: 0 };
      if (e.e === 'level_start') r.start++; if (e.e === 'level_complete') r.clear++; if (e.e === 'level_fail') r.fail++;
      if (e.e === 'collision') r.hit++; if (e.e === 'hint_used') r.hint++; if (e.e === 'stuck') r.stuck++;
    });
    var table = '<table><tr><th>Level</th><th>Starts</th><th>Clears</th><th>Fails</th><th>Hits</th><th>Hints</th><th>Stuck</th></tr>' + Object.keys(rows).map(function (k) {
      var r = rows[k]; return '<tr><td>' + k + '</td><td>' + r.start + '</td><td>' + r.clear + '</td><td>' + r.fail + '</td><td>' + r.hit + '</td><td>' + r.hint + '</td><td>' + r.stuck + '</td></tr>';
    }).join('') + '</table>';
    var recent = events.slice(-40).reverse().map(function (e) { return JSON.stringify(e); }).join('\n');
    var s = sheet('<div id="debug" style="display:grid;gap:14px"><div class="row"><h2>Analytics</h2><button class="close" id="x" aria-label="Close">×</button></div><p>Stored in this browser only.</p>' + '<div style="overflow-x:auto">' + table + '</div><pre></pre><button class="secondary" id="wipe">Clear events and progress</button></div>');
    s.querySelector('pre').textContent = recent;
    s.querySelector('#x').onclick = closeSheet;
    s.querySelector('#wipe').onclick = function () {
      events = []; progress = { last: { set: 'calm', index: 0 }, done: {}, perfect: {}, best: {}, endlessBy: {}, endlessOpts: { hard: false, timed: false }, daily: null };
      save('unwind.events', events); save('unwind.progress2', progress); openLevel('calm', 0);
    };
  }

  window.addEventListener('resize', function () { layout(); });
  window.addEventListener('hashchange', function () { if (location.hash === '#debug') debugSheet(); });
  /*TEST-HOOK-START*/
  // Small test hook: reports where to tap on screen, and jumps between boards.
  window.unwindTest = {
    point: function (id) {
      var c = current.level.arrows[id].cells[0];
      if (cam) { cam.anim = null; cam.zoom = null; cam.settling = false; cam.free = false; cam.cx = c[0] + 0.5; cam.cy = c[1] + 0.5; applyCam(); }
      return px(c);
    },
    solve: function () { return current.level.solution && !state.launches ? current.level.solution : E.solve(current.level, state, 800000).sequence; },
    cam: function () { return cam && { ox: ox, oy: oy, settling: !!cam.settling, zooming: !!cam.zoom, cs: cs, cx: cam.cx, cy: cam.cy, fit: fitCs, w: current.level.w, h: current.level.h, n: current.level.arrows.length }; },
    snapshot: function () { return { id: current.id, launches: state.launches, lives: state.lives, won: E.isWon(state), stuck: E.isStuck(current.level, state), hint: hintArrow, timeLeft: timeLeft, sheet: !!$('sheetHost').firstChild }; },
    arrows: function () { return current.level.arrows; },
    open: function (set, i) { openLevel(set, i); },
    setTime: function (ms) { timeLeft = ms; },
    counts: function () { var o = {}; Object.keys(SETS).forEach(function (k) { o[k] = SETS[k].length; }); return o; },
    legal: function () { return E.legalMoves(current.level, state); },
    nextMove: function () {
      var l = current.level, sol = E.solve(l, state, 400000), legal = E.legalMoves(l, state), hits = E.iceHits(l, state);
      if (sol.solved && sol.sequence.length && legal.indexOf(sol.sequence[0]) >= 0) return sol.sequence[0];
      if (hits.length) return hits[0];
      return legal.length ? legal[0] : -1;
    },
    rewind: function () { $('bRewind').click(); },
    seasonInfo: function () { return { hintAmt: lastHintAmt, frozen: Object.keys(state.frozen).length, burning: Object.keys(state.burning).filter(function (k) { return state.burning[k] > state.launches; }).length, flowersLeft: current.level.flowers ? Math.max(0, current.level.flowers.length - state.launches) : null, beeIndex: bee ? bee.index : null, rotating: current.level.arrows.filter(function (a) { return a.rot; }).length, windAt: windAt, theme: M.THEMES[wantedTheme()].name, badge: $('seasonBadge').textContent, title: $('where').textContent }; },
    setFrozen: function (id) { state.frozen[id] = state.launches + 3; refresh(); },
    levelInfo: function () { var l = current.level; return { effects: E.effectsOf(l), scene: activeScene, season: l.season, seed: l.seed, big: !!l.big, w: l.w, h: l.h, lives: state.lives, limit: l.timeLimit || null, guarantee: l.guaranteeAt, flowers: (l.flowers || []).length }; },
    openEndless: function () { openEndless(true); },
    pops: function () { return popCount; },
    coop: function () { return coop; },
    coopSwitch: function (i) { coopSwitch(i); },
    openCoop: function (seed, big) { loadingSync = true; try { openCoop(seed, big); } finally { loadingSync = false; } }, openCoopTutorial: openCoopTutorial, lobby: function () { return lobby; }, openLobby: function () { lobbySheet(); },
    cycle: function () { return { i: bgCycle.i, gap: bgCycle.gapUntil, on: cycleOn(), bar: musicBar, playing: playingTheme, want: wantedTheme(), bg: shownBackground(), season: $('seasonBg').getAttribute('data-season'), color: colors.name }; },
    cycleFinishSong: function () { if (ac) { musicBar = 1e6; nextBarAt = 0; } bgCycle.endAt = 0; },
    levels: function () { return audioPrefs; },
    records: function () { return progress.records || {}; },
    theme: function () { return audioPrefs.theme; },
    perfBoard: function (scale, effects, hard) { var o = endlessOpts(), saved = JSON.stringify(o); o.scale = scale; o.effectList = effects; o.effectRandom = false; o.hard = !!hard; o.timed = false; openEndless(true); progress.endlessOpts = JSON.parse(saved); },
    frameLoad: function () { return { flights: flights.length, embers: embers.length }; },
    burnAll: function () { var l = current.level, n = 0; for (var k = 0; k < l.w * l.h && n < 5; k++) { var o = l.grid[k]; if (o === -1 || state.removed[o]) { state.burning[k] = state.launches + 3; n++; } } return n; },
    firePath: function () { var l = current.level; for (var i = 0; i < l.arrows.length; i++) { var a = l.arrows[i]; if (state.removed[a.id]) continue; var c = E.check(l, state, a); if (c.fire) return a.id; } return -1; },
    iceHitFor: function () { return E.iceHits(current.level, state); },
    music: M,
    audio: function () {
      var rms = 0;
      if (analyser) { var d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d); d.forEach(function (v) { rms += v * v; }); rms = Math.sqrt(rms / d.length); }
      return { state: ac && ac.state, playing: playingTheme >= 0 ? M.THEMES[playingTheme].name : null, rms: rms, duck: duckBus ? duckBus.gain.value : null, jingle: !!jingleBus };
    },
    noteFor: noteFor,
    hintAge: function () { return performance.now() - hintStart; },
    hintAmt: function () { return lastHintAmt; },
    win: function () { return null; }
  };

  /*TEST-HOOK-END*/
  window.UnwindI18n.start();
  window.UnwindI18n.setLang(window.UnwindI18n.lang());
  track('session_start', {});
  var last = progress.last || { set: 'calm', index: 0 };
  holdTutorials = true;
  openLevel(SETS[last.set] ? last.set : 'calm', Math.min(last.index || 0, (SETS[last.set] || SETS.calm).length - 1));
  // Browsers, especially on phones, only allow sound after a tap, so the first tap starts the music.
  (function () {
    var s = sheet('<h2>Unwind</h2><p>Sound on for the full experience</p><button class="primary" id="begin" style="width:100%">Tap to begin</button>' + languageRow(), 'begin');
    wireLanguage(s);
    s.onclick = function () { audio(); closeSheet(); holdTutorials = false; maybeTutorials(); introStart = performance.now(); if (current.level.flowers && current.level.flowers.length) sendBee(state.launches, performance.now() + 900); };
  })();
  requestAnimationFrame(frame);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.body);
  if (location.hash === '#debug' || /[?&]debug=1/.test(location.search)) debugSheet();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
