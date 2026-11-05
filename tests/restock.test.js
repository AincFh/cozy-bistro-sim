import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,planRestock,buyPlannedRestock,recipeById} from '../src/engine.js';

function emptyPantry(state){for(const key of Object.keys(state.pantry))state.pantry[key]=0;return state}
test('quotes are read-only and do not spend funds',()=>{
 const game=createGame(),before=JSON.stringify(game);
 const plan=planRestock(game,'citrus',3);
 assert.equal(plan.ok,true);
 assert.equal(plan.cost,0);
 assert.deepEqual(plan.purchases,[]);
 assert.equal(JSON.stringify(game),before);
});
test('minimum-cost toast supply picks bakery + berry packs over all-purpose pack',()=>{
 const game=emptyPantry(createGame());const plan=planRestock(game,'toast',3);
 assert.equal(plan.ok,true);
 assert.equal(plan.cost,136);
 assert.deepEqual(plan.purchases.map(x=>x.id).sort(),['bakery','berries']);
 assert.equal(game.money,270);
 const purchase=buyPlannedRestock(game,'toast',3);
 assert.equal(purchase.ok,true);
 assert.equal(purchase.spent,136);
 assert.equal(game.money,134);
 assert.equal(game.today.spent,136);
 for(const [item,amount]of Object.entries(recipeById('toast').recipe))
  assert.ok(game.pantry[item]>=amount*3,item);
 assert.equal(buyPlannedRestock(game,'toast',3).spent,0);
 assert.equal(game.money,134);
});
test('insufficient budget fails atomically without changing inventory or daily spending',()=>{
 const game=emptyPantry(createGame());game.money=135;
 const before=JSON.stringify(game),plan=planRestock(game,'toast',3);
 assert.equal(plan.affordable,false);
 const result=buyPlannedRestock(game,'toast',3);
 assert.equal(result.ok,false);
 assert.equal(result.cost,136);
 assert.equal(JSON.stringify(game),before);
});
test('orders cannot buy food mid-service or for locked recipes',()=>{
 const game=emptyPantry(createGame());
 assert.equal(planRestock(game,'risotto',3).ok,false);
 assert.equal(planRestock(game,'toast',0).ok,false);
 assert.equal(planRestock(game,'toast',9).ok,false);
 game.phase='open';
 const before=JSON.stringify(game);
 assert.equal(buyPlannedRestock(game,'toast',3).ok,false);
 assert.equal(JSON.stringify(game),before);
});
test('complex recipes are fully supplied with best available pack combination',()=>{
 const game=emptyPantry(createGame());game.day=7;game.money=1000;
 const plan=planRestock(game,'brunch',3);
 assert.equal(plan.cost,172);
 assert.deepEqual(plan.purchases.map(x=>x.id).sort(),['bakery','pantry']);
 assert.equal(buyPlannedRestock(game,'brunch',3).spent,172);
 for(const [key,n]of Object.entries(recipeById('brunch').recipe))
  assert.ok(game.pantry[key]>=n*3,key);
});
