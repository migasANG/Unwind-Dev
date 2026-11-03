(function () {
  'use strict';
  var E = window.UnwindEngine, M = window.UnwindMusic, SETS = window.UNWIND_LEVELS;
  Object.keys(SETS).forEach(function (k) { SETS[k].forEach(E.prepare); });
  var SET_INFO = {
    calm: { label: 'Calm', prefix: 'L', title: 'Level ' },
    hard: { label: 'Hard', prefix: 'H', title: 'Hard ' },
    timed: { label: 'Timed', prefix: 'T', title: 'Timed ' }
  };
  var HEART = '<path d="M12 20.500s-7.800-4.700-9.300-9.700C1.600 7.200 3.800 4.200 7 4.200c2 0 3.700 1 5 3 1.300-2 3-3 5-3 3.200 0 5.400 3 4.300 6.600-1.500 5-9.300 9.700-9.300 9.700Z"/>';
  function heartSvg(cls) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + HEART + '</svg>'; }
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One day on the lake. Sun height (percent of screen) moves with progress.
  var CHAPTERS = [
    { name: 'Dawn', a: '#f6d9cf', b: '#c9c6e6', ink: '#3d2f5b', twin: '#b83563', compass: '#0f6a79', sun: '#ffeccf', card: '#fff6f0', hint: '#e85d04', music: 0, mirror: '#1f6fd6', twins: ['#b83563', '#0a7d55', '#8f5200', '#5a3fc0'] },
    { name: 'Morning', a: '#c3e6e4', b: '#e5f2d8', ink: '#123f4a', twin: '#c23c3c', compass: '#6a3fb0', sun: '#fff9dc', card: '#f6fcf8', hint: '#e85d04', music: 1, mirror: '#1f6fd6', twins: ['#c23c3c', '#a8127a', '#7d5200', '#2f6f1f'] },
    { name: 'Noon', a: '#a9d8ef', b: '#e8f6ee', ink: '#10385a', twin: '#c0392b', compass: '#7a3aa8', sun: '#fffdf0', card: '#f4fbff', hint: '#e85d04', music: 1, mirror: '#1f6fd6', twins: ['#c0392b', '#a8127a', '#7d5200', '#2f6f1f'] },
    { name: 'Dusk', a: '#4f4580', b: '#b4688a', ink: '#fff1e0', twin: '#ffcb77', compass: '#94ece6', sun: '#ffab76', card: '#3f3768', hint: '#ffe14d', music: 2, mirror: '#8fd0ff', twins: ['#ffcb77', '#ff9ecb', '#a8f08a', '#a9d4ff'] },
    { name: 'Night', a: '#111737', b: '#27335f', ink: '#e7ecff', twin: '#ffa6b8', compass: '#8ee8c6', sun: '#dfe6ff', card: '#1b2348', hint: '#ffe14d', music: 3, mirror: '#7cc4ff', twins: ['#ffa6b8', '#ffd479', '#a8f08a', '#a9d4ff'] }
  ];
  function chapterFor(i, total) { return CHAPTERS[Math.min(4, Math.floor(i / total * 5))]; }

  // Storage can throw in private windows, so every access is guarded.
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  var progress = load('unwind.progress2', { last: { set: 'calm', index: 0 }, done: {}, perfect: {}, best: {}, endlessBy: {}, endlessOpts: { hard: false, timed: false }, daily: null });
  var audioPrefs = load('unwind.audio', { music: true, sound: true, theme: 'auto' });
  var events = load('unwind.events', []);

  // Every analytics event goes through here. Connect a real service in this one function.
  function track(name, props) {
    var e = Object.assign({ e: name, t: Date.now(), level: current ? current.id : null }, props || {});
    events.push(e);
    if (events.length > 2000) events = events.slice(-2000);
    save('unwind.events', events);
  }

  /* ---------- Sound: everything is a short note. There is no drone, and silence is true silence. ---------- */
  var colors = CHAPTERS[0];
  var ac = null, sfxBus = null, musicBus = null, duckBus = null, sectionBus = null, jingleBus = null, analyser = null, musicBar = 0, nextBarAt = 0, playingTheme = -1;
  var ARROW_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function audio() {
    if (!audioPrefs.music && !audioPrefs.sound) return null;
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      sfxBus = ac.createGain(); musicBus = ac.createGain(); duckBus = ac.createGain();
      sfxBus.gain.value = audioPrefs.sound ? 0.7 : 0; musicBus.gain.value = audioPrefs.music ? 0.8 : 0; duckBus.gain.value = 1;
      var delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
      delay.delayTime.value = 0.34; fb.gain.value = 0.38; wet.gain.value = 0.3;
      duckBus.connect(musicBus); sfxBus.connect(ac.destination); musicBus.connect(ac.destination);
      sfxBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
      analyser = ac.createAnalyser(); analyser.fftSize = 2048; musicBus.connect(analyser);
      setInterval(musicTick, 200);
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    return ac;
  }
  function wantedTheme() {
    if (audioPrefs.theme !== 'auto') {
      var i = M.THEMES.map(function (t) { return t.id; }).indexOf(audioPrefs.theme);
      if (i >= 0) return i;
    }
    return colors.music;
  }
  function musicTick() {
    if (!ac || ac.state !== 'running' || !audioPrefs.music) return;
    var want = wantedTheme();
    if (want !== playingTheme) {
      // Fade the old theme out at once, including notes already queued, and start the new one straight away.
      if (sectionBus) {
        var old = sectionBus;
        old.gain.cancelScheduledValues(ac.currentTime);
        old.gain.setTargetAtTime(0, ac.currentTime, 0.18);
        setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 1500);
      }
      sectionBus = ac.createGain(); sectionBus.gain.value = 1; sectionBus.connect(duckBus);
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
  document.addEventListener('visibilitychange', function () {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  /* ---------- Level state ---------- */
  var current = null, state = null, hintsLeft = 1, hintArrow = -1, stuckShown = false, blockerGlow = {};
  var flights = [], bounces = {}, ripples = [], angles = {}, introStart = 0, collisions = 0, ended = false;
  var lastHintAmt = 0, wakes = [], HINT_IN = 500, HINT_HOLD = 3000, HINT_OUT = 800, hintStart = 0, tune = [], tuneBase = 0, hintsUsed = 0, rewinds = 0, activeMs = 0, lastFrame = 0, timeLeft = null, lastSecond = -1, nudges = {};

  function openLevel(set, index) {
    var list = SETS[set], info = SET_INFO[set], lvl = list[index];
    progress.last = { set: set, index: index }; save('unwind.progress2', progress);
    begin({ id: info.prefix + (index + 1), set: set, index: index, mode: 'levels', level: lvl, title: info.title + (index + 1),
      chapter: chapterFor(index, list.length), sunY: 72 - Math.sin(Math.min(index / (list.length - 1), 1) * Math.PI) * 58 });
  }
  function timeChapter() { var h = new Date().getHours(); return h < 6 ? 4 : h < 10 ? 0 : h < 14 ? 1 : h < 18 ? 2 : h < 21 ? 3 : 4; }
  function endlessOpts() { return progress.endlessOpts || { hard: false, timed: false }; }
  function openEndless() {
    var o = endlessOpts(), scale = o.scale || 1, key = ((o.hard ? 'h' : '') + (o.timed ? 't' : '') || 'free') + (scale > 1 ? scale + 'x' : '');
    progress.endlessBy = progress.endlessBy || {};
    var n = progress.endlessBy[key] || 0, seed = 500000 + n * 101 + (o.hard ? 70001 : 0) + (o.timed ? 3001 : 0) + scale * 1009;
    var lvl = E.endlessBoard(n, o, seed);
    lvl.lives = o.hard ? 2 : null;
    E.prepare(lvl);
    // Big boards get extra time, since the player also has to move around them.
    if (o.timed) lvl.timeLimit = Math.round(E.timeLimitFor(lvl.solution.length) * (scale > 1 ? 1.3 : 1));
    var tags = (scale > 1 ? ' · ' + scale + 'x' : '') + (o.hard ? ' · Harder' : '') + (o.timed ? ' · Timed' : '');
    begin({ id: 'open-' + key + '-' + (n + 1), endlessKey: key, mode: 'endless', level: lvl, title: 'Open water ' + (n + 1) + tags, chapter: CHAPTERS[timeChapter()], sunY: 34 });
  }
  function todayKey() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function openDaily() {
    var k = todayKey();
    var lvl = E.generate({ w: 7, h: 9, minLen: 2, maxLen: 6, depth: 7, twins: 1, compass: 1, trap: [0.05, 0.45] }, k, 40);
    E.prepare(lvl);
    begin({ id: 'daily-' + k, mode: 'daily', level: lvl, title: "Today's puzzle", chapter: CHAPTERS[timeChapter()], sunY: 34 });
  }
  function begin(c) {
    current = c; cam = null;
    duck(false); stopJingle();
    tuneBase = c.mode === 'levels' ? c.index : 3;
    closeSheet();
    state = E.newState(c.level);
    hintsLeft = c.level.hints === undefined ? 1 : c.level.hints; hintArrow = -1; stuckShown = false; ended = false; collisions = 0;
    hintsUsed = 0; rewinds = 0; activeMs = 0; lastFrame = 0; tune = []; nudges = {};
    wakes = []; flights = []; bounces = {}; ripples = []; blockerGlow = {}; angles = {};
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
    $('where').textContent = c.mode === 'endless' ? c.title : c.title + ' · ' + c.chapter.name;
    setCaption(baseCaption());
    if (c.index === 0 && c.mode === 'levels' && c.set === 'calm') { hintArrow = E.legalMoves(c.level, state)[0]; hintStart = performance.now() + 700; }
    if (timeLeft !== null) drawTimer();
    refresh(); layout();
    track('level_start', { mode: c.mode, set: c.set });
  }
  function baseCaption() {
    if (current.level.caption) return current.level.caption;
    if (current.level.big) { var left = state.removed.filter(function (x) { return !x; }).length; return left + (left === 1 ? ' arrow left' : ' arrows left'); }
    if (current.mode === 'endless') return current.level.lives === null && !current.level.timeLimit ? 'No lives to lose out here.' : '';
    if (current.set === 'hard' && current.index === 0) return 'Hard boards: two lives and no hints.';
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
  function setCaption(text) { var cap = $('caption'); cap.textContent = text; cap.classList.toggle('on', !!text); }
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
    r.setProperty('--gold-ink', ch.music >= 2 ? '#ffd23f' : '#a86a00');
    // Crossfade two gradient layers, since gradients themselves cannot transition.
    var show = $('sky2').style.opacity === '1' ? $('sky') : $('sky2'), hide = show.id === 'sky' ? $('sky2') : $('sky');
    show.style.background = 'linear-gradient(180deg,' + ch.a + ',' + ch.b + ')';
    show.style.opacity = '1'; hide.style.opacity = show.id === 'sky' ? '0' : '1';
    if (show.id === 'sky') $('sky2').style.opacity = '0';
    colors = ch;
  }

  var shownLives = null;
  function refresh() {
    var max = current.level.lives, lives = state.lives, hearts = $('hearts');
    if (lives !== null) {
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
    $('bRewind').disabled = !state.history.length || ended;
    $('bHint').disabled = hintsLeft <= 0 || ended;
    $('hintLabel').textContent = 'Hint ' + hintsLeft;
    var stuck = E.isStuck(current.level, state);
    $('bRewind').classList.toggle('call', stuck);
    if (stuck && !stuckShown) {
      stuckShown = true;
      setCaption('Nothing can move. Rewind one step.');
      track('stuck', { launches: state.launches });
    }
    if (!stuck && stuckShown) { stuckShown = false; setCaption(baseCaption()); }
    if (!stuck && current.level.big) setCaption(baseCaption());
    $('mute').innerHTML = (audioPrefs.music || audioPrefs.sound)
      ? '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/><path d="m3 3 18 18"/></svg>';
  }

  /* ---------- Board geometry ---------- */
  var canvas = $('board'), ctx = canvas.getContext('2d'), vw = 0, vh = 0, cs = 40, ox = 0, oy = 0;
  var cam = null, fitCs = 40, viewTop = 0, viewBottom = 0, MIN_TAP = 38, MAX_ZOOM = 64;
  function layout() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!current) return;
    viewTop = document.querySelector('header.ui').getBoundingClientRect().bottom + 10;
    viewBottom = document.querySelector('nav.ui').getBoundingClientRect().top - 54;
    var l = current.level, sideW = vw - 32;
    fitCs = Math.min(sideW / l.w, (viewBottom - viewTop) / l.h, 68);
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
      ox = (vw - cs * l.w) / 2; oy = viewTop + (viewBottom - viewTop - cs * l.h) / 2;
    }
  }
  function applyCam() {
    var l = current.level;
    cam.cs = Math.max(fitCs, Math.min(MAX_ZOOM, cam.cs));
    cs = cam.cs;
    var viewH = viewBottom - viewTop, halfW = vw / 2 / cs, halfH = viewH / 2 / cs;
    // While the mini-map is showing, extra room lets the bottom rows slide clear of it.
    var slack = cam.cs > fitCs * 1.04 ? (miniRect().h + 12) / cs : 0;
    cam.cx = Math.max(Math.min(l.w / 2, halfW - 1), Math.min(Math.max(l.w / 2, l.w - halfW + 1), cam.cx));
    cam.cy = Math.max(Math.min(l.h / 2, halfH - 1), Math.min(Math.max(l.h / 2, l.h - halfH + 1) + slack, cam.cy));
    ox = vw / 2 - cam.cx * cs; oy = viewTop + viewH / 2 - cam.cy * cs;
  }
  function zoomAt(x, y, factor) {
    if (!cam) return;
    var gx = (x - ox) / cs, gy = (y - oy) / cs;
    cam.anim = null; cam.zoom = null; cam.cs *= factor; applyCam();
    cam.cx += gx - (x - ox) / cs; cam.cy += gy - (y - oy) / cs; applyCam();
  }
  // Glides the view to an arrow if it is out of sight.
  function focusArrow(id) {
    if (!cam) return;
    cam.zoom = null;
    var h = E.headOf(current.level.arrows[id]), p = px(h), m = cs;
    if (p.x < m || p.x > vw - m || p.y < viewTop + m || p.y > viewBottom - m) cam.anim = { cx: h[0] + 0.5, cy: h[1] + 0.5 };
  }
  function px(c) { return { x: ox + (c[0] + 0.5) * cs, y: oy + (c[1] + 0.5) * cs }; }
  function screenCells() { return Math.ceil(Math.max(vw, vh) / cs) + 4 + (current && current.level.big ? current.level.w + current.level.h : 0); }

  // Builds a path through the arrow's cells, around any mirrors, then on past the screen edge.
  function trackOf(a, c) {
    var pts = a.kind === 'compass' ? [a.cells[0].slice()] : a.cells.map(function (x) { return x.slice(); });
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
  function arrowColor(a) { return a.kind === 'twin' ? colors.twins[(a.pair || 0) % colors.twins.length] : a.kind === 'compass' ? colors.compass : colors.ink; }
  function setStroke(color, width, alpha) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }

  /* ---------- Frame loop ---------- */
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
      if (Math.abs(cam.anim.cx - cam.cx) + Math.abs(cam.anim.cy - cam.cy) < 0.03) cam.anim = null;
      applyCam();
    }
    ctx.clearRect(0, 0, vw, vh);
    var l = current.level, w = Math.max(3, cs * 0.17);
    // Big boards only draw what is near the screen.
    var offscreen = function (a) {
      if (!cam || bounces[a.id] || nudges[a.id]) return false;
      return a.cells.every(function (c) { var p = px(c); return p.x < -cs * 2 || p.x > vw + cs * 2 || p.y < -cs * 2 || p.y > vh + cs * 2; });
    };

    // Faint resting dots mark the board, and show through as arrows leave.
    ctx.globalAlpha = 0.16 * (reduced ? 1 : Math.min(1, (now - introStart) / 500)); ctx.fillStyle = colors.ink;
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
    l.arrows.forEach(function (a, i) {
      if (state.removed[a.id] || offscreen(a)) return;
      var intro = introOf(a, now);
      if (intro <= 0) return;
      var f = ease(intro), shift = 0, b = bounces[a.id], amt = hinted[a.id] ? hintAmt : 0, isReady = ready(a);
      if (b) {
        var bt = (now - b.start) / 440;
        if (bt >= 1) delete bounces[a.id]; else shift = Math.sin(bt * Math.PI) * b.reach;
      }
      var nudge = nudges[a.id] && now < nudges[a.id] ? Math.sin((nudges[a.id] - now) / 40) * cs * 0.05 : 0;
      var glow = blockerGlow[a.id] && now < blockerGlow[a.id] ? 1 + 0.35 * Math.sin((blockerGlow[a.id] - now) / 420 * Math.PI) : 1;
      var color = amt ? mixColor(arrowColor(a), colors.hint, amt) : arrowColor(a);
      var width = w * glow * (1 + amt * 0.75);
      var head = cs * (0.24 + amt * 0.1);
      var alpha = (isReady ? 1 : 0.62 + amt * 0.38) * f;
      ctx.save(); ctx.translate(nudge, 0);
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
      var len = lengthOf(a), pts = b && b.pts ? b.pts : a.cells.concat([[E.headOf(a)[0] + E.DX[a.dir] * 2, E.headOf(a)[1] + E.DY[a.dir] * 2]]);
      setStroke(color, width, alpha);
      if (!isReady) ctx.setLineDash([cs * 0.18, cs * 0.3]);
      var res = strokeWindow(pts, shift, shift + len * f);
      ctx.setLineDash([]);
      setStroke(color, width, alpha);
      chevron(res.end, res.tan, head * (0.4 + 0.6 * f));
      var centre = pointAlong(pts, shift + len / 2);
      // Badges and icons pop in once their arrow is mostly drawn.
      var pop = Math.max(0, (intro - 0.45) / 0.55); pop = ease(pop);
      if (a.kind === 'twin') scaled(centre, pop, function () { badge(centre, cs * 0.29, color, colors.card, String.fromCharCode(65 + (a.pair || 0))); });
      var tailPoint = px(a.cells[0]);
      if (a.isKey) scaled(tailPoint, pop, function () { drawStar(tailPoint, cs * 0.34, now); });
      if (a.key !== undefined && !state.removed[a.key]) scaled(tailPoint, pop, function () { drawMoon(tailPoint, cs * 0.34, now); });
      if (a.wait && state.launches < a.wait) scaled(centre, pop, function () { badge(centre, cs * 0.29, colors.card, colors.ink, String(a.wait - state.launches), color); });
      ctx.restore();
    });

    drawWakes(now);

    // Arrows on their way out.
    flights = flights.filter(function (fl) {
      var tNow = (now - fl.start) / fl.duration;
      if (tNow >= 1) return false;
      if (tNow < 0) tNow = 0;
      var travel = fl.travel * (0.28 * tNow + 0.72 * tNow * tNow);
      if (!fl.rippled && travel >= fl.rayCells - 0.2) { fl.rippled = true; addRipple(fl.edge, fl.color); }
      setStroke(fl.color, w, 1);
      var res = strokeWindow(fl.pts, travel, travel + fl.len);
      chevron(res.end, res.tan, cs * 0.24);
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
    if (cam && cs > fitCs * 1.04) drawMinimap(Math.min(1, (cs / fitCs - 1.04) / 0.2));
  }
  // A small map of what is left, with a frame showing the current view. Tap it to jump.
  function miniRect() {
    var l = current.level, sc = Math.min(92 / l.w, 112 / l.h), mw = l.w * sc, mh = l.h * sc;
    return { x: 16, y: viewBottom - mh - 2, w: mw, h: mh, sc: sc };
  }
  function drawMinimap(fade) {
    var l = current.level, r = miniRect();
    ctx.globalAlpha = 0.92 * fade; ctx.fillStyle = colors.card;
    ctx.beginPath(); ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, r.sc * 0.35); ctx.globalAlpha = fade;
    l.arrows.forEach(function (a) {
      if (state.removed[a.id]) return;
      ctx.strokeStyle = hintArrow === a.id ? colors.hint : arrowColor(a);
      ctx.beginPath();
      a.cells.forEach(function (c, i) { ctx[i ? 'lineTo' : 'moveTo'](r.x + (c[0] + 0.5) * r.sc, r.y + (c[1] + 0.5) * r.sc); });
      if (a.cells.length === 1) ctx.lineTo(r.x + (a.cells[0][0] + 0.6) * r.sc, r.y + (a.cells[0][1] + 0.5) * r.sc);
      ctx.stroke();
    });
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
    var probe = { removed: state.removed.slice(), launches: state.launches, lives: null, history: [] };
    E.tap(current.level, probe, hintArrow);
    var sol = E.solve(current.level, probe, current.level.big ? 2000 : 30000);
    if (!sol.solved && !sol.exhausted) hintArrow = -1;
  }
  function onTap(id) {
    if (ended || id < 0) return;
    var l = current.level, res = E.tap(l, state, id), now = performance.now();
    if (res.notReady) {
      // Waiting arrows give a small shake and a soft sound. It costs nothing.
      nudges[id] = now + 360;
      if (l.arrows[id].key !== undefined) blockerGlow[l.arrows[id].key] = now + 500;
      pluck(220, 0, 0.07, 0.3); buzz(6);
      track('not_ready', { arrow: id });
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
        flights.push({ pts: pts, len: len, travel: travel, start: now, duration: sc * Math.min(1500, 480 + travel * 42), color: hintArrow === m.id || (m.kind === 'twin' && hintArrow === m.twin) ? colors.hint : arrowColor(m), edge: edge, rayCells: body + c.dist - 1 });
      });
      var f = noteFor(step); tune.push(f); pluck(f, 0, 0.2, 1.5);
      buzz(8);
      l.arrows.forEach(function (x) { if (x.kind === 'compass' && !state.removed[x.id]) angles[x.id] += 90; });
      res.results.forEach(function (r) {
        l.arrows.forEach(function (x) {
          if (x.key !== r.id || state.removed[x.id]) return;
          wakes.push({ from: px(l.arrows[r.id].cells[0]), to: px(x.cells[0]), start: now });
          pluck(880, 0.42, 0.12, 0.9); pluck(1318.5, 0.5, 0.1, 1.1);
        });
      });
      hintStillGood();
      if (res.won) finish(true);
    } else {
      collisions++;
      res.results.forEach(function (r) {
        var m = l.arrows[r.id], pts = trackOf(m, r.check);
        if (m.kind === 'compass') pts = null;
        if (r.check.clear) { bounces[r.id] = { start: now, reach: 0.18, pts: pts }; return; }
        bounces[r.id] = { start: now, reach: Math.max(0.14, r.check.dist - 0.62), pts: pts };
        blockerGlow[r.check.blocker] = now + 420;
        track('collision', { arrow: r.id, blocker: r.check.blocker });
      });
      thud(); buzz(26);
      if (res.failed) finish(false, 'lives');
    }
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
    if (!cam) { onTap(arrowAt(ev.clientX, ev.clientY)); return; }
    if (jumpFromMinimap(ev.clientX, ev.clientY)) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var list = ptrList();
    cam.anim = null; cam.zoom = null;
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
      if (gesture && !gesture.moved && ev.type === 'pointerup') onTap(arrowAt(ev.clientX, ev.clientY));
      gesture = null;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', function (ev) {
    if (!cam) return;
    ev.preventDefault();
    zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  $('zIn').onclick = function () { zoomAt(vw / 2, (viewTop + viewBottom) / 2, 1.3); };
  $('zOut').onclick = function () { zoomAt(vw / 2, (viewTop + viewBottom) / 2, 1 / 1.3); };
  $('zFit').onclick = function () { if (cam) { cam.anim = null; cam.zoom = null; cam.cs = fitCs; applyCam(); } };

  function finish(won, why) {
    if (ended) return;
    ended = true; refresh();
    var c = current, secs = Math.max(1, Math.round(activeMs / 1000));
    var perfect = won && collisions === 0 && c.level.lives !== null;
    track(won ? 'level_complete' : 'level_fail', { launches: state.launches, collisions: collisions, seconds: secs, mode: c.mode, set: c.set, perfect: perfect, why: why });
    var stats = { secs: secs, perfect: perfect, launches: state.launches, livesLeft: state.lives, hits: collisions, hints: hintsUsed, rewinds: rewinds };
    if (won) {
      if (c.mode === 'levels') {
        stats.previousBest = progress.best[c.id];
        stats.newBest = !stats.previousBest || secs < stats.previousBest;
        progress.done[c.id] = true;
        if (perfect) progress.perfect[c.id] = true;
        if (stats.newBest) progress.best[c.id] = secs;
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
  function closeSheet() { $('sheetHost').innerHTML = ''; }
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
  function allLevelCount() { return SETS.calm.length + SETS.hard.length + SETS.timed.length; }
  function winSheet(c, st) {
    var hasNext = c.mode === 'levels' && c.index < SETS[c.set].length - 1;
    var title = st.perfect ? 'Perfect!' : 'All clear';
    var lines = st.perfect ? ['You never lost a life.', 'Not one collision. Lovely.', 'Smooth as still water.']
      : c.level.lives === null ? ['Another calm stretch of water.'] : st.hits === 1 ? ['One small bump on the way.'] : [st.hits + ' bumps on the way, and you got there.'];
    var line = lines[Math.floor(Math.random() * lines.length)];
    var hearts = '';
    if (st.livesLeft !== null) {
      for (var i = 0; i < c.level.lives; i++) hearts += heartSvg(i >= st.livesLeft ? 'gone' : '').replace('<svg ', '<svg style="animation-delay:' + (i * 0.12 + 0.2) + 's" ');
      hearts = '<div class="winhearts" role="img" aria-label="' + st.livesLeft + ' of ' + c.level.lives + ' lives left">' + hearts + '</div>';
    }
    var fmt = function (s) { return s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's'; };
    var third = c.mode === 'levels' ? '<div><b>' + (st.newBest ? 'New!' : fmt(progress.best[c.id])) + '</b><span>Best time</span></div>' : '<div><b>' + st.hints + '</b><span>Hints used</span></div>';
    var lit = Object.keys(progress.done).length, gold = Object.keys(progress.perfect).length, total = allLevelCount();
    var nextLabel = hasNext ? 'Next level' : c.mode === 'levels' && c.set === 'calm' ? 'On to open water' : c.mode === 'endless' ? 'Keep drifting' : 'Back to levels';
    var s = sheet(sceneSvg(st.perfect) +
      '<div class="verdict"><h2 class="' + (st.perfect ? 'gold' : '') + '">' + title + '</h2><p>' + line + '</p></div>' + hearts +
      '<div class="stats"><div><b>' + fmt(st.secs) + '</b><span>Time</span></div><div><b>' + st.launches + '</b><span>Launches</span></div>' + third + '</div>' +
      '<div class="lanterns">' + lit + ' of ' + total + ' lanterns lit, ' + gold + ' golden<div class="lantern-bar"><i style="width:' + Math.round(lit / total * 100) + '%"></i></div></div>' +
      '<div class="actions"><button class="primary" id="next">' + nextLabel + '</button><button class="secondary" id="replayTune">Play my tune</button><button class="secondary" id="again">Play again</button><button class="secondary" id="winLevels">Levels</button></div>', 'win');
    s.querySelector('#next').onclick = function () {
      if (c.mode === 'levels') {
        if (hasNext) openLevel(c.set, c.index + 1);
        else if (c.set === 'calm') openEndless(); else levelsSheet(c.set);
      } else if (c.mode === 'endless') openEndless();
      else levelsSheet('calm');
    };
    s.querySelector('#replayTune').onclick = function () { audio(); playTune(); };
    s.querySelector('#again').onclick = function () { begin(c); };
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
  var CALM_SECTIONS = [['First steps', 0, 6], ['Twins', 6, 9], ['Compass', 9, 12], ['Sleepers', 12, 15], ['Mirrors', 15, 18], ['Patient', 18, 21], ['Everything together', 21, 24]];
  function levelsSheet(tab) {
    tab = tab || (current && current.set) || 'calm';
    var html = '<div class="row"><h2>A day on the lake</h2><button class="close" id="x" aria-label="Close">×</button></div>';
    html += '<div class="tabs" role="tablist">' + Object.keys(SET_INFO).map(function (k) { return '<button role="tab" aria-selected="' + (k === tab) + '" data-tab="' + k + '">' + SET_INFO[k].label + '</button>'; }).join('') + '</div>';
    var grid = function (from, to) {
      var out = '<div class="lv">';
      for (var i = from; i < to; i++) {
        var id = SET_INFO[tab].prefix + (i + 1);
        out += '<button data-l="' + i + '" class="' + (progress.done[id] ? 'done ' : '') + (progress.perfect[id] ? 'perfect' : '') + '" aria-label="Level ' + (i + 1) + (progress.perfect[id] ? ', perfect' : progress.done[id] ? ', cleared' : '') + '">' + (i + 1) + (progress.done[id] ? MOON_MARK : '') + (progress.perfect[id] ? STAR_MARK : '') + '</button>';
      }
      return out + '</div>';
    };
    html += '<div class="legend"><span>' + MOON_MARK.replace('class="mk m"', 'fill="#9fd8ff"') + 'Completed</span><span>' + STAR_MARK.replace('class="mk s"', 'fill="#ffc21f"') + 'Perfect, no lives lost</span></div>';
    if (tab === 'calm') CALM_SECTIONS.forEach(function (sec) { html += '<div class="chapter">' + sec[0] + '</div>' + grid(sec[1], sec[2]); });
    else {
      html += '<p class="note">' + (tab === 'hard' ? 'Bigger boards. Two lives and no hints.' : 'Beat the clock on every board. Three lives.') + '</p>' + grid(0, SETS[tab].length);
    }
    html += '<div class="modes"><button id="mDaily"><b>Today\'s puzzle</b><span>' + (progress.daily === todayKey() ? 'Cleared today. Play it again any time.' : 'One new board each day.') + '</span></button><div class="openbox"><button id="mOpen"><b>Open water</b><span>' + openLabel() + '</span></button>' +
      '<div class="setting"><span id="lHard">Harder<small>Bigger boards, 2 lives, no hints</small></span><button class="switch" id="oHard" role="switch" aria-labelledby="lHard" aria-checked="' + !!endlessOpts().hard + '"></button></div>' +
      '<div class="setting"><span id="lTimed">Timed<small>Clear each board before the clock runs out</small></span><button class="switch" id="oTimed" role="switch" aria-labelledby="lTimed" aria-checked="' + !!endlessOpts().timed + '"></button></div>' +
      '<div class="setting"><span>Map size<small>Bigger maps can be zoomed and moved around</small></span></div><div class="sizes" role="group" aria-label="Map size">' + [1, 3, 5, 10].map(function (x) { return '<button data-scale="' + x + '" aria-pressed="' + ((endlessOpts().scale || 1) === x) + '">' + (x === 1 ? 'Normal' : x + 'x') + '</button>'; }).join('') + '</div><button class="primary" id="mGo">Play open water</button></div></div>';
    var s = sheet(html);
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { levelsSheet(b.getAttribute('data-tab')); }; });
    s.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { openLevel(tab, +b.getAttribute('data-l')); }; });
    s.querySelector('#mDaily').onclick = openDaily;
    s.querySelector('#mOpen').onclick = openEndless;
    s.querySelector('#mGo').onclick = openEndless;
    [['#oHard', 'hard'], ['#oTimed', 'timed']].forEach(function (pair) {
      s.querySelector(pair[0]).onclick = function () {
        var o = endlessOpts(); o[pair[1]] = !o[pair[1]]; progress.endlessOpts = o; save('unwind.progress2', progress);
        this.setAttribute('aria-checked', o[pair[1]]);
        s.querySelector('#mOpen span').textContent = openLabel();
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
  function guideSheet() {
    var ink = colors.ink, twin = colors.twins[0], comp = colors.compass, mir = colors.mirror, gold = '#ffd23f', disc = '#1d2350', card = colors.card;
    var head = function (x, y, c) { return '<path d="M' + (x - 7) + ' ' + (y - 7) + ' L' + x + ' ' + y + ' L' + (x - 7) + ' ' + (y + 7) + '" stroke="' + c + '" stroke-width="4.5"/>'; };
    var badge = function (x, y, fill, text, label, edge) { return '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + fill + '"' + (edge ? ' stroke="' + edge + '" stroke-width="2"' : '') + '/><text x="' + x + '" y="' + (y + 4.500) + '" text-anchor="middle" font-size="13" font-weight="600" fill="' + text + '" stroke="none">' + label + '</text>'; };
    var nightDisc = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="11" fill="' + disc + '" stroke="' + gold + '" stroke-width="2"/>'; };
    var line = function (d, c, dash) { return '<path d="' + d + '" stroke="' + c + '" stroke-width="4.500"' + (dash ? ' stroke-dasharray="6 7"' : '') + '/>'; };
    var moon = '<path d="M16 16.500a7 7 0 1 0 5.500 11A6 6 0 0 1 16 16.500Z" fill="' + gold + '"/>';
    var star = '<path d="M14 15.500l2.100 4.500 4.900.600-3.600 3.400.9 4.900-4.300-2.400-4.300 2.400.9-4.900L7 20.600l4.900-.600Z" fill="' + gold + '"/>';
    var items = [
      { key: 'plain', title: 'Arrow', text: 'Tap it to send it off the board. If something is in its way, it bounces back and costs a life.',
        art: line('M6 36H26V12H50', ink) + head(55, 12, ink) },
      { key: 'twin', title: 'Twins', text: 'Same colour and letter. They leave together, so both of their paths must be clear.',
        art: line('M4 12H46', twin) + head(52, 12, twin) + badge(24, 12, twin, card, 'A') + line('M4 36H46', twin) + head(52, 36, twin) + badge(24, 36, twin, card, 'A') },
      { key: 'compass', title: 'Compass', text: 'Turns a quarter clockwise each time an arrow leaves. The wrong order can leave you stuck, so use Rewind.',
        art: '<circle cx="31" cy="23" r="19" stroke="' + comp + '" stroke-width="2.500"/>' + line('M21 23H38', comp) + head(44, 23, comp) },
      { key: 'moon', title: 'Moon arrow', text: 'Asleep and dashed. It cannot move until its star arrow leaves. Tapping it early costs nothing.',
        art: line('M16 23H50', ink, true) + head(56, 23, ink) + nightDisc(14, 23) + moon },
      { key: 'star', title: 'Star arrow', text: 'When it leaves, it wakes the moon arrow at the other end of its golden thread.',
        art: line('M16 23H50', ink) + head(56, 23, ink) + nightDisc(14, 23) + star },
      { key: 'mirror', title: 'Mirror', text: 'Not an arrow. It turns any arrow passing through by 90 degrees, so follow the new path.',
        art: '<circle cx="31" cy="23" r="19" stroke="' + mir + '" stroke-width="1.500" opacity=".6"/>' + line('M18 36L44 10', mir) },
      { key: 'patient', title: 'Patient arrow', text: 'Its number shows how many more launches it needs before it can leave. Tapping it early costs nothing.',
        art: line('M4 23H50', ink, true) + head(56, 23, ink) + badge(28, 23, card, ink, '3', ink) }
    ];
    var here = {}, arrows = current.level.arrows;
    arrows.forEach(function (a) {
      if (a.kind === 'twin') here.twin = 1; else if (a.kind === 'compass') here.compass = 1; else here.plain = 1;
      if (a.key !== undefined) here.moon = 1; if (a.isKey) here.star = 1; if (a.wait) here.patient = 1;
    });
    if ((current.level.mirrors || []).length) here.mirror = 1;
    var html = '<div class="row"><h2>Arrow guide</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      items.map(function (it) {
        return '<div class="guide-item"><svg viewBox="0 0 62 46" aria-hidden="true">' + it.art + '</svg><div><h3>' + it.title + (here[it.key] ? '<span class="onboard">On this board</span>' : '') + '</h3><p>' + it.text + '</p></div></div>';
      }).join('');
    var s = sheet(html);
    s.classList.add('side');
    s.querySelector('#x').onclick = closeSheet;
    s.onclick = function (ev) { if (ev.target === s) closeSheet(); };
    track('guide_open', {});
  }
  function restart() {
    track('restart', { launches: state.launches });
    begin(current);
  }
  function settingsSheet() {
    var themeRow = function (id, name, mood) { return '<button class="theme" data-theme-id="' + id + '" aria-pressed="' + (audioPrefs.theme === id) + '"><b>' + name + '</b><span>' + mood + '</span></button>'; };
    var html = '<div class="row"><h2>Music and sound</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      '<div class="setting"><span id="lMusic">Music</span><button class="switch" id="sMusic" role="switch" aria-labelledby="lMusic" aria-checked="' + audioPrefs.music + '"></button></div>' +
      '<div class="setting"><span id="lSound">Sound effects</span><button class="switch" id="sSound" role="switch" aria-labelledby="lSound" aria-checked="' + audioPrefs.sound + '"></button></div>' +
      '<div class="chapter" style="margin-bottom:-6px">Theme</div><p class="now" id="nowPlaying"></p><div class="modes">' + themeRow('auto', 'Follow the day', 'Changes with the time of day') + M.THEMES.map(function (t) { return themeRow(t.id, t.name, t.mood); }).join('') + '</div>';
    var s = sheet(html);
    var showNow = function () { s.querySelector('#nowPlaying').textContent = audioPrefs.music ? 'Now playing: ' + M.THEMES[wantedTheme()].name : 'Music is off'; };
    showNow();
    s.querySelector('#x').onclick = closeSheet;
    s.querySelector('#sMusic').onclick = function () {
      audioPrefs.music = !audioPrefs.music; save('unwind.audio', audioPrefs);
      audio();
      if (musicBus && ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(audioPrefs.music ? 0.8 : 0, ac.currentTime, 0.2); }
      this.setAttribute('aria-checked', audioPrefs.music); refresh(); showNow(); musicTick();
    };
    s.querySelector('#sSound').onclick = function () {
      audioPrefs.sound = !audioPrefs.sound; save('unwind.audio', audioPrefs);
      audio();
      if (sfxBus && ac) sfxBus.gain.setTargetAtTime(audioPrefs.sound ? 0.75 : 0, ac.currentTime, 0.05);
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
          if (musicBus && ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(0.8, ac.currentTime, 0.2); }
          refresh();
        }
        audio(); stopJingle(); duck(false); musicTick(); showNow();
      };
    });
  }

  /* ---------- Toolbar ---------- */
  $('bRewind').onclick = function () {
    audio();
    var ids = E.rewind(state);
    if (!ids) return;
    current.level.arrows.forEach(function (x) { if (x.kind === 'compass' && !state.removed[x.id] && ids.indexOf(x.id) < 0) angles[x.id] -= 90; });
    ids.forEach(function (id) { var a = current.level.arrows[id]; if (a.kind === 'compass') { angles[id] = E.dirOf(a, state) * 90; a.vis = angles[id]; } });
    tune.pop(); rewinds++; wakes = [];
    pluck(146.8, 0, 0.12, 0.7);
    track('rewind', { launches: state.launches });
    hintArrow = -1; refresh();
  };
  $('bHint').onclick = function () {
    audio();
    var l = current.level, sol = E.solve(l, state, l.big ? 6000 : 80000);
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
  // Small test hook: reports where to tap on screen, and jumps between boards.
  window.unwindTest = {
    point: function (id) {
      var c = current.level.arrows[id].cells[0];
      if (cam) { cam.anim = null; cam.zoom = null; cam.cx = c[0] + 0.5; cam.cy = c[1] + 0.5; applyCam(); }
      return px(c);
    },
    solve: function () { return current.level.solution && !state.launches ? current.level.solution : E.solve(current.level, state, 800000).sequence; },
    cam: function () { return cam && { zooming: !!cam.zoom, cs: cs, cx: cam.cx, cy: cam.cy, fit: fitCs, w: current.level.w, h: current.level.h, n: current.level.arrows.length }; },
    snapshot: function () { return { id: current.id, launches: state.launches, lives: state.lives, won: E.isWon(state), stuck: E.isStuck(current.level, state), hint: hintArrow, timeLeft: timeLeft, sheet: !!$('sheetHost').firstChild }; },
    arrows: function () { return current.level.arrows; },
    open: function (set, i) { openLevel(set, i); },
    setTime: function (ms) { timeLeft = ms; },
    counts: function () { return { calm: SETS.calm.length, hard: SETS.hard.length, timed: SETS.timed.length }; },
    legal: function () { return E.legalMoves(current.level, state); },
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

  track('session_start', {});
  var last = progress.last || { set: 'calm', index: 0 };
  openLevel(SETS[last.set] ? last.set : 'calm', Math.min(last.index || 0, (SETS[last.set] || SETS.calm).length - 1));
  requestAnimationFrame(frame);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.body);
  if (location.hash === '#debug' || /[?&]debug=1/.test(location.search)) debugSheet();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
