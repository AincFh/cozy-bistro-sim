import {
 SAVE_VERSION,INGREDIENTS,MENU,PACKS,UPGRADES,createGame,restore,serialize,recipesAvailable,recipeById,ingredientAvailable,slots,
 levelOf,upgradePrice,buyPackage,buyPlannedRestock,planRestock,buyUpgrade,startDay,cookOrder,serveOrder,advance,nextDay,achievements,finishDay,canClaimSupport,claimSupport,ASSISTANT,canHireAssistant,hireAssistant,contractOffers,acceptContract,DAILY_FEATURE,chooseDailySpecial,salePrice,featuredDemandShare,STAFF_CAREER,assistantLevel,assistantCooldownFor,assistantWage,assistantTrainingPrice,canTrainAssistant,trainAssistant
} from './engine.js';
import {initializeRoom,updateRoom} from './scene.js';
const $=id=>document.getElementById(id),STORAGE='cozy-bistro-save-v1';
const currency=n=>Math.round(n).toLocaleString('zh-CN');
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let state;try{state=restore(localStorage.getItem(STORAGE))}catch{state=createGame()}
let currentTab='service',active=false,lastFrame=0,lastRender=0,lastAutosave=0,lastToast,ctx=null,plating=null;
const setText=(id,v)=>{$(id).textContent=String(v);};
const save=()=>{try{localStorage.setItem(STORAGE,serialize(state));}catch{}};
function beep(tone='tap'){
 if(!state.sound)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ctx=ctx||new AC();if(ctx.state==='suspended')ctx.resume();
  const notes=tone==='success'?[[523,0,.09],[659,.09,.13],[784,.23,.2]]:tone==='order'?[[660,0,.12],[780,.13,.16]]:tone==='miss'?[[330,0,.11],[245,.12,.25]]:tone==='cook'?[[440,0,.08],[550,.09,.11]]:[[490,0,.08]];
  for(const [freq,at,dur]of notes){const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+at;
   o.type='sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(.041,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
   o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+dur+.02);
  }
 }catch{}
}
function toast(message,type='tap'){setText('toast',message);$('toast').classList.add('visible');clearTimeout(lastToast);lastToast=setTimeout(()=>$('toast').classList.remove('visible'),3000);beep(type);}
function eventsFeed(events){
 if(!events.length)return;
 if(events.some(x=>x.type==='summary')){toast('营业结束！查看今天的收支报告。','success');save();return}
 if(events.some(x=>x.type==='missed')){toast('有客人等不及离开了，口碑有所下降。','miss');return}
 if(events.some(x=>x.type==='assistantServe')){toast('兼职助手已为客人上菜，收入自动入账。','success');return}
 if(events.some(x=>x.type==='assistantCook')){toast('兼职助手已开始制作一道料理。','cook');return}
 if(events.some(x=>x.type==='ready')){toast('料理制作完成，记得及时上菜！','success');return}
 if(events.some(x=>x.type==='arrival')){toast('有新的客人走进了小店。','order');}
}
function updateOrderHTML(){
 const list=$('orderList');
 if(state.phase==='planning'){
  list.innerHTML="<div class='empty-orders'><div class='empty-symbol'>✦</div><strong>今天的小店，正在准备中</strong><p>库存、升级与菜谱都已就位。点击下方按钮，开始迎接客人。</p></div>";
  return;
 }
 if(state.phase==='summary'){
  const a=state.lastSummary||state.today;
  list.innerHTML="<div class='empty-orders'><div class='empty-symbol'>♡</div><strong>今天辛苦啦！</strong><p>已接待 "+currency(a.served)+" 位客人，获得 "+currency(a.revenue+a.tips)+" 金币营业收入。回顾得失，准备下一天。</p></div>";
  return;
 }
 if(state.orders.length===0){
  const upcoming=state.scheduled.length;
  list.innerHTML="<div class='empty-orders'><div class='empty-symbol'>◈</div><strong>"+(upcoming?'下一位客人正在路上…':'所有订单已处理')+"</strong><p>"+(upcoming?'可以先看看已有订单和厨房。':'等待最后的营业倒计时，今天就能收工啦。')+"</p></div>";
  return;
 }
 const running=state.orders.filter(x=>x.status==='cooking').length;
 list.innerHTML=state.orders.map(order=>{
  const dish=recipeById(order.recipe),patience=Math.max(0,order.patience),ratio=patience/Math.max(1,order.maxPatience);
  const ready=order.status==='ready',cooking=order.status==='cooking',canCook=!cooking&&!ready&&running<slots(state)&&ingredientAvailable(state,dish);
  const label=ready?'普通上菜':cooking?'制作中…':canCook?'开始制作':running>=slots(state)?'制作台已满':'食材不足';
  const pPercent=cooking?Math.round((1-order.cookLeft/Math.max(.1,order.cookTotal))*100):Math.round(ratio*100);
  const stateLabel=(order.contract?'团体订餐 · ':'')+(ready?'等待上菜':cooking?'厨师制作中':'等待点餐');
  const action=ready?'serve':'cook';
  const avatarColor=['#e1ab96','#b9bc98','#9db5a3','#c9b0ca','#e1c295'][order.mood%5];
  return "<article class='order-card "+(ready?'ready':cooking?'cooking':'')+"'><div class='order-top'><div class='guest'><div class='guest-portrait' style='background:"+avatarColor+"'>"+safe(order.customer.slice(0,1))+"</div><div><span class='guest-name'>"+safe(order.customer)+"</span><span class='guest-sub'>订单 #"+String(order.id).padStart(3,'0')+"</span></div></div><span class='order-state'>"+stateLabel+"</span></div><div class='order-body'><div class='dish'><span class='dish-icon'>"+dish.emoji+"</span><div><strong>"+safe(dish.name)+"</strong><small>"+(state.dailySpecial===dish.id&&!order.contract?"今日主推 · ":"")+"◈ "+salePrice(state,dish,order.contract)+" · "+Math.round(dish.prep)+"s 制作</small></div></div><button class='order-action "+(ready?'ready':'')+"' data-order='"+order.id+"' data-action='"+action+"' "+(!ready&&!canCook?'disabled':'')+">"+label+"</button>"+(ready?"<button class='plating-action' data-order='"+order.id+"' data-action='plate'>精致摆盘</button>":"")+"</div><div class='order-progress'><span>"+(cooking?'制作进度':'剩余耐心')+"</span><div><i class='"+(!cooking&&ratio<.27?'danger':'')+"' style='width:"+Math.round(pPercent)+"%'></i></div><b>"+(cooking?Math.ceil(order.cookLeft):Math.ceil(patience))+"s</b></div></article>";
 }).join('');
}
function render(){
 setText('money',currency(state.money));setText('rep',Math.round(state.rep));setText('level',levelOf(state));
 setText('xpText',currency(state.xp)+' XP');
 const lv=levelOf(state),lower=(lv-1)*(lv-1)*190,upper=lv*lv*190;
 $('xpProgress').style.width=Math.min(100,Math.max(0,(state.xp-lower)/(upper-lower)*100))+'%';
 setText('sidebarDay',String(state.day).padStart(2,'0'));setText('dayHeading','DAY '+String(state.day).padStart(2,'0'));
 setText('served',state.today.served);setText('revenue',currency(state.today.revenue+state.today.tips));setText('missed',state.today.missed);
 setText('elapsed',state.phase==='open'?Math.ceil(state.elapsed)+'s / '+Math.ceil(state.duration)+'s':state.phase==='planning'?'准备中':'已结算');
 setText('servicePercent',state.phase==='planning'?'0%':state.phase==='summary'?'100%':Math.min(100,Math.round(state.elapsed/state.duration*100))+'%');
 $('serviceBar').style.width=(state.phase==='planning'?0:state.phase==='summary'?100:Math.min(100,state.elapsed/state.duration*100))+'%';
 setText('speedBtn',state.gameSpeed+'× 速度');
 const needed=new Set(recipesAvailable(state).flatMap(x=>Object.keys(x.recipe)));
 setText('stockHint',[...needed].filter(k=>(state.pantry[k]||0)<3).length+' 种常用食材库存偏低');
 setText('menuHint',recipesAvailable(state).length+' / '+MENU.length+' 道菜谱已解锁'+(state.dailySpecial?' · 主推 '+recipeById(state.dailySpecial).name:''));
 setText('upgradeHint',slots(state)+' 个制作台 · 主厨速度 '+Math.round(100*Math.pow(1.18,state.upgrades.stove))+'%');
 setText('soundBtn',state.sound?'♫':'♪');
 const badge=$('statusBadge'),primary=$('primaryAction');
 if(state.phase==='planning'){
  setText('phaseTag','A NEW DAY BEGINS');setText('sectionTitle','把日子过成好风景.');
  setText('sectionDesc',state.contract?'今日已签约 '+state.contract.customer+' 的订餐委托，记得预留 '+state.contract.count+' 份 '+recipeById(state.contract.recipe).name+'。':state.dailySpecial?'今日主推「'+recipeById(state.dailySpecial).name+'」：预计需求提升，请提前备好足够原料。':'先补足库存、规划厨房，再开门迎接今天的第一位客人。');
  setText('panelHeading','今天的营业计划');setText('actionLead','备好原料与设备，开始今天的餐馆经营。');
  badge.textContent='PREPARE';primary.innerHTML='开门营业　<span>→</span>';primary.disabled=false;
  setText('objectiveText','准备食材，迎接新的营业日');setText('objectivePercent','0%');$('dayBar').style.width='0%';
  setText('sceneState','灯光已点亮，等待今天的客人');
 }else if(state.phase==='open'){
  setText('phaseTag','NOW SERVING · LIVE');setText('sectionTitle','今天也有好味道.');
  setText('sectionDesc','按顺序制作料理、及时上菜，并留意客人等待的耐心。');
  setText('panelHeading','正在等待的客人');setText('actionLead','先点“开始制作”，等料理做好，再点“立即上菜”。');
  badge.textContent='OPEN';primary.disabled=true;primary.innerHTML='正在营业中　<span>◷</span>';
  const total=state.today.served+state.today.missed+state.orders.length+state.scheduled.length;
  const pct=total?Math.round(state.today.served/total*100):0;
  setText('objectiveText','顾客满意度 · 已服务 '+state.today.served+' / '+total+' 位');
  setText('objectivePercent',pct+'%');$('dayBar').style.width=pct+'%';
  setText('sceneState',state.contract?.status==='active'?'团体订餐 '+state.contract.delivered+'/'+state.contract.count+' 已交付 · 和散客共用制作台':state.assistantHired?'兼职助手正在协助营业 · 今日完成 '+state.todayAssistantServed+' 单':state.orders.some(x=>x.status==='cooking')?'主厨正为客人制作料理':state.orders.length?'客人正在耐心等待':'街角的小店正在迎接客人');
 }else{
  setText('phaseTag','THE DAY IS DONE');setText('sectionTitle','又是一段好时光.');
  setText('sectionDesc','今天的经营已经结算。回看收获，继续下一天的生活。');
  setText('panelHeading','今日收工报告');setText('actionLead','营业数据已记录到经营账本，努力让下一天更好。');
  badge.textContent='CLOSED';primary.disabled=false;primary.innerHTML='进入下一天　<span>→</span>';
  const total=state.today.served+state.today.missed;const pct=total?Math.round(state.today.served/total*100):100;
  setText('objectiveText','今日客人满意率 '+pct+'%');
  setText('objectivePercent','100%');$('dayBar').style.width='100%';
  setText('sceneState',state.contract?.status==='completed'?'社区订餐已按时交付 · 收到额外奖金':state.contract?.status==='failed'?'社区订餐未完成 · 押金已损失':'温暖灯光留到明天，今天辛苦了');
 }
 updateOrderHTML();updateRoom($('room'),state);
}

/** Manual plating: a timed precision sweep instead of a passive serve click.
 * Timeout delivers the ready dish without a skill bonus. Sim time is paused.
 */
function startPlating(id){
 const order=state.orders.find(x=>x.id===id&&x.status==='ready');
 if(!order||state.phase!=='open'||plating)return;
 const hash=order.id*37+order.recipe.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
 const target=.29+(hash%42)/100;
 plating={id,target,started:performance.now(),position:0,seconds:5.5};
 const dish=recipeById(order.recipe);
 setText('platingDish',dish.name+' · '+order.customer);
 $('platingTarget').style.left=(100*target)+'%';
 $('platingOverlay').hidden=false;
 $('platingStop').focus();
}
function closePlating(){plating=null;$('platingOverlay').hidden=true;}
function finishPlating(expired=false){
 if(!plating)return;
 const current=plating;
 const precision=expired?0:Math.max(0,1-Math.abs(current.position-current.target)/.30);
 closePlating();
 const result=serveOrder(state,current.id,{platingScore:precision});
 if(!result.ok){toast(result.error,'miss');render();return}
 save();render();
 const names={perfect:'完美摆盘',good:'精致摆盘',fair:'摆盘合格',miss:'普通完成',standard:'正常上菜'};
 toast(names[result.plating.grade]+' · 获得 ◈ '+result.gain+'（摆盘奖励 ◈ '+result.plating.bonus+'）','success');
}
$('platingStop').onclick=()=>finishPlating(false);
$('platingCancel').onclick=()=>{closePlating();render()};
document.addEventListener('keydown',e=>{
 if(!plating)return;
 if(e.code==='Space'||e.code==='Enter'){e.preventDefault();finishPlating(false)}
 else if(e.key==='Escape'){e.preventDefault();closePlating();render()}
});
function animatePlating(now){
 if(!plating)return;
 const elapsed=(now-plating.started)/1000;
 if(elapsed>=plating.seconds){finishPlating(true);return}
 plating.position=.5-.5*Math.cos(elapsed*5.2);
 $('platingNeedle').style.left=(plating.position*100)+'%';
 $('platingTime').textContent=(plating.seconds-elapsed).toFixed(1)+' s';
}

function onPrimary(){
 if(state.phase==='planning'){
  const result=startDay(state);
  if(result.ok){toast('开门啦！今天将迎接 '+result.count+' 位客人。','success');save();}
  else toast(result.error,'miss');
 }else if(state.phase==='summary'){
  nextDay(state);toast('新的营业日开始啦，先检查食材库存。','success');save();
 }else if(state.scheduled.length===0&&state.orders.length===0){
  state.elapsed=Math.max(state.duration,state.elapsed);finishDay(state);save();
 }
 render();
}
$('primaryAction').onclick=onPrimary;
$('orderList').addEventListener('click',e=>{
 const b=e.target.closest('button[data-order]');if(!b)return;
 const id=Number(b.dataset.order),action=b.dataset.action;
 if(action==='plate'){startPlating(id);return}
 const result=action==='cook'?cookOrder(state,id):serveOrder(state,id);
 if(result.ok){toast(result.contractCompleted?'团体订餐完成！额外奖励 ◈ '+result.contractBonus+'，返还押金 ◈ '+result.depositRefund:action==='cook'?'主厨开始制作 '+result.recipe.name:'上菜成功！收到 ◈ '+result.gain+'（含小费 '+result.tip+'）',action==='cook'?'cook':'success');save();}
 else toast(result.error,'miss');
 render();
});
function card(title,eyebrow,description,icon,meta,actionLabel,action,disabled=false,extra=''){
 return "<article class='sheet-card "+extra+"'><div class='card-top'><span class='card-icon'>"+icon+"</span><div><div class='subline'>"+safe(eyebrow)+"</div><h3>"+safe(title)+"</h3></div></div><p>"+safe(description)+"</p><div class='card-cta'><span class='price'>"+safe(meta)+"</span>"+(action?"<button data-cmd='"+safe(action)+"' "+(disabled?'disabled':'')+">"+safe(actionLabel)+"</button>":'')+"</div></article>";
}
function menuContents(){
 const available=recipesAvailable(state),featured=state.dailySpecial&&recipeById(state.dailySpecial);
 const share=featured?Math.round(featuredDemandShare(state)*100):0;
 const summary=featured?
  "<div class='feature-highlight'><span class='subline'>CHEF'S DAILY PICK / 今日主推</span><h3>"+safe(featured.name)+"</h3><p>散客预计约 "+share+"% 会点这道菜；普通售价 ◈ "+featured.price+" → 主推售价 ◈ "+salePrice(state,featured)+"。总客流人数不变，社区订餐依照原合同价格结算。</p><strong>营销费用 ◈ "+DAILY_FEATURE.fee+" 已支付 · 今日服务 "+(state.today.specialServed||0)+" 份 · 售价溢价 ◈ "+(state.today.specialBonus||0)+"</strong></div>":
  "<div class='feature-highlight'><span class='subline'>CHEF'S DAILY PICK / 今日主推</span><h3>选择今天的主推菜</h3><p>营销成本 ◈ "+DAILY_FEATURE.fee+"，只支付一次；选定菜品的散客点单权重为普通菜的 "+DAILY_FEATURE.weight+" 倍，售价提高约 18%。并不会增加总客流，因此最好结合食材库存判断。</p></div>";
 return summary+"<div class='sheet-stats'><div><strong>"+available.length+" / "+MENU.length+"</strong><small>已解锁菜谱</small></div><div><strong>LV "+levelOf(state)+"</strong><small>主厨等级</small></div><div><strong>"+(state.specialServed||0)+"</strong><small>累计主推销量</small></div></div><div class='sheet-grid'>"+MENU.map(x=>{
  const unlock=x.day<=state.day,selected=state.dailySpecial===x.id;
  const parts=Object.entries(x.recipe).map(([k,v])=>INGREDIENTS[k].name+' ×'+v).join(' · ');
  const availableServings=Math.min(99,...Object.entries(x.recipe).map(([k,n])=>Math.floor((state.pantry[k]||0)/n)));
  return card(x.name,selected?"TODAY'S SPECIAL · "+x.en:x.en,
    x.flavor+" · "+parts+"。库存可制作 "+availableServings+" 份。",
    x.emoji,unlock?'售价 ◈ '+x.price+(selected?' → '+salePrice(state,x):'')+' · '+x.prep+' s':'第 '+x.day+' 天解锁',
    selected?'已选定主推':'设为今日主推',selected?null:'special:'+x.id,
    !unlock||state.phase!=='planning'||(!featured&&state.money<DAILY_FEATURE.fee),
    !unlock?'locked-card':selected?'featured-card':'');
 }).join('')+"</div>";
}
function stockContents(){
 const stocks=Object.entries(INGREDIENTS).map(([k,v])=>"<div class='stock-cell'><span class='icon'>"+v.emoji+"</span><strong>"+v.name+"</strong><small>"+state.pantry[k]+" 份库存</small></div>").join('');
 const packs=PACKS.map(p=>card(p.name,'FRESH DELIVERY',p.subtitle+' / '+Object.entries(p.items).map(([k,n])=>INGREDIENTS[k].name+'×'+n).join(' · '),'▤','◈ '+p.price,'采购补给','pack:'+p.id,state.phase!=='planning'||state.money<p.price)).join('');
 const smart=recipesAvailable(state).map(dish=>{
  const p=planRestock(state,dish.id,3);
  if(!p.ok)return '';
  const shortage=Object.entries(p.missing).filter(([,n])=>n>0).map(([k,n])=>INGREDIENTS[k].name+' ×'+n).join(' · ');
  const packs=p.purchases.map(x=>x.name+' ×'+x.count).join(' + ');
  return card(dish.name,'SMART RESTOCK · 3 SERVINGS',
   p.cost===0?'现有食材已经足够制作 3 份。':'缺少：'+shortage+'。建议配送：'+packs,
   dish.emoji,p.cost?'采购成本 ◈ '+currency(p.cost):'库存充足',
   p.cost?'按方案采购':'无需采购',p.cost?'restock:'+dish.id+':3':null,
   state.phase!=='planning'||!p.affordable);
 }).join('');
 const support=canClaimSupport(state)?"<div class='sheet-card' style='margin-bottom:20px;border-color:#dbcf9b99'><div class='card-top'><span class='card-icon'>✦</span><div><div class='subline'>COMMUNITY HELP · 一日一次</div><h3>邻里应急食材篮</h3></div></div><p>资金不足或没有可做菜品时，可领取一次免费食材，避免经营死局。</p><div class='card-cta'><span class='price'>免费 · 今日一次</span><button data-cmd='aid'>领取补给</button></div></div>":"";
 return "<h3 class='sheet-section-title'>当前冰箱库存</h3><div class='stock-grid'>"+stocks+"</div>"+support+"<h3 class='sheet-section-title'>智能采购计划 · 每道菜 3 份</h3><p class='muted'>按照现有库存计算实际缺口，在所有供应商组合中寻找最低总价。只有确认采购才会扣款，多余配送食材保留入库。</p><div class='sheet-grid'>"+smart+"</div><h3 class='sheet-section-title'>每日新鲜配送</h3><p class='muted'>营业前可以多次备货；开店后不能临时补货，请提前做好预算。</p><div class='sheet-grid'>"+packs+"</div>";
}
function upgradesContents(){
 return "<p class='muted'>不同升级会实际改变制作时间、并行料理、客人耐心、小费和每日客流。升级只允许在开业前进行。</p><div class='sheet-grid'>"+UPGRADES.map(x=>{
  const count=state.upgrades[x.id]||0,price=upgradePrice(state,x.id),max=count>=x.max;
  const meta=max?'已满级':'◈ '+currency(price)+' · '+count+'/'+x.max+' 级';
  return card(x.name,'RESTAURANT UPGRADE',x.desc,x.emoji,meta,max?'已满级':'升级','upgrade:'+x.id,max||state.phase!=='planning'||state.money<price);
 }).join('')+"</div>";
}
function staffContents(){
 const hired=state.assistantHired,level=assistantLevel(state),xp=state.assistantXp||0;
 const nextXp=STAFF_CAREER.levels[level]??STAFF_CAREER.maxXp;
 const canHire=canHireAssistant(state),canTrain=canTrainAssistant(state);
 const wage=assistantWage(state),training=assistantTrainingPrice(state);
 const status=hired?'今天已聘用。助手会优先上菜，再使用空余灶台制作料理。技能提高后每次工作间隔更短。':
  state.day<ASSISTANT.minimumDay?'第 2 天开始开放雇佣与培训。':
  state.phase!=='planning'?'正在营业中。下个营业日才能雇佣和培训。':
  '雇佣按天结算；技能会在帮助制作与上菜成功后增加，也能营业前付费培训。高级助手工资略高。';
 const progress=level>=STAFF_CAREER.levels.length?'已满级':xp+' / '+nextXp+' XP · 下级还差 '+Math.max(0,nextXp-xp)+' XP';
 return "<div class='sheet-stats'><div><strong>"+(hired?'已到岗':'未雇佣')+"</strong><small>今日班次</small></div>"+
  "<div><strong>LV "+level+"</strong><small>助手技能等级</small></div>"+
  "<div><strong>"+(state.todayAssistantServed||0)+"</strong><small>今日助手上菜</small></div>"+
  "<div><strong>"+(state.assistantServed||0)+"</strong><small>累计协助上菜</small></div></div>"+
  "<div class='sheet-card' style='margin:16px 0 20px'><div class='subline'>STAFF CAREER · 员工技能成长</div>"+
  "<h3 style='margin:8px 0'>"+ASSISTANT.name+"</h3><p>成长 "+progress+" · 实际工作间隔 "+assistantCooldownFor(state).toFixed(2)+
  " 秒 · 已培训 "+(state.assistantTrainingSessions||0)+" 次</p>"+
  "<div style='height:7px;border-radius:8px;background:#132d30;overflow:hidden'><div style='width:"+Math.min(100,Math.round(xp/STAFF_CAREER.maxXp*100))+
  "%;height:100%;background:#d9e7a4'></div></div></div>"+
  "<p class='muted'>"+status+"</p><div class='sheet-grid'>"+
  card(ASSISTANT.name,'PART-TIME SHIFT','必须支付实际工资才能排班。只在真实料理制作或上菜成功后获得 1 点技能经验。','☘',
   hired?'今日已排班 · 工资 ◈ '+(state.assistantShiftWage||wage):'今日工资 ◈ '+wage,
   hired?'今日已排班':'安排今日兼职','hire-assistant',!canHire)+
  card('专项培训','CAREER DEVELOPMENT','营业前付费学习获得 '+STAFF_CAREER.trainingXp+' XP；每个经营日最多一次。更高级的助手操作更快，但日薪也会增加。','✧',
   level>=STAFF_CAREER.levels.length?'技能满级':state.assistantTrainedDay===state.day?'今日已培训':'培训费 ◈ '+training,
   '安排一次培训','train-assistant',!canTrain)+
  card('班次与收支','BUSINESS BALANCE','固定工资及培训费用都计入当日经营支出。助手不创造食材和制作台，仍遵循客人耐心与库存限制。','◷',
   '今日已支出 ◈ '+currency(state.today.spent),null)+
  "</div>";
}
function contractsContents(){
 const c=state.contract;
 if(c){
  const dish=recipeById(c.recipe);
  const status={accepted:'已接单 · 等待开门',active:'制作与交付中',completed:'全部交付 · 已结算',failed:'未按时完成 · 押金损失'}[c.status]||'未确认';
  return "<div class='contract-summary'><span class='subline'>NEIGHBORHOOD CATERING / 社区委托</span><h3>"+safe(c.customer)+"</h3><p>"+safe(c.description)+"</p><div class='contract-numbers'><span>订餐 <b>"+safe(dish.name)+" × "+c.count+"</b></span><span>已交付 <b>"+c.delivered+" / "+c.count+"</b></span><span>完成奖金 <b>◈ "+c.bonus+"</b></span><span>可退押金 <b>◈ "+c.deposit+"</b></span></div><div class='contract-state "+c.status+"'>"+status+"</div></div>"+
   "<p class='muted'>这份委托与散客共用真实库存和厨房制作台。每份料理必须先制作再上菜；助手也遵守相同规则。任何一份超时都会导致该委托失败，不能退还押金。已领取的奖励不会重复发放。</p>"+
   "<h3 class='sheet-section-title'>所需原料</h3><div class='stock-grid'>"+
   Object.entries(dish.recipe).map(([k,v])=>"<div class='stock-cell'><span class='icon'>"+INGREDIENTS[k].emoji+"</span><strong>"+INGREDIENTS[k].name+"</strong><small>全单需 "+(v*c.count)+" · 剩余库存 "+(state.pantry[k]||0)+"</small></div>").join('')+"</div>";
 }
 const offers=contractOffers(state);
 return "<p class='muted'>营业前可选择一份邻里团体订餐。接单先扣押金；实际制作、按时上菜并交付全部餐点才能返还押金并获得奖励。建议先检查原料和厨房并发能力。</p><div class='sheet-stats'><div><strong>"+(state.contractsWon||0)+"</strong><small>历史成功委托</small></div><div><strong>"+(state.contractsLost||0)+"</strong><small>历史失败委托</small></div><div><strong>最多 1 份</strong><small>每营业日限接</small></div></div><div class='sheet-grid'>"+
 offers.map(o=>{const dish=recipeById(o.recipe);
   const inventory=Object.entries(dish.recipe).map(([k,v])=>INGREDIENTS[k].name+" ×"+(v*o.count)+" (库存 "+(state.pantry[k]||0)+")").join(" · ");
   return card(o.customer,'NEIGHBORHOOD CATERING',o.description+'。需要 '+dish.name+' ×'+o.count+'；'+inventory,'▣','押金 ◈ '+o.deposit+' / 额外奖金 ◈ '+o.bonus,'接受委托','contract:'+o.id,state.phase!=='planning'||state.money<o.deposit);
 }).join('')+"</div>";
}
function journalContents(){
 const allAchievements=achievements(state),earned=allAchievements.filter(x=>x.earned).length;
 let html="<div class='sheet-stats'><div><strong>"+state.totalServed+"</strong><small>累计接待</small></div><div><strong>"+state.totalMissed+"</strong><small>累计流失</small></div><div><strong>"+state.day+"</strong><small>经营第几天</small></div><div><strong>"+earned+" / "+allAchievements.length+"</strong><small>已得成就</small></div></div>";
 if(state.history.length){
  const h=state.history.slice(-12),max=Math.max(1,...h.map(x=>x.revenue+x.tips));
  html+="<h3 class='sheet-section-title'>最近的每日收入</h3><div class='ledger-bars'>"+h.map(x=>"<div title='第"+x.day+"天：收入 "+(x.revenue+x.tips)+"' style='height:"+Math.max(2,100*(x.revenue+x.tips)/max)+"%'><span>"+x.day+"</span></div>").join('')+"</div>";
  html+="<h3 class='sheet-section-title' style='margin-top:34px'>经营流水</h3>"+[...state.history].reverse().map(x=>"<div class='ledger-row'><strong>DAY "+String(x.day).padStart(2,'0')+"</strong><span>完成 "+x.served+" 单　·　流失 "+x.missed+" 单</span><em>收入 ◈ "+currency(x.revenue+x.tips)+" / 支出 ◈ "+currency(x.spent)+"</em></div>").join('');
 }else html+="<p class='muted'>营业日结束后，这里会自动出现每日账本和收入走势图。</p>";
 html+="<h3 class='sheet-section-title'>社区委托记录</h3><p class='muted'>累计完成 "+(state.contractsWon||0)+" 份，未完成 "+(state.contractsLost||0)+" 份。委托奖励记入当天账本，押金在全数交付后退还。</p>";
 html+="<h3 class='sheet-section-title'>今日主推与营销</h3><p class='muted'>累计营销活动 "+(state.specialsLaunched||0)+" 次 · 主推菜售出 "+(state.specialServed||0)+" 份 · 今日额外售价收入 ◈ "+currency(state.today.specialBonus||0)+"。</p>";
 html+="<h3 class='sheet-section-title'>摆盘手艺记录</h3><p class='muted'>累计摆盘 "+(state.platingAttempts||0)+" 次 · 完美摆盘 "+(state.platingPerfect||0)+" 次 · 最佳连续完美 "+(state.platingBestStreak||0)+" 次 · 今日额外奖励 ◈ "+currency(state.today.platingBonus||0)+"。</p>";
 html+="<h3 class='sheet-section-title'>兼职协助记录</h3><p class='muted'>累计兼职上菜 "+(state.assistantServed||0)+" 单 · 今日兼职上菜 "+(state.todayAssistantServed||0)+" 单。兼职工资计入当日支出，不另扣费。</p>";
 html+="<h3 class='sheet-section-title' style='margin-top:26px'>经营成就</h3><div class='sheet-grid'>"+achievements(state).map(a=>card(a.name,a.earned?'ACHIEVEMENT EARNED':'LOCKED GOAL',a.note,a.earned?'✦':'◇',a.earned?'已达成':'尚未达成',null,false,a.earned?'':'locked-card')).join('')+"</div>";
 return html;
}
function backupContents(){
 return "<p class='muted'>所有数据存储在此浏览器的本地站点数据中。更换设备或清除站点数据可能丢失进度；请定期导出备份。</p>"+
 "<div class='sheet-stats'><div><strong>DAY "+state.day+"</strong><small>当前进度</small></div><div><strong>"+currency(state.money)+"</strong><small>当前资金</small></div><div><strong>"+state.totalServed+"</strong><small>累计接待</small></div></div>"+
 "<div class='settings-actions'><button data-cmd='export'>导出 JSON 存档</button><button data-cmd='import'>导入已有存档</button><button data-cmd='sound'>声音："+(state.sound?'开启':'关闭')+"</button><button class='danger' data-cmd='reset'>重新开始游戏</button></div>"+
 "<p class='muted' style='margin-top:18px'>导入会覆盖当前存档，重置不可撤销。餐馆是单机模拟游戏，不支持云端账号同步。</p>";
}
const sheets={
 menu:['THE LITTLE MENU','今天的餐厅菜单','从三道基础料理开始，随着营业天数逐步解锁新食谱。',menuContents],
 stock:['FRESH FROM THE MARKET','采购与备货','备足客人最爱的食材，让厨房可以持续制作。',stockContents],
 upgrades:['THE DREAM GROWS','餐厅升级','投入合理预算，提升制作速度、客人耐心和餐馆经营效率。',upgradesContents],
 staff:['THE LITTLE TEAM','兼职与排班','安排兼职、支付工资并通过实际工作或培训提升助手技能。',staffContents],
 contracts:['NEIGHBORHOOD CATERING','社区订餐委托','按时完成团体订餐，赢取额外收益并建立街区口碑。',contractsContents],
 journal:['THE BUSINESS LEDGER','经营账本','收入、口碑、成就与每日财务都在这里。',journalContents],
 backup:['SAVE & SETTINGS','存档与设置','导出备份、更改音效，以及管理本地进度。',backupContents],
 help:['FIELD GUIDE','经营说明','从第一次开门开始，建立自己的街角餐馆。',()=>"<div class='sheet-grid'>"+
  card('01 · 营业前准备','PREPARE','点击左侧「采购与备货」购买食材，再根据预算在「餐厅升级」购买设备。','▤','每天只能在开业前采购',null)+
  card('02 · 开门营业','OPEN SHOP','进入经营总览，点击「开门营业」。客人会按照日程逐渐进入小店。','◷','支持 1× / 2× 速度',null)+
  card('03 · 制作订单','COOK','在订单卡片点击「开始制作」，厨房按制作台数量并行工作。食材不足时无法制作。','⌁','升级可提升制作效率',null)+
  card('04 · 聘用兼职助手','STAFF','第 2 天起可以营业前按天聘用兼职；助理自动制作或上菜，但需要支付固定工资。','♧','工资计入今日支出',null)+
  card('05 · 邻里团体订餐','CATERING','营业前可签约一份付押金的团体订餐，多份料理与散客共用厨房和食材，必须全部交付才能返还押金与领取奖金。','▣','通过专属社区订餐菜单接单',null)+
  card('06 · 及时上菜','SERVE','料理完成后可以普通上菜，也可挑战五秒计时的精致摆盘。越接近目标区域越有机会获得额外小费、经验与口碑。','♥','提高口碑可提高评级',null)+
  card('07 · 每日结算','DAY REPORT','当天全部顾客处理完毕后自动结算。查看账本，选择进入下一天。','◈','记录最近 24 天',null)+
  card('08 · 保存进度','LOCAL SAVE','浏览器自动存档，也能手动导出 JSON 备份。此版本无需登录，也没有真实支付。','✦','当前版本 v1',null)+"</div>"]
};
function openSheet(name){
 if(name==='service'){closeSheet();return}
 const conf=sheets[name];if(!conf)return;
 currentTab=name;
 document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('selected',x.dataset.tab===name));
 setText('sheetTag',conf[0]);setText('sheetTitle',conf[1]);setText('sheetDesc',conf[2]);
 $('sheetBody').innerHTML=conf[3]();$('sheetOverlay').hidden=false;
 $('closeSheet').focus();
}
function closeSheet(){
 $('sheetOverlay').hidden=true;currentTab='service';
 document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('selected',x.dataset.tab==='service'));
}
$('closeSheet').onclick=closeSheet;
$('sheetOverlay').addEventListener('click',e=>{if(e.target===$('sheetOverlay'))closeSheet()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('sheetOverlay').hidden)closeSheet();
 if(e.key==='1'||e.key==='2'){if(e.target.matches('input,textarea,select'))return;state.gameSpeed=Number(e.key);save();render();}
});
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.goto)));
$('helpBtn').onclick=()=>openSheet('help');$('backupBtn').onclick=()=>openSheet('backup');
$('speedBtn').onclick=()=>{state.gameSpeed=state.gameSpeed===1?2:1;save();render();toast('营业速度 '+state.gameSpeed+'×');};
$('soundBtn').onclick=()=>{state.sound=!state.sound;save();render();toast(state.sound?'音效已开启':'已关闭音效');};
$('sheetBody').addEventListener('click',e=>{
 const b=e.target.closest('button[data-cmd]');if(!b)return;
 const cmd=b.dataset.cmd;
 if(cmd.startsWith('restock:')){
  const [,recipeId,count]=cmd.split(':');
  const result=buyPlannedRestock(state,recipeId,Number(count));
  if(result.ok){toast(result.spent?'整套食材采购完成 · ◈ '+currency(result.spent):'现有食材已足够制作该菜品','success');save();openSheet('stock');render();}
  else toast(result.error,'miss');
  return;
 }
 if(cmd.startsWith('special:')){
  const result=chooseDailySpecial(state,cmd.slice(8));
  if(result.ok){save();toast(result.unchanged?'今天已经选定这道主推菜':'今日主推已更新：'+result.recipe.name+' · 营销成本 ◈ '+result.spent,'success');openSheet('menu');render();}
  else toast(result.error,'miss');
  return;
 }
 if(cmd.startsWith('pack:')){
  const result=buyPackage(state,cmd.slice(5));
  if(result.ok){toast('已经买到新鲜的 '+result.pack.name+'。','success');save();openSheet('stock');render();}
  else toast(result.error,'miss');return;
 }
 if(cmd.startsWith('upgrade:')){
  const result=buyUpgrade(state,cmd.slice(8));
  if(result.ok){toast(result.item.name+' 升级完成！','success');save();openSheet('upgrades');render();}
  else toast(result.error,'miss');return;
 }
 if(cmd.startsWith('contract:')){const result=acceptContract(state,cmd.slice(9));if(result.ok){save();toast('已接受 '+result.contract.customer+' 的社区订餐，押金 ◈ '+result.contract.deposit+' 已锁定','success');openSheet('contracts');render();}else toast(result.error,'miss');return;}
 if(cmd==='hire-assistant'){const result=hireAssistant(state);if(result.ok){save();toast('已经安排 '+result.assistant+' 今日到岗，支出 ◈ '+result.wage,'success');openSheet('staff');render();}else toast(result.error,'miss');return;}
  if(cmd==='train-assistant'){const result=trainAssistant(state);if(result.ok){save();toast('培训完成 · 助手 LV '+result.level+' · 支出 ◈ '+result.cost,'success');openSheet('staff');render();}else toast(result.error,'miss');return;}
 if(cmd==='aid'){const result=claimSupport(state);if(result.ok){save();toast('已收到邻里提供的应急食材。','success');openSheet('stock');render();}else toast(result.error,'miss');return;}
 if(cmd==='export'){
  const file=new Blob([JSON.stringify({type:'cozy-bistro-save',version:SAVE_VERSION,progress:state},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download='COZY-BISTRO-DAY-'+state.day+'.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);toast('本地存档已导出。','success');
 }
 if(cmd==='import')$('importFile').click();
 if(cmd==='sound'){state.sound=!state.sound;save();openSheet('backup');render();}
 if(cmd==='reset'&&confirm('确定要永久清空当前餐馆经营进度并重新开始吗？')){
  state=createGame();save();closeSheet();render();toast('已重新开始新的餐馆旅程。');
 }
});
$('importFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  if(file.size>400000)throw Error('存档文件过大');
  const data=JSON.parse(await file.text());
  if(data?.type!=='cozy-bistro-save'||data?.version!==SAVE_VERSION||!data.progress||data.progress.version!==SAVE_VERSION)throw Error('这不是有效的 COZY BISTRO 存档');
  if(!confirm('导入会覆盖当前餐馆进度。确定继续吗？'))return;
  state=restore(data.progress);save();closeSheet();render();toast('已成功恢复经营进度！','success');
 }catch(error){toast('导入失败：'+error.message,'miss')}
});
$('enterBtn').onclick=()=>{active=true;$('intro').hidden=true;render();toast(state.phase==='open'?'欢迎回来！继续经营你的餐馆。':'欢迎来到 COZY BISTRO！','success');lastFrame=performance.now();};
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.22,Math.max(0,(now-lastFrame)/1000||.016));lastFrame=now;
 animatePlating(now);
 if(active&&state.phase==='open'&&$('sheetOverlay').hidden&&!plating){
  const events=advance(state,dt*state.gameSpeed);
  if(events.length)eventsFeed(events);
 }
 if(now-lastRender>170){lastRender=now;render();}
 if(now-lastAutosave>3400){lastAutosave=now;if(active)save();}
}
window.addEventListener('pagehide',save);
initializeRoom($('room'));render();requestAnimationFrame(frame);
window.COZY_BISTRO={getState:()=>({day:state.day,phase:state.phase,money:state.money,rep:state.rep,served:state.totalServed,missed:state.totalMissed,platingPerfect:state.platingPerfect,dailySpecial:state.dailySpecial,specialServed:state.specialServed,specialBonus:state.today.specialBonus,platingActive:!!plating,orders:state.orders.map(o=>({id:o.id,recipe:o.recipe,status:o.status,patience:o.patience})),scheduled:state.scheduled.length,elapsed:state.elapsed}),test:{start(){const x=startDay(state);render();return x},step(n){const x=advance(state,n);render();return x},cook(id){const x=cookOrder(state,id);render();return x},serve(id){const x=serveOrder(state,id);render();return x},servePlated(id,score){const x=serveOrder(state,id,{platingScore:score});render();return x},getRaw:()=>state,reset(){state=createGame();render();}}};
