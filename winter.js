import * as T from './vendor/three.js';
const bulbGeo=new T.SphereGeometry(.065,8,6),bulbMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
const cableMat=new T.LineBasicMaterial({color:0x26342c});
const colors=[0xff563e,0xffd778,0x62ffb0,0x6fbbff];
export function garland(parent,points,count=36){
 const curve=new T.CatmullRomCurve3(points),g=new T.BufferGeometry().setFromPoints(curve.getPoints(count*2));
 const cable=new T.Line(g,cableMat);cable.userData.ownedGeometry=true;parent.add(cable);
 const bulbs=new T.InstancedMesh(bulbGeo,bulbMat,count),dummy=new T.Object3D();
 for(let i=0;i<count;i++){dummy.position.copy(curve.getPoint(i/(count-1)));dummy.updateMatrix();bulbs.setMatrixAt(i,dummy.matrix);bulbs.setColorAt(i,new T.Color(colors[i%4]))}
 bulbs.computeBoundingSphere();parent.add(bulbs);return bulbs;
}
export function tankGarland(body,turret){
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 garland(body,[V(-1.6,1.6,-1.8),V(-1.6,1.42,0),V(-1.55,1.62,1.8),V(0,1.47,2.15),V(1.55,1.62,1.8),V(1.6,1.42,0),V(1.6,1.6,-1.8)],40);
 garland(turret,[V(-1,.55,-.8),V(-1.18,.4,.2),V(-.65,.58,.75),V(.65,.58,.75),V(1.18,.4,.2),V(1,.55,-.8)],24);
}
export function winterHangar(world,mesh){
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 for(const z of [-12,-5,5])garland(world,[V(-15,7,z),V(-8,6.3,z),V(0,5.8,z),V(8,6.3,z),V(15,7,z)],48);
 // Gantry crane and hoist, pipework, tool stations and a maintenance pit frame.
 for(const side of [-1,1]){
  for(let z=-16;z<=16;z+=8){const brace=mesh('box',0x73828d,side*14,7.8,z,.18,5.8,.22);brace.rotation.z=side*.7}
  mesh('box',0xb49b44,side*12,6,-10,.55,12,.65);
  for(let z=-16;z<=16;z+=8){mesh('box',0x334d59,side*12,1.2,z,2.5,2.4,1.8);for(let k=0;k<4;k++)mesh('box',0x9faab1,side*12,.45+k*.48,z+1,1.9,.08,.08)}
 }
 mesh('box',0xb49b44,0,11.8,-10,25,.8,1.1);mesh('box',0x39484e,3,11,-10,2.3,1,1.8);
 mesh('cyl',0x9aa3aa,3,7.5,-10,.035,6,.035);const hook=mesh('cyl',0xb49b44,3,4.4,-10,.26,.5,.26);hook.rotation.x=.4;
 for(const x of [-4,4])mesh('box',0xd1b657,x,.06,0,.13,.04,10);
 for(let i=0;i<8;i++){const p=mesh('cyl',0x6b7881,-16,3+i*.4,-14,.12,12,.12);p.rotation.x=Math.PI/2}
 for(const side of [-1,1]){const light=new T.PointLight(side<0?0xffd6a2:0x96cfff,28,24,2);light.position.set(side*6,6,3);world.add(light)}
}
