import * as T from './vendor/three.js';
import {LEVELS,authoredHeight,footprint} from './authored-levels.js';
import {branchingTree} from './foliage.js';
import {microSurface} from './material-detail.js';
const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(.5,.5,1,12),dome=new T.SphereGeometry(.5,16,8,0,Math.PI*2,0,Math.PI/2);
const arch=(()=>{const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(.5,.48);shape.absellipse(0,.48,.5,.52,0,Math.PI,false,0);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:12});g.translate(0,0,-.5);return g})();
const roof=(()=>{const g=new T.BufferGeometry(),p=[[-.5,0,-.5],[.5,0,-.5],[0,1,-.5],[-.5,0,.5],[.5,0,.5],[0,1,.5]],idx=[0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3];g.setAttribute('position',new T.Float32BufferAttribute(idx.flatMap(i=>p[i]),3));g.computeVertexNormals();const uv=[];for(let i=0;i<g.attributes.position.count;i++)uv.push(g.attributes.position.getX(i)+.5,g.attributes.position.getZ(i)+.5);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g})();
const rock=new T.IcosahedronGeometry(.5,2);{const p=rock.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.14*Math.sin(x*17+y*11+z*23);p.setXYZ(i,x*r,y*r,z*r)}rock.computeVertexNormals()}
const materials=new Map();function material(color,metal=false,glow=false){const key=[color,metal,glow].join(':');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:metal?.52:.88,metalness:metal?.55:.06,...microSurface(metal?'metal':'stone'),normalScale:new T.Vector2(.15,.15),emissive:glow?color:0,emissiveIntensity:glow?.65:0}));return materials.get(key)}
const treeMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
export function buildAuthoredLevel(world,index,quality='medium'){
 const l=LEVELS[index],batches=new Map(),tmp=new T.Object3D(),local=new T.Object3D();
 function add(g,mat,x,y,z,w,h,d,angle=0,parent){local.position.set(x,y,z);local.scale.set(w,h,d);local.rotation.set(0,angle,0);local.updateMatrix();const matrix=parent?new T.Matrix4().multiplyMatrices(parent,local.matrix):local.matrix.clone();const key=g.uuid+mat.uuid;if(!batches.has(key))batches.set(key,{g,mat,transforms:[]});batches.get(key).transforms.push(matrix)}
 for(const o of l.props){tmp.position.set(o.x,authoredHeight(index,o.x,o.z)-.18,o.z);tmp.rotation.set(0,o.angle,0);tmp.scale.set(1,1,1);tmp.updateMatrix();const parent=tmp.matrix.clone();const [stone,steel,accent]=l.colors,S=material(stone),M=material(steel,true),A=material(accent),dark=material(0x18252c),glass=material(index===3?0x43c4d3:0x60989f,true,index===3);const b=(x,y,z,w,h,d,mat=S)=>add(box,mat,x,y,z,w,h,d,0,parent),c=(x,y,z,w,h,d,mat=M)=>add(cyl,mat,x,y,z,w,h,d,0,parent);
 const {w,d,h}=o;
 b(0,-.6,0,w+.4,1.6,d+.4,M);
 if(o.kit==='rock'){
  add(rock,S,0,h*.45,0,w,h,d,0,parent);add(rock,S,-w*.24,h*.23,d*.17,w*.62,h*.65,d*.72,.4,parent);for(let k=0;k<12;k++){const a=k*Math.PI/6;add(rock,k%3?S:M,Math.cos(a)*w*.32,.4+k%3*.15,Math.sin(a)*d*.32,2.1,1.1,1.8,a,parent)}
 }else if(o.kit==='wall'){
  b(0,h/2,0,w,h,d);for(let x=-w/2+1;x<w/2;x+=3)b(x,h*.52,0,.4,h*1.08,d+.5,A);b(0,h,0,w+.3,.18,d+.3,A);
 }else if(o.kit==='container'){
  b(0,h/2,0,w,h,d,M);for(let x=-w/2+.3;x<w/2;x+=.8){b(x,h/2,d/2+.04,.09,h-.2,.08,A);b(x,h/2,-d/2-.04,.09,h-.2,.08,A)}for(const x of [-w/2,w/2]){b(x,h/2,0,.15,h,d+.12,A);for(const z of [-d*.23,d*.23])b(x+.09,h/2,z,.08,h*.85,.08,S)}
 }else if(o.kit==='refinery'){
  b(0,h*.17,0,w,h*.34,d);for(let k=-1;k<=1;k++){c(k*w*.29,h*.59,0,w*.23,h*.65,d*.65,M);c(k*w*.29,h*.91,0,w*.26,.3,d*.69,A);for(let y=h*.4;y<h*.9;y+=2)c(k*w*.29,y,0,w*.245,.16,d*.67,A)}for(let y=1;y<h;y+=.65)b(w*.45,y,d*.35,.9,.08,.1,M);
 }else if(o.kit==='crane'){
  b(0,1,0,w,2,d);for(const x of [-w*.4,w*.4])for(const z of [-d*.35,d*.35])b(x,h*.48,z,.8,h*.9,.8,A);b(0,h*.88,0,w,.9,d*.85,A);b(0,h*.96,0,w,.6,1.2,M);b(0,h*.55,0,.09,h*.75,.09,M);b(0,h*.22,0,2,.5,2,A);for(let x=-w*.4;x<=w*.4;x+=2)b(x,h*.84,d*.4,.2,2,.2,A);
 }else if(o.kit==='hangar'||o.kit==='habitat'){
  add(arch,S,0,0,0,w,h,d,0,parent);for(let z=-d/2;z<=d/2;z+=3)add(arch,M,0,0,z,w*1.015,h*1.012,.18,0,parent);b(0,h*.3,d/2+.13,w*.7,h*.6,.22,M);for(let y=1;y<h*.6;y+=.6)b(0,y,d/2+.26,w*.65,.08,.08,A);b(w*.32,h*.5,d/2+.3,1,h*.3,.1,glass);if(o.kit==='habitat'){add(dome,M,0,h*.8,0,w*.45,h*.4,d*.5,0,parent)}
 }else {
  const bodyH=['house','mill','warehouse','factory'].includes(o.kit)?h*.73:h;
  b(0,bodyH/2,0,w,bodyH,d);
  if(['house','mill','warehouse','factory'].includes(o.kit))add(roof,A,0,bodyH,0,w*1.04,h*.27,d*1.04,0,parent);
  else b(0,h,0,w+.35,.3,d+.35,M);
  const floors=Math.max(1,Math.floor(bodyH/3));for(let floor=0;floor<floors;floor++){const y=1.9+floor*2.8;for(let x=-w/2+2;x<w/2-1;x+=3){b(x,y,d/2+.04,1.25,1.1,.09,dark);b(x,y,-d/2-.04,1.25,1.1,.09,glass);b(x,y-.64,d/2+.15,1.5,.14,.35,M)}b(0,y+1.1,0,w+.13,.12,d+.13,M)}
  b(0,1.4,d/2+.12,2.2,2.8,.18,M);
  for(const x of [-w/2+.25,w/2-.25])b(x,bodyH/2,d/2+.1,.35,bodyH,.22,A);
  if(o.kit==='ruin'){for(let k=0;k<5;k++){b(-w*.4+k*w*.2,h+(.5+k%2),-d*.2,1,1+k%2,d*.45);add(rock,S,w*.35-k*w*.16,.6,d*.42,2,.9,1.7,k, parent)}}
  if(o.kit==='tower'){for(const x of [-w/2-.1,w/2+.1])b(x,h/2,0,.25,h,d*.98,M);b(0,h*.65,d/2+.2,w*.6,.35,.2,glass);b(0,h+.8,0,w*.4,1.5,d*.35,M)}
  if(o.kit==='factory'){c(w*.3,h*.75,-d*.2,1.2,h*.5,1.2,M);for(let k=0;k<3;k++)b(-w*.3+k*2,h*.79,0,1.3,.5,3,M)}
  if(o.kit==='mill'){c(0,h+.7,0,.4,2,.4,M);for(const side of [-1,1]){b(side*w*.3,h*.6,d/2+.25,.6,h*.65,.5,M);b(0,h*.6,d/2+.3,w*.9,.5,.6,M)}}
  if(o.kit==='bunker'){b(0,h*.78,d/2+.2,w*.7,.6,.3,dark);b(0,h*.9,d/2+.5,w*.9,.7,1.1,M)}
 }
 // Ground-level pipe valves, drainage, and bollards give scale without new draw calls.
 for(const side of [-1,1]){c(side*w*.4,.45,d*.52,.25,.9,.25,A);b(side*w*.36,.12,-d*.4,1.4,.16,.7,M)}
 }
 // Authored curved roads follow the physical heightfield; no flat mesh floating above hills.
 for(const r of l.roads){const points=r.points.map(([x,z])=>new T.Vector3(x,0,z)),curve=new T.CatmullRomCurve3(points,false,'centripetal'),p=[],uv=[],idxs=[],n=100;
  for(let i=0;i<=n;i++){const at=curve.getPoint(i/n),dir=curve.getTangent(i/n),side=new T.Vector3(-dir.z,0,dir.x).normalize();for(const sign of [-1,1]){const v=at.clone().addScaledVector(side,sign*r.width/2);p.push(v.x,authoredHeight(index,v.x,v.z)+.01,v.z);uv.push(sign===-1?0:1,i/8)}if(i<n){const a=i*2;idxs.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idxs);g.computeVertexNormals();const m=new T.Mesh(g,material(index===2?0x9daeb4:index===6?0x7e8993:0x726e60));m.userData.ownedGeometry=true;world.add(m);
 }
 // Boundary is authored as outlying districts / cliffs, outside the driveable arena.
 for(let i=0;i<20;i++){const a=i*Math.PI/10,x=Math.cos(a)*178,z=Math.sin(a)*178;add(rock,material(l.colors[0]),x,8,z,18,20+i%3*5,20,a);}
 if(l.tree>=0){const count=quality==='low'?20:40;let placed=0;for(let i=0;i<200&&placed<count;i++){const x=Math.sin(i*47.3+index)*132,z=Math.cos(i*19.7+index)*132;if(l.roads.some(r=>r.points.slice(1).some(([bx,bz],j)=>{const [ax,az]=r.points[j],dx=bx-ax,dz=bz-az,f=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*f,z-az-dz*f)<r.width/2+6}))||l.props.some(o=>footprint(x,z,o,8)))continue;const size=8+i%4;add(branchingTree(l.tree,i%3),treeMaterial,x,authoredHeight(index,x,z),z,size,size,size,i);placed++}}
 // Shallow decorative water/lava stays beyond collision bounds, never an invisible driving trap.
 if(index===5||index===7){const m=new T.Mesh(new T.PlaneGeometry(480,480),new T.MeshStandardMaterial({color:index===5?0xa84220:0x365f69,roughness:.24,metalness:.25,emissive:index===5?0x8c2108:0,emissiveIntensity:.8}));m.rotation.x=-Math.PI/2;m.position.y=-1.5;m.userData.ownedGeometry=true;m.userData.ownedMaterial=true;world.add(m)}
 for(const {g,mat,transforms}of batches.values()){const m=new T.InstancedMesh(g,mat,transforms.length);transforms.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.computeBoundingSphere();m.receiveShadow=true;world.add(m)}
 return {instances:[...batches.values()].reduce((n,b)=>n+b.transforms.length,0),batches:batches.size};
}
