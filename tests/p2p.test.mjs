import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Offline integration tests: model two separate browser tabs, a PeerJS signaling
// registry and linked DataChannels. No real external server or internet needed.
const script=readFileSync(new URL('../p2p.js',import.meta.url),'utf8');

function simulator(){
  let now=0, nextId=0;
  const connections=new Map(), events=[], timers=[], links=[];
  class Emitter {
    constructor(){this.handlers=new Map()}
    on(event,cb){const arr=this.handlers.get(event)||[];arr.push(cb);this.handlers.set(event,arr);return this}
    emit(event,...args){for(const cb of this.handlers.get(event)||[])cb(...args)}
  }
  class Peer extends Emitter {
    constructor(id){
      super();this.id=id||'guest'+(++nextId);
      events.push(()=>{
        if(connections.has(this.id))this.emit('error',{type:'unavailable-id'});
        else{connections.set(this.id,this);this.emit('open',this.id)}
      });
    }
    connect(to){
      const peer=connections.get(to),a=new Emitter(),b=new Emitter();
      a.peer=to;b.peer=this.id;a.open=b.open=false;links.push({a,b,from:this.id,to});
      a.send=packet=>events.push(()=>b.emit('data',JSON.parse(JSON.stringify(packet))));
      b.send=packet=>events.push(()=>a.emit('data',JSON.parse(JSON.stringify(packet))));
      a.close=()=>{a.open=b.open=false;a.emit('close');b.emit('close')};
      b.close=()=>a.close();
      if(peer)events.push(()=>{peer.emit('connection',b);a.open=b.open=true;a.emit('open');b.emit('open')});
      else events.push(()=>a.emit('error',{type:'peer-unavailable'}));
      return a;
    }
    destroy(){if(connections.get(this.id)===this)connections.delete(this.id)}
  }
  function timeout(fn,ms=0){
    const t={fn,at:now+ms,cancel:false};
    timers.push(t);return t;
  }
  function interval(fn,ms){
    const t={fn,at:now+ms,period:ms,cancel:false};
    timers.push(t);return t;
  }
  function flush(){
    let n=0;
    while(events.length){
      events.shift()();
      if(++n>10000)throw Error('Network event flood');
    }
  }
  function advance(ms){
    const until=now+ms;let count=0;
    for(;;){
      const due=timers.filter(t=>!t.cancel&&t.at<=until).sort((a,b)=>a.at-b.at)[0];
      if(!due)break;
      now=due.at;
      if(due.period)due.at+=due.period;
      else due.cancel=true;
      due.fn();flush();
      if(++count>30000)throw Error('Timer flood');
    }
    now=until;flush();
  }
  function browser(index){
    const nodes=new Map();
    function el(id){
      if(!nodes.has(id)){
        const handlers=new Map();
        nodes.set(id,{
          id,value:'',textContent:'',hidden:false,disabled:false,style:{},
          classList:{toggle(){}},
          addEventListener(event,cb){handlers.set(event,cb)},
          click(){handlers.get('click')?.()}
        });
      }
      return nodes.get(id);
    }
    const bridge={
      alive:false,x:0,received:[],shots:[],health:100,
      isGarage:()=>true,tankType:()=>index,mapIndex:()=>0,
      launch(roster,id){
        this.alive=true;this.roster=roster;this.id=id;
        timeout(()=>win.STEEL_NET.ready(),80);
      },
      snapshot(){
        return this.alive?{x:this.x,z:0,yaw:0,turretYaw:0,pitch:0,hp:this.health,dead:false,speed:3}:null;
      },
      receiveState(id,state){this.received.push({id,x:state.x})},
      receiveFire(id,kind){this.shots.push({id,kind})},
      receiveHit(damage){this.health-=damage},dropped:[],drop(id){this.dropped.push(id)},hostLost(){}
    };
    const win={Peer,STEEL_NET_BRIDGE:bridge};
    const doc={getElementById:el,createElement(){return {}},head:{appendChild(){}}};
    const context={
      window:win,document:doc,
      crypto:{getRandomValues(arr){arr.fill(index+4);return arr}},
      performance:{now:()=>now},setTimeout:timeout,
      clearTimeout:timer=>{if(timer)timer.cancel=true},
      setInterval:interval,console:{warn(){}}
    };
    runInNewContext(script,context,{timeout:2000});
    return {el,bridge,win};
  }
  return {browser,flush,advance,links};
}
test('manual room synchronizes both tank positions and firing in both directions',()=>{
  const sim=simulator(),host=sim.browser(0),guest=sim.browser(1);
  host.el('p2pOpen').click();guest.el('p2pOpen').click();
  host.el('p2pCreate').click();sim.flush();
  guest.el('p2pCode').value=host.el('p2pKey').textContent;
  guest.el('p2pJoin').click();sim.flush();
  assert.match(host.el('p2pPlayers').textContent,/•/);
  host.el('p2pLaunch').click();sim.flush();
  host.bridge.x=35;guest.bridge.x=-14;
  sim.advance(650);
  assert.equal(host.win.STEEL_NET.active,true);
  assert.equal(guest.win.STEEL_NET.active,true);
  assert.ok(host.bridge.received.some(x=>x.x===-14),'host must receive guest movement');
  assert.ok(guest.bridge.received.some(x=>x.x===35),'guest must receive host movement');
  host.win.STEEL_NET.fire('cannon',0);
  guest.win.STEEL_NET.fire('mg',0);
  sim.flush();
  assert.ok(host.bridge.shots.some(x=>x.kind==='mg'));
  assert.ok(guest.bridge.shots.some(x=>x.kind==='cannon'));
  assert.ok(host.win.STEEL_NET.diagnostics.statesReceived>0);
  assert.ok(guest.win.STEEL_NET.diagnostics.statesReceived>0);
});
test('automatic matchmaking connects two players and starts synchronized battle',()=>{
  const sim=simulator(),host=sim.browser(0),guest=sim.browser(1);
  host.el('p2pOpen').click();guest.el('p2pOpen').click();
  host.el('p2pAuto').click();sim.flush();
  guest.el('p2pAuto').click();sim.flush();
  sim.advance(7200);
  assert.equal(host.win.STEEL_NET.active,true);
  assert.equal(guest.win.STEEL_NET.active,true);
  host.bridge.x=15;guest.bridge.x=-7;
  sim.advance(700);
  assert.ok(host.bridge.received.some(x=>x.x===-7));
  assert.ok(guest.bridge.received.some(x=>x.x===15));
  assert.equal(host.win.STEEL_NET.diagnostics.players,2);
  assert.equal(guest.win.STEEL_NET.diagnostics.players,2);
});

function manualThree(){
 const sim=simulator(),tabs=[0,1,2].map(i=>sim.browser(i));
 tabs.forEach(t=>t.el('p2pOpen').click());tabs[0].el('p2pCreate').click();sim.flush();
 for(const t of tabs.slice(1)){t.el('p2pCode').value=tabs[0].el('p2pKey').textContent;t.el('p2pJoin').click();sim.flush()}
 tabs[0].el('p2pLaunch').click();sim.flush();sim.advance(200);return {sim,tabs};
}
test('host relays guest movement and disconnect to the third player',()=>{
 const {sim,tabs:[host,a,b]}=manualThree();a.bridge.x=81;sim.advance(100);
 assert.ok(b.bridge.received.some(s=>s.id===a.bridge.id&&s.x===81));
 sim.links.find(l=>l.from===a.bridge.id).a.close();sim.flush();
 assert.ok(host.bridge.dropped.includes(a.bridge.id));assert.ok(b.bridge.dropped.includes(a.bridge.id));
});
test('stale, replayed and non-finite snapshots cannot rewind a player',()=>{
 const {sim,tabs:[host,a,b]}=manualThree(),link=sim.links.find(l=>l.from===a.bridge.id);
 const packet={t:'state',seq:900,s:{...a.bridge.snapshot(),x:88}};
 link.a.send(packet);sim.flush();const count=b.bridge.received.length;
 link.a.send({...packet,seq:899,s:{...packet.s,x:12}});link.a.send(packet);link.a.send({...packet,seq:901,s:{...packet.s,x:null}});sim.flush();
 assert.equal(b.bridge.received.length,count);assert.equal(b.bridge.received.at(-1).x,88);
});
test('incoming snapshots are buffered until the receiving scene is ready',()=>{
 const sim=simulator(),host=sim.browser(0),guest=sim.browser(1);
 host.el('p2pOpen').click();guest.el('p2pOpen').click();host.el('p2pCreate').click();sim.flush();
 guest.el('p2pCode').value=host.el('p2pKey').textContent;guest.el('p2pJoin').click();sim.flush();host.el('p2pLaunch').click();sim.flush();
 host.bridge.x=42;host.win.STEEL_NET.stateNow();sim.flush();assert.equal(guest.bridge.received.length,0);
 sim.advance(80);assert.ok(guest.bridge.received.some(s=>s.x===42));
});
