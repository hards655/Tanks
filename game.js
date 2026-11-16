import * as T from './vendor/three.js';
import {joystickVector,damp,PRODUCTS,migrateProfile,purchase,equip,consumeLoadout,createMG,reloadMG,tickMG,consumeMGShot,mgDamage} from './systems.js';
import {bevelBox,skyDome,detailTank,batchRigid,softParticle} from './visuals.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a)),lerp=T.MathUtils.lerp;
const TYPES=[{name:'LYNX',class:'ЛЁГКИЙ / I',hp:760,speed:17,armor:45,damage:190,reload:2.5,price:0,color:0x798462,scale:.88},{name:'KESTREL',class:'ЛЁГКИЙ / II',hp:850,speed:20,armor:55,damage:200,reload:2.7,price:900,color:0x8c9275,scale:.92},{name:'VANGUARD',class:'СРЕДНИЙ / III',hp:1200,speed:14,armor:95,damage:280,reload:3.4,price:1800,color:0x65745b,scale:1},{name:'BASTION',class:'ТЯЖЁЛЫЙ / IV',hp:1700,speed:10,armor:140,damage:370,reload:4.5,price:3200,color:0x737c68,scale:1.15},{name:'MONOLITH',class:'ТЯЖЁЛЫЙ / V',hp:2200,speed:8,armor:175,damage:460,reload:5.2,price:4800,color:0x58665e,scale:1.25}];
const MAP_NAMES=["Зелёная долина", "Пустынный рубеж", "Зимний фронт", "Неоновый каньон", "Ржавый мегаполис", "Вулканический разлом", "Лунная база", "Затопленный порт"];
const RANKS=['Новобранец','Рекрут','Курсант','Стрелок','Наводчик','Механик','Разведчик','Боец','Ветеран','Сержант','Старшина','Лейтенант','Капитан','Майор','Полковник','Командир','Ас','Герой фронта','Легенда','Маршал стали'];
const RANK_ICONS=['◇','◆','⬡','✦','✧','✪','◈','⬟','✶','★','✷','✹','✵','❖','✸','✺','✹','✪','✯','♛'];
const xpForLevel=l=>l>=20?Infinity:Math.round(180*l+45*l*l);
function rankFor(xp){let l=1;while(l<20&&xp>=xpForLevel(l))l++;return l}
function rankMarkup(){const l=rankFor(save.xp||0),prev=l===1?0:xpForLevel(l-1),next=xpForLevel(l);return `<div class="rankBadge"><span class="rankIcon">${RANK_ICONS[l-1]}</span><div><b>УРОВЕНЬ ${l} / 20 · ${RANKS[l-1]}</b><div class="rankBar"><i style="width:${l===20?100:Math.max(0,Math.min(100,(save.xp-prev)/(next-prev)*100))}%"></i></div><small>${l===20?'МАКСИМАЛЬНЫЙ УРОВЕНЬ':Math.floor(save.xp||0)+' / '+next+' XP'}</small></div></div>`}
const defaults={xp:0,credits:1800,owned:[0],upgrades:{},stats:{battles:0,wins:0,kills:0},settings:{invertJoystick:false,sensitivity:1,aimSensitivity:.65,deadzone:.12,smoothing:10,size:1,opacity:.85,assist:true,invert:false,quality:'medium',sound:true,layout:{}}};
let save;try{save=JSON.parse(localStorage.getItem('steel-thunder-v1'))}catch{}save={...defaults,...save,settings:{...defaults.settings,...save?.settings}};
migrateProfile(save);
function persist(){try{localStorage.setItem('steel-thunder-v1',JSON.stringify(save))}catch{notify('Сохранение недоступно в этом браузере')}}
const mobile=matchMedia('(pointer:coarse)').matches;document.body.classList.toggle('desktop',!mobile);
const renderer=new T.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.15,550);scene.background=new T.Color(0x899f91);scene.fog=new T.FogExp2(0x899f91,.006);scene.add(new T.HemisphereLight(0xdbeaf5,0x43482c,2.2));const sun=new T.DirectionalLight(0xffedd2,3.5);sun.position.set(-45,70,35);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:200});sun.shadow.bias=-.001;scene.add(sun);scene.add(sun.target);const sky=skyDome(scene);
const world=new T.Group();scene.add(world);let tanks=[],obstacles=[],shots=[],particles=[],player,preview,selected=0,mapIndex=0,mode='solo',flagCarrier=null,flagTimer=0,flagMesh=null,flagPole=null,flagTransferCooldown=0,state='garage',wave=1,kills=0,earned=0,elapsed=0,zoom=0,autoLock=false,aimYaw=0,aimPitch=.06,garageYaw=.55,gameTime=0,repairUsed=false,editing=false;
const mats=new Map(),geo={box:bevelBox(),sphere:new T.IcosahedronGeometry(1,2),cyl:new T.CylinderGeometry(1,1,1,24),cone:new T.ConeGeometry(1,1,16)};
function mat(c){if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.76,metalness:.25}));return mats.get(c)}
function mesh(g,c,x,y,z,sx=1,sy=1,sz=1,parent=world){const m=new T.Mesh(geo[g],mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function model(type,team=0){const d=TYPES[type],root=new T.Group(),body=new T.Group();root.add(body);const c=d.color;mesh('box',c,0,1.12,0,2.9,.72,4.3,body);const deck=mesh('box',c,0,1.5,-.15,2.65,.35,3.5,body);deck.rotation.x=.07;const nose=mesh('box',c,0,1.14,2,2.8,.7,.6,body);nose.rotation.x=-.35;
const wheels=[],trackLinks=[];for(const side of [-1,1]){mesh('box',0x222824,side*1.55,.64,0,.66,1.13,4.8,body);for(let i=0;i<7;i++){const w=mesh('cyl',0x444c3b,side*1.91,.66,-1.92+i*.64,.38,.12,.38,body);w.rotation.z=Math.PI/2;wheels.push(w)}for(let i=0;i<14;i++){mesh('box',0x51564a,side*1.56,1.22,-2.15+i*.33,.72,.09,.14,body);mesh('box',0x343b32,side*1.56,.09,-2.15+i*.33,.72,.08,.14,body)}}
// Continuous articulated tracks follow an oval loop around the road wheels.
for(const side of [-1,1])for(let i=0;i<44;i++){const link=mesh('box',0x252b29,side*1.94,.65,0,.31,.13,.32,body);link.userData.trackLink=true;link.userData.side=side;link.userData.phase=i/44;trackLinks.push(link)}
const turret=new T.Group();turret.position.set(0,1.75,-.25);body.add(turret);const cup=mesh('cyl',c,0,.08,0,1.35,.7,1.2,turret);cup.rotation.y=Math.PI/8;mesh('box',c,0,.38,-.08,1.8,.4,1.75,turret);mesh('cyl',0x454f3f,-.55,.7,-.3,.4,.15,.4,turret);mesh('cyl',0x202b22,.72,1.15,-.7,.025,1.7,.025,turret);mesh('box',team?0xb15f4b:0xd3e48b,0,.45,.82,.65,.14,.04,turret);
const gun=new T.Group();gun.position.set(0,.18,.9);turret.add(gun);mesh('box',c,0,0,.15,.7,.6,.6,gun);const barrel=mesh('cyl',c,0,0,1.65,.13,3.1,.13,gun);barrel.rotation.x=Math.PI/2;mesh('box',0x3a4638,0,0,3.2,.36,.3,.55,gun);mesh('box',0x111713,0,0,3.49,.18,.14,.02,gun);for(let i=0;i<3;i++)mesh('box',0x4b5343,-.8+i*.8,1.72,-1.55,.55,.15,.7,body);root.scale.setScalar(d.scale);const extra=detailTank({root,body,turret,gun},type,team,team?'factory':save.loadout.paint,mesh);for(const assembly of [body,turret,gun,extra.details,extra.mgMount])batchRigid(assembly,wheels);return{root,body,turret,gun,wheels,trackLinks,trackPhase:0,...extra}}
let seed=7;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function terrain(x,z){return .5*Math.sin(x*.035)*Math.cos(z*.043)+.18*Math.sin(z*.09)}
function clearWorld(){world.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();if(o.userData.ownedMaterial){o.material.map?.dispose();o.material.dispose()}});world.clear();tanks=[];obstacles=[];shots=[];particles=[]}

// Enhanced procedural environments and a modeled industrial hangar.
// Low-poly silhouettes + repeated structural detail: scalable on mobile.
function environmentDetail(idx,garageMode=false){
 const low=save.settings.quality==='low',step=low?2:1;
 const beam=(x,y,z,sx,sy,sz,c=0x53616a)=>mesh('box',c,x,y,z,sx,sy,sz);
 if(garageMode){
  scene.background.set(0x151c25);scene.fog.color.set(0x151c25);
  beam(0,-.32,0,40,.5,48,0x343c43);
  for(let k=-4;k<=4;k++){beam(k*4,.02,0,.12,.03,43,0x7b7e75);beam(0,.03,k*5,38,.03,.12,0x73796f)}
  for(const side of [-1,1]){beam(side*18,7,0,.6,14,48,0x49545d);
   for(let z=-20;z<=20;z+=10){beam(side*17.4,7,z,.8,13,.8,0x6e7780);
    beam(side*16,10,z,1.5,.12,2.4,0xd8bd6e)}
  }
  beam(0,14,0,38,1.1,48,0x343f48);
  for(let z=-20;z<=20;z+=10){beam(0,12.8,z,37,.55,.7,0x6e7b85);for(let x=-12;x<=12;x+=12)beam(x,12.4,z,7,.16,2.3,0xe2dfb4)}
  beam(0,7,-23,37,14,.6,0x424c53);
  for(let x=-14;x<=14;x+=4)beam(x,7,-22.6,.18,12,.2,0x78818a);
  for(let x of [-12,12])for(let z of [-12,10]){beam(x,1.4,z,2,2.8,3,0x6b5844);beam(x,2.9,z,2.3,.12,3.3,0xaaa079)}
  for(let z=-16;z<=16;z+=8){beam(-15,1,z,2,2,2,0x7c654a);beam(15,1,z,2,2,2,0x7c654a)}
  return;
 }
 if(idx===6){ // Lunar regolith, craters, habitats, solar panels, antennae.
  scene.fog.density=.002;
  for(let i=0;i<28/step;i++){const x=(rand()-.5)*250,z=(rand()-.5)*250;if(Math.abs(x)<16||Math.abs(z)<16)continue;
   const r=3+rand()*8;const ring=mesh('cyl',0x697582,x,.02,z,r,.25,r);ring.scale.y=.6;
   mesh('sphere',0x293644,x,.03,z,r*.72,.12,r*.72)}
  for(let i=0;i<9/step;i++){let x=(rand()-.5)*210,z=(rand()-.5)*210;const dome=mesh('sphere',0xc6d6e0,x,2.2,z,4.5,2.6,4.5);mesh('cyl',0x748ea0,x,.5,z,4.8,1,4.8);
   for(let j=-1;j<=1;j++){beam(x+7+j*2,.7,z,1.7,.12,5,0x2b638f);beam(x-7+j*2,.7,z,1.7,.12,5,0x2b638f)}
   beam(x,5,z,.15,4,.15,0xcdd6d9);mesh('sphere',0xffe1a3,x,7,z,.45,.45,.45)}
 }else if(idx===5){ // Lava channels, vents, volcanic caldera.
  scene.fog.density=.004;
  for(let i=0;i<30/step;i++){let x=(rand()-.5)*245,z=(rand()-.5)*245;if(Math.abs(x)<17||Math.abs(z)<17)continue;
   let r=3+rand()*7;mesh('cone',0x30272b,x,r*.5,z,r,r*1.8,r);
   const lava=beam(x,.08,z,r*.65,.12,1.1,0xff4d0a);lava.rotation.y=rand()*6;
   if(i%4===0){mesh('cyl',0x4b3032,x,1.3,z,1.3,2.6,1.3);mesh('sphere',0xc16d44,x,3.2,z,1.6,1.3,1.6)}
  }
  for(let i=0;i<8/step;i++){const x=(rand()-.5)*200,z=(rand()-.5)*200;mesh('cone',0x241e25,x,8,z,9,16,9);mesh('sphere',0xff6025,x,15.5,z,3,.5,3)}
 }else if(idx===7){ // Harbor: cranes, piers, containers and flooded basins.
  for(let i=0;i<22/step;i++){const x=(rand()-.5)*230,z=(rand()-.5)*230;if(Math.abs(x)<14||Math.abs(z)<14)continue;
   beam(x,.04,z,8,.06,12,0x277f9a);for(let j=0;j<3;j++)beam(x+(j-1)*2,1.4,z,2,2.8,5,[0xa35c3d,0x4d7386,0x7a8b5e][j]);}
  for(let i=0;i<5/step;i++){let x=-100+i*42,z=-95;beam(x,8,z,.9,16,.9,0xe0a84e);beam(x+6,16,z,14,.8,.8,0xe0a84e);beam(x+12,10,z,.12,12,.12,0xbfc4c6)}
 }else if(idx===3){ // Neon city canyon.
  for(let i=0;i<30/step;i++){let x=(rand()-.5)*230,z=(rand()-.5)*230;if(Math.abs(x)<16||Math.abs(z)<16)continue;
   let h=12+rand()*24;beam(x,h/2,z,6,h,7,0x272d49);
   for(let y=3;y<h;y+=4)beam(x,y,z+3.55,4,.3,.1,i%2?0x22d8eb:0xe649b7);
  }
 }else if(idx===4){ // Ruined city: fractured towers and wreckage.
  for(let i=0;i<30/step;i++){let x=(rand()-.5)*230,z=(rand()-.5)*230;if(Math.abs(x)<15||Math.abs(z)<15)continue;
   let h=4+rand()*16;beam(x,h/2,z,5,h,6,0x716a62);beam(x,h,z,6,.3,7,0x4d4d4a);
   for(let j=0;j<3;j++)beam(x+(rand()-.5)*7,.25,z+(rand()-.5)*7,2,.4,2,0x504b48);
  }
 }
}


// Stylized AAA-comic atmosphere: individually graded lighting and inked landmarks.
function applyComicArt(idx,garageMode=false){
 const themes=[[0xffdfad,0x9dbdb0,1.12],[0xffbc83,0xd8a37b,1.2],[0xd8ecff,0x91b7d7,1.13],[0xc38dff,0x565c9c,1.22],[0xffc69b,0xa18a7c,1.1],[0xff8754,0x9c4e42,1.22],[0xe0ecff,0x587aab,1.05],[0xb0e8df,0x7caeb2,1.1]];
 const [key,fill,exposure]=garageMode?[0xffe5b2,0x8497a7,1.1]:themes[idx];
 sun.color.set(key);sun.intensity=garageMode?2.7:3.2;sun.position.set(-65,idx===6?105:75,idx===3?-35:45);
 renderer.toneMappingExposure=exposure;
 scene.children.forEach(o=>{if(o.isHemisphereLight){o.color.set(fill);o.groundColor.set(idx===6?0x12182b:0x3c3b3b);o.intensity=idx===6?1.25:1.9}});
 if(sky?.material?.uniforms){
  sky.material.uniforms.top.value.set(garageMode?0x1a2733:[0x4b809a,0xa65c4d,0x639bc6,0x151c44,0x9a6257,0x542630,0x060a16,0x2e5d78][idx]);
  sky.material.uniforms.bottom.value.set(garageMode?0x38434a:[0xc8d2a6,0xf0b57d,0xb4d6e7,0x6e4a86,0xc7a086,0xa74b2e,0x101829,0x8bbab8][idx]);
 }
 const max=save.settings.quality==='low'?12:48;let n=0;
 for(const o of world.children){
  if(n>=max||!o.isMesh||o.isInstancedMesh||o.userData.ownedGeometry)continue;
  if(Math.max(o.scale.x,o.scale.y,o.scale.z)<5)continue;
  if(![geo.box,geo.cone,geo.cyl].includes(o.geometry))continue;
  const edge=new T.LineSegments(new T.EdgesGeometry(o.geometry,30),new T.LineBasicMaterial({color:0x15131d,opacity:.82,transparent:true,depthWrite:false}));
  edge.scale.setScalar(1.026);o.add(edge);o.userData.comicLandmark=true;n++;
 }
}


// Procedural PBR surface library. High quality uses a real 4096x4096 albedo map;
// low/medium use 512/1024 to protect Android GPU memory and startup time.
function terrainPBR(idx){
 const quality=save.settings.quality;
 const memory=navigator.deviceMemory||4;
 const size=quality==='high'?(memory>=4?4096:2048):quality==='medium'?1024:512;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{alpha:false});
 const palettes=[
 ['#667d51','#3f543a','#9c9d77','#b2a77b'],['#b79a65','#796345','#d8b780','#e5c993'],
 ['#d9e5e9','#8299a8','#f4f7f4','#9db5c1'],['#2c324a','#1a1f34','#53536a','#785a7a'],
 ['#7a6a5c','#4a4746','#a28b74','#514b47'],['#382d30','#1b1a21','#6c3d34','#ad4d2e'],
 ['#8a909e','#444e61','#bdc3cc','#626b78'],['#637a77','#344e57','#98a4a0','#466b73']
 ][idx]||['#777','#444','#aaa','#888'];
 ctx.fillStyle=palettes[0];ctx.fillRect(0,0,size,size);
 // Deterministic multilayer grain, fractures, patches and weathering.
 let rng=(0x1234567+idx*371)>>>0;
 const rnd=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 for(let layer=0;layer<4;layer++){
  const step=[128,40,12,3][layer],count=Math.round(size*size/(step*step)*(layer===3?.13:.75));
  for(let i=0;i<count;i++){
   const x=rnd()*size,y=rnd()*size,w=step*(.4+rnd()*2.5);
   ctx.globalAlpha=layer===3?.11:.12+rnd()*.23;
   ctx.fillStyle=palettes[1+Math.floor(rnd()*3)];
   ctx.beginPath();ctx.ellipse(x,y,w,w*(.25+rnd()),rnd()*6.28,0,6.283);ctx.fill();
  }
 }
 ctx.globalAlpha=.45;ctx.lineWidth=Math.max(1,size/2048);
 if(idx===5||idx===4||idx===6||idx===1){
  for(let k=0;k<Math.round(size/35);k++){
   let x=rnd()*size,y=rnd()*size;ctx.strokeStyle=idx===5?'#17151a':'#292b33';
   ctx.beginPath();ctx.moveTo(x,y);
   for(let j=0;j<6;j++){x+=(rnd()-.5)*size*.027;y+=(rnd()-.5)*size*.027;ctx.lineTo(x,y)}
   ctx.stroke();
  }
 }
 if(idx===5){ctx.globalAlpha=.6;ctx.strokeStyle='#ff5a19';ctx.lineWidth=size/450;
  for(let k=0;k<12;k++){ctx.beginPath();let x=rnd()*size,y=rnd()*size;ctx.moveTo(x,y);
   for(let j=0;j<8;j++){x+=(rnd()-.5)*size*.03;y+=(rnd()-.5)*size*.03;ctx.lineTo(x,y)}ctx.stroke()}}
 ctx.globalAlpha=1;
 const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(12,12);
 map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());map.needsUpdate=true;
 // Shared image used as a low-cost height detail source, avoiding another 4K allocation.
 const material=new T.MeshStandardMaterial({color:0xffffff,map,roughness:idx===7?.78:.96,metalness:idx===3?.14:0});
 material.userData.ownedMap=map;
 return material;
}


// Original fractured rock meshes: angular strata and chipped silhouettes.
// Shared geometry is reused across hundreds of instances; no external assets.
function makeRockGeometry(seedValue=1,detail=1){
 const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const grain=Math.sin(x*17.1+seedValue*2.7)*Math.cos(z*14.3-seedValue*1.9);
  const strata=Math.sin(y*12.5+seedValue*1.4);
  const facet=1+.17*grain+.11*strata+.09*Math.sin(x*7.3+z*9.7+seedValue);
  p.setXYZ(i,x*facet,y*(.87+.1*grain)*facet,z*facet);
 }
 p.needsUpdate=true;g.computeVertexNormals();return g;
}
const rockGeometryBank=[];
function rockGeometry(variant,low){
 const k=variant*2+(low?0:1);
 if(!rockGeometryBank[k])rockGeometryBank[k]=makeRockGeometry(variant+1,low?0:1);
 return rockGeometryBank[k];
}

function buildMap(idx,garage=false){
 clearWorld();seed=9281+idx*701;scene.fog.density=.0035;
 const palettes=[
 [0x637c4a,0xa4c3bd,0x526c45],[0xbba06d,0xe1bd8c,0x80664b],
 [0xc6d7df,0xa2bfd7,0x8195a3],[0x25283f,0x171d38,0x393354],
 [0x7e6555,0xb08b6e,0x61504b],[0x332a2c,0x692d25,0x4d3330],
 [0x8d929d,0x080d20,0x5b6171],[0x526d6c,0x8cb4bc,0x40585b]];
 const [groundColor,sky,stone]=palettes[idx]||palettes[0];
 scene.background.set(sky);scene.fog.color.set(sky);
 if(idx===6)scene.fog.density=.0015;
 const groundGeo=new T.PlaneGeometry(400,400,48,48);groundGeo.rotateX(-Math.PI/2);
 const ps=groundGeo.attributes.position;
 for(let i=0;i<ps.count;i++){const x=ps.getX(i),z=ps.getZ(i);let y=terrain(x,z)-.12;
  if(idx===5)y+=.35*Math.sin(x*.14+Math.cos(z*.1));
  if(idx===6)y+=.16*Math.sin(x*.28)*Math.cos(z*.23);
  if(idx===7)y=Math.min(y,.03);
  ps.setY(i,y);
 }
 groundGeo.computeVertexNormals();
 const ground=new T.Mesh(groundGeo,terrainPBR(idx));
 ground.receiveShadow=true;ground.userData.ownedGeometry=true;ground.userData.ownedMaterial=true;world.add(ground);
 if(garage){mesh('cyl',0x535c4d,0,-.15,0,6,.3,6);environmentDetail(0,true);applyComicArt(0,true);return}
 const low=save.settings.quality==='low',density=low?.55:1;
 const box=(x,y,z,w,h,d,c)=>mesh('box',c,x,y,z,w,h,d);
 const cyl=(x,y,z,r,h,c)=>mesh('cyl',c,x,y,z,r,h,r);
 const orb=(x,y,z,r,c)=>mesh('sphere',c,x,y,z,r,r,r);
 const rock=(x,z,r,c=stone)=>{
  const v=Math.floor(rand()*6),m=new T.Mesh(rockGeometry(v,low),mat(c));
  m.position.set(x,terrain(x,z)+r*.43,z);m.scale.set(r*(.8+rand()*.4),r*(.7+rand()*.5),r*(.8+rand()*.4));
  m.rotation.set((rand()-.5)*.5,rand()*6.283,(rand()-.5)*.4);
  m.castShadow=r>2;m.receiveShadow=true;world.add(m);return m;
 };
 const cliff=(x,z,width,height,depth,c=stone)=>{
  const g=new T.BufferGeometry(),verts=[],faces=[],n=7;
  for(let row=0;row<3;row++)for(let k=0;k<n;k++){
   const a=k*2*Math.PI/n,rad=row===0?.62:row===1?1:.22;
   const yy=row===0?0:row===1?height*.62:height;
   const wobble=.76+rand()*.48;
   verts.push(Math.cos(a)*width*rad*wobble,yy+(rand()-.5)*height*.1,Math.sin(a)*depth*rad*wobble);
  }
  for(let row=0;row<2;row++)for(let k=0;k<n;k++){const a=row*n+k,b=row*n+(k+1)%n,c=(row+1)*n+k,d=(row+1)*n+(k+1)%n;faces.push(a,b,c,b,d,c)}
  for(let k=1;k<n-1;k++)faces.push(2*n,2*n+k,2*n+k+1);
  const positions=[];for(const i of faces)positions.push(...verts.slice(i*3,i*3+3));
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshStandardMaterial({color:c,roughness:1,flatShading:true}));
  m.position.set(x,terrain(x,z)-.5,z);m.castShadow=true;m.receiveShadow=true;
  m.userData.ownedGeometry=true;m.userData.ownedMaterial=true;world.add(m);return m;
 };
 const blocked=(x,z,r=4)=>Math.abs(x)<15||Math.abs(z)<15||Math.hypot(x,z+90)<24||obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);
 const point=(min=22,max=125)=>{for(let k=0;k<40;k++){let x=(rand()-.5)*max*2,z=(rand()-.5)*max*2;if(!blocked(x,z,5)&&Math.hypot(x,z)>min)return [x,z]}return null};
 const obstacle=(x,z,r)=>obstacles.push({x,z,r});
 // Each arena has its own architecture, silhouettes, terrain palette and landmarks.
 if(idx===0){ // Valley: timber village, forest, wooden bridge, watchtower.
  for(let i=0;i<Math.round(42*density);i++){const p=point();if(!p)continue;const [x,z]=p;let h=5+rand()*5;
   cyl(x,h*.4,z,.45,h*.8,0x5c4c35);mesh('cone',0x31553b,x,h,z,2.8,h*.9,2.8);if(i%6===0)rock(x+3,z+2,2);
  }
  for(let i=0;i<13;i++){const p=point(30,115);if(!p)continue;const [x,z]=p;box(x,2,z,7,4,6,0x8c7658);mesh('cone',0x5b4a3d,x,5,z,5,3,4);for(let j=-1;j<=1;j++)box(x+j*2,2.2,z+3.04,.7,1,.12,0x273f45);obstacle(x,z,5)}
  for(let x of [-60,60]){for(let z of [-40,40]){cyl(x,6,z,.6,12,0x574d39);box(x,12,z,7,.7,7,0x705a3b);mesh('cone',0x47543c,x,14,z,5,3,5)}}
  for(let i=-6;i<=6;i++)box(82,.2,i*2.3,14,.35,2,0x82694b);
 }else if(idx===1){ // Desert: sandstone canyon, dunes, ancient ruins, refinery.
  for(let i=0;i<35*density;i++){const p=point();if(!p)continue;const [x,z]=p;const h=4+rand()*18;
   if(i%3===0){cyl(x,h/2,z,2.2,h,0x9a7652);box(x,h,z,6,1,6,0xc5a273)}
   else{mesh('cone',0x9b7653,x,h*.45,z,3+rand()*4,h,3+rand()*4)}
   if(i%4===0)obstacle(x,z,4);
  }
  for(let i=0;i<6;i++){const x=-95+i*33,z=75;box(x,2,z,12,4,11,0x9e8061);box(x,5,z,13,2,12,0xc3a177);
   for(let j=0;j<3;j++)box(x-4+j*4,2,z+5.6,1.2,2.3,.25,0x3e332d)}
  for(let i=0;i<5;i++){let x=90,z=-85+i*32;cyl(x,7,z,3,14,0x77716a);cyl(x,15,z,3.8,2,0xc0a46f);box(x,19,z,.2,7,.2,0x4d514c)}
 }else if(idx===2){ // Snow: alpine fortress, frozen lake, radar station.
  box(-76,-.08,60,75,.16,65,0x8cc6d7);
  for(let i=0;i<34*density;i++){const p=point();if(!p)continue;const [x,z]=p;const h=5+rand()*8;
   cyl(x,h*.4,z,.35,h*.8,0x4c514f);for(let j=0;j<3;j++)mesh('cone',0x476c64,x,h*.4+j*h*.22,z,2.6-j*.4,h*.48,2.6-j*.4);
  }
  for(let i=0;i<8;i++){const x=-105+i*28,z=-90;box(x,4,z,12,8,10,0x7f929c);box(x,8.4,z,13,.8,11,0xb4c5cd);
   for(let j=-1;j<=1;j++)box(x+j*3,5,z+5.1,1.3,2,.2,0x293a48);obstacle(x,z,7)}
  for(let i=0;i<5;i++){let x=60+i*13,z=82;cliff(x,z,10,24,10,0xdde8eb)}
  cyl(84,10,-72,1,20,0x758e9c);mesh('sphere',0xd2dfe7,84,21,-72,6,3,6);
 }else if(idx===3){ // Neon canyon: elevated expressways, towers, hologram billboards.
  for(let i=0;i<35*density;i++){const p=point();if(!p)continue;const [x,z]=p;const h=15+rand()*38;
   box(x,h/2,z,7,h,7,0x252b47);for(let y=3;y<h;y+=4){box(x,y,z+3.55,5,.3,.15,i%2?0x18c6df:0xf35aa8);box(x+3.55,y,z,.15,.3,5,0x577ec9)}
   if(i%4===0)obstacle(x,z,5);
  }
  for(let z of [-75,75]){box(0,7,z,220,1.1,8,0x4a5067);for(let x=-100;x<=100;x+=20){box(x,3.4,z,1.3,7,1.3,0x303a50);box(x,7.7,z,6,.18,.18,0x2bd0d6)}}
  for(let i=0;i<8;i++){const x=-100+i*27;box(x,12,-116,12,8,2,0x373651);box(x,13,-114.8,10,4,.15,i%2?0xff47ba:0x34e5f0)}
 }else if(idx===4){ // Ruined megacity: broken towers, freeway wrecks, debris.
  for(let i=0;i<31*density;i++){const p=point();if(!p)continue;const [x,z]=p;let h=7+rand()*27;
   box(x,h/2,z,8,h,8,0x70665e);box(x,h+.5,z,9,1,9,0x403d3d);
   for(let j=0;j<4;j++)box(x-3+j*2,3+rand()*h*.6,z+4.05,1.1,1.7,.15,0x252e32);
   if(i%2===0){box(x+4,1,z+5,5,1,2,0x514b46);obstacle(x,z,5)}
  }
  for(let x=-110;x<=110;x+=24){box(x,4,-65,1.6,8,1.6,0x77716b);box(x,8,-65,24,.8,9,0x5d5754)}
  for(let i=0;i<15;i++){let x=(rand()-.5)*250,z=(rand()-.5)*250;if(blocked(x,z))continue;box(x,.4,z,3+rand()*5,.8,2,0x494743)}
 }else if(idx===5){ // Volcano: huge caldera, lava rivers, basalt pillars, ash vents.
  for(let i=0;i<33*density;i++){const p=point();if(!p)continue;const [x,z]=p;const h=6+rand()*17;
   mesh('cone',0x2a272b,x,h*.48,z,3+rand()*5,h,3+rand()*5);
   if(i%3===0){orb(x,h,z,1.5,0xf36c22);obstacle(x,z,5)}
  }
  for(let i=0;i<13;i++){const x=-120+i*20,z=85+Math.sin(i*.8)*9;box(x,.08,z,21,.14,9,0xff4b09);box(x,.18,z+5,21,.22,1.1,0x3a2829)}
  for(let i=0;i<6;i++){let x=-95+i*38,z=-100;mesh('cone',0x1c1d22,x,18,z,11,36,11);orb(x,35,z,3,0xff5e1c)}
  for(let i=0;i<8;i++){let x=90,z=-95+i*27;cyl(x,6,z,2.5,12,0x39353a);orb(x,12,z,2,0xffa047)}
 }else if(idx===6){ // MOON / ARTEMIS OUTPOST: authored landmarks + modular high-detail geometry.
  scene.background.set(0x070b19);scene.fog.color.set(0x171f31);scene.fog.density=.0013;
  const steel=0x8996a7,white=0xc4d0d9,blue=0x285b83,glow=0x6bc7fa,amber=0xe4b65e;
  const beam=(x,y,z,w,h,d,c=steel)=>box(x,y,z,w,h,d,c);
  // Procedural crater with true sloped ring mesh rather than a flat cylinder.
  const crater=(x,z,r)=>{const seg=low?18:32,vertices=[],norm=[],indices=[];
   for(let k=0;k<=seg;k++){const a=k*Math.PI*2/seg,co=Math.cos(a),si=Math.sin(a);
    for(const [rad,height] of [[.46,-.45],[.7,-.27],[.91,.48],[1.15,.17],[1.48,.04]]){
     vertices.push(x+co*r*rad,height,z+si*r*rad);
    }}
   for(let k=0;k<seg;k++)for(let j=0;j<4;j++){const a=k*5+j,b=(k+1)*5+j;indices.push(a,b,a+1,b,b+1,a+1)}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
   const m=new T.Mesh(g,mat(0x69717f));m.receiveShadow=true;m.castShadow=true;m.userData.ownedGeometry=true;world.add(m);
   mesh('sphere',0x343c4d,x,-.38,z,r*.47,.07,r*.47);
  };
  // Horizon: monumental jagged lunar ridge silhouettes, with multiple scales.
  for(let i=0;i<36;i++){const a=i*Math.PI*2/36,r=145+rand()*28,h=10+rand()*27;
   cliff(Math.cos(a)*r,Math.sin(a)*r,10+rand()*11,h,9+rand()*10,i%3?0x424958:0x6a7180);
  }
  for(let i=0;i<Math.round(27*density);i++){const p=point(35,123);if(!p)continue;crater(p[0],p[1],3+rand()*8)}
  // Instanced fractured boulders and rubble clusters (GPU-friendly).
  const debrisCount=low?95:280,variants=5;
  for(let v=0;v<variants;v++){
   const n=Math.ceil(debrisCount/variants);
   const inst=new T.InstancedMesh(rockGeometry(v,low),mat(v%3===0?0x555e6c:v%3===1?0x838996:0x686e7b),n);
   const dummy=new T.Object3D();
   for(let j=0;j<n;j++){
    let x=(rand()-.5)*290,z=(rand()-.5)*290;
    if(Math.abs(x)<17||Math.abs(z)<17){x+=23;z+=23}
    const r=.4+Math.pow(rand(),2)*3.2;
    dummy.position.set(x,terrain(x,z)+r*.3,z);
    dummy.scale.set(r*(.8+rand()*.6),r*(.45+rand()*.6),r*(.75+rand()*.6));
    dummy.rotation.set(rand()*.4,rand()*6.283,rand()*.3);dummy.updateMatrix();inst.setMatrixAt(j,dummy.matrix);
   }
   inst.instanceMatrix.needsUpdate=true;inst.receiveShadow=true;inst.castShadow=false;world.add(inst);
  }
  // Earth visible above lunar horizon, using an unlit globe with clouds and continents.
  const earth=new T.Group();earth.position.set(-135,100,-170);world.add(earth);
  const globe=new T.Mesh(new T.SphereGeometry(20,low?16:32,low?12:24),new T.MeshBasicMaterial({color:0x2878b4}));earth.add(globe);globe.userData.ownedGeometry=true;globe.userData.ownedMaterial=true;
  for(let i=0;i<13;i++){const a=rand()*Math.PI*2,b=(rand()-.5)*2.3;const patch=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:i%3?0x7cae81:0xe9f0f1}));
   patch.position.set(Math.cos(a)*Math.cos(b)*19.8,Math.sin(b)*19.8,Math.sin(a)*Math.cos(b)*19.8);patch.scale.set(3+rand()*4,2+rand()*3,1.1);patch.lookAt(0,0,0);earth.add(patch);patch.userData.ownedGeometry=true;patch.userData.ownedMaterial=true;
  }
  // Primary landmark: a huge central research complex behind the northern battlefield.
  const habitat=(x,z,r=8)=>{const baseY=.55;
   cyl(x,baseY,z,r,1.1,0x5b6979);cyl(x,1.45,z,r*.95,.65,steel);
   const dome=mesh('sphere',white,x,4.15,z,r*.92,3.6,r*.92);
   for(let a=0;a<Math.PI*2;a+=Math.PI/6){const xx=x+Math.sin(a)*r*.92,zz=z+Math.cos(a)*r*.92;
    beam(xx,2.1,zz,.3,2.8,.3,0x687c8e);beam(xx,3.6,zz,.7,.35,.7,blue)}
   for(let a=0;a<Math.PI*2;a+=Math.PI/3){const xx=x+Math.sin(a)*r*.7,zz=z+Math.cos(a)*r*.7;
    beam(xx,1.2,zz,1.7,.6,.15,glow)}
   cyl(x,7.4,z,.3,2.8,steel);orb(x,9,z,.75,amber);obstacle(x,z,r+1);
  };
  for(const [x,z,r] of [[-85,-82,12],[-52,-94,8],[-111,-109,8],[83,87,10],[111,102,7]])habitat(x,z,r);
  // Pressurized corridors connect the research domes.
  beam(-69,1.7,-87,31,3.2,5,0x66788b);beam(-69,2.8,-87,31,.18,5,white);
  beam(-98,1.7,-96,5,3.2,27,0x66788b);
  // A full-scale launchpad with rocket, fuel lines, gantry and service towers.
  const lx=89,lz=-95;beam(lx,.35,lz,37,.7,37,0x4c5969);
  for(let a=0;a<8;a++){const ang=a*Math.PI/4;beam(lx+Math.cos(ang)*14,.82,lz+Math.sin(ang)*14,3,.14,3,amber)}
  cyl(lx,14,lz,3.2,28,white);mesh('cone',0xd6e0e8,lx,31.5,lz,3.2,8,3.2);
  for(let a=0;a<4;a++){const ang=a*Math.PI/2;const x=lx+Math.cos(ang)*3,z=lz+Math.sin(ang)*3;
   beam(x,4,z,2.4,8,1.2,0x557d99)}
  beam(lx+10,18,lz,1.6,36,1.6,0x8d9daa);
  for(let y=3;y<36;y+=5){beam(lx+10,y,lz,7,.4,1.6,0x5d778e);
   beam(lx+10,y,lz+1,1.6,.2,2,amber)}
  for(let y=8;y<29;y+=8)beam(lx+5,y,lz,9,.7,1,0x788b9d);
  obstacle(lx,lz,16);
  // Solar farm: each panel is framed and has subdivided photovoltaic cells.
  const solar=(x,z,dir=1)=>{for(let row=0;row<3;row++)for(let col=0;col<5;col++){
   const px=x+col*4.2,pz=z+row*5.2;beam(px,.9,pz,.18,1.8,.18,steel);
   const panel=beam(px,2,pz,3.7,.12,4.1,blue);panel.rotation.x=dir*.28;
   for(let k=-1;k<=1;k++)beam(px+k*1.05,2.2,pz,.06,.06,3.7,0x78a7cc);
   for(let k=-1;k<=1;k++)beam(px,2.22,pz+k*1.1,3.4,.06,.06,0x78a7cc);
  }};
  solar(-112,48);solar(47,43,-1);
  // Communications array: satellite dish, ring and support trusses.
  for(const [x,z] of [[-100,8],[110,12]]){cyl(x,9,z,1.2,18,steel);
   const dish=new T.Mesh(new T.SphereGeometry(6,low?12:24,low?6:12,0,Math.PI*2,0,Math.PI*.45),mat(white));
   dish.position.set(x,18,z);dish.rotation.x=-.5;dish.castShadow=true;dish.userData.ownedGeometry=true;world.add(dish);
   cyl(x,22,z,.25,5,0x586e80);orb(x,25,z,.7,glow);
   for(let a=0;a<4;a++){const ang=a*Math.PI/2;beam(x+Math.cos(ang)*3,5,z+Math.sin(ang)*3,.3,10,.3,0x677b89)}
  }
  // Cargo depot: modular airlocks, containers and stacked supplies.
  for(let i=0;i<12;i++){const x=-115+(i%4)*12,z=-37+Math.floor(i/4)*10;
   beam(x,2,z,9,4,6,i%3===0?0x9b774b:0x68798a);
   for(let k=-3;k<=3;k+=1.5)beam(x+k,2,z+3.04,.1,3.2,.1,0xa8b5c0);
   beam(x,4.15,z,9.5,.25,6.5,0xc0cbd2);
  }
  // Surface rock scatter, using instanced geometry to reduce draw calls.
  const count=Math.round(130*density),inst=new T.InstancedMesh(geo.sphere,mat(0x656c7b),count),dummy=new T.Object3D();
  for(let i=0;i<count;i++){let x=(rand()-.5)*290,z=(rand()-.5)*290,r=.3+rand()*1.6;
   if(Math.abs(x)<14||Math.abs(z)<14){x+=20;z+=20}
   dummy.position.set(x,r*.23,z);dummy.scale.set(r,r*.55,r*.85);dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix)}
  inst.castShadow=false;inst.receiveShadow=true;world.add(inst);

  // Original CC-independent modular lunar industrial hangar asset.
  // Authored in code: no third-party meshes, textures, or copyrighted game art.
  const hangar=(hx,hz,scale=1)=>{
   const g=new T.Group();g.position.set(hx,0,hz);g.scale.setScalar(scale);world.add(g);
   const part=(shape,c,x,y,z,w,h,d)=>mesh(shape,c,x,y,z,w,h,d,g);
   const steel=0x566271,edge=0x242e3c,trim=0x9eabb8,orange=0xd17b3d,glass=0x2c718a;
   // Hollow structure, real open entrance and interior volume.
   part('box',0x454d5b,0,.22,0,27,.44,23);
   for(const side of [-1,1]){
    part('box',steel,side*13.1,5.6,0,.85,10.8,23);
    part('box',edge,side*13.6,6,0,.38,11.8,23.5);
    for(let z=-10;z<=10;z+=5){
     part('box',trim,side*13.8,5.7,z,.4,10.8,.52);
     part('box',edge,side*13.98,3.4,z,.17,4.5,.8);
     for(let y=2;y<=9;y+=2.5)part('box',orange,side*14.1,y,z,.12,.16,.7);
    }
    part('box',steel,side*11.4,11.6,0,3.2,1.1,23.5);
    part('box',0x1d2835,side*12.7,9.1,0,.24,2.5,19);
    for(let z=-8;z<=8;z+=4)part('box',glass,side*12.9,9.2,z,.3,1.1,2.2);
   }
   // Segmented gabled roof with diagonal truss supports.
   for(const side of [-1,1]){
    const roof=part('box',steel,side*6.8,13.25,0,14.7,.65,24.8);roof.rotation.z=side*-.24;
    const seam=part('box',edge,side*6.8,13.7,0,14.8,.16,24.8);seam.rotation.z=side*-.24;
    for(let z=-10;z<=10;z+=2.5){const rib=part('box',trim,side*6.8,13.9,z,14.5,.13,.18);rib.rotation.z=side*-.24}
   }
   part('box',trim,0,15,0,2.2,.7,25.2);
   // Rear service wall, ducts, machinery and utility pipes.
   part('box',steel,0,6,-11.3,26,11.5,.8);
   for(let x=-9;x<=9;x+=6){
    part('box',edge,x,7,-10.8,4.6,5.6,.32);
    part('box',glass,x,7.8,-10.5,3.7,1.7,.15);
    for(let j=0;j<5;j++)part('box',trim,x,5.2+j*.4,-10.45,4,.12,.13);
   }
   // Entrance portal: recessed jambs, layered blast-door leaves.
   for(const side of [-1,1]){
    part('box',edge,side*12.7,6.5,11.8,1.7,12.6,1.6);
    part('box',trim,side*12.65,6.5,12.7,1.8,12.8,.3);
    part('box',orange,side*12.6,2,12.95,1.5,.35,.16);
    for(let k=0;k<5;k++)part('box',0x394554,side*(10.9+k*.35),5.2,12.2,.26,9.2,.55);
   }
   part('box',edge,0,12.9,12,26,1.8,2);
   part('box',orange,0,12.8,13.05,8,.35,.18);
   for(let x=-9;x<=9;x+=3){part('box',0xe0d1a4,x,12.7,13.2,1.1,.38,.16)}
   // Overhead service crane and movable-looking suspended hook.
   for(const side of [-1,1])part('box',orange,side*8.8,10.9,0,.5,.7,20);
   part('box',trim,0,11.1,-1,18,.9,1.1);
   part('box',edge,0,9.5,-1,.25,2.6,.25);
   part('cyl',orange,0,8,-1,.65,.25,.65);
   // Air handling rooftop stacks and safety collars.
   for(const x of [-8,8])for(const z of [-5,5]){
    part('cyl',edge,x,15.7,z,1.2,2.1,1.2);
    part('cyl',trim,x,16.8,z,1.5,.28,1.5);
    part('box',edge,x,17.1,z,3.4,.2,3.4);
   }
   // PBR metallic accents, minimal GPU cost from shared geometry.
   obstacle(hx,hz-11*scale,12*scale);
  };
  hangar(-77,-69,1.05);
 }else if(idx===7){ // Flooded port: water basins, container yards, gantry cranes, ship.
  for(let x of [-95,95])box(x,.04,0,25,.08,260,0x2c829a);
  for(let i=0;i<30*density;i++){const p=point();if(!p)continue;const [x,z]=p;
   const c=[0xb75c42,0x4d8296,0xc3a357,0x617c65][i%4];
   for(let k=0;k<2;k++){box(x,1.35+k*2.8,z,7,2.6,3,c);for(let j=-2;j<=2;j++)box(x+j*1.15,1.3+k*2.8,z+1.56,.12,2.1,.1,0x343f43)}
   if(i%3===0)obstacle(x,z,5);
  }
  for(let i=0;i<6;i++){let x=-110+i*43,z=-90;box(x,9,z,1.2,18,1.2,0xe7b44f);box(x+8,18,z,18,1,1,0xe7b44f);box(x+16,11,z,.16,14,.16,0xbfc5c7);
   box(x+16,4,z,5,1,5,0x8d999d)}
  box(88,1.3,85,55,2.5,17,0x424c56);box(85,5,85,21,6,14,0xd6d9cf);
  for(let i=0;i<8;i++)box(-115+i*32,.15,105,23,.3,9,0x6b665b);
 }
 // Map-specific boundary silhouettes; no shared fake village/forest overlay.
 for(let i=0;i<20;i++){const a=i*Math.PI/10,r=170+rand()*24;
  const x=Math.sin(a)*r,z=Math.cos(a)*r;
  if(idx===3||idx===4)box(x,20,z,20,40,22,stone);
  else if(idx===6)rock(x,z,12,stone);
  else cliff(x,z,15,22,15,stone);
 }
 // Traversable cross-shaped combat routes; objects avoid central lanes.
 box(0,-.07,0,12,.06,290,idx===6?0x747e8b:idx===5?0x3a3030:idx===7?0x737d7d:groundColor);
 box(0,-.07,0,290,.06,11,idx===6?0x747e8b:idx===5?0x3a3030:idx===7?0x737d7d:groundColor);
 applyComicArt(idx,false);batchRigid(world);
}
function makeTank(type,team,x,z,isPlayer=false){const visual=model(type,team),u=isPlayer?(save.upgrades[type]||[0,0,0]):[0,0,0],d=TYPES[type];const t={...visual,type,team,isPlayer,x,z,yaw:team?Math.PI:0,turretYaw:team?Math.PI:0,pitch:0,hp:d.hp*(1+.12*u[0]),maxHp:d.hp*(1+.12*u[0]),armor:d.armor*(1+.12*u[0]),maxSpeed:d.speed*(1+.08*u[1]),damage:d.damage*(1+.12*u[2]),reload:d.reload,speed:0,cool:1,dead:false,track:0,engine:0,ammo:0,rounds:[50,15,12],mg:createMG(),repairs:1,inputX:0,inputY:0,think:rand(),target:null,steer:0,throttle:0};if(isPlayer){const used=consumeLoadout(save);t.repairs=1+(used.includes('repairKit')?1:0);if(used.includes('ammoCrate')){t.rounds=[70,23,18];t.mg=createMG(120)}if(used.includes('overdrive'))t.maxSpeed*=1.12;if(save.loadout.equipment.includes('rammer'))t.reload*=.85;persist()}t.root.position.set(x,terrain(x,z),z);world.add(t.root);tanks.push(t);return t}
function garage(){state='garage';$('garage').hidden=false;$('hud').hidden=true;$('overlay').hidden=true;zoom=0;buildMap(0,true);preview=model(selected);world.add(preview.root);garageUI()}
function garageUI(){$('credits').textContent=save.credits.toLocaleString('ru');$('stats').textContent=`БОЁВ ${save.stats.battles} / ПОБЕД ${save.stats.wins} / УНИЧТОЖЕНО ${save.stats.kills}`;$('rankPanel').innerHTML=rankMarkup();$('tankCards').innerHTML=TYPES.map((d,i)=>`<button class="tankCard ${i===selected?'active':''}" data-tank="${i}">${d.name}<small>${save.owned.includes(i)?d.class:'◈ '+d.price}</small></button>`).join('');document.querySelectorAll('[data-tank]').forEach(b=>b.onclick=()=>{selected=+b.dataset.tank;world.remove(preview.root);preview.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose()});preview=model(selected);world.add(preview.root);garageUI();sound('ui')});const d=TYPES[selected],u=save.upgrades[selected]||[0,0,0];$('spec').innerHTML=`<div class="eyebrow">${d.class}</div><h2>${d.name}</h2>${[['Прочность',Math.round(d.hp*(1+.12*u[0])),2500],['Броня',Math.round(d.armor*(1+.12*u[0])),250],['Скорость',Math.round(d.speed*3.6*(1+.08*u[1])),90],['Урон',Math.round(d.damage*(1+.12*u[2])),650]].map(([n,v,m])=>`<div class="stat">${n}<b>${v}</b><div class="bar"><i style="width:${v/m*100}%"></i></div></div>`).join('')}${save.owned.includes(selected)?`<div id="upgrades">${['Броня','Мотор','Орудие'].map((n,i)=>`<button data-up="${i}">${n} ${u[i]}/3<br>${u[i]<3?'◈ '+(300+u[i]*300):'MAX'}</button>`).join('')}</div>`:`<button id="buy" class="primary">Купить · ${d.price} ◈</button>`}`;if($('buy'))$('buy').onclick=()=>{if(save.credits<d.price)return notify('Недостаточно кредитов');save.credits-=d.price;save.owned.push(selected);persist();garageUI()};document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{let i=+b.dataset.up,cost=300+u[i]*300;if(u[i]>=3)return;if(save.credits<cost)return notify('Недостаточно кредитов');save.credits-=cost;u[i]++;save.upgrades[selected]=u;persist();garageUI()});$('start').disabled=!save.owned.includes(selected)}
function startBattle(){initAudio();state='loading';$('garage').hidden=true;$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><div class="eyebrow">ПОДГОТОВКА ОПЕРАЦИИ</div><h2>Загрузка боевой зоны…</h2></div>';setTimeout(()=>{mapIndex=$('map').selectedIndex;mode=$('mode').value;buildMap(mapIndex);player=makeTank(selected,0,0,-90,true);if(mode==='team')for(let i=0;i<3;i++)makeTank(i,0,(i-1)*12,-80);wave=1;kills=0;earned=0;elapsed=0;repairUsed=false;aimYaw=0;aimPitch=.04;viewYaw=0;viewPitch=.04;resetInput();zoom=0;autoLock=false;if(mode==='flag'){makeTank(0,1,0,80);initFlag()}else spawnWave();state='battle';$('overlay').hidden=true;$('hud').hidden=false;$('scope').hidden=true;$('tankName').textContent=TYPES[selected].name;$('repair').disabled=false;notify(mode==='flag'?'ЗАХВАТИ ФЛАГ И УДЕРЖИ ЕГО 45 СЕКУНД':'ОПЕРАЦИЯ НАЧАЛАСЬ · Уничтожь противника');if(mobile){document.documentElement.requestFullscreen?.().catch(()=>{});screen.orientation?.lock?.('landscape').catch(()=>{})}},80)}
function spawnWave(){for(let i=0;i<7;i++)makeTank(Math.min(4,Math.floor((i+wave-1)/3)),1,(i-3)*17,55+rand()*45);notify('ВОЛНА '+wave)}
let noteTimer;function notify(s){$('notice').textContent=s;clearTimeout(noteTimer);noteTimer=setTimeout(()=>$('notice').textContent='',3000);if(state==='garage'){const old=$('stats').textContent;$('stats').textContent=s;setTimeout(()=>{$('stats').textContent=old},2400)}}
let audio,engineOsc,engineGain,musicTime=0;function initAudio(){if(audio){audio.resume();return}audio=new(window.AudioContext||window.webkitAudioContext)();engineOsc=audio.createOscillator();engineOsc.type='sawtooth';engineGain=audio.createGain();engineGain.gain.value=0;engineOsc.connect(engineGain).connect(audio.destination);engineOsc.start()}
function sound(kind){if(!audio||!save.settings.sound)return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g).connect(audio.destination);const t=audio.currentTime;const settings={mg:[170,55,.09,.1],shot:[110,22,.35,.28],boom:[65,15,.65,.35],hit:[280,55,.13,.18],ui:[700,1000,.06,.03],music:[110,110,.8,.018]}[kind];o.type=kind==='ui'||kind==='music'?'sine':'sawtooth';o.frequency.setValueAtTime(settings[0],t);o.frequency.exponentialRampToValueAtTime(settings[1],t+settings[2]);g.gain.setValueAtTime(settings[3],t);g.gain.exponentialRampToValueAtTime(.001,t+settings[2]);o.start();o.stop(t+settings[2]);o.onended=()=>{o.disconnect();g.disconnect()}}
function effect(pos,kind,count=12){const max=save.settings.quality==='low'?70:160;for(let i=0;i<count&&particles.length<max;i++){const smoke=kind==='smoke',m=softParticle(smoke?0x5a5c52:kind==='spark'?0xffe98a:i%2?0xff9f31:0x533e2a);m.position.copy(pos);m.scale.setScalar(.3);world.add(m);const life=smoke?2: .35+Math.random()*.7;particles.push({m,v:new T.Vector3((Math.random()-.5)*8,Math.random()*7,(Math.random()-.5)*8),life,max:life,smoke})}}
function fire(t){if(t.dead||t.cool>0||t.rounds[t.ammo]<=0)return false;t.cool=t.reload;t.rounds[t.ammo]--;const dir=new T.Vector3(Math.sin(t.turretYaw)*Math.cos(t.pitch),Math.sin(t.pitch),Math.cos(t.turretYaw)*Math.cos(t.pitch));const p=new T.Vector3(t.x,terrain(t.x,t.z)+2.1,t.z).addScaledVector(dir,4.6*TYPES[t.type].scale);const m=mesh('sphere',0xffed99,p.x,p.y,p.z,.13,.13,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);shots.push({m,p,prev:p.clone(),v:dir.multiplyScalar(105),owner:t,life:3,ammo:t.ammo});effect(p,'spark',8);if(t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<55)sound('shot');t.gun.position.z=.65;return true}
function segmentDistance(a,b,p){const ab=b.clone().sub(a),f=clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return a.clone().addScaledVector(ab,f).distanceTo(p)}
function impact(s,t){if(s.kind==='mg'){impactMG(s,t);return}const d=s.owner,front=Math.abs(Math.cos(Math.atan2(s.v.x,s.v.z)-t.yaw)),armor=t.armor*(.55+front*.45),pen=[145,245,55][s.ammo],ricochet=s.ammo!==2&&front<.22&&Math.random()<.5;let damage=ricochet?0:d.damage*(s.ammo===1?.8:s.ammo===2?1.2:1)*(pen>=armor?1:s.ammo===2?.4:.25);t.hp-=damage;if(d.isPlayer){$('hit').textContent=ricochet?'РИКОШЕТ':`${Math.round(damage)} · ${pen>=armor?'ПРОБИТИЕ':'БРОНЯ'}`;setTimeout(()=>$('hit').textContent='',1200)}effect(s.p,'spark',10);sound('hit');if(damage>0&&Math.random()<.25){if(Math.random()<.5)t.track=4;else t.engine=8;if(t.isPlayer)notify('МОДУЛЬ ПОВРЕЖДЁН · Используй ремонт')}if(t.hp<=0)destroyTank(t,d)}
function blocked(x,z,r=2.5){return Math.abs(x)>145||Math.abs(z)>145||obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r)}
function lineClear(a,b){for(const o of obstacles){const dx=b.x-a.x,dz=b.z-a.z,f=clamp(((o.x-a.x)*dx+(o.z-a.z)*dz)/(dx*dx+dz*dz),0,1);if(Math.hypot(a.x+dx*f-o.x,a.z+dz*f-o.z)<o.r)return false}return true}
function ai(t,dt){t.think-=dt;if(t.think<=0){t.think=.18+rand()*.18;t.target=tanks.filter(o=>!o.dead&&o.team!==t.team).sort((a,b)=>Math.hypot(t.x-a.x,t.z-a.z)-Math.hypot(t.x-b.x,t.z-b.z))[0]}const q=t.target;if(!q||q.dead){t.throttle=0;return}const dx=q.x-t.x,dz=q.z-t.z,dist=Math.hypot(dx,dz),desired=Math.atan2(dx,dz);t.turretYaw+=clamp(angle(desired-t.turretYaw),-dt*.8,dt*.8);t.pitch=Math.atan2(terrain(q.x,q.z)-terrain(t.x,t.z),dist)+.002;const visible=lineClear(t,q);let heading=desired,retreat=t.hp<t.maxHp*.27;if(retreat){let cover=obstacles.reduce((best,o)=>!best||Math.hypot(o.x-t.x,o.z-t.z)<Math.hypot(best.x-t.x,best.z-t.z)?o:best,null);if(cover){const vx=cover.x-q.x,vz=cover.z-q.z,l=Math.hypot(vx,vz);heading=Math.atan2(cover.x+vx/l*(cover.r+7)-t.x,cover.z+vz/l*(cover.r+7)-t.z)}else heading+=Math.PI}let avoid=0;for(const o of obstacles){const ox=o.x-t.x,oz=o.z-t.z,od=Math.hypot(ox,oz),diff=angle(Math.atan2(ox,oz)-t.yaw);if(od<o.r+12&&Math.abs(diff)<1.1)avoid+=diff>0?-1.7:1.7}heading+=avoid;t.steer=clamp(angle(heading-t.yaw)*1.8,-1,1);t.throttle=retreat||dist>42||!visible? .75:.12;if(Math.abs(angle(heading-t.yaw))>1.1)t.throttle=.16;if(visible&&dist<125&&Math.abs(angle(desired-t.turretYaw))<.055&&t.cool<=0){t.pitch+=(rand()-.5)*.014;fire(t)}}
const keys={},joy={x:0,y:0},pointers=new Map();let fireHeld=false,mgHeld=false,drag,joyPointer=null;const cameraPointers=new Map();let viewYaw=0,viewPitch=.04;
function updateTank(t,dt){tickMG(t.mg,dt);t.mgMount.rotation.x=-t.pitch;t.cool=Math.max(0,t.cool-dt);t.track=Math.max(0,t.track-dt);t.engine=Math.max(0,t.engine-dt);t.gun.position.z=lerp(t.gun.position.z,.9,1-Math.exp(-dt*14));if(t.dead){if(Math.random()<dt*5){effect(new T.Vector3(t.x,2,t.z),'smoke',2);effect(new T.Vector3(t.x,2,t.z),'boom',1)};return}if(t.isPlayer){const steerSign=save.settings.invertJoystick?1:-1,rawX=clamp((keys.KeyA?-1:0)+(keys.KeyD?1:0)+joy.x*steerSign,-1,1),rawY=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)-joy.y,-1,1);t.inputX=damp(t.inputX,rawX,12,dt);t.inputY=damp(t.inputY,rawY,rawY===0?14:7,dt);t.throttle=t.inputY;t.steer=t.inputX;if(autoLock||save.settings.assist){const target=tanks.filter(q=>q.team!==t.team&&!q.dead&&lineClear(t,q)).map(q=>({q,a:Math.atan2(q.x-t.x,q.z-t.z)})).filter(o=>Math.abs(angle(o.a-aimYaw))<(autoLock?.65:.075)).sort((a,b)=>Math.abs(angle(a.a-aimYaw))-Math.abs(angle(b.a-aimYaw)))[0];if(target){aimYaw+=angle(target.a-aimYaw)*dt*(autoLock?3:.7);if(autoLock)aimPitch=lerp(aimPitch,Math.atan2(terrain(target.q.x,target.q.z)-terrain(t.x,t.z),Math.hypot(target.q.x-t.x,target.q.z-t.z)),dt*3)}}const turnRate=save.loadout.equipment.includes('stabilizer')?1.82:1.4;t.turretYaw+=clamp(angle(aimYaw-t.turretYaw),-dt*turnRate,dt*turnRate);t.pitch=lerp(t.pitch,aimPitch,dt*6);if(fireHeld)fire(t);if(mgHeld||keys.Space)fireMG(t)}else ai(t,dt);
t.yaw+=t.steer*dt*(t.track?.18:.85)*(t.speed<-.5?-1:1);const targetSpeed=t.throttle*t.maxSpeed*(t.throttle<0?.55:1)*(t.track?.1:1)*(t.engine?.55:1);t.speed=damp(t.speed,targetSpeed,Math.abs(t.throttle)<.08?5:2,dt);const nx=t.x+Math.sin(t.yaw)*t.speed*dt,nz=t.z+Math.cos(t.yaw)*t.speed*dt;const collision=tanks.some(o=>o!==t&&!o.dead&&Math.hypot(nx-o.x,nz-o.z)<3.5);if(!blocked(nx,nz)&&!collision){t.x=nx;t.z=nz}else{t.speed*=.3;if(!t.isPlayer)t.yaw+=dt*.8}t.root.position.set(t.x,terrain(t.x,t.z),t.z);t.body.rotation.y=t.yaw;t.body.rotation.x=(terrain(t.x,t.z+1)-terrain(t.x,t.z-1))*.3;t.turret.rotation.y=angle(t.turretYaw-t.yaw);t.gun.rotation.x=-t.pitch;t.wheels.forEach(w=>w.rotation.x+=t.speed*dt*1.5);
t.trackPhase=(t.trackPhase||0)+t.speed*dt*.055;
for(const link of t.trackLinks){const u=((link.userData.phase+t.trackPhase)%1+1)%1,perimeter=11.8,dist=u*perimeter;let z,y,rotation=0;
if(dist<4.2){z=-2.1+dist;y=.13}else if(dist<5.9){const a=-Math.PI/2+(dist-4.2)/1.7*Math.PI;z=2.1+.54*Math.cos(a);y=.67+.54*Math.sin(a);rotation=a+Math.PI/2}else if(dist<10.1){z=2.1-(dist-5.9);y=1.2}else{const a=Math.PI/2+(dist-10.1)/1.7*Math.PI;z=-2.1+.54*Math.cos(a);y=.67+.54*Math.sin(a);rotation=a+Math.PI/2}
link.position.set(link.userData.side*1.94,y,z);link.rotation.x=rotation}
t.details.visible=t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<55;t.wheels.forEach(w=>w.visible=t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<65);if(Math.abs(t.speed)>5&&Math.random()<dt*5)effect(new T.Vector3(t.x,.4,t.z),'smoke',1)}
function updateShots(dt){for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.prev.copy(s.p);s.v.y-=.65*dt;s.p.addScaledVector(s.v,dt);s.m.position.copy(s.p);s.life-=dt;let hit=false;for(const t of tanks){if(t.dead||t.team===s.owner.team)continue;if(segmentDistance(s.prev,s.p,new T.Vector3(t.x,terrain(t.x,t.z)+1.5,t.z))<2.1*TYPES[t.type].scale){impact(s,t);hit=true;break}}if(!hit)for(const o of obstacles){if(segmentDistance(s.prev,s.p,new T.Vector3(o.x,2,o.z))<o.r){effect(s.p,'spark',5);hit=true;break}}if(hit||s.life<=0||s.p.y<terrain(s.p.x,s.p.z)){world.remove(s.m);shots.splice(i,1)}}}
function updateEffects(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){world.remove(p.m);particles.splice(i,1);continue}p.m.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*1.6);p.v.y+=p.smoke?dt*2:-dt*8;p.m.scale.setScalar(p.smoke?.2+(1-p.life/p.max)*1.8:.1+p.life*.3)}}
function repair(){if(state!=='battle'||player.repairs<=0||player.dead)return;repairUsed=true;player.repairs--;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.35);player.track=player.engine=0;$('repair').disabled=player.repairs<=0;notify('РЕМОНТ ЗАВЕРШЁН · +35% ПРОЧНОСТИ');sound('ui')}
function setZoom(){if(state!=='battle')return;zoom=(zoom+1)%4;$('scope').hidden=zoom===0;$('aim').innerHTML=`⊕<small>${zoom?['','2×','4×','6×'][zoom]:'ПРИЦЕЛ'}</small>`;sound('ui')}
function changeAmmo(){if(!player)return;player.ammo=(player.ammo+1)%3;$('ammo').innerHTML=['AP','APCR','HE'][player.ammo]+'<small>СНАРЯД</small>';sound('ui')}
function end(win){state='result';resetInput();save.stats.battles++;save.stats.wins+=+win;save.stats.kills+=kills;const reward=earned+(win?700:220)+(mode==='survival'?(wave-1)*250:0);save.credits+=reward;const oldLevel=rankFor(save.xp||0);const gainedXP=90+kills*65+(win?220:0)+(mode==='survival'?(wave-1)*70:0);save.xp=(save.xp||0)+gainedXP;const newLevel=rankFor(save.xp);persist();document.exitPointerLock?.();$('overlay').hidden=false;$('overlay').innerHTML=`<div class="dialog"><div class="eyebrow">ОПЕРАЦИЯ ЗАВЕРШЕНА</div><h2>${win?'ПОБЕДА':'ТАНК УНИЧТОЖЕН'}</h2><p>${MAP_NAMES[mapIndex]} · ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}</p><h2>+${reward} ◈ · +${gainedXP} XP</h2>${newLevel>oldLevel?`<div class="levelUp">${RANK_ICONS[newLevel-1]} НОВЫЙ УРОВЕНЬ ${newLevel} · ${RANKS[newLevel-1]}</div>`:""}<p>Уничтожено: ${kills} ${mode==='survival'?'· Волна: '+wave:''}</p><button id="again" class="primary">Ещё один бой</button><button id="backGarage">В гараж</button></div>`;$('again').onclick=startBattle;$('backGarage').onclick=garage}
function pause(){if(state==='battle'){state='paused';resetInput();document.exitPointerLock?.();$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><div class="eyebrow">ОПЕРАЦИЯ ПРИОСТАНОВЛЕНА</div><h2>Пауза</h2><button id="resume" class="primary">Продолжить</button><button id="pauseSettings">Настройки</button><button id="exitBattle">Завершить бой</button></div>';$('resume').onclick=pause;$('pauseSettings').onclick=openSettings;$('exitBattle').onclick=()=>end(false)}else if(state==='paused'){state='battle';$('overlay').hidden=true}}
function hud(){const p=player;$('mgInfo').textContent=`КП-12.7  ${p.mg.belt} / ${p.mg.reserve} · ${p.mg.reloading>0?'ЛЕНТА '+p.mg.reloading.toFixed(1)+'с':p.mg.overheated?'ПЕРЕГРЕВ':Math.round(p.mg.heat)+'°'}`;$('mgHeat').style.width=p.mg.heat+'%';$('mg').classList.toggle('hot',p.mg.overheated);$('repair').innerHTML='＋<small>РЕМОНТ ×'+p.repairs+'</small>';const direction=new T.Vector3(Math.sin(p.turretYaw)*Math.cos(p.pitch),Math.sin(p.pitch),Math.cos(p.turretYaw)*Math.cos(p.pitch));const bore=new T.Vector3(p.x,terrain(p.x,p.z)+2.1,p.z).addScaledVector(direction,60).project(camera);$('bore').style.left=(bore.x*.5+.5)*100+'%';$('bore').style.top=(-bore.y*.5+.5)*100+'%';$('bore').style.opacity=Math.abs(angle(p.turretYaw-aimYaw))<1?'1':'0';$('hp').textContent=`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;$('hpbar').style.width=p.hp/p.maxHp*100+'%';$('modules').textContent=[p.track?'ГУСЕНИЦА ⚠':'',p.engine?'ДВИГАТЕЛЬ ⚠':''].join(' ');$('speed').textContent=Math.round(Math.abs(p.speed)*3.6)+' км/ч';$('reload').textContent=p.cool>0?'ПЕРЕЗАРЯДКА '+p.cool.toFixed(1)+'с':'ОРУДИЕ ГОТОВО';$('ammoInfo').textContent=['AP','APCR','HE'][p.ammo]+' · '+p.rounds[p.ammo];$('fire').style.background=`conic-gradient(#c9df7a66 ${100*(1-p.cool/p.reload)}%,#19291d99 0)`;const allies=tanks.filter(t=>t.team===0&&!t.dead).length,enemies=tanks.filter(t=>t.team===1&&!t.dead).length;$('score').textContent=`${allies} СОЮЗНИКИ  /  ${enemies} ПРОТИВНИКИ${mode==='survival'?' · ВОЛНА '+wave:mode==='flag'?' · 🚩 '+(flagCarrier?(flagCarrier.isPlayer?'ТВОЙ ФЛАГ':'ФЛАГ ВРАГА'):'ФЛАГ СВОБОДЕН')+' · '+Math.ceil(flagTimer)+'с':''}`;const c=$('mini').getContext('2d');c.clearRect(0,0,180,180);c.fillStyle='#52604b';obstacles.forEach(o=>c.fillRect(90+o.x*.6-o.r*.6,90-o.z*.6-o.r*.6,o.r*1.2,o.r*1.2));tanks.forEach(t=>{if(t.dead)return;c.fillStyle=t.isPlayer?'#ffffff':t.team?'#ee8768':'#d4f070';c.beginPath();c.arc(90+t.x*.6,90-t.z*.6,t.isPlayer?4:3,0,7);c.fill()});c.strokeStyle='#fff';c.beginPath();c.moveTo(90+p.x*.6,90-p.z*.6);c.lineTo(90+p.x*.6+Math.sin(aimYaw)*15,90-p.z*.6-Math.cos(aimYaw)*15);c.stroke()}
function applySettings(){const s=save.settings;document.documentElement.style.setProperty('--size',s.size);document.documentElement.style.setProperty('--opacity',s.opacity);renderer.shadowMap.enabled=s.quality!=='low';const shadowSize=s.quality==='high'?2048:1024;if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null}renderer.setPixelRatio(Math.min(devicePixelRatio,s.quality==='high'?2:s.quality==='medium'?1.3:.8));for(const [id,p]of Object.entries(s.layout||{})){if($(id))Object.assign($(id).style,{left:p.x+'%',top:p.y+'%',right:'auto',bottom:'auto'})}persist()}
function openSettings(){if(state==='battle')pause();$('settings').hidden=false;const s=save.settings;$('settingsFields').innerHTML=`${[['sensitivity','Чувствительность обзора',.3,2.5,.1],['aimSensitivity','Чувствительность прицела',.2,1.5,.05],['deadzone','Мёртвая зона джойстика',.02,.25,.01],['smoothing','Скорость камеры',4,20,1],['size','Размер управления',.7,1.5,.05],['opacity','Прозрачность',.25,1,.05]].map(([k,n,a,b,step])=>`<label>${n}<input data-setting="${k}" type="range" min="${a}" max="${b}" step="${step}" value="${s[k]}"></label>`).join('')}${[['assist','Помощь в прицеливании'],['invert','Инверсия вертикальной оси'],['invertJoystick','Инверсия поворота джойстика (лево / право)'],['sound','Звуки и музыка']].map(([k,n])=>`<label>${n}<input data-setting="${k}" type="checkbox" ${s[k]?'checked':''}></label>`).join('')}<label>Графика<select data-setting="quality"><option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option></select></label>`;document.querySelector('[data-setting="quality"]').value=s.quality;document.querySelectorAll('[data-setting]').forEach(el=>el.oninput=()=>{s[el.dataset.setting]=el.type==='checkbox'?el.checked:el.type==='range'?+el.value:el.value;applySettings()})}
$('settingsOpen').onclick=openSettings;$('settingsClose').onclick=()=>{$('settings').hidden=true};$('layout').onclick=()=>{editing=true;$('settings').hidden=true;$('overlay').hidden=true;$('garage').hidden=true;$('hud').hidden=false;$('layoutDone').hidden=false;document.body.classList.remove('desktop')};$('layoutDone').onclick=e=>{if(e.target.tagName!=='BUTTON')return;editing=false;persist();$('layoutDone').hidden=true;document.body.classList.toggle('desktop',!mobile);if(state==='garage'){$('garage').hidden=false;$('hud').hidden=true}else if(state==='paused'){$('overlay').hidden=false}openSettings()};$('resetLayout').onclick=()=>{save.settings.layout={};document.querySelectorAll('.control').forEach(e=>{e.style.left=e.style.right=e.style.top=e.style.bottom=''});applySettings()};$('start').onclick=startBattle;$('pause').onclick=pause;$('repair').onclick=repair;$('aim').onclick=setZoom;$('ammo').onclick=changeAmmo;$('lock').onclick=()=>{if(editing)return;autoLock=!autoLock;$('lock').style.color=autoLock?'#e5fa72':'';notify(autoLock?'ЗАХВАТ ВКЛЮЧЁН':'ЗАХВАТ ОТКЛЮЧЁН')};$('mini').onclick=()=>{$('mini').style.width=$('mini').style.width?'':'240px';$('mini').style.height=$('mini').style.height?'':'240px'};
function resetInput(){Object.keys(keys).forEach(k=>delete keys[k]);joy.x=joy.y=0;fireHeld=false;mgHeld=false;drag=null;joyPointer=null;cameraPointers.clear();pointers.clear();$('stick').style.transform=''}window.addEventListener('blur',()=>{resetInput();if(state==='battle')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(state==='battle')pause()}});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='Escape')pause();if(e.code==='KeyR')repair();if(e.code==='KeyQ')changeAmmo();if(e.code==='ShiftLeft')setZoom();if(e.code==='KeyF'&&state==='battle')reloadMG(player.mg);if(e.code==='KeyC'&&state==='battle'){aimYaw=player.yaw;aimPitch=.04}});window.addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('.control').forEach(el=>{el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);if(editing){pointers.set(e.pointerId,{kind:'layout',el,dx:e.clientX-el.getBoundingClientRect().left,dy:e.clientY-el.getBoundingClientRect().top});return}if(state!=='battle')return;if(el.id==='joystick'&&joyPointer===null){joyPointer=e.pointerId;const r=el.getBoundingClientRect();pointers.set(e.pointerId,{kind:'joy',cx:r.left+r.width/2,cy:r.top+r.height/2,r:r.width*.36});movePointer(e)}if(el.id==='fire'){pointers.set(e.pointerId,{kind:'fire'});fireHeld=true;fire(player)}if(el.id==='mg'){pointers.set(e.pointerId,{kind:'mg'});mgHeld=true;fireMG(player)}});el.addEventListener('pointermove',movePointer);el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);el.addEventListener('click',e=>{if(editing)e.stopImmediatePropagation()},true)});
function movePointer(e){const p=pointers.get(e.pointerId);if(!p)return;if(p.kind==='joy'){const v=joystickVector((e.clientX-p.cx)/p.r,(e.clientY-p.cy)/p.r,save.settings.deadzone);joy.x=v.x;joy.y=v.y;$('stick').style.transform=`translate(${joy.x*p.r*.7}px,${joy.y*p.r*.7}px)`}if(p.kind==='layout'){let x=clamp((e.clientX-p.dx)/innerWidth*100,2,88),y=clamp((e.clientY-p.dy)/innerHeight*100,12,78);Object.assign(p.el.style,{left:x+'%',top:y+'%',right:'auto',bottom:'auto'});save.settings.layout[p.el.id]={x,y}}}
function release(e){const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(p?.kind==='joy'){joy.x=joy.y=0;joyPointer=null;$('stick').style.transform=''}if(p?.kind==='fire')fireHeld=[...pointers.values()].some(p=>p.kind==='fire');if(p?.kind==='mg')mgHeld=[...pointers.values()].some(p=>p.kind==='mg');cameraPointers.delete(e.pointerId)}
$('game').addEventListener('pointerdown',e=>{if(editing)return;if(state==='garage'){drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('game').setPointerCapture(e.pointerId);return}if(state!=='battle')return;if(e.pointerType==='mouse'){if(e.button===2)setZoom();else if(e.button===0){pointers.set(e.pointerId,{kind:'fire'});fire(player);fireHeld=true;$('game').requestPointerLock?.()}}else if(cameraPointers.size===0){cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('game').setPointerCapture(e.pointerId)}});
$('game').addEventListener('pointermove',e=>{if(state==='garage'&&drag?.id===e.pointerId){garageYaw+=(e.clientX-drag.x)*.01;drag.x=e.clientX;return}if(state!=='battle'||editing)return;let dx=0,dy=0;const touch=cameraPointers.get(e.pointerId);if(document.pointerLockElement){dx=e.movementX;dy=e.movementY}else if(touch){dx=e.clientX-touch.x;dy=e.clientY-touch.y;touch.x=e.clientX;touch.y=e.clientY}else if(e.pointerType==='mouse'){dx=e.movementX;dy=e.movementY}else return;const sensitivity=.0025*save.settings.sensitivity*(zoom?save.settings.aimSensitivity/(zoom*1.4):1);aimYaw+=clamp(dx,-150,150)*sensitivity;aimPitch=clamp(aimPitch-clamp(dy,-150,150)*sensitivity*(save.settings.invert?-1:1),-.18,.35)});
window.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=null;release(e)});window.addEventListener('pointercancel',release);$('game').addEventListener('lostpointercapture',release);window.addEventListener('contextmenu',e=>e.preventDefault());
$('mgReload').onclick=()=>{if(state==='battle'&&!editing)reloadMG(player.mg)};$('center').onclick=()=>{if(state==='battle'&&!editing){aimYaw=player.yaw;aimPitch=.04}};
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
let last=performance.now(),fpsAccum=0,frames=0,adaptive=1;const desiredPos=new T.Vector3(),look=new T.Vector3();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;gameTime+=dt;if(state==='garage'){const a=garageYaw+Math.sin(gameTime*.12)*.05;camera.position.set(Math.sin(a)*12,6.2,Math.cos(a)*12);camera.lookAt(0,1,0);camera.fov=55;camera.updateProjectionMatrix();preview.root.rotation.y=.3}else if(player){if(state==='battle'&&!editing){elapsed+=dt;tanks.forEach(t=>updateTank(t,dt));updateShots(dt);updateEffects(dt);if(mode==='flag')updateFlag(dt);if(state==='battle'&&player.dead)end(false);else if(state==='battle'&&!tanks.some(t=>t.team===1&&!t.dead)){if(mode==='flag'){end(true)}else if(mode==='survival'){wave++;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.2);player.rounds=player.rounds.map((n,i)=>n+[20,7,5][i]);spawnWave()}else end(true)}hud();musicTime+=dt;if(musicTime>4){musicTime=0;sound('music')}}viewYaw+=angle(aimYaw-viewYaw)*(1-Math.exp(-dt*save.settings.smoothing));viewPitch=damp(viewPitch,aimPitch,save.settings.smoothing,dt);const base=new T.Vector3(player.x,terrain(player.x,player.z)+2.2,player.z),dir=new T.Vector3(Math.sin(viewYaw)*Math.cos(viewPitch),Math.sin(viewPitch),Math.cos(viewYaw)*Math.cos(viewPitch));if(zoom){desiredPos.copy(base).addScaledVector(dir,4.8);camera.position.copy(desiredPos);look.copy(base).addScaledVector(dir,160)}else{desiredPos.copy(base).addScaledVector(dir,-12);desiredPos.y+=5;camera.position.lerp(desiredPos,1-Math.exp(-dt*7));look.copy(base).addScaledVector(dir,60)}camera.lookAt(look);camera.fov=zoom?[55,30,17,10][zoom]:55;camera.updateProjectionMatrix();player.root.visible=!zoom;sun.position.set(player.x-45,70,player.z+35);sun.target.position.set(player.x,0,player.z)}if(engineGain){engineGain.gain.setTargetAtTime(state==='battle'&&save.settings.sound?.018:0,audio.currentTime,.1);engineOsc.frequency.setTargetAtTime(35+Math.abs(player?.speed||0)*3,audio.currentTime,.1)}sky.position.copy(camera.position);renderer.render(scene,camera);fpsAccum+=dt;frames++;if(fpsAccum>3){const fps=frames/fpsAccum;if(state==='battle'&&fps<28&&adaptive>.6){adaptive-=.1;renderer.setPixelRatio(Math.min(devicePixelRatio,1.3)*adaptive)}window.STEEL_METRICS={fps:Math.round(fps),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,tanks:tanks.length,particles:particles.length,state};fpsAccum=0;frames=0}}


function initFlag(){flagCarrier=null;flagTimer=0;flagTransferCooldown=0;if(flagMesh){world.remove(flagMesh);flagMesh=null}flagMesh=new T.Group();const pole=mesh('box',0xe5e3cb,0,2,0,.14,4,.14,flagMesh);const cloth=mesh('box',0xffc439,.75,3.65,0,1.5,.85,.1,flagMesh);cloth.material=mat(0xffc439);flagMesh.position.set(0,terrain(0,0),0);world.add(flagMesh)}
function updateFlag(dt){if(state!=='battle'||mode!=='flag')return;flagTransferCooldown=Math.max(0,flagTransferCooldown-dt);if(flagCarrier?.dead){flagCarrier=null;flagTimer=0}if(!flagCarrier){const contender=tanks.find(t=>!t.dead&&Math.hypot(t.x,t.z)<6);if(contender){flagCarrier=contender;flagTimer=45;flagTransferCooldown=1.5;notify(contender.isPlayer?'ТЫ ВЗЯЛ ФЛАГ! УДЕРЖИ 45 СЕКУНД':'ВРАГ ВЗЯЛ ФЛАГ! ДОГОНИ ЕГО')}}else{const other=tanks.find(t=>!t.dead&&t.team!==flagCarrier.team&&Math.hypot(t.x-flagCarrier.x,t.z-flagCarrier.z)<5);if(other&&flagTransferCooldown===0){flagCarrier=other;flagTimer=45;flagTransferCooldown=1.5;notify(other.isPlayer?'ФЛАГ ПЕРЕХВАЧЕН!':'ВРАГ ПЕРЕХВАТИЛ ФЛАГ!')}else{flagTimer-=dt;if(flagTimer<=0){end(flagCarrier.isPlayer);return}}}if(flagMesh){const x=flagCarrier?.x??0,z=flagCarrier?.z??0;flagMesh.position.set(x,terrain(x,z)+(flagCarrier?2.2:0),z);flagMesh.rotation.y=flagCarrier?.yaw??0}}

function destroyTank(t,owner){if(t.dead)return;if(mode==='flag'&&flagCarrier===t){flagCarrier=null;flagTimer=0;notify('ФЛАГ ПОТЕРЯН!')} t.hp=0;t.dead=true;t.speed=0;effect(t.root.position.clone().add(new T.Vector3(0,2,0)),'boom',24);sound('boom');if(owner.isPlayer){kills++;earned+=160;notify('ЦЕЛЬ УНИЧТОЖЕНА · +160 ◈')}t.root.traverse(o=>{if(o.isMesh)o.material=mat(0x30352d)});t.turret.rotation.z=.12}
function fireMG(t){if(state!=='battle'||t.dead)return false;if(!consumeMGShot(t.mg,t.isPlayer&&save.loadout.equipment.includes('cooler')))return false;const yaw=t.turretYaw+(Math.random()-.5)*.012,pitch=t.pitch+(Math.random()-.5)*.009,dir=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));t.root.updateMatrixWorld(true);const origin=t.mgMount.localToWorld(new T.Vector3(0,0,1.65));const target=new T.Vector3(t.x,terrain(t.x,t.z)+2.1,t.z).addScaledVector(dir,60);dir.copy(target.sub(origin).normalize());const tracer=mesh('sphere',0xffd182,origin.x,origin.y,origin.z,.035,.035,1.4);tracer.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);shots.push({m:tracer,p:origin,prev:origin.clone(),v:dir.multiplyScalar(175),owner:t,life:1.1,ammo:0,kind:'mg'});effect(origin,'spark',2);sound('mg');return true}
function impactMG(s,t){const incoming=new T.Vector3(s.v.x,0,s.v.z).normalize(),forward=new T.Vector3(Math.sin(t.yaw),0,Math.cos(t.yaw));const rear=incoming.dot(forward)>.55,damage=mgDamage(t.armor,rear);t.hp-=damage;if(damage>0&&Math.random()<.13)t.track=Math.max(t.track,2);effect(s.p,'spark',3);if(s.owner.isPlayer){$('hit').textContent=damage?`КП-12.7 · −${damage}`:'КП-12.7 · БРОНЯ';clearTimeout(mgHitTimer);mgHitTimer=setTimeout(()=>$('hit').textContent='',450)}if(t.hp<=0)destroyTank(t,s.owner)}
let mgHitTimer,shopTab='equipment';
function refreshPaint(){if(state==='garage'){world.remove(preview.root);preview.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose()});preview=model(selected);world.add(preview.root)}}
function shop(){if(state!=='garage')return;$('shop').hidden=false;renderShop()}
function renderShop(){const tabs=[['equipment','Оборудование'],['supplies','Снабжение'],['paint','Камуфляж']];$('shopTabs').innerHTML=tabs.map(([id,name])=>`<button data-category="${id}" class="${shopTab===id?'selected':''}">${name}</button>`).join('');$('shopBalance').textContent=save.credits+' ◈';$('loadoutSummary').textContent=`Оборудование ${save.loadout.equipment.length}/2 · Снабжение ${save.loadout.supplies.length}/2 · Выбранное снабжение расходуется при начале боя`;
$('shopItems').innerHTML=PRODUCTS.filter(p=>p.category===shopTab).map(p=>{const owned=p.category==='equipment'?save.equipment.includes(p.id):p.category==='paint'?save.paints.includes(p.id):(save.inventory[p.id]||0)>0;const active=p.category==='paint'?save.loadout.paint===p.id:save.loadout[p.category].includes(p.id);return `<article class="shopItem"><div class="productIcon">${p.category==='equipment'?'⚙':p.category==='paint'?'◈':'▤'}</div><div><h3>${p.name}</h3><p>${p.description}</p><small>${p.category==='supplies'?'На складе: '+(save.inventory[p.id]||0):owned?'В собственности':'Постоянная покупка'}</small></div><div class="shopActions">${!owned||p.category==='supplies'?`<button data-buy="${p.id}" ${save.credits<p.price?'disabled':''}>Купить · ${p.price} ◈</button>`:''}${owned?`<button data-equip="${p.id}" class="${active?'selected':''}">${active?(p.category==='paint'?'Выбрано':'Снять'):(p.category==='paint'?'Нанести':'Установить')}</button>`:''}</div></article>`}).join('');
if(shopTab==='paint')$('shopItems').innerHTML+='<button id="factoryPaint">Заводская окраска · бесплатно</button>';
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{shopTab=b.dataset.category;renderShop()});document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const error=purchase(save,b.dataset.buy);$('shopMessage').textContent=error||'Покупка поступила на склад';persist();garageUI();renderShop();sound('ui')});document.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{const error=equip(save,b.dataset.equip);$('shopMessage').textContent=error||'Оснащение обновлено';persist();refreshPaint();renderShop()});if($('factoryPaint'))$('factoryPaint').onclick=()=>{save.loadout.paint='factory';persist();refreshPaint();renderShop()}}
$('shopOpen').onclick=shop;$('shopClose').onclick=()=>{$('shop').hidden=true};

applySettings();garage();requestAnimationFrame(frame);if(typeof location!=='undefined'&&location.protocol!=='file:'&&'serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
