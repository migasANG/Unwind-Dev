// Unwind game rules. No DOM access, so the same file runs in the browser and in Node tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UnwindEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Directions run clockwise: 0 up, 1 right, 2 down, 3 left.
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, r) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = list[i];
      list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  // Builds the cell lookup used by every rule check.
  function prepare(level) {
    var grid = new Array(level.w * level.h).fill(-1);
    level.arrows.forEach(function (a) {
      a.cells.forEach(function (c) { grid[c[1] * level.w + c[0]] = a.id; });
    });
    level.grid = grid;
    level.mirrorAt = {};
    (level.mirrors || []).forEach(function (m) { level.mirrorAt[m.y * level.w + m.x] = m.t; });
    level.arrows.forEach(function (a) { if (!a.baseCells) { a.baseCells = a.cells; a.baseDir = a.dir; } });
    // A flower's position in the queue is the launch on which a bee takes it.
    level.flowerAt = {};
    (level.flowers || []).forEach(function (f, i) { level.flowerAt[f[1] * level.w + f[0]] = i; });
    return level;
  }
  function newState(level) {
    return {
      removed: level.arrows.map(function () { return false; }),
      launches: 0,
      lives: level.lives === null ? null : (level.lives || 3),
      history: [], frozen: {}, burning: {}, snaps: [], eventDone: false, ghostFlip: 0, arrowsRef: level.arrows
    };
  }
  // The season effects a board uses. Pre-made levels have one, and open water can combine several.
  function effectsOf(level) { return level.effects || (level.season ? [level.season] : []); }
  function hasEffect(level, name) { return effectsOf(level).indexOf(name) >= 0; }
  function headOf(a) { return a.cells[a.cells.length - 1]; }
  // A reverse arrow's tip swaps to its other end on every launch, so it can leave from either end.
  function tipAtTail(state, a) { return a.uno !== undefined && (state.launches + a.uno + (state.ghostFlip || 0)) % 2 === 1; }
  function tipOf(a, state) { return tipAtTail(state, a) ? a.cells[0] : headOf(a); }
  function tailDir(a) {
    var dx = a.cells[0][0] - a.cells[1][0], dy = a.cells[0][1] - a.cells[1][1];
    for (var d = 0; d < 4; d++) if (DX[d] === dx && DY[d] === dy) return d;
    return a.dir;
  }
  function dirOf(a, state) { return a.kind === 'compass' ? (a.dir + state.launches) % 4 : tipAtTail(state, a) ? tailDir(a) : a.dir; }
  // Flowers leave in queue order, one per launch. A bee can also take one early if it is all that holds the board up.
  function flowerStands(level, state, key) { return level.flowerAt[key] >= state.launches && !state.noFlowers && !(state.picked && state.picked[key]); }
  function partnerOf(a) { return a.kind === 'twin' ? a.twin : -1; }

  // A mirror turns a travelling arrow 90 degrees. Index by direction of travel.
  var TURN = { '/': [1, 0, 3, 2], '\\': [3, 2, 1, 0] };

  // Walks from the head to the board edge, following mirrors. The arrow's own cells and its twin never block it.
  // path holds every corner, for drawing; endDir is the direction it finally leaves in.
  function check(level, state, a) {
    var d = dirOf(a, state), h = tipOf(a, state), x = h[0], y = h[1], dist = 0, partner = partnerOf(a), path = [], guard = 0, phased = false;
    for (;;) {
      x += DX[d]; y += DY[d]; dist++;
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { clear: true, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      if (++guard > 400) return { clear: false, blocker: a.id, dist: 1, dir: dirOf(a, state), endDir: d, path: [] };
      var key = y * level.w + x;
      var mirror = level.mirrorAt && level.mirrorAt[key];
      if (mirror) { d = TURN[mirror][d]; path.push([x, y]); continue; }
      if (state.burning && state.burning[key] > state.launches) return { clear: false, fire: true, blocker: -2, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      if (level.flowerAt && flowerStands(level, state, key)) return { clear: false, flower: true, flowerKey: key, blocker: -3, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      var o = level.grid[key];
      // Ghost-form arrows are intangible, so everything passes through them.
      if (o !== -1 && !state.removed[o] && isGhost(state, level.arrows[o])) o = -1;
      if (o !== -1 && o !== a.id && o !== partner && !state.removed[o] && a.phase && !phased) {
        // A phase arrow can slip through one occupied tile, but not along an arrow lying in its path.
        var nx = x + DX[d], ny = y + DY[d], next = (nx >= 0 && ny >= 0 && nx < level.w && ny < level.h) ? level.grid[ny * level.w + nx] : -1;
        var nextSolid = next !== -1 && next !== a.id && next !== partner && !state.removed[next] && !isGhost(state, level.arrows[next]);
        if (!nextSolid && !(state.frozen && state.frozen[o] !== undefined)) { phased = true; continue; }
      }
      if (o !== -1 && o !== a.id && o !== partner && !state.removed[o]) return { clear: false, blocker: o, frozen: !!(state.frozen && state.frozen[o] !== undefined), dist: dist, dir: dirOf(a, state), endDir: d, path: path };
    }
  }
  // Ghost arrows swap form on every launch, and can only be played when solid.
  function isGhost(state, a) { return a.ghostPhase !== undefined && (state.launches + a.ghostPhase + (state.ghostFlip || 0)) % 2 === 1; }
  // A red card arrow not played in time is sent off until only sent-off arrows remain.
  function hasRedCard(state, a) { return !!a.red && state.launches >= a.red; }
  function isRedCarded(state, a) {
    if (!hasRedCard(state, a)) return false;
    var list = state.arrowsRef;
    if (!list) return true;
    return !list.every(function (x) { return state.removed[x.id] || hasRedCard(state, x); });
  }
  // Sleepers wait for their key arrow to leave. Patient arrows wait for a number of launches.
  function isReady(state, a) {
    if (a.key !== undefined && !state.removed[a.key]) return false;
    if (a.wait && state.launches < a.wait) return false;
    if (state.frozen && state.frozen[a.id] !== undefined) return false;
    if (isGhost(state, a) || isRedCarded(state, a)) return false;
    return true;
  }
  function group(level, a) {
    return a.kind === 'twin' ? [a, level.arrows[a.twin]] : [a];
  }
  function canLaunch(level, state, id) {
    return group(level, level.arrows[id]).every(function (m) { return isReady(state, m) && check(level, state, m).clear; });
  }

  // A tap: launches the arrow when clear, otherwise reports the collision and costs a life.
  function tap(level, state, id) {
    var members = group(level, level.arrows[id]);
    // Tapping an arrow that is not ready yet is free: nothing moves and no life is lost.
    if (!members.every(function (m) { return isReady(state, m); })) return { ok: false, notReady: true, results: [], failed: false };
    var results = members.map(function (m) { var c = check(level, state, m); c.fromTail = tipAtTail(state, m); return { id: m.id, check: c }; });
    var hit = results.filter(function (r) { return !r.check.clear; });
    // Hitting a frozen arrow cracks it free. The tapped arrow bounces back and no life is lost.
    var ice = hit.filter(function (r) { return r.check.frozen; });
    if (ice.length && ice.length === hit.length) {
      ice.forEach(function (r) { delete state.frozen[r.check.blocker]; });
      // Freed but still hemmed in by fire or more ice: clear them, so effects can never trap the player.
      if (isStuck(level, state)) { state.frozen = {}; state.burning = {}; }
      unstickGhosts(level, state);
      return { ok: false, thawed: ice.map(function (r) { return r.check.blocker; }), results: results, failed: false };
    }
    if (hit.length) {
      if (state.lives !== null) state.lives--;
      return { ok: false, results: results, failed: state.lives === 0 };
    }
    {
      state.snaps = state.snaps || [];
      state.snaps.push({ picked: Object.assign({}, state.picked), ghostFlip: state.ghostFlip, eventDone: state.eventDone, frozen: Object.assign({}, state.frozen), burning: Object.assign({}, state.burning),
        geo: level.arrows.map(function (a) { return { cells: a.cells, dir: a.dir }; }) });
    }
    members.forEach(function (m) { state.removed[m.id] = true; });
    state.history.push(members.map(function (m) { return m.id; }));
    state.launches++;
    unstickGhosts(level, state);
    return { ok: true, results: results, won: state.removed.every(Boolean) };
  }
  // Rewind restores the last launch. Lives stay as they are.
  function rewind(state, level) {
    var last = state.history.pop();
    if (!last) return null;
    last.forEach(function (id) { state.removed[id] = false; });
    state.launches--;
    var snap = state.snaps && state.snaps.pop();
    if (snap && level) {
      state.frozen = snap.frozen; state.burning = snap.burning; state.eventDone = snap.eventDone; state.ghostFlip = snap.ghostFlip; state.picked = snap.picked;
      level.arrows.forEach(function (a, i) { a.cells = snap.geo[i].cells; a.dir = snap.geo[i].dir; });
      rebuildGrid(level, state);
    }
    return last;
  }
  // Cells of arrows still on the board take priority over cells of arrows that have left.
  function rebuildGrid(level, state) {
    var g = new Array(level.w * level.h).fill(-1);
    level.arrows.forEach(function (a) { if (state.removed[a.id]) a.cells.forEach(function (c) { g[c[1] * level.w + c[0]] = a.id; }); });
    level.arrows.forEach(function (a) { if (!state.removed[a.id]) a.cells.forEach(function (c) { g[c[1] * level.w + c[0]] = a.id; }); });
    level.grid = g;
  }
  // If nothing can move and a ghost is waiting, it turns solid so the board never freezes up.
  function unstickGhosts(level, state) {
    if (isWon(state) || !isStuck(level, state)) return false;
    if (level.arrows.some(function (a) { return !state.removed[a.id] && (a.ghostPhase !== undefined || a.uno !== undefined); })) {
      state.ghostFlip = (state.ghostFlip || 0) + 1;
      if (!isStuck(level, state)) return true;
      state.ghostFlip--;
    }
    // Only flowers are in the way: a bee comes early for one, so playing in a different order can't strand the board.
    var guard = 0;
    while (isStuck(level, state) && guard++ < 400) {
      var picked = -1;
      level.arrows.some(function (a) {
        if (state.removed[a.id] || !isReady(state, a)) return false;
        var c = check(level, state, a);
        if (c.flower) { picked = c.flowerKey; return true; }
        return false;
      });
      if (picked < 0) return false;
      state.picked = state.picked || {};
      state.picked[picked] = true;
      (state.pickedNew = state.pickedNew || []).push(picked);
    }
    return !isStuck(level, state);
  }
  function resetBoard(level) {
    level.arrows.forEach(function (a) { a.cells = a.baseCells; a.dir = a.baseDir; });
    prepare(level);
  }
  function legalMoves(level, state) {
    var out = [];
    level.arrows.forEach(function (a) {
      if (state.removed[a.id]) return;
      if (a.kind === 'twin' && a.twin < a.id) return;
      if (canLaunch(level, state, a.id)) out.push(a.id);
    });
    return out;
  }
  function isWon(state) { return state.removed.every(Boolean); }
  // An arrow that would hit a frozen arrow counts as a useful move.
  function iceHits(level, state) {
    var out = [];
    level.arrows.forEach(function (a) {
      if (state.removed[a.id]) return;
      // Counts only if a tap would really crack the ice. Twins must both be ready, with only ice in their way.
      var members = group(level, a);
      if (!members.every(function (m) { return isReady(state, m); })) return;
      var blocked = members.map(function (m) { return check(level, state, m); }).filter(function (c) { return !c.clear; });
      if (blocked.length && blocked.every(function (c) { return c.frozen; })) out.push(a.id);
    });
    return out;
  }
  function isStuck(level, state) { return !isWon(state) && legalMoves(level, state).length === 0 && iceHits(level, state).length === 0; }

  /* ---------- Seasons: what happens after each successful launch ---------- */
  // The roll depends only on the level and the launch number, so a rewound move plays out the same way.
  function liveEmptyCells(level, state) {
    var out = [];
    for (var y = 0; y < level.h; y++) for (var x = 0; x < level.w; x++) {
      var k = y * level.w + x, o = level.grid[k];
      if (level.mirrorAt[k] || flowerStands(level, state, k) || state.burning[k] > state.launches) continue;
      if (o === -1 || state.removed[o]) out.push(k);
    }
    return out;
  }
  function rayCellsOf(level, state, a) {
    var d = dirOf(a, state), h = tipOf(a, state), x = h[0], y = h[1], out = [], guard = 0;
    while (guard++ < 300) {
      x += DX[d]; y += DY[d];
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) break;
      var k = y * level.w + x, mirror = level.mirrorAt[k];
      if (mirror) d = TURN[mirror][d]; else out.push(k);
    }
    return out;
  }
  // The ways an arrow can pivot fully around its tail: quarter turns that fit in free space.
  function pivotOptions(level, state, a) {
    if (a.kind === 'compass') return [];
    var t = a.cells[0], out = [];
    [1, 2, 3].forEach(function (q) {
      var cells = [], ok = true;
      a.cells.forEach(function (c) {
        var dx = c[0] - t[0], dy = c[1] - t[1];
        for (var i = 0; i < q; i++) { var tmp = dx; dx = -dy; dy = tmp; }
        var nx = t[0] + dx, ny = t[1] + dy, k = ny * level.w + nx;
        if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h || level.mirrorAt[k] || flowerStands(level, state, k) || state.burning[k] > state.launches) { ok = false; return; }
        var o = level.grid[k];
        if (o !== -1 && o !== a.id && !state.removed[o]) ok = false;
        cells.push([nx, ny]);
      });
      if (ok) out.push({ quarters: q, cells: cells, dir: (a.dir + q) % 4 });
    });
    return out;
  }
  function seasonStep(level, state) {
    var ev = { triggered: false, forced: false, freeze: [], thaw: [], burn: [], wind: false, rotate: [], cleared: false };
    if (!effectsOf(level).length || isWon(state)) return ev;
    var r = rng32(((level.seed || 7) * 31 + state.launches * 7919 + 13) >>> 0);
    r(); r();
    var live = level.arrows.filter(function (a) { return !state.removed[a.id]; });
    // Pre-made levels promise at least one event. It keeps being retried until one really happens.
    var forced = level.guaranteeAt !== undefined && level.guaranteeAt !== null && !state.eventDone && state.launches >= level.guaranteeAt;
    ev.forced = forced;
    // Frozen arrows thaw by themselves after 3 to 5 launches, or sooner if another arrow hits them.
    Object.keys(state.frozen).forEach(function (id) {
      if (state.removed[id]) { delete state.frozen[id]; return; }
      if (state.launches >= state.frozen[id]) { delete state.frozen[id]; ev.thaw.push(+id); }
    });
    var rollWinter = r(), rollSummer = r(), rollAutumn = r();
    if (hasEffect(level, 'winter') && (rollWinter < 0.2 || forced)) {
      ev.triggered = true;
      var want = 1 + Math.floor(r() * 5), pool = shuffle(live.filter(function (a) { return a.kind !== 'compass' && state.frozen[a.id] === undefined; }), r);
      pool.some(function (a) {
        if (ev.freeze.length >= want) return true;
        if (a.kind === 'twin') return false;
        state.frozen[a.id] = state.launches + 3 + Math.floor(r() * 3);
        if (isStuck(level, state)) delete state.frozen[a.id]; else ev.freeze.push(a.id);
        return false;
      });
    }
    if (hasEffect(level, 'summer') && (rollSummer < 0.25 || forced)) {
      ev.triggered = true;
      // 1 to 5 tiles on a normal map, with more on bigger maps so fire stays noticeable.
      var fireScale = Math.max(1, Math.round(level.w * level.h / 56));
      var tiles = (1 + Math.floor(r() * 5)) * fireScale, turns = 2 + Math.floor(r() * 3), empty = liveEmptyCells(level, state), onPath = {};
      live.forEach(function (a) { rayCellsOf(level, state, a).forEach(function (k) { onPath[k] = 1; }); });
      // Prefer tiles that arrows actually need, so the fire matters.
      var order = shuffle(empty, r).sort(function (x, y) { return (onPath[y] || 0) - (onPath[x] || 0); }).slice(0, tiles);
      order.forEach(function (k) { state.burning[k] = state.launches + turns; ev.burn.push(k); });
      while (ev.burn.length && legalMoves(level, state).length === 0) delete state.burning[ev.burn.pop()];
    }
    if (hasEffect(level, 'autumn') && (rollAutumn < 0.5 || forced)) {
      ev.triggered = true; ev.wind = true;
      var attempts = 0, maxAttempts = level.w * level.h > 900 ? 2 : level.big ? 4 : Infinity, windOrder = shuffle(live.slice(), r);
      var spin = function (a, pick) {
        var options = pivotOptions(level, state, a);
        if (!options.length || attempts >= maxAttempts) return false;
        attempts++;
        var o = options[Math.floor(pick * options.length)], oldCells = a.cells, oldDir = a.dir;
        a.cells = o.cells; a.dir = o.dir; rebuildGrid(level, state);
        var res = solve(level, state, level.w * level.h > 900 ? 800 : level.big ? 1500 : 15000);
        if (res.solved) { ev.rotate.push({ id: a.id, quarters: o.quarters }); return true; }
        a.cells = oldCells; a.dir = oldDir; rebuildGrid(level, state);
        return false;
      };
      windOrder.forEach(function (a) {
        var roll = r(), pick = r();
        if (roll < 0.5) spin(a, pick);
      });
      // A promised gust must really turn something if anything can turn.
      if (forced && !ev.rotate.length) windOrder.some(function (a) { return spin(a, r()); });
    }
    if (ev.freeze.length || ev.burn.length || ev.rotate.length || hasEffect(level, 'spring')) state.eventDone = true;
    // If nothing can move, fire dies and ice melts, so effects alone can never trap the player.
    if (isStuck(level, state) && (Object.keys(state.frozen).length || Object.keys(state.burning).length)) {
      ev.thaw = ev.thaw.concat(Object.keys(state.frozen).map(Number));
      state.frozen = {}; state.burning = {}; ev.cleared = true;
    }
    unstickGhosts(level, state);
    return ev;
  }

  // Depth-first search with memoised dead ends.
  function solve(level, from, budget) {
    var state = { picked: from.picked, removed: from.removed.slice(), launches: from.launches, lives: null, history: [], burning: from.burning ? Object.assign({}, from.burning) : {}, ghostFlip: from.ghostFlip || 0, arrowsRef: level.arrows };
    var hasGhosts = level.arrows.some(function (a) { return a.ghostPhase !== undefined || a.uno !== undefined; }), hasFlowers = !!(level.flowers && level.flowers.length);
    var flipping = false, dead = {}, nodes = 0, limit = budget || 200000, exhausted = false, path = [];
    function dfs() {
      if (isWon(state)) return true;
      var key = state.removed.map(Number).join('') + (hasGhosts ? ((state.launches + state.ghostFlip) % 2) : '') + (state.noFlowers ? 'f' : '');
      if (dead[key]) return false;
      if (++nodes > limit) { exhausted = true; return false; }
      // Moves are looked for one at a time, since boards usually clear on the first path tried.
      var tried = 0, arrows = level.arrows;
      for (var i = 0; i < arrows.length; i++) {
        var cand = arrows[i];
        if (state.removed[cand.id] || (cand.kind === 'twin' && cand.twin < cand.id) || !canLaunch(level, state, cand.id)) continue;
        tried++;
        var members = group(level, cand);
        members.forEach(function (m) { state.removed[m.id] = true; });
        state.launches++; path.push(cand.id);
        if (dfs()) return true;
        path.pop(); state.launches--;
        members.forEach(function (m) { state.removed[m.id] = false; });
        if (exhausted) return false;
      }
      if (!tried && hasGhosts && !flipping) {
        flipping = true; state.ghostFlip++;
        var flipped = dfs();
        state.ghostFlip--; flipping = false;
        if (flipped) { state.ghostFlip++; return true; }
      }
      flipping = false;
      if (!tried && hasFlowers && !state.noFlowers) {
        state.noFlowers = true;
        var freed = dfs();
        state.noFlowers = false;
        if (freed) return true;
      }
      dead[key] = true;
      return false;
    }
    var solved = dfs();
    return { solved: solved, sequence: solved ? path : null, exhausted: exhausted };
  }

  // Share of random legal playthroughs that end stuck.
  function trapRate(level, runs, seed) {
    var r = rng32(seed || 1), stuck = 0;
    for (var i = 0; i < runs; i++) {
      var s = newState(level);
      for (;;) {
        var m = legalMoves(level, s);
        if (!m.length) { if (!isWon(s)) stuck++; break; }
        tap(level, s, m[Math.floor(r() * m.length)]);
      }
    }
    return stuck / runs;
  }
  // Rounds needed if every free arrow leaves at once. Higher means more tangled.
  function depthOf(level) {
    var s = newState(level), depth = 0;
    for (;;) {
      var m = legalMoves(level, s);
      if (!m.length) break;
      depth++;
      if (level.arrows.some(function (a) { return a.kind === 'compass'; })) { tap(level, s, m[0]); continue; }
      m.forEach(function (id) { tap(level, s, id); });
    }
    return depth;
  }

  // Builds a level backwards from its solution. Each new arrow only needs a clear path past the
  // arrows already placed, so removing them in reverse order always works.
  function buildOnce(spec, r) {
    var w = spec.w, h = spec.h, occ = new Array(w * h).fill(false), groups = [];
    var mirror = {};
    function free(x, y) { return x >= 0 && y >= 0 && x < w && y < h && !occ[y * w + x]; }
    function rayCells(x, y, d) {
      var out = [], guard = 0;
      x += DX[d]; y += DY[d];
      while (x >= 0 && y >= 0 && x < w && y < h && guard++ < 400) {
        var k = y * w + x;
        if (mirror[k]) d = TURN[mirror[k]][d]; else if (!reserved[k]) out.push(k);
        x += DX[d]; y += DY[d];
      }
      return out;
    }
    function rayClear(x, y, d) { return rayCells(x, y, d).every(function (c) { return !occ[c]; }); }
    function candidates() {
      var c = [];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (!occ[y * w + x]) c.push([x, y]);
      shuffle(c, r);
      if (spec.big) {
        // Big boards fill from the centre outwards, with some randomness, so no inner cells get walled off.
        var mx = (w - 1) / 2, my = (h - 1) / 2, reach = Math.max(w, h), weight = {};
        c.forEach(function (p) { weight[p[1] * w + p[0]] = Math.max(Math.abs(p[0] - mx), Math.abs(p[1] - my)) + r() * reach * 0.3; });
        c.sort(function (a, b) { return weight[a[1] * w + a[0]] - weight[b[1] * w + b[0]]; });
      }
      return c;
    }
    function placePlain(forbid) {
      forbid = forbid || {};
      var cand = candidates();
      for (var i = 0; i < cand.length; i++) {
        var head = cand[i];
        if (forbid[head[1] * w + head[0]]) continue;
        var dirs = shuffle([0, 1, 2, 3], r);
        for (var k = 0; k < 4; k++) {
          var d = dirs[k];
          if (!rayClear(head[0], head[1], d)) continue;
          var ray = {}; rayCells(head[0], head[1], d).forEach(function (c) { ray[c] = 1; });
          var cells = [head], taken = {}; taken[head[1] * w + head[0]] = 1;
          var want = spec.minLen + Math.floor(r() * (spec.maxLen - spec.minLen + 1));
          var cur = head, heading = (d + 2) % 4;
          while (cells.length < want) {
            var opts = [heading, (heading + 1) % 4, (heading + 3) % 4];
            // The head always continues straight from the body, so the arrow reads at a glance.
            if (cells.length === 1) opts = [heading];
            else if (r() < 0.4) opts = [opts[1], opts[2], opts[0]];
            var moved = false;
            for (var o = 0; o < opts.length; o++) {
              var nx = cur[0] + DX[opts[o]], ny = cur[1] + DY[opts[o]], key = ny * w + nx;
              if (!free(nx, ny) || ray[key] || taken[key] || forbid[key]) continue;
              cur = [nx, ny]; cells.push(cur); taken[key] = 1; heading = opts[o]; moved = true;
              break;
            }
            if (!moved) break;
          }
          if (cells.length < spec.minLen) continue;
          cells.forEach(function (c) { occ[c[1] * w + c[0]] = true; });
          return { cells: cells.slice().reverse(), dir: d, ray: ray };
        }
      }
      return null;
    }
    function placeCompass() {
      var cand = candidates();
      for (var i = 0; i < cand.length; i++) {
        var dirs = shuffle([0, 1, 2, 3], r);
        for (var k = 0; k < 4; k++) {
          if (!rayClear(cand[i][0], cand[i][1], dirs[k])) continue;
          occ[cand[i][1] * w + cand[i][0]] = true;
          return { cells: [cand[i]], dir: dirs[k] };
        }
      }
      return null;
    }
    // Cells kept free while building: flowers later, or open space for fire and wind.
    var reserved = {};
    var reserveCount = Math.round(w * h * ((spec.flowers || 0) + (spec.gaps || 0)));
    for (var ri = 0; ri < reserveCount; ri++) {
      var rx = Math.floor(r() * w), ry = Math.floor(r() * h), rk = ry * w + rx;
      if (!occ[rk]) { occ[rk] = true; reserved[rk] = 1; }
    }
    var placedMirrors = [];
    for (var mi = 0; mi < (spec.mirrors || 0); mi++) {
      for (var tryM = 0; tryM < 40; tryM++) {
        var mx = 1 + Math.floor(r() * (w - 2)), my = 1 + Math.floor(r() * (h - 2)), mk = my * w + mx;
        if (occ[mk]) continue;
        var type = r() < 0.5 ? '/' : '\\';
        occ[mk] = true; mirror[mk] = type; placedMirrors.push({ x: mx, y: my, t: type });
        break;
      }
    }
    var expected = Math.max(3, Math.round(w * h / ((spec.minLen + spec.maxLen) / 2)));
    var twinsLeft = spec.twins || 0, compassLeft = spec.compass || 0, stalls = 0;
    while (stalls < 3) {
      var specialChance = (twinsLeft + compassLeft) / Math.max(1, expected - groups.length);
      var special = (twinsLeft + compassLeft) > 0 && r() < specialChance * 1.5;
      var g = null;
      if (special && compassLeft > 0 && (twinsLeft === 0 || r() < 0.5)) {
        var c = placeCompass();
        if (c) { c.kind = 'compass'; g = [c]; compassLeft--; }
      } else if (special && twinsLeft > 0) {
        var one = placePlain();
        if (one) {
          // The second twin keeps off the first twin's path and the first twin's body stays off its path.
          var bodyKeys = {}; one.cells.forEach(function (x) { bodyKeys[x[1] * w + x[0]] = 1; });
          var two = placePlainAvoiding(one, bodyKeys);
          if (two) { one.kind = two.kind = 'twin'; g = [one, two]; twinsLeft--; }
          else { one.kind = 'plain'; g = [one]; }
        }
      } else {
        var p = placePlain();
        if (p) { p.kind = 'plain'; g = [p]; }
      }
      if (g) { groups.push(g); stalls = 0; } else stalls++;
    }
    function placePlainAvoiding(first, bodyKeys) {
      for (var tries = 0; tries < 8; tries++) {
        var snapshot = occ.slice();
        var cand = placePlain(first.ray);
        if (!cand) return null;
        var hitsBody = Object.keys(cand.ray).some(function (k) { return bodyKeys[k]; });
        if (!hitsBody) return cand;
        occ = snapshot;
      }
      return null;
    }
    if (twinsLeft > 0 || compassLeft > 0) return null;
    // Stretch arrow tails into leftover gaps. A tail may only enter a cell that no arrow leaving at the same time or sooner needs to pass through.
    if (spec.big) {
      var rayMax = {};
      groups.forEach(function (g, i) {
        g.forEach(function (a) {
          var h0 = a.cells[a.cells.length - 1];
          rayCells(h0[0], h0[1], a.dir).forEach(function (k) { rayMax[k] = i; });
        });
      });
      var grew = true;
      while (grew) {
        grew = false;
        groups.forEach(function (g, i) {
          g.forEach(function (a) {
            if (a.kind === 'compass') return;
            for (var extend = true; extend;) {
              extend = false;
              var tail = a.cells[0], dirs = shuffle([0, 1, 2, 3], r);
              for (var e = 0; e < 4; e++) {
                var ex = tail[0] + DX[dirs[e]], ey = tail[1] + DY[dirs[e]], ek = ey * w + ex;
                if (!free(ex, ey) || (rayMax[ek] !== undefined && rayMax[ek] >= i)) continue;
                a.cells.unshift([ex, ey]); occ[ek] = true; extend = grew = true;
                break;
              }
            }
          });
        });
      }
    }
    // Groups leave in reverse order, so group i leaves after (n - 1 - i) launches.
    var arrows = [], n = groups.length;
    groups.forEach(function (g, i) {
      var launchesBefore = n - 1 - i;
      var ids = g.map(function (a) {
        var id = arrows.length;
        var dir = a.kind === 'compass' ? (((a.dir - launchesBefore) % 4) + 4) % 4 : a.dir;
        arrows.push({ id: id, kind: a.kind, dir: dir, cells: a.cells });
        return id;
      });
      if (g.length === 2) { arrows[ids[0]].twin = ids[1]; arrows[ids[1]].twin = ids[0]; }
    });
    // Choose sleepers and patient arrows. Each only waits for things that leave before it in the known solution.
    var groupOf = function (i) { return groups[i].ids; };
    groups.forEach(function (g, i) { g.ids = arrows.filter(function (a) { return a.cells === g[0].cells || (g[1] && a.cells === g[1].cells); }).map(function (a) { return a.id; }); });
    var plainGroups = [];
    groups.forEach(function (g, i) { if (g.length === 1 && g[0].kind === 'plain') plainGroups.push(i); });
    shuffle(plainGroups, r);
    var sleepersLeft = spec.sleepers || 0, patientLeft = spec.patient || 0, usedKeys = {};
    plainGroups.forEach(function (i) {
      var lb = n - 1 - i, a = arrows[groupOf(i)[0]];
      if (sleepersLeft > 0 && lb >= 1 && !a.isKey) {
        for (var q = 0; q < 12; q++) {
          var j = i + 1 + Math.floor(r() * lb), keyId = groupOf(j)[0];
          if (usedKeys[keyId] || arrows[keyId].kind === 'compass' || arrows[keyId].key !== undefined || arrows[keyId].wait) continue;
          a.key = keyId; arrows[keyId].isKey = true; usedKeys[keyId] = 1; sleepersLeft--;
          return;
        }
      }
      if (patientLeft > 0 && lb >= 2 && !a.isKey && a.key === undefined) {
        a.wait = 2 + Math.floor(r() * Math.min(lb - 1, spec.maxWait || 5)); patientLeft--;
      }
    });
    // New arrow types, each set so the known solution still works when played in order.
    var ghostsLeft = spec.ghosts || 0, redsLeft = spec.reds || 0;
    shuffle(plainGroups, r);
    plainGroups.forEach(function (i) {
      var lb = n - 1 - i, a = arrows[groupOf(i)[0]];
      if (a.key !== undefined || a.isKey || a.wait) return;
      if (redsLeft > 0) {
        // The count must run out before the board can be cleared, or the card would never matter.
        var count = Math.max(3, lb + 2 + Math.floor(r() * 2) + Math.floor(n * (spec.redSlack || 0)));
        if (count <= n - 2) { a.red = count; redsLeft--; return; }
      }
      if (ghostsLeft > 0) { a.ghostPhase = lb % 2; ghostsLeft--; return; }
    });
    if (sleepersLeft > 0 || patientLeft > 0 || redsLeft > 0 || ghostsLeft > 0) return null;
    var used = occ.filter(Boolean).length;
    // Groups leave in reverse order, so this list always clears the board.
    var solution = groups.slice().reverse().map(function (g) { return g.ids[0]; });
    return { reserved: Object.keys(reserved).map(Number), solution: solution, w: w, h: h, mirrors: placedMirrors, arrows: arrows, lives: spec.lives === undefined ? 3 : spec.lives, density: used / (w * h) };
  }

  // Orders the flowers for the bees. Each flower must go before the arrow that needs its cell in the known
  // solution, and any legal play only ever frees more, so the board can always still be cleared.
  function plantFlowers(level, r) {
    var cells = level.reserved.slice(), deadline = {}, s = newState(level);
    cells.forEach(function (k) { deadline[k] = Infinity; });
    level.solution.forEach(function (id, step) {
      var members = level.arrows[id].kind === 'twin' ? [level.arrows[id], level.arrows[level.arrows[id].twin]] : [level.arrows[id]];
      members.forEach(function (a) {
        rayCellsOf(level, s, a).forEach(function (k) { if (deadline[k] !== undefined && step < deadline[k]) deadline[k] = step; });
      });
      tap(level, s, id);
    });
    shuffle(cells, r);
    cells.sort(function (a, b) { return deadline[a] - deadline[b]; });
    var queue = [];
    cells.forEach(function (k) {
      // A bee takes queue[i] on launch i, so this flower is gone in time only if i < its deadline.
      if (queue.length < deadline[k]) queue.push(k);
    });
    // Mix up the flowers that have no deadline pressure, so the bees don't look scripted.
    for (var i = queue.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      if (Math.min(deadline[queue[i]], Infinity) > j && deadline[queue[j]] > i) { var t = queue[i]; queue[i] = queue[j]; queue[j] = t; }
    }
    level.flowers = queue.map(function (k) { return [k % level.w, Math.floor(k / level.w)]; });
    prepare(level);
  }
  // Gives phase arrows to arrows that can really use it: blocked by one tile now, free to slip through it.
  function phaseWorks(level, a, state) {
    a.phase = false;
    var without = check(level, state, a);
    a.phase = true;
    var withPhase = check(level, state, a);
    delete a.phase;
    return !without.clear && withPhase.clear;
  }
  function assignPhases(level, spec, r) {
    var s = newState(level);
    var pool = level.arrows.filter(function (a) { return a.kind === 'plain' && a.key === undefined && !a.isKey && !a.wait && !a.red && a.ghostPhase === undefined; });
    var useful = shuffle(pool.filter(function (a) { return phaseWorks(level, a, s); }), r);
    if (spec.phaseStrict && useful.length < spec.phases) return false;
    var chosen = useful.slice(0, spec.phases);
    shuffle(pool, r).forEach(function (a) { if (chosen.length < spec.phases && chosen.indexOf(a) < 0) chosen.push(a); });
    chosen.forEach(function (a) { a.phase = true; });
    return true;
  }
  // Each reverse arrow is timed so its tip points the right way at its turn in the known solution.
  // Arrows whose other end is blocked at that moment come first, because for them the timing truly matters.
  function assignReverse(level, spec, r) {
    var s = newState(level), useful = [], others = [];
    s.lives = null;
    level.solution.forEach(function (id) {
      var a = level.arrows[id];
      if (a.kind === 'plain' && a.cells.length >= 2 && a.key === undefined && !a.isKey && !a.wait && !a.red && a.ghostPhase === undefined && !a.phase) {
        a.uno = (s.launches + 1 + (s.ghostFlip || 0)) % 2;
        var other = check(level, s, a);
        delete a.uno;
        (other.clear ? others : useful).push({ a: a, phase: (s.launches + (s.ghostFlip || 0)) % 2 });
      }
      tap(level, s, id);
    });
    if (spec.reverseStrict && useful.length < spec.unos) return false;
    shuffle(useful, r); shuffle(others, r);
    var chosen = useful.concat(others).slice(0, spec.unos);
    if (chosen.length < spec.unos) return false;
    chosen.forEach(function (c) { c.a.uno = c.phase; });
    return true;
  }
  function replays(level) {
    var s = newState(level); s.lives = null;
    return level.solution.every(function (id) { return tap(level, s, id).ok; }) && isWon(s);
  }
  // Tries seeds and keeps the level that best fits the spec.
  function generate(spec, seed, tries) {
    var best = null, bestScore = -Infinity;
    for (var t = 0; t < (tries || 60); t++) {
      var useSeed = (seed + t * 7919) >>> 0;
      var lvl = buildOnce(spec, rng32(useSeed));
      if (!lvl) continue;
      prepare(lvl);
      if (spec.flowers) plantFlowers(lvl, rng32(useSeed + 5));
      if (spec.phases && !assignPhases(lvl, spec, rng32(useSeed + 9))) continue;
      if (spec.unos && (!assignReverse(lvl, spec, rng32(useSeed + 13)) || !replays(lvl))) continue;
      var hasCompass = (spec.compass || 0) > 0;
      var start = newState(lvl);
      var startFree = legalMoves(lvl, start).length;
      var depth = depthOf(lvl);
      var trap = hasCompass && !spec.big ? trapRate(lvl, 40, useSeed) : 0;
      var mirrorUse = 0;
      if ((spec.mirrors || 0) > 0) {
        var seen = {};
        lvl.arrows.forEach(function (a) {
          if (a.kind === 'compass') return;
          check(lvl, { removed: lvl.arrows.map(function () { return true; }), launches: 1e9 }, a).path.forEach(function (c) { seen[c.join()] = 1; });
        });
        mirrorUse = Object.keys(seen).length;
        if (mirrorUse < lvl.mirrors.length) continue;
      }
      var score = lvl.density * 4 + Math.min(depth, spec.depth || 4) - startFree * 0.15;
      if (hasCompass && !spec.big) {
        var band = spec.trap || [0.1, 0.5];
        score += (trap >= band[0] && trap <= band[1]) ? 4 : -Math.abs(trap - band[0]) * 6;
      }
      // Big boards are checked by replaying their known solution, since a full search would take too long.
      if (score > bestScore && (spec.big ? replays(lvl) : solve(lvl, start, 50000).solved)) { bestScore = score; best = lvl; best.seed = useSeed; }
    }
    return best;
  }

  // Open water boards. Harder and Timed can be switched on separately or together.
  function endlessSpec(n, opts) {
    opts = opts || {};
    var size = Math.min(4, Math.floor(n / 4)), hard = !!opts.hard, extra = hard ? 2 : 0;
    // Map size multiplies the board's area, so each side grows by its square root.
    var scale = opts.scale || 1, root = Math.sqrt(scale), fx = opts.effects || [];
    var more = function (count) { return Math.min(count * scale, 14); };
    // Every board carries new arrows. One type at first and more as you drift further, all four on big maps.
    var kinds = ['ghosts', 'unos', 'phases', 'reds'], step = n % 4, howMany = scale > 1 ? 4 : Math.min(4, 1 + Math.floor(n / 4) + (hard ? 1 : 0)), special = {};
    for (var q = 0; q < howMany; q++) special[kinds[(step + q) % 4]] = 1;
    var extraOf = hard && n % 2 ? 1 : 0;
    return {
      big: scale > 1, scale: scale,
      w: Math.round(Math.min(9, 6 + size + extra) * root), h: Math.round(Math.min(12, 7 + size + (size > 2 ? 1 : 0) + extra) * root), minLen: 2,
      maxLen: 5 + size + extra + Math.round(root * 1.5), depth: 5 + size + extra * 2,
      twins: more(Math.min(2, Math.floor(n / 3)) + (hard ? 1 : 0)), compass: more(Math.min(2, Math.floor((n + 1) / 4)) + (hard ? 1 : 0)),
      sleepers: more((n % 5 === 2 ? 1 : 0) + (hard ? 1 : 0)), mirrors: more((n % 5 === 3 ? 2 : 0) + (hard && n % 2 ? 2 : 0)), patient: more((n % 5 === 4 ? 1 : 0) + (hard && n % 2 === 0 ? 1 : 0)),
      trap: hard ? [0.15, 0.7] : [0.05, 0.45], lives: hard ? 2 : null, hints: hard ? 0 : 1,
      ghosts: special.ghosts ? more(1 + extraOf) : 0, unos: special.unos ? more(1 + extraOf) : 0, phases: special.phases ? more(1 + extraOf) : 0,
      // Red cards can trap you, so big maps use few of them and give them more time.
      reds: special.reds ? Math.min(more(1), 1 + Math.floor(scale / 5)) : 0, redSlack: scale > 1 ? 0.12 : 0,
      flowers: fx.indexOf('spring') >= 0 ? 0.24 : 0, gaps: Math.max(fx.indexOf('summer') >= 0 ? 0.14 : 0, fx.indexOf('autumn') >= 0 ? 0.24 : 0)
    };
  }
  // Builds a board, simplifying the mix of special arrows if a seed cannot fit them all.
  function endlessBoard(n, opts, seed) {
    var spec = endlessSpec(n, opts);
    var tries = spec.big ? 3 : 30;
    var lvl = generate(spec, seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, twins: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, ghosts: 0, phases: 0, reds: 0, unos: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, twins: 0, ghosts: 0, phases: 0, reds: 0, unos: 0 }), seed, tries * 2);
    lvl.hints = spec.hints; lvl.big = spec.big; lvl.effects = opts && opts.effects ? opts.effects.slice() : [];
    return lvl;
  }
  function timeLimitFor(launches) { return Math.round((10 + launches * 3.2) / 5) * 5; }

  return {
    unstickGhosts: unstickGhosts, isGhost: isGhost, tipOf: tipOf, tipAtTail: tipAtTail, hasRedCard: hasRedCard, isRedCarded: isRedCarded, effectsOf: effectsOf, hasEffect: hasEffect, endlessBoard: endlessBoard, endlessSpec: endlessSpec, timeLimitFor: timeLimitFor, iceHits: iceHits, seasonStep: seasonStep, resetBoard: resetBoard, pivotOptions: pivotOptions, isReady: isReady, DX: DX, DY: DY, rng32: rng32, prepare: prepare, newState: newState, headOf: headOf, dirOf: dirOf,
    check: check, canLaunch: canLaunch, tap: tap, rewind: rewind, legalMoves: legalMoves, isWon: isWon,
    isStuck: isStuck, solve: solve, trapRate: trapRate, depthOf: depthOf, generate: generate
  };
});
