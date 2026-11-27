  /* ---------- Guiding Light 3.0 (online, two players; or one device from Boarding Up) ----------
     The rules live in guide3.js. Each phone shows only its own role's view:
     - the keeper sees the real sea only in the 7.5 s beam (and the boat, if the beam finds it), and otherwise an old
       paper chart that only holds what they drew;
     - the captain only ever sees a green radar screen: the keeper's chart, the boat, the lighthouse, traps, and the
       deep treasure and serpents inside the radar's circle.
     The screen uses the game's usual header and footer, and the chart can be zoomed. */
  var G3 = window.UnwindGuide3, g3 = null, g3ctx = null, g3w = 0, g3h = 0, g3dpr = 1;
  var G3_PHASE = { start: 'Get ready', light: 'Light', write: 'Chart', boat: 'Sailing', next: 'Turn over', over: 'Game over' };
  // One small picture per step, for the step banner under the counters.
  var G3_PHICON = {
    start: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="3"/>',
    light: '<path d="M4 12l15-6v12z" fill="currentColor" stroke="none" opacity=".55"/><circle cx="4.5" cy="12" r="2.5"/>',
    write: '<path d="M5 19l2-6 9-9 4 4-9 9zM14 6l4 4"/>',
    boat: '<path d="M4 15h16l-2 4H6zM12 4v10M12 4l6 9h-6"/>',
    next: '<path d="M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8M16 4c0 5-8 5-8 8"/>',
    over: '<path d="M6 4v16M6 5h11l-2 4 2 4H6"/>'
  };
  var G3_PAPER = { bg: '#d9ab68', table: '#24150d', grid: '#dcb072', ink: '#3d2314', red: '#a3291c', line: 'rgba(61,35,20,.42)' };
  var G3_RADAR = { bg: '#020c07', sea: '#03170c', line: 'rgba(90,255,160,.16)', ink: '#7dffb0', glow: 'rgba(90,255,160,' };
  function g3El() { return $('guide3'); }
  // The art's pictures, made once and kept. A picture may still be loading: it is simply skipped until it is ready.
  var g3Pics = {};
  function g3Pic(group, key) {
    var id = group + '.' + key, im = g3Pics[id];
    if (!im) { var src = group ? G3ART[group][key] : G3ART[key]; im = g3Pics[id] = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); }
    return im;
  }
  function g3PicsLoad() { ['chart', 'radar', 'radarMarks', 'sea', 'map'].forEach(function (g) { Object.keys(G3ART[g]).forEach(function (k) { g3Pic(g, k); }); }); g3Pic('', 'rose'); g3Pic('', 'boat'); }
  // Draws a square picture centred on cx, cy, size wide, turned by rot.
  function g3Put(c, im, cx, cy, size, rot, alpha) {
    if (!im.complete || !im.naturalWidth) return;
    c.save(); if (alpha !== undefined) c.globalAlpha *= alpha; c.translate(cx, cy); if (rot) c.rotate(rot);
    c.drawImage(im, -size / 2, -size / 2, size, size); c.restore();
  }
  var G3_ROT = { n: -Math.PI / 2, e: 0, s: Math.PI / 2, w: Math.PI };

  /* ---------- The menu (online) ---------- */
  function guide3Menu() {
    var o = load('unwind.guide3Opts', { size: 0, hard: false });
    var seg = function (key, opts) { return '<div class="sizes lseg ' + (opts.length === 3 ? 'o3' : '') + '" role="group">' + opts.map(function (v) { return '<button data-g3="' + key + '" data-v="' + v[0] + '" aria-pressed="' + (String(o[key]) === String(v[0])) + '">' + v[1] + '</button>'; }).join('') + '</div>'; };
    var html = '<div class="row" id="g3MenuCard"><h2>Guiding Light 3.0</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      '<p class="note">A game of memory and talk for two, online. The keeper sees the real sea only in short flashes of the lighthouse beam and draws the chart from memory. The captain never sees the sea: only that chart on a radar screen, with the coordinates, deep treasure and serpents. Talk to each other!</p>' +
      '<div class="setting"><span>Map size<small>A new map is made every game</small></span></div>' + seg('size', [[0, 'Small'], [1, 'Medium'], [2, 'Large']]) +
      '<div class="setting"><span>Difficulty<small>' + (o.hard ? 'Two moves a turn, more tall rocks, gusts and serpents, 2 sailors' : 'Three moves a turn, 3 sailors') + '</small></span></div>' + seg('hard', [[false, 'Normal'], [true, 'Hard']]) +
      '<button class="obig" id="g3Host"><b>Host a room</b><span>Send your partner the room code. Seat 1 keeps the lighthouse, seat 2 sails.</span></button>' +
      '<button class="obig" id="g3Code"><b>Enter a room code</b><span>Your partner sent you a code.</span></button>' +
      '<div class="chapter">How to play</div><div class="modes"><button id="g3Tut"><b>How Guiding Light 3.0 works</b><span>Both roles, the light, the chart and the radar.</span></button></div>';
    var s = $('g3MenuCard') ? sheetInPlace(html) : sheet(html, 'tall lobby');
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-g3]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-g3'), v = b.getAttribute('data-v'); o[k] = k === 'size' ? +v : v === 'true'; save('unwind.guide3Opts', o); guide3Menu(); }; });
    s.querySelector('#g3Host').onclick = function () { lobby = null; hostOnline(this, { mode: 'guide', gv: 3, gsize: o.size, ghard: o.hard }); };
    s.querySelector('#g3Code').onclick = function () { onlineSheet('home', 0, '', true); };
    s.querySelector('#g3Tut').onclick = function () { g3Help('all', guide3Menu); };
  }

  /* ---------- How to play ----------
     The first time, both roles are explained. In a game, the guide only explains your own role. The pages change in
     place, so the card does not close and open again between them. */
  var G3_PAGES = {
    roles: ['Two roles', 'The keeper has the lighthouse and an empty paper chart. The captain sails a boat that cannot see the sea at all: only a radar screen with the chart the keeper draws. You win together, so talk!'],
    light: ['The keeper: the light', 'Each turn starts with the light. Drag to aim the beam: for 7.5 seconds you see the real sea. Rocks, tall rocks (they hide what is behind them), whirlpools, gusts of wind, floating treasure, serpents, and the boat if the beam finds it. Remember all you can! Done ends it early.'],
    chart: ['The keeper: the chart', 'Then the light goes out and you have 30 seconds to draw on your chart from memory. Tap a square and pick what is there. The captain sees your drawings on the radar as you make them. Done ends it early.'],
    trap: ['The keeper: traps', 'While drawing, you can also throw one trap a turn: tap a square and pick Trap. Changed your mind? Pick it again on the same turn to take it back. It lasts 3 turns. A serpent that swims onto it or next to it, diagonals too, is stunned for 3 turns: it sinks and cannot bite.'],
    radar: ['The captain: the radar', 'You only see the radar: the keeper\'s chart, your boat\'s square (like E7), and what the radar picks up inside its circle, about 3 squares around you: deep treasure and serpents. Tell the keeper where you are, and what you see.'],
    sail: ['The captain: sailing', 'You have 30 seconds to plan up to 3 moves (2 on Hard). Tap a square next to the boat, then the next one. Tap a planned square again to take it back. Pinch, scroll or use + and − to zoom. Sail ends it early. Then press Next turn when you are both ready.'],
    danger: ['Dangers', 'Rocks are there even if nobody drew them: a crash costs a sailor. So does a serpent\'s bite, unless the serpent is stunned. Whirlpools fling the boat away, and a gust of wind blows it one square further. Lose every sailor and the boat is lost.'],
    win: ['Winning', 'Sail into the lighthouse itself to win: passing next to it is not enough. Half the treasure lies deep, where only the radar sees it; half floats, where only the light shows it. Sailing over any treasure finds it. Find every one for a perfect game. Tap any square to ping it on your partner\'s screen.']
  };
  function g3Help(which, after) {
    var keys = which === 'keeper' ? ['light', 'chart', 'trap', 'danger', 'win'] : which === 'boat' ? ['radar', 'sail', 'danger', 'win'] : ['roles', 'light', 'chart', 'trap', 'radar', 'sail', 'danger', 'win'];
    var i = 0, first = true, done = function () { closeSheet(); if (after) after(); };
    var show = function () {
      var p = G3_PAGES[keys[i]];
      var html = '<div class="row" id="g3HelpCard"><h2>' + p[0] + '</h2><button class="close" id="x" aria-label="Close">×</button></div><p>' + p[1] + '</p><p class="note"><span class="notr">' + (i + 1) + ' / ' + keys.length + '</span></p><div class="row" style="justify-content:flex-end;gap:8px">' + (i ? '<button class="secondary" id="g3Prev" style="width:auto;padding:0 18px">Back</button>' : '') + '<button class="primary" id="g3Next" style="width:auto;padding:0 22px">' + (i < keys.length - 1 ? 'Next' : 'Got it') + '</button></div>';
      var s = first || !$('g3HelpCard') ? sheet(html, 'tutorial') : sheetInPlace(html);
      first = false;
      s.querySelector('#x').onclick = done;
      s.querySelector('#g3Next').onclick = function () { if (i < keys.length - 1) { i++; show(); } else done(); };
      if (s.querySelector('#g3Prev')) s.querySelector('#g3Prev').onclick = function () { i--; show(); };
    };
    show();
  }
  // In a game: on one device the clock simply stops while the guide is open. Online the clock is the server's, so
  // the guide waits for the end of the turn instead of stopping the game for both players.
  function g3HelpRequest() {
    if (!g3) return;
    var G = g3.G, timed = !!G3.PHASE_MS[G.phase] && !G.ended;
    if (g3.local) {
      var paused = timed && g3.until ? Math.max(0, g3.until - performance.now()) : 0;
      if (paused) g3.until = 0;
      g3.paused = !!paused;
      g3Help(g3.role, function () { if (!g3) return; g3.paused = false; if (paused) g3.until = performance.now() + paused; g3Hud(); });
      return;
    }
    if (timed) { g3.helpQueued = true; g3Toast('Help will open when this turn ends.'); return; }
    g3Help(g3.role);
  }

  /* ---------- Starting ---------- */
  function onGuide3Start(m, you) {
    var S = m.settings;
    if ($('sheetHost').firstChild) closeSheet();
    g3Init(m.seed, { size: S.gsize || 0, hard: !!S.ghard }, you === 0 ? 'keeper' : 'boat', false, -1);
    netSend({ t: 'loaded' });
  }
  function g3Init(seed, opts, role, local, bu) {
    g3 = { G: G3.create(seed, opts), seed: seed, opts: opts, role: role, local: local, bu: bu, applied: 0, until: 0, angle: 0, picker: null, pickWind: false,
      plan: '', pings: [], anim: null, sent: {}, cover: null, zoom: 1, vx: 0, vy: 0, ptrs: {}, crew: -1 };
    var el = g3El();
    el.hidden = false; g3RoleClass();
    el.querySelector('.g-cover').hidden = true;
    el.querySelector('.g3-opts').innerHTML = $('mute').innerHTML;
    document.body.classList.add('guideon');
    guideMusic(true);
    g3PicsLoad(); g3Paint(); g3Layout(); g3Hud();
    track('guide3_start', { size: opts.size, hard: !!opts.hard, role: role, local: !!local });
    if (!(progress.tutorials && progress.tutorials.guide3)) { progress.tutorials = progress.tutorials || {}; progress.tutorials.guide3 = 1; save('unwind.progress2', progress); g3Help('all'); }
    if (!g3.loop) g3Loop();
  }
  function g3RoleClass() { var el = g3El(); el.classList.toggle('g3-keeper', g3.role === 'keeper'); el.classList.toggle('g3-boat', g3.role === 'boat'); }
  function g3Paint() { g3.paint = { n: g3.G.n, grid: g3.G.grid.map(function (t) { return t === G3.ROCK ? Gd.ROCK : t === G3.TALL ? Gd.BIG : t === G3.WHIRL ? Gd.WHIRL : Gd.WATER; }) }; }
  function closeGuide3() {
    if (!g3) return;
    g3 = null; g3El().hidden = true;
    document.body.classList.remove('guideon');
    guideMusic(false);
  }
  // Leaving from the footer or the settings: always asked first.
  function g3Leave(then) {
    if (!g3) { if (then) then(); return; }
    var local = g3.local;
    var s = sheet('<h2>Leave this game?</h2><p>' + (local ? 'This sea will be lost.' : 'Your partner will be left alone at sea.') + '</p><button class="primary" id="g3Stay">Keep playing</button><button class="secondary" id="g3Go">Leave</button>', 'start');
    s.querySelector('#g3Stay').onclick = closeSheet;
    s.querySelector('#g3Go').onclick = function () { closeSheet(); closeGuide3(); if (!local) { netSend({ t: 'leave' }); netClose(); } if (then) then(); };
  }

  /* ---------- One device: both roles take turns with the phone (offline, from Boarding Up) ---------- */
  function openGuide3Local(opts, bu) {
    if ($('sheetHost').firstChild) closeSheet();
    g3Init(1 + Math.floor(Math.random() * 1e9), opts, 'boat', true, bu);
  }
  function g3Holder(phase) { return phase === 'light' || phase === 'write' ? 'keeper' : 'boat'; }
  // The step's clock only starts once the right player has the phone and says so.
  function g3Local(act) {
    var G = g3.G, before = G.phase;
    g3Apply(g3.role, act, 0);
    if (!g3 || G.phase === before || G.ended) return;
    var who = g3Holder(G.phase), ms = G3.PHASE_MS[G.phase] || 0;
    if (who !== g3.role) { g3.role = who; g3RoleClass(); g3Cover(ms); }
    else if (ms) g3.until = performance.now() + ms;
    g3Hud();
  }
  function g3Cover(ms) {
    var c = g3El().querySelector('.g-cover'), keeper = g3.role === 'keeper';
    g3.until = 0; g3.cover = true; g3.picker = null;
    c.querySelector('h2').textContent = keeper ? 'Pass the phone to the keeper' : 'Pass the phone to the captain';
    c.querySelector('p').textContent = keeper ? 'Captain, look away! The light is about to shine on the real sea.' : 'Keeper, hand over. The captain has 30 seconds to plan the route.';
    c.querySelector('.primary').textContent = keeper ? 'I am the keeper' : 'I am the captain';
    c.querySelector('.g-passicon').innerHTML = guideIconSvg(keeper ? 'keeper' : 'boat');
    c.hidden = false;
    c.querySelector('.primary').onclick = function () { if (!g3) return; c.hidden = true; g3.cover = null; if (ms) g3.until = performance.now() + ms; g3Hud(); };
    window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush();
  }

  /* ---------- Actions and the server's messages ---------- */
  function g3Apply(role, act, ms) {
    var G = g3.G, before = G.phase, lives = G.lives, got = G.got;
    var res = G3.apply(G, role, act);
    if (!res.ok) return;
    if (ms) g3.until = performance.now() + ms;
    if (G.phase !== before) {
      g3.sent = {}; g3.picker = null;
      // A new plan every turn: last turn's moves are never carried over.
      if (G.phase === 'boat' || G.phase === 'light') g3.plan = '';
    }
    if (act.a === 'ping') { g3.pings.push({ x: act.x, y: act.y, role: role, t0: performance.now() }); pluck(role === g3.role ? 880 : 1046.5, 0, 0.04, 0.5); }
    if (act.a === 'mark') pluck(587.33, 0, 0.03, 0.25);
    if (G.phase === 'light' && before !== 'light') { pluck(659.25, 0, 0.05, 1.2); pluck(987.77, 0.08, 0.04, 1.4); }
    if (G.last && before === 'boat' && G.phase !== 'boat') {
      g3.anim = { t0: performance.now(), path: G.last.path };
      var lines = [];
      G.last.events.forEach(function (e) {
        var where = e.x !== undefined ? G3.coord(e.x, e.y) : '';
        var text = e.e === 'rock' ? (e.tall ? 'Crash on a tall rock at ' : 'Crash on a rock at ') + where + '. A sailor is lost!' : e.e === 'whirl' ? 'A whirlpool at ' + where + ' spun the boat away!' : e.e === 'wind' ? 'A gust at ' + where + ' blew the boat on!' : e.e === 'treasure' ? 'Treasure found at ' + where + '!' : e.e === 'bite' ? 'A serpent struck at ' + where + '. A sailor is lost!' : e.e === 'edge' ? 'That is the edge of the map.' : e.e === 'home' ? 'Home! The boat reached the lighthouse.' : e.e === 'stun' ? 'A serpent swam into the trap at ' + where + ' and sank, stunned!' : '';
        if (text) lines.push([text, e.e === 'rock' || e.e === 'bite']);
      });
      lines.forEach(function (l, i) { setTimeout(function () { if (g3) g3Toast(l[0], l[1]); }, 400 + i * 1300); });
      if (G.lives < lives) { pluck(130.8, 0.3, 0.08, 0.6); pluck(110, 0.42, 0.08, 0.7); }
      if (G.got > got) { [783.99, 987.77, 1174.66].forEach(function (f, i) { pluck(f, 0.3 + i * 0.08, 0.05, 0.6); }); }
    }
    g3Hud();
    if (g3.helpQueued && !G3.PHASE_MS[G.phase]) { g3.helpQueued = false; setTimeout(function () { if (g3 && !G.ended) g3Help(g3.role); }, G.last ? 1800 : 0); }
    if (G.ended && !g3.endShown) { g3.endShown = true; setTimeout(g3End, 2200); }
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
  function g3Send(act) { if (g3.local) g3Local(act); else netSend({ t: 'gact', act: act }); }
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

  /* ---------- Around the chart: the header, the pills and the buttons ---------- */
  // The crew counter's sailor: a round badge, a sailor in a striped shirt and a peaked cap.
  var G3_SAILOR = G3ART.sailor;
  function g3Hud() {
    var G = g3.G, el = g3El(), me = g3.role;
    el.querySelector('.g3-where').textContent = 'Guiding Light 3.0 · ' + (me === 'keeper' ? 'Lighthouse keeper' : 'Boat captain') + (g3.local ? ' · one device' : '');
    var crew = el.querySelector('.g3-crew');
    if (!crew.querySelector('.g3-sailor').firstChild) crew.querySelector('.g3-sailor').innerHTML = G3_SAILOR;
    if (g3.crew !== G.lives) {
      if (g3.crew > G.lives) { crew.classList.remove('hit'); void crew.offsetWidth; crew.classList.add('hit'); }
      g3.crew = G.lives;
      crew.querySelector('b').textContent = Math.max(0, G.lives) + '/' + G.maxLives;
      crew.setAttribute('aria-label', 'Sailors: ' + Math.max(0, G.lives) + ' of ' + G.maxLives);
    }
    el.querySelector('.g3-turn b').textContent = String(Math.max(1, G.turn));
    el.querySelector('.g3-gold b').textContent = G.got + '/' + G.treasure.length;
    if (g3.shownPhase !== G.phase) {
      g3.shownPhase = G.phase;
      var ph = el.querySelector('.g3-phase');
      ph.querySelector('.g3-phicon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (G3_PHICON[G.phase] || '') + '</svg>';
      ph.querySelector('b').textContent = G3_PHASE[G.phase] || '';
      ph.className = 'g3-phase ' + G.phase;
    }
    var msg = '', btns = '';
    if (G.ended) msg = G.ended === 'won' ? 'Home! The boat reached the lighthouse.' : 'The boat is lost.';
    else if (G.phase === 'start' || G.phase === 'next') {
      if (me === 'boat') { msg = G.phase === 'start' ? 'When you are both ready, start the first turn.' : 'Talk it over, then start the next turn.'; btns = '<button class="primary" id="g3NextBtn">' + (G.phase === 'start' ? 'Start' : 'Next turn') + '</button>'; }
      else msg = G.phase === 'start' ? 'Waiting for the captain to start. Get ready to look hard!' : 'Waiting for the captain to start the next turn.';
    } else if (G.phase === 'light') {
      if (me === 'keeper') { msg = 'Drag to aim the light. Remember everything you see!'; btns = '<button class="primary" id="g3LightDone">Done</button>'; }
      else msg = 'The keeper is studying the sea…';
    }
    else if (G.phase === 'write') {
      if (me === 'keeper') { msg = 'Tap a square to draw what you saw.'; btns = '<button class="primary" id="g3Done">Done</button>'; }
      else msg = 'The keeper is drawing the chart. Tap a square to ping it.';
    } else if (G.phase === 'boat') {
      if (me === 'boat') {
        msg = g3.plan ? G3.planPath(G, g3.plan).map(function (p) { return G3.coord(p[0], p[1]); }).join(' → ') : 'Tap a square next to the boat. Up to ' + G.steps + ' moves.';
        btns = '<button id="g3Undo"' + (g3.plan ? '' : ' disabled') + '>Undo</button><button class="primary" id="g3Ready">Sail</button>';
      } else msg = 'The captain is planning the route. Tap a square to ping it.';
    }
    if (g3.cover) { msg = ''; btns = ''; }
    el.querySelector('.g-msg').textContent = msg;
    var bt = el.querySelector('.g-btns'); bt.innerHTML = btns;
    var q = function (id) { return bt.querySelector(id); };
    if (q('#g3NextBtn')) q('#g3NextBtn').onclick = function () { this.disabled = true; g3Send({ a: 'next' }); };
    if (q('#g3LightDone')) q('#g3LightDone').onclick = function () { this.disabled = true; g3.sent.light = 1; g3Send({ a: 'done' }); };
    if (q('#g3Done')) q('#g3Done').onclick = function () { this.disabled = true; g3.sent.write = 1; g3Send({ a: 'done' }); };
    if (q('#g3Ready')) q('#g3Ready').onclick = function () { this.disabled = true; g3.sent.boat = 1; g3Send({ a: 'route', steps: g3.plan }); g3Send({ a: 'ready' }); };
    if (q('#g3Undo')) q('#g3Undo').onclick = function () { g3SetPlan(g3.plan.slice(0, -1)); };
    if (!g3.picker) el.querySelector('.g3-picker').hidden = true;
  }
  function g3SetPlan(p) { g3.plan = p; g3Send({ a: 'route', steps: p }); pluck(523.25, 0, 0.03, 0.2); g3Hud(); }
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

  /* ---------- The camera: fits the chart, or zooms in on part of it ---------- */
  function g3Cam() {
    var n = g3.G.n, base = Math.min(g3w / (n + 1.1), g3h / (n + 1.1)), cs = base * g3.zoom, ox, oy;
    if (g3.zoom <= 1.001) { g3.zoom = 1; cs = base; ox = (g3w - n * cs) / 2 + cs * 0.3; oy = (g3h - n * cs) / 2 + cs * 0.3; g3.vx = (g3w / 2 - ox) / cs; g3.vy = (g3h / 2 - oy) / cs; }
    else {
      ox = g3w / 2 - g3.vx * cs; oy = g3h / 2 - g3.vy * cs;
      var fit = function (o, view) { var size = n * cs; if (size + cs * 1.1 <= view) return (view - size) / 2 + cs * 0.3; return Math.min(cs * 0.8, Math.max(view - size - cs * 0.15, o)); };
      ox = fit(ox, g3w); oy = fit(oy, g3h);
      g3.vx = (g3w / 2 - ox) / cs; g3.vy = (g3h / 2 - oy) / cs;
    }
    return { cs: cs, ox: ox, oy: oy, base: base };
  }
  function g3Zoom(f, px, py) {
    var cam = g3Cam(), tx = (px - cam.ox) / cam.cs, ty = (py - cam.oy) / cam.cs;
    var z = Math.max(1, Math.min(4, g3.zoom * f)), cs = cam.base * z;
    g3.zoom = z; g3.vx = tx - (px - g3w / 2) / cs; g3.vy = ty - (py - g3h / 2) / cs;
    if (g3.picker) g3PlacePicker();
  }

  /* ---------- Drawing ---------- */
  function g3Loop() {
    g3.loop = true;
    var tick = function (now) { if (!g3) { return; } g3Clock(now); g3Draw(now); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function g3Draw(now) {
    var c = g3ctx, G = g3.G, el = g3El();
    c.setTransform(g3dpr, 0, 0, g3dpr, 0, 0);
    var left = G3.PHASE_MS[G.phase] && g3.until ? Math.max(0, g3.until - now) : 0;
    var timed = G3.PHASE_MS[G.phase] && (g3.until || g3.paused), secs = timed ? (g3.paused ? '❚❚' : Math.ceil(left / 1000) + 's') : '', ph = el.querySelector('.g3-phase');
    if (ph.dataset.secs !== secs) { ph.dataset.secs = secs; ph.querySelector('span').textContent = secs; ph.classList.toggle('timed', !!secs); ph.classList.toggle('low', !!secs && !g3.paused && left < 5000); }
    ph.querySelector('.g3-bar i').style.transform = 'scaleX(' + (timed ? (g3.paused ? 1 : left / G3.PHASE_MS[G.phase]) : 0) + ')';
    var cam = g3Cam(), view;
    if (G.ended) view = 'sea';
    else if (g3.role === 'boat') view = 'radar';
    else view = G.phase === 'light' && !g3.cover ? 'light' : 'paper';
    if (view === 'radar') g3DrawRadar(c, cam, now);
    else if (view === 'paper') g3DrawPaper(c, cam, now);
    else g3DrawSea(c, cam, now, view === 'light');
    // Pings, on every view.
    var X = function (x) { return cam.ox + x * cam.cs; }, Y = function (y) { return cam.oy + y * cam.cs; }, cs = cam.cs;
    g3.pings = g3.pings.filter(function (p) { return now - p.t0 < 2600; });
    g3.pings.forEach(function (p) {
      var u = Math.max(0, now - p.t0) / 2600, px2 = X(p.x) + cs / 2, py2 = Y(p.y) + cs / 2, col = view === 'paper' ? '163,41,28' : p.role === 'keeper' ? '255,214,120' : '125,255,154';
      for (var q = 0; q < 2; q++) { var v = (u * 2 + q * 0.5) % 1; c.strokeStyle = 'rgba(' + col + ',' + (1 - v) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(px2, py2, cs * (0.3 + v * 0.9), 0, 7); c.stroke(); }
    });
    if (g3.picker) { c.strokeStyle = view === 'paper' ? '#a3291c' : '#ffe9a8'; c.lineWidth = 2.5; c.strokeRect(X(g3.picker[0]) + 1, Y(g3.picker[1]) + 1, cs - 2, cs - 2); }
  }
  // Coordinates along the top and the left. When zoomed in they stay pinned to the edges of the screen.
  function g3Labels(c, cam, ink, band, serif) {
    var G = g3.G, cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; };
    var ty = Math.max(Y(0) - cs * 0.38, Math.min(cs * 0.36, 14)), lx = Math.max(X(0) - cs * 0.42, Math.min(cs * 0.42, 14));
    var fs = Math.max(9, Math.min(18, Math.round(cs * 0.36)));
    if (ty > Y(0) - cs * 0.38 + 0.5) { c.fillStyle = band; c.fillRect(0, 0, g3w, ty + fs * 0.75); }
    if (lx > X(0) - cs * 0.42 + 0.5) { c.fillStyle = band; c.fillRect(0, 0, lx + fs * 1.1, g3h); }
    c.fillStyle = ink; c.font = serif ? 'italic 600 ' + fs + 'px Georgia, \'Times New Roman\', serif' : '600 ' + fs + 'px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var i = 0; i < G.n; i++) {
      if (X(i) + cs > 0 && X(i) < g3w) c.fillText(String.fromCharCode(65 + i), X(i) + cs / 2, ty);
      if (Y(i) + cs > 0 && Y(i) < g3h) c.fillText(String(i + 1), lx, Y(i) + cs / 2);
    }
  }
  function g3Lighthouse(c, cam, glowA) {
    var G = g3.G, cs = cam.cs, lx = cam.ox + (G.c + 0.5) * cs, ly = cam.oy + G.c * cs, img = lighthouseImage(), lk = cs * 1.15 / 85;
    if (img.complete && img.naturalWidth) c.drawImage(img, lx - 20 * lk, ly + cs * 0.85 - 110 * lk, 40 * lk, 126 * lk);
    if (glowA) {
      var gy = ly + cs * 0.5 - cs * 0.62, glow = c.createRadialGradient(lx, gy, 0, lx, gy, cs * 0.6);
      glow.addColorStop(0, 'rgba(255,233,168,' + glowA + ')'); glow.addColorStop(1, 'rgba(255,233,168,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(lx, gy, cs * 0.6, 0, 7); c.fill();
    }
  }
  // The real sea: in the keeper's beam, or all of it once the game is over.
  function g3DrawSea(c, cam, now, lighting) {
    var G = g3.G, cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; };
    c.fillStyle = '#060a1c'; c.fillRect(0, 0, g3w, g3h);
    var lit = {};
    if (lighting) G3.litCells(G, g3.angle).forEach(function (k) { lit[k] = 1; });
    else for (var k0 = 0; k0 < G.n * G.n; k0++) lit[k0] = 1;
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var k = y * G.n + x;
      c.fillStyle = lighting ? (lit[k] ? '#2b3c74' : ((x + y) % 2 ? '#0e1735' : '#101a3b')) : '#1f2d5e';
      c.fillRect(X(x), Y(y), cs + 0.5, cs + 0.5);
    }
    c.strokeStyle = 'rgba(160,180,255,.1)'; c.lineWidth = 1;
    for (var gl = 1; gl < G.n; gl++) { c.beginPath(); c.moveTo(X(gl), Y(0)); c.lineTo(X(gl), Y(G.n)); c.moveTo(X(0), Y(gl)); c.lineTo(X(G.n), Y(gl)); c.stroke(); }
    c.strokeStyle = 'rgba(255,214,140,.35)'; c.lineWidth = 2; c.strokeRect(X(0), Y(0), G.n * cs, G.n * cs);
    if (lighting) { c.save(); c.beginPath(); c.rect(X(0), Y(0), G.n * cs, G.n * cs); c.clip(); g3Beam(c, X(G.c) + cs / 2, Y(G.c) + cs / 2, g3.angle, cs * G.n * 1.5); c.restore(); }
    for (var yy = 0; yy < G.n; yy++) for (var xx = 0; xx < G.n; xx++) {
      var kk = yy * G.n + xx, t = G.grid[kk];
      if (!lit[kk]) continue;
      if (t === G3.ROCK || t === G3.TALL) g3Rock(c, xx, yy, X(xx), Y(yy), cs, t === G3.TALL);
      else if (t === G3.WHIRL) guideTerrain(c, g3.paint, xx, yy, X(xx), Y(yy), cs, now, 1);
      var w = G3.windAt(G, xx, yy);
      if (w) g3Wind(c, X(xx) + cs / 2, Y(yy) + cs / 2, cs, w.dir, now, 1);
    }
    G.treasure.forEach(function (t) { if (t.got || !lit[t.y * G.n + t.x] || (lighting && t.deep)) return; g3Chest(c, X(t.x) + cs / 2, Y(t.y) + cs / 2, cs, now, t.deep); });
    g3Traps(c, cam, now, 'sea');
    G.serpents.forEach(function (s) {
      if (!lit[s.y * G.n + s.x]) return; if (s.stun) guideBubbles(c, X(s.x) + cs / 2, Y(s.y) + cs / 2, cs, now, s.id); else guideSerpent(c, X(s.x) + cs / 2, Y(s.y) + cs / 2, cs, now, s.id, 1); });
    g3Lighthouse(c, cam, lighting ? 0.9 : 0.45);
    var bp = g3BoatPos(now);
    if (lit[Math.round(bp.y) * G.n + Math.round(bp.x)]) g3Boat(c, X(bp.x) + cs / 2, Y(bp.y) + cs / 2, cs, now);
    g3Labels(c, cam, 'rgba(238,240,255,.7)', '#060a1c');
  }
  // The real sea's rocks: one of several pictures per square, always the same one for the same square.
  var G3_LOW = ['boulders', 'mossy', 'gull', 'barnacle', 'seaweed'], G3_TALL = ['stack', 'arch', 'nest', 'twin'];
  function g3Rock(c, x, y, px, py, cs, tall) {
    var h = ((x * 73856093) ^ (y * 19349663) ^ (g3.seed | 0)) >>> 0, list = tall ? G3_TALL : G3_LOW;
    g3Put(c, g3Pic('sea', list[h % list.length]), px + cs / 2, py + cs * 0.42, cs * 1.3);
  }
  // The boat: a little sailboat, the captain at the stern and a lantern on its post.
  function g3Boat(c, cx, cy, cs, now) {
    var im = g3Pic('', 'boat'); if (!im.complete || !im.naturalWidth) return;
    var w = cs * 1.3, h = w * 84 / 128, bob = reducedMotion() ? 0 : Math.sin(now / 650) * cs * 0.025;
    c.drawImage(im, cx - w / 2, cy + cs * 0.3 - h * 76 / 84 + bob, w, h);
  }
  // The keeper's chart, like the old map: torn, worn parchment filling the screen, the squares in a checkered border,
  // rhumb lines from the compass roses, a title ribbon, a key to the symbols, and ships and monsters in the margins.
  // The margin art is laid out in squares around the chart, from the room there is when the chart is not zoomed,
  // so it zooms and pans with the squares.
  function g3Sheet() {
    var n = g3.G.n, base = Math.min(g3w / (n + 1.1), g3h / (n + 1.1)), ox = (g3w - n * base) / 2 + base * 0.3, oy = (g3h - n * base) / 2 + base * 0.3;
    var L = ox / base, T = oy / base, R = g3w / base - L - n, B = g3h / base - T - n, key = [n, L.toFixed(2), T.toFixed(2), R.toFixed(2), B.toFixed(2)].join();
    if (g3.sheet && g3.sheet.key === key) return g3.sheet;
    // The sheet reaches the screen's edges, and always past the squares, their letters and the border (it may run off screen there).
    // On a wide screen the paper keeps narrow margins beside the squares (the table shows beyond), so the squares get the room.
    var wide = L + R > 6, Lm = wide ? Math.min(L - 0.14, 4.4) : L - 0.14, Rm = wide ? Math.min(R - 0.14, 4.4) : R - 0.14;
    var x0 = Math.min(-Lm, -0.8), y0 = Math.min(-T + 0.14, -0.8), x1 = Math.max(n + Rm, n + 0.36), y1 = Math.max(n + B - 0.14, n + 0.36), rnd = guideRand((g3.seed % 99991) + 7), pts = [];
    var ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    var side = function (ax, ay, bx, by, nx, ny) {
      var len = Math.hypot(bx - ax, by - ay), k = Math.max(10, Math.round(len * 7)), tear = 0, depth = 0;
      for (var i = 0; i < k; i++) {
        var t = i / k, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, u = (x + y) * 7;
        var d = 0.07 + 0.045 * Math.sin(u / 5.3 + ph[0]) + 0.03 * Math.sin(u / 1.9 + ph[1]) + rnd() * 0.035;
        if (tear > 0) { d += depth * (tear % 2 ? 1 : 0.65); tear--; } else if (rnd() < 0.035) { tear = 3; depth = 0.12 + rnd() * 0.18; }
        [[x1, y1, 0.9], [x0, y0, 0.55]].forEach(function (cn) { var dd = Math.hypot(x - cn[0], y - cn[1]); if (dd < cn[2]) d += (cn[2] - dd) * 0.85; });
        pts.push([x + nx * d, y + ny * d]);
      }
    };
    side(x0, y0, x1, y0, 0, 1); side(x1, y0, x1, y1, -1, 0); side(x1, y1, x0, y1, 0, -1); side(x0, y1, x0, y0, 1, 0);
    // Where the margin art goes: beside the chart on a wide screen, above and below it on a tall one.
    var d = { ship: null, serpent: null, anchor: null, ribbon: null, rose: null, small: null, key: null, mare: null, waves: [] };
    if (wide) {
      var lw = Lm - 0.95, lx = -Lm / 2 - 0.3, rw = Rm - 0.5, rx = n + Rm / 2 + 0.05;
      d.ribbon = { x: lx, y: 0.55, w: lw + 0.3, tall: true };
      d.small = { x: lx, y: 1.75, r: Math.min(0.62, lw * 0.16) };
      d.ship = { x: lx + 0.2, y: n * 0.45, w: Math.min(lw, 3.5) };
      d.anchor = { x: lx - lw * 0.33, y: n * 0.72, w: Math.min(1.05, lw * 0.26) };
      d.mare = { x: lx + lw * 0.14, y: n * 0.72, s: Math.min(0.42, lw * 0.105) };
      d.serpent = { x: lx, y: n - 0.95, w: Math.min(lw, 3.3) };
      d.key = { x: rx, y: 0.15, cols: 1, compact: true };
      d.rose = { x: rx, y: n - Math.min(1.35, rw * 0.33), r: Math.min(1.15, rw * 0.28) };
      d.waves = [[lx + lw * 0.3, n * 0.26], [lx - lw * 0.3, n * 0.86], [rx - rw * 0.3, n * 0.6], [rx + rw * 0.32, n * 0.52]];
    } else {
      if (T >= 1.9) {
        var ry = -(T + 0.9) / 2;
        d.ribbon = { x: n / 2, y: ry, w: Math.min(n * 0.56, 8) };
        d.small = { x: Math.max(0.2, (n / 2 - d.ribbon.w / 2) / 2 - 0.1), y: ry, r: Math.min(0.75, (T - 1) * 0.5) };
        d.rose = { x: n - Math.max(0.6, (n / 2 - d.ribbon.w / 2) / 2), y: ry, r: Math.min(0.8, (T - 1) * 0.52), noFleur: true };
      }
      if (B >= 1.8) d.key = { x: 0, y: n + 0.42, w: n, cols: 4, h: Math.min(B - 0.6, 1.95) };
      if (B >= 4.2) { d.serpent = { x: n * 0.3, y: n + 3.4, w: Math.min(4, n * 0.36) }; d.anchor = { x: n * 0.78, y: n + 3.3, w: 1.1 }; d.waves = [[n * 0.55, n + 3.3], [n * 0.08, n + 3.5]]; }
    }
    var hl = [[x1 - 0.7, y0 + 0.5, 0.12], [x0 + 0.6, y1 - 0.45, 0.09]];
    g3.sheet = { key: key, pts: pts, x0: x0, y0: y0, x1: x1, y1: y1, deco: d, holes: hl };
    return g3.sheet;
  }
  function g3DrawPaper(c, cam, now) {
    var G = g3.G, cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; }, n = G.n, P = G3_PAPER;
    var sh = g3Sheet(), d = sh.deco, tr = window.UnwindI18n ? window.UnwindI18n.t : function (t) { return t; };
    c.fillStyle = P.table; c.fillRect(0, 0, g3w, g3h);
    var sheet = function () { c.beginPath(); sh.pts.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1])); }); c.closePath(); };
    c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = cs * 0.25; c.shadowOffsetY = cs * 0.12; sheet(); c.fillStyle = P.bg; c.fill(); c.restore();
    var W = (sh.x1 - sh.x0) * cs, H = (sh.y1 - sh.y0) * cs, SX = X(sh.x0), SY = Y(sh.y0);
    c.save(); sheet(); c.clip();
    var pg = c.createLinearGradient(SX, SY, SX + W, SY + H); pg.addColorStop(0, '#e2b877'); pg.addColorStop(0.5, '#d9ab68'); pg.addColorStop(1, '#cc9a58');
    c.fillStyle = pg; c.fillRect(SX - cs, SY - cs, W + cs * 2, H + cs * 2);
    var rs = guideRand(g3.seed % 100000);
    for (var st = 0; st < 6; st++) { var sx = SX + rs() * W, sy = SY + rs() * H, sr = cs * (1 + rs() * 2.2), sg = c.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, 'rgba(138,90,34,.16)'); sg.addColorStop(0.82, 'rgba(138,90,34,.09)'); sg.addColorStop(0.94, 'rgba(107,67,22,.2)'); sg.addColorStop(1, 'rgba(107,67,22,0)'); c.fillStyle = sg; c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
    // Fold creases.
    var fold = function (x, y, w, h, vert) { var g = vert ? c.createLinearGradient(x, 0, x + w, 0) : c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(74,44,12,0)'); g.addColorStop(0.47, 'rgba(74,44,12,.15)'); g.addColorStop(0.53, 'rgba(255,242,204,.17)'); g.addColorStop(1, 'rgba(255,242,204,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); };
    fold(SX + W / 2 - cs * 0.4, SY, cs * 0.8, H, true); fold(SX, SY + H / 2 - cs * 0.35, W, cs * 0.7, false);
    // Rhumb lines fanning out from the roses.
    var rose = d.rose || { x: 1.25, y: n - 1.25, r: 1.15, faint: true };
    var fan = function (x, y, k, a) { c.strokeStyle = 'rgba(61,35,20,' + a + ')'; c.lineWidth = 0.8; c.beginPath(); for (var rl = 0; rl < k; rl++) { var ra = rl * Math.PI * 2 / k; c.moveTo(X(x), Y(y)); c.lineTo(X(x) + Math.cos(ra) * cs * 60, Y(y) + Math.sin(ra) * cs * 60); } c.stroke(); };
    fan(rose.x, rose.y, 32, 0.24); if (d.small) fan(d.small.x, d.small.y, 16, 0.17);
    // Wave strokes, the ships and monsters.
    var put = function (key, x, y, w, ratio) { var im = g3Pic('map', key); if (im.complete && im.naturalWidth) c.drawImage(im, X(x) - w * cs / 2, Y(y) - w * cs * ratio / 2, w * cs, w * cs * ratio); };
    d.waves.forEach(function (wv) { put('waves', wv[0], wv[1], 0.75, 66 / 84); });
    if (d.ship) put('ship', d.ship.x, d.ship.y, d.ship.w, 280 / 320);
    if (d.serpent) put('serpent', d.serpent.x, d.serpent.y, d.serpent.w, 120 / 288);
    if (d.anchor) put('anchor', d.anchor.x, d.anchor.y, d.anchor.w, 124 / 120);
    if (d.mare) { c.save(); c.translate(X(d.mare.x), Y(d.mare.y)); c.rotate(-0.1); c.fillStyle = P.ink; c.font = 'italic ' + Math.round(cs * (d.mare.s || 0.5)) + 'px Georgia, \'Times New Roman\', serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Mare Ignotum', 0, 0); c.restore(); }
    // The squares sit on slightly lighter paper.
    c.fillStyle = 'rgba(220,176,114,.86)'; c.fillRect(X(0) - cs * 0.16, Y(0) - cs * 0.16, n * cs + cs * 0.32, n * cs + cs * 0.32);
    // Holes, a darker worn rim and age at the edges.
    sh.holes.forEach(function (h) { c.fillStyle = 'rgba(90,52,16,.45)'; c.beginPath(); c.arc(X(h[0]), Y(h[1]), h[2] * cs * 1.7, 0, 7); c.fill(); c.fillStyle = P.table; c.beginPath(); c.arc(X(h[0]), Y(h[1]), h[2] * cs, 0, 7); c.fill(); });
    c.strokeStyle = 'rgba(74,40,8,.28)'; c.lineWidth = cs * 0.7; sheet(); c.stroke();
    c.strokeStyle = 'rgba(58,30,6,.35)'; c.lineWidth = cs * 0.22; sheet(); c.stroke();
    c.restore();
    c.strokeStyle = '#1d0f06'; c.lineWidth = 2.2; sheet(); c.stroke();
    c.save(); c.translate(-1, -1); c.strokeStyle = 'rgba(122,74,26,.7)'; c.lineWidth = 1; sheet(); c.stroke(); c.restore();
    // The compass roses.
    if (rose.faint) g3Put(c, g3Pic('', 'rose'), X(rose.x), Y(rose.y) - cs * 0.06, cs * rose.r * 2, 0, 0.3);
    else g3Put(c, g3Pic(rose.noFleur ? 'map' : '', rose.noFleur ? 'roseSmall' : 'rose'), X(rose.x), Y(rose.y) - (rose.noFleur ? 0 : cs * rose.r * 0.06), cs * rose.r * (rose.noFleur ? 2.25 : 2.5));
    if (d.small) g3Put(c, g3Pic('map', 'roseSmall'), X(d.small.x), Y(d.small.y), cs * d.small.r * 2.25);
    // The title ribbon.
    if (d.ribbon) {
      var rb = g3Pic('map', d.ribbon.tall ? 'ribbonTall' : 'ribbon'), rw = d.ribbon.w * cs, rh = rw * (d.ribbon.tall ? 132 : 96) / 780;
      if (rb.complete && rb.naturalWidth) c.drawImage(rb, X(d.ribbon.x) - rw / 2, Y(d.ribbon.y) - rh / 2, rw, rh);
      var title = tr('The keeper\'s chart'), fs = Math.min(rh * (d.ribbon.tall ? 0.48 : 0.56), rw * 0.72 / Math.max(8, title.length) * 1.9);
      c.fillStyle = P.ink; c.font = '600 ' + Math.round(fs) + 'px Georgia, \'Times New Roman\', serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(title, X(d.ribbon.x), Y(d.ribbon.y) + rh * 0.04);
    }
    // The key to the symbols.
    if (d.key) {
      var k = d.key, rows = [['light', 'Lighthouse'], ['rock', 'Rock'], ['tall', 'Tall rock'], ['whirl', 'Whirlpool'], ['wind', 'Gust'], ['treasure', 'Treasure'], ['serpent', 'Serpent'], ['trap', 'Trap']];
      if (k.compact) {
        // Snug: one column, as wide as its longest word.
        var fsz = Math.round(cs * 0.36), hsz = Math.round(cs * 0.4), ic = cs * 0.56, pad = cs * 0.24, rh = cs * 0.58, longest = 0;
        c.font = 'italic ' + fsz + 'px Georgia, \'Times New Roman\', serif'; rows.forEach(function (r) { longest = Math.max(longest, c.measureText(tr(r[1])).width); });
        c.font = '600 ' + hsz + 'px Georgia, \'Times New Roman\', serif'; var hw = c.measureText(tr('Key to the chart')).width;
        var kw2 = Math.max(hw + pad * 2, pad * 2 + ic * 1.3 + longest), kh2 = pad * 1.2 + hsz * 1.5 + rows.length * rh, kx2 = X(k.x) - kw2 / 2, ky2 = Y(k.y);
        c.fillStyle = 'rgba(230,196,138,.95)'; c.fillRect(kx2, ky2, kw2, kh2); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(kx2, ky2, kw2, kh2); c.lineWidth = 0.8; c.strokeRect(kx2 + 4, ky2 + 4, kw2 - 8, kh2 - 8);
        c.fillStyle = P.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tr('Key to the chart'), kx2 + kw2 / 2, ky2 + pad * 0.6 + hsz * 0.75);
        c.font = 'italic ' + fsz + 'px Georgia, \'Times New Roman\', serif'; c.textAlign = 'left';
        rows.forEach(function (r, i) { var cy = ky2 + pad * 0.6 + hsz * 1.5 + (i + 0.5) * rh; g3Put(c, g3Pic('chart', r[0]), kx2 + pad + ic / 2, cy, ic * 1.05); c.fillStyle = P.ink; c.fillText(tr(r[1]), kx2 + pad + ic * 1.3, cy + 1); });
      } else {
      var kx = X(k.x), ky = Y(k.y), kw = k.w * cs, kh = k.h * cs;
      c.fillStyle = 'rgba(230,196,138,.95)'; c.fillRect(kx, ky, kw, kh); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(kx, ky, kw, kh); c.lineWidth = 0.8; c.strokeRect(kx + 4, ky + 4, kw - 8, kh - 8);
      var head = Math.min(0.62 * cs, kh * 0.26), per = Math.ceil(rows.length / k.cols), rowH = (kh - head - 8) / per, colW = (kw - 8) / k.cols;
      c.fillStyle = P.ink; c.font = '600 ' + Math.round(head * 0.62) + 'px Georgia, \'Times New Roman\', serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(tr('Key to the chart'), kx + kw / 2, ky + 4 + head * 0.55);
      rows.forEach(function (rw2, i) {
        var col = Math.floor(i / per), row = i % per, cx = kx + 4 + col * colW, cy = ky + 4 + head + row * rowH + rowH / 2, isz = Math.min(rowH * 0.95, cs * 0.95);
        g3Put(c, g3Pic('chart', rw2[0]), cx + isz * 0.62, cy, isz);
        c.fillStyle = P.ink; c.textAlign = 'left'; c.font = 'italic ' + Math.round(Math.min(rowH * 0.46, cs * 0.4)) + 'px Georgia, \'Times New Roman\', serif';
        c.fillText(tr(rw2[1]), cx + isz * 1.25, cy + 1, colW - isz * 1.35);
      });
      }
    }
    c.strokeStyle = P.line; c.lineWidth = 1;
    for (var gl = 1; gl < n; gl++) { c.beginPath(); c.moveTo(X(gl), Y(0)); c.lineTo(X(gl), Y(n)); c.moveTo(X(0), Y(gl)); c.lineTo(X(n), Y(gl)); c.stroke(); }
    // A checkered border, like the scale bars round an old chart.
    var o = Math.max(4, cs * 0.16), half = cs / 2;
    c.fillStyle = P.ink;
    for (var b = 0; b < n * 2; b += 2) {
      c.fillRect(X(0) + b * half, Y(0) - o, half, o); c.fillRect(X(0) + b * half, Y(n), half, o);
      c.fillRect(X(0) - o, Y(0) + b * half, o, half); c.fillRect(X(n), Y(0) + b * half, o, half);
    }
    c.strokeStyle = P.ink; c.lineWidth = 1.4; c.strokeRect(X(0), Y(0), n * cs, n * cs); c.strokeRect(X(0) - o, Y(0) - o, n * cs + o * 2, n * cs + o * 2);
    g3Marks(c, cam, now);
    g3Traps(c, cam, now, 'paper');
    g3Crashes(c, cam);
    g3Put(c, g3Pic('chart', 'light'), X(G.c) + cs / 2, Y(G.c) + cs / 2, cs * 48 / 44);
    g3Labels(c, cam, P.ink, '#d9ab68', true);
  }
  // The captain's radar screen: crisp squares, the keeper's drawings in green, the lighthouse, traps, and a round reach
  // around the boat with a sweep.
  function g3DrawRadar(c, cam, now) {
    var G = g3.G, cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; }, n = G.n;
    c.fillStyle = G3_RADAR.bg; c.fillRect(0, 0, g3w, g3h);
    c.fillStyle = G3_RADAR.sea; c.fillRect(X(0), Y(0), n * cs, n * cs);
    c.strokeStyle = 'rgba(90,255,158,.3)'; c.lineWidth = 1;
    for (var gl = 1; gl < n; gl++) { var gx = Math.round(X(gl)) + 0.5, gy = Math.round(Y(gl)) + 0.5; c.beginPath(); c.moveTo(gx, Y(0)); c.lineTo(gx, Y(n)); c.moveTo(X(0), gy); c.lineTo(X(n), gy); c.stroke(); }
    c.strokeStyle = G3_RADAR.glow + '.55)'; c.lineWidth = 1.5; c.strokeRect(X(0), Y(0), n * cs, n * cs);
    var bp = g3BoatPos(now), bx = X(bp.x) + cs / 2, by = Y(bp.y) + cs / 2;
    g3Marks(c, cam, now, 'radarMarks');
    g3Traps(c, cam, now, 'radar');
    g3Crashes(c, cam);
    g3Put(c, g3Pic('radar', 'light'), X(G.c) + cs / 2, Y(G.c) + cs / 2, cs * 48 / 40);
    if (!G.ended) {
      var R = G3.RADAR, rr = R * 1.05 * cs, sweep = (now / 2400) % 1 * Math.PI * 2;
      c.save(); c.beginPath(); c.rect(X(0), Y(0), n * cs, n * cs); c.clip();
      c.save(); c.beginPath(); c.arc(bx, by, rr, 0, 7); c.clip();
      var rg = c.createRadialGradient(bx, by, 0, bx, by, rr); rg.addColorStop(0, G3_RADAR.glow + '.14)'); rg.addColorStop(1, G3_RADAR.glow + '.05)');
      c.fillStyle = rg; c.fillRect(bx - rr, by - rr, rr * 2, rr * 2);
      if (c.createConicGradient) { var sg = c.createConicGradient(sweep - 0.9, bx, by); sg.addColorStop(0, G3_RADAR.glow + '0)'); sg.addColorStop(0.14, G3_RADAR.glow + '.36)'); sg.addColorStop(0.145, G3_RADAR.glow + '0)'); c.fillStyle = sg; c.fillRect(bx - rr, by - rr, rr * 2, rr * 2); }
      c.strokeStyle = '#b8ffd2'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(sweep + 0.03) * rr, by + Math.sin(sweep + 0.03) * rr); c.stroke();
      c.restore();
      c.strokeStyle = G3_RADAR.glow + '.28)'; c.lineWidth = 1; for (var q = 1; q < Math.floor(R); q++) { c.beginPath(); c.arc(bx, by, (q + 0.5) * cs, 0, 7); c.stroke(); }
      c.strokeStyle = 'rgba(125,255,176,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, rr, 0, 7); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx, by - rr); c.lineTo(bx, by - rr - 7); c.moveTo(bx, by + rr); c.lineTo(bx, by + rr + 7); c.moveTo(bx - rr, by); c.lineTo(bx - rr - 7, by); c.moveTo(bx + rr, by); c.lineTo(bx + rr + 7, by); c.stroke();
      c.restore();
      if (!g3.anim) G3.radar(G).forEach(function (b) {
        var cx = X(b.x) + cs / 2, cy = Y(b.y) + cs / 2;
        if (b.stun) { g3Put(c, g3Pic('radar', 'stun'), cx, cy, cs * 48 / 40, 0, 0.9); return; }
        var a = Math.atan2(cy - by, cx - bx), since = ((sweep - a) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2), glow = Math.max(0.45, 1 - since / (Math.PI * 2));
        g3Put(c, g3Pic('radar', b.kind === 'treasure' ? 'treasure' : 'serpent'), cx, cy, cs * 48 / 40, 0, glow);
      });
      // The route being planned, and the squares that can come next.
      if (G.phase === 'boat') {
        var pp = G3.planPath(G, g3.plan), end = pp[pp.length - 1];
        if (g3.plan.length < G.steps) [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) { var ax = end[0] + d[0], ay = end[1] + d[1]; if (G3.inside(G, ax, ay)) { c.fillStyle = G3_RADAR.glow + (0.1 + 0.06 * Math.sin(now / 300)) + ')'; c.fillRect(X(ax) + 2, Y(ay) + 2, cs - 4, cs - 4); c.strokeStyle = G3_RADAR.glow + '.45)'; c.lineWidth = 1; c.strokeRect(X(ax) + 2.5, Y(ay) + 2.5, cs - 5, cs - 5); } });
        if (pp.length > 1) {
          c.strokeStyle = '#b8ffd2'; c.lineWidth = Math.max(2, cs * 0.07); c.setLineDash([cs * 0.14, cs * 0.11]); c.lineJoin = 'round';
          c.beginPath(); pp.forEach(function (p, j) { c[j ? 'lineTo' : 'moveTo'](X(p[0]) + cs / 2, Y(p[1]) + cs / 2); }); c.stroke(); c.setLineDash([]);
          pp.slice(1).forEach(function (p, j) { c.fillStyle = 'rgba(90,255,158,.14)'; c.fillRect(X(p[0]) + 1, Y(p[1]) + 1, cs - 2, cs - 2); c.strokeStyle = '#b8ffd2'; c.lineWidth = 1.5; c.strokeRect(X(p[0]) + 1, Y(p[1]) + 1, cs - 2, cs - 2); c.fillStyle = '#d6ffe6'; c.beginPath(); c.arc(X(p[0]) + cs / 2, Y(p[1]) + cs / 2, cs * 0.19, 0, 7); c.fill(); c.fillStyle = '#03170c'; c.font = '700 ' + Math.round(cs * 0.26) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(j + 1), X(p[0]) + cs / 2, Y(p[1]) + cs / 2 + 0.5); });
        }
      }
    }
    // The boat, with brackets round its square.
    var k = cs * 0.18, x0 = X(bp.x) + 1, y0 = Y(bp.y) + 1, x1 = x0 + cs - 2, y1 = y0 + cs - 2;
    c.strokeStyle = '#b8ffd2'; c.lineWidth = 2; c.beginPath();
    c.moveTo(x0, y0 + k); c.lineTo(x0, y0); c.lineTo(x0 + k, y0); c.moveTo(x1 - k, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + k);
    c.moveTo(x0, y1 - k); c.lineTo(x0, y1); c.lineTo(x0 + k, y1); c.moveTo(x1 - k, y1); c.lineTo(x1, y1); c.lineTo(x1, y1 - k); c.stroke();
    g3Put(c, g3Pic('radar', 'boat'), bx, by, cs * 48 / 40);
    if (!G.ended) {
      var lab = G3.coord(G.boat.x, G.boat.y);
      c.font = '700 ' + Math.max(11, Math.round(cs * 0.34)) + 'px Fredoka, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var tw = c.measureText(lab).width + 12, ly = Y(bp.y) + cs * 1.08;
      if (ly + cs * 0.3 > Y(n)) ly = Y(bp.y) - cs * 0.32;
      c.fillStyle = 'rgba(2,20,10,.9)'; c.fillRect(bx - tw / 2, ly - cs * 0.22, tw, cs * 0.44);
      c.strokeStyle = G3_RADAR.glow + '.6)'; c.lineWidth = 1; c.strokeRect(bx - tw / 2, ly - cs * 0.22, tw, cs * 0.44);
      c.fillStyle = G3_RADAR.ink; c.fillText(lab, bx, ly);
    }
    g3Labels(c, cam, G3_RADAR.ink, G3_RADAR.bg);
    // Scan lines and a darker rim, like an old screen.
    c.fillStyle = 'rgba(0,0,0,.16)'; for (var sl = 0; sl < g3h; sl += 3) c.fillRect(0, sl, g3w, 1);
    var vg = c.createRadialGradient(g3w / 2, g3h / 2, Math.min(g3w, g3h) * 0.4, g3w / 2, g3h / 2, Math.max(g3w, g3h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = vg; c.fillRect(0, 0, g3w, g3h);
  }
  // The keeper's drawings, in brown ink. Gusts point the way they blow.
  function g3Sprite(c, icon, cx, cy, cs, group) {
    var wind = icon.indexOf('wind-') === 0, key = wind ? 'wind' : icon;
    if (!G3ART.chart[key]) return;
    g3Put(c, g3Pic(group || 'chart', key), cx, cy, cs * 48 / 44, wind ? G3_ROT[icon.charAt(5)] : 0);
  }
  function g3Marks(c, cam, now, group) {
    var G = g3.G, cs = cam.cs;
    Object.keys(G.marks).forEach(function (kk) {
      var mx = +kk % G.n, my = Math.floor(+kk / G.n), px = cam.ox + mx * cs, py = cam.oy + my * cs;
      if (px > g3w || py > g3h || px + cs < 0 || py + cs < 0) return;
      g3Sprite(c, G.marks[kk], px + cs / 2, py + cs / 2, cs, group);
    });
  }
  // Where the boat crashed last turn, for both players: a red burst (a red X is treasure on the chart).
  function g3Crashes(c, cam) {
    var G = g3.G, cs = cam.cs;
    if (!G.last || !G.last.events) return;
    G.last.events.forEach(function (e) {
      if (e.e !== 'rock') return;
      var bx = cam.ox + (e.x + 0.5) * cs, by = cam.oy + (e.y + 0.5) * cs;
      c.save(); c.translate(bx, by); c.beginPath();
      for (var k = 0; k < 16; k++) { var r = (k % 2 ? 0.17 : 0.4) * cs, a = k * Math.PI / 8; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fillStyle = 'rgba(255,90,90,.22)'; c.fill(); c.strokeStyle = '#e8463c'; c.lineWidth = Math.max(1.5, cs * 0.05); c.lineJoin = 'round'; c.stroke(); c.restore();
    });
  }
  // Traps the keeper threw: the trap itself, and the squares around it where serpents get caught.
  function g3Traps(c, cam, now, style) {
    var G = g3.G, cs = cam.cs;
    G.traps.forEach(function (t) {
      var x0 = cam.ox + (t.x - 1) * cs, y0 = cam.oy + (t.y - 1) * cs, cx = cam.ox + (t.x + 0.5) * cs, cy = cam.oy + (t.y + 0.5) * cs;
      var col = style === 'paper' ? '163,41,28' : style === 'radar' ? '120,255,180' : '255,200,110';
      c.save(); c.beginPath(); c.rect(cam.ox, cam.oy, G.n * cs, G.n * cs); c.clip();
      c.fillStyle = 'rgba(' + col + ',' + (style === 'paper' ? 0.08 : 0.07) + ')'; c.fillRect(x0 + 2, y0 + 2, cs * 3 - 4, cs * 3 - 4);
      c.strokeStyle = 'rgba(' + col + ',.6)'; c.lineWidth = 1.5; c.setLineDash([cs * 0.14, cs * 0.1]); c.lineDashOffset = reducedMotion() ? 0 : -now / 60;
      c.strokeRect(x0 + 2, y0 + 2, cs * 3 - 4, cs * 3 - 4); c.setLineDash([]);
      c.restore();
      if (style === 'paper') g3Put(c, g3Pic('chart', 'trap'), cx, cy, cs * 48 / 44);
      else if (style === 'radar') g3Put(c, g3Pic('radar', 'trap'), cx, cy, cs * 48 / 40);
      else g3Trap(c, cx, cy, cs, now);
      // How many turns it has left, as small dots.
      var left = t.until - G.turn + 1;
      for (var d = 0; d < left; d++) { c.fillStyle = 'rgba(' + col + ',.9)'; c.beginPath(); c.arc(cx + (d - (left - 1) / 2) * cs * 0.16, cy + cs * 0.4, cs * 0.045, 0, 7); c.fill(); }
    });
  }
  // A trap: a ring of iron spikes around a glowing lantern float.
  function g3Trap(c, cx, cy, cs, now) {
    var s = cs / 24, pulse = reducedMotion() ? 0.8 : 0.65 + 0.35 * Math.sin(now / 300);
    c.save(); c.translate(cx, cy);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, 9 * s); g.addColorStop(0, 'rgba(255,220,120,' + (0.55 * pulse) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 9 * s, 0, 7); c.fill();
    c.strokeStyle = '#5a5f73'; c.lineWidth = Math.max(1.2, 1.6 * s); c.lineCap = 'round';
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * 5 * s, Math.sin(a) * 5 * s); c.lineTo(Math.cos(a) * 8 * s, Math.sin(a) * 8 * s); c.stroke(); }
    c.strokeStyle = '#8a8fa6'; c.lineWidth = Math.max(1.4, 2 * s); c.beginPath(); c.arc(0, 0, 5 * s, 0, 7); c.stroke();
    c.fillStyle = '#e8504a'; c.beginPath(); c.arc(0, 0, 3.2 * s, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,236,170,' + pulse + ')'; c.beginPath(); c.arc(0, -0.6 * s, 1.6 * s, 0, 7); c.fill();
    c.restore();
  }
  function g3BoatPos(now) {
    var G = g3.G, a = g3.anim;
    var at = function (x, y) { return { x: x, y: y + Math.max(0, 1 - Math.hypot(x - G.c, y - G.c)) * 0.45 }; };   // docks in front of the lighthouse
    if (!a || a.path.length < 2) return at(G.boat.x, G.boat.y);
    var segs = a.path.length - 1, f = Math.max(0, (now - a.t0) / 330);
    if (f >= segs) { g3.anim = null; return at(G.boat.x, G.boat.y); }
    var k = Math.floor(f), u = f - k, p = a.path[k], q = a.path[k + 1];
    return at(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u);
  }
  function g3Beam(c, cx, cy, angle, len) {
    c.save();
    var half = 20 * Math.PI / 180, a0 = angle - Math.PI / 2 - half, a1 = angle - Math.PI / 2 + half;
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, len);
    g.addColorStop(0, 'rgba(255,240,190,.5)'); g.addColorStop(0.6, 'rgba(255,225,150,.16)'); g.addColorStop(1, 'rgba(255,225,150,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, len, a0, a1); c.closePath(); c.fill();
    c.restore();
  }
  // A gust of wind: three streaks flowing one way, with an arrowhead.
  function g3Wind(c, cx, cy, cs, dir, now, alpha) {
    var rot = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI }[dir] || 0, s = cs / 24;
    c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.rotate(rot); c.lineCap = 'round';
    c.strokeStyle = 'rgba(230,240,255,.9)'; c.lineWidth = Math.max(1.4, 1.7 * s);
    c.setLineDash([5 * s, 3.2 * s]); c.lineDashOffset = reducedMotion() ? 0 : -now / 45;
    [[-5.5, 0.8], [0, 1], [5.5, 0.8]].forEach(function (r, i) {
      var y0 = r[0] * s;
      c.beginPath(); c.moveTo(-9 * s * r[1], y0); c.bezierCurveTo(-3 * s, y0 - 3 * s, 3 * s, y0 + 3 * s, 8 * s * r[1], y0); c.stroke();
    });
    c.setLineDash([]); c.fillStyle = 'rgba(230,240,255,.95)';
    c.beginPath(); c.moveTo(11 * s, 0); c.lineTo(6.5 * s, -3.6 * s); c.lineTo(6.5 * s, 3.6 * s); c.closePath(); c.fill();
    c.restore();
  }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  // Treasure: a chest bobbing on the water, or (only shown at the end) sunk deep with bubbles rising.
  function g3Chest(c, cx, cy, cs, now, deep) {
    var s = cs / 24, bob = deep || reducedMotion() ? 0 : Math.sin(now / 520 + cx) * 1.2 * s;
    c.save(); c.translate(cx, cy + bob); if (deep) c.globalAlpha = 0.55;
    c.fillStyle = 'rgba(255,214,90,.22)'; c.beginPath(); c.arc(0, 1 * s, 10.5 * s, 0, 7); c.fill();
    c.fillStyle = '#7b4e2c'; c.fillRect(-7 * s, -1 * s, 14 * s, 8 * s);
    c.fillStyle = '#9c6537'; c.beginPath(); c.moveTo(-7 * s, -1 * s); c.quadraticCurveTo(0, -8.5 * s, 7 * s, -1 * s); c.closePath(); c.fill();
    c.fillStyle = '#ffd23f'; c.fillRect(-7 * s, 0, 14 * s, 1.8 * s); c.fillRect(-1.4 * s, -1.5 * s, 2.8 * s, 4.5 * s);
    if (!deep) { c.strokeStyle = 'rgba(200,225,255,.55)'; c.lineWidth = Math.max(1, s); c.beginPath(); c.ellipse(0, 7.5 * s, 9 * s, 1.8 * s, 0, 0, 7); c.stroke(); }
    c.restore();
    if (deep) guideBubbles(c, cx, cy, cs, now, 3);
  }

  /* ---------- The keeper's picker: tap a square, then what is there ---------- */
  var G3_PICKS = [['rock', 'Rock'], ['tall', 'Tall rock'], ['whirl', 'Whirlpool'], ['wind', 'Gust'], ['treasure', 'Treasure'], ['serpent', 'Serpent'], ['trap', 'Trap'], ['erase', 'Erase'], ['ping', 'Ping']];
  var G3_WINDS = [['wind-n', 'North'], ['wind-e', 'East'], ['wind-s', 'South'], ['wind-w', 'West'], ['back', 'Back']];
  function g3PickerFill() {
    var pk = g3El().querySelector('.g3-picker'), list = g3.pickWind ? G3_WINDS : G3_PICKS;
    pk.innerHTML = list.map(function (p) { return '<button type="button" data-icon="' + p[0] + '"><canvas width="56" height="56" aria-hidden="true"></canvas><span>' + p[1] + '</span></button>'; }).join('');
    pk.setAttribute('aria-label', g3.pickWind ? 'Which way the gust blows' : 'Draw on the chart');
    pk.querySelectorAll('button').forEach(function (b) {
      var icon = b.getAttribute('data-icon'), cv = b.querySelector('canvas'), c = cv.getContext('2d');
      c.setTransform(2, 0, 0, 2, 0, 0);
      if (icon === 'erase' || icon === 'ping' || icon === 'back') {
        c.strokeStyle = icon === 'ping' ? '#ffd678' : '#eef0ff'; c.fillStyle = c.strokeStyle; c.lineWidth = 2.4; c.lineCap = 'round';
        if (icon === 'erase') { c.beginPath(); c.moveTo(8, 8); c.lineTo(20, 20); c.moveTo(20, 8); c.lineTo(8, 20); c.stroke(); }
        else if (icon === 'ping') { c.beginPath(); c.arc(14, 14, 3, 0, 7); c.fill(); c.lineWidth = 2; c.beginPath(); c.arc(14, 14, 8, 0, 7); c.stroke(); }
        else { c.beginPath(); c.moveTo(17, 7); c.lineTo(10, 14); c.lineTo(17, 21); c.stroke(); }
      } else {
        var paint = function () { c.clearRect(0, 0, 28, 28); c.fillStyle = '#e2bf82'; c.beginPath(); c.arc(14, 14, 13.5, 0, 7); c.fill(); g3Sprite(c, icon === 'wind' ? 'wind-e' : icon, 14, 14, 25); };
        paint();
        var im = g3Pic('chart', icon.indexOf('wind') === 0 ? 'wind' : icon); if (!im.complete) im.addEventListener('load', paint, { once: true });
      }
      if (icon === 'trap' && g3TrapHere()) b.querySelector('span').textContent = 'Take back';
      else if (icon === 'trap' && g3.G.trapTurn === g3.G.turn) { b.disabled = true; b.querySelector('span').textContent = 'Trap used'; }
      // A trap from an earlier turn stays where it is: it cannot be erased, and a second one cannot go on top of it.
      if ((icon === 'erase' || icon === 'trap') && g3OldTrapHere()) b.disabled = true;
      b.onclick = function () {
        if (!g3 || !g3.picker) return;
        var p = g3.picker;
        if (icon === 'wind') { g3.pickWind = true; g3PickerFill(); g3PlacePicker(); return; }
        if (icon === 'back') { g3.pickWind = false; g3PickerFill(); g3PlacePicker(); return; }
        if (icon === 'ping') g3Send({ a: 'ping', x: p[0], y: p[1] });
        else if (icon === 'trap' && g3TrapHere()) { g3Send({ a: 'untrap', x: p[0], y: p[1] }); pluck(523.25, 0, 0.04, 0.4); pluck(392, 0.06, 0.04, 0.5); }
        else if (icon === 'trap') { g3Send({ a: 'trap', x: p[0], y: p[1] }); pluck(392, 0, 0.05, 0.4); pluck(523.25, 0.06, 0.04, 0.5); }
        else { if (icon === 'erase' && g3TrapHere()) g3Send({ a: 'untrap', x: p[0], y: p[1] }); g3Send({ a: 'mark', x: p[0], y: p[1], icon: icon }); }
        g3.picker = null; g3.pickWind = false; g3Hud();
      };
    });
    window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush();
  }
  // This turn's trap, on the picked square (it can still be taken back).
  function g3OldTrapHere() { var p = g3.picker, G = g3.G; return !!p && G.traps.some(function (t) { return t.x === p[0] && t.y === p[1] && t.turn !== G.turn; }); }
  function g3TrapHere() { var p = g3.picker, G = g3.G; return !!p && G.traps.some(function (t) { return t.x === p[0] && t.y === p[1] && t.turn === G.turn; }); }
  function g3PlacePicker() {
    var pk = g3El().querySelector('.g3-picker'), cam = g3Cam();
    pk.hidden = false;
    var w = pk.offsetWidth || 300, h = pk.offsetHeight || 64;
    var left = Math.max(6, Math.min(g3w - w - 6, cam.ox + (g3.picker[0] + 0.5) * cam.cs - w / 2)), top = cam.oy + (g3.picker[1] + 1) * cam.cs + 6;
    if (top + h > g3h - 4) top = Math.max(4, cam.oy + g3.picker[1] * cam.cs - h - 6);
    pk.style.left = left + 'px'; pk.style.top = top + 'px';
  }

  /* ---------- Input: taps, the keeper's aim, zooming and moving the chart ---------- */
  function g3Pos(ev) { var r = g3El().querySelector('canvas').getBoundingClientRect(); return { px: ev.clientX - r.left, py: ev.clientY - r.top }; }
  function g3Aim(ev) {
    var p = g3Pos(ev), cam = g3Cam(), G = g3.G, lx = cam.ox + (G.c + 0.5) * cam.cs, ly = cam.oy + (G.c + 0.5) * cam.cs;
    if (Math.hypot(p.px - lx, p.py - ly) < cam.cs * 0.4) return;
    g3.angle = Math.atan2(p.px - lx, -(p.py - ly));
  }
  function g3Tap(ev) {
    if (!g3 || g3.G.ended || g3.cover) return;
    var G = g3.G, p = g3Pos(ev), cam = g3Cam(), x = Math.floor((p.px - cam.ox) / cam.cs), y = Math.floor((p.py - cam.oy) / cam.cs);
    if (g3.role === 'keeper' && G.phase === 'light') return;
    if (!G3.inside(G, x, y)) { if (g3.picker) { g3.picker = null; g3Hud(); } return; }
    if (g3.role === 'keeper' && G.phase === 'write') {
      if (x === G.c && y === G.c) return;
      g3.picker = [x, y]; g3.pickWind = false; g3PickerFill(); g3PlacePicker(); return;
    }
    if (g3.role === 'boat' && G.phase === 'boat') {
      var path = G3.planPath(G, g3.plan), end = path[path.length - 1];
      for (var j = 0; j < path.length; j++) if (path[j][0] === x && path[j][1] === y) { g3SetPlan(j === path.length - 1 ? g3.plan.slice(0, -1) : g3.plan.slice(0, j)); return; }
      var dx = x - end[0], dy = y - end[1];
      if (Math.abs(dx) + Math.abs(dy) === 1 && g3.plan.length < G.steps) { g3SetPlan(g3.plan + (dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N')); return; }
    }
    g3Send({ a: 'ping', x: x, y: y });
  }
  (function () {
    var el = g3El(); if (!el) return;
    var cv = el.querySelector('canvas'), pinch = null, drag = null;
    cv.addEventListener('pointerdown', function (ev) {
      if (!g3) return;
      audio();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      g3.ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(g3.ptrs);
      if (ids.length === 2) {
        var a = g3.ptrs[ids[0]], b = g3.ptrs[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; drag = null; g3.aiming = false; return;
      }
      drag = { x: ev.clientX, y: ev.clientY, moved: false };
      if (g3.role === 'keeper' && g3.G.phase === 'light' && !g3.cover && !g3.G.ended) { g3.aiming = true; g3Aim(ev); }
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!g3 || !g3.ptrs[ev.pointerId]) return;
      var prev = g3.ptrs[ev.pointerId];
      g3.ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(g3.ptrs);
      if (pinch && ids.length >= 2) {
        var a = g3.ptrs[ids[0]], b = g3.ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, r = cv.getBoundingClientRect();
        g3Zoom(d / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch.d = d; return;
      }
      if (g3.aiming) { g3Aim(ev); return; }
      if (!drag) return;
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 8) drag.moved = true;
      if (drag.moved && g3.zoom > 1) { var cam = g3Cam(); g3.vx -= (ev.clientX - prev.x) / cam.cs; g3.vy -= (ev.clientY - prev.y) / cam.cs; if (g3.picker) g3PlacePicker(); }
    });
    var up = function (ev) {
      if (!g3 || !g3.ptrs[ev.pointerId]) return;
      delete g3.ptrs[ev.pointerId];
      var was = drag; drag = null;
      if (pinch) { if (!Object.keys(g3.ptrs).length) pinch = null; return; }
      if (g3.aiming) { g3.aiming = false; return; }
      if (was && !was.moved && ev.type === 'pointerup') g3Tap(ev);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (ev) { if (!g3) return; ev.preventDefault(); var p = g3Pos(ev); g3Zoom(Math.exp(-ev.deltaY * 0.0015), p.px, p.py); }, { passive: false });
    el.querySelector('.g3-zin').onclick = function () { if (g3) g3Zoom(1.4, g3w / 2, g3h / 2); };
    el.querySelector('.g3-zout').onclick = function () { if (g3) g3Zoom(1 / 1.4, g3w / 2, g3h / 2); };
    el.querySelector('.g3-zfit').onclick = function () { if (g3) { g3.zoom = 1; if (g3.picker) g3PlacePicker(); } };
    // The usual footer and settings button, for this game.
    el.querySelector('[data-g3nav="menu"]').onclick = function () { audio(); g3Leave(startMenu); };
    el.querySelector('[data-g3nav="help"]').onclick = function () { audio(); g3HelpRequest(); };
    el.querySelector('[data-g3nav="levels"]').onclick = function () { audio(); var local = g3 && g3.local; g3Leave(function () { levelsSheet(local ? 'boarding' : 'online'); }); };
    el.querySelector('.g3-opts').onclick = function () { audio(); settingsSheet(); };
  })();

  /* ---------- The end ---------- */
  function g3End() {
    if (!g3) return;
    var G = g3.G, won = G.ended === 'won', perfect = won && G.got === G.treasure.length;
    if (won) [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { pluck(f, i * 0.12, 0.07, 1.6); });
    else { pluck(220, 0, 0.08, 1.2); pluck(174.6, 0.2, 0.07, 1.4); }
    track('guide3_end', { result: G.ended, turns: G.turn, treasure: G.got, sailors: G.lives, role: g3.role, local: !!g3.local, perfect: perfect });
    var head = '<div class="g-end"><h2>' + (perfect ? 'Perfect voyage!' : won ? 'Home safe!' : 'Lost at sea') + '</h2><p>' + (perfect ? 'Home with every treasure on board.' : won ? 'The boat reached the lighthouse.' : 'The boat ran out of sailors.') + '</p><p>' + (g3.local ? 'The fog has lifted: now you can see the whole sea.' : 'The fog has lifted: now you can both see the whole sea.') + '</p>' +
      '<div class="lsum"><span>Turns<b class="notr">' + G.turn + '</b></span><span>Treasure<b class="notr">' + G.got + ' / ' + G.treasure.length + '</b></span><span>Sailors<b class="notr">' + Math.max(0, G.lives) + '</b></span></div>';
    var look = function () { closeSheet(); var bt = g3El().querySelector('.g-btns'); bt.innerHTML = '<button class="primary" id="g3Back">Done</button>'; bt.querySelector('#g3Back').onclick = g3End; };
    if (g3.local) {
      var bu = g3.bu, opts = g3.opts, id = 'bu-' + (bu + 1);
      if (won && bu >= 0) { progress.done[id] = true; if (perfect) progress.perfect[id] = true; save('unwind.progress2', progress); }
      var ls = sheet(head + (won && !perfect ? '<p class="note">Find every treasure for a perfect voyage.</p>' : '') + '<button class="primary" id="g3New">New map</button><button class="secondary" id="g3Look">Look at the sea</button><button class="secondary" id="g3Levels">Back to levels</button></div>', 'start');
      ls.querySelector('#g3New').onclick = function () { closeSheet(); openGuide3Local(opts, bu); };
      ls.querySelector('#g3Look').onclick = look;
      ls.querySelector('#g3Levels').onclick = function () { closeSheet(); closeGuide3(); levelsSheet('boarding'); };
      return;
    }
    var s = sheet(head + '<button class="primary" id="again">Play again</button><button class="secondary" id="g3Look">Look at the sea</button><button class="secondary" id="g3Lobby">Back to the room</button></div>', 'start');
    s.querySelector('#again').onclick = function () { netSend({ t: 'again' }); this.disabled = true; this.textContent = 'Waiting for your partner…'; };
    s.querySelector('#g3Look').onclick = look;
    s.querySelector('#g3Lobby').onclick = function () { netSend({ t: 'lobby' }); closeSheet(); closeGuide3(); };
  }
