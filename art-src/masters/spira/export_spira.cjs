// Exports Spira's sprite sheet from spira_sheet.html:
//   spira_atlas.png  — transparent game atlas, one row per animation, feet on each cell's ground line
//   spira_atlas.json — per-animation row, cell size, anchor, frame count, fps, loop
//   spira_sheet.png  — the labelled presentation sheet
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
  await pg.addStyleTag({content:'.row .play{display:none}'});
  const g=await pg.$('#groups');await g.screenshot({path:path.join(DIR,'spira_sheet.png')});
  await b.close();console.log('atlas',out.meta.width+'x'+out.meta.height);
})();
