import * as T from './vendor/three.js';
import {armorMaterial,batchRigid,inkAssembly,toonMaterial} from './visuals.js';
const PROFILES=[{w:2.6,l:3.9,tw:1.05,tl:1.25,barrel:2.6},{w:2.7,l:4.3,tw:1.1,tl:1.4,barrel:3.2},{w:2.9,l:4.5,tw:1.3,tl:1.6,barrel:3.4},{w:3.2,l:4.9,tw:1.5,tl:1.85,barrel:3.7},{w:3.4,l:5.2,tw:1.65,tl:2,barrel:4.2}];
const dummy=new T.Object3D();
export function trackPose(u,length){const straight=length-.9,r=.5,loop=2*straight+2*Math.PI*r,d=((u%1)+1)%1*loop;let z,y,angle;if(d<straight){z=-straight/2+d;y=.17;angle=0}else if(d<straight+Math.PI*r){const a=-Math.PI/2+(d-straight)/r;z=straight/2+r*Math.cos(a);y=.67+r*Math.sin(a);angle=-a-Math.PI/2}else if(d<2*straight+Math.PI*r){z=straight/2-(d-straight-Math.PI*r);y=1.17;angle=0}else{const a=Math.PI/2+(d-2*straight-Math.PI*r)/r;z=-straight/2+r*Math.cos(a);y=.67+r*Math.sin(a);angle=-a-Math.PI/2}return{z,y,angle}}
export function animateTank(t,dt,near=true){t.trackPhase=(t.trackPhase||0)+t.speed*dt/(t.profile.l*2+1.4);if(!near)return;for(const belt of t.trackLinks){for(let i=0;i<belt.count;i++){const p=trackPose(i/belt.count+t.trackPhase,t.profile.l);dummy.position.set(belt.userData.side*(t.profile.w/2+.28),p.y,p.z);dummy.rotation.set(p.angle,0,0);dummy.scale.set(.62,.11,.23);dummy.updateMatrix();belt.setMatrixAt(i,dummy.matrix)}belt.instanceMatrix.needsUpdate=true}}
export function buildTank({type,team,color,scale,scheme,mesh,geo}){const profile=PROFILES[type],{w,l,tw,tl,barrel}=profile,root=new T.Group(),body=new T.Group(),turret=new T.Group(),gun=new T.Group(),details=new T.Group(),mgMount=new T.Group(),wheels=[],trackLinks=[];root.add(body);body.add(details);turret.position.set(0,1.75,-.2);body.add(turret);gun.position.set(0,.15,tl*.47);gun.userData.restZ=tl*.47;gun.userData.muzzleZ=barrel+.64;turret.add(gun);const armor=armorMaterial(color,scheme),dark=0x2d3540,steel=0x5f6d70;
 const part=(g,c,x,y,z,sx,sy,sz,parent=body,paint=false)=>{const m=mesh(g,c,x,y,z,sx,sy,sz,parent);if(paint)m.material=armor;return m};
 part('box',color,0,1.1,0,w,.68,l,body,true);part('box',color,0,1.54,-.1,w*.9,.3,l*.8,body,true);const glacis=part('box',color,0,1.22,l*.43,w*.94,.56,.7,body,true);glacis.rotation.x=-.36;
 for(const side of [-1,1]){part('box',dark,side*(w/2+.25),.67,0,.6,.85,l-.5);for(let i=0;i<7;i++){const z=-(l-.9)/2+i*(l-.9)/6,wheel=part('cyl',steel,side*(w/2+.59),.67,z,.36,.11,.36);wheel.rotation.z=Math.PI/2;wheels.push(wheel);part('cyl',dark,side*(w/2+.66),.67,z,.13,.13,.13).rotation.z=Math.PI/2}
 const belt=new T.InstancedMesh(geo.box,toonMaterial(dark),40);belt.userData.side=side;belt.frustumCulled=false;belt.castShadow=true;body.add(belt);trackLinks.push(belt);
 part('box',color,side*(w/2+.25),1.33,0,.85,.12,l+.15,details,true);for(let i=0;i<4;i++){const z=-(l-.8)/2+i*(l-.8)/3;part('box',color,side*(w/2+.64),1.12,z,.09,.46,.8,details,true);part('sphere',steel,side*(w/2+.7),1.24,z,.045,.045,.045,details)}
 part('box',dark,side*w*.32,1.61,l*.4,.4,.22,.25,details);part('box',0xffd58c,side*w*.32,1.61,l*.4+.135,.26,.11,.04,details);
 part('cyl',steel,side*w*.35,1.5,-l*.45,.11,.6,.11,details).rotation.x=Math.PI/2;
 }
 part('cyl',dark,0,-.06,0,tw,.18,tw,turret);part('box',color,0,.25,-.05,tw*2,.65,tl,turret,true);for(const side of [-1,1]){const cheek=part('box',color,side*tw*.72,.22,tl*.32,tw*.65,.7,tl*.6,turret,true);cheek.rotation.y=side*.18}
 part('cyl',color,-tw*.42,.67,-tl*.2,.37,.13,.37,turret,true);part('box',dark,tw*.4,.65,.2,.35,.2,.35,turret);part('box',0x72c9cf,tw*.4,.66,.39,.25,.1,.035,turret);
 for(let i=0;i<8;i++)part('box',dark,-w*.3+i*w*.085,1.72,-l*.3,.08,.035,.6,details);
 part('box',color,0,0,.2,.6,.52,.65,gun,true);part('cyl',steel,0,0,barrel*.5+.3,.115,barrel,.115,gun).rotation.x=Math.PI/2;part('cyl',dark,0,0,barrel*.55,.16,.32,.16,gun).rotation.x=Math.PI/2;
 part('box',steel,0,0,barrel+.4,.32,.28,.4,gun);part('box',0x151b26,0,0,barrel+.61,.18,.13,.025,gun);
 for(let i=0;i<4;i++){part('cyl',steel,-tw*.85+i*.22,.36,-tl*.52,.065,.4,.065,turret).rotation.x=-.4}
 part('box',0xc0a36e,0,1.72,-l*.4,w*.4,.25,.4,details);part('cyl',dark,tw*.65,1.3,-tl*.3,.02,1.8,.02,turret);
 mgMount.position.set(-tw*.4,1,-.2);turret.add(mgMount);part('cyl',dark,-tw*.4,.83,-.2,.08,.5,.08,turret);part('box',steel,0,0,.1,.22,.23,.65,mgMount);part('box',0x9b9965,-.23,-.04,.05,.28,.28,.32,mgMount);part('cyl',dark,0,0,.98,.05,1.15,.05,mgMount).rotation.x=Math.PI/2;part('box',dark,0,.19,.22,.04,.14,.04,mgMount);
 if(scheme==='admin_ua'&&!team){for(const side of [-1,0,1])part('box',0xffd44e,side*.19,.37,tl/2+.06,.07,side===0?.5:.35,.04,turret);part('box',0xffd44e,0,.16,tl/2+.06,.45,.07,.04,turret)}
 // Ink is generated from final static geometry, never as detached copies of moving links.
 for(const g of [body,turret,gun,details,mgMount]){batchRigid(g,wheels);inkAssembly(g)}
 root.scale.setScalar(scale);const result={root,body,turret,gun,details,mgMount,wheels,trackLinks,trackPhase:0,profile,speed:0};animateTank(result,0);return result;
}
