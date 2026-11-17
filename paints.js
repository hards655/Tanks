export const PAINTS={
 factory:{name:'Заводская',colors:[0x6c7956,0x6c7956,0x47513d],pattern:'solid',price:0},
 forest:{name:'Лесной охотник',colors:[0x587246,0x293b35,0xb6a777],pattern:'blot',price:450},
 desert:{name:'Песчаная буря',colors:[0xd3ac6b,0x815746,0xead5a1],pattern:'blot',price:450},
 winter:{name:'Северный призрак',colors:[0xe1e8dd,0x668a9a,0x354d63],pattern:'splinter',price:450},
 admin_ua:{name:'Сине-жёлтый Трезубец',colors:[0x2077c8,0xffd44e,0x2077c8],pattern:'flag',price:0},
 urban:{name:'Городской осколок',colors:[0x8f9d9b,0x334249,0xd0b8a0],pattern:'splinter',price:550},
 digital:{name:'Цифровой лес',colors:[0x708957,0x293d36,0xb5c580],pattern:'digital',price:650},
 tiger:{name:'Ржавый тигр',colors:[0xc3743d,0x272b33,0xe8b565],pattern:'stripe',price:700},
 arcticDigital:{name:'Полярный пиксель',colors:[0xd9e5e3,0x527186,0x91bec9],pattern:'digital',price:650},
 volcanic:{name:'Магма',colors:[0x42343e,0xf07335,0x1e2430],pattern:'crack',price:800},
 neon:{name:'Неоновый рейдер',colors:[0x34374d,0x54cbbd,0xc365a2],pattern:'stripe',price:850},
 naval:{name:'Морской дозор',colors:[0x355969,0x9ac8ba,0x243544],pattern:'splinter',price:550},
 lunar:{name:'Лунная пыль',colors:[0xa3a6ae,0x565b74,0xd6cbb5],pattern:'blot',price:600},
 hazard:{name:'Опасный груз',colors:[0xe4bd4e,0x343740,0x9d703e],pattern:'stripe',price:750}
};
export function paintBand(pattern,x,y){if(pattern==='solid')return 0;if(pattern==='flag')return y<.5?0:1;if(pattern==='digital')return ((Math.floor(x*24)*7^Math.floor(y*24)*13)&15)%3;if(pattern==='stripe')return Math.floor((x+y*.45+Math.sin(y*20)*.05)*12)%3;if(pattern==='splinter')return Math.floor((x*5+y*8+Math.abs(Math.sin(x*17)))*2)%3;if(pattern==='crack')return Math.abs(Math.sin(x*18+Math.sin(y*9)*2)*Math.sin(y*23+x*2))<.12?1:0;const f=Math.sin(x*16+Math.sin(y*12)*2)+Math.cos(y*20+Math.sin(x*11)*2);return f>.6?0:f<-.5?1:2}
