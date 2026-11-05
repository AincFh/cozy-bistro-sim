"""COZY BISTRO contract browser acceptance — real Chromium, real inputs.
No replacement game implementation and no mocked state transitions.
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

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROOF = ROOT / "test-artifacts" / "contracts"
PROOF.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass

with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = Options()
    chrome.add_argument("--headless=new")
    chrome.add_argument("--no-sandbox")
    chrome.add_argument("--disable-dev-shm-usage")
    chrome.add_argument("--window-size=1440,900")
    chrome.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    browser = webdriver.Chrome(options=chrome)
    browser.set_page_load_timeout(35)
    wait = WebDriverWait(browser, 25)
    try:
        browser.get("http://127.0.0.1:%d/" % server.server_address[1])
        wait.until(lambda b: b.execute_script("return !!window.COZY_BISTRO"))
        browser.find_element(By.ID, "enterBtn").click()
        browser.find_element(By.CSS_SELECTOR, '[data-tab="contracts"]').click()
        assert browser.find_element(By.ID, "sheetTitle").text == "社区订餐委托"
        offers = browser.find_elements(By.CSS_SELECTOR, '#sheetBody button[data-cmd^="contract:"]')
        assert len(offers) == 2, len(offers)
        browser.save_screenshot(str(PROOF / "01-offers-desktop.png"))
        starting = browser.execute_script("return window.COZY_BISTRO.test.getRaw().money")
        offers[0].click()
        contract = browser.execute_script("""return (() => {
          const s=window.COZY_BISTRO.test.getRaw();return {contract:s.contract,money:s.money,spent:s.today.spent}
        })()""")
        assert contract["contract"]["status"] == "accepted", contract
        assert contract["money"] == starting-contract["contract"]["deposit"], contract
        assert "已接单" in browser.find_element(By.ID, "sheetBody").text
        browser.save_screenshot(str(PROOF / "02-signed-contract.png"))
        browser.find_element(By.ID, "closeSheet").click()
        browser.find_element(By.ID, "primaryAction").click()
        opened = browser.execute_script("""return (() => {
          const s=window.COZY_BISTRO.test.getRaw();
          return {phase:s.phase,required:s.contract.count,scheduled:s.scheduled.filter(x=>x.contract).length}
        })()""")
        assert opened["phase"] == "open" and opened["required"] == opened["scheduled"], opened
        browser.execute_script("window.COZY_BISTRO.test.step(10)")
        assert "团体订餐" in browser.find_element(By.ID, "orderList").text
        browser.save_screenshot(str(PROOF / "03-live-delivery-orders.png"))
        # The exported browser-local state must survive a real full reload.
        browser.refresh()
        wait.until(lambda b: b.execute_script("return !!window.COZY_BISTRO"))
        browser.find_element(By.ID, "enterBtn").click()
        restored = browser.execute_script("""return (() => {
          const s=window.COZY_BISTRO.test.getRaw();
          return {phase:s.phase,contract:s.contract,
            openContractOrders:s.orders.filter(x=>x.contract).length}
        })()""")
        assert restored["phase"] == "open" and restored["contract"]["status"] == "active", restored
        assert restored["openContractOrders"] >= 1, restored
        browser.set_window_size(390, 844)
        time.sleep(.35)
        browser.find_element(By.CSS_SELECTOR, '[data-tab="contracts"]').click()
        assert "已交付" in browser.find_element(By.ID, "sheetBody").text
        mobile = browser.execute_script("""return {
          width:innerWidth,
          scrollWidth:document.documentElement.scrollWidth,
          contractTitle:document.getElementById('sheetTitle').textContent,
          dialog:!!document.querySelector('[role="dialog"]')
        }""")
        assert mobile["scrollWidth"] <= mobile["width"] + 4, mobile
        browser.save_screenshot(str(PROOF / "04-mobile-contract.png"))
        errors = [x["message"] for x in browser.get_log("browser") if x["level"] == "SEVERE" and "favicon" not in x["message"]]
        assert not errors, errors
        report = {"ok": True, "offerCount":len(offers), "signed": contract, "opened": opened, "restored":restored, "mobile": mobile, "browserErrors": errors}
        (PROOF / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        browser.quit()
        server.shutdown()
