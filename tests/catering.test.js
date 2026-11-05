import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createGame,contractOffers,acceptContract,recipeById,startDay,advance,
 cookOrder,serveOrder,ingredientAvailable,prepDuration,finishDay,nextDay,
 serialize,restore,achievements
} from '../src/engine.js';

function signed(seed=3456){
 const s=createGame(seed);const offer=contractOffers(s)[0];
 assert.equal(acceptContract(s,offer.id).ok,true);
 return {s,offer};
}
test('two deterministic, distinct offers require real recipes and expose risk',()=>{
 const a=createGame(91),b=createGame(91);
 const x=contractOffers(a),y=contractOffers(b);
 assert.deepEqual(x,y);
 assert.equal(x.length,2);
 assert.notEqual(x[0].recipe,x[1].recipe);
 for(const c of x){assert.ok(recipeById(c.recipe));assert.ok(c.count>=2);assert.ok(c.deposit>0);assert.ok(c.bonus>0);}
});
test('one signed contract per day and escrow debit, with real balance guard',()=>{
 const s=createGame(79),options=contractOffers(s);
 const original=s.money;
 const accepted=acceptContract(s,options[0].id);
 assert.equal(accepted.ok,true);
 assert.equal(s.money,original-options[0].deposit);
 assert.equal(s.today.spent,options[0].deposit);
 assert.equal(acceptContract(s,options[1].id).ok,false);
 startDay(s);
 assert.equal(acceptContract(s,options[0].id).ok,false);
 const poor=createGame(79);poor.money=0;
 assert.equal(acceptContract(poor,options[0].id).ok,false);
 assert.equal(poor.money,0);
});
test('a real batch of contracted dishes uses normal kitchen, pays premium once',()=>{
 const {s,offer}=signed(31337);
 const before=s.money;
 const r=recipeById(offer.recipe);
 startDay(s);
 const offers=s.scheduled.filter(x=>x.contract);
 assert.equal(offers.length,offer.count);
 assert.ok(offers.every(x=>x.recipe===offer.recipe));
 // Keep only contract guests in the deterministic unit scenario; their
 // arrival, ingredient use, cooking and service are still unmodified.
 s.scheduled=offers;
 let ordinaryRevenue=0;
 for(let i=0;i<offer.count;i++){
  const next=s.scheduled[0].arrival;
  advance(s,Math.max(.3,next-s.elapsed+.25));
  const waiting=s.orders.find(x=>x.contract&&x.status==='waiting');
  assert.ok(waiting,JSON.stringify({i,elapsed:s.elapsed,orders:s.orders}));
  assert.equal(ingredientAvailable(s,r),true);
  assert.equal(cookOrder(s,waiting.id).ok,true);
  assert.equal(cookOrder(s,waiting.id).ok,false,'cannot consume ingredients twice');
  advance(s,prepDuration(s,r)+.25);
  const served=serveOrder(s,waiting.id);
  assert.equal(served.ok,true);
  ordinaryRevenue+=served.gain;
  assert.equal(served.contractCompleted,i===offer.count-1);
  assert.equal(serveOrder(s,waiting.id).ok,false,'cannot claim same dish twice');
 }
 assert.equal(s.contract.status,'completed');
 assert.equal(s.contractsWon,1);
 assert.equal(s.today.contractBonus,offer.bonus);
 assert.equal(s.money,before+ordinaryRevenue+offer.bonus+offer.deposit);
 assert.equal(s.today.revenue>=offer.bonus+offer.deposit,true);
 assert.ok(achievements(s).some(x=>x.id==='neighbor'&&x.earned));
 advance(s,s.duration+30);
 assert.ok(s.phase==='summary');
 assert.equal(s.lastSummary.contractStatus,'completed');
 assert.equal(s.lastSummary.contractBonus,offer.bonus);
 assert.equal(nextDay(s),true);
 assert.equal(s.contract,null);
});
test('one expired catered order fails contract once; deposit is not refunded',()=>{
 const {s,offer}=signed(66);
 startDay(s);
 const afterDeposit=s.money;
 advance(s,140);
 assert.equal(s.contract.status,'failed');
 assert.equal(s.contractsLost,1);
 assert.equal(s.today.contractBonus,0);
 assert.ok(s.money<=afterDeposit+3000);
 // Additional time cannot charge failure repeatedly.
 advance(s,130);
 assert.equal(s.contractsLost,1);
 assert.equal(s.contract.status,'failed');
 assert.notEqual(s.contract.status,'completed');
});
test('contract, queued catered orders and history survive old/new local JSON',()=>{
 const {s}=signed(3210);
 startDay(s);advance(s,9);
 const cloned=restore(serialize(s));
 assert.equal(cloned.contract.status,'active');
 assert.equal(cloned.contract.recipe,s.contract.recipe);
 assert.equal(cloned.contract.count,s.contract.count);
 assert.ok(cloned.orders.some(x=>x.contract)||cloned.scheduled.some(x=>x.contract));
 assert.equal(cloned.today.spent,s.today.spent);
 const old=createGame(3210);delete old.contract;delete old.contractsWon;delete old.contractsLost;
 const restored=restore(serialize(old));
 assert.equal(restored.contract,null);
 assert.equal(restored.contractsWon,0);
 assert.equal(restored.contractsLost,0);
});
test('late-game catering offers scale without making unfulfillable recipes',()=>{
 const state=createGame(12);state.day=15;const offers=contractOffers(state);
 assert.equal(offers[0].count,4);
 assert.ok(offers.every(x=>recipeById(x.recipe)?.day<=state.day));
 assert.equal(acceptContract(state,offers[0].id).ok,true);
 assert.equal(state.contract.count,4);
});
