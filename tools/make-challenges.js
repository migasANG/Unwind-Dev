// Builds the Challenges levels by search: each board is checked so the goal can be reached and a careless order fails.
// node tools/make-challenges.js > src/challenges.json
const E = require('../src/engine.js');
const strip = (l) => ({ w: l.w, h: l.h, mirrors: l.mirrors || [], flowers: null, arrows: l.arrows.map((a) => { const o = { id: a.id, kind: a.kind, dir: a.dir, cells: a.cells }; ['twin', 'pair', 'red', 'key', 'wait', 'isKey', 'uno', 'ghostPhase', 'phase'].forEach((k) => { if (a[k] !== undefined) o[k] = a[k]; }); return o; }) });
function fresh(base, ch) {
  const l = E.prepare(JSON.parse(JSON.stringify(Object.assign({ lives: 3, hints: 0, timeLimit: null, season: null, flowers: null }, base))));
  const s = E.newState(l);
  s.safe = ch.goal === 'golden';
  (ch.frozen || []).forEach((id) => { s.frozen[id] = 999; });
  return { l, s };
}
const goals = {
  golden: (l, s) => !!(s.freed && Object.keys(s.freed).length),
  thaw: (l, s) => Object.keys(s.frozen).length === 0,
  red: (l, s) => { const reds = l.arrows.filter((a) => a.red !== undefined); return reds.length > 0 && reds.every((a) => !s.removed[a.id] && E.isRedCarded(s, a)); },
};
// Breadth-first over move orders. A move is a tap that does something (leaves, thaws); bumps cost a life and are skipped.
function play(base, ch, seq) {
  const { l, s } = fresh(base, ch);
  for (const id of seq) { const r = E.tap(l, s, id); if (!r.ok && !r.thawed) return null; }
  return { l, s };
}
function movesOf(l, s, ch) {
  const out = [];
  l.arrows.forEach((a) => {
    if (s.removed[a.id] || (a.kind === 'twin' && a.twin < a.id) || !E.isReady(s, a)) return;
    const c = E.check(l, s, a);
    if (c.clear || (c.frozen && ch.goal === 'thaw')) out.push(a.id);
  });
  return out;
}
// Breadth-first over move orders from a starting sequence. Bumps cost a life, so they are never part of a solution.
function search(base, ch, maxDepth, prefix) {
  const seen = new Set(), queue = [prefix || []];
  while (queue.length) {
    const seq = queue.shift(), g = play(base, ch, seq);
    if (!g) continue;
    const { l, s } = g;
    if (goals[ch.goal](l, s)) return seq;
    if (ch.goal !== 'golden' && s.freed && Object.keys(s.freed).length) continue;
    if (E.isWon(s) || seq.length >= maxDepth) continue;
    const key = s.removed.map((x) => (x ? 1 : 0)).join('') + '|' + Object.keys(s.frozen).sort().join(',') + '|' + s.launches;
    if (seen.has(key)) continue;
    seen.add(key);
    movesOf(l, s, ch).forEach((id) => queue.push(seq.concat(id)));
  }
  return null;
}
// A good challenge has a wrong first move: one after which the goal can no longer be reached.
function hasTrap(base, ch, maxDepth) {
  const g = play(base, ch, []);
  return movesOf(g.l, g.s, ch).some((id) => !search(base, ch, maxDepth + 1, [id]));
}
const out = [];
module.exports = { search, strip, fresh, E };
function find(kind, spec, picks) {
  let seed = 1, got = 0;
  while (got < picks.length && seed < 1500) {
    const p = picks[got];
    const lvl = E.generate(Object.assign({}, spec, p.spec || {}), seed * 131 + kind.length * 7, 30);
    seed++;
    if (!lvl) continue;
    const base = strip(lvl), ch = { goal: kind };
    if (kind === 'thaw') {
      // Freeze arrows that something else runs into, so each one can be hit free.
      // Any arrows may be frozen; the search below keeps only boards where every one can be hit free in time.
      const r = E.rng32(seed * 977), pool = base.arrows.filter((a) => a.kind !== 'twin').map((a) => a.id);
      for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[k]; pool[k] = t; }
      if (pool.length < p.frozen + 2) continue;
      ch.frozen = pool.slice(0, p.frozen);
    }
    const best = search(base, ch, p.max);
    if (!best || best.length < p.min) continue;
    if (!hasTrap(base, ch, p.max)) continue;
    out.push(Object.assign({ goal: kind, frozen: ch.frozen, moves: best.length, solution: best }, base));
    got++;
  }
}
if (require.main === module) {
find('golden', { w: 5, h: 5, minLen: 2, maxLen: 4, depth: 4, compass: 2 }, [{ min: 1, max: 3 }, { min: 3, max: 5 }, { min: 4, max: 7 }]);
find('thaw', { w: 5, h: 6, minLen: 2, maxLen: 4, depth: 5, compass: 2 }, [{ frozen: 2, min: 2, max: 5 }, { frozen: 3, min: 4, max: 7 }, { frozen: 4, min: 5, max: 9 }]);
find('red', { w: 5, h: 6, minLen: 2, maxLen: 4, depth: 5, reds: 2 }, [{ min: 2, max: 5 }, { min: 4, max: 7, spec: { reds: 3 } }, { min: 5, max: 8, spec: { reds: 3, w: 6, h: 7 } }]);
console.log(JSON.stringify(out));
}
