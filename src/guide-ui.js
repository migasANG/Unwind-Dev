  /* ---------- Guiding Light: the lighthouse keeper guides the boat home through a dark sea ----------
     The rules live in guide.js (shared with the room server). This part draws the sea, takes the players' input
     and plays the game on one device (passing it between turns) or online (one role on each phone). */
  var Gd = window.UnwindGuide;
  var guide = null;
  // On one device the view belongs to whoever last took the device; it only changes behind the cover screen.
  function guideRole() { return guide.local ? guide.viewRole : guide.role; }
  function guideMine() { return !guide.G.ended && guide.G.phase === (guideRole() === 'keeper' ? 'keeper' : 'boat'); }
  function guideEl() { return $('guide'); }

  // Opens a game. opts: { seed, size, hard, local, role, online }.
  function openGuide(opts) {
    if ($('sheetHost').firstChild) closeSheet();
    var G = Gd.create(opts.seed, { size: opts.size, hard: opts.hard });
    guide = { G: G, local: !!opts.local, role: opts.role || 'keeper', online: !!opts.online, opts: opts, aim: -1, anim: null, beamAt: 0,
      cover: null, peek: false, actions: [], view: null, busyUntil: 0, last: performance.now(), toast: null, viewRole: G.phase };
    var el = guideEl();
    el.hidden = false; el.classList.toggle('hard', !!opts.hard);
    document.body.classList.add('guideon');
    guideMusic(true);
    guideLayout();
    if (guide.local) guideCover(true);
    else guideFirstTutorial();
    guideHud();
    track('guide_start', { size: opts.size, hard: !!opts.hard, local: !!opts.local });
    if (!guide.loop) guideLoop();
  }
  function closeGuide() {
    if (!guide) return;
    guide = null;
    guideEl().hidden = true;
    document.body.classList.remove('guideon');
    guideMusic(false);
  }
  function guideMusic(on) { guideTheme = on; if (audio()) musicTick(); }

  /* ---------- Actions ---------- */
  function guideAct(act) {
    if (!guide || !guideMine() || performance.now() < guide.busyUntil) return;
    var role = guideRole();
    if (guide.online) { netSend({ t: 'gact', act: act }); guide.busyUntil = performance.now() + 2500; return; }
    guideApply(role, act);
  }
  // Every action, local or from the server, goes through here so the animation and sounds are the same.
  function guideApply(role, act) {
    var G = guide.G, before = { boat: { x: G.boat.x, y: G.boat.y }, serpents: G.serpents.map(function (s) { return { x: s.x, y: s.y, frozen: s.frozen }; }), phase: G.phase, round: G.round };
    var res = Gd.apply(G, role, act);
    if (!res.ok) return false;
    guide.actions.push({ role: role, act: act });
    var log = res.log, now = performance.now();
    guide.busyUntil = 0;
    if (act.a === 'beam') {
      guide.beamAt = now; guide.aim = -1;
      pluck(659.25, 0, 0.05, 1.4); pluck(987.77, 0.06, 0.04, 1.6);
      if (G.serpents.some(function (s) { return s.frozen; }) && (guide.local || guide.role === 'keeper')) setTimeout(function () { pluck(196, 0, 0.06, 0.5); pluck(220, 0.12, 0.05, 0.5); }, 280);
    } else if (act.a === 'rekindle') {
      pluck(196, 0, 0.06, 0.8); pluck(293.66, 0.15, 0.05, 1); pluck(392, 0.3, 0.05, 1.2);
    } else if (act.a === 'flare') {
      pluck(1318.5, 0, 0.06, 0.6); pluck(1760, 0.08, 0.05, 0.8);
    } else if (act.a === 'sail') {
      pluck(act.up ? 523.25 : 392, 0, 0.05, 0.3);
    } else if (act.a === 'move' || act.a === 'wait') {
      var boatDur = log.path ? Math.max(1, log.path.length - 1) * 230 + (log.washBack ? 520 : 0) : 0;
      guide.anim = { t0: now, log: log, before: before, boatDur: boatDur, snakeDur: 420 };
      guide.busyUntil = now + boatDur + 460;
      if (act.a === 'move') pluck(392, 0, 0.06, 0.4);
      log.barrels.forEach(function (b, i) { setTimeout(function () { specialSound('chirp'); guideFloat(b.kind === 'life' ? '+1 life' : '+1 flare', b.x, b.y); }, 260 + i * 120); });
      log.whirls.forEach(function (w, i) { setTimeout(function () { pluck(330, 0, 0.06, 0.5); pluck(262, 0.08, 0.05, 0.6); pluck(196, 0.16, 0.05, 0.7); }, 230 * (i + 1)); });
      log.hits.forEach(function (h, i) { setTimeout(function () { thud(); buzz(40); guideFloat('-1 life', h.x, h.y, true); }, h.why === 'serpent' && log.serpents.length ? boatDur + 300 : 240 + i * 100); });
      if (log.washBack) setTimeout(function () { specialSound('out'); }, 200);
    }
    if (G.ended) setTimeout(function () { if (guide && guide.G === G) guideEnd(); }, guide.anim ? guide.anim.boatDur + 900 : 300);
    else if (guide.local && before.phase !== G.phase) {
      // On one device the screen covers up before the other player looks.
      setTimeout(function () { if (guide && guide.G === G && !G.ended) guideCover(true); }, guide.anim ? guide.anim.boatDur + 600 : 900);
    } else if (!guide.local && G.phase !== before.phase && !G.ended) {
      var mine = guideMine();
      setTimeout(function () { if (guide && guide.G === G && mine) { pluck(784, 0, 0.05, 0.4); guideToast(G.phase === 'keeper' ? (G.lampOut ? 'Your turn: rekindle the light.' : 'Your turn: shine the light.') : (act.a === 'rekindle' ? 'The light is out this round. Your turn: catch a wave.' : 'Your turn: catch a wave.')); } }, guide.anim ? guide.anim.boatDur + 400 : 300);
    }
    guideHud();
    return true;
  }
  function guideFloat(text, x, y, bad) { guide.floats = (guide.floats || []).concat([{ text: text, x: x, y: y, t0: performance.now(), bad: !!bad }]); }
  function guideToast(text) { guide.toast = { text: text, t0: performance.now() }; var t = guideEl().querySelector('.g-toast'); t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush(); }

  /* ---------- One device: cover the screen between turns ---------- */
  function guideCover(on) {
    var c = guideEl().querySelector('.g-cover');
    guide.cover = on;
    if (!on) { c.hidden = true; guide.viewRole = guide.G.phase; guideFirstTutorial(); guideHud(); return; }
    var G = guide.G, keeper = G.phase === 'keeper';
    c.innerHTML = '<div class="g-pass"><div class="g-passicon">' + (keeper ? guideIconSvg('keeper') : guideIconSvg('boat')) + '</div>' +
      '<h2>' + (keeper ? 'Lighthouse keeper' : 'Boat captain') + '</h2>' +
      '<p>' + (G.round === 0 && keeper ? 'The keeper goes first. Pass the device to the keeper, and no peeking, captain!' : keeper ? 'Pass the device to the keeper. No peeking, captain!' : 'Pass the device to the captain. No peeking, keeper!') + '</p>' +
      '<button class="primary" id="gReady">' + (keeper ? 'I\'m the keeper' : 'I\'m the captain') + '</button></div>';
    c.hidden = false;
    c.querySelector('#gReady').onclick = function () { pluck(587.33, 0, 0.05, 0.4); guideCover(false); };
    window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush();
    guideHud();
  }
  function guideIconSvg(kind) {
    if (kind === 'keeper') return '<svg viewBox="-24 -112 48 130" aria-hidden="true">' + lighthouseArt() + '</svg>';
    return '<svg viewBox="-30 -34 60 48" aria-hidden="true"><path d="M-26 0 H26 L18 12 H-18 Z" fill="#7a4b32"/><path d="M-2 -2 V-32 L20 -6 Z" fill="#fff6f0"/><path d="M-4 -2 V-26 L-18 -6 Z" fill="#f3dccb"/><circle cx="-14" cy="-10" r="3" fill="#ffd27a"/></svg>';
  }

  /* ---------- Heads-up display ---------- */
  function guideHud() {
    if (!guide) return;
    var el = guideEl(), G = guide.G, role = guide.cover ? (G.phase === 'keeper' ? 'keeper' : 'boat') : guideRole(), mine = guideMine() && !guide.cover;
    el.querySelector('.g-role').textContent = guide.local ? (role === 'keeper' ? 'Lighthouse keeper' : 'Boat captain') : (guide.role === 'keeper' ? 'You keep the lighthouse' : 'You sail the boat');
    el.querySelector('.g-round b').textContent = G.round + 1;
    el.querySelector('.g-lives').innerHTML = Array.apply(null, Array(Math.max(G.lives, 0))).map(function () { return '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21 C 5 15 1 11.5 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 11.5 19 15 12 21Z"/></svg>'; }).join('');
    el.querySelector('.g-lives').setAttribute('aria-label', G.lives + ' lives');
    var wind = el.querySelector('.g-wind');
    wind.hidden = !G.hard;
    if (G.hard) wind.querySelector('.g-windarrow').style.transform = 'rotate(' + (G.wind * 90) + 'deg)';
    el.querySelector('.g-flares b').textContent = G.flares;
    var msg = '', btns = '';
    if (guide.cover) msg = '';
    else if (G.ended) msg = G.ended === 'won' ? 'Home safe!' : 'Lost at sea…';
    else if (G.phase === 'keeper') {
      if (role === 'keeper' && mine && G.lampOut) { msg = 'The light went out. Rekindle it now, and it shines again next round.'; btns = '<button class="primary" id="gRekindle">Rekindle the light</button>'; }
      else if (role === 'keeper' && mine) { msg = guide.aim >= 0 ? 'Shine the light this way?' : 'Tap the sea to aim the light.'; btns = '<button class="primary" id="gShine"' + (guide.aim >= 0 ? '' : ' disabled') + '>Shine</button>'; }
      else msg = G.lampOut ? 'The light is out. The keeper is rekindling it…' : 'The keeper is aiming the light…';
    } else {
      if (role === 'boat' && mine) {
        var waves = Gd.catchable(G).length, canWait = Gd.canWait(G);
        msg = waves ? 'Tap a wave next to the boat to ride it.' : 'No waves next to the boat. Wait for the sea to change.';
        if (!canWait) msg = 'You waited last round: catch a wave this time.';
        btns = '<button id="gWait"' + (canWait ? '' : ' disabled') + '>Wait</button><button id="gFlare"' + (G.flares > 0 && !G.flareUsed ? '' : ' disabled') + '>Use a flare</button>' +
          (G.hard ? '<button id="gSail" aria-pressed="' + G.sail + '">' + (G.sail ? 'Sail up' : 'Sail down') + '</button>' : '');
      } else msg = 'The captain is sailing…';
    }
    el.querySelector('.g-msg').textContent = msg;
    var row = el.querySelector('.g-btns');
    row.innerHTML = btns;
    if (row.querySelector('#gShine')) row.querySelector('#gShine').onclick = function () { if (guide.aim >= 0) guideAct({ a: 'beam', dir: guide.aim }); };
    if (row.querySelector('#gRekindle')) row.querySelector('#gRekindle').onclick = function () { guideAct({ a: 'rekindle' }); };
    if (row.querySelector('#gWait')) row.querySelector('#gWait').onclick = function () { guideAct({ a: 'wait' }); };
    if (row.querySelector('#gFlare')) row.querySelector('#gFlare').onclick = function () { guideAct({ a: 'flare' }); };
    if (row.querySelector('#gSail')) row.querySelector('#gSail').onclick = function () { guideAct({ a: 'sail', up: !G.sail }); };
    el.querySelector('.g-peek').hidden = !guide.local;
    el.querySelector('.g-peek').setAttribute('aria-pressed', guide.peek);
    window.UnwindI18n && window.UnwindI18n.flush && window.UnwindI18n.flush();
  }

  /* ---------- Layout and the camera ---------- */
  var gctx = null, gw = 0, gh = 0, gdpr = 1;
  function guideLayout() {
    if (!guide) return;
    var cv = guideEl().querySelector('canvas'), r = cv.getBoundingClientRect();
    gdpr = Math.min(2, window.devicePixelRatio || 1); gw = r.width; gh = r.height;
    cv.width = Math.round(gw * gdpr); cv.height = Math.round(gh * gdpr);
    gctx = cv.getContext('2d');
  }
  window.addEventListener('resize', function () { if (guide) guideLayout(); });
  // The keeper sees the whole map with the lighthouse in the middle; the captain's view follows the boat.
  function guideCamera(role, boatPos) {
    var G = guide.G;
    if (role === 'keeper' || guide.peek) {
      var cs = Math.min(gw / (G.n + 0.4), gh / (G.n + 0.4));
      return { cs: cs, ox: (gw - G.n * cs) / 2, oy: (gh - G.n * cs) / 2 };
    }
    var cs2 = Math.min(gw, gh) / 6.4;
    return { cs: cs2, ox: gw / 2 - (boatPos.x + 0.5) * cs2, oy: gh / 2 - (boatPos.y + 0.5) * cs2 };
  }

  /* ---------- Drawing ---------- */
  function guideLoop() {
    guide && (guide.loop = true);
    requestAnimationFrame(function step(now) {
      if (!guide) return;
      requestAnimationFrame(step);
      if (!gctx) guideLayout();
      guideDraw(now);
    });
  }
  // The boat glides along its whole path in one smooth motion (two tiles with the wind are one move, not two).
  // Over a whirlpool it flips around its own horizontal axis.
  function animBoat(now) {
    var G = guide.G, a = guide.anim;
    if (!a || !a.log.path) return { x: G.boat.x, y: G.boat.y, alpha: 1 };
    var t = now - a.t0, path = a.log.path, segs = path.length - 1;
    if (segs < 1) return { x: G.boat.x, y: G.boat.y, alpha: 1 };
    var moveDur = segs * 230;
    if (t >= a.boatDur) return { x: G.boat.x, y: G.boat.y, alpha: 1 };
    if (t < moveDur) {
      var u = t / moveDur, e = u * u * (3 - 2 * u), f = e * segs, k = Math.min(segs - 1, Math.floor(f)), v = f - k;
      var p = path[k], q = path[k + 1], off = a.log.washBack && k === segs - 1;
      var w = a.log.whirls.filter(function (z) { return z.x === p[0] && z.y === p[1]; })[0];
      return { x: p[0] + (q[0] - p[0]) * v, y: p[1] + (q[1] - p[1]) * v, alpha: off ? 1 - v * 0.8 : 1, flip: w ? v : 0 };
    }
    // Washed back after drifting off the edge.
    var wb = Math.min(1, (t - moveDur) / 520);
    return { x: a.log.washBack[0], y: a.log.washBack[1], alpha: wb };
  }
  function animSerpent(now, s) {
    var a = guide.anim;
    if (!a) return { x: s.x, y: s.y };
    var t = now - a.t0 - a.boatDur;
    var m = a.log.serpents.filter(function (q) { return q.id === s.id; })[0];
    var dive = a.log.dives.filter(function (q) { return q.id === s.id; })[0];
    if (t < 0) {
      var b = a.before.serpents[guide.G.serpents.indexOf(s)];
      return b ? { x: b.x, y: b.y } : { x: s.x, y: s.y };
    }
    if (m && t < a.snakeDur && m.path.length > 1) {
      var segs = m.path.length - 1, f = Math.min(0.999, t / a.snakeDur) * segs, k = Math.floor(f), u = f - k;
      return { x: m.path[k][0] + (m.path[k + 1][0] - m.path[k][0]) * u, y: m.path[k][1] + (m.path[k + 1][1] - m.path[k][1]) * u };
    }
    if (dive && t < a.snakeDur + 300) { var last = m ? m.path[m.path.length - 1] : dive.from; return { x: last[0], y: last[1], diving: true }; }
    return { x: s.x, y: s.y };
  }
  function guideDraw(now) {
    var G = guide.G, ctx2 = gctx, role = guideRole();
    if (!ctx2) return;
    ctx2.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    ctx2.fillStyle = '#060a1c'; ctx2.fillRect(0, 0, gw, gh);
    if (guide.cover) { guideDrawCoverSea(ctx2, now); return; }
    var boatPos = animBoat(now), cam = guideCamera(role, boatPos), cs = cam.cs;
    // What this player can see right now, and what they remember.
    var see = {}, mem = role === 'keeper' ? G.keeperSeen : G.boatSeen, showBoat = false, lightVisible = false;
    if (guide.peek) { for (var i = 0; i < G.n * G.n; i++) see[i] = 1; showBoat = true; lightVisible = true; }
    else if (role === 'keeper') { var kv = Gd.keeperView(G); see = kv.cells; showBoat = kv.boat; lightVisible = true; }
    else { var bv = Gd.boatView(G); see = bv.cells; showBoat = true; lightVisible = bv.touched; }
    var X = function (x) { return cam.ox + x * cs; }, Y = function (y) { return cam.oy + y * cs; };
    var x0 = Math.max(-1, Math.floor(-cam.ox / cs) - 1), x1 = Math.min(G.n, Math.ceil((gw - cam.ox) / cs) + 1);
    var y0 = Math.max(-1, Math.floor(-cam.oy / cs) - 1), y1 = Math.min(G.n, Math.ceil((gh - cam.oy) / cs) + 1);
    // The sea, tile by tile: lit and seen tiles are bright, remembered ones dim, the rest dark fog.
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var px = X(x), py = Y(y);
      if (!Gd.inside(G, x, y)) continue;
      var idx = y * G.n + x, vis = !!see[idx], rem = !!mem[idx];
      ctx2.fillStyle = vis ? (Gd.isLit(G, x, y) ? '#2b3c74' : '#1f2d5e') : rem ? '#141e44' : role === 'keeper' ? '#0f1838' : '#0a1029';
      ctx2.fillRect(px, py, cs + 0.5, cs + 0.5);
      if (vis || rem) guideTerrain(ctx2, G, x, y, px, py, cs, now, vis ? 1 : 0.35);
    }
    // The edge of the map, where the captain can see it.
    ctx2.save(); ctx2.strokeStyle = 'rgba(255,214,140,.55)'; ctx2.lineWidth = Math.max(2, cs * 0.05); ctx2.setLineDash([cs * 0.18, cs * 0.14]);
    for (y = 0; y < G.n; y++) for (x = 0; x < G.n; x++) {
      var id2 = y * G.n + x;
      if (!see[id2]) continue;
      if (x === 0) { ctx2.beginPath(); ctx2.moveTo(X(0), Y(y)); ctx2.lineTo(X(0), Y(y + 1)); ctx2.stroke(); }
      if (y === 0) { ctx2.beginPath(); ctx2.moveTo(X(x), Y(0)); ctx2.lineTo(X(x + 1), Y(0)); ctx2.stroke(); }
      if (x === G.n - 1) { ctx2.beginPath(); ctx2.moveTo(X(G.n), Y(y)); ctx2.lineTo(X(G.n), Y(y + 1)); ctx2.stroke(); }
      if (y === G.n - 1) { ctx2.beginPath(); ctx2.moveTo(X(x), Y(G.n)); ctx2.lineTo(X(x + 1), Y(G.n)); ctx2.stroke(); }
    }
    ctx2.restore();
    // Waves, barrels and serpents only show where the player can see right now.
    for (y = Math.max(0, y0); y <= Math.min(G.n - 1, y1); y++) for (x = Math.max(0, x0); x <= Math.min(G.n - 1, x1); x++) {
      var i3 = y * G.n + x;
      if (!see[i3]) continue;
      var bi = Gd.barrelAt(G, x, y);
      if (bi >= 0) guideBarrel(ctx2, X(x) + cs / 2, Y(y) + cs / 2, cs, now);
      var wv = G.waves[i3];
      if (wv >= 0 && !(guide.anim && now - guide.anim.t0 < guide.anim.boatDur)) guideWave(ctx2, X(x), Y(y), cs, wv, now, x * 7 + y * 13);
    }
    // The beam: from the lamp, across the whole map.
    var beamOn = G.beam >= 0 && lightVisible;
    var aimDir = role === 'keeper' && G.phase === 'keeper' && guideMine() && guide.aim >= 0 ? guide.aim : -1;
    var lampX = X(G.c) + cs / 2, lampY = Y(G.c) + cs / 2 - cs * 0.62;
    var mapClip = [X(0), Y(0), G.n * cs, G.n * cs];
    if (beamOn) guideBeam(ctx2, X(G.c) + cs / 2, Y(G.c) + cs / 2, G.beam, cs, G.n, Math.min(1, (now - guide.beamAt) / 350), false, mapClip);
    if (aimDir >= 0) guideBeam(ctx2, X(G.c) + cs / 2, Y(G.c) + cs / 2, aimDir, cs, G.n, 1, true, mapClip);
    // Lit tiles get a warm glow.
    if (beamOn) {
      ctx2.fillStyle = 'rgba(255,214,130,' + (0.12 * Math.min(1, (now - guide.beamAt) / 350)) + ')';
      G.lit.forEach(function (k) { var lx = k % G.n, ly = (k - lx) / G.n; if (see[k]) ctx2.fillRect(X(lx), Y(ly), cs + 0.5, cs + 0.5); });
    }
    // Serpents: surfaced in the dark, but those caught in the light have dived, and only bubbles show.
    G.serpents.forEach(function (s) {
      var p = animSerpent(now, s), cx = Math.round(p.x), cy = Math.round(p.y);
      if (!Gd.inside(G, cx, cy) || !see[cy * G.n + cx]) return;
      if (s.frozen && !(guide.anim && now - guide.anim.t0 < guide.anim.boatDur + guide.anim.snakeDur)) guideBubbles(ctx2, X(p.x) + cs / 2, Y(p.y) + cs / 2, cs, now, s.id);
      else guideSerpent(ctx2, X(p.x) + cs / 2, Y(p.y) + cs / 2, cs, now, s.id, p.diving ? 0.4 : 1);
    });
    // The lighthouse in the middle: always for the keeper, for the captain only when they can see it.
    var lhSeen = role === 'keeper' || guide.peek || lightVisible || see[G.c * G.n + G.c];
    if (lhSeen) {
      var img = lighthouseImage(), lk = cs * 1.15 / 85;
      if (img.complete && img.naturalWidth) ctx2.drawImage(img, X(G.c) + cs / 2 - 20 * lk, Y(G.c) + cs * 0.85 - 110 * lk, 40 * lk, 126 * lk);
      var on = role !== 'keeper' || Gd.lampWorks(G) || G.beam >= 0;
      var gl = ctx2.createRadialGradient(lampX, lampY, 0, lampX, lampY, cs * 0.55);
      gl.addColorStop(0, on ? 'rgba(255,233,168,.75)' : 'rgba(255,233,168,.12)'); gl.addColorStop(1, 'rgba(255,233,168,0)');
      ctx2.fillStyle = gl; ctx2.beginPath(); ctx2.arc(lampX, lampY, cs * 0.55, 0, 7); ctx2.fill();
    }
    // The boat.
    if (showBoat || (guide.anim && now - guide.anim.t0 < guide.anim.boatDur && role === 'keeper' && Gd.isLit(G, G.boat.x, G.boat.y))) {
      guideBoat(ctx2, X(boatPos.x) + cs / 2, Y(boatPos.y) + cs / 2, cs, now, G.hard ? G.sail : true, boatPos.alpha, boatPos.flip || 0);
      if (role === 'boat' && !guide.peek) {
        // The captain's lantern: a soft glow around the boat, bigger with a flare.
        var R = cs * (G.flare ? 2.6 : 1.7), lg = ctx2.createRadialGradient(X(boatPos.x) + cs / 2, Y(boatPos.y) + cs / 2, cs * 0.3, X(boatPos.x) + cs / 2, Y(boatPos.y) + cs / 2, R);
        lg.addColorStop(0, 'rgba(255,214,140,.16)'); lg.addColorStop(1, 'rgba(255,214,140,0)');
        ctx2.fillStyle = lg; ctx2.beginPath(); ctx2.arc(X(boatPos.x) + cs / 2, Y(boatPos.y) + cs / 2, R, 0, 7); ctx2.fill();
      }
    }
    // Waves the captain can catch: rings, and a mark where each would take the boat.
    if (role === 'boat' && G.phase === 'boat' && guideMine() && !guide.cover && !(guide.anim && now < guide.busyUntil)) {
      Gd.catchable(G).forEach(function (w) {
        var pulse = 0.55 + 0.25 * Math.sin(now / 260);
        ctx2.strokeStyle = 'rgba(255,233,168,' + pulse + ')'; ctx2.lineWidth = Math.max(2, cs * 0.05);
        ctx2.beginPath(); ctx2.arc(X(w.x) + cs / 2, Y(w.y) + cs / 2, cs * 0.42, 0, 7); ctx2.stroke();
        // Where this wave would take the boat: a dashed outline on that tile, or a cross when the wind holds it back.
        var steps = Gd.stepsFor(G, w.dir), tx = G.boat.x + Gd.DX[w.dir] * steps, ty = G.boat.y + Gd.DY[w.dir] * steps;
        ctx2.save(); ctx2.strokeStyle = 'rgba(255,233,168,.6)'; ctx2.lineWidth = Math.max(1.5, cs * 0.035);
        // Off the edge of the map the mark turns red: that move costs a life.
        if (steps > 0) { var offMap = !Gd.inside(G, tx, ty) || !Gd.inside(G, G.boat.x + Gd.DX[w.dir], G.boat.y + Gd.DY[w.dir]); if (offMap) ctx2.strokeStyle = 'rgba(255,120,140,.8)'; ctx2.setLineDash([cs * 0.1, cs * 0.08]); ctx2.strokeRect(X(tx) + cs * 0.12, Y(ty) + cs * 0.12, cs * 0.76, cs * 0.76); }
        else { var mx2 = X(G.boat.x) + cs / 2 + Gd.DX[w.dir] * cs * 0.42, my2 = Y(G.boat.y) + cs / 2 + Gd.DY[w.dir] * cs * 0.42, z = cs * 0.08; ctx2.beginPath(); ctx2.moveTo(mx2 - z, my2 - z); ctx2.lineTo(mx2 + z, my2 + z); ctx2.moveTo(mx2 + z, my2 - z); ctx2.lineTo(mx2 - z, my2 + z); ctx2.stroke(); }
        ctx2.restore();
      });
    }
    // Fog over everything the player cannot see, soft at the edges.
    if (!guide.peek) {
      ctx2.save(); ctx2.fillStyle = 'rgba(3,5,15,.94)'; ctx2.beginPath(); ctx2.rect(0, 0, gw, gh); ctx2.rect(X(0), Y(0), G.n * cs, G.n * cs); ctx2.fill('evenodd'); ctx2.restore();
      for (y = Math.max(0, y0); y <= Math.min(G.n - 1, y1); y++) for (x = Math.max(0, x0); x <= Math.min(G.n - 1, x1); x++) {
        var i4 = y * G.n + x;
        if (see[i4]) continue;
        ctx2.fillStyle = mem[i4] ? 'rgba(6,9,24,.5)' : role === 'keeper' ? 'rgba(6,9,24,.62)' : 'rgba(6,9,24,.86)';
        ctx2.fillRect(X(x), Y(y), cs + 0.5, cs + 0.5);
      }
      // The keeper knows the map: a faint grid and its outline show through the fog.
      if (role === 'keeper') {
        ctx2.strokeStyle = 'rgba(160,180,255,.07)'; ctx2.lineWidth = 1;
        for (var gl2 = 1; gl2 < G.n; gl2++) { ctx2.beginPath(); ctx2.moveTo(X(gl2), Y(0)); ctx2.lineTo(X(gl2), Y(G.n)); ctx2.moveTo(X(0), Y(gl2)); ctx2.lineTo(X(G.n), Y(gl2)); ctx2.stroke(); }
        ctx2.strokeStyle = 'rgba(255,214,140,.35)'; ctx2.lineWidth = 2; ctx2.strokeRect(X(0), Y(0), G.n * cs, G.n * cs);
      }
      guideFogWisps(ctx2, now, cam, G);
    }
    // Floating "+1 life" notes.
    (guide.floats || []).forEach(function (f) {
      var t = (now - f.t0) / 1300;
      if (t > 1) return;
      ctx2.globalAlpha = 1 - t; ctx2.fillStyle = f.bad ? '#ff8a9a' : '#ffe9a8'; ctx2.font = '700 ' + Math.round(cs * 0.3) + 'px ' + getComputedStyle(document.body).getPropertyValue('--display');
      ctx2.textAlign = 'center'; ctx2.fillText(window.UnwindI18n ? window.UnwindI18n.t(f.text) : f.text, X(f.x) + cs / 2, Y(f.y) - t * cs * 0.6);
      ctx2.globalAlpha = 1;
    });
    guide.floats = (guide.floats || []).filter(function (f) { return now - f.t0 < 1300; });
  }
  function guideDrawCoverSea(c, now) {
    for (var i = 0; i < 40; i++) { var x = (i * 97 % 100) / 100 * gw, y = (i * 61 % 100) / 100 * gh; c.fillStyle = 'rgba(200,214,255,' + (0.15 + 0.15 * Math.sin(now / 900 + i)) + ')'; c.fillRect(x, y, 2, 2); }
  }
  // Slow drifting mist over the sea.
  function guideFogWisps(c, now, cam, G) {
    if (reduced) return;
    c.save(); c.beginPath(); c.rect(cam.ox, cam.oy, G.n * cam.cs, G.n * cam.cs); c.clip();
    for (var i = 0; i < 7; i++) {
      var span = gw + 500, x = ((now / (70 + i * 11) + i * 230) % span) - 250, y = (i + 0.5) / 7 * gh + Math.sin(now / 3000 + i) * 20;
      var g = c.createRadialGradient(x, y, 0, x, y, 170);
      g.addColorStop(0, 'rgba(200,212,255,.05)'); g.addColorStop(1, 'rgba(200,212,255,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 170, 40, 0, 0, 7); c.fill();
    }
    c.restore();
  }
  function guideTerrain(c, G, x, y, px, py, cs, now, alpha) {
    var t = G.grid[y * G.n + x], cx = px + cs / 2, cy = py + cs / 2;
    c.save(); c.globalAlpha = alpha;
    if (t === Gd.ROCK) {
      // A low cluster of weathered stones with a ring of foam where the sea meets them.
      var seedR = (x * 7 + y * 13) % 5;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(cx, cy + cs * 0.2, cs * 0.4, cs * 0.12, 0, 0, 7); c.fill();
      [[-0.14, 0.06, 0.2, 0.17], [0.13, 0.08, 0.17, 0.14], [0.0, -0.06, 0.22, 0.2]].forEach(function (st, i) {
        if (i === 1 && seedR > 3) return;
        var sx = cx + cs * st[0], sy = cy + cs * st[1], rx = cs * st[2], ry = cs * st[3];
        var g = c.createLinearGradient(sx - rx, sy - ry, sx + rx * 0.4, sy + ry);
        g.addColorStop(0, '#8a8798'); g.addColorStop(0.55, '#5c5a6e'); g.addColorStop(1, '#383748');
        c.fillStyle = g; c.beginPath();
        c.moveTo(sx - rx, sy + ry * 0.55);
        c.quadraticCurveTo(sx - rx * 1.05, sy - ry * 0.5, sx - rx * 0.3, sy - ry);
        c.quadraticCurveTo(sx + rx * 0.5, sy - ry * 1.15, sx + rx, sy - ry * 0.1);
        c.quadraticCurveTo(sx + rx * 1.05, sy + ry * 0.6, sx + rx * 0.6, sy + ry * 0.75);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = Math.max(1, cs * 0.025); c.beginPath(); c.moveTo(sx - rx * 0.55, sy - ry * 0.55); c.quadraticCurveTo(sx - rx * 0.1, sy - ry * 0.95, sx + rx * 0.45, sy - ry * 0.6); c.stroke();
        c.strokeStyle = 'rgba(20,18,30,.35)'; c.beginPath(); c.moveTo(sx - rx * 0.1, sy - ry * 0.2); c.lineTo(sx + rx * 0.25, sy + ry * 0.3); c.stroke();
      });
      c.strokeStyle = 'rgba(225,235,255,.55)'; c.lineWidth = Math.max(1.2, cs * 0.03);
      var fw = reduced ? 0 : Math.sin(now / 700 + x + y) * cs * 0.015;
      c.beginPath(); c.ellipse(cx, cy + cs * 0.2, cs * 0.4 + fw, cs * 0.1, 0, 0.1, Math.PI - 0.1); c.stroke();
      c.fillStyle = 'rgba(225,235,255,.55)'; [[-0.36, 0.22], [0.33, 0.25], [0.05, 0.31]].forEach(function (d) { c.beginPath(); c.arc(cx + cs * d[0], cy + cs * d[1], cs * 0.018, 0, 7); c.fill(); });
    } else if (t === Gd.BIG) {
      // A tall sea stack with layered cliffs: it hides what is behind it from the light and from the boat.
      c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(cx, cy + cs * 0.36, cs * 0.46, cs * 0.12, 0, 0, 7); c.fill();
      var gb = c.createLinearGradient(cx - cs * 0.4, 0, cx + cs * 0.4, 0);
      gb.addColorStop(0, '#6f6a80'); gb.addColorStop(0.5, '#4b4760'); gb.addColorStop(1, '#2e2b3e');
      c.fillStyle = gb; c.beginPath();
      c.moveTo(cx - cs * 0.42, cy + cs * 0.36); c.lineTo(cx - cs * 0.34, cy - cs * 0.12); c.lineTo(cx - cs * 0.26, cy - cs * 0.42);
      c.lineTo(cx - cs * 0.06, cy - cs * 0.58); c.lineTo(cx + cs * 0.14, cy - cs * 0.5); c.lineTo(cx + cs * 0.3, cy - cs * 0.22); c.lineTo(cx + cs * 0.42, cy + cs * 0.36); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(20,18,30,.45)'; c.lineWidth = Math.max(1, cs * 0.025);
      [-0.3, -0.08, 0.14].forEach(function (k, i) { c.beginPath(); c.moveTo(cx - cs * (0.36 - i * 0.03), cy + cs * k); c.lineTo(cx + cs * (0.33 - i * 0.04), cy + cs * (k + 0.05)); c.stroke(); });
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(cx - cs * 0.26, cy - cs * 0.42); c.lineTo(cx - cs * 0.06, cy - cs * 0.58); c.lineTo(cx - cs * 0.12, cy - cs * 0.2); c.lineTo(cx - cs * 0.3, cy - cs * 0.05); c.closePath(); c.fill();
      c.fillStyle = '#4e7a5a'; c.beginPath(); c.ellipse(cx - cs * 0.04, cy - cs * 0.55, cs * 0.12, cs * 0.04, -0.3, 0, 7); c.fill();
      c.strokeStyle = 'rgba(225,235,255,.6)'; c.lineWidth = Math.max(1.2, cs * 0.03); c.beginPath(); c.ellipse(cx, cy + cs * 0.36, cs * 0.46, cs * 0.1, 0, 0.15, Math.PI - 0.15); c.stroke();
    } else if (t === Gd.WHIRL) {
      c.strokeStyle = 'rgba(190,210,255,.75)'; c.lineWidth = Math.max(1.5, cs * 0.045); c.lineCap = 'round';
      var rot = reduced ? 0 : now / 500;
      for (var k = 0; k < 3; k++) {
        c.beginPath();
        for (var a = 0; a <= 5.2; a += 0.25) { var r = cs * (0.06 + a * 0.065), ang = a + rot + k * 2.1; var qx = cx + Math.cos(ang) * r, qy = cy + Math.sin(ang) * r * 0.62; if (a === 0) c.moveTo(qx, qy); else c.lineTo(qx, qy); }
        c.stroke();
      }
    }
    c.restore();
  }
  function guideWave(c, px, py, cs, dir, now, seed) {
    var cx = px + cs / 2, cy = py + cs / 2, bob = reduced ? 0 : Math.sin(now / 420 + seed) * cs * 0.03;
    c.save(); c.translate(cx, cy + bob); c.rotate(dir * Math.PI / 2);
    c.strokeStyle = 'rgba(214,226,255,.85)'; c.lineWidth = Math.max(1.6, cs * 0.06); c.lineCap = 'round'; c.lineJoin = 'round';
    // A curling wave with an arrowhead: which way it will carry the boat.
    c.beginPath(); c.moveTo(0, cs * 0.26); c.bezierCurveTo(-cs * 0.12, cs * 0.12, cs * 0.12, -cs * 0.02, 0, -cs * 0.18); c.stroke();
    c.beginPath(); c.moveTo(-cs * 0.11, -cs * 0.08); c.lineTo(0, -cs * 0.22); c.lineTo(cs * 0.11, -cs * 0.08); c.stroke();
    c.restore();
  }
  function guideBarrel(c, cx, cy, cs, now) {
    var bob = reduced ? 0 : Math.sin(now / 500 + cx) * cs * 0.03, w = cs * 0.34, h = cs * 0.42;
    c.save(); c.translate(cx, cy + bob); c.rotate(-0.12);
    c.fillStyle = '#8a5a36'; c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); c.fill();
    c.fillStyle = '#a8703f'; c.fillRect(-w * 0.32, -h * 0.5, w * 0.64, h);
    c.strokeStyle = '#3a2a20'; c.lineWidth = Math.max(1.2, cs * 0.035);
    [-0.28, 0.28].forEach(function (k) { c.beginPath(); c.moveTo(-w * 0.42, h * k); c.lineTo(w * 0.42, h * k); c.stroke(); });
    c.fillStyle = 'rgba(255,233,168,.9)'; c.beginPath(); c.arc(0, 0, cs * 0.04, 0, 7); c.fill();
    c.restore();
  }
  function guideSerpent(c, cx, cy, cs, now, id, alpha) {
    var t = reduced ? 0 : now / 380 + id * 2;
    c.save(); c.globalAlpha = alpha; c.translate(cx, cy);
    c.fillStyle = '#2f8a6a';
    // Two humps and a head above the water, with a ripple around them.
    [[-0.28, 0.1, 0.12], [-0.05, 0.06, 0.15]].forEach(function (hmp, i) { c.beginPath(); c.ellipse(cs * hmp[0], cs * hmp[1] - Math.abs(Math.sin(t + i)) * cs * 0.04, cs * hmp[2], cs * hmp[2] * 0.8, 0, Math.PI, 0); c.fill(); });
    c.beginPath(); c.moveTo(cs * 0.12, cs * 0.1); c.quadraticCurveTo(cs * 0.16, -cs * 0.22, cs * 0.3, -cs * 0.2); c.quadraticCurveTo(cs * 0.4, -cs * 0.12, cs * 0.3, -cs * 0.06); c.quadraticCurveTo(cs * 0.24, -cs * 0.02, cs * 0.24, cs * 0.1); c.closePath(); c.fill();
    c.fillStyle = '#fff6f0'; c.beginPath(); c.arc(cs * 0.3, -cs * 0.15, cs * 0.035, 0, 7); c.fill();
    c.fillStyle = '#10202a'; c.beginPath(); c.arc(cs * 0.31, -cs * 0.15, cs * 0.018, 0, 7); c.fill();
    c.strokeStyle = 'rgba(200,220,255,.5)'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(0, cs * 0.12, cs * 0.42, cs * 0.08, 0, 0, 7); c.stroke();
    c.restore();
  }
  // A serpent caught in the light has dived: only its bubbles rise.
  function guideBubbles(c, cx, cy, cs, now, id) {
    c.save();
    for (var i = 0; i < 6; i++) {
      var period = 1500, t = reduced ? 0.5 : ((now + i * 260 + id * 400) % period) / period;
      var x = cx + Math.sin(i * 2.3 + id) * cs * 0.2 + Math.sin(t * 6 + i) * cs * 0.03, y = cy + cs * 0.18 - t * cs * 0.4;
      c.globalAlpha = 0.85 * (1 - t); c.strokeStyle = '#d6e2ff'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(x, y, cs * (0.03 + 0.03 * (i % 3)), 0, 7); c.stroke();
    }
    c.globalAlpha = 0.5; c.strokeStyle = 'rgba(200,220,255,.6)'; c.beginPath(); c.ellipse(cx, cy + cs * 0.2, cs * 0.3, cs * 0.06, 0, 0, 7); c.stroke();
    c.restore();
  }
  function guideBoat(c, cx, cy, cs, now, sailUp, alpha, flip) {
    var rock = reduced ? 0 : Math.sin(now / 600) * 0.06;
    c.save(); c.globalAlpha = alpha; c.translate(cx, cy + cs * 0.08); c.rotate(rock);
    // Caught in a whirlpool, the boat flips over twice around its horizontal axis, and comes back upright.
    if (flip) { var fy = Math.cos(flip * Math.PI * 4); c.translate(0, -cs * 0.12); c.scale(1, Math.abs(fy) < 0.08 ? (fy < 0 ? -0.08 : 0.08) : fy); c.translate(0, cs * 0.12); }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, cs * 0.2, cs * 0.36, cs * 0.07, 0, 0, 7); c.fill();
    c.fillStyle = '#7a4b32'; c.beginPath(); c.moveTo(-cs * 0.36, 0); c.lineTo(cs * 0.36, 0); c.lineTo(cs * 0.24, cs * 0.17); c.lineTo(-cs * 0.24, cs * 0.17); c.closePath(); c.fill();
    c.fillStyle = '#9a6644'; c.fillRect(-cs * 0.36, -cs * 0.02, cs * 0.72, cs * 0.05);
    c.strokeStyle = '#3a2a20'; c.lineWidth = Math.max(1.5, cs * 0.03); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -cs * 0.44); c.stroke();
    // With the sail down only the bare mast is left.
    if (sailUp) { c.fillStyle = '#fff6f0'; c.beginPath(); c.moveTo(cs * 0.02, -cs * 0.42); c.lineTo(cs * 0.26, -cs * 0.06); c.lineTo(cs * 0.02, -cs * 0.06); c.closePath(); c.fill(); c.fillStyle = '#f3dccb'; c.beginPath(); c.moveTo(-cs * 0.02, -cs * 0.36); c.lineTo(-cs * 0.18, -cs * 0.06); c.lineTo(-cs * 0.02, -cs * 0.06); c.closePath(); c.fill(); }
    c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(-cs * 0.22, -cs * 0.08, cs * 0.045, 0, 7); c.fill();
    c.restore();
  }
  function guideBeam(c, cx, cy, dir, cs, n, k, ghost, clip) {
    var a = dir * 2 * Math.PI / Gd.BEAM_STEPS - Math.PI / 2, len = cs * n * 1.5, half = 15 * Math.PI / 180;
    var g = c.createRadialGradient(cx, cy - cs * 0.62, 0, cx, cy - cs * 0.62, len);
    g.addColorStop(0, ghost ? 'rgba(255,214,130,.24)' : 'rgba(255,214,130,' + (0.5 * k) + ')'); g.addColorStop(0.6, ghost ? 'rgba(255,214,130,.1)' : 'rgba(255,214,130,' + (0.18 * k) + ')'); g.addColorStop(1, 'rgba(255,214,130,0)');
    c.save();
    if (clip) { c.beginPath(); c.rect(clip[0], clip[1], clip[2], clip[3]); c.clip(); }
    c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy - cs * 0.62);
    c.lineTo(cx + Math.cos(a - half) * len, cy + Math.sin(a - half) * len); c.lineTo(cx + Math.cos(a + half) * len, cy + Math.sin(a + half) * len); c.closePath(); c.fill();
    if (ghost) { c.setLineDash([cs * 0.15, cs * 0.12]); c.strokeStyle = 'rgba(255,233,168,.45)'; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
  }

  /* ---------- Input ---------- */
  function guidePointer(ev) {
    if (!guide || guide.cover || !guideMine()) return;
    var G = guide.G, role = guideRole(), r = ev.currentTarget.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    var cam = guideCamera(role, { x: G.boat.x, y: G.boat.y }), cs = cam.cs;
    if (role === 'keeper' && G.phase === 'keeper') {
      // Aim from the lighthouse towards the tap, snapped to one of 16 directions.
      var lx = cam.ox + (G.c + 0.5) * cs, ly = cam.oy + (G.c + 0.5) * cs, dx = mx - lx, dy = my - ly;
      if (Math.hypot(dx, dy) < cs * 0.4) return;
      var ang = Math.atan2(dx, -dy); if (ang < 0) ang += Math.PI * 2;
      var d = Math.round(ang / (2 * Math.PI) * Gd.BEAM_STEPS) % Gd.BEAM_STEPS;
      if (d !== guide.aim) pluck(523.25 + d * 12, 0, 0.03, 0.3);
      guide.aim = d; guideHud();
      return;
    }
    if (role === 'boat' && G.phase === 'boat') {
      var x = Math.floor((mx - cam.ox) / cs), y = Math.floor((my - cam.oy) / cs);
      var w = Gd.catchable(G).filter(function (q) { return q.x === x && q.y === y; })[0];
      if (w) guideAct({ a: 'move', x: x, y: y });
    }
  }
  function guideKey(ev) {
    if (!guide || guide.cover || $('sheetHost').firstChild) return;
    var G = guide.G, role = guideRole();
    if (!guideMine()) return;
    if (role === 'keeper' && G.phase === 'keeper') {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { guide.aim = ((guide.aim < 0 ? 0 : guide.aim) + (ev.key === 'ArrowLeft' ? -1 : 1) + Gd.BEAM_STEPS) % Gd.BEAM_STEPS; guideHud(); ev.preventDefault(); }
      else if (ev.key === 'Enter' && guide.aim >= 0) guideAct({ a: 'beam', dir: guide.aim });
    } else if (role === 'boat' && G.phase === 'boat') {
      var want = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[ev.key];
      if (want !== undefined) {
        var w = Gd.catchable(G).filter(function (q) { return q.dir === want; })[0];
        if (w) guideAct({ a: 'move', x: w.x, y: w.y });
        ev.preventDefault();
      } else if (ev.key === ' ') { guideAct({ a: 'wait' }); ev.preventDefault(); }
    }
  }
  document.addEventListener('keydown', guideKey);

  /* ---------- End of a game ---------- */
  function guideEnd() {
    var G = guide.G, won = G.ended === 'won';
    if (won) { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { pluck(f, i * 0.12, 0.07, 1.6); }); }
    else { pluck(220, 0, 0.08, 1.2); pluck(174.6, 0.2, 0.07, 1.4); }
    track('guide_end', { result: G.ended, rounds: G.round, size: G.size, hard: G.hard });
    var s = sheet('<div class="g-end">' + (won ? guideIconSvg('keeper') : '') +
      '<h2>' + (won ? 'Home safe!' : 'Lost at sea') + '</h2>' +
      '<p>' + (won ? 'The boat reached the lighthouse.' : 'The boat ran out of lives in the dark.') + '</p>' +
      '<div class="lsum"><span>Rounds<b class="notr">' + (G.round + 1) + '</b></span><span>Lives left<b class="notr">' + Math.max(0, G.lives) + '</b></span><span>Map<b>' + Gd.SIZE_NAMES[G.size] + (G.hard ? ' · Hard' : '') + '</b></span></div>' +
      (guide.online ? '<button class="primary" id="again">Play again</button><button class="secondary" id="gLobby">Back to the room</button>' :
        '<button class="primary" id="gNew">New map</button><button class="secondary" id="gMenu">Back to the menu</button>') + '</div>', 'start');
    if (s.querySelector('#gNew')) s.querySelector('#gNew').onclick = function () { closeSheet(); var o = Object.assign({}, guide.opts, { seed: 1 + Math.floor(Math.random() * 1e9) }); openGuide(o); };
    if (s.querySelector('#gMenu')) s.querySelector('#gMenu').onclick = function () { closeSheet(); closeGuide(); guideMenu(); };
    if (s.querySelector('#again')) s.querySelector('#again').onclick = function () { netSend({ t: 'again' }); this.disabled = true; this.textContent = 'Waiting for your partner…'; };
    if (s.querySelector('#gLobby')) s.querySelector('#gLobby').onclick = function () { netSend({ t: 'lobby' }); closeSheet(); closeGuide(); };
  }
  function guideLeave() {
    var s = sheet('<h2>Leave this game?</h2><p>' + (guide.online ? 'Your partner will be left alone at sea.' : 'This map will be lost.') + '</p><button class="primary" id="gStay">Keep playing</button><button class="secondary" id="gGo">Leave</button>', 'start');
    s.querySelector('#gStay').onclick = closeSheet;
    s.querySelector('#gGo').onclick = function () { closeSheet(); var online = guide.online; closeGuide(); if (online) { netSend({ t: 'leave' }); netClose(); onlineSheet('home'); } else guideMenu(); };
  }

  /* ---------- Menu ---------- */
  function guideMenu() {
    var o = load('unwind.guideOpts', { size: 1, hard: false });
    var seg = function (key, opts, cls) { return '<div class="sizes lseg ' + (cls || '') + '" role="group">' + opts.map(function (v) { return '<button data-g="' + key + '" data-v="' + v[0] + '" aria-pressed="' + (String(o[key]) === String(v[0])) + '">' + v[1] + '</button>'; }).join('') + '</div>'; };
    var html = '<div class="row" id="gMenuCard"><h2>Guiding Light</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
      '<p class="note">A game for two. One of you keeps the lighthouse, the other sails a little boat home through a dark, foggy sea. The keeper\'s beam is the only light out there.</p>' +
      '<div class="setting"><span>Map size<small>A new map is made every game</small></span></div>' + seg('size', [[0, 'Small'], [1, 'Medium'], [2, 'Large']], 'o3') +
      '<div class="setting"><span>Difficulty<small>' + (o.hard ? 'Tall rocks, wind and sail, a faulty lamp and faster serpents' : 'Rocks, whirlpools, barrels and serpents') + '</small></span></div>' + seg('hard', [[false, 'Normal'], [true, 'Hard']]) +
      '<button class="obig" id="gOnline"><b>Play online</b><span>Each of you on your own phone. Host a room and send your partner the code.</span></button>' +
      '<button class="obig" id="gLocal"><b>Play on one device</b><span>Pass the phone between turns. No peeking!</span></button>' +
      '<div class="chapter">How to play</div><div class="modes"><button id="gTutKeeper"><b>The keeper</b><span>Shine the light, find the boat, hold back the serpents.</span></button><button id="gTutBoat"><b>The captain</b><span>Catch waves, dodge danger, sail home.</span></button>' +
      (o.hard ? '<button id="gTutHard"><b>Hard mode</b><span>Tall rocks, wind and sail, the faulty lamp.</span></button>' : '') + '</div>';
    // Changing a setting swaps the menu's contents only, so it never fades out and back in.
    var s = $('gMenuCard') ? sheetInPlace(html) : sheet(html, 'tall lobby');
    s.querySelector('#x').onclick = closeSheet;
    s.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-g'), v = b.getAttribute('data-v'); o[k] = k === 'size' ? +v : v === 'true'; save('unwind.guideOpts', o); guideMenu(); }; });
    s.querySelector('#gLocal').onclick = function () { openGuide({ seed: 1 + Math.floor(Math.random() * 1e9), size: o.size, hard: o.hard, local: true }); };
    s.querySelector('#gOnline').onclick = function () { saveGuideHost(o); lobby = null; hostOnline(this, { mode: 'guide', gsize: o.size, ghard: o.hard }); };
    s.querySelector('#gTutKeeper').onclick = function () { guideTutorial('keeper', o.hard, guideMenu); };
    s.querySelector('#gTutBoat').onclick = function () { guideTutorial('boat', o.hard, guideMenu); };
    if (s.querySelector('#gTutHard')) s.querySelector('#gTutHard').onclick = function () { guideTutorial('hard', true, guideMenu); };
  }
  function saveGuideHost(o) { save('unwind.guideOpts', o); }

  /* ---------- Tutorials: short pages, each with a small moving picture drawn by the game itself ---------- */
  var GUIDE_TUT = {
    keeper: [
      { t: 'You keep the lighthouse', p: 'The sea is dark and foggy. Your partner\'s boat is somewhere out there, and you cannot see it. Your job is to light the way so the boat can reach the lighthouse in the middle.', scene: 'intro' },
      { t: 'Aim and shine', p: 'Each turn, tap the sea to aim the beam, then press Shine. The beam crosses the whole map. Only what it lights is visible to you.', scene: 'beam' },
      { t: 'Find the boat', p: 'You only see the boat when the beam is on it. When your light touches the boat or a tile next to it, the captain sees the whole lit path to the lighthouse.', scene: 'find' },
      { t: 'Hold back the serpents', p: 'Sea serpents roam the fog looking for the boat. Once one spots it, it hunts it down. A serpent caught in your light dives and cannot move this round. Bubbles show where it is.', scene: 'serpent' },
      { t: 'Light the way, or guard it?', p: 'Every turn is a choice: search for the boat, show it a safe path, or pin down a serpent that is getting close. Talk to each other!', scene: 'choice' }
    ],
    boat: [
      { t: 'You sail the boat', p: 'You only see the tiles around your boat. Somewhere in the dark is the lighthouse in the middle of the map. Stop next to it to win.', scene: 'intro' },
      { t: 'Catch a wave', p: 'Tap a wave next to your boat: it carries the boat one tile its way. A dashed square shows where you would end up. Waves change every round. If none goes your way, wait.', scene: 'waves' },
      { t: 'Follow the light', p: 'When the keeper\'s beam touches you or a tile next to you, you see the whole lit path to the lighthouse.', scene: 'find' },
      { t: 'Out on the water', p: 'Rocks block your way. Whirlpools spin you off in a random direction. Barrels hold an extra life or an extra flare. Sailing off the edge of the map costs a life. Serpents that come close spot you and hunt you, so keep moving.', scene: 'hazards' },
      { t: 'Flares', p: 'A flare lets you see two tiles around you for this turn. Only you see it: the keeper does not.', scene: 'flare' }
    ],
    hard: [
      { t: 'Tall rocks', p: 'On Hard, tall rocks stand in the sea. They block the boat, and they also block the light, for the keeper and for the captain. Look around them.', scene: 'tall' },
      { t: 'Wind and sail', p: 'The wind direction is shown in the top left, and it can turn. With your sail up, a wave that goes with the wind carries you two tiles in one move, and against the wind you do not move. Side winds change nothing. Lower the sail to ignore the wind.', scene: 'wind' },
      { t: 'A faulty lamp', p: 'After every shine the light goes out. On the keeper\'s next turn, press Rekindle the light: that round stays dark, and the light works again the round after.', scene: 'lamp' },
      { t: 'No resting', p: 'On Hard the captain cannot wait two rounds in a row. And serpents are faster: they move two tiles in a straight line.', scene: 'hazards' }
    ]
  };
  function guideTutorial(kind, hard, after) {
    var pages = GUIDE_TUT[kind].slice();
    if (hard && kind !== 'hard') pages = pages.concat(GUIDE_TUT.hard);
    var i = 0, raf = 0;
    var render = function () {
      var pg = pages[i];
      var s = sheet('<div class="row"><h2>' + pg.t + '</h2><button class="close" id="x" aria-label="Close">×</button></div>' +
        '<canvas class="g-tutcv" width="560" height="300" aria-hidden="true"></canvas><p>' + pg.p + '</p>' +
        '<div class="g-tutnav"><span class="notr">' + (i + 1) + ' / ' + pages.length + '</span><button class="secondary" id="gPrev"' + (i ? '' : ' disabled') + '>Back</button><button class="primary" id="gNext">' + (i < pages.length - 1 ? 'Next' : 'Got it') + '</button></div>', 'tutorial');
      var done = function () { cancelAnimationFrame(raf); closeSheet(); if (after) after(); };
      s.querySelector('#x').onclick = done;
      s.querySelector('#gPrev').onclick = function () { if (i > 0) { i--; cancelAnimationFrame(raf); render(); } };
      s.querySelector('#gNext').onclick = function () { if (i < pages.length - 1) { i++; cancelAnimationFrame(raf); render(); } else done(); };
      var cv = s.querySelector('.g-tutcv'), c = cv.getContext('2d');
      var loop = function (now) { if (!cv.isConnected) return; guideScene(c, cv.width, cv.height, pg.scene, now); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    };
    render();
  }
  // First time in each role (and on Hard), the right tutorial opens by itself.
  function guideFirstTutorial() {
    if (!guide) return;
    var role = guideRole(), tu = progress.tutorials = progress.tutorials || {};
    var key = 'guide-' + role, hk = 'guide-hard';
    if (!tu[key]) { tu[key] = 1; if (guide.G.hard) tu[hk] = 1; save('unwind.progress2', progress); guideTutorial(role, guide.G.hard); }
    else if (guide.G.hard && !tu[hk]) { tu[hk] = 1; save('unwind.progress2', progress); guideTutorial('hard', true); }
  }
  // Little scenes for the tutorial pages, drawn with the same pieces as the game.
  function guideScene(c, w, h, kind, now) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0a1029'; c.fillRect(0, 0, w, h);
    var cols = 9, rows = 5, cs = Math.min(w / cols, h / rows), ox = (w - cols * cs) / 2, oy = (h - rows * cs) / 2;
    var X = function (x) { return ox + x * cs; }, Y = function (y) { return oy + y * cs; };
    var tile = function (x, y, lit) { c.fillStyle = lit ? '#2b3c74' : '#1f2d5e'; c.fillRect(X(x), Y(y), cs + 0.5, cs + 0.5); };
    var fog = function (x, y, k) { c.fillStyle = 'rgba(6,9,24,' + (k || 0.86) + ')'; c.fillRect(X(x), Y(y), cs + 0.5, cs + 0.5); };
    var lh = function (x, y) { var img = lighthouseImage(), lk = cs * 1.15 / 85; if (img.complete && img.naturalWidth) c.drawImage(img, X(x) + cs / 2 - 20 * lk, Y(y) + cs * 0.85 - 110 * lk, 40 * lk, 126 * lk); };
    var fakeG = { n: 99, grid: [] };
    var terrain = function (x, y, t) { fakeG.grid = []; fakeG.n = 1; fakeG.grid[0] = t; guideTerrain(c, fakeG, 0, 0, X(x), Y(y), cs, now, 1); };
    var t = (now % 6000) / 6000, x, y;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) tile(x, y, false);
    if (kind === 'intro' || kind === 'choice') {
      lh(4, 2);
      guideBoat(c, X(1) + cs / 2, Y(3) + cs / 2, cs, now, true, 1, 0);
      if (kind === 'choice') { guideBeam(c, X(4) + cs / 2, Y(2) + cs / 2, 11, cs, 6, 1, false); guideSerpent(c, X(7) + cs / 2, Y(1) + cs / 2, cs, now, 0, 1); }
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (!(x === 4 && y === 2) && Math.abs(x - 1) + Math.abs(y - 3) > 1) fog(x, y, kind === 'choice' ? 0.6 : 0.86);
    } else if (kind === 'beam') {
      var d = (Math.floor(t * 16) + 10) % 16;
      lh(4, 2); guideBeam(c, X(4) + cs / 2, Y(2) + cs / 2, d, cs, 6, 1, false);
      terrain(1, 1, Gd.ROCK); terrain(7, 3, Gd.WHIRL);
    } else if (kind === 'find') {
      lh(6, 2); guideBeam(c, X(6) + cs / 2, Y(2) + cs / 2, 12, cs, 8, 0.6 + 0.4 * Math.sin(now / 400), false);
      guideBoat(c, X(1) + cs / 2, Y(2) + cs / 2, cs, now, true, 1, 0);
      for (x = 2; x <= 5; x++) { c.fillStyle = 'rgba(255,226,150,.12)'; c.fillRect(X(x), Y(2), cs, cs); }
      c.strokeStyle = 'rgba(255,233,168,.7)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(X(1.5) + cs * 0.4, Y(2.5)); c.lineTo(X(5.5), Y(2.5)); c.stroke(); c.setLineDash([]);
    } else if (kind === 'serpent') {
      lh(1, 2); guideBeam(c, X(1) + cs / 2, Y(2) + cs / 2, 4, cs, 9, 1, false);
      guideBubbles(c, X(5) + cs / 2, Y(2) + cs / 2, cs, now, 1);
      var sx = 6 + Math.round(Math.sin(now / 900)), sy = 4;
      guideSerpent(c, X(sx) + cs / 2, Y(sy) + cs / 2, cs, now, 2, 1);
      for (x = 0; x < cols; x++) for (y = 0; y < rows; y++) if (y !== 2 && !(y === 4 && Math.abs(x - sx) <= 1)) fog(x, y, 0.55);
    } else if (kind === 'waves') {
      var bx = 4, by = 2;
      [[3, 1, 0], [5, 2, 1], [4, 3, 3], [3, 3, 2]].forEach(function (q) { guideWave(c, X(q[0]), Y(q[1]), cs, (q[2] + Math.floor(now / 2000)) % 4, now, q[0]); });
      [[3, 1], [5, 2], [4, 3], [3, 3]].forEach(function (q) { c.strokeStyle = 'rgba(255,233,168,' + (0.55 + 0.25 * Math.sin(now / 260)) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(X(q[0]) + cs / 2, Y(q[1]) + cs / 2, cs * 0.42, 0, 7); c.stroke(); });
      guideBoat(c, X(bx) + cs / 2, Y(by) + cs / 2, cs, now, true, 1, 0);
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (Math.max(Math.abs(x - bx), Math.abs(y - by)) > 1) fog(x, y);
    } else if (kind === 'hazards') {
      terrain(1, 2, Gd.ROCK); terrain(3, 2, Gd.WHIRL); guideBarrel(c, X(5) + cs / 2, Y(2) + cs / 2, cs, now); guideSerpent(c, X(7) + cs / 2, Y(2) + cs / 2, cs, now, 0, 1);
      c.fillStyle = '#e8e2ff'; c.font = '600 ' + Math.round(cs * 0.22) + 'px system-ui'; c.textAlign = 'center';
      [['Rock', 1], ['Whirlpool', 3], ['Barrel', 5], ['Serpent', 7]].forEach(function (l) { c.fillText(window.UnwindI18n ? window.UnwindI18n.t(l[0]) : l[0], X(l[1]) + cs / 2, Y(3) + cs * 0.55); });
    } else if (kind === 'flare') {
      var R = Math.sin(now / 700) > 0 ? 2 : 1;
      guideBoat(c, X(4) + cs / 2, Y(2) + cs / 2, cs, now, true, 1, 0); terrain(6, 1, Gd.WHIRL); guideBarrel(c, X(2) + cs / 2, Y(4) + cs / 2, cs, now);
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (Math.max(Math.abs(x - 4), Math.abs(y - 2)) > R) fog(x, y);
      if (R === 2) { var fg = c.createRadialGradient(X(4) + cs / 2, Y(2) + cs / 2, 0, X(4) + cs / 2, Y(2) + cs / 2, cs * 2.6); fg.addColorStop(0, 'rgba(255,190,120,.25)'); fg.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = fg; c.fillRect(0, 0, w, h); }
    } else if (kind === 'tall') {
      lh(1, 2); terrain(4, 2, Gd.BIG);
      guideBeam(c, X(1) + cs / 2, Y(2) + cs / 2, 4, cs, 9, 1, false);
      for (x = 5; x < cols; x++) fog(x, 2, 0.8);
      for (x = 0; x < cols; x++) for (y = 0; y < rows; y++) if (y !== 2) fog(x, y, 0.6);
    } else if (kind === 'wind') {
      var up = Math.floor(now / 2500) % 2 === 0, k2 = (now % 2500) / 2500, e = k2 < 0.6 ? k2 / 0.6 : 1;
      var dist = up ? 2 : 1;
      guideWave(c, X(2), Y(2), cs, 1, now, 1);
      guideBoat(c, X(1 + e * dist) + cs / 2, Y(2) + cs / 2, cs, now, up, 1, 0);
      c.save(); c.translate(X(7) + cs / 2, Y(0.5) + cs / 2); c.strokeStyle = '#e8e2ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(-cs * 0.3, 0); c.lineTo(cs * 0.3, 0); c.moveTo(cs * 0.12, -cs * 0.16); c.lineTo(cs * 0.3, 0); c.lineTo(cs * 0.12, cs * 0.16); c.stroke(); c.restore();
      c.fillStyle = '#e8e2ff'; c.font = '600 ' + Math.round(cs * 0.22) + 'px system-ui'; c.textAlign = 'center';
      c.fillText(window.UnwindI18n ? window.UnwindI18n.t(up ? 'Sail up: 2 tiles' : 'Sail down: 1 tile') : '', X(4) + cs / 2, Y(4) + cs * 0.5);
    } else if (kind === 'lamp') {
      var lit = Math.floor(now / 1600) % 2 === 0;
      lh(4, 2); if (lit) guideBeam(c, X(4) + cs / 2, Y(2) + cs / 2, 12, cs, 6, 1, false);
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (!(x === 4 && y === 2) && (!lit || y !== 2 || x > 4)) fog(x, y, 0.7);
    }
  }

  /* ---------- Online: the server relays each action, and every phone applies it the same way ---------- */
  function onGuideStart(m, you) {
    var S = m.settings;
    openGuide({ seed: m.seed, size: S.gsize || 0, hard: !!S.ghard, local: false, online: true, role: you === 0 ? 'keeper' : 'boat' });
    guide.applied = 0;
    netSend({ t: 'loaded' });
  }
  function onGuideEvent(m) {
    if (!guide || !guide.online) return false;
    if (m.t === 'gact') { if (m.n === undefined || m.n === guide.applied) { guide.applied++; guideApply(m.role, m.act); } return true; }
    if (m.t === 'log') {
      (m.events || []).filter(function (e) { return e.t === 'gact'; }).forEach(function (e) { if (e.n >= guide.applied) { guide.applied = e.n + 1; Gd.apply(guide.G, e.role, e.act); } });
      guide.anim = null; guideHud();
      if (guide.G.ended) guideEnd();
      return true;
    }
    if (m.t === 'nope') { guide.busyUntil = 0; guideToast(m.why === 'turn' ? 'It is not your turn yet.' : 'That move is not allowed.'); return true; }
    if (m.t === 'left') {
      // Guiding Light needs both players, so the game ends here.
      if (guide.G.ended) return true;
      var lt = sheet('<h2>Your partner left</h2><p>' + (m.name || 'Your partner') + ' left the game, so this sea is closed. You can go back to the room or play again later.</p><button class="primary" id="gLobby2">Back to the room</button><button class="secondary" id="gMenu2">Back to the menu</button>', 'start');
      lt.querySelector('#gLobby2').onclick = function () { netSend({ t: 'lobby' }); closeSheet(); closeGuide(); };
      lt.querySelector('#gMenu2').onclick = function () { closeSheet(); closeGuide(); netSend({ t: 'leave' }); netClose(); guideMenu(); };
      return true;
    }
    if (m.t === 'offline') { showToast(m.name + ' lost connection. Waiting for them to come back…'); return true; }
    if (m.t === 'back') { showToast(m.name + ' is back.'); return true; }
    if (m.t === 'votes') { var vb = $('sheetHost').querySelector('#again'); if (vb) vb.textContent = 'Play again (' + m.count + '/' + m.total + ')'; return true; }
    if (m.t === 'go' || m.t === 'paused' || m.t === 'clock' || m.t === 'end') return true;
    return true;
  }

  // The screen's own buttons and the sea itself.
  (function () {
    var el = guideEl(); if (!el) return;
    var cv = el.querySelector('canvas'), dragging = false;
    cv.addEventListener('pointerdown', function (ev) { dragging = true; audio(); guidePointer(ev); });
    cv.addEventListener('pointermove', function (ev) { if (dragging && guide && guideRole() === 'keeper') guidePointer(ev); });
    window.addEventListener('pointerup', function () { dragging = false; });
    el.querySelector('.g-close').onclick = function () { audio(); if (guide) guideLeave(); };
    el.querySelector('.g-help').onclick = function () { if (guide) guideTutorial(guideRole(), guide.G.hard); };
    el.querySelector('.g-peek').onclick = function () { if (guide) { guide.peek = !guide.peek; guideHud(); } };
  })();
