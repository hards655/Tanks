import * as T from './vendor/three.js';
import {LEVELS,authoredHeight,footprint,creekX} from './authored-levels.js';

const horizonColors=[0x617855,0xc49a70,0xb9cbd3,0x47566d,0x69645f,0x574344,0x767986,0x657e81];
const wind={value:0};
let trail=null;
const matrix=new T.Object3D();

function fieldMesh(world,geometry,material){
 const mesh=new T.Mesh(geometry,material);
 mesh.userData.ownedGeometry=true;
 mesh.userData.ownedMaterial=true;
 world.add(mesh);
 return mesh;
}

export function snowSurface(base){
 const material=base.clone();
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying float snowFacing; varying vec3 snowCoord;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   vec3 slope=objectNormal;
   #ifdef USE_INSTANCING
   slope=mat3(instanceMatrix)*(slope/vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz)));
   #endif
   snowFacing=normalize(slope).y; snowCoord=position;`);
  shader.fragmentShader='varying float snowFacing; varying vec3 snowCoord;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float powder=smoothstep(.17,.79,snowFacing+.12*sin(snowCoord.x*26.)*cos(snowCoord.z*21.));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.81,.88,.95),powder*.95);`);
 };
 material.customProgramCacheKey=()=>'alpine-snow-1';
 return material;
}

export function landscape(world,index,quality){
 trail=null;
 const snowy=index===2,steps=quality==='low'?80:144;
 const geo=new T.PlaneGeometry(1,1,steps,12),pos=geo.attributes.position;
 for(let j=0;j<=12;j++)for(let i=0;i<=steps;i++){
  const a=i/steps*Math.PI*2,k=j/12,r=155+k*203;
  const peaks=.56+.19*Math.sin(a*7+index)+.13*Math.sin(a*13+1.4)+.09*Math.cos(a*23);
  const y=-3+Math.sin(k*Math.PI)*peaks*(snowy?104:index===1?64:47)+k*8;
  pos.setXYZ(j*(steps+1)+i,r*Math.cos(a),y,r*Math.sin(a));
 }
 geo.computeVertexNormals();
 const mat=new T.MeshStandardMaterial({color:horizonColors[index],side:T.DoubleSide,roughness:1});
 fieldMesh(world,geo,snowy?snowSurface(mat):mat);
 if(snowy)mat.dispose();
 if(index===0){
  // Shallow ford follows the same bed that supports wheels and projectiles.
  const riverVertices=[],indices=[];
  for(let i=0;i<=160;i++){const z=i*2-160,x=creekX(z),width=3.2+.65*Math.sin(z*.09);
   for(const side of [-1,1])riverVertices.push(x+side*width,authoredHeight(index,x,z)+.48,z);
   if(i<160){const a=2*i;indices.push(a,a+2,a+1,a+1,a+2,a+3)}
  }
  const ribbon=new T.BufferGeometry();ribbon.setAttribute('position',new T.Float32BufferAttribute(riverVertices,3));ribbon.setIndex(indices);ribbon.computeVertexNormals();
  const water=new T.MeshStandardMaterial({color:0x588f85,metalness:.25,roughness:.19});
  water.onBeforeCompile=s=>{s.uniforms.creekTime=wind;s.fragmentShader='uniform float creekTime;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(.045*sin(vViewPosition.z*1.8+creekTime),.025*cos(vViewPosition.x*2.3+creekTime),0.));')};
  fieldMesh(world,ribbon,water);
  let seed=19272;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const vertices=[],colors=[];
  for(let b=0;b<9;b++){
   const x=random()*1.2-.6,z=random()*1.2-.6,h=.35+random()*.52,w=.055+random()*.05;
   vertices.push(x-w,0,z,x+w,0,z,x+.18,h,z+.05);
   colors.push(.12,.19,.045,.17,.24,.06,.51,.59,.18);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  const m=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1});
  m.onBeforeCompile=s=>{s.uniforms.fieldTime=wind;s.vertexShader='uniform float fieldTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=position.y*position.y*.3*sin(fieldTime*1.9+instanceMatrix[3].x*.18+instanceMatrix[3].z*.21);')};
  const count=quality==='low'?1100:3500,grass=new T.InstancedMesh(g,m,count);
  let n=0;
  for(let patch=0;patch<500&&n<count;patch++){const px=random()*286-143,pz=random()*286-143;
   for(let k=0;k<16&&n<count;k++){const x=px+(random()-.5)*12,z=pz+(random()-.5)*12;
    if(Math.abs(x-creekX(z))<4.8)continue;
    if(LEVELS[index].props.some(o=>footprint(x,z,o,1)))continue;
    if(LEVELS[index].roads.some(r=>r.points.slice(1).some(([bx,bz],j)=>{const [ax,az]=r.points[j],dx=bx-ax,dz=bz-az,f=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-f*dx,z-az-f*dz)<r.width*.55})))continue;
    matrix.position.set(x,authoredHeight(index,x,z)-.13,z);matrix.rotation.set(0,random()*6.28,0);matrix.scale.setScalar(.8+random()*.7);matrix.updateMatrix();grass.setMatrixAt(n++,matrix.matrix);
   }
  }grass.count=n;grass.userData.ownedGeometry=true;grass.userData.ownedMaterial=true;world.add(grass);
 }
 if(snowy){
  const count=quality==='low'?512:1536,g=new T.PlaneGeometry(.61,.69);g.rotateX(-Math.PI/2);
  const m=new T.MeshBasicMaterial({color:0x879cae,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new T.InstancedMesh(g,m,count);mesh.count=0;mesh.frustumCulled=false;mesh.userData.ownedGeometry=true;mesh.userData.ownedMaterial=true;world.add(mesh);
  trail={mesh,count,cursor:0,last:new WeakMap()};
 }
}

export function animateLandscape(time,tanks){
 wind.value=time;if(!trail)return;
 for(const t of tanks){if(t.dead)continue;const last=trail.last.get(t);
  if(last&&Math.hypot(t.x-last.x,t.z-last.z)<.7)continue;
  trail.last.set(t,{x:t.x,z:t.z});if(!last)continue;
  for(const side of [-1,1]){const x=t.x+Math.cos(t.yaw)*side*1.55,z=t.z-Math.sin(t.yaw)*side*1.55;
   matrix.position.set(x,authoredHeight(2,x,z)+.045,z);matrix.rotation.set(0,t.yaw,0);matrix.scale.set(1,1,1);matrix.updateMatrix();trail.mesh.setMatrixAt(trail.cursor,matrix.matrix);trail.cursor=(trail.cursor+1)%trail.count;trail.mesh.count=Math.min(trail.count,trail.mesh.count+1);
  }trail.mesh.instanceMatrix.needsUpdate=true;
 }
}
