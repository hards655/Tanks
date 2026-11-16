// Deterministic input, weapon and economy rules shared with the test suite.
export function joystickVector(x,y,deadzone=.12){const r=Math.hypot(x,y);if(r<=deadzone)return{x:0,y:0};const m=(Math.min(r,1)-deadzone)/(1-deadzone);return{x:x/r*m,y:y/r*m}}
export function damp(current,target,rate,dt){return current+(target-current)*(1-Math.exp(-rate*dt))}
export const PRODUCTS=[
 {id:'stabilizer',name:'Стабилизатор',category:'equipment',price:950,description:'На 30% быстрее наведение башни. Постоянное оборудование.'},
 {id:'rammer',name:'Досылатель',category:'equipment',price:1100,description:'Перезарядка основного орудия быстрее на 15%.'},
 {id:'cooler',name:'Охлаждение КП-12.7',category:'equipment',price:700,description:'На 35% меньше нагрев крупнокалиберного пулемёта.'},
 {id:'optics',name:'Улучшенная оптика',category:'equipment',price:1300,description:'Увеличенная дальность обзора и более быстрый захват целей.'},
 {id:'spallLiner',name:'Противоосколочный подбой',category:'equipment',price:1450,description:'На 20% меньше урона от фугасов HESH и HE.'},
 {id:'wetRack',name:'Защищённая боеукладка',category:'equipment',price:1250,description:'Повышенная защита модулей от повреждений.'},
 {id:'heavyTracks',name:'Усиленные гусеницы',category:'equipment',price:980,description:'Снижение времени ремонта повреждённых гусениц.'},
 {id:'longBarrel',name:'Усиленный ствол',category:'equipment',price:1750,description:'На 12% выше бронепробитие основного орудия.'},
 {id:'autoloader',name:'Быстрый затвор',category:'equipment',price:1600,description:'Перезарядка ещё на 10% быстрее.'},
 {id:'gunLaying',name:'Приводы наведения',category:'equipment',price:900,description:'Увеличенная скорость поворота башни.'},
 {id:'fieldWorkshop',name:'Полевой инструмент',category:'equipment',price:1100,description:'Усиленные ремкомплекты восстанавливают больше прочности.'},
 {id:'smokeGrenades',name:'Дымовые гранатомёты',category:'equipment',price:1050,description:'Дают заряд дымовой завесы в бою (кнопка ДЫМ).'},
 {id:'ammoPouch',name:'Дополнительные укладки',category:'equipment',price:1100,description:'Дополнительные специальные снаряды в начале боя.'},
 {id:'repairKit',name:'Дополнительный ремкомплект',category:'supplies',price:180,description:'Ещё один ремонт в следующем бою. Расходуется при выходе в бой.'},
 {id:'ammoCrate',name:'Расширенный боекомплект',category:'supplies',price:160,description:'+20 AP, +8 APCR, +6 HE и +120 патронов КП. На один бой.'},
 {id:'overdrive',name:'Усиленное топливо',category:'supplies',price:140,description:'+12% скорости в следующем бою.'},
 {id:'supercharge',name:'Усиленный заряд',category:'supplies',price:220,description:'На один бой: +8% урона основных снарядов.'},
 {id:'rationPack',name:'Экипажный паёк',category:'supplies',price:190,description:'На один бой: +8% скорости перезарядки и поворота башни.'},
 {id:'forest',name:'Лесной камуфляж',category:'paint',price:450,description:'Трёхцветная окраска. Только внешний вид.'},
 {id:'desert',name:'Пустынный камуфляж',category:'paint',price:450,description:'Песочная окраска. Только внешний вид.'},
 {id:'winter',name:'Зимний камуфляж',category:'paint',price:450,description:'Светлая полевая окраска. Только внешний вид.'},
 {id:'admin_ua',name:'Админский: Сине-жёлтый Трезубец',category:'paint',price:0,description:'Сине-жёлтая окраска с гербом-трезубцем. Бесплатный декоративный скин.'}
];
export function migrateProfile(s){s.inventory??={};s.equipment??=[];s.paints??=['factory'];s.loadout??={equipment:[],supplies:[],paint:'factory'};s.loadout.equipment??=[];s.loadout.supplies??=[];s.contract??={day:'',kills:0,wins:0,claimed:false};return s}
export function purchase(s,id){const p=PRODUCTS.find(p=>p.id===id);if(!p)return 'Товар не найден';if(p.category==='equipment'&&s.equipment.includes(id)||p.category==='paint'&&s.paints.includes(id))return 'Уже приобретено';if(s.credits<p.price)return 'Недостаточно кредитов';if(p.category==='supplies'&&(s.inventory[id]||0)>=10)return 'На складе уже 10';s.credits-=p.price;if(p.category==='equipment')s.equipment.push(id);else if(p.category==='paint')s.paints.push(id);else s.inventory[id]=(s.inventory[id]||0)+1;return null}
export function equip(s,id){const p=PRODUCTS.find(p=>p.id===id);if(!p)return 'Товар не найден';if(p.category==='paint'){if(!s.paints.includes(id))return 'Сначала купи окраску';s.loadout.paint=id;return null}const list=s.loadout[p.category];const i=list.indexOf(id);if(i>=0){list.splice(i,1);return null}if(p.category==='equipment'&&!s.equipment.includes(id)||p.category==='supplies'&&!s.inventory[id])return 'Нет на складе';if(list.length>=(p.category==='equipment'?3:2))return p.category==='equipment'?'Доступно три слота':'Доступно два слота';list.push(id);return null}
export function consumeLoadout(s){const used=[];for(const id of s.loadout.supplies){if((s.inventory[id]||0)>0){s.inventory[id]--;used.push(id)}}s.loadout.supplies=s.loadout.supplies.filter(id=>(s.inventory[id]||0)>0);return used}
export function createMG(extra=0){return{belt:60,reserve:240+extra,capacity:60,heat:0,cooldown:0,reloading:0,overheated:false}}
export function reloadMG(m){if(m.reloading||m.belt===m.capacity||m.reserve<=0)return false;m.reloading=4;return true}
export function tickMG(m,dt){m.cooldown=Math.max(0,m.cooldown-dt);m.heat=Math.max(0,m.heat-dt*18);if(m.overheated&&m.heat<35)m.overheated=false;if(m.reloading>0){m.reloading=Math.max(0,m.reloading-dt);if(m.reloading===0){const n=Math.min(m.capacity-m.belt,m.reserve);m.belt+=n;m.reserve-=n}}}
export function consumeMGShot(m,cooled=false){if(m.reloading||m.cooldown>0||m.overheated)return false;if(m.belt===0){reloadMG(m);return false}m.belt--;m.cooldown=.1;m.heat=Math.min(100,m.heat+(cooled?3.9:6));if(m.heat>=100)m.overheated=true;return true}
export function mgDamage(armor,rear){return armor<=60?11:rear?4:0}
