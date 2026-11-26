  /* ---------- Guiding Light 3.0 (online, two players) ----------
     The rules live in guide3.js. The keeper glimpses the real sea in the beam for five seconds, then draws the chart
     from memory. The captain sails by that chart and a radar. Each phone shows only its own role's view. */
  var G3 = window.UnwindGuide3, g3 = null, g3ctx = null, g3w = 0, g3h = 0, g3dpr = 1;
  var G3_PHASE = {
    start: ['Ready to sail', 'The captain starts the first turn.'],
    light: ['The light', 'The keeper has five seconds to study the sea.'],
    write: ['The chart', 'The keeper draws the chart from memory.'],
    boat: ['Sailing', 'The captain plans the route.'],
    next: ['Turn over', 'The captain starts the next turn.'],
    over: ['Game over', '']
  };
  function g3El() { return $('guide3'); }
  function g3Role() { return g3.role; }
  function guide3Menu() {
    var o = load('unwind.guide3Opts', { size: 0, hard: false });
    var seg = function (key, opts) { return '<div class="sizes lseg ' + (opts.length === 3 ? 'o3' : '') + '" role="group">' + opts.map(function (v) { return '<button data-g3="' + key + '" data-v="' + v[0] + '" aria-pressed="' + (String(o[key]) === String(v[0])) + '">' + v[1] + '</button>'; }).join('') + '</div>'; };
    var html = '<div class="row" id="g3MenuCard"><h2>Guiding Light 3.0</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      '<p class="note">A game of memory and talk for two, online. The keeper sees the real sea only in five-second flashes of the lighthouse beam and draws the chart from memory. The captain never sees the sea: only that chart and a radar with the coordinates, treasure and serpents. Talk to each other!</p>' +
      '<div class="setting"><span>Map size<small>A new map is made every game</small></span></div>' + seg('size', [[0, 'Small'], [1, 'Medium'], [2, 'Large']]) +
      '<div class="setting"><span>Difficulty<small>' + (o.hard ? 'Two moves a turn, more tall rocks and serpents, 2 lives' : 'Three moves a turn, 3 lives') + '</small></span></div>' + seg('hard', [[false, 'Normal'], [true, 'Hard']]) +
      '<button class="obig" id="g3Host"><b>Host a room</b><span>Send your partner the room code. Seat 1 keeps the lighthouse, seat 2 sails.</span></button>' +
      '<button class="obig" id="g3Code"><b>Enter a room code</b><span>Your partner sent you a code.</span></button>' +
      '<div class="chapter">How to play</div><div class="modes"><button id="g3Tut"><b>How Guiding Light 3.0 works</b><span>The turn, the light, the chart and the radar.</span></button></div>';
    var s = $('g3MenuCard') ? sheetInPlace(html) : sheet(html, 'tall lobby');
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-g3]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-g3'), v = b.getAttribute('data-v'); o[k] = k === 'size' ? +v : v === 'true'; save('unwind.guide3Opts', o); guide3Menu(); }; });
    s.querySelector('#g3Host').onclick = function () { lobby = null; hostOnline(this, { mode: 'guide', gv: 3, gsize: o.size, ghard: o.hard }); };
    s.querySelector('#g3Code').onclick = function () { onlineSheet('home', 0, '', true); };
    s.querySelector('#g3Tut').onclick = function () { g3Help(guide3Menu); };
  }
  function g3Help(after) {
    var pages = [
      ['Two roles', 'The keeper has the lighthouse and an empty sea chart. The captain sails a boat that cannot see the sea at all: only the chart the keeper draws, and a radar.'],
      ['1 · The light', 'Each turn starts with the light. The keeper drags to aim the beam and has five seconds to study the real sea: rocks, tall rocks, whirlpools. Tall rocks hide what is behind them.'],
      ['2 · The chart', 'Then the keeper has 30 seconds to draw what they remember. Tap a square, pick an icon. The captain sees the chart as it is drawn. Done ends it early.'],
      ['3 · Sailing', 'The captain has 15 seconds to plan up to 3 moves (2 on Hard), then the boat sails. The radar shows where the boat is (like E7), and treasure and serpents nearby. Ready ends it early.'],
      ['Talk!', 'Rocks are there even if nobody drew them: hitting one costs a life. Whirlpools fling the boat away. Serpents hunt the boat when it is close. Tap a square to ping it on your partner\'s screen.'],
      ['Winning', 'Reach a square next to the lighthouse. Treasure is optional, for glory. After the boat sails, the captain presses Next turn when you are both ready.']
    ];
    var i = 0, show = function () {
      var p = pages[i];
      var s = sheet('<div class="row"><h2>' + p[0] + '</h2><button class="close" id="x" aria-label="Close">×</button></div><p>' + p[1] + '</p><p class="note">' + (i + 1) + ' / ' + pages.length + '</p><div class="row" style="justify-content:flex-end;gap:8px">' + (i ? '<button class="secondary" id="g3Prev" style="width:auto;padding:0 18px">Back</button>' : '') + '<button class="primary" id="g3Next" style="width:auto;padding:0 22px">' + (i < pages.length - 1 ? 'Next' : 'Got it') + '</button></div>', 'tutorial');
      var done = function () { closeSheet(); if (after) after(); };
      s.querySelector('#x').onclick = done;
      s.querySelector('#g3Next').onclick = function () { if (i < pages.length - 1) { i++; show(); } else done(); };
      if (s.querySelector('#g3Prev')) s.querySelector('#g3Prev').onclick = function () { i--; show(); };
    };
    show();
  }

  /* ---------- Starting, the server's messages ---------- */
  function onGuide3Start(m, you) {
    var S = m.settings;
    if ($('sheetHost').firstChild) closeSheet();
    g3 = { G: G3.create(m.seed, { size: S.gsize || 0, hard: !!S.ghard }), seed: m.seed, role: you === 0 ? 'keeper' : 'boat', applied: 0, until: 0, angle: 0, lit: [], picker: null,
      plan: '', pings: [], anim: null, sent: {}, toasts: [], revealAt: 0 };
    var el = g3El();
    el.hidden = false; el.classList.toggle('g3-keeper', g3.role === 'keeper'); el.classList.toggle('g3-boat', g3.role === 'boat');
    document.body.classList.add('guideon');
    guideMusic(true);
    g3Paint(); g3Layout(); g3Hud();
    track('guide3_start', { size: S.gsize, hard: !!S.ghard, role: g3.role });
    netSend({ t: 'loaded' });
    if (!(progress.tutorials && progress.tutorials.guide3)) { progress.tutorials = progress.tutorials || {}; progress.tutorials.guide3 = 1; save('unwind.progress2', progress); g3Help(); }
    if (!g3.loop) g3Loop();
  }
  function g3Paint() { g3.paint = { n: g3.G.n, grid: g3.G.grid.map(function (t) { return t === G3.ROCK ? Gd.ROCK : t === G3.TALL ? Gd.BIG : t === G3.WHIRL ? Gd.WHIRL : Gd.WATER; }) }; }
  function closeGuide3() {
    if (!g3) return;
    g3 = null; g3El().hidden = true;
    document.body.classList.remove('guideon');
    guideMusic(false);
  }
  function g3Apply(role, act, ms) {
    var G = g3.G, before = G.phase, lives = G.lives, got = G.got;
    var res = G3.apply(G, role, act);
    if (!res.ok) return;
    if (ms) g3.until = performance.now() + ms;
    if (G.phase !== before) { g3.sent = {}; g3.picker = null; if (G.phase === 'boat' && g3.role === 'boat') g3.plan = ''; }
    if (act.a === 'ping') { g3.pings.push({ x: act.x, y: act.y, role: role, t0: performance.now() }); pluck(role === g3.role ? 880 : 1046.5, 0, 0.04, 0.5); }
    if (act.a === 'mark') pluck(587.33, 0, 0.03, 0.25);
    if (G.phase === 'light' && before !== 'light') { pluck(659.25, 0, 0.05, 1.2); pluck(987.77, 0.08, 0.04, 1.4); }
    if (G.last && (before === 'boat') && G.phase !== 'boat') {
      g3.anim = { t0: performance.now(), path: G.last.path, events: G.last.events };
      G.last.events.forEach(function (e, i) {
        var where = e.x !== undefined ? G3.coord(e.x, e.y) : '';
        var text = e.e === 'rock' ? (e.tall ? 'Crash! A tall rock at ' : 'Crash! A rock at ') + where : e.e === 'whirl' ? 'A whirlpool at ' + where + ' spun the boat away!' : e.e === 'treasure' ? 'Treasure found at ' + where + '!' : e.e === 'bite' ? 'A serpent bit the boat at ' + where + '!' : e.e === 'edge' ? 'That is the edge of the map.' : e.e === 'home' ? 'Home! The boat reached the lighthouse.' : '';
        if (text) setTimeout(function () { if (g3) g3Toast(text, e.e === 'rock' || e.e === 'bite'); }, 400 + i * 1100);
      });
      if (G.lives < lives) { pluck(130.8, 0.3, 0.08, 0.6); pluck(110, 0.42, 0.08, 0.7); }
      if (G.got > got) { [783.99, 987.77, 1174.66].forEach(function (f, i) { pluck(f, 0.3 + i * 0.08, 0.05, 0.6); }); }
    }
    g3Hud();
    if (G.ended && !g3.endShown) { g3.endShown = true; g3.revealAt = performance.now(); setTimeout(g3End, 2200); }
  }
  function onGuide3Event(m) {
    if (!g3) return;
    if (m.t === 'gact') { if (m.n === undefined || m.n === g3.applied) { g3.applied++; g3Apply(m.role, m.act, m.ms); } return; }
    if (m.t === 'log') {
      (m.events || []).filter(function (e) { return e.t === 'gact'; }).forEach(function (e) { if (e.n >= g3.applied) { g3.applied = e.n + 1; G3.apply(g3.G, e.role, e.act); } });
      g3.until = m.phaseLeft ? performance.now() + m.phaseLeft : 0;
      g3.anim = null; g3Hud();
      if (g3.G.ended && !g3.endShown) { g3.endShown = true; g3End(); }
      return;
    }
    if (m.t === 'nope') {
      if (m.why === 'early' && m.left > 0) { var p = g3.G.phase; setTimeout(function () { if (g3 && g3.G.phase === p) { g3.sent[p] = 0; } }, m.left + 200); }
      return;
    }
    if (m.t === 'left') {
      if (g3.G.ended) return;
      var lt = sheet('<h2>Your partner left</h2><p>' + (m.name || 'Your partner') + ' left the game, so this sea is closed.</p><button class="primary" id="g3Lobby">Back to the room</button><button class="secondary" id="g3Menu">Back to the menu</button>', 'start');
      lt.querySelector('#g3Lobby').onclick = function () { netSend({ t: 'lobby' }); closeSheet(); closeGuide3(); };
      lt.querySelector('#g3Menu').onclick = function () { closeSheet(); closeGuide3(); netSend({ t: 'leave' }); netClose(); guide3Menu(); };
      return;
    }
    if (m.t === 'offline') { showToast(m.name + ' lost connection. Waiting for them to come back…'); return; }
    if (m.t === 'back') { showToast(m.name + ' is back.'); return; }
    if (m.t === 'votes') { var vb = $('sheetHost').querySelector('#again'); if (vb) vb.textContent = 'Play again (' + m.count + '/' + m.total + ')'; return; }
  }
  function g3Send(act) { netSend({ t: 'gact', act: act }); }
  // When a timed step runs out, its owner's phone asks the server to move on (once; the server checks the clock).
  function g3Clock(now) {
    var G = g3.G, p = G.phase;
    if (!G3.PHASE_MS[p] || G.ended || !g3.until || now < g3.until + 150 || g3.sent[p]) return;
    var owner = p === 'boat' ? 'boat' : 'keeper';
    if (g3.role !== owner && now < g3.until + 2500) return;   // the other phone steps in if the owner's is slow
    g3.sent[p] = 1;
    if (p === 'boat' && g3.role === 'boat' && g3.plan !== G.plan) g3Send({ a: 'route', steps: g3.plan });
    g3Send({ a: 'advance', p: p });
  }

  /* ---------- Around the chart ---------- */
  function g3Hud() {
    var G = g3.G, el = g3El(), me = g3.role, ph = G3_PHASE[G.phase] || ['', ''];
    el.querySelector('.g-role').textContent = me === 'keeper' ? 'Lighthouse keeper' : 'Boat captain';
    el.querySelector('.g3-turn b').textContent = String(Math.max(1, G.turn));
    el.querySelector('.g-lives').innerHTML = Array.apply(null, Array(G.maxLives)).map(function (_, i) { return '<svg viewBox="-1 -1 26 24"' + (i < G.lives ? '' : ' class="gone"') + ' aria-hidden="true"><path d="M12 21 C 5 15 1 11.5 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 11.5 19 15 12 21Z"/></svg>'; }).join('');
    el.querySelector('.g3-gold b').textContent = G.got + ' / ' + G.treasure.length;
    el.querySelector('.g3-ph b').textContent = ph[0];
    var msg = '', btns = '';
    if (G.ended) msg = G.ended === 'won' ? 'Home! The boat reached the lighthouse.' : 'The boat is lost.';
    else if (G.phase === 'start' || G.phase === 'next') {
      if (me === 'boat') { msg = G.phase === 'start' ? 'When you are both ready, start the first turn.' : 'Talk it over, then start the next turn.'; btns = '<button class="primary" id="g3NextBtn">' + (G.phase === 'start' ? 'Start' : 'Next turn') + '</button>'; }
      else msg = G.phase === 'start' ? 'Waiting for the captain to start. Get ready to look hard!' : 'Waiting for the captain to start the next turn.';
    } else if (G.phase === 'light') msg = me === 'keeper' ? 'Drag to aim the light. Remember everything you see!' : 'The keeper is studying the sea…';
    else if (G.phase === 'write') {
      if (me === 'keeper') { msg = 'Tap a square to draw what you saw.'; btns = '<button class="primary" id="g3Done">Done</button>'; }
      else msg = 'The keeper is drawing the chart. Tap a square to ping it.';
    } else if (G.phase === 'boat') {
      if (me === 'boat') {
        var path = G3.planPath(G, g3.plan);
        msg = g3.plan ? path.map(function (p) { return G3.coord(p[0], p[1]); }).join(' → ') : 'Plan up to ' + G.steps + ' moves with the arrows.';
        btns = '<div class="g3-pad"><button data-step="W" aria-label="West">←</button><button data-step="N" aria-label="North">↑</button><button data-step="S" aria-label="South">↓</button><button data-step="E" aria-label="East">→</button></div><button id="g3Undo"' + (g3.plan ? '' : ' disabled') + '>Undo</button><button class="primary" id="g3Ready">Sail</button>';
      } else msg = 'The captain is planning the route. Tap a square to ping it.';
    }
    el.querySelector('.g-msg').textContent = msg;
    var bt = el.querySelector('.g-btns'); bt.innerHTML = btns;
    var q = function (id) { return bt.querySelector(id); };
    if (q('#g3NextBtn')) q('#g3NextBtn').onclick = function () { this.disabled = true; g3Send({ a: 'next' }); };
    if (q('#g3Done')) q('#g3Done').onclick = function () { this.disabled = true; g3.sent.write = 1; g3Send({ a: 'done' }); };
    if (q('#g3Ready')) q('#g3Ready').onclick = function () { this.disabled = true; g3.sent.boat = 1; g3Send({ a: 'route', steps: g3.plan }); g3Send({ a: 'ready' }); };
    if (q('#g3Undo')) q('#g3Undo').onclick = function () { g3.plan = g3.plan.slice(0, -1); g3Send({ a: 'route', steps: g3.plan }); g3Hud(); };
    bt.querySelectorAll('[data-step]').forEach(function (b) { b.disabled = g3.plan.length >= G.steps; b.onclick = function () { if (g3.plan.length >= G.steps) return; g3.plan += b.getAttribute('data-step'); g3Send({ a: 'route', steps: g3.plan }); pluck(523.25, 0, 0.03, 0.2); g3Hud(); }; });
    el.querySelector('.g3-picker').hidden = !g3.picker;
  }
  function g3Toast(text, bad) {
    var t = g3El().querySelector('.g-toast'); t.textContent = text; t.classList.toggle('bad', !!bad); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush();
  }
  function g3Layout() {
    if (!g3) return;
    var cv = g3El().querySelector('canvas'), r = cv.getBoundingClientRect();
    g3dpr = Math.min(2, window.devicePixelRatio || 1); g3w = r.width; g3h = r.height;
    cv.width = Math.round(g3w * g3dpr); cv.height = Math.round(g3h * g3dpr);
    g3ctx = cv.getContext('2d');
  }
  window.addEventListener('resize', function () { if (g3) g3Layout(); });
  if (window.ResizeObserver) new ResizeObserver(function () { if (g3) g3Layout(); }).observe(g3El().querySelector('canvas'));
  // The chart leaves room on the left and top for its coordinates.
  function g3Cam() { var n = g3.G.n, cs = Math.min(g3w / (n + 1.1), g3h / (n + 1.1)); return { cs: cs, ox: (g3w - n * cs) / 2 + cs * 0.3, oy: (g3h - n * cs) / 2 + cs * 0.3 }; }

  /* ---------- Drawing ---------- */
  function g3Loop() {
    g3.loop = true;
    var tick = function (now) { if (!g3) return; g3Clock(now); g3Draw(now); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function g3Draw(now) {
    var c = g3ctx, G = g3.G, cam = g3Cam(), cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; };
    var me = g3.role, reveal = !!G.ended, el = g3El();
    c.setTransform(g3dpr, 0, 0, g3dpr, 0, 0);
    c.fillStyle = '#060a1c'; c.fillRect(0, 0, g3w, g3h);
    // The phase clock.
    var left = G3.PHASE_MS[G.phase] && g3.until ? Math.max(0, g3.until - now) : 0, bar = el.querySelector('.g3-clock i'), secs = el.querySelector('.g3-ph span');
    bar.style.transform = 'scaleX(' + (G3.PHASE_MS[G.phase] ? left / G3.PHASE_MS[G.phase] : 0) + ')';
    secs.textContent = G3.PHASE_MS[G.phase] ? Math.ceil(left / 1000) + 's' : '';
    // The keeper's beam reveals the real sea while the light is on.
    var lighting = me === 'keeper' && G.phase === 'light' && !G.ended, lit = {};
    if (lighting) G3.litCells(G, g3.angle).forEach(function (k) { lit[k] = 1; });
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var k = y * G.n + x, px = X(x), py = Y(y), t = G.grid[k];
      c.fillStyle = lit[k] ? '#2b3c74' : reveal ? '#1f2d5e' : ((x + y) % 2 ? '#141f45' : '#16224a');
      c.fillRect(px, py, cs + 0.5, cs + 0.5);
      if ((lit[k] || reveal) && t !== G3.WATER && t !== G3.LIGHT) guideTerrain(c, g3.paint, x, y, px, py, cs, now, 1);
    }
    // Grid and coordinates.
    c.strokeStyle = 'rgba(160,180,255,.12)'; c.lineWidth = 1;
    for (var gl = 1; gl < G.n; gl++) { c.beginPath(); c.moveTo(X(gl), Y(0)); c.lineTo(X(gl), Y(G.n)); c.moveTo(X(0), Y(gl)); c.lineTo(X(G.n), Y(gl)); c.stroke(); }
    c.strokeStyle = 'rgba(255,214,140,.35)'; c.lineWidth = 2; c.strokeRect(X(0), Y(0), G.n * cs, G.n * cs);
    c.fillStyle = 'rgba(238,240,255,.7)'; c.font = '600 ' + Math.max(9, Math.round(cs * 0.36)) + 'px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var i = 0; i < G.n; i++) { c.fillText(String.fromCharCode(65 + i), X(i) + cs / 2, Y(0) - cs * 0.38); c.fillText(String(i + 1), X(0) - cs * 0.42, Y(i) + cs / 2); }
    // The beam itself.
    if (lighting) g3Beam(c, X(G.c) + cs / 2, Y(G.c) + cs / 2, g3.angle, cs * G.n * 1.5);
    // The chart the keeper drew (both players see it).
    Object.keys(G.marks).forEach(function (kk) { var mx = +kk % G.n, my = Math.floor(+kk / G.n); g3Mark(c, X(mx) + cs / 2, Y(my) + cs / 2, cs, G.marks[kk], lighting && lit[kk] ? 0.55 : 1); });
    // A rock the boat ran into shows where it was, for the rest of that turn.
    if (G.last && G.last.events) G.last.events.forEach(function (e) { if (e.e === 'rock' || e.e === 'whirl') { var bx = X(e.x) + cs / 2, by = Y(e.y) + cs / 2; c.strokeStyle = '#ff6b6b'; c.lineWidth = Math.max(2, cs * 0.08); c.beginPath(); c.moveTo(bx - cs * 0.3, by - cs * 0.3); c.lineTo(bx + cs * 0.3, by + cs * 0.3); c.moveTo(bx + cs * 0.3, by - cs * 0.3); c.lineTo(bx - cs * 0.3, by + cs * 0.3); c.stroke(); } });
    // The lighthouse.
    var lx = X(G.c) + cs / 2, img = lighthouseImage(), lk = cs * 1.15 / 85;
    if (img.complete && img.naturalWidth) c.drawImage(img, lx - 20 * lk, Y(G.c) + cs * 0.85 - 110 * lk, 40 * lk, 126 * lk);
    var glow = c.createRadialGradient(lx, Y(G.c) + cs * 0.5 - cs * 0.62, 0, lx, Y(G.c) + cs * 0.5 - cs * 0.62, cs * 0.6);
    glow.addColorStop(0, lighting ? 'rgba(255,233,168,.9)' : 'rgba(255,233,168,.45)'); glow.addColorStop(1, 'rgba(255,233,168,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(lx, Y(G.c) + cs * 0.5 - cs * 0.62, cs * 0.6, 0, 7); c.fill();
    // The captain's view: the boat, the planned route and the radar.
    if (me === 'boat' || reveal) {
      var bp = g3BoatPos(now);
      if (me === 'boat' && !G.ended) {
        var R = G3.RADAR, sweep = (now / 2200) % 1 * Math.PI * 2, rx = X(bp.x) + cs / 2, ry = Y(bp.y) + cs / 2, rr = (R + 0.5) * cs;
        c.save(); c.beginPath(); c.rect(X(0), Y(0), G.n * cs, G.n * cs); c.clip(); c.save(); c.beginPath(); c.arc(rx, ry, rr, 0, 7); c.clip();
        var rg = c.createRadialGradient(rx, ry, 0, rx, ry, rr); rg.addColorStop(0, 'rgba(90,255,160,.10)'); rg.addColorStop(1, 'rgba(90,255,160,.03)');
        c.fillStyle = rg; c.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
        var sg = c.createConicGradient ? c.createConicGradient(sweep - 0.9, rx, ry) : null;
        if (sg) { sg.addColorStop(0, 'rgba(90,255,160,0)'); sg.addColorStop(0.14, 'rgba(90,255,160,.28)'); sg.addColorStop(0.15, 'rgba(90,255,160,0)'); c.fillStyle = sg; c.fillRect(rx - rr, ry - rr, rr * 2, rr * 2); }
        c.restore();
        c.strokeStyle = 'rgba(90,255,160,.45)'; c.lineWidth = 1.5; for (var q = 1; q <= R; q++) { c.beginPath(); c.arc(rx, ry, (q + 0.5) * cs, 0, 7); c.stroke(); } c.restore();
        if (!g3.anim) G3.radar(G).forEach(function (b) { g3Blip(c, X(b.x) + cs / 2, Y(b.y) + cs / 2, cs, now, b.kind); });
        // The planned route.
        if (G.phase === 'boat' && g3.plan) {
          var pp = G3.planPath(G, g3.plan);
          c.strokeStyle = 'rgba(255,233,168,.85)'; c.lineWidth = Math.max(2, cs * 0.09); c.setLineDash([cs * 0.16, cs * 0.12]); c.lineJoin = 'round';
          c.beginPath(); pp.forEach(function (p, j) { c[j ? 'lineTo' : 'moveTo'](X(p[0]) + cs / 2, Y(p[1]) + cs / 2); }); c.stroke(); c.setLineDash([]);
          pp.slice(1).forEach(function (p, j) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(X(p[0]) + cs / 2, Y(p[1]) + cs / 2, cs * 0.16, 0, 7); c.fill(); c.fillStyle = '#2a2550'; c.font = '700 ' + Math.round(cs * 0.22) + 'px system-ui'; c.fillText(String(j + 1), X(p[0]) + cs / 2, Y(p[1]) + cs / 2 + 0.5); });
        }
      }
      if (reveal) { G.treasure.forEach(function (t) { if (!t.got) g3Blip(c, X(t.x) + cs / 2, Y(t.y) + cs / 2, cs, now, 'treasure'); }); G.serpents.forEach(function (s) { guideSerpent(c, X(s.x) + cs / 2, Y(s.y) + cs / 2, cs, now, s.id, 1); }); }
      guideBoat(c, X(bp.x) + cs / 2, Y(bp.y) + cs / 2, cs, now, true, bp.alpha, 0);
      if (me === 'boat') {
        var lab = G3.coord(G.boat.x, G.boat.y);
        c.font = '700 ' + Math.max(11, Math.round(cs * 0.34)) + 'px Fredoka, system-ui'; var tw = c.measureText(lab).width + 12;
        c.fillStyle = 'rgba(20,40,30,.85)'; c.fillRect(X(bp.x) + cs / 2 - tw / 2, Y(bp.y) - cs * 0.55, tw, cs * 0.45);
        c.fillStyle = '#7dff9a'; c.fillText(lab, X(bp.x) + cs / 2, Y(bp.y) - cs * 0.32);
      }
    }
    // Pings.
    g3.pings = g3.pings.filter(function (p) { return now - p.t0 < 2600; });
    g3.pings.forEach(function (p) {
      var u = Math.max(0, now - p.t0) / 2600, px2 = X(p.x) + cs / 2, py2 = Y(p.y) + cs / 2, col = p.role === 'keeper' ? '255,214,120' : '125,255,154';
      for (var q = 0; q < 2; q++) { var v = (u * 2 + q * 0.5) % 1; c.strokeStyle = 'rgba(' + col + ',' + (1 - v) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(px2, py2, cs * (0.3 + v * 0.9), 0, 7); c.stroke(); }
    });
    // The icon picker's square.
    if (g3.picker) { c.strokeStyle = '#ffe9a8'; c.lineWidth = 2.5; c.strokeRect(X(g3.picker[0]) + 1, Y(g3.picker[1]) + 1, cs - 2, cs - 2); }
  }
  function g3BoatPos(now) {
    var G = g3.G, a = g3.anim;
    if (!a || a.path.length < 2) return { x: G.boat.x, y: G.boat.y, alpha: 1 };
    var segs = a.path.length - 1, f = Math.max(0, (now - a.t0) / 330);
    if (f >= segs) { g3.anim = null; return { x: G.boat.x, y: G.boat.y, alpha: 1 }; }
    var k = Math.floor(f), u = f - k, p = a.path[k], q = a.path[k + 1];
    return { x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, alpha: 1 };
  }
  function g3Beam(c, cx, cy, angle, len) {
    c.save();
    var half = 20 * Math.PI / 180, a0 = angle - Math.PI / 2 - half, a1 = angle - Math.PI / 2 + half;
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, len);
    g.addColorStop(0, 'rgba(255,240,190,.55)'); g.addColorStop(0.6, 'rgba(255,225,150,.18)'); g.addColorStop(1, 'rgba(255,225,150,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, len, a0, a1); c.closePath(); c.fill();
    c.restore();
  }
  function g3Mark(c, cx, cy, cs, icon, alpha) {
    var s = cs / 24;
    c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.lineCap = 'round'; c.lineJoin = 'round';
    // Drawn like ink on a chart: a pale disc behind each mark so it reads on the dark sea.
    c.fillStyle = 'rgba(244,236,214,.16)'; c.beginPath(); c.arc(0, 0, 10.5 * s, 0, 7); c.fill();
    if (icon === 'rock') { c.fillStyle = '#b8b5c9'; c.beginPath(); c.ellipse(0, 2 * s, 8 * s, 5.5 * s, 0, 0, 7); c.fill(); c.fillStyle = '#dcdae8'; c.beginPath(); c.ellipse(-2 * s, 0, 3.5 * s, 2.4 * s, 0, 0, 7); c.fill(); }
    else if (icon === 'tall') { c.fillStyle = '#b8b5c9'; c.beginPath(); c.moveTo(-6 * s, 8 * s); c.lineTo(-4 * s, -7 * s); c.lineTo(0, -9.5 * s); c.lineTo(4 * s, -7 * s); c.lineTo(6 * s, 8 * s); c.closePath(); c.fill(); c.strokeStyle = 'rgba(60,58,80,.6)'; c.lineWidth = Math.max(1, s); c.beginPath(); c.moveTo(-5 * s, 2 * s); c.lineTo(5 * s, 1 * s); c.stroke(); }
    else if (icon === 'whirl') { c.strokeStyle = '#9fd3ff'; c.lineWidth = Math.max(1.5, 1.8 * s); c.beginPath(); for (var t = 0; t < 14; t++) { var a = t * 0.55, r = 1 + t * 0.62; c[t ? 'lineTo' : 'moveTo'](Math.cos(a) * r * s, Math.sin(a) * r * s); } c.stroke(); }
    else if (icon === 'clear') { c.strokeStyle = '#7dff9a'; c.lineWidth = Math.max(2, 2.6 * s); c.beginPath(); c.moveTo(-6 * s, 0); c.lineTo(-2 * s, 5 * s); c.lineTo(7 * s, -5 * s); c.stroke(); }
    else if (icon === 'danger') { c.fillStyle = '#ff6b6b'; c.beginPath(); c.moveTo(0, -9 * s); c.lineTo(9 * s, 7 * s); c.lineTo(-9 * s, 7 * s); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(-1.2 * s, -3 * s, 2.4 * s, 6 * s); c.beginPath(); c.arc(0, 5 * s, 1.4 * s, 0, 7); c.fill(); }
    c.restore();
  }
  function g3Blip(c, cx, cy, cs, now, kind) {
    var s = cs / 24, pulse = 0.75 + 0.25 * Math.sin(now / 260);
    c.save(); c.translate(cx, cy);
    if (kind === 'treasure') {
      c.fillStyle = 'rgba(255,214,90,' + (0.25 * pulse) + ')'; c.beginPath(); c.arc(0, 0, 11 * s, 0, 7); c.fill();
      c.fillStyle = '#8a5a36'; c.fillRect(-7 * s, -2 * s, 14 * s, 9 * s); c.fillStyle = '#a8703f'; c.beginPath(); c.moveTo(-7 * s, -2 * s); c.quadraticCurveTo(0, -9 * s, 7 * s, -2 * s); c.closePath(); c.fill();
      c.fillStyle = '#ffd23f'; c.fillRect(-7 * s, -1 * s, 14 * s, 2 * s); c.fillRect(-1.5 * s, -2 * s, 3 * s, 5 * s);
    } else {
      c.fillStyle = 'rgba(255,90,90,' + (0.3 * pulse) + ')'; c.beginPath(); c.arc(0, 0, 11 * s, 0, 7); c.fill();
      c.strokeStyle = '#ff6b6b'; c.lineWidth = Math.max(2, 2.6 * s); c.beginPath(); c.moveTo(-8 * s, 3 * s); c.quadraticCurveTo(-4 * s, -5 * s, 0, 2 * s); c.quadraticCurveTo(4 * s, 8 * s, 8 * s, -2 * s); c.stroke();
      c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(8 * s, -3 * s, 2.6 * s, 0, 7); c.fill();
    }
    c.restore();
  }

  /* ---------- Input ---------- */
  function g3Tile(ev) {
    var r = g3El().querySelector('canvas').getBoundingClientRect(), cam = g3Cam();
    return { px: ev.clientX - r.left, py: ev.clientY - r.top, x: Math.floor((ev.clientX - r.left - cam.ox) / cam.cs), y: Math.floor((ev.clientY - r.top - cam.oy) / cam.cs), cam: cam };
  }
  function g3Aim(ev) {
    var t = g3Tile(ev), G = g3.G, lx = t.cam.ox + (G.c + 0.5) * t.cam.cs, ly = t.cam.oy + (G.c + 0.5) * t.cam.cs;
    if (Math.hypot(t.px - lx, t.py - ly) < t.cam.cs * 0.4) return;
    g3.angle = Math.atan2(t.px - lx, -(t.py - ly));
  }
  function g3Down(ev) {
    if (!g3 || g3.G.ended) return;
    var G = g3.G, t = g3Tile(ev);
    if (g3.role === 'keeper' && G.phase === 'light') { g3.aiming = true; g3Aim(ev); return; }
    if (!G3.inside(G, t.x, t.y)) { g3.picker = null; g3Hud(); return; }
    if (g3.role === 'keeper' && G.phase === 'write') {
      if (t.x === G.c && t.y === G.c) return;
      g3.picker = [t.x, t.y]; g3PlacePicker(); g3Hud(); return;
    }
    g3Send({ a: 'ping', x: t.x, y: t.y });
  }
  function g3PlacePicker() {
    var pk = g3El().querySelector('.g3-picker'), cam = g3Cam();
    pk.hidden = false;
    var w = pk.offsetWidth || 300, h = pk.offsetHeight || 64;
    var left = Math.max(8, Math.min(g3w - w - 8, cam.ox + (g3.picker[0] + 0.5) * cam.cs - w / 2)), top = cam.oy + (g3.picker[1] + 1) * cam.cs + 6;
    if (top + h > g3h - 4) top = Math.max(4, cam.oy + g3.picker[1] * cam.cs - h - 6);
    pk.style.left = left + 'px'; pk.style.top = top + 'px';
  }
  (function () {
    var el = g3El(); if (!el) return;
    var cv = el.querySelector('canvas');
    cv.addEventListener('pointerdown', function (ev) { audio(); g3Down(ev); });
    cv.addEventListener('pointermove', function (ev) { if (g3 && g3.aiming && g3.G.phase === 'light') g3Aim(ev); });
    window.addEventListener('pointerup', function () { if (g3) g3.aiming = false; });
    el.querySelector('.g-close').onclick = function () {
      if (!g3) return;
      var s = sheet('<h2>Leave this game?</h2><p>Your partner will be left alone at sea.</p><button class="primary" id="g3Stay">Keep playing</button><button class="secondary" id="g3Go">Leave</button>', 'start');
      s.querySelector('#g3Stay').onclick = closeSheet;
      s.querySelector('#g3Go').onclick = function () { closeSheet(); closeGuide3(); netSend({ t: 'leave' }); netClose(); guide3Menu(); };
    };
    el.querySelector('.g-help').onclick = function () { if (g3) g3Help(); };
    el.querySelectorAll('[data-icon]').forEach(function (b) {
      b.onclick = function () {
        if (!g3 || !g3.picker) return;
        var icon = b.getAttribute('data-icon'), p = g3.picker;
        if (icon === 'ping') g3Send({ a: 'ping', x: p[0], y: p[1] });
        else g3Send({ a: 'mark', x: p[0], y: p[1], icon: icon });
        g3.picker = null; g3Hud();
      };
    });
  })();

  /* ---------- The end ---------- */
  function g3End() {
    if (!g3) return;
    var G = g3.G, won = G.ended === 'won';
    if (won) [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { pluck(f, i * 0.12, 0.07, 1.6); });
    else { pluck(220, 0, 0.08, 1.2); pluck(174.6, 0.2, 0.07, 1.4); }
    track('guide3_end', { result: G.ended, turns: G.turn, treasure: G.got, lives: G.lives, role: g3.role });
    var s = sheet('<div class="g-end"><h2>' + (won ? 'Home safe!' : 'Lost at sea') + '</h2><p>' + (won ? 'The boat reached the lighthouse.' : 'The boat ran out of lives.') + '</p><p>The fog has lifted: now you can both see the whole sea.</p>' +
      '<div class="lsum"><span>Turns<b class="notr">' + G.turn + '</b></span><span>Treasure<b class="notr">' + G.got + ' / ' + G.treasure.length + '</b></span><span>Lives left<b class="notr">' + Math.max(0, G.lives) + '</b></span></div>' +
      '<button class="primary" id="again">Play again</button><button class="secondary" id="g3Look">Look at the sea</button><button class="secondary" id="g3Lobby">Back to the room</button></div>', 'start');
    s.querySelector('#again').onclick = function () { netSend({ t: 'again' }); this.disabled = true; this.textContent = 'Waiting for your partner…'; };
    s.querySelector('#g3Look').onclick = function () { closeSheet(); var bt = g3El().querySelector('.g-btns'); bt.innerHTML = '<button class="primary" id="g3Back">Done</button>'; bt.querySelector('#g3Back').onclick = g3End; };
    s.querySelector('#g3Lobby').onclick = function () { netSend({ t: 'lobby' }); closeSheet(); closeGuide3(); };
  }
