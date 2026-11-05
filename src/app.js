import {
 SAVE_VERSION,INGREDIENTS,MENU,PACKS,UPGRADES,createGame,restore,serialize,recipesAvailable,recipeById,ingredientAvailable,slots,
 levelOf,upgradePrice,buyPackage,buyUpgrade,startDay,cookOrder,serveOrder,advance,nextDay,achievements,finishDay
} from './engine.js';
import {initializeRoom,updateRoom} from './scene.js';
const $=id=>document.getElementById(id),STORAGE='cozy-bistro-save-v1';
const currency=n=>Math.round(n).toLocaleString('zh-CN');
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let state;try{state=restore(localStorage.getItem(STORAGE))}catch{state=createGame()}
let currentTab='service',active=false,lastFrame=0,lastRender=0,lastAutosave=0,lastToast,ctx=null;
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
  const label=ready?'立即上菜':cooking?'制作中…':canCook?'开始制作':running>=slots(state)?'制作台已满':'食材不足';
  const pPercent=cooking?Math.round((1-order.cookLeft/Math.max(.1,order.cookTotal))*100):Math.round(ratio*100);
  const stateLabel=ready?'等待上菜':cooking?'厨师制作中':'等待点餐';
  const action=ready?'serve':'cook';
  const avatarColor=['#e1ab96','#b9bc98','#9db5a3','#c9b0ca','#e1c295'][order.mood%5];
  return "<article class='order-card "+(ready?'ready':cooking?'cooking':'')+"'><div class='order-top'><div class='guest'><div class='guest-portrait' style='background:"+avatarColor+"'>"+safe(order.customer.slice(0,1))+"</div><div><span class='guest-name'>"+safe(order.customer)+"</span><span class='guest-sub'>订单 #"+String(order.id).padStart(3,'0')+"</span></div></div><span class='order-state'>"+stateLabel+"</span></div><div class='order-body'><div class='dish'><span class='dish-icon'>"+dish.emoji+"</span><div><strong>"+safe(dish.name)+"</strong><small>◈ "+dish.price+" · "+Math.round(dish.prep)+"s 制作</small></div></div><button class='order-action "+(ready?'ready':'')+"' data-order='"+order.id+"' data-action='"+action+"' "+(!ready&&!canCook?'disabled':'')+">"+label+"</button></div><div class='order-progress'><span>"+(cooking?'制作进度':'剩余耐心')+"</span><div><i class='"+(!cooking&&ratio<.27?'danger':'')+"' style='width:"+Math.round(pPercent)+"%'></i></div><b>"+(cooking?Math.ceil(order.cookLeft):Math.ceil(patience))+"s</b></div></article>";
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
 setText('stockHint',Object.keys(state.pantry).filter(k=>state.pantry[k]<3).length+' 种食材库存偏低');
 setText('menuHint',recipesAvailable(state).length+' / '+MENU.length+' 道菜谱已经解锁');
 setText('upgradeHint',slots(state)+' 个制作台 · 主厨速度 '+Math.round(100*Math.pow(1.18,state.upgrades.stove))+'%');
 setText('soundBtn',state.sound?'♫':'♪');
 const badge=$('statusBadge'),primary=$('primaryAction');
 if(state.phase==='planning'){
  setText('phaseTag','A NEW DAY BEGINS');setText('sectionTitle','把日子过成好风景.');
  setText('sectionDesc','先补足库存、规划厨房，再开门迎接今天的第一位客人。');
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
  setText('sceneState',state.orders.some(x=>x.status==='cooking')?'主厨正为客人制作料理':state.orders.length?'客人正在耐心等待':'街角的小店正在迎接客人');
 }else{
  setText('phaseTag','THE DAY IS DONE');setText('sectionTitle','又是一段好时光.');
  setText('sectionDesc','今天的经营已经结算。回看收获，继续下一天的生活。');
  setText('panelHeading','今日收工报告');setText('actionLead','营业数据已记录到经营账本，努力让下一天更好。');
  badge.textContent='CLOSED';primary.disabled=false;primary.innerHTML='进入下一天　<span>→</span>';
  const total=state.today.served+state.today.missed;const pct=total?Math.round(state.today.served/total*100):100;
  setText('objectiveText','今日客人满意率 '+pct+'%');
  setText('objectivePercent','100%');$('dayBar').style.width='100%';
  setText('sceneState','温暖灯光留到明天，今天辛苦了');
 }
 updateOrderHTML();updateRoom($('room'),state);
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
 const result=action==='cook'?cookOrder(state,id):serveOrder(state,id);
 if(result.ok){toast(action==='cook'?'主厨开始制作 '+result.recipe.name:'上菜成功！收到 ◈ '+result.gain+'（含小费 '+result.tip+'）',action==='cook'?'cook':'success');save();}
 else toast(result.error,'miss');
 render();
});
function card(title,eyebrow,description,icon,meta,actionLabel,action,disabled=false,extra=''){
 return "<article class='sheet-card "+extra+"'><div class='card-top'><span class='card-icon'>"+icon+"</span><div><div class='subline'>"+safe(eyebrow)+"</div><h3>"+safe(title)+"</h3></div></div><p>"+safe(description)+"</p><div class='card-cta'><span class='price'>"+safe(meta)+"</span>"+(action?"<button data-cmd='"+safe(action)+"' "+(disabled?'disabled':'')+">"+safe(actionLabel)+"</button>":'')+"</div></article>";
}
function menuContents(){
 const available=recipesAvailable(state);
 return "<div class='sheet-stats'><div><strong>"+available.length+" / "+MENU.length+"</strong><small>已解锁菜谱</small></div><div><strong>LV "+levelOf(state)+"</strong><small>主厨等级</small></div><div><strong>"+state.totalServed+"</strong><small>累计完成订单</small></div></div><div class='sheet-grid'>"+MENU.map(x=>{
  const unlock=x.day<=state.day;
  const parts=Object.entries(x.recipe).map(([k,v])=>INGREDIENTS[k].name+'×'+v).join(' · ');
  return card(x.name,x.en,x.flavor+' / '+parts,x.emoji,unlock?'◈ '+x.price+'　·　'+x.prep+'s':'第 '+x.day+' 天解锁',null,false,!unlock?'locked-card':'');
 }).join('')+"</div>";
}
function stockContents(){
 const stocks=Object.entries(INGREDIENTS).map(([k,v])=>"<div class='stock-cell'><span class='icon'>"+v.emoji+"</span><strong>"+v.name+"</strong><small>"+state.pantry[k]+" 份库存</small></div>").join('');
 const packs=PACKS.map(p=>card(p.name,'FRESH DELIVERY',p.subtitle+' / '+Object.entries(p.items).map(([k,n])=>INGREDIENTS[k].name+'×'+n).join(' · '),'▤','◈ '+p.price,'采购补给','pack:'+p.id,state.phase!=='planning'||state.money<p.price)).join('');
 return "<h3 class='sheet-section-title'>当前冰箱库存</h3><div class='stock-grid'>"+stocks+"</div><h3 class='sheet-section-title'>每日新鲜配送</h3><p class='muted'>营业前可以多次备货；开店后不能临时补货，请提前做好预算。</p><div class='sheet-grid'>"+packs+"</div>";
}
function upgradesContents(){
 return "<p class='muted'>不同升级会实际改变制作时间、并行料理、客人耐心、小费和每日客流。升级只允许在开业前进行。</p><div class='sheet-grid'>"+UPGRADES.map(x=>{
  const count=state.upgrades[x.id]||0,price=upgradePrice(state,x.id),max=count>=x.max;
  const meta=max?'已满级':'◈ '+currency(price)+' · '+count+'/'+x.max+' 级';
  return card(x.name,'RESTAURANT UPGRADE',x.desc,x.emoji,meta,max?'已满级':'升级','upgrade:'+x.id,max||state.phase!=='planning'||state.money<price);
 }).join('')+"</div>";
}
function journalContents(){
 const earned=achievements(state).filter(x=>x.earned).length;
 let html="<div class='sheet-stats'><div><strong>"+state.totalServed+"</strong><small>累计接待</small></div><div><strong>"+state.totalMissed+"</strong><small>累计流失</small></div><div><strong>"+state.day+"</strong><small>经营第几天</small></div><div><strong>"+earned+" / 7</strong><small>已得成就</small></div></div>";
 if(state.history.length){
  const h=state.history.slice(-12),max=Math.max(1,...h.map(x=>x.revenue+x.tips));
  html+="<h3 class='sheet-section-title'>最近的每日收入</h3><div class='ledger-bars'>"+h.map(x=>"<div title='第"+x.day+"天：收入 "+(x.revenue+x.tips)+"' style='height:"+Math.max(2,100*(x.revenue+x.tips)/max)+"%'><span>"+x.day+"</span></div>").join('')+"</div>";
  html+="<h3 class='sheet-section-title' style='margin-top:34px'>经营流水</h3>"+[...state.history].reverse().map(x=>"<div class='ledger-row'><strong>DAY "+String(x.day).padStart(2,'0')+"</strong><span>完成 "+x.served+" 单　·　流失 "+x.missed+" 单</span><em>收入 ◈ "+currency(x.revenue+x.tips)+" / 支出 ◈ "+currency(x.spent)+"</em></div>").join('');
 }else html+="<p class='muted'>营业日结束后，这里会自动出现每日账本和收入走势图。</p>";
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
 journal:['THE BUSINESS LEDGER','经营账本','收入、口碑、成就与每日财务都在这里。',journalContents],
 backup:['SAVE & SETTINGS','存档与设置','导出备份、更改音效，以及管理本地进度。',backupContents],
 help:['FIELD GUIDE','经营说明','从第一次开门开始，建立自己的街角餐馆。',()=>"<div class='sheet-grid'>"+
  card('01 · 营业前准备','PREPARE','点击左侧「采购与备货」购买食材，再根据预算在「餐厅升级」购买设备。','▤','每天只能在开业前采购',null)+
  card('02 · 开门营业','OPEN SHOP','进入经营总览，点击「开门营业」。客人会按照日程逐渐进入小店。','◷','支持 1× / 2× 速度',null)+
  card('03 · 制作订单','COOK','在订单卡片点击「开始制作」，厨房按制作台数量并行工作。食材不足时无法制作。','⌁','升级可提升制作效率',null)+
  card('04 · 及时上菜','SERVE','料理完成后点击「立即上菜」，赚取售价、小费和经验。等待太久的客人会离开。','♥','提高口碑可提高评级',null)+
  card('05 · 每日结算','DAY REPORT','当天全部顾客处理完毕后自动结算。查看账本，选择进入下一天。','◈','记录最近 24 天',null)+
  card('06 · 保存进度','LOCAL SAVE','浏览器自动存档，也能手动导出 JSON 备份。此版本无需登录，也没有真实支付。','✦','当前版本 v1',null)+"</div>"]
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
 if(active&&state.phase==='open'&&$('sheetOverlay').hidden){
  const events=advance(state,dt*state.gameSpeed);
  if(events.length)eventsFeed(events);
 }
 if(now-lastRender>170){lastRender=now;render();}
 if(now-lastAutosave>3400){lastAutosave=now;if(active)save();}
}
window.addEventListener('pagehide',save);
initializeRoom($('room'));render();requestAnimationFrame(frame);
window.COZY_BISTRO={getState:()=>({day:state.day,phase:state.phase,money:state.money,rep:state.rep,served:state.totalServed,missed:state.totalMissed,orders:state.orders.map(o=>({id:o.id,recipe:o.recipe,status:o.status,patience:o.patience})),scheduled:state.scheduled.length,elapsed:state.elapsed}),test:{start(){const x=startDay(state);render();return x},step(n){const x=advance(state,n);render();return x},cook(id){const x=cookOrder(state,id);render();return x},serve(id){const x=serveOrder(state,id);render();return x},getRaw:()=>state,reset(){state=createGame();render();}}};
