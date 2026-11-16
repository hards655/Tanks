import * as T from './vendor/three.js';
export const BIOMES=[
 {name:'Зелёная долина',ground:0x718453,rock:0x6b7562,sky:0x5e9cbb,haze:0xc1d0a2,accent:0xd7aa61,kind:'village'},
 {name:'Пустынный рубеж',ground:0xc69c62,rock:0xa16848,sky:0x7fa9b7,haze:0xe7c793,accent:0x6ac1bd,kind:'desert'},
 {name:'Зимний фронт',ground:0xd1e1db,rock:0x728c9b,sky:0x729abb,haze:0xc8e1e5,accent:0xe8a756,kind:'depot'},
 {name:'Неоновый каньон',ground:0x454456,rock:0x353b56,sky:0x343153,haze:0x8e7b98,accent:0x63d7c4,kind:'neon'},
 {name:'Ржавый мегаполис',ground:0x96816b,rock:0x626b6b,sky:0x768e9a,haze:0xc1b49b,accent:0xdd854a,kind:'foundry'},
 {name:'Вулканический разлом',ground:0x59525b,rock:0x403d4d,sky:0x66556c,haze:0xb98e83,accent:0xffa34b,kind:'volcano'},
 {name:'Лунная база',ground:0xa3a4ae,rock:0x6b7487,sky:0x151e39,haze:0x53627d,accent:0x80d9da,kind:'moon'},
 {name:'Затопленный порт',ground:0x7c9590,rock:0x546d79,sky:0x628da5,haze:0xb2c9bd,accent:0xe6bb55,kind:'port'}
];
export function heightAt(x,z,idx=0){const edge=Math.min(1,Math.max(0,(Math.abs(x)-18)/45))*Math.min(1,Math.max(0,(Math.abs(z)-18)/45));return edge*(idx===1?1.6:idx===5?1.2:.65)*Math.sin(x*.035)*Math.cos(z*.045)}
// Authored cover islands leave north/south, east/west and flanking lanes open.
export function mapPlan(idx){const plans=[
 [[-38,-55,12,10,'house'],[-55,-25,10,12,'house'],[40,55,12,10,'house'],[56,27,10,12,'house'],[-74,60,18,14,'mill'],[74,-60,18,14,'mill']],
 [[-35,-45,16,12,'ruin'],[35,45,16,12,'ruin'],[-68,35,18,18,'pump'],[68,-35,18,18,'pump'],[-83,-78,13,17,'ruin'],[83,78,13,17,'ruin']],
 [[-42,-52,24,13,'depot'],[42,52,24,13,'depot'],[-65,38,15,15,'bunker'],[65,-38,15,15,'bunker'],[-100,-20,12,14,'bunker'],[100,20,12,14,'bunker']],
 [[-38,-62,15,18,'tower'],[-38,-22,15,18,'tower'],[38,62,15,18,'tower'],[38,22,15,18,'tower'],[-87,40,20,25,'tower'],[87,-40,20,25,'tower']],
 [[-40,-55,26,17,'factory'],[40,55,26,17,'factory'],[-72,40,16,16,'tank'],[72,-40,16,16,'tank'],[-105,-60,17,22,'ruin'],[105,60,17,22,'ruin']],
 [[-40,-50,22,14,'basalt'],[40,50,22,14,'basalt'],[-78,40,22,24,'vent'],[78,-40,22,24,'vent'],[-105,-75,15,18,'basalt'],[105,75,15,18,'basalt']],
 [[-42,-52,20,20,'dome'],[42,52,20,20,'dome'],[-75,35,14,22,'habitat'],[75,-35,14,22,'habitat'],[-105,-70,12,12,'dish'],[105,70,12,12,'dish']],
 [[-40,-55,24,12,'containers'],[40,55,24,12,'containers'],[-70,35,18,24,'warehouse'],[70,-35,18,24,'warehouse'],[-110,-65,15,15,'crane'],[110,65,15,15,'crane']]
 ];return plans[idx].map(([x,z,w,d,type])=>({x,z,w,d,type,r:Math.hypot(w,d)/2}));}
export function makeBattlefield({idx,world,mesh,mat,geo,obstacles,batchRigid,quality}){
 const b=BIOMES[idx],h=(x,z)=>heightAt(x,z,idx),box=(x,y,z,w,ht,d,c)=>mesh('box',c,x,y,z,w,ht,d),cyl=(x,y,z,r,ht,c)=>mesh('cyl',c,x,y,z,r,ht,r);
 const groundGeo=new T.PlaneGeometry(350,350,72,72);groundGeo.rotateX(-Math.PI/2);const a=groundGeo.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,h(a.getX(i),a.getZ(i))-.08);groundGeo.computeVertexNormals();const ground=new T.Mesh(groundGeo,mat(b.ground));ground.receiveShadow=true;ground.userData.ownedGeometry=true;world.add(ground);
 // Road geometry follows the exact same height function as vehicle collision.
 const road=(points,width,color)=>{const dense=[points[0]];for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let k=1;k<=n;k++)dense.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}points=dense;const vertices=[],uv=[];let offset=0;for(let k=1;k<points.length;k++){const [ax,az]=points[k-1],[bx,bz]=points[k],len=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/len*width/2,nz=(bx-ax)/len*width/2;const v=[[ax+nx,az+nz],[ax-nx,az-nz],[bx+nx,bz+nz],[bx-nx,bz-nz]];for(const i of [0,2,1,2,3,1]){const [x,z]=v[i];vertices.push(x,h(x,z)+.025,z);uv.push(i%2,offset+(i>1?len:0))}offset+=len}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=new T.Mesh(g,mat(color));m.receiveShadow=true;m.userData.ownedGeometry=true;world.add(m)};
 const roadColor=new T.Color(b.ground).multiplyScalar(.74).getHex();road([[0,-145],[0,145]],13,roadColor);road([[-145,0],[145,0]],13,roadColor);road([[-105,-120],[-110,0],[-105,120]],10,roadColor);road([[105,-120],[110,0],[105,120]],10,roadColor);
 const ink=0x28303b,trim=b.accent;
 for(const p of mapPlan(idx)){const {x,z,w,d,type}=p,y=h(x,z);obstacles.push({...p,kind:'rect',height:({house:9,mill:17,ruin:9,pump:18,depot:8,bunker:4,tower:34,factory:19,tank:9,basalt:13,vent:13,dome:9,habitat:8,dish:14,containers:4,warehouse:8,crane:19})[type]});
 const building=(height,color)=>{box(x,y+height/2,z,w,height,d,color);box(x,y+height+.18,z,w+.5,.36,d+.5,ink);for(const side of [-1,1]){box(x+side*(w*.5+.025),y+height*.5,z,.06,height*.8,d*.84,trim);for(let n=-1;n<=1;n++)box(x+n*w*.25,y+height*.6,z+d*.5+.055,w*.12,height*.2,.08,ink)}};
 if(type==='house'||type==='mill'){building(type==='mill'?8:5,0xc3b68c);const roof=mesh('cone',0x79564d,x,y+7,z,w*.76,4,d*.82);roof.rotation.y=Math.PI/4;for(const side of [-1,1])box(x+side*w*.4,y+2.6,z+d/2+.12,.24,5,.24,0x4c4d41);if(type==='mill'){cyl(x,y+12,z,.25,10,ink);for(let k=0;k<4;k++){const sail=box(x,y+12,z+d*.51,1.2,10,.25,trim);sail.rotation.z=k*Math.PI/2}}}
 else if(['depot','factory','warehouse','habitat'].includes(type)){building(type==='factory'?11:7,idx===6?0xbfc9c5:b.rock);box(x,y+3,z+d/2+.08,w*.45,5,.12,ink);for(let k=-2;k<=2;k++)box(x+k*w*.17,y+7.4,z,.25,.7,d,trim);if(type==='factory')for(const k of [-1,1]){cyl(x+k*w*.28,y+12,z-d*.2,1.3,13,ink);cyl(x+k*w*.28,y+18,z-d*.2,1.4,.5,trim)}}
 else if(type==='tower'){const ht=18+(Math.abs(x)>70?12:0);building(ht,b.rock);for(let yy=4;yy<ht;yy+=4){box(x,y+yy,z+d/2+.09,w*.8,.3,.14,trim);box(x-w/2-.09,y+yy,z,.14,.3,d*.8,0xca79ae)}box(x,y+ht+2,z,w*.55,3,d*.55,ink)}
 else if(type==='bunker'||type==='ruin'){building(type==='bunker'?3.5:5,b.rock);box(x,y+2,z+d*.51,w*.6,.6,.15,ink);if(type==='ruin'){box(x-w*.3,y+6.8,z-d*.3,1.4,3.6,d*.4,b.rock);box(x+w*.35,y+.5,z,2,1,3,trim)}}
 else if(type==='containers'){for(let row=-1;row<=1;row++){const zz=z+row*d*.26,c=[trim,0x547f87,0xb9664d][row+1];box(x,y+2,zz,w,4,d*.24,c);for(let j=-5;j<=5;j++)box(x+j*w/12,y+2,zz+d*.13,.14,3.6,.13,ink)}}
 else if(type==='tank'||type==='pump'){cyl(x,y+4,z,w*.38,8,b.rock);cyl(x,y+8.2,z,w*.4,.4,trim);for(let n=0;n<3;n++)cyl(x,y+2+n*2.4,z,w*.39,.16,ink);if(type==='pump'){box(x,y+13,z,1,10,1,ink);box(x,y+17,z,w*.8,.9,1,trim);box(x+w*.35,y+12,z,.2,9,.2,ink)}}
 else if(type==='basalt'||type==='vent'){for(let i=-1;i<=1;i++){const r=mesh('cyl',b.rock,x+i*w*.24,y+4+Math.abs(i)*2,z, w*.22,8+Math.abs(i)*4,d*.45);r.rotation.y=.2*i}if(type==='vent')cyl(x,y+8.3,z,w*.22,.35,trim)}
 else if(type==='dome'){mesh('sphere',0xc7cfcb,x,y+1,z,w*.5,7,d*.5);cyl(x,y+.6,z,w*.51,1.2,ink);box(x,y+1.5,z+d*.45,5,3,4,trim);for(let i=-2;i<=2;i++)box(x+i*2.4,y+3,z-d*.42,1.8,.12,4,0x426b85)}
 else if(type==='dish'){cyl(x,y+4,z,1.1,8,b.rock);const dish=mesh('sphere',0xc2d4d5,x,y+9,z,6,1.2,6);dish.rotation.z=.4;cyl(x,y+10,z,.12,5,trim)}
 else if(type==='crane'){for(const side of [-1,1])box(x+side*w*.4,y+9,z,1.3,18,1.3,trim);box(x,y+18,z,w+5,1.2,2,trim);box(x,y+11,z,.12,14,.12,ink);box(x,y+4,z,4,.5,4,ink)}
 }
 // Low cover gives tactical stops; all visible cover has matching collision.
 for(const [x,z]of [[-20,-24],[20,24],[-65,-92],[65,92],[-85,90],[85,-90]]){const y=h(x,z);box(x,y+1.1,z,7,2.2,3,b.rock);box(x,y+2.3,z,7.2,.2,3.2,trim);obstacles.push({x,z,w:7,d:3,r:4,kind:'rect',height:2.4})}
 // Instanced vegetation, stones or solar pylons by biome, away from cover and routes.
 const count=quality==='low'?48:100,trunk=new T.InstancedMesh(geo.cyl,mat(ink),count),crown=new T.InstancedMesh(idx===0?geo.sphere:idx===2?geo.cone:geo.sphere,mat(idx===0?0x456548:idx===2?0x4c7375:b.rock),count),obj=new T.Object3D();let used=0,seed=542+idx*37;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<400&&used<count;i++){const x=(random()-.5)*270,z=(random()-.5)*270;if(Math.abs(x)<20||Math.abs(z)<18||Math.abs(Math.abs(x)-108)<12||obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+8))continue;const tree=idx===0||idx===2,hh=tree?4+random()*3:1+random()*2;obj.position.set(x,h(x,z)+hh*.4,z);obj.scale.set(tree?.25:.3,hh*.8,tree?.25:.3);obj.rotation.set(0,random()*6,0);obj.updateMatrix();trunk.setMatrixAt(used,obj.matrix);obj.position.y=h(x,z)+hh;obj.scale.set(tree?2:1.5,tree?(idx===2?hh:2.8):1.2,tree?2:1.5);obj.updateMatrix();crown.setMatrixAt(used,obj.matrix);used++}
 trunk.count=crown.count=used;world.add(trunk,crown);crown.castShadow=true;
 // Scenic ring is outside the playable boundary, avoiding invisible collision walls.
 for(let i=0;i<24;i++){const a=i*Math.PI/12,x=Math.sin(a)*173,z=Math.cos(a)*173;if(idx===3||idx===4)box(x,17,z,18,34,22,b.rock);else mesh('sphere',b.rock,x,5,z,18,15+(i%4)*4,20)}
 if(idx===7){box(-161,-.18,0,25,.1,300,0x3c8b9b);box(161,-.18,0,25,.1,300,0x3c8b9b)}
 if(idx===5)for(const side of [-1,1])box(side*153,-.05,0,5,.1,280,trim);
 batchRigid(world);return b;
}
