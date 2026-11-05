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
 pantry:{...DEFAULT_PANTRY},upgrades:{stove:0,counter:0,ambience:0,marketing:0,tips:0},
 elapsed:0,duration:110,scheduled:[],orders:[],idSeq:0,
 today:{served:0,missed:0,revenue:0,tips:0,spent:0},
 lastSummary:null,history:[],sound:true,gameSpeed:1,lastAidDay:0,
 assistantHired:false,assistantCooldown:0,assistantServed:0,todayAssistantServed:0};
}
export function rng(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
export const ASSISTANT = Object.freeze({name:'小森 · 兼职料理助手',minimumDay:2,wage:98,cooldown:4.5,initialDelay:3.2});
export function canHireAssistant(state){
 return state.phase==='planning'&&state.day>=ASSISTANT.minimumDay&&!state.assistantHired&&state.money>=ASSISTANT.wage;
}
export function hireAssistant(state){
 if(state.phase!=='planning')return {ok:false,error:'只能在营业前安排兼职'};
 if(state.day<ASSISTANT.minimumDay)return {ok:false,error:'第 2 天起开放兼职排班'};
 if(state.assistantHired)return {ok:false,error:'今天已经安排了兼职助手'};
 if(state.money<ASSISTANT.wage)return {ok:false,error:'资金不足，无法支付兼职工资'};
 state.money-=ASSISTANT.wage;state.today.spent+=ASSISTANT.wage;
 state.assistantHired=true;state.assistantCooldown=ASSISTANT.initialDelay;
 return {ok:true,wage:ASSISTANT.wage,assistant:ASSISTANT.name};
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
export function startDay(state){
 if(state.phase!=='planning')return{ok:false,error:'请先完成当前营业日'};
 const available=recipesAvailable(state),count=7+Math.min(5,Math.floor(state.day/2))+(state.upgrades.marketing||0)*2;
 state.orders=[];state.scheduled=[];state.elapsed=0;state.duration=0;
 for(let i=0;i<count;i++){
  const recipe=available[Math.floor(rng(state)*available.length)];
  const customer=CUSTOMERS[Math.floor(rng(state)*CUSTOMERS.length)];
  const arrival=3+i*8.7+rng(state)*2.3;
  const patience=34+rng(state)*14+(state.upgrades.ambience||0)*8;
  state.scheduled.push({id:++state.idSeq,recipe:recipe.id,customer,arrival:+arrival.toFixed(2),patience:+patience.toFixed(1),mood:Math.floor(rng(state)*5)});
 }
 state.scheduled.sort((a,b)=>a.arrival-b.arrival);
 state.duration=Math.ceil(state.scheduled.at(-1).arrival+28);
 state.phase='open';state.assistantCooldown=ASSISTANT.initialDelay;return{ok:true,count,duration:state.duration};
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
export function serveOrder(state,id){
 if(state.phase!=='open')return{ok:false,error:'餐厅未营业'};
 const index=state.orders.findIndex(x=>x.id===id&&x.status==='ready');
 if(index<0)return{ok:false,error:'订单尚未完成'};
 const order=state.orders[index],recipe=recipeById(order.recipe);
 const quality=order.patience/Math.max(1,order.maxPatience);
 const tip=Math.round(recipe.price*((quality>.5?.13:.05)+(state.upgrades.tips||0)*.05));
 const gain=recipe.price+tip;
 state.money+=gain;state.xp+=Math.ceil(recipe.price*.65)+Math.round(quality*12);
 state.rep=clamp(state.rep+(quality>.33?1:-1),0,100);
 state.today.served++;state.today.revenue+=recipe.price;state.today.tips+=tip;state.totalServed++;
 if(state.assistantAction){state.assistantServed++;state.todayAssistantServed++;}
 state.orders.splice(index,1);return{ok:true,recipe,tip,gain,quality};
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
   if(served.ok){state.assistantCooldown=ASSISTANT.cooldown;
     return {type:'assistantServe',id:ready.id,recipe:ready.recipe,gain:served.gain};}
 }
 const waiting=state.orders.find(x=>x.status==='waiting'&&ingredientAvailable(state,recipeById(x.recipe)));
 if(waiting){
   const cooked=cookOrder(state,waiting.id);
   if(cooked.ok){state.assistantCooldown=ASSISTANT.cooldown;
     return {type:'assistantCook',id:waiting.id,recipe:waiting.recipe};}
 }
 state.assistantCooldown=1;
 return null;
}
function missOrder(state,index){
 const order=state.orders[index];
 state.today.missed++;state.totalMissed++;
 state.rep=clamp(state.rep-3,0,100);
 state.orders.splice(index,1);return order;
}
export function finishDay(state){
 if(state.phase!=='open'||state.scheduled.length||state.orders.length||state.elapsed<state.duration-10)return false;
 const summary={day:state.day,...state.today,assistantServed:state.todayAssistantServed,assistantWages:state.assistantHired?ASSISTANT.wage:0,rep:state.rep,balance:state.money};
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
    patience:g.patience,maxPatience:g.patience,cookLeft:0,cookTotal:0,mood:g.mood});
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
 state.today={served:0,missed:0,revenue:0,tips:0,spent:0};state.assistantHired=false;state.assistantCooldown=0;state.todayAssistantServed=0;return true;
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
  {id:'partnership',name:'街角的默契',note:'兼职助手累计协助完成 20 次上菜',earned:(state.assistantServed||0)>=20}
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
  d.assistantHired=val.assistantHired===true;d.assistantCooldown=clamp(val.assistantCooldown??0,0,ASSISTANT.cooldown);
  d.assistantServed=integer(val.assistantServed??0,0,1e9);d.todayAssistantServed=integer(val.todayAssistantServed??0,0,1e9);d.assistantAction=false;
  d.phase=['planning','open','summary'].includes(val.phase)?val.phase:'planning';
  for(const k of Object.keys(d.pantry))d.pantry[k]=integer(val.pantry?.[k]??d.pantry[k],0,1e7);
  for(const u of UPGRADES)d.upgrades[u.id]=integer(val.upgrades?.[u.id]??0,0,u.max);
  d.elapsed=clamp(val.elapsed??0,0,1e6);d.duration=clamp(val.duration??110,60,1e6);
  d.orders=Array.isArray(val.orders)?val.orders.filter(o=>Number.isInteger(o.id)&&recipeById(o.recipe)&&['waiting','cooking','ready'].includes(o.status)).slice(0,70).map(o=>({
    id:o.id,recipe:o.recipe,customer:String(o.customer||'客人').slice(0,30),status:o.status,
    patience:clamp(o.patience,0,300),maxPatience:clamp(o.maxPatience,1,300),cookLeft:clamp(o.cookLeft,0,120),
    cookTotal:clamp(o.cookTotal,0,120),mood:integer(o.mood,0,4)
  })):[];
  d.scheduled=Array.isArray(val.scheduled)?val.scheduled.filter(o=>Number.isInteger(o.id)&&recipeById(o.recipe)).slice(0,100).map(o=>({
    id:o.id,recipe:o.recipe,customer:String(o.customer||'客人').slice(0,30),arrival:clamp(o.arrival,0,1e6),
    patience:clamp(o.patience,1,300),mood:integer(o.mood,0,4)
  })):[];d.scheduled.sort((a,b)=>a.arrival-b.arrival);
  const today=val.today||{};for(const k of Object.keys(d.today))d.today[k]=integer(today[k]??0,0,1e9);
  d.history=Array.isArray(val.history)?val.history.filter(x=>x&&Number.isInteger(x.day)).slice(-24).map(h=>({
    day:integer(h.day,1,1000),served:integer(h.served),missed:integer(h.missed),revenue:integer(h.revenue),
    tips:integer(h.tips),spent:integer(h.spent),assistantServed:integer(h.assistantServed??0),assistantWages:integer(h.assistantWages??0),rep:integer(h.rep,0,100),balance:integer(h.balance)
  })):[];
  d.lastSummary=d.phase==='summary'?d.history.at(-1)||null:null;
  d.sound=val.sound!==false;d.gameSpeed=[1,2].includes(val.gameSpeed)?val.gameSpeed:1;
  return d;
 }catch{return createGame();}
}