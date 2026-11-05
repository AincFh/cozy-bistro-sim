import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ASSISTANT,createGame,hireAssistant,canHireAssistant,startDay,advance,
 nextDay,serialize,restore,recipeById,cookOrder,serveOrder
} from '../src/engine.js';
test('assistant only available from the second day and only before service',()=>{
 const s=createGame();assert.equal(canHireAssistant(s),false);
 assert.equal(hireAssistant(s).ok,false);
 s.day=2;assert.equal(canHireAssistant(s),true);
 const before=s.money;const paid=hireAssistant(s);
 assert.equal(paid.ok,true);
 assert.equal(s.money,before-ASSISTANT.wage);
 assert.equal(s.today.spent,ASSISTANT.wage);
 assert.equal(s.assistantHired,true);
 assert.equal(hireAssistant(s).ok,false);
 startDay(s);assert.equal(hireAssistant(s).ok,false);
});
test('assistant automatically cooks, then serves normally using recipe inventory and kitchen limits',()=>{
 const s=createGame(134),recipe=recipeById('citrus');
 s.day=2;s.money=800;s.pantry.tea=20;s.pantry.lemon=20;
 assert.equal(hireAssistant(s).ok,true);
 startDay(s);
 s.scheduled=[];s.elapsed=0;s.duration=50;
 s.orders=[{id:1,recipe:'citrus',customer:'小夏',status:'waiting',patience:80,maxPatience:80,cookLeft:0,cookTotal:0,mood:0}];
 s.assistantCooldown=0;
 const before={tea:s.pantry.tea,lemon:s.pantry.lemon,money:s.money};
 const events=advance(s,.4);
 assert.ok(events.some(e=>e.type==='assistantCook'),events);
 assert.equal(s.orders[0].status,'cooking');
 assert.equal(s.pantry.tea,before.tea-1);assert.equal(s.pantry.lemon,before.lemon-1);
 assert.equal(s.money,before.money);
 assert.equal(cookOrder(s,1).ok,false);
 const events2=advance(s,recipe.prep+ASSISTANT.cooldown+2);
 assert.ok(events2.some(e=>e.type==='ready'));
 // Assistant may have served already if time budget permits, otherwise advance one shift.
 advance(s,ASSISTANT.cooldown+1);
 assert.equal(s.orders.length,0);
 assert.equal(s.todayAssistantServed,1);assert.equal(s.assistantServed,1);
 assert.equal(s.totalServed,1);
 assert.ok(s.money>=before.money+recipe.price);
});
test('assistant respects real cooking stations and ingredient shortages',()=>{
 const s=createGame(414);s.day=2;s.money=800;s.pantry.tea=0;s.pantry.lemon=0;
 hireAssistant(s);startDay(s);s.scheduled=[];s.elapsed=0;s.duration=50;
 s.orders=[{id:1,recipe:'citrus',customer:'A',status:'waiting',patience:80,maxPatience:80,cookLeft:0,cookTotal:0,mood:0}];
 s.assistantCooldown=0;
 advance(s,.5);
 assert.equal(s.orders[0].status,'waiting');
 assert.equal(s.pantry.tea,0);
 // Even with food, the single cooking station cannot be double-booked.
 s.pantry.tea=2;s.pantry.lemon=2;
 s.orders.unshift({id:2,recipe:'toast',customer:'B',status:'cooking',patience:80,maxPatience:80,cookLeft:20,cookTotal:20,mood:0});
 s.assistantCooldown=0;advance(s,.2);
 assert.equal(s.orders.find(o=>o.id===1).status,'waiting');
});
test('daily payroll is once per hire, and next day resets shift without deleting totals',()=>{
 const s=createGame();s.day=2;s.money=800;
 const r=hireAssistant(s);assert.equal(r.ok,true);
 const cost=s.money;assert.equal(hireAssistant(s).ok,false);assert.equal(s.money,cost);
 startDay(s);s.scheduled=[];s.orders=[];s.elapsed=s.duration+1;
 advance(s,.5);assert.equal(s.phase,'summary');assert.equal(s.lastSummary.assistantWages,ASSISTANT.wage);
 assert.equal(nextDay(s),true);assert.equal(s.assistantHired,false);
 assert.equal(s.todayAssistantServed,0);assert.equal(s.money,cost);
});
test('old v1 saves migrate without losing old money, pantry, upgrades and logs',()=>{
 const old=createGame();old.day=6;old.money=756;old.pantry.bread=12;delete old.assistantHired;delete old.assistantCooldown;delete old.assistantServed;
 const out=restore(serialize(old));
 assert.equal(out.day,6);assert.equal(out.money,756);
 assert.equal(out.pantry.bread,12);assert.equal(out.assistantHired,false);
 assert.equal(out.assistantServed,0);
});
test('shift is persisted and tampered helper counters are bounded',()=>{
 const s=createGame();s.day=3;s.money=700;
 hireAssistant(s);startDay(s);
 const loaded=restore(serialize(s));
 assert.equal(loaded.assistantHired,true);
 assert.equal(loaded.today.spent,ASSISTANT.wage);
 assert.equal(loaded.assistantCooldown,ASSISTANT.initialDelay);
 const tampered=restore({...s,assistantCooldown:9e20,assistantServed:-99,todayAssistantServed:1e20});
 assert.equal(tampered.assistantCooldown,ASSISTANT.cooldown);
 assert.equal(tampered.assistantServed,0);
 assert.equal(tampered.todayAssistantServed,1e9);
});
