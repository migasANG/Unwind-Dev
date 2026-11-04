// Plays every level with real clicks and checks the new systems. Run: node tools/test-browser.js <screenshot-folder>
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const errs=[];const out=process.argv[2];
const url='file://'+path.resolve(__dirname,'../dist/index.html');
const ctx=await b.newContext({viewport:{width:390,height:800}});
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|fonts/.test(m.text()))errs.push(m.text())});
await p.goto(url);await p.waitForTimeout(300);await p.screenshot({path:out+'/begin.png'});await p.click('#begin');await p.waitForTimeout(1200);await p.screenshot({path:out+'/l1.png'});
const snap=()=>p.evaluate(()=>unwindTest.snapshot());
const tapId=async id=>{const pt=await p.evaluate(i=>unwindTest.point(i),id);await p.mouse.click(pt.x,pt.y)};
// Collision costs a life; last life fails
let s=await p.evaluate(()=>unwindTest.solve());const lastId=s[s.length-1];
await tapId(lastId);await p.waitForTimeout(250);console.log('after collision',(await snap()).lives,await p.textContent('#livesLabel'));await p.screenshot({path:out+'/hit.png'});
await tapId(lastId);await tapId(lastId);await p.waitForSelector('#again',{timeout:3000});console.log('lives fail sheet:',await p.textContent('.card h2'));
await p.click('#again');
// Non-perfect win and perfect win
s=await p.evaluate(()=>unwindTest.solve());await tapId(s[s.length-1]);for(const id of s){await tapId(id);await p.waitForTimeout(10)}
await p.waitForSelector('#next');await p.waitForTimeout(800);console.log('with collision title:',await p.textContent('.win h2'));await p.screenshot({path:out+'/clear.png'});
await p.click('#again');await p.waitForTimeout(100);s=await p.evaluate(()=>unwindTest.solve());for(const id of s){await tapId(id);await p.waitForTimeout(10)}
await p.waitForSelector('#next');await p.waitForTimeout(2600);console.log('no collision title:',await p.textContent('.win h2'));await p.screenshot({path:out+'/perfect.png'});await p.click('#next');
// Hint
await p.evaluate(()=>unwindTest.open('calm',3));await p.waitForTimeout(1300);await p.click('#bHint');await p.waitForTimeout(300);const h=await snap();console.log('hint',h.hint);await p.screenshot({path:out+'/hint.png'});
await p.waitForTimeout(3000);console.log('hint still showing after 3s',(await snap()).hint===h.hint);
// Every level
const counts=await p.evaluate(()=>unwindTest.counts());
for(const set of Object.keys(counts))for(let i=0;i<counts[set];i++){
 await p.evaluate(([a,c])=>unwindTest.open(a,c),[set,i]);
 let g=0,n;while(g++<400){n=await snap();if(n.won)break;const id=await p.evaluate(()=>unwindTest.nextMove());if(id<0){await p.evaluate(()=>unwindTest.rewind());continue}await tapId(id)}
 n=await snap();if(!n.won)throw new Error('failed '+JSON.stringify(n));
 await p.waitForSelector('#next',{timeout:6000});
 console.log('cleared',n.id,await p.textContent('.win h2'));
}
// Patient and sleeper: tapping too early is free
await p.evaluate(()=>unwindTest.open('calm',12));await p.waitForTimeout(100);
let early=await p.evaluate(()=>{const a=unwindTest.arrows().find(x=>x.key!==undefined);return a.id});await tapId(early);console.log('sleeper early tap lives',(await snap()).lives,'launches',(await snap()).launches);
await p.evaluate(()=>unwindTest.open('calm',18));await p.waitForTimeout(100);
early=await p.evaluate(()=>unwindTest.arrows().find(x=>x.wait).id);await tapId(early);console.log('patient early tap lives',(await snap()).lives,'launches',(await snap()).launches);
// Timer pauses in a sheet and fails at zero
await p.evaluate(()=>unwindTest.open('timed',0));await p.waitForTimeout(1000);await p.screenshot({path:out+'/timed.png'});
const t0=(await snap()).timeLeft;await p.waitForTimeout(600);const t1=(await snap()).timeLeft;console.log('timer runs',t0>t1);
await p.click('#bLevels');await p.waitForTimeout(150);const t2=(await snap()).timeLeft;await p.waitForTimeout(500);console.log('timer pauses in menu',(await snap()).timeLeft===t2);await p.screenshot({path:out+'/levels.png'});await p.click('#x');
await p.evaluate(()=>unwindTest.setTime(300));await p.waitForSelector('#again',{timeout:3000});console.log('timeout sheet:',await p.textContent('.card h2'));await p.screenshot({path:out+'/timeup.png'});
await p.click('#again');
await p.click('#mute');await p.waitForTimeout(300);await p.screenshot({path:out+'/settings.png'});await p.click('#x');
// Audio: render offline and measure
const audio=await p.evaluate(async()=>{const M=unwindTest.music,res=[];
 const measure=async(render,secs)=>{const c=new OfflineAudioContext(1,44100*secs,44100);render(c);const buf=await c.startRendering();return buf.getChannelData(0)};
 const rms=(d,a,z)=>{let t=0;for(let i=a;i<z;i++)t+=d[i]*d[i];return Math.sqrt(t/(z-a))};
 const hf=d=>{let e=0,t=0;for(let i=1;i<d.length;i++){const x=d[i]-d[i-1];e+=x*x;t+=d[i]*d[i]}return t?e/t:0};
 const sfx=await measure(c=>M.note(c,c.destination,392,0,.2,1.5,.012),8);
 res.push({what:'launch note then silence',tailPeak:sfx.subarray(44100*3).reduce((m,v)=>Math.max(m,Math.abs(v)),0)});
 for(let i=0;i<M.THEMES.length;i++){let bar=0;const d=await measure(c=>{let t=0;for(bar=0;bar<8;bar++)t+=M.scheduleBar(c,c.destination,i,bar,t);},44);
  let peak=0;for(const v of d)if(Math.abs(v)>peak)peak=Math.abs(v);
  const th=M.THEMES[i],dur=8*th.beats*60/th.bpm;const tail=Math.floor((dur+Math.max(9,th.beats*60/th.bpm*5))*44100);
  res.push({theme:th.name,seconds:Math.round(dur),peak:+peak.toFixed(3),rms:+rms(d,0,dur*44100).toFixed(4),hfRatio:+hf(d.subarray(0,dur*44100)).toExponential(2),tailRmsAfterEnd:rms(d,Math.min(tail,d.length-44100),d.length)});}
 return res});
console.log(JSON.stringify(audio,null,0).replace(/},/g,'},\n'));
await ctx.close();
for(const [n,w,h] of [['small',360,640],['desk',1280,800]]){const c=await b.newContext({viewport:{width:w,height:h}});const q=await c.newPage();q.on('pageerror',e=>errs.push(e.message));await q.goto(url);await q.waitForTimeout(200);await q.click('#begin');await q.waitForTimeout(600);await q.evaluate(()=>unwindTest.open('hard',11));await q.waitForTimeout(1800);await q.screenshot({path:out+`/${n}.png`});
 const sq=await q.evaluate(()=>unwindTest.solve());await q.evaluate(()=>unwindTest.open('calm',0));await q.waitForTimeout(60);for(const id of await q.evaluate(()=>unwindTest.solve())){const pt=await q.evaluate(i=>unwindTest.point(i),id);await q.mouse.click(pt.x,pt.y)}await q.waitForSelector('#next');await q.waitForTimeout(1200);await q.screenshot({path:out+`/${n}win.png`});
 console.log(n,'winCardFits',await q.evaluate(()=>{const c=document.querySelector('.card');return [c.scrollHeight,c.clientHeight,document.documentElement.scrollWidth]}));await c.close();}
console.log('errors',errs);await b.close()})().catch(e=>{console.error(e);process.exit(1)});
