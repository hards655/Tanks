import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three.js';
import {battlefieldPlan,clearLane,coverContact,sphereContact} from '../battlefield.js';
import {tankGarland} from '../winter.js';
import {armorMaterial} from '../visuals.js';
import {createTracks,animateTracks} from '../track-rig.js';
for(let i=0;i<8;i++)test('Tactical map '+i+': connected clear routes, spawn clearance, reproducible covers',()=>{
 const p=battlefieldPlan(i);assert.deepEqual(p,battlefieldPlan(i));assert.equal(p.covers.length,24);
 for(const [x,z]of p.spawns)for(const o of p.covers)assert(Math.hypot(x-o.x,z-o.z)>o.r+5);
 for(const x of p.lanes)for(let z=-140;z<=140;z+=2)for(const o of p.covers)assert(Math.hypot(x-o.x,z-o.z)>o.r+3);
 for(const o of p.covers)assert(!clearLane(o.x,o.z,0));
});
test('Free tank garland costs four draw objects and has no per-bulb lights',()=>{
 const body=new T.Group(),turret=new T.Group();tankGarland(body,turret);let lights=0,bulbs=0,objects=0;
 for(const part of [body,turret])part.traverse(o=>{if(o.isLight)lights++;if(o.isInstancedMesh)bulbs+=o.count;if(o.isMesh||o.isLine)objects++});
 assert.equal(lights,0);assert.equal(bulbs,64);assert.equal(objects,4);
});
test('Armor projection uses three planes and normalized weights instead of stretched UVs',()=>{
 const m=armorMaterial(0x556644,'forest'),s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);
 assert(s.vertexShader.includes('vArmorPos=position*.22'));for(const axis of ['yz','xz','xy'])assert(s.fragmentShader.includes('vArmorPos.'+axis));assert(s.fragmentShader.includes('blend/=max'));
});
test('Pivot steering animates opposite track directions while stopped',()=>{
 const body=new T.Group(),t={speed:0,steer:1,trackPhase:0,trackLinks:createTracks(body,new T.BoxGeometry(),new T.MeshBasicMaterial())};animateTracks(t,.1);
 assert(t.trackLinks[0].userData.turnPhase<0);assert(t.trackLinks[1].userData.turnPhase>0);for(const m of t.trackLinks)assert([...m.instanceMatrix.array].every(Number.isFinite));
});

test('Cover collision respects height and reports the nearest shell contact',()=>{
 const o={x:0,z:0,w:8,d:6,h:3,angle:0};assert.equal(coverContact({x:0,y:8,z:-20},{x:0,y:8,z:20},o),null);
 const a={x:0,y:1,z:-20},b={x:0,y:1,z:20};const wall=coverContact(a,b,o),tank=sphereContact(a,b,{x:0,y:1,z:12},2);
 assert(wall<tank);assert(wall>0&&wall<1);assert.equal(coverContact({x:20,y:1,z:-20},{x:20,y:1,z:20},o),null);
});
