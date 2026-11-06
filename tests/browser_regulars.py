"""Real Chrome acceptance: repeat customers, food delivery, extra tips, save/reload and phone."""
import json
import pathlib
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROOF=ROOT/'test-artifacts'/'regulars'
PROOF.mkdir(parents=True,exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
 def log_message(self,*args):pass

with socketserver.TCPServer(('127.0.0.1',0),Handler) as server:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 options=Options()
 for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,820'):
  options.add_argument(arg)
 options.set_capability('goog:loggingPrefs',{'browser':'ALL'})
 browser=webdriver.Chrome(options=options)
 try:
  browser.get('http://127.0.0.1:%s/'%server.server_address[1])
  wait=WebDriverWait(browser,35)
  wait.until(lambda b:b.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  initial=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
    return {phase:s.phase,money:s.money,regulars:Object.keys(s.regulars).length};})()""")
  assert initial['phase']=='planning' and initial['regulars']==0,initial
  # Fixture ONLY: introduce three previously earned successful meals for every
  # guest. The current meal, its ingredients, cooking, serving and loyalty tips
  # are generated entirely through the real production interaction path.
  browser.execute_script("""(()=>{
    const s=window.COZY_BISTRO.test.getRaw();
    for(const name of ['小夏','柚子','阿雅','艾米','林先生','木子','桃桃','阿泽','小松','贝拉','若林','浅浅','星野','橘子','苏苏','雨果'])
      s.regulars[name]={served:3,missed:0,lastSeenDay:1};
  })()""")
  browser.find_element(By.ID,'primaryAction').click()
  browser.execute_script('window.COZY_BISTRO.test.step(8)')
  first=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw(),o=s.orders.find(o=>o.status==='waiting'&&!o.contract);
    return {id:o?.id,name:o?.customer,status:o?.status,
      money:s.money,served:s.regulars[o?.customer]?.served,
      patience:o?.maxPatience,recipe:o?.recipe};})()""")
  assert first['id'] and first['served']==3 and first['status']=='waiting',first
  assert browser.find_elements(By.CSS_SELECTOR,'[data-order="%s"][data-action="cook"]'%first['id']),first
  browser.save_screenshot(str(PROOF/'01-regular-guest-order.png'))
  # The same order card must remain mounted when only a progress timer advances.
  # This catches accidental wholesale DOM replacement and stale Selenium buttons.
  pending=browser.find_element(By.CSS_SELECTOR,'[data-order="%s"][data-action="cook"]'%first['id'])
  browser.execute_script('window.COZY_BISTRO.test.step(.2)')
  assert pending.is_displayed() and pending.is_enabled(), 'order button was unexpectedly replaced'
  pending.click()
  cooked=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw(),o=s.orders.find(o=>o.id===%s);
    return {status:o?.status,cookLeft:o?.cookLeft,bonus:s.today.regularBonus};})()"""%first['id'])
  assert cooked['status']=='cooking' and cooked['bonus']==0,cooked
  browser.execute_script('window.COZY_BISTRO.test.step(9)')
  assert browser.execute_script("return window.COZY_BISTRO.test.getRaw().orders.find(x=>x.id===%d)?.status"%first['id'])=='ready'
  browser.find_element(By.CSS_SELECTOR,'[data-order="%s"][data-action="serve"]'%first['id']).click()
  settled=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();const r=s.regulars[%s];
    return {money:s.money,served:r.served,missed:r.missed,day:r.lastSeenDay,
      bonus:s.today.regularBonus,regularsServed:s.today.regularsServed,
      servedToday:s.today.served,orderGone:!s.orders.some(o=>o.id===%s)};})()"""%(json.dumps(first['name'],ensure_ascii=False),first['id']))
  assert settled['served']==4 and settled['bonus']==3 and settled['regularsServed']==1,settled
  assert settled['money']>first['money']+3 and settled['orderGone'],settled
  browser.save_screenshot(str(PROOF/'02-actually-served-and-paid.png'))
  browser.find_element(By.CSS_SELECTOR,'[data-tab="journal"]').click()
  journal=browser.execute_script("""return (()=>{const el=document.getElementById('sheetBody');
    return {records:document.querySelectorAll('[data-regular-name]').length,
      hasGuest:!!document.querySelector('[data-regular-name=%s]'),
      hasTip:el.textContent.includes('今日熟客小费'),
      hasTrust:el.textContent.includes('成功接待')};})()"""%json.dumps(first['name'],ensure_ascii=False))
  assert journal['records']>=1 and journal['hasGuest'] and journal['hasTip'] and journal['hasTrust'],journal
  browser.save_screenshot(str(PROOF/'03-customer-ledger.png'))
  browser.refresh()
  wait.until(lambda d:d.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  restored=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw(),r=s.regulars[%s];
    return {money:s.money,served:r?.served,missed:r?.missed,
      regularBonus:s.today.regularBonus,regularsServed:s.today.regularsServed};})()"""%json.dumps(first['name'],ensure_ascii=False))
  assert restored['money']==settled['money'] and restored['served']==4,restored
  assert restored['regularBonus']==3 and restored['regularsServed']==1,restored
  browser.set_window_size(390,844)
  browser.find_element(By.CSS_SELECTOR,'[data-tab="journal"]').click()
  mobile=browser.execute_script("""return (()=>{const el=document.querySelector('.regular-card'),r=el.getBoundingClientRect();
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      cardLeft:r.left,cardRight:r.right,cardCount:document.querySelectorAll('.regular-card').length};})()""")
  assert mobile['cardCount']>0 and mobile['cardLeft']>=0,mobile
  assert mobile['cardRight']<=mobile['width']+2 and mobile['scrollWidth']<=mobile['width']+5,mobile
  browser.save_screenshot(str(PROOF/'04-mobile-guest-history.png'))
  errors=[e['message'] for e in browser.get_log('browser') if e['level']=='SEVERE' and
          ('Uncaught' in e['message'] or '127.0.0.1' in e['message'])]
  assert not errors,errors
  report={'status':'PASS','guest':first,'cooked':cooked,'served':settled,
          'journal':journal,'restored':restored,'mobile':mobile,'errors':errors}
  (PROOF/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps(report,ensure_ascii=False,indent=2))
 finally:
  browser.quit()
  server.shutdown()
