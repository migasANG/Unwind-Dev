/*
 * Guiding Light: a two-player mode for Unwind. One player keeps the lighthouse, the other sails the boat,
 * and the sea is dark for both. The keeper turns the beam to show the way and to hold back the sea serpents;
 * the captain catches waves next to the boat to sail it home to the lighthouse in the middle of the map.
 *
 * This file holds only the rules, with no drawing. The game and the room server both use it, and everything
 * random comes from the game's seed, so every phone and the server always agree.
 *
 * A round: the keeper shines the beam (on Hard the lamp only works every other round), then the captain acts
 * (flare, sail, then catch a wave or wait), then the serpents move, then the waves change.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Directions run clockwise: 0 up, 1 right, 2 down, 3 left.
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var WATER = 0, ROCK = 1, BIG = 2, WHIRL = 3, LIGHT = 4;
  var SIZES = [9, 11, 15], SIZE_NAMES = ['Small', 'Medium', 'Large'];
  var BEAM_STEPS = 16, BEAM_HALF = 15 * Math.PI / 180, BEAM_CORE = 0.75;
  var MAX_LIVES = 5;

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // A separate stream of random numbers for each purpose and round, so replaying always gives the same sea.
  function rngFor(seed, round, salt) {
    var h = (seed | 0) ^ Math.imul(round + 1, 0x9E3779B1) ^ Math.imul(salt + 7, 0x85EBCA77);
    h = Math.imul(h ^ h >>> 16, 0x7FEB352D); h = Math.imul(h ^ h >>> 15, 0x846CA68B); h ^= h >>> 16;
    return mulberry(h);
  }
  var SALT = { map: 1, waves: 2, wind: 3, whirl: 4, serpent: 5, respawn: 6 };

  function inside(G, x, y) { return x >= 0 && y >= 0 && x < G.n && y < G.n; }
  function cell(G, x, y) { return inside(G, x, y) ? G.grid[y * G.n + x] : -1; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function serpentAt(G, x, y) { for (var i = 0; i < G.serpents.length; i++) if (G.serpents[i].x === x && G.serpents[i].y === y) return i; return -1; }
  function barrelAt(G, x, y) { for (var i = 0; i < G.barrels.length; i++) if (!G.barrels[i].taken && G.barrels[i].x === x && G.barrels[i].y === y) return i; return -1; }
  function sailable(t) { return t === WATER || t === WHIRL; }

  /* ---------- The map ---------- */
  // Tiles reachable from (x, y) by sailing, ignoring waves (the captain can always wait for the right wave).
  function distances(G, sx, sy) {
    var n = G.n, d = new Array(n * n), q = [sx, sy], h = 0;
    for (var i = 0; i < d.length; i++) d[i] = -1;
    d[sy * n + sx] = 0;
    while (h < q.length) {
      var x = q[h++], y = q[h++];
      for (var k = 0; k < 4; k++) {
        var nx = x + DX[k], ny = y + DY[k];
        if (!inside(G, nx, ny) || d[ny * n + nx] >= 0 || !sailable(G.grid[ny * n + nx])) continue;
        d[ny * n + nx] = d[y * n + x] + 1; q.push(nx, ny);
      }
    }
    return d;
  }
  function dockDistance(G, d) {
    var best = -1;
    for (var y = G.c - 1; y <= G.c + 1; y++) for (var x = G.c - 1; x <= G.c + 1; x++) {
      var v = d[y * G.n + x];
      if (v >= 0 && (best < 0 || v < best)) best = v;
    }
    return best;
  }
  function tryMap(seed, size, hard, attempt) {
    var r = rngFor(seed, attempt, SALT.map), n = SIZES[size] || 11, c = n >> 1, area = n * n;
    var G = { n: n, c: c, grid: [], barrels: [], serpents: [] };
    for (var i = 0; i < area; i++) G.grid.push(WATER);
    G.grid[c * n + c] = LIGHT;
    var nearLight = function (x, y) { return cheb(x, y, c, c) <= 1; };
    var free = function (x, y) { return inside(G, x, y) && G.grid[y * n + x] === WATER && !nearLight(x, y); };
    // Rocks come in small clusters, so the sea has channels and dead ends instead of an even sprinkle.
    var place = function (type, total, grow, keep) {
      var placed = 0, tries = 0;
      while (placed < total && tries++ < total * 30) {
        var x = Math.floor(r() * n), y = Math.floor(r() * n);
        if (!free(x, y) || cheb(x, y, c, c) <= (keep || 0)) continue;
        G.grid[y * n + x] = type; placed++;
        var len = Math.floor(r() * (grow + 1));
        for (var g = 0; g < len && placed < total; g++) {
          var k = Math.floor(r() * 4); x += DX[k]; y += DY[k];
          if (!free(x, y) || cheb(x, y, c, c) <= (keep || 0)) break;
          G.grid[y * n + x] = type; placed++;
        }
      }
    };
    place(ROCK, Math.round(area * (hard ? 0.13 : 0.15)), 2);
    // Tall rocks stay a little away from the lighthouse, so they shade parts of the sea instead of whole sides of it.
    if (hard) place(BIG, Math.round(area * 0.06), 2, 2);
    place(WHIRL, Math.max(2, Math.round(area / 38)), 0);
    // The boat starts far out, near the edge of the map.
    var starts = [];
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (G.grid[y * n + x] === WATER && cheb(x, y, c, c) >= c - 1) starts.push([x, y]);
    if (!starts.length) return null;
    var s = starts[Math.floor(r() * starts.length)];
    G.boat = { x: s[0], y: s[1] };
    var d = distances(G, s[0], s[1]), dock = dockDistance(G, d);
    var straight = Math.max(0, Math.abs(s[0] - c) + Math.abs(s[1] - c) - 1);
    // There has to be a way home, and it should bend: rocks in the way make the couple plan a route.
    if (dock < 0 || dock < straight + (size === 0 ? 1 : 2)) return null;
    // Most of the sea must be reachable, so barrels and serpents are not lost in sealed pockets.
    var reach = 0, water = 0;
    for (i = 0; i < area; i++) { if (sailable(G.grid[i])) { water++; if (d[i] >= 0) reach++; } }
    if (reach < water * 0.8) return null;
    var reachable = function (x, y) { return d[y * n + x] >= 0 && G.grid[y * n + x] === WATER && !nearLight(x, y) && !(x === s[0] && y === s[1]); };
    var spots = [];
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (reachable(x, y)) spots.push([x, y]);
    var take = function (ok) {
      for (var t = 0; t < 200 && spots.length; t++) {
        var k = Math.floor(r() * spots.length), p = spots[k];
        if (ok(p[0], p[1])) { spots.splice(k, 1); return p; }
      }
      return null;
    };
    var nBarrels = Math.max(2, Math.round(area / 40));
    for (i = 0; i < nBarrels; i++) {
      var b = take(function () { return true; });
      if (b) G.barrels.push({ x: b[0], y: b[1], kind: r() < 0.5 ? 'life' : 'flare', taken: false });
    }
    var nSerpents = [1, 2, 3][size] || 2;
    for (i = 0; i < nSerpents; i++) {
      var p = take(function (x, y) { return cheb(x, y, s[0], s[1]) >= 4; });
      if (p) G.serpents.push({ x: p[0], y: p[1], frozen: false, id: i });
    }
    return G;
  }

  function create(seed, opts) {
    opts = opts || {};
    var size = opts.size === undefined ? 1 : opts.size | 0, hard = !!opts.hard, G = null;
    for (var a = 0; a < 400 && !G; a++) G = tryMap(seed, size, hard, a);
    if (!G) throw new Error('no map');
    G.seed = seed | 0; G.size = size; G.hard = hard;
    G.round = 0; G.lives = 3; G.flares = 1; G.sail = true;
    G.beam = -1; G.lit = []; G.flare = false; G.flareUsed = false;
    G.ended = null; G.moves = 0; G.hits = 0;
    G.keeperSeen = {}; G.boatSeen = {};
    G.phase = lampWorks(G) ? 'keeper' : 'boat';
    G.wind = windFor(G);
    G.waves = wavesFor(G);
    rememberBoat(G);
    return G;
  }

  /* ---------- Waves, wind and the lamp ---------- */
  // Every round the sea changes: about two tiles in five carry a wave, each in a random direction.
  function wavesFor(G) {
    var r = rngFor(G.seed, G.round, SALT.waves), w = [];
    for (var i = 0; i < G.n * G.n; i++) {
      var on = G.grid[i] === WATER && r() < 0.42, d = Math.floor(r() * 4);
      // No waves under barrels, so a barrel is always easy to see.
      w.push(on && barrelAt(G, i % G.n, Math.floor(i / G.n)) < 0 ? d : -1);
    }
    return w;
  }
  // Hard only. The wind turns every six rounds.
  function windFor(G) { return G.hard ? Math.floor(rngFor(G.seed, Math.floor(G.round / 6), SALT.wind)() * 4) : -1; }
  // Hard only: the lamp is faulty and only works every other round.
  function lampWorks(G) { return !G.hard || G.round % 2 === 0; }

  /* ---------- Light and sight ---------- */
  // Big rocks block the beam and the boat's view. Small rocks are low and do not.
  function lineClear(G, ax, ay, bx, by) {
    var steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3);
    for (var i = 1; i < steps; i++) {
      var t = i / steps, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
      if ((x !== ax || y !== ay) && (x !== bx || y !== by) && cell(G, x, y) === BIG) return false;
    }
    return true;
  }
  // The beam reaches the whole way across the map: a narrow core with a soft widening cone around it.
  function beamCells(G, dir) {
    if (dir < 0) return [];
    var a = dir * 2 * Math.PI / BEAM_STEPS, ux = Math.sin(a), uy = -Math.cos(a), out = [];
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var dx = x - G.c, dy = y - G.c;
      if (!dx && !dy) continue;
      var along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
      if (along <= 0.2) continue;
      var ang = Math.atan2(across, along);
      if ((ang <= BEAM_HALF || across <= BEAM_CORE) && lineClear(G, G.c, G.c, x, y)) out.push(y * G.n + x);
    }
    return out;
  }
  function isLit(G, x, y) { return G.lit.indexOf(y * G.n + x) >= 0; }
  // What the captain sees: the tiles around the boat (two around with a flare), and the whole beam when it
  // touches the boat or a tile next to it.
  function boatView(G) {
    var seen = {}, R = G.flare ? 2 : 1, bx = G.boat.x, by = G.boat.y, touched = false;
    for (var y = by - R; y <= by + R; y++) for (var x = bx - R; x <= bx + R; x++) {
      if (!inside(G, x, y)) continue;
      if (R > 1 && cheb(x, y, bx, by) > 1 && !lineClear(G, bx, by, x, y)) continue;
      seen[y * G.n + x] = 1;
      if (cheb(x, y, bx, by) <= 1 && isLit(G, x, y)) touched = true;
    }
    if (touched) G.lit.forEach(function (i) { seen[i] = 1; });
    return { cells: seen, touched: touched };
  }
  function keeperView(G) {
    var seen = {};
    G.lit.forEach(function (i) { seen[i] = 1; });
    return { cells: seen, boat: isLit(G, G.boat.x, G.boat.y) };
  }
  function rememberBoat(G) { var v = boatView(G).cells; for (var k in v) G.boatSeen[k] = 1; }

  /* ---------- Actions ---------- */
  // Waves the captain can catch: on the boat's tile or any of the eight around it.
  function catchable(G) {
    var out = [];
    for (var y = G.boat.y - 1; y <= G.boat.y + 1; y++) for (var x = G.boat.x - 1; x <= G.boat.x + 1; x++) {
      if (!inside(G, x, y)) continue;
      var w = G.waves[y * G.n + x];
      if (w >= 0) out.push({ x: x, y: y, dir: w });
    }
    return out;
  }
  // How far a wave carries the boat: one tile, or on Hard two with the wind behind a raised sail and none against it.
  function stepsFor(G, dir) {
    if (!G.hard || !G.sail || G.wind < 0) return 1;
    if (dir === G.wind) return 2;
    if (dir === (G.wind + 2) % 4) return 0;
    return 1;
  }
  function hurt(G, log, why, x, y) {
    G.lives--; G.hits++;
    log.hits.push({ why: why, x: x, y: y, lives: G.lives });
    if (G.lives <= 0) G.ended = 'lost';
  }
  // A serpent that touches the boat dives and comes up again somewhere far away in the dark.
  function respawnSerpent(G, s, log) {
    var r = rngFor(G.seed, G.round * 31 + s.id, SALT.respawn), best = null;
    for (var t = 0; t < 120; t++) {
      var x = Math.floor(r() * G.n), y = Math.floor(r() * G.n);
      if (G.grid[y * G.n + x] !== WATER || cheb(x, y, G.c, G.c) <= 1 || serpentAt(G, x, y) >= 0 || barrelAt(G, x, y) >= 0) continue;
      if (cheb(x, y, G.boat.x, G.boat.y) >= 5) { best = [x, y]; break; }
      if (!best) best = [x, y];
    }
    log.dives.push({ id: s.id, from: [s.x, s.y], to: best });
    if (best) { s.x = best[0]; s.y = best[1]; }
  }
  function sailBoat(G, dir, log) {
    var steps = stepsFor(G, dir), start = [G.boat.x, G.boat.y], path = [start.slice()], whirls = 0;
    var r = rngFor(G.seed, G.round, SALT.whirl);
    log.dir = dir; log.steps = steps;
    while (steps > 0) {
      var nx = G.boat.x + DX[dir], ny = G.boat.y + DY[dir], t = cell(G, nx, ny);
      if (t < 0) {
        // Off the edge of the map: the boat drifts out, a life is lost, and the sea washes it back.
        path.push([nx, ny]);
        hurt(G, log, 'edge', nx, ny);
        G.boat.x = start[0]; G.boat.y = start[1];
        log.washBack = start.slice();
        break;
      }
      if (t === ROCK || t === BIG || t === LIGHT) { log.blocked = [nx, ny]; break; }
      var si = serpentAt(G, nx, ny);
      if (si >= 0) {
        hurt(G, log, 'serpent', nx, ny);
        log.bump = [nx, ny];
        respawnSerpent(G, G.serpents[si], log);
        break;
      }
      G.boat.x = nx; G.boat.y = ny; path.push([nx, ny]); steps--;
      var bi = barrelAt(G, nx, ny);
      if (bi >= 0) {
        var b = G.barrels[bi]; b.taken = true;
        if (b.kind === 'life') G.lives = Math.min(MAX_LIVES, G.lives + 1); else G.flares++;
        log.barrels.push({ x: nx, y: ny, kind: b.kind });
      }
      // A whirlpool spins the boat and flings it one more tile in a random direction.
      if (t === WHIRL && whirls < 6) {
        whirls++;
        dir = Math.floor(r() * 4);
        log.whirls.push({ x: nx, y: ny, dir: dir });
        steps = Math.max(steps, 1);
      }
    }
    log.path = path;
  }
  function moveSerpents(G, log) {
    var r = rngFor(G.seed, G.round, SALT.serpent), reach = G.hard ? 2 : 1;
    G.serpents.forEach(function (s) {
      if (s.frozen || G.ended) return;
      var opts = [];
      for (var k = 0; k < 4; k++) { var x = s.x + DX[k], y = s.y + DY[k]; if (sailable(cell(G, x, y)) && cheb(x, y, G.c, G.c) > 1) opts.push(k); }
      if (!opts.length) return;
      var dir = opts[Math.floor(r() * opts.length)], path = [[s.x, s.y]];
      // On Hard serpents move two tiles, always in a straight line.
      for (var i = 0; i < reach; i++) {
        var nx = s.x + DX[dir], ny = s.y + DY[dir];
        if (!sailable(cell(G, nx, ny)) || cheb(nx, ny, G.c, G.c) <= 1 || serpentAt(G, nx, ny) >= 0) break;
        s.x = nx; s.y = ny; path.push([nx, ny]);
        if (nx === G.boat.x && ny === G.boat.y) {
          log.serpents.push({ id: s.id, path: path });
          hurt(G, log, 'serpent', nx, ny);
          respawnSerpent(G, s, log);
          return;
        }
      }
      log.serpents.push({ id: s.id, path: path });
    });
  }
  function docked(G) { return cheb(G.boat.x, G.boat.y, G.c, G.c) === 1; }
  function endRound(G, log) {
    G.round++;
    G.flare = false; G.flareUsed = false;
    G.serpents.forEach(function (s) { s.frozen = false; });
    G.lit = []; G.beam = -1;
    G.wind = windFor(G);
    G.waves = wavesFor(G);
    G.phase = lampWorks(G) ? 'keeper' : 'boat';
    log.round = G.round;
    rememberBoat(G);
  }

  // Applies one action. role is 'keeper' or 'boat'. Returns { ok, log } or { ok: false, why }.
  function apply(G, role, act) {
    if (G.ended) return { ok: false, why: 'ended' };
    if (!act || typeof act.a !== 'string') return { ok: false, why: 'bad' };
    var log = { a: act.a, role: role, hits: [], barrels: [], whirls: [], dives: [], serpents: [] };
    if (act.a === 'beam') {
      if (role !== 'keeper' || G.phase !== 'keeper') return { ok: false, why: 'turn' };
      var d = act.dir | 0;
      if (d < 0 || d >= BEAM_STEPS) return { ok: false, why: 'bad' };
      G.beam = d; G.lit = beamCells(G, d);
      G.lit.forEach(function (i) { G.keeperSeen[i] = 1; });
      // Serpents caught in the light dive and stay still this round; bubbles show where they are.
      G.serpents.forEach(function (s) { s.frozen = isLit(G, s.x, s.y); });
      G.phase = 'boat';
      rememberBoat(G);
      log.lit = G.lit.slice();
      return { ok: true, log: log };
    }
    if (role !== 'boat' || G.phase !== 'boat') return { ok: false, why: 'turn' };
    if (act.a === 'flare') {
      if (G.flareUsed || G.flares <= 0) return { ok: false, why: 'noflare' };
      G.flares--; G.flare = true; G.flareUsed = true;
      rememberBoat(G);
      return { ok: true, log: log };
    }
    if (act.a === 'sail') {
      if (!G.hard) return { ok: false, why: 'bad' };
      G.sail = !!act.up;
      return { ok: true, log: log };
    }
    if (act.a === 'move' || act.a === 'wait') {
      if (act.a === 'move') {
        var x = act.x | 0, y = act.y | 0;
        if (cheb(x, y, G.boat.x, G.boat.y) > 1 || !inside(G, x, y)) return { ok: false, why: 'far' };
        var w = G.waves[y * G.n + x];
        if (w < 0) return { ok: false, why: 'nowave' };
        sailBoat(G, w, log);
        G.moves++;
      }
      if (!G.ended && docked(G)) G.ended = 'won';
      if (!G.ended) moveSerpents(G, log);
      if (!G.ended) endRound(G, log);
      return { ok: true, log: log };
    }
    return { ok: false, why: 'bad' };
  }

  // Rebuilds a game from its seed and the list of actions so far.
  function replay(seed, opts, actions) {
    var G = create(seed, opts);
    (actions || []).forEach(function (x) { apply(G, x.role, x.act); });
    return G;
  }

  return {
    create: create, apply: apply, replay: replay, beamCells: beamCells, boatView: boatView, keeperView: keeperView,
    catchable: catchable, stepsFor: stepsFor, lampWorks: lampWorks, isLit: isLit, serpentAt: serpentAt, barrelAt: barrelAt,
    cell: cell, inside: inside, cheb: cheb, distances: distances,
    DX: DX, DY: DY, WATER: WATER, ROCK: ROCK, BIG: BIG, WHIRL: WHIRL, LIGHT: LIGHT,
    SIZES: SIZES, SIZE_NAMES: SIZE_NAMES, BEAM_STEPS: BEAM_STEPS
  };
});
