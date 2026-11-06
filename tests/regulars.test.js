import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGULAR_TIERS,REGULARS,CUSTOMERS,createGame,regularLevel,regularOverview,pickGuest,
  startDay,advance,cookOrder,serveOrder,finishDay,nextDay,serialize,restore,achievements,
} from '../src/engine.js';

function openFirstGuest(s){
  assert.equal(startDay(s).ok,true);
  advance(s,8);
  const order=s.orders.find(o=>o.status==='waiting'&&!o.contract);
  assert.ok(order,'a normal customer must have arrived');
  assert.equal(cookOrder(s,order.id).ok,true);
  advance(s,9);
  const ready=s.orders.find(o=>o.id===order.id);
  assert.equal(ready?.status,'ready');
  return order;
}
test('new city has no fictional regulars and existing random customer mix is preserved',()=>{
  const s=createGame(77);
  assert.deepEqual(s.regulars,{});
  assert.equal(regularOverview(s).length,CUSTOMERS.length);
  assert.ok(regularOverview(s).every(r=>r.tier===0&&r.served===0&&r.missed===0));
  for(let i=0;i<1000;i++){
    const value=i/1000;
    assert.equal(pickGuest(s,value),CUSTOMERS[Math.floor(value*CUSTOMERS.length)]);
  }
  assert.deepEqual(REGULAR_TIERS,[0,3,8,18]);
});
test('only actual successfully completed meals create real customer relationships',()=>{
  const s=createGame(505),o=openFirstGuest(s);
  const before=s.money;
  assert.equal(s.regulars[o.customer],undefined);
  assert.equal(serveOrder(s,o.id).ok,true);
  assert.equal(s.regulars[o.customer].served,1);
  assert.equal(s.regulars[o.customer].missed,0);
  assert.equal(s.regulars[o.customer].lastSeenDay,1);
  assert.equal(s.today.regularsServed,1);
  assert.equal(s.today.regularBonus,0,'a first-time guest has no loyalty tip');
  assert.ok(s.money>before);
  const frozen=serialize(s);
  assert.equal(serveOrder(s,o.id).ok,false);
  assert.equal(serialize(s),frozen,'no duplicate relationship or payout');
});
test('loyalty bonus is earned on real service, included once in cash and tip ledger',()=>{
  const s=createGame(988);
  for(const name of CUSTOMERS)s.regulars[name]={served:8,missed:0,lastSeenDay:1};
  const o=openFirstGuest(s);
  const before=s.money,tipBefore=s.today.tips;
  const result=serveOrder(s,o.id);
  assert.equal(result.ok,true);
  assert.equal(result.loyaltyTier,2);
  assert.equal(result.regularBonus,REGULARS.tipPerTier*2);
  assert.equal(s.money-before,result.gain);
  assert.equal(result.gain,result.salePrice+result.tip+result.plating.bonus+result.regularBonus);
  assert.equal(s.today.tips-tipBefore,result.tip+result.regularBonus+result.plating.bonus);
  assert.equal(s.today.regularBonus,6);
  assert.equal(s.regulars[o.customer].served,9);
  assert.equal(s.today.regularsServed,1);
  assert.equal(serveOrder(s,o.id).ok,false);
  assert.equal(s.today.regularBonus,6);
});
test('trust thresholds and missed orders enforce genuine customer loyalty',()=>{
  const s=createGame();
  const name=CUSTOMERS[0];
  assert.equal(regularLevel(s,name),0);
  s.regulars[name]={served:3,missed:0,lastSeenDay:1};
  assert.equal(regularLevel(s,name),1);
  s.regulars[name].served=8;
  assert.equal(regularLevel(s,name),2);
  s.regulars[name].served=18;
  assert.equal(regularLevel(s,name),3);
  s.regulars[name].missed=6;
  assert.equal(regularLevel(s,name),1,'six walks-outs subtract twelve trust');
  const snapshot=regularOverview(s).find(r=>r.name===name);
  assert.equal(snapshot.trust,6);
  assert.equal(snapshot.next,8);
  assert.equal(snapshot.tipBonus,3);
  assert.equal(regularLevel(s,'arbitrary unknown guest'),0);
});
test('the actual missed-order path reduces trust and never awards money',()=>{
  const s=createGame(22);
  for(const name of CUSTOMERS)s.regulars[name]={served:3,missed:0,lastSeenDay:0};
  assert.equal(startDay(s).ok,true);
  advance(s,8);
  const guest=s.orders[0].customer,initialBalance=s.money;
  assert.equal(regularLevel(s,guest),1);
  advance(s,240);
  assert.equal(s.regulars[guest].missed>0,true);
  assert.equal(s.money,initialBalance,'abandoned meals do not create income');
  assert.equal(s.today.regularBonus,0);
  assert.ok(s.totalMissed>0);
});
test('regulars have higher probability of returning, without changing customer list or adding random calls',()=>{
  const standard=createGame();
  const loyal=createGame();
  loyal.regulars[CUSTOMERS[0]]={served:18,missed:0,lastSeenDay:1};
  let base=0,popular=0;
  for(let i=0;i<4096;i++){
    const roll=(i+.5)/4096;
    if(pickGuest(standard,roll)===CUSTOMERS[0])base++;
    if(pickGuest(loyal,roll)===CUSTOMERS[0])popular++;
  }
  assert.ok(popular>base*3,{base,popular});
  assert.equal(pickGuest(loyal,1),CUSTOMERS.at(-1));
  assert.equal(pickGuest(loyal,NaN),CUSTOMERS[0]);
});
test('loyalty provides actual more tolerant orders when scheduling a new day',()=>{
  const standard=createGame(548);
  const frequent=createGame(548);
  for(const name of CUSTOMERS)frequent.regulars[name]={served:8,missed:0,lastSeenDay:1};
  startDay(standard);startDay(frequent);
  assert.deepEqual(standard.scheduled.map(x=>x.recipe),frequent.scheduled.map(x=>x.recipe));
  assert.deepEqual(standard.scheduled.map(x=>x.customer),frequent.scheduled.map(x=>x.customer));
  for(let i=0;i<standard.scheduled.length;i++){
    assert.equal(frequent.scheduled[i].patience-standard.scheduled[i].patience,8);
  }
});
test('community catering does not create loyalty, make visitors into recurring NPCs or add tip bonuses',()=>{
  const s=createGame();
  s.phase='open';
  s.contract={id:'test',status:'active',recipe:'citrus',count:2,delivered:0,deposit:25,bonus:50,day:1,customer:'街区读书会'};
  s.orders=[{id:3,recipe:'citrus',customer:'街区读书会',status:'ready',patience:40,maxPatience:40,contract:true}];
  const result=serveOrder(s,3);
  assert.equal(result.ok,true);
  assert.equal(result.regularBonus,0);
  assert.deepEqual(s.regulars,{});
  assert.equal(s.today.regularsServed,0);
  assert.equal(s.contract.delivered,1);
});
test('business ledger stores actual loyalty income and it carries across days safely',()=>{
  const s=createGame(701);
  for(const name of CUSTOMERS)s.regulars[name]={served:3,missed:0,lastSeenDay:1};
  const o=openFirstGuest(s);
  assert.equal(serveOrder(s,o.id).ok,true);
  assert.equal(s.today.regularBonus,3);
  advance(s,240);
  assert.equal(s.phase,'summary');
  assert.equal(s.history[0].regularBonus,3);
  assert.equal(s.history[0].regularsServed,1);
  const served=s.regulars[o.customer].served;
  assert.equal(nextDay(s),true);
  assert.equal(s.today.regularBonus,0);
  assert.equal(s.today.regularsServed,0);
  assert.equal(s.regulars[o.customer].served,served);
});
test('relationships, guest earnings and earned achievements survive save/restore',()=>{
  const s=createGame(31);
  for(const [i,name] of CUSTOMERS.entries())
    if(i<4)s.regulars[name]={served:8,missed:0,lastSeenDay:4};
  s.day=7;
  s.today.regularBonus=12;s.today.regularsServed=3;
  const copy=restore(serialize(s));
  assert.deepEqual(copy.regulars,s.regulars);
  assert.equal(copy.today.regularBonus,12);
  assert.equal(copy.today.regularsServed,3);
  assert.equal(achievements(copy).find(x=>x.id==='welcome')?.earned,true);
  assert.equal(achievements(copy).find(x=>x.id==='friends')?.earned,true);
});
test('legacy and manipulated saves cannot smuggle unknown guests or invalid counts',()=>{
  const s=createGame();delete s.regulars;
  delete s.today.regularBonus;delete s.today.regularsServed;
  const restored=restore(serialize(s));
  assert.deepEqual(restored.regulars,{});
  assert.equal(restored.today.regularBonus,0);
  assert.equal(restored.today.regularsServed,0);
  const t=createGame();
  t.regulars={evil:{served:1e10,missed:0},[CUSTOMERS[0]]:{served:Infinity,missed:-5,lastSeenDay:90000},
    [CUSTOMERS[1]]:{served:3,missed:1,lastSeenDay:8}};
  const validated=restore(serialize(t));
  assert.deepEqual(Object.keys(validated.regulars),[CUSTOMERS[1]]);
  assert.equal(validated.regulars[CUSTOMERS[1]].served,3);
  assert.equal(regularLevel(validated,CUSTOMERS[1]),0);
});
