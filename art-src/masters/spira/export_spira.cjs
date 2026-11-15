// Exports Spira's sprite sheet from spira_sheet.html:
//   spira_atlas.png  — transparent game atlas, one row per animation, feet on each cell's ground line
//   spira_atlas.json — per-animation row, cell size, anchor, frame count, fps, loop
//   spira_sheet.png  — the labelled presentation sheet
//   dist/art/walk/spira_s0..5.png — in-game sheets (288x336 frames, one sheet per form): see GAME_FRAMES for the layout
//   dist/art/hd/spira_s0..5.png + spira.png — the idle picture for each form
// Usage: node art-src/masters/spira/export_spira.cjs   (needs Playwright + Chromium)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const DIR=__dirname, SCALE=1.5;
(async()=>{
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+fs.readFileSync(path.join(DIR,'spira_sheet.html'),'utf8')+'</body></html>';
  const tmp=path.join(require('os').tmpdir(),'spira_export.html');fs.writeFileSync(tmp,html);
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1320,height:900}});
  await pg.goto('file://'+tmp);await pg.waitForTimeout(1500);
  const out=await pg.evaluate((SC)=>{const {A,GROUPS,renderFrame,frameT}=window.SPIRA;
    const ids=GROUPS.flatMap(g=>g.ids);const meta={scale:SC,animations:{}};
    const W=Math.max(...ids.map(id=>Math.ceil(A[id].n*A[id].cell[0]*SC)));let H=0;
    ids.forEach(id=>{H+=Math.ceil(A[id].cell[1]*SC);});
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');let y=0;
    for(const id of ids){const a=A[id];const cw=Math.ceil(a.cell[0]*SC),ch=Math.ceil(a.cell[1]*SC),gy=ch-Math.round(10*SC);
      for(let i=0;i<a.n;i++){x.save();x.beginPath();x.rect(i*cw,y,cw,ch);x.clip();x.translate(i*cw+a.cell[2]*SC,y+gy);x.scale(SC,SC);renderFrame(x,a,frameT(a,i),i);x.restore();}
      meta.animations[id]={label:a.label,y,frameW:cw,frameH:ch,frames:a.n,fps:a.fps,loop:a.loop,anchorX:Math.round(a.cell[2]*SC),groundY:gy,moveX:Math.round((a.dx||0)*SC),frameLabels:a.frameLabels||undefined};
      y+=ch;}
    meta.width=W;meta.height=H;return {png:c.toDataURL('image/png'),meta};},SCALE);
  fs.writeFileSync(path.join(DIR,'spira_atlas.png'),Buffer.from(out.png.split(',')[1],'base64'));
  fs.writeFileSync(path.join(DIR,'spira_atlas.json'),JSON.stringify(out.meta,null,1));
  // ---- in-game sheets: frames 0-1 idle, 2-5 run, then a short cast sequence per power (dist/pixel-arena.js POSES.spira) ----
  const GAME_FRAMES=[['idle',0],['idle',.5],['run',0],['run',.25],['run',.5],['run',.75],
    ['volley',.25],['volley',.45],['volley',.62],      // 6-8   Droplet Volley (basic, Lv1)
    ['lash',.25],['lash',.45],['lash',.62],            // 9-11  Spiral Lash (special, Lv1)
    ['mirror',.4],['mirror',.7],                       // 12-13 Tidal Mirror (guard)
    ['rush',.4],['rush',.72],                          // 14-15 Undertow Rush (dash)
    ['geyser',.2],['geyser',.38],['geyser',.7],        // 16-18 Coral Geyser (special, Lv10)
    ['bubble',.3],['bubble',.5],['bubble',.85],        // 19-21 Bubble Lock (basic, Lv25)
    ['needles',.3],['needles',.48],['needles',.62],    // 22-24 Rain Needles (special, Lv25)
    ['ultimate',.15],['ultimate',.32],['ultimate',.52],['ultimate',.7]]; // 25-28 Maelstrom Crown Cannon (special, Lv50) and Grand Maelstrom (mega)
  const sheets=await pg.evaluate((GF)=>{const {A,renderFrame}=window.SPIRA;const FW=288,FH=336,SC=2.5,AURA=[0,.2,.3,.4,.55,.7];const out=[];
    for(let st=0;st<6;st++){const c=document.createElement('canvas');c.width=FW*GF.length;c.height=FH;const x=c.getContext('2d');
      GF.forEach(([id,t],i)=>{const a=A[id];const fake={...a,pose:(tt,ii)=>{const p=a.pose(tt,ii);return {...p,x:0,air:(p.air||0)*.35,hy:p.ground===false?Math.max(p.hy,-60):p.hy,form:Math.max(st,p.form||0),aura:Math.max(AURA[st],p.aura||0)};}};
        x.save();x.beginPath();x.rect(i*FW,0,FW,FH);x.clip();x.translate(i*FW+FW/2-(id==='ultimate'||id==='volley'||id==='lash'||id==='bubble'||id==='geyser'?14:0),FH-8);x.scale(SC,SC);renderFrame(x,fake,t,undefined,{reach:44,auraW:.62});x.restore();});
      const one=document.createElement('canvas');one.width=FW;one.height=FH;one.getContext('2d').drawImage(c,0,0,FW,FH,0,0,FW,FH);
      out.push([c.toDataURL('image/png'),one.toDataURL('image/png')]);}
    return out;},GAME_FRAMES);
  const ROOT=path.join(DIR,'..','..','..','dist','art');
  sheets.forEach(([w,h],st)=>{fs.writeFileSync(path.join(ROOT,'walk',`spira_s${st}.png`),Buffer.from(w.split(',')[1],'base64'));
    fs.writeFileSync(path.join(ROOT,'hd',`spira_s${st}.png`),Buffer.from(h.split(',')[1],'base64'));
    if(st===2)fs.writeFileSync(path.join(ROOT,'hd','spira.png'),Buffer.from(h.split(',')[1],'base64'));});
  // 256-colour PNGs keep the game sheets small for phones (~0.4 MB each instead of ~3 MB)
  require('child_process').execFileSync('python3',['-c',`from PIL import Image
for st in range(6):
    for d in ('walk','hd'):
        p=f'${ROOT}/{d}/spira_s{st}.png'; Image.open(p).convert('RGBA').quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(p,optimize=True)
Image.open('${ROOT}/hd/spira_s2.png').save('${ROOT}/hd/spira.png',optimize=True)`]);
  await pg.addStyleTag({content:'.row .play{display:none}'});
  const g=await pg.$('#groups');await g.screenshot({path:path.join(DIR,'spira_sheet.png')});
  await b.close();console.log('atlas',out.meta.width+'x'+out.meta.height);
})();
