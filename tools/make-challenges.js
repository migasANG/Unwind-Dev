// Builds the Challenges levels: 3x boards with Hard rules (2 lives, no hints, combo arrows).
// Each board is tested by many random playthroughs: the goal must be reachable, but rarely by chance.
// node tools/make-challenges.js > src/challenges.json
const E = require('../src/engine.js');
const KEEP = ['twin', 'pair', 'red', 'key', 'wait', 'isKey', 'uno', 'ghostPhase', 'phase'];
const strip = (l) => ({ w: l.w, h: l.h, big: true, mirrors: l.mirrors || [], flowers: null, arrows: l.arrows.map((a) => { const o = { id: a.id, kind: a.kind, dir: a.dir, cells: a.cells }; KEEP.forEach((k) => { if (a[k] !== undefined) o[k] = a[k]; }); return o; }) });
function fresh(base, ch) {
  const l = E.prepare(JSON.parse(JSON.stringify(Object.assign({ lives: 2, hints: 0, timeLimit: null, season: null, flowers: null }, base))));
  const s = E.newState(l);
  s.safe = ch.goal === 'golden';
  s.keepIce = ch.goal === 'thaw';
  (ch.frozen || []).forEach((id) => { s.frozen[id] = 9999; });
  return { l, s };
}
const goals = {
  golden: (l, s) => !!(s.freed && Object.keys(s.freed).length),
  thaw: (l, s) => Object.keys(s.frozen).length === 0,
  red: (l, s) => { const reds = l.arrows.filter((a) => a.red !== undefined); return reds.length > 0 && reds.every((a) => !s.removed[a.id] && E.isRedCarded(s, a)); },
};
// Taps that move the game on without costing a life: launches, and for Thaw, hits that crack ice.
function movesOf(l, s, ch) {
  const out = [];
  l.arrows.forEach((a) => {
    if (s.removed[a.id] || (a.kind === 'twin' && a.twin < a.id)) return;
    const members = a.kind === 'twin' ? [a, l.arrows[a.twin]] : [a];
    if (!members.every((m) => E.isReady(s, m))) return;
    const cs = members.map((m) => E.check(l, s, m)), hit = cs.filter((c) => !c.clear);
    if (!hit.length || (ch.goal === 'thaw' && hit.every((c) => c.frozen))) out.push(a.id);
  });
  return out;
}
// One random playthrough. Returns the moves if the goal was reached.
function rollout(base, ch, r) {
  const { l, s } = fresh(base, ch), seq = [];
  for (let guard = 0; guard < 400; guard++) {
    if (goals[ch.goal](l, s)) return seq;
    if (E.isWon(s)) return null;
    if (ch.goal !== 'golden' && s.freed && Object.keys(s.freed).length) return null;
    const m = movesOf(l, s, ch);
    if (!m.length) return null;
    const id = m[Math.floor(r() * m.length)];
    E.tap(l, s, id); seq.push(id);
  }
  return null;
}
function replay(base, ch, seq) {
  const { l, s } = fresh(base, ch);
  for (const id of seq) { const res = E.tap(l, s, id); if (!res.ok && !res.thawed) return false; }
  return goals[ch.goal](l, s);
}
const out = [];
function find(goal, extra, picks, runs) {
  let seed = 1, got = 0;
  while (got < picks.length && seed < 400) {
    const p = picks[got];
    const spec = Object.assign(E.endlessSpec(4 + got, { hard: true, scale: 3 }), { flowers: 0, gaps: 0 }, extra, p.spec || {});
    const lvl = E.generate(spec, seed * 131 + goal.length * 7, 4);
    seed++;
    if (!lvl) continue;
    const base = strip(lvl), ch = { goal };
    if (goal === 'thaw') {
      const r = E.rng32(seed * 977), pool = base.arrows.filter((a) => a.kind === 'plain' && !E.traitCount(a)).map((a) => a.id);
      for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[k]; pool[k] = t; }
      if (pool.length < p.frozen + 4) continue;
      ch.frozen = pool.slice(0, p.frozen);
    }
    if (goal === 'red' && base.arrows.filter((a) => a.red !== undefined).length < p.reds) continue;
    const r = E.rng32(seed * 31 + 5);
    let wins = 0, best = null;
    for (let i = 0; i < runs; i++) {
      const seq = rollout(base, ch, r);
      if (seq) { wins++; if (!best || seq.length > best.length) best = seq; }
      // Stop early once it is clearly too easy.
      if (wins / runs > p.max) break;
    }
    const rate = wins / runs;
    process.stderr.write(`${goal} seed ${seed} arrows ${base.arrows.length} rate ${rate.toFixed(2)}\n`);
    if (!best || rate > p.max || !replay(base, ch, best)) continue;
    out.push(Object.assign({ goal, frozen: ch.frozen, moves: best.length, rate, solution: best }, base));
    got++;
  }
}
module.exports = { strip, fresh, goals, movesOf, replay, E };
if (require.main === module) {
  find('golden', { compass: 4, reds: 0 }, [{ max: 0.3 }, { max: 0.15 }, { max: 0.08 }], 26);
  find('thaw', { compass: 2 }, [{ frozen: 5, max: 0.3 }, { frozen: 7, max: 0.15 }, { frozen: 9, max: 0.08 }], 40);
  find('red', { reds: 3, redSlack: 0 }, [{ reds: 3, max: 0.3 }, { reds: 4, max: 0.15, spec: { reds: 4 } }, { reds: 5, max: 0.08, spec: { reds: 5 } }], 40);
  console.log(JSON.stringify(out));
}
