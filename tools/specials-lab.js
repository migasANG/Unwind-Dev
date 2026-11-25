// Design bench for the Boarding Up specials (Matchday, Woodland, The Poem).
// node tools/specials-lab.js [key]   -> prints each board and solves it.
const E = require('../src/engine.js');

function clone(S) { return JSON.parse(JSON.stringify({ removed: S.removed, launches: S.launches, lives: S.lives, props: S.props, broken: S.broken, loaded: S.loaded, redStay: S.redStay, history: [], frozen: {}, burning: {}, snaps: [], ghostFlip: 0 })); }
function fix(S, L) { S.arrowsRef = L.arrows; return S; }
function keyOf(states) { return states.map((S) => S.removed.map((r) => (r ? 1 : 0)).join('') + '|' + S.props.filter((p) => !p.gone).map((p) => p.id + ':' + p.x + ',' + p.y + (p.loaded ? 'L' : '')).sort().join(';') + '|' + Object.keys(S.broken).sort().join(',')).join('#'); }

// Every move from a room state: taps on every board, and slingshot shots.
function moves(room, states) {
  const out = [];
  room.boards.forEach((L, b) => {
    L.arrows.forEach((a) => {
      const S = states[b];
      if (S.removed[a.id] || !E.isReady(S, a)) return;
      const ns = states.map((x, i) => fix(clone(x), room.boards[i]));
      const r = E.roomTap(room.boards, ns, b, a.id, room.kick || { b: 0, x: 0, y: 0 });
      const res = r.res;
      let kind = res.ok ? 'launch' : res.pushed ? (res.pushed.some((p) => p.moved) ? 'push' : 'noop') : 'hit';
      if (r.birds && r.birds.some((x) => x.result === 'lost')) kind = 'pushlost';
      if (r.ball && (r.ball.result === 'out' || r.ball.result === 'own')) kind = r.ball.result;
      if (r.ball && r.ball.result === 'goal') kind = 'goal';
      if (kind === 'noop') return;
      out.push({ label: 'b' + b + ':' + a.id + '(' + kind + ')', states: ns, cost: kind === 'hit' || kind === 'out' || kind === 'own' ? 1 : 0, goal: kind === 'goal' });
    });
    if (L.sling && states[b].loaded !== -1) for (let d = 0; d < 4; d++) {
      const ns = states.map((x, i) => fix(clone(x), room.boards[i]));
      const r = E.throwBird(room.boards, ns, b, d);
      if (!r || r.noop) continue;
      out.push({ label: 'b' + b + ':fire' + 'URDL'[d] + (r.broke ? '(wall)' : r.destroyed ? '(kill' + r.destroyed.b + ':' + r.destroyed.id + ')' : r.gone ? '(lost)' : r.to.b !== b ? '(to' + r.to.b + ')' : ''), states: ns, cost: 0 });
    }
  });
  return out;
}
function won(room, states, mv) {
  if (room.kind === 'football') return !!(mv && mv.goal);
  if (room.kind === 'poem') return E.slotsDone(room.boards[0], states[0]);
  return states.every((S) => E.isWon(S));
}
// 0-1 BFS: the fewest lives lost, then the fewest moves.
function solve(room, limit) {
  const start = room.boards.map((L) => { const S = E.newState(L); S.lives = null; return S; });
  const seen = new Map(), dq = [{ states: start, cost: 0, path: [] }];
  seen.set(keyOf(start), 0);
  let n = 0, best = null, wins = 0;
  while (dq.length && n < (limit || 400000)) {
    const cur = dq.shift(); n++;
    if (best && cur.cost > best.cost) break;
    for (const mv of moves(room, cur.states)) {
      const cost = cur.cost + mv.cost, path = cur.path.concat(mv.label);
      if (won(room, mv.states, mv)) { wins++; if (!best || cost < best.cost || (cost === best.cost && path.length < best.path.length)) best = { cost, path }; continue; }
      const k = keyOf(mv.states);
      if (seen.has(k) && seen.get(k) <= cost) continue;
      seen.set(k, cost);
      const item = { states: mv.states, cost, path };
      if (mv.cost) dq.push(item); else dq.unshift(item);
    }
  }
  return { best, explored: n, states: seen.size, wins };
}
// Random play: how often does someone tapping at random reach the goal, with the level's lives?
function randomRate(room, runs, lives) {
  let ok = 0;
  const r = E.rng32(99);
  for (let i = 0; i < runs; i++) {
    let states = room.boards.map((L) => E.newState(L)), left = lives;
    for (let g = 0; g < 200; g++) {
      const ms = moves(room, states);
      if (!ms.length) break;
      const m = ms[Math.floor(r() * ms.length)];
      left -= m.cost;
      if (left <= 0) break;
      states = m.states;
      if (won(room, states, m)) { ok++; break; }
    }
  }
  return ok / runs;
}
function ascii(L, S) {
  const W = L.w * 2 + 1, H = L.h * 2 + 1, g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill(' '));
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) g[y * 2 + 1][x * 2 + 1] = '.';
  (L.slots || []).forEach((s) => { g[s.y * 2 + 1][s.x * 2 + 1] = '_'; });
  L.arrows.forEach((a) => {
    if (S && S.removed[a.id]) return;
    a.cells.forEach((c, i) => {
      const last = i === a.cells.length - 1;
      const d = a.kind === 'compass' ? E.dirOf(a, S || { launches: 0 }) : a.dir;
      g[c[1] * 2 + 1][c[0] * 2 + 1] = last ? (a.kind === 'compass' ? 'c' : '^>v<'[d]) : a.red ? 'r' : a.keeper ? 'K' : a.phase ? 'p' : a.ghostPhase !== undefined ? 'g' : (a.cells[1] && a.cells[0][0] === a.cells[1][0] ? '|' : '-');
      if (last && a.keeper) g[c[1] * 2 + 1][c[0] * 2 + 1] = 'K';
    });
  });
  if (L.sling) g[L.sling.y * 2 + 1][L.sling.x * 2 + 1] = 'Y';
  ((S && S.props) || L.props || []).forEach((p) => { if (!p.gone) g[p.y * 2 + 1][p.x * 2 + 1] = p.kind === 'ball' ? 'o' : p.kind === 'bird' ? 'B' : p.ch; });
  (L.walls || []).forEach((w) => { if (S && S.broken[(w[2] === 'r' ? 'v' : 'h') + w[0] + '_' + w[1]]) return; if (w[2] === 'r') g[w[1] * 2 + 1][w[0] * 2 + 2] = '#'; else g[w[1] * 2 + 2][w[0] * 2 + 1] = '='; });
  (L.goals || []).forEach((gl) => gl.ys.forEach((y) => { g[y * 2 + 1][gl.side === 1 ? W - 1 : 0] = gl.own ? '[' : ']'; }));
  return g.map((r) => r.join('')).join('\n');
}
function show(room) {
  const rows = room.boards.map((L) => ascii(L).split('\n'));
  for (let i = 0; i < rows[0].length; i++) console.log(rows.map((r) => r[i]).join('   '));
}
module.exports = { solve, randomRate, show, ascii, moves, won };
if (require.main === module) {
  const want = process.argv[2];
  const list = E.SPECIALS;
  Object.keys(list).forEach((k) => {
    if (want && !k.startsWith(want)) return;
    const full = E.specialRoom(k);
    const rooms = full.kind === 'poem' ? full.boards.map((L, i) => Object.assign({}, full, { boards: [L], key: k + '#' + i })) : [full];
    rooms.forEach((room) => {
    console.log('\n=== ' + room.key + ' ===');
    show(room);
    const s = solve(room, +process.argv[3] || 300000);
    console.log('explored', s.explored, 'states', s.states, s.best ? 'lives lost ' + s.best.cost + ' moves ' + s.best.path.length + '\n  ' + s.best.path.join(' ') : 'NO SOLUTION');
    console.log('random play wins', (randomRate(room, 400, room.lives) * 100).toFixed(1) + '%');
    });
  });
}
