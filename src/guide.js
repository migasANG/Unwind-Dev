/*
 * Guiding Light: a two-player mode for Unwind. One player keeps the lighthouse, the other sails the boat,
 * and the sea is dark for both. The keeper turns the beam to show the way and to hold back the sea serpents;
 * the captain catches waves next to the boat to sail it home to the lighthouse in the middle of the map.
 *
 * This file holds only the rules, with no drawing. The game and the room server both use it, and everything
 * random comes from the game's seed, so every phone and the server always agree.
 *
 * A round: the keeper shines the beam (on Hard the lamp goes out after each shine, and the keeper spends the next
 * turn rekindling it), then the captain acts (flare, sail, then catch a wave or wait), then the serpents move, then
 * the waves change. Maps are random: some are easy, some hard, and some cannot be won.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Directions run clockwise: 0 up, 1 right, 2 down, 3 left.
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var WATER = 0, ROCK = 1, BIG = 2, WHIRL = 3, LIGHT = 4;
  var SIZES = [13, 17, 23], SIZE_NAMES = ['Small', 'Medium', 'Large'];
  var BEAM_STEPS = 16, BEAM_HALF = 15 * Math.PI / 180, BEAM_CORE = 0.75;
  var MAX_LIVES = 5;
  // On Hard the sea seems to go on past the edge of the map: this many rings of open water outside it carry
  // waves and catch the light like any other tile, so nothing gives the edge away until the boat sails off it.
  var EDGE = 4;

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
  var SALT = { map: 1, waves: 2, wind: 3, whirl: 4, serpent: 5, respawn: 6, roam: 7, edge: 8 };

  function inside(G, x, y) { return x >= 0 && y >= 0 && x < G.n && y < G.n; }
  function cell(G, x, y) { return inside(G, x, y) ? G.grid[y * G.n + x] : -1; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function serpentAt(G, x, y) { for (var i = 0; i < G.serpents.length; i++) if (G.serpents[i].x === x && G.serpents[i].y === y) return i; return -1; }
  function barrelAt(G, x, y) { for (var i = 0; i < G.barrels.length; i++) if (!G.barrels[i].taken && G.barrels[i].x === x && G.barrels[i].y === y) return i; return -1; }
  function sailable(t) { return t === WATER || t === WHIRL; }
  // Tiles just outside the map (Hard only) have their own index in a padded grid.
  function outKey(G, x, y) { var P = G.n + 2 * EDGE; return x >= -EDGE && y >= -EDGE && x < G.n + EDGE && y < G.n + EDGE && !inside(G, x, y) ? (y + EDGE) * P + (x + EDGE) : -1; }
  function outXY(G, k) { var P = G.n + 2 * EDGE; return [k % P - EDGE, Math.floor(k / P) - EDGE]; }
  // The wave on any tile, inside the map or (on Hard) just outside it.
  function waveAt(G, x, y) {
    if (inside(G, x, y)) return G.waves[y * G.n + x];
    var k = G.hard ? outKey(G, x, y) : -1;
    return k >= 0 && G.outWaves ? G.outWaves[k] : -1;
  }

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
  // Everything about the sea is random: how rocky it is, how many whirlpools and barrels, where the boat starts.
  // Nothing promises a way home: some maps are easy, some are hard, and some are lost from the start.
  function tryMap(seed, size, hard, attempt) {
    var r = rngFor(seed, attempt, SALT.map), n = SIZES[size] || 17, c = n >> 1, area = n * n;
    var between = function (a, b) { return a + r() * (b - a); };
    var G = { n: n, c: c, grid: [], barrels: [], serpents: [] };
    for (var i = 0; i < area; i++) G.grid.push(WATER);
    G.grid[c * n + c] = LIGHT;
    var nearLight = function (x, y) { return cheb(x, y, c, c) <= 1; };
    var free = function (x, y) { return inside(G, x, y) && G.grid[y * n + x] === WATER && !nearLight(x, y); };
    // Rocks come in clusters, so the sea has channels and dead ends instead of an even sprinkle.
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
    place(ROCK, Math.round(area * between(0.06, 0.22)), Math.floor(between(0, 4)));
    if (hard) place(BIG, Math.round(area * between(0.03, 0.09)), Math.floor(between(1, 4)), 2);
    place(WHIRL, Math.round(area * between(0.008, 0.045)), 0);
    // The boat starts somewhere between halfway out and the edge: first a random distance, then a spot at that
    // distance, so the edge is no more likely than anywhere else.
    var starts = [], ring = Math.ceil(c / 2) + Math.floor(r() * (c - Math.ceil(c / 2) + 1));
    var open = function (x, y) { var k = 0; for (var yy = y - 1; yy <= y + 1; yy++) for (var xx = x - 1; xx <= x + 1; xx++) if ((xx !== x || yy !== y) && xx >= 0 && yy >= 0 && xx < n && yy < n && G.grid[yy * n + xx] === WATER) k++; return k; };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (G.grid[y * n + x] === WATER && cheb(x, y, c, c) === ring && open(x, y) >= 3) starts.push([x, y]);
    if (!starts.length) return null;
    var s = starts[Math.floor(r() * starts.length)];
    G.boat = { x: s[0], y: s[1] };
    var d = distances(G, s[0], s[1]), room = 0;
    for (i = 0; i < area; i++) if (d[i] >= 0) room++;
    if (room < 8) return null;
    var spots = [];
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (G.grid[y * n + x] === WATER && !nearLight(x, y) && !(x === s[0] && y === s[1])) spots.push([x, y]);
    var take = function (ok) {
      for (var t = 0; t < 300 && spots.length; t++) {
        var k = Math.floor(r() * spots.length), p = spots[k];
        if (ok(p[0], p[1])) { spots.splice(k, 1); return p; }
      }
      return null;
    };
    var nBarrels = Math.round(area * between(0, 0.03));
    for (i = 0; i < nBarrels; i++) {
      var b = take(function () { return true; });
      if (b) G.barrels.push({ x: b[0], y: b[1], kind: r() < 0.5 ? 'life' : 'flare', taken: false });
    }
    G.startFlares = Math.floor(between(0, 3));
    // Serpents are the one thing that is not left to chance: a set number for each size, starting away from the boat.
    var nSerpents = (hard ? [3, 4, 5] : [2, 3, 4])[size] || 3;
    for (i = 0; i < nSerpents; i++) {
      var p = take(function (x, y) { return cheb(x, y, s[0], s[1]) >= 5; });
      if (p) G.serpents.push({ x: p[0], y: p[1], frozen: false, id: i, hunt: null, goal: null });
    }
    G.nextSerpent = G.serpents.length;
    return G;
  }

  function create(seed, opts) {
    opts = opts || {};
    var size = opts.size === undefined ? 1 : opts.size | 0, hard = !!opts.hard, G = null;
    for (var a = 0; a < 400 && !G; a++) G = tryMap(seed, size, hard, a);
    if (!G) throw new Error('no map');
    G.seed = seed | 0; G.size = size; G.hard = hard;
    G.round = 0; G.lives = 3; G.flares = G.startFlares; G.sail = true;
    G.beam = -1; G.lit = []; G.litOut = []; G.lastLit = []; G.lastLitOut = []; G.flare = false; G.flareUsed = false;
    G.ended = null; G.moves = 0; G.hits = 0;
    G.keeperSeen = {}; G.boatSeen = {};
    G.lampOut = false; G.waited = false;
    G.phase = 'keeper';
    G.wind = G.hard ? Math.floor(rngFor(G.seed, 0, SALT.wind)() * 4) : -1;
    G.waves = wavesFor(G);
    G.outWaves = outWavesFor(G);
    rememberBoat(G);
    return G;
  }

  /* ---------- Waves, wind and the lamp ---------- */
  // Every round the sea changes: a random share of the tiles carry a wave, each in a random direction.
  // Never under the boat or a barrel. Next to the boat there are always waves going at least two different ways
  // the boat can really go (not into a rock, a serpent, the lighthouse or off the map), unless the boat is boxed
  // in so tightly that fewer ways are open.
  function wavesFor(G) {
    var r = rngFor(G.seed, G.round, SALT.waves), w = [], share = 0.3 + r() * 0.22;
    for (var i = 0; i < G.n * G.n; i++) {
      var x = i % G.n, y = Math.floor(i / G.n), on = G.grid[i] === WATER && r() < share, d = Math.floor(r() * 4);
      w.push(on && barrelAt(G, x, y) < 0 && !(x === G.boat.x && y === G.boat.y) ? d : -1);
    }
    var open = [];
    for (var d0 = 0; d0 < 4; d0++) { var ox = G.boat.x + DX[d0], oy = G.boat.y + DY[d0]; if (inside(G, ox, oy) && sailable(G.grid[oy * G.n + ox]) && serpentAt(G, ox, oy) < 0) open.push(d0); }
    var near = [], spare = [];
    for (var yy = G.boat.y - 1; yy <= G.boat.y + 1; yy++) for (var xx = G.boat.x - 1; xx <= G.boat.x + 1; xx++) {
      if (!inside(G, xx, yy) || (xx === G.boat.x && yy === G.boat.y) || G.grid[yy * G.n + xx] !== WATER) continue;
      if (barrelAt(G, xx, yy) >= 0) spare.push(yy * G.n + xx); else near.push(yy * G.n + xx);
    }
    // Hemmed in by rocks, the boat may get a wave on a barrel tile too.
    if (near.length < 2) near = near.concat(spare);
    var good = function () { var g = {}; near.forEach(function (q) { if (w[q] >= 0 && open.indexOf(w[q]) >= 0) g[w[q]] = (g[w[q]] || 0) + 1; }); return g; };
    var need = Math.min(2, open.length, near.length);
    for (var t = 0; t < 40; t++) {
      var g = good(), have = Object.keys(g).length;
      if (have >= need) break;
      var missing = open.filter(function (q) { return !g[q]; }), d2 = missing[Math.floor(r() * missing.length)];
      // Put it on an empty tile, or on one whose wave leads nowhere, or one that repeats another good wave.
      var spots = near.filter(function (q) { return w[q] < 0; });
      if (!spots.length) spots = near.filter(function (q) { return open.indexOf(w[q]) < 0; });
      if (!spots.length) spots = near.filter(function (q) { return g[w[q]] > 1; });
      if (!spots.length) break;
      w[spots[Math.floor(r() * spots.length)]] = d2;
    }
    return w;
  }
  // Hard only: waves on the open water just outside the map, so it looks like any other part of the sea.
  function outWavesFor(G) {
    if (!G.hard) return null;
    var r = rngFor(G.seed, G.round, SALT.edge), P = G.n + 2 * EDGE, out = [], share = 0.3 + r() * 0.22;
    for (var k = 0; k < P * P; k++) { var xy = outXY(G, k), on = !inside(G, xy[0], xy[1]) && r() < share, d = Math.floor(r() * 4); out.push(on ? d : -1); }
    return out;
  }
  // Hard only. Each round there is a chance the wind turns.
  function windFor(G) {
    if (!G.hard) return -1;
    var r = rngFor(G.seed, G.round, SALT.wind);
    return r() < 0.22 ? (G.wind + 1 + Math.floor(r() * 3)) % 4 : G.wind;
  }
  // Hard only: the lamp is faulty. It goes out after every shine, and the keeper has to rekindle it.
  function lampWorks(G) { return !G.hard || !G.lampOut; }

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
  // Hard: the tiles outside the map that the beam lights, so its path does not stop at the edge.
  function beamOut(G, dir) {
    if (dir < 0 || !G.hard) return [];
    var a = dir * 2 * Math.PI / BEAM_STEPS, ux = Math.sin(a), uy = -Math.cos(a), out = [];
    for (var y = -EDGE; y < G.n + EDGE; y++) for (var x = -EDGE; x < G.n + EDGE; x++) {
      if (inside(G, x, y)) continue;
      var dx = x - G.c, dy = y - G.c, along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
      if (along <= 0.2) continue;
      if ((Math.atan2(across, along) <= BEAM_HALF || across <= BEAM_CORE) && lineClear(G, G.c, G.c, x, y)) out.push(outKey(G, x, y));
    }
    return out;
  }
  function isLit(G, x, y) { return inside(G, x, y) ? G.lit.indexOf(y * G.n + x) >= 0 : (G.litOut || []).indexOf(outKey(G, x, y)) >= 0; }
  // What the captain sees: the tiles around the boat (two around with a flare), and the whole beam when it
  // touches the boat or a tile next to it. On Hard, tiles outside the map are seen the same way (in `out`).
  function boatView(G) {
    var seen = {}, out = {}, R = G.flare ? 2 : 1, bx = G.boat.x, by = G.boat.y, touched = false;
    for (var y = by - R; y <= by + R; y++) for (var x = bx - R; x <= bx + R; x++) {
      var ins = inside(G, x, y);
      if (!ins && !G.hard) continue;
      if (R > 1 && cheb(x, y, bx, by) > 1 && !lineClear(G, bx, by, x, y)) continue;
      if (ins) seen[y * G.n + x] = 1; else out[outKey(G, x, y)] = 1;
      if (cheb(x, y, bx, by) <= 1 && isLit(G, x, y)) touched = true;
    }
    // Tall rocks also hide parts of the lit path from the captain.
    if (touched) {
      G.lit.forEach(function (i) { var x = i % G.n, y = (i - x) / G.n; if (lineClear(G, bx, by, x, y)) seen[i] = 1; });
      (G.litOut || []).forEach(function (k) { var xy = outXY(G, k); if (lineClear(G, bx, by, xy[0], xy[1])) out[k] = 1; });
    }
    return { cells: seen, out: out, touched: touched };
  }
  function keeperView(G) {
    var seen = {}, out = {};
    G.lit.forEach(function (i) { seen[i] = 1; });
    (G.litOut || []).forEach(function (k) { out[k] = 1; });
    return { cells: seen, out: out, boat: isLit(G, G.boat.x, G.boat.y) };
  }
  function rememberBoat(G) { var v = boatView(G).cells; for (var k in v) G.boatSeen[k] = 1; }

  /* ---------- Actions ---------- */
  // Waves the captain can use: any wave the captain can see (around the boat, further with a flare, or along the
  // keeper's beam when it touches the boat). The boat moves the way that wave goes.
  function catchable(G) {
    var out = [], v = boatView(G);
    for (var k in v.cells) { var i = +k, w = G.waves[i]; if (w >= 0) out.push({ x: i % G.n, y: Math.floor(i / G.n), dir: w }); }
    for (var k2 in v.out) { var xy = outXY(G, +k2), w2 = waveAt(G, xy[0], xy[1]); if (w2 >= 0) out.push({ x: xy[0], y: xy[1], dir: w2 }); }
    return out;
  }
  // How far a wave carries the boat in one move: one tile, or on Hard two tiles with the wind behind a raised sail,
  // and none against it.
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
  // A serpent that bites the boat dives and is gone. A new one appears somewhere at random in the dark
  // (never right next to the boat).
  function replaceSerpent(G, s, log) {
    var r = rngFor(G.seed, G.round * 31 + s.id, SALT.respawn), spot = null;
    for (var t = 0; t < 200 && !spot; t++) {
      var x = Math.floor(r() * G.n), y = Math.floor(r() * G.n);
      if (G.grid[y * G.n + x] !== WATER || cheb(x, y, G.c, G.c) <= 1 || serpentAt(G, x, y) >= 0 || barrelAt(G, x, y) >= 0 || cheb(x, y, G.boat.x, G.boat.y) < 3) continue;
      spot = [x, y];
    }
    G.serpents.splice(G.serpents.indexOf(s), 1);
    var fresh = spot ? { x: spot[0], y: spot[1], frozen: false, id: G.nextSerpent++, hunt: null, goal: null } : null;
    if (fresh) G.serpents.push(fresh);
    log.dives.push({ id: s.id, from: [s.x, s.y], to: spot, newId: fresh ? fresh.id : -1 });
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
        replaceSerpent(G, G.serpents[si], log);
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
  // Serpents hunt. Each one sees the 3x3 tiles around itself: when the boat is there, it goes for it. When it has
  // lost the boat, it heads for where it last saw it; with no idea at all, it roams to random spots of the sea.
  function serpentOk(G, x, y) { return sailable(cell(G, x, y)) && cheb(x, y, G.c, G.c) > 1 && barrelAt(G, x, y) < 0; }
  function firstStep(G, s, tx, ty) {
    var n = G.n, prev = {}, q = [[s.x, s.y]], seen = {}, key = function (x, y) { return y * n + x; };
    seen[key(s.x, s.y)] = 1;
    for (var h = 0; h < q.length; h++) {
      var x = q[h][0], y = q[h][1];
      if (x === tx && y === ty) {
        var k2 = key(x, y);
        while (prev[k2] && prev[k2].from !== key(s.x, s.y)) k2 = prev[k2].from;
        return prev[k2] ? prev[k2].dir : -1;
      }
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d], k = key(nx, ny);
        if (seen[k] || !(serpentOk(G, nx, ny) || (nx === tx && ny === ty && inside(G, nx, ny)))) continue;
        seen[k] = 1; prev[k] = { from: key(x, y), dir: d }; q.push([nx, ny]);
      }
    }
    return -1;
  }
  // Serpents take two steps a round (three on Hard), one tile at a time, and choose their way again at every
  // step: one that spots the boat halfway through its move turns towards it.
  function moveSerpents(G, log) {
    var steps = G.hard ? 3 : 2;
    G.serpents.slice().forEach(function (s) {
      if (G.serpents.indexOf(s) < 0) return;
      if (s.frozen || G.ended) return;
      var r = rngFor(G.seed, G.round * 17 + s.id, SALT.serpent), path = [[s.x, s.y]];
      for (var i = 0; i < steps; i++) {
        if (cheb(s.x, s.y, G.boat.x, G.boat.y) <= 1) { s.hunt = [G.boat.x, G.boat.y]; if ((log.spotted || []).indexOf(s.id) < 0) log.spotted = (log.spotted || []).concat([s.id]); }
        var target = s.hunt || s.goal;
        if (target && target[0] === s.x && target[1] === s.y) { s.hunt = null; s.goal = null; target = null; }
        for (var t = 0; !target && t < 40; t++) {
          var gx = Math.floor(r() * G.n), gy = Math.floor(r() * G.n);
          if (serpentOk(G, gx, gy) && cheb(gx, gy, s.x, s.y) >= 3) target = s.goal = [gx, gy];
        }
        var dir = target ? firstStep(G, s, target[0], target[1]) : -1;
        if (dir < 0) {
          s.goal = null; s.hunt = null;
          var opts = []; for (var k = 0; k < 4; k++) if (serpentOk(G, s.x + DX[k], s.y + DY[k]) && serpentAt(G, s.x + DX[k], s.y + DY[k]) < 0) opts.push(k);
          if (!opts.length) break;
          dir = opts[Math.floor(r() * opts.length)];
        }
        var nx = s.x + DX[dir], ny = s.y + DY[dir], onBoat = nx === G.boat.x && ny === G.boat.y;
        if (!onBoat && (!serpentOk(G, nx, ny) || serpentAt(G, nx, ny) >= 0)) break;
        s.x = nx; s.y = ny; path.push([nx, ny]);
        if (onBoat) {
          log.serpents.push({ id: s.id, path: path });
          hurt(G, log, 'serpent', nx, ny);
          replaceSerpent(G, s, log);
          return;
        }
      }
      log.serpents.push({ id: s.id, path: path });
    });
  }
  function canWait(G) { return !G.hard || !G.waited || !catchable(G).length; }
  function docked(G) { return cheb(G.boat.x, G.boat.y, G.c, G.c) === 1; }
  function endRound(G, log) {
    G.round++;
    G.flare = false; G.flareUsed = false;
    G.serpents.forEach(function (s) { s.frozen = false; });
    // The keeper remembers last round's lit tiles for one round only.
    G.lastLit = G.lit; G.lastLitOut = G.litOut || [];
    G.lit = []; G.litOut = []; G.beam = -1;
    G.wind = windFor(G);
    G.waves = wavesFor(G);
    G.outWaves = outWavesFor(G);
    G.phase = 'keeper';
    log.round = G.round;
    rememberBoat(G);
  }

  // Applies one action. role is 'keeper' or 'boat'. Returns { ok, log } or { ok: false, why }.
  function apply(G, role, act) {
    if (G.ended) return { ok: false, why: 'ended' };
    if (!act || typeof act.a !== 'string') return { ok: false, why: 'bad' };
    var log = { a: act.a, role: role, hits: [], barrels: [], whirls: [], dives: [], serpents: [] };
    if (act.a === 'rekindle') {
      // Hard: the light is out. Rekindling it is the keeper's whole turn, and the sea stays dark this round.
      if (role !== 'keeper' || G.phase !== 'keeper') return { ok: false, why: 'turn' };
      if (!G.lampOut) return { ok: false, why: 'lit' };
      G.lampOut = false; G.phase = 'boat';
      G.serpents.forEach(function (s) { s.frozen = false; });
      rememberBoat(G);
      return { ok: true, log: log };
    }
    if (act.a === 'beam') {
      if (role !== 'keeper' || G.phase !== 'keeper') return { ok: false, why: 'turn' };
      if (G.lampOut) return { ok: false, why: 'out' };
      var d = act.dir | 0;
      if (d < 0 || d >= BEAM_STEPS) return { ok: false, why: 'bad' };
      G.beam = d; G.lit = beamCells(G, d); G.litOut = beamOut(G, d);
      G.lit.forEach(function (i) { G.keeperSeen[i] = 1; });
      // Serpents caught in the light dive and stay still this round; bubbles show where they are.
      G.serpents.forEach(function (s) { s.frozen = isLit(G, s.x, s.y); });
      G.phase = 'boat';
      if (G.hard) G.lampOut = true;
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
      // Hard: the captain cannot wait two rounds in a row, unless there is no wave to catch.
      if (act.a === 'wait' && !canWait(G)) return { ok: false, why: 'nowait' };
      G.waited = act.a === 'wait';
      if (act.a === 'move') {
        var x = act.x | 0, y = act.y | 0;
        var bv = boatView(G);
        if (inside(G, x, y) ? !bv.cells[y * G.n + x] : !bv.out[outKey(G, x, y)]) return { ok: false, why: 'far' };
        var w = waveAt(G, x, y);
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
    catchable: catchable, stepsFor: stepsFor, lampWorks: lampWorks, canWait: canWait, isLit: isLit, serpentAt: serpentAt, barrelAt: barrelAt,
    cell: cell, inside: inside, cheb: cheb, distances: distances, waveAt: waveAt, outKey: outKey, outXY: outXY, EDGE: EDGE,
    DX: DX, DY: DY, WATER: WATER, ROCK: ROCK, BIG: BIG, WHIRL: WHIRL, LIGHT: LIGHT,
    SIZES: SIZES, SIZE_NAMES: SIZE_NAMES, BEAM_STEPS: BEAM_STEPS
  };
});
