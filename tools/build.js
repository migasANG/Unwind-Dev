// Inlines everything into one page. dist/index.html suits any static host; dist/artifact.html omits the document wrapper.
const fs=require('fs'),p=f=>__dirname+'/../'+f;
let t=fs.readFileSync(p('src/index.template.html'),'utf8');
const safe=s=>s.replace(/<\/script/g,'<\\/script');
t=t.replace('/*__ENGINE__*/',()=>safe(fs.readFileSync(p('src/engine.js'),'utf8')))
 .replace('/*__LEVELS__*/',()=>fs.readFileSync(p('src/levels.json'),'utf8'))
 .replace('/*__CHALLENGES__*/',()=>fs.readFileSync(p('src/challenges.json'),'utf8'))
 .replace('/*__MUSIC__*/',()=>safe(fs.readFileSync(p('src/music.js'),'utf8')))
 .replace('/*__GAME__*/',()=>safe(fs.readFileSync(p('src/guide.js'),'utf8')+'\n'+fs.readFileSync(p('src/guide2.js'),'utf8')+'\n'+fs.readFileSync(p('src/guide3.js'),'utf8')+'\n'+fs.readFileSync(p('src/i18n.js'),'utf8')+'\n'+fs.readFileSync(p('src/game.js'),'utf8').replace('/*__GUIDE_UI__*/',()=>fs.readFileSync(p('src/guide-ui.js'),'utf8')).replace('/*__GUIDE2_UI__*/',()=>fs.readFileSync(p('src/guide2-ui.js'),'utf8')).replace('/*__GUIDE3_UI__*/',()=>fs.readFileSync(p('src/guide3-art.js'),'utf8')+fs.readFileSync(p('src/guide3-ui.js'),'utf8')).replace('/*__PHOTO_SCENES__*/',()=>fs.readFileSync(p('src/photo-scenes.js'),'utf8'))));
fs.writeFileSync(p('dist/artifact.html'),t);
fs.writeFileSync(p('dist/index.html'),'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style>\n'+t+'\n</html>\n');
// The painted backgrounds are separate files, next to the page.
fs.mkdirSync(p('dist/bg'),{recursive:true});fs.readdirSync(p('src/bg')).forEach(f=>fs.copyFileSync(p('src/bg/'+f),p('dist/bg/'+f)));
console.log('built',fs.statSync(p('dist/artifact.html')).size,'bytes');
