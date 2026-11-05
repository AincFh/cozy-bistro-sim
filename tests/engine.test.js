import test from 'node:test';import assert from 'node:assert/strict';
import {MENU,PACKS,UPGRADES,createGame,recipesAvailable,recipeById,ingredientAvailable,slots,prepDuration,buyPackage,buyUpgrade,startDay,cookOrder,serveOrder,advance,nextDay,achievements,serialize,restore,levelOf,upgradePrice} from '../src/engine.js';
test('initial game is playable with pantry and startup budget',()=>{const s=createGame();assert.equal(s.day,1);assert.equal(s.phase,'planning');assert.ok(s.money>=250);for(const r of recipesAvailable(s))assert.ok(ingredientAvailable(s,r));});
test('all recipes are distinct and correctly defined',()=>{assert.equal(new Set(MENU.map(x=>x.id)).size,MENU.length);for(const x of MENU){assert.ok(x.price>x.prep);assert.ok(x.prep>0);assert.ok(Object.keys(x.recipe).length>0)}});
test('day-specific recipes unlock over time',()=>{const s=createGame();assert.equal(recipesAvailable(s).length,3);s.day=3;assert.equal(recipesAvailable(s).length,5);s.day=10;assert.equal(recipesAvailable(s).length,MENU.length)});
test('supply delivery costs money and adds quantities',()=>{const s=createGame(),old=s.pantry.bread;const r=buyPackage(s,'bakery');assert.equal(r.ok,true);assert.equal(s.money,270-68);assert.equal(s.pantry.bread,old+8);assert.equal(s.today.spent,68)});
test('cannot buy supplies while restaurant is open',()=>{const s=createGame();startDay(s);assert.equal(buyPackage(s,'garden').ok,false);});
test('upgrade caps and upgrades cost more each level',()=>{const s=createGame();s.money=3000;const first=upgradePrice(s,'stove');assert.equal(buyUpgrade(s,'stove').ok,true);assert.ok(upgradePrice(s,'stove')>first);assert.ok(prepDuration(s,MENU[0])<MENU[0].prep);});
test('counter upgrade allows two simultaneous cooking jobs',()=>{const s=createGame();s.money=1000;buyUpgrade(s,'counter');assert.equal(slots(s),2);startDay(s);advance(s,22);assert.ok(s.orders.length>=2);assert.equal(cookOrder(s,s.orders[0].id).ok,true);assert.equal(cookOrder(s,s.orders[1].id).ok,true);assert.equal(s.orders.filter(x=>x.status==='cooking').length,2);});
test('generated customer schedule is reproducible',()=>{const a=createGame(123),b=createGame(123);startDay(a);startDay(b);assert.deepEqual(a.scheduled,b.scheduled);assert.ok(a.duration>80)});
test('cannot start a new day while open',()=>{const s=createGame();assert.equal(startDay(s).ok,true);assert.equal(startDay(s).ok,false)});
test('first guest arrives, can be prepared and served',()=>{const s=createGame(555);startDay(s);advance(s,10);assert.ok(s.orders.length>=1);const order=s.orders[0];const r=cookOrder(s,order.id);assert.equal(r.ok,true);advance(s,15);assert.equal(s.orders[0].status,'ready');const served=serveOrder(s,order.id);assert.equal(served.ok,true);assert.ok(s.today.revenue>0);assert.equal(s.totalServed,1);});
test('cannot serve an unfinished order or double-serve',()=>{const s=createGame(789);startDay(s);advance(s,8);const o=s.orders[0];assert.equal(serveOrder(s,o.id).ok,false);cookOrder(s,o.id);advance(s,12);assert.equal(serveOrder(s,o.id).ok,true);assert.equal(serveOrder(s,o.id).ok,false)});
test('cooking consumes ingredients only once',()=>{const s=createGame(9);startDay(s);advance(s,8);const o=s.orders[0],r=recipeById(o.recipe);const key=Object.keys(r.recipe)[0],before=s.pantry[key];assert.equal(cookOrder(s,o.id).ok,true);assert.equal(s.pantry[key],before-r.recipe[key]);assert.equal(cookOrder(s,o.id).ok,false);});
test('orders missed by long waits lower reputation and count losses',()=>{const s=createGame(89);startDay(s);const rep=s.rep;advance(s,80);assert.ok(s.totalMissed>0);assert.ok(s.rep<rep)});
test('a whole day eventually reaches summary without forced closure',()=>{const s=createGame(100);startDay(s);advance(s,220);assert.equal(s.phase,'summary');assert.equal(s.history.length,1);assert.equal(s.history[0].day,1);assert.ok(s.history[0].missed>0)});
test('next day increments without resetting budget and stats',()=>{const s=createGame(100);startDay(s);advance(s,230);const money=s.money;assert.equal(nextDay(s),true);assert.equal(s.day,2);assert.equal(s.phase,'planning');assert.equal(s.money,money);assert.equal(s.today.served,0);});
test('buying unknown items or without money is guarded',()=>{const s=createGame();s.money=0;assert.equal(buyPackage(s,'unknown').ok,false);assert.equal(buyPackage(s,'garden').ok,false);assert.equal(buyUpgrade(s,'counter').ok,false);});
test('save/restore roundtrip preserves active orders, kitchen and ledger',()=>{const s=createGame(77);startDay(s);advance(s,9);cookOrder(s,s.orders[0].id);const cloned=restore(serialize(s));assert.equal(cloned.phase,'open');assert.deepEqual(cloned.pantry,s.pantry);assert.deepEqual(cloned.orders,s.orders);});
test('invalid or adversarial save data is repaired',()=>{const s=restore({version:1,money:-900,rep:999,day:0,upgrades:{stove:800},pantry:{tea:-4},orders:[{id:'evil',recipe:'oops'}]});assert.equal(s.money,0);assert.equal(s.day,1);assert.equal(s.upgrades.stove,3);assert.equal(s.pantry.tea,0);assert.equal(s.orders.length,0);});
test('unknown save schema resets safely',()=>assert.equal(restore('{bad json').money,270));
test('achievement milestones and leveling update',()=>{const s=createGame();s.totalServed=60;s.day=10;s.money=3000;s.rep=99;s.xp=1200;assert.ok(achievements(s).filter(x=>x.earned).length>=6);assert.ok(levelOf(s)>1);});
test('simulation never creates negative inventories or money',()=>{const s=createGame(1213);startDay(s);for(let i=0;i<330;i++){advance(s,1);for(const order of [...s.orders]){if(order.status==='waiting')cookOrder(s,order.id);else if(order.status==='ready')serveOrder(s,order.id)}}for(const n of Object.values(s.pantry))assert.ok(n>=0);assert.ok(s.money>=0)});

test('free emergency basket prevents bankruptcy deadlocks once per day',async()=>{
 const {canClaimSupport,claimSupport}=await import('../src/engine.js');const s=createGame();s.money=0;
 assert.equal(canClaimSupport(s),true);const original=s.pantry.bread;assert.equal(claimSupport(s).ok,true);
 assert.equal(s.pantry.bread,original+3);assert.equal(canClaimSupport(s),false);assert.equal(claimSupport(s).ok,false);
 startDay(s);advance(s,240);nextDay(s);assert.equal(canClaimSupport(s),true);
});
test('aid is offered when no unlocked recipe can be made',async()=>{
 const {canClaimSupport}=await import('../src/engine.js');const s=createGame();for(const k of Object.keys(s.pantry))s.pantry[k]=0;
 assert.equal(canClaimSupport(s),true);
});
test('aid redemption day survives storage roundtrip',async()=>{
 const {claimSupport,canClaimSupport}=await import('../src/engine.js');const s=createGame();s.money=0;claimSupport(s);
 const copy=restore(serialize(s));assert.equal(copy.lastAidDay,1);assert.equal(canClaimSupport(copy),false);
});