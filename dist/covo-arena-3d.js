/* PocketMonstars Covo — 3D avatar renderer inside original 2D arena. Hierarchical articulated mesh; not a production skinned GLB. */
(async()=>{
try{
const T=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(320,380,false);renderer.setClearColor(0,0);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(29,320/380,.1,60);camera.position.set(0,3.15,10.4);camera.lookAt(0,1.65,0);
scene.add(new T.HemisphereLight(0xd7efff,0x4d3150,2.6));
const light=new T.DirectionalLight(0xffd8a3,3.1);light.position.set(-3,8,7);scene.add(light);
const blueLight=new T.PointLight(0x37b9ff,8,9);blueLight.position.set(2,2,3);scene.add(blueLight);
const m=(c,metal=.08,rough=.42)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const skin=m('#95512f'),skinShade=m('#733a24'),gold=m('#eab544',.72,.23),hair=m('#a66a29'),hairLight=m('#e5a93b'),blue=m('#0d54b7',.25),navy=m('#103777'),white=m('#eef1f4'),boots=m('#172d54'),cyan=new T.MeshBasicMaterial({color:0x47d7ff}),eyes=new T.MeshBasicMaterial({color:0xc7faff});
const root=new T.Group();scene.add(root);
function part(parent,geo,material,x=0,y=0,z=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);parent.add(o);return o}
const ball=(p,r,mat,x,y,z)=>part(p,new T.SphereGeometry(r,16,12),mat,x,y,z);
const cyl=(p,r1,r2,h,mat,x,y,z)=>part(p,new T.CylinderGeometry(r1,r2,h,12),mat,x,y,z);
function limb(p,a,b,rad,material){const g=new T.Vector3(...a),h=new T.Vector3(...b),d=h.clone().sub(g),o=part(p,new T.CylinderGeometry(rad*.86,rad,d.length(),12),material,...g.clone().add(h).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o}
const torso=new T.Group();root.add(torso);
ball(torso,.39,skin,0,1.54,0).scale.set(1.12,1.27,.74);
ball(torso,.38,skin,0,2.04,0).scale.set(1.22,1.12,.75);
part(torso,new T.BoxGeometry(.77,.36,.16),blue,0,2.05,.30);
part(torso,new T.BoxGeometry(.9,.08,.19),gold,0,2.25,.33);
part(torso,new T.TorusGeometry(.145,.026,10,36),cyan,0,2.08,.40);
for(let i=0;i<6;i++){const a=i*Math.PI/3;const dot=ball(torso,.017,cyan,Math.sin(a)*.095,2.08+Math.cos(a)*.095,.418);}
const pelvis=ball(torso,.34,blue,0,1.23,0);pelvis.scale.set(1.22,.62,.8);
const belt=cyl(torso,.36,.36,.10,gold,0,1.27,0);
const sash=new T.Group();sash.position.set(0,1.25,.28);torso.add(sash);
for(let i=-1;i<=1;i++){const cloth=part(sash,new T.BoxGeometry(.19,.85,.045),i===0?blue:white,i*.2,-.45,0);cloth.rotation.z=i*.17;}
const head=new T.Group();head.position.set(0,2.53,0);torso.add(head);
ball(head,.30,skin,0,0,0).scale.set(.95,1.13,.85);
ball(head,.13,skinShade,0,-.18,.08).scale.set(.95,.65,.9);
for(const s of [-1,1]){const e=ball(head,.092,eyes,s*.125,.015,.253);e.scale.set(1.18,.48,.34);ball(head,.024,navy,s*.125,.012,.281);}
const mark=part(head,new T.TorusGeometry(.083,.015,7,32),cyan,0,.15,.277);mark.rotation.z=.28;
const hairBase=ball(head,.31,hair,0,.20,-.02);hairBase.scale.set(1.05,.5,1);
const braids=[];
for(let i=0;i<26;i++){const a=i*Math.PI*2/26,rr=.20+(i%3)*.035;const b=new T.Group();b.position.set(Math.sin(a)*rr,.23,Math.cos(a)*rr-.03);head.add(b);
const length=.40+(i%5)*.09;
for(let j=0;j<5;j++){const p=ball(b,.052,j%3===0?hairLight:hair,Math.sin(j*.5+a)*.06,-j*length/5,Math.cos(j*.4+a)*.025);p.scale.set(.85,1.15,.85)}
if(i%3===0)cyl(b,.057,.057,.065,gold,0,-length*.67,0);
braids.push(b)}
for(let i=0;i<11;i++){const a=i*Math.PI*2/11;const spike=part(head,new T.ConeGeometry(.12,.56,7),hairLight,Math.sin(a)*.23,.49,Math.cos(a)*.23);spike.rotation.z=-Math.sin(a)*.35;spike.rotation.x=Math.cos(a)*.35}
const arms=[],legs=[];
for(const s of [-1,1]){
const sh=new T.Group();sh.position.set(s*.47,2.22,0);torso.add(sh);
ball(sh,.19,skin,0,-.06,0);cyl(sh,.145,.13,.48,skin,0,-.30,0);
cyl(sh,.17,.17,.13,gold,0,-.16,0);
const elbow=new T.Group();elbow.position.y=-.56;sh.add(elbow);ball(elbow,.13,skin,0,0,0);
cyl(elbow,.115,.11,.42,skin,0,-.26,0);cyl(elbow,.14,.14,.15,gold,0,-.42,0);ball(elbow,.13,skin,0,-.53,0);
arms.push({sh,elbow});
const hip=new T.Group();hip.position.set(s*.22,1.16,0);torso.add(hip);
ball(hip,.22,white,0,-.1,0);cyl(hip,.22,.18,.54,white,0,-.35,0);
const knee=new T.Group();knee.position.y=-.67;hip.add(knee);ball(knee,.18,white,0,0,0);
cyl(knee,.16,.125,.48,white,0,-.28,0);cyl(knee,.17,.17,.18,gold,0,-.43,0);
const shoe=part(knee,new T.BoxGeometry(.32,.22,.53),boots,0,-.62,.13);part(knee,new T.BoxGeometry(.34,.065,.55),gold,0,-.73,.13);
legs.push({hip,knee});
}
const energy=new T.Group();root.add(energy);const rings=[];
for(let j=0;j<3;j++){const r=part(energy,new T.TorusGeometry(.46+j*.11,.013,6,64),new T.MeshBasicMaterial({color:j===0?0x7cefff:0x168bff,transparent:true,opacity:.6}),0,1.6,0);r.rotation.set(j*.45,j*.8,.25);rings.push(r)}
let last=0;
window.PMCovo3D={
 ready:true,
 draw(ctx,x,y,height,f,alpha=1){
  const t=performance.now()/1000;
  if(t-last>1/28){
    last=t;
    const dx=f.fx||0,dy=f.fy||0,ang=Math.atan2(dx,dy);
    root.rotation.y=ang;
    const walk=!!f.mv||!!f.ds,cycle=t*(f.ds?15:10);
    torso.position.y=walk?Math.abs(Math.sin(cycle))*.055:Math.sin(t*2.4)*.022;
    torso.rotation.z=walk?Math.sin(cycle)*.045:0;
    legs[0].hip.rotation.x=walk?Math.sin(cycle)*.6:0;
    legs[1].hip.rotation.x=walk?-Math.sin(cycle)*.6:0;
    legs[0].knee.rotation.x=walk?Math.max(0,-Math.sin(cycle))*.45:0;
    legs[1].knee.rotation.x=walk?Math.max(0,Math.sin(cycle))*.45:0;
    arms[0].sh.rotation.x=walk?-Math.sin(cycle)*.45:0;
    arms[1].sh.rotation.x=walk?Math.sin(cycle)*.45:0;
    const casting=!!f.ck&&f.ct<.55;
    if(casting){const u=Math.max(0,1-f.ct/.55);arms[1].sh.rotation.x=-1.5*Math.sin(Math.PI*u);arms[0].sh.rotation.x=-.85*Math.sin(Math.PI*u);arms[1].elbow.rotation.x=-.3}
    else arms[1].elbow.rotation.x=0;
    const transformed=(f.sg||0)>0||(f.as||0)>0||f.tr>0;
    hairLight.color.set(transformed?'#fff5a1':'#e5a93b');
    energy.visible=transformed||casting;
    rings.forEach((r,i)=>{r.rotation.y=t*(i%2?-2:2);r.rotation.z=t*.8+i;r.scale.setScalar(1+Math.sin(t*4+i)*.08)});
    braids.forEach((b,i)=>{b.rotation.z=Math.sin(t*4+i*.6)*(walk?.17:.065);b.rotation.x=Math.cos(t*3+i*.4)*.07});
    sash.rotation.z=Math.sin(t*6)*(walk?.15:.04);
    renderer.render(scene,camera);
  }
  ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const w=height*320/380;
  ctx.drawImage(renderer.domElement,x-w/2,y-height,w,height);
  ctx.restore();return true;
 }
};
}catch(e){console.warn('Covo 3D renderer unavailable; keeping original sprite',e);}
})();