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
    // Boarding Up specials: wooden walls on the edges between tiles, a slingshot, letter slots and goals.
    level.wallAt = null; level.slotAt = null; level.slingAt = -1; level.nestAt = null;
    if (level.nests && level.nests.length) { level.nestAt = {}; level.nests.forEach(function (n) { level.nestAt[n[1] * level.w + n[0]] = true; }); }
    if (level.walls && level.walls.length) { level.wallAt = {}; level.walls.forEach(function (w) { level.wallAt[(w[2] === 'r' ? 'v' : 'h') + w[0] + '_' + w[1]] = true; }); }
    if (level.slots && level.slots.length) { level.slotAt = {}; level.slots.forEach(function (sl) { level.slotAt[sl.y * level.w + sl.x] = sl.ch; }); }
    if (level.sling) level.slingAt = level.sling.y * level.w + level.sling.x;
    return level;
  }
  function newState(level) {
    return {
      removed: level.arrows.map(function () { return false; }),
      launches: 0,
      lives: level.lives === null ? null : (level.lives || 3),
      history: [], frozen: {}, burning: {}, snaps: [], eventDone: false, ghostFlip: 0, arrowsRef: level.arrows,
      props: (level.props || []).map(function (p) { return Object.assign({}, p); }), broken: {}, loaded: (level.props || []).reduce(function (v, p) { return p.loaded ? p.id : v; }, -1), redStay: !!level.redStay
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
  // Short scripted demos of each mechanic, played by the real rules so they can never show something false.
  // Each step: tap an arrow (expect: ok, hit, wait or thaw) or spin one (autumn wind), with a line to read.
  var P = function (id, cells, dir, more) { return Object.assign({ id: id, kind: 'plain', cells: cells, dir: dir }, more || {}); };
  var TUTORIALS = {
    goal: { title: 'Get every arrow off the board', text: 'The goal of the game is to make every arrow leave the board. An arrow leaves the way it points, so its path must be clear. Hitting another arrow costs a life.', w: 5, h: 4,
      arrows: [P(0, [[0, 0], [1, 0]], 1), P(1, [[0, 2], [1, 2]], 1), P(2, [[3, 3], [3, 2]], 0)],
      steps: [{ tap: 0, expect: 'ok', say: 'Tap an arrow and it leaves the way it points' }, { tap: 1, expect: 'hit', say: 'If another arrow is in the way, it bounces back' }, { tap: 2, expect: 'ok', say: 'So clear the way first' }, { tap: 1, expect: 'ok', say: 'Now it can leave too' }], end: 'All arrows gone: board cleared!' },
    combo: { title: 'Arrows with several effects', text: 'In Hard, one arrow can carry up to 3 effects at once. Every one of its rules applies, so read all of its symbols.', w: 5, h: 4,
      arrows: [P(0, [[1, 1], [2, 1], [3, 1]], 1, { wait: 1, uno: 0 }), P(1, [[1, 3], [2, 3]], 1), P(2, [[4, 2], [4, 1], [4, 0]], 0)],
      steps: [{ tap: 0, expect: 'wait', say: 'Patient and reverse: it must wait 1 launch' }, { tap: 1, expect: 'ok', say: 'One launch, and its tip also swaps ends' }, { tap: 0, expect: 'ok', say: 'Both rules are met: it leaves the other way' }, { tap: 2, expect: 'ok', say: '' }] },
    twin: { title: 'Twins', text: 'Twins share a colour and a letter. They leave together, so both paths must be clear.', w: 5, h: 4,
      arrows: [P(0, [[0, 0], [1, 0]], 1, { kind: 'twin', twin: 1, pair: 0 }), P(1, [[0, 2], [1, 2]], 1, { kind: 'twin', twin: 0, pair: 0 }), P(2, [[3, 3], [3, 2]], 0)],
      steps: [{ tap: 0, expect: 'hit', say: 'One twin is blocked, so neither can go' }, { tap: 2, expect: 'ok', say: 'Clear the way first' }, { tap: 0, expect: 'ok', say: 'Now both leave together' }] },
    compass: { title: 'Compass', text: 'A compass arrow turns a quarter clockwise every time another arrow leaves.', w: 4, h: 4,
      arrows: [P(0, [[1, 1]], 1, { kind: 'compass' }), P(1, [[3, 1], [3, 2]], 2)],
      steps: [{ tap: 0, expect: 'hit', say: 'It points at another arrow' }, { tap: 1, expect: 'ok', say: 'Each launch turns it a quarter' }, { tap: 0, expect: 'ok', say: 'Now it has a clear way out' }] },
    sleeper: { title: 'Moon and star', text: 'A moon arrow sleeps until the star arrow with the same number leaves. Tapping it early costs nothing.', w: 5, h: 4,
      arrows: [P(0, [[0, 1], [1, 1], [2, 1]], 1, { key: 1 }), P(1, [[1, 3], [2, 3], [3, 3]], 1, { isKey: true })],
      steps: [{ tap: 0, expect: 'wait', say: 'The moon arrow is asleep' }, { tap: 1, expect: 'ok', say: 'Send its star arrow away' }, { tap: 0, expect: 'ok', say: 'Now it wakes and can leave' }] },
    mirror: { title: 'Mirror', text: 'A mirror turns any arrow passing through it by 90 degrees, so follow the new path.', w: 5, h: 4,
      mirrors: [{ x: 3, y: 2, t: '/' }],
      arrows: [P(0, [[0, 2], [1, 2]], 1), P(1, [[3, 0], [4, 0]], 1)],
      steps: [{ tap: 0, expect: 'hit', say: 'The mirror sends it up, into an arrow' }, { tap: 1, expect: 'ok', say: 'Clear the new path' }, { tap: 0, expect: 'ok', say: 'It turns at the mirror and leaves' }] },
    patient: { title: 'Patient arrow', text: 'Its number shows how many more launches it needs before it can leave.', w: 5, h: 4,
      arrows: [P(0, [[0, 1], [1, 1], [2, 1]], 1, { wait: 2 }), P(1, [[1, 0], [2, 0]], 1), P(2, [[1, 3], [2, 3]], 1)],
      steps: [{ tap: 0, expect: 'wait', say: 'It needs 2 more launches' }, { tap: 1, expect: 'ok', say: 'One launch' }, { tap: 2, expect: 'ok', say: 'Two launches' }, { tap: 0, expect: 'ok', say: 'Now it can leave' }] },
    ghost: { title: 'Ghost arrow', text: 'It swaps form after every launch. As a ghost it cannot be played, and arrows pass through it.', w: 5, h: 3,
      arrows: [P(0, [[3, 0], [3, 1], [3, 2]], 2, { ghostPhase: 1 }), P(1, [[0, 1], [1, 1]], 1)],
      steps: [{ tap: 0, expect: 'wait', say: 'See-through: it cannot be played' }, { tap: 1, expect: 'ok', say: 'Other arrows pass right through it' }, { tap: 0, expect: 'ok', say: 'After a launch it is solid and can go' }] },
    phase: { title: 'Phase arrow', text: 'A phase arrow slips through one occupied tile: an arrow, a flower or fire. But not two in a row.', w: 5, h: 3,
      arrows: [P(0, [[0, 1], [1, 1]], 1, { phase: true }), P(1, [[3, 0], [3, 1], [3, 2]], 2)],
      steps: [{ tap: 0, expect: 'ok', say: 'It slips through the arrow in its way' }, { tap: 1, expect: 'ok', say: 'A normal arrow could not do that' }] },
    red: { title: 'Red card', text: 'Play it before its count runs out. If not, it is sent off until only sent-off arrows remain.', w: 5, h: 4,
      arrows: [P(0, [[0, 1], [1, 1], [2, 1]], 1, { red: 2 }), P(1, [[1, 0], [2, 0]], 1), P(2, [[1, 2], [2, 2]], 1), P(3, [[1, 3], [2, 3]], 1)],
      steps: [{ tap: 1, expect: 'ok', say: 'Each launch lowers its count' }, { tap: 2, expect: 'ok', say: 'At zero it gets a red card' }, { tap: 0, expect: 'wait', say: 'Sent off: it cannot move now' }, { tap: 3, expect: 'ok', say: 'Clear everything else' }, { tap: 0, expect: 'ok', say: 'Only then can it leave' }] },
    uno: { title: 'Reverse arrow', text: 'Its tip swaps to the other end after every launch. The faint mark shows where it goes next.', w: 5, h: 4,
      arrows: [P(0, [[1, 1], [2, 1]], 1, { uno: 0 }), P(1, [[4, 2], [4, 1], [4, 0]], 0), P(2, [[1, 3], [2, 3]], 1)],
      steps: [{ tap: 0, expect: 'hit', say: 'Its tip points at another arrow' }, { tap: 2, expect: 'ok', say: 'After a launch the tip swaps ends' }, { tap: 0, expect: 'ok', say: 'Now it leaves the other way' }, { tap: 1, expect: 'ok', say: '' }] },
    ice: { title: 'Frozen arrow', text: 'Winter. It cannot move, and it blocks others. It thaws by itself, or hit it with an arrow to free it at no cost.', w: 5, h: 3,
      frozen: [0], arrows: [P(0, [[3, 0], [3, 1], [3, 2]], 2), P(1, [[0, 1], [1, 1]], 1)],
      steps: [{ tap: 1, expect: 'thaw', say: 'Hit it to crack the ice, for free' }, { tap: 0, expect: 'ok', say: 'Now it is free to go' }, { tap: 1, expect: 'ok', say: 'And the way is clear' }] },
    fire: { title: 'Burning tile', text: 'Summer. Fire blocks arrows for a few launches, and hitting it costs a life. Wait for it to burn out.', w: 5, h: 4,
      burning: [[3, 1, 2]], arrows: [P(0, [[0, 1], [1, 1]], 1), P(1, [[1, 0], [2, 0]], 1), P(2, [[1, 3], [2, 3]], 1)],
      steps: [{ tap: 0, expect: 'hit', say: 'Fire in the way costs a life' }, { tap: 1, expect: 'ok', say: 'Play other arrows instead' }, { tap: 2, expect: 'ok', say: 'The fire burns out' }, { tap: 0, expect: 'ok', say: 'Now the way is clear' }] },
    flower: { title: 'Flower and bee', text: 'Spring. Flowers block arrows. After each launch, a bee carries one flower away.', w: 5, h: 4,
      flowers: [[3, 1]], arrows: [P(0, [[0, 1], [1, 1]], 1), P(1, [[1, 3], [2, 3]], 1)],
      steps: [{ tap: 0, expect: 'hit', say: 'A flower blocks the way' }, { tap: 1, expect: 'ok', say: 'After a launch, a bee takes it' }, { tap: 0, expect: 'ok', say: 'Now the way is clear' }] },
    wind: { title: 'Wind', text: 'Autumn. Wind can spin an arrow around its tail when there is room, which can change everything.', w: 5, h: 4,
      arrows: [P(0, [[2, 3], [2, 2]], 0), P(1, [[1, 0], [2, 0], [3, 0]], 1), P(2, [[1, 1], [0, 1]], 3)],
      steps: [{ tap: 0, expect: 'hit', say: 'This arrow is blocked' }, { tap: 2, expect: 'ok', spinWith: 0, say: 'A launch can bring a gust that spins an arrow' }, { tap: 0, expect: 'ok', say: 'Now it has a new way out' }, { tap: 1, expect: 'ok', say: '' }] }
  };
  // Starts a fresh copy of a demo, or plays one spin of the wind.
  function tutorialStart(key) {
    var d = JSON.parse(JSON.stringify(TUTORIALS[key]));
    var lvl = prepare({ w: d.w, h: d.h, lives: 99, arrows: d.arrows, mirrors: d.mirrors || [], flowers: d.flowers || [] });
    var s = newState(lvl);
    (d.frozen || []).forEach(function (id) { s.frozen[id] = 99; });
    (d.burning || []).forEach(function (b) { s.burning[b[1] * d.w + b[0]] = b[2]; });
    return { level: lvl, state: s, steps: d.steps, end: d.end };
  }
  function tutorialSpin(level, id) {
    var a = level.arrows[id], t = a.cells[0];
    a.cells.forEach(function (c) { level.grid[c[1] * level.w + c[0]] = -1; });
    a.cells = a.cells.map(function (c) { var dx = c[0] - t[0], dy = c[1] - t[1]; return [t[0] - dy, t[1] + dx]; });
    a.dir = (a.dir + 1) % 4;
    a.cells.forEach(function (c) { level.grid[c[1] * level.w + c[0]] = id; });
  }
  function partnerOf(a) { return a.kind === 'twin' ? a.twin : -1; }

  // A mirror turns a travelling arrow 90 degrees. Index by direction of travel.
  var TURN = { '/': [1, 0, 3, 2], '\\': [3, 2, 1, 0] };

  // Whether this tile would stop an arrow: fire, a flower, or another solid arrow.
  function tileBlocks(level, state, a, partner, key) {
    if (state.burning && state.burning[key] > state.launches) return true;
    if (propAt(level, state, key) >= 0 || (level.nestAt && level.nestAt[key])) return true;
    if (level.flowerAt && flowerStands(level, state, key)) return true;
    var o = level.grid[key];
    return o !== -1 && o !== a.id && o !== partner && !state.removed[o] && !isGhost(state, level.arrows[o]);
  }
  // Walks from the head to the board edge, following mirrors. The arrow's own cells and its twin never block it.
  // path holds every corner, for drawing; endDir is the direction it finally leaves in.
  function check(level, state, a) {
    var d = dirOf(a, state), h = tipOf(a, state), x = h[0], y = h[1], dist = 0, partner = partnerOf(a), path = [], guard = 0, phased = false;
    for (;;) {
      // A wooden wall on the edge it is about to cross stops it, like any obstacle.
      if (level.wallAt && wallOn(level, state, x, y, d)) return { clear: false, wall: edgeKey(x, y, d), blocker: -5, dist: dist + 0.5, dir: dirOf(a, state), endDir: d, path: path };
      x += DX[d]; y += DY[d]; dist++;
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { clear: true, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      if (++guard > 400) return { clear: false, blocker: a.id, dist: 1, dir: dirOf(a, state), endDir: d, path: [] };
      var key = y * level.w + x;
      var mirror = level.mirrorAt && level.mirrorAt[key];
      if (mirror) { d = TURN[mirror][d]; path.push([x, y]); continue; }
      if (state.freed && state.freed[a.id] && !(level.mirrorAt && level.mirrorAt[y * level.w + x])) continue;
      // An empty nest: the arrow would crush the eggs. A bird sitting in it is pushed instead, below.
      if (level.nestAt && level.nestAt[key] && propAt(level, state, key) < 0) return { clear: false, nest: true, blocker: -7, dist: dist, dir: dirOf(a, state), endDir: d, path: path, at: [x, y] };
      // A phase arrow slips through one occupied tile of anything, as long as the tile after it is open.
      if (a.phase && !phased && tileBlocks(level, state, a, partner, key)) {
        var nx = x + DX[d], ny = y + DY[d];
        var nextOn = nx >= 0 && ny >= 0 && nx < level.w && ny < level.h, nextKey = ny * level.w + nx;
        if (!nextOn || (level.mirrorAt && level.mirrorAt[nextKey]) || !tileBlocks(level, state, a, partner, nextKey)) { phased = true; continue; }
      }
      var pi = state.props && state.props.length ? propAt(level, state, key) : -1;
      if (pi >= 0) return { clear: false, prop: pi, blocker: -4, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      if (state.burning && state.burning[key] > state.launches) return { clear: false, fire: true, blocker: -2, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      if (level.flowerAt && flowerStands(level, state, key)) return { clear: false, flower: true, flowerKey: key, blocker: -3, dist: dist, dir: dirOf(a, state), endDir: d, path: path };
      var o = level.grid[key];
      // Ghost-form arrows are intangible, so everything passes through them.
      if (o !== -1 && !state.removed[o] && isGhost(state, level.arrows[o])) o = -1;
      if (o !== -1 && o !== a.id && o !== partner && !state.removed[o]) return { clear: false, blocker: o, frozen: !!(state.frozen && state.frozen[o] !== undefined), dist: dist, dir: dirOf(a, state), endDir: d, path: path };
    }
  }
  // Ghost arrows swap form on every launch, and can only be played when solid.
  function isGhost(state, a) { return a.ghostPhase !== undefined && (state.launches + a.ghostPhase + (state.ghostFlip || 0)) % 2 === 1; }
  // A red card arrow not played in time is sent off until only sent-off arrows remain.
  function hasRedCard(state, a) { return !!a.red && state.launches >= a.red; }
  function isRedCarded(state, a) {
    // A goalkeeper is never played, and on a football pitch a red card is for good.
    if (a.keeper) return true;
    if (hasRedCard(state, a) && state.redStay) return true;
    if (!hasRedCard(state, a) || (state.redLift && state.redLift[a.id])) return false;
    var list = state.arrowsRef;
    if (!list) return true;
    return !list.every(function (x) { return state.removed[x.id] || hasRedCard(state, x); });
  }
  // Sleepers wait for their key arrow to leave. Patient arrows wait for a number of launches.
  function isReady(state, a) {
    if (state.freed && state.freed[a.id]) return !(state.frozen && state.frozen[a.id] !== undefined);
    if (a.key !== undefined && !state.removed[a.key]) return false;
    if (a.wait && state.launches < a.wait) return false;
    if (state.frozen && state.frozen[a.id] !== undefined) return false;
    if (isGhost(state, a) || isRedCarded(state, a)) return false;
    return true;
  }
  // A twin whose partner is already gone plays like a normal arrow.
  function paired(state, a) { return a.kind === 'twin' && !(state && state.removed[a.twin]); }
  function group(level, a, state) {
    return paired(state, a) ? [a, level.arrows[a.twin]] : [a];
  }
  function canLaunch(level, state, id) {
    return group(level, level.arrows[id], state).every(function (m) { return isReady(state, m) && check(level, state, m).clear; });
  }

  // A tap: launches the arrow when clear, otherwise reports the collision and costs a life.
  function tap(level, state, id) {
    var members = group(level, level.arrows[id], state);
    // Tapping an arrow that is not ready yet is free: nothing moves and no life is lost.
    if (!members.every(function (m) { return isReady(state, m); })) return { ok: false, notReady: true, results: [], failed: false };
    var results = members.map(function (m) { var c = check(level, state, m); c.fromTail = tipAtTail(state, m); return { id: m.id, check: c }; });
    var hit = results.filter(function (r) { return !r.check.clear; });
    // Hitting a frozen arrow cracks it free. The tapped arrow bounces back and no life is lost.
    var ice = hit.filter(function (r) { return r.check.frozen; });
    if (ice.length && ice.length === hit.length) {
      ice.forEach(function (r) { delete state.frozen[r.check.blocker]; });
      // Freed but still hemmed in by fire or more ice: clear them, so effects can never trap the player.
      if (!state.safe && !state.keepIce && isStuck(level, state)) { state.frozen = {}; state.burning = {}; }
      unstickGhosts(level, state);
      if (state.safe) ensurePlay(level, state);
      return { ok: false, thawed: ice.map(function (r) { return r.check.blocker; }), results: results, failed: false };
    }
    // An arrow that hits an empty nest breaks the eggs, and the level is lost.
    if (hit.some(function (r) { return r.check.nest; })) return { ok: false, eggs: true, results: results, failed: true };
    // Hitting a ball, a bird or a letter pushes it. The arrow stays where it is and no life is lost.
    var shoves = hit.filter(function (r) { return r.check.prop !== undefined; });
    if (shoves.length && shoves.length === hit.length) {
      var pushed = [];
      shoves.forEach(function (r) { var pu = pushProp(level, state, r.check.prop, r.check.endDir); pushed.push(pu); for (var c = pu.chain; c; c = c.chain) pushed.push(c); });
      state.falls = level.gravity ? settle(level, state) : [];
      return { ok: false, pushed: pushed, results: results, failed: false };
    }
    if (hit.length) {
      if (state.lives !== null) state.lives--;
      return { ok: false, results: results, failed: state.lives === 0 };
    }
    {
      state.snaps = state.snaps || [];
      state.snaps.push({ freed: Object.assign({}, state.freed), redLift: Object.assign({}, state.redLift), picked: Object.assign({}, state.picked), ghostFlip: state.ghostFlip, eventDone: state.eventDone, frozen: Object.assign({}, state.frozen), burning: Object.assign({}, state.burning),
        geo: level.arrows.map(function (a) { return { cells: a.cells, dir: a.dir }; }) });
    }
    members.forEach(function (m) { state.removed[m.id] = true; });
    state.history.push(members.map(function (m) { return m.id; }));
    state.launches++;
    // Every launch, the bee carries a flower away. If its flower has already gone, it takes the next one.
    state.beeTaken = null;
    if (level.flowers && level.flowers.length) {
      var due = level.flowers[state.launches - 1];
      if (due && state.picked && state.picked[due[1] * level.w + due[0]]) {
        due = null;
        for (var fi = state.launches; fi < level.flowers.length && !due; fi++) {
          var nf = level.flowers[fi], nk = nf[1] * level.w + nf[0];
          if (!state.picked[nk]) { state.picked = Object.assign({}, state.picked); state.picked[nk] = true; due = nf; }
        }
      }
      state.beeTaken = due || null;
    }
    // Letters with nothing under them drop down.
    state.falls = level.gravity ? settle(level, state) : [];
    unstickGhosts(level, state);
    // Season boards run this check after their effects, once the board has settled.
    if (state.safe && !effectsOf(level).length) ensurePlay(level, state);
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
      state.frozen = snap.frozen; state.burning = snap.burning; state.eventDone = snap.eventDone; state.ghostFlip = snap.ghostFlip; state.picked = snap.picked; state.freed = snap.freed; state.redLift = snap.redLift;
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
    if (level.special || isWon(state) || !isStuck(level, state)) return false;
    if (level.arrows.some(function (a) { return !state.removed[a.id] && (a.ghostPhase !== undefined || a.uno !== undefined); })) {
      state.ghostFlip = (state.ghostFlip || 0) + 1;
      if (!isStuck(level, state)) return true;
      state.ghostFlip--;
    }
    if (state.safe) return false;
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
      if (paired(state, a) && a.twin < a.id) return;
      if (canLaunch(level, state, a.id)) out.push(a.id);
    });
    return out;
  }
  function isWon(state) { return state.removed.every(Boolean); }

  /* ---------- Boarding Up specials: a football, birds and a slingshot, and letters that fall ---------- */
  // The edge between a tile and its neighbour in direction d, the same key from either side.
  function edgeKey(x, y, d) { return d === 1 ? 'v' + x + '_' + y : d === 3 ? 'v' + (x - 1) + '_' + y : d === 2 ? 'h' + x + '_' + y : 'h' + x + '_' + (y - 1); }
  function wallOn(level, state, x, y, d) { var k = edgeKey(x, y, d); return !!(level.wallAt && level.wallAt[k] && !(state.broken && state.broken[k])); }
  function propAt(level, state, key) {
    var ps = state.props || [];
    for (var i = 0; i < ps.length; i++) if (!ps[i].gone && ps[i].y * level.w + ps[i].x === key) return i;
    return -1;
  }
  // Balls, birds and letters stop at any arrow (even a ghost) and any other prop. The slingshot is part of
  // the ground: arrows pass over it, and only a bird sitting on it is in the way.
  function cellTaken(level, state, key, self) {
    var o = level.grid[key];
    if (o !== -1 && !state.removed[o]) return true;
    var pi = propAt(level, state, key);
    return pi >= 0 && state.props[pi] !== self;
  }
  // A ball or a bird slides until something stops it. A letter moves one tile, and only sideways.
  // A bird that slides onto an empty slingshot is caught there. Leaving the board is reported as exit.
  function slideProp(level, state, p, d) {
    var x = p.x, y = p.y, path = [[x, y]], out = { id: p.id, kind: p.kind, from: [x, y], path: path, exit: null, loaded: false }, was = p.loaded;
    if (p.kind === 'letter' && (d === 0 || d === 2)) { out.to = [x, y]; out.moved = false; return out; }
    for (var guard = 0; guard < 400; guard++) {
      if (wallOn(level, state, x, y, d)) { out.wall = edgeKey(x, y, d); break; }
      var nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) { if (p.kind !== 'letter') out.exit = { dir: d, x: x, y: y }; break; }
      var k = ny * level.w + nx;
      // A nest catches a bird. If a bird is already resting there, the newcomer takes its place and pushes it on.
      if (level.nestAt && level.nestAt[k] && p.kind === 'bird') {
        var qi = propAt(level, state, k);
        if (qi < 0) { x = nx; y = ny; path.push([x, y]); out.nest = true; break; }
        var q = state.props[qi];
        if (q !== p && q.kind === 'bird' && pushMoves(level, state, q, d)) { out.chain = slideProp(level, state, q, d); x = nx; y = ny; path.push([x, y]); out.nest = true; }
        break;
      }
      if (cellTaken(level, state, k, p)) break;
      if (k === level.slingAt && p.kind === 'bird' && (state.loaded === -1 || state.loaded === p.id)) { x = nx; y = ny; path.push([x, y]); out.loaded = true; break; }
      x = nx; y = ny; path.push([x, y]);
      if (p.kind === 'letter') break;
    }
    if (out.exit) p.gone = true; else { p.x = x; p.y = y; }
    out.to = out.exit ? null : [x, y]; out.moved = path.length > 1 || !!out.exit;
    // A bird pushed off the slingshot is no longer loaded; one that slid onto it is.
    if (was && out.moved && !out.loaded) { p.loaded = false; if (state.loaded === p.id) state.loaded = -1; }
    if (out.loaded) { p.loaded = true; state.loaded = p.id; }
    return out;
  }
  function pushProp(level, state, i, d) { return slideProp(level, state, state.props[i], d); }
  // Would pushing this prop this way move it at all?
  function pushMoves(level, state, p, d) {
    if (p.kind === 'letter' && (d === 0 || d === 2)) return false;
    if (wallOn(level, state, p.x, p.y, d)) return false;
    var nx = p.x + DX[d], ny = p.y + DY[d];
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) return p.kind !== 'letter';
    var nk = ny * level.w + nx;
    if (level.nestAt && level.nestAt[nk] && p.kind === 'bird') { var qi = propAt(level, state, nk); return qi < 0 || (state.props[qi].kind === 'bird' && pushMoves(level, state, state.props[qi], d)); }
    return !cellTaken(level, state, ny * level.w + nx, p);
  }
  // Letters fall until they land in a slot, on an arrow, on another letter or on the bottom row.
  function settle(level, state) {
    var falls = {}, order = [], moved = true, guard = 0, w = level.w;
    var held = function (p) { return level.slotAt && level.slotAt[p.y * w + p.x] !== undefined; };
    while (moved && guard++ < 100) {
      moved = false;
      (state.props || []).filter(function (p) { return p.kind === 'letter' && !p.gone; }).sort(function (a, b) { return b.y - a.y; }).forEach(function (p) {
        if (held(p) || p.y + 1 >= level.h || cellTaken(level, state, (p.y + 1) * w + p.x, p)) return;
        if (!falls[p.id]) { falls[p.id] = { id: p.id, from: [p.x, p.y] }; order.push(p.id); }
        while (p.y + 1 < level.h && !cellTaken(level, state, (p.y + 1) * w + p.x, p)) { p.y++; if (held(p)) break; }
        falls[p.id].to = [p.x, p.y]; moved = true;
      });
    }
    return order.map(function (id) { return falls[id]; });
  }
  function slotsDone(level, state) {
    if (!level.slots || !level.slots.length) return false;
    return level.slots.every(function (sl) { var i = propAt(level, state, sl.y * level.w + sl.x); return i >= 0 && state.props[i].ch === sl.ch; });
  }
  function findProp(state, id) { for (var i = 0; i < (state.props || []).length; i++) if (state.props[i].id === id) return state.props[i]; return null; }
  // Is anything at all left to do on this board: a launch, a push that moves something, or a loaded slingshot?
  function anyMove(level, state) {
    if (state.loaded !== -1 && state.loaded !== undefined) return true;
    return level.arrows.some(function (a) {
      if (state.removed[a.id] || !group(level, a, state).every(function (m) { return isReady(state, m); })) return false;
      var c = check(level, state, a);
      if (c.clear) return true;
      return c.prop !== undefined && pushMoves(level, state, state.props[c.prop], c.endDir);
    });
  }
  /* A row of boards: a ball or a bird rolls across board edges. A ball scores through a goal on the outer edge.
     A bird pushed off the outer edge flies away. */
  function carry(boards, states, b, push) {
    var segs = [{ b: b, path: push.path.concat([[push.exit.x + DX[push.exit.dir], push.exit.y + DY[push.exit.dir]]]), exit: true }];
    var p = findProp(states[b], push.id), exit = push.exit;
    for (var guard = 0; guard < 20; guard++) {
      var d = exit.dir, L = boards[b];
      var nb = d === 1 ? b + 1 : d === 3 ? b - 1 : -1;
      if (nb < 0 || nb >= boards.length) {
        states[b].props = states[b].props.filter(function (x) { return x !== p; });
        if (p.kind !== 'ball') return { segs: segs, result: 'lost' };
        var g = (L.goals || []).filter(function (gl) { return gl.side === d && gl.ys.indexOf(exit.y) >= 0; })[0];
        return { segs: segs, result: g ? (g.own ? 'own' : 'goal') : 'out' };
      }
      var L2 = boards[nb], S2 = states[nb], ex = d === 1 ? 0 : L2.w - 1, k0 = exit.y * L2.w + ex;
      if (exit.y >= L2.h || cellTaken(L2, S2, k0, p)) {
        // The next board is blocked right at its edge: it stops on the edge of this one.
        p.gone = false; p.x = exit.x; p.y = exit.y;
        segs[segs.length - 1].path.pop(); segs[segs.length - 1].exit = false;
        return { segs: segs, result: 'moved', b: b, at: [exit.x, exit.y] };
      }
      states[b].props = states[b].props.filter(function (x) { return x !== p; });
      p.gone = false; p.x = d === 1 ? -1 : L2.w; p.y = exit.y;
      S2.props.push(p);
      var r = slideProp(L2, S2, p, d);
      segs.push({ b: nb, path: r.path, exit: !!r.exit });
      if (!r.exit) return { segs: segs, result: 'moved', b: nb, at: r.to, loaded: r.loaded };
      segs[segs.length - 1].path = r.path.concat([[r.exit.x + DX[d], r.exit.y + DY[d]]]);
      b = nb; exit = r.exit;
    }
    return { segs: segs, result: 'out' };
  }
  // A thrown bird flies straight, across board edges too. A wooden wall breaks; on boards where birds are strong,
  // an arrow it meets is destroyed. Either way the bird drops on the last free tile before it. It passes through
  // ghosts. Anything else stops it there. Off the outer edge it flies away.
  function throwBird(boards, states, b, d) {
    var S0 = states[b], p = S0.loaded === -1 ? null : findProp(S0, S0.loaded);
    if (!p) return null;
    var L = boards[b], S = S0, x = p.x, y = p.y, path = [[x, y]], segs = [{ b: b, path: path }], land = { b: b, x: x, y: y, seg: 0, at: 0 };
    var out = { id: p.id, segs: segs, broke: null, destroyed: null, gone: false, impact: null };
    for (var guard = 0; guard < 400; guard++) {
      if (wallOn(L, S, x, y, d)) { out.broke = { b: segs.length - 1 >= 0 ? segs[segs.length - 1].b : b, key: edgeKey(x, y, d) }; out.impact = { b: segs[segs.length - 1].b, p: [x + DX[d] * 0.5, y + DY[d] * 0.5] }; break; }
      var nx = x + DX[d], ny = y + DY[d], cb = segs[segs.length - 1].b;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) {
        var nb = d === 1 ? cb + 1 : d === 3 ? cb - 1 : -1;
        path.push([nx, ny]);
        if (nb < 0 || nb >= boards.length || ny >= boards[nb].h) { out.gone = true; break; }
        L = boards[nb]; S = states[nb]; x = d === 1 ? -1 : L.w; path = [[x, y]]; segs.push({ b: nb, path: path });
        continue;
      }
      var k = ny * L.w + nx, o = L.grid[k];
      // A nest catches the bird. A bird already resting there is knocked on, and the newcomer takes its place.
      if (L.nestAt && L.nestAt[k]) {
        var qi = propAt(L, S, k);
        if (qi >= 0 && !(S.props[qi].kind === 'bird' && pushMoves(L, S, S.props[qi], d))) { out.impact = { b: cb, p: [nx, ny] }; break; }
        if (qi >= 0) { var q = S.props[qi], r2 = slideProp(L, S, q, d); out.chain = { b: cb, slide: r2, trip: r2.exit ? carry(boards, states, cb, r2) : null }; }
        x = nx; y = ny; path.push([x, y]); out.nest = true;
        land = { b: cb, x: x, y: y, seg: segs.length - 1, at: path.length - 1 };
        break;
      }
      if (o !== -1 && !S.removed[o] && isGhost(S, L.arrows[o])) { x = nx; y = ny; path.push([x, y]); continue; }
      if (o !== -1 && !S.removed[o]) {
        if (L.birdsBreak) out.destroyed = { b: cb, id: o };
        out.impact = { b: cb, p: [nx, ny] };
        break;
      }
      if (propAt(L, S, k) >= 0) { out.impact = { b: cb, p: [nx, ny] }; break; }
      x = nx; y = ny; path.push([x, y]);
      land = { b: cb, x: x, y: y, seg: segs.length - 1, at: path.length - 1 };
    }
    var still = land.b === b && land.x === p.x && land.y === p.y;
    if (still && !out.broke && !out.destroyed && !out.gone) { out.noop = true; return out; }
    if (out.broke) states[out.broke.b].broken[out.broke.key] = true;
    if (out.destroyed) states[out.destroyed.b].removed[out.destroyed.id] = true;
    // The flight drawn ends where the bird lands, or where it left the last board.
    if (!out.gone) { segs.length = land.seg + 1; segs[land.seg].path.length = land.at + 1; }
    var LL = boards[land.b], SL = states[land.b];
    if (out.gone) { S0.props = S0.props.filter(function (q) { return q !== p; }); p.loaded = false; S0.loaded = -1; }
    else if (!still) {
      p.loaded = false; S0.loaded = -1; p.x = land.x; p.y = land.y;
      if (land.b !== b) { S0.props = S0.props.filter(function (q) { return q !== p; }); states[land.b].props.push(p); }
      // Landing on an empty slingshot loads it.
      if (land.y * LL.w + land.x === LL.slingAt && SL.loaded === -1) { p.loaded = true; SL.loaded = p.id; out.loaded = true; }
    }
    out.to = out.gone ? null : { b: land.b, x: land.x, y: land.y }; out.stays = still;
    return out;
  }
  // A search for the poem: launches and pushes that change something, until every slot holds its letter.
  // Returns the first move of a shortest way, or solved: false once every reachable position has been tried.
  function solveSpecial(level, state, limit) {
    var copy = function (S) { return { removed: S.removed.slice(), launches: S.launches, lives: null, props: S.props.map(function (p) { return Object.assign({}, p); }), broken: Object.assign({}, S.broken), loaded: S.loaded, redStay: S.redStay, history: [], frozen: {}, burning: {}, snaps: [], ghostFlip: S.ghostFlip || 0, arrowsRef: level.arrows }; };
    var keyOf = function (S) { var k = ''; for (var i = 0; i < S.removed.length; i++) k += S.removed[i] ? '1' : '0'; S.props.forEach(function (p) { if (!p.gone) k += '|' + p.id + ':' + p.x + ',' + p.y; }); return k; };
    var start = copy(state);
    if (slotsDone(level, start)) return { solved: true, first: -1, exhausted: true };
    var seen = {}, queue = [{ S: start, first: -1 }], head = 0;
    seen[keyOf(start)] = 1;
    while (head < queue.length) {
      if (head > (limit || 20000)) return { solved: false, first: -1, exhausted: false };
      var cur = queue[head++];
      for (var i = 0; i < level.arrows.length; i++) {
        var a = level.arrows[i];
        if (cur.S.removed[a.id] || !isReady(cur.S, a)) continue;
        var S = copy(cur.S), res = tap(level, S, a.id);
        if (!res.ok && !(res.pushed && res.pushed.some(function (pu) { return pu.moved; }))) continue;
        var first = cur.first === -1 ? a.id : cur.first;
        if (slotsDone(level, S)) return { solved: true, first: first, exhausted: true };
        var k = keyOf(S);
        if (seen[k]) continue;
        seen[k] = 1; queue.push({ S: S, first: first });
      }
    }
    return { solved: false, first: -1, exhausted: true };
  }
  // After an out or an own goal the ball goes back to the centre spot.
  function resetBall(boards, states, kick, known) {
    var ball = known || null;
    states.forEach(function (S) { (S.props || []).forEach(function (p) { if (p.kind === 'ball' && !ball) ball = p; }); S.props = (S.props || []).filter(function (p) { return p.kind !== 'ball'; }); });
    if (!ball) return null;
    ball.gone = false; ball.x = kick.x; ball.y = kick.y;
    states[kick.b].props.push(ball);
    return ball;
  }
  // One tap on a board of a room, with the ball carried across boards. Out and own goals cost a life.
  function roomTap(boards, states, b, id, kick) {
    var L = boards[b], S = states[b], res = tap(L, S, id), out = { res: res, ball: null };
    (res.pushed || []).forEach(function (pu) {
      if (!pu.exit) return;
      if (pu.kind === 'bird') { (out.birds = out.birds || []).push(carry(boards, states, b, pu)); return; }
      if (pu.kind !== 'ball') return;
      var ball = findProp(S, pu.id);
      out.ball = carry(boards, states, b, pu);
      if (out.ball.result === 'out' || out.ball.result === 'own') {
        // The ball comes back to the spot it was kicked from.
        if (S.lives !== null) S.lives--;
        out.ballSpot = { b: b, x: pu.from[0], y: pu.from[1] };
        resetBall(boards, states, out.ballSpot, ball);
        res.failed = S.lives === 0;
      }
    });
    return out;
  }
  // An arrow that would hit a frozen arrow counts as a useful move.
  function iceHits(level, state) {
    var out = [];
    level.arrows.forEach(function (a) {
      if (state.removed[a.id]) return;
      // Counts only if a tap would really crack the ice. Twins must both be ready, with only ice in their way.
      var members = group(level, a, state);
      if (!members.every(function (m) { return isReady(state, m); })) return;
      var blocked = members.map(function (m) { return check(level, state, m); }).filter(function (c) { return !c.clear; });
      if (blocked.length && blocked.every(function (c) { return c.frozen; })) out.push(a.id);
    });
    return out;
  }
  // Cracking ice is a free action, so it never moves the game on by itself. The board only counts as playable
  // if a launch exists now, or if cracking the ice that can be reached would lead to one.
  function iceOpensPlay(level, state) {
    var frozen = state.frozen, found = false;
    state.frozen = Object.assign({}, frozen);
    for (var guard = 0; guard < 400 && !found; guard++) {
      var hits = iceHits(level, state), cracked = false;
      hits.forEach(function (id) {
        group(level, level.arrows[id], state).forEach(function (m) {
          var c = check(level, state, m);
          if (c.frozen && state.frozen[c.blocker] !== undefined) { delete state.frozen[c.blocker]; cracked = true; }
        });
      });
      if (!cracked) break;
      found = legalMoves(level, state).length > 0;
    }
    state.frozen = frozen;
    return found;
  }
  /* ---------- The safety net: after every action, the board must still be clearable ---------- */
  // What stands between an arrow and the edge: fire and flowers can be removed, solid arrows cannot.
  function obstaclesOf(level, state, a) {
    var d = dirOf(a, state), h = tipOf(a, state), x = h[0], y = h[1], out = { fire: [], flowers: [], solid: 0 }, guard = 0, partner = partnerOf(a);
    while (guard++ < 400) {
      x += DX[d]; y += DY[d];
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) break;
      var k = y * level.w + x;
      if (level.mirrorAt[k]) { d = TURN[level.mirrorAt[k]][d]; continue; }
      if (state.burning[k] > state.launches) out.fire.push(k);
      if (flowerStands(level, state, k)) out.flowers.push(k);
      var o = level.grid[k];
      if (o !== -1 && o !== a.id && o !== partner && !state.removed[o] && !isGhost(state, level.arrows[o])) out.solid++;
    }
    return out;
  }
  function boardClearable(level, state) {
    if (isWon(state)) return true;
    if (!legalMoves(level, state).length && !iceOpensPlay(level, state)) return false;
    var live = state.removed.filter(function (x) { return !x; }).length, sol = solve(level, state, Math.max(3000, live * 12));
    return sol.solved || sol.exhausted;
  }
  // Tries a change, and keeps it only if the board can then be cleared.
  function tryRescue(level, state, change) {
    var keep = { burning: state.burning, frozen: state.frozen, picked: state.picked, freed: state.freed, redLift: state.redLift };
    state.burning = Object.assign({}, keep.burning); state.frozen = Object.assign({}, keep.frozen); state.picked = Object.assign({}, keep.picked); state.freed = Object.assign({}, keep.freed); state.redLift = Object.assign({}, keep.redLift);
    change();
    if (boardClearable(level, state)) return true;
    state.burning = keep.burning; state.frozen = keep.frozen; state.picked = keep.picked; state.freed = keep.freed; state.redLift = keep.redLift;
    return false;
  }
  // Removes as little as possible. First the arrow that needs the fewest tiles cleared, then red cards, then,
  // only if arrows truly block one another, one arrow is freed to fly through anything.
  function rescueStep(level, state) {
    state.rescued = state.rescued || { fire: [], ice: [], freed: [] };
    var live = level.arrows.filter(function (a) { return !state.removed[a.id] && !(paired(state, a) && a.twin < a.id); });
    var withoutIce = { frozen: {}, launches: state.launches, ghostFlip: state.ghostFlip, removed: state.removed, arrowsRef: state.arrowsRef, redLift: state.redLift, freed: state.freed };
    var soft = [];
    live.forEach(function (a) {
      var fire = {}, flowers = {}, solid = 0, ice = [], ready = true;
      group(level, a, state).forEach(function (m) {
        var o = obstaclesOf(level, state, m);
        solid += o.solid; o.fire.forEach(function (k) { fire[k] = 1; }); o.flowers.forEach(function (k) { flowers[k] = 1; });
        if (state.frozen[m.id] !== undefined) ice.push(m.id);
        if (!isReady(withoutIce, m)) ready = false;
      });
      if (ready && !solid) soft.push({ a: a, fire: Object.keys(fire).map(Number), flowers: Object.keys(flowers).map(Number), ice: ice, cost: Object.keys(fire).length + Object.keys(flowers).length + ice.length });
    });
    soft.sort(function (p, q) { return p.cost - q.cost; });
    for (var i = 0; i < soft.length && i < 10; i++) {
      var c = soft[i];
      var done = tryRescue(level, state, function () {
        c.fire.forEach(function (k) { delete state.burning[k]; });
        c.flowers.forEach(function (k) { state.picked[k] = true; });
        c.ice.forEach(function (id) { delete state.frozen[id]; });
      });
      if (done) {
        c.fire.forEach(function (k) { state.rescued.fire.push(k); });
        c.ice.forEach(function (id) { state.rescued.ice.push(id); });
        if (c.flowers.length) state.pickedNew = (state.pickedNew || []).concat(c.flowers);
        return true;
      }
    }
    var carded = live.filter(function (a) { return isRedCarded(state, a); });
    for (i = 0; i < carded.length; i++) {
      var red = carded[i];
      if (tryRescue(level, state, function () { state.redLift[red.id] = true; })) { state.rescued.freed.push(red.id); return true; }
    }
    // A golden arrow only appears when the player truly has no move left. While any arrow can still leave
    // (or crack ice), play goes on; once the last move is made, this runs again and hands out the golden arrow.
    var movesLeft = legalMoves(level, state).length || iceOpensPlay(level, state);
    if (movesLeft && !state.rescueEarly) return false;
    // Arrows that are blocked the least come first. If nothing proves clearable, the best one is freed and the check runs again.
    // A compass keeps its own rule, so it is only ever freed if nothing else can be.
    var order = live.map(function (a) { var s = 0; group(level, a, state).forEach(function (m) { s += obstaclesOf(level, state, m).solid; }); return { a: a, s: s + (a.kind === 'compass' ? 1000 : 0) }; }).sort(function (p, q) { return p.s - q.s; });
    var free = function (a) { group(level, a, state).forEach(function (m) { state.freed[m.id] = true; delete state.frozen[m.id]; }); };
    for (i = 0; i < order.length && i < 10; i++) {
      var f = order[i].a;
      if (tryRescue(level, state, function () { free(f); })) { state.rescued.freed.push(f.id); return true; }
    }
    // With moves still left, wait for a rescue that is proven to work.
    if (movesLeft) return false;
    // Nothing single proved enough, so make progress and let the check run again.
    state.burning = Object.assign({}, state.burning); state.frozen = Object.assign({}, state.frozen); state.picked = Object.assign({}, state.picked); state.freed = Object.assign({}, state.freed);
    var step = soft.filter(function (c) { return c.cost > 0; })[0];
    if (step) {
      step.fire.forEach(function (k) { delete state.burning[k]; state.rescued.fire.push(k); });
      step.flowers.forEach(function (k) { state.picked[k] = true; });
      step.ice.forEach(function (id) { delete state.frozen[id]; state.rescued.ice.push(id); });
      if (step.flowers.length) state.pickedNew = (state.pickedNew || []).concat(step.flowers);
      return true;
    }
    var next = order.filter(function (o) { return !state.freed[o.a.id]; })[0];
    if (!next) return false;
    free(next.a); state.rescued.freed.push(next.a.id);
    return true;
  }
  function ensurePlay(level, state) {
    for (var guard = 0; guard < 30 && !boardClearable(level, state); guard++) {
      if (!rescueStep(level, state)) break;
      state.rescueCount = (state.rescueCount || 0) + 1;
    }
  }
  /* ---------- Several boards at once: twins that span boards can lock each other ---------- */
  // Moves anywhere in a room. A cross-board twin only counts if every copy that is still on the board can go.
  function roomMoves(boards, states, groups) {
    var out = [];
    boards.forEach(function (l, b) {
      legalMoves(l, states[b]).forEach(function (id) {
        var a = l.arrows[id];
        if (a.coopGroup !== undefined && groups && groups[a.coopGroup]) {
          var ok = groups[a.coopGroup].members.every(function (m) {
            if (m[0] === b) return true;
            var L = boards[m[0]], S = states[m[0]], o = L.arrows[m[1]];
            return S.removed[o.id] || (isReady(S, o) && check(L, S, o).clear);
          });
          if (!ok) return;
        }
        out.push([b, id]);
      });
    });
    return out;
  }
  function roomHasPlay(boards, states, groups) {
    if (roomMoves(boards, states, groups).length) return true;
    return boards.some(function (l, b) { return !isWon(states[b]) && iceOpensPlay(l, states[b]); });
  }
  // When nothing in the room can move: fire dies and ice melts everywhere, and if that is not enough,
  // a golden arrow (every copy of it, for a cross-board twin) flies through anything.
  function roomRescue(boards, states, groups) {
    if (states.every(isWon) || roomHasPlay(boards, states, groups)) return false;
    var log = function (b) { return (states[b].rescued = states[b].rescued || { fire: [], ice: [], freed: [] }); };
    boards.forEach(function (l, b) {
      var S = states[b], fire = Object.keys(S.burning || {}).filter(function (k) { return S.burning[k] > S.launches; }), ice = Object.keys(S.frozen || {});
      if (fire.length || ice.length) {
        fire.forEach(function (k) { log(b).fire.push(+k); }); ice.forEach(function (id) { log(b).ice.push(+id); });
        S.burning = {}; S.frozen = {};
      }
    });
    if (roomHasPlay(boards, states, groups)) return true;
    var units = [], seenGroup = {};
    boards.forEach(function (l, b) {
      var S = states[b];
      l.arrows.forEach(function (a) {
        if (S.removed[a.id] || (paired(S, a) && a.twin < a.id)) return;
        var members = [];
        if (a.coopGroup !== undefined && groups && groups[a.coopGroup]) {
          if (seenGroup[a.coopGroup]) return; seenGroup[a.coopGroup] = 1;
          groups[a.coopGroup].members.forEach(function (m) { if (!states[m[0]].removed[m[1]]) members.push([m[0], m[1]]); });
        } else group(l, a, S).forEach(function (m) { members.push([b, m.id]); });
        var cost = 0;
        members.forEach(function (m) { cost += obstaclesOf(boards[m[0]], states[m[0]], boards[m[0]].arrows[m[1]]).solid; });
        units.push({ members: members, cost: cost + (a.kind === 'compass' ? 1000 : 0) });
      });
    });
    units.sort(function (p, q) { return p.cost - q.cost; });
    var free = function (u, on) { u.members.forEach(function (m) { var S = states[m[0]]; S.freed = Object.assign({}, S.freed); if (on) S.freed[m[1]] = true; else delete S.freed[m[1]]; }); };
    for (var i = 0; i < units.length && i < 24; i++) {
      free(units[i], true);
      if (roomHasPlay(boards, states, groups)) { units[i].members.forEach(function (m) { log(m[0]).freed.push(m[1]); }); return true; }
      free(units[i], false);
    }
    if (units.length) { free(units[0], true); units[0].members.forEach(function (m) { log(m[0]).freed.push(m[1]); }); return true; }
    return false;
  }
  function isStuck(level, state) { return !isWon(state) && legalMoves(level, state).length === 0 && !iceOpensPlay(level, state); }

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
    // Compasses and twin-shared arrows keep their one effect: ice and wind leave them alone. Snipers take anything.
    if (a.kind === 'compass' || a.coopGroup !== undefined) return [];
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
      var want = 1 + Math.floor(r() * 5), pool = shuffle(live.filter(function (a) { return a.kind !== 'compass' && a.coopGroup === undefined && state.frozen[a.id] === undefined; }), r);
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
      var fireScale = Math.max(1, Math.round(level.w * level.h / 56 * 0.75));
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
    if (!state.safe && isStuck(level, state) && (Object.keys(state.frozen).length || Object.keys(state.burning).length)) {
      ev.thaw = ev.thaw.concat(Object.keys(state.frozen).map(Number));
      state.frozen = {}; state.burning = {}; ev.cleared = true;
    }
    unstickGhosts(level, state);
    if (state.safe) ensurePlay(level, state);
    return ev;
  }

  // Depth-first search with memoised dead ends.
  function solve(level, from, budget) {
    var state = { picked: from.picked, freed: from.freed, redLift: from.redLift, removed: from.removed.slice(), launches: from.launches, lives: null, history: [], burning: from.burning ? Object.assign({}, from.burning) : {}, ghostFlip: from.ghostFlip || 0, arrowsRef: level.arrows };
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
        if (state.removed[cand.id] || (paired(state, cand) && cand.twin < cand.id) || !canLaunch(level, state, cand.id)) continue;
        tried++;
        var members = group(level, cand, state);
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
  /* ---------- Co-op rooms: 4 boards in a 2 x 2 grid ---------- */
  // Board b sits at row b >> 1, column b & 1. A shot leaving in direction d goes to this neighbour, or nowhere.
  // Boards sit in a 2 x 2 grid (0 1 / 2 3). A room of 2 uses the top row only, so shots there go sideways.
  function coopNeighbour(b, d, n) {
    var r = b >> 1, c = b & 1;
    if (n === 2) return d === 1 && c === 0 ? 1 : d === 3 && c === 1 ? 0 : -1;
    if (d === 1 && c === 0) return b + 1;
    if (d === 3 && c === 1) return b - 1;
    if (d === 2 && r === 0) return b + 2;
    if (d === 0 && r === 1) return b - 2;
    return -1;
  }
  // Every board is a normal winnable board. Snipers are a bonus. Cross-board twins are chosen in the same order on every
  // board's own solution, so playing each board's solution in turn always lets every group leave together.
  function coopRoom(seed, spec) {
    var r = rng32(seed || 1), boards = [], groups = [];
    spec = applyTypes(Object.assign({}, spec || { w: 7, h: 9, minLen: 2, maxLen: 6, depth: 7, twins: 1, mirrors: 2 }), spec && spec.off);
    var n = spec.n || 4, lives = spec.lives === undefined ? 12 : spec.lives;
    for (var b = 0; b < n; b++) {
      var lvl = generate(spec, (seed || 1) + b * 977, 200) || generate(Object.assign({}, spec, { mirrors: 0 }), (seed || 1) + b * 977, 200);
      lvl.lives = lives; lvl.hints = 0;
      boards.push(lvl);
    }
    var empty = function (lvl) { return { removed: lvl.arrows.map(function () { return true; }), launches: 0, frozen: {}, burning: {} }; };
    // Cross-board twins never carry another effect, the same as twins in single player. Snipers can carry any effect.
    var plain = function (a) { return a.kind === 'plain' && !traitCount(a) && !a.sniper && a.coopGroup === undefined; };
    var sniperOk = function (a) { return a.kind === 'plain' && !a.sniper && a.coopGroup === undefined; };
    // Snipers: between 1 in 25 and 1 in 10 of each board's arrows, aimed so they reach a neighbouring board.
    if (!spec.noSnipers) boards.forEach(function (lvl, b) {
      var n = lvl.arrows.length, want = Math.max(1, Math.min(Math.floor(n / 10), Math.max(Math.ceil(n / 25), Math.round(n / 13))));
      shuffle(lvl.arrows.slice(), r).forEach(function (a) {
        if (want <= 0 || !sniperOk(a)) return;
        var c = check(lvl, empty(lvl), a);
        if (coopNeighbour(b, c.endDir, boards.length) < 0) return;
        a.sniper = true; want--;
      });
    });
    // Cross-board twins in groups of 2, 3 and 4.
    var sizes = n === 2 ? [2, 2] : shuffle([2, 3, 4], r), last = [-1, -1, -1, -1];
    if (spec.big) sizes = sizes.concat(n === 2 ? [2] : shuffle([2, 3, 4], r));
    if (spec.noTwins) sizes = [];
    sizes.forEach(function (size, gi) {
      var pick = shuffle(n === 2 ? [0, 1] : [0, 1, 2, 3], r).slice(0, size), members = [];
      pick.sort().forEach(function (b) {
        var lvl = boards[b], sol = lvl.solution, options = [];
        for (var i = last[b] + 1; i < sol.length && options.length < 3; i++) if (plain(lvl.arrows[sol[i]])) options.push(i);
        if (!options.length) return;
        var at = options[Math.floor(r() * options.length)];
        members.push([b, sol[at], at]);
      });
      if (members.length < 2) return;
      members.forEach(function (m) { boards[m[0]].arrows[m[1]].coopGroup = groups.length; last[m[0]] = m[2]; });
      groups.push({ id: groups.length, members: members.map(function (m) { return [m[0], m[1]]; }) });
    });
    return { seed: seed, boards: boards, groups: groups, big: !!spec.big, n: n, lives: lives };
  }
  // Hard boards: some arrows carry several effects at once (up to 3, season effects not counted).
  function traitCount(a) {
    return (a.kind === 'twin' ? 1 : 0) + (a.key !== undefined ? 1 : 0) + (a.isKey ? 1 : 0) + (a.wait ? 1 : 0) + (a.ghostPhase !== undefined ? 1 : 0) + (a.phase ? 1 : 0) + (a.red ? 1 : 0) + (a.uno !== undefined ? 1 : 0);
  }
  // Arrow types the player switched off are left out of a generated board.
  var TYPE_KEYS = { twins: ['twins'], compass: ['compass'], moon: ['sleepers'], mirror: ['mirrors'], patient: ['patient'], ghost: ['ghosts'], phase: ['phases'], red: ['reds'], reverse: ['unos'] };
  function applyTypes(spec, off) {
    if (!off) return spec;
    Object.keys(TYPE_KEYS).forEach(function (k) { if (off[k]) TYPE_KEYS[k].forEach(function (f) { spec[f] = 0; }); });
    spec.off = off;
    if (off.ghost && off.reverse && off.phase && off.patient && off.red) spec.combos = 0;
    if (off.sniper) spec.noSnipers = true;
    if (off.twinshared) spec.noTwins = true;
    return spec;
  }
  function assignCombos(level, spec, r) {
    var n = level.solution.length, stepOf = {};
    level.solution.forEach(function (id, i) { stepOf[id] = i; });
    var pool = level.arrows.filter(function (a) { return a.kind === 'plain' && a.cells.length >= 3 && stepOf[a.id] !== undefined; });
    pool = shuffle(pool, r).sort(function (p, q) { return traitCount(q) - traitCount(p); });
    var made = 0, off = spec.off || {};
    pool.some(function (a) {
      if (made >= spec.combos) return true;
      var step = stepOf[a.id], want = traitCount(a) ? 2 + (r() < 0.4 ? 1 : 0) : 2 + (r() < 0.3 ? 1 : 0);
      var adders = shuffle([
        function () { if (a.ghostPhase !== undefined || off.ghost) return false; a.ghostPhase = step % 2; return true; },
        function () { if (a.uno !== undefined || off.reverse) return false; a.uno = step % 2; return true; },
        function () { if (a.phase || off.phase) return false; a.phase = true; return true; },
        function () { if (a.wait || a.isKey || step < 2 || off.patient) return false; a.wait = 2 + Math.floor(r() * Math.min(step - 1, 5)); return true; },
        function () { if (a.red || a.isKey || off.red) return false; var count = Math.max(3, step + 2 + Math.floor(n * (spec.redSlack || 0))); if (count > n - 2) return false; a.red = count; return true; }
      ], r);
      // An arrow only carries as many effects as its body has room to show: one per cell after the tail, at most 3.
      var room = Math.min(3, a.cells.length - 1);
      for (var i = 0; i < adders.length && traitCount(a) < Math.min(room, want); i++) adders[i]();
      if (traitCount(a) >= 2) made++;
      return false;
    });
    return made >= spec.combos;
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
      if (spec.unos && !assignReverse(lvl, spec, rng32(useSeed + 13))) continue;
      if (spec.combos && !assignCombos(lvl, spec, rng32(useSeed + 17))) continue;
      if ((spec.unos || spec.combos) && !replays(lvl)) continue;
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
        if (spec.big && mirrorUse > 0) {
          // On big maps a mirror no arrow can reach is simply left out.
          lvl.mirrors = lvl.mirrors.filter(function (mi) { return seen[mi.x + ',' + mi.y]; });
          prepare(lvl);
        } else if (mirrorUse < lvl.mirrors.length) continue;
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
      sleepers: more((n % 5 === 2 ? 1 : 0) + (hard ? 1 : 0)), mirrors: more(1 + (n % 3 === 0 ? 1 : 0) + (hard && n % 2 ? 2 : 0)), combos: hard ? more(1) : 0, patient: more((n % 5 === 4 ? 1 : 0) + (hard && n % 2 === 0 ? 1 : 0)),
      trap: hard ? [0.15, 0.7] : [0.05, 0.45], lives: hard ? 2 : null, hints: hard ? 0 : 1,
      ghosts: special.ghosts ? more(1 + extraOf) : 0, unos: special.unos ? more(1 + extraOf) : 0, phases: special.phases ? more(1 + extraOf) : 0,
      // Red cards can trap you, so big maps use few of them and give them more time.
      reds: special.reds ? Math.min(more(1), 1 + Math.floor(scale / 5)) : 0, redSlack: scale > 1 ? 0.12 : 0,
      flowers: fx.indexOf('spring') >= 0 ? 0.24 : 0, gaps: Math.max(fx.indexOf('summer') >= 0 ? 0.14 : 0, fx.indexOf('autumn') >= 0 ? 0.24 : 0)
    };
  }
  // Builds a board, simplifying the mix of special arrows if a seed cannot fit them all.
  function endlessBoard(n, opts, seed) {
    var spec = applyTypes(endlessSpec(n, opts), opts && opts.off);
    var tries = spec.big ? 3 : 30;
    var lvl = generate(spec, seed, tries)
      || generate(Object.assign({}, spec, { mirrors: Math.ceil((spec.mirrors || 0) / 2) }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, twins: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, ghosts: 0, phases: 0, reds: 0, unos: 0, combos: 0 }), seed, tries)
      || generate(Object.assign({}, spec, { mirrors: 0, compass: 0, sleepers: 0, patient: 0, twins: 0, ghosts: 0, phases: 0, reds: 0, unos: 0, combos: 0 }), seed, tries * 2);
    lvl.hints = spec.hints; lvl.big = spec.big; lvl.effects = opts && opts.effects ? opts.effects.slice() : [];
    return lvl;
  }
  function timeLimitFor(launches) { return Math.round((10 + launches * 3.2) / 5) * 5; }


  /* ---------- Boarding Up specials: hand-made levels ---------- */
  // An arrow is written as its cells, tail first, head last ("x,y x,y"). A one-tile arrow names its direction.
  function specArrow(id, txt, more) {
    var cells = txt.split(' ').map(function (c) { return c.split(',').map(Number); }), n = cells.length, dir = more && more.dir;
    if (n > 1) { var h = cells[n - 1], q = cells[n - 2]; dir = h[1] < q[1] ? 0 : h[0] > q[0] ? 1 : h[1] > q[1] ? 2 : 3; }
    var a = Object.assign({ id: id, kind: 'plain', cells: cells, dir: dir }, more || {});
    if (a.dir === undefined) a.dir = 0;
    return a;
  }
  var SPECIALS = {
    // Matchday: a row of boards and one ball. Score on the right; the goal on the left is your own.
    fb1: { kind: 'football', w: 5, h: 5, goal: [1, 2, 3], kicks: [{ b: 0, x: 3, y: 3 }], lives: 5, boards: [
      [['1,3 2,3'], ['1,1 2,1'], ['0,4 0,3', { red: 2 }], ['3,0 3,1 3,2', { red: 1 }], ['4,3 4,2 4,1']],
      [['2,3 2,4'], ['2,0 2,1'], ['4,4 3,4'], ['0,2 1,2 2,2'], ['4,1 3,1', { red: 2 }], ['1,3 0,3']],
      [['3,1 3,0'], ['3,3 3,4', { red: 1 }], ['0,4 1,4'], ['1,0 0,0'], ['2,1 2,2 2,3']]
    ] },
    fb2: { kind: 'football', w: 5, h: 5, goal: [1, 2, 3], kicks: [{ b: 1, x: 4, y: 3 }], lives: 5, boards: [
      [['3,0 4,0'], ['4,4 3,4'], ['2,4 2,3'], ['2,1 1,1 0,1', { red: 1 }], ['3,1 3,2 3,3']],
      [['2,0 2,1'], ['3,4 2,4', { red: 2 }], ['0,3 1,3'], ['4,2 3,2'], ['4,0 4,1'], ['0,2 1,2 2,2']],
      [['3,3 4,3', { red: 1 }], ['0,3 1,3'], ['2,0 3,0'], ['1,1 1,0'], ['2,2 2,3', { red: 2 }], ['4,1 3,1 2,1']],
      [['1,3 1,4'], ['2,4 2,3', { red: 2 }], ['2,0 1,0'], ['4,0 4,1', { red: 1 }], ['0,1 0,2 0,3']]
    ] },
    fb3: { kind: 'football', w: 5, h: 5, goal: [1, 2, 3], kicks: [{ b: 1, x: 3, y: 1 }], lives: 5, boards: [
      [['3,0 4,0'], ['4,4 3,4'], ['2,4 2,3'], ['4,2 3,2 2,2'], ['2,1 1,1', { red: 2 }]],
      [['1,2 1,3'], ['2,4 2,3'], ['1,0 2,0', { red: 2 }], ['0,1 1,1'], ['4,4 4,3'], ['4,2 4,1 4,0']],
      [['4,2 3,2'], ['2,1 2,0', { red: 1 }], ['0,4 1,4'], ['0,0 1,0'], ['0,2 1,2 2,2'], ['4,3 3,3 2,3']],
      [['1,1 2,1', { red: 2 }], ['4,1 4,2'], ['0,3 1,3'], ['3,4 3,3'], ['4,0 3,0'], ['2,3 2,2'], ['0,1 0,2']],
      [['4,1 4,0'], ['2,1 3,1', { red: 2 }], ['3,4 3,3', { red: 1 }], ['0,4 1,4'], ['1,0 0,0'], ['1,2 2,2']]
    ] },
    fb4: { kind: 'football', w: 6, h: 6, goal: [2, 3, 4], kicks: [{ b: 2, x: 3, y: 3 }], lives: 5, boards: [
      [['3,0 4,0'], ['5,5 4,5'], ['3,5 3,4'], ['3,2 2,2 1,2', { red: 1 }], ['4,2 4,3 4,4'], ['2,5 2,4 2,3', { red: 2 }], ['4,1 3,1 2,1']],
      [['2,5 2,4'], ['1,1 2,1', { red: 2 }], ['0,2 1,2'], ['4,5 5,5'], ['4,0 4,1'], ['1,3 1,4'], ['4,2 4,3 4,4'], ['3,5 3,4 3,3']],
      [['3,2 3,1', { red: 1 }], ['3,0 4,0'], ['2,0 2,1'], ['1,5 2,5', { red: 2 }], ['0,4 1,4'], ['4,4 4,5', { red: 1 }], ['5,3 4,3'], ['2,3 1,3 0,3', { red: 3 }]],
      [['2,0 1,0'], ['2,4 2,3', { red: 2 }], ['5,0 5,1', { red: 1 }], ['0,5 1,5'], ['3,5 4,5'], ['1,1 1,2 1,3', { red: 2 }], ['4,1 3,1'], ['3,3 3,2']]
    ] },
    fb5: { kind: 'football', w: 7, h: 7, goal: [2, 3, 4], kicks: [{ b: 3, x: 4, y: 4 }], lives: 5, boards: [
      [['5,2 5,1'], ['1,0 2,0'], ['4,0 3,0'], ['3,2 3,3'], ['3,5 3,4'], ['6,6 5,6']],
      [['6,1 5,1', { red: 2 }], ['0,3 1,3'], ['3,3 2,3'], ['2,5 3,5'], ['5,5 4,5'], ['1,0 1,1']],
      [['2,4 2,5'], ['3,6 3,5'], ['2,1 3,1', { red: 2 }], ['1,2 2,2'], ['5,6 6,6'], ['5,0 5,1', { red: 1 }], ['5,2 5,3', { red: 2 }]],
      [['6,4 5,4'], ['2,2 2,3', { red: 2 }], ['1,5 2,5'], ['0,0 1,0'], ['4,6 5,6'], ['3,1 4,1'], ['6,1 5,1']],
      [['4,2 4,1', { red: 1 }], ['4,0 5,0'], ['3,0 3,1'], ['2,5 3,5', { red: 2 }], ['1,4 2,4'], ['5,4 5,5', { red: 1 }], ['0,6 1,6']]
    ] },
    // Fowl Play: push birds onto the slingshot, then throw them at the wooden walls. From level 2, birds break arrows too.
    sl1: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 6, h: 6, sling: [4, 1], birds: [[4, 3]], walls: [[1, 1, 'r']], arrows: [['4,5 4,4'], ['0,1 1,1'], ['0,4 1,4'], ['5,3 5,2'], ['2,3 2,2']] }
    ] },
    sl2: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 5, h: 5, sling: [1, 3], walls: [], arrows: [['0,1 1,1'], ['4,1 3,1 2,1'], ['2,4 3,4', { ghostPhase: 1 }], ['4,2 4,3']] },
      { w: 5, h: 5, birds: [[1, 3]], walls: [], arrows: [['4,3 3,3'], ['4,0 3,0 2,0', { phase: true }], ['1,1 1,0'], ['0,0 0,1']] }
    ] },
    // Fowl Play 3 brings in nests: the nest is the only way to stop the bird where arrows can steer it onto the slingshot.
    sl3: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 6, h: 6, sling: [0, 2], birds: [[0, 3]], walls: [], arrows: [['0,5 0,4'], ['2,0 3,0'], ['4,5 4,4'], ['2,3 3,3', { ghostPhase: 1 }], ['2,5 2,4']] },
      { w: 6, h: 6, sling: [5, 4], nests: [[3, 2]], birds: [[3, 3]], walls: [[5, 2, 'r']], arrows: [['3,5 3,4'], ['0,2 1,2'], ['5,0 5,1'], ['1,5 2,5'], ['0,4 0,3'], ['2,0 1,0']] }
    ] },
    sl4: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 6, h: 6, birds: [[3, 1]], walls: [], arrows: [['1,1 2,1'], ['0,4 1,4 2,4', { phase: true }], ['4,5 4,4'], ['0,2 0,3', { ghostPhase: 1 }]] },
      { w: 6, h: 6, sling: [2, 1], birds: [[2, 3]], walls: [[2, 1, 'b']], arrows: [['2,5 2,4'], ['5,5 4,5 3,5', { phase: true }], ['0,4 0,5']] },
      { w: 6, h: 6, walls: [], arrows: [['2,0 2,1'], ['2,4 2,3'], ['1,3 1,2'], ['4,0 4,1'], ['4,4 4,3'], ['0,5 1,5', { ghostPhase: 0 }]] }
    ] },
    sl5: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 7, h: 6, sling: [2, 3], birds: [[4, 3]], walls: [[2, 1, 'b']], arrows: [['6,3 5,3'], ['2,0 2,1'], ['5,5 4,5 3,5', { phase: true }], ['0,0 0,1']] },
      { w: 7, h: 6, sling: [2, 1], walls: [[3, 1, 'r']], arrows: [['3,2 3,3'], ['3,5 3,4'], ['2,5 2,4'], ['0,1 1,1'], ['1,2 1,3', { ghostPhase: 1 }], ['5,5 6,5']] }
    ] },
    sl6: { kind: 'sling', lives: 4, birdsBreak: true, boards: [
      { w: 6, h: 6, sling: [2, 1], birds: [[5,  4]], walls: [[2, 0, 'b'], [3, 0, 'b']], arrows: [['1,3 1,4', { phase: true }], ['2,3 3,3'], ['5,1 5,2 5,3'], ['4,4 3,4'], ['3,1 3,0']] },
      { w: 6, h: 6, sling: [4, 2], birds: [[4,  3]], walls: [[0, 1, 'r']], arrows: [['0,0 1,0 2,0', { phase: true }], ['5,1 4,1', { ghostPhase: 0 }], ['2,4 1,4', { ghostPhase: 0 }], ['3,0 4,0', { ghostPhase: 0 }], ['4,5 4,4'], ['2,2 2,3']] },
      { w: 6, h: 6, sling: [2, 2], nests: [[3, 1]], birds: [[2,  3]], walls: [[2, 2, 'r'], [4, 4, 'b'], [0, 3, 'b']], arrows: [['4,2 4,3'], ['3,4 3,3', { phase: true }], ['5,5 5,4', { phase: true }], ['0,3 1,3']] }
    ] },
    // The Poem: one level, one board per line. Compass arrows push letters into their slots; letters fall.
    poem: { kind: 'poem', lives: 5, boards: [
      { w: 5, h: 5, word: 'SEA', pt: 'MAR', line: 'Breathe out, and let the {SEA}', ptLine: 'Respira, e deixa o {MAR}', letters: [[2,  2,  0],  [2,  0,  1],  [3,  2,  2]], slots: [[1,  4],  [2,  4],  [3,  4]], arrows: [['4,1', { kind: 'compass', dir: 0 }], ['4,2', { kind: 'compass', dir: 1 }], ['3,3', { kind: 'compass', dir: 2 }], ['3,1', { kind: 'compass', dir: 0 }], ['2,1', { kind: 'compass', dir: 3 }], ['2,3', { kind: 'compass', dir: 2 }]] },
      { w: 5, h: 6, word: 'DAY', pt: 'DIA', line: 'carry the long {DAY} away;', ptLine: 'levar o longo {DIA} embora;', letters: [[2,  1,  0],  [3,  0,  1],  [2,  3,  2]], slots: [[1,  5],  [2,  5],  [3,  5]], arrows: [['0,2', { kind: 'compass', dir: 3 }], ['4,4', { kind: 'compass', dir: 1 }], ['4,1', { kind: 'compass', dir: 3 }], ['2,4', { kind: 'compass', dir: 3 }], ['3,1', { kind: 'compass', dir: 3 }], ['2,2', { kind: 'compass', dir: 3 }], ['1,3', { kind: 'compass', dir: 1 }]] },
      { w: 6, h: 6, word: 'STAR', pt: 'LUAR', line: 'beneath a quiet {STAR},', ptLine: 'sob um {LUAR} sereno,', letters: [[4,  0,  0],  [1,  2,  1],  [3,  3,  2],  [4,  3,  3]], slots: [[1,  5],  [2,  5],  [3,  5],  [4,  5]], arrows: [['5,4', { kind: 'compass', dir: 0 }], ['1,4', { kind: 'compass', dir: 3 }], ['3,4', { kind: 'compass', dir: 2 }], ['0,2', { kind: 'compass', dir: 0 }], ['1,3', { kind: 'compass', dir: 2 }], ['4,4', { kind: 'compass', dir: 1 }], ['4,1', { kind: 'compass', dir: 2 }], ['4,2', { kind: 'compass', dir: 1 }]] },
      { w: 6, h: 6, word: 'HOME', pt: 'CASA', line: 'the heart finds its way {HOME}.', ptLine: 'o coração volta a {CASA}.', letters: [[1,  2,  0],  [3,  0,  1],  [4,  3,  2],  [2,  3,  3]], slots: [[1,  5],  [2,  5],  [3,  5],  [4,  5]], arrows: [['0,1', { kind: 'compass', dir: 0 }], ['1,3', { kind: 'compass', dir: 1 }], ['5,3', { kind: 'compass', dir: 2 }], ['4,4', { kind: 'compass', dir: 0 }], ['3,1', { kind: 'compass', dir: 3 }], ['5,1', { kind: 'compass', dir: 3 }], ['1,4', { kind: 'compass', dir: 1 }], ['2,4', { kind: 'compass', dir: 2 }]] }
    ] }
  };
  var BIRD_COLORS = ['#3d8bf2', '#f2b035', '#4fb06d', '#e8669a', '#9b6bd8'];
  // Builds a room of boards for a special level. lang picks the poem's word.
  function specialRoom(key, lang, def, opts) {
    var d = def || SPECIALS[key], boards = [], base = { lives: d.lives, hints: 0, timeLimit: null, season: null, flowers: null, mirrors: [], special: d.kind };
    var arrowsOf = function (list) { return list.map(function (a, i) { return specArrow(i, a[0], a[1]); }); };
    if (d.kind === 'football') {
      // Each try can start the ball on a different spot; every spot listed is known to be winnable.
      var kicks = d.kicks || [d.kick], pick = opts && opts.kick !== undefined ? opts.kick : 0;
      d = Object.assign({}, d, { kick: kicks[Math.max(0, Math.min(kicks.length - 1, pick))] });
      var n = d.boards.length, ym = d.goal[Math.floor(d.goal.length / 2)];
      d.boards.forEach(function (list, b) {
        var arrows = arrowsOf(list), goals = [];
        // Keepers stand in front of both goals: they can never be played and never move.
        if (b === 0) { arrows.push(specArrow(arrows.length, '0,' + ym + ' 1,' + ym, { red: 1, keeper: true })); goals.push({ side: 3, ys: d.goal.slice(), own: true }); }
        if (b === n - 1) { arrows.push(specArrow(arrows.length, (d.w - 1) + ',' + ym + ' ' + (d.w - 2) + ',' + ym, { red: 1, keeper: true })); goals.push({ side: 1, ys: d.goal.slice(), own: false }); }
        var props = b === d.kick.b ? [{ id: 0, kind: 'ball', x: d.kick.x, y: d.kick.y }] : [];
        boards.push(prepare(Object.assign({ w: d.w, h: d.h, arrows: arrows, props: props, goals: goals, redStay: true }, base)));
      });
      return { kind: d.kind, key: key, boards: boards, groups: [], kick: d.kick, kicks: kicks, lives: d.lives, n: n, layout: 'row' };
    }
    var bird = 0;
    d.boards.forEach(function (bd) {
      var lvl = Object.assign({ w: bd.w, h: bd.h, arrows: arrowsOf(bd.arrows), props: [] }, base);
      if (d.kind === 'sling') {
        if (bd.sling) lvl.sling = { x: bd.sling[0], y: bd.sling[1] };
        lvl.walls = bd.walls || []; lvl.birdsBreak = !!d.birdsBreak; lvl.nests = bd.nests || [];
        lvl.props = (bd.birds || []).map(function (c) { var i = bird++; return { id: i, kind: 'bird', x: c[0], y: c[1], color: BIRD_COLORS[i % BIRD_COLORS.length], loaded: !!(bd.sling && bd.sling[0] === c[0] && bd.sling[1] === c[1]) }; });
      } else {
        var word = lang === 'pt' ? bd.pt : bd.word;
        lvl.gravity = true; lvl.word = word; lvl.line = lang === 'pt' ? bd.ptLine : bd.line;
        lvl.props = bd.letters.map(function (c, i) { return { id: i, kind: 'letter', x: c[0], y: c[1], ch: word.charAt(c[2] === undefined ? i : c[2]) }; });
        lvl.slots = bd.slots.map(function (c, i) { return { x: c[0], y: c[1], ch: word.charAt(i) }; });
      }
      boards.push(prepare(lvl));
    });
    return { kind: d.kind, key: key, boards: boards, groups: [], lives: d.lives, n: boards.length, layout: 'row' };
  }


  return {
    TUTORIALS: TUTORIALS, applyTypes: applyTypes, coopRoom: coopRoom, coopNeighbour: coopNeighbour, TURN: TURN, ensurePlay: ensurePlay, boardClearable: boardClearable, traitCount: traitCount, tutorialStart: tutorialStart, tutorialSpin: tutorialSpin, isReady: isReady, paired: paired, unstickGhosts: unstickGhosts, isGhost: isGhost, tipOf: tipOf, tipAtTail: tipAtTail, hasRedCard: hasRedCard, isRedCarded: isRedCarded, effectsOf: effectsOf, hasEffect: hasEffect, endlessBoard: endlessBoard, endlessSpec: endlessSpec, timeLimitFor: timeLimitFor, iceHits: iceHits, seasonStep: seasonStep, resetBoard: resetBoard, pivotOptions: pivotOptions, DX: DX, DY: DY, rng32: rng32, prepare: prepare, newState: newState, headOf: headOf, dirOf: dirOf,
    check: check, canLaunch: canLaunch, tap: tap, rewind: rewind, legalMoves: legalMoves, isWon: isWon,
    SPECIALS: SPECIALS, specialRoom: specialRoom, BIRD_COLORS: BIRD_COLORS,
    edgeKey: edgeKey, wallOn: wallOn, propAt: propAt, slideProp: slideProp, pushMoves: pushMoves, settle: settle, slotsDone: slotsDone, findProp: findProp, anyMove: anyMove, carry: carry, throwBird: throwBird, solveSpecial: solveSpecial, resetBall: resetBall, roomTap: roomTap,
    isStuck: isStuck, roomMoves: roomMoves, roomHasPlay: roomHasPlay, roomRescue: roomRescue, solve: solve, trapRate: trapRate, depthOf: depthOf, generate: generate
  };
});
