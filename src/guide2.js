/* Guiding Light 2.0: the rules.
   The keeper (the player) has the whole sea chart but never sees the boat. The captain, lost in the fog, sees only
   the tiles around the boat and radios what is there. The keeper works out where the boat must be, then guides it
   home: a beam of light the boat can follow straight to the lighthouse, and buoys it sails to when it sees them.
   In solo play the captain is played by these rules. Plain functions on a plain state object, so a room server
   can use the same file later. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindGuide2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Tiles. Rocks, wrecks and islands block the boat. Tall rocks and islands also block the light. Kelp is open water
  // with something to see in it.
  var WATER = 0, ROCK = 1, TALL = 2, WRECK = 3, ISLAND = 4, KELP = 5, LIGHT = 6;
  var CHARS = { '.': WATER, 'r': ROCK, 'R': TALL, 'W': WRECK, 'I': ISLAND, 'k': KELP, 'L': LIGHT };
  var NAMES = ['water', 'rock', 'tall', 'wreck', 'island', 'kelp', 'light'];
  var VIEW = 2;            // the captain sees this many tiles around the boat
  var BEAM_STEPS = 16, BEAM_HALF = 15 * Math.PI / 180, BEAM_CORE = 0.75;
  var BUOY_COLORS = ['red', 'yellow', 'green'];
  var DIR8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

  // The levels. S marks the places the boat may start (one is picked at random each game). Serpents swim their
  // loop of waypoints; a serpent that comes within two tiles of the boat hunts it.
  var LEVELS = [
    { name: 'First night', buoys: 3, oil: 5, rounds: 30, lives: 3, map: [
      'r...kk...',
      '..S......',
      '.I..r..rW',
      '.......r.',
      'k...L....',
      '..r......',
      '..r...IS.',
      'S........',
      'W.....kk.'], serpents: [] },
    { name: 'Twin rocks', buoys: 3, oil: 4, rounds: 30, lives: 3, map: [
      '.S.........',
      '.rr......rr',
      '.....k.....',
      '...I......W',
      '.k.....r...',
      '.....L.....',
      '...r.....k.',
      'W......I...',
      '.....k.....',
      '.rr......rr',
      '.........S.'], serpents: [[[2, 6], [2, 8], [6, 8], [8, 6], [8, 3], [5, 2], [2, 3]]] },
    { name: 'The long dark', buoys: 3, oil: 4, rounds: 36, lives: 3, map: [
      '.S...........',
      '.r..kk....r..',
      '....k...W....',
      '..R..........',
      '.k....r...R..',
      '....I.......S',
      '..W...L..rr..',
      '.............',
      '..r....R..k..',
      '..r..k.......',
      '.........I...',
      '.R......k..r.',
      'S............'], serpents: [[[3, 9], [6, 10], [10, 9], [11, 6], [9, 3]], [[9, 2], [6, 1], [2, 2], [1, 6], [3, 8]]] }
  ];

  function inside(G, x, y) { return x >= 0 && y >= 0 && x < G.n && y < G.n; }
  function tile(G, x, y) { return inside(G, x, y) ? G.grid[y * G.n + x] : -1; }
  function open(G, x, y) { var t = tile(G, x, y); return t === WATER || t === KELP; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function blocksLight(t) { return t === TALL || t === ISLAND; }
  // Can light travel in a straight line between two tiles? Only tall rocks and islands stop it.
  function lineClear(G, ax, ay, bx, by) {
    var n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3;
    for (var i = 1; i < n; i++) {
      var x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
      if ((x !== ax || y !== ay) && (x !== bx || y !== by) && blocksLight(tile(G, x, y))) return false;
    }
    return true;
  }
  function beamCells(G, dir) {
    var a = dir * 2 * Math.PI / BEAM_STEPS, ux = Math.sin(a), uy = -Math.cos(a), out = [];
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var dx = x - G.c, dy = y - G.c, along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
      if (along <= 0.2) continue;
      if ((Math.atan2(across, along) <= BEAM_HALF || across <= BEAM_CORE) && lineClear(G, G.c, G.c, x, y)) out.push(y * G.n + x);
    }
    return out;
  }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function create(level, seed) {
    var L = LEVELS[level], n = L.map.length, G = { level: level, n: n, c: (n - 1) / 2, grid: [], starts: [], round: 1, lives: L.lives, maxRounds: L.rounds,
      buoyMax: L.buoys, oil: L.oil, buoys: [], beam: -1, lit: [], ended: null, log: [], path: [], serpents: [], marks: {}, seed: seed >>> 0 };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var ch = L.map[y].charAt(x);
      if (ch === 'S') { G.starts.push([x, y]); ch = '.'; }
      G.grid.push(CHARS[ch] !== undefined ? CHARS[ch] : WATER);
    }
    var pick = G.starts[Math.floor(rng(seed)() * G.starts.length)];
    G.boat = { x: pick[0], y: pick[1] };
    G.path.push([G.boat.x, G.boat.y]);
    G.serpents = L.serpents.map(function (route, i) { return { id: i, route: route, at: 0, x: route[0][0], y: route[0][1], hunt: false, down: false }; });
    G.report = report(G, []);
    return G;
  }
  // Shortest step from a tile towards a goal, over open water (and never onto a serpent). -1 if there is no way.
  function stepToward(G, fx, fy, tx, ty, avoid) {
    if (fx === tx && fy === ty) return null;
    var prev = {}, q = [[tx, ty]], seen = {}; seen[ty * G.n + tx] = 1;
    while (q.length) {
      var p = q.shift();
      for (var d = 0; d < 4; d++) {
        var x = p[0] + [0, 1, 0, -1][d], y = p[1] + [-1, 0, 1, 0][d], k = y * G.n + x;
        if (seen[k] || !inside(G, x, y)) continue;
        if (x === fx && y === fy) return p;
        if (!open(G, x, y) || (avoid && avoid(x, y))) continue;
        seen[k] = 1; q.push([x, y]);
      }
    }
    return null;
  }
  function serpentAt(G, x, y) { for (var i = 0; i < G.serpents.length; i++) if (G.serpents[i].x === x && G.serpents[i].y === y) return G.serpents[i]; return null; }
  function isLit(G, x, y) { return G.lit.indexOf(y * G.n + x) >= 0; }
  function home(G) { return cheb(G.boat.x, G.boat.y, G.c, G.c) <= 1; }

  // What the captain radios: the things within sight, grouped, with a compass direction and how near they are.
  function report(G, events) {
    var bx = G.boat.x, by = G.boat.y, items = [], seen = {};
    for (var y = by - VIEW; y <= by + VIEW; y++) for (var x = bx - VIEW; x <= bx + VIEW; x++) {
      if (x === bx && y === by) continue;
      var t = tile(G, x, y);
      if (t === WATER || t < 0 || seen[y * G.n + x]) continue;
      // Join touching tiles of the same kind into one thing.
      var group = [[x, y]], q = [[x, y]]; seen[y * G.n + x] = 1;
      while (q.length) {
        var p = q.shift();
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = p[0] + dx, yy = p[1] + dy;
          if (cheb(xx, yy, bx, by) > VIEW || seen[yy * G.n + xx] || tile(G, xx, yy) !== t) continue;
          seen[yy * G.n + xx] = 1; group.push([xx, yy]); q.push([xx, yy]);
        }
      }
      var near = group.slice().sort(function (a, b) { return cheb(a[0], a[1], bx, by) - cheb(b[0], b[1], bx, by) || (Math.abs(a[0] - bx) + Math.abs(a[1] - by)) - (Math.abs(b[0] - bx) + Math.abs(b[1] - by)); })[0];
      items.push({ kind: NAMES[t], count: group.length, dir: dir8(near[0] - bx, near[1] - by), dist: cheb(near[0], near[1], bx, by) });
    }
    G.buoys.forEach(function (b) { if (cheb(b.x, b.y, bx, by) <= VIEW && (b.x !== bx || b.y !== by)) items.push({ kind: 'buoy', color: b.color, count: 1, dir: dir8(b.x - bx, b.y - by), dist: cheb(b.x, b.y, bx, by) }); });
    G.serpents.forEach(function (s) { if (!s.down && cheb(s.x, s.y, bx, by) <= VIEW) items.push({ kind: 'serpent', count: 1, dir: dir8(s.x - bx, s.y - by), dist: cheb(s.x, s.y, bx, by) }); });
    items.sort(function (a, b) { return a.dist - b.dist; });
    return { items: items, events: events || [], round: G.round };
  }
  function dir8(dx, dy) { var a = Math.atan2(dx, -dy); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; }

  // The keeper's turn: shine the beam one way (it burns one measure of oil, and there are only a few), drop a buoy (the oldest is lifted once all are out), or wait.
  // Then the boat moves, the serpents swim, and the captain radios again.
  function apply(G, act) {
    if (G.ended) return { ok: false, why: 'ended' };
    var events = [];
    G.beam = -1; G.lit = [];
    if (act.a === 'beam') {
      if (G.oil <= 0) return { ok: false, why: 'oil' };
      G.oil--;
      var d = ((act.dir | 0) % BEAM_STEPS + BEAM_STEPS) % BEAM_STEPS;
      G.beam = d; G.lit = beamCells(G, d);
    } else if (act.a === 'buoy') {
      if (!open(G, act.x, act.y) || buoyAt(G, act.x, act.y)) return { ok: false, why: 'spot' };
      var color = BUOY_COLORS.filter(function (c) { return !G.buoys.some(function (b) { return b.color === c; }); })[0];
      if (G.buoys.length >= G.buoyMax) { color = G.buoys[0].color; G.buoys.shift(); }
      G.buoys.push({ x: act.x, y: act.y, color: color, reached: false });
    } else if (act.a !== 'wait') return { ok: false, why: 'act' };
    // Serpents caught in the light dive and stay down this round.
    G.serpents.forEach(function (s) { s.down = isLit(G, s.x, s.y); });
    var moved = sailBoat(G, events);
    if (!G.ended) moveSerpents(G, events);
    if (!G.ended && home(G)) { G.ended = 'won'; events.push({ e: 'home' }); }
    G.round++;
    if (!G.ended && G.round > G.maxRounds) { G.ended = 'lost'; events.push({ e: 'oil' }); }
    G.report = report(G, events);
    G.log.push({ act: act, events: events, moved: moved });
    return { ok: true, events: events };
  }
  function buoyAt(G, x, y) { for (var i = 0; i < G.buoys.length; i++) if (G.buoys[i].x === x && G.buoys[i].y === y) return G.buoys[i]; return null; }
  // The captain follows the light home when the boat is in the beam (two tiles), or else sails to a buoy it can see
  // (one tile). Otherwise it keeps still and waits for a sign.
  function sailBoat(G, events) {
    var steps = 0;
    if (isLit(G, G.boat.x, G.boat.y)) {
      events.push({ e: 'light' });
      for (var i = 0; i < 2 && !home(G); i++) {
        var best = null, bd = Math.hypot(G.boat.x - G.c, G.boat.y - G.c) - 0.01;
        for (var d = 0; d < 4; d++) {
          var x = G.boat.x + [0, 1, 0, -1][d], y = G.boat.y + [-1, 0, 1, 0][d], dd = Math.hypot(x - G.c, y - G.c);
          if (open(G, x, y) && isLit(G, x, y) && dd < bd && !serpentAt(G, x, y)) { best = [x, y]; bd = dd; }
        }
        if (!best) { if (!home(G)) events.push({ e: 'blocked' }); break; }
        G.boat.x = best[0]; G.boat.y = best[1]; G.path.push(best); steps++;
      }
      return steps;
    }
    var target = null;
    G.buoys.forEach(function (b) { if (!b.reached && cheb(b.x, b.y, G.boat.x, G.boat.y) <= VIEW && (!target || b === G.buoys[G.buoys.length - 1])) target = b; });
    if (target) {
      var s = stepToward(G, G.boat.x, G.boat.y, target.x, target.y, function (x, y) { return !!serpentAt(G, x, y); });
      if (s) { G.boat.x = s[0]; G.boat.y = s[1]; G.path.push(s); steps = 1; events.push({ e: 'tobuoy', color: target.color }); }
      else events.push({ e: 'noway', color: target.color });
      if (G.boat.x === target.x && G.boat.y === target.y) { target.reached = true; events.push({ e: 'atbuoy', color: target.color }); }
    }
    return steps;
  }
  function moveSerpents(G, events) {
    G.serpents.forEach(function (s) {
      if (s.down) return;
      var near = cheb(s.x, s.y, G.boat.x, G.boat.y) <= 2, step;
      if (near) { s.hunt = true; step = stepToward(G, s.x, s.y, G.boat.x, G.boat.y, function (x, y) { var o = serpentAt(G, x, y); return o && o !== s; }); }
      else {
        s.hunt = false;
        var wp = s.route[s.at];
        if (s.x === wp[0] && s.y === wp[1]) { s.at = (s.at + 1) % s.route.length; wp = s.route[s.at]; }
        step = stepToward(G, s.x, s.y, wp[0], wp[1], function (x, y) { var o = serpentAt(G, x, y); return (o && o !== s) || (x === G.boat.x && y === G.boat.y); });
      }
      if (!step) return;
      s.x = step[0]; s.y = step[1];
      if (s.x === G.boat.x && s.y === G.boat.y) {
        G.lives--; events.push({ e: 'bite' });
        // The serpent dives and comes back up where its loop starts.
        s.x = s.route[0][0]; s.y = s.route[0][1]; s.at = 0; s.hunt = false;
        if (G.lives <= 0) G.ended = 'lost';
      }
    });
  }

  return { LEVELS: LEVELS, create: create, apply: apply, beamCells: beamCells, report: report, isLit: isLit, buoyAt: buoyAt, tile: tile, open: open, inside: inside, cheb: cheb,
    WATER: WATER, ROCK: ROCK, TALL: TALL, WRECK: WRECK, ISLAND: ISLAND, KELP: KELP, LIGHT: LIGHT, NAMES: NAMES, DIR8: DIR8, VIEW: VIEW, BEAM_STEPS: BEAM_STEPS };
});
