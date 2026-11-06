import test from 'node:test';import assert from 'node:assert/strict';
import {ASSISTANT,STAFF_CAREER,createGame,restore,serialize,assistantLevel,assistantCooldownFor,
 assistantWage,assistantTrainingPrice,canTrainAssistant,trainAssistant,canHireAssistant,hireAssistant,
 startDay,advance,nextDay,achievements} from '../src/engine.js';
test('staff career levels are monotonic and effective cooldown decreases with earned skill',()=>{
 const s=createGame();assert.equal(assistantLevel(s),1);assert.equal(assistantCooldownFor(s),4.5);
 const levels=[0,5,16,34,60].map(x=>{s.assistantXp=x;return assistantLevel(s)});
 assert.deepEqual(levels,[1,2,3,4,5]);
 assert.equal(assistantCooldownFor(s),2.98);
 assert.equal(assistantWage(s),146);
 assert.equal(assistantTrainingPrice(s),420);
});
test('training requires day two, planning phase, adequate coins and one session per day',()=>{
 const s=createGame();s.money=2000;
 assert.equal(canTrainAssistant(s),false);assert.equal(trainAssistant(s).ok,false);
 s.day=2;
 assert.equal(canTrainAssistant(s),true);
 const old=s.money,r=trainAssistant(s);
 assert.equal(r.ok,true);assert.equal(r.cost,140);assert.equal(r.level,2);
 assert.equal(s.money,old-140);assert.equal(s.today.spent,140);
 assert.equal(s.today.staffTraining,140);assert.equal(s.assistantTrainingSessions,1);
 assert.equal(s.assistantTrainingTotal,140);
 assert.equal(trainAssistant(s).ok,false);
 assert.equal(canHireAssistant(s),true);
 const wage=assistantWage(s),h=hireAssistant(s);
 assert.equal(h.ok,true);assert.equal(h.wage,110);
 assert.equal(s.assistantShiftWage,110);
 assert.equal(s.today.spent,140+110);
 assert.equal(s.money,old-250);
 startDay(s);
 assert.equal(trainAssistant(s).ok,false);
});
test('advanced skill changes real assistant operating cooldown and payroll without free ingredients',()=>{
 const s=createGame(101);s.day=2;s.money=900;
 assert.equal(trainAssistant(s).ok,true);assert.equal(hireAssistant(s).ok,true);
 s.pantry.tea=8;s.pantry.lemon=8;startDay(s);
 s.scheduled=[];s.elapsed=0;s.duration=45;
 s.orders=[{id:1,recipe:'citrus',customer:'小夏',status:'waiting',patience:85,maxPatience:85,cookLeft:0,cookTotal:0,mood:0}];
 s.assistantCooldown=0;
 const beforeXp=s.assistantXp,tea=s.pantry.tea,lemon=s.pantry.lemon;
 const ev=advance(s,.2);
 assert.ok(ev.some(e=>e.type==='assistantCook'));
 assert.equal(s.assistantXp,beforeXp+1);
 assert.ok(s.assistantCooldown<=assistantCooldownFor(s)&&s.assistantCooldown>assistantCooldownFor(s)-.3);
 assert.equal(s.pantry.tea,tea-1);assert.equal(s.pantry.lemon,lemon-1);
 advance(s,20);
 assert.equal(s.assistantServed,1);
 assert.equal(s.assistantXp,beforeXp+2);
 assert.equal(s.todayAssistantServed,1);
 assert.ok(s.money>0);
});
test('no fake staff experience for blocked kitchen or no paid shift',()=>{
 const s=createGame();s.day=2;s.money=1000;s.pantry.tea=0;s.pantry.lemon=0;
 hireAssistant(s);startDay(s);s.scheduled=[];s.orders=[{id:2,recipe:'citrus',customer:'A',status:'waiting',patience:60,maxPatience:60,mood:0}];s.assistantCooldown=0;
 advance(s,.3);
 assert.equal(s.assistantXp,0);
 s.assistantHired=false;advance(s,5);
 assert.equal(s.assistantXp,0);
});
test('daily settlement records true charged wages and training cost, next shift can train again',()=>{
 const s=createGame();s.day=2;s.money=2000;
 trainAssistant(s);hireAssistant(s);
 startDay(s);s.scheduled=[];s.orders=[];s.elapsed=s.duration+1;advance(s,.2);
 assert.equal(s.phase,'summary');
 assert.equal(s.lastSummary.assistantWages,110);
 assert.equal(s.lastSummary.staffTraining,140);
 assert.equal(s.lastSummary.assistantLevel,2);
 const prev=s.assistantXp;
 nextDay(s);
 assert.equal(s.assistantHired,false);assert.equal(s.today.staffTraining,0);
 assert.equal(s.assistantShiftWage,0);
 assert.equal(canTrainAssistant(s),true);
 const result=trainAssistant(s);
 assert.equal(result.ok,true);assert.equal(s.assistantXp,prev+8);
 assert.equal(result.level,3);
});
test('old saves migrate safely and forged skill/training counters cannot escape bounds',()=>{
 const s=createGame();s.day=7;s.money=600;s.assistantHired=true;
 delete s.assistantXp;delete s.assistantTrainingSessions;delete s.assistantTrainedDay;delete s.assistantShiftWage;
 const old=restore(serialize(s));
 assert.equal(old.day,7);assert.equal(old.money,600);
 assert.equal(old.assistantXp,0);assert.equal(old.assistantTrainingSessions,0);
 assert.equal(old.assistantShiftWage,ASSISTANT.wage);
 const hacked=restore({...old,assistantXp:1e15,assistantTrainedDay:-99,assistantTrainingSessions:1e50,assistantTrainingTotal:-100,assistantShiftWage:99999});
 assert.equal(hacked.assistantXp,STAFF_CAREER.maxXp);
 assert.equal(hacked.assistantTrainedDay,0);
 assert.equal(hacked.assistantTrainingSessions,1000);
 assert.equal(hacked.assistantTrainingTotal,0);
 assert.equal(hacked.assistantShiftWage,1000);
 assert.equal(assistantLevel(hacked),5);
 assert.equal(canTrainAssistant(hacked),false);
});
test('staff career adds earned milestones without removing existing achievements',()=>{
 const s=createGame();let names=achievements(s).map(x=>x.id);
 assert.ok(names.includes('partnership')&&names.includes('trainee')&&names.includes('mentor'));
 s.assistantXp=16;assert.equal(achievements(s).find(x=>x.id==='trainee').earned,true);
 assert.equal(achievements(s).find(x=>x.id==='mentor').earned,false);
 s.assistantXp=60;assert.equal(achievements(s).find(x=>x.id==='mentor').earned,true);
});
