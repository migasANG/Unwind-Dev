// Generates src/levels.json, proves each level solvable and prints a report.
const E = require('../src/engine.js'), fs = require('fs');
const calm = [
 { w:3,h:4,minLen:2,maxLen:3,depth:2 },
 { w:4,h:5,minLen:2,maxLen:3,depth:3 },
 { w:5,h:6,minLen:2,maxLen:4,depth:4 },
 { w:6,h:7,minLen:2,maxLen:5,depth:5 },
 { w:6,h:8,minLen:2,maxLen:6,depth:6 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7 },
 { w:6,h:7,minLen:2,maxLen:5,depth:5,twins:1,caption:'Twins leave together. Both paths must be clear.' },
 { w:7,h:8,minLen:2,maxLen:6,depth:6,twins:2 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,twins:3 },
 { w:5,h:6,minLen:2,maxLen:4,depth:4,compass:1,trap:[0.02,0.4],caption:'Compass arrows turn a quarter each time something leaves.' },
 { w:6,h:7,minLen:2,maxLen:5,depth:5,compass:2,trap:[0.1,0.5] },
 { w:7,h:8,minLen:2,maxLen:6,depth:6,compass:3,trap:[0.1,0.6] },
 { w:5,h:6,minLen:2,maxLen:4,depth:4,sleepers:1,caption:'Moon arrows are asleep. Send the star arrow away to wake them.' },
 { w:6,h:8,minLen:2,maxLen:5,depth:5,sleepers:2 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,sleepers:3 },
 { w:5,h:6,minLen:2,maxLen:4,depth:4,mirrors:1,caption:'Mirrors turn an arrow on its way out. Follow the new path.' },
 { w:6,h:8,minLen:2,maxLen:5,depth:5,mirrors:2 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,mirrors:4 },
 { w:5,h:6,minLen:2,maxLen:4,depth:4,patient:1,maxWait:3,caption:'Patient arrows show a number. They can leave after that many launches.' },
 { w:6,h:8,minLen:2,maxLen:5,depth:5,patient:2,maxWait:4 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,patient:3,maxWait:5 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,twins:1,compass:1,sleepers:1,trap:[0.05,0.5] },
 { w:8,h:10,minLen:2,maxLen:7,depth:8,twins:1,compass:2,mirrors:2,patient:1,trap:[0.05,0.6] },
 { w:9,h:11,minLen:2,maxLen:8,depth:9,twins:2,compass:2,sleepers:2,mirrors:3,patient:2,trap:[0.1,0.7] },
];
const hard = [
 { w:7,h:9,minLen:3,maxLen:7,depth:9 },
 { w:8,h:10,minLen:3,maxLen:8,depth:10 },
 { w:8,h:10,minLen:2,maxLen:8,depth:9,twins:3 },
 { w:8,h:10,minLen:2,maxLen:7,depth:9,compass:3,trap:[0.3,0.8] },
 { w:8,h:10,minLen:2,maxLen:8,depth:10,sleepers:4 },
 { w:8,h:10,minLen:2,maxLen:7,depth:9,mirrors:5 },
 { w:9,h:11,minLen:2,maxLen:8,depth:10,patient:4,maxWait:8 },
 { w:9,h:11,minLen:2,maxLen:9,depth:11,compass:4,trap:[0.3,0.85] },
 { w:9,h:11,minLen:2,maxLen:8,depth:11,twins:2,sleepers:3,mirrors:3 },
 { w:9,h:12,minLen:2,maxLen:9,depth:12,twins:2,compass:3,patient:2,trap:[0.3,0.85] },
 { w:9,h:12,minLen:2,maxLen:9,depth:12,compass:3,sleepers:3,mirrors:4,trap:[0.3,0.85] },
 { w:9,h:12,minLen:2,maxLen:9,depth:13,twins:3,compass:4,sleepers:3,mirrors:4,patient:3,trap:[0.3,0.9] },
].map(s=>({...s,lives:2,hints:0}));
const timed = [
 { w:4,h:5,minLen:2,maxLen:3,depth:3 },
 { w:5,h:6,minLen:2,maxLen:4,depth:4 },
 { w:6,h:7,minLen:2,maxLen:5,depth:5 },
 { w:6,h:7,minLen:2,maxLen:5,depth:5,twins:1 },
 { w:6,h:8,minLen:2,maxLen:6,depth:6 },
 { w:6,h:8,minLen:2,maxLen:5,depth:5,mirrors:2 },
 { w:6,h:8,minLen:2,maxLen:5,depth:6,sleepers:2 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,twins:2 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,patient:3,maxWait:4 },
 { w:7,h:9,minLen:2,maxLen:6,depth:7,compass:2,trap:[0.05,0.4] },
 { w:8,h:10,minLen:2,maxLen:7,depth:8,twins:1,mirrors:2,sleepers:2 },
 { w:8,h:10,minLen:2,maxLen:7,depth:8,twins:1,compass:2,patient:2,trap:[0.05,0.5] },
].map(s=>({...s,timed:true}));
const out={}, rows=[];
[['calm',calm,1000],['hard',hard,7000],['timed',timed,13000]].forEach(([name,specs,base])=>{
 out[name]=specs.map((s,i)=>{
  const l=E.generate(s,base+i*31,s.compass?500:300);
  if(!l) throw new Error('no level '+name+' '+(i+1));
  const st=E.newState(l), sol=E.solve(l,st,3000000);
  if(!sol.solved) throw new Error('unsolvable '+name+' '+(i+1));
  const p=E.newState(l); let won=false;
  sol.sequence.forEach(id=>{const r=E.tap(l,p,id); if(!r.ok) throw new Error('replay failed '+name+(i+1)); won=r.won;});
  if(!won) throw new Error('replay did not clear '+name+(i+1));
  const c=k=>l.arrows.filter(k).length;
  const limit=s.timed?E.timeLimitFor(sol.sequence.length):null;
  rows.push({set:name,level:i+1,grid:s.w+'x'+s.h,arrows:l.arrows.length,twin:c(a=>a.kind==='twin')/2,compass:c(a=>a.kind==='compass'),sleep:c(a=>a.key!==undefined),mirror:l.mirrors.length,patient:c(a=>a.wait),filled:Math.round(l.density*100)+'%',freeAtStart:E.legalMoves(l,E.newState(l)).length,lives:s.lives||3,limit,stuck:Math.round(E.trapRate(l,300,7)*100)+'%'});
  return {w:l.w,h:l.h,lives:s.lives||3,hints:s.hints===undefined?1:s.hints,timeLimit:limit,seed:l.seed,caption:s.caption||null,mirrors:l.mirrors,arrows:l.arrows};
 });
});
fs.writeFileSync(__dirname+'/../src/levels.json',JSON.stringify(out));
console.table(rows);
