import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startDay,advance,cookOrder,serveOrder,platingResult,serialize,restore,achievements,nextDay} from '../src/engine.js';

function readyOrder(){
 const s=createGame(31337);startDay(s);advance(s,8);
 const o=s.orders[0];assert.ok(o,'need first diner');
 assert.equal(cookOrder(s,o.id).ok,true);advance(s,15);
 assert.equal(s.orders.find(x=>x.id===o.id)?.status,'ready');
 return {s,id:o.id};
}
test('plating score bands are bounded and improve premium by real skill',()=>{
 assert.equal(platingResult(null,50).grade,'standard');
 assert.equal(platingResult(NaN,50).bonus,0);
 assert.equal(platingResult(99,50).grade,'standard');
 assert.equal(platingResult(.2,50).bonus,0);
 assert.equal(platingResult(.48,50).grade,'fair');
 assert.equal(platingResult(.72,50).grade,'good');
 const p=platingResult(.99,50);
 assert.equal(p.grade,'perfect');assert.equal(p.bonus,12);assert.equal(p.repBonus,2);
});
test('perfect plating earns separate real money, XP, rep and daily accounting',()=>{
 const {s,id}=readyOrder(),plain=restore(serialize(s));
 const normal=serveOrder(plain,id);
 const fancy=serveOrder(s,id,{platingScore:1});
 assert.ok(normal.ok&&fancy.ok);
 assert.equal(fancy.plating.grade,'perfect');
 assert.equal(fancy.gain-normal.gain,fancy.plating.bonus);
 assert.equal(s.money-plain.money,fancy.plating.bonus);
 assert.equal(s.today.platingBonus,fancy.plating.bonus);
 assert.equal(s.today.tips-plain.today.tips,fancy.plating.bonus);
 assert.ok(s.xp>plain.xp&&s.rep>=plain.rep);
 assert.equal(s.platingPerfect,1);assert.equal(s.platingAttempts,1);
 assert.equal(serveOrder(s,id,{platingScore:1}).ok,false);
});
test('service staff cannot claim player precision bonuses',()=>{
 const {s,id}=readyOrder();
 s.assistantAction=true;
 const result=serveOrder(s,id,{platingScore:1});
 assert.equal(result.plating.grade,'standard');
 assert.equal(s.platingPerfect,0);assert.equal(s.today.platingBonus,0);
});
test('plating streak and records persist through old and new saves',()=>{
 const {s,id}=readyOrder();
 assert.equal(serveOrder(s,id,{platingScore:1}).ok,true);
 const cloned=restore(serialize(s));
 assert.equal(cloned.platingPerfect,1);
 assert.equal(cloned.platingBestStreak,1);
 assert.equal(cloned.today.platingBonus,s.today.platingBonus);
 const older=restore({version:1,day:1,seed:1,platingPerfect:-10,platingAttempts:NaN});
 assert.equal(older.platingPerfect,0);assert.equal(older.platingAttempts,0);
});
test('plating achievements use actual settled counts, never just clicks',()=>{
 const s=createGame();s.platingPerfect=5;s.platingBestStreak=3;
 const earned=achievements(s).filter(x=>x.earned).map(x=>x.id);
 assert.ok(earned.includes('plating')&&earned.includes('streak'));
});
