// Plays every Boarding Up special (Matchday, Woodland, The Poem) to the end with real clicks, using solver moves.
// node tools/test-specials.js <screenshot-folder> [lang]
const { chromium } = require('playwright');
const path = require('path');
const E = require('../src/engine.js');
const G = require('./gen-specials.js');

function plan(key, lang) {
  const room = E.specialRoom(key, lang);
  if (room.kind === 'poem') {
    let all = [];
    room.boards.forEach((L, i) => { const s = G.solve(Object.assign({}, room, { boards: [L] }), 300000); all = all.concat(s.best.path.map((m) => ({ b: i, id: m.id, fire: m.fire, kind: m.kind }))); });
    return all;
  }
  const s = G.solve(room, 1500000);
  if (!s.best) throw new Error('no solution for ' + key);
  return s.best.path.map((m) => ({ b: m.b, id: m.id, fire: m.fire, kind: m.kind }));
}
(async () => {
  const out = process.argv[2], lang = process.argv[3] || 'en';
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => { try { window.UNWIND_NO_INTRO = true; localStorage.setItem('unwind.lang', l); } catch (e) {} }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { if (!errs.length) console.log('FIRST ERROR', e.stack); errs.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await p.waitForTimeout(300); await p.click('#begin'); await p.waitForTimeout(600);
  const list = await p.evaluate(() => unwindTest.boardingList());
  const idle = async () => { for (let i = 0; i < 80; i++) { const s = await p.evaluate(() => unwindTest.sp()); if (!s.busy) return s; await p.waitForTimeout(100); } return p.evaluate(() => unwindTest.sp()); };
  for (let i = 0; i < list.length; i++) {
    const key = list[i]; if (!key || (process.env.ONLY && key !== process.env.ONLY)) continue;
    const moves = plan(key, lang);
    await p.evaluate((k) => unwindTest.boarding(k), i);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/${key}-start.png` });
    let n = 0, prevIdx = -1;
    for (const m of moves) {
      let s = await idle();
      if (s.ended) break;
      // The board slides in when it changes: wait for it, as a player would.
      if (prevIdx !== -1 && s.idx !== prevIdx) { await p.waitForTimeout(500); s = await idle(); }
      prevIdx = m.b;
      if (s.idx !== m.b) {
        const r = await p.evaluate((x) => { const e = document.querySelector('.cnav[data-board="' + x + '"]'); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, m.b);
        if (r) await p.mouse.click(r.x, r.y); else await p.evaluate((x) => unwindTest.coopSwitch(x), m.b);
        await p.waitForTimeout(450);
      }
      if (m.fire !== undefined) {
        const sp = await p.evaluate(() => unwindTest.slingPoint());
        await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(250);
        if (n === 0 || key === 'sl1') await p.screenshot({ path: `${out}/${key}-aim.png` });
        const dp = await p.evaluate((d) => unwindTest.slingPoint(d), m.fire);
        await p.mouse.click(dp.x, dp.y);
      } else {
        const pt = await p.evaluate((id) => unwindTest.arrowPoint(id), m.id);
        await p.mouse.click(pt.x, pt.y);
      }
      n++;
      await p.waitForTimeout(140);
      if (process.env.DEBUG) { const d = await p.evaluate(() => unwindTest.sp()); console.log('  move', n, JSON.stringify(m), 'idx', d.idx, 'lives', d.lives, d.removed[d.idx], d.props[d.idx].join(' '), '|', d.caption); }
      if (n === Math.ceil(moves.length / 2)) { await idle(); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${key}-mid.png` }); }
    }
    // The poem shows its finale before the win card.
    for (let t = 0; t < 60; t++) {
      if (await p.$('#poemEnd:not(.out) #poemOk')) { if (process.env.DEBUG) for (let q = 0; q < 10; q++) { console.log('  finale', q, JSON.stringify(await p.evaluate(() => { const e = document.getElementById('poemEnd'); return { end: !!e, op: e && getComputedStyle(e).opacity, cls: e && e.className, sheet: !!document.querySelector('#next') }; }))); await p.waitForTimeout(300); } await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${key}-finale.png` }); await p.waitForTimeout(12000); await p.screenshot({ path: `${out}/${key}-finale2.png` }); await p.evaluate(() => document.getElementById('poemOk').click()); await p.waitForTimeout(1500); }
      if (await p.$('#next') || await p.$('#again')) break;
      await p.waitForTimeout(250);
    }
    const won = !!(await p.$('#next'));
    const s2 = await p.evaluate(() => unwindTest.sp());
    console.log(key, won ? 'WON' : 'NOT WON', 'moves', moves.length, 'lives', s2.lives, '|', s2.caption);
    await p.screenshot({ path: `${out}/${key}-end.png` });
    if (!won) console.log('  state', JSON.stringify(s2));
  }
  if (lang === 'pt') { await p.evaluate(() => { document.getElementById('bGuide').click(); }); await p.waitForTimeout(400); console.log('untranslated', JSON.stringify(await p.evaluate(() => window.UnwindI18n.misses()))); }
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
