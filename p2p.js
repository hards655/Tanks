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
  let peers = new Map(), roster = [], hostConn = null, loading = false;
  let sendAt = 0, snapSeq = 0;
  const bridge = () => window.STEEL_NET_BRIDGE;
  function status(s) { $('p2pStatus').textContent = s; }
  function publishRoster() {
    $('p2pPlayers').textContent = 'Игроки: ' + (roster.map(p => p.name).join(' • ') || 'нет');
    $('p2pLaunch').hidden = !host || running;
    $('p2pLaunch').disabled = roster.length < 2;
  }
  function sendConn(c, data) { if (c && c.open) { try { c.send(data); } catch (e) {} } }
  function relay(data, except = '') {
    peers.forEach((c, id) => { if (id !== except) sendConn(c, data); });
  }
  function packet(data, conn) {
    if (!data || typeof data !== 'object' || !('t' in data)) return;
    if (data.t === 'hello' && host) {
      if (running || roster.length >= 4) { sendConn(conn, {t:'error', msg:'Комната закрыта или заполнена'}); conn.close(); return; }
      const name = safeName(data.name);
      roster = roster.filter(p => p.id !== conn.peer);
      roster.push({id:conn.peer, name:name, type:validTank(data.tank)});
      relay({t:'roster', roster:roster});
      publishRoster();
      status('Комната ' + room + ' • игроков: ' + roster.length + '/4');
      return;
    }
    if (data.t === 'roster' && !host && Array.isArray(data.roster)) {
      roster = data.roster.slice(0, 4).map(p => ({id:String(p.id || '').slice(0,80), name:safeName(p.name), type:validTank(p.type)}));
      publishRoster();
      status('В комнате ' + roster.length + '/4. Ожидаем запуска хостом.');
      return;
    }
    if (data.t === 'start' && !host && Array.isArray(data.roster) && !running) {
      roster = data.roster.slice(0, 4);
      const map = Math.max(0, Math.min(7, Number(data.map) || 0));
      running = true;
      $('p2pLobby').hidden = true;
      bridge()?.launch(roster, myId, map);
      return;
    }
    if (data.t === 'error') { status(String(data.msg || 'Ошибка соединения')); return; }
    if (!running) return;
    const id = host ? conn.peer : String(data.id || '');
    if (!roster.some(p => p.id === id) && data.t !== 'hit') return;
    if (data.t === 'state') {
      if (!data.s || typeof data.s !== 'object') return;
      bridge()?.receiveState(id, data.s);
      if (host) relay({t:'state', id:id, s:data.s}, conn.peer);
    } else if (data.t === 'fire') {
      if (data.kind !== 'cannon' && data.kind !== 'mg') return;
      bridge()?.receiveFire(id, data.kind, data.ammo, data.yaw, data.pitch);
      if (host) relay({t:'fire', id:id, kind:data.kind, ammo:data.ammo, yaw:data.yaw, pitch:data.pitch}, conn.peer);
    } else if (data.t === 'hit') {
      const dmg = Number(data.amount);
      if (!Number.isFinite(dmg) || dmg <= 0 || dmg > 500 || !roster.some(p=>p.id === data.target)) return;
      if (data.target === myId) bridge()?.receiveHit(dmg);
      if (host) relay({t:'hit', id:id, target:data.target, amount:dmg}, conn.peer);
    }
  }
  function connected(c) {
    if (host && peers.size >= 3) { c.close(); return; }
    if (host) peers.set(c.peer, c); else hostConn = c;
    c.on('data', d => packet(d,c));
    c.on('close', () => {
      if (host) {
        peers.delete(c.peer);
        roster = roster.filter(p => p.id !== c.peer);
        if (!running) { relay({t:'roster',roster:roster}); publishRoster(); }
        else bridge()?.drop(c.peer);
      } else {
        status('Соединение с хостом закрыто.');
        if (running) bridge()?.hostLost();
      }
    });
    c.on('error', () => status('Ошибка P2P соединения.'));
    c.on('open', () => {
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
    if (loading) return;
    loading = true;
    status('Загружаем WebRTC-модуль…');
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
    s.onload = () => { loading=false; done(); };
    s.onerror = () => { loading=false; status('Не удалось загрузить PeerJS. Нужен интернет.'); };
    document.head.appendChild(s);
  }
  function close() {
    running = false;
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null; peers.clear(); hostConn = null; roster=[]; room=''; myId='';
    publishRoster();
  }
  function open() {
    if (!bridge()?.isGarage()) return;
    close();
    nickname = nickParts[crypto.getRandomValues(new Uint8Array(1))[0] % nickParts.length] + '-' + randomCode().slice(0,3);
    $('p2pNick').value = nickname;
    $('p2pKey').textContent = '—';
    $('p2pLobby').hidden = false;
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
  function launch() {
    if (!host || running || roster.length < 2) { status('Для начала нужны минимум 2 игрока.'); return; }
    const map=bridge()?.mapIndex() || 0;
    const msg={t:'start',roster:roster,map:map};
    relay(msg);
    running=true;
    $('p2pLobby').hidden=true;
    bridge()?.launch(roster,myId,map);
  }
  function send(data) {
    if (!running) return;
    if (host) relay(data); else sendConn(hostConn,data);
  }
  window.STEEL_NET = {
    fire(kind,ammo) {
      const s=bridge()?.snapshot();
      if (!s) return;
      send({t:'fire',id:myId,kind:kind,ammo:ammo,yaw:s.turretYaw,pitch:s.pitch});
    },
    hit(id,amount) {
      if (!Number.isFinite(amount) || amount<=0) return;
      send({t:'hit',id:myId,target:id,amount:Math.min(500,amount)});
    },
    close: close,
    get active(){return running;}
  };
  $('p2pOpen').addEventListener('click',open);
  $('p2pCreate').addEventListener('click',create);
  $('p2pJoin').addEventListener('click',join);
  $('p2pLaunch').addEventListener('click',launch);
  $('p2pBack').addEventListener('click',()=>{close();$('p2pLobby').hidden=true;});
  $('p2pCopy').addEventListener('click',async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room); status('Код скопирован.'); }
    catch(e) { status('Скопируй код с экрана: ' + room); }
  });
  setInterval(() => {
    if (!running) return;
    const now=performance.now();
    if (now-sendAt<65) return;
    sendAt=now;
    const s=bridge()?.snapshot();
    if (s) send({t:'state',id:myId,s:s,seq:++snapSeq});
  },70);
})();