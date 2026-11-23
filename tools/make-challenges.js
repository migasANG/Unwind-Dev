// Builds the Challenges levels with Hard lives (2, no hints) and never more than one effect per arrow.
// Level 1: plain and compass arrows (plus what the goal needs) at 1x. Level 2: +2 random arrow types at 1x. Level 3: +3 at 2x.
// Each board is tested by many random playthroughs: the goal must be reachable, but rarely by chance.
// node tools/make-challenges.js > src/challenges.json
const E = require('../src/engine.js');
const KEEP = ['twin', 'pair', 'red', 'key', 'wait', 'isKey', 'uno', 'ghostPhase', 'phase'];
const strip = (l) => ({ w: l.w, h: l.h, big: !!l.big, mirrors: l.mirrors || [], flowers: null, arrows: l.arrows.map((a) => { const o = { id: a.id, kind: a.kind, dir: a.dir, cells: a.cells }; KEEP.forEach((k) => { if (a[k] !== undefined) o[k] = a[k]; }); return o; }) });
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
const EXTRAS = ['sleepers', 'patient', 'ghosts', 'phases', 'unos', 'mirrors', 'twins', 'reds'];
function specFor(goal, level, seed, extra) {
  const big = level === 2, root = big ? Math.SQRT2 : 1;
  const spec = { w: Math.round(7 * root), h: Math.round(9 * root), minLen: 2, maxLen: big ? 7 : 6, depth: big ? 9 : 7, big, trap: [0.15, 0.7],
    compass: 2, twins: 0, mirrors: 0, sleepers: 0, patient: 0, ghosts: 0, phases: 0, unos: 0, reds: 0, combos: 0, lives: 2 };
  const r = E.rng32(seed * 7 + level * 101 + goal.length);
  const pool = EXTRAS.filter((k) => !(goal === 'red' && k === 'reds')).sort(() => r() - 0.5);
  const picked = pool.slice(0, [0, 2, 3][level]);
  picked.forEach((k) => { spec[k] = big ? 2 : 1; });
  return { spec: Object.assign(spec, extra), picked };
}
function find(goal, extra, picks, runs) {
  let seed = 1, got = 0;
  while (got < picks.length && seed < 600) {
    const p = picks[got];
    const made = specFor(goal, got, seed, Object.assign({}, extra, p.spec || {}));
    const lvl = E.generate(made.spec, seed * 131 + goal.length * 7, made.spec.big ? 6 : 20);
    seed++;
    if (!lvl) continue;
    lvl.big = made.spec.big;
    // Never more than one effect on an arrow.
    if (lvl.arrows.some((a) => E.traitCount(a) > 1)) continue;
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
      if (wins / runs > p.max) break;
    }
    const rate = wins / runs;
    process.stderr.write(`${goal} L${got + 1} seed ${seed} arrows ${base.arrows.length} [${made.picked}] rate ${rate.toFixed(2)}\n`);
    if (!best || rate > p.max || rate < (p.min || 0.01) || !replay(base, ch, best)) continue;
    out.push(Object.assign({ goal, frozen: ch.frozen, extras: made.picked, moves: best.length, rate, solution: best }, base));
    got++;
  }
}
module.exports = { strip, fresh, goals, movesOf, replay, E };
if (require.main === module) {
  find('golden', { compass: 3 }, [{ max: 0.35 }, { max: 0.25 }, { max: 0.15 }], 40);
  find('thaw', {}, [{ frozen: 3, max: 0.35 }, { frozen: 4, max: 0.25 }, { frozen: 6, max: 0.15 }], 40);
  find('red', {}, [{ reds: 2, max: 0.35, spec: { reds: 2 } }, { reds: 3, max: 0.25, spec: { reds: 3 } }, { reds: 4, max: 0.15, spec: { reds: 4 } }], 40);
  console.log(JSON.stringify(out));
}
