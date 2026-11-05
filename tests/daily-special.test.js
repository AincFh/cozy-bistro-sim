import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MENU,DAILY_FEATURE,createGame,chooseDailySpecial,featuredDemandShare,salePrice,
 startDay,advance,cookOrder,serveOrder,acceptContract,contractOffers,nextDay,
 achievements,serialize,restore,recipesAvailable
} from '../src/engine.js';

test('marketing is opt-in, charges a single fee and cannot be repeated as a currency exploit',()=>{
 const s=createGame(12),before=s.money;
 assert.equal(chooseDailySpecial(s,'nonexistent').ok,false);
 assert.equal(chooseDailySpecial(s,'pasta').ok,false,'future recipes are locked');
 assert.equal(s.money,before);
 const one=chooseDailySpecial(s,'citrus');
 assert.equal(one.ok,true);assert.equal(one.spent,DAILY_FEATURE.fee);
 assert.equal(s.money,before-DAILY_FEATURE.fee);
 assert.equal(s.today.spent,DAILY_FEATURE.fee);
 assert.equal(chooseDailySpecial(s,'citrus').spent,0);
 assert.equal(chooseDailySpecial(s,'toast').spent,0,'changing menu before opening does not charge again');
 assert.equal(s.money,before-DAILY_FEATURE.fee);
 assert.equal(s.dailySpecial,'toast');
});
test('insufficient funds cannot create an unpaid campaign or partially change stats',()=>{
 const s=createGame();s.money=DAILY_FEATURE.fee-1;
 const before=serialize(s),result=chooseDailySpecial(s,'citrus');
 assert.equal(result.ok,false);assert.equal(serialize(s),before);
});
test('guest mix is deterministic and promotion materially shifts demand',()=>{
 assert.equal(featuredDemandShare(createGame()),0);
 const x=createGame(23);chooseDailySpecial(x,'citrus');
 assert.equal(featuredDemandShare(x),3/5);
 const y=restore(serialize(x));startDay(x);startDay(y);
 assert.deepEqual(x.scheduled,y.scheduled,'same restored seed + choice generates identical guests');
 const chosen=x.scheduled.filter(x=>x.recipe==='citrus'&&!x.contract).length;
 let regularCount=0,featuredCount=0;
 for(let seed=1;seed<=100;seed++){
  const a=createGame(seed),b=createGame(seed);chooseDailySpecial(b,'citrus');
  startDay(a);startDay(b);
  regularCount+=a.scheduled.filter(x=>x.recipe==='citrus'&&!x.contract).length;
  featuredCount+=b.scheduled.filter(x=>x.recipe==='citrus'&&!x.contract).length;
 }
 assert.ok(featuredCount>regularCount*1.35,{regularCount,featuredCount,chosen});
});
test('featured price is only charged for the selected walk-in dish, not other dishes',()=>{
 const s=createGame();chooseDailySpecial(s,'citrus');
 assert.equal(salePrice(s,'citrus'),Math.round(19*1.18));
 assert.equal(salePrice(s,'toast'),29);
 assert.equal(salePrice(s,'citrus',true),19);
 assert.equal(salePrice(s,'does-not-exist'),0);
});
test('a real promoted order pays exact price and permanently records premium and sold count',()=>{
 const s=createGame(101);chooseDailySpecial(s,'citrus');startDay(s);
 const customer=s.scheduled.find(x=>x.recipe==='citrus'&&!x.contract);
 assert.ok(customer,'seeded campaign should generate walk-in');
 advance(s,customer.arrival+.15);
 const order=s.orders.find(x=>x.id===customer.id);
 assert.ok(order);
 assert.equal(cookOrder(s,order.id).ok,true);
 advance(s,9);
 const before=s.money;
 const sold=serveOrder(s,order.id);
 assert.equal(sold.ok,true);
 assert.equal(sold.salePrice,Math.round(19*1.18));
 assert.equal(sold.specialBonus,sold.salePrice-19);
 assert.equal(s.money-before,sold.gain);
 assert.equal(s.today.specialBonus,sold.specialBonus);
 assert.equal(s.today.specialServed,1);
 assert.equal(s.specialServed,1);
 assert.equal(serveOrder(s,order.id).ok,false,'repeat serving must not earn twice');
});
test('community catering keeps original contractual price even if same recipe is featured',()=>{
 const s=createGame(404),offer=contractOffers(s)[0];
 assert.ok(offer);
 assert.equal(acceptContract(s,offer.id).ok,true);
 assert.equal(chooseDailySpecial(s,offer.recipe).ok,true);
 startDay(s);
 const promised=s.scheduled.find(x=>x.contract&&x.recipe===offer.recipe);
 assert.ok(promised);
 advance(s,promised.arrival+.05);
 assert.equal(cookOrder(s,promised.id).ok,true);
 advance(s,16);
 const result=serveOrder(s,promised.id);
 assert.equal(result.ok,true);
 assert.equal(result.salePrice,MAILER_BASE());
 assert.equal(result.specialBonus,0);
 assert.equal(s.today.specialBonus,0);
 function MAILER_BASE(){return MENU.find(x=>x.id===offer.recipe).price}
});
test('active day disallows changing marketing; next day resets promotion without leaking price',()=>{
 const s=createGame();chooseDailySpecial(s,'citrus');startDay(s);
 assert.equal(chooseDailySpecial(s,'toast').ok,false);
 assert.equal(s.specialsLaunched,1);
 advance(s,290);
 assert.equal(s.phase,'summary');
 assert.equal(s.history[0].specialDish,'citrus');
 assert.equal(s.history[0].specialBonus,0);
 assert.equal(nextDay(s),true);
 assert.equal(s.dailySpecial,null);
 assert.equal(salePrice(s,'citrus'),19);
 assert.equal(featuredDemandShare(s),0);
});
test('marketing survives mid-service save, and legacy save gets zero counters',()=>{
 const s=createGame();chooseDailySpecial(s,'toast');startDay(s);advance(s,11);
 const restored=restore(serialize(s));
 assert.equal(restored.dailySpecial,'toast');
 assert.equal(restored.specialsLaunched,1);
 assert.equal(restored.today.spent,DAILY_FEATURE.fee);
 const legacy=createGame();delete legacy.dailySpecial;delete legacy.specialsLaunched;
 delete legacy.specialServed;delete legacy.today.specialBonus;
 const old=restore(serialize(legacy));
 assert.equal(old.dailySpecial,null);assert.equal(old.specialsLaunched,0);
 assert.equal(old.specialServed,0);assert.equal(old.today.specialBonus,0);
});
test('marketing achievements require actual campaigns and sold dishes',()=>{
 const s=createGame();s.specialsLaunched=5;s.specialServed=25;
 const a=achievements(s);
 assert.equal(a.find(x=>x.id==='marketer').earned,true);
 assert.equal(a.find(x=>x.id==='favorite').earned,true);
});
