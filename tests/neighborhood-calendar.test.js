import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startDay,finishDay,serialize,restore,neighborhoodEvent,NEIGHBORHOOD_CALENDAR} from '../src/engine.js';

test('three event days repeat weekly; ordinary days are unchanged',()=>{
 assert.equal(neighborhoodEvent(1),null);
 assert.equal(neighborhoodEvent(3)?.id,'market');
 assert.equal(neighborhoodEvent(5)?.id,'coffee');
 assert.equal(neighborhoodEvent(7)?.id,'family');
 assert.equal(neighborhoodEvent(10)?.id,'market');
 assert.equal(neighborhoodEvent(0),null);
 assert.equal(neighborhoodEvent(NaN),null);
 assert.equal(new Set(NEIGHBORHOOD_CALENDAR.map(x=>x.weekday)).size,3);
});
test('a market day spawns actual extra guests, not unearned income',()=>{
 const normal=createGame(101),market=createGame(101);normal.day=4;market.day=3;
 assert.equal(startDay(market).ok,true);
 assert.equal(startDay(normal).ok,true);
 assert.equal(market.scheduled.length,10);
 assert.equal(normal.scheduled.length,9);
 assert.equal(market.scheduled[0].patience,normal.scheduled[0].patience-3);
 assert.equal(market.money,270);
 assert.equal(market.today.revenue,0);
});
test('event demand changes real dish distribution while keeping deterministic schedule',()=>{
 let events=0,ordinary=0,etotal=0,ototal=0;
 for(let seed=10;seed<110;seed++){
  const a=createGame(seed),b=createGame(seed),clone=createGame(seed);
  a.day=3;b.day=4;clone.day=3;
  startDay(a);startDay(b);startDay(clone);
  assert.deepEqual(a.scheduled,clone.scheduled);
  events+=a.scheduled.filter(o=>['citrus','toast','salad'].includes(o.recipe)).length;
  ordinary+=b.scheduled.filter(o=>['citrus','toast','salad'].includes(o.recipe)).length;
  etotal+=a.scheduled.length;ototal+=b.scheduled.length;
 }
 assert.ok(events/etotal>ordinary/ototal,`event preference must increase: ${events}/${etotal} vs ${ordinary}/${ototal}`);
});
test('event does not affect contracted guests and remains safe across saves',()=>{
 const a=createGame(222);a.day=5;startDay(a);
 assert.equal(a.scheduled.length,12);
 assert.equal(a.scheduled.filter(x=>x.contract).length,0);
 const restored=restore(serialize(a));
 assert.deepEqual(restored.scheduled.map(({contract,...order})=>order),a.scheduled);
 a.scheduled=[];a.orders=[];a.elapsed=a.duration;
 assert.equal(finishDay(a),true);
 assert.equal(a.lastSummary.neighborhoodEvent,'coffee');
 assert.equal(a.money,270);
});
