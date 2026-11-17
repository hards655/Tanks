// Permanent weapon choices: tradeoffs rather than strictly stronger paid guns.
export const WEAPONS={
 standard:{name:'Штатное орудие',price:0,damage:1,reload:1,pen:1,velocity:105,length:1,description:'Сбалансированное орудие. Бесплатно, без ограничений.'},
 marksman:{name:'Длинноствольное орудие',price:1600,damage:.9,reload:1.15,pen:1.25,velocity:145,length:1.18,description:'+25% пробития, снаряд 145 м/с; −10% урона и +15% время перезарядки.'},
 rapid:{name:'Скорострельное орудие',price:1900,damage:.62,reload:.6,pen:.85,velocity:110,length:.85,description:'Перезарядка быстрее на 40%; −38% урона и −15% пробития.'},
 siege:{name:'Штурмовая гаубица',price:2400,damage:1.5,reload:1.6,pen:.8,velocity:80,length:.73,description:'+50% урона; +60% время перезарядки, −20% пробития, снаряд 80 м/с.'}
};
export const WEAPON_PRODUCTS=Object.entries(WEAPONS).map(([id,w])=>({id,category:'weapon',...w}));
export function applyWeapon(t,id){const w=WEAPONS[id]||WEAPONS.standard;t.weapon=id;t.damage*=w.damage;t.reload*=w.reload;t.penMultiplier=w.pen;t.shellVelocity=w.velocity;return t}
export function battleSettlement({win,earned=0,wave=1,survival=false,damage=0,ammo=0,repairs=0,hp=1,maxHp=1,elapsed=0}){
 const completed=win||elapsed>=30||damage>0;
 const base=win?700:completed?220:0,damageBonus=Math.round(Math.max(0,damage)*.085),waveBonus=survival?Math.max(0,wave-1)*250:0;
 const gross=Math.max(0,earned)+base+damageBonus+waveBonus;
 const service=Math.round(Math.max(0,ammo)+Math.max(0,repairs)+(1-Math.min(1,Math.max(0,hp)/Math.max(1,maxHp)))*130);
 const floor=completed?100:0,reward=Math.max(floor,gross-service);return{gross,service,reward,subsidy:Math.max(0,floor-(gross-service)),completed};
}
export function actualDamage(hp,damage){return Math.min(Math.max(0,hp),Math.max(0,damage))}
