// Layout in CSS pixels. Hit areas and rendered buttons use the same rectangles.
export const CONTROL_IDS=['joystick','smokeBtn','center','lock','aim','repair','ammo','mgReload','mg','fire'];
export const overlaps=(a,b,gap=6)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
export function controlLayout(width,height,scale=1,custom={},safe={left:12,right:12,bottom:12}){
 const pad=Math.max(10,safe.bottom||0),left=Math.max(12,safe.left||0),right=Math.max(12,safe.right||0);
 const cell=Math.max(44,Math.min(70*scale,(height-126-pad-16)/3,(width/2-108-right-16)/3));
 const gap=8,block=3*cell+2*gap,x=width-right-block,y=height-pad-block;
 const positions={smokeBtn:[0,2],center:[0,0],lock:[1,0],aim:[2,0],repair:[0,1],ammo:[1,1],mgReload:[2,1],mg:[1,2],fire:[2,2]};
 const stick=Math.min(132*scale,Math.max(90,height*.34),x-left-24),out={joystick:{x:left+4,y:height-pad-stick,w:stick,h:stick}};
 for(const [id,[col,row]]of Object.entries(positions)){const diameter=Math.max(44,id==='fire'?cell:id==='mg'?cell*.94:cell*.83);out[id]={x:x+col*(cell+gap)+(cell-diameter)/2,y:y+row*(cell+gap)+(cell-diameter)/2,w:diameter,h:diameter}}
 const reserved=[{x:0,y:0,w:width,h:106},{x:width/2-95,y:height-35,w:190,h:35}];
 for(const id of CONTROL_IDS){const p=custom[id];if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const box={...out[id],x:p.x*width/100,y:p.y*height/100};if(box.x<left||box.y<110||box.x+box.w>width-right||box.y+box.h>height-pad)continue;if(reserved.some(r=>overlaps(box,r,0))||Object.entries(out).some(([other,r])=>other!==id&&overlaps(box,r)))continue;out[id]=box}
 return out;
}
export function canPlaceControl(id,box,layout,width,height){if(box.x<10||box.y<110||box.x+box.w>width-10||box.y+box.h>height-10)return false;return !Object.entries(layout).some(([key,r])=>key!==id&&overlaps(box,r))&&!overlaps(box,{x:width/2-95,y:height-35,w:190,h:35},0)}
