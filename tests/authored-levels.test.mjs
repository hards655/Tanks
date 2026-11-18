import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three.js';
import {LEVELS,footprint,authoredHeight} from '../authored-levels.js';
import {buildAuthoredLevel} from '../level-art.js';
import {navigationGrid,findRoute} from '../navigation.js';
const spawns=[{x:0,z:-90},{x:0,z:90},{x:-75,z:0},{x:75,z:0},{x:0,z:0},{x:0,z:80},{x:-12,z:-80},{x:12,z:-80}];
for(let i=0;i<8;i++){
 test('Authored arena '+i+': every spawn and objective reachable by heavy tank',()=>{const l=LEVELS[i],grid=navigationGrid(l.props);for(const p of spawns){assert(!l.props.some(o=>footprint(p.x,p.z,o,3.5)),'blocked spawn '+JSON.stringify(p));if(p!==spawns[0])assert(findRoute(grid,spawns[0],p).length>0,'unreachable '+JSON.stringify(p))}assert(l.props.length>=14);assert(l.zones.length===3)});
 test('Authored arena '+i+': finite detailed models, upward roads and bounded rendering',()=>{const world=new T.Group(),info=buildAuthoredLevel(world,i,'medium');assert(info.instances>300);assert(info.batches<85);let tris=0;world.traverse(o=>{if(!o.isMesh)return;for(const p of o.geometry.attributes.position.array)assert(Number.isFinite(p));tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count||1);if(o.userData.ownedGeometry&&o.geometry.attributes.normal&&o.geometry.type==='BufferGeometry'){for(let j=0;j<o.geometry.attributes.normal.count;j++)assert(o.geometry.attributes.normal.getY(j)>0)}});assert(tris<750000,'triangle budget '+tris);for(const p of spawns)assert(Number.isFinite(authoredHeight(i,p.x,p.z)))});
}
test('Eight arenas have genuinely different authored footprints',()=>{assert.equal(new Set(LEVELS.map(l=>JSON.stringify(l.props))).size,8);assert.equal(new Set(LEVELS.map(l=>JSON.stringify(l.roads))).size,8)});
test('Oriented collision allows passage beside long buildings',()=>{const o={x:0,z:0,w:24,d:6,angle:Math.PI/2};assert(footprint(0,9,o,2));assert(!footprint(8,0,o,2))});
