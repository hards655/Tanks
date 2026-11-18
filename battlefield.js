import {LEVELS,footprint} from './authored-levels.js';
export function battlefieldPlan(index){const l=LEVELS[index];return {...l,covers:l.props,spawns:[[0,-90],[0,90],[-75,0],[75,0]],lanes:[]}}
export function clearLane(x,z,r=3){return Math.abs(x)<14+r||Math.abs(z)<12+r}
// Segment vs oriented cover box, returning first contact [0,1] or null.
export function coverContact(a,b,o,ground=0){
 const c=Math.cos(o.angle||0),s=Math.sin(o.angle||0);
 const local=p=>({x:(p.x-o.x)*c-(p.z-o.z)*s,y:p.y-ground,z:(p.x-o.x)*s+(p.z-o.z)*c});
 const p=local(a),q=local(b),bounds={x:[-(o.w||o.r*2)/2,(o.w||o.r*2)/2],y:[0,(o.h||4)+.6],z:[-(o.d||o.r*2)/2,(o.d||o.r*2)/2]};let enter=0,exit=1;
 for(const key of ['x','y','z']){const d=q[key]-p[key],[min,max]=bounds[key];if(Math.abs(d)<1e-9){if(p[key]<min||p[key]>max)return null;continue}let lo=(min-p[key])/d,hi=(max-p[key])/d;if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return null}
 return enter;
}
export function sphereContact(a,b,c,r){const x=a.x-c.x,y=a.y-c.y,z=a.z-c.z,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,A=dx*dx+dy*dy+dz*dz,C=x*x+y*y+z*z-r*r;if(C<=0)return 0;if(A<1e-12)return null;const B=x*dx+y*dy+z*dz,D=B*B-A*C;if(D<0)return null;const t=(-B-Math.sqrt(D))/A;return t>=0&&t<=1?t:null}
