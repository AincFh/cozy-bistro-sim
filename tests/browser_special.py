"""Actual Chrome acceptance of daily menu strategy and customer economics."""
import json
import pathlib
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROOF=ROOT/'test-artifacts'/'specials'
PROOF.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass

with socketserver.TCPServer(('127.0.0.1',0),Handler) as server:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 options=Options()
 options.add_argument('--headless=new')
 options.add_argument('--no-sandbox')
 options.add_argument('--disable-dev-shm-usage')
 options.add_argument('--window-size=1280,820')
 options.set_capability('goog:loggingPrefs',{'browser':'ALL'})
 browser=webdriver.Chrome(options=options)
 try:
  browser.get('http://127.0.0.1:%s/'%server.server_address[1])
  WebDriverWait(browser,30).until(lambda b:b.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  initial=browser.execute_script('return window.COZY_BISTRO.getState()')
  assert initial['money']==270 and initial['phase']=='planning',initial
  browser.find_element(By.CSS_SELECTOR,'[data-tab="menu"]').click()
  assert "CHEF'S DAILY PICK" in browser.find_element(By.ID,'sheetBody').text
  assert len(browser.find_elements(By.CSS_SELECTOR,'[data-cmd^="special:"]:not([disabled])'))==3
  browser.save_screenshot(str(PROOF/'01-marketing-planning.png'))
  browser.execute_script("document.querySelector('[data-cmd=\"special:citrus\"]').click()")
  after=browser.execute_script('return window.COZY_BISTRO.getState()')
  assert after['dailySpecial']=='citrus' and after['money']==232,after
  assert '今日主推' in browser.find_element(By.ID,'sheetBody').text
  assert '◈ 19 →' in browser.find_element(By.ID,'sheetBody').text
  browser.save_screenshot(str(PROOF/'02-citrus-selected.png'))
  # Retargeting an existing campaign does not multiply the one-time fee.
  browser.execute_script("document.querySelector('[data-cmd=\"special:toast\"]').click()")
  switched=browser.execute_script('return window.COZY_BISTRO.getState()')
  assert switched['dailySpecial']=='toast' and switched['money']==232,switched
  browser.execute_script("document.querySelector('[data-cmd=\"special:citrus\"]').click()")
  browser.find_element(By.ID,'closeSheet').click()
  browser.find_element(By.ID,'primaryAction').click()
  started=browser.execute_script("""return (() => {
   const s=window.COZY_BISTRO.test.getRaw();
   return {phase:s.phase,featured:s.dailySpecial,
     walkIns:s.scheduled.filter(x=>!x.contract&&x.recipe==='citrus').length,
     total:s.scheduled.length}
  })()""")
  assert started['phase']=='open' and started['walkIns']>=1,started
  candidate=browser.execute_script("""return (() => {
   const r=window.COZY_BISTRO.test.getRaw().scheduled.find(
     x=>x.recipe==='citrus'&&!x.contract);
   return {id:r.id,arrival:r.arrival};
  })()""")
  browser.execute_script("window.COZY_BISTRO.test.step(%s)"%(candidate['arrival']+.15))
  browser.execute_script("""document.querySelector(
    '[data-order="%s"][data-action="cook"]').click()"""%candidate['id'])
  browser.execute_script("window.COZY_BISTRO.test.step(5.8)")
  order=browser.execute_script("""return window.COZY_BISTRO.test.getRaw().orders.find(
    x=>x.id===%s)?.status"""%candidate['id'])
  assert order=='ready',order
  browser.save_screenshot(str(PROOF/'03-featured-customer.png'))
  browser.execute_script("""document.querySelector(
    '[data-order="%s"][data-action="serve"]').click()"""%candidate['id'])
  sold=browser.execute_script("""return (() => {
   const s=window.COZY_BISTRO.test.getRaw();
   return {money:s.money,specialBonus:s.today.specialBonus,
     featuredServed:s.today.specialServed,totalFeatured:s.specialServed,
     campaigns:s.specialsLaunched,marketingCost:s.today.spent,
     remaining:s.orders.some(o=>o.id===%s)}
  })()"""%candidate['id'])
  assert sold['specialBonus']>0 and sold['featuredServed']==1,sold
  assert sold['campaigns']==1 and sold['marketingCost']==38,sold
  assert not sold['remaining'],sold
  browser.refresh()
  WebDriverWait(browser,30).until(lambda b:b.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  resumed=browser.execute_script('return window.COZY_BISTRO.getState()')
  assert resumed['dailySpecial']=='citrus' and resumed['specialServed']==1,resumed
  browser.set_window_size(390,844)
  browser.find_element(By.CSS_SELECTOR,'[data-tab="menu"]').click()
  mobile=browser.execute_script("""return (() => {
   const e=document.querySelector('.feature-highlight'),r=e.getBoundingClientRect(),
     panel=document.getElementById('sheetBody').getBoundingClientRect();
   return {viewport:innerWidth,left:r.left,right:r.right,scroll:document.documentElement.scrollWidth,
      panelLeft:panel.left,panelRight:panel.right,selected:!!document.querySelector('.featured-card')}
  })()""")
  assert mobile['left']>=0 and mobile['right']<=mobile['viewport']+2,mobile
  assert mobile['selected'],mobile
  browser.save_screenshot(str(PROOF/'04-mobile-marketing.png'))
  errors=[x['message'] for x in browser.get_log('browser')
          if x['level']=='SEVERE' and 'favicon' not in x['message']]
  assert not errors,errors
  result={'status':'PASS','start':initial,'scheduled':started,'sold':sold,'save':resumed,
          'mobile':mobile,'consoleErrors':errors}
  (PROOF/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(result,ensure_ascii=False))
 finally:
  browser.quit();server.shutdown()
