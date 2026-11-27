/* Guiding Light 3.0: the rules, shared by the phones and the room server.
   Two players, online. The keeper (seat 0) has an empty sea chart and the lighthouse: each turn the beam shows the
   real sea for 7.5 seconds, then the keeper draws what they remember on the chart. The captain (seat 1) never sees
   the sea itself: only the chart the keeper drew, and a radar with the boat's coordinates, deep treasure and serpents.
   Rocks are there whether or not anyone drew them. Gusts of wind come and go: a boat sailing into one is blown one
   tile further. Only the keeper's light shows them. Lives are sailors: a crash or a bite costs one.
   Treasure: half lies deep (only the radar sees it), half floats (only the light shows it). Any of it counts if the
   boat sails over it. A win with every treasure found is perfect. The boat wins by sailing into the lighthouse itself.
   While drawing, the keeper can throw one trap a turn onto the sea. It lasts 3 turns: a serpent that swims onto it or
   next to it (diagonals too) is stunned for 3 turns. A stunned serpent sinks out of reach and cannot bite.
   A turn: the captain presses Next turn -> light (7.5 s) -> the keeper writes (30 s, or Done) -> the captain plans up
   to 3 moves (2 on Hard) and sails (30 s, or Ready) -> the boat sails, the serpents swim -> Next turn again.
   Plain functions on a plain object: the server replays the same actions to check them. Timing is the server's job:
   it only lets a timed step end ('advance') once its time is up. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindGuide3 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WATER = 0, ROCK = 1, TALL = 2, WHIRL = 3, LIGHT = 4;
  var SIZES = [11, 13, 15], SIZE_NAMES = ['Small', 'Medium', 'Large'];
  var PHASE_MS = { light: 7500, write: 30000, boat: 30000 };
  var ICONS = ['rock', 'tall', 'whirl', 'wind-n', 'wind-e', 'wind-s', 'wind-w', 'treasure', 'serpent', 'clear', 'danger'];
  var WIND = { chance: [0.4, 0.55], max: [2, 3], turns: 3 };
  var TRAP = { turns: 3, stun: 3 };
  var DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  var RADAR = 3.5;          // the captain's radar: a circle this many squares wide around the boat; a square counts if its middle is inside
  var BEAM_HALF = 20 * Math.PI / 180;

  function rngFor(seed, salt) {
    var a = (seed ^ Math.imul(salt + 1, 0x9E3779B1)) >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function inside(G, x, y) { return x >= 0 && y >= 0 && x < G.n && y < G.n; }
  function cell(G, x, y) { return inside(G, x, y) ? G.grid[y * G.n + x] : -1; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function sailable(t) { return t === WATER || t === WHIRL; }
  function coord(x, y) { return String.fromCharCode(65 + x) + (y + 1); }
  // A straight line of sight: only tall rocks (and the lighthouse itself) stop light.
  function lineClear(G, ax, ay, bx, by) {
    var n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3;
    for (var i = 1; i < n; i++) {
      var x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
      if ((x !== ax || y !== ay) && (x !== bx || y !== by) && cell(G, x, y) === TALL) return false;
    }
    return true;
  }
  // The tiles the beam lights when aimed at an angle (radians, 0 = north, clockwise).
  function litCells(G, angle) {
    var ux = Math.sin(angle), uy = -Math.cos(angle), out = [];
    for (var y = 0; y < G.n; y++) for (var x = 0; x < G.n; x++) {
      var dx = x - G.c, dy = y - G.c, along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
      if (along <= 0.3) continue;
      if ((Math.atan2(across, along) <= BEAM_HALF || across <= 0.8) && lineClear(G, G.c, G.c, x, y)) out.push(y * G.n + x);
    }
    return out;
  }
  function serpentAt(G, x, y) { for (var i = 0; i < G.serpents.length; i++) if (G.serpents[i].x === x && G.serpents[i].y === y) return G.serpents[i]; return null; }
  function trapNear(G, x, y) { for (var i = 0; i < G.traps.length; i++) if (cheb(G.traps[i].x, G.traps[i].y, x, y) <= 1) return G.traps[i]; return null; }
  function treasureAt(G, x, y) { for (var i = 0; i < G.treasure.length; i++) if (!G.treasure[i].got && G.treasure[i].x === x && G.treasure[i].y === y) return G.treasure[i]; return null; }
  function windAt(G, x, y) { for (var i = 0; i < G.winds.length; i++) if (G.winds[i].x === x && G.winds[i].y === y) return G.winds[i]; return null; }
  // The first step of a shortest route over open water (whirlpools are avoided), or null.
  function firstStep(G, fx, fy, tx, ty, avoid) {
    var q = [[tx, ty]], seen = {}; seen[ty * G.n + tx] = 1;
    while (q.length) {
      var p = q.shift();
      for (var d = 0; d < 4; d++) {
        var x = p[0] + [0, 1, 0, -1][d], y = p[1] + [-1, 0, 1, 0][d], k = y * G.n + x;
        if (seen[k] || !inside(G, x, y)) continue;
        if (x === fx && y === fy) return p;
        if (cell(G, x, y) !== WATER || (avoid && avoid(x, y))) continue;
        seen[k] = 1; q.push([x, y]);
      }
    }
    return null;
  }
  function reach(G, fx, fy) {
    var dist = {}, q = [[fx, fy]]; dist[fy * G.n + fx] = 0;
    while (q.length) {
      var p = q.shift();
      for (var d = 0; d < 4; d++) {
        var x = p[0] + [0, 1, 0, -1][d], y = p[1] + [-1, 0, 1, 0][d], k = y * G.n + x;
        if (!inside(G, x, y) || dist[k] !== undefined || cell(G, x, y) !== WATER) continue;
        dist[k] = dist[p[1] * G.n + p[0]] + 1; q.push([x, y]);
      }
    }
    return dist;
  }

  function tryMap(seed, size, hard, attempt) {
    var r = rngFor(seed + attempt * 7919, 1), n = SIZES[size] || 13, c = (n - 1) / 2, G = { v: 3, seed: seed, size: size, hard: !!hard, n: n, c: c, grid: [] };
    for (var i = 0; i < n * n; i++) G.grid.push(WATER);
    var area = n * n, put = function (t, count) {
      for (var k = 0, tries = 0; k < count && tries < 5000; tries++) {
        var x = Math.floor(r() * n), y = Math.floor(r() * n);
        if (cheb(x, y, c, c) <= 1 || G.grid[y * n + x] !== WATER) continue;
        G.grid[y * n + x] = t; k++;
        // Rocks like company: a low rock often has a neighbour.
        if (t === ROCK && r() < 0.45) { var d = Math.floor(r() * 4), xx = x + [0, 1, 0, -1][d], yy = y + [-1, 0, 1, 0][d]; if (inside(G, xx, yy) && cheb(xx, yy, c, c) > 1 && G.grid[yy * n + xx] === WATER) { G.grid[yy * n + xx] = ROCK; k++; } }
      }
    };
    put(ROCK, Math.round(area * (hard ? 0.15 : 0.12)));
    put(TALL, Math.round(area * (hard ? 0.06 : 0.035)));
    put(WHIRL, Math.round(area * (hard ? 0.03 : 0.02)) + 1);
    G.grid[c * n + c] = LIGHT;
    // The boat starts out in the far half of the sea, somewhere it can still sail home from.
    var home = reach(G, c, c - 2), starts = [];
    var dock = function (dist) { var best = Infinity; for (var yy = c - 1; yy <= c + 1; yy++) for (var xx = c - 1; xx <= c + 1; xx++) { var v = dist[yy * n + xx]; if (v !== undefined && v < best) best = v; } return best; };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (G.grid[y * n + x] !== WATER || cheb(x, y, c, c) < Math.ceil(c * 0.65)) continue;
      if (dock(reach(G, x, y)) < Infinity) starts.push([x, y]);
    }
    if (!starts.length) return null;
    var s = starts[Math.floor(r() * starts.length)];
    G.boat = { x: s[0], y: s[1] };
    var fromBoat = reach(G, s[0], s[1]);
    var free = function (x, y, far) { return G.grid[y * n + x] === WATER && fromBoat[y * n + x] !== undefined && cheb(x, y, s[0], s[1]) >= far && cheb(x, y, c, c) > 1; };
    G.treasure = [];
    // Half the treasure lies deep (the radar finds it), half floats on the surface (the light finds it).
    var each = size === 2 ? 3 : 2;
    for (var t = 0, tt = 0; t < each * 2 && tt < 3000; tt++) {
      var tx = Math.floor(r() * n), ty = Math.floor(r() * n);
      if (!free(tx, ty, 2) || G.treasure.some(function (q) { return cheb(q.x, q.y, tx, ty) < 3; })) continue;
      G.treasure.push({ x: tx, y: ty, got: false, deep: t % 2 === 0 }); t++;
    }
    G.serpents = [];
    for (var sp = 0, st = 0; sp < (hard ? [2, 3, 4] : [1, 2, 3])[size] && st < 3000; st++) {
      var sx = Math.floor(r() * n), sy = Math.floor(r() * n);
      if (!free(sx, sy, 5) || serpentAt(G, sx, sy) || treasureAt(G, sx, sy)) continue;
      G.serpents.push({ id: sp, x: sx, y: sy, goal: null }); sp++;
    }
    return G;
  }
  function create(seed, opts) {
    opts = opts || {};
    var G = null;
    for (var a = 0; a < 60 && !G; a++) G = tryMap(seed >>> 0, opts.size | 0, !!opts.hard, a);
    G.lives = G.hard ? 2 : 3; G.maxLives = G.lives; G.steps = G.hard ? 2 : 3;
    G.winds = []; G.traps = []; G.trapTurn = 0; G.marks = {}; G.phase = 'start'; G.turn = 0; G.plan = ''; G.ended = null; G.got = 0; G.last = null; G.ping = null; G.pings = 0; G.nextSerpent = G.serpents.length;
    return G;
  }

  function apply(G, role, act) {
    if (!act || typeof act !== 'object') return { ok: false, why: 'bad' };
    if (G.ended) return { ok: false, why: 'ended' };
    var a = act.a;
    if (a === 'ping') {
      if (!inside(G, act.x | 0, act.y | 0)) return { ok: false, why: 'bad' };
      G.pings++; G.ping = { role: role, x: act.x | 0, y: act.y | 0, n: G.pings };
      return { ok: true };
    }
    if (a === 'next') {
      if (role !== 'boat' || (G.phase !== 'start' && G.phase !== 'next')) return { ok: false, why: 'turn' };
      G.turn++; G.phase = 'light'; G.plan = ''; G.last = null;
      gusts(G);
      G.traps = G.traps.filter(function (t) { return t.until >= G.turn; });
      return { ok: true };
    }
    if (a === 'advance') {
      // Time is up for the step in progress (the server checks the clock). Anyone may call it, once.
      if (act.p !== G.phase || !PHASE_MS[G.phase]) return { ok: false, why: 'stale' };
      if (G.phase === 'light') G.phase = 'write';
      else if (G.phase === 'write') G.phase = 'boat';
      else sail(G);
      return { ok: true };
    }
    if (a === 'mark') {
      if (role !== 'keeper' || G.phase !== 'write') return { ok: false, why: 'turn' };
      var x = act.x | 0, y = act.y | 0, k = y * G.n + x;
      if (!inside(G, x, y) || (x === G.c && y === G.c)) return { ok: false, why: 'bad' };
      if (act.icon === 'erase') delete G.marks[k];
      else if (ICONS.indexOf(act.icon) >= 0) G.marks[k] = act.icon;
      else return { ok: false, why: 'bad' };
      return { ok: true };
    }
    if (a === 'trap') {
      // One trap a turn, thrown while drawing. It lands on any square but the lighthouse.
      if (role !== 'keeper' || G.phase !== 'write') return { ok: false, why: 'turn' };
      var tx = act.x | 0, ty = act.y | 0;
      if (!inside(G, tx, ty) || (tx === G.c && ty === G.c) || G.trapTurn === G.turn) return { ok: false, why: 'bad' };
      G.traps.push({ x: tx, y: ty, until: G.turn + TRAP.turns - 1, turn: G.turn }); G.trapTurn = G.turn;
      return { ok: true };
    }
    if (a === 'untrap') {
      // A trap can be taken back on the turn it was thrown, and thrown again somewhere else.
      if (role !== 'keeper' || G.phase !== 'write') return { ok: false, why: 'turn' };
      for (var ti = 0; ti < G.traps.length; ti++) {
        var tr = G.traps[ti];
        if (tr.x === (act.x | 0) && tr.y === (act.y | 0) && tr.turn === G.turn) { G.traps.splice(ti, 1); G.trapTurn = 0; return { ok: true }; }
      }
      return { ok: false, why: 'bad' };
    }
    if (a === 'done') {
      // The keeper may end the light or the chart early.
      if (role !== 'keeper' || (G.phase !== 'write' && G.phase !== 'light')) return { ok: false, why: 'turn' };
      if (G.phase === 'light') { G.phase = 'write'; return { ok: true }; }
      G.phase = 'boat';
      return { ok: true };
    }
    if (a === 'route') {
      if (role !== 'boat' || G.phase !== 'boat') return { ok: false, why: 'turn' };
      var steps = String(act.steps || '').toUpperCase().replace(/[^NESW]/g, '').slice(0, G.steps);
      G.plan = steps;
      return { ok: true };
    }
    if (a === 'ready') {
      if (role !== 'boat' || G.phase !== 'boat') return { ok: false, why: 'turn' };
      sail(G);
      return { ok: true };
    }
    return { ok: false, why: 'bad' };
  }

  // Gusts of wind come and go at the start of each turn. Each blows one way and lasts a few turns.
  function gusts(G) {
    var h = G.hard ? 1 : 0, r = rngFor(G.seed, 2000 + G.turn);
    G.winds = G.winds.filter(function (w) { return w.until >= G.turn; });
    if (G.winds.length >= WIND.max[h] || r() >= WIND.chance[h]) return;
    for (var t = 0; t < 200; t++) {
      var x = Math.floor(r() * G.n), y = Math.floor(r() * G.n);
      if (G.grid[y * G.n + x] !== WATER || cheb(x, y, G.c, G.c) <= 1 || cheb(x, y, G.boat.x, G.boat.y) < 2 || windAt(G, x, y) || treasureAt(G, x, y)) continue;
      G.winds.push({ x: x, y: y, dir: 'NESW'.charAt(Math.floor(r() * 4)), until: G.turn + WIND.turns - 1 });
      return;
    }
  }
  // The boat follows the captain's plan, tile by tile. Rocks are there whether drawn or not: a rock stops the boat
  // and costs a sailor. A whirlpool flings it off somewhere. A gust blows it one tile on, and the plan goes on from
  // there. Reaching the lighthouse ends the trip at once. Then the serpents swim.
  function sail(G) {
    var log = { path: [[G.boat.x, G.boat.y]], events: [], serpents: [], bumped: null };
    var r = rngFor(G.seed, 100 + G.turn);
    for (var i = 0; i < G.plan.length && !G.ended; i++) {
      var d = DIRS[G.plan.charAt(i)];
      if (!enter(G, log, G.boat.x + d[0], G.boat.y + d[1], r, 0)) break;
    }
    if (!G.ended) swim(G, log);
    G.last = log; G.plan = '';
    G.phase = G.ended ? 'over' : 'next';
  }
  // Moves the boat onto a tile. False when the boat's trip ends there.
  function enter(G, log, nx, ny, r, depth) {
    var t = cell(G, nx, ny);
    if (t < 0) { log.events.push({ e: 'edge', x: nx, y: ny }); return false; }
    if (t === LIGHT) {
      // Home: only by sailing into the lighthouse itself, not by passing next to it.
      G.boat.x = nx; G.boat.y = ny; log.path.push([nx, ny]);
      G.ended = 'won'; log.events.push({ e: 'home' });
      return false;
    }
    if (t === ROCK || t === TALL) {
      G.lives--; log.events.push({ e: 'rock', x: nx, y: ny, tall: t === TALL }); log.bumped = [nx, ny];
      if (G.lives <= 0) G.ended = 'lost';
      return false;
    }
    G.boat.x = nx; G.boat.y = ny; log.path.push([nx, ny]);
    if (bite(G, log)) return false;
    collect(G, log);
    if (t === WHIRL) {
      // Spun away: up to three tiles in a random direction, stopping short of rocks and the edge.
      var dir = Math.floor(r() * 8), ddx = [0, 1, 1, 1, 0, -1, -1, -1][dir], ddy = [-1, -1, 0, 1, 1, 1, 0, -1][dir];
      log.events.push({ e: 'whirl', x: nx, y: ny });
      for (var k = 0; k < 3; k++) {
        var wx = G.boat.x + ddx, wy = G.boat.y + ddy;
        if (cell(G, wx, wy) !== WATER) break;
        G.boat.x = wx; G.boat.y = wy; log.path.push([wx, wy]);
        if (bite(G, log)) break;
        collect(G, log);
      }
      return false;
    }
    var w = windAt(G, nx, ny);
    if (w && depth < 3) {
      var wd = DIRS[w.dir];
      log.events.push({ e: 'wind', x: nx, y: ny, dir: w.dir });
      return enter(G, log, nx + wd[0], ny + wd[1], r, depth + 1);
    }
    return true;
  }
  function collect(G, log) {
    var t = treasureAt(G, G.boat.x, G.boat.y);
    if (t) { t.got = true; G.got++; log.events.push({ e: 'treasure', x: t.x, y: t.y }); }
  }
  function bite(G, log) {
    var s = serpentAt(G, G.boat.x, G.boat.y);
    if (!s || s.stun) return false;
    G.lives--; log.events.push({ e: 'bite', x: s.x, y: s.y });
    respawn(G, s);
    if (G.lives <= 0) G.ended = 'lost';
    return true;
  }
  function respawn(G, s) {
    var r = rngFor(G.seed, 500 + G.turn * 13 + s.id);
    for (var t = 0; t < 400; t++) {
      var x = Math.floor(r() * G.n), y = Math.floor(r() * G.n);
      if (G.grid[y * G.n + x] !== WATER || cheb(x, y, G.boat.x, G.boat.y) < 5 || serpentAt(G, x, y) || cheb(x, y, G.c, G.c) <= 1) continue;
      s.x = x; s.y = y; s.goal = null; s.stun = 0; return;
    }
  }
  // Serpents take one step a turn (two on Hard). Within three tiles of the boat they hunt it; otherwise they roam.
  function swim(G, log) {
    var steps = G.hard ? 2 : 1, r = rngFor(G.seed, 900 + G.turn);
    G.serpents.forEach(function (s) {
      var path = [[s.x, s.y]];
      // A stunned serpent stays down, out of reach, for its turns.
      if (s.stun) { s.stun--; log.serpents.push({ id: s.id, path: path, stun: s.stun }); return; }
      for (var i = 0; i < steps && !G.ended; i++) {
        var hunt = cheb(s.x, s.y, G.boat.x, G.boat.y) <= 3, target = hunt ? [G.boat.x, G.boat.y] : s.goal;
        if (!hunt && (!target || (target[0] === s.x && target[1] === s.y))) {
          for (var t = 0; t < 40; t++) { var gx = Math.floor(r() * G.n), gy = Math.floor(r() * G.n); if (G.grid[gy * G.n + gx] === WATER && cheb(gx, gy, G.c, G.c) > 1) { target = s.goal = [gx, gy]; break; } }
        }
        if (!target) break;
        var step = firstStep(G, s.x, s.y, target[0], target[1], function (x, y) { var o = serpentAt(G, x, y); return o && o !== s; });
        if (!step) { s.goal = null; break; }
        s.x = step[0]; s.y = step[1]; path.push(step);
        if (trapNear(G, s.x, s.y)) { s.stun = TRAP.stun; s.goal = null; log.events.push({ e: 'stun', x: s.x, y: s.y }); break; }
        if (s.x === G.boat.x && s.y === G.boat.y) {
          G.lives--; log.events.push({ e: 'bite', x: s.x, y: s.y });
          log.serpents.push({ id: s.id, path: path }); path = null;
          respawn(G, s);
          if (G.lives <= 0) G.ended = 'lost';
          break;
        }
      }
      if (path) log.serpents.push({ id: s.id, path: path });
    });
  }
  // Is this square inside the radar's circle around the boat? (37 squares: the 7 x 7 block without its corners.)
  function inRadar(G, x, y) { var dx = x - G.boat.x, dy = y - G.boat.y; return dx * dx + dy * dy <= RADAR * RADAR; }
  // What the captain's radar shows: blips inside its circle (treasure not yet found, serpents).
  function radar(G) {
    var out = [];
    G.treasure.forEach(function (t) { if (!t.got && t.deep && inRadar(G, t.x, t.y)) out.push({ kind: 'treasure', x: t.x, y: t.y }); });
    G.serpents.forEach(function (s) { if (inRadar(G, s.x, s.y)) out.push({ kind: 'serpent', x: s.x, y: s.y, id: s.id, stun: s.stun || 0 }); });
    return out;
  }
  function replay(seed, opts, actions) {
    var G = create(seed, opts);
    (actions || []).forEach(function (x) { apply(G, x.role, x.act); });
    return G;
  }
  // The tiles a plan would pass through, from the boat (for drawing the planned route).
  function planPath(G, steps) {
    var x = G.boat.x, y = G.boat.y, out = [[x, y]];
    String(steps || '').split('').forEach(function (ch) { var d = DIRS[ch]; if (!d) return; x += d[0]; y += d[1]; out.push([x, y]); });
    return out;
  }

  return { create: create, apply: apply, replay: replay, litCells: litCells, radar: radar, inRadar: inRadar, planPath: planPath, windAt: windAt, trapNear: trapNear, coord: coord, cell: cell, inside: inside, cheb: cheb,
    WATER: WATER, ROCK: ROCK, TALL: TALL, WHIRL: WHIRL, LIGHT: LIGHT, SIZES: SIZES, SIZE_NAMES: SIZE_NAMES, PHASE_MS: PHASE_MS, ICONS: ICONS, RADAR: RADAR, DIRS: DIRS, TRAP: TRAP };
});
