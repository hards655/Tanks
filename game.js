import {battlefieldPlan,clearLane,coverContact,sphereContact} from './battlefield.js';
import {tankGarland,winterHangar} from './winter.js';
import {branchingTree} from './foliage.js';
import {WEAPONS,applyWeapon,battleSettlement,actualDamage} from './arsenal.js';
import {microSurface,addWind,addTerrainShader,windUniform} from './material-detail.js';
import {createTracks,animateTracks} from './track-rig.js';
import {controlLayout,canPlaceControl} from './controls.js';
import {PAINTS} from './paints.js';
import * as T from './vendor/three.js';
import {joystickVector,damp,PRODUCTS,migrateProfile,purchase,equip,consumeLoadout,createMG,reloadMG,tickMG,consumeMGShot,mgDamage} from './systems.js';
import {bevelBox,skyDome,detailTank,batchRigid,softParticle} from './visuals.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a)),lerp=T.MathUtils.lerp;
const TYPES=[{name:'LYNX',class:'ЛЁГКИЙ / I',hp:760,speed:17,armor:45,damage:190,reload:2.5,price:0,color:0x798462,scale:.88},{name:'KESTREL',class:'ЛЁГКИЙ / II',hp:850,speed:20,armor:55,damage:200,reload:2.7,price:900,color:0x8c9275,scale:.92},{name:'VANGUARD',class:'СРЕДНИЙ / III',hp:1200,speed:14,armor:95,damage:280,reload:3.4,price:1800,color:0x65745b,scale:1},{name:'BASTION',class:'ТЯЖЁЛЫЙ / IV',hp:1700,speed:10,armor:140,damage:370,reload:4.5,price:3200,color:0x737c68,scale:1.15},{name:'MONOLITH',class:'ТЯЖЁЛЫЙ / V',hp:2200,speed:8,armor:175,damage:460,reload:5.2,price:4800,color:0x58665e,scale:1.25}];
const AMMO_NAMES=['AP','APCR','HE','HEAT','HESH'];
const AMMO_PEN=[145,245,55,272,96],AMMO_MULT=[1,.8,1.2,.94,1.46],AMMO_PRICES=[0,12,6,19,15];
let ammoService=0,smokeCharges=0,smokeUntil=0,smokeOrigin={x:0,z:0},battleDamage=0,damageService=0;
const MAP_NAMES=["Зелёная долина", "Пустынный рубеж", "Зимний фронт", "Неоновый каньон", "Ржавый мегаполис", "Вулканический разлом", "Лунная база", "Затопленный порт"];
const RANKS=['Новобранец','Рекрут','Курсант','Стрелок','Наводчик','Механик','Разведчик','Боец','Ветеран','Сержант','Старшина','Лейтенант','Капитан','Майор','Полковник','Командир','Ас','Герой фронта','Легенда','Маршал стали'];
const RANK_ICONS=['◇','◆','⬡','✦','✧','✪','◈','⬟','✶','★','✷','✹','✵','❖','✸','✺','✹','✪','✯','♛'];
const xpForLevel=l=>l>=20?Infinity:Math.round(180*l+45*l*l);
function rankFor(xp){let l=1;while(l<20&&xp>=xpForLevel(l))l++;return l}
function rankMarkup(){const l=rankFor(save.xp||0),prev=l===1?0:xpForLevel(l-1),next=xpForLevel(l);return `<div class="rankBadge"><span class="rankIcon">${RANK_ICONS[l-1]}</span><div><b>УРОВЕНЬ ${l} / 20 · ${RANKS[l-1]}</b><div class="rankBar"><i style="width:${l===20?100:Math.max(0,Math.min(100,(save.xp-prev)/(next-prev)*100))}%"></i></div><small>${l===20?'МАКСИМАЛЬНЫЙ УРОВЕНЬ':Math.floor(save.xp||0)+' / '+next+' XP'}</small></div></div>`}
const defaults={xp:0,credits:1800,owned:[0],upgrades:{},stats:{battles:0,wins:0,kills:0},settings:{invertJoystick:false,invertJoystickY:false,sensitivity:1,aimSensitivity:.65,deadzone:.12,smoothing:10,size:1,opacity:.85,assist:true,invert:false,quality:'medium',sound:true,layout:{}}};
let save;try{save=JSON.parse(localStorage.getItem('steel-thunder-v1'))}catch{}save={...defaults,...save,settings:{...defaults.settings,...save?.settings}};
migrateProfile(save);
function persist(){try{localStorage.setItem('steel-thunder-v1',JSON.stringify(save))}catch{notify('Сохранение недоступно в этом браузере')}}
const mobile=matchMedia('(pointer:coarse)').matches;document.body.classList.toggle('desktop',!mobile);
const renderer=(()=>{try{return new T.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'})}catch(error){$('garage').hidden=true;$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><div class="eyebrow">STEEL THUNDER / FIELDWORKS 4.0</div><h2>WebGL недоступен</h2><p>Браузер не смог запустить 3D-графику. Откройте игру в Chrome с аппаратным ускорением. Если HTML открыт во встроенном просмотрщике файлов, используйте обычный браузер.</p><button id="retryGraphics" class="primary">Повторить запуск</button></div>';$('retryGraphics').onclick=()=>location.reload();throw error}})();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.25));renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.15,550);scene.background=new T.Color(0x899f91);scene.fog=new T.FogExp2(0x899f91,.0025);scene.add(new T.HemisphereLight(0xf1f6ff,0x66705c,2.65));const sun=new T.DirectionalLight(0xffedd2,3.5);sun.position.set(-45,70,35);sun.castShadow=false;sun.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:200});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);const sky=skyDome(scene);
const world=new T.Group();scene.add(world);let tanks=[],obstacles=[],shots=[],particles=[],player,preview,selected=0,mapIndex=0,mode='solo',flagCarrier=null,flagTimer=0,flagMesh=null,flagPole=null,flagTransferCooldown=0,state='garage',wave=1,kills=0,earned=0,elapsed=0,zoom=0,autoLock=false,aimYaw=0,aimPitch=.06,garageYaw=.55,gameTime=0,repairUsed=false,editing=false;
const mats=new Map(),geo={box:bevelBox(),sphere:new T.IcosahedronGeometry(1,2),cyl:new T.CylinderGeometry(1,1,1,24),cone:new T.ConeGeometry(1,1,16)};
function mat(c){if(!mats.has(c)){const m=new T.MeshStandardMaterial({color:c,roughness:.72,metalness:.29});if(TYPES.some(t=>t.color===c)){const d=microSurface('metal');m.normalMap=d.normalMap;m.normalScale=new T.Vector2(.23,.23);m.roughnessMap=d.roughnessMap}mats.set(c,m)}return mats.get(c)}
function mesh(g,c,x,y,z,sx=1,sy=1,sz=1,parent=world){const m=new T.Mesh(geo[g],mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=!mobile;m.receiveShadow=true;parent.add(m);return m}

// Visible modular equipment attachments; ownership is applied to the garage and player tank.
// Original designs, built from shared geometry so static parts batch with the turret.
function modelGear(turret,body,gun,team){
 if(team!==0)return;const eq=save.loadout.equipment||[];
 if(eq.includes('smokeGrenades')){
  for(const side of [-1,1]){mesh('box',0x3e4d4c,side*1.25,.42,.35,.55,.35,.65,turret);
   for(let j=0;j<3;j++){const tube=mesh('cyl',0x303c3a,side*(1.12+j*.13),.68,.55,.11,.52,.11,turret);tube.rotation.x=Math.PI*.34}
  }
 }
 if(eq.includes('optics')){
  mesh('box',0x2a3434,-.58,.91,.19,.48,.42,.64,turret);
  mesh('box',0x4c9799,-.58,.97,.53,.31,.27,.045,turret);
  mesh('box',0x181e22,-.58,.89,.58,.38,.03,.08,turret);
 }
 if(eq.includes('heavyTracks'))for(const side of [-1,1])for(let k=0;k<5;k++)mesh('box',0x465449,side*1.93,1.05,-1.82+k*.9,.18,.62,.81,body);
 if(eq.includes('wetRack')||eq.includes('ammoPouch'))for(let side of [-1,1]){mesh('box',0x5b6457,side*.72,.42,-1.2,.68,.48,.42,turret);
  mesh('box',0x222b2b,side*.72,.71,-1.2,.6,.08,.34,turret)}
 if(eq.includes('spallLiner'))for(const side of [-1,1])for(let k=0;k<3;k++)mesh('box',0x586357,side*1.13,.18,-.64+k*.58,.24,.48,.53,turret);
 if(eq.includes('longBarrel')){const collar=mesh('cyl',0x414847,0,0,2.7,.19,.48,.19,gun);collar.rotation.x=Math.PI/2;mesh('box',0x66716a,0,0,2.9,.27,.1,.3,gun)}
 if(eq.includes('gunLaying'))for(let side of [-1,1]){const piston=mesh('cyl',0x7e8580,side*.43,-.22,.64,.052,.88,.052,gun);piston.rotation.x=Math.PI/2}
 if(eq.includes('fieldWorkshop')){mesh('box',0x4f584b,.9,1.7,-1.45,1,.55,.7,body);mesh('box',0x91947c,.9,2,-1.45,.95,.07,.72,body)}
}

function model(type,team=0){const d=TYPES[type],root=new T.Group(),body=new T.Group();root.add(body);const c=d.color;mesh('box',c,0,1.12,0,2.9,.72,4.3,body);const deck=mesh('box',c,0,1.5,-.15,2.65,.35,3.5,body);deck.rotation.x=.07;const nose=mesh('box',c,0,1.14,2,2.8,.7,.6,body);nose.rotation.x=-.35;
const wheels=[];for(const side of [-1,1]){for(let i=0;i<7;i++){const w=mesh('cyl',0x444c3b,side*1.91,.66,-1.92+i*.64,.38,.12,.38,body);w.rotation.z=Math.PI/2;wheels.push(w)}}
const trackLinks=createTracks(body,geo.box,mat(0x252b29));
const turret=new T.Group();turret.position.set(0,1.75,-.25);body.add(turret);const cup=mesh('cyl',c,0,.08,0,1.35,.7,1.2,turret);cup.rotation.y=Math.PI/8;mesh('box',c,0,.38,-.08,1.8,.4,1.75,turret);mesh('cyl',0x454f3f,-.55,.7,-.3,.4,.15,.4,turret);mesh('cyl',0x202b22,.72,1.15,-.7,.025,1.7,.025,turret);mesh('box',team?0xb15f4b:0xd3e48b,0,.45,.82,.65,.14,.04,turret);
const gun=new T.Group();gun.position.set(0,.18,.9);turret.add(gun);mesh('box',c,0,0,.15,.7,.6,.6,gun);const barrel=mesh('cyl',c,0,0,1.65,.13,3.1,.13,gun);barrel.rotation.x=Math.PI/2;mesh('box',0x3a4638,0,0,3.2,.36,.3,.55,gun);mesh('box',0x111713,0,0,3.49,.18,.14,.02,gun);for(let i=0;i<3;i++)mesh('box',0x4b5343,-.8+i*.8,1.72,-1.55,.55,.15,.7,body);root.scale.setScalar(d.scale);const extra=detailTank({root,body,turret,gun},type,team,team?'factory':save.loadout.paint,mesh);modelGear(turret,body,gun,team);if(team===0&&save.settings.garland!==false)tankGarland(body,turret);gun.scale.z=team?1:(WEAPONS[save.loadout.weapon]||WEAPONS.standard).length;for(const assembly of [body,turret,gun,extra.details,extra.mgMount])batchRigid(assembly,wheels);return{root,body,turret,gun,wheels,trackLinks,trackPhase:0,...extra}}
let seed=7;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function terrain(x,z){return .5*Math.sin(x*.035)*Math.cos(z*.043)+.18*Math.sin(z*.09)}
function clearWorld(){for(const t of tanks)t.marker?.remove?.();world.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();if(o.userData.ownedMaterial){o.material.map?.dispose();o.material.dispose()}});world.clear();tanks=[];obstacles=[];shots=[];particles=[]}

// Enhanced procedural environments and a modeled industrial hangar.
// Low-poly silhouettes + repeated structural detail: scalable on mobile.
function environmentDetail(idx,garageMode=false){
 const low=save.settings.quality==='low',step=low?2:1;
 const beam=(x,y,z,sx,sy,sz,c=0x53616a)=>mesh('box',c,x,y,z,sx,sy,sz);
 if(garageMode){
  scene.background.set(0x687887);scene.fog.color.set(0x687887);
  beam(0,-.32,0,40,.5,48,0x66737b);
  for(let k=-4;k<=4;k++){beam(k*4,.02,0,.12,.03,43,0x7b7e75);beam(0,.03,k*5,38,.03,.12,0x73796f)}
  for(const side of [-1,1]){beam(side*18,7,0,.6,14,48,0x49545d);
   for(let z=-20;z<=20;z+=10){beam(side*17.4,7,z,.8,13,.8,0x6e7780);
    beam(side*16,10,z,1.5,.12,2.4,0xd8bd6e)}
  }
  beam(0,14,0,38,1.1,48,0x5b6974);
  for(let z=-20;z<=20;z+=10){beam(0,12.8,z,37,.55,.7,0x6e7b85);for(let x=-12;x<=12;x+=12)beam(x,12.4,z,7,.16,2.3,0xe2dfb4)}
  beam(0,7,-23,37,14,.6,0x424c53);
  for(let x=-14;x<=14;x+=4)beam(x,7,-22.6,.18,12,.2,0x78818a);
  for(let x of [-12,12])for(let z of [-12,10]){beam(x,1.4,z,2,2.8,3,0x6b5844);beam(x,2.9,z,2.3,.12,3.3,0xaaa079)}
  for(let z=-16;z<=16;z+=8){beam(-15,1,z,2,2,2,0x7c654a);beam(15,1,z,2,2,2,0x7c654a)}
  return;
 }
 if(idx===6){ // LUNA-9: fortified lunar research complex, distant craters and industrial infrastructure.
  scene.fog.density=.00115;
  const steel=0x788da2,bright=0xd8e3e9,dark=0x293847,blue=0x1d5a86,orange=0xe9a75b;
  const box=(x,y,z,w,h,d,c=steel)=>beam(x,y,z,w,h,d,c);
  const cylinder=(x,y,z,r,h,c=steel)=>mesh('cyl',c,x,y,z,r,h,r);
  // Moon surface: crater rims made of separated rocks; keep the three combat lanes open.
  for(let i=0;i<34/step;i++){
   const x=(rand()-.5)*335,z=(rand()-.5)*335;
   if(Math.abs(x)<35||Math.abs(z)<35||Math.hypot(x,z)<65)continue;
   const radius=4+rand()*10;
   mesh('sphere',0x52606c,x,.03,z,radius*.86,.12,radius*.86);
   for(let j=0;j<9;j++){const angle=j*Math.PI*2/9,rr=radius*(.87+rand()*.24);
    const stone=mesh('sphere',j%2?0x8a929b:0x667482,x+Math.cos(angle)*rr,.1,z+Math.sin(angle)*rr,1.5+rand()*1.5,.7+rand()*.4,1.5+rand()*1.4);
    stone.rotation.y=angle;
   }
  }
  // Habitats have segmented pressure shells, airlocks, panoramic windows and service struts.
  const habitat=(x,z,scale=1)=>{
   const g=new T.Group();g.position.set(x,terrain(x,z),z);g.scale.setScalar(scale);world.add(g);
   const part=(shape,c,px,py,pz,sx,sy,sz)=>mesh(shape,c,px,py,pz,sx,sy,sz,g);
   part('cyl',dark,0,.7,0,7,1.4,7);
   part('sphere',bright,0,4,0,7,4.5,7);
   part('cyl',steel,0,1.4,0,7.25,.6,7.25);
   part('cyl',dark,0,7.35,0,2.3,.5,2.3);
   for(let j=0;j<12;j++){
    const q=j*Math.PI/6,xx=Math.cos(q)*6.65,zz=Math.sin(q)*6.65;
    const rib=part('box',steel,xx,3.5,zz,.45,4.5,.6);rib.rotation.y=-q;
    if(j%2===0){const win=part('box',blue,xx*.89,4.1,zz*.89,1.55,1.25,.24);win.rotation.y=-q;}
   }
   part('box',dark,0,1.9,7,3.7,3.8,2.2);
   part('box',orange,0,2.1,8.17,2.5,2.5,.2);
   part('box',blue,0,2.1,8.3,1.6,1.6,.12);
   for(const side of [-1,1]){
    part('box',dark,side*5.7,.8,5,1.1,1.6,1.1);
    part('box',orange,side*5.7,1.7,5,1.4,.15,1.4);
   }
  };
  habitat(-113,-92,1.1);habitat(115,93,1);habitat(-115,96,.85);habitat(115,-95,.85);
  // Elevated central command platform: recognizable silhouette, far enough from spawn points.
  const cx=62,cz=112;
  cylinder(cx,1.4,cz,13,2.8,dark);
  cylinder(cx,3.1,cz,12,.65,steel);
  for(let i=0;i<12;i++){
   const q=i*Math.PI/6;
   const p=mesh('box',orange,Math.cos(q)*11.8,3.55,Math.sin(q)*11.8,1.9,.22,.48);p.rotation.y=-q;
  }
  cylinder(cx,6.3,cz,7.5,5.6,steel);
  cylinder(cx,9.25,cz,8.2,.7,dark);
  for(let i=0;i<16;i++){const q=i*Math.PI/8;
   const p=mesh('box',i%4===0?orange:blue,Math.cos(q)*7.42,6.8,Math.sin(q)*7.42,2.35,2.3,.2);p.rotation.y=-q;
  }
  cylinder(cx,11.5,cz,2.2,4.5,steel);
  mesh('sphere',0xc4e9f7,cx,14.4,cz,2.1,1.1,2.1);
  // Satellite arrays: many individually framed photovoltaic cells, structural booms and a tracking dish.
  const array=(x,z,rotation=0)=>{
   const g=new T.Group();g.position.set(x,terrain(x,z),z);g.rotation.y=rotation;world.add(g);
   const part=(shape,c,px,py,pz,sx,sy,sz)=>mesh(shape,c,px,py,pz,sx,sy,sz,g);
   for(const side of [-1,1]){
    part('box',steel,side*11,1.7,0,18,.28,.55);
    for(let col=0;col<8;col++)for(let row=0;row<3;row++){
     const px=side*(3+col*2.25),pz=(row-1)*2.1;
     part('box',dark,px,2.05,pz,2.08,.12,1.95);
     part('box',blue,px,2.13,pz,1.84,.04,1.7);
     part('box',0x9dc7e3,px,2.17,pz,.045,.025,1.7);
    }
   }
   part('cyl',dark,0,.8,0,1.2,1.6,1.2);
   part('cyl',steel,0,2.6,0,.32,2.5,.32);
   part('sphere',bright,0,4.2,0,1.2,.42,1.2);
   part('sphere',blue,0,4.65,0,.4,.4,.4);
  };
  array(-104,35,.4);array(104,-35,-.4);array(-40,112,.15);array(40,-112,-.15);
  // Cargo yard, antenna mast and pressurized connecting tubes.
  for(const side of [-1,1]){
   const x=side*83,z=side*116;
   for(let j=0;j<5;j++){
    box(x+(j%3)*4,1.3,z+Math.floor(j/3)*5,3.6,2.5,4.3,j%2?0x8b9ca6:0xb47e51);
    box(x+(j%3)*4,2.65,z+Math.floor(j/3)*5,3.7,.15,4.4,dark);
   }
   box(side*105,2.4,0,4.5,4.8,24,steel);
   for(let j=-2;j<=2;j++)box(side*105,2.5,j*4.2,4.8,.25,.35,dark);
   box(side*105,2.3,12,3.2,2.8,.12,blue);
  }
  box(-135,10,0,.7,20,.7,steel);
  for(let y=3;y<20;y+=3){box(-135,y,0,3.6,.2,.25,dark);box(-135,y,0,.25,.2,3.6,dark)}
  mesh('sphere',orange,-135,21,0,.8,.8,.8);
  for(let i=0;i<4;i++){const q=i*Math.PI/2;const p=mesh('box',bright,-135+Math.cos(q)*2.5,18,Math.sin(q)*2.5,4,.3,.5);p.rotation.y=-q}
  // Distant lander and launchpad, decorative geometry beyond the playable center.
  cylinder(145,.45,-145,15,.9,dark);
  for(let j=0;j<4;j++){const q=j*Math.PI/2;const x=145+Math.cos(q)*7,z=-145+Math.sin(q)*7;
   box(x,2,z,.55,4,.55,steel);mesh('sphere',orange,x,4.3,z,.5,.5,.5)}
  cylinder(145,6,-145,3.4,9,bright);
  mesh('cone',bright,145,12.2,-145,3.5,4.6,3.5);
  for(let j=0;j<4;j++){const q=j*Math.PI/2;box(145+Math.cos(q)*4,3.3,-145+Math.sin(q)*4,1.2,5.8,1.2,steel)}
 }else if(idx===5){ // Lava channels, vents, volcanic caldera.
  scene.fog.density=.004;
  for(let i=0;i<30/step;i++){let x=(rand()-.5)*245,z=(rand()-.5)*245;if(Math.abs(x)<17||Math.abs(z)<17)continue;
   let r=3+rand()*7;const a=mesh('box',0x30272b,x,r*.7,z,r*.8,r*1.5,r*.7);a.rotation.set(rand()*.6,rand()*6.28,rand()*.6);
   const lava=beam(x,.08,z,r*.65,.12,1.1,0xff4d0a);lava.rotation.y=rand()*6;
   if(i%4===0){mesh('cyl',0x4b3032,x,1.3,z,1.3,2.6,1.3);mesh('sphere',0xc16d44,x,3.2,z,1.6,1.3,1.6)}
  }
  for(let i=0;i<8/step;i++){const x=(rand()-.5)*200,z=(rand()-.5)*200;const a=mesh('box',0x241e25,x,8,z,12,16,11);a.rotation.set(rand()*.4,rand()*6.28,rand()*.35);mesh('sphere',0xff6025,x,15.5,z,3,.5,3)}
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
 const [key,fill,exposure]=garageMode?[0xffefd9,0xc1d7eb,1.05]:themes[idx];
 sun.color.set(key);sun.intensity=garageMode?2:3.4;sun.position.set(-65,idx===6?105:75,idx===3?-35:45);
 renderer.toneMappingExposure=exposure;
 scene.children.forEach(o=>{if(o.isHemisphereLight){o.color.set(fill);o.groundColor.set(idx===6?0x12182b:0x3c3b3b);o.intensity=garageMode?1.45:idx===6?1.75:2.4}});
 if(sky?.material?.uniforms){
  sky.material.uniforms.top.value.set(garageMode?0x718caa:[0x4b809a,0xa65c4d,0x639bc6,0x151c44,0x9a6257,0x542630,0x060a16,0x2e5d78][idx]);
  sky.material.uniforms.bottom.value.set(garageMode?0xb2c3ce:[0xc8d2a6,0xf0b57d,0xb4d6e7,0x6e4a86,0xc7a086,0xa74b2e,0x101829,0x8bbab8][idx]);
 }
 const max=mobile?8:save.settings.quality==='low'?12:32;let n=0;
 for(const o of world.children){
  if(n>=max||!o.isMesh||o.isInstancedMesh||o.userData.ownedGeometry)continue;
  if(Math.max(o.scale.x,o.scale.y,o.scale.z)<7)continue;
  if(![geo.box,geo.cone,geo.cyl].includes(o.geometry))continue;
  const edge=new T.LineSegments(new T.EdgesGeometry(o.geometry,30),new T.LineBasicMaterial({color:0x15131d,opacity:.82,transparent:true,depthWrite:false}));
  edge.userData.ownedGeometry=true;edge.userData.ownedMaterial=true;edge.scale.setScalar(1.015);edge.renderOrder=2;o.add(edge);o.userData.comicLandmark=true;n++;
 }
}


// Procedural PBR surface library. High quality uses a real 4096x4096 albedo map;
// low/medium use 512/1024 to protect Android GPU memory and startup time.
function terrainPBR(idx){
 const quality=save.settings.quality;
 const memory=navigator.deviceMemory||2;
 const mobileGPU=matchMedia('(pointer:coarse)').matches;
 const gpuCap=renderer.capabilities.maxTextureSize||2048;
 const target=quality==='high'?(mobileGPU?(memory>=6?1024:512):1024):quality==='medium'?(mobileGPU?512:768):512;
 const size=Math.min(target,gpuCap);
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
 const material=new T.MeshStandardMaterial({color:0xffffff,map,bumpMap:map,bumpScale:idx===2?.05:.115,roughness:idx===7?.78:.96,metalness:idx===3?.14:0});
 const detail=microSurface('stone');material.normalMap=detail.normalMap;material.normalScale=new T.Vector2(idx===2?.12:.3,idx===2?.12:.3);material.roughnessMap=detail.roughnessMap;material.bumpMap=null;addTerrainShader(material);
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

// Small, reusable authored rock microdetail: no downloads or third-party assets.
// One tiling 256px height field serves all cliff and boulder materials.
let stoneBumpTexture=null;const stoneMaterialBank=new Map();
function stoneMaterial(color){
 if(stoneMaterialBank.has(color))return stoneMaterialBank.get(color);
 if(!stoneBumpTexture){
  const size=256,buf=new Uint8Array(size*size*4);
  let rng=0x4a67b92;const rnd=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const fine=rnd()*.28,layer=Math.sin(y*.19+Math.sin(x*.035)*2.1)*.17;
   const fracture=Math.abs(Math.sin(x*.087+y*.063+Math.sin(y*.024)*3))>.985?-.32:0;
   const v=Math.max(0,Math.min(255,Math.floor(150+95*(fine+layer+fracture))));
   const i=(y*size+x)*4;buf[i]=buf[i+1]=buf[i+2]=v;buf[i+3]=255;
  }
  stoneBumpTexture=new T.DataTexture(buf,size,size,T.RGBAFormat);
  stoneBumpTexture.wrapS=stoneBumpTexture.wrapT=T.RepeatWrapping;
  stoneBumpTexture.repeat.set(2,2);stoneBumpTexture.generateMipmaps=true;
  stoneBumpTexture.minFilter=T.LinearMipmapLinearFilter;stoneBumpTexture.magFilter=T.LinearFilter;
  stoneBumpTexture.needsUpdate=true;
 }
 const m=new T.MeshStandardMaterial({color,roughness:.96,metalness:.015,flatShading:true,bumpMap:stoneBumpTexture,bumpScale:.12,...microSurface('stone'),normalScale:new T.Vector2(.35,.35)});
 stoneMaterialBank.set(color,m);return m;
}
const rockGeometryBank=[];
function rockGeometry(variant,low){
 const k=variant*2+(low?0:1);
 if(!rockGeometryBank[k])rockGeometryBank[k]=makeRockGeometry(variant+1,low?0:1);
 return rockGeometryBank[k];
}


// 2026 terrain art pass: fully original meshes (no model downloads or copied game assets).
// Trees use branching trunks and irregular leaf fans, never primitive cones/spheres.
const naturalTreeCache=new Map(),naturalTreeMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.99,side:T.DoubleSide,flatShading:false});
addWind(naturalTreeMat);
function naturalTreeGeometry(kind=0,variant=0){return branchingTree(kind,variant)}
function scatterModeledTrees(count,kind,blocked,rand,terrain){
 const low=save.settings.quality==='low',n=low?Math.ceil(count*.65):count;
 for(let v=0;v<3;v++){
  const part=Math.ceil(n/3),im=new T.InstancedMesh(naturalTreeGeometry(kind,v),naturalTreeMat,part),obj=new T.Object3D();
  for(let i=0;i<part;i++){
   let x=0,z=0;
   for(let attempts=0;attempts<20;attempts++){x=(rand()-.5)*265;z=(rand()-.5)*265;if(!blocked(x,z,3)&&Math.hypot(x,z)>24)break}
   const size=(kind===2?9:12)*(0.65+rand()*.62);
   obj.position.set(x,terrain(x,z)-.05,z);
   obj.rotation.set(0,rand()*6.283,0);obj.scale.set(size,size,size);obj.updateMatrix();im.setMatrixAt(i,obj.matrix);
  }
  im.instanceMatrix.needsUpdate=true;im.castShadow=!low;im.receiveShadow=true;
  im.computeBoundingSphere();im.frustumCulled=true;world.add(im);
 }
}
const roofForm=(()=>{
 const verts=[],faces=[[0,2,1],[3,5,4],[0,3,4],[0,4,2],[1,2,4],[1,4,5],[0,1,5],[0,5,3]];
 const p=[[-.5,0,-.5],[.5,0,-.5],[0,1,-.5],[-.5,0,.5],[0,1,.5],[.5,0,.5]];
 for(const f of faces)for(const id of f)verts.push(...p[id]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();return g;
})();
function gableRoof(x,y,z,w,h,d,color,angle=0){
 const m=new T.Mesh(roofForm,mat(color));m.position.set(x,y+terrain(x,z),z);m.scale.set(w,h,d);m.rotation.y=angle;m.castShadow=true;m.receiveShadow=true;world.add(m);return m;
}
function hazardMaterial(type){
 if(hazardMaterial.cache?.[type])return hazardMaterial.cache[type];
 const water=type==='water';
 const material=new T.ShaderMaterial({
  uniforms:{uTime:{value:0},uWater:{value:water?1:0}},
  vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`precision mediump float;
   varying vec2 vUv; uniform float uTime;uniform float uWater;
   void main(){
    vec2 p=vUv*12.;
    float a=sin(p.x*2.3+sin(p.y*.7+uTime*.36)*1.8+uTime*.7);
    float b=cos(p.y*1.7+p.x*.52-uTime*.45);
    float wave=a*.55+b*.45;
    float crack=smoothstep(.22,.72,wave);
    vec3 lava=mix(vec3(.10,.018,.01),vec3(1.,.19,.025),crack);
    lava+=vec3(.45,.18,.015)*pow(max(wave,0.),5.);
    vec3 water=vec3(.055,.30,.39)+vec3(.08,.16,.17)*(wave*.5+.5);
    vec3 c=mix(lava,water,uWater);
    gl_FragColor=vec4(c,uWater>.5?.86:1.);
   }`,
  transparent:water,side:T.DoubleSide,depthWrite:!water
 });
 hazardMaterial.cache??={};hazardMaterial.cache[type]=material;return material;
}
const hazardGeo=new T.PlaneGeometry(1,1);
function hazardPatch(x,z,w,d,type){const m=new T.Mesh(hazardGeo,hazardMaterial(type));m.rotation.x=-Math.PI/2;m.position.set(x,terrain(x,z)+.055,z);m.scale.set(w,d,1);m.renderOrder=1;world.add(m);return m}
function biomeRubble(idx,low,rand,terrain){
 if(idx===6)return;
 const palette=[0x6c735d,0xa08762,0x9da6a9,0x40425a,0x71645f,0x332d30,0x747b89,0x5a6e72];
 const cnt=low?48:save.settings.quality==='high'?165:95;
 for(let variant=0;variant<3;variant++){
  const n=Math.ceil(cnt/3),geometry=rockGeometry(variant,low),m=new T.InstancedMesh(geometry,stoneMaterial(palette[idx]),n),dummy=new T.Object3D();
  for(let i=0;i<n;i++){
   let x=(rand()-.5)*280,z=(rand()-.5)*280;if(Math.abs(x)<18||Math.abs(z)<18){x+=27;z-=29}
   const r=.35+Math.pow(rand(),2)*2.8;
   dummy.position.set(x,terrain(x,z)+r*.35,z);dummy.rotation.set((rand()-.5)*.6,rand()*6.283,(rand()-.5)*.6);
   dummy.scale.set(r*(.8+rand()*.6),r*(.4+rand()*.6),r*(.7+rand()*.6));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
  }
  m.instanceMatrix.needsUpdate=true;m.castShadow=false;m.receiveShadow=true;world.add(m);
 }
}

function steelBatchStatic(){
 // Batch shared static primitives even inside habitat/solar-array groups.
 world.updateMatrixWorld(true);
 const groups=new Map();
 world.traverse(m=>{
  if(!m.isMesh||m.isInstancedMesh||m.userData.ownedGeometry||m.userData.ownedMaterial||!m.material||m.material.transparent||!Object.values(geo).includes(m.geometry))return;
  const key=m.geometry.uuid+':'+m.material.uuid;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(m);
 });
 for(const list of groups.values()){
  if(list.length<3)continue;
  const batch=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);
  batch.castShadow=false;batch.receiveShadow=true;
  for(let i=0;i<list.length;i++){
   const m=list[i];batch.setMatrixAt(i,m.matrixWorld);
   m.parent.remove(m);
  }
  batch.instanceMatrix.needsUpdate=true;
  batch.computeBoundingSphere();world.add(batch);
 }
}
function buildMap(idx,garage=false){const quality=save.settings.quality;try{if(mode==='net')save.settings.quality='medium';steelBuildMap(idx,garage);steelBatchStatic()}finally{save.settings.quality=quality}}
function steelBuildMap(idx,garage=false){
 clearWorld();seed=9281+idx*701;scene.fog.density=.0025;
 const palettes=[
 [0x637c4a,0xa4c3bd,0x526c45],[0xbba06d,0xe1bd8c,0x80664b],
 [0xc6d7df,0xa2bfd7,0x8195a3],[0x25283f,0x171d38,0x393354],
 [0x7e6555,0xb08b6e,0x61504b],[0x332a2c,0x692d25,0x4d3330],
 [0x8d929d,0x080d20,0x5b6171],[0x526d6c,0x8cb4bc,0x40585b]];
 const [groundColor,sky,stone]=palettes[idx]||palettes[0];
 scene.background.set(sky);scene.fog.color.set(sky);
 if(idx===6)scene.fog.density=.0015;
 const terrainSegments=save.settings.quality==='high'?72:save.settings.quality==='low'?32:48;
 const groundGeo=new T.PlaneGeometry(400,400,terrainSegments,terrainSegments);groundGeo.rotateX(-Math.PI/2);
 const ps=groundGeo.attributes.position;
 for(let i=0;i<ps.count;i++){const x=ps.getX(i),z=ps.getZ(i);let y=terrain(x,z)-.12;

  ps.setY(i,y);
 }
 groundGeo.computeVertexNormals();
 const ground=new T.Mesh(groundGeo,terrainPBR(idx));
 ground.receiveShadow=true;ground.userData.ownedGeometry=true;ground.userData.ownedMaterial=true;world.add(ground);
 if(garage){mesh('cyl',0x81938e,0,-.15,0,6,.3,6);environmentDetail(0,true);winterHangar(world,mesh);applyComicArt(0,true);return}
 buildTacticalArena(idx,groundColor,stone);
}

function buildTacticalArena(idx,groundColor,stone){
 const plan=battlefieldPlan(idx);
 for(const o of plan.covers){
  const root=new T.Group();root.position.set(o.x,terrain(o.x,o.z),o.z);root.rotation.y=o.angle;world.add(root);
  const color=idx===2?0x89999e:stone;
  const base=mesh('box',color,0,o.h/2,0,o.w,o.h,o.d,root);base.material=stoneMaterial(color);
  if(o.kind===0){mesh('box',0x4d5652,0,o.h+.2,0,o.w+.8,.4,o.d+.8,root);for(const side of [-1,1])mesh('box',0x182323,side*2,o.h*.75,3.52,1.3,.45,.05,root)}
  if(o.kind===1){for(let k=0;k<4;k++)mesh('box',color,-3+k*2,o.h+.7,0,.6,1.4,o.d,root)}
  if(o.kind===2){mesh('box',0x56616a,0,o.h+.3,0,o.w,.55,o.d,root);for(let k=-3;k<=3;k++)mesh('box',0x6b7880,k,o.h*.5,3.6,.09,o.h,.08,root)}
  batchRigid(root);obstacles.push({...o});
 }
 // Three routes plus a transverse connection, wide enough for heavy tanks.
 for(const x of plan.lanes){const g=new T.PlaneGeometry(18,290,1,48);g.rotateX(-Math.PI/2);g.translate(x,0,0);const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,terrain(a.getX(i),a.getZ(i))-.05);g.computeVertexNormals();const road=new T.Mesh(g,mat(idx===2?0xa0b1b4:0x746d5c));road.userData.ownedGeometry=true;world.add(road)}
 const avoid=(x,z,r)=>clearLane(x,z,r)||obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r+4);
 const oldSeed=seed;seed=3001+idx*97;
 if([0,2,7].includes(idx))scatterModeledTrees(save.settings.quality==='low'?18:36,idx===2?1:2,avoid,rand,terrain);
 for(let i=0;i<24;i++){const a=i*Math.PI/12,x=Math.sin(a)*175,z=Math.cos(a)*175;const rock=new T.Mesh(rockGeometry(i%3,true),stoneMaterial(stone));rock.scale.set(12,10+(i%4)*5,13);rock.position.set(x,5,z);world.add(rock)}
 seed=oldSeed;
 if(idx===6){environmentDetail(idx,false);buildLunarInteriors()}
 applyComicArt(idx,false);
}
// Walkable lunar tunnels and rooms: roofs are raised, both ends open and side walls are collidable.
function buildLunarInteriors(){
 const low=save.settings.quality==='low';
 const hull=0x718394,trim=0xc3d0d7,inside=0x293947,light=0xf3c17a,glass=0x3d8eb3;
 const block=(x,y,z,w,h,d,c=hull)=>mesh('box',c,x,y,z,w,h,d);
 // Collision is approximated by small circles, matching the existing tank collision engine.
 const barrier=(x,z,r=1.8)=>obstacles.push({x,z,r,h:4,w:r*2,d:r*2,angle:0,kind:0});
 const wallZ=(x,z,length,thick=1.1,height=5)=>{
  block(x,terrain(x,z)+height/2,z,thick,height,length);
  for(let dz=-length/2+1;dz<=length/2-1;dz+=3.2)barrier(x,z+dz,thick*.7);
 };
 const wallX=(x,z,length,thick=1.1,height=5)=>{
  block(x,terrain(x,z)+height/2,z,length,height,thick);
  for(let dx=-length/2+1;dx<=length/2-1;dx+=3.2)barrier(x+dx,z,thick*.7);
 };
 const corridor=(x,z,length)=>{
  // The passage runs north-south, wide enough for tanks and open at both ends.
  const width=15;
  block(x,terrain(x,z)-.06,z,width,.22,length,inside);
  wallZ(x-width/2,z,length);
  wallZ(x+width/2,z,length);
  block(x,terrain(x,z)+6.3,z,width+2,1.1,length,trim);
  for(let dz=-length/2+4;dz<length/2;dz+=9){
   const yy=terrain(x,z+dz);
   for(const side of [-1,1]){
    block(x+side*(width/2-.35),yy+4.4,z+dz,.35,.5,1.5,light);
    block(x+side*(width/2+.55),yy+.3,z+dz,.8,.6,1.2,inside);
   }
   block(x,yy+5.72,z+dz,4,.14,1.4,glass);
  }
  // Highly visible entrance frames and yellow hazard stripes.
  for(const end of [-1,1]){
   const ez=z+end*length/2,ey=terrain(x,ez);
   for(const side of [-1,1]){
    block(x+side*(width/2+.5),ey+3.3,ez,1.6,6.6,1.5,trim);
    block(x+side*(width/2+.5),ey+.4,ez+end*1.1,1.8,.3,1.3,light);
   }
   block(x,ey+6.7,ez,width+3,1.2,1.7,trim);
   block(x,ey+6.7,ez+end*.95,5,.4,.3,light);
  }
 };
 const room=(x,z)=>{
  // Square maintenance hall with a wide entrance on each of its north/south walls.
  const w=30,d=28,door=15;
  block(x,terrain(x,z)-.08,z,w,.25,d,inside);
  for(const side of [-1,1]){
   wallZ(x+side*w/2,z,d,1.2,7);
   for(const half of [-1,1]){
    const segment=(w-door)/2;
    const xx=x+half*(door/2+segment/2);
    wallX(xx,z+side*d/2,segment,1.2,7);
   }
   block(x,terrain(x,z)+7.5,z+side*d/2,door+2,1.1,1.5,trim);
  }
  // Roof beams rather than a solid roof: tanks remain visible from the game camera.
  for(let dz=-9;dz<=9;dz+=9){
   block(x,terrain(x,z)+8.2,z+dz,w+2,.75,1.25,trim);
   block(x,terrain(x,z)+8.8,z+dz,5,.3,1.3,light);
  }
  for(const side of [-1,1]){
   const px=x+side*11;
   for(let j=-1;j<=1;j++){
    const zz=z+j*7;
    block(px,terrain(px,zz)+1,zz,2.6,2,3.3,j===0?glass:hull);
    block(px,terrain(px,zz)+2.15,zz,2.8,.25,3.5,trim);
   }
   block(x+side*12,terrain(x,z)+5.4,z,2.5,1.5,9,glass);
  }
  block(x,terrain(x,z)+.2,z,4,.12,7,0xc9a34d);
  for(const dz of [-9,9])block(x,terrain(x,z)+.2,z+dz,8,.12,.45,light);
 };
 // Two symmetrical, connected routes; leave the central arena and spawns unobstructed.
 for(const x of [-76,76]){
  corridor(x,-46,36);
  room(x,0);
  corridor(x,46,36);
  // Side equipment outside the traversable passage.
  for(const z of [-44,44]){
   const px=x+(x<0?-13:13);
   block(px,terrain(px,z)+2.3,z,4,4.6,7,inside);
   block(px,terrain(px,z)+4.8,z,4.5,.5,7,trim);
   block(px,terrain(px,z)+2.7,z+(z<0?-3.55:3.55),3.2,2.6,.15,glass);
  }
 }
}
const occludedMaterial=new T.LineBasicMaterial({color:0xff775e,transparent:true,opacity:.65,depthTest:true,depthWrite:false,depthFunc:T.GreaterDepth});
function addEnemyOverlay(t){
 t.outlines=[];
 for(const assembly of [t.body,t.turret,t.gun])for(const m of [...assembly.children].filter(m=>m.isMesh&&!m.isInstancedMesh&&!t.wheels.includes(m)).sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count).slice(0,2)){if(m.geometry.attributes.position.count<30)continue;const edge=new T.LineSegments(new T.EdgesGeometry(m.geometry,35),occludedMaterial);edge.userData.ownedGeometry=true;edge.renderOrder=80;edge.visible=false;m.add(edge);t.outlines.push(edge)}
 const label=document.createElement('div');label.className='tankMarker';label.hidden=true;$('hud').appendChild?.(label);t.marker=label;
}
const markerPoint=new T.Vector3();
function updateEnemyOverlays(){
 for(const t of tanks){if(t.isPlayer||!t.marker)continue;const enemy=t.team!==player.team,range=Math.hypot(t.x-player.x,t.z-player.z),active=!t.dead&&range<140;
 const obscured=active&&enemy&&!lineClear(player,t);for(const e of t.outlines)e.visible=obscured;
 markerPoint.set(t.x,terrain(t.x,t.z)+4.5,t.z).project(camera);
 t.marker.hidden=!active||markerPoint.z>1||markerPoint.z<0||Math.abs(markerPoint.x)>1||Math.abs(markerPoint.y)>1;
 if(!t.marker.hidden){t.marker.style.left=(markerPoint.x*.5+.5)*100+'%';t.marker.style.top=(-markerPoint.y*.5+.5)*100+'%';t.marker.style.color=enemy?'#ff9b80':'#b9e784';t.marker.textContent=(enemy?'▼ ':'◆ ')+TYPES[t.type].name+' · '+Math.ceil(t.hp)}
 }
}

function makeTank(type,team,x,z,isPlayer=false){const visual=model(type,isPlayer?0:team+1),u=isPlayer?(save.upgrades[type]||[0,0,0]):[0,0,0],d=TYPES[type];const t={...visual,type,team,isPlayer,x,z,yaw:team?Math.PI:0,turretYaw:team?Math.PI:0,pitch:0,hp:d.hp*(1+.12*u[0]),maxHp:d.hp*(1+.12*u[0]),armor:d.armor*(1+.12*u[0]),maxSpeed:d.speed*(1+.08*u[1]),damage:d.damage*(1+.12*u[2]),reload:d.reload,speed:0,cool:1,dead:false,track:0,engine:0,ammo:0,rounds:[50,15,12,8,6],mg:createMG(),repairs:1,usedSupplies:[],inputX:0,inputY:0,think:rand(),target:null,steer:0,throttle:0};applyWeapon(t,isPlayer?save.loadout.weapon:'standard');if(isPlayer){const used=consumeLoadout(save);t.usedSupplies=used;t.repairs=1+(used.includes('repairKit')?1:0);if(used.includes('ammoCrate')){t.rounds=[70,23,18,12,10];t.mg=createMG(120)}if(used.includes('overdrive'))t.maxSpeed*=1.12;if(save.loadout.equipment.includes('ammoPouch')){t.rounds[3]+=8;t.rounds[4]+=6}if(used.includes('supercharge'))t.damage*=1.08;if(used.includes('rationPack'))t.reload*=.92;if(save.loadout.equipment.includes('rammer'))t.reload*=.85;if(save.loadout.equipment.includes('autoloader'))t.reload*=.9;persist()}t.root.position.set(x,terrain(x,z),z);world.add(t.root);tanks.push(t);if(!isPlayer)addEnemyOverlay(t);return t}

let tourYaw=.65,tourPitch=.38,tourDistance=95,tourCenter=new T.Vector3(0,3,0),tourPointer=null;
function tourUI(){
 let panel=$('tourPanel');
 if(!panel){panel=document.createElement('div');panel.id='tourPanel';panel.style.cssText='position:fixed;z-index:110;top:12px;left:12px;right:12px;display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;pointer-events:none';document.body.appendChild(panel)}
 panel.hidden=false;
 panel.innerHTML='<div style="pointer-events:auto;background:#101923e8;color:white;border:1px solid #8194a4;border-radius:12px;padding:9px;display:flex;gap:7px;align-items:center;flex-wrap:wrap;font:600 13px system-ui"><b id="tourName" style="padding:0 9px"></b><button id="tourPrev">◀ Карта</button><button id="tourNext">Карта ▶</button><button id="tourCloser">＋</button><button id="tourFarther">－</button><button id="tourExit">✕ Назад</button><small style="opacity:.8">Тяни экран — осмотр · колёсико — масштаб</small></div>';
 const label=()=>$('tourName').textContent=MAP_NAMES[mapIndex]+' · '+(mapIndex+1)+'/8';
 label();
 $('tourPrev').onclick=()=>switchTourMap(-1);$('tourNext').onclick=()=>switchTourMap(1);
 $('tourCloser').onclick=()=>tourDistance=clamp(tourDistance*.8,12,220);
 $('tourFarther').onclick=()=>tourDistance=clamp(tourDistance*1.25,12,220);
 $('tourExit').onclick=()=>{panel.hidden=true;garage()};
}
function switchTourMap(dir){
 mapIndex=(mapIndex+dir+MAP_NAMES.length)%MAP_NAMES.length;
 buildMap(mapIndex);tourCenter.set(0,4,0);tourDistance=95;player=null;
 $('tourName').textContent=MAP_NAMES[mapIndex]+' · '+(mapIndex+1)+'/8';
}
function startTour(){
 state='tour';$('garage').hidden=true;$('hud').hidden=true;$('overlay').hidden=true;
 mapIndex=$('map').selectedIndex;player=null;preview=null;
 tourYaw=.65;tourPitch=.38;tourDistance=95;tourCenter.set(0,4,0);
 buildMap(mapIndex);tourUI();
}
function installTourButton(){$('tourStart').onclick=startTour}
function garage(){window.STEEL_NET?.close();const netHud=$('p2pHud');if(netHud)netHud.hidden=true;state='garage';$('garage').hidden=false;$('hud').hidden=true;$('overlay').hidden=true;zoom=0;buildMap(0,true);preview=model(selected);world.add(preview.root);garageUI();installTourButton()}
function garageUI(){$('credits').textContent=save.credits.toLocaleString('ru');$('stats').textContent=`БОЁВ ${save.stats.battles} / ПОБЕД ${save.stats.wins} / УНИЧТОЖЕНО ${save.stats.kills}`;$('rankPanel').innerHTML=rankMarkup();$('tankCards').innerHTML=TYPES.map((d,i)=>`<button class="tankCard ${i===selected?'active':''}" data-tank="${i}">${d.name}<small>${save.owned.includes(i)?d.class:'◈ '+d.price}</small></button>`).join('');document.querySelectorAll('[data-tank]').forEach(b=>b.onclick=()=>{selected=+b.dataset.tank;world.remove(preview.root);preview.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose()});preview=model(selected);world.add(preview.root);garageUI();sound('ui')});const d=TYPES[selected],u=save.upgrades[selected]||[0,0,0];$('spec').innerHTML=`<div class="eyebrow">${d.class}</div><h2>${d.name}</h2>${[['Прочность',Math.round(d.hp*(1+.12*u[0])),2500],['Броня',Math.round(d.armor*(1+.12*u[0])),250],['Скорость',Math.round(d.speed*3.6*(1+.08*u[1])),90],['Урон',Math.round(d.damage*(1+.12*u[2])),650]].map(([n,v,m])=>`<div class="stat">${n}<b>${v}</b><div class="bar"><i style="width:${v/m*100}%"></i></div></div>`).join('')}${save.owned.includes(selected)?`<div id="upgrades">${['Броня','Мотор','Орудие'].map((n,i)=>`<button data-up="${i}">${n} ${u[i]}/3<br>${u[i]<3?'◈ '+(300+u[i]*300):'MAX'}</button>`).join('')}</div>`:`<button id="buy" class="primary">Купить · ${d.price} ◈</button>`}`;$('spec').insertAdjacentHTML?.('beforeend','<button id="garlandToggle" class="winterGift">'+(save.settings.garland===false?'🎁 Надеть гирлянду · бесплатно':'✨ Гирлянда надета · снять')+'</button>');$('garlandToggle').onclick=()=>{save.settings.garland=save.settings.garland===false;persist();garage()};if($('buy'))$('buy').onclick=()=>{if(save.credits<d.price)return notify('Недостаточно кредитов');save.credits-=d.price;save.owned.push(selected);persist();garageUI()};document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{let i=+b.dataset.up,cost=300+u[i]*300;if(u[i]>=3)return;if(save.credits<cost)return notify('Недостаточно кредитов');save.credits-=cost;u[i]++;save.upgrades[selected]=u;persist();garageUI()});$('start').disabled=!save.owned.includes(selected);contractUI()}
function startBattle(){const netHud=$('p2pHud');if(netHud)netHud.hidden=true;initAudio();state='loading';$('garage').hidden=true;$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><div class="eyebrow">ПОДГОТОВКА ОПЕРАЦИИ</div><h2>Загрузка боевой зоны…</h2></div>';setTimeout(()=>{mapIndex=$('map').selectedIndex;mode=$('mode').value;buildMap(mapIndex);player=makeTank(selected,0,0,-90,true);if(mode==='team')for(let i=0;i<3;i++)makeTank(i,0,(i-1)*12,-80);wave=1;kills=0;earned=0;elapsed=0;repairUsed=false;aimYaw=0;aimPitch=.04;viewYaw=0;viewPitch=.04;resetInput();zoom=0;autoLock=false;if(mode==='flag'){makeTank(0,1,0,80);initFlag()}else if(mode==='duel')makeTank(selected,1,0,80);else spawnWave();ammoService=0;battleDamage=0;damageService=0;smokeCharges=save.loadout.equipment.includes('smokeGrenades')?2:0;smokeUntil=0;ensureSmokeButton();state='battle';$('overlay').hidden=true;$('hud').hidden=false;$('scope').hidden=true;$('tankName').textContent=TYPES[selected].name;$('repair').disabled=false;notify(mode==='flag'?'ЗАХВАТИ ФЛАГ И УДЕРЖИ ЕГО 45 СЕКУНД':'ОПЕРАЦИЯ НАЧАЛАСЬ · Уничтожь противника');if(mobile){document.documentElement.requestFullscreen?.().catch(()=>{});screen.orientation?.lock?.('landscape').catch(()=>{})}},80)}
function spawnWave(){for(let i=0;i<3;i++){let x=(i-1)*25,z=55+rand()*45;for(let n=0;n<250&&(blocked(x,z,3)||tanks.some(t=>!t.dead&&Math.hypot(x-t.x,z-t.z)<7));n++){x=(rand()-.5)*240;z=40+rand()*90}makeTank(Math.min(4,Math.floor((i+wave-1)/3)),1,x,z)}notify('ВОЛНА '+wave)}
let noteTimer;function notify(s){$('notice').textContent=s;clearTimeout(noteTimer);noteTimer=setTimeout(()=>$('notice').textContent='',3000);if(state==='garage'){const old=$('stats').textContent;$('stats').textContent=s;setTimeout(()=>{$('stats').textContent=old},2400)}}
let audio,engineOsc,engineGain,musicTime=0;function initAudio(){if(audio){audio.resume();return}audio=new(window.AudioContext||window.webkitAudioContext)();engineOsc=audio.createOscillator();engineOsc.type='sawtooth';engineGain=audio.createGain();engineGain.gain.value=0;engineOsc.connect(engineGain).connect(audio.destination);engineOsc.start()}
function sound(kind){if(!audio||!save.settings.sound)return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g).connect(audio.destination);const t=audio.currentTime;const settings={mg:[170,55,.09,.1],shot:[110,22,.35,.28],boom:[65,15,.65,.35],hit:[280,55,.13,.18],ui:[700,1000,.06,.03],music:[110,110,.8,.018]}[kind];o.type=kind==='ui'||kind==='music'?'sine':'sawtooth';o.frequency.setValueAtTime(settings[0],t);o.frequency.exponentialRampToValueAtTime(settings[1],t+settings[2]);g.gain.setValueAtTime(settings[3],t);g.gain.exponentialRampToValueAtTime(.001,t+settings[2]);o.start();o.stop(t+settings[2]);o.onended=()=>{o.disconnect();g.disconnect()}}
function effect(pos,kind,count=12){const max=mobile?48:save.settings.quality==='low'?80:140;for(let i=0;i<count&&particles.length<max;i++){const smoke=kind==='smoke',m=softParticle(smoke?0x5a5c52:kind==='spark'?0xffe98a:kind==='blast'?(i%3===0?0xfff3a0:i%3===1?0xffa62e:0x402b28):i%2?0xff9f31:0x533e2a);m.position.copy(pos);m.scale.setScalar(kind==='blast'?.6:.3);world.add(m);const life=smoke?2:kind==='blast'?.25+Math.random()*.4:.35+Math.random()*.7;particles.push({m,v:new T.Vector3((Math.random()-.5)*8,Math.random()*7,(Math.random()-.5)*8),life,max:life,smoke})}}
const shellGeometry=new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.07,0),new T.Vector2(.085,.06),new T.Vector2(.085,.36),new T.Vector2(.06,.5),new T.Vector2(0,.64)],12);shellGeometry.rotateX(Math.PI/2);
const shellMaterial=new T.MeshStandardMaterial({color:0xbda472,metalness:.7,roughness:.3,emissive:0x5d2406,emissiveIntensity:.5});
function shellExplosion(p){effect(p,'blast',mobile?8:14);effect(p,'smoke',mobile?3:5);sound('hit')}
function fire(t){if(t.dead||t.cool>0||t.rounds[t.ammo]<=0)return false;t.cool=t.reload;t.rounds[t.ammo]--;if(t.isPlayer)ammoService+=AMMO_PRICES[t.ammo];const dir=new T.Vector3(Math.sin(t.turretYaw)*Math.cos(t.pitch),Math.sin(t.pitch),Math.cos(t.turretYaw)*Math.cos(t.pitch));if(!t.isPlayer&&smokeUntil>gameTime&&Math.hypot(player.x-smokeOrigin.x,player.z-smokeOrigin.z)<18){dir.x+=(Math.random()-.5)*.34;dir.y+=(Math.random()-.5)*.19;dir.z+=(Math.random()-.5)*.34;dir.normalize()}t.root.position.set(t.x,terrain(t.x,t.z),t.z);t.body.rotation.y=t.yaw;t.turret.rotation.y=angle(t.turretYaw-t.yaw);t.gun.rotation.x=-t.pitch;t.root.updateMatrixWorld(true);const p=t.gun.localToWorld(new T.Vector3(0,0,3.52));const m=new T.Mesh(shellGeometry,shellMaterial);m.position.copy(p);world.add(m);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);shots.push({m,p,prev:p.clone(),v:dir.multiplyScalar(t.shellVelocity||105),owner:t,life:3,ammo:t.ammo});effect(p,'spark',8);if(t.isPlayer&&mode==='net')window.STEEL_NET?.fire('cannon',t.ammo);if(t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<55)sound('shot');t.gun.position.z=.65;return true}
function segmentDistance(a,b,p){const ab=b.clone().sub(a),f=clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return a.clone().addScaledVector(ab,f).distanceTo(p)}
function impact(s,t){if(s.kind==='mg'){impactMG(s,t);return}const d=s.owner,front=Math.abs(Math.cos(Math.atan2(s.v.x,s.v.z)-t.yaw)),armor=t.armor*(.55+front*.45),pen=AMMO_PEN[s.ammo]*(d.penMultiplier||1)*(d.isPlayer&&save.loadout.equipment.includes('longBarrel')?1.12:1),ricochet=(s.ammo===0||s.ammo===1)&&front<.22&&Math.random()<.5;
 let damage=ricochet?0:d.damage*AMMO_MULT[s.ammo]*(pen>=armor?1:s.ammo===2||s.ammo===4?.4:.25);
 if(t.isPlayer&&save.loadout.equipment.includes('spallLiner')&&(s.ammo===2||s.ammo===4))damage*=.8;
 if(d.isPlayer)battleDamage+=actualDamage(t.hp,damage);
 if(!(d.isPlayer&&mode==='net'&&t.netId))t.hp-=damage;if(d.isPlayer&&mode==='net'&&t.netId&&damage>0)window.STEEL_NET?.hit(t.netId,damage);if(d.isPlayer){$('hit').textContent=ricochet?'РИКОШЕТ':`${Math.round(damage)} · ${pen>=armor?'ПРОБИТИЕ':'БРОНЯ'}`;setTimeout(()=>$('hit').textContent='',1200)}effect(s.p,'blast',mobile?9:16);effect(s.p,'smoke',mobile?3:5);sound('hit');if(damage>0&&Math.random()<(t.isPlayer&&save.loadout.equipment.includes('wetRack')?.1:.25)){if(Math.random()<.5)t.track=t.isPlayer&&save.loadout.equipment.includes('heavyTracks')?2:4;else t.engine=8;if(t.isPlayer)notify('МОДУЛЬ ПОВРЕЖДЁН · Используй ремонт')}if(t.hp<=0)destroyTank(t,d)}
function blocked(x,z,r=2.5){return Math.abs(x)>145||Math.abs(z)>145||obstacles.some(o=>{const dx=x-o.x,dz=z-o.z,radius=o.r+r;return dx*dx+dz*dz<radius*radius})}
function lineClear(a,b){for(const o of obstacles){const dx=b.x-a.x,dz=b.z-a.z,f=clamp(((o.x-a.x)*dx+(o.z-a.z)*dz)/(dx*dx+dz*dz),0,1);if(Math.hypot(a.x+dx*f-o.x,a.z+dz*f-o.z)<o.r)return false}return true}
function ai(t,dt){t.think-=dt;if(t.think<=0){t.think=.18+rand()*.18;t.target=tanks.filter(o=>!o.dead&&o.team!==t.team).sort((a,b)=>Math.hypot(t.x-a.x,t.z-a.z)-Math.hypot(t.x-b.x,t.z-b.z))[0]}const q=t.target;if(!q||q.dead){t.throttle=0;return}const dx=q.x-t.x,dz=q.z-t.z,dist=Math.hypot(dx,dz),desired=Math.atan2(dx,dz);t.turretYaw+=clamp(angle(desired-t.turretYaw),-dt*.8,dt*.8);t.pitch=Math.atan2(terrain(q.x,q.z)-terrain(t.x,t.z),dist)+.002;const visible=lineClear(t,q);let heading=desired,retreat=t.hp<t.maxHp*.27;if(mode==='flag'){if(flagCarrier===t)heading=desired+Math.PI;else{const fx=flagCarrier?.x??0,fz=flagCarrier?.z??0;heading=Math.atan2(fx-t.x,fz-t.z)}retreat=false;}if(retreat){let cover=obstacles.reduce((best,o)=>!best||Math.hypot(o.x-t.x,o.z-t.z)<Math.hypot(best.x-t.x,best.z-t.z)?o:best,null);if(cover){const vx=cover.x-q.x,vz=cover.z-q.z,l=Math.hypot(vx,vz);heading=Math.atan2(cover.x+vx/l*(cover.r+7)-t.x,cover.z+vz/l*(cover.r+7)-t.z)}else heading+=Math.PI}let avoid=0;for(const o of obstacles){const ox=o.x-t.x,oz=o.z-t.z,od=Math.hypot(ox,oz),diff=angle(Math.atan2(ox,oz)-t.yaw);if(od<o.r+12&&Math.abs(diff)<1.1)avoid+=diff>0?-1.7:1.7}heading+=avoid;t.steer=clamp(angle(heading-t.yaw)*1.8,-1,1);t.throttle=mode==='flag'||retreat||dist>42||!visible? .75:.12;if(Math.abs(angle(heading-t.yaw))>1.1)t.throttle=.16;if(visible&&dist<125&&Math.abs(angle(desired-t.turretYaw))<.055&&t.cool<=0){t.pitch+=(rand()-.5)*.014;fire(t)}}
const keys={},joy={x:0,y:0},pointers=new Map();let fireHeld=false,mgHeld=false,drag,joyPointer=null;const cameraPointers=new Map();let viewYaw=0,viewPitch=.04;
function updateTank(t,dt){if(mode==='net'&&t.netId&&!t.isPlayer){const s=t.netTarget;if(s){const k=1-Math.exp(-dt*13);t.x+=(s.x-t.x)*k;t.z+=(s.z-t.z)*k;t.yaw+=angle(s.yaw-t.yaw)*k;t.turretYaw+=angle(s.turretYaw-t.turretYaw)*k;t.pitch+=(s.pitch-t.pitch)*k;t.speed=s.speed;t.steer=s.steer||0;t.hp=s.hp;if(s.dead&&!t.dead)destroyTank(t,{isPlayer:false})}t.root.position.set(t.x,terrain(t.x,t.z),t.z);t.body.rotation.y=t.yaw;t.turret.rotation.y=angle(t.turretYaw-t.yaw);t.gun.rotation.x=-t.pitch;t.wheels.forEach(w=>w.rotation.x+=t.speed*dt*1.5);t.trackTick=(t.trackTick||0)+dt;if(t.trackTick>=1/18){animateTracks(t,t.trackTick);t.trackTick=0}tickMG(t.mg,dt);t.gun.position.z=lerp(t.gun.position.z,.9,1-Math.exp(-dt*14));t.details.visible=Math.hypot(t.x-player.x,t.z-player.z)<55;return}tickMG(t.mg,dt);t.mgMount.rotation.x=-t.pitch;t.cool=Math.max(0,t.cool-dt);t.track=Math.max(0,t.track-dt);t.engine=Math.max(0,t.engine-dt);t.gun.position.z=lerp(t.gun.position.z,.9,1-Math.exp(-dt*14));if(t.dead){if(Math.random()<dt*1.5){effect(new T.Vector3(t.x,2,t.z),'smoke',1)};return}if(t.isPlayer){const steerSign=save.settings.invertJoystick?-1:1,rawX=clamp((keys.KeyA?-1:0)+(keys.KeyD?1:0)+joy.x*steerSign,-1,1),rawY=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)-joy.y*(save.settings.invertJoystickY?-1:1),-1,1);t.inputX=damp(t.inputX,rawX,12,dt);t.inputY=damp(t.inputY,rawY,rawY===0?14:7,dt);t.throttle=t.inputY;t.steer=t.inputX;if(autoLock||save.settings.assist){const target=tanks.filter(q=>q.team!==t.team&&!q.dead&&Math.hypot(q.x-t.x,q.z-t.z)<(save.loadout.equipment.includes('optics')?240:180)&&lineClear(t,q)).map(q=>({q,a:Math.atan2(q.x-t.x,q.z-t.z)})).filter(o=>Math.abs(angle(o.a-aimYaw))<(autoLock?.65:.075)).sort((a,b)=>Math.abs(angle(a.a-aimYaw))-Math.abs(angle(b.a-aimYaw)))[0];if(target){aimYaw+=angle(target.a-aimYaw)*dt*(autoLock?(save.loadout.equipment.includes('optics')?4.5:3):.7);if(autoLock)aimPitch=lerp(aimPitch,Math.atan2(terrain(target.q.x,target.q.z)-terrain(t.x,t.z),Math.hypot(target.q.x-t.x,target.q.z-t.z)),dt*3)}}const turnRate=(save.loadout.equipment.includes('stabilizer')?1.82:1.4)*(save.loadout.equipment.includes('gunLaying')?1.2:1)*(t.usedSupplies.includes('rationPack')?1.08:1);t.turretYaw+=clamp(angle(aimYaw-t.turretYaw),-dt*turnRate,dt*turnRate);t.pitch=lerp(t.pitch,aimPitch,dt*6);if(fireHeld)fire(t);if(mgHeld||keys.Space)fireMG(t)}else ai(t,dt);
t.yaw+=t.steer*dt*(t.track?.18:.85)*(t.speed<-.5?-1:1);const targetSpeed=t.throttle*t.maxSpeed*(t.throttle<0?.55:1)*(t.track?.1:1)*(t.engine?.55:1);t.speed=damp(t.speed,targetSpeed,Math.abs(t.throttle)<.08?5:2,dt);const nx=t.x+Math.sin(t.yaw)*t.speed*dt,nz=t.z+Math.cos(t.yaw)*t.speed*dt;const collision=tanks.some(o=>o!==t&&!o.dead&&Math.abs(nx-o.x)<3.5&&Math.abs(nz-o.z)<3.5&&Math.hypot(nx-o.x,nz-o.z)<3.5);if(!blocked(nx,nz)&&!collision){t.x=nx;t.z=nz}else{t.speed*=.3;if(!t.isPlayer)t.yaw+=dt*.8}t.root.position.set(t.x,terrain(t.x,t.z),t.z);t.body.rotation.y=t.yaw;t.body.rotation.x=(terrain(t.x,t.z+1)-terrain(t.x,t.z-1))*.3;t.turret.rotation.y=angle(t.turretYaw-t.yaw);t.gun.rotation.x=-t.pitch;if(t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<48)t.wheels.forEach(w=>w.rotation.x+=t.speed*dt*1.5);
if(t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<48){t.trackTick=(t.trackTick||0)+dt;const interval=t.isPlayer?1/30:1/18;if(t.trackTick>=interval){animateTracks(t,t.trackTick);t.trackTick=0}}
t.details.visible=t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<55;t.wheels.forEach(w=>w.visible=t.isPlayer||Math.hypot(t.x-player.x,t.z-player.z)<65);if(Math.abs(t.speed)>5&&Math.random()<dt*5)effect(new T.Vector3(t.x,.4,t.z),'smoke',1)}
function updateShots(dt){for(let i=shots.length-1;i>=0;i--){
 const s=shots[i];s.prev.copy(s.p);s.v.y-=.65*dt;s.p.addScaledVector(s.v,dt);s.life-=dt;
 let first=Infinity,victim=null,hit=false;
 for(const o of obstacles){const contact=coverContact(s.prev,s.p,o,terrain(o.x,o.z));if(contact!==null&&contact<first){first=contact;victim=null}}
 for(const t of tanks){if(t.dead||t.team===s.owner.team||(mode==='net'&&s.owner.netId&&!s.owner.isPlayer))continue;
 const contact=sphereContact(s.prev,s.p,{x:t.x,y:terrain(t.x,t.z)+1.5,z:t.z},2.1*TYPES[t.type].scale);
 if(contact!==null&&contact<first){first=contact;victim=t}}
 if(first!==Infinity){s.p.lerpVectors(s.prev,s.p,first);if(victim)impact(s,victim);else shellExplosion(s.p);hit=true}
 if(!hit&&s.p.y<terrain(s.p.x,s.p.z)){s.p.y=terrain(s.p.x,s.p.z);shellExplosion(s.p);hit=true}
 s.m.position.copy(s.p);s.m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),s.v.clone().normalize());
 if(hit||s.life<=0){world.remove(s.m);shots.splice(i,1)}
}}
function updateEffects(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){world.remove(p.m);particles.splice(i,1);continue}p.m.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*1.6);p.v.y+=p.smoke?dt*2:-dt*8;p.m.scale.setScalar(p.smoke?.2+(1-p.life/p.max)*1.8:.1+p.life*.3)}}
function repair(){if(state!=='battle'||player.repairs<=0||player.dead)return;repairUsed=true;damageService+=55;player.repairs--;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*(save.loadout.equipment.includes('fieldWorkshop')?.48:.35));player.track=player.engine=0;$('repair').disabled=player.repairs<=0;notify('РЕМОНТНЫЙ КОМПЛЕКТ ПРИМЕНЁН');sound('ui')}
function setZoom(){if(state!=='battle')return;zoom=(zoom+1)%4;$('scope').hidden=zoom===0;$('aim').innerHTML=`⊕<small>${zoom?['','2×','4×','6×'][zoom]:'ПРИЦЕЛ'}</small>`;sound('ui')}
function changeAmmo(){if(!player)return;player.ammo=(player.ammo+1)%AMMO_NAMES.length;$('ammo').innerHTML=AMMO_NAMES[player.ammo]+'<small>СНАРЯД</small>';sound('ui')}
function todayContract(){const day=new Date().toISOString().slice(0,10);if(save.contract?.day!==day)save.contract={day,kills:0,wins:0,claimed:false};return save.contract}
function contractUI(){
 const c=todayContract();let box=$('contractInfo');
 if(!box){box=document.createElement('div');box.id='contractInfo';box.style.cssText='margin-top:12px;padding:9px;border-radius:8px;border:1px solid #8a8f6a;background:#202d26e8;font:600 11px system-ui';$('spec').appendChild(box)}
 const ready=c.kills>=5&&c.wins>=1;
 box.innerHTML='<b>◈ ЕЖЕДНЕВНЫЙ КОНТРАКТ</b><br>Уничтожь 5 врагов ('+Math.min(5,c.kills)+'/5) и победи ('+Math.min(1,c.wins)+'/1)<br><button id="claimContract" style="margin-top:5px;padding:6px" '+(!ready||c.claimed?'disabled':'')+'>'+(c.claimed?'НАГРАДА ПОЛУЧЕНА':'ЗАБРАТЬ +650 ◈')+'</button>';
 $('claimContract').onclick=()=>{if(c.kills<5||c.wins<1||c.claimed)return;c.claimed=true;save.credits+=650;persist();garageUI();notify('КОНТРАКТ ВЫПОЛНЕН · +650 ◈')};
}
function ensureSmokeButton(){const b=$('smokeBtn');b.hidden=false;b.disabled=smokeCharges<1;$('smokeLabel').textContent='ДЫМ ×'+smokeCharges}
function deploySmoke(){
 if(state!=='battle'||smokeCharges<1||player.dead)return;
 smokeCharges--;smokeUntil=gameTime+9;smokeOrigin={x:player.x,z:player.z};
 for(let i=0;i<22;i++){const a=i*2.3999,d=2+Math.sqrt(i)*1.5;effect(new T.Vector3(player.x+Math.cos(a)*d,terrain(player.x,player.z)+.6,player.z+Math.sin(a)*d),'smoke',2)}
 ensureSmokeButton();notify('ДЫМОВАЯ ЗАВЕСА · ПРИЦЕЛ ПРОТИВНИКА СБИТ');
}
function end(win){
 if(state==='result'||state==='garage'||state==='loading')return;
 state='result';const netHud=$('p2pHud');if(netHud)netHud.hidden=true;resetInput();if($('smokeBtn'))$('smokeBtn').hidden=true;
 save.stats.battles++;save.stats.wins+=+win;save.stats.kills+=kills;
 const contract=todayContract();contract.kills+=kills;contract.wins+=+win;
 const settlement=battleSettlement({win,earned,wave,survival:mode==='survival',damage:battleDamage,ammo:ammoService,repairs:damageService,hp:player.hp,maxHp:player.maxHp,elapsed});const {gross,service:serviceCost,reward,subsidy}=settlement;save.lastBattle=settlement;
 save.credits+=reward;const oldLevel=rankFor(save.xp||0);
 const gainedXP=settlement.completed?90+kills*65+(win?220:0)+(mode==='survival'?(wave-1)*70:0)+Math.round(battleDamage*.04):0;
 save.xp=(save.xp||0)+gainedXP;const newLevel=rankFor(save.xp);persist();
 document.exitPointerLock?.();$('overlay').hidden=false;
 $('overlay').innerHTML=`<div class="dialog"><div class="eyebrow">ОПЕРАЦИЯ ЗАВЕРШЕНА</div><h2>${win?'ПОБЕДА':'ТАНК УНИЧТОЖЕН'}</h2><p>${MAP_NAMES[mapIndex]} · ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}</p><p>Бой: ${gross} ◈ · Снаряды, ремонт и обслуживание: −${serviceCost} ◈</p>${subsidy?`<p>Компенсация обслуживания: +${subsidy} ◈</p>`:''}<h2>+${reward} ◈ · +${gainedXP} XP</h2>${newLevel>oldLevel?`<div class="levelUp">${RANK_ICONS[newLevel-1]} НОВЫЙ УРОВЕНЬ ${newLevel} · ${RANKS[newLevel-1]}</div>`:""}<p>Уничтожено: ${kills} · Нанесено урона: ${Math.round(battleDamage)} ${mode==='survival'?'· Волна: '+wave:''}</p><button id="again" class="primary">Ещё один бой</button><button id="backGarage">В гараж</button></div>`;
 $('again').onclick=mode==='net'?()=>{window.STEEL_NET?.close();garage()}:startBattle;$('backGarage').onclick=garage;
}
function pause(){if(mode==='net'&&state==='battle'){resetInput();notify('Сетевой бой нельзя поставить на паузу');return}if(state==='battle'){state='paused';resetInput();document.exitPointerLock?.();$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><div class="eyebrow">ОПЕРАЦИЯ ПРИОСТАНОВЛЕНА</div><h2>Пауза</h2><button id="resume" class="primary">Продолжить</button><button id="pauseSettings">Настройки</button><button id="exitBattle">Завершить бой</button></div>';$('resume').onclick=pause;$('pauseSettings').onclick=openSettings;$('exitBattle').onclick=()=>end(false)}else if(state==='paused'){state='battle';$('overlay').hidden=true}}
function hud(){updateEnemyOverlays();const p=player;$('mgInfo').textContent=`КП-12.7  ${p.mg.belt} / ${p.mg.reserve} · ${p.mg.reloading>0?'ЛЕНТА '+p.mg.reloading.toFixed(1)+'с':p.mg.overheated?'ПЕРЕГРЕВ':Math.round(p.mg.heat)+'°'}`;$('mgHeat').style.width=p.mg.heat+'%';$('mg').classList.toggle('hot',p.mg.overheated);$('repairLabel').textContent='РЕМОНТ ×'+p.repairs;const direction=new T.Vector3(Math.sin(p.turretYaw)*Math.cos(p.pitch),Math.sin(p.pitch),Math.cos(p.turretYaw)*Math.cos(p.pitch));const bore=new T.Vector3(p.x,terrain(p.x,p.z)+2.1,p.z).addScaledVector(direction,60).project(camera);$('bore').style.left=(bore.x*.5+.5)*100+'%';$('bore').style.top=(-bore.y*.5+.5)*100+'%';$('bore').style.opacity=Math.abs(angle(p.turretYaw-aimYaw))<1?'1':'0';$('hp').textContent=`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;$('hpbar').style.width=p.hp/p.maxHp*100+'%';$('modules').textContent=[p.track?'ГУСЕНИЦА ⚠':'',p.engine?'ДВИГАТЕЛЬ ⚠':''].join(' ');$('speed').textContent=Math.round(Math.abs(p.speed)*3.6)+' км/ч';$('reload').textContent=p.cool>0?'ПЕРЕЗАРЯДКА '+p.cool.toFixed(1)+'с':'ОРУДИЕ ГОТОВО';$('ammoInfo').textContent=AMMO_NAMES[p.ammo]+' · '+p.rounds[p.ammo];$('fire').style.background=`conic-gradient(#c9df7a66 ${100*(1-p.cool/p.reload)}%,#19291d99 0)`;const allies=tanks.filter(t=>t.team===p.team&&!t.dead).length,enemies=tanks.filter(t=>t.team!==p.team&&!t.dead).length;$('score').textContent=`${allies} СОЮЗНИКИ  /  ${enemies} ПРОТИВНИКИ${mode==='survival'?' · ВОЛНА '+wave:mode==='flag'?' · 🚩 '+(flagCarrier?(flagCarrier.isPlayer?'ТВОЙ ФЛАГ':'ФЛАГ ВРАГА'):'ФЛАГ СВОБОДЕН')+' · '+Math.ceil(flagTimer)+'с':''}`;const c=$('mini').getContext('2d');c.clearRect(0,0,180,180);c.fillStyle='#52604b';obstacles.forEach(o=>c.fillRect(90+o.x*.6-o.r*.6,90-o.z*.6-o.r*.6,o.r*1.2,o.r*1.2));tanks.forEach(t=>{if(t.dead)return;c.fillStyle=t.isPlayer?'#ffffff':t.team!==p.team?'#ee8768':'#d4f070';c.beginPath();c.arc(90+t.x*.6,90-t.z*.6,t.isPlayer?4:3,0,7);c.fill()});c.strokeStyle='#fff';c.beginPath();c.moveTo(90+p.x*.6,90-p.z*.6);c.lineTo(90+p.x*.6+Math.sin(aimYaw)*15,90-p.z*.6-Math.cos(aimYaw)*15);c.stroke()}
function applySettings(){const s=save.settings;document.documentElement.style.setProperty('--size',s.size);document.documentElement.style.setProperty('--opacity',s.opacity);renderer.shadowMap.enabled=false;pixelCap=Math.min(devicePixelRatio,mobile?1:1.25);adaptive=1;renderer.setPixelRatio(pixelCap);layoutControls();persist()}
function openSettings(){if(state==='battle')pause();$('settings').hidden=false;const s=save.settings;$('settingsFields').innerHTML=`${[['sensitivity','Чувствительность обзора',.3,2.5,.1],['aimSensitivity','Чувствительность прицела',.2,1.5,.05],['deadzone','Мёртвая зона джойстика',.02,.25,.01],['smoothing','Скорость камеры',4,20,1],['size','Размер управления',.7,1.5,.05],['opacity','Прозрачность',.25,1,.05]].map(([k,n,a,b,step])=>`<label>${n}<input data-setting="${k}" type="range" min="${a}" max="${b}" step="${step}" value="${s[k]}"></label>`).join('')}${[['garland','Бесплатная новогодняя гирлянда'],['assist','Помощь в прицеливании'],['invert','Инверсия вертикальной оси'],['invertJoystick','Инверсия поворота джойстика (лево / право)'],['invertJoystickY','Инверсия джойстика вперёд / назад'],['sound','Звуки и музыка']].map(([k,n])=>`<label>${n}<input data-setting="${k}" type="checkbox" ${s[k]?'checked':''}></label>`).join('')}<label>Графика<select data-setting="quality"><option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option></select></label>`;document.querySelector('[data-setting="quality"]').value=s.quality;document.querySelectorAll('[data-setting]').forEach(el=>el.oninput=()=>{s[el.dataset.setting]=el.type==='checkbox'?el.checked:el.type==='range'?+el.value:el.value;applySettings()})}
$('settingsOpen').onclick=openSettings;$('settingsClose').onclick=()=>{$('settings').hidden=true;if(state==='garage')garage()};$('layout').onclick=()=>{editing=true;$('settings').hidden=true;$('overlay').hidden=true;$('garage').hidden=true;$('hud').hidden=false;$('layoutDone').hidden=false;document.body.classList.remove('desktop')};$('layoutDone').onclick=e=>{if(e.target.tagName!=='BUTTON')return;editing=false;persist();$('layoutDone').hidden=true;document.body.classList.toggle('desktop',!mobile);if(state==='garage'){$('garage').hidden=false;$('hud').hidden=true}else if(state==='paused'){$('overlay').hidden=false}openSettings()};$('resetLayout').onclick=()=>{save.settings.layout={};document.querySelectorAll('.control').forEach(e=>{e.style.left=e.style.right=e.style.top=e.style.bottom=''});applySettings()};$('start').onclick=startBattle;$('pause').onclick=pause;$('repair').onclick=repair;$('aim').onclick=setZoom;$('ammo').onclick=changeAmmo;$('lock').onclick=()=>{if(editing)return;autoLock=!autoLock;$('lock').style.color=autoLock?'#e5fa72':'';notify(autoLock?'ЗАХВАТ ВКЛЮЧЁН':'ЗАХВАТ ОТКЛЮЧЁН')};$('mini').onclick=()=>{$('mini').style.width=$('mini').style.width?'':'240px';$('mini').style.height=$('mini').style.height?'':'240px'};
function resetInput(){Object.keys(keys).forEach(k=>delete keys[k]);joy.x=joy.y=0;fireHeld=false;mgHeld=false;drag=null;joyPointer=null;cameraPointers.clear();pointers.clear();$('stick').style.transform=''}window.addEventListener('blur',()=>{resetInput();if(state==='battle')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(state==='battle')pause()}});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='Escape'){if(state==='tour'){$('tourPanel').hidden=true;garage()}else pause()}if(e.code==='KeyG')deploySmoke();if(e.code==='KeyR')repair();if(e.code==='KeyQ')changeAmmo();if(e.code==='ShiftLeft')setZoom();if(e.code==='KeyF'&&state==='battle')reloadMG(player.mg);if(e.code==='KeyC'&&state==='battle'){aimYaw=player.yaw;aimPitch=.04}});window.addEventListener('keyup',e=>keys[e.code]=false);
const tapActions={aim:setZoom,repair,ammo:changeAmmo,smokeBtn:deploySmoke,lock:()=>{autoLock=!autoLock;$('lock').classList.toggle('selected',autoLock)},mgReload:()=>reloadMG(player.mg),center:()=>{aimYaw=player.yaw;aimPitch=.04}};
document.querySelectorAll('.control').forEach(el=>{el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);if(editing){pointers.set(e.pointerId,{kind:'layout',el,dx:e.clientX-el.getBoundingClientRect().left,dy:e.clientY-el.getBoundingClientRect().top});return}if(state!=='battle')return;if(tapActions[el.id])tapActions[el.id]();if(el.id==='joystick'&&joyPointer===null){joyPointer=e.pointerId;const r=el.getBoundingClientRect();pointers.set(e.pointerId,{kind:'joy',cx:r.left+r.width/2,cy:r.top+r.height/2,r:r.width*.36});movePointer(e)}if(el.id==='fire'){pointers.set(e.pointerId,{kind:'fire'});fireHeld=true;fire(player)}if(el.id==='mg'){pointers.set(e.pointerId,{kind:'mg'});mgHeld=true;fireMG(player)}});el.addEventListener('pointermove',movePointer);el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);el.onclick=e=>{if(!editing&&state==='battle'&&e.detail===0&&tapActions[el.id])tapActions[el.id]();}});
function movePointer(e){const p=pointers.get(e.pointerId);if(!p)return;if(p.kind==='joy'){const v=joystickVector((e.clientX-p.cx)/p.r,(e.clientY-p.cy)/p.r,save.settings.deadzone);joy.x=v.x;joy.y=v.y;$('stick').style.transform=`translate(${joy.x*p.r*.7}px,${joy.y*p.r*.7}px)`}if(p.kind==='layout'){const box={...activeLayout[p.el.id],x:e.clientX-p.dx,y:e.clientY-p.dy};if(canPlaceControl(p.el.id,box,activeLayout,innerWidth,innerHeight)){activeLayout[p.el.id]=box;Object.assign(p.el.style,{left:box.x+'px',top:box.y+'px'});save.settings.layout[p.el.id]={x:box.x/innerWidth*100,y:box.y/innerHeight*100}}}}

function release(e){const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(p?.kind==='joy'){joy.x=joy.y=0;joyPointer=null;$('stick').style.transform=''}if(p?.kind==='fire')fireHeld=[...pointers.values()].some(p=>p.kind==='fire');if(p?.kind==='mg')mgHeld=[...pointers.values()].some(p=>p.kind==='mg');cameraPointers.delete(e.pointerId)}
$('game').addEventListener('pointerdown',e=>{if(editing)return;if(state==='garage'){drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('game').setPointerCapture(e.pointerId);return}if(state!=='battle')return;if(e.pointerType==='mouse'){if(e.button===2)setZoom();else if(e.button===0){pointers.set(e.pointerId,{kind:'fire'});fire(player);fireHeld=true;$('game').requestPointerLock?.()}}else if(cameraPointers.size===0){cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('game').setPointerCapture(e.pointerId)}});
$('game').addEventListener('pointerdown',e=>{if(state==='tour'){tourPointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('game').setPointerCapture(e.pointerId)}});
$('game').addEventListener('wheel',e=>{if(state==='tour'){e.preventDefault();tourDistance=clamp(tourDistance*Math.exp(e.deltaY*.001),12,220)}},{passive:false});
$('game').addEventListener('pointermove',e=>{if(state==='tour'){if(tourPointer?.id===e.pointerId){tourYaw-=(e.clientX-tourPointer.x)*.006;tourPitch=clamp(tourPitch+(e.clientY-tourPointer.y)*.005,-.12,1.42);tourPointer.x=e.clientX;tourPointer.y=e.clientY}return}if(state==='garage'&&drag?.id===e.pointerId){garageYaw+=(e.clientX-drag.x)*.01;drag.x=e.clientX;return}if(state!=='battle'||editing)return;let dx=0,dy=0;const touch=cameraPointers.get(e.pointerId);if(document.pointerLockElement){dx=e.movementX;dy=e.movementY}else if(touch){dx=e.clientX-touch.x;dy=e.clientY-touch.y;touch.x=e.clientX;touch.y=e.clientY}else if(e.pointerType==='mouse'){dx=e.movementX;dy=e.movementY}else return;const sensitivity=.0025*save.settings.sensitivity*(zoom?save.settings.aimSensitivity/(zoom*1.4):1);aimYaw+=clamp(dx,-150,150)*sensitivity;aimPitch=clamp(aimPitch-clamp(dy,-150,150)*sensitivity*(save.settings.invert?-1:1),-.18,.35)});
window.addEventListener('pointerup',e=>{if(tourPointer?.id===e.pointerId)tourPointer=null;if(drag?.id===e.pointerId)drag=null;release(e)});window.addEventListener('pointercancel',e=>{if(tourPointer?.id===e.pointerId)tourPointer=null;release(e)});$('game').addEventListener('lostpointercapture',release);window.addEventListener('contextmenu',e=>e.preventDefault());

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);layoutControls()});
let hudClock=0;let last=performance.now(),fpsAccum=0,frames=0,adaptive=1;let pixelCap=Math.min(devicePixelRatio,mobile?1:1.25);const desiredPos=new T.Vector3(),look=new T.Vector3(),smoothLook=new T.Vector3();let cameraReady=false;function frame(now){requestAnimationFrame(frame);const wallDt=Math.max(0,(now-last)/1000),dt=Math.min(wallDt,.04);last=now;gameTime+=dt;windUniform.value=gameTime;if(state==='tour'){
 const cp=Math.cos(tourPitch);
 camera.position.set(tourCenter.x+Math.sin(tourYaw)*cp*tourDistance,tourCenter.y+Math.sin(tourPitch)*tourDistance,tourCenter.z+Math.cos(tourYaw)*cp*tourDistance);
 camera.lookAt(tourCenter);camera.fov=55;camera.updateProjectionMatrix();
 sun.position.set(-45,70,35);sun.target.position.set(0,0,0);
 }else if(state==='garage'){const a=garageYaw+Math.sin(gameTime*.12)*.05;camera.position.set(Math.sin(a)*11,5.5,Math.cos(a)*11);camera.lookAt(0,1.4,0);camera.fov=55;camera.updateProjectionMatrix();preview.root.rotation.y=.3}else if(player){if(state==='battle'&&!editing){elapsed+=dt;tanks.forEach(t=>updateTank(t,dt));updateShots(dt);updateEffects(dt);if(smokeUntil>gameTime&&Math.random()<dt*7){const a=Math.random()*6.283,d=Math.sqrt(Math.random())*12;effect(new T.Vector3(smokeOrigin.x+Math.cos(a)*d,terrain(smokeOrigin.x,smokeOrigin.z)+.8,smokeOrigin.z+Math.sin(a)*d),'smoke',1)}if(mode==='flag')updateFlag(dt);if(state==='battle'&&player.dead)end(false);else if(state==='battle'&&mode==='net'&&tanks.length>1&&tanks.every(t=>t.isPlayer||t.dead))end(true);else if(state==='battle'&&mode!=='net'&&!tanks.some(t=>t.team===1&&!t.dead)){if(mode==='flag'){end(true)}else if(mode==='survival'){wave++;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.2);player.rounds=player.rounds.map((n,i)=>n+[20,7,5,3,2][i]);spawnWave()}else end(true)}hudClock+=dt;if(hudClock>.08){hudClock=0;hud()}musicTime+=dt;if(musicTime>4){musicTime=0;sound('music')}}viewYaw+=angle(aimYaw-viewYaw)*(1-Math.exp(-dt*save.settings.smoothing));viewPitch=damp(viewPitch,aimPitch,save.settings.smoothing,dt);const base=new T.Vector3(player.x,terrain(player.x,player.z)+2.2,player.z),dir=new T.Vector3(Math.sin(viewYaw)*Math.cos(viewPitch),Math.sin(viewPitch),Math.cos(viewYaw)*Math.cos(viewPitch));if(zoom){desiredPos.copy(base).addScaledVector(dir,4.8);camera.position.copy(desiredPos);look.copy(base).addScaledVector(dir,160)}else{desiredPos.copy(base).addScaledVector(dir,-12);desiredPos.y+=5;camera.position.lerp(desiredPos,1-Math.exp(-dt*5.5));look.copy(base).addScaledVector(dir,60)}if(!cameraReady||zoom){smoothLook.copy(look);cameraReady=true}else smoothLook.lerp(look,1-Math.exp(-dt*11));camera.lookAt(smoothLook);camera.fov=zoom?[55,30,17,10][zoom]:55;if(camera.userData.lastFov!==camera.fov){camera.updateProjectionMatrix();camera.userData.lastFov=camera.fov}player.root.visible=!zoom;sun.position.set(player.x-45,70,player.z+35);sun.target.position.set(player.x,0,player.z)}if(engineGain){engineGain.gain.setTargetAtTime(state==='battle'&&save.settings.sound?.018:0,audio.currentTime,.1);engineOsc.frequency.setTargetAtTime(35+Math.abs(player?.speed||0)*3,audio.currentTime,.1)}if(hazardMaterial.cache)for(const material of Object.values(hazardMaterial.cache))material.uniforms.uTime.value=gameTime;
 sky.position.copy(camera.position);renderer.render(scene,camera);fpsAccum+=wallDt;frames++;if(fpsAccum>1.5){const fps=frames/fpsAccum;if((state==='battle'||state==='tour')&&fps<48&&adaptive>.7){adaptive=Math.max(.7,adaptive-.1);renderer.setPixelRatio(pixelCap*adaptive)}else if((state==='battle'||state==='tour')&&fps>57&&adaptive<1){adaptive=Math.min(1,adaptive+.05);renderer.setPixelRatio(pixelCap*adaptive)}window.STEEL_METRICS={fps:Math.round(fps),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,tanks:tanks.length,particles:particles.length,state};fpsAccum=0;frames=0}}


function initFlag(){flagCarrier=null;flagTimer=0;flagTransferCooldown=0;if(flagMesh){world.remove(flagMesh);flagMesh=null}flagMesh=new T.Group();const pole=mesh('box',0xe5e3cb,0,2,0,.14,4,.14,flagMesh);const cloth=mesh('box',0xffc439,.75,3.65,0,1.5,.85,.1,flagMesh);cloth.material=mat(0xffc439);flagMesh.position.set(0,terrain(0,0),0);world.add(flagMesh)}
function updateFlag(dt){if(state!=='battle'||mode!=='flag')return;flagTransferCooldown=Math.max(0,flagTransferCooldown-dt);if(flagCarrier?.dead){flagCarrier=null;flagTimer=0}if(!flagCarrier){const contender=tanks.find(t=>!t.dead&&Math.hypot(t.x,t.z)<6);if(contender){flagCarrier=contender;flagTimer=45;flagTransferCooldown=1.5;notify(contender.isPlayer?'ТЫ ВЗЯЛ ФЛАГ! УДЕРЖИ 45 СЕКУНД':'ВРАГ ВЗЯЛ ФЛАГ! ДОГОНИ ЕГО')}}else{const other=tanks.find(t=>!t.dead&&t.team!==flagCarrier.team&&Math.hypot(t.x-flagCarrier.x,t.z-flagCarrier.z)<5);if(other&&flagTransferCooldown===0){flagCarrier=other;flagTimer=45;flagTransferCooldown=1.5;notify(other.isPlayer?'ФЛАГ ПЕРЕХВАЧЕН!':'ВРАГ ПЕРЕХВАТИЛ ФЛАГ!')}else{flagTimer-=dt;if(flagTimer<=0){end(flagCarrier.isPlayer);return}}}if(flagMesh){const x=flagCarrier?.x??0,z=flagCarrier?.z??0;flagMesh.position.set(x,terrain(x,z)+(flagCarrier?2.2:0),z);flagMesh.rotation.y=flagCarrier?.yaw??0}}

function destroyTank(t,owner){if(t.dead)return;if(mode==='flag'&&flagCarrier===t){flagCarrier=null;flagTimer=0;notify('ФЛАГ ПОТЕРЯН!')} t.hp=0;t.dead=true;t.speed=0;if(t.isPlayer&&mode==='net')window.STEEL_NET?.stateNow();effect(t.root.position.clone().add(new T.Vector3(0,2,0)),'boom',24);sound('boom');if(owner.isPlayer){kills++;earned+=160;notify('ЦЕЛЬ УНИЧТОЖЕНА · +160 ◈')}t.root.traverse(o=>{if(o.isMesh)o.material=mat(0x30352d)});t.turret.rotation.z=.12}
function fireMG(t){if(state!=='battle'||t.dead)return false;if(!consumeMGShot(t.mg,t.isPlayer&&save.loadout.equipment.includes('cooler')))return false;const yaw=t.turretYaw+(Math.random()-.5)*.012,pitch=t.pitch+(Math.random()-.5)*.009,dir=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));t.root.updateMatrixWorld(true);const origin=t.mgMount.localToWorld(new T.Vector3(0,0,1.65));const target=new T.Vector3(t.x,terrain(t.x,t.z)+2.1,t.z).addScaledVector(dir,60);dir.copy(target.sub(origin).normalize());const tracer=mesh('sphere',0xffd182,origin.x,origin.y,origin.z,.035,.035,1.4);tracer.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);shots.push({m:tracer,p:origin,prev:origin.clone(),v:dir.multiplyScalar(175),owner:t,life:1.1,ammo:0,kind:'mg'});effect(origin,'spark',2);if(t.isPlayer&&mode==='net')window.STEEL_NET?.fire('mg',0);sound('mg');return true}
function impactMG(s,t){const incoming=new T.Vector3(s.v.x,0,s.v.z).normalize(),forward=new T.Vector3(Math.sin(t.yaw),0,Math.cos(t.yaw));const rear=incoming.dot(forward)>.55,damage=mgDamage(t.armor,rear);const dealt=actualDamage(t.hp,damage);if(!(s.owner.isPlayer&&mode==='net'&&t.netId))t.hp-=damage;if(s.owner.isPlayer&&mode==='net'&&t.netId&&damage>0)window.STEEL_NET?.hit(t.netId,damage);if(damage>0&&Math.random()<.13)t.track=Math.max(t.track,2);if(s.owner.isPlayer)battleDamage+=dealt;effect(s.p,'spark',3);if(s.owner.isPlayer){$('hit').textContent=damage?`КП-12.7 · −${damage}`:'КП-12.7 · БРОНЯ';clearTimeout(mgHitTimer);mgHitTimer=setTimeout(()=>$('hit').textContent='',450)}if(t.hp<=0)destroyTank(t,s.owner)}
let mgHitTimer,shopTab='equipment';
function refreshPaint(){if(state==='garage'){world.remove(preview.root);preview.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose()});preview=model(selected);world.add(preview.root)}}
function shop(){if(state!=='garage')return;$('shop').hidden=false;renderShop()}
function renderShop(){const tabs=[['weapon','Орудия'],['equipment','Оборудование'],['supplies','Снабжение'],['paint','Камуфляж']];$('shopTabs').innerHTML=tabs.map(([id,name])=>`<button data-category="${id}" class="${shopTab===id?'selected':''}">${name}</button>`).join('');$('shopBalance').textContent=save.credits+' ◈';$('loadoutSummary').textContent=`${WEAPONS[save.loadout.weapon].name} · Оборудование ${save.loadout.equipment.length}/3 · Снабжение ${save.loadout.supplies.length}/2 · Выбранное снабжение расходуется при начале боя`;
$('shopItems').innerHTML=PRODUCTS.filter(p=>p.category===shopTab).map(p=>{const owned=p.category==='weapon'?save.weapons.includes(p.id):p.category==='equipment'?save.equipment.includes(p.id):p.category==='paint'?save.paints.includes(p.id):(save.inventory[p.id]||0)>0;const active=p.category==='weapon'?save.loadout.weapon===p.id:p.category==='paint'?save.loadout.paint===p.id:save.loadout[p.category].includes(p.id);return `<article class="shopItem"><div class="productIcon">${p.category==='equipment'?'⚙':p.category==='paint'?'◈':'▤'}</div><div><h3>${p.name}</h3><p>${p.description}</p><small>${p.category==='supplies'?'На складе: '+(save.inventory[p.id]||0):owned?'В собственности':'Постоянная покупка'}</small></div><div class="shopActions">${!owned||p.category==='supplies'?`<button data-buy="${p.id}" ${save.credits<p.price?'disabled':''}>Купить · ${p.price} ◈</button>`:''}${owned?`<button data-equip="${p.id}" class="${active?'selected':''}">${active?(p.category==='paint'||p.category==='weapon'?'Выбрано':'Снять'):(p.category==='paint'?'Нанести':'Установить')}</button>`:''}</div></article>`}).join('');
if(shopTab==='paint')$('shopItems').innerHTML+='<button id="factoryPaint">Заводская окраска · бесплатно</button>';
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{shopTab=b.dataset.category;renderShop()});document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const error=purchase(save,b.dataset.buy);$('shopMessage').textContent=error||'Покупка поступила на склад';persist();garageUI();renderShop();sound('ui')});document.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{const error=equip(save,b.dataset.equip);$('shopMessage').textContent=error||'Оснащение обновлено';persist();refreshPaint();renderShop()});if($('factoryPaint'))$('factoryPaint').onclick=()=>{save.loadout.paint='factory';persist();refreshPaint();renderShop()}}
$('shopOpen').onclick=shop;$('shopClose').onclick=()=>{$('shop').hidden=true};

let activeLayout={};
function layoutControls(){activeLayout=controlLayout(innerWidth,innerHeight,save.settings.size,save.settings.layout);for(const[id,r]of Object.entries(activeLayout)){const el=$(id);if(el)Object.assign(el.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',bottom:'auto',right:'auto',transform:'none'})}const r=activeLayout.joystick;Object.assign($('stick').style,{left:r.w*.28+'px',top:r.h*.28+'px',width:r.w*.44+'px',height:r.h*.44+'px'})}
window.STEEL_NET_BRIDGE={
isGarage:()=>state==='garage',tankType:()=>selected,mapIndex:()=>$('map').selectedIndex,
snapshot:()=>mode==='net'&&state==='battle'&&player?{x:+player.x.toFixed(3),z:+player.z.toFixed(3),yaw:+player.yaw.toFixed(3),turretYaw:+player.turretYaw.toFixed(3),pitch:+player.pitch.toFixed(3),hp:Math.max(0,+player.hp.toFixed(1)),dead:player.dead,speed:+player.speed.toFixed(2),maxHp:player.maxHp,armor:player.armor,steer:player.steer||0}:null,
launch:(roster,id,map)=>{if(state!=='garage')return;initAudio();state='loading';$('garage').hidden=true;$('overlay').hidden=false;$('overlay').innerHTML='<div class="dialog"><h2>Подключаем P2P бой…</h2></div>';setTimeout(()=>{mapIndex=clamp(map|0,0,7);$('map').selectedIndex=mapIndex;mode='net';buildMap(mapIndex);const positions=[[0,-90],[0,90],[-75,0],[75,0]];player=null;for(let i=0;i<roster.length&&i<4;i++){const p=roster[i],xy=positions[i],mine=p.id===id,t=makeTank(clamp(p.type|0,0,4),i,xy[0],xy[1],mine);t.netId=p.id;t.netName=p.name;if(mine)player=t}if(!player){garage();return}wave=1;kills=0;earned=0;elapsed=0;repairUsed=false;aimYaw=player.yaw;aimPitch=.04;viewYaw=aimYaw;viewPitch=.04;resetInput();zoom=0;autoLock=false;ammoService=0;battleDamage=0;damageService=0;smokeCharges=2;smokeUntil=0;ensureSmokeButton();state='battle';$('overlay').hidden=true;$('hud').hidden=false;$('scope').hidden=true;$('tankName').textContent='P2P · '+player.netName;$('repair').disabled=false;notify('P2P БОЙ • '+roster.length+' ИГРОКОВ');window.STEEL_NET?.ready()},80)},
receiveState:(id,s)=>{if(mode!=='net'||state!=='battle')return;const t=tanks.find(o=>o.netId===id&&!o.isPlayer);if(!t)return;const num=(v,old,max)=>Number.isFinite(v)?clamp(v,-max,max):old;if(Number.isFinite(s.maxHp))t.maxHp=clamp(s.maxHp,100,10000);if(Number.isFinite(s.armor))t.armor=clamp(s.armor,1,1000);t.netTarget={x:num(s.x,t.x,145),z:num(s.z,t.z,145),yaw:num(s.yaw,t.yaw,100),turretYaw:num(s.turretYaw,t.turretYaw,100),pitch:num(s.pitch,t.pitch,3),hp:clamp(Number(s.hp)||0,0,t.maxHp),dead:!!s.dead,speed:num(s.speed,0,100),steer:num(s.steer,0,1)}},
receiveFire:(id,kind,ammo,yaw,pitch)=>{if(mode!=='net'||state!=='battle')return;const t=tanks.find(o=>o.netId===id&&!o.isPlayer);if(!t||t.dead)return;if(Number.isFinite(yaw))t.turretYaw=yaw;if(Number.isFinite(pitch))t.pitch=clamp(pitch,-1.5,1.5);if(kind==='cannon'){t.ammo=clamp(ammo|0,0,4);t.rounds[t.ammo]=Math.max(1,t.rounds[t.ammo]);t.cool=0;fire(t)}else if(kind==='mg'){t.mg.cooldown=0;fireMG(t)}},
receiveHit:amount=>{if(mode!=='net'||state!=='battle'||!player||player.dead)return;player.hp=Math.max(0,player.hp-clamp(amount,0,1500));if(player.hp<=0)destroyTank(player,{isPlayer:false})},
drop:id=>{const t=tanks.find(o=>o.netId===id);if(t&&!t.isPlayer){t.dead=true;t.root.visible=false;notify('Игрок отключился: '+t.netName)}},
hostLost:()=>{if(mode==='net'&&state==='battle'){notify('Хост отключился');end(false)}}
};
applySettings();garage();requestAnimationFrame(frame);if(typeof location!=='undefined'&&location.protocol!=='file:'&&'serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
