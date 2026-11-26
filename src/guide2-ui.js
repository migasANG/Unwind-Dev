  /* ---------- Guiding Light 2.0 (solo, in Boarding Up): you are the keeper ----------
     The rules live in guide2.js. You have the whole chart but never see the boat; the captain radios what is
     around it. Work out where the boat is, then bring it home with the beam and buoys. */
  var G2 = window.UnwindGuide2, g2 = null, g2ctx = null, g2w = 0, g2h = 0, g2dpr = 1;
  function g2El() { return $('guide2'); }
  function openGuide2(level, bu) {
    if ($('sheetHost').firstChild) closeSheet();
    var seed = Math.floor(Math.random() * 1e9);
    g2 = { G: G2.create(level, seed), level: level, bu: bu, seed: seed, mode: 'beam', aim: -1, spot: null, beamAt: 0, busyUntil: 0, history: [], ended: false, endAt: 0 };
    g2.history.push(g2.G.report);
    // Rock and tall rock tiles drawn by the Guiding Light painter: it reads the tile kinds of its own rules.
    g2.paint = { n: g2.G.n, grid: g2.G.grid.map(function (t) { return t === G2.ROCK ? Gd.ROCK : t === G2.TALL ? Gd.BIG : Gd.WATER; }) };
    var el = g2El();
    el.hidden = false;
    document.body.classList.add('guideon');
    guideMusic(true);
    g2Layout(); g2Hud(); g2Radio();
    track('guide2_start', { level: level + 1 });
    if (!(progress.tutorials && progress.tutorials.guide2)) g2Help(true);
    if (!g2.loop) g2Loop();
  }
  function closeGuide2(toLevels) {
    if (!g2) return;
    g2 = null; g2El().hidden = true;
    document.body.classList.remove('guideon');
    guideMusic(false);
    if (toLevels) levelsSheet('boarding');
  }
  function g2Layout() {
    if (!g2) return;
    var cv = g2El().querySelector('canvas'), r = cv.getBoundingClientRect();
    g2dpr = Math.min(2, window.devicePixelRatio || 1); g2w = r.width; g2h = r.height;
    cv.width = Math.round(g2w * g2dpr); cv.height = Math.round(g2h * g2dpr);
    g2ctx = cv.getContext('2d');
  }
  window.addEventListener('resize', function () { if (g2) g2Layout(); });
  // The report panel grows and shrinks with what the captain says, which resizes the chart's space too.
  if (window.ResizeObserver) new ResizeObserver(function () { if (g2) g2Layout(); }).observe(g2El().querySelector('canvas'));
  function g2Cam() { var n = g2.G.n, cs = Math.min(g2w / (n + 0.4), g2h / (n + 0.4)); return { cs: cs, ox: (g2w - n * cs) / 2, oy: (g2h - n * cs) / 2 }; }

  /* ---------- Turns ---------- */
  function g2Act(act) {
    if (!g2 || g2.G.ended || performance.now() < g2.busyUntil) return;
    var res = G2.apply(g2.G, act);
    if (!res.ok) { if (res.why === 'oil') g2Note('The lamp has no oil left. Use buoys.'); return; }
    var now = performance.now();
    g2.busyUntil = now + 450; g2.aim = -1; g2.spot = null;
    if (act.a === 'beam') { g2.beamAt = now; pluck(659.25, 0, 0.05, 1.4); pluck(987.77, 0.06, 0.04, 1.6); }
    else if (act.a === 'buoy') { pluck(523.25, 0, 0.05, 0.6); pluck(392, 0.1, 0.04, 0.7); }
    // The radio crackles before the captain answers.
    g2.radioAt = now;
    g2.history.push(g2.G.report);
    if (res.events.some(function (e) { return e.e === 'bite'; })) { pluck(130.8, 0.2, 0.08, 0.6); pluck(110, 0.32, 0.08, 0.7); }
    else if (res.events.some(function (e) { return e.e === 'light' || e.e === 'tobuoy'; })) { pluck(784, 0.25, 0.04, 0.4); }
    g2Hud(); g2Radio();
    if (g2.G.ended) { g2.endAt = now; setTimeout(g2End, 1300); }
  }

  /* ---------- What is shown around the chart ---------- */
  function g2Hud() {
    var G = g2.G, el = g2El();
    el.querySelector('.g-role').textContent = G2.LEVELS[g2.level].name;
    el.querySelector('.g2-level b').textContent = String(g2.level + 1);
    el.querySelector('.g-round b').textContent = Math.min(G.round, G.maxRounds) + ' / ' + G.maxRounds;
    el.querySelector('.g-lives').innerHTML = Array.apply(null, Array(Math.max(G.lives, 3))).map(function (_, i) { return '<svg viewBox="-1 -1 26 24"' + (i < G.lives ? '' : ' class="gone"') + ' aria-hidden="true"><path d="M12 21 C 5 15 1 11.5 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 11.5 19 15 12 21Z"/></svg>'; }).join('');
    el.querySelector('.g2-oil b').textContent = String(G.oil);
    el.querySelectorAll('[data-g2mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g2mode') === g2.mode)); });
    var msg = '', btns = '';
    if (G.ended) msg = '';
    else if (g2.mode === 'beam') {
      msg = G.oil ? (g2.aim >= 0 ? 'Shine the beam this way? The boat follows it home if it is in the light.' : 'Tap the sea to aim the beam.') : 'The lamp has no oil left. Use buoys.';
      btns = '<button class="primary" id="g2Go"' + (g2.aim < 0 || !G.oil ? ' disabled' : '') + '>Shine</button>';
    } else if (g2.mode === 'buoy') {
      msg = g2.spot ? 'Drop a buoy here? The captain sails to a buoy within two tiles.' : (G.buoys.length >= G.buoyMax ? 'Tap the sea to move your oldest buoy.' : 'Tap the sea where you want a buoy.');
      btns = '<button class="primary" id="g2Go"' + (!g2.spot ? ' disabled' : '') + '>Drop buoy</button>';
    } else msg = 'Tap tiles to mark where the boat might be. Marks are only notes for you.';
    btns += '<button id="g2Wait">Wait a round</button>';
    el.querySelector('.g-msg').textContent = msg;
    var bt = el.querySelector('.g-btns'); bt.innerHTML = G.ended ? '' : btns;
    if (bt.querySelector('#g2Go')) bt.querySelector('#g2Go').onclick = function () { if (g2.mode === 'beam' && g2.aim >= 0) g2Act({ a: 'beam', dir: g2.aim }); else if (g2.mode === 'buoy' && g2.spot) g2Act({ a: 'buoy', x: g2.spot[0], y: g2.spot[1] }); };
    if (bt.querySelector('#g2Wait')) bt.querySelector('#g2Wait').onclick = function () { g2Act({ a: 'wait' }); };
  }
  function g2Note(text) { var m = g2El().querySelector('.g-msg'); m.textContent = text; }
  var G2_KIND = { rock: ['A rock', 'Rocks'], tall: ['A tall rock', 'Tall rocks'], wreck: ['A shipwreck', 'A shipwreck'], island: ['An island', 'An island'], kelp: ['Kelp', 'Kelp'], light: ['The lighthouse', 'The lighthouse'], serpent: ['A sea serpent', 'A sea serpent'] };
  var G2_DIR = ['to the north', 'to the north-east', 'to the east', 'to the south-east', 'to the south', 'to the south-west', 'to the west', 'to the north-west'];
  var G2_ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  var G2_BUOY = { red: 'The red buoy', yellow: 'The yellow buoy', green: 'The green buoy' };
  var G2_EVENT = { light: 'I see your light! Following it home.', blocked: 'Something blocks the way along the light.', home: 'Home! Thank you, keeper.', oil: 'The night is over. We are lost until tomorrow.', bite: 'A serpent bit the boat!' };
  function g2EventText(e) {
    if (G2_EVENT[e.e]) return G2_EVENT[e.e];
    var b = G2_BUOY[e.color] || 'The buoy';
    if (e.e === 'tobuoy') return { red: 'I see the red buoy. Heading for it.', yellow: 'I see the yellow buoy. Heading for it.', green: 'I see the green buoy. Heading for it.' }[e.color];
    if (e.e === 'atbuoy') return { red: 'We are at the red buoy.', yellow: 'We are at the yellow buoy.', green: 'We are at the green buoy.' }[e.color];
    if (e.e === 'noway') return { red: 'I see the red buoy, but I cannot reach it.', yellow: 'I see the yellow buoy, but I cannot reach it.', green: 'I see the green buoy, but I cannot reach it.' }[e.color];
    return b;
  }
  function g2Icon(it) {
    var col = { red: '#ff6b6b', yellow: '#ffd23f', green: '#5ad17a' };
    var svg = {
      rock: '<circle cx="12" cy="14" r="7" fill="#8d8ba3"/><circle cx="9" cy="11" r="3" fill="#b9b7cc"/>',
      tall: '<path d="M6 21 8 6 12 3 16 6 18 21Z" fill="#8d8ba3"/><path d="M8 6 12 3 16 6 12 8Z" fill="#c9c7da"/><path d="M10 4h4" stroke="#6a9a6c" stroke-width="2"/>',
      wreck: '<path d="M3 16 21 12 19 19 6 20Z" fill="#8a5a36"/><path d="M11 14 9 4 15 8 11 9" fill="none" stroke="#d8c6a8" stroke-width="1.6"/>',
      island: '<ellipse cx="12" cy="18" rx="9" ry="4" fill="#e3c98e"/><path d="M12 18V8" stroke="#8a5a36" stroke-width="2"/><path d="M12 8Q6 5 4 9M12 8Q18 5 20 9M12 8Q9 3 6 4M12 8Q15 3 18 4" stroke="#5aa860" stroke-width="2" fill="none" stroke-linecap="round"/>',
      kelp: '<path d="M8 21Q5 15 8 11T8 3M13 21Q16 15 13 11T14 4M18 21Q15 16 18 12" stroke="#4fb06d" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      light: '<path d="M9 21 10 8H14L15 21Z" fill="#eef0ff"/><path d="M10 13H14M9.6 17H14.4" stroke="#e24b4b" stroke-width="2"/><circle cx="12" cy="6" r="3" fill="#ffe9a8"/>',
      serpent: '<path d="M3 16Q6 10 9 16T15 16Q17 12 20 13" stroke="#5f9c8e" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="20" cy="12.5" r="2.2" fill="#5f9c8e"/>',
      buoy: '<path d="M7 19H17L15 9H9Z" fill="' + (col[it.color] || '#fff') + '"/><path d="M8 14H16" stroke="#fff" stroke-width="2"/><circle cx="12" cy="7" r="2" fill="#fff6c8"/>'
    }[it.kind] || '';
    return '<svg class="g2-ic" viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg>';
  }
  function g2Line(rep) {
    var out = '';
    rep.events.forEach(function (e) { out += '<p class="g2-ev">' + g2EventText(e) + '</p>'; });
    if (!rep.items.length) out += '<p class="g2-none">Only fog and open water around me.</p>';
    else out += '<ul class="g2-items">' + rep.items.map(function (it) {
      var name = it.kind === 'buoy' ? G2_BUOY[it.color] : G2_KIND[it.kind][it.count > 1 ? 1 : 0];
      return '<li>' + g2Icon(it) + '<div><span class="g2-what">' + name + '</span> <span class="g2-where"><span>' + (it.dist <= 1 ? 'right next to me' : 'two tiles away') + '</span>, <span>' + G2_DIR[it.dir] + '</span> <b class="notr">' + G2_ARROW[it.dir] + '</b></span></div></li>';
    }).join('') + '</ul>';
    return out;
  }
  function g2Radio() {
    var box = g2El().querySelector('.g2-radio'), h = g2.history, cur = h[h.length - 1];
    var html = '<div class="g2-head"><span class="g2-dot"></span><b>Captain</b><span class="g2-r">Round ' + Math.min(cur.round, g2.G.maxRounds) + '</span></div>' + (h.length === 1 ? '<p class="g2-ev">Captain here. We are lost in the fog. This is what I can see:</p>' : '') + g2Line(cur);
    if (h.length > 1) html += '<details class="g2-prev"><summary>Earlier reports</summary>' + h.slice(0, -1).reverse().map(function (r) { return '<div class="g2-old"><span class="g2-r">Round ' + r.round + '</span>' + g2Line(r) + '</div>'; }).join('') + '</details>';
    box.innerHTML = html;
    box.classList.remove('fresh'); void box.offsetWidth; box.classList.add('fresh');
  }

  /* ---------- Drawing ---------- */
  function g2Loop() {
    g2.loop = true;
    var tick = function (now) {
      if (!g2) return;
      g2Draw(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function g2Draw(now) {
    var c = g2ctx, G = g2.G, cam = g2Cam(), cs = cam.cs, X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; };
    c.setTransform(g2dpr, 0, 0, g2dpr, 0, 0);
    c.fillStyle = '#060a1c'; c.fillRect(0, 0, g2w, g2h);
    // The chart: the keeper knows every tile, in the soft blue of a moonlit sea.
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var t = G.grid[y * G.n + x], px = X(x), py = Y(y), lit = G2.isLit(G, x, y);
      c.fillStyle = lit ? '#2b3c74' : ((x + y) % 2 ? '#17234c' : '#192650'); c.fillRect(px, py, cs + 0.5, cs + 0.5);
      if (t === G2.ROCK || t === G2.TALL) guideTerrain(c, g2.paint, x, y, px, py, cs, now, 1);
      else if (t === G2.WRECK) g2Wreck(c, px + cs / 2, py + cs / 2, cs);
      else if (t === G2.ISLAND) g2Island(c, px + cs / 2, py + cs / 2, cs, now);
      else if (t === G2.KELP) g2Kelp(c, px + cs / 2, py + cs / 2, cs, now, x * 7 + y);
    }
    c.strokeStyle = 'rgba(160,180,255,.08)'; c.lineWidth = 1;
    for (var gl = 1; gl < G.n; gl++) { c.beginPath(); c.moveTo(X(gl), Y(0)); c.lineTo(X(gl), Y(G.n)); c.moveTo(X(0), Y(gl)); c.lineTo(X(G.n), Y(gl)); c.stroke(); }
    c.strokeStyle = 'rgba(255,214,140,.3)'; c.lineWidth = 2; c.strokeRect(X(0), Y(0), G.n * cs, G.n * cs);
    // The beam of this round, and the one being aimed.
    var lx = X(G.c) + cs / 2, ly = Y(G.c) + cs / 2, clip = [X(0), Y(0), G.n * cs, G.n * cs];
    if (G.beam >= 0) guideBeam(c, lx, ly, G.beam, cs, G.n, Math.min(1, (now - g2.beamAt) / 350), false, clip);
    if (g2.mode === 'beam' && g2.aim >= 0 && !G.ended) guideBeam(c, lx, ly, g2.aim, cs, G.n, 1, true, clip);
    // Serpents are only seen where the light falls: caught in it, they dive, and only bubbles show.
    G.serpents.forEach(function (s) { if (s.down && G2.isLit(G, s.x, s.y)) guideBubbles(c, X(s.x) + cs / 2, Y(s.y) + cs / 2, cs, now, s.id); });
    // Your notes.
    Object.keys(G.marks).forEach(function (k) {
      var mx = X(k % G.n) + cs / 2, my = Y(Math.floor(k / G.n)) + cs / 2;
      c.strokeStyle = 'rgba(255,233,168,.85)'; c.lineWidth = Math.max(1.5, cs * 0.06); c.setLineDash([cs * 0.08, cs * 0.06]);
      c.beginPath(); c.arc(mx, my, cs * 0.3, 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,233,168,.9)'; c.font = '700 ' + Math.round(cs * 0.34) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', mx, my + cs * 0.02);
    });
    // Buoys, bobbing; and the spot picked for a new one.
    G.buoys.forEach(function (b, i) { g2Buoy(c, X(b.x) + cs / 2, Y(b.y) + cs / 2, cs, now, b.color, 1, i); });
    if (g2.mode === 'buoy' && g2.spot && !G.ended) {
      var next = G.buoys.length >= G.buoyMax ? G.buoys[0].color : ['red', 'yellow', 'green'].filter(function (cc) { return !G.buoys.some(function (b) { return b.color === cc; }); })[0];
      g2Buoy(c, X(g2.spot[0]) + cs / 2, Y(g2.spot[1]) + cs / 2, cs, now, next, 0.55, 9);
      c.strokeStyle = 'rgba(255,233,168,.35)'; c.setLineDash([cs * 0.12, cs * 0.1]); c.lineWidth = 1.5;
      c.strokeRect(X(g2.spot[0] - 2), Y(g2.spot[1] - 2), cs * 5, cs * 5); c.setLineDash([]);
    }
    // The lighthouse.
    var img = lighthouseImage(), lk = cs * 1.15 / 85;
    if (img.complete && img.naturalWidth) c.drawImage(img, lx - 20 * lk, Y(G.c) + cs * 0.85 - 110 * lk, 40 * lk, 126 * lk);
    var glow = c.createRadialGradient(lx, ly - cs * 0.62, 0, lx, ly - cs * 0.62, cs * 0.55);
    glow.addColorStop(0, G.oil ? 'rgba(255,233,168,.75)' : 'rgba(255,233,168,.15)'); glow.addColorStop(1, 'rgba(255,233,168,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(lx, ly - cs * 0.62, cs * 0.55, 0, 7); c.fill();
    // At the end the fog lifts: the boat and the way it sailed.
    if (G.ended) {
      var k = Math.min(1, (now - g2.endAt) / 900);
      c.save(); c.globalAlpha = k; c.strokeStyle = 'rgba(255,233,168,.7)'; c.lineWidth = Math.max(2, cs * 0.08); c.setLineDash([cs * 0.14, cs * 0.12]); c.lineJoin = 'round';
      c.beginPath(); G.path.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](X(p[0]) + cs / 2, Y(p[1]) + cs / 2); }); c.stroke(); c.restore();
      guideBoat(c, X(G.boat.x) + cs / 2, Y(G.boat.y) + cs / 2, cs, now, true, k, 0);
    }
  }
  function g2Wreck(c, cx, cy, cs) {
    c.save(); c.translate(cx, cy); c.rotate(-0.25); var s = cs / 24;
    c.fillStyle = 'rgba(3,6,20,.35)'; c.beginPath(); c.ellipse(0, 6 * s, 11 * s, 3 * s, 0, 0, 7); c.fill();
    c.fillStyle = '#6e4a2e'; c.beginPath(); c.moveTo(-10 * s, 0); c.lineTo(10 * s, -2 * s); c.lineTo(7 * s, 6 * s); c.lineTo(-7 * s, 6 * s); c.closePath(); c.fill();
    c.strokeStyle = '#4a2f1c'; c.lineWidth = Math.max(1, s); c.beginPath(); c.moveTo(-8 * s, 3 * s); c.lineTo(8 * s, 1.5 * s); c.stroke();
    c.strokeStyle = '#c9b48f'; c.lineWidth = Math.max(1.2, 1.4 * s); c.beginPath(); c.moveTo(1 * s, -1 * s); c.lineTo(-2 * s, -11 * s); c.stroke();
    c.fillStyle = 'rgba(225,215,190,.75)'; c.beginPath(); c.moveTo(-2 * s, -11 * s); c.lineTo(5 * s, -6 * s); c.lineTo(-0.5 * s, -5 * s); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(225,235,255,.55)'; c.lineWidth = Math.max(1, s); c.beginPath(); c.ellipse(0, 6 * s, 12 * s, 3.2 * s, 0, 0.2, 2.9); c.stroke();
    c.restore();
  }
  function g2Island(c, cx, cy, cs, now) {
    var s = cs / 24, sway = reduced ? 0 : Math.sin(now / 900) * 0.06;
    c.fillStyle = 'rgba(225,235,255,.4)'; c.beginPath(); c.ellipse(cx, cy + 6 * s, 12 * s, 4.5 * s, 0, 0, 7); c.fill();
    c.fillStyle = '#e3c98e'; c.beginPath(); c.ellipse(cx, cy + 5 * s, 10.5 * s, 3.8 * s, 0, 0, 7); c.fill();
    c.fillStyle = '#6fae5f'; c.beginPath(); c.ellipse(cx - 3 * s, cy + 3.5 * s, 4 * s, 1.6 * s, 0, 0, 7); c.fill();
    c.save(); c.translate(cx + 1 * s, cy + 4 * s); c.rotate(sway);
    c.strokeStyle = '#8a5a36'; c.lineWidth = Math.max(1.5, 2 * s); c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-1 * s, -7 * s, 1 * s, -14 * s); c.stroke();
    c.strokeStyle = '#5aa860'; c.lineWidth = Math.max(1.5, 2.2 * s);
    [[-8, -11], [8, -11], [-6, -18], [6, -18], [0, -20]].forEach(function (p) { c.beginPath(); c.moveTo(1 * s, -14 * s); c.quadraticCurveTo((1 + p[0] * 0.4) * s, (-14 + (p[1] + 14) * 0.2 - 3) * s, (1 + p[0]) * s, (p[1] + 4) * s); c.stroke(); });
    c.restore();
  }
  function g2Kelp(c, cx, cy, cs, now, seed) {
    var s = cs / 24, t = reduced ? 0 : now / 1100 + seed;
    c.strokeStyle = 'rgba(79,176,109,.8)'; c.lineWidth = Math.max(1.2, 1.8 * s); c.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var bx = cx + (i - 1.5) * 4.5 * s, sw = Math.sin(t + i) * 2.5 * s;
      c.beginPath(); c.moveTo(bx, cy + 9 * s); c.quadraticCurveTo(bx + sw - 3 * s, cy + 2 * s, bx + sw, cy - 2 * s); c.quadraticCurveTo(bx + sw + 3 * s, cy - 6 * s, bx + sw * 1.4, cy - 9 * s); c.stroke();
    }
    c.fillStyle = 'rgba(120,200,140,.5)'; c.beginPath(); c.arc(cx + 2 * s, cy - 3 * s, 1.4 * s, 0, 7); c.fill();
  }
  function g2Buoy(c, cx, cy, cs, now, color, alpha, seed) {
    var s = cs / 24, bob = reduced ? 0 : Math.sin(now / 520 + seed) * 1.2 * s, col = { red: '#e8504a', yellow: '#f5c63c', green: '#4fb36a' }[color];
    c.save(); c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(225,235,255,.5)'; c.lineWidth = Math.max(1, s); c.beginPath(); c.ellipse(cx, cy + 7 * s, 8 * s, 2.4 * s, 0, 0, 7); c.stroke();
    c.translate(cx, cy + bob);
    c.fillStyle = col; c.beginPath(); c.moveTo(-6 * s, 7 * s); c.lineTo(6 * s, 7 * s); c.lineTo(3.5 * s, -5 * s); c.lineTo(-3.5 * s, -5 * s); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-4.8 * s, 0, 9.6 * s, 2.6 * s);
    c.fillStyle = '#3a3f52'; c.fillRect(-0.8 * s, -9 * s, 1.6 * s, 4 * s);
    var on = reduced || Math.sin(now / 300 + seed) > -0.2;
    var g = c.createRadialGradient(0, -10 * s, 0, 0, -10 * s, 7 * s); g.addColorStop(0, on ? 'rgba(255,246,200,.95)' : 'rgba(255,246,200,.35)'); g.addColorStop(1, 'rgba(255,246,200,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -10 * s, 7 * s, 0, 7); c.fill();
    c.restore();
  }

  /* ---------- Input ---------- */
  function g2Pointer(ev) {
    if (!g2 || g2.G.ended || !g2El().querySelector('.g-stage').contains(ev.target)) return;
    var G = g2.G, r = g2El().querySelector('canvas').getBoundingClientRect(), cam = g2Cam(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    var tx = Math.floor((px - cam.ox) / cam.cs), ty = Math.floor((py - cam.oy) / cam.cs);
    if (g2.mode === 'beam') {
      var lx = cam.ox + (G.c + 0.5) * cam.cs, ly = cam.oy + (G.c + 0.5) * cam.cs, a = Math.atan2(px - lx, -(py - ly));
      if (Math.hypot(px - lx, py - ly) < cam.cs * 0.6) return;
      g2.aim = ((Math.round(a / (2 * Math.PI / G2.BEAM_STEPS)) % G2.BEAM_STEPS) + G2.BEAM_STEPS) % G2.BEAM_STEPS;
    } else if (!G2.inside(G, tx, ty)) return;
    else if (g2.mode === 'buoy') {
      if (!G2.open(G, tx, ty) || G2.buoyAt(G, tx, ty)) { g2Note('A buoy needs open water.'); return; }
      g2.spot = [tx, ty];
    } else {
      var k = ty * G.n + tx;
      if (G.marks[k]) delete G.marks[k]; else G.marks[k] = 1;
    }
    g2Hud();
  }
  document.addEventListener('pointerdown', function (ev) { if (g2 && !g2El().hidden && ev.target.tagName === 'CANVAS') g2Pointer(ev); });

  /* ---------- Help and the end ---------- */
  function g2Help(first) {
    var pages = [
      ['You are the keeper', 'A boat is lost in the fog. You have the whole sea chart, but you cannot see the boat. The captain radios what is around it: rocks, kelp, a shipwreck, with how near and which way.'],
      ['Find the boat', 'Look for the place on the chart that matches the report. Mark the places it could be with the pencil. As the reports change, rule places out.'],
      ['Buoys', 'Drop a buoy where you think the boat is. If it lands within two tiles, the captain sees it, says so, and sails to it. That tells you exactly where the boat is. You have three; a fourth moves your oldest.'],
      ['The beam', 'A boat in your beam follows it straight home, two tiles a round, unless rocks are in the way. The lamp has little oil, so shine only when you know. Tall rocks and islands block the light.'],
      ['Serpents', 'In later nights sea serpents swim their rounds and hunt a boat that comes near. You only see them where your light falls. Get the boat home before the night is over.']
    ];
    var i = 0, show = function () {
      var p = pages[i];
      var s = sheet('<div class="row"><h2>' + p[0] + '</h2><button class="close" id="x" aria-label="Close">×</button></div><p>' + p[1] + '</p><p class="note">' + (i + 1) + ' / ' + pages.length + '</p><div class="row" style="justify-content:flex-end;gap:8px">' + (i ? '<button class="secondary" id="g2Prev" style="width:auto;padding:0 18px">Back</button>' : '') + '<button class="primary" id="g2Next" style="width:auto;padding:0 22px">' + (i < pages.length - 1 ? 'Next' : 'Start') + '</button></div>', 'tutorial');
      var done = function () { closeSheet(); if (first) { progress.tutorials = progress.tutorials || {}; progress.tutorials.guide2 = 1; save('unwind.progress2', progress); } };
      s.querySelector('#x').onclick = done;
      s.querySelector('#g2Next').onclick = function () { if (i < pages.length - 1) { i++; show(); } else done(); };
      if (s.querySelector('#g2Prev')) s.querySelector('#g2Prev').onclick = function () { i--; show(); };
    };
    show();
  }
  function g2End() {
    if (!g2) return;
    var G = g2.G, won = G.ended === 'won', id = 'bu-' + (g2.bu + 1), last = g2.level >= G2.LEVELS.length - 1;
    if (won) { progress.done[id] = true; if (G.lives === G2.LEVELS[g2.level].lives) progress.perfect[id] = true; save('unwind.progress2', progress); }
    track('guide2_end', { level: g2.level + 1, won: won, rounds: G.round - 1, lives: G.lives });
    var html = '<div class="row"><h2>' + (won ? 'Home safe' : 'Lost in the fog') + '</h2></div><p>' + (won ? 'The boat reached the lighthouse in ' + (G.round - 1) + ' rounds.' : G.lives <= 0 ? 'The serpents got the boat.' : 'The night ran out before the boat got home.') + '</p><p>The fog has lifted: the dotted line shows where the boat really sailed.</p>' +
      '<div class="modes">' + (won && !last ? '<button id="g2Next"><b>Next night</b><span>' + G2.LEVELS[g2.level + 1].name + '</span></button>' : '') +
      '<button id="g2Again"><b>' + (won ? 'Play again' : 'Try again') + '</b><span>The boat starts somewhere else.</span></button><button id="g2Look"><b>Look at the chart</b><span>See where the boat was.</span></button><button id="g2Levels"><b>Levels</b><span>Back to Boarding Up.</span></button></div>';
    var s = sheet(html);
    var bu = g2.bu, level = g2.level;
    if (s.querySelector('#g2Next')) s.querySelector('#g2Next').onclick = function () { closeGuide2(); openGuide2(level + 1, bu + 1); };
    s.querySelector('#g2Again').onclick = function () { closeGuide2(); openGuide2(level, bu); };
    s.querySelector('#g2Look').onclick = function () { closeSheet(); g2El().querySelector('.g-btns').innerHTML = '<button class="primary" id="g2Done">Done</button>'; g2El().querySelector('#g2Done').onclick = g2End; };
    s.querySelector('#g2Levels').onclick = function () { closeSheet(); closeGuide2(true); };
  }
  (function () {
    var el = g2El();
    el.querySelector('.g-close').onclick = function () { closeGuide2(true); };
    el.querySelector('.g-help').onclick = function () { g2Help(false); };
    el.querySelectorAll('[data-g2mode]').forEach(function (b) { b.onclick = function () { if (!g2) return; g2.mode = b.getAttribute('data-g2mode'); g2Hud(); }; });
  })();
