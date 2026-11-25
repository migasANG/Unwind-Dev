// Searches for good Matchday boards: random layouts, kept only when a solver says they make a real puzzle.
// node tools/gen-specials.js fb <boards> <seed from> <count>
const E = require('../src/engine.js');

function cl(S) {
  return { removed: S.removed.slice(), launches: S.launches, lives: S.lives, props: S.props.map((p) => Object.assign({}, p)), broken: Object.assign({}, S.broken), loaded: S.loaded, redStay: S.redStay, history: [], frozen: {}, burning: {}, snaps: [], ghostFlip: 0, arrowsRef: S.arrowsRef };
}
function key(states) {
  let k = '';
  for (const S of states) { for (const r of S.removed) k += r ? '1' : '0'; for (const p of S.props) if (!p.gone) k += '|' + p.id + ':' + p.x + ',' + p.y + (p.loaded ? 'L' : ''); for (const b in S.broken) k += '#' + b; k += '/'; }
  return k;
}
function moves(room, states) {
  const out = [];
  room.boards.forEach((L, b) => {
    const S = states[b];
    for (const a of L.arrows) {
      if (S.removed[a.id] || !E.isReady(S, a)) continue;
      const ns = states.map(cl);
      const r = E.roomTap(room.boards, ns, b, a.id, room.kick || { b: 0, x: 0, y: 0 });
      const res = r.res;
      if (res.eggs) continue;
      let kind = res.ok ? 'launch' : res.pushed ? (res.pushed.some((p) => p.moved) ? 'push' : 'noop') : 'hit';
      if (kind === 'noop') continue;
      if (r.ball) kind = r.ball.result === 'moved' ? 'push' : r.ball.result;
      if (r.birds && r.birds.some((x) => x.result === 'lost')) kind = 'lost';
      out.push({ b, id: a.id, kind, red: !!a.red, states: ns, cost: kind === 'hit' || kind === 'out' || kind === 'own' ? 1 : 0, goal: kind === 'goal', ball: r.ball, pushRes: res.pushed });
    }
    if (L.sling && S.loaded !== -1) for (let d = 0; d < 4; d++) {
      const ns = states.map(cl);
      const r = E.throwBird(room.boards, ns, b, d);
      if (!r || r.noop) continue;
      out.push({ b, fire: d, kind: r.broke ? 'wall' : r.destroyed ? 'kill' : r.gone ? 'lost' : 'throw', states: ns, cost: 0, throwRes: r });
    }
  });
  return out;
}
function isGoal(room, states, mv) {
  if (room.kind === 'football') return !!(mv && mv.goal);
  if (room.kind === 'poem') return E.slotsDone(room.boards[0], states[0]);
  return states.every((S) => E.isWon(S));
}
function solve(room, limit) {
  const start = room.boards.map((L) => { const S = E.newState(L); S.lives = null; return S; });
  const seen = new Map([[key(start), 0]]), dq = [{ states: start, cost: 0, path: [] }];
  let n = 0, best = null;
  while (dq.length && n < limit) {
    const cur = dq.shift(); n++;
    if (best && cur.cost > best.cost) break;
    for (const mv of moves(room, cur.states)) {
      const cost = cur.cost + mv.cost, path = cur.path.concat([mv]);
      if (isGoal(room, mv.states, mv)) { if (!best || cost < best.cost || (cost === best.cost && path.length < best.path.length)) best = { cost, path }; continue; }
      const k = key(mv.states);
      if (seen.has(k) && seen.get(k) <= cost) continue;
      seen.set(k, cost);
      const it = { states: mv.states, cost, path };
      if (mv.cost) dq.push(it); else dq.unshift(it);
    }
  }
  return { best, explored: n, done: !dq.length || !!best, seen };
}
// Every state reachable without losing a life: can all red card arrows ever be gone at once?
function allRedsClearable(room, seen) {
  for (const k of seen.keys()) {
    const parts = k.split('/');
    let ok = true;
    room.boards.forEach((L, b) => { const bits = parts[b]; L.arrows.forEach((a, i) => { if (a.red && !a.keeper && bits[i] !== '1') ok = false; }); });
    if (ok) return true;
  }
  return false;
}
function randomRate(room, runs, lives, seed) {
  let ok = 0; const r = E.rng32(seed || 7);
  for (let i = 0; i < runs; i++) {
    let states = room.boards.map((L) => E.newState(L)), left = lives;
    for (let g = 0; g < 120; g++) {
      const ms = moves(room, states); if (!ms.length) break;
      const m = ms[Math.floor(r() * ms.length)]; left -= m.cost; if (left <= 0) break;
      states = m.states; if (isGoal(room, states, m)) { ok++; break; }
    }
  }
  return ok / runs;
}
const lab = require('./specials-lab.js');
function label(m) { return 'b' + m.b + ':' + (m.fire !== undefined ? 'fire' + 'URDL'[m.fire] : m.id) + '(' + m.kind + ')'; }

// ---------- Football ----------
function randFootball(n, seed, w, h) {
  const r = E.rng32(seed), goal = [1, 2, 3], kickB = n >= 5 ? 2 : 1, kick = { b: kickB, x: Math.floor(w / 2), y: 2 };
  const boards = [];
  for (let b = 0; b < n; b++) {
    const used = {}, list = [];
    const mark = (x, y) => { used[y * w + x] = 1; };
    if (b === 0) { mark(0, 2); mark(1, 2); }
    if (b === n - 1) { mark(w - 1, 2); mark(w - 2, 2); }
    if (b === kickB) mark(kick.x, kick.y);
    const want = 3 + Math.floor(r() * 3) + (b === n - 1 || b === kickB ? 1 : 0);
    for (let t = 0; t < 80 && list.length < want; t++) {
      const d = Math.floor(r() * 4), len = 2 + (r() < 0.3 ? 1 : 0), hx = Math.floor(r() * w), hy = Math.floor(r() * h), cells = [];
      for (let i = len - 1; i >= 0; i--) cells.push([hx - E.DX[d] * i, hy - E.DY[d] * i]);
      if (cells.some((c) => c[0] < 0 || c[1] < 0 || c[0] >= w || c[1] >= h || used[c[1] * w + c[0]])) continue;
      cells.forEach((c) => mark(c[0], c[1]));
      const opts = r() < 0.3 ? { red: 1 + Math.floor(r() * 3) } : undefined;
      list.push(opts ? [cells.map((c) => c.join(',')).join(' '), opts] : [cells.map((c) => c.join(',')).join(' ')]);
    }
    boards.push(list);
  }
  return { kind: 'football', w, h, goal, kick, lives: 5, boards };
}
function evalFootball(def, minMoves) {
  E.SPECIALS.__try = def;
  const room = E.specialRoom('__try');
  const reds = room.boards.reduce((s, L) => s + L.arrows.filter((a) => a.red && !a.keeper).length, 0);
  if (reds < 2) return null;
  const s = solve(room, 60000);
  if (!s.best || s.best.cost > 0 || s.best.path.length < minMoves || !s.done) return null;
  const path = s.best.path;
  const launchedRed = path.some((m) => m.kind === 'launch' && m.red);
  if (!launchedRed) return null;
  // Every state, not only those on the way to the goal: explore fully for the red card check.
  const full = exploreAll(room, 80000);
  if (!full || allRedsClearable(room, full)) return null;
  const visits = new Set(); path.forEach((m) => { if (m.ball) m.ball.segs.forEach((sg) => visits.add(sg.b)); });
  const rate = randomRate(room, 300, 5);
  const verticals = path.filter((m) => m.kind === 'push' && m.ball === null).length;
  return { def, room, moves: path.length, path: path.map(label), rate, visits: [...visits].sort(), verticals };
}
function exploreAll(room, limit) {
  const start = room.boards.map((L) => { const S = E.newState(L); S.lives = null; return S; });
  const seen = new Map([[key(start), 0]]), q = [start];
  while (q.length) {
    if (seen.size > limit) return null;
    const cur = q.pop();
    for (const mv of moves(room, cur)) { if (mv.cost || mv.goal) continue; const k = key(mv.states); if (!seen.has(k)) { seen.set(k, 1); q.push(mv.states); } }
  }
  return seen;
}
module.exports = { solve, moves, randomRate, exploreAll, allRedsClearable, label, key, cl, isGoal };
if (require.main === module) {
  const [, , kind, nArg, fromArg, countArg, minArg, wArg] = process.argv;
  if (kind === 'fb') {
    const n = +nArg || 4, from = +fromArg || 1, count = +countArg || 200, minMoves = +minArg || 7, w = +wArg || 5;
    const found = [];
    for (let seed = from; seed < from + count; seed++) {
      const def = randFootball(n, seed, w, 5);
      let res = null;
      try { res = evalFootball(def, minMoves); } catch (e) { console.error(seed, e.message); }
      if (!res) continue;
      found.push(res);
      console.log('\nseed', seed, 'moves', res.moves, 'random', (res.rate * 100).toFixed(1) + '%', 'visits', res.visits.join(','));
      lab.show(res.room);
      console.log('  ' + res.path.join(' '));
      console.log('  ' + JSON.stringify(def.boards));
    }
  }
}

// ---------- Poem boards ----------
function randPoem(len, seed, w, h) {
  const r = E.rng32(seed), used = {}, arrows = [], letters = [];
  const slotX0 = Math.floor((w - len) / 2), slots = [];
  for (let i = 0; i < len; i++) slots.push([slotX0 + i, h - 1]);
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !used[y * w + x];
  const nArrows = len + 2 + Math.floor(r() * 3);
  for (let t = 0; t < 200 && arrows.length < nArrows; t++) {
    const x = Math.floor(r() * w), y = 1 + Math.floor(r() * (h - 2));
    if (!free(x, y) || slots.some((s) => s[0] === x && s[1] === y)) continue;
    used[y * w + x] = 1; arrows.push([x + ',' + y, { kind: 'compass', dir: Math.floor(r() * 4) }]);
  }
  const order = []; for (let i = 0; i < len; i++) order.push(i);
  for (let i = len - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const tops = arrows.map((a) => a[0].split(',').map(Number)).filter((c) => free(c[0], c[1] - 1));
  for (let i = tops.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tops[i], tops[j]] = [tops[j], tops[i]]; }
  if (tops.length < len) return null;
  for (let i = 0; i < len; i++) { const c = tops[i]; used[(c[1] - 1) * w + c[0]] = 1; letters.push([c[0], c[1] - 1, order[i]]); }
  return { w, h, letters: letters.sort((a, b) => a[2] - b[2]), slots, arrows };
}
function evalPoem(bd, word, minMoves) {
  E.SPECIALS.__p = { kind: 'poem', lives: 5, boards: [Object.assign({ word, pt: word, line: '', ptLine: '' }, bd)] };
  const room = E.specialRoom('__p');
  const L = room.boards[0], S0 = E.newState(L);
  if (E.settle(L, S0).length) return null;
  if (E.slotsDone(L, S0)) return null;
  const s = solve(room, 200000);
  if (!s.best || s.best.cost > 0 || s.best.path.length < minMoves) return null;
  const pushes = s.best.path.filter((m) => m.kind === 'push').length;
  if (pushes < 1) return null;
  return { room, moves: s.best.path.length, pushes, path: s.best.path.map(label), rate: randomRate(room, 300, 5) };
}
if (require.main === module && process.argv[2] === 'po') {
  const [, , , word, fromArg, countArg, minArg, wArg, hArg] = process.argv;
  const from = +fromArg || 1, count = +countArg || 500, minMoves = +minArg || 6, w = +wArg || 5, h = +hArg || 5;
  for (let seed = from; seed < from + count; seed++) {
    const bd = randPoem(word.length, seed, w, h);
    if (!bd) continue;
    const res = evalPoem(bd, word, minMoves);
    if (!res) continue;
    console.log('\nseed', seed, 'moves', res.moves, 'pushes', res.pushes, 'random', (res.rate * 100).toFixed(1) + '%');
    lab.show(res.room);
    console.log('  ' + res.path.join(' '));
    console.log('  ' + JSON.stringify({ w, h, letters: bd.letters, slots: bd.slots, arrows: bd.arrows }));
  }
}

// ---------- Woodland boards ----------
function randSling(nb, seed, w, h) {
  const r = E.rng32(seed), boards = [];
  let birdsTotal = 0;
  for (let b = 0; b < nb; b++) {
    const used = {}, arrows = [], walls = [], birds = [];
    const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !used[y * w + x];
    let sling = null;
    if (b === 0 || r() < 0.6) { const sx = 1 + Math.floor(r() * (w - 2)), sy = 1 + Math.floor(r() * (h - 2)); sling = [sx, sy]; used[sy * w + sx] = 1; }
    const nBirds = b === 0 ? 1 : r() < 0.5 ? 1 : 0;
    for (let i = 0; i < nBirds; i++) for (let t = 0; t < 30; t++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); if (free(x, y)) { used[y * w + x] = 1; birds.push([x, y]); birdsTotal++; break; } }
    const want = 4 + Math.floor(r() * 3);
    for (let t = 0; t < 120 && arrows.length < want; t++) {
      const d = Math.floor(r() * 4), len = 2 + (r() < 0.25 ? 1 : 0), hx = Math.floor(r() * w), hy = Math.floor(r() * h), cells = [];
      for (let i = len - 1; i >= 0; i--) cells.push([hx - E.DX[d] * i, hy - E.DY[d] * i]);
      if (cells.some((c) => !free(c[0], c[1]))) continue;
      cells.forEach((c) => { used[c[1] * w + c[0]] = 1; });
      const k = r(), opts = k < 0.15 ? { phase: true } : k < 0.3 ? { ghostPhase: Math.floor(r() * 2) } : undefined;
      arrows.push(opts ? [cells.map((c) => c.join(',')).join(' '), opts] : [cells.map((c) => c.join(',')).join(' ')]);
    }
    const nWalls = 1 + Math.floor(r() * 3);
    for (let i = 0; i < nWalls; i++) { const x = Math.floor(r() * (w - 1)), y = Math.floor(r() * (h - 1)); walls.push([x, y, r() < 0.5 ? 'r' : 'b']); }
    const nests = [];
    const nNests = process.env.NESTS ? (r() < 0.7 ? 1 : 2) : 0;
    for (let i = 0; i < nNests; i++) for (let t = 0; t < 30; t++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); if (free(x, y)) { used[y * w + x] = 1; nests.push([x, y]); break; } }
    boards.push({ w, h, sling, birds, walls, arrows, nests });
  }
  if (!birdsTotal) return null;
  boards.forEach((bd) => { if (!bd.sling) delete bd.sling; });
  const def = { kind: 'sling', lives: 4, birdsBreak: true, boards };
  // Few free launches at the start, so the birds have real work to do.
  E.SPECIALS.__q = def;
  const room = E.specialRoom('__q');
  if (room.boards.some((L) => E.legalMoves(L, E.newState(L)).length > (process.env.FREE ? +process.env.FREE : 2))) return null;
  return def;
}
function evalSling(def, minMoves) {
  E.SPECIALS.__s = def;
  const room = E.specialRoom('__s');
  const s = solve(room, 120000);
  if (!s.best || s.best.cost > 0 || s.best.path.length < minMoves) return null;
  const path = s.best.path, throws = path.filter((m) => m.fire !== undefined);
  const walls = throws.filter((m) => m.kind === 'wall').length, kills = throws.filter((m) => m.kind === 'kill').length;
  const crossed = path.some((m) => (m.throwRes && m.throwRes.to && m.throwRes.to.b !== m.b) || (m.ball && m.ball.b !== m.b));
  if (throws.length < (process.env.THROWS ? +process.env.THROWS : 2) || walls < 1 || kills < 1) return null;
  // With nests on: a bird must rest in a nest on the way to the win.
  if (process.env.NESTS && !path.some((m) => (m.throwRes && m.throwRes.nest) || (m.pushRes && m.pushRes.some((pu) => pu.nest)))) return null;
  return { room, moves: path.length, throws: throws.length, walls, kills, crossed, path: path.map(label), rate: randomRate(room, 200, 4) };
}
if (require.main === module && process.argv[2] === 'sl') {
  const [, , , nArg, fromArg, countArg, minArg, wArg, hArg] = process.argv;
  const nb = +nArg || 2, from = +fromArg || 1, count = +countArg || 500, minMoves = +minArg || 12, w = +wArg || 6, h = +hArg || 6;
  for (let seed = from; seed < from + count; seed++) {
    const def = randSling(nb, seed, w, h);
    if (!def) continue;
    let res = null;
    try { res = evalSling(def, minMoves); } catch (e) { if (process.env.DEBUG) console.error(e.stack); continue; }
    if (!res) continue;
    console.log('\nseed', seed, 'moves', res.moves, 'throws', res.throws, 'walls', res.walls, 'kills', res.kills, 'random', (res.rate * 100).toFixed(1) + '%');
    lab.show(res.room);
    console.log('  ' + res.path.join(' '));
    console.log('  ' + JSON.stringify(def.boards));
  }
}
