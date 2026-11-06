"""Actual Chromium acceptance of staff training and assistant growth.
No DOM injection or direct money/XP mutation; the real game engine advances.
A disposable browser profile is used, without real player saves.
"""
import json
import pathlib
import socketserver
import threading
import time
from http.server import SimpleHTTPRequestHandler
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROOF=ROOT/'test-artifacts'/'staff'
PROOF.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass

with socketserver.TCPServer(('127.0.0.1',0),Handler) as server:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 opts=Options()
 for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,820'):
  opts.add_argument(arg)
 opts.set_capability('goog:loggingPrefs',{'browser':'ALL'})
 browser=webdriver.Chrome(options=opts)
 try:
  browser.get('http://127.0.0.1:%d/'%server.server_address[1])
  WebDriverWait(browser,30).until(lambda d:d.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  # Day one is played by the normal simulation (all impatient guests leave);
  # the player does not gain fictional food, sales or team experience.
  browser.find_element(By.ID,'primaryAction').click()
  browser.execute_script('window.COZY_BISTRO.test.step(240)')
  assert browser.execute_script("return window.COZY_BISTRO.test.getRaw().phase")=='summary'
  browser.find_element(By.ID,'primaryAction').click()
  start=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
    return {day:s.day,phase:s.phase,money:s.money,xp:s.assistantXp,spent:s.today.spent};})()""")
  assert start['day']==2 and start['phase']=='planning' and start['money']==270,start
  browser.find_element(By.CSS_SELECTOR,'[data-tab="staff"]').click()
  assert 'LV 1' in browser.find_element(By.ID,'sheetBody').text
  train=browser.find_element(By.CSS_SELECTOR,'[data-cmd="train-assistant"]')
  assert train.is_enabled()
  browser.save_screenshot(str(PROOF/'01-trainee.png'))
  train.click() # UI -> engine -> finance -> persistent state
  after=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
    return {money:s.money,spent:s.today.spent,training:s.today.staffTraining,
      level:s.assistantXp,days:s.assistantTrainedDay,sessions:s.assistantTrainingSessions};})()""")
  assert after=={'money':130,'spent':140,'training':140,'level':8,'days':2,'sessions':1},after
  assert 'LV 2' in browser.find_element(By.ID,'sheetBody').text
  assert not browser.find_element(By.CSS_SELECTOR,'[data-cmd="train-assistant"]').is_enabled()
  hire=browser.find_element(By.CSS_SELECTOR,'[data-cmd="hire-assistant"]')
  assert hire.is_enabled()
  hire.click()
  hired=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
    return {money:s.money,spent:s.today.spent,wage:s.assistantShiftWage,hired:s.assistantHired,
      xp:s.assistantXp};})()""")
  assert hired=={'money':20,'spent':250,'wage':110,'hired':True,'xp':8},hired
  browser.save_screenshot(str(PROOF/'02-trained-and-hired.png'))
  browser.find_element(By.ID,'closeSheet').click()
  browser.find_element(By.ID,'primaryAction').click()
  browser.execute_script('window.COZY_BISTRO.test.step(23)')
  work=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
   return {phase:s.phase,skillXp:s.assistantXp,served:s.assistantServed,
    cooked:s.orders.some(o=>o.status==='cooking'),money:s.money,
    remaining:s.scheduled.length};})()""")
  assert work['skillXp']>8,work
  # A real successful cooking or serving action, not a test-added XP bonus.
  browser.save_screenshot(str(PROOF/'03-real-staff-growth.png'))
  time.sleep(4.0) # normal app autosave tick, not direct save injection
  browser.refresh()
  WebDriverWait(browser,30).until(lambda d:d.execute_script('return !!window.COZY_BISTRO'))
  browser.find_element(By.ID,'enterBtn').click()
  restored=browser.execute_script("""return (()=>{const s=window.COZY_BISTRO.test.getRaw();
   return {day:s.day,skillXp:s.assistantXp,trained:s.assistantTrainedDay,
     hired:s.assistantHired,training:s.today.staffTraining,wage:s.assistantShiftWage};})()""")
  assert restored['day']==2 and restored['skillXp']>=8 and restored['trained']==2,restored
  assert restored['hired'] and restored['training']==140 and restored['wage']==110,restored
  browser.set_window_size(390,844)
  browser.find_element(By.CSS_SELECTOR,'[data-tab="staff"]').click()
  layout=browser.execute_script("""return (()=>({
    window:innerWidth,page:document.documentElement.scrollWidth,
    sheet:document.getElementById('sheetBody').getBoundingClientRect().width,
    trainedText:document.getElementById('sheetBody').textContent.includes('LV 2') }))()""")
  assert layout['page']<=layout['window']+5 and layout['trainedText'],layout
  browser.save_screenshot(str(PROOF/'04-mobile-career.png'))
  errors=[e['message'] for e in browser.get_log('browser') if e['level']=='SEVERE']
  assert not [e for e in errors if 'Uncaught' in e or '127.0.0.1' in e],errors
  result={'training':after,'hired':hired,'work':work,'restored':restored,'mobile':layout,'consoleErrors':errors}
  (PROOF/'staff-browser-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps(result,ensure_ascii=False,indent=2))
 finally:
  browser.quit()
  server.shutdown()
