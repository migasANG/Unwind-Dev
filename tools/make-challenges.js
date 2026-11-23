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
  // Sent off: every red card arrow has left the board.
  red: (l, s) => { const reds = l.arrows.filter((a) => a.red !== undefined); return reds.length > 0 && reds.every((a) => s.removed[a.id]); },
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
function rollout(base, ch, r, smart) {
  const { l, s } = fresh(base, ch), seq = [];
  for (let guard = 0; guard < 400; guard++) {
    if (goals[ch.goal](l, s)) return seq;
    if (E.isWon(s)) return null;
    if (ch.goal !== 'golden' && s.freed && Object.keys(s.freed).length) return null;
    // A red card that runs out while its arrow is still on the board loses Sent off.
    if (ch.goal === 'red' && l.arrows.some((a) => a.red !== undefined && !s.removed[a.id] && E.hasRedCard(s, a))) return null;
    let m = movesOf(l, s, ch);
    // The smart player plays like a person would: for Sent off it sends the red card closest to running out
    // whenever it can, for Thaw it cracks ice whenever it can.
    if (smart && ch.goal === 'red') { const reds = m.filter((id) => l.arrows[id].red !== undefined).sort((a, b) => l.arrows[a].red - l.arrows[b].red); if (reds.length && r() < 0.85) m = [reds[0]]; }
    if (smart && ch.goal === 'thaw') { const ice = m.filter((id) => !E.check(l, s, l.arrows[id]).clear); if (ice.length && r() < 0.85) m = ice; }
    if (!m.length) return null;
    const id = m[Math.floor(r() * m.length)];
    E.tap(l, s, id); seq.push(id);
  }
  return null;
}
function replay(base, ch, seq) {
  const { l, s } = fresh(base, ch);
  for (const id of seq) {
    const res = E.tap(l, s, id); if (!res.ok && !res.thawed) return false;
    if (goals[ch.goal](l, s)) return true;
    if (ch.goal === 'red' && l.arrows.some((a) => a.red !== undefined && !s.removed[a.id] && E.hasRedCard(s, a))) return false;
  }
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
  while (got < picks.length && seed < 2000) {
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
      // Harder: no ice can be cracked at the start, so every crack needs setting up first.
      const g0 = fresh(base, ch);
      if (E.iceHits(g0.l, g0.s).length) continue;
    }
    if (goal === 'red') {
      // Red cards go on arrows that are blocked at the start, so each one needs a way cleared first.
      // Each card gives only the launches the known solution needs, plus at most one.
      const at = {}; lvl.solution.forEach((id, i) => { at[id] = i; });
      const g0 = fresh(base, ch), rr = E.rng32(seed * 53);
      const pool = base.arrows.filter((a) => a.kind === 'plain' && !E.traitCount(a) && at[a.id] !== undefined && at[a.id] >= 2 && !E.canLaunch(g0.l, g0.s, a.id));
      if (pool.length < p.reds) continue;
      for (let i = pool.length - 1; i > 0; i--) { const q = Math.floor(rr() * (i + 1)); const t = pool[i]; pool[i] = pool[q]; pool[q] = t; }
      pool.slice(0, p.reds).forEach((a) => { a.red = at[a.id] + 1 + (rr() < p.slack ? 1 : 0); });
    }
    const r = E.rng32(seed * 31 + 5);
    let wins = 0, best = null;
    for (let i = 0; i < runs; i++) {
      const seq = rollout(base, ch, r);
      if (seq) { wins++; if (!best || seq.length > best.length) best = seq; }
      if (wins / runs > p.max) break;
    }
    let rate = wins / runs;
    // The smart player must also mostly fail, or the board is easy for a person.
    if (goal !== 'golden' && rate <= p.max) {
      let sw = 0;
      for (let i = 0; i < runs; i++) { const seq = rollout(base, ch, r, true); if (seq) { sw++; if (!best || seq.length > best.length) best = seq; } if (sw / runs > p.max) break; }
      rate = Math.max(rate, sw / runs);
      for (let i = 0; i < 400 && !best && rate <= p.max; i++) best = rollout(base, ch, r, true) || rollout(base, ch, r);
    }
    process.stderr.write(`${goal} L${got + 1} seed ${seed} arrows ${base.arrows.length} [${made.picked}] rate ${rate.toFixed(2)}\n`);
    if (!best || rate > p.max || rate < (p.min === undefined ? (goal === 'red' ? 0 : 0.01) : p.min) || !replay(base, ch, best)) continue;
    out.push(Object.assign({ goal, frozen: ch.frozen, extras: made.picked, moves: best.length, rate, solution: best }, base));
    got++;
  }
}
module.exports = { strip, fresh, goals, movesOf, replay, E };
if (require.main === module) {
  // node tools/make-challenges.js thaw red  -> rebuilds only those groups and keeps the others from src/challenges.json
  const only = process.argv.slice(2);
  const want = (g) => !only.length || only.includes(g);
  const keep = only.length ? require('../src/challenges.json') : [];
  if (want('golden')) find('golden', { compass: 3 }, [{ max: 0.35 }, { max: 0.25 }, { max: 0.15 }], 40); else out.push(...keep.filter((c) => c.goal === 'golden'));
  // Thaw 1 is a gentle start: random play should manage it now and then.
  if (want('thaw')) find('thaw', {}, [{ frozen: 4, min: 0, max: 0.2 }, { frozen: 6, min: 0, max: 0.1 }, { frozen: 8, min: 0, max: 0.05 }], 60); else out.push(...keep.filter((c) => c.goal === 'thaw'));
  // Sent off: twice the red cards of before, and rarer by chance.
  if (want('red')) find('red', {}, [{ reds: 4, slack: 0.5, max: 0.2, spec: { reds: 0 } }, { reds: 6, slack: 0.3, max: 0.1, spec: { reds: 0 } }, { reds: 8, slack: 0.15, max: 0.05, spec: { reds: 0 } }], 60); else out.push(...keep.filter((c) => c.goal === 'red'));
  const order = { golden: 0, thaw: 1, red: 2 };
  console.log(JSON.stringify(out.sort((a, b) => order[a.goal] - order[b.goal])));
}
