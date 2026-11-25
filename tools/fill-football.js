// Fills the empty parts of a Matchday pitch with more arrows, one at a time, keeping only arrows that leave
// the level winnable and at least as long to solve.  node tools/fill-football.js fb1 [targetFill] [seed]
const E = require('../src/engine.js');
const G = require('./gen-specials.js');
const key = process.argv[2], target = +process.argv[3] || 0.5, r = E.rng32(+process.argv[4] || 7);
const def = JSON.parse(JSON.stringify(E.SPECIALS[key]));
function room(d) { E.SPECIALS.__f = d; return E.specialRoom('__f'); }
function score(d) {
  const rm = room(d), s = G.solve(rm, 400000);
  if (!s.best || s.best.cost > 0 || !s.done) return null;
  return { moves: s.best.path.length, seen: s.seen.size };
}
const base = score(def);
console.error(key, 'start', JSON.stringify(base));
let cur = base;
for (let b = 0; b < def.boards.length; b++) {
  for (let tries = 0; tries < 70; tries++) {
    const rm = room(def), L = rm.boards[b], used = {};
    L.arrows.forEach((a) => a.cells.forEach((c) => { used[c[1] * L.w + c[0]] = 1; }));
    (L.props || []).forEach((p) => { used[p.y * L.w + p.x] = 1; });
    const filled = Object.keys(used).length / (L.w * L.h);
    if (filled >= target) break;
    // Prefer the emptiest spots: count free tiles around the head.
    let best = null;
    for (let k = 0; k < 40; k++) {
      const d = Math.floor(r() * 4), len = 2 + (r() < 0.3 ? 1 : 0), hx = Math.floor(r() * L.w), hy = Math.floor(r() * L.h), cells = [];
      for (let i = len - 1; i >= 0; i--) cells.push([hx - E.DX[d] * i, hy - E.DY[d] * i]);
      if (cells.some((c) => c[0] < 0 || c[1] < 0 || c[0] >= L.w || c[1] >= L.h || used[c[1] * L.w + c[0]])) continue;
      let room2 = 0;
      cells.forEach((c) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < L.w && y < L.h && !used[y * L.w + x]) room2++; } });
      if (!best || room2 > best.room) best = { cells, room: room2 };
    }
    if (!best) continue;
    const entry = [best.cells.map((c) => c.join(',')).join(' ')];
    if (r() < 0.25) entry.push({ red: 1 + Math.floor(r() * 3) });
    def.boards[b].push(entry);
    const sc = score(def);
    if (!sc || sc.moves < cur.moves || sc.seen > 250000) { def.boards[b].pop(); continue; }
    cur = sc;
  }
}
const rm = room(def), full = G.exploreAll(rm, 400000);
console.error(key, 'end', JSON.stringify(cur), 'allRedsClearable', full ? G.allRedsClearable(rm, full) : '?', 'random', G.randomRate(rm, 200, 5));
console.log(JSON.stringify(def.boards));
