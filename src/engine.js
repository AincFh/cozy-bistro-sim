// COZY BISTRO / Simulation engine - dependency-free, testable and deterministic.
export const SAVE_VERSION=1;
export const INGREDIENTS={
 tea:{name:'茶叶',emoji:'🍃'},lemon:{name:'柠檬',emoji:'🍋'},bread:{name:'吐司',emoji:'🍞'},berries:{name:'莓果',emoji:'🍓'},
 lettuce:{name:'生菜',emoji:'🥬'},tomato:{name:'番茄',emoji:'🍅'},coffee:{name:'咖啡豆',emoji:'☕'},milk:{name:'牛奶',emoji:'🥛'},
 pasta:{name:'意面',emoji:'🍝'},cheese:{name:'奶酪',emoji:'🧀'},rice:{name:'米',emoji:'🍚'},mushroom:{name:'蘑菇',emoji:'🍄'},
 cream:{name:'奶油',emoji:'🥣'},eggs:{name:'鸡蛋',emoji:'🥚'}
};
export const MENU=[
 {id:'citrus',name:'柠檬冰茶',en:'CITRUS TEA',emoji:'🍋',day:1,price:19,prep:4,recipe:{tea:1,lemon:1},color:'#d9b96b',flavor:'清爽 · 解腻'},
 {id:'toast',name:'莓果厚吐司',en:'BERRY TOAST',emoji:'🍞',day:1,price:29,prep:6,recipe:{bread:1,berries:1},color:'#de9786',flavor:'甜点 · 热门'},
 {id:'salad',name:'花园沙拉',en:'GARDEN SALAD',emoji:'🥗',day:1,price:35,prep:7,recipe:{lettuce:1,tomato:1},color:'#96b98e',flavor:'轻食 · 健康'},
 {id:'latte',name:'香草拿铁',en:'MILK LATTE',emoji:'☕',day:2,price:36,prep:6,recipe:{coffee:1,milk:1},color:'#d0af8e',flavor:'咖啡 · 香浓'},
 {id:'pasta',name:'番茄芝士意面',en:'TOMATO PASTA',emoji:'🍝',day:3,price:59,prep:10,recipe:{pasta:1,tomato:2,cheese:1},color:'#c8876d',flavor:'主食 · 人气'},
 {id:'risotto',name:'森林蘑菇烩饭',en:'FOREST RISOTTO',emoji:'🍄',day:5,price:72,prep:12,recipe:{rice:1,mushroom:2,cream:1},color:'#9b9f86',flavor:'招牌 · 暖心'},
 {id:'brunch',name:'云朵早午餐',en:'CLOUD BRUNCH',emoji:'🥚',day:7,price:69,prep:11,recipe:{eggs:2,bread:1,cheese:1},color:'#ebbc76',flavor:'早午餐 · 丰盛'},
 {id:'pavlova',name:'莓雪奶油杯',en:'BERRY PARFAIT',emoji:'🍨',day:9,price:58,prep:9,recipe:{berries:2,cream:1},color:'#db9cb3',flavor:'甜点 · 精品'}
];
export const PACKS=[
 {id:'garden',name:'清晨菜篮',subtitle:'新鲜叶菜与番茄',price:65,items:{lettuce:7,tomato:9,mushroom:3}},
 {id:'bakery',name:'面包房配送',subtitle:'吐司与新鲜鸡蛋',price:68,items:{bread:8,eggs:7}},
 {id:'drinks',name:'咖啡茶饮补给',subtitle:'茶叶、柠檬与咖啡',price:88,items:{tea:8,lemon:8,coffee:7,milk:7}},
 {id:'berries',name:'莓果甜品篮',subtitle:'莓果与奶油',price:68,items:{berries:9,cream:5}},
 {id:'pantry',name:'主食储备箱',subtitle:'奶酪、米饭与意面',price:104,items:{rice:9,pasta:9,cheese:7,mushroom:4,cream:4}},
 {id:'essentials',name:'开业万能补给',subtitle:'最常用的六种原料',price:143,items:{tea:5,lemon:5,bread:6,berries:5,lettuce:5,tomato:7}}
];
export const UPGRADES=[
 {id:'stove',name:'专业灶台',emoji:'🔥',base:280,max:3,desc:'每级烹饪速度 +18%'},
 {id:'counter',name:'双人厨房',emoji:'🍳',base:520,max:2,desc:'每级增加一个同时制作位置'},
 {id:'ambience',name:'温馨餐厅',emoji:'🪴',base:330,max:3,desc:'每级顾客耐心 +8 秒'},
 {id:'marketing',name:'邻里口碑',emoji:'✦',base:410,max:3,desc:'每日新增 2 位顾客'},
 {id:'tips',name:'贴心服务',emoji:'♥',base:330,max:3,desc:'每级小费率额外 +5%'}
];
export const CUSTOMERS=['小夏','柚子','阿雅','艾米','林先生','木子','桃桃','阿泽','小松','贝拉','若林','浅浅','星野','橘子','苏苏','雨果'];
/** Regulars are earned from real service and lost from impatient walkouts. */
export const REGULAR_TIERS=Object.freeze([0,3,8,18]);
export const REGULARS=Object.freeze({patiencePerTier:4,tipPerTier:3,returnWeightPerTier:1.4});
const validGuest=name=>CUSTOMERS.includes(name);
function regularRecord(state,name){
 if(!state.regulars||typeof state.regulars!=='object')state.regulars={};
 if(!state.regulars[name])state.regulars[name]={served:0,missed:0,lastSeenDay:0};
 return state.regulars[name];
}
export function regularLevel(state,name){
 if(!validGuest(name))return 0;
 const entry=state.regulars?.[name];if(!entry)return 0;
 const trust=Math.max(0,Math.max(0,entry.served||0)-2*Math.max(0,entry.missed||0));
 return REGULAR_TIERS.reduce((level,threshold,i)=>trust>=threshold?i:level,0);
}
export function regularOverview(state){
 return CUSTOMERS.map(name=>{
  const entry=state.regulars?.[name]||{served:0,missed:0,lastSeenDay:0};
  const served=Math.max(0,entry.served||0),missed=Math.max(0,entry.missed||0);
  const trust=Math.max(0,served-2*missed),tier=regularLevel(state,name);
  return{name,served,missed,trust,tier,next:tier>=REGULAR_TIERS.length-1?null:REGULAR_TIERS[tier+1],
   tipBonus:tier*REGULARS.tipPerTier,patienceBonus:tier*REGULARS.patiencePerTier,lastSeenDay:entry.lastSeenDay||0};
 }).sort((a,b)=>b.tier-a.tier||b.trust-a.trust||b.served-a.served||a.name.localeCompare(b.name,'zh'));
}
export function pickGuest(state,roll){
 const r=Math.max(0,Math.min(.999999999999,Number.isFinite(roll)?roll:0));
 const weights=CUSTOMERS.map(name=>1+regularLevel(state,name)*REGULARS.returnWeightPerTier);
 const total=weights.reduce((a,b)=>a+b,0);let sample=r*total;
 for(let i=0;i<CUSTOMERS.length;i++){sample-=weights[i];if(sample<0)return CUSTOMERS[i]}
 return CUSTOMERS.at(-1);
}
function recordRegularOutcome(state,name,served){
 if(!validGuest(name))return 0;
 const entry=regularRecord(state,name),tier=regularLevel(state,name);
 if(served)entry.served=Math.min(1e6,entry.served+1);
 else entry.missed=Math.min(1e6,entry.missed+1);
 entry.lastSeenDay=state.day;
 return tier;
}
export const DAILY_FEATURE=Object.freeze({fee:38,weight:3,markup:.18});
export const DEFAULT_PANTRY={tea:7,lemon:7,bread:6,berries:6,lettuce:7,tomato:9,coffee:2,milk:2,pasta:0,cheese:0,rice:0,mushroom:0,cream:0,eggs:0};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const integer=(n,min=0,max=1000000)=>Math.round(clamp(Number(n),min,max));
const byId=(list,id)=>list.find(x=>x.id===id);
export function recipeById(id){return byId(MENU,id);}
export function levelOf(state){return Math.min(25,1+Math.floor(Math.sqrt(Math.max(0,state.xp||0)/190)));}
export function recipesAvailable(state){return MENU.filter(x=>x.day<=state.day);}
export function ingredientAvailable(state,recipe){return Object.entries(recipe.recipe).every(([k,v])=>(state.pantry[k]||0)>=v);}
export function slots(state){return 1+(state.upgrades.counter||0);}
export function prepDuration(state,recipe){return +(recipe.prep/Math.pow(1.18,state.upgrades.stove||0)).toFixed(2);}
export function upgradePrice(state,id){const item=byId(UPGRADES,id);return item?Math.round(item.base*Math.pow(1.7,state.upgrades[id]||0)):null;}
export function createGame(seed=20261105){
 return {version:SAVE_VERSION,seed:integer(seed,0,4294967295)>>>0,day:1,phase:'planning',money:270,rep:65,xp:0,totalServed:0,totalMissed:0,
 pantry:{...DEFAULT_PANTRY},regulars:{},upgrades:{stove:0,counter:0,ambience:0,marketing:0,tips:0},
 elapsed:0,duration:110,scheduled:[],orders:[],idSeq:0,
 today:{served:0,missed:0,revenue:0,tips:0,spent:0,staffTraining:0,contractBonus:0,platingBonus:0,specialBonus:0,specialServed:0,regularBonus:0,regularsServed:0},
 lastSummary:null,history:[],sound:true,gameSpeed:1,lastAidDay:0,platingPerfect:0,platingGood:0,platingAttempts:0,platingBestStreak:0,platingStreak:0,
 assistantHired:false,assistantCooldown:0,assistantServed:0,todayAssistantServed:0,
  assistantXp:0,assistantTrainedDay:0,assistantTrainingSessions:0,assistantTrainingTotal:0,assistantShiftWage:0,
 contract:null,contractsWon:0,contractsLost:0,dailySpecial:null,specialsLaunched:0,specialServed:0};
}
export function rng(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
/**
 * Neighborhood catering adds risky, multi-plate commitments to normal walk-in
 * service. Deposits are held at acceptance; the player receives the deposit
 * back plus a premium bonus ONLY after delivering every contracted dish.
 * Both generated offers depend on persisted state, not ambient Math.random.
 */
export function contractOffers(state){
 const menu=recipesAvailable(state);if(!menu.length)return[];
 const count=2+(state.day>=4?1:0)+(state.day>=10?1:0);
 const first=(state.day+(state.seed>>>0))%menu.length;
 return [0,1].map(i=>{
  const recipe=menu[(first+i)%menu.length];
  const deposit=Math.max(20,Math.round(recipe.price*count*.45));
  const bonus=Math.round(recipe.price*count*.82)+(state.day>=6?25:0);
  return {id:'neighborhood-'+state.day+'-'+i,recipe:recipe.id,count,deposit,bonus,
   customer:i===0?'街区读书会':'社区花房',description:i===0?'为邻里活动准备整套餐点':'按时交付花房小型聚会的料理'};
 });
}
export function acceptContract(state,id){
 if(state.phase!=='planning')return {ok:false,error:'社区订餐只能在开业前接取'};
 if(state.contract)return {ok:false,error:'今日已经接取过一份社区订单'};
 const offer=contractOffers(state).find(x=>x.id===id);
 if(!offer)return {ok:false,error:'这份订餐委托不存在'};
 if(state.money<offer.deposit)return {ok:false,error:'营业资金不足，无法缴纳订餐押金'};
 state.money-=offer.deposit;state.today.spent+=offer.deposit;
 state.contract={...offer,day:state.day,delivered:0,status:'accepted'};
 return {ok:true,contract:state.contract};
}
function failContract(state){
 const contract=state.contract;
 if(!contract||contract.status!=='active')return false;
 contract.status='failed';state.contractsLost++;
 state.rep=clamp(state.rep-4,0,100);return true;
}
export const ASSISTANT = Object.freeze({name:'小森 · 兼职料理助手',minimumDay:2,wage:98,cooldown:4.5,initialDelay:3.2});
export const STAFF_CAREER=Object.freeze({levels:[0,5,16,34,60],trainingXp:8,maxXp:60,trainingBase:140,trainingStep:70,wageStep:12,cooldownStep:.38});
export function assistantLevel(state){
 const xp=Number.isFinite(state.assistantXp)?Math.min(STAFF_CAREER.maxXp,Math.max(0,state.assistantXp)):0;
 return STAFF_CAREER.levels.reduce((level,threshold,i)=>xp>=threshold?i+1:level,1);
}
export function assistantCooldownFor(state){return +(ASSISTANT.cooldown-(assistantLevel(state)-1)*STAFF_CAREER.cooldownStep).toFixed(2);}
export function assistantWage(state){return ASSISTANT.wage+(assistantLevel(state)-1)*STAFF_CAREER.wageStep;}
export function assistantTrainingPrice(state){return STAFF_CAREER.trainingBase+(assistantLevel(state)-1)*STAFF_CAREER.trainingStep;}
export function canTrainAssistant(state){
 return state.phase==='planning'&&state.day>=ASSISTANT.minimumDay&&state.assistantTrainedDay!==state.day&&
  assistantLevel(state)<STAFF_CAREER.levels.length&&state.money>=assistantTrainingPrice(state);
}
export function trainAssistant(state){
 if(state.phase!=='planning')return{ok:false,error:'必须在营业前进行培训'};
 if(state.day<ASSISTANT.minimumDay)return{ok:false,error:'第 2 天起开放员工培训'};
 if(state.assistantTrainedDay===state.day)return{ok:false,error:'每个营业日只能培训一次'};
 if(assistantLevel(state)>=STAFF_CAREER.levels.length)return{ok:false,error:'兼职助手已达到最高技能等级'};
 const price=assistantTrainingPrice(state);
 if(state.money<price)return{ok:false,error:'资金不足，无法支付培训费用'};
 state.money-=price;state.today.spent+=price;state.today.staffTraining=(state.today.staffTraining||0)+price;
 state.assistantXp=Math.min(STAFF_CAREER.maxXp,(state.assistantXp||0)+STAFF_CAREER.trainingXp);
 state.assistantTrainedDay=state.day;state.assistantTrainingSessions=(state.assistantTrainingSessions||0)+1;
 state.assistantTrainingTotal=(state.assistantTrainingTotal||0)+price;
 return{ok:true,cost:price,level:assistantLevel(state),xp:state.assistantXp};
}
function earnAssistantXp(state){
 // No ingredients/serve action succeeded => no staff XP.
 state.assistantXp=Math.min(STAFF_CAREER.maxXp,(state.assistantXp||0)+1);
}
export function canHireAssistant(state){
 return state.phase==='planning'&&state.day>=ASSISTANT.minimumDay&&!state.assistantHired&&state.money>=assistantWage(state);
}
export function hireAssistant(state){
 if(state.phase!=='planning')return {ok:false,error:'只能在营业前安排兼职'};
 if(state.day<ASSISTANT.minimumDay)return {ok:false,error:'第 2 天起开放兼职排班'};
 if(state.assistantHired)return {ok:false,error:'今天已经安排了兼职助手'};
 const wage=assistantWage(state);
 if(state.money<wage)return {ok:false,error:'资金不足，无法支付兼职工资'};
 state.money-=wage;state.today.spent+=wage;
 state.assistantHired=true;state.assistantShiftWage=wage;
 state.assistantCooldown=Math.max(1,ASSISTANT.initialDelay-(assistantLevel(state)-1)*.2);
 return {ok:true,wage,assistant:ASSISTANT.name,level:assistantLevel(state)};
}
export const SUPPORT_ITEMS={tea:3,lemon:3,bread:3,berries:3,lettuce:3,tomato:3};
export function canClaimSupport(state){
 const noMeals=recipesAvailable(state).every(recipe=>!ingredientAvailable(state,recipe));
 return state.phase==='planning'&&state.lastAidDay<state.day&&(state.money<80||noMeals);
}
export function claimSupport(state){
 if(!canClaimSupport(state))return{ok:false,error:'当前不符合应急补给领取条件'};
 for(const [k,v]of Object.entries(SUPPORT_ITEMS))state.pantry[k]=(state.pantry[k]||0)+v;
 state.lastAidDay=state.day;return{ok:true,items:SUPPORT_ITEMS};
}
/**
 * Find the cheapest bundle of existing supplier packs needed to make N
 * servings of a selected unlocked dish, after counting current inventory.
 * This is an exact bounded search over pack quantities (only six suppliers).
 * A quoted plan never mutates the simulation.
 */
export function planRestock(state,recipeId,servings=3){
 const recipe=recipeById(recipeId);
 if(!recipe||recipe.day>state.day)return{ok:false,error:'这份菜谱尚未解锁'};
 if(!Number.isInteger(servings)||servings<1||servings>8)return{ok:false,error:'备货份数必须在 1–8 之间'};
 const required=Object.fromEntries(Object.entries(recipe.recipe).map(([k,v])=>[k,v*servings]));
 const missing=Object.fromEntries(Object.entries(required).map(([k,n])=>[k,Math.max(0,n-Math.max(0,Number(state.pantry[k])||0))]));
 const keys=Object.keys(required);
 if(keys.every(k=>missing[k]===0))
  return{ok:true,recipe,servings,missing,purchases:[],cost:0,affordable:true};
 const suppliers=PACKS.filter(p=>keys.some(k=>missing[k]>0&&(p.items[k]||0)>0));
 let bestCost=Infinity,bestCount=Infinity,best=null;
 function search(index,needs,cost,chosen,count){
  if(cost>bestCost||(cost===bestCost&&count>=bestCount))return;
  if(keys.every(k=>needs[k]===0)){
   bestCost=cost;bestCount=count;best=[...chosen];return;
  }
  if(index===suppliers.length)return;
  const pack=suppliers[index];
  const maxCopies=Math.max(0,...keys.map(k=>pack.items[k]?Math.ceil(needs[k]/pack.items[k]):0));
  for(let copies=0;copies<=maxCopies;copies++){
   chosen[index]=copies;
   const next={};
   for(const k of keys)next[k]=Math.max(0,needs[k]-copies*(pack.items[k]||0));
   search(index+1,next,cost+copies*pack.price,chosen,count+copies);
  }
  chosen[index]=0;
 }
 search(0,missing,0,[],0);
 if(!best)return{ok:false,error:'当前配送商无法补齐所需食材'};
 const purchases=suppliers.map((p,i)=>({...p,count:best[i]||0})).filter(p=>p.count>0);
 return{ok:true,recipe,servings,missing,purchases,cost:bestCost,affordable:state.money>=bestCost};
}
/** Purchase all quoted packs atomically; insufficient funds never alter data. */
export function buyPlannedRestock(state,recipeId,servings=3){
 if(state.phase!=='planning')return{ok:false,error:'只能在营业前进行批量备货'};
 const plan=planRestock(state,recipeId,servings);
 if(!plan.ok)return plan;
 if(!plan.affordable)return{ok:false,error:'当前资金不足，无法完成整套采购',cost:plan.cost};
 if(plan.cost===0)return{ok:true,spent:0,plan};
 // All preconditions checked before the first mutation.
 state.money-=plan.cost;state.today.spent+=plan.cost;
 for(const pack of plan.purchases)
  for(const [ingredient,qty]of Object.entries(pack.items))
   state.pantry[ingredient]=(state.pantry[ingredient]||0)+qty*pack.count;
 return{ok:true,spent:plan.cost,plan};
}
export function buyPackage(state,id){const pack=byId(PACKS,id);if(!pack)return{ok:false,error:'不存在的补给'};
 if(state.phase!=='planning')return{ok:false,error:'请在营业前备货'};
 if(state.money<pack.price)return{ok:false,error:'金币不足'};
 state.money-=pack.price;state.today.spent+=pack.price;
 for(const [k,v]of Object.entries(pack.items))state.pantry[k]=(state.pantry[k]||0)+v;
 return{ok:true,pack};
}
export function buyUpgrade(state,id){const item=byId(UPGRADES,id);if(!item)return{ok:false,error:'不存在的升级'};
 if(state.phase!=='planning')return{ok:false,error:'请在营业前升级'};
 if(state.upgrades[id]>=item.max)return{ok:false,error:'已经升级到最高等级'};
 const price=upgradePrice(state,id);if(state.money<price)return{ok:false,error:'金币不足'};
 state.money-=price;state.upgrades[id]++;state.today.spent+=price;return{ok:true,item,price};
}
/** Daily menu spotlight: one paid marketing campaign per service day.
 * Choosing it shifts real guest demand and changes walk-in sale prices.
 * Contracted catering stays at its agreed base price.
 */
export function chooseDailySpecial(state,recipeId){
 if(state.phase!=='planning')return{ok:false,error:'只能在开业前确定今日主推'};
 const recipe=recipeById(recipeId);
 if(!recipe||recipe.day>state.day)return{ok:false,error:'今日尚未解锁这道菜'};
 if(state.dailySpecial===recipeId)return{ok:true,recipe,spent:0,unchanged:true};
 const fee=state.dailySpecial?0:DAILY_FEATURE.fee;
 if(state.money<fee)return{ok:false,error:'营销预算不足，请先保留必要资金'};
 state.money-=fee;state.today.spent+=fee;
 state.dailySpecial=recipeId;
 return {ok:true,recipe,spent:fee,unchanged:false};
}
export function salePrice(state,recipeOrId,isContract=false){
 const recipe=typeof recipeOrId==='string'?recipeById(recipeOrId):recipeOrId;
 if(!recipe)return 0;
 return !isContract&&state.dailySpecial===recipe.id?
  Math.round(recipe.price*(1+DAILY_FEATURE.markup)):recipe.price;
}
export function featuredDemandShare(state){
 const available=recipesAvailable(state);
 if(!state.dailySpecial||!available.some(x=>x.id===state.dailySpecial))return 0;
 return DAILY_FEATURE.weight/(available.length-1+DAILY_FEATURE.weight);
}
function pickWalkInDish(state,available){
 if(!state.dailySpecial)return available[Math.floor(rng(state)*available.length)];
 const pool=available.filter(x=>x.id!==state.dailySpecial);
 const choice=rng(state)*(DAILY_FEATURE.weight+pool.length);
 return choice<DAILY_FEATURE.weight?recipeById(state.dailySpecial):
  pool[Math.min(pool.length-1,Math.floor(choice-DAILY_FEATURE.weight))];
}
export function startDay(state){
 if(state.phase!=='planning')return{ok:false,error:'请先完成当前营业日'};
 const available=recipesAvailable(state),count=7+Math.min(5,Math.floor(state.day/2))+(state.upgrades.marketing||0)*2;
 if(state.dailySpecial)state.specialsLaunched=(state.specialsLaunched||0)+1;
 state.orders=[];state.scheduled=[];state.elapsed=0;state.duration=0;
 for(let i=0;i<count;i++){
  const recipe=pickWalkInDish(state,available);
  const customer=pickGuest(state,rng(state));
  const arrival=3+i*8.7+rng(state)*2.3;
  const patience=34+rng(state)*14+(state.upgrades.ambience||0)*8+regularLevel(state,customer)*REGULARS.patiencePerTier;
  state.scheduled.push({id:++state.idSeq,recipe:recipe.id,customer,arrival:+arrival.toFixed(2),patience:+patience.toFixed(1),mood:Math.floor(rng(state)*5)});
 }
 if(state.contract?.status==='accepted'&&state.contract.day===state.day){
  state.contract.status='active';
  for(let i=0;i<state.contract.count;i++){
   state.scheduled.push({id:++state.idSeq,recipe:state.contract.recipe,
    customer:state.contract.customer,arrival:7+i*12,patience:76+(state.upgrades.ambience||0)*8,
    mood:4,contract:true});
  }
 }
 state.scheduled.sort((a,b)=>a.arrival-b.arrival);
 state.duration=Math.ceil(state.scheduled.at(-1).arrival+28);
 state.phase='open';state.assistantCooldown=Math.max(1,ASSISTANT.initialDelay-(assistantLevel(state)-1)*.2);
 return{ok:true,count:count+(state.contract?.status==='active'?state.contract.count:0),duration:state.duration};
}
export function cookOrder(state,id){
 if(state.phase!=='open')return{ok:false,error:'餐厅目前未营业'};
 const order=state.orders.find(x=>x.id===id),recipe=order&&recipeById(order.recipe);
 if(!order||order.status!=='waiting'||!recipe)return{ok:false,error:'订单不存在或已处理'};
 if(state.orders.filter(x=>x.status==='cooking').length>=slots(state))return{ok:false,error:'厨房制作台已满'};
 if(!ingredientAvailable(state,recipe))return{ok:false,error:'食材不足，今日无法补货'};
 for(const [k,v] of Object.entries(recipe.recipe))state.pantry[k]-=v;
 order.status='cooking';order.cookLeft=prepDuration(state,recipe);order.cookTotal=order.cookLeft;
 return{ok:true,recipe};
}
export function platingResult(score,recipePrice){
 if(!Number.isFinite(score)||score<0||score>1)return{grade:'standard',bonus:0,repBonus:0,xpBonus:0};
 const grade=score>=.88?'perfect':score>=.6?'good':score>=.35?'fair':'miss';
 const bonus=grade==='perfect'?Math.round(recipePrice*.23):grade==='good'?Math.round(recipePrice*.12):grade==='fair'?Math.round(recipePrice*.04):0;
 return {grade,bonus,repBonus:grade==='perfect'?2:grade==='good'?1:0,xpBonus:grade==='perfect'?18:grade==='good'?9:grade==='fair'?3:0};
}
export function serveOrder(state,id,{platingScore=null}={}){
 if(state.phase!=='open')return{ok:false,error:'餐厅未营业'};
 const index=state.orders.findIndex(x=>x.id===id&&x.status==='ready');
 if(index<0)return{ok:false,error:'订单尚未完成'};
 const order=state.orders[index],recipe=recipeById(order.recipe);
 const quality=order.patience/Math.max(1,order.maxPatience);
 const charged=salePrice(state,recipe,order.contract);
 const specialBonus=charged-recipe.price;
 const loyaltyTier=order.contract?0:regularLevel(state,order.customer);
 const regularBonus=loyaltyTier*REGULARS.tipPerTier;
 const tip=Math.round(charged*((quality>.5?.13:.05)+(state.upgrades.tips||0)*.05));
 const plating=platingResult(state.assistantAction?null:platingScore,charged);
 const gain=charged+tip+plating.bonus+regularBonus;
 state.money+=gain;state.xp+=Math.ceil(recipe.price*.65)+Math.round(quality*12)+plating.xpBonus;
 state.rep=clamp(state.rep+(quality>.33?1:-1)+plating.repBonus,0,100);
 if(plating.grade!=='standard'){
  state.platingAttempts=(state.platingAttempts||0)+1;
  if(plating.grade==='perfect')state.platingPerfect=(state.platingPerfect||0)+1;
  if(plating.grade==='good')state.platingGood=(state.platingGood||0)+1;
  state.platingStreak=plating.grade==='perfect'?Math.min(1000,(state.platingStreak||0)+1):0;
  state.platingBestStreak=Math.max(state.platingBestStreak||0,state.platingStreak);
 }
 state.today.served++;state.today.revenue+=charged;state.today.tips+=tip+plating.bonus+regularBonus;state.today.regularBonus=(state.today.regularBonus||0)+regularBonus;state.today.platingBonus=(state.today.platingBonus||0)+plating.bonus;state.totalServed++;
 if(specialBonus>0){
  state.today.specialBonus=(state.today.specialBonus||0)+specialBonus;
  state.today.specialServed=(state.today.specialServed||0)+1;
  state.specialServed=(state.specialServed||0)+1;
 }
 if(!order.contract){recordRegularOutcome(state,order.customer,true);state.today.regularsServed=(state.today.regularsServed||0)+1;}
 if(state.assistantAction){state.assistantServed++;state.todayAssistantServed++;}
 let contractBonus=0,depositRefund=0,contractCompleted=false;
 const contract=state.contract;
 if(order.contract&&contract?.status==='active'&&contract.recipe===order.recipe){
  contract.delivered++;
  if(contract.delivered>=contract.count){
   contract.status='completed';contractCompleted=true;state.contractsWon++;
   contractBonus=contract.bonus;depositRefund=contract.deposit;
   state.money+=contractBonus+depositRefund;
   state.today.revenue+=contractBonus+depositRefund;
   state.today.contractBonus=(state.today.contractBonus||0)+contractBonus;
   state.rep=clamp(state.rep+3,0,100);state.xp+=40+10*contract.count;
  }
 }
 state.orders.splice(index,1);
 return{ok:true,recipe,tip,gain,quality,plating,salePrice:charged,specialBonus,regularBonus,loyaltyTier,contractCompleted,contractBonus,depositRefund};
}
// Each helper action must use the normal cooking/serving rules. No ingredients,
// money or chef slots are granted by automation.
function runAssistant(state){
 if(!state.assistantHired||state.phase!=='open'||state.assistantCooldown>0)return null;
 const ready=state.orders.find(x=>x.status==='ready');
 if(ready){
   state.assistantAction=true;
   const served=serveOrder(state,ready.id);
   state.assistantAction=false;
   if(served.ok){earnAssistantXp(state);state.assistantCooldown=assistantCooldownFor(state);
     return {type:'assistantServe',id:ready.id,recipe:ready.recipe,gain:served.gain};}
 }
 const waiting=state.orders.find(x=>x.status==='waiting'&&ingredientAvailable(state,recipeById(x.recipe)));
 if(waiting){
   const cooked=cookOrder(state,waiting.id);
   if(cooked.ok){earnAssistantXp(state);state.assistantCooldown=assistantCooldownFor(state);
     return {type:'assistantCook',id:waiting.id,recipe:waiting.recipe};}
 }
 state.assistantCooldown=1;
 return null;
}
function missOrder(state,index){
 const order=state.orders[index];
 state.today.missed++;state.totalMissed++;
 state.rep=clamp(state.rep-3,0,100);
 if(order.contract)failContract(state);
 else recordRegularOutcome(state,order.customer,false);
 state.orders.splice(index,1);return order;
}
export function finishDay(state){
 if(state.phase!=='open'||state.scheduled.length||state.orders.length||state.elapsed<state.duration-10)return false;
 if(state.contract?.status==='active')failContract(state);
 const summary={day:state.day,...state.today,assistantServed:state.todayAssistantServed,
  assistantWages:state.assistantHired?(state.assistantShiftWage||ASSISTANT.wage):0,
   staffTraining:state.today.staffTraining||0,assistantLevel:assistantLevel(state),
  contractStatus:state.contract?.status||null,contractRecipe:state.contract?.recipe||null,
  contractDelivered:state.contract?.delivered||0,
  contractRequired:state.contract?.count||0,
  specialDish:state.dailySpecial||null,
  specialBonus:state.today.specialBonus||0,specialServed:state.today.specialServed||0,
  regularBonus:state.today.regularBonus||0,regularsServed:state.today.regularsServed||0,
  platingBonus:state.today.platingBonus||0,platingPerfect:state.platingPerfect||0,
  rep:state.rep,balance:state.money};
 state.history.push(summary);state.history=state.history.slice(-24);
 state.lastSummary=summary;state.phase='summary';return true;
}
export function advance(state,seconds){
 if(state.phase!=='open')return[];
 const events=[],total=clamp(seconds,0,240);
 // Step through time to preserve guest patience and consistent cooking behavior.
 let remainder=total;
 while(remainder>0&&state.phase==='open'){
  const dt=Math.min(remainder,.15);remainder-=dt;state.elapsed+=dt;
  while(state.scheduled.length&&state.scheduled[0].arrival<=state.elapsed){
   const g=state.scheduled.shift();
   state.orders.push({id:g.id,recipe:g.recipe,customer:g.customer,status:'waiting',
    patience:g.patience,maxPatience:g.patience,cookLeft:0,cookTotal:0,mood:g.mood,contract:g.contract===true});
   events.push({type:'arrival',id:g.id,recipe:g.recipe,customer:g.customer});
  }
  if(state.assistantHired){state.assistantCooldown=Math.max(0,state.assistantCooldown-dt);const action=runAssistant(state);if(action)events.push(action);}
  for(let i=state.orders.length-1;i>=0;i--){
   const o=state.orders[i];o.patience-=dt;
   if(o.patience<=0){const lost=missOrder(state,i);events.push({type:'missed',id:lost.id,recipe:lost.recipe});continue;}
   if(o.status==='cooking'){
    o.cookLeft=Math.max(0,o.cookLeft-dt);
    if(o.cookLeft<=0){o.status='ready';events.push({type:'ready',id:o.id,recipe:o.recipe});}
   }
  }
  if(finishDay(state)){events.push({type:'summary',day:state.day});break;}
 }
 return events;
}
export function nextDay(state){
 if(state.phase!=='summary')return false;
 state.day++;state.phase='planning';state.elapsed=0;state.duration=110;state.orders=[];state.scheduled=[];
 state.today={served:0,missed:0,revenue:0,tips:0,spent:0,staffTraining:0,contractBonus:0,platingBonus:0,specialBonus:0,specialServed:0,regularBonus:0,regularsServed:0};state.dailySpecial=null;state.assistantHired=false;state.assistantCooldown=0;state.assistantShiftWage=0;state.todayAssistantServed=0;state.contract=null;return true;
}
export function achievements(state){
 return [
  {id:'first',name:'第一份微笑',note:'成功送出第一份餐点',earned:state.totalServed>=1},
  {id:'ten',name:'熟悉的客人',note:'累计完成 10 份订单',earned:state.totalServed>=10},
  {id:'fifty',name:'街角招牌',note:'累计完成 50 份订单',earned:state.totalServed>=50},
  {id:'five',name:'五日主厨',note:'经营满五天',earned:state.day>=5},
  {id:'tenDays',name:'十日老店',note:'经营满十天',earned:state.day>=10},
  {id:'reputation',name:'五星好评',note:'口碑达到 95 分',earned:state.rep>=95},
  {id:'rich',name:'金色收银台',note:'持有 2000 金币',earned:state.money>=2000},
  {id:'partnership',name:'街角的默契',note:'兼职助手累计协助完成 20 次上菜',earned:(state.assistantServed||0)>=20},
   {id:'trainee',name:'小店培训师',note:'将兼职助手提升至 3 级',earned:assistantLevel(state)>=3},
   {id:'mentor',name:'金牌伙伴',note:'将兼职助手提升至满级',earned:assistantLevel(state)>=5},
  {id:'neighbor',name:'邻里的信任',note:'按时完成首份社区订餐委托',earned:(state.contractsWon||0)>=1},
  {id:'catering',name:'餐饮承办达人',note:'累计完成 10 份社区订餐委托',earned:(state.contractsWon||0)>=10},
  {id:'plating',name:'摆盘艺术家',note:'完成 5 次完美摆盘',earned:(state.platingPerfect||0)>=5},
  {id:'streak',name:'手感正佳',note:'连续 3 次完美摆盘',earned:(state.platingBestStreak||0)>=3},
  {id:'marketer',name:'今日推荐主厨',note:'成功举办 5 次餐厅主推活动',earned:(state.specialsLaunched||0)>=5},
  {id:'favorite',name:'街区招牌',note:'累计卖出 25 份主推菜',earned:(state.specialServed||0)>=25},
  {id:'welcome',name:'邻里熟客',note:'至少一名顾客成为 2 级熟客',earned:regularOverview(state).some(x=>x.tier>=2)},
  {id:'friends',name:'街角的人情味',note:'培养至少四位 1 级熟客',earned:regularOverview(state).filter(x=>x.tier>=1).length>=4}
 ];
}
export function serialize(state){return JSON.stringify(state);}
export function restore(raw){
 try{
  const val=typeof raw==='string'?JSON.parse(raw):raw;
  if(!val||val.version!==SAVE_VERSION||typeof val!=='object')return createGame();
  const d=createGame(val.seed);
  for(const k of ['day','money','xp','totalServed','totalMissed','idSeq'])d[k]=integer(val[k]??d[k],k==='day'?1:0,k==='day'?1000:1e9);
  d.seed=integer(val.seed??20261105,0,4294967295)>>>0;d.rep=integer(val.rep??65,0,100);
  d.lastAidDay=integer(val.lastAidDay??0,0,1000);
  if(val.regulars&&typeof val.regulars==='object'&&!Array.isArray(val.regulars)){
   for(const name of CUSTOMERS){
    const rec=val.regulars[name];
    if(!rec||typeof rec!=='object'||Array.isArray(rec))continue;
    const served=integer(rec.served??0,0,1e6),missed=integer(rec.missed??0,0,1e6);
    if(served||missed)d.regulars[name]={served,missed,lastSeenDay:integer(rec.lastSeenDay??0,0,1000)};
   }
  }
  d.assistantHired=val.assistantHired===true;d.assistantCooldown=clamp(val.assistantCooldown??0,0,ASSISTANT.cooldown);
  d.assistantServed=integer(val.assistantServed??0,0,1e9);d.todayAssistantServed=integer(val.todayAssistantServed??0,0,1e9);d.assistantAction=false;
   d.assistantXp=integer(val.assistantXp??0,0,STAFF_CAREER.maxXp);
   d.assistantTrainedDay=integer(val.assistantTrainedDay??0,0,1000);
   d.assistantTrainingSessions=integer(val.assistantTrainingSessions??0,0,1000);
   d.assistantTrainingTotal=integer(val.assistantTrainingTotal??0,0,1e9);
   d.assistantShiftWage=integer(val.assistantShiftWage??(d.assistantHired?ASSISTANT.wage:0),0,1000);
  d.contractsWon=integer(val.contractsWon??0,0,1e6);d.contractsLost=integer(val.contractsLost??0,0,1e6);
  d.specialsLaunched=integer(val.specialsLaunched??0,0,1e6);d.specialServed=integer(val.specialServed??0,0,1e6);
  d.dailySpecial=recipeById(val.dailySpecial)?.day<=d.day?val.dailySpecial:null;
  for(const key of ['platingPerfect','platingGood','platingAttempts','platingBestStreak','platingStreak'])
   d[key]=integer(val[key]??0,0,1e6);
  const c=val.contract;
  if(c&&typeof c==='object'&&recipeById(c.recipe)&&['accepted','active','failed','completed'].includes(c.status)){
   const count=integer(c.count,2,4),delivered=integer(c.delivered,0,count),day=integer(c.day,1,1000);
   if(day===d.day){
    d.contract={id:String(c.id||'').slice(0,60),day,recipe:c.recipe,count,delivered,
     customer:String(c.customer||'邻里委托').slice(0,30),description:String(c.description||'').slice(0,100),
     deposit:integer(c.deposit,0,10000),bonus:integer(c.bonus,0,10000),status:c.status};
   }
  }
  d.phase=['planning','open','summary'].includes(val.phase)?val.phase:'planning';
  for(const k of Object.keys(d.pantry))d.pantry[k]=integer(val.pantry?.[k]??d.pantry[k],0,1e7);
  for(const u of UPGRADES)d.upgrades[u.id]=integer(val.upgrades?.[u.id]??0,0,u.max);
  d.elapsed=clamp(val.elapsed??0,0,1e6);d.duration=clamp(val.duration??110,60,1e6);
  d.orders=Array.isArray(val.orders)?val.orders.filter(o=>Number.isInteger(o.id)&&recipeById(o.recipe)&&['waiting','cooking','ready'].includes(o.status)).slice(0,70).map(o=>({
    id:o.id,recipe:o.recipe,customer:String(o.customer||'客人').slice(0,30),status:o.status,
    patience:clamp(o.patience,0,300),maxPatience:clamp(o.maxPatience,1,300),cookLeft:clamp(o.cookLeft,0,120),
    cookTotal:clamp(o.cookTotal,0,120),mood:integer(o.mood,0,4),contract:o.contract===true
  })):[];
  d.scheduled=Array.isArray(val.scheduled)?val.scheduled.filter(o=>Number.isInteger(o.id)&&recipeById(o.recipe)).slice(0,100).map(o=>({
    id:o.id,recipe:o.recipe,customer:String(o.customer||'客人').slice(0,30),arrival:clamp(o.arrival,0,1e6),
    patience:clamp(o.patience,1,300),mood:integer(o.mood,0,4),contract:o.contract===true
  })):[];d.scheduled.sort((a,b)=>a.arrival-b.arrival);
  const today=val.today||{};for(const k of Object.keys(d.today))d.today[k]=integer(today[k]??0,0,1e9);
  d.history=Array.isArray(val.history)?val.history.filter(x=>x&&Number.isInteger(x.day)).slice(-24).map(h=>({
    day:integer(h.day,1,1000),served:integer(h.served),missed:integer(h.missed),revenue:integer(h.revenue),
    tips:integer(h.tips),spent:integer(h.spent),assistantServed:integer(h.assistantServed??0),
    assistantWages:integer(h.assistantWages??0),staffTraining:integer(h.staffTraining??0),
     assistantLevel:integer(h.assistantLevel??1,1,5),contractBonus:integer(h.contractBonus??0),
    contractStatus:['completed','failed'].includes(h.contractStatus)?h.contractStatus:null,
    contractRecipe:recipeById(h.contractRecipe)?h.contractRecipe:null,
    contractDelivered:integer(h.contractDelivered??0,0,4),contractRequired:integer(h.contractRequired??0,0,4),
    platingBonus:integer(h.platingBonus??0),platingPerfect:integer(h.platingPerfect??0),
    specialDish:recipeById(h.specialDish)?h.specialDish:null,specialBonus:integer(h.specialBonus??0),specialServed:integer(h.specialServed??0),
    regularBonus:integer(h.regularBonus??0),regularsServed:integer(h.regularsServed??0),
    rep:integer(h.rep,0,100),balance:integer(h.balance)
  })):[];
  d.lastSummary=d.phase==='summary'?d.history.at(-1)||null:null;
  d.sound=val.sound!==false;d.gameSpeed=[1,2].includes(val.gameSpeed)?val.gameSpeed:1;
  return d;
 }catch{return createGame();}
}