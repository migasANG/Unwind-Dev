// Builds public/index.html: minified, without the test hook, with a rights notice. Needs: npm i terser
const fs=require('fs'),path=require('path'),{minify}=require('terser');
const p=f=>path.join(__dirname,'..',f),rd=f=>fs.readFileSync(p(f),'utf8');
const NOTICE='© 2026 Miguel Lima. All rights reserved. No licence is granted to copy, modify, publish or use this work without written agreement.';
(async()=>{
 const strip=s=>s.replace(/\/\*TEST-HOOK-START\*\/[\s\S]*?\/\*TEST-HOOK-END\*\//,'');
 const opts={compress:{passes:2},mangle:{toplevel:true},format:{comments:false}};
 const js=(await minify(rd('src/engine.js')+'\n'+rd('src/music.js')+'\n'+'window.UNWIND_LEVELS='+rd('src/levels.json')+';\n'+'window.UNWIND_CHALLENGES='+rd('src/challenges.json')+';\n'+rd('src/guide.js')+'\n'+rd('src/guide2.js')+'\n'+rd('src/guide3.js')+'\n'+rd('src/i18n.js')+'\n'+strip(rd('src/game.js')).replace('/*__GUIDE_UI__*/',()=>rd('src/guide-ui.js')).replace('/*__GUIDE2_UI__*/',()=>rd('src/guide2-ui.js')).replace('/*__GUIDE3_UI__*/',()=>rd('src/guide3-ui.js')).replace('/*__PHOTO_SCENES__*/',()=>rd('src/photo-scenes.js')),opts)).code;
 if(/unwindTest|\.solve\(\)\.sequence/.test(js)&&js.includes('unwindTest'))throw new Error('test hook still present');
 let t=rd('src/index.template.html');
 t=t.replace(/<script>\/\*__ENGINE__\*\/<\/script>\s*<script>window\.UNWIND_LEVELS=\/\*__LEVELS__\*\/;(?:window\.UNWIND_CHALLENGES=\/\*__CHALLENGES__\*\/;)?<\/script>\s*<script>\/\*__MUSIC__\*\/<\/script>\s*<script>\/\*__GAME__\*\/<\/script>/,'<script>__JS__</script>');
 if(!t.includes('__JS__'))throw new Error('template');
 t=t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/>\s+</g,'><').replace(/\n\s*/g,'\n').replace('__JS__',()=>js.replace(/<\/script/g,'<\\/script'));
 fs.mkdirSync(p('public'),{recursive:true});
 fs.writeFileSync(p('public/index.html'),`<!doctype html>\n<!-- ${NOTICE} -->\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="copyright" content="${NOTICE}"><style>*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style>\n${t}\n</html>\n`);
 fs.mkdirSync(p('public/bg'),{recursive:true});fs.readdirSync(p('src/bg')).forEach(f=>fs.copyFileSync(p('src/bg/'+f),p('public/bg/'+f)));
 console.log('public bytes',fs.statSync(p('public/index.html')).size);
})().catch(e=>{console.error(e);process.exit(1)});
