"""Play the actual precision-plating timing control with Selenium and the real kitchen engine."""
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
PROOF=ROOT/'test-artifacts'/'plating';PROOF.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,*args):pass
with socketserver.TCPServer(('127.0.0.1',0),Handler) as server:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    opts=Options();opts.add_argument('--headless=new');opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage');opts.add_argument('--window-size=1200,820')
    opts.set_capability('goog:loggingPrefs',{'browser':'ALL'})
    browser=webdriver.Chrome(options=opts)
    try:
        browser.get('http://127.0.0.1:%s/'%server.server_address[1])
        WebDriverWait(browser,25).until(lambda b:b.execute_script('return !!window.COZY_BISTRO'))
        browser.find_element(By.ID,'enterBtn').click()
        browser.find_element(By.ID,'primaryAction').click()
        browser.execute_script('window.COZY_BISTRO.test.step(9)')
        cook=browser.find_elements(By.CSS_SELECTOR,'#orderList button[data-action="cook"]:not([disabled])')
        assert cook,'No real cookable order spawned'
        cook[0].click()
        browser.execute_script('window.COZY_BISTRO.test.step(16)')
        ready=browser.find_elements(By.CSS_SELECTOR,'#orderList button[data-action="plate"]')
        assert ready,'No plateable ready order after actual cooking'
        before=browser.execute_script('return window.COZY_BISTRO.test.getRaw().money')
        ready[0].click()
        assert not browser.find_element(By.ID,'platingOverlay').get_attribute('hidden')
        browser.save_screenshot(str(PROOF/'01-timing-game.png'))
        # The oscillating UI needle has to travel to the visible target.
        # Stop using a real click, not a direct engine score injection.
        within=False
        deadline=time.monotonic()+5.2
        while time.monotonic()<deadline:
            dist=browser.execute_script("""return Math.abs(
                parseFloat(document.getElementById('platingNeedle').style.left)-
                parseFloat(document.getElementById('platingTarget').style.left))""")
            if dist<7.0:
                browser.find_element(By.ID,'platingStop').click()
                within=True
                break
            time.sleep(.06)
        assert within,'Plating needle never entered the target window'
        current=browser.execute_script("""return (() => {
            const s=window.COZY_BISTRO.test.getRaw();
            return {platingAttempts:s.platingAttempts,platingPerfect:s.platingPerfect,
              platingGood:s.platingGood,bonus:s.today.platingBonus,money:s.money,orders:s.orders.length};
        })()""")
        assert current['platingAttempts']==1 and current['bonus']>0,current
        assert current['money']>before,current
        assert browser.find_element(By.ID,'platingOverlay').get_attribute('hidden')
        browser.save_screenshot(str(PROOF/'02-served-and-bonus.png'))
        browser.refresh()
        WebDriverWait(browser,25).until(lambda b:b.execute_script('return !!window.COZY_BISTRO'))
        browser.find_element(By.ID,'enterBtn').click()
        recovered=browser.execute_script('return window.COZY_BISTRO.getState()')
        assert recovered['platingPerfect']==current['platingPerfect'],recovered
        browser.set_window_size(390,844)
        browser.execute_script('window.COZY_BISTRO.test.step(8)')
        # Confirm that the overlay remains usable and in bounds on phones.
        option=browser.find_elements(By.CSS_SELECTOR,'#orderList [data-action="plate"]')
        if option:
            option[0].click()
            mobile=browser.execute_script("""return (() => {
                const p=document.querySelector('.plating-panel').getBoundingClientRect();
                return {width:innerWidth,panelLeft:p.left,panelRight:p.right,buttons:
                    [...document.querySelectorAll('.plating-actions button')].map(b=>b.getBoundingClientRect().width)}
            })()""")
            assert mobile['panelLeft']>=0 and mobile['panelRight']<=mobile['width']+1,mobile
            browser.save_screenshot(str(PROOF/'03-mobile-plating.png'))
        else:
            mobile={'skipped':'No extra ready order yet'}
        errors=[x['message'] for x in browser.get_log('browser') if x['level']=='SEVERE' and 'favicon' not in x['message']]
        assert not errors,errors
        report={'result':'PASS','realTiming':current,'saved':recovered,'mobile':mobile,'consoleErrors':errors}
        (PROOF/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False))
    finally:
        browser.quit();server.shutdown()
