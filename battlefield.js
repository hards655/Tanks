// Seeded tactical arenas: three driveable lanes, staggered cover and clear spawns.
export function battlefieldPlan(index){
 let seed=(9281+index*701)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const covers=[];
 for(const x of [-102,-29,29,102])for(const z of [-68,-28,28,68]){
  const mirrored=Math.sign(x),dx=(random()-.5)*4;
  covers.push({x:x+dx,z:z+(random()-.5)*5,r:6.5,w:9,d:7,h:2.7+random()*1.6,angle:mirrored*.12,kind:(covers.length+index)%3});
 }
 for(const z of [-108,108])for(const x of [-100,-36,36,100])covers.push({x,z,r:7,w:11,d:7,h:4,angle:0,kind:2});
 return {covers,lanes:[-64,0,64],spawns:[[0,-90],[0,90],[-75,0],[75,0]],seed};
}
export function clearLane(x,z,r=3){return Math.abs(x)<14+r||Math.abs(x-64)<12+r||Math.abs(x+64)<12+r||Math.abs(z)<12+r}
// Segment vs oriented cover box, returning first contact [0,1] or null.
export function coverContact(a,b,o,ground=0){
 const c=Math.cos(o.angle||0),s=Math.sin(o.angle||0);
 const local=p=>({x:(p.x-o.x)*c-(p.z-o.z)*s,y:p.y-ground,z:(p.x-o.x)*s+(p.z-o.z)*c});
 const p=local(a),q=local(b),bounds={x:[-(o.w||o.r*2)/2,(o.w||o.r*2)/2],y:[0,(o.h||4)+.6],z:[-(o.d||o.r*2)/2,(o.d||o.r*2)/2]};let enter=0,exit=1;
 for(const key of ['x','y','z']){const d=q[key]-p[key],[min,max]=bounds[key];if(Math.abs(d)<1e-9){if(p[key]<min||p[key]>max)return null;continue}let lo=(min-p[key])/d,hi=(max-p[key])/d;if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return null}
 return enter;
}
export function sphereContact(a,b,c,r){const x=a.x-c.x,y=a.y-c.y,z=a.z-c.z,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,A=dx*dx+dy*dy+dz*dz,C=x*x+y*y+z*z-r*r;if(C<=0)return 0;if(A<1e-12)return null;const B=x*dx+y*dy+z*dz,D=B*B-A*C;if(D<0)return null;const t=(-B-Math.sqrt(D))/A;return t>=0&&t<=1?t:null}
