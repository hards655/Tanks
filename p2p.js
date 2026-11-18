/* STEEL THUNDER: experimental browser-to-browser multiplayer.
   PeerJS cloud is used only for signaling; game packets travel over WebRTC DataChannels. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const nickParts = ['Вихрь', 'Титан', 'Рысь', 'Гром', 'Сокол', 'Фантом', 'Барс', 'Шторм'];
  const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
  const safeName = s => String(s || '').trim().replace(/[<>]/g, '').slice(0, 22) || 'Танкист';
  const validTank = v => Number.isInteger(v) && v >= 0 && v <= 4 ? v : 0;
  let peer = null, host = false, room = '', nickname = '', myId = '', running = false;
  let peers = new Map(), roster = [], hostConn = null, loading = false, pendingPeerLoad=null;
  let sendAt = 0, snapSeq = 0;
  let packetsSent = 0, packetsReceived = 0, statesReceived = 0, lastSnapshotAt = 0, lastDataAt = 0, lastPingAt = 0, rtt = null;
  let ready = false;
  const latestStates = new Map(), receivedSeq = new Map();
  function deliverStates() { if(ready) latestStates.forEach((p,id)=>bridge()?.receiveState(id,p.s)); }
  // Public deterministic PeerJS IDs serve as queue slots; no peer listing is needed.
  let auto = false, autoSlot = 0, generation = 0, autoTimer = null;
  let autoProbeTimer = null, autoRetryTimer = null, autoRetrying = false;
  const AUTO_SLOTS = 12;
  let searchStarted=0;
  function networkFailure(message){close();status(message+' Проверь интернет и повтори поиск.');}
  const autoPeerId = n => 'steel-tanks-auto-v2-slot-' + n;
  function clearAutoTimers() {
    clearTimeout(autoTimer); clearTimeout(autoProbeTimer); clearTimeout(autoRetryTimer);
    autoTimer = autoProbeTimer = autoRetryTimer = null; autoRetrying = false;
  }
  function autoStatus() {
    $('p2pAuto').disabled = auto;
    $('p2pCancel').hidden = !auto;
    $('p2pCreate').disabled = auto;
    $('p2pJoin').disabled = auto;
    $('p2pCopy').disabled = auto;
  }
  function autoLaunchSoon() {
    if (!auto || !host || running || roster.length < 2) return;
    clearTimeout(autoTimer);
    const delay = roster.length >= 4 ? 1300 : roster.length === 3 ? 4000 : 6500;
    status('Игроки найдены (' + roster.length + '/4). Бой начнётся автоматически…');
    autoTimer = setTimeout(() => {
      if (auto && host && !running && roster.length >= 2) launch();
    }, delay);
  }
  function autoAdvance(reason) {
    if (!auto || running || autoRetrying) return;
    autoRetrying = true;
    clearTimeout(autoProbeTimer);
    const current = autoSlot;
    status(reason || 'Ищем другую комнату…');
    autoRetryTimer = setTimeout(() => {
      if (auto && !running) autoScan(current + 1);
    }, 260);
  }

  const bridge = () => window.STEEL_NET_BRIDGE;
  function status(s) { $('p2pStatus').textContent = s; }
  function publishRoster() {
    $('p2pPlayers').textContent = 'Игроки: ' + (roster.map(p => p.name).join(' • ') || 'нет');
    $('p2pLaunch').hidden = !host || running || auto;
    $('p2pLaunch').disabled = roster.length < 2;
  }
  function sendConn(c, data) {
    if (!c || !c.open) return false;
    try {
      c.send(data);
      packetsSent++;
      return true;
    } catch (e) {
      console.warn('[STEEL P2P] Failed to send packet:', e);
      return false;
    }
  }
  function relay(data, except = '') {
    peers.forEach((c, id) => { if (id !== except) sendConn(c, data); });
  }
  function packet(data, conn) {
    if (!data || typeof data !== 'object' || typeof data.t !== 'string') return;
    packetsReceived++;
    lastDataAt = performance.now();
    if (data.t === 'hello' && host) {
      if(roster.some(p=>p.id===conn.peer)){sendConn(conn,{t:'roster',roster});return;}
      if (running || roster.length >= 4) { sendConn(conn, {t:'error', code:'busy', msg:'Комната закрыта или заполнена'}); setTimeout(() => conn.close(), 250); return; }
      const name = safeName(data.name);
      roster = roster.filter(p => p.id !== conn.peer);
      roster.push({id:conn.peer, name:name, type:validTank(data.tank)});
      relay({t:'roster', roster:roster});
      publishRoster();
      if (auto) autoLaunchSoon();
      else status('Комната ' + room + ' • игроков: ' + roster.length + '/4');
      return;
    }
    if (data.t === 'roster' && !host && Array.isArray(data.roster)) {
      roster = data.roster.slice(0, 4).map(p => ({id:String(p.id || '').slice(0,80), name:safeName(p.name), type:validTank(p.type)}));
      publishRoster();
      if (auto) {
        clearTimeout(autoProbeTimer);
        status('Матч найден! Игроков ' + roster.length + '/4. Ждём автоматического старта…');
      } else status('В комнате ' + roster.length + '/4. Ожидаем запуска хостом.');
      return;
    }
    if (data.t === 'start' && !host && Array.isArray(data.roster) && !running) {
      roster = data.roster.slice(0, 4);
      const map = Math.max(0, Math.min(7, Number(data.map) || 0));
      running = true;
      packetsSent=packetsReceived=statesReceived=0; lastDataAt=lastSnapshotAt=performance.now(); ready=false;
      $('p2pLobby').hidden = true;
      bridge()?.launch(roster, myId, map);
      return;
    }
    if (data.t === 'error') {
      if (auto && data.code === 'busy') autoAdvance('Комната занята. Продолжаем поиск…');
      else status(String(data.msg || 'Ошибка соединения'));
      return;
    }
    if (!running) return;
    if (data.t === 'ready') {
      // The guest has finished building the 3D scene. Re-send a fresh host snapshot.
      if (host && roster.some(p => p.id === conn.peer)) {
        const s = bridge()?.snapshot();
        if (s) sendConn(conn, {t:'state', id:myId, seq:++snapSeq, s});
        latestStates.forEach((p,id)=>{if(id!==conn.peer)sendConn(conn,p)});
        sendConn(conn, {t:'ready-ack'});
      }
      return;
    }
    if (data.t === 'drop' && !host) {
      const gone=String(data.id||''); roster=roster.filter(p=>p.id!==gone); latestStates.delete(gone); bridge()?.drop(gone); return;
    }
    if (data.t === 'ready-ack') {
      const s = bridge()?.snapshot();
      if (s) send({t:'state',id:myId,s,seq:++snapSeq});
      return;
    }
    if (data.t === 'ping') {
      if (Number.isFinite(data.ts)) sendConn(conn, {t:'pong',ts:data.ts});
      return;
    }
    if (data.t === 'pong') {
      if (Number.isFinite(data.ts)) rtt = Math.max(0,Math.round(performance.now()-data.ts));
      return;
    }
    const id = host ? conn.peer : String(data.id || '');
    if (!roster.some(p => p.id === id)) return;
    if (data.t === 'state') {
      if (!data.s || typeof data.s !== 'object' || !Number.isSafeInteger(data.seq) || data.seq<0) return;
      if(data.seq <= (receivedSeq.get(id) ?? -1)) return;
      if(!['x','z','yaw','turretYaw','pitch','hp','speed'].every(k=>Number.isFinite(data.s[k]))) return;
      receivedSeq.set(id,data.seq); latestStates.set(id,{t:'state',id,seq:data.seq,s:data.s});
      statesReceived++;
      lastSnapshotAt = performance.now();
      if(ready) bridge()?.receiveState(id, data.s);
      if (host) relay({t:'state', id:id, seq:data.seq, s:data.s}, conn.peer);
    } else if (data.t === 'fire') {
      if (data.kind !== 'cannon' && data.kind !== 'mg') return;
      bridge()?.receiveFire(id, data.kind, data.ammo, data.yaw, data.pitch);
      if (host) relay({t:'fire', id:id, kind:data.kind, ammo:data.ammo, yaw:data.yaw, pitch:data.pitch}, conn.peer);
    } else if (data.t === 'hit') {
      const dmg = Number(data.amount);
      if (!Number.isFinite(dmg) || dmg <= 0 || dmg > 1500 || !roster.some(p=>p.id === data.target)) return;
      if (data.target === myId) bridge()?.receiveHit(dmg);
      if (host) relay({t:'hit', id:id, target:data.target, amount:dmg}, conn.peer);
    }
  }
  function connected(c) {
    const stamp = generation;
    const helloTimeout=setTimeout(()=>{if(stamp===generation&&host&&!roster.some(p=>p.id===c.peer))c.close()},10000);
    if (host && peers.size >= 3) { c.close(); return; }
    if (host) peers.set(c.peer, c); else hostConn = c;
    c.on('data', d => { if (stamp === generation) packet(d,c); });
    c.on('close', () => {
      clearTimeout(helloTimeout);
      if (stamp !== generation) return;
      if (host) {
        peers.delete(c.peer);
        roster = roster.filter(p => p.id !== c.peer);
        if (!running) {
          relay({t:'roster',roster:roster}); publishRoster();
          if (auto) {
            clearTimeout(autoTimer);
            if (roster.length >= 2) autoLaunchSoon();
            else status('Ждём второго игрока…');
          }
        } else { latestStates.delete(c.peer); relay({t:'drop',id:c.peer}); bridge()?.drop(c.peer); }
      } else {
        if (auto && !running) autoAdvance('Хост недоступен. Ищем другую игру…');
        else status('Соединение с хостом закрыто.');
        if (running) bridge()?.hostLost();
      }
    });
    c.on('error', () => {
      if (stamp !== generation) return;
      if (auto && !running && !host) autoAdvance('Не получилось соединиться. Ищем следующую игру…');
      else status('Ошибка P2P соединения.');
    });
    c.on('open', () => {
      if (stamp !== generation) return;
      if (host) {
        status('Подключился игрок. Ожидаем его ник…');
      } else {
        sendConn(c,{t:'hello',name:nickname,tank:bridge()?.tankType() || 0});
        status('Подключено! Ожидаем запуска хостом.');
      }
    });
  }
  function loadPeer(done) {
    if (window.Peer) { done(); return; }
    pendingPeerLoad={done,stamp:generation};
    if (loading) return;
    loading = true;
    status('Загружаем WebRTC-модуль…');
    const s = document.createElement('script');
    s.src = './vendor/peerjs.min.js';
    s.onload = () => { loading=false; const job=pendingPeerLoad;pendingPeerLoad=null;if(job?.stamp===generation)job.done(); };
    s.onerror = () => { loading=false; status('Не удалось загрузить PeerJS. Нужен интернет.'); };
    document.head.appendChild(s);
  }
  function close() {
    generation++; latestStates.clear(); receivedSeq.clear(); snapSeq=0; auto = false; running = false; ready = false; clearAutoTimers();
    packetsSent = packetsReceived = statesReceived = 0; lastSnapshotAt = lastDataAt = lastPingAt = 0; rtt = null;
    const hud=$('p2pHud'); if(hud) hud.hidden=true;
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null; host = false; peers.clear(); hostConn = null; roster=[]; room=''; myId='';
    publishRoster(); autoStatus();
  }
  function open() {
    if (!bridge()?.isGarage()) return;
    close();
    nickname = nickParts[crypto.getRandomValues(new Uint8Array(1))[0] % nickParts.length] + '-' + randomCode().slice(0,3);
    $('p2pNick').value = nickname;
    $('p2pKey').textContent = '—';
    $('p2pLobby').hidden = false;
    autoStatus();
    $('p2pLaunch').hidden = true;
    status('Создай комнату или введи код комнаты друга.');
  }
  function create() {
    close(); host=true; room=randomCode();
    nickname = safeName($('p2pNick').value);
    $('p2pKey').textContent = room;
    loadPeer(() => {
      if (peer) return;
      myId = 'steel-tanks-' + room.toLowerCase();
      peer = new window.Peer(myId,{debug:0});
      peer.on('open', id => {
        myId=id;
        roster=[{id:id,name:nickname,type:bridge()?.tankType() || 0}];
        publishRoster();
        status('Комната создана. Отправь другу код ' + room + ' и начни бой, когда он войдёт.');
      });
      peer.on('connection', c => connected(c));
      peer.on('error', e => status('Ошибка комнаты: ' + String(e.type || e.message)));
      peer.on('disconnected', () => { if (!running) status('Сервер поиска недоступен. Проверь подключение.'); });
    });
  }
  function join() {
    close(); host=false;
    nickname=safeName($('p2pNick').value);
    room=String($('p2pCode').value || '').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
    if(room.length!==6) { status('Введи 6 символов кода комнаты.'); return; }
    $('p2pKey').textContent=room;
    loadPeer(() => {
      if(peer) return;
      peer=new window.Peer(undefined,{debug:0});
      peer.on('open', id => {
        myId=id;
        const c=peer.connect('steel-tanks-' + room.toLowerCase(),{reliable:true,serialization:'json'});
        connected(c);
        status('Соединяемся с комнатой ' + room + '…');
      });
      peer.on('error', e => status('Не удалось соединиться: ' + String(e.type || e.message)));
    });
  }

  function autoScan(slot) {
    if (!auto || running) return;
    clearAutoTimers(); generation++;
    if (slot >= AUTO_SLOTS) {
      status('Все игровые комнаты заняты. Проверяем их ещё раз…');
      autoRetryTimer = setTimeout(() => { if (auto && !running) autoScan(0); }, 2300);
      return;
    }
    autoSlot = slot; host = true; room = 'АВТО';
    roster=[]; peers.clear(); hostConn=null; myId='';
    if (peer) { try { peer.destroy(); } catch (e) {} }
    const stamp = generation, id = autoPeerId(slot);
    const owner = new window.Peer(id, {debug:0});
    peer = owner;
    status('Автопоиск · проверяем комнату ' + (slot+1) + '…');
    autoProbeTimer=setTimeout(()=>{if(auto&&stamp===generation&&!myId)networkFailure('Сервер поиска не ответил за 12 секунд.')},12000);
    owner.on('connection', c => { if (auto && peer === owner && stamp === generation) connected(c); else c.close(); });
    owner.on('open', connectedId => {
      if (!auto || stamp !== generation || peer !== owner) return;
      clearTimeout(autoProbeTimer);host=true; myId=connectedId;
      roster=[{id:myId,name:nickname,type:bridge()?.tankType() || 0}];
      publishRoster();
      status('Комната доступна. Ждём другого игрока — открой игру на втором устройстве и нажми «Автопоиск».');
      autoTimer=setTimeout(()=>{if(auto&&!running&&roster.length===1)autoScan(0)},22000+Math.random()*3000);
    });
    owner.on('error', error => {
      if (!auto || running || stamp !== generation) return;
      if (error.type === 'unavailable-id') {
        try { owner.destroy(); } catch (e) {}
        host=false;clearTimeout(autoProbeTimer);
        const guest=new window.Peer(undefined,{debug:0});
        peer=guest;
        autoProbeTimer=setTimeout(()=>{if(auto&&stamp===generation)autoAdvance('Не отвечает сервер подключения. Повторяем поиск…')},12000);
        guest.on('open', guestId => {
          if (!auto || stamp !== generation || peer !== guest) return;
          clearTimeout(autoProbeTimer);myId=guestId; room='АВТО';
          const c=guest.connect(id,{reliable:true,serialization:'json'});
          connected(c);
          status('Нашли комнату! Проверяем свободные места…');
          autoProbeTimer=setTimeout(() => {
            if (auto && stamp === generation && !running && !roster.some(p => p.id === myId)) {
              autoAdvance('Хост не ответил. Продолжаем поиск…');
            }
          }, 6000);
        });
        guest.on('error', err => {
          if (!auto || stamp !== generation || running) return;
          if (err.type==='peer-unavailable') autoAdvance('Комната закрылась. Ищем дальше…');
          else autoAdvance('Не удалось войти в комнату. Ищем дальше…');
        });
        guest.on('disconnected',()=>{if(auto && !running && stamp===generation) autoAdvance('Потеряна связь. Ищем снова…');});
      } else networkFailure('Ошибка сервера поиска: '+String(error.type||'network')+'.');
    });
    owner.on('disconnected',()=>{if(auto&&!running&&stamp===generation)autoAdvance('Сервер поиска недоступен. Повторяем попытку…');});
  }
  function automatic() {
    if (!bridge()?.isGarage()) return;
    close();
    auto=true;searchStarted=performance.now(); nickname=safeName($('p2pNick').value);
    $('p2pKey').textContent='АВТОПОИСК';
    autoStatus();
    status('Ищем игроков… Комнаты подбираются автоматически.');
    loadPeer(()=>{ if(auto && !peer) autoScan(0); });
  }
  function cancelAuto() {
    if (!auto) return;
    close(); $('p2pKey').textContent='—';
    status('Автопоиск отменён. Можно создать комнату или войти по коду.');
  }

  function launch() {
    if (!host || running || roster.length < 2) { status('Для начала нужны минимум 2 игрока.'); return; }
    const map=bridge()?.mapIndex() || 0;
    const msg={t:'start',roster:roster,map:map};
    relay(msg);
    running=true;
    packetsSent=packetsReceived=statesReceived=0; lastDataAt=lastSnapshotAt=performance.now(); ready=false;
    $('p2pLobby').hidden=true;
    bridge()?.launch(roster,myId,map);
  }
  function send(data) {
    if (!running) return;
    if (host) relay(data); else sendConn(hostConn,data);
  }
  window.STEEL_NET = {
    ready() {
      // Called only when the game reports the scene is actually playable.
      if (!running) return;
      ready = true; deliverStates();
      const s=bridge()?.snapshot();
      if(s) send({t:'state',id:myId,s,seq:++snapSeq});
      if (!host) sendConn(hostConn,{t:'ready'});
      else peers.forEach(c=>{
        if (s) sendConn(c,{t:'state',id:myId,s,seq:++snapSeq});
      });
    },
    get diagnostics() {
      return {connected:running,host,ready,id:myId,players:roster.length,packetsSent,packetsReceived,statesReceived,rtt,secondsWithoutState:lastSnapshotAt?Math.round((performance.now()-lastSnapshotAt)/1000):null};
    },
    fire(kind,ammo) {
      const s=bridge()?.snapshot();
      if (!s) return;
      send({t:'fire',id:myId,kind:kind,ammo:ammo,yaw:s.turretYaw,pitch:s.pitch});
    },
    hit(id,amount) {
      if (!Number.isFinite(amount) || amount<=0) return;
      send({t:'hit',id:myId,target:id,amount:Math.min(1500,amount)});
    },
    close: close,
    stateNow() { const s=bridge()?.snapshot(); if(s) send({t:'state',id:myId,s:s,seq:++snapSeq}); },
    get active(){return running;}
  };
  $('p2pOpen').addEventListener('click',open);
  $('p2pCreate').addEventListener('click',create);
  $('p2pJoin').addEventListener('click',join);
  $('p2pAuto').addEventListener('click',automatic);
  $('p2pCancel').addEventListener('click',cancelAuto);
  $('p2pLaunch').addEventListener('click',launch);
  $('p2pBack').addEventListener('click',()=>{close();$('p2pLobby').hidden=true;});
  $('p2pCopy').addEventListener('click',async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room); status('Код скопирован.'); }
    catch(e) { status('Скопируй код с экрана: ' + room); }
  });
  autoStatus();
  setInterval(() => {
    if (!running) return;
    const now=performance.now();
    if (now-sendAt>=50) {
      sendAt=now;
      const s=bridge()?.snapshot();
      if (s) send({t:'state',id:myId,s,seq:++snapSeq});
    }
    if (now-lastPingAt>=2000) {
      lastPingAt=now;
      if (host) peers.forEach(c=>sendConn(c,{t:'ping',ts:now}));
      else sendConn(hostConn,{t:'ping',ts:now});
    }
  },50);
  setInterval(() => {
    if (!running) return;
    const hud=$('p2pHud');
    const delay=lastSnapshotAt?Math.round((performance.now()-lastSnapshotAt)/1000):0;
    window.STEEL_NET_DEBUG=window.STEEL_NET.diagnostics;
    if (hud) {
      hud.hidden=false;
      const connected=statesReceived>0 && delay<4;
      hud.classList.toggle('netWarning',!connected);
      hud.textContent=connected
        ? '🌐 P2P · данные '+statesReceived+' · '+(rtt===null?'ping…':rtt+' мс')
        : '⚠ P2P · нет синхронизации '+delay+' c · RX '+packetsReceived;
    }
  },1000);
})();